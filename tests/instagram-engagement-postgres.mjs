import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { resolve } from "node:path";

const require = createRequire(
  resolve(process.env.INTELLIGENCE_PG_TEST_DEPS || ".", "package.json"),
);
const { PGlite } = require("@electric-sql/pglite");
const db = new PGlite();
const workspace = "00000000-0000-4000-8000-000000000001";
const otherWorkspace = "00000000-0000-4000-8000-000000000002";
const accountA = "00000000-0000-4000-8000-000000000010";
const accountB = "00000000-0000-4000-8000-000000000020";
const otherAccount = "00000000-0000-4000-8000-000000000030";
const lease = "00000000-0000-4000-8000-000000000100";
const loadMigration = (file) =>
  readFile(new URL("../supabase/migrations/" + file, import.meta.url), "utf8");
const top = async (account = null) =>
  (await db.query("select public.get_instagram_top_posts($1, $2) as report", [workspace, account]))
    .rows[0].report;
const analytics = async (account = null) =>
  (
    await db.query("select public.get_instagram_analytics($1, $2, null, null, 0) as report", [
      workspace,
      account,
    ])
  ).rows[0].report;

try {
  await db.exec(`
    create role anon;
    create role authenticated;
    create role service_role;
    create schema cron;
    create function cron.schedule(text, text, text) returns integer
      language sql as 'select 1';
    create function public.is_workspace_member(uuid) returns boolean
      language sql as $$ select $1::text = current_setting('test.workspace', true) $$;
    create table public.workspaces (id uuid primary key, timezone text not null);
    create table public.instagram_accounts (
      id uuid primary key, workspace_id uuid not null, username text not null,
      instagram_user_id text, auth_mode text, connection_status text, last_verified_at timestamptz
    );
    create table public.posts (
      workspace_id uuid, instagram_account_id uuid, status text,
      published_at timestamptz, scheduled_at timestamptz, created_at timestamptz,
      content_type text
    );
  `);
  await db.query("select set_config('test.workspace', $1, false)", [workspace]);
  await db.query(
    "insert into public.workspaces values ($1,'America/Sao_Paulo'), ($2,'America/Sao_Paulo')",
    [workspace, otherWorkspace],
  );
  await db.query(
    "insert into public.instagram_accounts(id,workspace_id,username,connection_status) values ($1,$4,'perfil_a','connected'), ($2,$4,'perfil_b','connected'), ($3,$5,'privado','connected')",
    [accountA, accountB, otherAccount, workspace, otherWorkspace],
  );
  await db.exec(await loadMigration("20261110170000_instagram_analytics.sql"));
  await db.exec(await loadMigration("20261110203000_instagram_top_posts.sql"));
  await db.query(
    "insert into private.instagram_analytics_sync(account_id,followers) values ($1,120),($2,80),($3,999)",
    [accountA, accountB, otherAccount],
  );
  await db.query(
    `
    insert into private.instagram_analytics_media (account_id,media_id,kind,published_at,views,likes,comments)
    values ($1,'most-views','reel',now(),9000,1,1), ($1,'most-interactions','reel',now(),null,120,20),
           ($2,'not-enough','reel',now(),500,1000,null), ($3,'external','reel',now(),5000,5000,500),
           ($2,'photo','post',now(),22,200,300), ($2,'older','reel',now()-interval '45 days',33,500,500)
  `,
    [accountA, accountB, otherAccount],
  );
  await db.query(
    `
    insert into private.instagram_analytics_media (account_id,media_id,kind,published_at,views,likes,comments)
    select $1, 'id-'||n, 'reel', now(), 100*n, n, 2
    from generate_series(1, 12) n
  `,
    [accountB],
  );

  assert.equal((await top()).ranking[0].media_id, "most-views");
  await db.exec(await loadMigration("20261119170000_instagram_rank_reels_by_engagement.sql"));
  await db.exec("set role authenticated");
  const all = await top();
  assert.equal(all.ranking_basis, "engagement");
  assert.equal(all.ranking.length, 10);
  assert.equal(all.ranking[0].username, "perfil_a");
  assert.equal(all.ranking[0].media_id, "most-interactions");
  assert.equal(all.ranking[0].views, null);
  assert.equal(all.ranking[0].interactions, 140);
  assert.deepEqual(
    all.ranking.map((item) => item.position),
    Array.from({ length: 10 }, (_, i) => i + 1),
  );
  assert.equal(all.totals.reels, 15);
  assert.equal(all.totals.measured, 14);
  assert.equal(all.totals.interactions_measured, 14);
  assert.ok(
    all.ranking.every(
      ({ media_id }) => !["not-enough", "older", "external", "photo"].includes(media_id),
    ),
  );
  const b = await top(accountB);
  assert.equal(b.leader.username, "perfil_b");
  assert.ok(b.ranking.every((item) => item.account_id === accountB));
  assert.equal((await top(accountA)).totals.views, 9000);
  assert.equal((await top(otherAccount)).totals.views, null);
  assert.deepEqual(
    (await analytics()).profiles.map((profile) => profile.followers),
    [120, 80],
  );
  assert.deepEqual(
    (await analytics(accountB)).profiles.map((profile) => profile.followers),
    [80],
  );
  assert.deepEqual((await analytics(otherAccount)).profiles, []);
  await assert.rejects(
    db.query("select public.get_instagram_top_posts($1, null)", [otherWorkspace]),
    { code: "42501" },
  );
  await db.exec("reset role; set role anon");
  await assert.rejects(top(), { code: "42501" });
  await db.exec("reset role");

  await db.query(
    "update private.instagram_analytics_sync set lease_id=$1, lease_until=now()+interval '10 min' where account_id=$2",
    [lease, accountA],
  );
  const result = {
    issue: "permission",
    discovered: true,
    after: "next-page",
    followers: 125,
    measurements: [{ id: "most-views", views: null }],
  };
  await db.exec("set role service_role");
  assert.equal(
    (
      await db.query("select public.finish_instagram_analytics($1,$2,$3) as ok", [
        accountA,
        lease,
        result,
      ])
    ).rows[0].ok,
    true,
  );
  await db.exec("reset role");
  const checkpoint = (
    await db.query(
      `
    select followers,cursor_after, due_at < now()+interval '3 minutes' as soon
    from private.instagram_analytics_sync where account_id=$1
  `,
      [accountA],
    )
  ).rows[0];
  assert.equal(Number(checkpoint.followers), 125);
  assert.equal(checkpoint.cursor_after, "next-page");
  assert.equal(checkpoint.soon, true);
  const viewRecord = (
    await db.query(
      `
    select views, due_at > now()+interval '5 hours' as deferred
    from private.instagram_analytics_media where account_id=$1 and media_id='most-views'
  `,
      [accountA],
    )
  ).rows[0];
  assert.equal(Number(viewRecord.views), 9000);
  assert.equal(viewRecord.deferred, true);

  await db.exec(await loadMigration("20261123153000_postkit_dashboard_performance.sql"));
  await db.query(
    `insert into public.posts (workspace_id,instagram_account_id,status,published_at,content_type)
       values ($1,$3,'published','2020-11-22T02:59:59Z','reel'),
              ($1,$3,'published','2020-11-22T03:00:00Z','reel'),
              ($1,$3,'published','2020-11-22T04:00:00Z','reel'),
              ($1,$4,'published','2020-11-22T04:00:00Z','story'),
              ($1,$4,'published','2020-11-23T03:00:00Z','reel'),
              ($1,$4,'scheduled',null,'reel'),
              ($2,$5,'published','2020-11-22T04:00:00Z','reel')`,
    [workspace, otherWorkspace, accountA, accountB, otherAccount],
  );
  await db.query(
    `insert into private.instagram_analytics_media (account_id,media_id,kind,published_at,views)
       values ($1,'boundary-start','reel','2020-11-22T03:00:00Z',12),
              ($2,'boundary-end','reel','2020-11-23T03:00:00Z',100),
              ($2,'within-zero','reel','2020-11-22T05:00:00Z',0),
              ($2,'within-missing','reel','2020-11-22T05:00:00Z',null),
              ($3,'within-other','reel','2020-11-22T05:00:00Z',999)`,
    [accountA, accountB, otherAccount],
  );
  await db.exec("set role authenticated");
  const dashboard = async (id, start, end) =>
    (
      await db.query("select public.get_postkit_dashboard_performance($1,$2,$3) as report", [
        id,
        start,
        end,
      ])
    ).rows[0].report;
  const report = await dashboard(workspace, "2020-11-22T03:00:00Z", "2020-11-23T03:00:00Z");
  assert.equal(report.published, 2);
  assert.equal(report.active, 2);
  assert.equal(report.connected, 2);
  assert.equal(report.views, 12);
  assert.equal(report.reels, 3);
  assert.equal(report.measured, 2);
  assert.deepEqual(
    report.ranking.map(({ username, views }) => [username, views]),
    [
      ["perfil_a", 12],
      ["perfil_b", 0],
    ],
  );
  const empty = await dashboard(workspace, "2020-11-21T03:00:00Z", "2020-11-21T04:00:00Z");
  assert.equal(empty.views, null);
  assert.equal(empty.published, 0);
  assert.equal(empty.active, 0);
  assert.deepEqual(empty.ranking, []);
  await assert.rejects(dashboard(otherWorkspace, null, null), /workspace_access/);
  console.log(
    "PASS: ranking by engagement, nullable metrics, top 10, scopes, follower totals, existing view retention and catalog advancement.",
  );
} finally {
  await db.close();
}
