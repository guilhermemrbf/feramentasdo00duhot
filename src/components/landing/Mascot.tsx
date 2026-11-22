import { motion, useMotionValue, useSpring, AnimatePresence, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";

export function Mascot({ size = 180 }: { size?: number }) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const rx = useSpring(useMotionValue(0), { stiffness: 150, damping: 18 });
  const ry = useSpring(useMotionValue(0), { stiffness: 150, damping: 18 });
  const [pokes, setPokes] = useState(0);
  useEffect(() => {
    if (reduce) return;
    const h = (e: PointerEvent) => {
      const r = ref.current?.getBoundingClientRect();
      if (!r) return;
      ry.set(Math.max(-15, Math.min(15, (e.clientX - (r.left + r.width / 2)) / 25)));
      rx.set(Math.max(-15, Math.min(15, -(e.clientY - (r.top + r.height / 2)) / 25)));
    };
    window.addEventListener("pointermove", h);
    return () => window.removeEventListener("pointermove", h);
  }, [reduce, rx, ry]);
  return (
    <div ref={ref} className="relative select-none" style={{ width: size, height: size }}>
      <motion.button
        type="button"
        aria-label="Dê um toque no rato"
        onClick={() => setPokes((p) => p + 1)}
        animate={reduce ? undefined : { y: [0, -8, 0] }}
        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
        whileTap={{ scale: 0.88, rotate: -6 }}
        style={{ rotateX: rx, rotateY: ry, transformPerspective: 600 }}
        className="h-full w-full cursor-pointer overflow-hidden rounded-full shadow-glow"
      >
        <img
          src="/brand/organic-mascot.webp"
          alt=""
          width={640}
          height={640}
          loading="lazy"
          className="h-full w-full object-cover"
          draggable={false}
        />
      </motion.button>
      <AnimatePresence>
        {pokes > 0 && !reduce && (
          <motion.div key={pokes} className="pointer-events-none absolute inset-0">
            {Array.from({ length: 14 }).map((_, i) => {
              const a = (i / 14) * Math.PI * 2;
              return (
                <motion.span
                  key={i}
                  className="absolute left-1/2 top-1/2 h-2.5 w-2.5 rounded-sm"
                  style={{
                    background:
                      i % 3 === 0
                        ? "var(--accent)"
                        : i % 3 === 1
                          ? "var(--primary-glow)"
                          : "var(--primary)",
                  }}
                  initial={{ x: 0, y: 0, opacity: 1 }}
                  animate={{
                    x: Math.cos(a) * size * 0.7,
                    y: Math.sin(a) * size * 0.7,
                    opacity: 0,
                    rotate: 360,
                  }}
                  transition={{ duration: 0.9, ease: "easeOut" }}
                />
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
      {pokes > 0 && (
        <motion.div
          key={`m${pokes}`}
          initial={{ opacity: 0, y: 10, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          className="absolute -top-14 left-1/2 w-max max-w-[240px] -translate-x-1/2 rounded-2xl bg-foreground px-4 py-2 text-center text-sm font-bold text-background"
        >
          {pokes < 3
            ? "O chefe tá de olho. Bora escalar? 🐭"
            : pokes < 6
              ? "Cada toque = 1 conta que podia estar postando 😎"
              : "Chega de toque. Cria a conta! 🔥"}
        </motion.div>
      )}
    </div>
  );
}
