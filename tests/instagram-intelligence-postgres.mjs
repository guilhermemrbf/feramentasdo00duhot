import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { resolve } from "node:path";

const pg = createRequire(resolve(process.env.INTELLIGENCE_PG_TEST_DEPS || ".", "package.json"));
const { PGlite } = pg("@electric-sql/pglite");
const db = new PGlite();
const owner = "f0fb6477-21a5-4a6e-84a2-4ccfa03a2e38";
const other = "9a5f7332-eb29-467b-8d14-39917443b095";
const migration = new URL(
  "../supabase/migrations/20261112235500_instagram_intelligence_import.sql",
  import.meta.url,
);

try {
  await db.exec(`
    create role authenticated;
    create role anon;
    create schema auth;
    create table auth.users(id uuid primary key);
    create function auth.jwt() returns jsonb language sql stable as
      $$ select coalesce(nullif(current_setting('request.jwt.claims',true),''), '{}')::jsonb $$;
    create function auth.uid() returns uuid language sql stable as
      $$ select (auth.jwt()->>'sub')::uuid $$;
    grant usage on schema auth to authenticated, anon;
    insert into auth.users values ('${owner}'), ('${other}');
  `);
  await db.exec(await readFile(migration, "utf8"));
  const actor = async (role, sub, is_anonymous = false) => {
    await db.exec("reset role");
    await db.query("select set_config('request.jwt.claims', $1, false)", [
      JSON.stringify({ sub, is_anonymous }),
    ]);
    await db.exec("set role " + role);
  };
  const create = (users, label = "Primeiro lote") =>
    db.query("select public.create_instagram_intelligence_batch($1, $2) as id", [label, users]);
  const batches = "public.instagram_intelligence_batches";
  const profiles = "public.instagram_intelligence_profiles";
  const count = async (table) =>
    Number((await db.query("select count(*) as n from " + table)).rows[0].n);

  await actor("anon", owner);
  await assert.rejects(create(["perfil"]), /permission denied/i);
  await assert.rejects(count(batches), /permission denied/i);
  await actor("authenticated", owner, true);
  await assert.rejects(create(["perfil"]), /autentic/i);
  assert.equal(await count(batches), 0);

  await actor("authenticated", owner);
  const handles = Array.from({ length: 1_000 }, (_, i) => "perfil_" + i);
  const {
    rows: [{ id }],
  } = await create(handles);
  const result = await db.query(
    `select username, position from ${profiles} where batch_id = $1 order by position`,
    [id],
  );
  assert.deepEqual(
    result.rows.map((row) => row.username),
    handles,
  );
  assert.equal(result.rows[999].position, 1000);
  for (const input of [
    [],
    [...handles, "extra"],
    ["perfil", "perfil"],
    ["@invalido"],
    ["Reels"],
    ["reels"],
    [null],
  ]) {
    await assert.rejects(create(input));
  }
  await assert.rejects(create(["valido"], " ".repeat(4)));
  await db.exec("reset role");
  await db.exec(`alter table ${profiles} add constraint integration_test_reject_child
    check (username <> 'falha_de_insercao')`);
  await actor("authenticated", owner);
  await assert.rejects(create(["valido", "falha_de_insercao"]), /integration_test_reject_child/);
  assert.equal(await count(batches), 1);
  assert.equal(await count(profiles), 1_000);
  await actor("authenticated", owner, true);
  assert.equal(await count(batches), 0);
  assert.equal(await count(profiles), 0);
  await actor("authenticated", owner);
  await assert.rejects(
    db.query(`insert into ${batches}(name, owner_id, profile_count) values ('indevido', $1, 1)`, [
      owner,
    ]),
  );
  await assert.rejects(
    db.query(`update ${profiles} set username = 'indevido' where batch_id = $1`, [id]),
  );

  await actor("authenticated", other);
  assert.equal(await count(batches), 0);
  assert.equal(
    (await db.query(`select * from ${profiles} where batch_id = $1`, [id])).rows.length,
    0,
  );
  await create(["outro"]);
  assert.equal(await count(batches), 1);
  assert.equal(await count(profiles), 1);
  console.log("PostgreSQL: limite de 1.000, ordem, gravação atômica e isolamento confirmados.");
} finally {
  await db.close();
}
