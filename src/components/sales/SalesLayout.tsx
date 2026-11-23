import type { ReactNode } from "react";
import { useRouterState } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import "./scalehot.css";

export function SalesLayout({ children }: { children: ReactNode }) {
  const standalone = useRouterState({
    select: ({ location }) => location.pathname === "/vendas" || location.pathname === "/vendas/",
  });
  return (
    <AppShell>
      <div className={standalone ? "scalehot-theme scalehot-workspace" : undefined}>
        <main className="mx-auto w-full min-w-0 max-w-7xl px-4 py-6 sm:px-6 lg:px-10 lg:py-10">
          {children}
        </main>
      </div>
    </AppShell>
  );
}

export function SalesPageHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <header className="mb-8 space-y-1.5 sm:mb-10">
      <h1 className="font-display text-2xl font-bold tracking-tight text-balance sm:text-3xl md:text-4xl">
        {title}
      </h1>
      <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base md:text-lg">
        {subtitle}
      </p>
    </header>
  );
}
