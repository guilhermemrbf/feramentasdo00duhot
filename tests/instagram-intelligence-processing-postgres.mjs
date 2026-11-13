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
const at = new Date(Date.now() - 60_000).toISOString();
const seedReels = (n, data = {}) =>
  Array.from({ length: n }, (_, i) => ({
    url: "https://www.instagram.com/reel/test_" + i + "/",
    publishedAt: new Date(Date.parse(at) - (i + 1) * 86400000).toISOString(),
    views: 1000,
    likes: 50,
    comments: 10,
    ...data,
  }));
const metrics = (reels, followers = 1000) => ({ capturedAt: at, followers, reels });
const review = (reels) => ({
  niche: "Educação",
  subniche: "Educação científica",
  microniche: "Astronomia observacional",
  formats: ["tutorial"],
  themes: ["astronomia"],
  opportunities: "Demonstrações em sequência.",
  subnicheReason: "Tutoriais têm demanda aparente na amostra.",
  safetyReason: "Materiais conferidos pelo operador.",
  qualityReason: "Calendário e edição consistentes.",
  accountStatus: "eligible",
  accountEvidence: "Consulta autorizada do Status da Conta em 13/11.",
  community: "low",
  recommendation: "low",
  findings: [],
  inspected: reels.map((reel) => ({
    url: reel.url,
    coverage: "full",
    note: "Reel e legenda revisados.",
  })),
  potential: 95,
  safety: 95,
  quality: 95,
  finalReview: true,
});

const run = (sql, args = []) => db.query(sql, args);
const one = async (sql, args) => (await run(sql, args)).rows[0]?.value;
async function actor(sub, anonymous = false) {
  await db.exec("reset role");
  await run("select set_config('request.jwt.claims', $1, false)", [
    JSON.stringify({ sub, is_anonymous: anonymous }),
  ]);
  await db.exec("set role authenticated");
}
const score = (snapshot, assessment) =>
  one("select private.intelligence_report($1::jsonb, $2::jsonb, $3::timestamptz) as value", [
    snapshot,
    assessment,
    at,
  ]);

try {
  await db.exec(`
    create role authenticated; create role anon; create role service_role;
    create schema auth; create schema private;
    create table auth.users(id uuid primary key);
    create function auth.jwt() returns jsonb language sql stable as
      $$ select coalesce(nullif(current_setting('request.jwt.claims',true),''), '{}')::jsonb $$;
    create function auth.uid() returns uuid language sql stable as $$ select (auth.jwt()->>'sub')::uuid $$;
    insert into auth.users values ('${owner}'), ('${other}');
    grant usage on schema auth to authenticated, anon;
    create table public.workspaces(id uuid primary key, owner_id uuid, name text);
    create table public.instagram_accounts(id uuid primary key, workspace_id uuid, username text, connection_status text);
    create table public.workspace_members(workspace_id uuid, user_id uuid, primary key(workspace_id,user_id));
    create table private.instagram_analytics_sync(account_id uuid primary key, followers bigint, last_catalog_at timestamptz);
    create table private.instagram_analytics_media(account_id uuid, media_id text, kind text, published_at timestamptz,
      permalink text, views bigint, likes bigint, comments bigint, measured_at timestamptz);
  `);
  for (const name of [
    "20261112235500_instagram_intelligence_import.sql",
    "20261113130000_instagram_intelligence_processing.sql",
  ])
    await db.exec(
      await readFile(new URL("../supabase/migrations/" + name, import.meta.url), "utf8"),
    );

  const reels = seedReels(20);
  const complete = review(reels);
  const a = await score(metrics(reels), complete);
  assert.equal(a.decision, "approved");
  assert.equal(a.metrics.medianViews, 1000);
  assert.equal(a.metrics.interactionRate, 6);
  assert.equal(
    a.score,
    Math.round((a.notes.performance * 0.35 + 95 * 0.25 + 95 * 0.3 + 95 * 0.1) * 10) / 10,
  );
  const critical = {
    ...complete,
    community: "critical",
    findings: [
      {
        url: reels[0].url,
        area: "community",
        severity: "critical",
        confirmed: true,
        policy: "community",
        evidence: "Registro verificável pelo operador",
        confidence: "high",
        category: "restrição",
        reason: "A revisão confirmou a regra aplicável.",
        action: "Revisar a publicação.",
        second: 4,
      },
    ],
  };
  assert.equal((await score(metrics(reels), critical)).decision, "rejected");
  const distinct = reels.slice(0, 3).map((reel, index) => ({
    ...critical.findings[0],
    url: reel.url,
    severity: "high",
    category: "risco " + index,
  }));
  assert.equal(
    (await score(metrics(reels), { ...complete, findings: distinct })).decision,
    "review",
  );
  assert.equal(
    (
      await score(metrics(reels), {
        ...complete,
        findings: distinct.map((finding) => ({ ...finding, category: "recorrente" })),
      })
    ).reason,
    "confirmed_recurring",
  );
  const staleTime = Date.parse(at) - 40 * 86400000;
  const stale = {
    ...metrics(reels),
    capturedAt: new Date(staleTime).toISOString(),
    reels: reels.map((reel, index) => ({
      ...reel,
      publishedAt: new Date(staleTime - (index + 1) * 86400000).toISOString(),
    })),
  };
  assert.equal((await score(stale, complete)).decision, "review");
  assert.equal((await score(metrics(reels), { ...critical, findings: [] })).decision, "review");
  assert.equal(
    (
      await score(metrics(seedReels(20, { views: 1, likes: 0, comments: 0 })), {
        ...complete,
        potential: 30,
        safety: 75,
        quality: 30,
      })
    ).reason,
    "low_potential",
  );
  assert.equal((await score(metrics([], null), null)).metrics.medianViews, null);
  assert.equal((await score(metrics(seedReels(5)), complete)).decision, "review");
  const outlier = seedReels(20);
  outlier[0].views = 1000000;
  const f = await score(metrics(outlier), complete);
  assert.equal(f.metrics.medianViews, 1000);
  assert(f.metrics.topViewShare > 95);
  assert.equal(
    (await score(metrics(reels), { ...complete, recommendation: "high" })).decision,
    "review",
  );
  assert.equal(
    (await score(metrics(reels), { ...complete, accountStatus: "unverified" })).decision,
    "review",
  );
  assert.deepEqual(await score(metrics(reels), complete), a);
  console.log("Motor PostgreSQL: cenários A–H, pesos, ausência de dados e repetibilidade.");

  const batch = await actor(owner).then(() =>
    one(
      "select public.create_instagram_intelligence_batch('Amostra', array['perfil_a','perfil_b','perfil_c']) as value",
    ),
  );
  const rows = (id = batch) =>
    one("select public.list_instagram_intelligence_results($1) as value", [id]);
  const enqueue = (items, id = batch) =>
    one(
      "select public.enqueue_instagram_intelligence_import($1,'autorizado.json',$2::jsonb) as value",
      [id, items],
    );
  const tick = (limit = 25) =>
    one("select private.process_instagram_intelligence_jobs($1) as value", [limit]);
  const apply = (id, assessment) =>
    one("select public.save_instagram_intelligence_review($1,$2::jsonb) as value", [
      id,
      assessment,
    ]);
  const report = (id) => one("select public.get_instagram_intelligence_report($1) as value", [id]);

  const first = { username: "perfil_a", snapshot: metrics(reels) };
  await assert.rejects(enqueue([first, { ...first, username: "fora_do_lote" }]), /fora do lote/);
  await assert.rejects(
    enqueue([
      {
        ...first,
        snapshot: metrics([reels[0], { ...reels[0], url: reels[0].url.replace("/reel/", "/p/") }]),
      },
    ]),
    /dados inválidos/,
  );
  assert.equal((await rows())[0].state, "awaiting_source");
  assert.equal(await enqueue([first]), 1);
  assert.equal(await enqueue([first]), 0);
  await assert.rejects(tick(), /permission denied/);
  await db.exec("reset role");
  assert.equal(await tick(1), 1);
  await actor(owner);
  const id = (await rows())[0].jobId;
  assert.equal((await rows())[0].state, "done");
  assert.equal((await report(id)).report.metrics.medianViews, 1000);
  assert.equal(await enqueue([first]), 0);
  await assert.rejects(apply(id, { ...complete, potential: 101 }), /evidências/);
  await assert.rejects(
    apply(id, { ...complete, inspected: [...complete.inspected, complete.inspected[0]] }),
    /evidências/,
  );
  await assert.rejects(
    apply(id, { ...complete, findings: [{ ...critical.findings[0], policy: "originality" }] }),
    /evidências/,
  );
  assert.equal((await apply(id, { ...complete, finalReview: false })).decision, "review");
  assert.equal((await apply(id, complete)).decision, "approved");
  assert.equal((await report(id)).history.length, 2);
  assert.equal((await rows())[0].decision, "approved");
  const refreshed = { ...first, snapshot: { ...first.snapshot, followers: 1200 } };
  assert.equal(await enqueue([refreshed]), 1);
  assert.equal((await rows())[0].state, "queued");
  assert.equal((await rows())[0].jobId, id);
  await db.exec("reset role");
  await run(
    "update public.instagram_intelligence_jobs set snapshot = '{\"reels\":{}}', attempts = 2 where batch_id=$1 and state='queued'",
    [batch],
  );
  assert.equal(await tick(), 1);
  await actor(owner);
  assert.equal((await rows())[0].state, "failed");
  assert.equal((await rows())[0].jobId, id);
  assert.equal(await enqueue([refreshed]), 1);
  await db.exec("reset role");
  assert.equal(await tick(), 1);
  await actor(owner);
  const refreshedId = (await rows())[0].jobId;
  assert.notEqual(refreshedId, id);
  assert.equal((await report(refreshedId)).pastReports[0].id, id);
  await actor(other);
  await assert.rejects(rows(), /inacessível/);
  await assert.rejects(apply(id, complete), /inacessível/);
  await assert.rejects(enqueue([first]), /inacessível/);
  assert.equal(await report(id), null);
  await actor(owner, true);
  await assert.rejects(rows(), /inacessível/);

  const workspace = "ca5e98dd-70f1-4cb1-bab0-b09b08c9ec61";
  const account = "196eb3b4-c6f8-43ec-9cd3-433d54987673";
  await db.exec("reset role");
  await run("insert into public.workspaces values($1,$2,'Teste')", [workspace, owner]);
  await run("insert into public.instagram_accounts values($1,$2,'Perfil_B','connected')", [
    account,
    workspace,
  ]);
  await run("insert into private.instagram_analytics_sync values($1,654,now())", [account]);
  await run(
    "insert into private.instagram_analytics_media values($1,'reel1','reel',$2,$3,789,24,3,now())",
    [account, reels[0].publishedAt, reels[0].url],
  );
  const fromMeta = () =>
    one("select public.enqueue_instagram_intelligence_connected($1,$2) as value", [
      batch,
      workspace,
    ]);
  await actor(owner);
  assert.equal(await fromMeta(), 1);
  assert.equal(await fromMeta(), 0);
  await db.exec("reset role");
  assert.equal(await tick(), 1);
  await actor(owner);
  const connected = (await rows())[1];
  assert.equal(connected.source, "connected_analytics");
  assert.equal(connected.medianViews, 789);
  assert.equal((await report(connected.jobId)).report.metrics.followers, 654);
  assert.equal((await report(connected.jobId)).report.analysisModel, null);
  assert.equal(await fromMeta(), 0);

  await db.exec("reset role");
  await run(
    "insert into public.instagram_intelligence_jobs(batch_id, username, source, source_label, snapshot) values($1, 'perfil_c', 'owner_import', 'Teste', $2::jsonb)",
    [batch, { capturedAt: at, reels: {} }],
  );
  for (let attempt = 1; attempt <= 3; attempt++) {
    assert.equal(await tick(), 1);
    const result = (
      await run(
        "select attempts,state from public.instagram_intelligence_jobs where batch_id=$1 and username='perfil_c'",
        [batch],
      )
    ).rows[0];
    assert.equal(result.attempts, attempt);
    assert.equal(result.state, attempt < 3 ? "queued" : "failed");
    assert.equal(await tick(), 0);
    await run(
      "update public.instagram_intelligence_jobs set due_at=now()-interval '1 minute' where batch_id=$1 and username='perfil_c'",
      [batch],
    );
  }
  await actor(owner);
  const large = Array.from({ length: 1000 }, (_, i) => "lote_" + i);
  const largeBatch = await one(
    "select public.create_instagram_intelligence_batch('Mil', $1) as value",
    [large],
  );
  assert.equal(
    await enqueue(
      large.map((username) => ({ username, snapshot: metrics([], null) })),
      largeBatch,
    ),
    1000,
  );
  await db.exec("reset role");
  assert.equal(await tick(1000), 50);
  for (let i = 0; i < 19; i++) assert.equal(await tick(50), 50);
  assert.equal(await tick(), 0);
  await actor(owner);
  const processed = await rows(largeBatch);
  assert.equal(processed.length, 1000);
  assert(
    processed.every(
      (row) => row.state === "done" && row.decision === "review" && row.score === null,
    ),
  );
  console.log(
    "Fila PostgreSQL: importação atômica, fonte conectada, revisão auditada, isolamento, retentativas e lote de 1.000.",
  );
} finally {
  await db.close();
}
