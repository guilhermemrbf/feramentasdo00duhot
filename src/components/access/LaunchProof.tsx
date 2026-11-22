import { useEffect, useState } from "react";
import { useLaunchEntrance } from "./useLaunchEntrance";

const SHOW_TESTIMONIALS = false;
const metrics = [
  {
    label: "Perfis gerenciados",
    value: null,
    placeholder: "{{PREENCHER: nº de perfis gerenciados}}",
  },
  {
    label: "Publicações agendadas",
    value: null,
    placeholder: "{{PREENCHER: nº de publicações agendadas}}",
  },
  {
    label: "Horas economizadas",
    value: null,
    placeholder: "{{PREENCHER: horas economizadas e período de referência}}",
  },
] satisfies { label: string; value: number | null; placeholder: string }[];

const testimonials = [
  {
    quote: "{{PREENCHER: depoimento autorizado 1}}",
    attribution: "{{PREENCHER: nome e função 1}}",
  },
  {
    quote: "{{PREENCHER: depoimento autorizado 2}}",
    attribution: "{{PREENCHER: nome e função 2}}",
  },
];

function CountUp({ value }: { value: number }) {
  const { ref, entered } = useLaunchEntrance<HTMLElement>();
  const [display, setDisplay] = useState(value);
  useEffect(() => {
    if (
      !entered ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
      document.hidden
    )
      return;
    const start = performance.now();
    let frame = 0;
    function update(now: number) {
      const phase = Math.min((now - start) / 700, 1);
      if (document.hidden) {
        setDisplay(value);
        return;
      }
      setDisplay(Math.round(value * (1 - (1 - phase) ** 3)));
      if (phase < 1) frame = requestAnimationFrame(update);
    }
    frame = requestAnimationFrame(update);
    return () => cancelAnimationFrame(frame);
  }, [entered, value]);
  return (
    <strong ref={ref} aria-label={String(value)}>
      {display.toLocaleString("pt-BR")}
    </strong>
  );
}

export function LaunchProof() {
  const published = metrics.filter(({ value }) => value !== null);
  if (!published.length && !SHOW_TESTIMONIALS) return null;
  return (
    <section className="command-proof" aria-labelledby="proof-title">
      <div className="launch-wrap">
        <h2 id="proof-title">Resultados da operação</h2>
        <dl>
          {published.map(({ label, value }) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>
                <CountUp value={value!} />
              </dd>
            </div>
          ))}
        </dl>
        {SHOW_TESTIMONIALS &&
          testimonials.map(({ quote, attribution }) => (
            <figure key={attribution}>
              <blockquote>{quote}</blockquote>
              <figcaption>{attribution}</figcaption>
            </figure>
          ))}
      </div>
    </section>
  );
}
