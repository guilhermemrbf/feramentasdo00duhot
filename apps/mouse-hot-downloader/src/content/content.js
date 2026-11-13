import { makeCandidate, pageInfo } from "../core/media.js";
import { scanInstagram } from "../adapters/instagram/instagram-adapter.js";
import { readInstagramProfile, resolveInstagramPost } from "../adapters/instagram/profile-download.js";
import { scanTikTok } from "../adapters/tiktok/tiktok-adapter.js";
import { makeAutoScroll, captureLimit } from "./auto-scroll.js";
import { makeDownloadController } from "./download-controller.js";
import { makeOverlay } from "./overlay.js";

if (!globalThis.__mouseHotCapture) {
  globalThis.__mouseHotCapture = true;
  start();
}

function getContext() {
  const url = location.href;
  const page = pageInfo(url);
  if (!page || (page.surface !== "profile" && !page.id)) return null;
  const scope = page.surface === "profile" ? page.platform + ":@" + page.handle :
    page.platform + ":" + page.surface + ":" + page.id;
  return { url, page, scope };
}

function start() {
  const fixture = typeof __MOUSE_HOT_FIXTURE__ !== "undefined" && __MOUSE_HOT_FIXTURE__;
  const send = (type, data = {}) => chrome.runtime.sendMessage({ type: "capture:" + type, ...data }).catch(() => null);
  const seen = new Map();
  const scroll = makeAutoScroll(state => void send("scroll-state", { state }), () => seen.size);
  const overlay = makeOverlay(send, fixture, (action, data) => downloads.run(action, data));
  const downloads = makeDownloadController({
    getContext, collect: scroll.collect, readProfile: readInstagramProfile, resolvePost: resolveInstagramPost,
    send, setOperation: overlay.setOperation,
    getSnapshot: async ({ scan: refreshCapture }) => {
      if (refreshCapture) {
        if (scanning) await scanning;
        await scan();
      }
      return (await send("snapshot"))?.value?.capture;
    },
  });
  let registration, debounce, scope = "", route = "", scanning;

  function schedule() {
    if (route !== location.pathname) downloads.checkScope();
    if (debounce) return;
    debounce = setTimeout(() => {
      debounce = undefined;
      void scan();
    }, 200);
  }

  function scan() {
    if (!scanning) scanning = scanPage().finally(() => { scanning = undefined; });
    return scanning;
  }

  async function scanPage() {
    const context = getContext();
    route = location.pathname;
    const nextScope = context?.scope || "";
    const changed = nextScope !== scope;
    if (changed) {
      downloads.checkScope();
      if (scope) scroll.command("stop");
      scope = nextScope;
      seen.clear();
    }
    overlay.display(nextScope);
    if (!context) return;
    if (!registration) registration = send("register");
    if (!(await registration)?.ok) { registration = undefined; scope = ""; return; }
    if (getContext()?.scope !== nextScope) { schedule(); return; }

    const { page, url } = context;
    const found = new Map();
    const raw = page.platform === "instagram" ? scanInstagram(page) : scanTikTok(page);
    for (const input of raw) {
      const item = makeCandidate(input, page.platform);
      if (!item) continue;
      const old = found.get(item.key);
      if (!old || (!old.source && item.source)) found.set(item.key, item);
    }
    const updated = [];
    for (const item of found.values()) {
      if (seen.size >= captureLimit && !seen.has(item.key)) continue;
      const old = seen.get(item.key);
      const version = JSON.stringify(item);
      if ((old?.source && !item.source) || old?.version === version) continue;
      seen.set(item.key, { version, source: item.source });
      updated.push(item);
    }
    if (updated.length || changed) {
      const response = await send("items", { scope: nextScope, url, items: updated });
      if (!response?.ok) { registration = undefined; scope = ""; return; }
    }
    void overlay.refresh();
  }

  async function refreshVideo({ postUrl, index, handle }) {
    const start = getContext();
    const post = pageInfo(postUrl);
    if (post?.platform !== "instagram" || post.surface !== "post" ||
        start?.page.platform !== "instagram" || new URL(postUrl).origin !== location.origin) return [];
    const samePublication = () => {
      const current = getContext();
      return current?.scope === start.scope &&
        (current.page.surface === "profile" ? current.page.handle === handle : current.page.id === post.id);
    };
    if (!samePublication()) return [];
    const items = await resolveInstagramPost(postUrl);
    const asset = items.find(item => item.kind === "video" && item.index === index);
    return samePublication() && asset ? [asset.source, ...(asset.alternates || [])] : [];
  }

  chrome.runtime.onMessage.addListener((message, sender, respond) => {
    if (sender.id !== chrome.runtime.id) return;
    if (message.type === "capture:scroll") scroll.command(message.command);
    if (message.type === "capture:state") void overlay.refresh();
    if (message.type === "capture:refresh-video") {
      void refreshVideo(message).then(respond, () => respond([]));
      return true;
    }
  });
  const observer = new MutationObserver(schedule);
  observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true,
    attributeFilter: ["src","srcset","poster","aria-current","aria-selected","href"] });
  for (const event of ["loadedmetadata", "play", "load", "popstate"]) window.addEventListener(event, schedule, true);
  setInterval(() => {
    if (route !== location.pathname) schedule();
    else if (scope && !document.hidden) void overlay.refresh();
  }, 1250);
  schedule();
}
