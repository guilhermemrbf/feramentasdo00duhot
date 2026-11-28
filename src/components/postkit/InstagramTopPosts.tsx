import { usePlanAccess } from "@/components/access/PlatformAccessProvider";
import { useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ArrowUpRight, Instagram, TrendingUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { PostkitDatabase } from "@/lib/postkit-database";
import { WorkspaceSelect } from "@/components/ui/workspace-select";

const db = supabase as unknown as SupabaseClient<PostkitDatabase>;
const format = new Intl.NumberFormat("pt-BR");
const number = (value: number | null | undefined) => (value == null ? "—" : format.format(value));
const panel = "rounded-xl border border-border bg-card";
type Account = {
  id: string;
  username: string;
  issue: string | null;
  last_catalog_at: string | null;
};
type RankedReel = {
  position: number;
  account_id: string;
  media_id: string;
  username: string;
  views: number | null;
  interactions?: number;
  likes: number | null;
  comments: number | null;
  published_at: string;
  permalink: string | null;
};
type Report = {
  ranking_basis?: "engagement";
  accounts: Account[];
  ranking: RankedReel[];
  totals: {
    reels: number;
    measured: number;
    views: number | null;
    likes: number | null;
    comments: number | null;
    likes_measured: number;
    comments_measured: number;
  };
  leader: {
    username: string;
    interactions: number;
    likes: number;
    comments: number;
    measured: number;
  } | null;
};

function ReelLink({ reel }: { reel: RankedReel }) {
  if (!reel.permalink) return null;
  return (
    <a
      href={reel.permalink}
      target="_blank"
      rel="noreferrer"
      aria-label={`Abrir Reel do ${reel.position}º lugar no Instagram`}
      className="inline-flex items-center gap-1 text-sm font-semibold text-sky-300 hover:underline"
    >
      Ver Reel <ArrowUpRight className="size-3.5" aria-hidden />
    </a>
  );
}

export function InstagramTopPosts({
  workspaceId,
  timezone,
  onAnalytics,
}: {
  workspaceId: string;
  timezone: string;
  onAnalytics: () => void;
}) {
  const { canExecute } = usePlanAccess();
  const [account, setAccount] = useState("");
  const [snapshot, setSnapshot] = useState<{ account: string; report: Report }>();
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    if (!canExecute) return;
    let active = true;
    let loading = false;
    const load = async () => {
      if (loading) return;
      loading = true;
      try {
        const { data, error } = await db.rpc("get_instagram_top_posts", {
          p_workspace: workspaceId,
          p_account: account || null,
        });
        if (error || !data) throw new Error("Ranking unavailable");
        if (!active) return;
        const report = data as unknown as Report;
        if (account && !report.accounts.some((item) => item.id === account)) setAccount("");
        setSnapshot({ account, report });
        setError(false);
      } catch {
        if (active) setError(true);
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
  }, [account, workspaceId, retry, canExecute]);

  const accounts = snapshot?.report.accounts ?? [];
  const report = snapshot?.account === account ? snapshot.report : undefined;
  const totals = report?.totals;
  const byEngagement = report?.ranking_basis === "engagement";
  const ranking = report?.ranking ?? [];
  const leader = report?.leader;
  const date = new Intl.DateTimeFormat("pt-BR", { timeZone: timezone, dateStyle: "short" });
  const cards = [
    [
      "Visualizações",
      totals?.views,
      totals ? `${number(totals.measured)} Reels com medição` : "Leitura da Meta",
    ],
    [
      "Curtidas totais",
      totals?.likes,
      totals ? `${number(totals.likes_measured)} Reels com leitura` : "Leitura da Meta",
    ],
    [
      "Comentários",
      totals?.comments,
      totals ? `${number(totals.comments_measured)} Reels com leitura` : "Leitura da Meta",
    ],
    ["Reels encontrados", totals?.reels, "Publicados nos últimos 30 dias"],
  ] as const;

  return (
    <section aria-label="Top posts do Instagram" className="mt-4 space-y-4">
      <div className={`${panel} flex flex-wrap items-end justify-between gap-3 p-4`}>
        <div>
          <h2 className="font-semibold">Melhores publicações</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Reels publicados nos últimos 30 dias. Os totais refletem as leituras disponíveis da
            Meta.
          </p>
        </div>
        <label className="block w-full max-w-xs text-sm font-semibold">
          Conta do Instagram
          <WorkspaceSelect
            label="Conta do Instagram"
            className="mt-1"
            value={account}
            options={[
              { value: "", label: "Todas as contas conectadas" },
              ...accounts.map((item) => ({ value: item.id, label: `@${item.username}` })),
            ]}
            onValueChange={(value) => {
              setError(false);
              setAccount(value);
            }}
          />
        </label>
      </div>
      {error && (
        <p role="alert" className="rounded-lg bg-amber-500/10 p-3 text-sm text-amber-200">
          Não foi possível carregar o ranking.{" "}
          <button
            type="button"
            className="font-semibold underline"
            onClick={() => {
              setError(false);
              setRetry((value) => value + 1);
            }}
          >
            Tentar novamente
          </button>
        </p>
      )}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map(([label, value, detail], index) => (
          <div
            key={label}
            className={`metric-card ${panel} p-4`}
            data-tone={["info", "coral", "violet", "success"][index]}
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {label}
            </p>
            <p className="mt-2 text-2xl font-semibold tabular-nums">{number(value)}</p>
            <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
          </div>
        ))}
      </div>

      <section className={`${panel} p-4`}>
        <h2 className="flex items-center gap-2 font-semibold">
          <TrendingUp className="size-4 text-emerald-300" aria-hidden />{" "}
          {account && byEngagement
            ? "Engajamento da conta selecionada"
            : "Conta com mais engajamento"}
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Soma de curtidas e comentários dos Reels com as duas métricas disponíveis.
        </p>
        {leader ? (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-emerald-500/25 bg-emerald-500/10 p-3">
            <span className="inline-flex items-center gap-2 font-semibold text-emerald-200">
              <Instagram className="size-4" aria-hidden /> @{leader.username}
            </span>
            <span className="text-sm">
              <strong className="text-emerald-200">{number(leader.interactions)} interações</strong>
              <span className="block text-xs text-muted-foreground">
                {number(leader.likes)} curtidas · {number(leader.comments)} comentários ·{" "}
                {number(leader.measured)} Reels
              </span>
            </span>
          </div>
        ) : (
          report && (
            <p className="mt-3 text-sm text-muted-foreground">Aguardando dados de engajamento.</p>
          )
        )}
      </section>

      <section className={panel}>
        <div className="border-b border-border p-4">
          <h2 className="font-semibold">
            {byEngagement
              ? "Top 10 Reels por engajamento"
              : report
                ? "Top 10 Reels por visualizações"
                : "Top 10 Reels"}
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {byEngagement
              ? "Ordenado pela soma de curtidas e comentários."
              : report
                ? "A ordenação por engajamento depende da atualização do banco."
                : ""}
          </p>
        </div>
        {!canExecute && <p className="text-sm text-muted-foreground">Conecte uma conta para ver as melhores publicações.</p>}
        {canExecute && !report && !error && (
          <p role="status" className="p-4 text-sm text-muted-foreground">
            Carregando ranking…
          </p>
        )}
        {report && !ranking.length && (
          <div className="p-8 text-center">
            <p className="font-semibold">
              {byEngagement
                ? "Nenhum Reel com curtidas e comentários disponíveis"
                : "Nenhum Reel com visualizações medidas ainda"}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              O ranking aparece quando a Meta disponibilizar a primeira leitura.
            </p>
            <button
              type="button"
              onClick={onAnalytics}
              className="mt-3 text-sm font-semibold text-sky-300 hover:underline"
            >
              Conferir a coleta em Analytics
            </button>
          </div>
        )}
        {ranking.length > 0 && (
          <ol aria-label="Ranking de Reels" className="divide-y divide-border">
            {ranking.map((reel) => (
              <li
                key={reel.account_id + ":" + reel.media_id}
                className="grid items-center gap-3 p-4 sm:grid-cols-[2.5rem_minmax(0,1fr)_minmax(0,2fr)_auto]"
              >
                <span className="grid size-9 place-items-center rounded-lg bg-primary/10 text-sm font-semibold text-brand-red">
                  {reel.position}º
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">@{reel.username}</p>
                  <p className="text-xs text-muted-foreground">
                    {date.format(new Date(reel.published_at))}
                  </p>
                </div>
                <dl className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                  {[
                    [
                      "Interações",
                      reel.interactions ??
                        (reel.likes != null && reel.comments != null
                          ? reel.likes + reel.comments
                          : null),
                    ],
                    ["Visualizações", reel.views],
                    ["Curtidas", reel.likes],
                    ["Comentários", reel.comments],
                  ].map(([label, value]) => (
                    <div key={label}>
                      <dt className="text-muted-foreground">{label}</dt>
                      <dd className="mt-1 font-semibold tabular-nums">
                        {number(typeof value === "number" ? value : null)}
                      </dd>
                    </div>
                  ))}
                </dl>
                <ReelLink reel={reel} />
              </li>
            ))}
          </ol>
        )}
      </section>
    </section>
  );
}
