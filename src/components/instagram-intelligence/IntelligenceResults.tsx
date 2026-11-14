import { useQuery } from "@tanstack/react-query";
import { getIntelligenceResults } from "@/lib/instagram-intelligence-data";
import {
  confidenceLabels,
  criteria,
  reasons,
  type ResultRow,
} from "@/lib/instagram-intelligence-report";

const colors = {
  performance: "bg-[#16a34a]",
  potential: "bg-[#3b82f6]",
  safety: "bg-[#d97706]",
  quality: "bg-[#a855f7]",
} satisfies Record<(typeof criteria)[number][0], string>;

const format = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });

function ScoreBars({ notes }: { notes?: ResultRow["notes"] }) {
  const model = notes === undefined;
  return (
    <ul className={model ? "space-y-4" : "space-y-2"}>
      {criteria.map(([key, title, weight]) => {
        const value = model ? weight : (notes?.[key] ?? null);
        return (
          <li key={key}>
            <div className="mb-1.5 flex items-baseline justify-between gap-2">
              <span>
                {title}
                {!model && <span className="text-neutral-400"> · {weight}%</span>}
              </span>
              <span className="shrink-0 tabular-nums">
                {model ? weight + "%" : value === null ? "—" : format.format(value) + "/100"}
              </span>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-[#222]" aria-hidden="true">
              {value !== null && (
                <div
                  className={"h-full rounded-full " + colors[key]}
                  style={{ width: value + "%" }}
                />
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export function ScoringModel() {
  return (
    <section
      aria-labelledby="intelligence-scoring"
      className="space-y-5 rounded-[10px] border border-[#252525] px-[15px] py-4"
    >
      <h2 id="intelligence-scoring" className="text-xl font-semibold">
        Modelo de pontuação
      </h2>
      <ScoreBars />
    </section>
  );
}

function explanation(row: ResultRow) {
  if (row.state === "awaiting_source") return "Sem uma fonte de dados autorizada para este perfil.";
  if (row.state === "failed") {
    if (row.failure === "ambiguous_account") return "Há mais de uma conta conectada com esse nome.";
    if (row.failure === "workspace_revoked") return "A conexão autorizada ficou indisponível.";
    return "O processamento falhou antes de concluir a análise.";
  }
  return (
    reasons[row.reason ?? ""] ?? "O backend não registrou uma justificativa para este resultado."
  );
}

function ProfileCard({ row, approved }: { row: ResultRow; approved: boolean }) {
  const report = row.state === "done" ? row : null;
  return (
    <li className="min-w-0 space-y-3 rounded-lg border border-[#262626] bg-[#0b0b0b] p-3 text-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="break-all font-semibold">@{row.username}</h3>
          <p className={approved ? "text-[#4ade80]" : "text-[#f87171]"}>
            {approved ? "Aprovado" : "Não aprovado"}
          </p>
        </div>
        <p className="font-semibold tabular-nums">
          {report?.score == null ? "Sem nota final" : format.format(report.score) + "/100"}
        </p>
      </div>
      <p className="break-words text-neutral-300">
        Subnicho: {report?.subniche || "Não identificado"}
      </p>
      <p className="text-neutral-300">
        Confiança: {report?.confidence ? confidenceLabels[report.confidence] : "Indisponível"}
      </p>
      <p>{explanation(row)}</p>
      <ScoreBars notes={report?.notes ?? null} />
    </li>
  );
}

function ResultGroup({ rows, approved }: { rows: ResultRow[]; approved: boolean }) {
  const id = approved ? "intelligence-approved" : "intelligence-not-approved";
  return (
    <section aria-labelledby={id} className="min-w-0 space-y-4 px-1 sm:px-[15px]">
      <div>
        <p
          className={
            "text-3xl font-semibold tabular-nums " +
            (approved ? "text-[#22c55e]" : "text-[#f87171]")
          }
        >
          {rows.length}
        </p>
        <h2 id={id} className="text-xl font-semibold">
          {approved ? "Aprovados" : "Não aprovados"}
        </h2>
      </div>
      {rows.length > 0 && (
        <ul
          className="max-h-[32rem] space-y-3 overflow-y-auto focus-visible:outline-2 focus-visible:outline-neutral-500"
          tabIndex={0}
          aria-labelledby={id}
        >
          {rows.map((row) => (
            <ProfileCard key={row.username} row={row} approved={approved} />
          ))}
        </ul>
      )}
    </section>
  );
}

export function IntelligenceResults({
  userId,
  batch,
}: {
  userId: string;
  batch?: { id: string; count: number };
}) {
  const results = useQuery({
    queryKey: ["intelligence-results", userId, batch?.id],
    enabled: !!batch,
    queryFn: ({ signal }) => {
      if (!batch) return [];
      return getIntelligenceResults(batch.id, signal);
    },
    refetchInterval: (query) =>
      query.state.data?.some((row) => row.state === "queued")
        ? 5000
        : query.state.data?.some((row) => row.state === "awaiting_source")
          ? 30_000
          : false,
    gcTime: 0,
  });
  const approved: ResultRow[] = [];
  const notApproved: ResultRow[] = [];
  let processed = 0;
  let missing = 0;
  let failed = 0;
  for (const row of results.data ?? []) {
    if (row.state === "queued") continue;
    if (row.state === "done") processed++;
    if (row.state === "awaiting_source") missing++;
    if (row.state === "failed") failed++;
    if (row.state === "done" && row.decision === "approved") approved.push(row);
    else notApproved.push(row);
  }
  return (
    <section aria-label="Resultados" className="space-y-3 py-3">
      {batch && (
        <div role="status" className="space-y-1 px-1 text-sm text-neutral-300 sm:px-[15px]">
          {results.data ? (
            <>
              <p>
                {processed} de {batch.count} perfis processados
              </p>
              {(missing > 0 || failed > 0) && (
                <p>
                  {[
                    missing > 0 ? missing + " sem fonte autorizada" : null,
                    failed > 0 ? failed + " com falha" : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              )}
            </>
          ) : results.isPending ? (
            "Carregando análise…"
          ) : null}
        </div>
      )}
      {results.isError && <p role="alert">{results.error.message}</p>}
      <div className="grid grid-cols-2 items-start gap-x-2 sm:gap-x-3">
        <ResultGroup rows={approved} approved />
        <ResultGroup rows={notApproved} approved={false} />
      </div>
    </section>
  );
}
