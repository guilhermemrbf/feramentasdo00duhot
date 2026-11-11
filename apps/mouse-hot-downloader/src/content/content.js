import { makeCandidate, pageInfo } from "../core/media.js";
import { scanInstagram } from "../adapters/instagram/instagram-adapter.js";
import { scanTikTok } from "../adapters/tiktok/tiktok-adapter.js";
import { makeAutoScroll } from "./auto-scroll.js";
import { makeOverlay } from "./overlay.js";

if (!globalThis.__mouseHotCapture) {
  globalThis.__mouseHotCapture = true;
  start();
}
function start() {
  const fixture = typeof __MOUSE_HOT_FIXTURE__ !== "undefined" && __MOUSE_HOT_FIXTURE__;
  const send = (type, data = {}) => chrome.runtime.sendMessage({ type: "capture:" + type, ...data }).catch(() => null);
  const overlay = makeOverlay(send, fixture);
  const seen = new Map();
  const scroll = makeAutoScroll(state => void send("scroll-state", { state }), () => seen.size);
  let registration, debounce, scope = "", route = "", scanning = false, rescan = false;
  function schedule() {
    if (debounce) return;
    debounce = setTimeout(() => {
      debounce = undefined;
      void scan();
    }, 200);
  }
  async function scan() {
    if (scanning) { rescan = true; return; }
    scanning = true;
    try {
      const currentUrl = location.href;
      const page = pageInfo(currentUrl);
      route = location.pathname;
      const eligible = !!page && (page.surface === "profile" || !!page.id);
      overlay.display(eligible);
      if (!eligible) {
        if (scope) scroll("stop");
        scope = "";
        seen.clear();
        return;
      }
      const nextScope = page.surface === "profile" ? page.platform + ":@" + page.handle :
        page.platform + ":" + page.surface + ":" + page.id;
      const changed = nextScope !== scope;
      if (changed) {
        if (scope) scroll("stop");
        scope = nextScope;
        seen.clear();
      }
      if (!registration) registration = send("register");
      if (!(await registration)?.ok) { registration = undefined; scope = ""; return; }
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
        if (seen.size >= 350 && !seen.has(item.key)) continue;
        const old = seen.get(item.key);
        const version = JSON.stringify(item);
        if ((old?.source && !item.source) || old?.version === version) continue;
        seen.set(item.key, { version, source: item.source });
        updated.push(item);
      }
      if (updated.length || changed) {
        const response = await send("items", { scope, url: currentUrl, items: updated });
        if (!response?.ok) { registration = undefined; scope = ""; return; }
      }
      void overlay.refresh();
    } finally {
      scanning = false;
      if (rescan) { rescan = false; schedule(); }
    }
  }
  chrome.runtime.onMessage.addListener((message, sender) => {
    if (sender.id !== chrome.runtime.id) return;
    if (message.type === "capture:scroll") scroll(message.command);
    if (message.type === "capture:state") void overlay.refresh();
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
