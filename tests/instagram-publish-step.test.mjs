import assert from "node:assert/strict";
import { test } from "node:test";
import { runInstagramPublishStep } from "../src/lib/instagram-publish-step.ts";

function harness(overrides = {}) {
  const events = [];
  return {
    events,
    deps: {
      createContainer: async () => {
        events.push("create");
        return "container";
      },
      readStatus: async (id) => {
        events.push(`read:${id}`);
        return "FINISHED";
      },
      publish: async (id) => {
        events.push(`publish:${id}`);
        return { mediaId: "media" };
      },
      checkpoint: async (value) => {
        events.push(value);
      },
      ...overrides,
    },
  };
}
const waiting = { publish_phase: "waiting", meta_container_id: "container" };

test("container creation persists before returning, without publishing", async () => {
  const { deps, events } = harness();
  assert.equal(
    await runInstagramPublishStep({ publish_phase: "create", meta_container_id: null }, deps),
    "waiting",
  );
  assert.deepEqual(events, ["create", { outcome: "waiting", containerId: "container" }]);
});

test("resumption uses existing container and commits the marker before publishing", async () => {
  const { deps, events } = harness();
  assert.equal(await runInstagramPublishStep(waiting, deps), "published");
  assert.deepEqual(events, [
    "read:container",
    { outcome: "publishing", containerId: "container" },
    "publish:container",
    { outcome: "published", containerId: "container", mediaId: "media" },
  ]);
});

test("unfinished container is deferred without polling or creating another", async () => {
  const { deps, events } = harness({ readStatus: async () => "IN_PROGRESS" });
  assert.equal(await runInstagramPublishStep(waiting, deps), "waiting");
  assert.deepEqual(events, [{ outcome: "waiting", containerId: "container" }]);
});

test("lost checkpoint acknowledgement prevents publication", async () => {
  const { deps, events } = harness({
    checkpoint: async () => {
      throw new Error("database offline");
    },
  });
  await assert.rejects(runInstagramPublishStep(waiting, deps), /database offline/);
  assert.deepEqual(events, ["read:container"]);
});

test("ambiguous publish result requires review and is never retried", async () => {
  let attempts = 0;
  const { deps, events } = harness({
    publish: async () => {
      attempts++;
      throw new Error("connection lost");
    },
  });
  assert.equal(await runInstagramPublishStep(waiting, deps), "needs_review");
  assert.equal(attempts, 1);
  assert.equal(events.at(-1).outcome, "needs_review");
  events.length = 0;
  await runInstagramPublishStep({ ...waiting, publish_phase: "publishing" }, deps);
  assert.equal(attempts, 1);
  assert.deepEqual(events, [{ outcome: "needs_review", errorCode: "publish_interrupted" }]);
});

test("lost final database response does not overwrite a potentially committed success", async () => {
  const checkpoints = [];
  const { deps } = harness({
    checkpoint: async (value) => {
      checkpoints.push(value.outcome);
      if (value.outcome === "published") throw new Error("lost acknowledgement");
    },
  });
  await assert.rejects(runInstagramPublishStep(waiting, deps), /lost acknowledgement/);
  assert.deepEqual(checkpoints, ["publishing", "published"]);
});

test("already published containers are not submitted again", async () => {
  const { deps, events } = harness({ readStatus: async () => "PUBLISHED" });
  assert.equal(await runInstagramPublishStep(waiting, deps), "needs_review");
  assert.deepEqual(events, [{ outcome: "needs_review", errorCode: "container_already_published" }]);
});

test("expired and unknown containers fail before any publication", async () => {
  for (const status of ["EXPIRED", "ERROR", "UNKNOWN"]) {
    const { deps, events } = harness({ readStatus: async () => status });
    assert.equal(await runInstagramPublishStep(waiting, deps), "failed");
    assert.deepEqual(events, [{ outcome: "failed", errorCode: "preparation_failed" }]);
  }
});
