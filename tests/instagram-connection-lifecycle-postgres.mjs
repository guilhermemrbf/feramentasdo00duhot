import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { resolve } from "node:path";

const require = createRequire(
  resolve(process.env.INTELLIGENCE_PG_TEST_DEPS || ".", "package.json"),
);
const { PGlite } = require("@electric-sql/pglite");
const db = new PGlite();
const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const w = id(1),
  otherWorkspace = id(2),
  owner = id(90),
  editor = id(91),
  viewer = id(92),
  stranger = id(93);
const account = id(10),
  otherAccount = id(11),
  media = id(20);
const sql = (name) => readFile(new URL("../" + name, import.meta.url), "utf8");
const one = async (query, args = []) => (await db.query(query, args)).rows[0];
const actor = async (role, user = owner) => {
  await db.exec("reset role");
  await db.query("select set_config('test.actor',$1,false)", [user ?? ""]);
  await db.exec("set role " + role);
};
const disconnect = () =>
  db.query("select public.disconnect_instagram_account($1) result", [account]);
const save = (
  expiry = null,
  profiles = [
    {
      id: "123",
      username: "fixture_reconnected",
      client_business_id: "987",
      login_config_id: "654",
    },
  ],
) =>
  db.query("select public.save_instagram_unified_accounts($1,$2,$3::jsonb,$4,$5,$6)", [
    w,
    owner,
    JSON.stringify(profiles),
    ["instagram_basic", "instagram_content_publish"],
    "encrypted-test-fixture",
    expiry,
  ]);
try {
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('test.actor',true),'')::uuid$$;
    grant usage on schema public,auth to anon,authenticated,service_role;
    insert into auth.users values('${owner}'),('${editor}'),('${viewer}'),('${stranger}');`);
  await db.exec(
    (await sql("supabase/migrations/20261013010000_postkit_instagram_foundation.sql")).replace(
      "create extension if not exists pgcrypto;",
      "",
    ),
  );
  const authModeMigration = await sql(
    "supabase/migrations/20261110165000_postkit_instagram_auth_mode.sql",
  );
  await db.exec(authModeMigration);
  await db.exec(
    await sql("supabase/migrations/20261110173000_facebook_insights_authorization.sql"),
  );
  await db.exec(await sql("supabase/migrations/20261111145000_instagram_unified_login.sql"));
  await db.exec(authModeMigration);
  // The storage catalog is a Supabase dependency; only the catalog is a fixture.
  await db.exec("create schema storage; create table storage.objects(bucket_id text,name text);");
  await db.exec(await sql("supabase/migrations/20261109170000_instagram_story_reminders.sql"));
  await db.exec(await sql("supabase/migrations/20261110110000_instagram_reel_loops.sql"));
  await db.exec(await sql("supabase/migrations/20261116235000_instagram_connection_lifecycle.sql"));
  await db.exec(`grant select,insert,update on all tables in schema public to authenticated;
    grant all on all tables in schema public to service_role;
    insert into workspaces(id,name,owner_id) values('${w}','Fixture A','${owner}'),('${otherWorkspace}','Fixture B','${stranger}');
    insert into workspace_members(workspace_id,user_id,role) values('${w}','${editor}','editor'),('${w}','${viewer}','viewer');
    insert into instagram_accounts(id,workspace_id,instagram_user_id,username,connection_status)
      values('${account}','${w}','123','fixture_a','connected'),('${otherAccount}','${w}','456','fixture_b','connected');
    insert into instagram_tokens(account_id,access_token_ciphertext) values('${account}','fixture-a'),('${otherAccount}','fixture-b');
    insert into media_assets(id,workspace_id,original_filename,storage_path,mime_type,size_bytes)
      values('${media}','${w}','fixture.mp4','fixture.mp4','video/mp4',100);
    insert into posts(id,workspace_id,instagram_account_id,media_asset_id,status)
      values('${id(30)}','${w}','${account}','${media}','scheduled'),('${id(31)}','${w}','${account}','${media}','published'),
      ('${id(32)}','${w}','${otherAccount}','${media}','scheduled'),('${id(33)}','${w}','${account}','${media}','processing');
    insert into private.instagram_reel_loops(workspace_id,account_id,name,asset_ids,caption,interval_minutes,next_at)
      values('${w}','${account}','fixture','{${media}}','',120,now()+interval '1 day');
    insert into instagram_story_reminders(id,workspace_id,instagram_account_id,storage_path,filename,mime_type,link_url,link_title,sticker_x,sticker_y,scheduled_at)
      values('${id(40)}','${w}','${account}','${w}/${id(40)}/fixture.png','fixture.png','image/png','https://example.test','Fixture',50,50,now()+interval '1 day');`);
  await db.exec(await sql("supabase/migrations/20261120100000_instagram_workspace_apps.sql"));
  const newWorkspace = id(4);
  await db.query("insert into workspaces(id,name,owner_id) values($1,'Nova operação',$2)", [
    newWorkspace,
    viewer,
  ]);
  await db.query(
    "insert into workspace_members(workspace_id,user_id,role) values($1,$2,'editor')",
    [newWorkspace, editor],
  );
  const register = (workspace, user, app = "1234", config = "4567") =>
    one("select public.save_instagram_workspace_app($1,$2,$3,$4,'v1.fixture') ok", [
      workspace,
      user,
      app,
      config,
    ]);
  const grant = (workspace, user, revision, configId) =>
    one("select public.save_workspace_instagram_grant($1,$2,$3,$4::jsonb,$5,'v1.token',null) ok", [
      workspace,
      user,
      revision,
      JSON.stringify([{ id: "422", username: "new_fixture", login_config_id: configId }]),
      ["instagram_basic", "instagram_content_publish"],
    ]);
  await actor("service_role");
  const legacy = await one(
    "select app_id, revision from instagram_workspace_apps where workspace_id=$1",
    [w],
  );
  assert.equal(legacy.app_id, null);
  assert.equal(
    await one("select * from instagram_workspace_apps where workspace_id=$1", [newWorkspace]),
    undefined,
  );
  assert.deepEqual(await grant(newWorkspace, viewer, legacy.revision, "4567"), { ok: false });
  assert.deepEqual(await register(w, owner), { ok: false });
  await assert.rejects(register(newWorkspace, editor), /Workspace administrator required/);
  await assert.rejects(register(newWorkspace, owner), /Workspace administrator required/);
  assert.deepEqual(await register(newWorkspace, viewer), { ok: true });
  const app = await one(
    "select app_id, revision, secret_ciphertext from instagram_workspace_apps where workspace_id=$1",
    [newWorkspace],
  );
  assert.equal(app.app_id, "1234");
  assert.equal(app.secret_ciphertext, "v1.fixture");
  assert.deepEqual(await register(newWorkspace, viewer, "1234", "8901"), { ok: true });
  const rotated = await one("select revision from instagram_workspace_apps where workspace_id=$1", [
    newWorkspace,
  ]);
  assert.notEqual(rotated.revision, app.revision);
  assert.deepEqual(await grant(newWorkspace, viewer, app.revision, "4567"), { ok: false });
  assert.deepEqual(await grant(newWorkspace, viewer, rotated.revision, "4567"), { ok: false });
  await assert.rejects(
    grant(newWorkspace, owner, rotated.revision, "8901"),
    /Workspace access denied/,
  );
  assert.deepEqual(await grant(newWorkspace, editor, rotated.revision, "8901"), { ok: true });
  const newAccount = await one(
    "select id, login_config_id from instagram_accounts where workspace_id=$1",
    [newWorkspace],
  );
  assert.equal(newAccount.login_config_id, "8901");
  assert.deepEqual(await register(newWorkspace, viewer, "1235"), { ok: false });
  await actor("authenticated", viewer);
  await assert.rejects(
    one("select secret_ciphertext from instagram_workspace_apps"),
    /permission denied/,
  );
  await assert.rejects(register(newWorkspace, viewer), /permission denied/);
  await assert.rejects(grant(newWorkspace, viewer, rotated.revision, "8901"), /permission denied/);
  await assert.rejects(
    db.query("update instagram_accounts set username='fake' where id=$1", [newAccount.id]),
    /permission denied/,
  );
  await disconnectOwnFixture();

  async function disconnectOwnFixture() {
    const removed = await one("select public.disconnect_instagram_account($1) result", [
      newAccount.id,
    ]);
    assert.equal(removed.result.disconnected, true);
    await actor("service_role");
    assert.deepEqual(await register(newWorkspace, viewer, "1235"), { ok: true });
  }
  await actor("anon");
  await assert.rejects(disconnect(), /permission denied/);
  for (const who of [null, viewer, stranger]) {
    await actor("authenticated", who);
    await assert.rejects(disconnect(), /account_access_denied/);
  }
  await actor("authenticated");
  assert.equal((await one("select count(*)::int n from instagram_tokens")).n, 0);
  await assert.rejects(save(), /permission denied/);
  await assert.rejects(disconnect(), /account_publish_in_progress/);
  await actor("service_role");
  assert.equal((await one("select count(*)::int n from instagram_tokens")).n, 2);
  assert.equal((await one("select status from posts where id=$1", [id(30)])).status, "scheduled");
  await assert.rejects(save("2000-01-01"), /Invalid Instagram grant/);
  await assert.rejects(save("infinity"), /Invalid Instagram grant/);
  await assert.rejects(
    save(null, [{ id: "abc", username: "fixture" }]),
    /Invalid Instagram profile/,
  );
  await db.exec(`update posts set status='published' where id='${id(33)}'`);
  await db.query("update instagram_accounts set connection_status='expired' where id=$1", [
    account,
  ]);
  await actor("authenticated", editor);
  assert.deepEqual((await disconnect()).rows[0].result, {
    disconnected: true,
    cancelledPosts: 1,
    cancelledStories: 1,
  });
  assert.deepEqual((await disconnect()).rows[0].result, {
    disconnected: true,
    cancelledPosts: 0,
    cancelledStories: 0,
  });
  await actor("service_role");
  assert.equal((await one("select count(*)::int n from instagram_tokens")).n, 1);
  assert.equal(
    (
      await one("select access_token_ciphertext from instagram_tokens where account_id=$1", [
        otherAccount,
      ])
    ).access_token_ciphertext,
    "fixture-b",
  );
  assert.equal((await one("select status from posts where id=$1", [id(30)])).status, "cancelled");
  assert.equal((await one("select status from posts where id=$1", [id(31)])).status, "published");
  assert.equal((await one("select status from posts where id=$1", [id(32)])).status, "scheduled");
  assert.equal((await one("select count(*)::int n from media_assets")).n, 1);
  await db.exec("reset role");
  assert.equal((await one("select state from private.instagram_reel_loops")).state, "paused");
  assert.equal((await one("select state from instagram_story_reminders")).state, "cancelled");
  const disconnectedAt = (
    await one("select disconnected_at from instagram_accounts where id=$1", [account])
  ).disconnected_at;
  assert.ok(disconnectedAt);
  await actor("service_role");
  await save();
  const restored = await one("select * from instagram_accounts where id=$1", [account]);
  assert.equal(restored.connection_status, "connected");
  assert.equal(restored.username, "fixture_reconnected");
  assert.equal(restored.client_business_id, "987");
  assert.equal(restored.login_config_id, "654");
  assert.ok(restored.connected_at);
  assert.equal(restored.disconnected_at, null);
  assert.equal((await one("select count(*)::int n from instagram_tokens")).n, 2);
  assert.equal((await one("select status from posts where id=$1", [id(30)])).status, "cancelled");
  await actor("authenticated", stranger);
  assert.equal((await one("select count(*)::int n from instagram_accounts")).n, 0);
  console.log(
    "PASS: actual foundation/RLS and lifecycle migrations; authorization, processing rollback, account isolation, token deletion, idempotency, pending Reels/Stories cancellation, library/history preservation, reconnect metadata, expired grants rejected. Local fixtures only.",
  );
} finally {
  await db.close();
}
