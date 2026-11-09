import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildStorySchedule,
  readStoryStickers,
  validateStoryStickers,
} from "../src/lib/instagram-story-layout.ts";

test("45 Stories fit into 23 days with two times per day", () => {
  const items = Array.from({ length: 45 }, (_, i) => "story-" + i);
  const plan = buildStorySchedule(items, "2026-11-09", "18:00, 09:00", false);
  assert.equal(plan.length, 45);
  assert.deepEqual(plan[0], { media: items[0], date: "2026-11-09", time: "09:00" });
  assert.deepEqual(plan[1], { media: items[1], date: "2026-11-09", time: "18:00" });
  assert.deepEqual(plan[44], { media: items[44], date: "2026-12-01", time: "09:00" });
});

test("shuffling preserves every Story exactly once and does not mutate the editing order", () => {
  const items = Array.from({ length: 45 }, (_, i) => i);
  const plan = buildStorySchedule(items, "2026-11-09", "08:00, 17:00", true, () => 0);
  assert.notDeepEqual(
    plan.map(({ media }) => media),
    items,
  );
  assert.deepEqual(
    plan.map(({ media }) => media).sort((a, b) => a - b),
    items,
  );
  assert.equal(items[0], 0);
  assert.throws(() => buildStorySchedule([...items, 45], "2026-11-09", "09:00", false), /45/);
});

test("a batch starting today uses only the remaining times before continuing tomorrow", () => {
  const plan = buildStorySchedule(
    ["a", "b", "c"],
    "2026-11-09",
    "09:00, 18:00",
    false,
    Math.random,
    "15:15",
  );
  assert.deepEqual(plan, [
    { media: "a", date: "2026-11-09", time: "18:00" },
    { media: "b", date: "2026-11-10", time: "09:00" },
    { media: "c", date: "2026-11-10", time: "18:00" },
  ]);
});

test("the four stickers preserve independent positions and old reminders still load", () => {
  const stickers = validateStoryStickers({
    link: { x: 31, y: 75, value: "https://example.com/oferta" },
    mention: { x: 64, y: 62, value: "perfil" },
    hashtag: { x: 31, y: 88, value: "promoção" },
    text: { x: 62, y: 31, value: "Oferta de hoje" },
  });
  assert.deepEqual(Object.keys(stickers), ["link", "mention", "hashtag", "text"]);
  assert.equal(stickers.link.y, 75);
  assert.equal(stickers.mention.x, 64);
  assert.equal(stickers.mention.value, "@perfil");
  assert.equal(stickers.hashtag.value, "#promoção");
  assert.equal(stickers.text.value, "Oferta de hoje");
  assert.throws(
    () => validateStoryStickers({ link: { x: 50, y: 50, value: "javascript:alert(1)" } }),
    /HTTPS/,
  );
  assert.equal(
    readStoryStickers(null, {
      link_url: "https://example.com/legacy",
      link_title: "Antes",
      sticker_x: 57,
      sticker_y: 71,
    }).link.y,
    71,
  );
});
