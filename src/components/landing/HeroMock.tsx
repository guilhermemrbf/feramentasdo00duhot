import { Activity, CalendarDays, CircleCheck, Clock3, Film, ReceiptText } from "lucide-react";
import { useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { TRACKING_NAME } from "@/lib/brand";

const reels = [
  { title: "Apresentação da coleção", profile: "@loja.exemplo", time: "09:00", published: true },
  { title: "Bastidores da produção", profile: "@estudio.exemplo", time: "13:00", published: false },
  { title: "Guia de tamanhos", profile: "@loja.exemplo", time: "18:30", published: false },
];

const sales = [
  {
    title: "Coleção de verão",
    detail: "Meta Ads · pedido aprovado",
    amount: "R$ 149,00",
    attributed: true,
  },
  {
    title: "Busca pela marca",
    detail: "Google Ads · pedido aprovado",
    amount: "R$ 89,00",
    attributed: true,
  },
  {
    title: "Origem não identificada",
    detail: "Pedido aprovado",
    amount: "R$ 59,00",
    attributed: false,
  },
];

export function HeroMock() {
  const [view, setView] = useState<"tracking" | "reels">("tracking");
  const reduced = useReducedMotion();
  const tracking = view === "tracking";

  return (
    <div
      className="mousefy-demo app-frame"
      data-visual
      role="region"
      aria-labelledby="mousefy-demo-title"
    >
      <header className="mousefy-demo-head">
        <div>
          <p>Demonstração com dados fictícios</p>
          <strong id="mousefy-demo-title">{tracking ? TRACKING_NAME : "Automatic Post"}</strong>
        </div>
        {tracking ? (
          <Activity size={22} aria-hidden="true" />
        ) : (
          <CalendarDays size={22} aria-hidden="true" />
        )}
      </header>
      <div className="mousefy-demo-controls" role="group" aria-label="O que demonstrar">
        <button type="button" aria-pressed={tracking} onClick={() => setView("tracking")}>
          Atribuição de vendas
        </button>
        <button type="button" aria-pressed={!tracking} onClick={() => setView("reels")}>
          Fila de Reels
        </button>
      </div>
      <motion.div
        className="mousefy-demo-body"
        key={view}
        initial={reduced ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: reduced ? 0 : 0.22 }}
        aria-live="polite"
      >
        {tracking ? (
          <>
            <dl className="mousefy-demo-summary">
              <div>
                <dt>Receita atribuída</dt>
                <dd>R$ 238,00</dd>
              </div>
              <div>
                <dt>Sem atribuição</dt>
                <dd>R$ 59,00</dd>
              </div>
            </dl>
            <ul className="mousefy-demo-list" aria-label="Vendas por origem">
              {sales.map(({ title, detail, amount, attributed }) => (
                <li key={title}>
                  <ReceiptText size={18} aria-hidden="true" />
                  <div>
                    <strong>{title}</strong>
                    <span>{detail}</span>
                  </div>
                  <b data-positive={attributed}>{amount}</b>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <>
            <dl className="mousefy-demo-summary">
              <div>
                <dt>Publicados</dt>
                <dd>1 Reel</dd>
              </div>
              <div>
                <dt>Na fila</dt>
                <dd>2 Reels</dd>
              </div>
            </dl>
            <ul className="mousefy-demo-list" aria-label="Publicações por conta">
              {reels.map(({ title, profile, time, published }) => (
                <li key={title}>
                  <Film size={18} aria-hidden="true" />
                  <div>
                    <strong>{title}</strong>
                    <span>
                      {profile} · {time}
                    </span>
                  </div>
                  <b data-positive={published}>
                    {published ? (
                      <CircleCheck size={14} aria-hidden="true" />
                    ) : (
                      <Clock3 size={14} aria-hidden="true" />
                    )}
                    {published ? "Publicado" : "Na fila"}
                  </b>
                </li>
              ))}
            </ul>
          </>
        )}
      </motion.div>
    </div>
  );
}
