import type { ReactNode } from "react";
import { AppShell } from "@/components/AppShell";
import "./scalehot.css";

export function SalesLayout({ children }: { children: ReactNode }) {
  return (
    <AppShell>
      <main className="mx-auto w-full min-w-0 max-w-7xl px-4 py-6 sm:px-8 sm:py-8">
        {children}
      </main>
    </AppShell>
  );
}

export function SalesPageHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <header className="operate-heading">
      <div>
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>
    </header>
  );
}
