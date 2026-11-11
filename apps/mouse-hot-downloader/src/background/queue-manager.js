import { classify, filePath, verifyMedia } from "../core/media.js";

const key = "mouse-hot.queue.v1";
const busy = new Set(["starting", "running", "pausing"]);
const retryable = new Set(["NETWORK_TIMEOUT", "NETWORK_DISCONNECTED", "NETWORK_FAILED",
  "SERVER_UNREACHABLE", "SERVER_FAILED"]);
const terminal = new Set(["done", "cancelled", "failed", "review"]);
const withBytes = (j) => ({ ...j, item: { ...j.item, source: undefined, thumb: undefined } });
const own = (d) => d?.byExtensionId === chrome.runtime.id;
const labels = {
  queued: "Aguardando", starting: "Verificando arquivo…", running: "Baixando",
  paused: "Pausado", pausing: "Pausando…", done: "Salvo no computador",
  failed: "Não foi possível baixar", cancelled: "Cancelado", review: "Confira no Chrome",
};
export function queueLabel(job) { return labels[job.status] || job.status; }
export function makeQueue(notify) {
  let jobs, serial = Promise.resolve();
  const exclusive = (run) => {
    const work = serial.then(async () => {
      if (!jobs) {
        const saved = (await chrome.storage.local.get(key))[key];
        jobs = Array.isArray(saved) ? saved : [];
      }
      return run();
    });
    serial = work.catch(() => {});
    return work;
  };
  async function save() {
    if (jobs.length > 350) {
      const trim = jobs.length - 350;
      const removable = jobs.filter(j => terminal.has(j.status)).slice(0, trim).map(j => j.id);
      jobs = jobs.filter(j => !removable.includes(j.id));
    }
    await chrome.storage.local.set({ [key]: jobs });
  }
  function state(job, status, message = "") {
    if (job.status === status && job.message === message) return;
    job.status = status;
    job.message = message;
    job.updated = Date.now();
    if (status === "done" || status === "cancelled") delete job.item.source;
    void notify(job.tabId, job.item.key, labels[status], busy.has(status) || status === "queued");
  }
  async function ingest(job, d) {
    if (!own(d)) return;
    const final = d.finalUrl || d.url;
    if (final && classify(final, job.item.platform)) {
      await chrome.downloads.cancel(d.id).catch(() => {});
      return state(job, "review", "O destino mudou. Confira esta transferência no Chrome.");
    }
    job.received = d.bytesReceived || 0;
    job.total = d.totalBytes > 0 ? d.totalBytes : 0;
    job.canResume = !!d.canResume;
    if (d.state === "complete") return state(job, "done");
    if (d.state === "in_progress") {
      return state(job, d.paused ? "paused" : "running", d.danger && !["safe","accepted"].includes(d.danger)
        ? "Confira o aviso de segurança em chrome://downloads." : "");
    }
    if (d.error === "USER_CANCELED") return state(job, "cancelled");
    if (retryable.has(d.error) && job.attempts < 3 && job.item.source) {
      job.downloadId = null;
      job.next = Date.now() + 30000 * job.attempts;
      return state(job, "queued", "Falha temporária. Uma nova tentativa foi programada.");
    }
    state(job, "failed", d.error ? "Chrome informou: " + d.error : "Transferência interrompida.");
  }
  async function reconcile() {
    for (const j of jobs) {
      if (terminal.has(j.status)) continue;
      if (j.downloadId != null) {
        const [d] = await chrome.downloads.search({ id: j.downloadId });
        if (own(d)) await ingest(j, d);
        else state(j, "review", "O Chrome não localizou a transferência. Confira antes de repetir.");
      } else if (j.status === "starting") {
        if (!j.filename) {
          state(j, "queued", "Validação retomada.");
          continue;
        }
        const matches = (await chrome.downloads.search({
          url: j.item.source, startedAfter: new Date(j.updated - 5000).toISOString(), limit: 15,
        })).filter(d => own(d) && d.filename.replaceAll("\\", "/").endsWith("/" + j.filename));
        if (matches.length === 1) {
          j.downloadId = matches[0].id;
          await ingest(j, matches[0]);
        } else state(j, "review", "O Chrome foi fechado durante o início. Confira a lista de downloads antes de repetir.");
      }
    }
    await save();
  }
  async function launch(job) {
    // Mark validation separately from the journal of the browser call.
    job.filename = "";
    job.attempts++;
    job.received = job.total = 0;
    state(job, "starting");
    await save();
    let path;
    try {
      const ext = await verifyMedia(job.item);
      path = filePath(job.item, ext);
    } catch (error) {
      state(job, "failed", error.message);
      await save();
      return;
    }
    job.filename = path;
    await save();
    try {
      job.downloadId = await chrome.downloads.download({ url: job.item.source, filename: path,
        conflictAction: "uniquify", saveAs: false });
      state(job, "running");
      await save();
      const [d] = await chrome.downloads.search({ id: job.downloadId });
      if (d) await ingest(job, d);
    } catch {
      state(job, "failed", "O Chrome não iniciou o download. Confira a pasta de destino e as permissões.");
    }
    await save();
  }
  async function pump() {
    const available = 2 - jobs.filter(j => busy.has(j.status)).length;
    if (available <= 0) return;
    const ready = jobs.filter(j => j.status === "queued" && (!j.next || j.next <= Date.now())).slice(0, available);
    // Start one at a time so a queue snapshot cannot overwrite another job's journal.
    for (const job of ready) await launch(job);
  }
  let initialized = false;
  const run = (fn) => exclusive(async () => {
    if (!initialized) { await reconcile(); initialized = true; }
    return fn();
  });
  return {
    start: () => run(pump),
    tick: () => run(async () => { await reconcile(); await pump(); }),
    list: () => run(async () => {
      // DownloadItem's byte counters are read on demand; no guessed progress.
      for (const j of jobs.filter(j => j.status === "running")) {
        const [d] = await chrome.downloads.search({ id: j.downloadId });
        if (own(d)) await ingest(j, d);
      }
      return jobs.map(withBytes).reverse();
    }),
    enqueue: (items, tabId) => run(async () => {
      let added = 0;
      for (const item of items) {
        const prior = jobs.find(j => j.item.key === item.key && !["cancelled","failed"].includes(j.status));
        if (prior || !item.source || jobs.filter(j => !terminal.has(j.status)).length >= 350) continue;
        jobs.push({ id: crypto.randomUUID(), item, tabId, status: "queued", updated: Date.now(),
          attempts: 0, received: 0, total: 0, downloadId: null, message: "" });
        added++;
      }
      await save();
      return added;
    }),
    changed: (id) => run(async () => {
      const j = jobs.find(j => j.downloadId === id && !terminal.has(j.status));
      if (!j) return;
      const [d] = await chrome.downloads.search({ id });
      if (own(d)) await ingest(j, d);
      await save();
      await pump();
    }),
    act: (id, command) => run(async () => {
      const j = jobs.find(it => it.id === id);
      if (!j) throw new Error("Download não encontrado.");
      if (command === "pause" && j.status === "running") {
        await chrome.downloads.pause(j.downloadId);
        state(j, "paused");
      } else if (command === "resume" && ["paused","failed"].includes(j.status) && j.canResume) {
        if (jobs.filter(it => busy.has(it.status)).length >= 2) throw new Error("Aguarde uma das duas vagas na fila.");
        await chrome.downloads.resume(j.downloadId);
        state(j, "running");
      } else if (command === "cancel" && !terminal.has(j.status)) {
        if (j.downloadId != null) await chrome.downloads.cancel(j.downloadId);
        state(j, "cancelled");
      } else if (command === "retry" && ["failed","review"].includes(j.status) && j.item.source) {
        j.downloadId = null;
        j.attempts = 0;
        j.next = 0;
        state(j, "queued");
      } else throw new Error("Essa ação não está disponível para este download.");
      await save();
      return true;
    }),
    clear: () => run(async () => {
      jobs = jobs.filter(j => !terminal.has(j.status));
      await save();
    }),
  };
}
