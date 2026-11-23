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
const pixel = "00000000-0000-4000-8000-000000000003";
const order = "00000000-0000-4000-8000-000000000004";
const oldOrder = "00000000-0000-4000-8000-000000000005";
const key = "a".repeat(64);
const click = "b".repeat(64);
const wrongClick = "f".repeat(64);
const call = async (query, args) => (await db.query(query, args)).rows[0]?.result;
const pay = (reference, type, secret = "sealed-sync") =>
  call("select scalehot_meta_record_syncpay($1,$2,$3,$4,29.90,27,now()) as result", [
    pixel,
    secret,
    reference,
    type,
  ]);
const bind = (reference, hash) =>
  call("select scalehot_meta_bind($1,$2,$3,$4,'https://loja.example/checkout') as result", [
    pixel,
    key,
    hash,
    reference,
  ]);
const report = (user) =>
  db.query("select set_config('test.user_id',$1,false)", [user]).then(async () => {
    await db.exec("set role authenticated");
    try {
      return await call("select scalehot_meta_report(null,null) as result", []);
    } finally {
      await db.exec("reset role");
    }
  });

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
  for (const migration of ["20261122213000_scalehot_sales","20261123140000_scalehot_pixel"]) {
    await db.exec(await readFile(new URL("../supabase/migrations/" + migration + ".sql", import.meta.url), "utf8"));
  }
  await db.query(
    "insert into scalehot_meta_pixels(id,user_id,label,dataset_id,checkout_origin,checkout_key_hash,meta_token,syncpay_secret) values ($1,$2,'Loja','123','https://loja.example',$3,'sealed-meta','sealed-sync')",
    [pixel, owner, key],
  );
  await db.exec("set role authenticated");
  await assert.rejects(
    db.query("select meta_token from scalehot_meta_pixels"),
    /permission denied/,
  );
  await assert.rejects(db.query("select * from scalehot_meta_claim()"), /permission denied/);
  await db.exec("set role service_role");
  assert.equal(
    await call(
      "select scalehot_meta_capture($1,$2,$3,'123','456','789','fb.1.1795445000000.fixture') as result",
      [pixel, key, click],
    ),
    true,
  );
  assert.equal(await pay(order, "cashin", "wrong"), "unauthorized");
  assert.equal(await pay(order, "cashin"), "recorded");
  assert.equal(await pay(order, "cashin"), "duplicate");
  assert.equal((await db.query("select * from scalehot_meta_claim()")).rows.length, 0);
  assert.equal(await bind(order, click), "bound");
  assert.equal(await bind(order, click), "bound");
  assert.equal(await bind(order, wrongClick), "conflict");
  const job = (await db.query("select * from scalehot_meta_claim()")).rows[0];
  assert.equal(job.fbc, "fb.1.1795445000000.fixture");
  assert.equal((await db.query("select * from scalehot_meta_claim()")).rows.length, 0);
  await db.query("select scalehot_meta_finish($1,$2,'sent')", [job.id, job.lease]);
  assert.equal(await pay(oldOrder, "refund"), "recorded");
  assert.equal(await pay(oldOrder, "cashin"), "recorded");
  assert.equal(await bind(oldOrder, click), "bound");
  assert.equal((await db.query("select * from scalehot_meta_claim()")).rows.length, 0);
  await db.exec("reset role");
  assert.deepEqual(await report(owner), {
    approved: 1,
    attributed: 1,
    revenue: 29.9,
    sent: 1,
    test_sent: 0,
    failed: 0,
    campaigns: [{ campaign_id: "123", ad_id: "789", sales: 1, gross: 29.9 }],
  });
  assert.equal((await report(other)).attributed, 0);
  assert.equal(
    (await db.query("select count(*)::int as count from sales_events")).rows[0].count,
    3,
  );
  console.log(
    "ScaleHot SQL: deduplication, delayed binding, refund before approval, queue and tenant isolation passed",
  );
} finally {
  await db.close();
}
