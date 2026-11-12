import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { once } from "node:events";
import { createServer } from "node:http";
import { mkdir, mkdtemp, readFile, readdir, writeFile } from "node:fs/promises";
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
function makeVideo(color) {
  const generated = spawnSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-f", "lavfi",
    "-i", "color=c=" + color + ":s=160x160:r=15", "-t", "0.5", "-c:v", "libx264", "-threads", "1",
    "-movflags", "frag_keyframe+empty_moov", "-f", "mp4", "pipe:1"]);
  assert.equal(generated.status, 0, generated.stderr?.toString() || "FFmpeg is required for the test.");
  return generated.stdout;
}
const video = makeVideo("blue");
const serialVideos = new Map([["First3", video], ["Denied3", video], ["Last3", makeVideo("red")]]);
const serialTransfers = [];
let finishFirstReel;
let active = 0, peak = 0, waitRequestStarted = false, waitRequestAborted = false;
let expiredVideoAttempts = 0, interruptedVideoAttempts = 0, rejectedRangeAttempts = 0, ordinaryVideoRequests = 0;
let updatedRetryPost = false;
const server = createServer((req, res) => {
  const path = new URL(req.url, "http://localhost").pathname;
  if (path.startsWith("/media/")) {
    const serialCode = path.match(/^\/media\/serial-(\w+)\.mp4$/)?.[1];
    if (path.includes("expired")) {
      if (path.endsWith(".mp4")) expiredVideoAttempts++;
      res.writeHead(403);
      return res.end();
    }
    if (path === "/media/full-denied.mp4" && req.headers.range !== "bytes=0-511") {
      interruptedVideoAttempts++;
      res.writeHead(403);
      return res.end();
    }
    if (path === "/media/no-range.mp4") {
      if (req.headers.range) {
        rejectedRangeAttempts++;
        req.socket.destroy();
        return;
      }
      ordinaryVideoRequests++;
    }
    const isVideo = path.endsWith(".mp4");
    const bytes = serialVideos.get(serialCode) ?? (isVideo ? video : photo);
    const type = isVideo ? "video/mp4" : "image/png";
    if (req.headers.range) {
      const size = Math.min(512, bytes.length);
      res.writeHead(206, { "Content-Type": type, "Content-Length": size, "Content-Range": "bytes 0-" + (size - 1) + "/" + bytes.length });
      return res.end(bytes.subarray(0, size));
    }
    if (serialVideos.has(serialCode)) {
      serialTransfers.push("start:" + serialCode);
      res.once("finish", () => serialTransfers.push("finish:" + serialCode));
      if (serialCode === "Denied3") {
        res.writeHead(403);
        return res.end();
      }
      if (serialCode === "First3") {
        res.writeHead(200, { "Content-Type": type, "Content-Length": bytes.length });
        res.write(bytes.subarray(0, 512));
        finishFirstReel = () => res.end(bytes.subarray(512));
        return;
      }
    }
    res.writeHead(200, { "Content-Type": type, "Content-Length": bytes.length });
    if (!path.includes("slow") || req.headers["sec-fetch-dest"] === "image") return res.end(bytes);
    peak = Math.max(peak, ++active);
    res.once("close", () => active--);
    res.write(bytes.subarray(0, 40));
    return setTimeout(() => res.end(bytes.subarray(40)), 2900);
  }
  res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  if (path === "/ig/serialcase/reels/") {
    return res.end("<!doctype html><main>" + [...serialVideos.keys()].map(code =>
      '<a href="/ig/serialcase/reel/' + code + '/"><img width="140" height="140" src="/media/photo.png"></a>'
    ).join("") + "</main>");
  }
  const serialPost = path.match(/^\/ig\/serialcase\/reel\/(\w+)\/$/)?.[1];
  if (serialVideos.has(serialPost)) {
    return res.end(`<!doctype html><link rel="canonical" href="${origin}${path}">
      <script type="application/json">${JSON.stringify({ code: serialPost, media_type: 2,
        video_versions: [{ url: "/media/serial-" + serialPost + ".mp4" }] })}</script>`);
  }
  if (path === "/ig/covercase/") {
    const posts = ["Cover3", "OnlyCover3", "RealPhoto3"];
    return res.end("<!doctype html><main>" + posts.map(code =>
      '<a href="/ig/covercase/p/' + code + '/"><img width="140" height="140" src="/media/photo.png"></a>'
    ).join("") + "</main>");
  }
  const coverPost = path.match(/^\/ig\/(?:covercase\/p|reel)\/(Cover3|OnlyCover3|RealPhoto3)\/$/);
  if (coverPost) {
    const [, code] = coverPost;
    const isVideoPage = path.startsWith("/ig/reel/");
    const node = code === "RealPhoto3" ? { media_type: 1, display_url: "/media/photo.png" } :
      code === "Cover3" && isVideoPage ? { media_type: 2, video_versions: [{ url: "/media/reel.mp4" }] } : {};
    return res.end(`<!doctype html><link rel="canonical" href="${origin}${path}">
      <meta property="og:image" content="/media/photo.png">
      <script type="application/json">${JSON.stringify({ code, ...node })}</script>`);
  }
  if (["/ig/vault/", "/ig/canceltest/", "/ig/retrycase/"].includes(path)) {
    const account = path.split("/")[2];
    const tile = (id) => `<a href="/ig/${account}/p/${id}/"><img width="140" height="140" src="/media/photo.png"></a>`;
    const tiles = account === "vault" ? ["Solo3", "Mixed3", "Blocked3"] : account === "retrycase" ? ["Retry3"] : ["Wait3"];
    const lazy = account === "vault" ? `<script>window.addEventListener("scroll", () => document.querySelector("main")
      .insertAdjacentHTML("beforeend", ${JSON.stringify(tile("Lazy3"))}), {once:true})</script>` : "";
    return res.end(`<!doctype html><main><header><h2>${account}</h2><strong data-profile-name>Equipe Mouse Hot</strong>
      <div data-profile-bio>Relatórios e vídeos da equipe</div><a href="https://example.com/">Site da equipe</a>
      <a href="/ig/${account}/followers/">24 seguidores</a></header>
      ${tiles.map(tile).join("")}
      <a style="visibility:hidden" href="/ig/${account}/p/Hidden1/"><img width="140" height="140" src="/media/photo.png"></a>
      <a aria-hidden="true" href="/ig/${account}/p/Hidden2/"><img width="140" height="140" src="/media/photo.png"></a>
      <div style="height:1150px"></div>${lazy}</main>`);
  }
  const archivePost = path.match(/^\/ig\/(vault|canceltest|retrycase)\/p\/(Solo3|Mixed3|Blocked3|Lazy3|Wait3|Retry3)\/$/);
  if (archivePost) {
    const [, , code] = archivePost;
    const image = { media_type: 1, image_versions2: { candidates: [{ url: "/media/photo.png", width: 140, height: 140 }] } };
    const reel = { media_type: 2, video_versions: [{ url: "/media/reel.mp4", width: 160, height: 160 }] };
    const variants = { media_type: 2, video_versions: [
      { url: "/media/expired.mp4", width: 1920, height: 1080 },
      { url: "/media/full-denied.mp4", width: 1280, height: 720 },
      { url: "/media/no-range.mp4", width: 160, height: 160 },
    ] };
    const unavailable = { media_type: 2, video_url: "/media/segmented.m3u8" };
    const retryAlbum = { media_type: 8, carousel_media: [image, { media_type: 2,
      video_url: updatedRetryPost ? "/media/fresh-retry.mp4" : "/media/expired-retry.mp4" }] };
    const node = code === "Mixed3" ? { media_type: 8, carousel_media: [image, reel, unavailable] } :
      code === "Blocked3" ? {} : code === "Solo3" ? variants : code === "Wait3" ? reel : code === "Retry3" ? retryAlbum : image;
    const html = `<!doctype html><link rel="canonical" href="${origin}${path}">
      <script type="application/json">${JSON.stringify({ code, ...node })}</script>`;
    if (code === "Wait3") {
      waitRequestStarted = true;
      const timer = setTimeout(() => res.end(html), 9000);
      res.once("close", () => {
        clearTimeout(timer);
        waitRequestAborted = !res.writableEnded;
      });
      return;
    }
    return res.end(html);
  }
  if (path === "/ig/fixture/") return res.end(`<!doctype html><main>
    <a href="/ig/p/pending/"><img width="160" height="160" src="/media/photo.png"></a>
    <div style="height:1000px"></div>
    <script>window.addEventListener("scroll", () => document.querySelector("main").insertAdjacentHTML(
      "beforeend", '<a href="/ig/p/dynamic/"><img width="160" height="160" src="/media/photo.png"></a>'), {once:true})</script></main>`);
  if (path === "/tt/@fixture") return res.end(`<!doctype html><main>
    <a href="/tt/@fixture/video/42"><img width="160" height="160" src="/media/photo.png"></a>
    <div style="height:1000px"></div>
    <script>window.addEventListener("scroll", () => document.querySelector("main").insertAdjacentHTML(
      "beforeend", '<a href="/tt/@fixture/video/43"><img width="160" height="160" src="/media/photo.png"></a>'), {once:true})</script></main>`);
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
const overlayValue = (target, selector, property = "textContent") => evaluate(target,
  "document.querySelector('#mouse-hot-overlay')?.shadowRoot?.querySelector(" + JSON.stringify(selector) +
  ")?.[" + JSON.stringify(property) + "]");
async function clickOverlay(target, selector) {
  const point = await waitUntil(() => evaluate(target, `(() => {
    const item = document.querySelector("#mouse-hot-overlay")?.shadowRoot?.querySelector(${JSON.stringify(selector)});
    if (!item || item.disabled) return null;
    item.scrollIntoView({ block: "nearest" });
    const rect = item.getBoundingClientRect();
    return rect.width && rect.height ? [rect.x + rect.width / 2, rect.y + rect.height / 2] : null;
  })()`), "visible overlay control " + selector);
  for (const type of ["mousePressed", "mouseReleased"]) {
    await command("Input.dispatchMouseEvent", { type, x: point[0], y: point[1], button: "left", clickCount: 1 }, target.session);
  }
}
async function fileWhenReady(path, expected) {
  await waitUntil(async () => {
    try { return (await readFile(path)).equals(expected); } catch (error) { if (error.code !== "ENOENT") throw error; return false; }
  }, "Chrome saves expected bytes at " + path);
}
async function closedOverlayNode(target, matches) {
  const { root: documentNode } = await command("DOM.getDocument", {}, target.session);
  const { nodeId } = await command("DOM.querySelector", { nodeId: documentNode.nodeId, selector: "#mouse-hot-overlay" }, target.session);
  if (!nodeId) return null;
  const { node } = await command("DOM.describeNode", { nodeId, depth: 12, pierce: true }, target.session);
  function visit(item) {
    if (matches(item)) return item;
    for (const child of [...(item.shadowRoots || []), ...(item.children || [])]) {
      const found = visit(child);
      if (found) return found;
    }
    return null;
  }
  return visit(node);
}
async function clickProductionOverlay(target, name, value, tag = "BUTTON") {
  const node = await waitUntil(() => closedOverlayNode(target, node => node.nodeName === tag &&
    (node.attributes || []).some((attribute, i, all) => i % 2 === 0 && attribute === name && (!value || all[i+1] === value))),
  "production overlay control " + name);
  await command("DOM.scrollIntoViewIfNeeded", { backendNodeId: node.backendNodeId }, target.session);
  const { model } = await command("DOM.getBoxModel", { backendNodeId: node.backendNodeId }, target.session);
  const [x1, y1, , , x2, y2] = model.content;
  for (const type of ["mousePressed", "mouseReleased"]) {
    await command("Input.dispatchMouseEvent", { type, x: (x1 + x2) / 2, y: (y1 + y2) / 2,
      button: "left", clickCount: 1 }, target.session);
  }
}
try {
  const info = await command("Browser.getVersion");
  const { id: productionId } = await command("Extensions.loadUnpacked", { path: resolve(root, "dist", "release", "Mouse Hot") });
  const production = await open("chrome-extension://" + productionId + "/src/popup/index.html");
  await waitUntil(async () => /Abrir Instagram/.test(await text(production)), "production popup");
  assert.match(await text(production), /TikTok/);
  assert.doesNotMatch(await text(production), /Telegram/);
  const manifest = await evaluate(production, "chrome.runtime.getManifest()");
  assert.equal(manifest.name, "Mouse Hot");
  const packageJson = JSON.parse(await readFile(join(root, "package.json"), "utf8"));
  assert.equal(manifest.version, packageJson.version);
  assert.equal(manifest.side_panel, undefined);
  if (process.env.MOUSE_HOT_LIVE === "1") {
    const visit = await open("https://www.instagram.com/instagram/reels/");
    await waitUntil(() => evaluate(visit, "document.readyState === 'complete'"), "public Instagram profile");
    await delay(2300);
    const point = await evaluate(visit, `(() => { const b = [...document.querySelectorAll('[role=dialog] button,[role=dialog] [role=button]')]
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
    if (process.env.MOUSE_HOT_LIVE_MEDIA === "1") {
      assert.ok(reel?.startsWith("https://www.instagram.com/"), "public profile exposes a Reel without logging in");
    }
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
      if (process.env.MOUSE_HOT_LIVE_MEDIA === "1") {
        assert.equal(DOM.loginDialog, false, "public profile is visible after closing Instagram's dialog");
        await command("Target.activateTarget", { targetId: visit.targetId });
        await clickProductionOverlay(visit, "id", "mh-toggle");
        const code = metrics.path.split("/").filter(Boolean).at(-1);
        await clickProductionOverlay(visit, "data-download", "instagram:post:" + code + ":0:video");
        let last = [];
        try {
          const saved = await waitUntil(async () => {
            last = await evaluate(production, `chrome.downloads.search({}).then(items =>
              items.filter(item=>item.byExtensionId===chrome.runtime.id).map(({state,error,filename,mime,bytesReceived})=>
                ({state,error,filename,mime,bytesReceived})))`);
            return last.find(item => item.state === "complete" && /\.mp4$/i.test(item.filename));
          }, "a complete real Instagram MP4 on disk", 32000);
          const bytes = await readFile(saved.filename);
          assert.ok(bytes.length > 1024);
          assert.equal(bytes.toString("ascii", 4, 8), "ftyp");
          const probe = spawnSync("ffprobe", ["-v", "error", "-select_streams", "v:0", "-show_entries",
            "stream=codec_name,duration", "-of", "json", saved.filename], { encoding: "utf8" });
          assert.equal(probe.status, 0, probe.stderr);
          const stream = JSON.parse(probe.stdout).streams[0];
          assert.ok(stream.codec_name && Number(stream.duration) > 0);
          assert.equal(await evaluate(visit, "location.pathname"), DOM.path);
          console.log("Live Instagram profile downloaded a complete MP4 without navigating:",
            JSON.stringify({ bytes: bytes.length, mime: saved.mime, codec: stream.codec_name, seconds: Number(stream.duration) }));
          if (process.env.MOUSE_HOT_LIVE_BATCH === "1") {
            const codes = await evaluate(visit, `[...new Set([...document.querySelectorAll('main a[href*="/reel/"]')]
              .map(a => new URL(a.href).pathname.split('/').filter(Boolean).at(-1)))].slice(1,3)`);
            assert.equal(codes.length, 2);
            for (const selectedCode of codes) {
              await clickProductionOverlay(visit, "data-select", "instagram:post:" + selectedCode + ":0:video", "INPUT");
            }
            await clickProductionOverlay(visit, "id", "mh-download-selected");
            const batch = await waitUntil(async () => {
              const items = await evaluate(production, `chrome.downloads.search({}).then(items => items.filter(
                item => item.byExtensionId === chrome.runtime.id && item.state === "complete")
                .map(({filename,bytesReceived,startTime,endTime})=>({filename,bytesReceived,startTime,endTime})))`);
              const picked = items.filter(item => codes.some(selectedCode => item.filename.toLowerCase().includes(
                "post_" + selectedCode.toLowerCase() + "_1_video.mp4")));
              assert.ok(!items.some(item => item.filename.endsWith(".json")), "media actions must not save JSON");
              return picked.length === codes.length ? picked : null;
            }, "two selected real Instagram MP4s", 42000);
            for (const file of batch) {
              const bytes = await readFile(file.filename);
              assert.equal(bytes.length, file.bytesReceived);
              assert.equal(bytes.toString("ascii", 4, 8), "ftyp");
              assert.ok(Date.parse(file.startTime) <= Date.parse(file.endTime), "Chrome reports both download times");
            }
            batch.sort((a, b) => Date.parse(a.startTime) - Date.parse(b.startTime));
            assert.ok(Date.parse(batch[0].endTime) <= Date.parse(batch[1].startTime),
              "Chrome must finish the first public Reel before starting the second");
            assert.equal(await evaluate(visit, "location.pathname"), DOM.path);
            console.log("Live Instagram selected batch saved two sequential MP4s:",
              JSON.stringify(batch.map(({ bytesReceived, startTime, endTime }) => ({ bytesReceived, startTime, endTime }))));
          }
        } catch (error) {
          const notice = await closedOverlayNode(visit, node => node.nodeName === "P" &&
            (node.attributes || []).includes("mh-operation"));
          const jobs = await evaluate(production, `chrome.storage.local.get("mouse-hot.queue.v1").then(store =>
            (store["mouse-hot.queue.v1"] || []).map(({status,message,received,total})=>({status,message,received,total})))`);
          throw new Error(error.message + " | " + JSON.stringify({ last, jobs, notice: notice?.children?.map(n=>n.nodeValue) }));
        }
      }
      await command("Target.closeTarget", { targetId: direct.targetId });
    }
    await command("Target.closeTarget", { targetId: visit.targetId });
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
  assert.match(await overlay("#mh-items"), /Baixar/);
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
  assert.equal(peak, 1, "queue allows only one active transfer");
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

  const serial = await open(origin + "/ig/serialcase/reels/");
  await waitUntil(async () => (await overlayValue(serial, "#mh-summary"))?.includes("3 publicações"), "three Reels appear on the profile");
  await clickOverlay(serial, "#mh-toggle");
  await clickOverlay(serial, "#mh-select-all");
  await clickOverlay(serial, "#mh-download-selected");
  await waitUntil(() => finishFirstReel, "Chrome starts receiving the first Reel");
  const serialJobs = () => evaluate(restored, `[...document.querySelectorAll('#jobs .job')]
    .filter(job => job.textContent.includes('@serialcase')).map(job => ({ status: job.dataset.status, text: job.textContent }))`);
  await waitUntil(async () => {
    if (serialTransfers.length > 1) return true;
    const states = (await serialJobs()).map(job => job.status).sort();
    return states.join() === "queued,queued,running";
  }, "queue shows one running Reel and two waiting while the first MP4 is incomplete");
  assert.deepEqual(serialTransfers, ["start:First3"], "no second transfer can start before the first MP4 completes");
  finishFirstReel();
  await waitUntil(async () => {
    const states = (await serialJobs()).map(job => job.status).sort();
    return states.join() === "done,done,failed";
  }, "queue reports two complete Reels and keeps the failed Reel");
  const failedReel = (await serialJobs()).find(job => job.status === "failed");
  assert.match(failedReel.text, /Falhou.*post_denied3_1_video\.mp4/i);
  assert.deepEqual(serialTransfers, [
    "start:First3", "finish:First3", "start:Denied3", "finish:Denied3", "start:Last3", "finish:Last3",
  ], "the full requests run in order and the terminal failure releases the next Reel");
  const serialFolder = join(downloadPath, "Mouse Hot", "Instagram", "serialcase");
  await fileWhenReady(join(serialFolder, "post_first3_1_video.mp4"), serialVideos.get("First3"));
  await fileWhenReady(join(serialFolder, "post_last3_1_video.mp4"), serialVideos.get("Last3"));
  assert.deepEqual((await readdir(serialFolder)).sort(), ["post_first3_1_video.mp4", "post_last3_1_video.mp4"]);

  const vault = await open(origin + "/ig/vault/");
  await waitUntil(async () => (await overlayValue(vault, "#mh-summary"))?.includes("3 publicações"), "profile sees three previews");
  await waitUntil(async () => await overlayValue(vault, "header img", "naturalWidth") > 0, "logo loads in the overlay");
  await clickOverlay(vault, "#mh-toggle");
  if (process.env.MOUSE_HOT_SCREENSHOT) {
    const shot = await command("Page.captureScreenshot", { format:"png" }, vault.session);
    await writeFile(process.env.MOUSE_HOT_SCREENSHOT, Buffer.from(shot.data, "base64"));
  }
  assert.match(await overlayValue(vault, "#mh-items"), /Solo3/);
  await clickOverlay(vault, "#mh-items button[data-download]");
  const folder = join(downloadPath, "Mouse Hot", "Instagram", "vault");
  await fileWhenReady(join(folder, "post_solo3_1_video.mp4"), video);
  assert.ok(expiredVideoAttempts > 0, "the preferred URL expired");
  assert.ok(interruptedVideoAttempts > 0, "the next URL passed the probe but failed its Chrome download");
  assert.ok(rejectedRangeAttempts > 0, "the usable CDN URL rejects a Range probe");
  assert.ok(ordinaryVideoRequests >= 2, "the worker verified and Chrome downloaded the file using ordinary GETs");
  assert.equal(await evaluate(vault, "location.pathname"), "/ig/vault/", "single download keeps the profile open");

  await clickOverlay(vault, "#mh-select-all");
  await clickOverlay(vault, "#mh-download-selected");
  await fileWhenReady(join(folder, "post_mixed3_1_image.png"), photo);
  await fileWhenReady(join(folder, "post_mixed3_2_video.mp4"), video);
  await waitUntil(async () => /2 indisponíveis/i.test(
    await overlayValue(vault, "#mh-operation") || ""), "unavailable post reported without stopping the batch");
  assert.equal(await evaluate(vault, "location.pathname"), "/ig/vault/", "batch stays in the profile");

  await clickOverlay(vault, "#mh-download-all");
  await fileWhenReady(join(folder, "post_lazy3_1_image.png"), photo);
  await assert.rejects(readFile(join(folder, "perfil.json")), { code: "ENOENT" });
  await clickOverlay(vault, "#mh-download-profile");
  const exported = await waitUntil(async () => {
    try { return JSON.parse(await readFile(join(folder, "perfil.json"), "utf8")); }
    catch (error) { if (error.code !== "ENOENT") throw error; return false; }
  }, "Chrome saves profile JSON");
  assert.deepEqual(exported, { handle:"vault", name:"Equipe Mouse Hot", biography:"Relatórios e vídeos da equipe",
    links:["https://example.com/"], followers:"24" });
  assert.deepEqual((await readdir(folder)).filter(name => !name.endsWith(".crdownload")).sort(),
    ["perfil.json","post_lazy3_1_image.png","post_mixed3_1_image.png","post_mixed3_2_video.mp4","post_solo3_1_video.mp4"]);
  await clickOverlay(vault, "#mh-items li:has(button[data-download*='Solo3']) button[data-download]");
  await waitUntil(async () => (await readdir(folder)).filter(name => /^post_solo3_1_video.*\.mp4$/.test(name)).length === 2,
    "explicit media re-download is allowed even with history");

  const cancel = await open(origin + "/ig/canceltest/");
  await waitUntil(async () => (await overlayValue(cancel, "#mh-summary"))?.includes("1 publicação"), "cancel fixture");
  await clickOverlay(cancel, "#mh-toggle");
  await clickOverlay(cancel, "#mh-items button[data-download]");
  await waitUntil(() => waitRequestStarted, "permalink fetch started");
  await clickOverlay(cancel, "#mh-abort-download");
  await waitUntil(() => waitRequestAborted, "permalink fetch aborted");
  assert.equal(await evaluate(cancel, "location.pathname"), "/ig/canceltest/");
  await assert.rejects(readFile(join(downloadPath, "Mouse Hot", "Instagram", "canceltest", "post_wait3_1_video.mp4")),
    { code: "ENOENT" });

  const retry = await open(origin + "/ig/retrycase/");
  await waitUntil(async () => (await overlayValue(retry, "#mh-summary"))?.includes("1 publicação"), "retry fixture");
  await clickOverlay(retry, "#mh-toggle");
  await clickOverlay(retry, "#mh-items button[data-download]");
  const retryFolder = join(downloadPath, "Mouse Hot", "Instagram", "retrycase");
  await fileWhenReady(join(retryFolder, "post_retry3_1_image.png"), photo);
  await waitUntil(async () => (await overlayValue(retry, "#mh-jobs"))?.includes("Falhou"), "expired link is reported");
  updatedRetryPost = true;
  await clickOverlay(retry, "#mh-jobs button");
  await fileWhenReady(join(retryFolder, "post_retry3_2_video.mp4"), video);
  await waitUntil(async () => (await overlayValue(retry, "#mh-summary"))?.includes("2 salvos") &&
    await overlayValue(retry, "#mh-jobs") === "", "latest success replaces the old failure");
  assert.deepEqual((await readdir(retryFolder)).sort(), ["post_retry3_1_image.png", "post_retry3_2_video.mp4"]);

  const coverCase = await open(origin + "/ig/covercase/");
  await waitUntil(async () => (await overlayValue(coverCase, "#mh-summary"))?.includes("3 publicações"), "mixed preview grid");
  await clickOverlay(coverCase, "#mh-toggle");
  await clickOverlay(coverCase, "#mh-select-all");
  await clickOverlay(coverCase, "#mh-download-selected");
  const coverFolder = join(downloadPath, "Mouse Hot", "Instagram", "covercase");
  await fileWhenReady(join(coverFolder, "post_realphoto3_1_image.png"), photo);
  await fileWhenReady(join(coverFolder, "post_cover3_1_video.mp4"), video);
  await waitUntil(async () => /1 indisponível/.test(await overlayValue(coverCase, "#mh-operation") || ""),
    "report missing Reel instead of downloading its cover");
  assert.deepEqual((await readdir(coverFolder)).sort(), ["post_cover3_1_video.mp4", "post_realphoto3_1_image.png"]);
  assert.equal(await evaluate(coverCase, "location.pathname"), "/ig/covercase/");

  const tikTokProfile = await open(origin + "/tt/@fixture");
  await waitUntil(async () => (await overlayValue(tikTokProfile, "#mh-summary"))?.includes("1 publicação"), "TikTok profile ready");
  await clickOverlay(tikTokProfile, "#mh-toggle");
  await clickOverlay(tikTokProfile, "#mh-scroll");
  await waitUntil(async () => (await overlayValue(tikTokProfile, "#mh-summary"))?.includes("2 publicações"),
    "TikTok discovers another publication without queueing media");
  await clickOverlay(tikTokProfile, "#mh-scroll");
  await waitUntil(async () => await overlayValue(tikTokProfile, "#mh-scroll") === "Continuar busca", "TikTok scan pauses");
  await clickOverlay(tikTokProfile, "#mh-scroll");
  await clickOverlay(tikTokProfile, "#mh-stop");
  assert.equal((await readdir(join(downloadPath, "Mouse Hot", "TikTok", "fixture"))).length, 1, "scan only saves no file");

  console.log("Mouse Hot — individual and batch media, video fallback after expiry and Chrome interruption, no automatic JSON, carousel, scroll and cancel validated.");
  console.log(info.product + " — production package loaded. One transfer at a time, Reel failure advances the queue, exact MP4 bytes, duplicate, queue persistence and TikTok validated.");
} finally {
  if (browser.exitCode === null) await closeBrowser();
  server.closeAllConnections();
  server.close();
}
