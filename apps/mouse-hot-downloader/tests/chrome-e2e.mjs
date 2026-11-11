import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { once } from "node:events";
import { createServer } from "node:http";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const chromePath = process.env.MOUSE_HOT_CHROME ||
  (process.platform === "win32" ? "C:/Program Files/Google/Chrome/Application/chrome.exe" : "/usr/bin/google-chrome");
const profile = await mkdtemp(join(tmpdir(), "mouse-hot-chrome-"));
const downloadPath = join(profile, "downloads");
await mkdir(downloadPath);
await mkdir(join(profile, "Default"));
await writeFile(join(profile, "Default", "Preferences"), JSON.stringify({
  download: { default_directory: downloadPath, prompt_for_download: false },
}));
const photo = await readFile(join(root, "assets/icons/128.png"));
const generated = spawnSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-f", "lavfi",
  "-i", "color=c=blue:s=160x160:r=15", "-t", "0.5", "-c:v", "libx264", "-threads", "1",
  "-movflags", "frag_keyframe+empty_moov", "-f", "mp4", "pipe:1"]);
assert.equal(generated.status, 0, generated.stderr?.toString() || "FFmpeg is required for the test.");
const video = generated.stdout;
let active = 0, peak = 0;
const server = createServer((req, res) => {
  const path = new URL(req.url, "http://localhost").pathname;
  if (path.startsWith("/media/")) {
    if (path.includes("expired")) { res.writeHead(403); return res.end(); }
    const isVideo = path.endsWith(".mp4");
    const bytes = isVideo ? video : photo;
    const type = isVideo ? "video/mp4" : "image/png";
    if (req.headers.range) {
      const size = Math.min(512, bytes.length);
      res.writeHead(206, { "Content-Type": type, "Content-Length": size, "Content-Range": "bytes 0-" + (size - 1) + "/" + bytes.length });
      return res.end(bytes.subarray(0, size));
    }
    res.writeHead(200, { "Content-Type": type, "Content-Length": bytes.length });
    if (!path.includes("slow") || req.headers["sec-fetch-dest"] === "image") return res.end(bytes);
    peak = Math.max(peak, ++active);
    res.once("close", () => active--);
    res.write(bytes.subarray(0, 40));
    return setTimeout(() => res.end(bytes.subarray(40)), 2900);
  }
  res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  if (path === "/ig/fixture/") return res.end(`<!doctype html><main>
    <a href="/ig/p/pending/"><img width="160" height="160" src="/media/photo.png"></a>
    <div style="height:1000px"></div>
    <script>window.addEventListener("scroll", () => document.querySelector("main").insertAdjacentHTML(
      "beforeend", '<a href="/ig/p/dynamic/"><img width="160" height="160" src="/media/photo.png"></a>'), {once:true})</script></main>`);
  if (path === "/ig/reeltest/reels/") return res.end(`<!doctype html><main>
    <a href="/ig/reeltest/reel/livecode/"><img width="140" height="140" src="/media/photo.png"></a>
    <a href="/ig/reel/othercode/"><img width="140" height="140" src="/media/photo.png"></a>
    <script type="application/json">{"result":{"code":"livecode","video_versions":[{"url":"${origin}/media/reel.mp4","width":160,"height":160}]}}</script>
    <script type="application/json">{"result":{"code":"not-on-this-profile","video_url":"${origin}/media/reel.mp4"}}</script>
    </main>`);
  if (path === "/tt/@fixture/video/42") return res.end(`<!doctype html><main>
    <div data-e2e="browse-video"><video width="200" height="180" controls src="/media/reel.mp4"></video></div></main>`);
  if (path === "/ig/p/pending/") return res.end(`<!doctype html><main><article>
    <header><a href="/ig/fixture/">fixture</a></header><img width="160" height="160" src="/media/photo.png"></article></main>`);
  return res.end(`<!doctype html><main><article><header><a href="/ig/fixture/">fixture</a></header>
    <img width="160" height="160" src="/media/slow-1.png" data-index="0">
    <img width="160" height="160" src="/media/slow-2.png" data-index="1">
    <img width="160" height="160" src="/media/slow-3.png" data-index="2">
    <img width="160" height="160" src="/media/expired.png" data-index="3">
    <img width="160" height="160" src="blob:http://127.0.0.1/invalid" data-index="4">
  </article></main>`);
});
await new Promise((done) => server.listen(0, "127.0.0.1", done));
const origin = "http://127.0.0.1:" + server.address().port;

function launch() {
  const browser = spawn(chromePath, [
    "--headless=new", "--no-first-run", "--no-default-browser-check", "--disable-background-networking",
    "--disable-features=DisableLoadExtensionCommandLineSwitch", "--enable-unsafe-extension-debugging",
    "--remote-debugging-pipe", "--user-data-dir=" + profile, "about:blank",
  ], { stdio: ["ignore", "ignore", "pipe", "pipe", "pipe"], windowsHide: true });
  let logs = "", buffer = "", id = 0;
  const replies = new Map();
  browser.stderr.on("data", chunk => { logs = (logs + chunk).slice(-3500); });
  browser.stdio[3].on("error", () => {});
  browser.stdio[4].on("data", chunk => {
    buffer += chunk.toString();
    for (;;) {
      const end = buffer.indexOf("\0");
      if (end < 0) break;
      const message = JSON.parse(buffer.slice(0, end));
      buffer = buffer.slice(end + 1);
      if (!message.id) continue;
      const resolve = replies.get(message.id);
      if (resolve) resolve(message);
    }
  });
  const command = (method, params = {}, sessionId) => new Promise((resolve, reject) => {
    const myId = ++id;
    const timeout = setTimeout(() => { replies.delete(myId); reject(new Error(method + " timed out. " + logs)); }, 14000);
    replies.set(myId, msg => {
      clearTimeout(timeout);
      replies.delete(myId);
      if (msg.error) reject(new Error(method + ": " + msg.error.message)); else resolve(msg.result);
    });
    browser.stdio[3].write(JSON.stringify({ id: myId, method, params, sessionId }) + "\0");
  });
  return { browser, command };
}
let { browser, command } = launch();
async function closeBrowser() {
  const exited = once(browser, "exit");
  await command("Browser.close").catch(() => browser.kill());
  await exited;
}
async function attach(targetId) {
  return (await command("Target.attachToTarget", { targetId, flatten: true })).sessionId;
}
async function open(url) {
  const { targetId } = await command("Target.createTarget", { url });
  return { targetId, session: await attach(targetId) };
}
async function evaluate(target, expression) {
  const result = await command("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true,
    userGesture: true }, target.session);
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
  return result.result.value;
}
async function waitUntil(fn, description, ms = 23000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    const value = await fn();
    if (value) return value;
    await delay(160);
  }
  throw new Error("Timed out: " + description);
}
const panelPage = (id) => "chrome-extension://" + id + "/src/panel/index.html";
const list = target => evaluate(target, "document.querySelector('#items')?.children.length || 0");
const count = (target, state) => evaluate(target, "document.querySelectorAll('.job[data-status=" + state + "]').length");
const click = (target, selector) => evaluate(target, "document.querySelector(" + JSON.stringify(selector) + ")?.click()");
const text = target => evaluate(target, "document.body?.innerText || ''");
try {
  const info = await command("Browser.getVersion");
  const { id: productionId } = await command("Extensions.loadUnpacked", { path: resolve(root, "dist", "release", "Mouse Hot") });
  const production = await open("chrome-extension://" + productionId + "/src/popup/index.html");
  await waitUntil(async () => (await text(production)).includes("Telegram"), "production popup");
  const manifest = await evaluate(production, "chrome.runtime.getManifest()");
  assert.equal(manifest.name, "Mouse Hot");
  assert.equal(manifest.side_panel, undefined);
  if (process.env.MOUSE_HOT_LIVE === "1") {
    const visit = await open("https://www.instagram.com/instagram/reels/");
    await waitUntil(() => evaluate(visit, "document.readyState === 'complete'"), "public Instagram profile");
    await delay(2300);
    const point = await evaluate(visit, `(() => { const b = [...document.querySelectorAll('[role=dialog] button')]
      .find(e => /close|fechar/i.test(e.getAttribute('aria-label') || e.querySelector('svg')?.getAttribute('aria-label') || ''));
      if (!b) return null;
      const r = b.getBoundingClientRect();
      return [r.x + r.width / 2, r.y + r.height / 2]; })()`);
    if (point) {
      for (const type of ["mousePressed", "mouseReleased"]) {
        await command("Input.dispatchMouseEvent", { type, x: point[0], y: point[1], button: "left", clickCount: 1 }, visit.session);
      }
    }
    await delay(2000);
    async function publicOverlay(target) {
      const { root: documentNode } = await command("DOM.getDocument", {}, target.session);
      const { nodeId } = await command("DOM.querySelector", { nodeId: documentNode.nodeId, selector: "#mouse-hot-overlay" }, target.session);
      if (!nodeId) return "overlay not found";
      const { node } = await command("DOM.describeNode", { nodeId, depth: 5, pierce: true }, target.session);
      function flatten(n) {
        return [n.nodeValue, ...(n.shadowRoots || []).flatMap(flatten), ...(n.children || []).flatMap(flatten)];
      }
      return flatten(node).filter(Boolean).slice(0, 4).join(" | ");
    }
    const DOM = await evaluate(visit, `({ path: location.pathname, profileReelLinks: document.querySelectorAll('main a[href*="/reel/"]').length,
      playbackDataBlocks: [...document.querySelectorAll('script[type="application/json"]')]
      .filter(s => /"video_versions"|"video_url"/.test(s.textContent)).length,
      videos: document.querySelectorAll('video').length, loginDialog: !!document.querySelector('[role=dialog]') })`);
    console.log("Live public Instagram:", JSON.stringify({ ...DOM, overlayState: await publicOverlay(visit) }));
    const reel = await evaluate(visit, "document.querySelector('main a[href*=\"/reel/\"]')?.href");
    await command("Target.closeTarget", { targetId: visit.targetId });
    if (reel?.startsWith("https://www.instagram.com/")) {
      const direct = await open(reel);
      await waitUntil(() => evaluate(direct, "document.readyState === 'complete'"), "public Instagram Reel");
      await delay(3000);
      const metrics = await evaluate(direct, `({ path: location.pathname, loginDialog: !!document.querySelector('[role=dialog]'),
        videoSources: [...document.querySelectorAll('video')].map(v => {
          try { return new URL(v.currentSrc || v.src).protocol; } catch { return 'missing'; }
        }), videoMetadata: document.querySelectorAll('meta[property^="og:video"]').length,
        playbackDataBlocks: [...document.querySelectorAll('script[type="application/json"]')]
        .filter(s => /"video_versions"|"video_url"/.test(s.textContent)).length })`);
      const shapes = await evaluate(direct, `(() => {
        const code = location.pathname.split('/').filter(Boolean).at(-1);
        const shapes = [];
        for (const script of document.querySelectorAll('script[type="application/json"]')) {
          if (!/"video_versions"|"video_url"/.test(script.textContent)) continue;
          let root;
          try { root = JSON.parse(script.textContent); } catch { continue; }
          const visit = (node, path, linked) => {
            if (!node || typeof node !== 'object' || path.length > 24 || shapes.length >= 10) return;
            const current = linked || [node.code,node.shortcode,node.media_shortcode].includes(code);
            const properties = ['video_versions','video_url','playback_url'].filter(key => Object.hasOwn(node, key));
            if (properties.length) shapes.push({ path, linked:current, keys:Object.keys(node).slice(0,60),
              properties:properties.map(key => [key, typeof node[key], Array.isArray(node[key]) ? node[key].length : null]) });
            for (const [key,value] of Object.entries(node)) if (typeof value === 'object') visit(value, [...path,key], current);
          };
          visit(root, [], false);
        }
        return shapes;
      })()`);
      console.log("Live public Instagram Reel:", JSON.stringify({ ...metrics, overlayState: await publicOverlay(direct), shapes }));
      const mediaURL = await evaluate(direct, `(() => {
        const code = location.pathname.split('/').filter(Boolean).at(-1);
        for (const script of document.querySelectorAll('script[type="application/json"]')) {
          if (!script.textContent.includes('"video_versions"')) continue;
          let data;
          try { data = JSON.parse(script.textContent); } catch { continue; }
          const pending = [data];
          while (pending.length) {
            const node = pending.pop();
            if (!node || typeof node !== 'object') continue;
            if (node.code === code && node.video_versions?.[0]?.url) return node.video_versions[0].url;
            for (const value of Object.values(node)) if (value && typeof value === 'object') pending.push(value);
          }
        }
      })()`);
      if (mediaURL && /^https:\/\/[\w.-]+\.(?:cdninstagram\.com|fbcdn\.net)\//i.test(mediaURL)) {
        const { targetInfos } = await command("Target.getTargets");
        const worker = targetInfos.find(t => t.type === "service_worker" && t.url.startsWith("chrome-extension://" + productionId + "/"));
        if (worker) {
          const check = await evaluate({ session: await attach(worker.targetId) }, `(async () => {
            try {
              const response = await fetch(${JSON.stringify(mediaURL)}, {
                credentials: 'omit', redirect: 'error', headers: {Range:'bytes=0-511'}, signal: AbortSignal.timeout(7000),
              });
              const reader = response.body.getReader();
              const {value} = await reader.read();
              void reader.cancel();
              return {status: response.status, type: response.headers.get('content-type'),
                mp4: !!value && new TextDecoder().decode(value.slice(4,8)) === 'ftyp'};
            } catch { return {unavailable:true}; }
          })()`);
          console.log("Live public Instagram CDN, 512-byte probe:", JSON.stringify(check));
        }
      }
      await command("Target.closeTarget", { targetId: direct.targetId });
    }
  }
  await command("Target.closeTarget", { targetId: production.targetId });
  await command("Extensions.uninstall", { id: productionId });

  const { id: fixtureId } = await command("Extensions.loadUnpacked", { path: resolve(root, "dist", "fixture") });
  const overlayPage = await open(origin + "/ig/reeltest/reels/");
  const overlay = (query) => evaluate(overlayPage,
    "document.querySelector('#mouse-hot-overlay')?.shadowRoot?.querySelector(" + JSON.stringify(query) + ")?.textContent");
  await waitUntil(async () => (await overlay("#mh-summary"))?.includes("1 disponível"), "automatic overlay binds the embedded video to its reel");
  async function overlayClick(selector) {
    const rect = await evaluate(overlayPage,
      `(() => { const e = document.querySelector("#mouse-hot-overlay").shadowRoot.querySelector(${JSON.stringify(selector)});
        const r = e.getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; })()`);
    for (const type of ["mousePressed", "mouseReleased"]) {
      await command("Input.dispatchMouseEvent", { type, x: rect[0], y: rect[1], button: "left", clickCount: 1 }, overlayPage.session);
    }
  }
  await overlayClick("#mh-toggle");
  assert.match(await overlay("#mh-items"), /Abrir/);
  await overlayClick("#mh-items button[data-download]");
  await waitUntil(async () => (await overlay("#mh-summary"))?.includes("1 salvo"), "embedded video downloaded using overlay");
  assert.deepEqual(await readFile(join(downloadPath, "Mouse Hot", "Instagram", "reeltest", "post_livecode_1_video.mp4")), video);
  const history = await open(panelPage(fixtureId));
  await waitUntil(async () => await count(history, "done") === 1, "overlay download is persisted");
  await click(history, "#clear");
  await waitUntil(async () => await count(history, "done") === 0, "test history cleared");
  await command("Target.closeTarget", { targetId: history.targetId });
  const getTabId = async (url) => {
    const inspector = await open(panelPage(fixtureId));
    try {
      return await waitUntil(() => evaluate(inspector, `(async () => (await globalThis.chrome?.tabs?.query({}) || [])
        .find(tab => tab.url === ${JSON.stringify(url)})?.id)()`), "fixture tab id");
    } finally { await command("Target.closeTarget", { targetId: inspector.targetId }); }
  };
  const igUrl = origin + "/ig/p/fixture-pack/";
  await open(igUrl);
  const igTabId = await getTabId(igUrl);
  const ig = await open(panelPage(fixtureId) + "?fixtureTabId=" + igTabId);
  await waitUntil(async () => await list(ig) === 5, "five Instagram media entries");
  assert.match(await text(ig), /sem arquivo direto/);
  await click(ig, "#select-all");
  await waitUntil(async () => (await text(ig)).includes("Baixar 4 arquivos"), "four selected items");
  await click(ig, "#enqueue");
  await waitUntil(async () => await count(ig, "done") === 3 && await count(ig, "failed") === 1, "three downloads and an expired URL");
  assert.equal(peak, 2, "queue allows exactly two concurrent downloads");
  assert.deepEqual(await readFile(join(downloadPath, "Mouse Hot", "Instagram", "fixture", "post_fixture-pack_1_image.png")), photo);
  await click(ig, "#items .row button");
  await waitUntil(async () => (await text(ig)).includes("já estão na fila ou no histórico"), "duplicate denied");
  await command("Target.closeTarget", { targetId: ig.targetId });
  const reloaded = await open(panelPage(fixtureId) + "?fixtureTabId=" + igTabId);
  await waitUntil(async () => await count(reloaded, "done") === 3, "queue survives closing the panel");

  const ttUrl = origin + "/tt/@fixture/video/42";
  await open(ttUrl);
  const tt = await open(panelPage(fixtureId) + "?fixtureTabId=" + await getTabId(ttUrl));
  await waitUntil(async () => await list(tt) === 1, "TikTok video entry");
  await click(tt, "#items .row button");
  await waitUntil(async () => await count(tt, "done") === 4, "TikTok download");
  assert.deepEqual(await readFile(join(downloadPath, "Mouse Hot", "TikTok", "fixture", "post_42_1_video.mp4")), video);

  const gridUrl = origin + "/ig/fixture/";
  const grid = await open(gridUrl);
  const gridPanel = await open(panelPage(fixtureId) + "?fixtureTabId=" + await getTabId(gridUrl));
  await waitUntil(async () => await list(gridPanel) === 1, "grid discovers a post");
  await command("Target.activateTarget", { targetId: grid.targetId });
  await click(gridPanel, "#scroll-start");
  try {
    await waitUntil(async () => await list(gridPanel) === 2, "auto-scroll detects dynamically inserted post", 9500);
  } catch (error) {
    const gridState = await evaluate(grid, "({hidden: document.hidden, scroll: scrollY, posts: document.querySelectorAll('main a').length})");
    throw new Error(error.message + " " + JSON.stringify(gridState) + " " + await text(gridPanel));
  }
  await click(gridPanel, "#scroll-stop");
  await closeBrowser();
  ({ browser, command } = launch());
  await command("Browser.getVersion");
  const { id: restoredId } = await command("Extensions.loadUnpacked", { path: resolve(root, "dist", "fixture") });
  assert.equal(restoredId, fixtureId);
  const restored = await open(panelPage(restoredId));
  await waitUntil(async () => await count(restored, "done") === 4, "queue survives restarting Chrome");
  console.log(info.product + " — production package loaded. Instagram batch, 2 concurrent, expired URL, duplicate, persisted queue after restart, TikTok video and auto-scroll passed.");
} finally {
  if (browser.exitCode === null) await closeBrowser();
  server.closeAllConnections();
  server.close();
}
