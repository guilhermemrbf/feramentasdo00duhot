import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell, PageIntro } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { telegramSyncAction } from "@/lib/api/telegram-sync.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/telegram-sync")({ component: TelegramSync });
type Connection = { id: string; name: string };
type Job = {
  id: string;
  source_title: string;
  destination_title: string;
  status: string;
  processed: number;
  error: string | null;
};
type Workspace = {
  connections: Connection[];
  jobs: Job[];
  logs: { id: number; event: string; created_at: string }[];
};
const empty: Workspace = { connections: [], jobs: [], logs: [] };
function TelegramSync() {
  const [workspace, setWorkspace] = useState<Workspace>(empty);
  const [signed, setSigned] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [email, setEmail] = useState(""),
    [password, setPassword] = useState("");
  const [session, setSession] = useState(""),
    [name, setName] = useState("Minha conta"),
    [connection, setConnection] = useState("");
  const [source, setSource] = useState(""),
    [destination, setDestination] = useState(""),
    [mode, setMode] = useState("history");
  const [rules, setRules] = useState([{ find: "", replacement: "" }]),
    [authorized, setAuthorized] = useState(false);
  const [sample, setSample] = useState(""),
    [preview, setPreview] = useState(""),
    [resolved, setResolved] = useState("");
  async function call(data: Record<string, unknown>) {
    const { data: auth } = await supabase.auth.getSession();
    if (!auth.session) throw new Error("Entre na sua conta para continuar.");
    return JSON.parse(
      await telegramSyncAction({
        data,
        headers: { Authorization: `Bearer ${auth.session.access_token}` },
      }),
    );
  }
  async function refresh() {
    setWorkspace(await call({ action: "workspace" }));
  }
  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((_event, value) => {
      setSigned(!!value);
      setWorkspace(empty);
    });
    void supabase.auth.getSession().then(({ data }) => setSigned(!!data.session));
    return () => data.subscription.unsubscribe();
  }, []);
  useEffect(() => {
    if (!signed) return;
    let active = true;
    const load = async () => {
      try {
        const value = await call({ action: "workspace" });
        if (active) setWorkspace(value);
      } catch (e) {
        if (active) setError((e as Error).message);
      }
    };
    void load();
    const timer = setInterval(() => void load(), 15000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [signed]);
  const config = {
    id: connection,
    source,
    destination,
    mode,
    rules: rules.filter((r) => r.find),
    authorized,
  };
  const panel = "space-y-4 rounded-2xl border border-border bg-card p-5";
  return (
    <AppShell>
      <main className="mx-auto max-w-6xl space-y-6 p-5 sm:p-8">
        <PageIntro
          eyebrow="AUTOMAÇÃO"
          title="Telegram Sync"
          description="Clone e sincronize canais e grupos do Telegram. Importe conteúdos autorizados, substitua links de divulgação e automatize novas publicações."
        />
        {error && (
          <p role="alert" className="rounded-xl border border-destructive p-4 text-destructive">
            {error}
          </p>
        )}
        {!signed ? (
          <form
            className={panel}
            onSubmit={(e) => {
              e.preventDefault();
              void run(async () => {
                const result = await supabase.auth.signInWithPassword({ email, password });
                if (result.error) throw result.error;
                setPassword("");
              });
            }}
          >
            <h2 className="text-xl font-semibold">Entrar na plataforma</h2>
            <Input
              aria-label="E-mail"
              type="email"
              placeholder="E-mail"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <Input
              aria-label="Senha"
              type="password"
              placeholder="Senha"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <Button disabled={busy}>Entrar</Button>
          </form>
        ) : (
          <>
            <div className="flex gap-3">
              <Button disabled={busy} onClick={() => void run(refresh)}>
                Atualizar painel
              </Button>
              <Button variant="outline" onClick={() => void supabase.auth.signOut()}>
                Sair
              </Button>
            </div>
            <div className="grid gap-6 lg:grid-cols-2">
              <form
                className={panel}
                onSubmit={(e) => {
                  e.preventDefault();
                  void run(async () => {
                    await call({ action: "connect", name, session });
                    setSession("");
                    await refresh();
                  });
                }}
              >
                <h2 className="text-xl font-semibold">1. Conectar conta Telegram</h2>
                <p className="text-sm text-muted-foreground">
                  Gere a sessão no seu computador com o utilitário session.py descrito na
                  documentação. Ela ficará criptografada no servidor.
                </p>
                <Input
                  aria-label="Nome da conexão"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Nome da conexão"
                  required
                />
                <Input
                  aria-label="Sessão secreta Telegram"
                  type="password"
                  autoComplete="off"
                  value={session}
                  onChange={(e) => setSession(e.target.value)}
                  placeholder="Sessão secreta Telegram"
                  required
                />
                <Button disabled={busy}>Validar e conectar</Button>
                {workspace.connections.map((c) => (
                  <div key={c.id} className="flex items-center justify-between gap-2">
                    <span>{c.name}</span>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={busy}
                      onClick={() =>
                        void run(async () => {
                          await call({ action: "disconnect", id: c.id });
                          await refresh();
                        })
                      }
                    >
                      Remover
                    </Button>
                  </div>
                ))}
              </form>
              <form
                className={panel}
                onSubmit={(e) => {
                  e.preventDefault();
                  void run(async () => {
                    await call({ ...config, action: "create" });
                    await refresh();
                  });
                }}
              >
                <h2 className="text-xl font-semibold">2. Configurar sincronização</h2>
                <label className="block text-sm">
                  Conta
                  <select
                    required
                    className="mt-2 w-full rounded border bg-background p-2"
                    value={connection}
                    onChange={(e) => setConnection(e.target.value)}
                  >
                    <option value="">Selecione uma conexão</option>
                    {workspace.connections.map((c) => (
                      <option value={c.id} key={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </label>
                <Input
                  aria-label="Origem"
                  placeholder="Origem: ID, @username ou https://t.me/canal"
                  value={source}
                  onChange={(e) => {
                    setSource(e.target.value);
                    setResolved("");
                  }}
                  required
                />
                <Input
                  aria-label="Destino"
                  placeholder="Destino: ID, @username ou link"
                  value={destination}
                  onChange={(e) => {
                    setDestination(e.target.value);
                    setResolved("");
                  }}
                  required
                />
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy || !connection}
                  onClick={() =>
                    void run(async () => {
                      const result = await call({ ...config, action: "resolve" });
                      setResolved(
                        `${result.source_title} (${result.source}) → ${result.destination_title} (${result.destination})`,
                      );
                    })
                  }
                >
                  Verificar canais e permissões
                </Button>
                {resolved && <p className="text-sm">{resolved}</p>}
                <label className="block text-sm">
                  Modo
                  <select
                    className="mt-2 w-full rounded border bg-background p-2"
                    value={mode}
                    onChange={(e) => setMode(e.target.value)}
                  >
                    <option value="history">Importar histórico</option>
                    <option value="continuous">Importar histórico e sincronizar novos posts</option>
                  </select>
                </label>
                <label className="flex gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={authorized}
                    onChange={(e) => setAuthorized(e.target.checked)}
                    required
                  />
                  Tenho autorização para republicar o conteúdo da origem.
                </label>
                <Button disabled={busy || !connection || !authorized}>Criar tarefa</Button>
              </form>
            </div>
            <section className={panel}>
              <h2 className="text-xl font-semibold">Regras de substituição</h2>
              <p className="text-sm text-muted-foreground">
                As regras abaixo serão salvas na próxima tarefa. Troque links, @usernames ou trechos
                de texto.
              </p>
              {rules.map((r, i) => (
                <div className="flex flex-wrap gap-2" key={i}>
                  <Input
                    className="flex-1"
                    aria-label={`Original ${i + 1}`}
                    placeholder="Texto ou link original"
                    value={r.find}
                    onChange={(e) =>
                      setRules(rules.map((v, j) => (j === i ? { ...v, find: e.target.value } : v)))
                    }
                  />
                  <Input
                    className="flex-1"
                    aria-label={`Substituição ${i + 1}`}
                    placeholder="Substituir por (vazio remove)"
                    value={r.replacement}
                    onChange={(e) =>
                      setRules(
                        rules.map((v, j) => (j === i ? { ...v, replacement: e.target.value } : v)),
                      )
                    }
                  />
                  <Button
                    variant="outline"
                    onClick={() => setRules(rules.filter((_, j) => j !== i))}
                  >
                    Remover
                  </Button>
                </div>
              ))}
              <Button
                variant="outline"
                disabled={rules.length >= 50}
                onClick={() => setRules([...rules, { find: "", replacement: "" }])}
              >
                Adicionar regra
              </Button>
              <Textarea
                aria-label="Legenda de exemplo"
                placeholder="Cole uma legenda para testar"
                value={sample}
                onChange={(e) => setSample(e.target.value)}
              />
              <Button
                disabled={busy}
                onClick={() =>
                  void run(async () =>
                    setPreview(
                      (await call({ action: "preview", text: sample, rules: config.rules })).text,
                    ),
                  )
                }
              >
                Pré-visualizar
              </Button>
              <p className="whitespace-pre-wrap">{preview}</p>
            </section>
            <section className={panel}>
              <h2 className="text-xl font-semibold">Tarefas e progresso</h2>
              {!workspace.jobs.length && (
                <p className="text-muted-foreground">Nenhuma tarefa criada.</p>
              )}
              {workspace.jobs.map((j) => (
                <article key={j.id} className="space-y-3 border-t py-4">
                  <h3 className="font-semibold">
                    {j.source_title} → {j.destination_title}
                  </h3>
                  <p>
                    {j.status} · {j.processed} mensagens
                  </p>
                  {j.error && (
                    <p role="alert" className="text-destructive">
                      {j.error}
                    </p>
                  )}
                  <div className="flex gap-2">
                    {(j.status === "running" ||
                      j.status === "paused" ||
                      j.status === "attention") && (
                      <>
                        <Button
                          disabled={busy || j.status === "attention"}
                          variant="outline"
                          onClick={() =>
                            void run(async () => {
                              await call({
                                action: j.status === "paused" ? "resume" : "pause",
                                id: j.id,
                              });
                              await refresh();
                            })
                          }
                        >
                          {j.status === "paused" ? "Retomar" : "Pausar"}
                        </Button>
                        <Button
                          disabled={busy}
                          variant="outline"
                          onClick={() =>
                            void run(async () => {
                              await call({ action: "cancel", id: j.id });
                              await refresh();
                            })
                          }
                        >
                          Cancelar
                        </Button>
                      </>
                    )}
                  </div>
                </article>
              ))}
            </section>
            <section className={panel}>
              <h2 className="text-xl font-semibold">Histórico de atividade</h2>
              {workspace.logs.map((l) => (
                <p className="text-sm" key={l.id}>
                  {new Date(l.created_at).toLocaleString("pt-BR")} · {l.event}
                </p>
              ))}
            </section>
          </>
        )}
      </main>
    </AppShell>
  );
}
