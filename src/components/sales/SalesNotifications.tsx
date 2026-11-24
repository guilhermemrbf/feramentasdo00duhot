import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Bell, BellRing, CheckCircle2, DollarSign, Send, Smartphone, Sparkles } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import {
  disableSalesPush,
  registerSalesPush,
  salesPushStatus,
  setSalesPushPreference,
  testSalesPush,
} from "@/lib/api/sales.functions";

function publicKeyBytes(key: string) {
  return Uint8Array.from(atob(key.replaceAll("-", "+").replaceAll("_", "/") + "="), (character) =>
    character.charCodeAt(0),
  );
}

export function SalesNotifications({
  renderSettings,
}: {
  renderSettings?: (parts: { device: ReactNode; approved: ReactNode }) => ReactNode;
}) {
  const query = useQueryClient();
  const status = useServerFn(salesPushStatus);
  const register = useServerFn(registerSalesPush);
  const disable = useServerFn(disableSalesPush);
  const sendTest = useServerFn(testSalesPush);
  const savePreference = useServerFn(setSalesPushPreference);
  const [registration, setRegistration] = useState<ServiceWorkerRegistration>();
  const [subscription, setSubscription] = useState<PushSubscription | null>(null);
  const [key, setKey] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [compatible, setCompatible] = useState(false);
  const [active, setActive] = useState(false);
  const [notifyApproved, setNotifyApproved] = useState(false);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<{ text: string; error?: boolean }>();

  useEffect(() => {
    let current = true;
    async function check() {
      if (
        !("serviceWorker" in navigator) ||
        !("PushManager" in window) ||
        !("Notification" in window)
      ) {
        if (current) setReady(true);
        return;
      }
      setCompatible(true);
      const config = await status({ data: {} });
      if (!current) return;
      setKey(config.publicKey);
      if (config.publicKey) {
        await navigator.serviceWorker.register("/sales-sw.js", { scope: "/" });
        const worker = await navigator.serviceWorker.ready;
        const saved = await worker.pushManager.getSubscription();
        const device = saved ? await status({ data: { endpoint: saved.endpoint } }) : config;
        if (!current) return;
        setRegistration(worker);
        setSubscription(saved);
        setActive(device.active);
        setNotifyApproved(device.notifyApproved);
      }
      setReady(true);
    }
    void check().catch(() => {
      if (current) {
        setReady(true);
        setMessage({
          text: "Não foi possível consultar os alertas neste dispositivo.",
          error: true,
        });
      }
    });
    return () => {
      current = false;
    };
  }, [status]);

  async function change(action: "enable" | "disable" | "test") {
    setPending(true);
    setMessage(undefined);
    try {
      if (action === "enable" && key && registration) {
        const next =
          subscription ??
          (await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: publicKeyBytes(key),
          }));
        const keys = next.toJSON().keys;
        if (!keys?.p256dh || !keys.auth)
          throw new Error("O navegador não retornou as chaves de push.");
        await register({ data: { endpoint: next.endpoint, p256dh: keys.p256dh, auth: keys.auth } });
        setSubscription(next);
        setActive(true);
        setNotifyApproved(true);
        setMessage({ text: "Alertas ativados neste dispositivo." });
      }
      if (action === "disable" && subscription) {
        await disable({ data: { endpoint: subscription.endpoint } });
        setActive(false);
        setNotifyApproved(false);
        if (await subscription.unsubscribe()) setSubscription(null);
        setMessage({ text: "Alertas desativados neste dispositivo." });
      }
      if (action === "test" && subscription) {
        await sendTest({ data: { endpoint: subscription.endpoint } });
        setMessage({
          text: "Teste aceito pelo serviço de push. Confira as notificações do dispositivo.",
        });
      }
      await query.invalidateQueries({ queryKey: ["sales-overview"] });
    } catch (error) {
      const text =
        typeof Notification !== "undefined" && Notification.permission === "denied"
          ? "O navegador bloqueou as notificações. Libere a permissão nas configurações do dispositivo."
          : error instanceof Error
            ? error.message
            : "Não foi possível atualizar os alertas.";
      setMessage({ text, error: true });
    } finally {
      setPending(false);
    }
  }

  async function toggleApproved(enabled: boolean) {
    if (!subscription || !active) return;
    setPending(true);
    setMessage(undefined);
    try {
      await savePreference({ data: { endpoint: subscription.endpoint, enabled } });
      setNotifyApproved(enabled);
      setMessage({
        text: enabled
          ? "Alertas de vendas ativados."
          : "Alertas de vendas pausados neste aparelho.",
      });
    } catch (error) {
      setMessage({
        text: error instanceof Error ? error.message : "Não foi possível salvar a preferência.",
        error: true,
      });
    } finally {
      setPending(false);
    }
  }

  const DeviceIcon = active ? BellRing : Bell;
  if (renderSettings) {
    return renderSettings({
      approved: (
        <select
          className="field"
          value={notifyApproved ? "on" : "off"}
          disabled={!active || pending}
          onChange={(event) => void toggleApproved(event.target.value === "on")}
        >
          <option value="on">Habilitado</option>
          <option value="off">Desabilitado</option>
        </select>
      ),
      device: (
        <>
          <div className="settings-inset">
            <strong>Modo atual</strong>
            <p>
              {typeof window !== "undefined" &&
              window.matchMedia("(display-mode: standalone)").matches
                ? "Aplicativo instalado"
                : "Navegador"}
            </p>
            <InstallSalesApp primary={false} />
          </div>
          <div className="settings-inset">
            <strong>Notificações neste dispositivo</strong>
            <p role="status">
              {!ready
                ? "Verificando o dispositivo…"
                : active
                  ? "Ativadas"
                  : !compatible
                    ? "Este navegador não oferece notificações push."
                    : !key
                      ? "Serviço de notificações indisponível neste ambiente."
                      : "Desativadas"}
            </p>
            {ready && registration && key && (
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className={active ? "sales-button sales-button-outline" : "sales-button"}
                  disabled={pending}
                  onClick={() => void change(active ? "disable" : "enable")}
                >
                  <DeviceIcon className="size-4" aria-hidden />
                  {active ? "Desativar notificações" : "Ativar notificações"}
                </button>
                {active && (
                  <button
                    type="button"
                    className="sales-button sales-button-outline"
                    disabled={pending}
                    onClick={() => void change("test")}
                  >
                    <Send className="size-4" aria-hidden /> Enviar teste
                  </button>
                )}
              </div>
            )}
            {message && (
              <p
                role={message.error ? "alert" : "status"}
                className={message.error ? "text-destructive" : "text-success"}
              >
                {message.text}
              </p>
            )}
          </div>
        </>
      ),
    });
  }
  return (
    <div className="grid max-w-6xl gap-6 lg:grid-cols-3">
      <section className="sales-panel p-6 lg:col-span-2" aria-labelledby="sales-push-title">
        <div className="flex items-start gap-4">
          <div
            className={`grid size-12 shrink-0 place-items-center rounded-2xl ${active ? "bg-success/15 text-success" : "bg-primary/15 text-brand-red"}`}
          >
            <DeviceIcon className="size-6" aria-hidden />
          </div>
          <div>
            <h2 id="sales-push-title" className="font-display text-lg font-semibold">
              {active ? "Notificações ativas" : "Ative as notificações"}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {active
                ? "Os alertas podem chegar a este aparelho mesmo com o painel fechado."
                : "Permita alertas neste dispositivo para receber avisos de vendas aprovadas."}
            </p>
          </div>
        </div>
        <div className="mt-6 space-y-3">
          {!ready && (
            <p role="status" className="text-sm text-muted-foreground">
              Verificando o dispositivo…
            </p>
          )}
          {ready && compatible && !key && (
            <p role="status" className="text-sm text-muted-foreground">
              O serviço de notificações ainda não está configurado neste ambiente.
            </p>
          )}
          {ready && registration && key && (
            <div className="flex flex-wrap gap-2">
              {active ? (
                <>
                  <button
                    type="button"
                    className="sales-button sales-button-outline flex-1"
                    disabled={pending}
                    onClick={() => void change("disable")}
                  >
                    Desativar neste dispositivo
                  </button>
                  <button
                    type="button"
                    className="sales-button"
                    disabled={pending}
                    onClick={() => void change("test")}
                  >
                    <Send className="size-4" aria-hidden /> Enviar notificação de teste
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  className="sales-button w-full"
                  disabled={pending}
                  onClick={() => void change("enable")}
                >
                  <Bell className="size-4" aria-hidden /> Ativar notificações
                </button>
              )}
            </div>
          )}
          {!active && <InstallSalesApp primary={!compatible} />}
        </div>
      </section>
      <section className="sales-panel p-6">
        <span className="mb-3 grid size-10 place-items-center rounded-xl bg-primary/15 text-brand-red">
          <Sparkles className="size-5" aria-hidden />
        </span>
        <h2 className="mb-2 font-display font-semibold">Por que ativar?</h2>
        <ul className="space-y-2 text-sm text-muted-foreground">
          <li className="flex gap-2">
            <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" aria-hidden /> Aviso
            quando um gateway confirmar uma venda.
          </li>
          <li className="flex gap-2">
            <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" aria-hidden /> Toque no
            alerta para abrir o painel de vendas.
          </li>
        </ul>
      </section>
      <section className="sales-panel p-6 lg:col-span-3">
        <h2 className="font-display text-lg font-semibold">Personalizar alertas</h2>
        <p className="mt-1 mb-5 text-xs text-muted-foreground">
          Escolha o que deseja receber neste dispositivo.
        </p>
        <label className="flex max-w-md items-center gap-3 rounded-xl border border-border bg-background/60 p-3.5">
          <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-success/15 text-success">
            <DollarSign className="size-5" aria-hidden />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-medium">Cada venda aprovada</span>
            <span className="block text-xs text-muted-foreground">
              {active
                ? "Alertas para vendas confirmadas pelos gateways."
                : "Ative as notificações neste dispositivo primeiro."}
            </span>
          </span>
          <Switch
            checked={notifyApproved}
            disabled={!active || pending}
            onCheckedChange={(enabled) => void toggleApproved(enabled)}
            aria-label="Cada venda aprovada"
          />
        </label>
      </section>
      {message && (
        <p
          role={message.error ? "alert" : "status"}
          className={`text-sm lg:col-span-3 ${message.error ? "text-destructive" : "text-success"}`}
        >
          {message.text}
        </p>
      )}
    </div>
  );
}

function InstallSalesApp({ primary }: { primary: boolean }) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          type="button"
          className={`sales-button w-full ${primary ? "" : "sales-button-outline"}`}
        >
          <Smartphone className="size-4" aria-hidden /> Como instalar o app
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-md bg-card text-foreground">
        <DialogHeader>
          <DialogTitle>Como instalar o Mousefy</DialogTitle>
          <DialogDescription>
            Abra o Mousefy pelo ícone na Tela de Início e volte a Notificações para ativar os
            alertas.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="rounded-xl border border-border bg-background/40 p-4">
            <h3 className="mb-2 text-sm font-semibold">iPhone e iPad (Safari)</h3>
            <ol className="list-inside list-decimal space-y-1 text-sm text-muted-foreground">
              <li>Toque em Compartilhar.</li>
              <li>Escolha Adicionar à Tela de Início.</li>
              <li>Confirme em Adicionar.</li>
            </ol>
          </div>
          <div className="rounded-xl border border-border bg-background/40 p-4">
            <h3 className="mb-2 text-sm font-semibold">Android (Chrome)</h3>
            <ol className="list-inside list-decimal space-y-1 text-sm text-muted-foreground">
              <li>Abra o menu de três pontos.</li>
              <li>Escolha Adicionar à tela inicial e confirme.</li>
            </ol>
          </div>
          <div className="rounded-xl border border-border bg-background/40 p-4">
            <h3 className="mb-2 text-sm font-semibold">Windows e Mac (Chrome ou Edge)</h3>
            <p className="text-sm text-muted-foreground">
              Abra o menu do navegador e procure a opção de instalar o Mousefy ou de instalar a
              página como aplicativo.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
