import { useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { Trophy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { calendarDateInZone, zonedDateTimeToIso } from "@/lib/scheduling";
import type { PostkitDatabase } from "@/lib/postkit-database";
import type { InstagramAnalyticsReport } from "./InstagramAnalytics";

type RankedAccount = { id: string; username: string; views: number };
type Result = [month: RankedAccount[], day: RankedAccount[]];
const number = new Intl.NumberFormat("pt-BR");

export function InstagramAccountRanking({
  workspaceId,
  timezone,
  onAccount,
}: {
  workspaceId: string;
  timezone: string;
  onAccount: (accountId: string) => void;
}) {
  const [result, setResult] = useState<Result>();
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    const fetchRanking = async () => {
      const today = calendarDateInZone(timezone);
      const end = zonedDateTimeToIso(calendarDateInZone(timezone, 1), "00:00", timezone);
      const client = supabase as unknown as SupabaseClient<PostkitDatabase>;
      const rank = async (date: string) => {
        const { data, error } = await client.rpc("get_instagram_analytics", {
          p_workspace: workspaceId,
          p_account: null,
          p_start: zonedDateTimeToIso(date, "00:00", timezone),
          p_end: end,
          p_page: 0,
        });
        if (error || !data) throw new Error("Métricas indisponíveis");
        const report = data as unknown as InstagramAnalyticsReport;
        return report.profiles
          .flatMap(({ id, username, reel_views }) =>
            reel_views === null ? [] : [{ id, username, views: reel_views }],
          )
          .sort((a, b) => b.views - a.views || a.username.localeCompare(b.username, "pt-BR"))
          .slice(0, 5);
      };
      const values = await Promise.all([rank(today.slice(0, 7) + "-01"), rank(today)]);
      if (active) setResult(values);
    };
    void fetchRanking().catch(() => {
      if (active) setError(true);
    });
    return () => {
      active = false;
    };
  }, [workspaceId, timezone, attempt]);

  if (error) {
    return (
      <div className="postkit-card p-4" role="alert">
        <p>Não foi possível consultar o ranking.</p>
        <button
          className="postkit-text-button"
          type="button"
          onClick={() => {
            setError(false);
            setAttempt((value) => value + 1);
          }}
        >
          Tentar novamente
        </button>
      </div>
    );
  }
  if (!result) return <p role="status">Carregando ranking…</p>;

  return (
    <div className="grid gap-3 md:grid-cols-2">
      {result.map((accounts, index) => (
        <section key={index === 0 ? "mês" : "hoje"} className="postkit-card p-4">
          <h2 className="flex items-center gap-2 font-semibold">
            <Trophy className="size-4" aria-hidden />{" "}
            {index === 0 ? "Top 5 do mês" : "Top 5 de hoje"}
          </h2>
          {accounts.length ? (
            <ol className="mt-3 divide-y divide-border">
              {accounts.map(({ id, username, views }, rank) => (
                <li key={id}>
                  <button
                    type="button"
                    className="flex min-h-11 w-full items-center gap-3 text-left hover:text-primary"
                    onClick={() => onAccount(id)}
                  >
                    <span className="postkit-step-number">{rank + 1}</span>
                    <span className="min-w-0 flex-1 break-all">@{username}</span>
                    <span className="tabular-nums">{number.format(views)} visualizações</span>
                  </button>
                </li>
              ))}
            </ol>
          ) : (
            <p className="postkit-muted mt-3">
              Nenhuma conta com visualizações coletadas neste período.
            </p>
          )}
        </section>
      ))}
    </div>
  );
}
