// Offline PostgreSQL verification. No credentials or network access.
// Install the optional test engine in the ignored directory:
// npm install --prefix .hot-profiles/postkit-sql-check --ignore-scripts @electric-sql/pglite@0.3.14
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
const require = createRequire(
  new URL("../../.hot-profiles/postkit-sql-check/package.json", import.meta.url),
);
const { PGlite } = require("@electric-sql/pglite");
const db = new PGlite();
let checks = 0;
const check = (condition, message) => {
  assert.ok(condition, message);
  checks++;
};
const query = (sql, args = []) => db.query(sql, args);
const first = async (sql, args = []) => (await query(sql, args)).rows[0];
const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const user = id(1),
  other = id(2),
  workspace = id(3),
  elsewhere = id(4),
  account = id(5),
  otherAccount = id(6),
  media = id(7),
  otherMedia = id(8);
const asUser = async (userId) => {
  await db.exec("reset role");
  await query("select set_config('request.jwt.claim.sub', $1, false)", [userId]);
  await db.exec("set role authenticated");
};
const admin = () => db.exec("reset role");
const claim = async () => (await query("select * from public.claim_instagram_publish_step()")).rows;
const checkpoint = async (
  post,
  outcome,
  container = null,
  mediaId = null,
  lease = post.worker_lease_id,
) =>
  (
    await first("select public.checkpoint_instagram_publish($1,$2,$3,$4,$5,null) as ok", [
      post.id,
      lease,
      outcome,
      container,
      mediaId,
    ])
  ).ok;
const insert = async (postId, w = workspace, a = account, m = media) =>
  query(
    "insert into public.posts(id,workspace_id,instagram_account_id,media_asset_id,status,scheduled_at) values($1,$2,$3,$4,'scheduled',now()+interval '1 day')",
    [postId, w, a, m],
  );

try {
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema public, auth to authenticated, service_role;`);
  for (const file of [
    "20261013010000_postkit_instagram_foundation.sql",
    "20261017010000_postkit_instagram_worker.sql",
    "20261103010000_instagram_resumable_queue.sql",
  ]) {
    let sql = await readFile(new URL(`../../supabase/migrations/${file}`, import.meta.url), "utf8");
    // PGlite includes core gen_random_uuid; the unused pgcrypto extension is absent.
    sql = sql.replace("create extension if not exists pgcrypto;", "");
    await db.exec(sql);
  }
  check(true, "migrations execute in PostgreSQL");
  await db.exec(
    "grant select, insert, update, delete on all tables in schema public to authenticated; grant all on all tables in schema public to service_role",
  );
  await query("insert into auth.users values ($1),($2)", [user, other]);
  await query(
    "insert into public.workspaces(id,name,owner_id) values($1,'First',$2),($3,'Other',$4)",
    [workspace, user, elsewhere, other],
  );
  await query(
    "insert into public.instagram_accounts(id,workspace_id,instagram_user_id,username,connection_status) values($1,$2,'first','first','connected'),($3,$4,'second','second','connected')",
    [account, workspace, otherAccount, elsewhere],
  );
  await query(
    "insert into public.media_assets(id,workspace_id,original_filename,storage_path,mime_type,size_bytes) values($1,$2,'first.mp4','first','video/mp4',100),($3,$4,'second.mp4','second','video/mp4',100)",
    [media, workspace, otherMedia, elsewhere],
  );
  await insert(id(9), elsewhere, otherAccount, otherMedia);
  await asUser(user);
  check(
    (await query("select * from public.posts")).rows.length === 0,
    "workspace isolation hides foreign posts",
  );
  check(
    !(await first("select public.cancel_scheduled_instagram_post($1) as ok", [id(9)])).ok,
    "cannot cancel foreign posts",
  );
  await assert.rejects(claim(), /permission denied/);
  checks++;
  await assert.rejects(
    query("select public.checkpoint_instagram_publish($1,$2,'published',null,'fake',null)", [
      id(9),
      id(90),
    ]),
    /permission denied/,
  );
  checks++;
  await insert(id(10));
  check((await query("select * from public.posts")).rows.length === 1, "owner can schedule");
  check(
    (await query("update public.posts set status='published' returning id")).rows.length === 0,
    "client cannot forge status",
  );
  await assert.rejects(
    query(
      "insert into public.posts(workspace_id,instagram_account_id,media_asset_id,status,scheduled_at,meta_media_id) values($1,$2,$3,'published',now(),'fake')",
      [workspace, account, media],
    ),
    /row-level security/,
  );
  checks++;
  await assert.rejects(insert(id(11), elsewhere, otherAccount, otherMedia), /row-level security/);
  checks++;
  await admin();
  await query("update public.posts set scheduled_at=now()-interval '1 minute' where id=$1", [
    id(10),
  ]);
  const [created] = await claim();
  check(created.id === id(10) && created.publish_phase === "create", "claim due post");
  check((await claim()).length === 0, "active lease cannot be claimed twice");
  check(
    !(await checkpoint(created, "waiting", "container", null, id(99))),
    "wrong lease cannot checkpoint",
  );
  check(await checkpoint(created, "waiting", "container"), "persist container");
  check((await claim()).length === 0, "respect next-attempt time");
  await query("update public.posts set next_attempt_at=now()-interval '1 second' where id=$1", [
    created.id,
  ]);
  const [ready] = await claim();
  check(
    ready.meta_container_id === "container" && ready.publish_phase === "waiting",
    "resume saved container",
  );
  await asUser(user);
  check(
    !(await first("select public.cancel_scheduled_instagram_post($1) as ok", [ready.id])).ok,
    "cannot cancel processing post",
  );
  await admin();
  check(await checkpoint(ready, "publishing", "container"), "persist publish marker");
  // A failure in the attempt update must roll back the post update too.
  await db.exec(
    "create function public.reject_attempt() returns trigger language plpgsql as $$begin if new.status='succeeded' then raise exception 'test rollback'; end if; return new; end;$$; create trigger reject_attempt before update on public.publish_attempts for each row execute function public.reject_attempt()",
  );
  await assert.rejects(checkpoint(ready, "published", "container", "result"), /test rollback/);
  checks++;
  check(
    (await first("select status from public.posts where id=$1", [ready.id])).status ===
      "processing",
    "atomic checkpoint rolls back all changes",
  );
  await db.exec(
    "drop trigger reject_attempt on public.publish_attempts; drop function public.reject_attempt()",
  );
  check(await checkpoint(ready, "published", "container", "result"), "confirm publication");
  check(
    (await first("select status,meta_media_id from public.posts where id=$1", [ready.id]))
      .meta_media_id === "result",
    "media ID persisted",
  );
  check(
    (
      await first(
        "select status from public.publish_attempts where post_id=$1 order by attempt_number desc limit 1",
        [ready.id],
      )
    ).status === "succeeded",
    "attempt confirmed atomically",
  );
  await insert(id(12));
  await query("update public.posts set scheduled_at=now()-interval '1 minute' where id=$1", [
    id(12),
  ]);
  const [interrupted] = await claim();
  await checkpoint(interrupted, "waiting", "saved");
  await query("update public.posts set next_attempt_at=now()-interval '1 second' where id=$1", [
    interrupted.id,
  ]);
  const [processing] = await claim();
  await checkpoint(processing, "publishing", "saved");
  await query("update public.posts set worker_lease_until=now()-interval '1 second' where id=$1", [
    processing.id,
  ]);
  check((await claim()).length === 0, "expired publication is never submitted again");
  check(
    (await first("select status from public.posts where id=$1", [processing.id])).status ===
      "needs_review",
    "expired publication requires review",
  );
  await asUser(user);
  await insert(id(13));
  check(
    (await first("select public.cancel_scheduled_instagram_post($1) as ok", [id(13)])).ok,
    "owner cancels scheduled post",
  );
  console.log(
    `PostgreSQL: ${checks} checks passed (migrations, RLS, leases, atomic persistence and recovery).`,
  );
} catch (error) {
  console.error(`PostgreSQL verification failed: ${error.message}`);
  process.exitCode = 1;
} finally {
  await db.close();
}
