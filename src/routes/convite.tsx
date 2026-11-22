import { ArrowRight, Clock3 } from "lucide-react";
import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { AccessForm } from "@/components/access/AccessForm";
import { AccessStatusPanel } from "@/components/access/AccessStatusPanel";
import { PublicBrand } from "@/components/access/LaunchPage";
import { usePlatformAccess } from "@/components/access/PlatformAccessProvider";
import { inviteFromHash } from "@/lib/platform-access";
import { platformRpc, rpcData } from "@/lib/platform-access-client";

export const Route = createFileRoute("/convite")({
  head: () => ({
    meta: [
      { title: "Seu convite | MouseHot" },
      { name: "robots", content: "noindex, nofollow" },
      { name: "referrer", content: "no-referrer" },
    ],
  }),
  component: InvitePage,
});

const storageKey = "mousehot:trial-invitation";

function InvitePage() {
  const [token, setToken] = useState<string | null | undefined>();
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState("");
  const access = usePlatformAccess();
  const navigate = useNavigate();

  useEffect(() => {
    const hashToken = inviteFromHash(window.location.hash);
    try {
      if (hashToken) window.localStorage.setItem(storageKey, hashToken);
      const previous = window.localStorage.getItem(storageKey);
      setToken(hashToken ?? (previous ? inviteFromHash("#" + previous) : null));
    } catch {
      setToken(hashToken);
    }
    if (hashToken)
      window.history.replaceState(
        window.history.state,
        "",
        window.location.pathname + window.location.search,
      );
  }, []);

  useEffect(() => {
    if (!access.isError && ["admin", "approved", "trial"].includes(access.status ?? "")) {
      void navigate({ to: "/painel", replace: true });
    }
  }, [access.status, access.isError, navigate]);

  async function startTrial() {
    if (!token) return;
    setStarting(true);
    setError("");
    try {
      const result = await rpcData(platformRpc.rpc("platform_start_trial", { p_token: token }));
      if (result?.status !== "trial") throw new Error("O teste não pôde ser iniciado.");
      try {
        window.localStorage.removeItem(storageKey);
      } catch {
        /* Access is persisted in the database. */
      }
      await access.refresh();
      await navigate({ to: "/painel", replace: true });
    } catch {
      setError(
        "Confira se você entrou com o e-mail do convite. Ele pode ter expirado ou já ter sido usado.",
      );
    } finally {
      setStarting(false);
    }
  }

  return (
    <div className="launch-site invite-site">
      <header className="launch-top launch-wrap">
        <PublicBrand />
      </header>
      <main className="launch-access launch-wrap">
        <div>
          <h1>
            Seu teste na MouseHot<span>.</span>
          </h1>
          <p>
            Você tem 15 minutos para experimentar as ferramentas de preparação de conteúdo. O tempo
            começa quando você inicia o teste. Use o e-mail do convite para criar sua conta ou
            entrar.
          </p>
        </div>
        {token === undefined || access.isLoading ? (
          <p role="status">Verificando convite…</p>
        ) : !token ? (
          <div className="access-form-panel">
            <h2>Abra o link do seu convite</h2>
            <p>Use o endereço que recebeu do administrador para habilitar o teste.</p>
            <Link to="/" className="saas-button saas-button-outline">
              Voltar à página inicial
            </Link>
          </div>
        ) : !access.user ? (
          <AccessForm invitation />
        ) : access.isError || !["pending", "expired"].includes(access.status ?? "") ? (
          <AccessStatusPanel />
        ) : (
          <div className="access-form-panel">
            <Clock3 className="size-6" aria-hidden />
            <h2>Pronto para começar?</h2>
            <p>
              Conta confirmada <strong>{access.user.email}</strong>
            </p>
            <button
              className="saas-button saas-button-primary"
              disabled={starting}
              onClick={() => void startTrial()}
            >
              {starting ? "Iniciando…" : "Iniciar meus 15 minutos"}{" "}
              <ArrowRight size={17} aria-hidden />
            </button>
            {error && (
              <p role="alert" className="access-message">
                {error}
              </p>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
