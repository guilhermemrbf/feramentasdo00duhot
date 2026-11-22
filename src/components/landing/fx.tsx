import {
  motion,
  useInView,
  useMotionValue,
  useSpring,
  useTransform,
  useReducedMotion,
  animate,
} from "motion/react";
import { useEffect, useRef, useState, type ReactNode, type MouseEvent } from "react";
import { cn } from "@/lib/utils";

export function Reveal({
  children,
  delay = 0,
  className,
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.7, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}

export function Counter({
  to,
  suffix = "",
  prefix = "",
  decimals = 0,
}: {
  to: number;
  suffix?: string;
  prefix?: string;
  decimals?: number;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const reduce = useReducedMotion();
  const inView = useInView(ref, { once: true });
  const [v, setV] = useState(0);
  useEffect(() => {
    if (!inView || reduce) return;
    const c = animate(0, to, { duration: 1.6, ease: "easeOut", onUpdate: setV });
    return () => c.stop();
  }, [inView, reduce, to]);
  return (
    <span ref={ref}>
      {prefix}
      {(reduce ? to : v).toLocaleString("pt-BR", {
        maximumFractionDigits: decimals,
        minimumFractionDigits: decimals,
      })}
      {suffix}
    </span>
  );
}

export function MagneticButton({
  children,
  className,
  onClick,
  href,
  variant = "primary",
}: {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
  href?: string;
  variant?: "primary" | "ghost";
}) {
  const reduce = useReducedMotion();
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const sx = useSpring(x, { stiffness: 250, damping: 15 });
  const sy = useSpring(y, { stiffness: 250, damping: 15 });
  const move = (e: MouseEvent<HTMLElement>) => {
    if (reduce) return;
    const r = e.currentTarget.getBoundingClientRect();
    x.set((e.clientX - r.left - r.width / 2) * 0.3);
    y.set((e.clientY - r.top - r.height / 2) * 0.3);
  };
  const reset = () => {
    x.set(0);
    y.set(0);
  };
  const cls = cn(
    "group relative inline-flex items-center justify-center gap-2 overflow-hidden rounded-full px-7 py-4 text-base font-bold transition-colors",
    variant === "primary"
      ? "organic-fill-hot text-primary-foreground shadow-glow"
      : "border border-border bg-card/40 text-foreground backdrop-blur hover:bg-card",
    className,
  );
  const inner = (
    <>
      {variant === "primary" && (
        <span className="pointer-events-none absolute inset-y-0 left-0 w-1/3 bg-foreground/30 opacity-0 blur-md group-hover:opacity-100 group-hover:[animation:organic-shine_0.9s_ease]" />
      )}
      <span className="relative">{children}</span>
    </>
  );
  return href ? (
    <motion.a
      href={href}
      style={{ x: sx, y: sy }}
      onMouseMove={move}
      onMouseLeave={reset}
      whileTap={{ scale: 0.96 }}
      className={cls}
    >
      {inner}
    </motion.a>
  ) : (
    <motion.button
      type="button"
      onClick={onClick}
      style={{ x: sx, y: sy }}
      onMouseMove={move}
      onMouseLeave={reset}
      whileTap={{ scale: 0.96 }}
      className={cls}
    >
      {inner}
    </motion.button>
  );
}

export function TiltCard({ children, className }: { children: ReactNode; className?: string }) {
  const reduce = useReducedMotion();
  const mx = useMotionValue(0.5);
  const my = useMotionValue(0.5);
  const rx = useSpring(useTransform(my, [0, 1], [6, -6]), { stiffness: 200, damping: 20 });
  const ry = useSpring(useTransform(mx, [0, 1], [-6, 6]), { stiffness: 200, damping: 20 });
  const bg = useTransform(
    [mx, my],
    ([a, b]) =>
      `radial-gradient(400px circle at ${(a as number) * 100}% ${(b as number) * 100}%, color-mix(in oklab, var(--primary) 18%, transparent), transparent 60%)`,
  );
  return (
    <motion.div
      onMouseMove={(e) => {
        if (reduce) return;
        const r = e.currentTarget.getBoundingClientRect();
        mx.set((e.clientX - r.left) / r.width);
        my.set((e.clientY - r.top) / r.height);
      }}
      onMouseLeave={() => {
        mx.set(0.5);
        my.set(0.5);
      }}
      style={{ rotateX: rx, rotateY: ry, transformPerspective: 900 }}
      className={cn(
        "relative overflow-hidden rounded-3xl border border-border bg-card p-7",
        className,
      )}
    >
      <motion.div className="pointer-events-none absolute inset-0" style={{ background: bg }} />
      <div className="relative">{children}</div>
    </motion.div>
  );
}

export function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-primary">
      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
      {children}
    </span>
  );
}
