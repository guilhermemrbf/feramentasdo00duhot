import { motion, useMotionValue, useSpring, useTransform, useReducedMotion } from "motion/react";
import { useState } from "react";

const labels = [
  { t: "Perfis", d: "Perfis para analisar e comparar", x: 50, y: 17, orbit: 0 },
  { t: "Conteúdo", d: "Mídia preparada em lote, por conta", x: 96, y: 50, orbit: 1 },
  { t: "Automação", d: "Reels agendados e lembretes de Stories", x: 50, y: 83, orbit: 0 },
  { t: "Campanhas", d: "Funil do orgânico até a venda", x: 4, y: 50, orbit: 1 },
];

export function OrbitHero() {
  const reduce = useReducedMotion();
  const [hover, setHover] = useState<number | null>(null);
  const mx = useSpring(useMotionValue(0), { stiffness: 80, damping: 20 });
  const my = useSpring(useMotionValue(0), { stiffness: 80, damping: 20 });
  const coreX = useTransform(mx, (v) => v * 14);
  const coreY = useTransform(my, (v) => v * 14);
  const orbX = useTransform(mx, (v) => v * -8);
  const orbY = useTransform(my, (v) => v * -8);
  const spin = (dur: number, dir = 1) =>
    reduce
      ? {}
      : {
          animate: { rotate: 360 * dir },
          transition: { duration: dur, repeat: Infinity, ease: "linear" as const },
        };
  const active = hover === null ? null : labels[hover]!.orbit;

  return (
    <div
      role="group"
      aria-label="Áreas da operação"
      className="relative mx-auto aspect-square w-full max-w-[340px] sm:max-w-[520px]"
      onMouseMove={(e) => {
        if (reduce) return;
        const r = e.currentTarget.getBoundingClientRect();
        mx.set((e.clientX - r.left) / r.width - 0.5);
        my.set((e.clientY - r.top) / r.height - 0.5);
      }}
      onMouseLeave={() => {
        mx.set(0);
        my.set(0);
        setHover(null);
      }}
    >
      <motion.div
        className="absolute inset-[18%] rounded-full bg-primary/30 blur-[80px]"
        animate={reduce ? {} : { opacity: [0.5, 0.9, 0.5], scale: [0.95, 1.05, 0.95] }}
        transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
      />

      <motion.div className="absolute inset-0" style={{ x: orbX, y: orbY }}>
        {[
          { rot: -18, dur: 38, dash: false, dir: 1 },
          { rot: 22, dur: 52, dash: true, dir: -1 },
        ].map((o, i) => (
          <div
            key={i}
            className="absolute inset-[6%]"
            style={{ transform: `rotate(${o.rot}deg) scaleY(0.62)` }}
          >
            <motion.div className="h-full w-full" {...spin(o.dur, o.dir)}>
              <svg viewBox="0 0 200 200" className="h-full w-full overflow-visible">
                <motion.circle
                  cx="100"
                  cy="100"
                  r="98"
                  fill="none"
                  stroke="var(--primary)"
                  strokeWidth={active === i ? 1.4 : 0.7}
                  strokeOpacity={active === i ? 1 : 0.55}
                  strokeDasharray={o.dash ? "2 5" : undefined}
                  initial={reduce ? false : { pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{
                    duration: reduce ? 0 : 1.6,
                    delay: reduce ? 0 : 0.5 + i * 0.3,
                    ease: "easeInOut",
                  }}
                />
                {[0, 120, 240].map((a, k) => (
                  <motion.circle
                    key={k}
                    cx={100 + 98 * Math.cos((a * Math.PI) / 180)}
                    cy={100 + 98 * Math.sin((a * Math.PI) / 180)}
                    r={k === 0 ? 3.2 : 2}
                    fill={k === 0 ? "var(--primary-glow)" : "var(--primary)"}
                    initial={{ opacity: 0, scale: 0 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 1.8 + k * 0.15 + i * 0.2 }}
                    style={{ filter: "drop-shadow(0 0 4px var(--primary))" }}
                  />
                ))}
              </svg>
            </motion.div>
          </div>
        ))}
        <div className="absolute inset-[26%] rounded-full border border-primary/20" />
      </motion.div>

      <motion.div
        className="absolute inset-[29%] flex flex-col items-center justify-center"
        style={{ x: coreX, y: coreY }}
        initial={{ opacity: 0, scale: 0.6 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.9, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
      >
        <motion.div
          className="relative h-full w-full overflow-hidden rounded-full border border-primary/50 bg-card shadow-glow"
          animate={reduce ? {} : { scale: [1, 1.03, 1] }}
          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
        >
          <img
            src="/brand/organic-mascot.webp"
            alt="Mascote MouseHot"
            width={640}
            height={640}
            fetchPriority="high"
            className="h-full w-full object-cover"
          />
          <div className="absolute inset-x-0 bottom-0 organic-orbit-shade pt-8 pb-3 text-center font-display text-sm font-extrabold tracking-[0.25em] sm:text-lg">
            MOUSE<span className="text-primary">HOT</span>
          </div>
        </motion.div>
      </motion.div>

      {labels.map((l, i) => (
        <motion.button
          key={l.t}
          type="button"
          onMouseEnter={() => setHover(i)}
          onClick={() => setHover(i)}
          onFocus={() => setHover(i)}
          onBlur={() => setHover(null)}
          className="absolute -translate-x-1/2 -translate-y-1/2"
          style={{ left: `${l.x}%`, top: `${l.y}%` }}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 2.1 + i * 0.15 }}
        >
          <span
            className={`block rounded-full border px-3 py-1.5 text-xs font-bold whitespace-nowrap backdrop-blur transition-all sm:px-4 sm:text-sm ${hover === i ? "scale-110 border-primary bg-primary text-primary-foreground shadow-glow" : "border-border bg-background/70 text-foreground"}`}
          >
            {l.t}
          </span>
          {hover === i && (
            <motion.span
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className="absolute top-full left-1/2 z-10 mt-2 hidden w-44 -translate-x-1/2 rounded-xl border border-border bg-card p-2.5 text-center text-xs text-muted-foreground sm:block"
            >
              {l.d}
            </motion.span>
          )}
        </motion.button>
      ))}
    </div>
  );
}
