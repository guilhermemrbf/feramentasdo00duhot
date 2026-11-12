import { makeCandidate } from "../core/media.js";

const isInstagramPost = item => item.key.startsWith("instagram:post:");
export const canDownloadItem = item => item.status === "check" || isInstagramPost(item);
const incompleteScanMessages = {
  limit: "Limite da busca atingido.",
  hidden: "Busca encerrada porque a aba ficou oculta.",
  stopped: "Busca encerrada.",
};

export function makeDownloadController({ getContext, getSnapshot, collect, readProfile, resolvePost, send, setOperation }) {
  let current;

  function checkScope() {
    if (current && current.scope !== getContext()?.scope) {
      current.abort.abort("page-changed");
    }
  }

  async function run(action, { key, keys = [] } = {}) {
    if (action === "abort-download") {
      current?.abort.abort("user");
      return;
    }
    if (current) return;
    const start = getContext();
    if (!start) return;
    const abort = new AbortController();
    const { signal } = abort;
    current = { scope: start.scope, abort };
    const progress = (message, details) => setOperation({ message, busy: true, canCancel: true, ...details });
    const finish = (message, error = false) => setOperation({ message, busy: false, canCancel: false, error });
    const guard = () => {
      checkScope();
      signal.throwIfAborted();
    };
    async function request(type, data) {
      guard();
      const result = await send(type, data);
      guard();
      if (!result?.ok) throw new Error(result?.error || "Recarregue a página para tentar novamente.");
      return result.value;
    }
    async function snapshot(scan = false) {
      const capture = await getSnapshot({ scan });
      guard();
      if (capture?.scope !== start.scope) throw new Error("Aguarde a captura desta página e tente novamente.");
      return capture;
    }
    async function saveProfile() {
      guard();
      const profile = readProfile();
      if (!profile) throw new Error("Os dados do perfil ainda não estão disponíveis.");
      await request("save-profile", { profile });
    }

    try {
      if (action === "download-profile") {
        progress("Salvando dados do perfil…");
        await saveProfile();
        finish("Dados do perfil salvos.");
        return;
      }

      const all = action === "download-all";
      const single = action === "download-one";
      let scanNotice = "", profileResult = "";
      progress(all ? "Procurando mais publicações nesta aba…" : "Preparando downloads…");
      if (all) {
        const result = await collect(signal);
        guard();
        if (result.reason === "changed") {
          abort.abort("page-changed");
          guard();
        }
        scanNotice = incompleteScanMessages[result.reason] || "";
        if (start.page.platform === "instagram" && start.page.surface === "profile") {
          try {
            await saveProfile();
            profileResult = " Dados do perfil salvos.";
          } catch {
            guard();
            profileResult = " Dados do perfil indisponíveis.";
          }
        }
      }

      const capture = await snapshot(true);
      const wanted = new Set(single ? [key] : keys);
      const groups = new Map();
      for (const item of capture.items) {
        if (!canDownloadItem(item)) continue;
        const groupKey = isInstagramPost(item) ? item.id : item.key;
        if (!groups.has(groupKey)) groups.set(groupKey, []);
        groups.get(groupKey).push(item);
      }
      const selected = [...groups.values()].filter(items => all || items.some(item => wanted.has(item.key)));
      let added = 0, unavailable = 0;
      for (const [index, items] of selected.entries()) {
        guard();
        const item = items.find(item => wanted.has(item.key)) || items[0];
        const message = [scanNotice, "Preparando " + (index + 1) + " de " + selected.length + "…"].filter(Boolean).join(" ");
        progress(message);
        const direct = items.filter(item => item.status === "check").map(item => item.key);
        try {
          let downloadKeys = direct;
          let omitted = [];
          if (isInstagramPost(item)) {
            const resolved = await resolvePost(item.postUrl, { signal }).catch(() => []);
            guard();
            const normalized = new Map();
            for (const asset of resolved) {
              const media = makeCandidate({ ...asset, handle: capture.account || item.handle }, "instagram");
              if (media?.source && media.id === item.id && media.postUrl === item.postUrl) normalized.set(media.key, media);
            }
            if (normalized.size) {
              await request("items", { scope: start.scope, url: getContext().url, items: [...normalized.values()] });
              const saved = await snapshot();
              const accepted = new Set(saved.items.filter(item => item.status === "check").map(item => item.key));
              downloadKeys = [...normalized.keys()].filter(key => accepted.has(key));
              omitted = [...normalized.keys()].filter(key => !accepted.has(key));
            }
          }
          if (!downloadKeys.length) throw new Error("Arquivo indisponível.");
          added += await request("enqueue", { keys: downloadKeys });
          if (omitted.length) unavailable++;
          progress(message, { readyKeys: items.map(item => item.key), unavailableKeys: omitted });
        } catch {
          guard();
          unavailable++;
          progress(message, { unavailableKeys: items.map(item => item.key) });
        }
      }
      const queued = added === 1 ? "1 arquivo na fila." : added + " arquivos na fila.";
      const skipped = unavailable ? " " + unavailable + (unavailable === 1 ? " indisponível." : " indisponíveis.") : "";
      finish([queued + skipped + profileResult, scanNotice].filter(Boolean).join(" "), !!unavailable && !added);
    } catch (error) {
      finish(signal.aborted ? signal.reason === "page-changed" ? "Busca encerrada porque a página mudou." : "Busca cancelada." :
        error.message, !signal.aborted);
    } finally {
      current = undefined;
    }
  }

  return { run, checkScope };
}
