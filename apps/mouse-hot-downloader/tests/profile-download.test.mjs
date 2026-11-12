import assert from "node:assert/strict";
import { test } from "node:test";
import { parseHTML } from "linkedom";

globalThis.__MOUSE_HOT_FIXTURE__ = true;
Object.assign(globalThis, { document: undefined, location: undefined, chrome: undefined });

const origin = "https://www.instagram.com";
const profileUrl = origin + "/fixture/";
const postUrl = origin + "/p/Mixed9/";
const image = "https://images.cdninstagram.com/full.jpg";
const video = "https://videos.cdninstagram.com/full.mp4";
const script = (data) => '<script type="application/json">' + JSON.stringify(data) + "</script>";
const canonical = (url) => '<link rel="canonical" href="' + url + '">';
const photo = { media_type: 1, image_versions2: { candidates: [
  { url: "https://images.cdninstagram.com/small.jpg", width: 150, height: 150 },
  { url: image, width: 1080, height: 1350 },
] } };

function mockPage(t, fetcher, url = profileUrl, html = "") {
  const { document } = parseHTML(html);
  Object.defineProperty(document, "URL", { value: url });
  t.mock.method(globalThis, "fetch", fetcher);
  t.mock.property(globalThis, "document", document);
  t.mock.property(globalThis, "location", new URL(url));
  return document;
}
const htmlResponse = (body, options) => new Response(body, {
  headers: { "content-type": "text/html" }, ...options,
});

test("resolves full media in a mixed carousel with original positions", async t => {
  mockPage(t, async (url, request) => {
    assert.equal(String(url), postUrl);
    assert.equal(request.method, "GET");
    assert.equal(request.credentials, "same-origin");
    assert.equal(request.redirect, "error");
    return htmlResponse(canonical(postUrl) + script({ data: { code: "Mixed9", carousel_media: [
      photo,
      { media_type: 2, video_versions: [{ url: video }], display_url: image },
      { media_type: 2, video_url: "https://videos.cdninstagram.com/stream.m3u8", display_url: image },
      photo,
    ] } }));
  });
  const { resolveInstagramPost } = await import("../src/adapters/instagram/profile-download.js");
  assert.deepEqual(await resolveInstagramPost(postUrl + "?ignored=1#ignored"), [
    { postUrl, index: 0, kind: "image", source: image, thumb: image },
    { postUrl, index: 1, kind: "video", source: video, thumb: image },
    { postUrl, index: 3, kind: "image", source: image, thumb: image },
  ]);
});

test("uses display resources when image candidates contain no valid source", async t => {
  const responses = [[], [{ url: "https://unknown.example/invalid.jpg" }]].map(candidates =>
    htmlResponse(script({ code: "Mixed9", media_type: 1, image_versions2: { candidates },
      display_resources: [{ src: image, config_width: 1080, config_height: 1350 }] })));
  mockPage(t, async () => responses.shift());
  const { resolveInstagramPost } = await import("../src/adapters/instagram/profile-download.js");
  for (let i = 0; i < 2; i++) {
    assert.deepEqual(await resolveInstagramPost(postUrl),
      [{ postUrl, index: 0, kind: "image", source: image, thumb: image }]);
  }
});

test("uses GraphSidecar children even when a malformed matching record also appears", async t => {
  const children = [
    { node: { __typename: "GraphImage", display_url: image } },
    { node: { __typename: "GraphVideo", is_video: true, video_url: video } },
  ];
  mockPage(t, async () => htmlResponse(script([
    { shortcode: "Mixed9", __typename: "GraphSidecar", edge_sidecar_to_children: { edges: children } },
    { shortcode: "Mixed9", video_versions: [{ url: video, width: { toString: null } }] },
  ])));
  const { resolveInstagramPost } = await import("../src/adapters/instagram/profile-download.js");
  assert.deepEqual((await resolveInstagramPost(postUrl)).map(({ index, kind, source }) => ({ index, kind, source })), [
    { index: 0, kind: "image", source: image },
    { index: 1, kind: "video", source: video },
  ]);
});

test("an already cancelled resolver skips the request", async t => {
  let fetched = false;
  mockPage(t, async () => { fetched = true; return htmlResponse(""); });
  const { resolveInstagramPost } = await import("../src/adapters/instagram/profile-download.js");
  assert.deepEqual(await resolveInstagramPost(postUrl, { signal: AbortSignal.abort() }), []);
  assert.equal(fetched, false);
});

test("matches the shortcode exactly and ignores unrelated media and executable scripts", async t => {
  mockPage(t, async () => htmlResponse('<img src="' + image + '">' +
    '<script>' + JSON.stringify({ code: "Mixed9", video_url: video }) + "</script>" +
    script([{ code: "mixed9", ...photo }, { code: "Mixed90", ...photo }])));
  const { resolveInstagramPost } = await import("../src/adapters/instagram/profile-download.js");
  assert.deepEqual(await resolveInstagramPost(postUrl), []);
});

test("requires the canonical to match before using Open Graph media", async t => {
  const photoMeta = '<meta property="og:image" content="' + image + '">';
  const pages = [
    canonical(origin + "/p/Other/") + photoMeta + script({ code: "Mixed9", ...photo }),
    photoMeta,
    canonical(postUrl) + photoMeta,
  ];
  mockPage(t, async () => htmlResponse(pages.shift()));
  const { resolveInstagramPost } = await import("../src/adapters/instagram/profile-download.js");
  assert.deepEqual(await resolveInstagramPost(postUrl), []);
  assert.deepEqual(await resolveInstagramPost(postUrl), []);
  assert.deepEqual(await resolveInstagramPost(postUrl),
    [{ postUrl, index: 0, kind: "image", source: image, thumb: image }]);
});

test("rejects off-origin and non-permalink addresses before requesting anything", async t => {
  let requests = 0;
  mockPage(t, async () => { requests++; return htmlResponse(""); });
  const { resolveInstagramPost } = await import("../src/adapters/instagram/profile-download.js");
  for (const url of ["https://instagram.com/p/Mixed9/", "https://www.instagram.com.evil.test/p/Mixed9/",
    origin + "/p/Mixed9/comments/", origin + "/api/v1/", "https://user@www.instagram.com/p/Mixed9/"]) {
    assert.deepEqual(await resolveInstagramPost(url), []);
  }
  assert.equal(requests, 0);
});

test("skips unavailable, oversized, non-HTML and redirected pages", async t => {
  const body = canonical(postUrl) + script({ code: "Mixed9", ...photo });
  const responses = [
    htmlResponse(body, { status: 404 }),
    new Response(body, { headers: { "content-type": "application/json" } }),
    htmlResponse(body.padEnd(8_000_001)),
    Object.defineProperty(htmlResponse(body), "redirected", { value: true }),
  ];
  mockPage(t, async () => responses.shift());
  const { resolveInstagramPost } = await import("../src/adapters/instagram/profile-download.js");
  for (let i = 0; i < 4; i++) assert.deepEqual(await resolveInstagramPost(postUrl), []);
});

test("reads display data from the current Instagram profile header only", async t => {
  const page = mockPage(t, async () => htmlResponse(""), profileUrl, `<html><body><main><header>
    <h2>fixture</h2><strong data-profile-name>Nome visível</strong>
    <div data-profile-bio>Uma bio pública</div>
    <a href="https://example.org/">Portfólio</a>
    <a hidden href="https://private.example/">Internal link</a>
    <a href="/fixture/followers/">1.234 seguidores</a>
    <a href="/fixture/following/">10 seguindo</a>
  </header><article><a href="https://unrelated.example/">Not a profile link</a></article>
  ${script({ name: "Secret", internal_id: 12345, access_token: "secret" })}</main></body></html>`);
  const { readInstagramProfile } = await import("../src/adapters/instagram/profile-download.js");
  assert.deepEqual(readInstagramProfile(page), {
    handle: "fixture", name: "Nome visível", biography: "Uma bio pública", links: ["https://example.org/"],
    followers: "1.234", following: "10",
  });
});

test("reads an ordinary profile header with separate display name and biography", async t => {
  const page = mockPage(t, async () => htmlResponse(""), profileUrl, `<html><body><main><header>
    <h2>@fixture</h2><section><h1 hidden>Wrong name</h1><h1>Display Name</h1>
    <p>Public biography</p></section><aside><p>Unrelated banner</p></aside>
  </header><article><h1>Unrelated heading</h1><p>Unrelated article</p></article></main></body></html>`);
  const { readInstagramProfile } = await import("../src/adapters/instagram/profile-download.js");
  assert.deepEqual(readInstagramProfile(page), { handle: "fixture", name: "Display Name", biography: "Public biography" });
});

test("omits biography when the only non-handle heading could be a name", async t => {
  const page = mockPage(t, async () => htmlResponse(""), profileUrl, `<html><head>
    <meta property="og:title" content="Display Name (@fixture) • Instagram photos and videos">
    </head><body><main><header><h2>fixture</h2><h1>Display Name</h1></header></main></body></html>`);
  const { readInstagramProfile } = await import("../src/adapters/instagram/profile-download.js");
  assert.deepEqual(readInstagramProfile(page), { handle: "fixture", name: "Display Name" });
});

test("an empty rendered biography does not expose text from hidden descendants", async t => {
  const page = mockPage(t, async () => htmlResponse(""), profileUrl, `<html><body><main><header>
    <h2>fixture</h2><div itemprop="description"><span hidden>Hidden profile text</span></div>
  </header></main></body></html>`);
  const biography = page.querySelector('[itemprop="description"]');
  assert.equal(biography.textContent, "Hidden profile text");
  Object.defineProperty(biography, "innerText", { value: "" });
  const { readInstagramProfile } = await import("../src/adapters/instagram/profile-download.js");
  assert.deepEqual(readInstagramProfile(page), { handle: "fixture" });
});

test("resolves same-origin fixture metadata and declines a reel cover without direct media", async t => {
  const fixtureOrigin = "http://127.0.0.1:8910";
  const fixturePost = fixtureOrigin + "/ig/p/Fixture9/";
  const reel = fixtureOrigin + "/ig/reel/Reel9/";
  const responses = [
    htmlResponse(canonical(fixturePost) + script({ code: "Fixture9", media_type: 1, display_url: "/media/full.png" })),
    htmlResponse(canonical(reel) + '<meta property="og:image" content="/media/cover.png">'),
  ];
  mockPage(t, async () => responses.shift(), fixtureOrigin + "/ig/fixture/");
  const { resolveInstagramPost } = await import("../src/adapters/instagram/profile-download.js");
  const source = fixtureOrigin + "/media/full.png";
  assert.deepEqual(await resolveInstagramPost(fixturePost),
    [{ postUrl: fixturePost, index: 0, kind: "image", source, thumb: source }]);
  assert.deepEqual(await resolveInstagramPost(reel), []);
});

function mockChrome(t) {
  const event = () => ({ addListener: () => {} });
  const session = {};
  const local = {};
  const storage = store => ({
    get: async key => ({ [key]: structuredClone(store[key]) }),
    set: async values => { Object.assign(store, structuredClone(values)); },
  });
  const saved = [];
  let onMessage;
  t.mock.property(globalThis, "chrome", {
    runtime: { id: "mouse-hot-test", getURL: path => "chrome-extension://mouse-hot-test/" + path,
      onMessage: { addListener: listener => { onMessage = listener; } }, onStartup: event(), onInstalled: event() },
    storage: { session: storage(session), local: storage(local) },
    tabs: { onRemoved: event(), sendMessage: async () => {} },
    alarms: { onAlarm: event(), get: async () => true },
    downloads: { onChanged: event(), search: async () => [],
      download: async options => { saved.push(options); return saved.length; } },
  });
  const sender = { id: "mouse-hot-test", url: origin + "/con/", frameId: 0, documentId: "profile", tab: { id: 1 } };
  return { saved, local, send: (message, url = sender.url) =>
    new Promise(resolve => onMessage(message, { ...sender, url }, resolve)) };
}

test("the worker validates the active profile and builds its own filtered download", async t => {
  const { saved, send } = mockChrome(t);
  await import("../src/background/service-worker.js");
  assert.deepEqual(await send({ type: "capture:register" }), { ok: true, value: true });
  const profile = {
    handle: "CON", name: "Nome visível", biography: "Sobre o perfil",
    links: ["https://example.org/", "https://name:secret@example.org/", "javascript:alert(1)"],
    followers: 1200, posts: { hidden: 15 },
    internal_id: "29", token: "secret", cookie: "secret", url: "https://evil.example/secret.json",
  };
  assert.equal((await send({ type: "capture:save-profile", profile: { ...profile, handle: "other" } })).ok, false);
  assert.equal((await send({ type: "capture:save-profile", profile }, postUrl)).ok, false);
  assert.deepEqual(await send({ type: "capture:save-profile", profile }), { ok: true, value: 1 });
  assert.equal(saved.length, 1);
  assert.equal(saved[0].filename, "Mouse Hot/Instagram/perfil_con/perfil.json");
  assert.equal(saved[0].saveAs, false);
  assert.match(saved[0].url, /^data:application\/json[;,]/);
  assert.deepEqual(await (await fetch(saved[0].url)).json(), {
    handle: "con", name: "Nome visível", biography: "Sobre o perfil", links: ["https://example.org/"], followers: 1200,
  });
});

test("explicit enqueue keys select only captured items with a direct source", async t => {
  const { local, send } = mockChrome(t);
  t.mock.method(globalThis, "fetch", async (url, request) => {
    assert.equal(url, video);
    assert.equal(request.headers.Range, "bytes=0-511");
    return new Response(Buffer.concat([Buffer.from([0, 0, 0, 24]), Buffer.from("ftypisom"), Buffer.alloc(12)]),
      { headers: { "content-type": "video/mp4" } });
  });
  await import("../src/background/service-worker.js?queue-test");
  await send({ type: "capture:register" });
  const items = [
    { postUrl, kind: "image", index: 0, source: image },
    { postUrl, kind: "video", index: 1, source: video },
    { postUrl, kind: "video", index: 2, source: "" },
  ];
  await send({ type: "capture:items", scope: "instagram:@con", url: origin + "/con/", items });
  const selected = ["instagram:post:Mixed9:0:image"];
  await send({ type: "capture:select", keys: selected, selected: true });
  assert.deepEqual(await send({ type: "capture:enqueue", keys: ["unknown", "instagram:post:Mixed9:1:video",
    "instagram:post:Mixed9:2:video"] }), { ok: true, value: 1 });
  assert.deepEqual((await send({ type: "capture:snapshot" })).value.capture.selected, selected);
  await send({ type: "capture:items", scope: "instagram:@con", url: origin + "/con/", items: [
    { postUrl: origin + "/con/reel/Alias9/", kind: "video", index: 0 },
    { postUrl: origin + "/reel/Alias9/", kind: "image", index: 0, source: image },
  ] });
  assert.deepEqual((await send({ type: "capture:snapshot" })).value.capture.items.filter(item => item.id === "Alias9")
    .map(item => item.key), ["instagram:post:Alias9:0:image"]);
  await send({ type: "capture:items", scope: "instagram:@con", url: origin + "/con/", items: [
    { postUrl: origin + "/con/reel/Alias9/", kind: "video", index: 0 },
  ] });
  assert.deepEqual((await send({ type: "capture:snapshot" })).value.capture.items.filter(item => item.id === "Alias9")
    .map(item => item.key), ["instagram:post:Alias9:0:image"]);
  assert.deepEqual(await send({ type: "capture:enqueue", keys: ["instagram:post:Mixed9:1:video"] }),
    { ok: true, value: 0 });
  assert.equal(local["mouse-hot.queue.v1"].length, 1);
  assert.equal(local["mouse-hot.queue.v1"][0].filename, "Mouse Hot/Instagram/perfil_con/post_mixed9_2_video.mp4");
  assert.equal(local["mouse-hot.queue.v1"][0].item.source, video);
});

test("a resolved photo can replace its placeholder in a full capture", async t => {
  const { send } = mockChrome(t);
  await import("../src/background/service-worker.js?full-capture");
  await send({ type: "capture:register" });
  const scope = "instagram:@con";
  const url = origin + "/con/";
  const others = Array.from({ length: 349 }, (_, index) => ({
    postUrl: origin + "/p/Other" + index + "/",
    kind: "video", index: 0,
  }));
  await send({ type: "capture:items", scope, url, items: [
    ...others, { postUrl: origin + "/con/p/Mixed9/", kind: "video", index: 0 },
  ] });
  await send({ type: "capture:items", scope, url, items: [
    { postUrl, kind: "image", index: 0, source: image },
    { postUrl, kind: "video", index: 1, source: video },
    { postUrl: origin + "/p/Unrelated/", kind: "image", index: 0, source: image },
  ] });
  const { items } = (await send({ type: "capture:snapshot" })).value.capture;
  assert.deepEqual(items.map(item => item.key), [
    ...others.map((_, index) => "instagram:post:Other" + index + ":0:video"),
    "instagram:post:Mixed9:0:image",
  ]);
  assert.equal(items.at(-1).sourceOrigin, "https://images.cdninstagram.com");
});
