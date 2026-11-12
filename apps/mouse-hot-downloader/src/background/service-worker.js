import { cleanPathPart, directVideoSources, makeCandidate, pageInfo } from "../core/media.js";
import { instagramProfileData, instagramProfileHandle } from "../core/profile-data.js";
import { makeQueue } from "./queue-manager.js";

const fixture = typeof __MOUSE_HOT_FIXTURE__ !== "undefined" && __MOUSE_HOT_FIXTURE__;
const captureKey = (tabId) => "mouse-hot.capture." + tabId;
const panelUrl = chrome.runtime.getURL("src/panel/index.html");
const current = async (tabId) => (await chrome.storage.session.get(captureKey(tabId)))[captureKey(tabId)];
const persist = (tabId, state) => chrome.storage.session.set({ [captureKey(tabId)]: state });
const tell = (tabId, message, documentId) => chrome.tabs.sendMessage(tabId, message, documentId ? { documentId } : {}).catch(() => {});
const queue = makeQueue((tabId, key, label, active) => tell(tabId, { type: "capture:state", key, label, active }));
const runQueue = () => void queue.start().catch(() => {});
const captureLocks = new Map();
function sameInstagramPost(a, b) {
  return a.key.startsWith("instagram:post:") && b.key.startsWith("instagram:post:") &&
    a.id === b.id && new URL(a.postUrl).origin === new URL(b.postUrl).origin;
}
function withCapture(tabId, work) {
  const next = (captureLocks.get(tabId) || Promise.resolve()).catch(() => {}).then(work);
  captureLocks.set(tabId, next);
  return next.finally(() => { if (captureLocks.get(tabId) === next) captureLocks.delete(tabId); });
}
async function ensureAlarm() {
  if (!(await chrome.alarms.get("mouse-hot.queue"))) await chrome.alarms.create("mouse-hot.queue", { periodInMinutes: 0.5 });
}
chrome.tabs.onRemoved.addListener(tabId => void withCapture(tabId, () => chrome.storage.session.remove(captureKey(tabId))).catch(() => {}));
chrome.downloads.onChanged.addListener(({ id }) => void queue.changed(id).catch(() => {}));
chrome.alarms.onAlarm.addListener(({ name }) => {
  if (name === "mouse-hot.queue") void queue.tick().catch(() => {});
});
chrome.runtime.onStartup.addListener(() => { void ensureAlarm().catch(() => {}); runQueue(); });
chrome.runtime.onInstalled.addListener(() => { void ensureAlarm().catch(() => {}); runQueue(); });
void ensureAlarm().catch(() => {});
runQueue();

async function content(message, sender) {
  const id = sender.tab?.id;
  const page = pageInfo(sender.url);
  if (!Number.isInteger(id) || sender.frameId !== 0 || !page) throw new Error("Aba incompatível.");
  return withCapture(id, async () => {
    const state = await current(id);
    const origin = new URL(sender.url).origin;
    if (message.type === "capture:register") {
      const keep = state?.origin === origin && state.platform === page.platform;
      await persist(id, { origin, documentId: sender.documentId,
        platform: page.platform, scope: keep ? state.scope : "", account: keep ? state.account : "",
        items: keep ? state.items : [], selected: keep ? state.selected : [],
        scroll: { mode: "idle", message: "" } });
      return true;
    }
    if (!state || state.documentId !== sender.documentId || state.origin !== origin) {
      throw new Error("Recarregue a página para ativar a Mouse Hot.");
    }
    if (message.type === "capture:items") {
      const p = pageInfo(message.url);
      if (!p || p.platform !== state.platform || new URL(message.url).origin !== state.origin ||
        typeof message.scope !== "string" || message.scope.length > 210 || !Array.isArray(message.items)) {
        throw new Error("Captura incompatível.");
      }
      // Preserve a profile collection while opening one of its posts. Reset on switching profiles.
      if (p.surface === "profile" && state.account !== p.handle) {
        state.items = [];
        state.selected = [];
        state.account = p.handle;
      } else if (!state.account && state.scope && message.scope !== state.scope) {
        state.items = [];
        state.selected = [];
      } else if (state.account && (p.handle && p.handle !== state.account || p.surface === "feed" ||
        p.surface === "post" && !state.items.some(i => i.id === p.id) && state.scope !== message.scope)) {
        state.items = [];
        state.selected = [];
        state.account = "";
      }
      state.scope = message.scope;
      const items = new Map(state.items.map(i => [i.key, i]));
      for (const input of message.items.slice(0, 350)) {
        const item = makeCandidate(input, state.platform);
        if (!item || (state.account && item.handle && state.account !== item.handle)) continue;
        if (!item.source && input.reason && input.status === "unavailable") {
          item.status = "unavailable";
          item.reason = typeof input.reason === "string" ? input.reason.slice(0, 160) : "";
        }
        if (item.source && !item.handle && state.account) item.handle = state.account;
        const previous = items.get(item.key);
        if (previous?.source && !item.source) continue;
        if (previous?.source && item.source && item.kind === "video" && item.platform === "instagram") {
          const alternates = directVideoSources([item.source, ...(item.alternates || []),
            previous.source, ...(previous.alternates || [])], item.platform).slice(1);
          if (alternates.length) item.alternates = alternates;
        }
        if (item.status === "open" && item.key.startsWith("instagram:post:") &&
          [...items.values()].some(prior => prior.source && sameInstagramPost(item, prior))) continue;
        if (item.source) {
          for (const [k, prior] of items) {
            const samePost = prior.postUrl === item.postUrl || sameInstagramPost(item, prior);
            if (samePost && prior.status === "open" && k !== item.key) items.delete(k);
          }
        }
        if (items.size >= 350 && !items.has(item.key)) continue;
        items.set(item.key, item);
      }
      state.items = [...items.values()];
      await persist(id, state);
      return true;
    }
    if (message.type === "capture:scroll-state") {
      state.scroll = { mode: ["idle","running","paused"].includes(message.state?.mode) ? message.state.mode : "idle",
        message: typeof message.state?.message === "string" ? message.state.message.slice(0, 140) : "" };
      await persist(id, state);
      return true;
    }
    if (message.type === "capture:save-profile") {
      const profile = instagramProfileData(message.profile, instagramProfileHandle(sender.url));
      if (!profile) throw new Error("Abra o perfil do Instagram para salvar os dados exibidos.");
      const json = JSON.stringify(profile, null, 2) + "\n";
      return chrome.downloads.download({
        url: "data:application/json;charset=utf-8," + encodeURIComponent(json),
        filename: "Mouse Hot/Instagram/" + cleanPathPart(profile.handle) + "/perfil.json",
        conflictAction: "uniquify",
        saveAs: false,
      });
    }
    return command(id, state, message);
  });
}
async function command(id, state, message) {
  const action = message.type.split(":")[1];
  if (action === "queue-action") {
    await queue.act(message.id, message.command);
    runQueue();
    return true;
  }
  if (action === "clear") { await queue.clear(); return true; }
  if (action === "snapshot") {
    const jobs = await queue.list();
    const captured = new Set(state?.items.map(item => item.key));
    return { capture: state ? { scope: state.scope, account: state.account, scroll: state.scroll,
      items: state.items.map(i => ({ ...i, sourceOrigin: i.source ? new URL(i.source).origin : "",
        source: undefined, alternates: undefined })),
      selected: state.selected } : null, jobs: fixture && message.type.startsWith("panel:") ? jobs :
        jobs.filter(job => captured.has(job.item.key)) };
  }
    if (!state) throw new Error("Abra um perfil ou publicação compatível.");
    if (action === "scroll") {
      if (!state.scope.includes(":@") || !["start","stop","pause","resume"].includes(message.command)) {
        throw new Error("Abra a página do perfil para procurar mais publicações.");
      }
      await tell(id, { type: "capture:scroll", command: message.command }, state.documentId);
      return true;
    }
    if (action === "open") {
      const item = state.items.find(i => i.key === message.key);
      if (!item || new URL(item.postUrl).origin !== state.origin) throw new Error("Publicação indisponível nesta aba.");
      await chrome.tabs.update(id, { url: item.postUrl });
      return true;
    }
    if (action === "select") {
      const keys = Array.isArray(message.keys) ? message.keys.slice(0, 350) : [];
      const allowed = new Set(state.items.filter(i => i.source).map(i => i.key));
      const selected = new Set(state.selected.filter(k => allowed.has(k)));
      for (const k of keys) {
        if (allowed.has(k)) (message.selected ? selected.add(k) : selected.delete(k));
      }
      state.selected = [...selected];
      await persist(id, state);
      return true;
    }
    if (action === "enqueue") {
      const explicit = Array.isArray(message.keys);
      const wanted = new Set(explicit ? message.keys.slice(0, 350) : message.key ? [message.key] : state.selected);
      const items = state.items.filter(i => i.source && wanted.has(i.key));
      if (!items.length) throw new Error("Selecione uma mídia com arquivo direto.");
      const result = await queue.enqueue(items, id, { repeat: explicit && message.repeat === true });
      if (!result.added && !explicit) throw new Error(result.full ? "A fila está cheia." :
        "Os itens selecionados já estão na fila ou no histórico.");
      state.selected = state.selected.filter(k => !wanted.has(k));
      await persist(id, state);
      runQueue();
      return message.details === true ? result : result.added;
    }
    throw new Error("Comando indisponível.");
}
async function testPanel(message) {
  if (Number.isInteger(message.fixtureTabId)) {
    const id = message.fixtureTabId;
    return withCapture(id, async () => command(id, await current(id), message));
  }
  return command(null, null, message);
}
chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (sender.id !== chrome.runtime.id || typeof message?.type !== "string") return;
  const fromPanel = fixture && (sender.url === panelUrl || sender.url?.startsWith(panelUrl + "?fixtureTabId="));
  if (fromPanel && !message.type.startsWith("panel:")) return;
  const promise = fromPanel ? testPanel(message) : content(message, sender);
  void promise.then(value => respond({ ok: true, value }), error =>
    respond({ ok: false, error: error.message || "Não foi possível executar a ação." }));
  return true;
});
