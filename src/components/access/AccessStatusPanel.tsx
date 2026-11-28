import { ArrowLeft, Clock3, LoaderCircle, LogOut, ShieldCheck, ShieldX } from "lucide-react";
import { Link, useRouterState } from "@tanstack/react-router";
import { type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { isPublicRoute } from "@/lib/platform-access";
import { usePlatformAccess } from "./PlatformAccessProvider";

export function AccessStatusPanel() {
  const { user, status, isLoading, isError, refresh } = usePlatformAccess();
  if (isLoading)
    return (
      <p className="access-message" role="status">
        <LoaderCircle className="size-4 animate-spin" aria-hidden /> Verificando acesso…
      </p>
    );

  const approved = ["admin", "approved", "trial"].includes(status ?? "") && !isError;
  const title = isError
    ? "Acesso indisponível"
    : approved
      ? "Acesso liberado"
      : status === "expired"
        ? "Seu teste terminou"
        : status === "denied"
          ? "Explore o Mousefy"
          : status === "unverified"
            ? "Confirme seu e-mail"
            : "Explore o Mousefy";

  const detail = isError
    ? "Não foi possível verificar sua permissão agora. Tente novamente."
    : approved
      ? "Seu espaço de trabalho está pronto."
      : status === "expired"
        ? "Você pode continuar navegando. Escolha um plano para executar ferramentas."
        : status === "denied"
          ? "Escolha um plano para executar ferramentas e conectar contas."
          : status === "unverified"
            ? "Abra a mensagem de confirmação que enviamos ao seu endereço."
            : "Escolha um plano para executar ferramentas e conectar contas.";

  const Icon = approved ? ShieldCheck : status === "denied" ? ShieldX : Clock3;

  return (
    <div className="access-form-panel access-status-panel">
      <Icon className="size-6" aria-hidden />
      <div role="status">
        <h2>{title}</h2>
        <p>{detail}</p>
        {user?.email && <p className="access-account-email">{user.email}</p>}
      </div>
      <div className="access-status-actions">
        {approved ? (
          <Link className="saas-button saas-button-primary" to="/painel">
            Abrir painel
          </Link>
        ) : (
          status !== "denied" && (
            <button
              type="button"
              className="saas-button saas-button-outline"
              onClick={() => void refresh()}
            >
              Verificar acesso
            </button>
          )
        )}
        {user && status && !isError && status !== "unverified" && (
          <Link className="saas-button saas-button-outline" to="/assinatura">
            Assinatura
          </Link>
        )}
        {user && (
          <button
            type="button"
            className="saas-button saas-button-outline"
            onClick={() => void supabase.auth.signOut()}
          >
            <LogOut size={16} aria-hidden /> Sair da conta
          </button>
        )}
      </div>
    </div>
  );
}

export function PlatformGate({ children }: { children: ReactNode }) {
  const access = usePlatformAccess();
  const path = useRouterState({
    select: (state) => state.location.pathname.replace(/\/$/, "") || "/",
  });
  if (isPublicRoute(path)) return children;
  if (access.isLoading) {
    return (
      <main className="access-standalone">
        <p role="status">
          <LoaderCircle className="inline size-4 animate-spin" aria-hidden /> Verificando acesso…
        </p>
      </main>
    );
  }
  if (!access.isError && access.user && (path !== "/aprovacoes" || access.status === "admin"))
    return children;
  const adminBlocked = path === "/aprovacoes" && !!access.user && !access.isError;
  return (
    <main className="access-standalone">
      {adminBlocked ? (
        <div className="access-form-panel access-status-panel">
          <h1>Área da administração</h1>
          <p>Apenas a conta administradora pode aprovar cadastros e gerar convites.</p>
          <Link to="/painel" className="saas-button saas-button-outline">
            <ArrowLeft size={17} aria-hidden /> Voltar ao painel
          </Link>
        </div>
      ) : access.user || access.isError ? (
        <AccessStatusPanel />
      ) : (
        <div className="access-form-panel access-status-panel">
          <h1>Entre para usar o Mousefy</h1>
          <p>Faça login ou crie uma conta para explorar as ferramentas.</p>
          <Link to="/" hash="acesso" className="saas-button saas-button-primary">
            Entrar ou criar conta
          </Link>
        </div>
      )}
    </main>
  );
}
