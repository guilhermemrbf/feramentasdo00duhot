const css = `
:host { color-scheme:dark; color:#fff0e5; font:13px/1.42 system-ui,sans-serif; }
*, *::before, *::after { box-sizing:border-box; }
section { background:#20171c; border:1px solid #6c414b; border-radius:14px; box-shadow:0 8px 32px #0008;
  overflow:hidden; color:#fff0e5; color-scheme:dark; font:13px/1.42 system-ui,sans-serif; }
header, .bar, li { display:flex; align-items:center; gap:7px; }
header { padding:7px 9px; min-width:210px; }
header strong { font-size:13px; white-space:nowrap; }
header small { color:#e1bec4; font-size:11px; }
.badge { border-radius:50%; width:9px; height:9px; background:#ef947c; flex:none; }
header button { margin-left:auto; }
button { background:#3c2830; border:1px solid #68434f; border-radius:7px; color:#fff0df;
  padding:4px 7px; font:600 11px system-ui,sans-serif; cursor:pointer; }
button:hover { background:#53343e; }
button:disabled { opacity:.54; cursor:default; }
button:focus-visible, input:focus-visible { outline:2px solid #ffc889; outline-offset:2px; }
input { accent-color:#ffc889; }
[hidden] { display:none !important; }
main { padding:0 9px 9px; width:min(285px, calc(100vw - 30px)); }
.bar { flex-wrap:wrap; }
ul { padding:0; margin:6px 0; list-style:none; overflow:auto; overscroll-behavior:contain; max-height:min(28vh, 210px); }
li { min-height:35px; padding:4px 0; border-bottom:1px solid #4c333a; justify-content:space-between; }
li span { flex:1; min-width:0; overflow-wrap:anywhere; }
small, p { color:#dec5ca; font-size:11px; }
p { margin:5px 0; }
.notice[data-error=true] { color:#ffb9af; }
.primary { background:#ffc889; color:#28161d; border-color:#ffc889; }
.primary:hover { background:#ffddb2; }
.job progress { max-width:63px; height:6px; accent-color:#ffc889; }
`;
const active = new Set(["queued", "starting", "running", "pausing", "paused"]);
const labels = { done:"Salvo", failed:"Falhou", running:"Baixando", paused:"Pausado", starting:"Verificando",
  queued:"Na fila", cancelled:"Cancelado", review:"Confira no Chrome" };

export function makeOverlay(send, fixture) {
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
  make("span", header, { class: "badge", "aria-hidden": "true" });
  make("strong", header, {}, "Mouse Hot");
  make("small", header, { id: "mh-summary" }, "Procurando mídias…");
  make("button", header, { id: "mh-toggle", "aria-expanded": "false", "aria-controls": "mh-details" }, "Abrir");
  const main = make("main", box, { id: "mh-details", hidden: "" });
  make("p", main, { class: "notice", role: "status" });
  const controls = make("div", main, { class: "bar" });
  make("button", controls, { id: "mh-scroll", hidden: "" }, "Rolar e procurar");
  make("button", controls, { id: "mh-stop", hidden: "" }, "Parar");
  make("button", controls, { id: "mh-select", hidden: "" }, "Selecionar disponíveis");
  make("p", main, { id: "mh-hint" });
  make("ul", main, { id: "mh-items", "aria-label": "Publicações detectadas" });
  make("button", main, { id: "mh-batch", class: "primary", hidden: "" }, "Baixar seleção");
  make("ul", main, { id: "mh-jobs", "aria-label": "Fila desta página" });
  shadow.append(box);
  const $ = (id) => shadow.getElementById(id);
  const notice = box.querySelector(".notice");
  const toggle = $("mh-toggle");
  const details = $("mh-details");
  const summary = $("mh-summary");
  let snapshot, stamp, working = false, shown = false, refreshPromise;
  const button = (label, run, attr) => {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = label;
    if (attr) b.dataset[attr] = "";
    b.addEventListener("click", e => { if (e.isTrusted) void run(); });
    return b;
  };
  async function action(type, data) {
    if (working) return;
    working = true;
    notice.textContent = "";
    try {
      const result = await send(type, data);
      if (!result?.ok) throw new Error(result?.error || "Recarregue a página para tentar novamente.");
      if (type === "enqueue") notice.textContent = result.value + " adicionado(s) à fila.";
      notice.dataset.error = "false";
    } catch (error) {
      notice.textContent = error.message;
      notice.dataset.error = "true";
    } finally {
      working = false;
      await refresh();
    }
  }
  function draw() {
    const { capture, jobs = [] } = snapshot || {};
    const all = capture?.items || [];
    const selected = new Set(capture?.selected || []);
    const downloadable = all.filter(item => item.status === "check");
    const done = jobs.filter(job => job.status === "done").length;
    const activeJobs = jobs.filter(job => active.has(job.status)).length;
    const failed = jobs.filter(job => job.status === "failed" || job.status === "review").length;
    const counts = [];
    if (downloadable.length) counts.push(downloadable.length + (downloadable.length === 1 ? " disponível" : " disponíveis"));
    else if (all.length) counts.push(all.length + (all.length === 1 ? " encontrada" : " encontradas"));
    if (activeJobs) counts.push(activeJobs + " na fila");
    if (done) counts.push(done + (done === 1 ? " salvo" : " salvos"));
    if (failed) counts.push(failed + (failed === 1 ? " falha" : " falhas"));
    summary.textContent = counts.join(" · ") || "Nenhum arquivo direto";
    const mode = capture?.scroll.mode;
    $("mh-scroll").hidden = !capture?.scope?.includes(":@");
    $("mh-scroll").textContent = mode === "running" ? "Pausar busca" : mode === "paused" ? "Continuar busca" : "Rolar e procurar";
    $("mh-stop").hidden = mode !== "running" && mode !== "paused";
    $("mh-select").hidden = !downloadable.length;
    $("mh-select").textContent = downloadable.every(item => selected.has(item.key)) ? "Limpar seleção" : "Selecionar disponíveis";
    $("mh-batch").hidden = !selected.size;
    $("mh-batch").textContent = selected.size === 1 ? "Baixar 1 arquivo" : "Baixar " + selected.size + " arquivos";
    $("mh-hint").textContent = mode === "running" ? "Buscando mais publicações…" :
      all.some(item => item.status === "open") ? "Use Abrir quando aparecer só a prévia." :
      !all.length ? "Abra uma publicação ou role para carregar mais." : "";
    const currentFocus = shadow.activeElement?.dataset.focus;
    const rows = all.map(item => {
      const row = document.createElement("li");
      const title = document.createElement("span");
      const name = item.status === "open" ? "Publicação " : item.kind === "video" ? "Vídeo " : "Foto ";
      title.textContent = name + item.id + (item.index ? " · " + (item.index + 1) : "");
      if (item.reason) {
        title.title = item.reason;
        title.append(document.createElement("br"), document.createTextNode(item.reason));
      }
      if (item.status === "check") {
        const input = document.createElement("input");
        input.type = "checkbox";
        input.checked = selected.has(item.key);
        input.dataset.focus = item.key;
        input.setAttribute("aria-label", "Selecionar " + title.textContent);
        input.addEventListener("change", event => {
          if (event.isTrusted) void action("select", { keys: [item.key], selected: input.checked });
        });
        row.append(input);
      }
      row.append(title);
      if (item.status === "open") row.append(button("Abrir", () => action("open", { key: item.key })));
      if (item.status === "check") {
        const job = jobs.find(job => job.item.key === item.key);
        const done = job?.status === "done";
        const inQueue = active.has(job?.status);
        const download = button(done ? "Salvo" : inQueue ? labels[job.status] : "Baixar",
          () => action("enqueue", { key: item.key }), "download");
        download.disabled = done || inQueue;
        row.append(download);
      }
      return row;
    });
    $("mh-items").replaceChildren(...rows);
    if (currentFocus) [...$("mh-items").querySelectorAll("input")].find(input => input.dataset.focus === currentFocus)?.focus();
    $("mh-jobs").replaceChildren(...jobs.filter(job => job.status !== "done").map(job => {
      const row = document.createElement("li");
      row.className = "job";
      const title = document.createElement("span");
      title.textContent = (labels[job.status] || job.status) + " · " + job.item.id;
      if (job.message) { title.append(document.createElement("br"), document.createTextNode(job.message)); }
      row.append(title);
      const task = (label, command) => button(label, () => action("queue-action", { id: job.id, command }));
      if (job.status === "running") {
        const progress = document.createElement("progress");
        progress.setAttribute("aria-label", "Progresso");
        if (job.total > 0) { progress.max = job.total; progress.value = Math.min(job.total, job.received); }
        row.append(progress, task("Pausar", "pause"));
      }
      if (job.status === "paused" && job.canResume) row.append(task("Retomar", "resume"));
      if (active.has(job.status)) row.append(task("Cancelar", "cancel"));
      if (job.status === "failed") row.append(task("Tentar de novo", "retry"));
      return row;
    }));
  }
  function refresh() {
    if (!shown || refreshPromise) return refreshPromise;
    refreshPromise = send("snapshot").then(reply => {
      if (!reply?.ok) return;
      const next = JSON.stringify(reply.value);
      if (next === stamp) return;
      stamp = next;
      snapshot = reply.value;
      draw();
    }).finally(() => { refreshPromise = undefined; });
    return refreshPromise;
  }
  toggle.addEventListener("click", event => {
    if (!event.isTrusted) return;
    details.hidden = !details.hidden;
    toggle.textContent = details.hidden ? "Abrir" : "Recolher";
    toggle.setAttribute("aria-expanded", String(!details.hidden));
    void refresh();
  });
  $("mh-scroll").addEventListener("click", event => {
    if (!event.isTrusted) return;
    const mode = snapshot?.capture?.scroll.mode;
    void action("scroll", { command: mode === "running" ? "pause" : mode === "paused" ? "resume" : "start" });
  });
  $("mh-stop").addEventListener("click", event => { if (event.isTrusted) void action("scroll", { command: "stop" }); });
  $("mh-batch").addEventListener("click", event => { if (event.isTrusted) void action("enqueue", {}); });
  $("mh-select").addEventListener("click", event => {
    if (!event.isTrusted) return;
    const capture = snapshot?.capture;
    if (!capture) return;
    const keys = capture.items.filter(item => item.status === "check").map(item => item.key);
    void action("select", { keys, selected: !keys.every(key => capture.selected.includes(key)) });
  });
  return {
    display(value) {
      shown = value;
      if (shown && !host.isConnected) document.documentElement.append(host);
      if (!shown && host.isConnected) host.remove();
    },
    refresh,
  };
}
