import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { classify, filePath, makeCandidate, mediaUrl, pageInfo, verifyMedia } from "../src/core/media.js";

const reel = "https://www.instagram.com/reel/AbC9/";
const video = "https://a.cdninstagram.com/clip.mp4?signature=ephemeral";
const mp4Header = Buffer.concat([Buffer.from([0, 0, 0, 24]), Buffer.from("ftypisom"), Buffer.alloc(12)]);
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
test("only full video alternatives from approved origins survive capture", () => {
  const other = "https://b.cdninstagram.com/full.mp4";
  const item = candidate({ alternates: [video, other, other,
    "https://b.cdninstagram.com/full.mp4?bytestart=0", "https://example.org/video.mp4",
    "https://b.cdninstagram.com/x.m3u8"] });
  assert.deepEqual(item.alternates, [other]);
});
test("requires a real media signature and reports expired URLs", async () => {
  const sample = (data, mime) => new Response(data, { headers: { "content-type": mime } });
  assert.equal(await verifyMedia(candidate(), async (_, init) => {
    assert.equal(init.credentials, "omit");
    assert.equal(init.redirect, "error");
    return sample(mp4Header, "video/mp4");
  }), "mp4");
  await assert.rejects(verifyMedia(candidate(), () => sample("<html>Not found</html>", "video/mp4")), /não corresponde/);
  await assert.rejects(verifyMedia(candidate(), () => new Response("", { status: 403 })), /expirado ou sem acesso/);
});
test("retries an Instagram video without Range and cancels the response after its prefix", async () => {
  const requests = [];
  let cancelled = false;
  const body = new ReadableStream({
    start(controller) { controller.enqueue(Buffer.concat([mp4Header, Buffer.alloc(488)])); },
    cancel() { cancelled = true; },
  });
  assert.equal(await verifyMedia(candidate(), async (url, options) => {
    const range = new Headers(options.headers).get("range");
    requests.push(range);
    assert.equal(url, video);
    assert.equal(options.credentials, "omit");
    assert.equal(options.redirect, "error");
    if (range) throw new TypeError("Failed to fetch");
    return new Response(body, { headers: { "content-type": "application/octet-stream" } });
  }), "mp4");
  assert.deepEqual(requests, ["bytes=0-511", null]);
  assert.equal(cancelled, true);
});
test("retries Instagram Range rejection and incompatible partial responses", async () => {
  for (const [status, contentRange] of [[400], [416], [206, "bytes 9-511/1024"], [206, "bytes 0-600/1024"],
    [206, "bytes 0-511/400"], [206]]) {
    const requests = [];
    assert.equal(await verifyMedia(candidate(), async (_, options) => {
      const range = new Headers(options.headers).get("range");
      requests.push(range);
      const headers = { "content-type": "video/mp4" };
      if (range && contentRange) headers["content-range"] = contentRange;
      return new Response(mp4Header, { status: range ? status : 200, headers });
    }), "mp4", String(contentRange || status));
    assert.deepEqual(requests, ["bytes=0-511", null]);
  }
});
test("gives the ordinary Instagram request time to run within the verification deadline", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout", "Date"] });
  const requests = [];
  let ordinaryStarted;
  const started = new Promise(resolve => { ordinaryStarted = resolve; });
  const result = verifyMedia(candidate(), (_, options) => {
    const range = new Headers(options.headers).get("range");
    requests.push({ range, signal: options.signal });
    if (!range) ordinaryStarted();
    return new Promise((_, reject) => options.signal.addEventListener("abort", () => reject(options.signal.reason)));
  });
  const rejected = assert.rejects(result, /tempo limite/i);
  assert.equal(requests.length, 1);
  t.mock.timers.tick(4000);
  assert.equal(requests[0].signal.aborted, true);
  await started;
  assert.equal(requests[1].range, null);
  assert.equal(requests[1].signal.aborted, false);
  t.mock.timers.tick(2500);
  await rejected;
  assert.equal(requests[1].signal.aborted, true);
});
test("keeps authorization, unrelated HTTP failures and unsupported content terminal", async () => {
  for (const [status, mime, message] of [[401, "text/html", /sem acesso/], [403, "text/html", /sem acesso/],
    [404, "text/html", /sem acesso/], [410, "text/html", /sem acesso/], [429, "text/html", /HTTP 429/],
    [500, "text/html", /HTTP 500/], [200, "text/html", /formato compatível/], [206, "text/html", /formato compatível/]]) {
    let requests = 0;
    await assert.rejects(verifyMedia(candidate(), async () => {
      requests++;
      return new Response("<html>Unavailable</html>", { status, headers: { "content-type": mime } });
    }), message);
    assert.equal(requests, 1);
  }
});
test("the ordinary Instagram request still requires a complete video response and matching signature", async () => {
  for (const [body, status, message] of [["<html>Unavailable</html>", 200, /não corresponde/],
    [mp4Header.subarray(0, 8), 200, /não corresponde/], [mp4Header, 206, /resposta parcial/]]) {
    let requests = 0;
    await assert.rejects(verifyMedia(candidate(), async (_, options) => {
      requests++;
      if (new Headers(options.headers).has("range")) return new Response("", { status: 416 });
      return new Response(body, { status, headers: {
        "content-type": "video/mp4", "content-range": "bytes 0-23/1024",
      } });
    }), message);
    assert.equal(requests, 2);
  }
});
test("still images and TikTok media do not retry verification without Range", async () => {
  const tiktok = makeCandidate({
    postUrl: "https://www.tiktok.com/@team/video/42",
    source: "https://a.tiktokcdn.com/clip.mp4",
    kind: "video",
  }, "tiktok");
  for (const item of [candidate({ kind: "image" }), tiktok]) {
    let requests = 0;
    await assert.rejects(verifyMedia(item, async () => {
      requests++;
      throw new TypeError("Failed to fetch");
    }), /não foi possível verificar/i);
    assert.equal(requests, 1);
  }
});
test("reports a network error when neither Instagram request connects", async () => {
  let requests = 0;
  await assert.rejects(verifyMedia(candidate(), async () => {
    requests++;
    throw new TypeError("Failed to fetch");
  }), /falha de rede/i);
  assert.equal(requests, 2);
});
test("the installable manifest automatically overlays supported sites and provides quick links", async () => {
  const root = new URL("../", import.meta.url);
  const manifest = JSON.parse(await readFile(new URL("manifest.json", root)));
  assert.equal(manifest.name, "Mouse Hot");
  const packageJson = JSON.parse(await readFile(new URL("package.json", root)));
  assert.equal(manifest.version, packageJson.version);
  assert.deepEqual(manifest.web_accessible_resources, [{ resources: ["icons/48.png"], matches: manifest.content_scripts[0].matches }]);
  assert.equal(manifest.side_panel, undefined);
  assert.ok(!manifest.permissions.includes("cookies"));
  assert.ok(manifest.content_scripts.some(script => script.matches.includes("https://www.instagram.com/*")));
  const html = await readFile(new URL(manifest.action.default_popup, root), "utf8");
  assert.match(html, /https:\/\/www\.tiktok\.com\//);
  assert.match(html, /https:\/\/www\.instagram\.com\//);
  assert.doesNotMatch(html, /telegram/);
});
