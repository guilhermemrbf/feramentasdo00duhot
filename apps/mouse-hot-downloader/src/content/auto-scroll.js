export function makeAutoScroll(report, count) {
  let mode = "idle", timer, elapsed, steps, stale, previous, route;
  const finish = (message) => {
    clearInterval(timer);
    mode = "idle";
    report({ mode, message });
  };
  return (command) => {
    if (command === "stop") return finish("Busca encerrada.");
    if (command === "pause" && mode === "running") {
      clearInterval(timer);
      mode = "paused";
      return report({ mode, message: "Busca pausada." });
    }
    if (mode === "running" || (command !== "start" && command !== "resume")) return;
    if (mode !== "paused") {
      steps = stale = 0;
      elapsed = Date.now();
      route = location.pathname;
      previous = count();
    }
    mode = "running";
    report({ mode, message: "Procurando mais publicações nesta aba…" });
    timer = setInterval(() => {
      if (route !== location.pathname || document.hidden) return finish("Busca encerrada porque a aba mudou.");
      if (++steps > 60 || Date.now() - elapsed > 90000 || count() >= 350) return finish("Limite de busca atingido.");
      const next = count();
      const root = document.scrollingElement;
      const bottom = !root || root.scrollHeight - root.scrollTop - innerHeight < 10;
      stale = bottom && next === previous ? stale + 1 : 0;
      if (stale >= 5) return finish("Nenhuma publicação nova apareceu.");
      previous = next;
      window.scrollBy({ top: Math.round(innerHeight * 0.76), behavior: "smooth" });
    }, 1250);
  };
}
