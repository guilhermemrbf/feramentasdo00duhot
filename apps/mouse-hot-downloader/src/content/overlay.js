import { captureLimit, scanTimeLimitSeconds } from "./auto-scroll.js";
import { canDownloadItem } from "./download-controller.js";

const css = `
:host { color-scheme:dark; color:#fff0e5; font:14px/1.45 system-ui,sans-serif; }
*, *::before, *::after { box-sizing:border-box; }
section { background:#19151a; border:1px solid #70505b; border-radius:18px; box-shadow:0 12px 44px #000a;
  overflow:hidden; color:#fff0e5; color-scheme:dark; font:14px/1.45 system-ui,sans-serif;
  max-width:calc(100vw - 28px); }
header, .bar, li { display:flex; align-items:center; gap:8px; }
header { padding:12px; background:linear-gradient(105deg,#30202a,#1c171c 76%); }
header img { width:34px; height:34px; border-radius:8px; flex:none; }
header div { display:grid; flex:1; min-width:0; margin-right:6px; }
header strong { font-size:15px; white-space:nowrap; }
header small { color:#e1bec4; }
button { background:#382934; border:1px solid #70505b; border-radius:9px; color:#fff0df;
  padding:7px 10px; font:650 12px system-ui,sans-serif; cursor:pointer; min-height:34px; }
button:not(:disabled):hover { background:#53343e; }
button:disabled { opacity:.54; cursor:default; }
button:focus-visible, input:focus-visible { outline:2px solid #ffc889; outline-offset:2px; }
input { accent-color:#ffc889; }
[hidden] { display:none !important; }
main { padding:10px 12px 12px; width:min(440px, calc(100vw - 30px)); max-height:calc(100dvh - 86px);
  overflow:auto; overscroll-behavior:contain; }
.bar { flex-wrap:wrap; }
ul { padding:0; margin:6px 0 0; list-style:none; overflow:auto; overscroll-behavior:contain; max-height:min(35vh, 270px); }
ul:empty, p:empty { display:none; }
#mh-jobs { max-height:min(20vh, 140px); }
li { min-height:44px; padding:5px 7px; margin-bottom:4px; background:#251f26; border:1px solid #463640;
  border-radius:9px; justify-content:space-between; }
li:has(input:checked) { background:#3b2a31; border-color:#ad795e; }
li input { width:16px; height:16px; flex:none; margin:0 2px; }
li span { flex:1; min-width:0; overflow-wrap:anywhere; }
li small { display:block; }
small, p { color:#dec5ca; font-size:12px; }
p { margin:7px 0 0; overflow-wrap:anywhere; }
#mh-operation[data-error=true], .unavailable { color:#ffb9af; }
.primary { background:#ffc889; color:#28161d; border-color:#ffc889; }
.primary:not(:disabled):hover { background:#ffddb2; }
.job progress { max-width:63px; height:6px; accent-color:#ffc889; }
.group-title { margin:12px 0 5px; color:#fff0e5; font-size:13px; font-weight:750; }
.guide { color:#e7cdd7; margin:0 0 8px; }
.secondary { margin-top:9px; padding-top:8px; border-top:1px solid #4c333a; }
.status { display:inline-block; border-radius:6px; padding:2px 6px; margin-right:5px; background:#393140;
  color:#f2e2f3; font-size:11px; font-weight:750; }
[data-state="running"] .status { background:#193f45; color:#baf6f4; }
[data-state="failed"] .status, [data-state="review"] .status { background:#4e262d; color:#ffc3bd; }
[data-state="paused"] .status { background:#4d3521; color:#ffdb9a; }
.saved { color:#a9e7c2; }
`;
const active = new Set(["queued", "starting", "running", "pausing", "paused"]);
const labels = { done:"Salvo", failed:"Falhou", running:"Baixando", paused:"Pausado", starting:"Preparando",
  queued:"Aguardando", cancelled:"Cancelado", review:"Confira no Chrome" };

export function makeOverlay(send, fixture, runDownload) {
  const host = document.createElement("div");
  host.id = "mouse-hot-overlay";
  host.style.setProperty("all", "initial", "important");
  host.style.setProperty("position", "fixed", "important");
  host.style.setProperty("right", "14px", "important");
  host.style.setProperty("bottom", "16px", "important");
  host.style.setProperty("z-index", "2147483647", "important");
  const shadow = host.attachShadow({ mode: fixture ? "open" : "closed" });
  const styles = new CSSStyleSheet();
  styles.replaceSync(css);
  shadow.adoptedStyleSheets = [styles];
  const box = document.createElement("section");
  box.setAttribute("aria-label", "Mouse Hot");
  const make = (tag, parent, attributes = {}, label = "") => {
    const node = document.createElement(tag);
    for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, value);
    if (tag === "button") node.type = "button";
    if (label) node.textContent = label;
    parent.append(node);
    return node;
  };
  const header = make("header", box);
  make("img", header, { src: chrome.runtime.getURL("icons/48.png"), alt: "", width: "34", height: "34" });
  const heading = make("div", header);
  make("strong", heading, {}, "Mouse Hot");
  const summary = make("small", heading, { id: "mh-summary" }, "Procurando mídias…");
  const toggle = make("button", header, { id: "mh-toggle", class: "primary", "aria-expanded": "false", "aria-controls": "mh-details" }, "Ver mídias");
  const details = make("main", box, { id: "mh-details", hidden: "" });
  make("p", details, { class: "guide" }, "Marque o que quer salvar ou clique em Baixar ao lado de uma publicação.");
  const controls = make("div", details, { class: "bar" });
  const selectAll = make("button", controls, { id: "mh-select-all", disabled: "" }, "Selecionar tudo");
  const downloadSelected = make("button", controls, { id: "mh-download-selected", class: "primary", disabled: "" }, "Baixar seleção");
  const downloadAll = make("button", controls, { id: "mh-download-all", hidden: "" }, "Buscar e baixar tudo");
  const scanOnly = make("button", controls, { id: "mh-scroll", hidden: "" }, "Rolar e procurar");
  const stopScan = make("button", controls, { id: "mh-stop", hidden: "" }, "Parar");
  const cancel = make("button", controls, { id: "mh-abort-download", hidden: "" }, "Cancelar busca");
  const notice = make("p", details, { id: "mh-operation", role: "status" });
  const hint = make("p", details, { id: "mh-hint" });
  const mediaTitle = make("h2", details, { class: "group-title", hidden: "" }, "Publicações encontradas");
  const list = make("ul", details, { id: "mh-items", "aria-label": "Publicações detectadas" });
  const queueTitle = make("h2", details, { class: "group-title", hidden: "" }, "Fila de downloads");
  const queue = make("ul", details, { id: "mh-jobs", "aria-label": "Fila desta página" });
  const footer = make("div", details, { class: "secondary" });
  const downloadProfile = make("button", footer, { id: "mh-download-profile", hidden: "" }, "Exportar dados do perfil");
  make("p", footer, {}, "Os arquivos ficam em Downloads → Mouse Hot.");
  shadow.append(box);

  const selected = new Set();
  const unavailable = new Set();
  let snapshot, stamp, busy = false, scope = "", refreshPromise;
  const onClick = (button, run) => button.addEventListener("click", event => {
    if (event.isTrusted) void run();
  });
  const download = (action, data) => runDownload(action, data).finally(refresh);
  function setOperation({ message, busy: nextBusy, canCancel, error, readyKeys = [], unavailableKeys = [] }) {
    notice.textContent = message;
    notice.dataset.error = String(!!error);
    cancel.hidden = !canCancel;
    let changed = busy !== nextBusy;
    busy = nextBusy;
    for (const key of readyKeys) {
      const wasUnavailable = unavailable.delete(key);
      const wasSelected = selected.delete(key);
      changed ||= wasUnavailable || wasSelected;
    }
    for (const key of unavailableKeys) {
      changed ||= !unavailable.has(key);
      unavailable.add(key);
    }
    if (changed) draw();
  }
  async function action(type, data) {
    const result = await send(type, data);
    if (!result?.ok && !busy) {
      setOperation({ message: result?.error || "Recarregue a página para tentar novamente.", busy: false, error: true });
    }
    await refresh();
  }
  function updateSelection(eligible) {
    const everything = eligible.length > 0 && eligible.every(item => selected.has(item.key));
    selectAll.textContent = everything ? "Limpar seleção" : "Selecionar tudo";
    selectAll.disabled = busy || !eligible.length;
    downloadSelected.disabled = busy || !selected.size;
    downloadSelected.textContent = selected.size ? "Baixar seleção (" + selected.size + ")" : "Baixar seleção";
  }
  function draw() {
    const { capture, jobs: history = [] } = snapshot || {};
    const all = capture?.items || [];
    const jobsByKey = new Map();
    for (const job of history) {
      if (!jobsByKey.has(job.item.key)) jobsByKey.set(job.item.key, job);
    }
    const jobs = [...jobsByKey.values()];
    mediaTitle.hidden = !all.length;
    queueTitle.hidden = !jobs.some(job => job.status !== "done");
    const counts = [];
    const direct = all.filter(item => item.status === "check").length;
    const done = jobs.filter(job => job.status === "done").length;
    const activeJobs = jobs.filter(job => active.has(job.status)).length;
    const failed = jobs.filter(job => job.status === "failed" || job.status === "review").length;
    if (direct) counts.push(direct + (direct === 1 ? " disponível" : " disponíveis"));
    if (all.length > direct) {
      const pending = all.length - direct;
      counts.push(pending + (pending === 1 ? " publicação" : " publicações"));
    }
    if (activeJobs) counts.push(activeJobs + " na fila");
    if (done) counts.push(done + (done === 1 ? " salvo" : " salvos"));
    if (failed) counts.push(failed + (failed === 1 ? " falha" : " falhas"));
    summary.textContent = counts.join(" · ") || (capture ? "Nenhuma mídia encontrada" : "Procurando mídias…");
    const profile = scope.includes(":@");
    downloadAll.hidden = !profile;
    downloadAll.disabled = busy || !capture;
    downloadProfile.hidden = !(profile && scope.startsWith("instagram:"));
    downloadProfile.disabled = busy || !capture;
    const tiktokProfile = profile && scope.startsWith("tiktok:");
    const mode = capture?.scroll?.mode;
    scanOnly.hidden = !tiktokProfile;
    scanOnly.disabled = busy || !capture;
    scanOnly.textContent = mode === "running" ? "Pausar busca" : mode === "paused" ? "Continuar busca" : "Rolar e procurar";
    stopScan.hidden = !tiktokProfile || (mode !== "running" && mode !== "paused");
    stopScan.disabled = busy;
    const hints = [];
    if (tiktokProfile && capture?.scroll?.message) hints.push(capture.scroll.message);
    if (capture && !all.length) hints.push("Nenhuma publicação detectada nesta página.");
    if (profile) hints.push("Até " + captureLimit + " itens ou " + scanTimeLimitSeconds + " segundos de rolagem por busca.");
    hint.textContent = hints.join(" ");
    const eligible = all.filter(canDownloadItem);
    const eligibleKeys = new Set(eligible.map(item => item.key));
    for (const key of selected) {
      if (!eligibleKeys.has(key)) selected.delete(key);
    }
    updateSelection(eligible);
    const currentFocus = shadow.activeElement?.dataset.focus;
    const rows = all.map(item => {
      const row = document.createElement("li");
      const title = document.createElement("span");
      const name = item.status !== "check" ? "Publicação " : item.kind === "video" ? "Vídeo " : "Foto ";
      title.textContent = name + item.id + (item.index ? " · " + (item.index + 1) : "");
      const available = canDownloadItem(item);
      if (unavailable.has(item.key)) {
        make("small", title, { class: "unavailable" }, "Arquivo indisponível");
      } else if (item.reason && !available) {
        make("small", title, {}, item.reason);
      }
      if (available) {
        const input = make("input", row, { type: "checkbox", "aria-label": "Selecionar " + name + item.id });
        input.checked = selected.has(item.key);
        input.disabled = busy;
        input.dataset.select = item.key;
        input.dataset.focus = "select:" + item.key;
        input.addEventListener("change", event => {
          if (!event.isTrusted) return;
          if (input.checked) selected.add(item.key);
          else selected.delete(item.key);
          updateSelection(eligible);
        });
      }
      row.append(title);
      if (!available) {
        const open = make("button", row, { "data-focus": "open:" + item.key }, "Abrir");
        open.disabled = busy;
        onClick(open, () => action("open", { key: item.key }));
        return row;
      }
      const job = jobsByKey.get(item.key);
      const done = job?.status === "done";
      const inQueue = active.has(job?.status);
      if (done) make("small", title, { class: "saved" }, "Salvo no computador");
      const label = done ? "Salvo" : inQueue ? labels[job.status] || "Aguardando" : "Baixar";
      const resolvePost = item.key.startsWith("instagram:post:");
      const button = make("button", row, { "data-download": item.key, "data-focus": "download:" + item.key },
        resolvePost ? "Baixar" : label);
      button.disabled = busy || (!resolvePost && (done || inQueue));
      onClick(button, () => download("download-one", { key: item.key }));
      return row;
    });
    list.replaceChildren(...rows);
    if (currentFocus) [...list.querySelectorAll("[data-focus]")].find(node => node.dataset.focus === currentFocus)?.focus();
    queue.replaceChildren(...jobs.filter(job => job.status !== "done").map(job => {
      const row = document.createElement("li");
      row.className = "job";
      row.dataset.state = job.status;
      const title = make("span", row);
      make("strong", title, { class: "status" }, labels[job.status] || job.status);
      title.append(job.item.id);
      if (job.message) make("small", title, {}, job.message);
      const task = (label, command) => {
        const button = make("button", row, {}, label);
        onClick(button, () => action("queue-action", { id: job.id, command }));
      };
      if (job.status === "running") {
        const progress = make("progress", row, { "aria-label": "Progresso" });
        if (job.total > 0) { progress.max = job.total; progress.value = Math.min(job.total, job.received); }
        task("Pausar", "pause");
      }
      if (job.status === "paused" && job.canResume) task("Retomar", "resume");
      if (active.has(job.status)) task("Cancelar", "cancel");
      if (job.status === "failed") {
        if (job.item.key.startsWith("instagram:post:")) {
          const retry = make("button", row, {}, "Tentar de novo");
          retry.disabled = busy;
          onClick(retry, () => download("retry-one", { key: job.item.key }));
        } else task("Tentar de novo", "retry");
      }
      return row;
    }));
  }

  function refresh() {
    if (!scope || refreshPromise) return refreshPromise;
    refreshPromise = send("snapshot").then(reply => {
      if (!reply?.ok || reply.value.capture?.scope !== scope) return;
      const next = JSON.stringify(reply.value);
      if (next === stamp) return;
      stamp = next;
      snapshot = reply.value;
      draw();
    }).finally(() => { refreshPromise = undefined; });
    return refreshPromise;
  }

  onClick(toggle, () => {
    details.hidden = !details.hidden;
    toggle.textContent = details.hidden ? "Ver mídias" : "Recolher";
    toggle.setAttribute("aria-expanded", String(!details.hidden));
    void refresh();
  });
  onClick(selectAll, () => {
    const eligible = snapshot.capture.items.filter(canDownloadItem);
    if (eligible.every(item => selected.has(item.key))) selected.clear();
    else for (const item of eligible) selected.add(item.key);
    draw();
  });
  onClick(downloadSelected, () => download("download-selected", { keys: [...selected] }));
  onClick(downloadAll, () => download("download-all"));
  onClick(downloadProfile, () => download("download-profile"));
  onClick(scanOnly, () => {
    const mode = snapshot?.capture?.scroll?.mode;
    return action("scroll", { command: mode === "running" ? "pause" : mode === "paused" ? "resume" : "start" });
  });
  onClick(stopScan, () => action("scroll", { command: "stop" }));
  onClick(cancel, () => download("abort-download"));

  return {
    display(nextScope) {
      if (scope !== nextScope) {
        scope = nextScope;
        stamp = snapshot = undefined;
        selected.clear();
        unavailable.clear();
        if (!busy) notice.textContent = "";
        draw();
      }
      if (scope && !host.isConnected) document.documentElement.append(host);
      if (!scope && host.isConnected) host.remove();
    },
    refresh,
    setOperation,
  };
}
