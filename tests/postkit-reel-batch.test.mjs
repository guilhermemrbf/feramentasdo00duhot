import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildReelSchedule,
  captionWithHashtags,
  dailyReelTimes,
  orderReelVideos,
} from "../src/lib/postkit-reel-batch.ts";
import {
  createInstagramFirstComment,
  createInstagramReelContainer,
} from "../src/lib/social-publishing.server.ts";

test("a thousand numbered videos are scheduled in natural order with six per day", () => {
  const videos = Array.from({ length: 1000 }, (_, index) => ({
    name: `Reel ${1000 - index}.mp4`,
    importPosition: index,
  }));
  const ordered = orderReelVideos(videos, "numeric", true);
  const times = dailyReelTimes(6).split(", ");
  const plan = buildReelSchedule(ordered, ordered.length, "2026-11-10", times, "America/Sao_Paulo");
  assert.equal(plan.length, 1000);
  assert.equal(plan[0].scheduledAt, "2026-11-10T11:00:00.000Z");
  assert.equal(plan[5].date, plan[0].date);
  assert.notEqual(plan[6].date, plan[0].date);
  assert.equal(new Set(plan.map((item) => item.date)).size, 167);
  assert.deepEqual(
    plan.map((item) => item.video.name),
    Array.from({ length: 1000 }, (_, i) => `Reel ${i + 1}.mp4`),
  );
  assert.equal(videos[0].name, "Reel 1000.mp4");
});

test("folder order survives reversed library loading, and shuffling keeps every video", () => {
  const source = [
    { name: "c.mp4", importPosition: 2 },
    { name: "a.mp4", importPosition: 0 },
    { name: "b.mp4", importPosition: 1 },
  ];
  assert.deepEqual(
    orderReelVideos(source, "selection", true).map((item) => item.name),
    ["a.mp4", "b.mp4", "c.mp4"],
  );
  assert.deepEqual(orderReelVideos(source, "selection", false), source);
  const shuffled = orderReelVideos(source, "random", true, () => 0);
  assert.notDeepEqual(shuffled, source);
  assert.deepEqual(new Set(shuffled), new Set(source));
});

test("hashtags are joined with the caption without counting an absent separator", () => {
  assert.equal(captionWithHashtags("   ", " #a "), "#a");
  assert.equal(captionWithHashtags(" Desc ", " #a #b "), "Desc\n\n#a #b");
});

test("the cover is sent during creation and the comment targets the published media", async (t) => {
  const previousVersion = process.env.META_GRAPH_API_VERSION;
  process.env.META_GRAPH_API_VERSION = "v25.0";
  t.after(() => {
    if (previousVersion === undefined) delete process.env.META_GRAPH_API_VERSION;
    else process.env.META_GRAPH_API_VERSION = previousVersion;
  });
  const calls = [];
  t.mock.method(globalThis, "fetch", async (url, options) => {
    calls.push({ url, options });
    return Response.json({ id: "confirmed" });
  });
  assert.equal(
    await createInstagramReelContainer({
      instagramUserId: "acct",
      accessToken: "fixture",
      caption: "#reels",
      publicVideoUrl: "https://media.example/reel.mp4",
      publicCoverUrl: "https://media.example/capa.jpg",
    }),
    "confirmed",
  );
  assert.equal(calls[0].options.body.get("cover_url"), "https://media.example/capa.jpg");
  assert.equal(calls[0].options.body.get("caption"), "#reels");
  assert.equal(
    await createInstagramFirstComment({
      accessToken: "fixture",
      mediaId: "published-reel",
      message: "#primeiro",
      authMode: "facebook_login",
    }),
    "published",
  );
  assert.equal(calls[1].url.href, "https://graph.facebook.com/v25.0/published-reel/comments");
  assert.equal(calls[1].options.body.get("message"), "#primeiro");
  assert.equal(calls[1].options.headers.Authorization, "Bearer fixture");
});
