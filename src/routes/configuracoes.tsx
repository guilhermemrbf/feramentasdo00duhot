import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowUpRight,
  Box,
  CreditCard,
  LayoutGrid,
  Link2,
  LogOut,
  Monitor,
  ShieldCheck,
  Smartphone,
  User as UserIcon,
} from "lucide-react";
import { useState, type FormEvent } from "react";
import type { User } from "@supabase/supabase-js";
import { AppShell } from "@/components/AppShell";
import { usePlatformAccess } from "@/components/access/PlatformAccessProvider";
import { SalesNotifications } from "@/components/sales/SalesNotifications";
import { SettingsNotifications } from "@/components/settings/SettingsNotifications";
import {
  SettingsCardHeading,
  SettingsSectionHeading,
} from "@/components/settings/SettingsHeadings";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import {
  MOUSEHOT_DASHBOARD_PERIODS,
  readMouseHotSettings,
  type MouseHotDashboardPeriod,
} from "@/lib/mousehot-settings";
import { mouseHotDashboardName } from "@/lib/mousehot-notice-preferences";
import "@/components/sales/scalehot.css";
import "./mousehot-settings.css";

export const Route = createFileRoute("/configuracoes")({
  head: () => ({ meta: [{ title: "Configurações | Mousefy" }] }),
  component: SettingsPage,
});

function loginName(user: User) {
  return (
    [user.user_metadata.full_name, user.user_metadata.name, user.user_metadata.given_name]
      .find((value): value is string => typeof value === "string" && value.trim().length > 0)
      ?.trim() ?? ""
  );
}

function SettingsPage() {
  const { status, user } = usePlatformAccess();
  const [loggingOut, setLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState(false);
  const dashboard = mouseHotDashboardName(user?.user_metadata);
  const display = user
    ? readMouseHotSettings(user.user_metadata).displayName || loginName(user) || "Minha conta"
    : "Minha conta";
  const access = status === "admin" ? "Administrador" : "Conta aprovada";

  async function leaveThisDevice() {
    setLoggingOut(true);
    setLogoutError(false);
    try {
      const { error } = await supabase.auth.signOut({ scope: "local" });
      if (error) setLogoutError(true);
    } catch {
      setLogoutError(true);
    } finally {
      setLoggingOut(false);
    }
  }

  return (
    <AppShell>
      <main className="settings-page">
        <header className="settings-intro">
          <div className="settings-identity">
            <span className="settings-avatar" aria-hidden>
              {display.charAt(0).toUpperCase()}
            </span>
            <div className="settings-identity-text">
              <h1>Configurações</h1>
              <strong>{display}</strong>
              {user?.email && <span>{user.email}</span>}
            </div>
            <div className="settings-badges">
              <span>{access}</span>
              <span>
                <Box size={13} aria-hidden /> {dashboard}
              </span>
            </div>
          </div>
          <p>Ajuste sua conta, o dashboard e os avisos que você recebe no Mousefy.</p>
        </header>
        <section id="conta" className="settings-section" aria-labelledby="settings-account">
          <SettingsSectionHeading id="settings-account" title="Conta e dashboard" icon={UserIcon}>
            Seus dados pessoais e as preferências da sua operação.
          </SettingsSectionHeading>
          {user && <AccountForm key={user.id} user={user} />}
        </section>
        {user && (
          <SalesNotifications
            key={user.id}
            renderSettings={({ approved, device }) => (
              <>
                <SettingsNotifications
                  dashboard={dashboard}
                  metadata={user.user_metadata}
                  approved={approved}
                />
                <section className="settings-section" aria-labelledby="settings-app">
                  <SettingsSectionHeading id="settings-app" title="App e plano" icon={Smartphone}>
                    Instale o Mousefy e veja o acesso desta conta.
                  </SettingsSectionHeading>
                  <div className="settings-columns">
                    <section
                      className="settings-card settings-fields"
                      aria-labelledby="settings-device"
                    >
                      <SettingsCardHeading
                        id="settings-device"
                        title="Notificações no Mac / PC"
                        icon={Monitor}
                      >
                        Ative os avisos de venda no navegador ou no aplicativo instalado.
                      </SettingsCardHeading>
                      {device}
                    </section>
                    <section
                      className="settings-card settings-fields"
                      aria-labelledby="settings-plan"
                    >
                      <SettingsCardHeading id="settings-plan" title="Plano" icon={CreditCard}>
                        Acesso atual · {access}
                      </SettingsCardHeading>
                      <div className="settings-inset">
                        <strong>Acesso ao Mousefy</strong>
                        <p>O acesso à plataforma é gerenciado por aprovação de cadastro.</p>
                      </div>
                    </section>
                  </div>
                </section>
              </>
            )}
          />
        )}
        <section
          id="integracoes"
          className="settings-section"
          aria-labelledby="settings-connections"
        >
          <SettingsSectionHeading id="settings-connections" title="Integrações" icon={Link2}>
            Gerencie conexões das ferramentas do Mousefy.
          </SettingsSectionHeading>
          <div className="settings-card settings-directories">
            <div>
              <div>
                <h3>Automatic Post</h3>
                <p>Gerencie a publicação automática e as configurações do Instagram.</p>
              </div>
              <Button variant="outline" asChild>
                <Link to="/automacao-instagram" search={{ tab: "config" }}>
                  Abrir Automatic Post <ArrowUpRight />
                </Link>
              </Button>
            </div>
            <div>
              <div>
                <h3>Traqueamento avançado</h3>
                <p>Conecte contas de anúncios e configure webhooks, UTMs e pixels.</p>
              </div>
              <Button variant="outline" asChild>
                <Link to="/vendas/conexoes">
                  Abrir integrações <ArrowUpRight />
                </Link>
              </Button>
            </div>
            <div>
              <div>
                <h3>Gateways</h3>
                <p>Configure o recebimento de vendas dos seus gateways de pagamento.</p>
              </div>
              <Button variant="outline" asChild>
                <Link to="/vendas/integracoes">
                  Abrir Gateways <ArrowUpRight />
                </Link>
              </Button>
            </div>
          </div>
        </section>
        <section id="privacidade" className="settings-section" aria-labelledby="settings-privacy">
          <SettingsSectionHeading
            id="settings-privacy"
            title="Privacidade e sessão"
            icon={ShieldCheck}
          >
            Consulte seus direitos e gerencie o acesso neste navegador.
          </SettingsSectionHeading>
          <div className="settings-card settings-directories">
            <div>
              <div>
                <h3>Dados da conta</h3>
                <p>Saiba como os dados são usados e como solicitar a exclusão.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" asChild>
                  <Link to="/privacidade">Política de privacidade</Link>
                </Button>
                <Button variant="outline" asChild>
                  <Link to="/exclusao-de-dados">Exclusão de dados</Link>
                </Button>
              </div>
            </div>
            {status === "admin" && (
              <div>
                <div>
                  <h3>Aprovações e convites</h3>
                  <p>Administre cadastros e gere convites de teste.</p>
                </div>
                <Button variant="outline" asChild>
                  <Link to="/aprovacoes">
                    Abrir aprovações <ArrowUpRight />
                  </Link>
                </Button>
              </div>
            )}
            <div>
              <div>
                <h3>Sessão atual</h3>
                <p>Encerre o acesso do Mousefy neste navegador.</p>
              </div>
              <Button
                type="button"
                variant="outline"
                disabled={loggingOut}
                onClick={() => void leaveThisDevice()}
              >
                <LogOut />
                {loggingOut ? "Saindo…" : "Sair deste dispositivo"}
              </Button>
            </div>
          </div>
          {logoutError && (
            <p role="alert" className="text-sm text-destructive">
              Não foi possível encerrar a sessão. Tente novamente.
            </p>
          )}
        </section>
      </main>
    </AppShell>
  );
}

function AccountForm({ user }: { user: User }) {
  const existing = readMouseHotSettings(user.user_metadata);
  const [name, setName] = useState(existing.displayName);
  const storedDashboardName = mouseHotDashboardName(user.user_metadata);
  const [dashboard, setDashboard] = useState(storedDashboardName);
  const [period, setPeriod] = useState<MouseHotDashboardPeriod | "">(existing.period ?? "");
  const [shortcuts, setShortcuts] = useState(existing.showToolShortcuts);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<"saved" | "error" | null>(null);
  const providerName = loginName(user);
  const dirty =
    name.trim() !== existing.displayName ||
    (dashboard.trim() || "Mousefy") !== storedDashboardName ||
    period !== (existing.period ?? "") ||
    shortcuts !== existing.showToolShortcuts;

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!dirty || saving) return;
    setSaving(true);
    setFeedback(null);
    try {
      const { error } = await supabase.auth.updateUser({
        data: {
          mousehot_display_name: name.trim(),
          mousehot_dashboard_name: dashboard.trim() || null,
          mousehot_dashboard_period: period || null,
          mousehot_show_tool_shortcuts: shortcuts,
        },
      });
      setFeedback(error ? "error" : "saved");
    } catch {
      setFeedback("error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="settings-columns" onSubmit={save}>
      <section className="settings-card settings-fields" aria-labelledby="settings-profile">
        <SettingsCardHeading id="settings-profile" title="Perfil" icon={UserIcon}>
          Dados básicos da sua conta.
        </SettingsCardHeading>
        <div className="settings-columns settings-fields">
          <label>
            Nome
            <input
              className="field"
              autoComplete="name"
              placeholder={providerName || "Seu nome"}
              maxLength={120}
              value={name}
              onChange={(event) => {
                setName(event.target.value);
                setFeedback(null);
              }}
            />
          </label>
          <label>
            E-mail
            <input
              className="field"
              autoComplete="email"
              type="email"
              readOnly
              value={user.email ?? ""}
            />
          </label>
        </div>
        <div className="settings-inset">
          <strong>Dica</strong>
          <p>
            O e-mail é usado para entrar no Mousefy. Alterações neste formulário atualizam o nome
            de exibição.
          </p>
        </div>
      </section>
      <section className="settings-card settings-fields" aria-labelledby="settings-dashboard">
        <SettingsCardHeading id="settings-dashboard" title="Dashboard atual" icon={LayoutGrid}>
          Nome, período inicial, fuso e moeda da sua operação.
        </SettingsCardHeading>
        <label>
          Nome do dashboard
          <input
            className="field"
            value={dashboard}
            maxLength={80}
            onChange={(event) => {
              setDashboard(event.target.value);
              setFeedback(null);
            }}
          />
        </label>
        <div className="settings-columns settings-fields">
          <label>
            Fuso horário
            <input className="field" readOnly value="America/São Paulo" />
          </label>
          <label>
            Moeda
            <input className="field" readOnly value="BRL — Real" />
          </label>
        </div>
        <label>
          Período inicial
          <select
            className="field"
            value={period}
            onChange={(event) => {
              setPeriod(event.target.value as MouseHotDashboardPeriod | "");
              setFeedback(null);
            }}
          >
            <option value="">Padrão de cada painel</option>
            {MOUSEHOT_DASHBOARD_PERIODS.map(({ key, label }) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <div className="settings-switch">
          <div>
            <label htmlFor="settings-shortcuts">Favoritas e recentes</label>
            <p>Mostra os atalhos no menu de Ferramentas.</p>
          </div>
          <Switch
            id="settings-shortcuts"
            checked={shortcuts}
            onCheckedChange={(checked) => {
              setShortcuts(checked);
              setFeedback(null);
            }}
          />
        </div>
        <div className="settings-save">
          {feedback && (
            <p
              aria-live={feedback === "error" ? "assertive" : "polite"}
              role={feedback === "error" ? "alert" : "status"}
            >
              {feedback === "saved"
                ? "Alterações salvas."
                : "Não foi possível salvar as alterações. Tente novamente."}
            </p>
          )}
          <Button type="submit" className="workspace-primary-action" disabled={!dirty || saving}>
            {saving ? "Salvando…" : "Salvar alterações"}
          </Button>
        </div>
      </section>
    </form>
  );
}
