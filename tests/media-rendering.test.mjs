import test from "node:test";
import assert from "node:assert/strict";
import { renderLocalVideo } from "../src/lib/media/render.ts";
function environment(t, { playError = false, drawError = false, noEnd = false } = {}) {
  const saved = {
    document: globalThis.document,
    MediaRecorder: globalThis.MediaRecorder,
    requestAnimationFrame: globalThis.requestAnimationFrame,
    cancelAnimationFrame: globalThis.cancelAnimationFrame,
    create: URL.createObjectURL,
    revoke: URL.revokeObjectURL,
  };
  let revoked = 0,
    stopped = 0,
    draws = 0,
    paused = 0;
  const track = () => ({
      stop() {
        stopped++;
      },
    }),
    audio = track();
  const video = {
    videoWidth: 120,
    videoHeight: 80,
    duration: 1,
    onloadeddata: null,
    onended: null,
    onerror: null,
    set src(value) {
      queueMicrotask(() => this.onloadeddata?.());
    },
    captureStream() {
      return { getAudioTracks: () => [audio], getTracks: () => [audio] };
    },
    async play() {
      if (playError) throw new Error("play failed");
      if (!noEnd) setTimeout(() => this.onended?.(), 8);
    },
    pause() {
      paused++;
    },
    load() {},
    removeAttribute() {},
  };
  const canvas = {
    width: 0,
    height: 0,
    getContext: () => ({}),
    captureStream() {
      return { addTrack() {}, getTracks: () => [track()] };
    },
  };
  class Recorder {
    static isTypeSupported() {
      return true;
    }
    state = "inactive";
    start() {
      this.state = "recording";
    }
    stop() {
      this.state = "inactive";
      queueMicrotask(() => {
        this.ondataavailable?.({ data: new Blob(["encoded"]) });
        this.onstop?.();
      });
    }
  }
  globalThis.document = { createElement: (name) => (name === "video" ? video : canvas) };
  globalThis.MediaRecorder = Recorder;
  globalThis.requestAnimationFrame = (callback) => setTimeout(callback, 2);
  globalThis.cancelAnimationFrame = clearTimeout;
  URL.createObjectURL = () => "blob:test";
  URL.revokeObjectURL = () => {
    revoked++;
  };
  t.after(() => {
    for (const key of [
      "document",
      "MediaRecorder",
      "requestAnimationFrame",
      "cancelAnimationFrame",
    ]) {
      if (saved[key] === undefined) delete globalThis[key];
      else globalThis[key] = saved[key];
    }
    URL.createObjectURL = saved.create;
    URL.revokeObjectURL = saved.revoke;
  });
  return {
    video,
    draw() {
      draws++;
      if (drawError) throw new Error("draw failed");
    },
    stats: () => ({ revoked, stopped, draws, paused, canvasWidth: canvas.width }),
  };
}
test("local video rendering exports a Blob and releases media tracks and source URL", async (t) => {
  const env = environment(t);
  const output = await renderLocalVideo({}, env.draw, new AbortController().signal);
  assert.equal(output.type, "video/webm");
  assert.ok(output.size > 0);
  assert.equal(env.stats().revoked, 1);
  assert.equal(env.stats().stopped, 2);
  assert.equal(env.stats().canvasWidth, 0);
});
test("cancel during rendering rejects without producing a success and releases resources", async (t) => {
  const env = environment(t, { noEnd: true }),
    controller = new AbortController();
  const work = renderLocalVideo({}, env.draw, controller.signal);
  setTimeout(() => controller.abort(), 8);
  await assert.rejects(work, { name: "AbortError" });
  assert.equal(env.stats().revoked, 1);
  assert.equal(env.stats().stopped, 2);
});
test("playback failure does not leak capture tracks or URL", async (t) => {
  const env = environment(t, { playError: true });
  await assert.rejects(renderLocalVideo({}, env.draw, new AbortController().signal), /play failed/);
  assert.equal(env.stats().revoked, 1);
  assert.equal(env.stats().stopped, 2);
});
test("cancellation before opening a file has no side effects", async (t) => {
  const env = environment(t),
    controller = new AbortController();
  controller.abort();
  await assert.rejects(renderLocalVideo({}, env.draw, controller.signal), { name: "AbortError" });
  assert.equal(env.stats().revoked, 0);
});

test("drawing failure releases the source URL before capture starts", async (t) => {
  const env = environment(t, { drawError: true });
  await assert.rejects(renderLocalVideo({}, env.draw, new AbortController().signal), /draw failed/);
  assert.equal(env.stats().revoked, 1);
  assert.equal(env.stats().canvasWidth, 0);
});
