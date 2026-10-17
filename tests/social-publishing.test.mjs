import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { publishInstagramReel } from "../src/lib/social-publishing.server.ts";

const originalFetch = globalThis.fetch;
const originalMetaVersion = process.env.META_GRAPH_API_VERSION;

afterEach(() => {
  globalThis.fetch = originalFetch;
  if (originalMetaVersion === undefined) delete process.env.META_GRAPH_API_VERSION;
  else process.env.META_GRAPH_API_VERSION = originalMetaVersion;
});

test("Instagram Reel waits for a finished container then publishes once", async () => {
  process.env.META_GRAPH_API_VERSION = "v25.0";
  const calls = [];
  globalThis.fetch = async (input, init = {}) => {
    const url = new URL(String(input));
    calls.push({ url, init });
    if (url.pathname.endsWith("/media") && !url.pathname.endsWith("/media_publish")) {
      assert.equal(new URLSearchParams(init.body).get("media_type"), "REELS");
      assert.equal(
        new URLSearchParams(init.body).get("video_url"),
        "https://media.example/video.mp4",
      );
      return Response.json({ id: "container-1" });
    }
    if (url.pathname.endsWith("/container-1")) return Response.json({ status_code: "FINISHED" });
    if (url.pathname.endsWith("/media_publish")) return Response.json({ id: "media-1" });
    throw new Error(`Unexpected URL ${url}`);
  };

  const result = await publishInstagramReel({
    accessToken: "test-token",
    instagramUserId: "ig-user-1",
    publicVideoUrl: "https://media.example/video.mp4",
    caption: "hello",
  });

  assert.deepEqual(result, { mediaId: "media-1" });
  assert.equal(calls.length, 3);
  assert.equal(calls[2].init.method, "POST");
});

test("Instagram refuses non-HTTPS media URLs before calling Meta", async () => {
  process.env.META_GRAPH_API_VERSION = "v25.0";
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    return Response.json({ id: "container" });
  };

  await assert.rejects(
    publishInstagramReel({
      accessToken: "test-token",
      instagramUserId: "ig-user-1",
      publicVideoUrl: "http://media.example/video.mp4",
      caption: "hello",
    }),
    /public HTTPS URL/i,
  );
  assert.equal(calls, 0);
});

test("Instagram does not retry a publish request whose result is ambiguous", async () => {
  process.env.META_GRAPH_API_VERSION = "v25.0";
  let publishCalls = 0;
  globalThis.fetch = async (input) => {
    const url = new URL(String(input));
    if (url.pathname.endsWith("/media")) return Response.json({ id: "container-1" });
    if (url.pathname.endsWith("/container-1")) return Response.json({ status_code: "FINISHED" });
    if (url.pathname.endsWith("/media_publish")) {
      publishCalls += 1;
      throw new TypeError("network connection closed after request");
    }
    throw new Error(`Unexpected URL ${url}`);
  };

  await assert.rejects(
    publishInstagramReel({
      accessToken: "test-token",
      instagramUserId: "ig-user-1",
      publicVideoUrl: "https://media.example/video.mp4",
      caption: "hello",
    }),
    /network connection closed/i,
  );
  assert.equal(publishCalls, 1);
});
