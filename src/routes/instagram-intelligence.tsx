import { ScanSearch } from "lucide-react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import type { Session } from "@supabase/supabase-js";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  IntelligenceResults,
  ScoringModel,
} from "@/components/instagram-intelligence/IntelligenceResults";
import { IntelligenceBatch } from "@/components/instagram-intelligence/IntelligenceBatch";
import { Button } from "@/components/ui/button";
import { lovable } from "@/integrations/lovable";
import { supabase } from "@/integrations/supabase/client";
import {
  analyzeIntelligenceBatch,
  getIntelligenceBatches,
} from "@/lib/instagram-intelligence-data";
import {
  IMPORT_LIMIT,
  PROFILE_LIMIT,
  parseInstagramProfiles,
} from "@/lib/instagram-intelligence-import";
import { recordTool } from "@/lib/tool-preferences";
import { getPostkitSession } from "@/lib/postkit-access";

export const Route = createFileRoute("/instagram-intelligence")({
  head: () => ({ meta: [{ title: "Instagram Intelligence — MauseHot" }] }),
  validateSearch: (search: Record<string, unknown>) => ({
    modo: search.modo === "revisao" ? ("revisao" as const) : undefined,
  }),
  component: InstagramIntelligence,
});

function InstagramIntelligence() {
  const { modo } = Route.useSearch();
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [error, setError] = useState("");
  const [signingIn, setSigningIn] = useState(false);

  useEffect(() => {
    recordTool("intelligence");
  }, []);

  useEffect(() => {
    let disposed = false;
    let updated = false;
    const access = (next: Session | null) => {
      if (!disposed) setSession(next?.user.is_anonymous ? null : next);
    };
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, next) => {
      if (event === "INITIAL_SESSION") return;
      updated = true;
      access(next);
    });
    void getPostkitSession(supabase.auth).then(
      (next) => {
        if (!updated) access(next);
      },
      () => {
        if (disposed || updated) return;
        setError("Não foi possível recuperar o acesso deste navegador.");
        setSession(null);
      },
    );
    return () => {
      disposed = true;
      subscription.unsubscribe();
    };
  }, []);

  async function signIn() {
    setSigningIn(true);
    setError("");
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri:
          window.location.origin + "/instagram-intelligence" + (modo ? "?modo=revisao" : ""),
      });
      if (result.error) throw result.error;
    } catch {
      setError("Não foi possível entrar com Google. Tente novamente.");
    } finally {
      setSigningIn(false);
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <main className="mx-auto max-w-[1000px] space-y-6 px-4 py-6 sm:px-5">
        <h1 className="flex items-center gap-3 text-2xl font-semibold">
          <span
            className="tool-tone tool-icon grid size-12 shrink-0 place-items-center"
            aria-hidden
          >
            <ScanSearch className="size-6" />
          </span>
          Instagram Intelligence
        </h1>
        {session === undefined ? (
          <p role="status">Verificando acesso…</p>
        ) : session ? (
          <PrivateBatches
            key={session.user.id}
            userId={session.user.id}
            reviewMode={modo === "revisao"}
          />
        ) : (
          <section className="space-y-3 rounded-xl border border-border bg-card p-5">
            <h2 className="text-lg font-semibold">Entre para acessar seus lotes</h2>
            <p className="text-sm text-muted-foreground">Use a mesma conta Google do MauseHot.</p>
            <Button onClick={() => void signIn()} disabled={signingIn}>
              Continuar com Google
            </Button>
            {error && <p role="alert">{error}</p>}
          </section>
        )}
        <ScoringModel />
      </main>
    </div>
  );
}

function PrivateBatches({ userId, reviewMode }: { userId: string; reviewMode: boolean }) {
  const [text, setText] = useState("");
  const [submitted, setSubmitted] = useState<{ id: string; count: number; name: string }>();
  const [error, setError] = useState("");
  const saving = useRef(false);
  const [busy, setBusy] = useState(false);
  const parsed = useMemo(() => parseInstagramProfiles(text), [text]);
  const latest = useQuery({
    queryKey: ["intelligence-latest-batch", userId],
    queryFn: async ({ signal }) => (await getIntelligenceBatches(0, signal)).items[0] ?? null,
    gcTime: 0,
  });
  const current =
    submitted ??
    (latest.data
      ? { id: latest.data.id, count: latest.data.profile_count, name: latest.data.name }
      : undefined);

  async function analyze() {
    if (saving.current || !parsed.usernames.length || parsed.invalidLines.length || parsed.error)
      return;
    saving.current = true;
    setBusy(true);
    setError("");
    try {
      const { id, name } = await analyzeIntelligenceBatch(parsed.usernames);
      setSubmitted({ id, name, count: parsed.usernames.length });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível iniciar a análise.");
    } finally {
      saving.current = false;
      setBusy(false);
    }
  }

  return (
    <>
      <form
        className="space-y-3 rounded-[10px] border border-border bg-card p-[15px]"
        onSubmit={(event) => {
          event.preventDefault();
          void analyze();
        }}
      >
        <h2 id="intelligence-input-title" className="text-xl font-semibold">
          Cole os links dos perfis
        </h2>
        <textarea
          className="block w-full resize-y rounded-md border border-input bg-background px-3 py-3 text-base text-foreground placeholder:text-muted-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          aria-labelledby="intelligence-input-title"
          aria-describedby="intelligence-import-help"
          rows={4}
          value={text}
          maxLength={IMPORT_LIMIT + 1}
          disabled={busy}
          spellCheck={false}
          autoCapitalize="none"
          placeholder={"https://instagram.com/perfil1/\n@perfil2"}
          onChange={(event) => setText(event.target.value)}
        />
        <div id="intelligence-import-help" className="space-y-1 text-sm text-neutral-300">
          <p>Um perfil por linha. Até 1.000 perfis por análise. Use links ou @usuários.</p>
          {parsed.error === "size" && <p role="alert">A lista é longa demais.</p>}
          {parsed.error === "limit" && (
            <p role="alert">Limite de {PROFILE_LIMIT.toLocaleString("pt-BR")} perfis distintos.</p>
          )}
          {parsed.invalidLines.length > 0 && (
            <p role="alert">
              Corrija as linhas {parsed.invalidLines.slice(0, 12).join(", ")}
              {parsed.invalidLines.length > 12 ? " e outras." : "."}
            </p>
          )}
          {parsed.duplicateCount > 0 && (
            <p>
              {parsed.duplicateCount}{" "}
              {parsed.duplicateCount === 1 ? "duplicidade removida" : "duplicidades removidas"}.
            </p>
          )}
        </div>
        <Button
          type="submit"
          className="h-16 w-full rounded-[10px] bg-primary text-xl font-semibold text-primary-foreground hover:bg-primary/90 focus-visible:ring-ring"
          disabled={
            busy || !parsed.usernames.length || !!parsed.error || !!parsed.invalidLines.length
          }
        >
          {busy ? "INICIANDO…" : "ANALISAR"}
        </Button>
        {error && <p role="alert">{error}</p>}
      </form>
      {!current && latest.isError && <p role="alert">{latest.error.message}</p>}
      {reviewMode && current ? (
        <IntelligenceBatch key={current.id} userId={userId} batch={current} />
      ) : (
        <IntelligenceResults key={current?.id ?? "empty"} userId={userId} batch={current} />
      )}
    </>
  );
}
