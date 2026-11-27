// From Uiverse.io by zanina-yassine - https://uiverse.io/zanina-yassine/angry-shrimp-34
// MIT License, Copyright (c) zanina-yassine (Yassine Zanina)
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
const planDetails: Record<
  string,
  { name: string; instagram: string; ads: number; telegram: number }
> = {
  "b51f6f0f-4d23-48c8-a2e7-1037849aa8a9": {
    name: "Essencial",
    instagram: "50",
    ads: 3,
    telegram: 3,
  },
  "26a29855-68aa-4a80-bd53-2200ce44c471": {
    name: "Crescimento",
    instagram: "100",
    ads: 5,
    telegram: 5,
  },
  "44aa1915-be2f-4b0c-b386-7b75181c23eb": { name: "Pro", instagram: "150", ads: 8, telegram: 8 },
  "66b2964c-c281-4c8c-b902-ced6d567bcbd": {
    name: "Escala",
    instagram: "1.000",
    ads: 15,
    telegram: 15,
  },
};
type Action = "cancel" | "suspend" | "reactivate";
const paymentLabels: Record<string, string> = {
  aguardando: "Aguardando o primeiro pagamento",
  em_dia: "Pagamento em dia",
  pendente: "Pagamento pendente",
  bloqueado: "Acesso da assinatura suspenso",
};
const button = "saas-button saas-button-outline";
const primary = "saas-button saas-button-primary";
const field = "w-full rounded-lg border border-input bg-background px-3 py-2 text-foreground";
const checkoutField =
  "h-11 w-full rounded-[9px] border border-border bg-background px-4 text-foreground transition-[background-color,box-shadow] duration-300 ease-[cubic-bezier(0.15,0.83,0.66,1)] focus:bg-transparent focus:outline-none focus:ring-2 focus:ring-primary motion-reduce:transition-none";

function PlanLimits({ details }: { details: (typeof planDetails)[string] }) {
  return (
    <dl className="grid gap-2.5 text-sm">
      <div>
        <dt className="text-xs text-muted-foreground">Automatic Post</dt>
        <dd className="font-semibold">Até {details.instagram} contas do Instagram</dd>
      </div>
      <div>
        <dt className="text-xs text-muted-foreground">Traqueamento avançado</dt>
        <dd className="font-semibold">Até {details.ads} contas de anúncio</dd>
        <dd className="text-xs text-muted-foreground">Meta Ads e Google Ads</dd>
      </div>
      <div>
        <dt className="text-xs text-muted-foreground">Telegram Sync</dt>
        <dd className="font-semibold">Até {details.telegram} contas do Telegram</dd>
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
    <div className="mx-auto max-w-md space-y-5 rounded-[26px] border border-border bg-card p-5 shadow-xl sm:p-6">
      <div className="text-center">
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
      {payment.image && (
        <img
          className="mx-auto aspect-square w-full max-w-72 rounded-xl bg-white object-contain p-3"
          width={320}
          height={320}
          alt="QR Code do pagamento Pix"
          src={payment.image}
          referrerPolicy="no-referrer"
        />
      )}
      <div className="min-w-0 space-y-4">
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
              className={button + " w-full"}
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
            <p className="mt-2 text-sm text-muted-foreground">
              Compare os limites de contas de cada plano do Mousefy.
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
  const canPayRenewal =
    !!current?.hasSubscription &&
    !current.closed &&
    current.method === "qr_code" &&
    current.paymentStatus !== "aguardando";
  const renewal = useQuery({
    queryKey: ["mousefy-renewal", user, current?.paymentStatus, current?.nextChargeAt],
    queryFn: async () => {
      let page = 1;
      let lastPage: number;
      do {
        const result = await getMousefyCharges({ data: page++ });
        const payable = result.charges.find(({ payment }) => payment?.image || payment?.code);
        if (payable?.payment) return payable;
        lastPage = result.lastPage;
      } while (page <= lastPage);
      return null;
    },
    enabled: canPayRenewal,
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
      client.invalidateQueries({ queryKey: ["mousefy-renewal", user] }),
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
          {canPayRenewal && renewal.data?.payment && (
            <div className="space-y-3">
              <p className="text-center text-sm font-semibold">
                Pix da renovação · {money(renewal.data.amount)}
              </p>
              <PaymentInstructions
                key={renewal.data.payment.code}
                payment={renewal.data.payment}
                method="qr_code"
              />
            </div>
          )}
          {canPayRenewal && renewal.isError && (
            <p role="alert">Não foi possível consultar o Pix da renovação. Tente atualizar.</p>
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
        <section className="space-y-4" aria-label="Planos">
          {plans.isPending ? (
            <p role="status">Consultando os planos…</p>
          ) : plans.isError ? (
            <p role="alert">Os planos estão temporariamente indisponíveis.</p>
          ) : !plans.data.length ? (
            <p>Nenhum plano disponível para adesão agora.</p>
          ) : (
            <form className="space-y-4" onSubmit={submit}>
              {!selected ? (
                <>
                  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    {plans.data.map((entry) => {
                      const details = planDetails[entry.token];
                      const name = details?.name ?? entry.name;
                      const featured = name === "Pro";
                      return (
                        <article
                          key={entry.token}
                          className={`flex min-w-0 flex-col gap-4 rounded-2xl border p-4 transition-colors sm:p-5 ${
                            featured
                              ? "border-emerald-400/50 bg-emerald-400/5 hover:border-emerald-400"
                              : "border-border bg-card hover:border-muted-foreground/60"
                          }`}
                        >
                          <div>
                            <h3 className="text-base font-semibold">{name}</h3>
                            <p className="mt-2 font-display text-2xl font-bold tracking-tight text-emerald-300">
                              {money(entry.amount)}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              A cada {entry.days} dias
                            </p>
                          </div>
                          <div className="flex-1 border-t border-border pt-3">
                            {details && <PlanLimits details={details} />}
                          </div>
                          <p className="flex items-start gap-2 text-sm font-medium">
                            <CircleCheck
                              aria-hidden
                              className="mt-0.5 size-4 shrink-0 text-emerald-400"
                            />
                            Acesso a todas as ferramentas
                          </p>
                          <button
                            type="button"
                            disabled={busy}
                            aria-label={`Selecionar plano ${name} — ${money(entry.amount)}`}
                            className="flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm font-semibold transition-colors hover:border-primary hover:text-brand-red focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-50"
                            onClick={() => {
                              setPlan(entry.token);
                              setAccepted(undefined);
                              setMethod(entry.methods[0] ?? "pix_automatico");
                              setMessage("");
                            }}
                          >
                            Selecionar plano
                            <ArrowRight aria-hidden className="size-4 shrink-0" />
                          </button>
                        </article>
                      );
                    })}
                  </div>
                  <p className="text-xs leading-5 text-muted-foreground">
                    O limite de contas de anúncio vale para Meta Ads (Facebook e Instagram) e Google
                    Ads.
                  </p>
                </>
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
                  <div className="grid grid-cols-[minmax(0,450px)] justify-center gap-5 lg:grid-cols-[minmax(0,450px)_minmax(16rem,20rem)] lg:items-start">
                    <section
                      className="flex min-w-0 flex-col gap-5 rounded-[26px] border border-border bg-card p-5 shadow-[0_12px_26px_rgba(0,0,0,0.24)]"
                      aria-label="Dados e forma de pagamento"
                    >
                      <div className="space-y-3">
                        <h3 className="text-base font-semibold">Dados de cobrança</h3>
                        <div className="grid gap-[15px]">
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
                      <fieldset
                        className="grid min-w-0 grid-cols-1 gap-2 min-[420px]:grid-cols-2"
                        disabled={busy}
                      >
                        <legend className="mb-3 w-full text-center text-xs font-semibold text-muted-foreground">
                          <span className="flex items-center gap-2.5 before:h-px before:flex-1 before:bg-border after:h-px after:flex-1 after:bg-border">
                            Forma de pagamento
                          </span>
                        </legend>
                        {methods.map((item) => (
                          <label
                            key={item}
                            className="flex min-h-[55px] cursor-pointer items-start gap-2.5 rounded-[11px] border border-border bg-background p-3 transition-colors has-[:checked]:border-primary has-[:checked]:bg-primary/5 has-[:disabled]:cursor-not-allowed motion-reduce:transition-none"
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
                        className="flex h-[55px] w-full items-center justify-center gap-2 rounded-[11px] bg-linear-to-b from-[#c62c3a] to-[#971b29] text-sm font-bold text-white transition-shadow duration-300 ease-[cubic-bezier(0.15,0.83,0.66,1)] hover:shadow-[0_0_0_2px_var(--card),0_0_0_4px_var(--primary)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-60 motion-reduce:transition-none"
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
    </div>
  );
}
