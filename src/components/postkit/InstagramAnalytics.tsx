import { useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ArrowUpRight, BarChart3, Eye, RefreshCw, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { PostkitDatabase } from "@/lib/postkit-database";
import { calendarDateInZone, zonedDateTimeToIso } from "@/lib/scheduling";

const db = supabase as unknown as SupabaseClient<PostkitDatabase>;
const numbers = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });
const showNumber = (value: number | null | undefined) =>
  value == null ? "—" : numbers.format(value);
const rangeOptions = [
  ["today", "Hoje"],
  ["yesterday", "Ontem"],
  ["week", "7 dias"],
  ["30d", "30 dias"],
  ["90d", "90 dias"],
  ["month", "Este mês"],
  ["previousMonth", "Mês passado"],
  ["all", "Todo o histórico"],
  ["custom", "Personalizado"],
] as const;
type Range = (typeof rangeOptions)[number][0];
const types = [
  ["reel", "Reels"],
  ["post", "Posts"],
  ["story", "Stories"],
] as const;
type Kind = (typeof types)[number][0];
type Account = { id: string; username: string; auth_mode: "instagram_login" | "facebook_login" };
type Profile = Account & {
  followers: number | null;
  following: number | null;
  issue: string | null;
  last_catalog_at: string | null;
  last_measured_at: string | null;
  reel_views: number | null;
  reels: number;
  measured: number;
};
type Totals = { kind: Kind; publications: number; measured: number; views: number | null };
type Report = {
  accounts: Account[];
  profiles: Profile[];
  totals: Totals[];
  reels: Array<{
    account_id: string;
    username: string;
    media_id: string;
    permalink: string | null;
    published_at: string;
    views: number | null;
  }>;
  statuses: Array<{ status: string; total: number }>;
};
const statuses: Record<string, string> = {
  scheduled: "Agendadas",
  processing: "Em andamento",
  published: "Publicadas",
  failed: "Com falha",
  needs_review: "Para revisar",
  cancelled: "Canceladas",
  draft: "Rascunhos",
};

function rangeDays(range: Range, timezone: string, customStart: string, customEnd: string) {
  const now = new Date();
  const day = (offset: number) => calendarDateInZone(timezone, offset, now);
  const today = day(0);
  if (range === "all") return { from: null, to: null };
  if (range === "custom") return { from: customStart, to: customEnd };
  if (range === "yesterday") return { from: day(-1), to: day(-1) };
  if (range === "month") return { from: today.slice(0, 7) + "-01", to: today };
  if (range === "previousMonth") {
    const previous = new Date(today.slice(0, 7) + "-01T00:00:00Z");
    previous.setUTCDate(0);
    const last = previous.toISOString().slice(0, 10);
    return { from: last.slice(0, 7) + "-01", to: last };
  }
  const offsets = { today: 0, week: -6, "30d": -29, "90d": -89 };
  return { from: day(offsets[range]), to: today };
}

function datesInZone(from: string | null, to: string | null, timezone: string) {
  if (!from || !to) return { start: null, end: null };
  const next = new Date(to + "T00:00:00Z");
  next.setUTCDate(next.getUTCDate() + 1);
  return {
    start: zonedDateTimeToIso(from, "00:00", timezone),
    end: zonedDateTimeToIso(next.toISOString().slice(0, 10), "00:00", timezone),
  };
}

function totalKnown(values: Array<number | null>) {
  const known = values.filter((value): value is number => value !== null);
  return known.length ? known.reduce((total, value) => total + value, 0) : null;
}

const surface = "rounded-xl border border-border bg-card";
const pill =
  "rounded-full border border-border px-3 py-1.5 text-sm hover:bg-secondary aria-pressed:border-sky-400/50 aria-pressed:bg-sky-700 aria-pressed:text-white";
const tableCell = "px-3 py-2.5";
const statusLabel = (profile: Profile) => {
  if (profile.issue === "permission") return "Autorize o acesso às métricas";
  if (profile.issue === "reconnect") return "Reconexão necessária";
  if (profile.issue === "temporary") return "Nova tentativa automática";
  if (!profile.last_catalog_at || profile.measured < profile.reels) return "Coletando dados";
  return profile.last_measured_at ? "Métricas coletadas" : "Sem medições de Reels";
};

function Metric({
  label,
  value,
  detail,
}: {
  label: string;
  value: number | null | undefined;
  detail?: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-background/35 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-semibold tabular-nums">{showNumber(value)}</p>
      {detail && <p className="mt-1 text-xs text-muted-foreground">{detail}</p>}
    </div>
  );
}

export function InstagramAnalytics({
  workspaceId,
  timezone,
  connecting,
  onAuthorize,
  onConnect,
}: {
  workspaceId: string;
  timezone: string;
  connecting: boolean;
  onAuthorize: (mode: Account["auth_mode"]) => void;
  onConnect: () => void;
}) {
  const [account, setAccount] = useState("");
  const [kind, setKind] = useState<Kind | "all">("all");
  const [range, setRange] = useState<Range>("30d");
  const [customStart, setCustomStart] = useState(() => calendarDateInZone(timezone, -29));
  const [customEnd, setCustomEnd] = useState(() => calendarDateInZone(timezone));
  const [page, setPage] = useState(0);
  const [reload, setReload] = useState(0);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [report, setReport] = useState<{ key: string; data: Report }>();
  const [error, setError] = useState("");
  const { from, to } = rangeDays(range, timezone, customStart, customEnd);
  const invalid = range === "custom" && (!from || !to || from > to);
  const key = JSON.stringify([account, from, to, page]);
  const data = report?.key === key ? report.data : undefined;

  useEffect(() => {
    if (invalid) return;
    let active = true;
    let loading = false;
    const load = async () => {
      if (loading) return;
      loading = true;
      try {
        const { start, end } = datesInZone(from, to, timezone);
        const { data, error } = await db.rpc("get_instagram_analytics", {
          p_workspace: workspaceId,
          p_account: account || null,
          p_start: start,
          p_end: end,
          p_page: page,
        });
        if (!active) return;
        if (error || !data) throw new Error("Não foi possível carregar as métricas do Instagram.");
        const result = data as unknown as Report;
        if (account && !result.accounts.some((item) => item.id === account)) {
          setAccount("");
          setPage(0);
        }
        setAccounts(result.accounts);
        setReport({ key, data: result });
        setError("");
      } catch {
        if (active) setError("Não foi possível carregar as métricas. Tente atualizar o painel.");
      } finally {
        loading = false;
      }
    };
    void load();
    const timer = window.setInterval(() => void load(), 30_000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [workspaceId, timezone, account, from, to, page, key, invalid, reload]);

  const current = data?.totals.filter((item) => kind === "all" || item.kind === kind);
  const posts = current?.reduce((sum, item) => sum + item.publications, 0);
  const measured = current?.reduce((sum, item) => sum + item.measured, 0) ?? 0;
  const views = totalKnown(current?.map((item) => item.views) ?? []);
  const profiles = data?.profiles ?? [];
  const reelCount = data?.totals.find((item) => item.kind === "reel")?.publications ?? 0;
  const dateFormat = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeZone: timezone });
  const rangeText =
    from && to
      ? `${from.split("-").reverse().join("/")} a ${to.split("-").reverse().join("/")}`
      : "Todo o histórico";
  const updateRange = (value: Range) => {
    setRange(value);
    setPage(0);
    setError("");
  };
  const authNeeded = profiles.some((profile) =>
    ["permission", "reconnect"].includes(profile.issue ?? ""),
  );

  return (
    <section aria-label="Métricas do Instagram" className="mt-4 space-y-4">
      <div className={`${surface} space-y-4 p-4`}>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <label className="block w-full max-w-xs text-sm font-semibold">
            Conta do Instagram
            <select
              className="field mt-1"
              value={account}
              onChange={(event) => {
                setAccount(event.target.value);
                setPage(0);
                setError("");
              }}
            >
              <option value="">Todas as contas conectadas</option>
              {accounts.map((item) => (
                <option key={item.id} value={item.id}>
                  @{item.username}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={() => {
              setError("");
              setReload((n) => n + 1);
            }}
            className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm font-semibold hover:bg-secondary"
          >
            <RefreshCw className="size-4" aria-hidden /> Atualizar painel
          </button>
        </div>
        <div role="group" aria-label="Período" className="flex flex-wrap gap-2">
          {rangeOptions.map(([value, label]) => (
            <button
              key={value}
              type="button"
              className={pill}
              aria-pressed={range === value}
              onClick={() => updateRange(value)}
            >
              {label}
            </button>
          ))}
        </div>
        {range === "custom" && (
          <div className="flex flex-wrap gap-3">
            <label className="text-sm">
              Data inicial
              <input
                className="field mt-1"
                type="date"
                value={customStart}
                onChange={(e) => {
                  setCustomStart(e.target.value);
                  setPage(0);
                }}
              />
            </label>
            <label className="text-sm">
              Data final
              <input
                className="field mt-1"
                type="date"
                value={customEnd}
                min={customStart}
                onChange={(e) => {
                  setCustomEnd(e.target.value);
                  setPage(0);
                }}
              />
            </label>
          </div>
        )}
        <p className="text-xs text-muted-foreground">
          {invalid ? "Informe as datas inicial e final na ordem correta." : rangeText}
        </p>
      </div>

      {error && (
        <p role="alert" className="rounded-lg bg-amber-500/10 p-3 text-sm text-amber-200">
          {error}
        </p>
      )}
      {!data && !error && !invalid && (
        <p role="status" className="text-sm text-muted-foreground">
          Carregando métricas…
        </p>
      )}
      {data && !accounts.length && (
        <button type="button" onClick={onConnect} className="font-semibold text-primary">
          Conectar uma conta do Instagram
        </button>
      )}
      {authNeeded && (
        <p className="rounded-lg bg-amber-500/10 p-3 text-sm text-amber-200">
          Algumas contas precisam de autorização para ler as métricas. Confira a seção Contas
          conectadas.
        </p>
      )}

      <div className={surface}>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-4">
          <h2 className="flex items-center gap-2 font-semibold">
            <BarChart3 className="size-4 text-sky-300" aria-hidden /> Desempenho das publicações
          </h2>
          <div role="group" aria-label="Tipo de publicação" className="flex flex-wrap gap-2">
            {([["all", "Todos"], ...types] as const).map(([value, label]) => (
              <button
                type="button"
                key={value}
                className={pill}
                aria-pressed={kind === value}
                onClick={() => setKind(value)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="grid gap-3 p-4 sm:grid-cols-3">
          <Metric label="Publicações encontradas" value={posts} />
          <Metric
            label="Visualizações das publicações"
            value={views}
            detail={measured ? `${measured} de ${posts} com medição` : "Sem medição ainda"}
          />
          <Metric
            label="Média de views por publicação"
            value={views !== null && measured ? views / measured : null}
            detail="Entre publicações com medição"
          />
        </div>
        <p className="px-4 pb-3 text-xs text-muted-foreground">
          O período filtra pela data de publicação. As views são acumuladas até a última leitura.
          Stories ficam disponíveis para coleta enquanto estão ativos no Instagram.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[400px] text-left text-sm">
            <thead className="border-y border-border text-xs uppercase text-muted-foreground">
              <tr>
                <th className={tableCell}>Tipo</th>
                <th className={tableCell}>Publicações</th>
                <th className={tableCell}>Views</th>
                <th className={tableCell}>Média por publicação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {types
                .filter(([value]) => kind === "all" || kind === value)
                .map(([value, label]) => {
                  const row = data?.totals.find((item) => item.kind === value);
                  return (
                    <tr key={value}>
                      <th className={tableCell} scope="row">
                        {label}
                      </th>
                      <td className={tableCell}>
                        {showNumber(data ? (row?.publications ?? 0) : null)}
                      </td>
                      <td className={tableCell}>{showNumber(row?.views)}</td>
                      <td className={tableCell}>
                        {showNumber(
                          row?.views != null && row.measured ? row.views / row.measured : null,
                        )}
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric
          label="Views de Reels das contas"
          value={totalKnown(profiles.map((p) => p.reel_views))}
          detail="Todo o histórico coletado"
        />
        <Metric
          label="Total de seguidores"
          value={totalKnown(profiles.map((p) => p.followers))}
          detail="Última leitura disponível"
        />
        <Metric
          label="Total seguindo"
          value={totalKnown(profiles.map((p) => p.following))}
          detail="Última leitura disponível"
        />
        <Metric label="Contas selecionadas" value={data ? profiles.length : null} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <section className={`${surface} min-w-0 p-4`}>
          <h2 className="flex items-center gap-2 font-semibold">
            <Users className="size-4 text-sky-300" aria-hidden /> Contas conectadas
          </h2>
          <ul className="mt-2 divide-y divide-border">
            {profiles.map((profile) => (
              <li
                key={profile.id}
                className="flex flex-wrap items-start justify-between gap-2 py-3 text-sm"
              >
                <div>
                  <p className="font-semibold">@{profile.username}</p>
                  <p className="text-xs text-muted-foreground">
                    {statusLabel(profile)}
                    {profile.last_measured_at &&
                      ` · ${dateFormat.format(new Date(profile.last_measured_at))}`}
                  </p>
                  {profile.measured < profile.reels && (
                    <p className="text-xs text-muted-foreground">
                      {profile.measured} de {profile.reels} Reels com views medidas
                    </p>
                  )}
                </div>
                <div className="text-xs text-muted-foreground">
                  <p>
                    {showNumber(profile.followers)} seguidores · {showNumber(profile.following)}{" "}
                    seguindo
                  </p>
                  <p>{showNumber(profile.reel_views)} views de Reels no histórico</p>
                  {(profile.issue === "permission" ||
                    profile.issue === "reconnect" ||
                    (profile.last_catalog_at && profile.reels > 0 && !profile.measured)) && (
                    <button
                      type="button"
                      disabled={connecting}
                      onClick={() => onAuthorize(profile.auth_mode)}
                      className="mt-1 font-semibold text-sky-300 hover:underline disabled:opacity-50"
                    >
                      Autorizar métricas
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
          {data && !profiles.length && (
            <p className="mt-3 text-sm text-muted-foreground">Sem contas para exibir.</p>
          )}
        </section>
        <section className={`${surface} p-4`}>
          <h2 className="font-semibold">Status das publicações do 00duHot</h2>
          {data && !data.statuses.length && (
            <p className="mt-3 text-sm text-muted-foreground">
              Nenhuma publicação do painel no período.
            </p>
          )}
          <dl className="mt-2 space-y-2 text-sm">
            {data?.statuses.map(({ status, total }) => (
              <div key={status} className="flex justify-between gap-2">
                <dt>{statuses[status] ?? status}</dt>
                <dd>{showNumber(total)}</dd>
              </div>
            ))}
          </dl>
        </section>
      </div>

      <section className={surface}>
        <div className="border-b border-border p-4">
          <h2 className="flex items-center gap-2 font-semibold">
            <Eye className="size-4 text-sky-300" aria-hidden /> Visualizações por Reel
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[390px] text-left text-sm">
            <thead className="border-b border-border text-xs uppercase text-muted-foreground">
              <tr>
                <th className={tableCell}>Conta</th>
                <th className={tableCell}>Publicado em</th>
                <th className={tableCell}>Views</th>
                <th className={tableCell}>Reel</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data?.reels.map((reel) => (
                <tr key={reel.account_id + ":" + reel.media_id}>
                  <td className={tableCell}>@{reel.username}</td>
                  <td className={tableCell}>{dateFormat.format(new Date(reel.published_at))}</td>
                  <td className={tableCell}>{showNumber(reel.views)}</td>
                  <td className={tableCell}>
                    {reel.permalink ? (
                      <a
                        href={reel.permalink}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-sky-300 hover:underline"
                      >
                        Abrir no Instagram <ArrowUpRight className="size-3" aria-hidden />
                      </a>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {data && !reelCount && (
          <p className="p-4 text-sm text-muted-foreground">
            Nenhum Reel encontrado no período. A primeira coleta pode levar alguns minutos.
          </p>
        )}
        {reelCount > 25 && (
          <div className="flex flex-wrap items-center gap-2 border-t border-border p-3 text-sm">
            <button
              type="button"
              className="rounded-md border border-border px-3 py-1.5 disabled:opacity-40"
              disabled={page === 0}
              onClick={() => setPage(page - 1)}
            >
              Anterior
            </button>
            <span>
              Página {page + 1} de {Math.ceil(reelCount / 25)}
            </span>
            <button
              type="button"
              className="rounded-md border border-border px-3 py-1.5 disabled:opacity-40"
              disabled={(page + 1) * 25 >= reelCount}
              onClick={() => setPage(page + 1)}
            >
              Próxima
            </button>
          </div>
        )}
      </section>
    </section>
  );
}
