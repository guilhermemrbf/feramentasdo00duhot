import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { resolve } from "node:path";

const require = createRequire(
  resolve(process.env.INTELLIGENCE_PG_TEST_DEPS || ".", "package.json"),
);
const { PGlite } = require("@electric-sql/pglite");
const db = new PGlite();
const owner = "f0fb6477-21a5-4a6e-84a2-4ccfa03a2e38";
const other = "9a5f7332-eb29-467b-8d14-39917443b095";
const migration = (name) =>
  readFile(new URL("../supabase/migrations/" + name, import.meta.url), "utf8");
const first = async (sql, args = []) => (await db.query(sql, args)).rows[0];
const analyze = (profiles) =>
  first("select * from public.analyze_instagram_intelligence_batch($1)", [profiles]);

try {
  await db.exec(`
    create role authenticated; create role anon;
    create schema auth; create schema private;
    create table auth.users(id uuid primary key);
    create function auth.jwt() returns jsonb language sql stable as
      $$ select current_setting('request.jwt.claims',true)::jsonb $$;
    create function auth.uid() returns uuid language sql stable as $$ select (auth.jwt()->>'sub')::uuid $$;
    insert into auth.users values ('${owner}'), ('${other}');
    grant usage on schema auth to authenticated, anon;
    create table public.workspaces(id uuid primary key, owner_id uuid, name text);
    create table public.instagram_accounts(id uuid primary key, workspace_id uuid, username text, connection_status text);
    create table public.workspace_members(workspace_id uuid, user_id uuid, primary key(workspace_id,user_id));
    create table private.instagram_analytics_sync(account_id uuid primary key, followers bigint, last_catalog_at timestamptz);
    create table private.instagram_analytics_media(account_id uuid, media_id text, kind text, published_at timestamptz,
      permalink text, views bigint, likes bigint, comments bigint, measured_at timestamptz);
    insert into public.workspaces values
      ('00000000-0000-4000-8000-000000000001','${owner}','Próprio'),
      ('00000000-0000-4000-8000-000000000002','${other}','Alheio'),
      ('00000000-0000-4000-8000-000000000003','${owner}','Próprio alternativo');
    insert into public.instagram_accounts
    select gen_random_uuid(), id, name, 'connected'
    from (values
      ('00000000-0000-4000-8000-000000000001'::uuid, 'meu'),
      ('00000000-0000-4000-8000-000000000001'::uuid, 'duplicado'),
      ('00000000-0000-4000-8000-000000000003'::uuid, 'duplicado'),
      ('00000000-0000-4000-8000-000000000002'::uuid, 'alheio')
    ) a(id,name);
  `);
  for (const name of [
    "20261112235500_instagram_intelligence_import.sql",
    "20261113130000_instagram_intelligence_processing.sql",
  ])
    await db.exec(await migration(name));

  const sql = await migration("20261113193000_instagram_intelligence_analyze.sql").catch(
    (error) => {
      if (error.code !== "ENOENT") throw error;
      return "";
    },
  );
  if (sql) await db.exec(sql);
  await db.exec("set role authenticated");
  await db.query("select set_config('request.jwt.claims', $1, false)", [
    JSON.stringify({ sub: owner, is_anonymous: false }),
  ]);

  const names = [
    "meu",
    "alheio",
    "duplicado",
    ...Array.from({ length: 997 }, (_, i) => "lote_" + i),
  ];
  const batch = await analyze(names);
  assert.equal(batch.queued, 1);
  assert.equal(batch.awaiting_source, 999);
  const { result } = await first(
    "select public.list_instagram_intelligence_results($1) as result",
    [batch.id],
  );
  assert.equal(result.length, 1000);
  assert.deepEqual(
    result.slice(0, 3).map((item) => item.state),
    ["queued", "awaiting_source", "awaiting_source"],
  );
  await assert.rejects(analyze(["meu", "meu"]), { code: "22023" });
  await db.query("select set_config('request.jwt.claims', $1, false)", [
    JSON.stringify({ sub: owner, is_anonymous: true }),
  ]);
  await assert.rejects(analyze(["meu"]), { code: "42501" });
  await db.exec("reset role");
  const checkpoint = await first("select private.process_instagram_intelligence_jobs(25) as count");
  assert.equal(checkpoint.count, 1);
  const job = await first(
    "select state, report->>'decision' as decision from public.instagram_intelligence_jobs",
  );
  assert.deepEqual(job, { state: "done", decision: "review" });
  console.log(
    "Analyze RPC: 1000 profiles, owner isolation, ambiguous sources, anonymous denial and report persistence passed.",
  );
} finally {
  await db.close();
}
