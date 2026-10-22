import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { Loader2, LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { AppShell } from "@/components/AppShell";
import { Input } from "@/components/ui/input";

export type Workspace = { id: string; name: string; timezone: string; owner_id: string };

const STORAGE_KEY = "postkit.workspace";

function AuthCard() {
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setMsg("");
    try {
      const res =
        mode === "in"
          ? await supabase.auth.signInWithPassword({ email: email.trim(), password })
          : await supabase.auth.signUp({
              email: email.trim(),
              password,
              options: { emailRedirectTo: `${window.location.origin}/automacao-instagram` },
            });
      if (res.error) {
        setMsg(res.error.message);
        return;
      }
      if (mode === "up" && !res.data.session)
        setMsg("Confira seu e-mail para confirmar o cadastro.");
    } catch {
      setMsg("Não foi possível conectar. Confira sua internet e tente novamente.");
    } finally {
      setBusy(false);
    }
  };
  const google = async () => {
    if (busy) return;
    setBusy(true);
    setMsg("");
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin + "/automacao-instagram",
      });
      if (result.error)
        setMsg("Não foi possível entrar com Google. Tente novamente ou use e-mail e senha.");
    } catch {
      setMsg("Não foi possível iniciar o acesso com Google.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto mt-8 max-w-sm rounded-lg border border-border bg-card p-6">
      <h2 className="font-display text-lg font-semibold">
        {mode === "in" ? "Entrar" : "Criar conta"}
      </h2>
      <p className="mt-1 text-xs text-muted-foreground">
        Acesse para salvar sua automação com segurança.
      </p>
      <form onSubmit={submit} className="mt-5 space-y-3">
        <label className="block text-xs" htmlFor="workspace-email">
          E-mail
        </label>
        <Input
          id="workspace-email"
          autoComplete="email"
          type="email"
          required
          placeholder="E-mail"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <label className="block text-xs" htmlFor="workspace-password">
          Senha
        </label>
        <Input
          id="workspace-password"
          autoComplete={mode === "in" ? "current-password" : "new-password"}
          type="password"
          required
          minLength={6}
          placeholder="Senha"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <Button type="submit" className="w-full" disabled={busy}>
          {busy && <Loader2 className="size-4 animate-spin" />}
          {mode === "in" ? "Entrar" : "Criar conta"}
        </Button>
      </form>
      <Button variant="outline" className="mt-3 w-full" disabled={busy} onClick={google}>
        Continuar com Google
      </Button>
      {msg && (
        <p role="status" className="mt-3 text-xs text-muted-foreground">
          {msg}
        </p>
      )}
      <button
        disabled={busy}
        className="mt-4 text-xs text-primary"
        onClick={() => setMode(mode === "in" ? "up" : "in")}
      >
        {mode === "in" ? "Não tem conta? Criar agora" : "Já tem conta? Entrar"}
      </button>
    </div>
  );
}

export function WorkspaceGate({ children }: { children: (ws: Workspace) => ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const [list, setList] = useState<Workspace[] | null>(null);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [err, setErr] = useState("");
  const [creating, setCreating] = useState(false);
  const [newWorkspace, setNewWorkspace] = useState(false);

  useEffect(() => {
    let active = true;
    const { data } = supabase.auth.onAuthStateChange((_event, value) => {
      if (active) setSession(value);
    });
    supabase.auth
      .getSession()
      .then(({ data: d, error }) => {
        if (!active) return;
        setSession(d.session);
        if (error) setErr("Não foi possível restaurar a sessão. Entre novamente.");
        setReady(true);
      })
      .catch(() => {
        if (active) {
          setErr("Não foi possível conectar ao serviço de contas.");
          setReady(true);
        }
      });
    try {
      setCurrentId(localStorage.getItem(STORAGE_KEY));
    } catch {
      /* Selection is optional. */
    }
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);
  const userId = session?.user.id;
  useEffect(() => {
    setList(null);
    if (!userId) return;
    let active = true;
    Promise.resolve(
      supabase.from("workspaces").select("id,name,timezone,owner_id").order("created_at"),
    )
      .then(({ data, error }) => {
        if (!active) return;
        if (error)
          setErr("Não foi possível carregar seus workspaces. Atualize a página e tente novamente.");
        setList(data ?? []);
      })
      .catch(() => {
        if (active) {
          setErr("Falha de conexão ao carregar os workspaces.");
          setList([]);
        }
      });
    return () => {
      active = false;
    };
  }, [userId]);

  const select = (id: string) => {
    try {
      localStorage.setItem(STORAGE_KEY, id);
    } catch {
      /* Keep selection in memory. */
    }
    setNewWorkspace(false);
    setCurrentId(id);
  };

  const create = async (event: FormEvent) => {
    event.preventDefault();
    if (creating) return;
    const title = name.trim();
    if (!title) {
      setErr("Dê um nome ao workspace.");
      return;
    }
    setCreating(true);
    setErr("");
    try {
      const { data, error } = await supabase
        .from("workspaces")
        .insert({ name: title })
        .select("id,name,timezone,owner_id")
        .single();
      if (error || !data) {
        setErr("Não foi possível criar o workspace. Confira o acesso e tente novamente.");
        return;
      }
      setList((current) => [...(current ?? []), data]);
      setName("");
      select(data.id);
    } catch {
      setErr("A conexão foi interrompida. Atualize a lista antes de tentar criar novamente.");
    } finally {
      setCreating(false);
    }
  };

  if (!ready)
    return (
      <AppShell>
        <Loader2 className="mx-auto my-20 size-5 animate-spin text-muted-foreground" />
      </AppShell>
    );
  if (!session)
    return (
      <AppShell>
        <AuthCard />
        {err && (
          <p role="alert" className="mx-auto mt-4 max-w-sm text-xs text-muted-foreground">
            {err}
          </p>
        )}
      </AppShell>
    );
  if (!list)
    return (
      <AppShell>
        <Loader2 className="mx-auto my-20 size-5 animate-spin text-muted-foreground" />
      </AppShell>
    );

  const current = newWorkspace
    ? undefined
    : (list.find((w) => w.id === currentId) ?? (list.length === 1 ? list[0] : undefined));

  const bar = (
    <div className="mt-5 flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card px-4 py-3 text-xs">
      <span className="text-muted-foreground">Workspace</span>
      <select
        className="rounded-md border border-border bg-background px-2 py-1"
        aria-label="Workspace atual"
        value={current?.id ?? ""}
        onChange={(e) =>
          e.target.value === "__new" ? setNewWorkspace(true) : select(e.target.value)
        }
      >
        {!current && <option value="">Selecione…</option>}
        {list.map((w) => (
          <option key={w.id} value={w.id}>
            {w.name}
          </option>
        ))}
        <option value="__new">+ Novo workspace</option>
      </select>
      <span className="ml-auto text-muted-foreground">{session.user.email}</span>
      <button
        aria-label="Sair"
        onClick={() =>
          void supabase.auth
            .signOut()
            .then(({ error }) => {
              if (error) setErr("Não foi possível sair. Tente novamente.");
            })
            .catch(() => setErr("Não foi possível sair. Confira sua conexão."))
        }
        className="text-muted-foreground hover:text-foreground"
      >
        <LogOut className="size-4" />
      </button>
    </div>
  );

  if (!current) {
    return (
      <AppShell>
        <div className="mx-auto max-w-7xl px-5 pb-10">
          {bar}
          <form
            onSubmit={create}
            className="mx-auto mt-8 max-w-sm rounded-lg border border-border bg-card p-6"
          >
            <h2 className="font-display text-lg font-semibold">Criar workspace</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Cada workspace tem suas próprias contas, vídeos e programações.
            </p>
            <Input
              className="mt-4"
              required
              maxLength={120}
              placeholder="Ex.: Minha operação"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <Button type="submit" disabled={creating || !name.trim()} className="mt-3 w-full">
              {creating ? "Criando…" : "Criar workspace"}
            </Button>
            {err && <p className="mt-3 text-xs text-destructive">{err}</p>}
          </form>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-7xl px-5">
        {bar}
        {err && (
          <p role="alert" className="mt-3 text-xs text-destructive">
            {err}
          </p>
        )}
      </div>
      {children(current)}
    </AppShell>
  );
}
