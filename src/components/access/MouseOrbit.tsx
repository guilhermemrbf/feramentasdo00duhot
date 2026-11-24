import { ArrowLeft, ArrowRight } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useVisibleMotion } from "./useVisibleMotion";

const examples = [
  {
    category: "Perfis",
    title: "Escolher com quem trabalhar",
    detail: "Compare subnichos e desempenho no Instagram Intelligence.",
  },
  {
    category: "Conteúdo",
    title: "Preparar uma pasta inteira",
    detail: "Limpe metadados e aplique sua marca aos criativos.",
  },
  {
    category: "Automação",
    title: "Distribuir por conta",
    detail: "Escolha a biblioteca, revise os horários e acompanhe a fila no Automatic Post.",
  },
  {
    category: "Campanhas",
    title: "Enxergar cada etapa da campanha",
    detail: "Conecte descoberta, interesse e oferta em um quadro visual com o Funil.",
  },
] as const;

export function MouseOrbit() {
  const { ref, running } = useVisibleMotion<HTMLElement>();
  const [paused, setPaused] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [greeting, setGreeting] = useState(0);
  const touchX = useRef<number>(null);
  const [index, setIndex] = useState(0);
  const move = (direction: number) =>
    setIndex((current) => (current + direction + examples.length) % examples.length);
  useEffect(() => {
    if (!running || paused || hovered) return;
    const timer = window.setTimeout(
      () => setIndex((current) => (current + 1) % examples.length),
      7200,
    );
    return () => window.clearTimeout(timer);
  }, [index, running, paused, hovered]);

  return (
    <section
      ref={ref}
      className="mouse-orbit"
      aria-label="Exemplos de uso do Mousefy"
      data-playing={(running && !paused && !hovered) || undefined}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={(event) => {
        if (!event.target.closest(".command-carousel-pause")) setPaused(true);
      }}
      onTouchStart={(event) => {
        touchX.current = event.touches[0]?.clientX ?? null;
      }}
      onTouchEnd={(event) => {
        const x = event.changedTouches[0]?.clientX;
        if (x === undefined || touchX.current === null) return;
        const distance = x - touchX.current;
        touchX.current = null;
        if (Math.abs(distance) > 48) {
          setPaused(true);
          move(distance < 0 ? 1 : -1);
        }
      }}
    >
      <div
        className="mouse-orbit-art"
        data-in-view={(running && !paused) || undefined}
        data-category={index}
        onPointerMove={(event) => {
          if (
            event.pointerType !== "mouse" ||
            !window.matchMedia("(prefers-reduced-motion: no-preference)").matches
          )
            return;
          const art = event.currentTarget;
          const bounds = art.getBoundingClientRect();
          const relativeX = (event.clientX - bounds.left) / bounds.width - 0.5;
          const relativeY = (event.clientY - bounds.top) / bounds.height - 0.5;
          art.style.setProperty("--orbit-x", `${relativeX * 20}px`);
          art.style.setProperty("--orbit-y", `${relativeY * 14}px`);
        }}
        onPointerLeave={(event) => {
          event.currentTarget.style.removeProperty("--orbit-x");
          event.currentTarget.style.removeProperty("--orbit-y");
        }}
      >
        <div className="mouse-orbit-halo" aria-hidden="true" />
        <svg className="mouse-orbit-diagram" viewBox="0 0 560 356" aria-hidden="true">
          <g className="mouse-orbit-ring mouse-orbit-ring-solid">
            <ellipse
              className="mouse-orbit-trail"
              cx="280"
              cy="178"
              rx="200"
              ry="91"
              pathLength="1"
            />
            <g transform="translate(280 178) scale(1 .455)">
              <g className="mouse-orbit-satellite mouse-orbit-satellite-forward">
                <circle cx="200" cy="0" r="5" />
              </g>
            </g>
          </g>
          <g className="mouse-orbit-ring mouse-orbit-ring-dotted">
            <ellipse className="mouse-orbit-trail" cx="280" cy="178" rx="211" ry="79" />
            <g transform="translate(280 178) scale(1 .3744)">
              <g className="mouse-orbit-satellite mouse-orbit-satellite-back">
                <circle cx="-211" cy="0" r="5" />
              </g>
            </g>
          </g>
        </svg>
        <button
          type="button"
          className="command-mascot-trigger"
          aria-label="Cumprimentar o rato do Mousefy"
          onClick={() => setGreeting((value) => value + 1)}
        >
          <span className="mouse-orbit-core" aria-hidden="true">
            <img src="/brand/mascot.webp" width="720" height="720" alt="" fetchPriority="high" />
            <strong>Mousefy</strong>
          </span>
        </button>
        <div className="mouse-orbit-categories" role="group" aria-label="Áreas da operação">
          {examples.map(({ category }, position) => (
            <button
              key={category}
              type="button"
              aria-pressed={index === position}
              onClick={() => setIndex(position)}
            >
              <i aria-hidden="true" /> {category}
            </button>
          ))}
        </div>
        <span role="status" className="command-mascot-bubble">
          {greeting > 0 && (
            <span key={greeting}>
              Bora escalar? <i aria-hidden="true">✦</i>
            </span>
          )}
        </span>
      </div>
      <div className="mouse-orbit-caption">
        <div aria-live={running && !paused && !hovered ? "off" : "polite"} aria-atomic="true">
          <div className="mouse-orbit-story" key={index}>
            <h2>{examples[index].title}</h2>
            <p>{examples[index].detail}</p>
          </div>
        </div>
        <div className="mouse-orbit-controls">
          <button
            className="command-carousel-pause"
            type="button"
            aria-label={paused ? "Reproduzir exemplos" : "Pausar exemplos"}
            onClick={() => setPaused(!paused)}
          >
            {paused ? "▶" : "Ⅱ"}
          </button>
          <button type="button" aria-label="Exemplo anterior" onClick={() => move(-1)}>
            <ArrowLeft size={18} />
          </button>
          <button type="button" aria-label="Próximo exemplo" onClick={() => move(1)}>
            <ArrowRight size={18} />
          </button>
        </div>
      </div>
      <div className="command-carousel-timer" key={index} aria-hidden="true" />
    </section>
  );
}
