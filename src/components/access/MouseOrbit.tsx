import { ArrowLeft, ArrowRight } from "lucide-react";
import { useState } from "react";

const examples = [
  {
    title: "Escolher com quem trabalhar",
    detail: "Compare subnichos e desempenho no Instagram Intelligence.",
  },
  {
    title: "Preparar uma pasta inteira",
    detail: "Limpe metadados e aplique sua marca aos criativos.",
  },
  {
    title: "Distribuir por conta",
    detail: "Escolha a biblioteca, revise os horários e acompanhe a fila no Automatic Post.",
  },
];

export function MouseOrbit() {
  const [index, setIndex] = useState(0);
  const move = (direction: number) =>
    setIndex((current) => (current + direction + examples.length) % examples.length);
  return (
    <section className="mouse-orbit" aria-label="Exemplos de uso da MouseHot">
      <div className="mouse-orbit-art" aria-hidden="true">
        <i className="mouse-orbit-track" key={index} />
        <img src="/brand/mascot.webp" width="720" height="720" alt="" fetchPriority="high" />
      </div>
      <div className="mouse-orbit-caption">
        <div aria-live="polite" aria-atomic="true">
          <div className="mouse-orbit-story" key={index}>
            <h2>{examples[index].title}</h2>
            <p>{examples[index].detail}</p>
          </div>
        </div>
        <div className="mouse-orbit-controls">
          <button type="button" aria-label="Exemplo anterior" onClick={() => move(-1)}>
            <ArrowLeft size={18} />
          </button>
          <button type="button" aria-label="Próximo exemplo" onClick={() => move(1)}>
            <ArrowRight size={18} />
          </button>
        </div>
      </div>
    </section>
  );
}
