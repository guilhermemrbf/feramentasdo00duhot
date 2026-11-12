import { test } from "node:test";
import assert from "node:assert/strict";
import { makeCandidate } from "../src/core/media.js";
import { canDownloadItem, makeDownloadController } from "../src/content/download-controller.js";

const origin = "https://www.instagram.com";
const reel = origin + "/reel/Reel/";
const carousel = origin + "/p/Slides/";
const account = "creator";
const profile = { handle: account, name: "Creator" };
const candidate = (postUrl, options = {}) => {
  const { source, ...item } = makeCandidate({ postUrl, kind: "video", handle: account, ...options }, "instagram");
  return item;
};
const video = { kind: "video", source: "https://s.cdninstagram.com/video.mp4" };
const photo = { kind: "image", source: "https://s.cdninstagram.com/photo.jpg" };

function setup({ items = [], resolve, collect, send: override, accepts = () => true } = {}) {
  let context = { scope: "instagram:@creator", url: origin + "/creator/", page: { platform: "instagram", surface: "profile", handle: account } };
  const calls = [];
  const operations = [];
  const persisted = new Map();
  const controller = makeDownloadController({
    getContext: () => context,
    getSnapshot: async () => ({ scope: context.scope, account, items: [...new Map([...items.map(item => [item.key, item]), ...persisted]).values()] }),
    collect: collect || (async () => ({ reason: "bottom" })),
    readProfile: () => profile,
    resolvePost: resolve || (async () => []),
    setOperation: (operation) => operations.push(operation),
    send: async (type, data) => {
      calls.push([type, data]);
      if (type === "items") {
        for (const item of data.items.filter(accepts)) persisted.set(item.key, { ...item, source: undefined });
      }
      return override?.(type, data) || { ok: true, value: type === "enqueue" ? data.keys.length : 1 };
    },
  });
  return {
    ...controller, calls, operations,
    navigate(url, scope) { context = { ...context, url, scope }; },
  };
}

test("pending and unavailable Instagram posts can be selected for resolution", () => {
  assert.equal(canDownloadItem(candidate(reel)), true);
  assert.equal(canDownloadItem(candidate(reel, { source: "blob:https://www.instagram.com/id" })), true);
  const tiktok = makeCandidate({ postUrl: "https://www.tiktok.com/@creator/video/42", kind: "video" }, "tiktok");
  assert.equal(canDownloadItem(tiktok), false);
});

test("downloads an Instagram Reel from its profile without navigating", async () => {
  const item = candidate(reel);
  const harness = setup({ items: [item], resolve: async (url, { signal }) => {
    assert.equal(url, reel);
    assert.equal(signal.aborted, false);
    return [{ ...video, postUrl: url }];
  } });
  await harness.run("download-one", { key: item.key });
  assert.deepEqual(harness.calls.map(([type]) => type), ["items", "enqueue"]);
  assert.equal(harness.calls[0][1].url, origin + "/creator/");
  assert.equal(harness.calls[0][1].items[0].handle, account);
  assert.deepEqual(harness.calls[1][1].keys, ["instagram:post:Reel:0:video"]);
});

test("one known photo queues every carousel asset after resolution", async () => {
  const item = candidate(carousel, photo);
  const harness = setup({ items: [item], resolve: async postUrl =>
    [{ ...photo, postUrl, index: 0 }, { ...video, postUrl, index: 1 }] });
  await harness.run("download-one", { key: item.key });
  assert.deepEqual(harness.calls.at(-1)[1].keys, ["instagram:post:Slides:0:image", "instagram:post:Slides:1:video"]);
});

test("selection reports an unavailable post and still queues the next publication once", async () => {
  const items = [candidate(reel), candidate(carousel, photo), candidate(carousel, { ...video, index: 1 })];
  const resolved = [];
  const harness = setup({ items, resolve: async postUrl => {
    resolved.push(postUrl);
    if (postUrl === reel) throw new Error("offline");
    return [{ ...photo, postUrl }, { ...video, postUrl, index: 1 }];
  } });
  await harness.run("download-selected", { keys: items.map(item => item.key) });
  assert.deepEqual(resolved, [reel, carousel]);
  assert.deepEqual(harness.calls.at(-1)[1].keys, ["instagram:post:Slides:0:image", "instagram:post:Slides:1:video"]);
  assert.match(harness.operations.at(-1).message, /1 indispon/);
});

test("does not enqueue resolved items if the profile changes after saving the items", async () => {
  const item = candidate(reel);
  const harness = setup({ items: [item], resolve: async postUrl => [{ ...video, postUrl }], send: (type) => {
    if (type === "items") harness.navigate(origin + "/other/", "instagram:@other");
  } });
  await harness.run("download-one", { key: item.key });
  assert.deepEqual(harness.calls.map(([type]) => type), ["items"]);
});

test("scope changes abort an active permalink fetch and discard its results", async () => {
  const item = candidate(reel);
  let markStarted;
  const started = new Promise(resolve => { markStarted = resolve; });
  const harness = setup({ items: [item], resolve: async (postUrl, { signal }) => {
    markStarted(signal);
    await new Promise(resolve => signal.addEventListener("abort", resolve, { once: true }));
    return [{ ...video, postUrl }];
  } });
  const pending = harness.run("download-one", { key: item.key });
  const signal = await started;
  harness.navigate(origin + "/other/", "instagram:@other");
  harness.checkScope();
  await pending;
  assert.equal(signal.aborted, true);
  assert.deepEqual(harness.calls, []);
});

test("full profile download saves the JSON and queues posts collected while scrolling", async () => {
  const items = [];
  const harness = setup({ items, resolve: async postUrl => [{ ...photo, postUrl }], collect: async () => {
    items.push(candidate(carousel));
    return { reason: "limit" };
  } });
  await harness.run("download-all");
  assert.deepEqual(harness.calls.filter(([type]) => type === "save-profile"), [["save-profile", { profile }]]);
  assert.deepEqual(harness.calls.at(-1)[1].keys, ["instagram:post:Slides:0:image"]);
  assert.match(harness.operations.at(-1).message, /limite/i);
});

test("canceling collection prevents the download and profile export", async () => {
  let markStarted;
  const started = new Promise(resolve => { markStarted = resolve; });
  const harness = setup({ collect: async (signal) => {
    markStarted();
    await new Promise(resolve => signal.addEventListener("abort", resolve, { once: true }));
    return { reason: "cancelled" };
  } });
  const pending = harness.run("download-all");
  await started;
  await harness.run("abort-download");
  await pending;
  assert.deepEqual(harness.calls, []);
  assert.match(harness.operations.at(-1).message, /cancelada/);
});

test("queues accepted carousel assets and reports when capture omitted another asset", async () => {
  const item = candidate(carousel);
  const harness = setup({ items: [item], accepts: asset => asset.index === 0, resolve: async postUrl =>
    [{ ...photo, postUrl, index: 0 }, { ...video, postUrl, index: 1 }] });
  await harness.run("download-one", { key: item.key });
  assert.deepEqual(harness.calls.at(-1)[1].keys, ["instagram:post:Slides:0:image"]);
  assert.match(harness.operations.at(-1).message, /1 indispon/);
});
