import { downloads } from "@/lib/downloads";

export function WorkspaceMode({ mode }: { mode: "local" | "cloud" }) {
  return (
    <section
      aria-label="Onde executar seus ambientes"
      className="rounded-lg border border-border bg-card p-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">Onde os ambientes vão rodar?</h2>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            {mode === "local"
              ? "No seu computador: dados locais e sem servidor contratado."
              : "Na nuvem: usa sua configuração existente e os limites do provedor."}
          </p>
        </div>
        <nav className="flex gap-2" aria-label="Modo de execução">
          <a
            href="/hot-profiles"
            aria-current={mode === "local" ? "page" : undefined}
            className={`rounded-md border px-3 py-2 text-sm ${mode === "local" ? "border-primary text-primary" : "border-border text-muted-foreground"}`}
          >
            Meu computador
          </a>
          <a
            href="/hot-profiles?mode=cloud"
            aria-current={mode === "cloud" ? "page" : undefined}
            className={`rounded-md border px-3 py-2 text-sm ${mode === "cloud" ? "border-primary text-primary" : "border-border text-muted-foreground"}`}
          >
            Nuvem
          </a>
        </nav>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        Os cadastros dos dois modos são separados. Alternar o painel não encerra sessões abertas.
      </p>
      {mode === "local" && (
        <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-border pt-4 text-xs">
          <a
            href={downloads.hotProfilesDesktop.url}
            className="rounded-md bg-primary px-4 py-2.5 font-semibold text-primary-foreground"
          >
            Baixar aplicativo Windows
          </a>
          <span className="text-muted-foreground">
            Janela própria, dados neste PC e sem instalar Node.js.
          </span>
          <a
            href={downloads.hotProfilesDesktop.release}
            target="_blank"
            rel="noreferrer"
            className="text-muted-foreground underline underline-offset-4"
          >
            Versão {downloads.hotProfilesDesktop.version}, instruções e integridade
          </a>
        </div>
      )}
    </section>
  );
}
