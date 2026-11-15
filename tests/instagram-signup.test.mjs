import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const module = await import("../tools/hot-profiles/instagram-signup.mjs").catch(() => ({}));
const input = {
  username: "example_owner",
  fullName: "Example Owner",
  contact: "owner@example.com",
  password: "private-password-123",
};
async function setup(t, start) {
  assert.equal(typeof module.createSignupManager, "function", "signup manager must exist");
  const directory = await mkdtemp(path.join(os.tmpdir(), "signup-test-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const manager = await module.createSignupManager({ directory, start });
  t.after(() => manager.close());
  return { manager, directory };
}
function runtime() {
  return { stop: async () => {}, signupStep: async () => ({ status: "submitted" }) };
}
test("signup rejects malformed input before launching a browser", async (t) => {
  const { manager } = await setup(t, () => {
    throw new Error("must not launch");
  });
  for (const bad of [
    { ...input, username: "../escape" },
    { ...input, password: "x" },
    { ...input, contact: "invalid" },
    null,
  ]) {
    await assert.rejects(manager.open(bad), /dados|usuário|senha|contato/i);
  }
  assert.equal(manager.state().history.length, 0);
});
test("signup saves outcomes without credentials and never treats submission as creation", async (t) => {
  const { manager, directory } = await setup(t, async () => runtime());
  const result = await manager.open(input);
  assert.equal(result.current.status, "submitted");
  await assert.rejects(manager.open(input), /encerre/i);
  await manager.finish("reported_created");
  const saved = await readFile(path.join(directory, "instagram-signups.json"), "utf8");
  assert.ok(!saved.includes(input.password));
  assert.ok(!saved.includes(input.contact));
  assert.ok(!saved.includes(input.fullName));
  assert.equal(manager.state().history[0].status, "reported_created");
  await assert.rejects(manager.open(input), /confirmado/i);
});
test("cancelling while launch is pending closes the eventual browser and retains cancellation", async (t) => {
  let resolveStart;
  let stopped = 0;
  const { manager } = await setup(
    t,
    () =>
      new Promise((resolve) => {
        resolveStart = resolve;
      }),
  );
  const opening = manager.open(input);
  while (!resolveStart) await new Promise((resolve) => setTimeout(resolve, 5));
  await manager.finish("cancelled");
  resolveStart({
    ...runtime(),
    stop: async () => {
      stopped++;
    },
  });
  await opening;
  assert.equal(stopped, 1);
  assert.equal(manager.state().current, null);
  assert.equal(manager.state().history[0].status, "cancelled");
});
test("daily attempt ceiling survives restarts", async (t) => {
  const { manager, directory } = await setup(t, async () => runtime());
  for (let i = 0; i < 10; i++) {
    await manager.open({ ...input, username: `owner_${i}` });
    await manager.finish("cancelled");
  }
  const restarted = await module.createSignupManager({ directory, start: async () => runtime() });
  await assert.rejects(restarted.open(input), /10 tentativas/i);
  assert.equal(restarted.state().todayAttempts, 10);
});
test("shutdown waits for an in-flight launch to close its browser", async (t) => {
  let resolveStart;
  let stopped = false;
  const { manager } = await setup(
    t,
    () =>
      new Promise((resolve) => {
        resolveStart = resolve;
      }),
  );
  const opening = manager.open(input);
  while (!resolveStart) await new Promise((resolve) => setTimeout(resolve, 5));
  let closed = false;
  const closing = manager.close().then(() => {
    closed = true;
  });
  await new Promise((resolve) => setTimeout(resolve, 25));
  const closedTooEarly = closed;
  resolveStart({
    ...runtime(),
    stop: async () => {
      stopped = true;
    },
  });
  await Promise.all([opening, closing]);
  assert.equal(closedTooEarly, false, "shutdown cannot abandon a launching browser");
  assert.equal(stopped, true);
});
test("shutdown does not overwrite an in-flight user confirmation", async (t) => {
  let releaseStop;
  const stopping = new Promise((resolve) => {
    releaseStop = resolve;
  });
  const { manager } = await setup(t, async () => ({ ...runtime(), stop: () => stopping }));
  await manager.open(input);
  const finishing = manager.finish("reported_created");
  const closing = manager.close();
  releaseStop();
  await Promise.all([finishing, closing]);
  assert.equal(manager.state().history[0].status, "reported_created");
});
