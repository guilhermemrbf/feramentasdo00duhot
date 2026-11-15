import { createFileRoute } from "@tanstack/react-router";
import { Instagram } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { AppShell, PageIntro } from "@/components/AppShell";
import { hotButton, hotInput, hotPrimary } from "@/components/hot-profiles/HotDialog";
import {
  bridgeRequest,
  pairComputer,
  HOT_CONNECTION_KEY,
  type HotConnection,
} from "@/lib/hot-profiles";

export const Route = createFileRoute("/criar-conta-instagram")({
  head: () => ({ meta: [{ title: "InstaStart — Cadastro Instagram | MauseHot" }] }),
  component: InstagramSignup,
});

type Status =
  | "starting"
  | "submitted"
  | "verification"
  | "manual"
  | "blocked"
  | "reported_created"
  | "cancelled"
  | "interrupted"
  | "failed";
type Entry = { id: string; username: string; status: Status; createdAt: string; updatedAt: string };
type State = { current: Entry | null; history: Entry[]; todayAttempts: number; dailyLimit: number };
const labels: Record<Status, string> = {
  starting: "Abrindo navegador",
  submitted: "Cadastro enviado · conclua no Instagram",
  verification: "Verificação necessária no Instagram",
  manual: "Continue na janela do Instagram",
  blocked: "Instagram interrompeu o cadastro",
  reported_created: "Criação confirmada por você",
  cancelled: "Cancelado",
  interrupted: "Janela fechada ou conector reiniciado",
  failed: "Não foi possível iniciar",
};

function InstagramSignup() {
  const [connection, setConnection] = useState<HotConnection | null>(null);
  const [state, setState] = useState<State | null>(null);
  const [online, setOnline] = useState(false);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  useEffect(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem(HOT_CONNECTION_KEY) || "null");
      if (saved?.token && saved?.url && saved?.computer) setConnection(saved);
    } catch {
      /* A new pairing remains available. */
    }
  }, []);
  useEffect(() => {
    if (!connection) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    async function refresh() {
      try {
        const value = await bridgeRequest<State>(
          connection!,
          "/v1/instagram-signups",
          undefined,
          "GET",
          AbortSignal.timeout(5000),
        );
        if (!stopped) {
          setState(value);
          setOnline(true);
        }
      } catch {
        if (!stopped) setOnline(false);
      }
      if (!stopped) timer = setTimeout(refresh, 2000);
    }
    void refresh();
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [connection]);
  async function connect(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const next = await pairComputer("http://127.0.0.1:47900", code);
      const value = await bridgeRequest<State>(next, "/v1/instagram-signups");
      sessionStorage.setItem(HOT_CONNECTION_KEY, JSON.stringify(next));
      setState(value);
      setConnection(next);
      setOnline(true);
      setCode("");
    } catch (reason) {
      setError(
        (reason as Error).message + " Se já conectou antes, baixe o conector atualizado abaixo.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function begin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!connection) return;
    const form = event.currentTarget;
    const fields = new FormData(form);
    let input: Record<string, string> | null = Object.fromEntries(
      ["fullName", "username", "contact", "password"].map((name) => [
        name,
        String(fields.get(name) || ""),
      ]),
    );
    setBusy(true);
    setError("");
    setConfirmed(false);
    try {
      const pending = bridgeRequest<State>(
        connection,
        "/v1/instagram-signups",
        input,
        "POST",
        AbortSignal.timeout(45000),
      );
      (form.elements.namedItem("password") as HTMLInputElement).value = "";
      input = null;
      setState(await pending);
    } catch (reason) {
      setError((reason as Error).message);
    } finally {
      input = null;
      setBusy(false);
    }
  }
  async function finish(status: "cancelled" | "reported_created") {
    if (!connection) return;
    setFinishing(true);
    setError("");
    try {
      setState(
        await bridgeRequest<State>(connection, "/v1/instagram-signups", { status }, "PATCH"),
      );
      setConfirmed(false);
    } catch (reason) {
      setError((reason as Error).message);
    } finally {
      setFinishing(false);
    }
  }
  const canBegin = online && !busy && !state?.current && (state?.todayAttempts ?? 0) < 10;
  return (
    <AppShell>
      <main className="mx-auto max-w-5xl space-y-6 p-5 sm:p-8">
        <PageIntro
          eyebrow="CADASTRO INSTAGRAM"
          title="InstaStart"
          description="Preencha os dados uma vez. O MauseHot abre o Instagram e envia o formulário quando reconhecer a tela de cadastro."
        />
        <section
          className="rounded-2xl border border-border bg-card p-5"
          aria-labelledby="connection-heading"
        >
          <h2 id="connection-heading" className="text-lg font-semibold">
            1. Conecte este computador
          </h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Extraia o conector atualizado e abra “Iniciar Hot Profiles.cmd”. Requer Node.js 22+ e
            Chrome ou Edge. Mantenha a janela do conector aberta.
          </p>
          <a className={`${hotButton} my-3`} href="/hot-profiles-connector.zip" download>
            Baixar conector atualizado
          </a>
          {connection && (
            <p role="status" className="mb-3 text-sm">
              {online
                ? `Conectado a ${connection.computer}`
                : "Conector indisponível ou desatualizado. Abra a nova versão e conecte novamente."}
            </p>
          )}
          {(!connection || !online) && (
            <form onSubmit={connect} className="flex flex-wrap items-end gap-3">
              <label className="space-y-2 text-sm">
                <span className="block">Código de conexão</span>
                <input
                  className={hotInput}
                  aria-label="Código de conexão"
                  value={code}
                  onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  required
                  placeholder="000000"
                />
              </label>
              <button className={hotPrimary} disabled={busy}>
                Conectar
              </button>
            </form>
          )}
        </section>
        {error && (
          <p
            role="alert"
            className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm"
          >
            {error}
          </p>
        )}
        <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
          <section
            className="rounded-2xl border border-border bg-card p-5"
            aria-labelledby="signup-heading"
          >
            <h2 id="signup-heading" className="flex items-center gap-2 text-lg font-semibold">
              <Instagram className="size-5" aria-hidden />
              2. Dados da nova conta
            </h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Use um e-mail ou telefone que você controla. Data de nascimento, códigos e
              verificações são concluídos na janela do Instagram.
            </p>
            <form className="mt-5 space-y-4" onSubmit={begin} autoComplete="off">
              <fieldset disabled={!canBegin} className="space-y-4 disabled:opacity-60">
                <label className="block space-y-2 text-sm">
                  <span>Nome completo</span>
                  <input
                    name="fullName"
                    className={hotInput}
                    required
                    maxLength={100}
                    autoComplete="name"
                  />
                </label>
                <label className="block space-y-2 text-sm">
                  <span>Nome de usuário</span>
                  <input
                    name="username"
                    className={hotInput}
                    required
                    pattern="[a-zA-Z0-9_][a-zA-Z0-9_.]{0,29}"
                    maxLength={30}
                    placeholder="seu.usuario"
                    autoComplete="off"
                    autoCapitalize="none"
                  />
                </label>
                <label className="block space-y-2 text-sm">
                  <span>E-mail ou telefone com +código do país</span>
                  <input
                    name="contact"
                    className={hotInput}
                    required
                    maxLength={254}
                    placeholder="voce@exemplo.com ou +5511999999999"
                  />
                </label>
                <label className="block space-y-2 text-sm">
                  <span>Senha</span>
                  <input
                    name="password"
                    type="password"
                    className={hotInput}
                    required
                    minLength={8}
                    maxLength={128}
                    autoComplete="new-password"
                  />
                  <span className="block text-xs text-muted-foreground">
                    Guarde a senha no seu gerenciador. Ela não fica no histórico do MauseHot.
                  </span>
                </label>
                <button className={`${hotPrimary} w-full`} type="submit">
                  {busy ? "Abrindo cadastro…" : "Abrir Instagram e enviar cadastro"}
                </button>
              </fieldset>
            </form>
          </section>
          <section
            className="rounded-2xl border border-border bg-card p-5"
            aria-labelledby="progress-heading"
          >
            <h2 id="progress-heading" className="text-lg font-semibold">
              3. Acompanhe a conclusão
            </h2>
            <p className="mt-3 text-3xl font-semibold">
              {state?.todayAttempts ?? 0}
              <span className="text-base text-muted-foreground"> / 10 tentativas hoje</span>
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Horário de Brasília. Limite local; não garante contas aceitas pelo Instagram.
            </p>
            {state?.current ? (
              <div className="mt-5 space-y-4" aria-live="polite">
                <p className="font-semibold">@{state.current.username}</p>
                <p role="status">{labels[state.current.status]}</p>
                <p className="text-sm leading-6 text-muted-foreground">
                  Continue na janela aberta. Se a tela não for reconhecida, preencha diretamente no
                  Instagram. O envio do formulário não confirma que a conta foi criada.
                </p>
                <label className="flex items-start gap-2 text-sm">
                  <input
                    className="mt-1"
                    type="checkbox"
                    checked={confirmed}
                    onChange={(event) => setConfirmed(event.target.checked)}
                  />
                  Concluí o cadastro e conferi que entrei na nova conta.
                </label>
                <button
                  className={`${hotPrimary} w-full`}
                  disabled={
                    !online ||
                    finishing ||
                    !confirmed ||
                    ["starting", "blocked"].includes(state.current.status)
                  }
                  onClick={() => void finish("reported_created")}
                >
                  Registrar minha confirmação e fechar
                </button>
                <button
                  className={`${hotButton} w-full`}
                  disabled={!online || finishing}
                  onClick={() => void finish("cancelled")}
                >
                  Cancelar e fechar navegador
                </button>
              </div>
            ) : (
              <p className="mt-6 text-sm leading-6 text-muted-foreground">
                Nenhum cadastro aberto. O navegador será exibido neste computador quando você
                iniciar.
              </p>
            )}
          </section>
        </div>
        <section
          className="rounded-2xl border border-border bg-card p-5"
          aria-labelledby="history-heading"
        >
          <h2 id="history-heading" className="text-lg font-semibold">
            Histórico neste computador
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Resultados informados por você; sem senhas, contatos ou códigos. Fechar a janela antes
            de registrar o resultado deixa a tentativa como interrompida.
          </p>
          {state?.history.length ? (
            <ul className="mt-4 divide-y divide-border">
              {state.history.slice(0, 30).map((entry) => (
                <li key={entry.id} className="flex flex-wrap justify-between gap-2 py-3 text-sm">
                  <span className="font-medium">@{entry.username}</span>
                  <span>{labels[entry.status]}</span>
                  <time className="text-muted-foreground" dateTime={entry.createdAt}>
                    {new Date(entry.createdAt).toLocaleString("pt-BR", {
                      timeZone: "America/Sao_Paulo",
                    })}
                  </time>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 text-sm text-muted-foreground">
              As tentativas aparecerão aqui após conectar o computador.
            </p>
          )}
        </section>
      </main>
    </AppShell>
  );
}
