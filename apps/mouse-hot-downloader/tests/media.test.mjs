import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { classify, filePath, makeCandidate, mediaUrl, pageInfo, verifyMedia } from "../src/core/media.js";

const reel = "https://www.instagram.com/reel/AbC9/";
const video = "https://a.cdninstagram.com/clip.mp4?signature=ephemeral";
const candidate = (changes = {}) => makeCandidate({
  postUrl: reel, kind: "video", index: 0, handle: "CON", source: video, ...changes,
}, "instagram");

test("recognizes Instagram and TikTok publication routes", () => {
  assert.equal(pageInfo(reel).id, "AbC9");
  assert.deepEqual(pageInfo("https://www.instagram.com/Perfil/reel/AbC9/"), {
    platform: "instagram", id: "AbC9", handle: "perfil", surface: "post",
  });
  assert.equal(pageInfo("https://www.instagram.com/Perfil/reels/").handle, "perfil");
  assert.equal(pageInfo("https://www.instagram.com/stories/perfil/42/").surface, "story");
  assert.equal(pageInfo("https://www.tiktok.com/@team/photo/42").handle, "team");
});
test("rejects unsafe schemes, credentialed URLs, and unrelated hosts", () => {
  for (const url of ["http://a.cdninstagram.com/file", "https://a.cdninstagram.com.evil.com/file",
    "https://127.0.0.1/file", "https://u:p@a.cdninstagram.com/file", "https://a.cdninstagram.com:9050/file",
    "https://foo.tiktokcdn.com/file"]) assert.equal(mediaUrl(url, "instagram"), null);
  assert.match(classify("blob:https://www.instagram.com/aa", "instagram"), /sem arquivo direto/);
  assert.match(classify("https://a.cdninstagram.com/a.m3u8", "instagram"), /segmentos/);
  assert.match(classify("https://a.cdninstagram.com/a.mp4?bytestart=0&byteend=4000", "instagram"), /segmentos/);
});
test("uses stable post identity, distinct carousel positions and Windows-safe names", () => {
  assert.equal(candidate().key, candidate({ source: video.replace("ephemeral", "fresh") }).key);
  assert.notEqual(candidate().key, candidate({ index: 1 }).key);
  assert.equal(filePath(candidate(), "mp4"), "Mouse Hot/Instagram/perfil_con/post_abc9_1_video.mp4");
});
test("requires a real media signature and reports expired URLs", async () => {
  const bytes = Buffer.concat([Buffer.from([0, 0, 0, 24]), Buffer.from("ftypisom"), Buffer.alloc(12)]);
  const sample = (data, mime) => new Response(data, { headers: { "content-type": mime } });
  assert.equal(await verifyMedia(candidate(), async (_, init) => {
    assert.equal(init.credentials, "omit");
    assert.equal(init.redirect, "error");
    return sample(bytes, "video/mp4");
  }), "mp4");
  await assert.rejects(verifyMedia(candidate(), () => sample("<html>Not found</html>", "video/mp4")), /não corresponde/);
  await assert.rejects(verifyMedia(candidate(), () => new Response("", { status: 403 })), /expirado ou sem acesso/);
});
test("the installable manifest automatically overlays supported sites and provides quick links", async () => {
  const root = new URL("../", import.meta.url);
  const manifest = JSON.parse(await readFile(new URL("manifest.json", root)));
  assert.equal(manifest.name, "Mouse Hot");
  assert.equal(manifest.version, "3.0.0");
  assert.deepEqual(manifest.web_accessible_resources, [{ resources: ["icons/48.png"], matches: manifest.content_scripts[0].matches }]);
  assert.equal(manifest.side_panel, undefined);
  assert.ok(!manifest.permissions.includes("cookies"));
  assert.ok(manifest.content_scripts.some(script => script.matches.includes("https://www.instagram.com/*")));
  const html = await readFile(new URL(manifest.action.default_popup, root), "utf8");
  assert.match(html, /https:\/\/www\.tiktok\.com\//);
  assert.match(html, /https:\/\/www\.instagram\.com\//);
  assert.doesNotMatch(html, /telegram/);
});
