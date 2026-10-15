import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { Loader2, LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export type Workspace = { id: string; name: string; timezone: string; owner_id: string };

const STORAGE_KEY = "postkit.workspace";

function AuthCard() {
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMsg("");
    const res =
      mode === "in"
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({
            email,
            password,
            options: { emailRedirectTo: `${window.location.origin}/automacao-instagram` },
          });
    setBusy(false);
    if (res.error) return setMsg(res.error.message);
    if (mode === "up" && !res.data.session) setMsg("Enviamos um link de confirmação para o seu e-mail.");
  };

  const google = async () => {
    const r = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin + "/automacao-instagram" });
    if (r.error) setMsg("Não foi possível entrar com Google.");
  };

  return (
    <div className="mx-auto mt-8 max-w-sm rounded-lg border border-border bg-card p-6">
      <h2 className="font-display text-lg font-semibold">{mode === "in" ? "Entrar" : "Criar conta"}</h2>
      <p className="mt-1 text-xs text-muted-foreground">Acesse para salvar sua automação com segurança.</p>
      <form onSubmit={submit} className="mt-5 space-y-3">
        <Input type="email" required placeholder="E-mail" value={email} onChange={(e) => setEmail(e.target.value)} />
        <Input type="password" required minLength={6} placeholder="Senha" value={password} onChange={(e) => setPassword(e.target.value)} />
        <Button type="submit" className="w-full" disabled={busy}>
          {busy && <Loader2 className="size-4 animate-spin" />}
          {mode === "in" ? "Entrar" : "Criar conta"}
        </Button>
      </form>
      <Button variant="outline" className="mt-3 w-full" onClick={google}>Continuar com Google</Button>
      {msg && <p className="mt-3 text-xs text-muted-foreground">{msg}</p>}
      <button className="mt-4 text-xs text-primary" onClick={() => setMode(mode === "in" ? "up" : "in")}>
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

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    supabase.auth.getSession().then(({ data: d }) => {
      setSession(d.session);
      setReady(true);
    });
    setCurrentId(localStorage.getItem(STORAGE_KEY));
    return () => data.subscription.unsubscribe();
  }, []);

  const userId = session?.user.id;
  useEffect(() => {
    if (!userId) return setList(null);
    supabase
      .from("workspaces")
      .select("id,name,timezone,owner_id")
      .order("created_at")
      .then(({ data, error }) => {
        if (error) setErr(error.message);
        setList(data ?? []);
      });
  }, [userId]);

  const select = (id: string) => {
    localStorage.setItem(STORAGE_KEY, id);
    setCurrentId(id);
  };

  const create = async (e: FormEvent) => {
    e.preventDefault();
    setErr("");
    const { data, error } = await supabase
      .from("workspaces")
      .insert({ name: name.trim() })
      .select("id,name,timezone,owner_id")
      .single();
    if (error) return setErr(error.message);
    setList((l) => [...(l ?? []), data]);
    setName("");
    select(data.id);
  };

  if (!ready) return <Loader2 className="mx-auto mt-10 size-5 animate-spin text-muted-foreground" />;
  if (!session) return <AuthCard />;
  if (!list) return <Loader2 className="mx-auto mt-10 size-5 animate-spin text-muted-foreground" />;

  const current = list.find((w) => w.id === currentId) ?? (list.length === 1 ? list[0] : undefined);

  const bar = (
    <div className="mt-5 flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card px-4 py-3 text-xs">
      <span className="text-muted-foreground">Workspace</span>
      <select
        className="rounded-md border border-border bg-background px-2 py-1"
        value={current?.id ?? ""}
        onChange={(e) => (e.target.value === "__new" ? setCurrentId(null) : select(e.target.value))}
      >
        {!current && <option value="">Selecione…</option>}
        {list.map((w) => (
          <option key={w.id} value={w.id}>{w.name}</option>
        ))}
        <option value="__new">+ Novo workspace</option>
      </select>
      <span className="ml-auto text-muted-foreground">{session.user.email}</span>
      <button aria-label="Sair" onClick={() => supabase.auth.signOut()} className="text-muted-foreground hover:text-foreground">
        <LogOut className="size-4" />
      </button>
    </div>
  );

  if (!current) {
    return (
      <>
        {bar}
        <form onSubmit={create} className="mx-auto mt-8 max-w-sm rounded-lg border border-border bg-card p-6">
          <h2 className="font-display text-lg font-semibold">Criar workspace</h2>
          <p className="mt-1 text-xs text-muted-foreground">Cada workspace tem suas próprias contas, vídeos e programações.</p>
          <Input className="mt-4" required maxLength={120} placeholder="Ex.: Minha operação" value={name} onChange={(e) => setName(e.target.value)} />
          <Button type="submit" className="mt-3 w-full">Criar</Button>
          {err && <p className="mt-3 text-xs text-destructive">{err}</p>}
        </form>
      </>
    );
  }

  return (
    <>
      {bar}
      {children(current)}
    </>
  );
}
