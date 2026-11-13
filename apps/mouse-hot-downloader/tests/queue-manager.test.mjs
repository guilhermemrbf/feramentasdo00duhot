import assert from "node:assert/strict";
import { test } from "node:test";
import { setImmediate } from "node:timers/promises";
import { makeQueue } from "../src/background/queue-manager.js";
import { makeCandidate } from "../src/core/media.js";

const storageKey = "mouse-hot.queue.v1";
const extensionId = "mock-mouse-hot";
const mp4Header = Buffer.concat([Buffer.from([0, 0, 0, 24]), Buffer.from("ftypisom"), Buffer.alloc(12)]);

const video = (id) => makeCandidate({
  postUrl: "https://www.instagram.com/reel/" + id + "/",
  source: "https://media.cdninstagram.com/" + id + ".mp4",
  kind: "video",
}, "instagram");

function savedJob(id, status, downloadId = null) {
  return {
    id, status, downloadId, item: video(id), tabId: 1, attempts: 1, updated: Date.now(),
    received: 0, total: 0, canResume: status === "paused" || status === "failed", message: "",
  };
}

function setup(t, {
  saved = [], native = [], invalid = [], blockProbe = false, refreshVideo, failFirstSearch = false, cancel = (d) => {
    Object.assign(d, { state: "interrupted", error: "USER_CANCELED" });
  }, notify = () => {},
} = {}) {
  let stored = structuredClone(saved);
  const downloads = new Map();
  const removed = [];
  let nextDownloadId = 1;
  function addDownload({ url, filename, paused = false, state = "in_progress", byExtensionId = extensionId }) {
    const id = nextDownloadId++;
    downloads.set(id, { id, url, finalUrl: url, filename, state, paused,
      danger: "safe", canResume: paused, bytesReceived: 0, totalBytes: 24, byExtensionId,
      startTime: new Date().toISOString() });
    return id;
  }
  for (const job of saved) {
    if (job.downloadId == null) continue;
    const id = addDownload({ url: job.item.source, filename: job.item.id + ".mp4",
      paused: job.status === "paused", state: job.status === "failed" ? "interrupted" : "in_progress" });
    assert.equal(id, job.downloadId);
  }

  for (const download of native) addDownload(download);

  t.mock.method(globalThis, "fetch", async (url) => {
    if (blockProbe) throw new TypeError("Preflight blocked");
    return invalid.some(id => video(id).source === url)
      ? new Response("", { status: 403 })
      : new Response(mp4Header, { headers: { "content-type": "video/mp4" } });
  });
  const priorChrome = Object.getOwnPropertyDescriptor(globalThis, "chrome");
  Object.defineProperty(globalThis, "chrome", { configurable: true, value: {
    runtime: { id: extensionId },
    storage: { local: {
      get: async (key) => ({ [key]: structuredClone(stored) }),
      set: async (data) => { stored = structuredClone(data[storageKey]); },
    } },
    downloads: {
      download: async ({ url, filename }) => {
        if (invalid.some(id => video(id).source === url)) throw new Error("Chrome refused to start");
        return addDownload({ url, filename });
      },
      search: async ({ id, url, startedAfter, limit }) => {
        if (failFirstSearch) {
          failFirstSearch = false;
          throw new Error("Chrome temporarily unavailable");
        }
        if (id != null) return downloads.has(id) ? [structuredClone(downloads.get(id))] : [];
        return structuredClone([...downloads.values()].filter(d => d.url === url && d.startTime > startedAfter)
          .slice(0, limit || undefined));
      },
      pause: async (id) => Object.assign(downloads.get(id), { paused: true, canResume: true }),
      resume: async (id) => Object.assign(downloads.get(id), { state: "in_progress", paused: false, canResume: false }),
      cancel: async (id) => cancel(downloads.get(id)),
      removeFile: async (id) => { removed.push(id); },
    },
  } });
  t.after(() => {
    if (priorChrome) Object.defineProperty(globalThis, "chrome", priorChrome);
    else delete globalThis.chrome;
  });
  return {
    queue: makeQueue(notify, refreshVideo), downloads, removed,
    active: () => [...downloads.values()].filter(d => d.state === "in_progress" && !d.paused).map(d => d.url),
  };
}

const statuses = (jobs) => Object.fromEntries(jobs.map(job => [job.item.id, job.status]));

test("starts a native MOV download without making any media request first", async (t) => {
  const { queue, downloads } = setup(t, { blockProbe: true });
  const item = { ...video("quicktime"), source: "https://media.cdninstagram.com/native.MOV?token=1" };
  await queue.enqueue([item], 1);
  await queue.start();
  assert.equal(globalThis.fetch.mock.callCount(), 0);
  assert.match(downloads.get(1)?.filename, /\.mov$/);
  Object.assign(downloads.get(1), { state: "complete", mime: "video/quicktime" });
  await queue.changed(1);
  assert.equal((await queue.list())[0].status, "done");
});

test("refreshes an expired video's native URL once and advances after a second refusal", async (t) => {
  const refreshCalls = [];
  const updated = "https://media.cdninstagram.com/first.mp4?fresh=1";
  const { queue, downloads, active } = setup(t, { refreshVideo: async job => {
    refreshCalls.push([job.item.key, job.tabId, job.documentId]);
    return [updated];
  } });
  await queue.enqueue(["first", "second"].map(video), 8, { documentId: "original-doc" });
  await queue.start();
  Object.assign(downloads.get(1), { state: "interrupted", error: "SERVER_FORBIDDEN" });
  await queue.changed(1);
  assert.deepEqual(active(), [updated]);
  assert.deepEqual(refreshCalls, [[video("first").key, 8, "original-doc"]]);
  Object.assign(downloads.get(2), { state: "interrupted", error: "SERVER_FORBIDDEN" });
  await queue.changed(2);
  assert.deepEqual(active(), [video("second").source]);
  assert.equal(refreshCalls.length, 1);
  assert.match((await queue.list()).find(job => job.item.id === "first").message, /SERVER_FORBIDDEN/);
});

test("does not mark an HTML response from a native video transfer as saved", async (t) => {
  const { queue, downloads, removed } = setup(t);
  await queue.enqueue([video("html")], 1);
  await queue.start();
  Object.assign(downloads.get(1), { state: "complete", mime: "text/html; charset=utf-8" });
  await queue.changed(1);
  assert.deepEqual(removed, [1]);
  assert.equal((await queue.list())[0].status, "failed");
});

test("starts one transfer at a time and advances past a terminal Chrome error", async (t) => {
  const { queue, downloads, active } = setup(t);
  await queue.enqueue(["first", "second", "third"].map(video), 1);
  await Promise.all([queue.start(), queue.start()]);
  assert.deepEqual(statuses(await queue.list()), { first: "running", second: "queued", third: "queued" });
  assert.deepEqual(active(), [video("first").source]);

  downloads.get(1).state = "complete";
  await queue.changed(1);
  assert.deepEqual(active(), [video("second").source]);

  Object.assign(downloads.get(2), { state: "interrupted", error: "FILE_FAILED" });
  await queue.changed(2);
  const jobs = await queue.list();
  assert.deepEqual(statuses(jobs), { first: "done", second: "failed", third: "running" });
  assert.match(jobs.find(job => job.item.id === "second").message, /FILE_FAILED/);
  assert.deepEqual(active(), [video("third").source]);
});

test("keeps a paused job's place through repeated starts and a worker restart", async (t) => {
  const { queue, downloads, active } = setup(t);
  await queue.enqueue(["first", "second"].map(video), 1);
  await queue.start();
  const first = (await queue.list()).find(job => job.item.id === "first");
  await queue.act(first.id, "pause");
  await queue.changed(1);
  await Promise.all([queue.start(), queue.start()]);
  assert.deepEqual(statuses(await queue.list()), { first: "paused", second: "queued" });
  assert.equal(downloads.size, 1);

  const restarted = makeQueue(() => {});
  await restarted.tick();
  assert.deepEqual(statuses(await restarted.list()), { first: "paused", second: "queued" });
  await restarted.act(first.id, "resume");
  assert.deepEqual(active(), [video("first").source]);
  await restarted.act(first.id, "cancel");
  await restarted.start();
  assert.deepEqual(statuses(await restarted.list()), { first: "cancelled", second: "running" });
  assert.deepEqual(active(), [video("second").source]);
});

test("resumes one persisted paused job while the others wait for its slot", async (t) => {
  const { queue, active } = setup(t, { saved: [
    savedJob("older", "paused", 1), savedJob("newer", "paused", 2), savedJob("waiting", "queued"),
  ] });
  await queue.start();
  assert.deepEqual(active(), []);
  await queue.act("older", "resume");
  await assert.rejects(queue.act("newer", "resume"), /aguarde/i);
  assert.deepEqual(statuses(await queue.list()), { older: "running", newer: "paused", waiting: "queued" });
  assert.deepEqual(active(), [video("older").source]);
});

test("blocks a failed transfer from resuming while a paused job holds the slot", async (t) => {
  const { queue, active } = setup(t, { saved: [
    savedJob("paused", "paused", 1), savedJob("failed", "failed", 2),
  ] });
  await assert.rejects(queue.act("failed", "resume"), /aguarde/i);
  assert.deepEqual(active(), []);
});

test("continues past four validation failures without waiting for the alarm", async (t) => {
  const invalid = ["bad1", "bad2", "bad3", "bad4", "bad5"];
  let inBetween;
  const { queue, active } = setup(t, {
    invalid,
    notify: (_tabId, key, _label, active) => {
      if (key === video("bad4").key && !active) inBetween = queue.list();
    },
  });
  await queue.enqueue([...invalid, "good"].map(video), 1);
  await queue.start();
  assert.deepEqual(statuses(await inBetween), {
    bad1: "failed", bad2: "failed", bad3: "failed", bad4: "failed", bad5: "queued", good: "queued",
  });

  await setImmediate();
  assert.deepEqual(statuses(await queue.list()), {
    bad1: "failed", bad2: "failed", bad3: "failed", bad4: "failed", bad5: "failed", good: "running",
  });
  assert.deepEqual(active(), [video("good").source]);
});

test("the alarm recovers ready work from a saved queue", async (t) => {
  const { queue, active } = setup(t, { saved: [
    savedJob("bad", "failed"), savedJob("waiting", "queued"),
  ] });
  await queue.tick();
  assert.deepEqual(statuses(await queue.list()), { bad: "failed", waiting: "running" });
  assert.deepEqual(active(), [video("waiting").source]);
});

test("a failed Chrome lookup cannot release an already-started transfer's slot", async (t) => {
  const { queue, active } = setup(t, { failFirstSearch: true });
  await queue.enqueue(["first", "second"].map(video), 1);
  await queue.start();
  assert.deepEqual(statuses(await queue.list()), { first: "running", second: "queued" });
  assert.deepEqual(active(), [video("first").source]);
});


test("an incompatible download keeps its slot while Chrome refuses to cancel it", async (t) => {
  let allowCancel = false;
  const { queue, downloads, active } = setup(t, { cancel: (download) => {
    if (!allowCancel) throw new Error("Chrome temporarily unavailable");
    Object.assign(download, { state: "interrupted", error: "USER_CANCELED" });
  } });
  await queue.enqueue(["first", "second"].map(video), 1);
  await queue.start();
  const first = downloads.get(1);
  first.finalUrl = "https://example.org/first.mp4";
  await queue.changed(1);
  assert.deepEqual(active(), [video("first").source]);
  const jobs = await queue.list();
  assert.deepEqual(statuses(jobs), { first: "running", second: "queued" });
  assert.match(jobs.find(job => job.item.id === "first").message, /destino.*cancelamento/i);

  Object.assign(first, { paused: true, canResume: true });
  await queue.tick();
  assert.deepEqual(statuses(await queue.list()), { first: "paused", second: "queued" });
  assert.equal(downloads.size, 1);
  await assert.rejects(queue.act(jobs.find(job => job.item.id === "first").id, "resume"));

  allowCancel = true;
  const restarted = makeQueue(() => {});
  await restarted.tick();
  assert.equal(first.state, "interrupted");
  assert.deepEqual(statuses(await restarted.list()), { first: "review", second: "running" });
  assert.deepEqual(active(), [video("second").source]);
});

test("polling a completion before its Chrome event persists it and starts the next transfer", async (t) => {
  const { queue, downloads, active } = setup(t);
  await queue.enqueue(["first", "second"].map(video), 1);
  await queue.start();
  downloads.get(1).state = "complete";
  assert.deepEqual(statuses(await queue.list()), { first: "done", second: "running" });
  await queue.changed(1);
  assert.deepEqual(active(), [video("second").source]);
  downloads.get(2).state = "complete";
  await queue.list();
  downloads.delete(2);
  assert.deepEqual(statuses(await makeQueue(() => {}).list()), { first: "done", second: "done" });
});

const starting = () => ({
  ...savedJob("first", "starting"), filename: "Mouse Hot/Instagram/perfil-nao-identificado/post_first_1_video.mp4",
});

function recoveredDownload(job, suffix, byExtensionId) {
  return {
    url: job.item.source,
    filename: "C:/Downloads/" + job.filename.replace(/\.mp4$/, suffix + ".mp4"),
    byExtensionId,
  };
}

test("recovery claims Chrome's uniquified target after the worker loses the download ID", async (t) => {
  const first = starting();
  const { queue, downloads } = setup(t, {
    saved: [first, savedJob("second", "queued")],
    native: [recoveredDownload(first, " (1)"), recoveredDownload(first, "", "another-extension")],
  });
  await queue.start();
  assert.deepEqual(statuses(await queue.list()), { first: "running", second: "queued" });
  assert.equal(downloads.size, 2);

  downloads.get(1).state = "complete";
  await queue.changed(1);
  assert.deepEqual(statuses(await queue.list()), { first: "done", second: "running" });
  assert.equal(downloads.get(2).state, "in_progress");
});

test("recovery preserves the slot while matching owned downloads are ambiguous", async (t) => {
  const first = starting();
  const { queue, downloads } = setup(t, {
    saved: [first, savedJob("second", "queued")],
    native: [recoveredDownload(first, ""), recoveredDownload(first, " (2)")],
  });
  await queue.start();
  assert.deepEqual(statuses(await queue.list()), { first: "starting", second: "queued" });
  await assert.rejects(queue.act(first.id, "cancel"), /confira.*Chrome/i);
  await queue.start();
  assert.equal(downloads.size, 2);
  downloads.get(1).state = "complete";
  await queue.tick();
  assert.deepEqual(statuses(await queue.list()), { first: "starting", second: "queued" });
  assert.equal(downloads.size, 2);

  downloads.get(2).state = "complete";
  await queue.tick();
  assert.deepEqual(statuses(await queue.list()), { first: "review", second: "running" });
});


test("recovery waits for Chrome to assign the owned download's target path", async (t) => {
  const first = starting();
  const { queue, downloads } = setup(t, {
    saved: [first, savedJob("second", "queued")],
    native: [{ ...recoveredDownload(first, ""), filename: "" }],
  });
  await queue.start();
  assert.deepEqual(statuses(await queue.list()), { first: "starting", second: "queued" });
  assert.equal(downloads.size, 1);

  downloads.get(1).filename = recoveredDownload(first, " (3)").filename;
  await queue.tick();
  assert.deepEqual(statuses(await queue.list()), { first: "running", second: "queued" });

  downloads.get(1).state = "complete";
  await queue.changed(1);
  assert.deepEqual(statuses(await queue.list()), { first: "done", second: "running" });
});
