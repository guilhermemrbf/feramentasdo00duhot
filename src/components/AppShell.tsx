import { Link, useRouterState } from "@tanstack/react-router";
import { FileKey, Home, Image, PanelTop, Scan, ShieldCheck, Zap } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

const navItems = [
  { to: "/" as const, label: "Início", icon: Home },
  { to: "/image-links" as const, label: "Image Links", icon: Image },
  { to: "/criar-pagina" as const, label: "Tela Privacy", icon: PanelTop },
  { to: "/limpar-metadados" as const, label: "Metadados", icon: FileKey },
  { to: "/otimizar-criativos" as const, label: "Criativos", icon: ShieldCheck },
  { to: "/gerar-preview" as const, label: "Preview", icon: Scan },
];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (state) => state.location.pathname });

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur-sm">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-5 px-4 sm:px-6 lg:px-8">
          <Link to="/" className="flex min-w-0 items-center gap-3" aria-label="00duHot — início">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <Zap className="size-4" strokeWidth={2.4} />
            </span>
            <span className="truncate font-display text-base font-bold">00duHot</span>
          </Link>

          <nav className="flex items-center gap-1" aria-label="Navegação principal">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = item.to === "/" ? pathname === "/" : pathname.startsWith(item.to);
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={cn(
                    "flex h-9 items-center gap-2 rounded-md px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
                    active && "bg-accent text-foreground",
                  )}
                >
                  <Icon className="size-4" />
                  <span className={cn("hidden", item.to !== "/" && "sm:inline")}>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>
      </header>
      {children}
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
    <header className="border-b border-border pb-8">
      <p className="mb-3 text-xs font-semibold uppercase text-primary">{eyebrow}</p>
      <h1 className="max-w-3xl font-display text-3xl font-bold text-foreground sm:text-4xl">{title}</h1>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">{description}</p>
    </header>
  );
}