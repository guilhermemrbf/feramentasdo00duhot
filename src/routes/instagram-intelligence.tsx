import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import type { Session } from "@supabase/supabase-js";
import { useEffect, useMemo, useRef, useState } from "react";
import { AppShell, PageIntro } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { lovable } from "@/integrations/lovable";
import { supabase } from "@/integrations/supabase/client";
import {
  createIntelligenceBatch,
  getIntelligenceBatches,
  getIntelligenceProfiles,
} from "@/lib/instagram-intelligence-data";
import {
  IMPORT_LIMIT,
  PROFILE_LIMIT,
  parseInstagramProfiles,
} from "@/lib/instagram-intelligence-import";
import { getPostkitSession } from "@/lib/postkit-access";

export const Route = createFileRoute("/instagram-intelligence")({
  head: () => ({ meta: [{ title: "Instagram Intelligence — MauseHot" }] }),
  component: InstagramIntelligence,
});

function InstagramIntelligence() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [error, setError] = useState("");
  const [signingIn, setSigningIn] = useState(false);

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
        redirect_uri: window.location.origin + "/instagram-intelligence",
      });
      if (result.error) throw result.error;
    } catch {
      setError("Não foi possível entrar com Google. Tente novamente.");
    } finally {
      setSigningIn(false);
    }
  }

  return (
    <AppShell>
      <main className="mx-auto max-w-5xl space-y-6 p-5 sm:p-8">
        <PageIntro
          eyebrow="LOTES PRIVADOS"
          title="Instagram Intelligence"
          description="Organize até 1.000 perfis por lote. Nesta etapa você cadastra os perfis para análise futura."
        />
        {session === undefined ? (
          <p role="status">Verificando acesso…</p>
        ) : session ? (
          <PrivateBatches key={session.user.id} userId={session.user.id} />
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
      </main>
    </AppShell>
  );
}

const dateLabel = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeZone: "America/Sao_Paulo",
});
const inputClass = "w-full rounded-md border border-input bg-background px-3 py-2 text-sm";

function PrivateBatches({ userId }: { userId: string }) {
  const [name, setName] = useState("");
  const [text, setText] = useState("");
  const [batchPage, setBatchPage] = useState(0);
  const [profilePage, setProfilePage] = useState(0);
  const [batch, setBatch] = useState<{ id: string; name: string }>();
  const [feedback, setFeedback] = useState<{ message: string; error?: boolean }>();
  const saving = useRef(false);
  const [busy, setBusy] = useState(false);
  const parsed = useMemo(() => parseInstagramProfiles(text), [text]);
  const batches = useQuery({
    queryKey: ["intelligence-batches", userId, batchPage],
    queryFn: ({ signal }) => getIntelligenceBatches(batchPage, signal),
    gcTime: 0,
    retry: false,
  });

  async function save() {
    if (
      saving.current ||
      !name.trim() ||
      !parsed.usernames.length ||
      parsed.invalidLines.length ||
      parsed.error
    )
      return;
    saving.current = true;
    setBusy(true);
    setFeedback(undefined);
    try {
      const id = await createIntelligenceBatch(name.trim(), parsed.usernames);
      setBatch({ id, name: name.trim() });
      setProfilePage(0);
      if (batchPage === 0) void batches.refetch();
      else setBatchPage(0);
      setName("");
      setText("");
      setFeedback({ message: `Lote salvo com ${parsed.usernames.length} perfil(is).` });
    } catch (error) {
      setFeedback({
        message: error instanceof Error ? error.message : "Não foi possível salvar.",
        error: true,
      });
    } finally {
      saving.current = false;
      setBusy(false);
    }
  }

  return (
    <>
      <form
        className="space-y-4 rounded-xl border border-border bg-card p-5"
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
      >
        <h2 className="text-lg font-semibold">Novo lote</h2>
        <label className="block space-y-1 text-sm">
          <span>Nome do lote</span>
          <input
            className={inputClass}
            value={name}
            maxLength={80}
            disabled={busy}
            required
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <label className="block space-y-1 text-sm">
          <span>Links de perfil ou @usuários</span>
          <textarea
            className={inputClass}
            rows={7}
            value={text}
            maxLength={IMPORT_LIMIT + 1}
            disabled={busy}
            placeholder="@perfil1 ou https://www.instagram.com/perfil1/"
            aria-describedby="intelligence-import-help"
            onChange={(e) => setText(e.target.value)}
          />
        </label>
        <div id="intelligence-import-help" className="space-y-1 text-sm text-muted-foreground">
          <p>Separe por linha, vírgula ou ponto e vírgula. Limite de 1.000 perfis distintos.</p>
          {parsed.error === "size" && (
            <p role="alert">A lista é longa demais. Divida a entrada em lotes menores.</p>
          )}
          {parsed.error === "limit" && (
            <p role="alert">
              A lista passa do limite de {PROFILE_LIMIT.toLocaleString("pt-BR")} perfis distintos.
            </p>
          )}
          {parsed.invalidLines.length > 0 && (
            <p role="alert">
              Corrija as linhas {parsed.invalidLines.slice(0, 12).join(", ")}
              {parsed.invalidLines.length > 12 ? " e outras." : "."}
            </p>
          )}
          {!parsed.error && parsed.usernames.length > 0 && (
            <p>
              {parsed.usernames.length} perfil(is) para cadastrar · {parsed.duplicateCount}{" "}
              repetição(ões) removida(s). Prévia:{" "}
              {parsed.usernames
                .slice(0, 5)
                .map((value) => "@" + value)
                .join(", ")}
              {parsed.usernames.length > 5 ? "…" : ""}
            </p>
          )}
        </div>
        <Button
          type="submit"
          disabled={
            busy ||
            !name.trim() ||
            !parsed.usernames.length ||
            !!parsed.error ||
            !!parsed.invalidLines.length
          }
        >
          {busy ? "Salvando…" : "Salvar lote"}
        </Button>
        {feedback && <p role={feedback.error ? "alert" : "status"}>{feedback.message}</p>}
      </form>

      <section className="space-y-3 rounded-xl border border-border bg-card p-5">
        <h2 className="text-lg font-semibold">Meus lotes</h2>
        {batches.isPending && <p role="status">Carregando lotes…</p>}
        {batches.isError && (
          <QueryError error={batches.error} retry={() => void batches.refetch()} />
        )}
        {batches.data?.items.length === 0 && (
          <p className="text-sm text-muted-foreground">Nenhum lote nesta página.</p>
        )}
        <ul className="space-y-2">
          {batches.data?.items.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                className="w-full rounded-lg border border-border p-3 text-left text-sm hover:bg-accent aria-pressed:border-primary"
                aria-pressed={item.id === batch?.id}
                onClick={() => {
                  setBatch(item);
                  setProfilePage(0);
                }}
              >
                <span className="block break-words font-semibold">{item.name}</span>
                <span className="text-muted-foreground">
                  {item.profile_count} perfil(is) · {dateLabel.format(new Date(item.created_at))}
                </span>
              </button>
            </li>
          ))}
        </ul>
        <Pagination
          label="lotes"
          page={batchPage}
          hasMore={!!batches.data?.hasMore}
          select={setBatchPage}
        />
      </section>

      {batch && (
        <BatchProfiles userId={userId} batch={batch} page={profilePage} select={setProfilePage} />
      )}
    </>
  );
}

function BatchProfiles({
  userId,
  batch,
  page,
  select,
}: {
  userId: string;
  batch: { id: string; name: string };
  page: number;
  select: (page: number) => void;
}) {
  const profiles = useQuery({
    queryKey: ["intelligence-profiles", userId, batch.id, page],
    queryFn: ({ signal }) => getIntelligenceProfiles(batch.id, page, signal),
    gcTime: 0,
    retry: false,
  });
  return (
    <section className="space-y-3 rounded-xl border border-border bg-card p-5">
      <h2 className="break-words text-lg font-semibold">Perfis de {batch.name}</h2>
      <p className="text-sm text-muted-foreground">
        Cadastro concluído. Ainda sem coleta ou análise.
      </p>
      {profiles.isPending && <p role="status">Carregando perfis…</p>}
      {profiles.isError && (
        <QueryError error={profiles.error} retry={() => void profiles.refetch()} />
      )}
      <ol className="grid gap-2 text-sm sm:grid-cols-2">
        {profiles.data?.items.map(({ position, username }) => (
          <li key={position} className="flex items-center gap-2">
            <span className="text-muted-foreground">{position}.</span>
            <a
              href={`https://www.instagram.com/${username}/`}
              className="break-all text-primary underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              @{username}
            </a>
          </li>
        ))}
      </ol>
      <Pagination label="perfis" page={page} hasMore={!!profiles.data?.hasMore} select={select} />
    </section>
  );
}

function Pagination({
  label,
  page,
  hasMore,
  select,
}: {
  label: string;
  page: number;
  hasMore: boolean;
  select: (page: number) => void;
}) {
  if (!page && !hasMore) return null;
  return (
    <nav className="flex flex-wrap items-center gap-2" aria-label={`Paginação de ${label}`}>
      <Button variant="outline" disabled={!page} onClick={() => select(page - 1)}>
        Anterior
      </Button>
      <span className="text-sm">Página {page + 1}</span>
      <Button variant="outline" disabled={!hasMore} onClick={() => select(page + 1)}>
        Próxima
      </Button>
    </nav>
  );
}

function QueryError({ error, retry }: { error: Error; retry: () => void }) {
  return (
    <div className="space-y-2">
      <p role="alert">{error.message}</p>
      <Button variant="outline" onClick={retry}>
        Tentar novamente
      </Button>
    </div>
  );
}
