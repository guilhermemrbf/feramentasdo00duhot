import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { ArrowLeft, ArrowRight, CircleCheck, Copy, LockKeyhole, ScanLine } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { PublicBrand } from "@/components/access/LaunchPage";
import { usePlatformAccess } from "@/components/access/PlatformAccessProvider";
import {
  changeMousefySubscription,
  enrollMousefy,
  getMousefyCharges,
  getMousefyPlans,
  getMousefySubscription,
} from "@/lib/api/syncpay.functions";
import { TOOL_CATALOG } from "@/lib/tool-catalog";

export const Route = createFileRoute("/assinatura")({
  head: () => ({
    meta: [{ title: "Assinatura | Mousefy" }, { name: "robots", content: "noindex" }],
  }),
  component: SubscriptionPage,
});

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const date = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo" });
const money = (amount: unknown) =>
  amount != null && Number.isFinite(Number(amount)) ? currency.format(Number(amount)) : "—";
const day = (value?: string | null) =>
  value && Number.isFinite(Date.parse(value))
    ? /^\d{4}-\d{2}-\d{2}$/.test(value)
      ? value.split("-").reverse().join("/")
      : date.format(new Date(value))
    : "—";
const names = { pix_automatico: "Pix Automático", qr_code: "Pix Copia e Cola" } as const;
type BillingMethod = keyof typeof names;
const methodDescriptions: Record<BillingMethod, string> = {
  pix_automatico: "Autorize uma vez no banco para pagar os próximos ciclos automaticamente.",
  qr_code: "Pague um novo Pix a cada ciclo.",
};
const planDetails: Record<string, { name: string; instagram: string; ads: number }> = {
  "b51f6f0f-4d23-48c8-a2e7-1037849aa8a9": { name: "Essencial", instagram: "50", ads: 3 },
  "26a29855-68aa-4a80-bd53-2200ce44c471": { name: "Crescimento", instagram: "100", ads: 5 },
  "44aa1915-be2f-4b0c-b386-7b75181c23eb": { name: "Pro", instagram: "150", ads: 8 },
  "66b2964c-c281-4c8c-b902-ced6d567bcbd": { name: "Escala", instagram: "1.000", ads: 15 },
};
type Action = "cancel" | "suspend" | "reactivate";
const paymentLabels: Record<string, string> = {
  aguardando: "Aguardando o primeiro pagamento",
  em_dia: "Pagamento em dia",
  pendente: "Pagamento pendente",
  bloqueado: "Acesso da assinatura suspenso",
};
const chargeLabels: Record<string, string> = {
  pending: "Pendente",
  paid: "Paga",
  overdue: "Vencida",
  failed: "Falhou",
  expired: "Expirada",
  cancelled: "Cancelada",
  processing: "Processando",
};
const button = "saas-button saas-button-outline";
const primary = "saas-button saas-button-primary";
const field = "w-full rounded-lg border border-input bg-background px-3 py-2 text-foreground";
const checkoutField =
  field +
  " min-h-12 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

function PlanLimits({ details }: { details: (typeof planDetails)[string] }) {
  return (
    <dl className="grid gap-3 text-sm">
      <div>
        <dt className="text-muted-foreground">Automatic Post</dt>
        <dd className="font-semibold">Até {details.instagram} contas do Instagram</dd>
      </div>
      <div>
        <dt className="text-muted-foreground">Traqueamento avançado</dt>
        <dd className="font-semibold">Até {details.ads} contas de anúncio</dd>
      </div>
    </dl>
  );
}

function PaymentInstructions({
  payment,
  method,
}: {
  payment: { code?: string; image?: string; expiresAt?: string };
  method: BillingMethod;
}) {
  const [copy, setCopy] = useState("");
  const automatic = method === "pix_automatico";
  return (
    <div className="grid items-center gap-6 rounded-2xl border border-border bg-card p-4 sm:p-6 md:grid-cols-[auto_minmax(0,1fr)] md:gap-8">
      {payment.image && (
        <img
          className="mx-auto aspect-square w-64 max-w-full rounded-xl bg-white object-contain p-3"
          width={320}
          height={320}
          alt="QR Code do pagamento Pix"
          src={payment.image}
          referrerPolicy="no-referrer"
        />
      )}
      <div className="min-w-0 space-y-4">
        <div>
          <h3 className="text-lg font-semibold">
            {automatic ? "Autorize no app do seu banco" : "Pague no app do seu banco"}
          </h3>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            {payment.image
              ? "Abra a área Pix no celular e escaneie o QR Code."
              : payment.code
                ? "Copie o código e cole na área Pix do seu banco."
                : "O QR Code ainda está indisponível. Atualize a assinatura e tente novamente."}
            {automatic &&
              payment.image &&
              " Confira os dados e confirme a autorização do Pix Automático."}
          </p>
        </div>
        {payment.code && (
          <div className="space-y-2">
            <label className="block space-y-2 text-sm font-medium">
              <span>Pix Copia e Cola</span>
              <input
                className={checkoutField + " font-mono text-xs"}
                readOnly
                value={payment.code}
                onFocus={(event) => event.target.select()}
              />
            </label>
            <button
              type="button"
              className={button}
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(payment.code ?? "");
                  setCopy("Código copiado.");
                } catch {
                  setCopy("Selecione e copie o código acima.");
                }
              }}
            >
              <Copy className="size-4" aria-hidden /> Copiar código Pix
            </button>
            <p className="text-sm text-muted-foreground" role="status">
              {copy}
            </p>
          </div>
        )}
        {payment.expiresAt && (
          <p className="text-sm text-muted-foreground">Pix válido até {day(payment.expiresAt)}.</p>
        )}
      </div>
    </div>
  );
}

function SubscriptionPage() {
  const access = usePlatformAccess();
  if (access.user) {
    return (
      <AppShell>
        <main className="mx-auto max-w-7xl px-5 py-8 sm:px-8 sm:py-10">
          <header className="rounded-xl border border-border bg-card px-5 py-6 sm:px-7">
            <h1 className="font-display text-3xl font-semibold tracking-tight">Planos</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              Escolha como ativar sua operação. Você pode explorar o Mousefy antes de assinar;
              conexões, publicações e ferramentas são ativadas após o pagamento confirmado.
            </p>
          </header>
          <div className="mt-6">
            {access.isLoading ? (
              <p role="status">Carregando sua conta…</p>
            ) : access.status === "unverified" ? (
              <p>Confirme seu e-mail para assinar.</p>
            ) : access.isError ? (
              <p role="alert">Não foi possível verificar sua conta. Tente novamente.</p>
            ) : (
              <SubscriptionDetails key={access.user.id} user={access.user.id} />
            )}
          </div>
        </main>
      </AppShell>
    );
  }
  return (
    <div className="launch-site">
      <header className="launch-top launch-wrap launch-top-static">
        <PublicBrand />
      </header>
      <main className="mx-auto max-w-2xl px-5 py-12">
        <h1 className="mb-6 text-3xl font-semibold">Assinatura do Mousefy</h1>
        {access.isLoading ? (
          <p role="status">Carregando sua conta…</p>
        ) : (
          <Link to="/" hash="acesso" className={primary}>
            Entrar ou criar conta
          </Link>
        )}
      </main>
    </div>
  );
}

function SubscriptionDetails({ user }: { user: string }) {
  const access = usePlatformAccess();
  const client = useQueryClient();
  const [plan, setPlan] = useState("");
  const [method, setMethod] = useState<BillingMethod>("pix_automatico");
  const [accepted, setAccepted] = useState<BillingMethod[]>();
  const [message, setMessage] = useState("");
  const [page, setPage] = useState(1);
  const [action, setAction] = useState<Action>();
  const [reason, setReason] = useState("");
  const subscriptionKey = ["mousefy-subscription", user];
  const subscription = useQuery({
    queryKey: subscriptionKey,
    queryFn: () => getMousefySubscription(),
    refetchInterval: 12_000,
  });
  const current = subscription.data;
  const canEnroll =
    access.status !== "denied" && (!current || current.closed || !current.hasSubscription);
  const plans = useQuery({
    queryKey: ["mousefy-plans", user],
    queryFn: () => getMousefyPlans(),
    enabled: subscription.isSuccess && canEnroll,
    staleTime: 60_000,
  });
  const charges = useQuery({
    queryKey: ["mousefy-charges", user, page, current?.paymentStatus],
    queryFn: () => getMousefyCharges({ data: page }),
    enabled: !!current?.hasSubscription,
    staleTime: 30_000,
  });
  const selected = plans.data?.find((entry) => entry.token === plan);
  const selectedDetails = selected && planDetails[selected.token];
  const checkoutHeading = useRef<HTMLHeadingElement>(null);
  const awaitingPayment =
    !!current?.hasSubscription && !current.closed && current.paymentStatus === "aguardando";
  const methods = accepted ?? selected?.methods ?? [];
  useEffect(() => {
    if (selected || awaitingPayment) checkoutHeading.current?.focus();
  }, [selected, awaitingPayment]);
  const refresh = async () => {
    await Promise.all([
      client.invalidateQueries({ queryKey: subscriptionKey }),
      client.invalidateQueries({ queryKey: ["mousefy-charges", user] }),
      access.refresh(),
    ]);
  };
  const enrollment = useMutation({
    mutationFn: enrollMousefy,
    onSuccess: async (data) => {
      if ("error" in data && data.error) {
        if ("acceptedMethods" in data && data.acceptedMethods) {
          setAccepted(data.acceptedMethods);
          setMethod(data.acceptedMethods[0] ?? "pix_automatico");
        }
        setMessage(data.error);
        await client.invalidateQueries({ queryKey: ["mousefy-plans", user] });
      } else {
        if ("subscription" in data && data.subscription?.hasSubscription) {
          client.setQueryData(subscriptionKey, data.subscription);
        }
        await refresh();
      }
    },
    onError: () =>
      setMessage("Não foi possível concluir a adesão. Confira os dados e tente novamente."),
  });
  const change = useMutation({
    mutationFn: changeMousefySubscription,
    onSuccess: async () => {
      setAction(undefined);
      setReason("");
      await refresh();
    },
    onError: () =>
      setMessage("Não foi possível concluir a alteração. Tente a mesma operação novamente."),
  });
  const busy = enrollment.isPending || change.isPending;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !selected || !methods.includes(method)) return;
    setMessage("");
    const form = new FormData(event.currentTarget);
    enrollment.mutate({
      data: {
        plan: selected.token,
        method,
        amount: selected.amount,
        days: selected.days,
        name: String(form.get("name")),
        document: String(form.get("document")),
      },
    });
  }

  if (subscription.isPending) return <p role="status">Consultando a assinatura…</p>;
  if (subscription.isError) return <p role="alert">Não foi possível consultar a assinatura.</p>;

  return (
    <div className="space-y-6">
      {current?.hasSubscription && (
        <section
          className="space-y-5 rounded-2xl border border-border p-4 sm:p-6"
          aria-label="Estado da assinatura"
        >
          <h2
            className="text-xl font-semibold focus:outline-none sm:text-2xl"
            ref={awaitingPayment ? checkoutHeading : undefined}
            tabIndex={awaitingPayment ? -1 : undefined}
          >
            {current.closed
              ? current.status === "cancelled"
                ? "Assinatura cancelada"
                : "Assinatura encerrada"
              : current.status === "suspended"
                ? current.manuallySuspended
                  ? "Assinatura pausada"
                  : "Assinatura suspensa pela SyncPay"
                : (paymentLabels[current.paymentStatus] ?? "Processando")}
          </h2>
          <p>
            {names[current.method]}
            {current.nextChargeAt && " · Vencimento: " + day(current.nextChargeAt)}
          </p>
          {current.paymentStatus === "pendente" && !current.closed && (
            <p>
              O acesso pode continuar durante os sete dias corridos após o vencimento, no horário de
              São Paulo.
            </p>
          )}
          {awaitingPayment && (
            <PaymentInstructions
              key={current.payment?.code}
              payment={current.payment ?? {}}
              method={current.method}
            />
          )}
          <div className="flex flex-wrap gap-2">
            <button type="button" className={button} onClick={() => void refresh()}>
              Atualizar
            </button>
            {access.status === "approved" && (
              <Link className={primary} to="/painel">
                Abrir painel
              </Link>
            )}
            {!current.closed && (
              <>
                <button
                  type="button"
                  className={button}
                  disabled={busy}
                  onClick={() => {
                    setMessage("");
                    setAction(current.status === "suspended" ? "reactivate" : "suspend");
                  }}
                >
                  {current.status === "suspended" ? "Retomar" : "Pausar"}
                </button>
                <button
                  type="button"
                  className={button}
                  disabled={busy}
                  onClick={() => {
                    setMessage("");
                    setAction("cancel");
                  }}
                >
                  Cancelar assinatura
                </button>
              </>
            )}
          </div>
          {action && !current.closed && (
            <form
              className="space-y-3"
              onSubmit={(event) => {
                event.preventDefault();
                setMessage("");
                change.mutate({ data: action === "cancel" ? { action, reason } : { action } });
              }}
            >
              <p>
                {action === "cancel"
                  ? "O cancelamento encerra esta assinatura e a cobrança recorrente."
                  : action === "suspend"
                    ? "A pausa suspende o acesso da assinatura."
                    : "Ao retomar, os ciclos de cobrança voltam a seguir o plano."}
              </p>
              {action === "cancel" && (
                <label className="block space-y-1">
                  <span>Motivo do cancelamento</span>
                  <input
                    className={field}
                    required
                    minLength={3}
                    maxLength={250}
                    value={reason}
                    onChange={(event) => setReason(event.target.value)}
                  />
                </label>
              )}
              <div className="flex flex-wrap gap-2">
                <button className={primary} disabled={busy}>
                  Confirmar{" "}
                  {action === "cancel"
                    ? "cancelamento"
                    : action === "suspend"
                      ? "pausa"
                      : "retomada"}
                </button>
                <button
                  type="button"
                  className={button}
                  disabled={busy}
                  onClick={() => setAction(undefined)}
                >
                  Voltar
                </button>
              </div>
            </form>
          )}
        </section>
      )}
      {canEnroll && (
        <section className="space-y-4 rounded-xl border border-border p-5" aria-label="Planos">
          {!selected && <h2 className="text-xl font-semibold">Escolha seu plano</h2>}
          {!selected && <p>Todos os planos incluem acesso às ferramentas do Mousefy.</p>}
          {plans.isPending ? (
            <p role="status">Consultando os planos…</p>
          ) : plans.isError ? (
            <p role="alert">Os planos estão temporariamente indisponíveis.</p>
          ) : !plans.data.length ? (
            <p>Nenhum plano disponível para adesão agora.</p>
          ) : (
            <form className="space-y-4" onSubmit={submit}>
              {!selected ? (
                <div className="mousefy-pricing relative isolate min-w-0 overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950 p-4 text-zinc-50 sm:p-6">
                  <style>{`
                    .mousefy-pricing .pricing-lines {
                      position: absolute;
                      inset: 0;
                      pointer-events: none;
                      background:
                        linear-gradient(90deg, transparent 17.9%, #27272a 18%, transparent 18.1%, transparent 49.9%, #27272a 50%, transparent 50.1%, transparent 81.9%, #27272a 82%, transparent 82.1%),
                        linear-gradient(transparent 17.9%, #27272a 18%, transparent 18.1%, transparent 49.9%, #27272a 50%, transparent 50.1%, transparent 81.9%, #27272a 82%, transparent 82.1%);
                      opacity: .65;
                      animation: mousefy-pricing-lines .7s ease both;
                    }
                    .mousefy-pricing .pricing-particles {
                      position: absolute;
                      inset: 0;
                      pointer-events: none;
                      background-image: radial-gradient(ellipse at center, #a1a1aa 0 1px, transparent 1.6px), radial-gradient(ellipse at center, #71717a 0 1px, transparent 1.6px);
                      background-size: 71px 89px, 113px 137px;
                      background-position: 13px 19px, 41px 61px;
                      opacity: .18;
                      animation: mousefy-pricing-particles 4s ease-out both;
                    }
                    .mousefy-pricing .pricing-grid {
                      display: grid;
                      grid-template-columns: repeat(auto-fit, minmax(min(100%, 210px), 1fr));
                      gap: 1rem;
                    }
                    .mousefy-pricing .pricing-card {
                      animation: mousefy-pricing-card .55s ease backwards;
                    }
                    @keyframes mousefy-pricing-lines {
                      from { opacity: 0; transform: scale(.94); }
                      to { opacity: .65; transform: scale(1); }
                    }
                    @keyframes mousefy-pricing-particles {
                      from { background-position: 13px 39px, 41px 81px; }
                      to { background-position: 13px 19px, 41px 61px; }
                    }
                    @keyframes mousefy-pricing-card {
                      from { opacity: 0; transform: translateY(10px); }
                      to { opacity: 1; transform: translateY(0); }
                    }
                    @media (prefers-reduced-motion: reduce) {
                      .mousefy-pricing .pricing-lines,
                      .mousefy-pricing .pricing-particles,
                      .mousefy-pricing .pricing-card { animation: none; }
                    }
                  `}</style>
                  <div aria-hidden="true" className="pricing-lines" />
                  <div aria-hidden="true" className="pricing-particles" />
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-0 [background:radial-gradient(80%_60%_at_50%_0%,rgba(255,255,255,0.07),transparent_65%)]"
                  />
                  <div className="relative">
                    <div className="mb-7 text-center">
                      <p className="text-xs font-medium uppercase tracking-[0.16em] text-zinc-400">
                        Mousefy
                      </p>
                      <h3 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
                        Sua operação, seu ritmo
                      </h3>
                      <p className="mt-2 text-sm text-zinc-400">
                        Escolha a capacidade ideal para sua operação.
                      </p>
                    </div>
                    <div className="pricing-grid">
                      {plans.data.map((entry, index) => (
                        <article
                          key={entry.token}
                          style={{ animationDelay: `${index * 70}ms` }}
                          className="pricing-card relative flex min-w-0 flex-col gap-4 rounded-xl border border-zinc-800 bg-zinc-900/90 p-4 transition-colors hover:border-zinc-500 sm:p-5"
                        >
                          <h4 className="break-words text-base font-semibold">
                            {planDetails[entry.token]?.name ?? entry.name}
                          </h4>
                          <div>
                            <span className="block text-2xl font-bold tracking-tight text-white sm:text-3xl">
                              {money(entry.amount)}
                            </span>
                            <span className="mt-1 block text-sm text-zinc-400">
                              A cada {entry.days} dias
                            </span>
                          </div>
                          {planDetails[entry.token] && (
                            <PlanLimits details={planDetails[entry.token]} />
                          )}
                          <div className="flex-1 border-t border-zinc-700 pt-4">
                            <p className="mb-3 text-sm font-semibold text-zinc-100">
                              Todas as ferramentas
                            </p>
                            <ul className="space-y-2.5 text-sm text-zinc-200">
                              {TOOL_CATALOG.map((tool) => (
                                <li key={tool.id} className="flex items-start gap-2">
                                  <CircleCheck
                                    aria-hidden="true"
                                    className="mt-0.5 size-4 shrink-0 text-zinc-400"
                                  />
                                  <span>
                                    {tool.id === "social"
                                      ? "Automatic Post · Agendamento de Reels e preparação de Stories"
                                      : tool.name}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          </div>
                          <button
                            type="button"
                            disabled={busy}
                            aria-label={`Selecionar plano ${planDetails[entry.token]?.name ?? entry.name} — ${money(entry.amount)}`}
                            className="mt-auto flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-zinc-100 bg-zinc-100 px-3 py-2 text-center text-sm font-semibold text-zinc-950 transition-colors hover:bg-zinc-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:opacity-50"
                            onClick={() => {
                              setPlan(entry.token);
                              setAccepted(undefined);
                              setMethod(entry.methods[0] ?? "pix_automatico");
                              setMessage("");
                            }}
                          >
                            Selecionar plano
                            <ArrowRight aria-hidden="true" className="size-4 shrink-0" />
                          </button>
                        </article>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="mx-auto max-w-5xl space-y-5">
                  <button
                    type="button"
                    className="inline-flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm font-medium text-muted-foreground hover:bg-card hover:text-foreground focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-50"
                    disabled={busy}
                    onClick={() => {
                      setPlan("");
                      setAccepted(undefined);
                      setMessage("");
                    }}
                  >
                    <ArrowLeft className="size-4" aria-hidden /> Voltar aos planos
                  </button>
                  <h2
                    ref={checkoutHeading}
                    tabIndex={-1}
                    className="font-display text-2xl font-semibold tracking-tight focus:outline-none sm:text-3xl"
                  >
                    Finalizar assinatura
                  </h2>
                  <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(16rem,0.62fr)] lg:items-start">
                    <section
                      className="space-y-6 rounded-2xl border border-border bg-card p-4 sm:p-6"
                      aria-label="Dados e forma de pagamento"
                    >
                      <div className="space-y-3">
                        <h3 className="text-base font-semibold">Dados de cobrança</h3>
                        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(10rem,0.65fr)]">
                          <label className="block space-y-2 text-sm font-medium">
                            <span>Nome completo ou razão social</span>
                            <input
                              className={checkoutField}
                              name="name"
                              minLength={3}
                              maxLength={150}
                              required
                              autoComplete="name"
                              disabled={busy}
                            />
                          </label>
                          <label className="block space-y-2 text-sm font-medium">
                            <span>CPF ou CNPJ</span>
                            <input
                              className={checkoutField}
                              name="document"
                              inputMode="numeric"
                              minLength={11}
                              maxLength={18}
                              required
                              aria-describedby="mousefy-document-hint"
                              autoComplete="off"
                              disabled={busy}
                            />
                          </label>
                        </div>
                        <p
                          className="text-xs leading-5 text-muted-foreground"
                          id="mousefy-document-hint"
                        >
                          Seu nome, e-mail e CPF ou CNPJ são enviados à SyncPay para processar a
                          cobrança.
                        </p>
                      </div>
                      <fieldset className="space-y-2 border-t border-border pt-4" disabled={busy}>
                        <legend className="text-base font-semibold">Forma de pagamento</legend>
                        {methods.map((item) => (
                          <label
                            key={item}
                            className="flex cursor-pointer items-start gap-3 rounded-xl border border-border bg-background p-3.5 has-[:checked]:border-primary has-[:checked]:bg-primary/5 has-[:disabled]:cursor-not-allowed"
                          >
                            <input
                              type="radio"
                              name="billing-method"
                              className="mt-1 size-4 shrink-0 accent-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                              checked={method === item}
                              onChange={() => setMethod(item)}
                            />
                            <span>
                              <span className="block text-sm font-semibold">{names[item]}</span>
                              <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                                {methodDescriptions[item]}
                              </span>
                            </span>
                          </label>
                        ))}
                        {!methods.length && (
                          <p role="status">Nenhuma forma de pagamento disponível.</p>
                        )}
                      </fieldset>
                      {message && (
                        <p role="alert" className="text-sm text-brand-red">
                          {message}
                        </p>
                      )}
                      <button
                        type="submit"
                        className={primary + " w-full"}
                        disabled={busy || !methods.includes(method)}
                      >
                        <ScanLine className="size-4" aria-hidden />
                        {busy ? "Gerando Pix…" : "Gerar Pix"}
                      </button>
                    </section>
                    <aside
                      className="space-y-5 rounded-2xl border border-border border-t-primary bg-card p-4 sm:p-6"
                      aria-label="Resumo do plano"
                    >
                      <div>
                        <h3 className="text-sm font-medium text-muted-foreground">
                          Resumo do plano
                        </h3>
                        <p className="mt-1 text-xl font-semibold">
                          {selectedDetails?.name ?? selected.name}
                        </p>
                        <p className="mt-2 text-2xl font-semibold tracking-tight">
                          {money(selected.amount)} a cada{" "}
                          <span className="whitespace-nowrap">{selected.days} dias</span>
                        </p>
                      </div>
                      {selectedDetails && <PlanLimits details={selectedDetails} />}
                      <p className="border-t border-border pt-4 text-sm">
                        Acesso a todas as ferramentas do Mousefy
                      </p>
                      <p className="flex items-start gap-2 text-xs leading-5 text-muted-foreground">
                        <LockKeyhole className="mt-0.5 size-4 shrink-0" aria-hidden />O acesso é
                        liberado após a confirmação do primeiro pagamento.
                      </p>
                    </aside>
                  </div>
                </div>
              )}
            </form>
          )}
        </section>
      )}
      {access.status === "denied" && !current?.hasSubscription && (
        <p>Seu cadastro está indisponível para adesão.</p>
      )}
      {message && !selected && <p role="alert">{message}</p>}
      {current?.hasSubscription && (
        <section className="space-y-4 rounded-xl border border-border p-5">
          <h2 className="text-xl font-semibold">Cobranças</h2>
          {charges.isPending ? (
            <p role="status">Consultando cobranças…</p>
          ) : charges.isError ? (
            <p role="alert">Não foi possível consultar as cobranças.</p>
          ) : (
            <>
              {charges.data.charges.length ? (
                <ul className="divide-y divide-border">
                  {charges.data.charges.map((item, index) => (
                    <li key={String(item.cycle ?? index)} className="space-y-2 py-3">
                      <p>
                        Gerada em {day(item.chargeAt)} · {money(item.amount)} ·{" "}
                        {chargeLabels[String(item.status)] ?? "Em processamento"}
                      </p>
                      {item.paidAt && <p>Paga em {day(item.paidAt)}</p>}
                      {(item.payment?.code || item.payment?.image) && (
                        <PaymentInstructions
                          key={item.payment.code}
                          payment={item.payment}
                          method="qr_code"
                        />
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <p>Nenhuma cobrança neste período.</p>
              )}
              {charges.data.lastPage > 1 && (
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    className={button}
                    disabled={page <= 1}
                    onClick={() => setPage(page - 1)}
                  >
                    Anterior
                  </button>
                  <span>
                    Página {page} de {charges.data.lastPage}
                  </span>
                  <button
                    type="button"
                    className={button}
                    disabled={page >= charges.data.lastPage}
                    onClick={() => setPage(page + 1)}
                  >
                    Próxima
                  </button>
                </div>
              )}
              {charges.data.upcoming.length > 0 && (
                <>
                  <h3 className="font-semibold">Próximas cobranças</h3>
                  <ul>
                    {charges.data.upcoming.map((item, index) => (
                      <li key={String(item.cycle ?? index)}>
                        {day(item.date)} · {money(item.amount)}
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </>
          )}
        </section>
      )}
    </div>
  );
}
