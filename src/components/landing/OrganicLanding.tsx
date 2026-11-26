import { Link } from "@tanstack/react-router";
import { BRAND_NAME, BRAND_SLOGAN } from "@/lib/brand";
import {
  AtSign,
  Building2,
  CalendarDays,
  ChartNoAxesCombined,
  Clapperboard,
  Cloud,
  Crosshair,
  Film,
  FolderOpen,
  GitBranch,
  Hash,
  ImageIcon,
  Instagram,
  LayoutGrid,
  Link2,
  LockKeyhole,
  MonitorSmartphone,
  MousePointer2,
  PenLine,
  Plus,
  ReceiptText,
  Route as RouteIcon,
  ScanSearch,
  ShieldCheck,
  Smartphone,
  Zap,
} from "lucide-react";
import {
  motion,
  useScroll,
  useTransform,
  useMotionValueEvent,
  AnimatePresence,
  MotionConfig,
  useInView,
  useReducedMotion,
} from "motion/react";
import { useEffect, useRef, useState } from "react";
import { AccessForm } from "@/components/access/AccessForm";
import { findTool } from "@/lib/tool-catalog";
import { Reveal, MagneticButton, TiltCard, Eyebrow } from "./fx";
import { OperationComparison } from "./OperationComparison";
import { Mascot } from "./Mascot";
import { HeroMock } from "./HeroMock";
import { OrbitHero } from "./OrbitHero";
import { RoiCalculator, Quiz, BeforeAfter } from "./Interactive";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const headline = BRAND_SLOGAN.split(" ");

function Nav() {
  const { scrollY } = useScroll();
  const [small, setSmall] = useState(false);
  useMotionValueEvent(scrollY, "change", (v) => setSmall(v > 40));
  return (
    <motion.header
      className="fixed inset-x-0 top-0 z-50 flex justify-center px-4"
      animate={{ paddingTop: small ? 10 : 20 }}
    >
      <motion.nav
        aria-label="Menu público"
        animate={{ maxWidth: small ? 900 : 1240 }}
        className="flex w-full items-center justify-between rounded-full border border-border bg-background/70 px-5 py-3 backdrop-blur-xl"
      >
        <a href="#" className="flex items-center gap-2 font-display text-xl font-extrabold">
          <img src="/brand/organic-mascot.webp" alt="" className="h-8 w-8 rounded-full" />
          <span aria-label={BRAND_NAME}>
            Mouse<span className="text-primary">fy</span>
          </span>
        </a>
        <div className="hidden gap-7 text-sm font-semibold text-muted-foreground md:flex">
          <a href="#frentes" className="hover:text-foreground">
            Tudo em um lugar
          </a>
          <a href="#como" className="hover:text-foreground">
            Como funciona
          </a>
          <a href="#ferramentas" className="hover:text-foreground">
            Ferramentas
          </a>
          <a href="#calculadora" className="hover:text-foreground">
            Calculadora
          </a>
          <a href="#faq" className="hover:text-foreground">
            FAQ
          </a>
        </div>
        <a
          href="#acesso"
          className="rounded-full organic-fill-hot px-5 py-2.5 text-sm font-bold text-primary-foreground"
        >
          Criar conta
        </a>
      </motion.nav>
    </motion.header>
  );
}

function Hero({ sectionRef }: { sectionRef: React.RefObject<HTMLElement | null> }) {
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start start", "end start"],
  });
  const y = useTransform(scrollYProgress, [0, 1], [0, 78]);
  const blob = useTransform(scrollYProgress, [0, 1], [0, -200]);
  return (
    <section ref={sectionRef} className="relative overflow-hidden pt-28 pb-20 md:pt-36 md:pb-28">
      <div className="absolute inset-0 bg-grid opacity-40 [mask-image:radial-gradient(ellipse_at_top,black,transparent_70%)]" />
      <motion.div
        style={reduce ? undefined : { y: blob }}
        className="absolute -top-40 left-1/2 h-[600px] w-[600px] -translate-x-1/2 rounded-full bg-primary/25 blur-[140px]"
      />
      <div className="ambient-hero relative mx-auto max-w-[1240px] px-6">
        <div className="ambient-hero-heading">
          <h1
            aria-label={BRAND_SLOGAN}
            className="text-[clamp(2.5rem,6.25vw,4.85rem)] font-extrabold leading-[0.99]"
          >
            {headline.map((w, i) => (
              <motion.span
                aria-hidden="true"
                key={i}
                className={`mr-[0.22em] inline-block ${w === "digital" || w === "lugar" ? "text-gradient-hot" : ""}`}
                initial={reduce ? false : { opacity: 0.76, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  delay: reduce ? 0 : i * 0.042,
                  duration: reduce ? 0 : 0.6,
                  ease: [0.22, 1, 0.36, 1],
                }}
              >
                {w}
                {i < headline.length - 1 ? " " : ""}
              </motion.span>
            ))}
          </h1>
        </div>
        <motion.div style={reduce ? undefined : { y }} className="ambient-hero-visual">
          <OrbitHero />
        </motion.div>
        <div className="ambient-hero-detail">
          <p className="max-w-[34rem] text-lg leading-relaxed text-muted-foreground md:text-xl">
            Descubra quais campanhas geraram vendas, programe Reels por perfil e prepare seus
            Stories. Reúna também os canais de Telegram, os arquivos e os celulares que fazem parte
            da operação.
          </p>
          <div className="mt-6 flex flex-wrap gap-4">
            <MagneticButton href="#acesso">Criar minha conta →</MagneticButton>
            <MagneticButton href="#como" variant="ghost">
              Ver como funciona
            </MagneticButton>
          </div>
          <p className="mt-5 text-sm text-muted-foreground">
            Cadastro sujeito à aprovação · Teste de 15 minutos por convite
          </p>
        </div>
      </div>
    </section>
  );
}

function Marquee() {
  const items = [
    "Tráfego pago",
    "Traqueamento de vendas",
    "Gestão de contas",
    "Reels agendados",
    "Agenda de Stories",
    "Fazenda de celulares",
    "Tráfego orgânico",
    "Infoprodutos",
    "Agências",
  ];
  return (
    <div className="overflow-hidden border-y border-border bg-card/50 py-6">
      <div className="flex w-max animate-marquee gap-12">
        {[...items, ...items].map((t, i) => (
          <span
            key={i}
            className="flex items-center gap-12 font-display text-2xl font-bold text-muted-foreground"
          >
            {t}
            <Plus className="size-4 text-primary" aria-hidden="true" />
          </span>
        ))}
      </div>
    </div>
  );
}

const steps = [
  {
    n: "01",
    t: "Conecte as contas e escolha os perfis",
    dor: "Trocar de painel para gerenciar cada conta.",
    res: "Conecte suas contas profissionais e compare perfis e subnichos no Instagram Intelligence antes de investir.",
    vis: [
      "@loja.exemplo · conta conectada",
      "@estudio.exemplo · conta conectada",
      "Perfil de referência · em análise",
    ],
  },
  {
    n: "02",
    t: "Do arquivo original à prévia com sua marca",
    dor: "Várias cópias do mesmo vídeo em pastas diferentes.",
    res: "Guarde o original, exporte a versão com sua marca e crie a prévia para divulgar — tudo em lote, no navegador.",
    vis: ["original.mp4", "com-marca.mp4", "previa.mp4"],
  },
  {
    n: "03",
    t: "Uma biblioteca para cada conta",
    dor: "Links e vídeos perdidos em conversas e planilhas.",
    res: "Reels e Stories separados por perfil. Vincule uma pasta privada do Google Drive à biblioteca de Reels.",
    vis: ["Pasta no Google Drive", "Reels da conta", "Stories da conta"],
  },
  {
    n: "04",
    t: "Agende Reels e acompanhe Stories",
    dor: "Horários conferidos conta por conta.",
    res: "Escolha dias e horários, revise a fila e veja o que foi publicado em cada perfil. Os Stories com figurinhas são publicados no Instagram após o lembrete.",
    vis: [
      "Reel da manhã · 09:00 · Revisado",
      "Story · 12:00 · Lembrete",
      "Reel da noite · 18:00 · Na fila",
    ],
  },
];

const stepIcons = [ScanSearch, Film, FolderOpen, CalendarDays];

function StepPreview({ index }: { index: number }) {
  const step = steps[index]!;
  const Icon = stepIcons[index]!;

  return (
    <div className="flow-preview">
      <div className="flow-preview-surface">
        <div className="flow-preview-header">
          <Icon size={22} strokeWidth={1.7} aria-hidden="true" />
          <strong>{step.t}</strong>
        </div>
        <ul>
          {step.vis.map((value) => (
            <li key={value}>
              <span aria-hidden="true" />
              {value}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function Steps() {
  const ref = useRef<HTMLElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] });
  const [active, setActive] = useState(0);
  const bar = useTransform(scrollYProgress, [0, 1], [0, 1]);
  const rotateY = useTransform(scrollYProgress, [0, 0.52, 1], [-22, 0, 12]);
  const rotateX = useTransform(scrollYProgress, [0, 1], [14, -7]);
  useMotionValueEvent(scrollYProgress, "change", (v) => setActive(Math.min(3, Math.floor(v * 4))));
  const step = steps[active]!;

  return (
    <section id="como" ref={ref} className="landing-flow" aria-label="Como funciona">
      <div className="landing-flow-sticky">
        <div className="landing-flow-content">
          <div>
            <h2 className="text-3xl font-extrabold sm:text-4xl">Da preparação à publicação.</h2>
            <ol className="flow-chapters" aria-label="Etapas da operação">
              {steps.map(({ n, t }, i) => (
                <li key={n} aria-current={i === active ? "step" : undefined}>
                  <span>{n}</span>
                  <span>{t}</span>
                </li>
              ))}
            </ol>
            <div className="flow-progress" aria-hidden="true">
              <motion.div style={{ scaleX: bar }} />
            </div>
            <p className="mt-5 min-h-24 max-w-md text-base leading-relaxed text-muted-foreground">
              {step.res}
            </p>
          </div>
          <div className="flow-perspective">
            <motion.div className="flow-world" style={reduce ? undefined : { rotateY, rotateX }}>
              <div className="flow-depth flow-depth-far" aria-hidden="true" />
              <div className="flow-depth" aria-hidden="true" />
              <AnimatePresence initial={false} mode="popLayout">
                <motion.div
                  key={active}
                  className="flow-pane"
                  initial={{ opacity: 0, x: 25, z: -30 }}
                  animate={{ opacity: 1, x: 0, z: 0 }}
                  exit={{ opacity: 0, x: -30, z: 32 }}
                  transition={{ duration: 0.36, ease: [0.22, 1, 0.36, 1] }}
                >
                  <StepPreview index={active} />
                </motion.div>
              </AnimatePresence>
            </motion.div>
          </div>
        </div>
      </div>
      <div className="landing-flow-static mx-auto max-w-[1240px] px-6 py-20">
        <h2 className="mb-8 text-3xl font-extrabold sm:text-4xl">Da preparação à publicação.</h2>
        <ol className="grid gap-9 md:grid-cols-2">
          {steps.map(({ n, res }, i) => (
            <motion.li
              key={n}
              initial={false}
              whileInView={reduce ? undefined : { opacity: [0.76, 1], rotateX: [9, 0], y: [16, 0] }}
              viewport={{ once: true, amount: 0.25 }}
              transition={{ duration: 0.48, ease: "easeOut" }}
              style={{ transformPerspective: 750 }}
            >
              <StepPreview index={i} />
              <p className="mt-4 text-base leading-relaxed text-muted-foreground">{res}</p>
            </motion.li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function Section({
  id,
  eyebrow,
  title,
  sub,
  children,
  alt,
}: {
  id?: string;
  eyebrow: string;
  title: React.ReactNode;
  sub?: string;
  children: React.ReactNode;
  alt?: boolean;
}) {
  return (
    <section id={id} className={`py-20 md:py-36 ${alt ? "bg-card/40" : ""}`}>
      <div className="mx-auto max-w-[1240px] px-6">
        <Reveal className="mx-auto mb-14 max-w-3xl text-center">
          <Eyebrow>{eyebrow}</Eyebrow>
          <h2 className="mt-5 text-[clamp(2.2rem,4.5vw,3.8rem)] font-extrabold leading-[1.02]">
            {title}
          </h2>
          {sub && <p className="mx-auto mt-5 max-w-[60ch] text-lg text-muted-foreground">{sub}</p>}
        </Reveal>
        {children}
      </div>
    </section>
  );
}

const personas = [
  {
    icon: LayoutGrid,
    t: "Operações com vários perfis",
    d: "Organize conteúdo e programação para os perfis que você administra.",
  },
  {
    icon: Crosshair,
    t: "Infoprodutores",
    d: "Planeje conteúdo orgânico para apresentar sua oferta.",
  },
  {
    icon: Building2,
    t: "Agências",
    d: "Bibliotecas e agendas por perfil para vários clientes com equipe enxuta.",
  },
  {
    icon: Smartphone,
    t: "Outros nichos digitais",
    d: "Organize campanhas, conteúdo e tarefas recorrentes do seu negócio.",
  },
];

const tools = [
  {
    icon: Zap,
    t: "Gestão de contas",
    d: "Conecte suas contas profissionais do Instagram e organize a operação por perfil.",
  },
  {
    icon: ScanSearch,
    t: "Instagram Intelligence",
    d: "Pesquise e compare perfis e subnichos antes de investir em produção.",
  },
  {
    icon: GitBranch,
    t: "Funil visual",
    d: "Desenhe o caminho do primeiro contato até a venda, por campanha.",
  },
  {
    icon: Clapperboard,
    t: "Preparo em lote",
    d: "Original, versão com marca e prévia — dezenas de vídeos de uma vez, no navegador.",
  },
  {
    icon: CalendarDays,
    t: "Automatic Post · Reels",
    d: "Fila de Reels de todos os perfis, com dia, horário e histórico.",
  },
  {
    icon: Instagram,
    t: "Agenda de Stories",
    d: "Prepare sequências de Stories por conta com lembretes para publicar.",
  },
  {
    icon: MonitorSmartphone,
    t: "Fazenda de celulares",
    d: "Conecte vários iPhones ao Windows via USB e selecione a tela que deseja acompanhar.",
  },
  {
    icon: FolderOpen,
    t: "Biblioteca por conta",
    d: "Pasta privada do Google Drive vinculada à biblioteca de Reels de cada perfil.",
  },
];

const trackingSteps = [
  { icon: MousePointer2, title: "Clique na campanha", detail: "Identifica a origem da visita" },
  { icon: ReceiptText, title: "Pagamento aprovado", detail: "Confirma a venda recebida" },
  {
    icon: ChartNoAxesCombined,
    title: "Receita por campanha",
    detail: "Exibe as vendas atribuídas",
  },
];

function TrackingFeature() {
  const frame = useRef<HTMLDivElement>(null);
  const player = useRef<HTMLVideoElement>(null);
  const inView = useInView(frame, { amount: 0.6 });
  const hasEntered = useInView(frame, { amount: 0.6, once: true });
  const reduceMotion = useReducedMotion();
  const tracking = findTool("/vendas");

  useEffect(() => {
    const video = player.current;
    if (!video || reduceMotion !== false || !inView) return;
    const sync = () => {
      if (document.hidden) video.pause();
      else if (!video.ended) void video.play().catch(() => {});
    };
    sync();
    document.addEventListener("visibilitychange", sync);
    return () => {
      document.removeEventListener("visibilitychange", sync);
      video.pause();
    };
  }, [hasEntered, inView, reduceMotion]);

  if (!tracking) return null;

  return (
    <div id="rastreamento" className="mb-5 scroll-mt-24">
      <Reveal className="landing-tracking-feature brand-stage">
        <div>
          <span className="landing-tracking-icon" aria-hidden="true">
            <RouteIcon size={22} strokeWidth={1.75} />
          </span>
          <h3 className="mt-4 text-2xl font-bold sm:text-3xl">Rastreamento avançado de vendas</h3>
          <p className="mt-3 max-w-xl text-base leading-relaxed text-muted-foreground">
            {tracking.summary}
          </p>
          <div ref={frame} className="tracking-motion" aria-hidden="true">
            {hasEntered && reduceMotion === false ? (
              <video
                ref={player}
                muted
                playsInline
                preload="none"
                poster="/brand/tracking-flow.webp"
                src="/brand/tracking-flow.mp4"
              />
            ) : (
              <img src="/brand/tracking-flow.webp" alt="" width={720} height={405} loading="lazy" />
            )}
          </div>
        </div>
        <ol className="landing-tracking-steps" aria-label="Como o Mousefy atribui uma venda">
          {trackingSteps.map(({ icon: Icon, title, detail }) => (
            <li key={title}>
              <Icon size={18} strokeWidth={1.75} aria-hidden="true" />
              <div>
                <strong>{title}</strong>
                <span>{detail}</span>
              </div>
            </li>
          ))}
        </ol>
      </Reveal>
    </div>
  );
}

function StoriesMock() {
  const reduce = useReducedMotion();
  const stories = [
    { t: "08:00 · Bom dia", s: "Figurinha de link" },
    { t: "12:00 · Prévia do conteúdo", s: "Menção marcada" },
    { t: "18:00 · Chamada pro link", s: "Link e hashtag" },
    { t: "21:00 · Último Story", s: "Hashtag do perfil" },
  ];
  const stickers = [
    { icon: Link2, l: "Link", x: "12%", y: "30%" },
    { icon: AtSign, l: "Menção", x: "52%", y: "48%" },
    { icon: Hash, l: "Hashtag", x: "18%", y: "64%" },
  ];
  return (
    <div className="grid items-center gap-10 md:grid-cols-2">
      <Reveal>
        <div className="flex justify-center gap-4">
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              animate={reduce ? undefined : { y: [0, i % 2 ? 12 : -12, 0] }}
              transition={{ duration: 4 + i, repeat: Infinity, ease: "easeInOut" }}
              className="relative aspect-[9/16] w-28 overflow-hidden rounded-3xl border border-border bg-card p-2 sm:w-36"
            >
              <div className="flex gap-1">
                {[0, 1, 2].map((k) => (
                  <div key={k} className="h-1 flex-1 overflow-hidden rounded bg-muted">
                    <motion.div
                      className="h-full bg-foreground"
                      animate={{ width: reduce ? "100%" : ["0%", "100%"] }}
                      transition={
                        reduce
                          ? { duration: 0 }
                          : { duration: 3, delay: k * 3, repeat: Infinity, repeatDelay: 6 }
                      }
                    />
                  </div>
                ))}
              </div>
              <div className="mt-2 flex items-center gap-1.5">
                <img src="/brand/organic-mascot.webp" alt="" className="h-5 w-5 rounded-full" />
                <span className="text-[10px] font-bold">@perfil_0{i + 1}</span>
              </div>
              {stickers.map((st, k) => (
                <motion.div
                  key={st.l}
                  className="absolute flex items-center gap-1 rounded-full bg-foreground/90 px-1.5 py-0.5 text-[8px] font-bold text-background shadow sm:text-[9px]"
                  style={{ left: st.x, top: st.y }}
                  initial={reduce ? false : { scale: 0, rotate: -20 }}
                  animate={
                    reduce ? undefined : { scale: [0, 1.15, 1], rotate: 0, opacity: [0, 1, 1, 0] }
                  }
                  transition={{
                    duration: 2.2,
                    delay: 1 + k * 2.2 + i * 0.5,
                    repeat: Infinity,
                    repeatDelay: 4.4,
                    times: [0, 0.15, 0.85, 1],
                  }}
                >
                  <st.icon className="size-3" aria-hidden="true" />
                  {st.l}
                </motion.div>
              ))}
              <div className="absolute inset-x-2 bottom-3 rounded-xl organic-fill-hot p-2 text-center text-[10px] font-bold text-primary-foreground">
                Lembrete
              </div>
            </motion.div>
          ))}
        </div>
      </Reveal>
      <div className="space-y-3">
        {stories.map((t, i) => (
          <Reveal key={t.t} delay={i * 0.08}>
            <div className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4">
              <div>
                <span className="font-semibold">{t.t}</span>
                <p className="mt-1 text-xs font-bold text-primary">{t.s}</p>
              </div>
              <span className="shrink-0 rounded-full bg-primary/15 px-3 py-1 text-xs font-bold text-primary">
                Lembrete
              </span>
            </div>
          </Reveal>
        ))}
        <Reveal delay={0.35}>
          <p className="pt-1 text-sm text-muted-foreground">
            Prepare <strong className="text-foreground">link</strong>,{" "}
            <strong className="text-foreground">menção</strong> e{" "}
            <strong className="text-foreground">hashtag</strong>. Na hora indicada, adicione as
            figurinhas ao publicar pelo Instagram.
          </p>
        </Reveal>
      </div>
    </div>
  );
}

function ReelsMock() {
  const reduce = useReducedMotion();
  const feats = [
    { icon: ImageIcon, t: "Capa do Reel", d: "Escolha a capa que aparece no feed de cada perfil." },
    { icon: PenLine, t: "Legenda", d: "Texto pronto por conta, sem copiar e colar na mão." },
    { icon: Hash, t: "Hashtags", d: "Conjuntos de hashtags por nicho, aplicados no agendamento." },
    { icon: ShieldCheck, t: "Mais segurança", d: "Publicação com a autorização oficial da Meta." },
  ];
  return (
    <div className="grid items-center gap-10 md:grid-cols-2">
      <div className="order-2 space-y-3 md:order-1">
        {feats.map(({ icon: Icon, t, d }, i) => (
          <Reveal key={t} delay={i * 0.08}>
            <div className="flex items-start gap-4 rounded-2xl border border-border bg-card p-4">
              <span className="text-2xl">
                <Icon className="size-6 text-primary" aria-hidden="true" />
              </span>
              <div>
                <p className="font-bold">{t}</p>
                <p className="mt-0.5 text-sm text-muted-foreground">{d}</p>
              </div>
            </div>
          </Reveal>
        ))}
      </div>
      <Reveal className="order-1 md:order-2">
        <div className="mx-auto w-64">
          <motion.div
            animate={reduce ? undefined : { y: [0, -10, 0] }}
            transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
            className="relative overflow-hidden rounded-[2rem] border border-border bg-card shadow-glow"
          >
            <div className="relative aspect-[9/16] organic-reel-shade p-3">
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 }}
                className="absolute top-3 right-3 rounded-full bg-foreground/90 px-2.5 py-1 text-[10px] font-bold text-background"
              >
                <ImageIcon className="mr-1 inline size-3" aria-hidden="true" /> Capa definida
              </motion.div>
              <div className="mt-8 flex items-center gap-1.5">
                <img src="/brand/organic-mascot.webp" alt="" className="h-6 w-6 rounded-full" />
                <span className="text-[11px] font-bold">@perfil_01</span>
              </div>
              <div className="absolute inset-x-3 bottom-3 space-y-2">
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 1 }}
                  className="rounded-xl bg-background/70 p-2 text-[10px] font-semibold backdrop-blur"
                >
                  Legenda: 3 erros que travam sua operação no orgânico…
                </motion.p>
                <div className="flex flex-wrap gap-1">
                  {["#trafegoorganico", "#rendadigital", "#mousefy"].map((h, k) => (
                    <motion.span
                      key={h}
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ delay: 1.3 + k * 0.15, type: "spring", stiffness: 300 }}
                      className="rounded-full bg-primary/20 px-2 py-0.5 text-[9px] font-bold text-primary"
                    >
                      {h}
                    </motion.span>
                  ))}
                </div>
                <div className="rounded-xl organic-fill-hot p-2 text-center text-[10px] font-bold text-primary-foreground">
                  Reel agendado · 18:00 ✓
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </Reveal>
    </div>
  );
}

const faqs = [
  ["Quanto custa?", "Entre na sua conta para consultar os planos recorrentes e assinar com Pix."],
  [
    "A criação de contas é automática mesmo?",
    "Você cria a conta no Instagram e depois conecta o perfil profissional ao Mousefy para organizar o conteúdo.",
  ],
  [
    "O Automatic Post publica Stories sozinho?",
    "O Mousefy publica Reels da fila quando a publicação automática está ativa. Para Stories, ele prepara a mídia e envia um lembrete. Adicione as figurinhas no Instagram e publique manualmente.",
  ],
  [
    "Como funciona a Fazenda de Celulares?",
    "Conecte iPhones compatíveis via USB a um computador Windows. A janela exibe um aparelho por vez. Para controle por mouse e teclado, use iOS 27 ou mais recente com o Modo de Desenvolvedor ativo.",
  ],
  [
    "Funciona para agência e vários clientes?",
    "Você organiza contas profissionais autorizadas, com bibliotecas e agendas por perfil. As condições para agências ainda estão em definição.",
  ],
  [
    "Meus dados e perfis ficam seguros?",
    "A conexão do Instagram usa a autorização oficial da Meta e o preparo de mídia acontece no seu navegador.",
  ],
  [
    "Preciso de conta profissional no Instagram?",
    "Sim, para programar publicações no Automatic Post. As ferramentas de preparo funcionam sem conectar perfil.",
  ],
  [
    "Meus vídeos do Google Drive precisam ficar públicos?",
    "Não. A pasta continua privada: compartilhe com a identidade indicada pelo Mousefy e vincule à biblioteca da conta.",
  ],
  [
    "Como funciona o convite de 15 minutos?",
    "O convite vale uma vez e vence 15 minutos após ser gerado. Entre com o e-mail indicado no convite. Ao iniciar, você tem 15 minutos para testar as ferramentas de preparo.",
  ],
  [
    "Posso criar uma conta sem convite?",
    "Sim. Use o formulário no fim da página, confirme o e-mail e aguarde a aprovação para entrar no painel.",
  ],
];

export function OrganicLanding() {
  const heroSection = useRef<HTMLElement>(null);
  const accessSection = useRef<HTMLElement>(null);
  const viewingAccess = useInView(accessSection, { margin: "0px 0px -60px 0px" });
  const [pastHero, setPastHero] = useState(false);

  useEffect(() => {
    const hero = heroSection.current;
    if (!hero) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry) setPastHero(entry.boundingClientRect.bottom <= 1);
      },
      { rootMargin: "-1px 0px 0px" },
    );
    observer.observe(hero);
    return () => observer.disconnect();
  }, []);

  return (
    <MotionConfig reducedMotion="user">
      <div className="organic-landing">
        <a className="skip-link" href="#conteudo">
          Pular para o conteúdo
        </a>
        <Nav />
        <main id="conteudo" tabIndex={-1} className="overflow-x-clip">
          <Hero sectionRef={heroSection} />
          <Marquee />

          <OperationComparison />

          <Steps />

          <Section
            id="ferramentas"
            eyebrow="Ferramentas"
            title={
              <>
                Tudo que sua operação usa,{" "}
                <span className="text-gradient-hot">no mesmo lugar.</span>
              </>
            }
            sub="Planeje perfis, prepare conteúdo, programe publicações e acompanhe de onde vêm suas vendas."
          >
            <TrackingFeature />
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {tools.map(({ icon: Icon, t, d }, i) => (
                <Reveal key={t} delay={(i % 4) * 0.07}>
                  <TiltCard className="h-full">
                    <div className="text-3xl">
                      <Icon className="size-7 text-primary" aria-hidden="true" />
                    </div>
                    <h3 className="mt-4 text-xl font-bold">{t}</h3>
                    <p className="mt-2 text-[15px] text-muted-foreground">{d}</p>
                  </TiltCard>
                </Reveal>
              ))}
            </div>
          </Section>

          <Section
            eyebrow="Agenda de Stories"
            title={
              <>
                Organize a publicação de Stories,{" "}
                <span className="text-gradient-hot">conta por conta.</span>
              </>
            }
            sub="Prepare mídia, link, menção e hashtag na prévia. O lembrete sinaliza a hora de abrir o Instagram, adicionar as figurinhas e publicar."
            alt
          >
            <StoriesMock />
          </Section>

          <Section
            eyebrow="Reels completos"
            title={
              <>
                Reel agendado com capa, legenda e hashtag.{" "}
                <span className="text-gradient-hot">Publique pela conexão com a Meta.</span>
              </>
            }
            sub="Quando a publicação automática está ativa, o Mousefy envia o Reel da fila para o perfil profissional autorizado pela Meta."
          >
            <ReelsMock />
          </Section>

          <Section
            eyebrow="Por dentro do painel"
            title="Veja como aparecem as vendas e a fila de Reels."
            sub="Alterne entre vendas atribuídas e a fila de Reels. Os dois exemplos usam dados fictícios."
          >
            <div className="mx-auto max-w-xl">
              <HeroMock />
            </div>
          </Section>

          <Section
            id="comparacao"
            eyebrow="Pare de apagar incêndio"
            title={
              <>
                Pare de apagar incêndio. <span className="text-gradient-hot">Comece a operar.</span>
              </>
            }
            sub="Quando a operação cresce, importa onde está cada arquivo, quem vai publicar e o que já saiu. Arraste e compare."
            alt
          >
            <Reveal>
              <BeforeAfter />
            </Reveal>
          </Section>

          <Section
            id="calculadora"
            eyebrow="Calculadora"
            title={
              <>
                Quanto o trabalho manual está te{" "}
                <span className="text-gradient-hot">custando?</span>
              </>
            }
            sub="Use seus números para estimar o tempo e o custo atuais dedicados às publicações manuais."
          >
            <Reveal>
              <RoiCalculator />
            </Reveal>
          </Section>

          <Section eyebrow="Para quem é" title="Para quem opera campanhas, canais e conteúdo." alt>
            <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
              {personas.map(({ icon: Icon, t, d }, i) => (
                <Reveal key={t} delay={i * 0.08}>
                  <TiltCard className="h-full">
                    <div className="text-4xl">
                      <Icon className="size-7 text-primary" aria-hidden="true" />
                    </div>
                    <h3 className="mt-5 text-2xl font-bold">{t}</h3>
                    <p className="mt-3 text-muted-foreground">{d}</p>
                  </TiltCard>
                </Reveal>
              ))}
            </div>
          </Section>

          <Section eyebrow="Seu ponto de partida" title="Escolha seu ponto de partida.">
            <Reveal>
              <Quiz />
            </Reveal>
          </Section>

          <Section
            eyebrow="Segurança"
            title={
              <>
                Mais controle, <span className="text-gradient-hot">com conexão oficial.</span>
              </>
            }
            sub="Autorize seus perfis profissionais na Meta e acompanhe as publicações de Reels no histórico."
            alt
          >
            <div className="grid gap-5 md:grid-cols-3">
              {(
                [
                  [
                    LockKeyhole,
                    "API oficial da Meta",
                    "Publicação de Reels pela conexão autorizada na Meta.",
                  ],
                  [
                    Cloud,
                    "Drive privado",
                    "A pasta de Reels pode permanecer privada no Google Drive.",
                  ],
                  [
                    Zap,
                    "Processado no navegador",
                    "Exportação local, rápida e sem upload de arquivos pesados.",
                  ],
                ] as const
              ).map(([Icon, t, d], i) => (
                <Reveal key={t} delay={i * 0.08}>
                  <TiltCard className="h-full">
                    <Icon className="size-7 text-primary" aria-hidden="true" />
                    <h3 className="mt-4 text-xl font-bold">{t}</h3>
                    <p className="mt-2 text-muted-foreground">{d}</p>
                  </TiltCard>
                </Reveal>
              ))}
            </div>
          </Section>

          <Section id="faq" eyebrow="Dúvidas" title="Tudo que te impede de começar hoje.">
            <Reveal className="mx-auto max-w-3xl">
              <Accordion type="single" collapsible className="space-y-3">
                {faqs.map(([q = "", a = ""]) => (
                  <AccordionItem
                    key={q}
                    value={q}
                    className="rounded-2xl border border-border bg-card px-6"
                  >
                    <AccordionTrigger className="text-left text-lg font-bold hover:no-underline">
                      {q}
                    </AccordionTrigger>
                    <AccordionContent className="text-base text-muted-foreground">
                      {a}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </Reveal>
          </Section>

          <section
            id="acesso"
            ref={accessSection}
            tabIndex={-1}
            aria-labelledby="organic-access-title"
            className="relative overflow-hidden py-24 md:py-36"
          >
            <div className="absolute inset-0 organic-fill-hot opacity-15" />
            <div className="relative mx-auto grid max-w-[1100px] items-center gap-12 px-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
              <Reveal>
                <div className="mb-7 flex flex-col items-center lg:items-start">
                  <Mascot size={200} />
                  <p className="mt-3 text-sm text-muted-foreground">Dê um toque no rato</p>
                </div>
                <Eyebrow>Acesso antecipado</Eyebrow>
                <h2
                  id="organic-access-title"
                  className="mt-5 text-[clamp(2.4rem,5vw,4.2rem)] font-extrabold leading-[1]"
                >
                  Sua próxima operação começa com{" "}
                  <span className="text-gradient-hot">mais controle.</span>
                </h2>
                <p className="mt-4 mb-8 text-lg text-muted-foreground">
                  Crie sua conta para organizar publicações e acompanhar as vendas da sua operação
                  no mesmo painel.
                </p>
              </Reveal>
              <div className="organic-access">
                <AccessForm />
                <p className="mt-3 text-sm text-muted-foreground">
                  Após confirmar seu e-mail, acompanhe a aprovação do cadastro ao entrar.
                </p>
                <nav
                  aria-label="Informações legais"
                  className="mt-3 flex flex-wrap gap-4 text-sm text-muted-foreground"
                >
                  <Link to="/privacidade" className="hover:underline">
                    Privacidade
                  </Link>
                  <Link to="/exclusao-de-dados" className="hover:underline">
                    Exclusão de dados
                  </Link>
                </nav>
              </div>
            </div>
          </section>
        </main>
        <footer className="border-t border-border py-10 pb-28 text-center text-sm text-muted-foreground md:pb-10">
          © 2026 {BRAND_NAME} · {BRAND_SLOGAN}
        </footer>

        {pastHero && !viewingAccess && (
          <div className="fixed inset-x-4 bottom-4 z-40 md:hidden">
            <a
              href="#acesso"
              className="block rounded-full organic-fill-hot py-4 text-center font-bold text-primary-foreground shadow-glow"
            >
              Criar minha conta
            </a>
          </div>
        )}
      </div>
    </MotionConfig>
  );
}
