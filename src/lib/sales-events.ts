export const SALES_PROVIDERS = {
  omegapay: "OmegaPay",
  syncpay: "Syncpay",
  wiinpay: "Wiinpay",
  hotmart: "Hotmart",
  kiwify: "Kiwify",
  monetizze: "Monetizze",
  pepper: "Pepper",
  custom: "Webhook personalizado",
} as const;

export type SalesProvider = keyof typeof SALES_PROVIDERS;
export const SALES_CONNECTION_PROVIDERS = ["omegapay", "syncpay", "wiinpay"] as const;
export type SalesConnectionProvider = (typeof SALES_CONNECTION_PROVIDERS)[number];
export const SALES_PERIODS = [
  { key: "today", label: "Hoje" },
  { key: "yesterday", label: "Ontem" },
  { key: "7d", label: "7 dias" },
  { key: "30d", label: "30 dias" },
  { key: "month", label: "Este mês" },
  { key: "2m", label: "2 meses" },
  { key: "all", label: "Total" },
] as const;
export type SalesPeriod = (typeof SALES_PERIODS)[number]["key"];
export type SaleKind = "approved" | "reversed";
export type SaleEvent = {
  externalId: string;
  kind: SaleKind;
  amountCents: number;
  netCents: number | null;
  occurredAt: string | null;
};

type Fields = Record<string, unknown>;
type ProviderEvent = {
  id: unknown;
  status: string;
  amount: unknown;
  net?: unknown;
  currency?: unknown;
  netCurrency?: unknown;
  date?: unknown;
  units?: "cents";
};

function fields(value: unknown): Fields {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Fields) : {};
}

function status(value: unknown) {
  return typeof value === "string" ? value.trim().toUpperCase() : "";
}

function cents(value: unknown, units: ProviderEvent["units"]) {
  if (typeof value !== "number" && typeof value !== "string") return null;
  const str = String(value).trim();
  if (!/^\d{1,10}(?:\.\d{1,2})?$/.test(str)) return null;
  const [whole, fraction = ""] = str.split(".");
  if (units === "cents" && fraction) return null;
  const result =
    units === "cents" ? Number(whole) : Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  return result <= 1_000_000_000_000 ? result : null;
}

function timestamp(value: unknown) {
  if (typeof value !== "number" && typeof value !== "string") return null;
  if (typeof value === "string" && !/(?:Z|[+-]\d\d:\d\d)$/i.test(value)) return null;
  const ms = typeof value === "number" ? value : Date.parse(value);
  return Number.isFinite(ms) && ms >= Date.UTC(2000, 0, 1) ? new Date(ms).toISOString() : null;
}

const adapters: Record<SalesProvider, (body: Fields) => ProviderEvent | null> = {
  omegapay(body) {
    const tx = fields(body.transaction);
    const event = status(body.event);
    const originalCurrency = status(tx.originalCurrency);
    return {
      id: tx.id ?? tx.identifier,
      status: event,
      amount: tx.amount ?? (originalCurrency === "BRL" ? tx.originalAmount : undefined),
      net: event === "TRANSACTION_PAID" ? tx.commissionAmount : undefined,
      currency: tx.currency,
      date: event === "TRANSACTION_PAID" ? tx.payedAt : undefined,
    };
  },
  syncpay(body) {
    const source = body.data ? fields(body.data) : body;
    if (
      /cash[_\s-]?out|withdraw|saque|payout|transfer/i.test(
        String(
          source.transaction_type ??
            source.type ??
            source.operation ??
            body.transaction_type ??
            body.type ??
            body.operation ??
            "",
        ),
      ) ||
      source.seller ||
      body.seller ||
      source.beneficiary ||
      source.beneficiary_name ||
      (!source.client &&
        !body.client &&
        (source.pix_key || body.pix_key || source.pix_type || body.pix_type))
    )
      return null;
    return {
      id:
        source.idtransaction ??
        source.transaction_id ??
        source.transactionId ??
        source.id ??
        body.idtransaction ??
        body.id ??
        source.externalreference ??
        body.externalreference ??
        source.end_to_end,
      status: status(source.status ?? body.status),
      amount: source.amount ?? body.amount,
      net:
        source.deposito_liquido ?? source.liquid_amount ?? source.final_amount ?? source.net_amount,
      currency: source.currency ?? body.currency,
    };
  },
  wiinpay(body) {
    const data = body.data ? fields(body.data) : body;
    return {
      id: data.id ?? body.id,
      status: status(body.event),
      amount: data.amount,
      net: data.net_amount,
      currency: data.currency,
    };
  },
  hotmart(body) {
    const purchase = fields(fields(body.data).purchase);
    const price = fields(purchase.price);
    const commission = fields(purchase.commission);
    return {
      id: purchase.transaction,
      status: status(body.event),
      amount: price.value,
      net: commission.value,
      currency: price.currency_value,
      netCurrency: commission.currency_value,
      date: body.creation_date,
    };
  },
  kiwify(body) {
    const commission = fields(body.Commissions);
    return {
      id: body.order_id,
      status: status(body.order_status),
      amount: commission.charge_amount,
      net: commission.my_commission,
      currency: commission.currency,
      units: "cents",
    };
  },
  monetizze(body) {
    const sale = body.venda ? fields(body.venda) : body;
    return {
      id: sale.codigo ?? body.id,
      status: status(sale.status),
      amount: sale.valor,
      net: sale.valor_comissao,
      currency: sale.moeda,
    };
  },
  pepper(body) {
    return {
      id: body.transaction_id ?? body.id,
      status: status(body.event ?? body.status),
      amount: body.amount,
      net: body.net_amount ?? body.liquid_amount,
      currency: body.currency,
    };
  },
  custom(body) {
    return {
      id: body.transaction_id,
      status: status(body.status),
      amount: body.amount_cents,
      net: body.net_cents,
      currency: body.currency,
      units: "cents",
      date: body.occurred_at,
    };
  },
};

const eventStates: Record<SalesProvider, [approved: string[], reversed: string[]]> = {
  omegapay: [["TRANSACTION_PAID"], ["TRANSACTION_REFUNDED", "TRANSACTION_CHARGED_BACK"]],
  syncpay: [
    ["PAID", "PAID_OUT", "COMPLETED"],
    ["MED", "REFUNDED", "REFUND", "CHARGEBACK"],
  ],
  wiinpay: [["PAYMENT.APPROVED"], ["PAYMENT.REFUNDED", "PAYMENT.CHARGEBACK"]],
  hotmart: [["PURCHASE_APPROVED"], ["PURCHASE_REFUNDED", "PURCHASE_CHARGEBACK"]],
  kiwify: [["PAID"], ["REFUNDED", "CHARGEDBACK"]],
  monetizze: [["FINALIZADA", "APROVADA"], ["REEMBOLSADA"]],
  pepper: [["APPROVED"], ["REFUNDED", "CHARGEBACK"]],
  custom: [["APPROVED"], ["REFUNDED", "CHARGEBACK"]],
};

export function parseSaleEvent(
  provider: SalesProvider,
  payload: unknown,
): { result: "event"; event: SaleEvent } | { result: "ignored" | "invalid" } {
  if (!payload || typeof payload !== "object" || Array.isArray(payload))
    return { result: "invalid" };
  const data = adapters[provider](fields(payload));
  if (!data) return { result: "ignored" };
  const [approved, reversed] = eventStates[provider];
  const kind = approved.includes(data.status)
    ? "approved"
    : reversed.includes(data.status)
      ? "reversed"
      : null;
  if (!kind) return { result: "ignored" };
  const currency = status(data.currency);
  if (currency && currency !== "BRL") return { result: "ignored" };
  if (!currency && ["hotmart", "kiwify", "custom"].includes(provider)) return { result: "invalid" };
  const id =
    typeof data.id === "string" || typeof data.id === "number" ? String(data.id).trim() : "";
  const amountCents = cents(data.amount, data.units);
  if (!id || id.length > 160 || amountCents === null || amountCents === 0)
    return { result: "invalid" };
  const netCents =
    status(data.netCurrency) && status(data.netCurrency) !== "BRL"
      ? null
      : cents(data.net, data.units);
  return {
    result: "event",
    event: {
      externalId: id,
      kind,
      amountCents,
      netCents:
        provider === "omegapay" && netCents !== null && netCents > amountCents ? null : netCents,
      occurredAt: timestamp(data.date),
    },
  };
}

export function salesDashboardAmounts(data: {
  approved: number;
  with_net: number;
  gross_cents: number;
  reported_net_cents: number | null;
  reversed_cents: number;
}) {
  const reported = data.reported_net_cents;
  const net = data.approved === 0 ? 0 : data.with_net === data.approved ? reported : null;
  return {
    net,
    deductions: net === null || net > data.gross_cents ? null : data.gross_cents - net,
    beforeCosts: net === null ? null : net - data.reversed_cents,
  };
}

export function salesMoney(cents: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}
