import { Link, useRouterState } from "@tanstack/react-router";
import {
  FileKey,
  Home,
  Image,
  Instagram,
  PanelTop,
  Scan,
  Settings2,
  ShieldCheck,
  UserRound,
  Zap,
} from "lucide-react";
import type { ComponentType, ReactNode } from "react";
import { cn } from "@/lib/utils";

type NavItem = {
  to:
    | "/"
    | "/image-links"
    | "/criar-pagina"
    | "/limpar-metadados"
    | "/otimizar-criativos"
    | "/gerar-preview"
    | "/automacao-instagram";
  label: string;
  description: string;
  icon: ComponentType<{ className?: string }>;
};

const navItems: NavItem[] = [
  { to: "/", label: "Início", description: "Visão geral", icon: Home },
  { to: "/image-links", label: "Image Links", description: "Gerar links de imagens", icon: Image },
  { to: "/criar-pagina", label: "Criar Tela Privacy", description: "Criar páginas Privacy", icon: PanelTop },
  { to: "/limpar-metadados", label: "Limpar Metadados", description: "Limpar dados de arquivos", icon: FileKey },
  { to: "/otimizar-criativos", label: "Otimizar Criativos", description: "Otimizar arquivos criativos", icon: ShieldCheck },
  { to: "/gerar-preview", label: "Gerar Preview", description: "Gerar previews de mídia", icon: Scan },
  { to: "/automacao-instagram", label: "Automação Instagram", description: "Automação de Reels", icon: Instagram },
];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (state) => state.location.pathname });

  return (
    <div className="min-h-screen bg-background text-foreground">
      <aside className="fixed inset-y-0 left-0 z-50 hidden w-[264px] border-r border-sidebar-border bg-sidebar lg:flex lg:flex-col">
        <div className="flex h-[76px] items-center border-b border-sidebar-border px-5">
          <Link to="/" className="flex items-center gap-3" aria-label="00duHot — início">
            <span className="flex size-10 items-center justify-center rounded-xl bg-sidebar-primary text-sidebar-primary-foreground shadow-[0_0_28px_rgba(72,132,255,0.2)]">
              <Zap className="size-[18px]" strokeWidth={2.5} />
            </span>
            <div className="min-w-0">
              <p className="font-display text-[16px] font-bold tracking-tight">00duHot</p>
              <p className="mt-0.5 text-[9px] font-semibold tracking-[0.2em] text-sidebar-foreground/40">
                OPERAÇÃO DIGITAL
              </p>
            </div>
          </Link>
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-5">
          <p className="px-3 pb-2 text-[10px] font-semibold tracking-[0.16em] text-sidebar-foreground/35">
            PRINCIPAL
          </p>
          <nav className="space-y-1" aria-label="Ferramentas do 00duHot">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = item.to === "/" ? pathname === "/" : pathname.startsWith(item.to);

              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={cn(
                    "group relative flex items-center gap-3 rounded-xl border px-3 py-2.5 transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring",
                    active
                      ? "border-sidebar-border bg-sidebar-accent text-sidebar-accent-foreground shadow-[0_8px_24px_rgba(0,0,0,0.12)]"
                      : "border-transparent text-sidebar-foreground/60 hover:border-sidebar-border/60 hover:bg-sidebar-accent/55 hover:text-sidebar-accent-foreground",
                  )}
                  aria-current={active ? "page" : undefined}
                >
                  {active && (
                    <span className="absolute left-0 top-1/2 h-6 w-0.5 -translate-y-1/2 rounded-full bg-sidebar-primary" />
                  )}
                  <span
                    className={cn(
                      "flex size-9 shrink-0 items-center justify-center rounded-lg transition-colors",
                      active
                        ? "bg-sidebar-primary/12 text-sidebar-primary"
                        : "bg-sidebar-accent text-sidebar-foreground/55 group-hover:text-sidebar-foreground",
                    )}
                  >
                    <Icon className="size-[17px]" />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-[13px] font-semibold">{item.label}</span>
                    <span className="mt-0.5 block truncate text-[10px] text-sidebar-foreground/35">
                      {item.description}
                    </span>
                  </span>
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="border-t border-sidebar-border p-3">
          <div className="flex items-center gap-3 rounded-xl border border-sidebar-border/70 bg-sidebar-accent/45 px-3 py-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-sidebar-primary/10 text-sm font-bold text-sidebar-primary">
              G
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold">Guilherme</p>
              <p className="truncate text-[10px] text-sidebar-foreground/40">Conta ativa</p>
            </div>
            <UserRound className="size-4 text-sidebar-foreground/30" />
          </div>
          <div className="mt-2 flex items-center justify-between px-2 text-[10px] text-sidebar-foreground/30">
            <span>00duHot</span>
            <Settings2 className="size-3.5" />
          </div>
        </div>
      </aside>

      <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur-md lg:hidden">
        <div className="flex h-14 items-center gap-3 overflow-x-auto px-3">
          <Link to="/" className="mr-1 flex shrink-0 items-center gap-2" aria-label="00duHot — início">
            <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Zap className="size-4" />
            </span>
            <span className="font-display text-sm font-bold">00duHot</span>
          </Link>
          <nav className="flex items-center gap-1" aria-label="Navegação principal">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = item.to === "/" ? pathname === "/" : pathname.startsWith(item.to);

              return (
                <Link
                  key={item.to}
                  to={item.to}
                  aria-label={item.label}
                  className={cn(
                    "flex size-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    active && "bg-accent text-foreground",
                  )}
                >
                  <Icon className="size-4" />
                </Link>
              );
            })}
          </nav>
        </div>
      </header>

      <div className="lg:pl-[264px]">{children}</div>
    </div>
  );
}

export function PageIntro({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <header className="border-b border-border pb-7">
      <p className="mb-2 text-xs font-semibold tracking-wide text-primary">{eyebrow}</p>
      <h1 className="max-w-3xl font-display text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
        {title}
      </h1>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-[15px]">
        {description}
      </p>
    </header>
  );
}
