import { useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ArrowUpRight, Crown, Instagram, TrendingUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { PostkitDatabase } from "@/lib/postkit-database";
import { WorkspaceSelect } from "@/components/ui/workspace-select";

const db = supabase as unknown as SupabaseClient<PostkitDatabase>;
const format = new Intl.NumberFormat("pt-BR");
const number = (value: number | null | undefined) => (value == null ? "—" : format.format(value));
const panel = "rounded-xl border border-border bg-card";
const podium = [
  "sm:col-start-2 border-amber-400/40 bg-amber-400/10 text-amber-200 sm:min-h-56",
  "sm:col-start-1 border-slate-300/30 bg-slate-300/10 text-slate-200 sm:min-h-48",
  "sm:col-start-3 border-orange-500/30 bg-orange-500/10 text-orange-200 sm:min-h-44",
];

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
  views: number;
  likes: number | null;
  comments: number | null;
  published_at: string;
  permalink: string | null;
};
type Report = {
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
  const [account, setAccount] = useState("");
  const [snapshot, setSnapshot] = useState<{ account: string; report: Report }>();
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
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
  }, [account, workspaceId, retry]);

  const accounts = snapshot?.report.accounts ?? [];
  const report = snapshot?.account === account ? snapshot.report : undefined;
  const totals = report?.totals;
  const ranking = report?.ranking ?? [];
  const leader = report?.leader;
  const date = new Intl.DateTimeFormat("pt-BR", { timeZone: timezone, dateStyle: "short" });
  const cards = [
    [
      "Views totais",
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
          <h2 className="font-semibold">Os Reels mais vistos</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Publicações dos últimos 30 dias, com views acumuladas até a última leitura.
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
          <TrendingUp className="size-4 text-emerald-300" aria-hidden /> Conta com mais engajamento
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Entre todas as contas conectadas, pela soma de curtidas e comentários dos Reels com as
          duas métricas disponíveis.
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
          <h2 className="font-semibold">Top 10 de Reels por visualizações</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            O @ abaixo das views identifica o perfil que publicou o Reel.
          </p>
        </div>
        {!report && !error && (
          <p role="status" className="p-4 text-sm text-muted-foreground">
            Carregando ranking…
          </p>
        )}
        {report && !ranking.length && (
          <div className="p-8 text-center">
            <p className="font-semibold">Nenhum Reel com views medidas ainda</p>
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
          <>
            <ol
              aria-label="Pódio dos três Reels mais vistos"
              className={`grid items-end gap-3 p-4 ${ranking.length >= 3 ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}
            >
              {ranking.slice(0, 3).map((reel) => (
                <li
                  key={reel.account_id + ":" + reel.media_id}
                  className={`flex flex-col items-center justify-center gap-1.5 rounded-xl border p-4 text-center sm:row-start-1 ${ranking.length >= 3 ? podium[reel.position - 1] : "border-sky-400/30 bg-sky-400/10 text-sky-200"}`}
                >
                  {reel.position === 1 && <Crown className="size-6" aria-hidden />}
                  <span className="text-lg font-semibold">{reel.position}º lugar</span>
                  <span className="text-3xl font-bold tabular-nums">
                    {number(reel.views)} <span className="text-base font-medium">views</span>
                  </span>
                  <span className="inline-flex items-center gap-1.5 break-all text-sm font-semibold">
                    <Instagram className="size-4 shrink-0" aria-hidden /> @{reel.username}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {date.format(new Date(reel.published_at))}
                  </span>
                  <ReelLink reel={reel} />
                </li>
              ))}
            </ol>
            {ranking.length > 3 && (
              <ol
                start={4}
                aria-label="Do quarto ao décimo lugar"
                className="mx-4 mb-4 divide-y divide-border rounded-lg border border-border"
              >
                {ranking.slice(3).map((reel) => (
                  <li
                    key={reel.account_id + ":" + reel.media_id}
                    className="grid grid-cols-[auto_1fr_auto] items-center gap-x-3 gap-y-1 p-3"
                  >
                    <span className="w-8 text-center font-semibold text-sky-200">
                      {reel.position}º
                    </span>
                    <div className="min-w-0">
                      <p className="break-all text-sm font-semibold">@{reel.username}</p>
                      <p className="text-xs text-muted-foreground">
                        {date.format(new Date(reel.published_at))}
                      </p>
                    </div>
                    <strong className="text-right text-sm tabular-nums">
                      {number(reel.views)} views
                    </strong>
                    <div className="col-start-2 col-span-2">
                      <ReelLink reel={reel} />
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </>
        )}
      </section>
    </section>
  );
}
