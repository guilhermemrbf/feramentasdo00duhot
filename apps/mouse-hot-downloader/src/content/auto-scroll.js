export const captureLimit = 350;

export function makeAutoScroll(report, count) {
  let mode = "idle", timer, started, steps, stale, previous, route, onFinish;

  function finish(reason, message) {
    clearInterval(timer);
    mode = "idle";
    report({ mode, message });
    onFinish?.({ reason, message });
    onFinish = undefined;
  }

  function command(action) {
    if (action === "stop") {
      if (mode !== "idle") finish("stopped", "Busca encerrada.");
      return;
    }
    if (action === "pause" && mode === "running") {
      clearInterval(timer);
      mode = "paused";
      report({ mode, message: "Busca pausada." });
      return;
    }
    if (mode === "running" || (action !== "start" && action !== "resume")) return;
    if (mode !== "paused") {
      steps = stale = 0;
      started = Date.now();
      route = location.pathname;
      previous = count();
    }
    mode = "running";
    report({ mode, message: "Procurando mais publicações nesta aba…" });
    timer = setInterval(() => {
      if (route !== location.pathname) return finish("changed", "Busca encerrada porque a página mudou.");
      if (document.hidden) return finish("hidden", "Busca encerrada porque a aba ficou oculta.");
      if (++steps > 60 || Date.now() - started > 90000 || count() >= captureLimit) {
        return finish("limit", "Limite da busca atingido.");
      }
      const next = count();
      const root = document.scrollingElement;
      const bottom = !root || root.scrollHeight - root.scrollTop - innerHeight < 10;
      stale = bottom && next === previous ? stale + 1 : 0;
      if (stale >= 5) return finish("bottom", "Nenhuma publicação nova apareceu.");
      previous = next;
      window.scrollBy({ top: Math.round(innerHeight * 0.76), behavior: "smooth" });
    }, 1250);
  }

  function collect(signal) {
    signal.throwIfAborted();
    command("stop");
    return new Promise(resolve => {
      const cancel = () => finish("cancelled", "Busca cancelada.");
      onFinish = result => {
        signal.removeEventListener("abort", cancel);
        resolve(result);
      };
      signal.addEventListener("abort", cancel, { once: true });
      command("start");
    });
  }

  return { command, collect };
}
