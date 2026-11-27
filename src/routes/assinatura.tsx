import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { ArrowRight, CircleCheck } from "lucide-react";
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

function PaymentInstructions({
  payment,
}: {
  payment: { code?: string; image?: string; expiresAt?: string };
}) {
  const [copy, setCopy] = useState("");
  return (
    <div className="space-y-3">
      {payment.image && (
        <img
          className="rounded-lg bg-white"
          width={256}
          height={256}
          alt="QR Code do pagamento Pix"
          src={payment.image}
          referrerPolicy="no-referrer"
        />
      )}
      {payment.code && (
        <>
          <label className="block space-y-1">
            <span>Código Pix</span>
            <input
              className={field}
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
            Copiar código Pix
          </button>
          <p role="status">{copy}</p>
        </>
      )}
      {payment.expiresAt && <p>Pagamento disponível até {day(payment.expiresAt)}.</p>}
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
  const methods = accepted ?? selected?.methods ?? [];
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
        plan,
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
          className="space-y-4 rounded-xl border border-border p-5"
          aria-label="Estado da assinatura"
        >
          <h2 className="text-xl font-semibold">
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
          {current.payment && !current.closed && <PaymentInstructions payment={current.payment} />}
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
          <h2 className="text-xl font-semibold">
            {selected ? "Finalizar assinatura" : "Escolha seu plano"}
          </h2>
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
                <div
                  className="mousefy-pricing relative isolate min-w-0 overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950 p-4 text-zinc-50 sm:p-6"
                >
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
                        Escolha o período de assinatura ideal para você.
                      </p>
                    </div>
                    <div className="pricing-grid">
                      {plans.data.map((entry, index) => (
                        <article
                          key={entry.token}
                          style={{ animationDelay: `${index * 70}ms` }}
                          className="pricing-card relative flex min-w-0 flex-col gap-4 rounded-xl border border-zinc-800 bg-zinc-900/90 p-4 transition-colors hover:border-zinc-500 sm:p-5"
                        >
                          <h4 className="break-words text-base font-semibold">{entry.name}</h4>
                          <div>
                            <span className="block text-2xl font-bold tracking-tight text-white sm:text-3xl">
                              {money(entry.amount)}
                            </span>
                            <span className="mt-1 block text-sm text-zinc-400">
                              A cada {entry.days} dias
                            </span>
                          </div>
                          <div className="flex-1 border-t border-zinc-700 pt-4">
                            <p className="mb-3 text-sm font-semibold text-zinc-100">Inclui:</p>
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
                            aria-label={`Selecionar plano ${entry.name}`}
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
                <div className="mx-auto max-w-2xl space-y-4">
                  <button
                    type="button"
                    className={button}
                    disabled={busy}
                    onClick={() => {
                      setPlan("");
                      setAccepted(undefined);
                      setMessage("");
                    }}
                  >
                    Voltar aos planos
                  </button>
                  <div className="rounded-xl border border-border bg-card p-4">
                    <p className="text-sm text-muted-foreground">Plano selecionado</p>
                    <p className="mt-1 text-lg font-semibold">{selected.name}</p>
                    <p>{money(selected.amount)} a cada {selected.days} dias</p>
                  </div>
                  <label className="block space-y-1">
                    <span>Forma de pagamento</span>
                    <select
                      className={field}
                      required
                      disabled={!methods.length || busy}
                      value={method}
                      onChange={(event) => setMethod(event.target.value as BillingMethod)}
                    >
                      {methods.map((item) => (
                        <option key={item} value={item}>
                          {names[item]}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block space-y-1">
                    <span>Nome completo ou razão social</span>
                    <input
                      className={field}
                      name="name"
                      minLength={3}
                      maxLength={150}
                      required
                      autoComplete="name"
                      disabled={busy}
                    />
                  </label>
                  <label className="block space-y-1">
                    <span>CPF ou CNPJ</span>
                    <input
                      className={field}
                      name="document"
                      inputMode="numeric"
                      minLength={11}
                      maxLength={18}
                      required
                      autoComplete="off"
                      disabled={busy}
                    />
                  </label>
                  <p className="text-sm text-muted-foreground">
                    Seu nome, e-mail e CPF ou CNPJ são enviados à SyncPay para processar a cobrança.
                  </p>
                  {selected && (
                    <p>
                      {money(selected.amount)} a cada {selected.days} dias. O acesso é liberado quando o
                      primeiro pagamento for confirmado.
                    </p>
                  )}
                  <button
                    type="submit"
                    className={primary}
                    disabled={busy || !selected || !methods.length}
                  >
                    {busy ? "Processando…" : "Assinar com Pix"}
                  </button>
                </div>
              )}
            </form>
          )}
        </section>
      )}
      {access.status === "denied" && !current?.hasSubscription && (
        <p>Seu cadastro está indisponível para adesão.</p>
      )}
      {message && <p role="alert">{message}</p>}
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
                      {item.payment?.code &&
                        current.method === "qr_code" &&
                        current.paymentStatus !== "aguardando" && (
                          <PaymentInstructions payment={item.payment} />
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
