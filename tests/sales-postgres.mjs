import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { resolve } from "node:path";

const require = createRequire(
  resolve(process.env.INTELLIGENCE_PG_TEST_DEPS || ".", "package.json"),
);
const { PGlite } = require("@electric-sql/pglite");
const db = new PGlite();
const owner = "00000000-0000-4000-8000-000000000001";
const other = "00000000-0000-4000-8000-000000000002";
const link = "00000000-0000-4000-8000-000000000003";
const secret = "a".repeat(64);
const record = (kind, hash = secret) =>
  db.query("select * from sales_record_event($1,$2,'sale-42',$3,9990,8000,null)", [
    link,
    hash,
    kind,
  ]);

try {
  await db.exec(`
    create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create table auth.users(id uuid primary key);
    insert into auth.users values ('${owner}'), ('${other}');
    create function auth.uid() returns uuid language sql as $$
      select nullif(current_setting('test.user_id', true), '')::uuid
    $$;
    create function public.platform_approved_user(p_user uuid) returns boolean language sql as $$
      select p_user in ('${owner}'::uuid, '${other}'::uuid)
    $$;
    create function public.platform_is_approved() returns boolean language sql as $$
      select public.platform_approved_user(auth.uid())
    $$;
    grant usage on schema auth to authenticated;
  `);
  await assert.rejects(record("approved"), /does not exist/);
  await db.exec(
    await readFile(
      new URL("../supabase/migrations/20261122213000_scalehot_sales.sql", import.meta.url),
      "utf8",
    ),
  );
  await db.exec(
    await readFile(
      new URL(
        "../supabase/migrations/20261124203000_archive_custom_sales_webhooks.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  await db.exec(`
    set role service_role;
    insert into sales_webhook_links(id,user_id,provider,label,secret_hash) values ('${link}','${owner}','custom','Loja','${secret}');
    insert into sales_push_devices(user_id,endpoint,public_key,auth_key)
    values ('${owner}','https://fcm.googleapis.com/sale-test','pub','auth'),
           ('${other}','https://fcm.googleapis.com/different-user','pub','auth');
  `);
  assert.equal((await record("approved", "b".repeat(64))).rows[0].outcome, "unauthorized");
  const first = (await record("approved")).rows[0];
  assert.equal(first.outcome, "recorded");
  assert.deepEqual((await record("approved")).rows[0], {
    event_id: first.event_id,
    outcome: "duplicate",
  });
  const refund = (await record("reversed")).rows[0];
  assert.equal(refund.outcome, "recorded");
  assert.equal(
    (await db.query("select * from sales_claim_push($1)", [refund.event_id])).rows.length,
    0,
  );
  const job = (await db.query("select * from sales_claim_push($1)", [first.event_id])).rows[0];
  assert.equal(job.endpoint, "https://fcm.googleapis.com/sale-test");
  assert.equal((await db.query("select * from sales_claim_push()")).rows.length, 0);
  await db.query("select sales_finish_push($1,$2,'retry')", [job.job_id, job.lease]);
  await db.exec(
    "reset role; update sales_push_outbox set next_attempt=now(); set role service_role;",
  );
  const retried = (await db.query("select * from sales_claim_push()")).rows[0];
  assert.equal(retried.job_id, job.job_id);
  assert.notEqual(retried.lease, job.lease);
  await db.query("select sales_finish_push($1,$2,'sent')", [retried.job_id, retried.lease]);
  assert.equal((await db.query("select * from sales_claim_push()")).rows.length, 0);
  await db.exec(`
    insert into sales_goals (user_id, monthly_cents) values ('${owner}', 90000);
    update sales_push_devices set notify_approved = false where user_id = '${owner}';
  `);
  const quiet = (
    await db.query(
      "select * from sales_record_event($1,$2,'quiet','approved',990,800,now() - interval '3 days')",
      [link, secret],
    )
  ).rows[0];
  assert.equal(
    (await db.query("select * from sales_claim_push($1)", [quiet.event_id])).rows.length,
    0,
  );
  await db.query(
    "update sales_push_devices set notify_approved = true, notify_since = now() where user_id = $1",
    [owner],
  );
  assert.equal(
    (await db.query("select * from sales_claim_push($1)", [quiet.event_id])).rows.length,
    0,
  );
  await db.exec("reset role; set role anon");
  await assert.rejects(db.query("select sales_overview(7)"), /permission denied/);
  await db.exec(
    `reset role; set role authenticated; select set_config('test.user_id','${owner}',false);`,
  );
  await assert.rejects(record("approved"), /permission denied/);
  await assert.rejects(
    db.query("select secret_hash from sales_webhook_links"),
    /permission denied/,
  );
  const snapshot = (await db.query("select sales_overview(7) as snapshot")).rows[0].snapshot;
  assert.equal(snapshot.approved, 2);
  assert.equal(snapshot.gross_cents, 10980);
  assert.equal(snapshot.reversed_cents, 9990);
  assert.equal(snapshot.reported_net_cents, 8800);
  assert.equal(snapshot.series.length, 7);
  assert.equal(snapshot.recent.length, 3);
  assert.equal(snapshot.goal_cents, 90000);
  const today = (await db.query("select sales_overview(30,null,'today') as snapshot")).rows[0]
    .snapshot;
  assert.equal(today.approved, 1);
  assert.equal(today.reversed, 1);
  assert.equal(today.monthly.length, 1);
  assert.equal(snapshot.links[0].secret_hash, undefined);
  await db.query("select set_config('test.user_id',$1,false)", [other]);
  const otherSnapshot = (await db.query("select sales_overview(7) as snapshot")).rows[0].snapshot;
  assert.equal(otherSnapshot.approved, 0);
  assert.deepEqual(otherSnapshot.links, []);
  assert.deepEqual(otherSnapshot.recent, []);
  assert.equal(otherSnapshot.goal_cents, null);
  await db.exec("reset role; set role service_role");
  await assert.rejects(
    db.query("update sales_webhook_links set archived_at=now() where id=$1", [link]),
    /sales_webhook_links_archived_opt_out/,
  );
  await db.query(
    "update sales_webhook_links set active=false,archived_at=now(),secret_hash=$2 where id=$1",
    [link, "c".repeat(64)],
  );
  assert.equal(
    (await db.query("select id from sales_webhook_links where archived_at is null")).rows.length,
    0,
  );
  assert.equal((await record("approved")).rows[0].outcome, "unauthorized");
  assert.equal((await record("approved", "c".repeat(64))).rows[0].outcome, "unauthorized");
  await db.exec("reset role; set role authenticated");
  await db.query("select set_config('test.user_id',$1,false)", [owner]);
  const archivedSnapshot = (await db.query("select sales_overview(7) as snapshot")).rows[0]
    .snapshot;
  assert.equal(archivedSnapshot.recent.length, 3);
  assert.equal(archivedSnapshot.gross_cents, snapshot.gross_cents);
  console.log(
    "PASS: intake, deduplication, reversals, monthly goal, dashboard periods, push preferences and retries, tenant isolation and revoked links",
  );
} finally {
  await db.close();
}
