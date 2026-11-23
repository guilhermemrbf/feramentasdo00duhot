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
const source = "00000000-0000-4000-8000-000000000004";
const otherSource = "00000000-0000-4000-8000-000000000005";
const otherLink = "00000000-0000-4000-8000-000000000006";
const saleSecret = "a".repeat(64);
const sourceSecret = "b".repeat(64);
const click = "c".repeat(64);
const secondClick = "d".repeat(64);
const register = (id, kind = "approved") =>
  db.query("select * from sales_record_event($1,$2,$3,$4,8000,7500,null)", [
    link,
    saleSecret,
    id,
    kind,
  ]);
const bind = async (token, order, id = source, key = sourceSecret) =>
  (await db.query("select sales_tracking_bind($1,$2,$3,$4) as outcome", [id, key, token, order]))
    .rows[0].outcome;
const snapshot = async (user) => {
  await db.query("select set_config('test.user_id',$1,false)", [user]);
  await db.exec("set role authenticated");
  const result = (await db.query("select sales_tracking_overview() as snapshot")).rows[0].snapshot;
  await db.exec("reset role");
  return result;
};

try {
  await db.exec(`
    create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create table auth.users(id uuid primary key);
    insert into auth.users values ('${owner}'), ('${other}');
    create function auth.uid() returns uuid language sql as $$
      select nullif(current_setting('test.user_id',true),'')::uuid
    $$;
    create function public.platform_approved_user(p_user uuid) returns boolean language sql as $$
      select p_user in ('${owner}'::uuid,'${other}'::uuid)
    $$;
    create function public.platform_is_approved() returns boolean language sql as $$
      select public.platform_approved_user(auth.uid())
    $$;
    grant usage on schema auth to authenticated;
  `);
  for (const filename of [
    "20261122213000_scalehot_sales.sql",
    "20261123120000_scalehot_attribution.sql",
    "20261123121000_scalehot_meta_ads.sql",
    "20261123122000_scalehot_tracking_report.sql",
  ]) {
    await db.exec(
      await readFile(new URL("../supabase/migrations/" + filename, import.meta.url), "utf8"),
    );
  }
  await db.query(
    "insert into sales_webhook_links(id,user_id,provider,label,secret_hash) values ($1,$2,'syncpay','Loja',$3),($4,$5,'syncpay','Outra', $6)",
    [link, owner, saleSecret, otherLink, other, "e".repeat(64)],
  );
  const createSource = (id, user, gateway, hash) =>
    db.query(
      "insert into sales_tracking_sources(id,user_id,link_id,origin,secret_hash) values ($1,$2,$3,'https://loja.example',$4)",
      [id, user, gateway, hash],
    );
  await assert.rejects(createSource(source, owner, otherLink, sourceSecret), /foreign key/);
  await createSource(source, owner, link, sourceSecret);
  await createSource(otherSource, other, otherLink, "f".repeat(64));

  await db.query(
    "insert into sales_tracking_clicks(token_hash,source_id,utm_source,utm_campaign) values ($1,$3,'meta','Lançamento'),($2,$3,'google','Busca')",
    [click, secondClick, source],
  );
  assert.equal(await bind(click, "order-1", otherSource, "f".repeat(64)), "invalid_click");
  assert.equal(await bind(click, "order-1", source, saleSecret), "unauthorized");
  await register("order-1", "reversed");
  const first = await register("order-1");
  assert.equal(first.rows[0].outcome, "recorded");
  assert.equal((await snapshot(owner)).unattributed, 1);
  assert.equal(await bind(click, "order-1"), "bound");
  assert.equal(await bind(click, "order-1"), "bound");
  assert.equal(await bind(secondClick, "order-1"), "conflict");
  assert.equal((await register("order-1")).rows[0].outcome, "duplicate");
  await register("order-2");
  const data = await snapshot(owner);
  assert.equal(data.approved, 2);
  assert.equal(data.attributed, 1);
  assert.equal(data.unattributed, 1);
  assert.deepEqual(data.campaigns, [
    {
      source: "meta",
      medium: null,
      campaign: "Lançamento",
      campaign_id: null,
      ad_id: null,
      sales: 1,
      gross_cents: 8000,
      reversed_cents: 8000,
    },
  ]);
  assert.equal((await snapshot(other)).approved, 0);
  await db.query("select set_config('test.user_id',$1,false)", [owner]);
  await db.exec("set role authenticated");
  const report = (await db.query("select sales_tracking_report(7, 'campaign') as value")).rows[0]
    .value;
  assert.equal(report.series.length, 7);
  assert.equal(report.gross_attributed_cents, 8000);
  assert.equal(report.reversed_attributed_cents, 8000);
  assert.equal(
    report.series.reduce((total, point) => total + point.attributed, 0),
    1,
  );
  assert.equal(report.campaigns[0].campaign, "Lançamento");
  await assert.rejects(
    db.query("select sales_tracking_report(500, 'campaign')"),
    /invalid report/i,
  );
  await db.exec("reset role");
  await db.exec("set role authenticated");
  await assert.rejects(
    db.query("select token_hash from sales_tracking_clicks"),
    /permission denied/,
  );
  await db.exec("reset role");
  await db.query(
    "update sales_tracking_clicks set created_at=now()-interval '8 days' where token_hash=$1",
    [secondClick],
  );
  assert.equal(await bind(secondClick, "expired-order"), "invalid_click");
  await db.query("update sales_tracking_sources set active=false where id=$1", [source]);
  assert.equal(await bind(click, "order-2"), "unauthorized");
  const metaState = "9".repeat(64);
  await db.query(
    "insert into sales_meta_ads_connections(user_id,state_hash,state_expires_at) values ($1,$2,now()+interval '10 minutes')",
    [owner, metaState],
  );
  await db.exec("set role authenticated");
  await assert.rejects(db.query("select * from sales_meta_ads_connections"), /permission denied/);
  await assert.rejects(
    db.query("select sales_meta_ads_claim_state($1)", [metaState]),
    /permission denied/,
  );
  await db.exec("set role service_role");
  const claim = async () =>
    (await db.query("select sales_meta_ads_claim_state($1) as owner", [metaState])).rows[0].owner;
  const finish = async (who = owner) =>
    (
      await db.query(
        "select sales_meta_ads_finish_state($1,$2,'123','v1.fixture',now()+interval '60 days','[]'::jsonb) as saved",
        [who, metaState],
      )
    ).rows[0].saved;
  assert.equal(await finish(), false);
  assert.equal(await claim(), owner);
  assert.equal(await claim(), null);
  assert.equal(await finish(other), false);
  assert.equal(await finish(), true);
  assert.equal(await finish(), false);
  await db.query(
    "update sales_meta_ads_connections set state_hash=$1,state_claimed_at=null,state_expires_at=now()-interval '1 second'",
    [metaState],
  );
  assert.equal(await claim(), null);
  await db.exec("reset role");
  console.log(
    "ScaleHot attribution PostgreSQL: ownership, late binding, duplicate, refund, expiry and revocation passed",
  );
} finally {
  await db.close();
}
