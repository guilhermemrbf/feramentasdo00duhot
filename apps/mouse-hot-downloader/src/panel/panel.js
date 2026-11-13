const fixture = typeof __MOUSE_HOT_FIXTURE__ !== "undefined" && __MOUSE_HOT_FIXTURE__;
const testTabId = fixture ? Number(new URLSearchParams(location.search).get("fixtureTabId")) : null;
const $ = (id) => document.getElementById(id);
const labels = {
  queued: "Aguardando", starting: "Preparando download", running: "Baixando",
  paused: "Pausado", done: "Salvo", failed: "Falhou", cancelled: "Cancelado", review: "Confira no Chrome",
};
const terminal = new Set(["done","failed","cancelled","review"]);
const site = (item) => item.platform === "instagram" ? "Instagram" : "TikTok";
let capture, needed = [], busy = false, fetching = false, captureStamp = "", queueStamp = "";
function el(tag, className, content) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (content) node.textContent = content;
  return node;
}
function control(label, action) {
  const button = el("button", "soft", label);
  button.type = "button";
  button.addEventListener("click", action);
  return button;
}
function notice(message, isError = false) {
  $("notice").textContent = message;
  $("notice").dataset.error = String(isError);
  $("notice").hidden = !message;
}
async function send(type, data = {}) {
  const reply = await chrome.runtime.sendMessage({ type: "panel:" + type,
    ...(testTabId ? { fixtureTabId: testTabId } : {}), ...data });
  if (!reply?.ok) throw new Error(reply?.error || "O Chrome não respondeu. Tente novamente.");
  return reply.value;
}
async function refresh() {
  if (fetching || busy) return;
  fetching = true;
  try {
    const snapshot = await send("snapshot");
    if (busy) return;
    capture = snapshot.capture;
    const origins = [...new Set((capture?.items || []).map(i => i.sourceOrigin).filter(Boolean))];
    const grants = await chrome.permissions.getAll();
    needed = origins.filter(origin => !(grants.origins || []).includes(origin + "/*") &&
      !(fixture && origin.startsWith("http://127.0.0.1:")));
    renderCapture();
    renderJobs(snapshot.jobs);
  } catch (err) {
    notice(err.message, true);
  } finally { fetching = false; }
}
async function action(type, data, feedback) {
  if (busy) return;
  busy = true;
  try {
    const value = await send(type, data);
    notice(feedback ? feedback(value) : "");
  } catch (err) { notice(err.message, true); }
  finally { busy = false; await refresh(); }
}
function renderCapture() {
  const stamp = JSON.stringify([capture, needed]);
  if (stamp === captureStamp) return;
  captureStamp = stamp;
  const items = capture?.items || [];
  const selected = new Set(capture?.selected || []);
  const available = items.filter(i => i.status === "check");
  const collection = capture?.account ? " · @" + capture.account : "";
  const platform = capture?.scope?.startsWith("instagram:") ? "Instagram" : "TikTok";
  $("source").textContent = capture?.scope ? platform + collection : "Aguardando";
  $("capture-hint").textContent = !capture ?
    "Abra o Instagram ou TikTok e clique no ícone Mouse Hot na barra do Chrome." :
    !items.length ? "Abra uma publicação ou role o perfil para encontrar mídias." :
    items.length + " encontrada(s) · " + selected.size + " selecionada(s). O arquivo é verificado antes de baixar.";
  $("allow").hidden = !needed.length;
  $("scroll-tools").hidden = !capture?.scope?.includes(":@");
  $("scroll-stop").hidden = !["running","paused"].includes(capture?.scroll.mode);
  $("scroll-start").textContent = capture?.scroll.mode === "running" ? "Pausar busca" :
    capture?.scroll.mode === "paused" ? "Continuar busca" : "Rolar e procurar";
  $("scroll-info").textContent = capture?.scroll.message || "";
  $("selection-tools").hidden = !available.length;
  $("select-all").disabled = available.every(i => selected.has(i.key));
  $("select-none").disabled = !selected.size;
  $("enqueue").hidden = !available.length;
  $("enqueue").disabled = !selected.size;
  $("enqueue").textContent = selected.size ? "Baixar " + selected.size + (selected.size === 1 ? " arquivo" : " arquivos") : "Baixar selecionadas";
  const priorFocus = document.activeElement?.dataset.mediaKey;
  $("items").replaceChildren(...items.map(item => {
    const row = el("li", "row");
    const title = item.kind === "image" ? "Foto" : "Vídeo";
    if (item.status === "check") {
      const input = el("input");
      input.type = "checkbox";
      input.checked = selected.has(item.key);
      input.setAttribute("aria-label", "Selecionar " + title.toLowerCase() + " " + item.id);
      input.dataset.mediaKey = item.key;
      input.addEventListener("change", () => void action("select", { keys: [item.key], selected: input.checked }));
      row.append(input);
    }
    if (item.thumb) {
      const img = el("img", "thumb");
      img.alt = "";
      img.loading = "lazy";
      img.referrerPolicy = "no-referrer";
      img.src = item.thumb;
      img.addEventListener("error", () => img.remove(), { once: true });
      row.append(img);
    }
    const copy = el("div", "copy");
    copy.append(el("strong", "", item.status === "open" ? "Publicação" : title),
      el("small", "", item.status === "check" ? "Arquivo detectado" : item.reason || "Abra para verificar o arquivo"));
    row.append(copy);
    if (item.status === "open") row.append(control("Abrir", () => void action("open", { key: item.key })));
    if (item.status === "check") row.append(control("Baixar", () => void action("enqueue", { key: item.key }, queued)));
    return row;
  }));
  if (priorFocus) [...$("items").querySelectorAll("input")].find(i => i.dataset.mediaKey === priorFocus)?.focus();
}
function renderJobs(jobs) {
  const stamp = JSON.stringify(jobs);
  if (stamp === queueStamp) return;
  queueStamp = stamp;
  $("clear").hidden = !jobs.some(j => terminal.has(j.status));
  $("queue-hint").textContent = !jobs.length ? "Os arquivos salvos ficam em Downloads → Mouse Hot." :
    jobs.filter(j => j.status === "done").length + " salvos de " + jobs.length +
    " na lista · um download por vez";
  $("jobs").replaceChildren(...jobs.map(job => {
    const row = el("li", "row job");
    row.dataset.status = job.status;
    const copy = el("div", "copy");
    copy.append(el("strong", "", (labels[job.status] || job.status) + " · " + site(job.item)),
      el("small", "", [job.item.handle && "@" + job.item.handle, job.filename?.split("/").at(-1),
        job.message || ""].filter(Boolean).join(" · ")));
    row.append(copy);
    if (["running","paused"].includes(job.status)) {
      const progress = el("progress");
      progress.setAttribute("aria-label", "Progresso do download");
      if (job.total > 0) { progress.max = job.total; progress.value = Math.min(job.total, job.received); }
      row.append(progress);
    }
    const actions = el("div", "toolbar");
    function add(label, command) {
      actions.append(control(label, () => void action("queue-action", { id: job.id, command })));
    }
    if (job.status === "running") add("Pausar", "pause");
    if (["paused","failed"].includes(job.status) && job.canResume) add("Retomar", "resume");
    if (!terminal.has(job.status)) add("Cancelar", "cancel");
    if (["failed","review"].includes(job.status)) add("Tentar de novo", "retry");
    if (actions.childElementCount) row.append(actions);
    return row;
  }));
}
const queued = (count) => count + (count === 1 ? " arquivo adicionado à fila." : " arquivos adicionados à fila.");
$("allow").addEventListener("click", async () => {
  if (!needed.length) return;
  try {
    const accepted = await chrome.permissions.request({ origins: needed.map(origin => origin + "/*") });
    notice(accepted ? "Acesso liberado para verificar os arquivos." : "A permissão de mídia não foi concedida.", !accepted);
    await refresh();
  } catch (err) { notice(err.message, true); }
});
$("select-all").addEventListener("click", () => void action("select", {
  keys: capture.items.filter(i => i.status === "check").map(i => i.key), selected: true,
}));
$("select-none").addEventListener("click", () => void action("select", { keys: capture.selected, selected: false }));
$("enqueue").addEventListener("click", () => void action("enqueue", {}, queued));
$("clear").addEventListener("click", () => void action("clear", {}, () => "Histórico da fila limpo."));
$("scroll-stop").addEventListener("click", () => void action("scroll", { command: "stop" }));
$("scroll-start").addEventListener("click", () => void action("scroll", {
  command: capture?.scroll.mode === "running" ? "pause" : capture?.scroll.mode === "paused" ? "resume" : "start",
}));
setInterval(() => { if (fixture || !document.hidden) void refresh(); }, 1050);
document.addEventListener("visibilitychange", () => { if (!document.hidden) void refresh(); });
void refresh();
