import { motion, AnimatePresence } from "motion/react";
import { useEffect, useState } from "react";
import { Counter } from "./fx";

type Status = "Na fila" | "Agendado" | "Publicado";
type Post = { id: number; profile: string; title: string; status: Status };
const profiles = ["@studiofit", "@chefdacasa", "@viagemlow", "@devdicas", "@petshopzn"];
const titles = [
  "Reel: 3 erros no treino",
  "Receita em 30s",
  "Roteiro barato Lisboa",
  "Atalho no VS Code",
  "Banho sem estresse",
];
const next: Record<Status, Status> = {
  "Na fila": "Agendado",
  Agendado: "Publicado",
  Publicado: "Publicado",
};
const tone: Record<Status, string> = {
  "Na fila": "bg-muted text-muted-foreground",
  Agendado: "bg-primary/15 text-primary",
  Publicado: "bg-accent/20 text-accent",
};

export function HeroMock() {
  const [seq, setSeq] = useState(3);
  const [posts, setPosts] = useState<Post[]>([
    { id: 0, profile: profiles[0]!, title: titles[0]!, status: "Publicado" },
    { id: 1, profile: profiles[1]!, title: titles[1]!, status: "Agendado" },
    { id: 2, profile: profiles[2]!, title: titles[2]!, status: "Na fila" },
  ]);
  const [progress, setProgress] = useState(20);

  const add = () => {
    setSeq((s) => s + 1);
    setPosts((p) =>
      [
        {
          id: seq,
          profile: profiles[seq % 5]!,
          title: titles[seq % 5]!,
          status: "Na fila" as Status,
        },
        ...p,
      ].slice(0, 4),
    );
  };

  useEffect(() => {
    const t = setInterval(() => {
      setPosts((p) => p.map((x) => (Math.random() > 0.5 ? { ...x, status: next[x.status] } : x)));
      setProgress((v) => (v >= 100 ? 10 : v + 15));
    }, 1800);
    const a = setInterval(add, 4200);
    return () => {
      clearInterval(t);
      clearInterval(a);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seq]);

  return (
    <motion.div
      role="region"
      aria-label="Demonstração da fila de Reels"
      initial={{ opacity: 0, y: 40, rotateX: 12 }}
      animate={{ opacity: 1, y: 0, rotateX: 0 }}
      transition={{ duration: 1, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
      style={{ transformPerspective: 1200 }}
      className="relative rounded-3xl border border-border bg-card/80 p-5 shadow-glow backdrop-blur-xl"
    >
      <div className="mb-4 flex items-center justify-between">
        <div className="flex gap-1.5">
          <span className="h-3 w-3 rounded-full bg-destructive/70" />
          <span className="h-3 w-3 rounded-full bg-primary-glow/70" />
          <span className="h-3 w-3 rounded-full bg-accent/70" />
        </div>
        <span className="text-xs font-semibold text-muted-foreground">Demonstração · 5 perfis</span>
      </div>
      <div className="mb-4 grid grid-cols-3 gap-3">
        {[
          { l: "Posts/semana", v: 84 },
          { l: "Horas salvas", v: 26 },
          { l: "Alcance", v: 312, s: "k" },
        ].map((k) => (
          <div key={k.l} className="rounded-2xl bg-muted/60 p-3">
            <div className="text-[11px] text-muted-foreground">{k.l}</div>
            <div className="font-display text-2xl font-bold">
              <Counter to={k.v} suffix={k.s ?? ""} />
            </div>
          </div>
        ))}
      </div>
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-bold">Fila de Reels</span>
        <motion.button
          whileTap={{ scale: 0.92 }}
          onClick={add}
          className="rounded-full organic-fill-hot px-3 py-1 text-xs font-bold text-primary-foreground"
        >
          + Agendar
        </motion.button>
      </div>
      <ul className="space-y-2">
        <AnimatePresence initial={false}>
          {posts.map((p) => (
            <motion.li
              key={p.id}
              layout
              initial={{ opacity: 0, x: -30, scale: 0.95 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 30 }}
              transition={{ type: "spring", stiffness: 300, damping: 26 }}
              className="flex items-center gap-3 rounded-xl border border-border bg-background/60 p-2.5"
            >
              <div className="h-9 w-9 shrink-0 rounded-lg organic-fill-hot" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold">{p.title}</div>
                <div className="text-xs text-muted-foreground">{p.profile}</div>
              </div>
              <motion.span
                key={p.status}
                initial={{ scale: 0.6, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${tone[p.status]}`}
              >
                {p.status}
              </motion.span>
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>
      <div className="mt-4">
        <div className="mb-1 flex justify-between text-xs text-muted-foreground">
          <span>Exportando lote de mídia</span>
          <span>{Math.min(progress, 100)}%</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-muted">
          <motion.div
            className="h-full organic-fill-hot"
            animate={{ width: `${Math.min(progress, 100)}%` }}
            transition={{ duration: 0.8 }}
          />
        </div>
      </div>
    </motion.div>
  );
}
