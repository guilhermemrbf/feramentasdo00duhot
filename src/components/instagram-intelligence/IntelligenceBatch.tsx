import { useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { instagramProfileUrl } from "@/lib/instagram-intelligence-import";
import {
  enqueueIntelligenceConnected,
  enqueueIntelligenceImport,
  getIntelligenceResults,
  getIntelligenceSources,
} from "@/lib/instagram-intelligence-data";
import {
  confidenceLabels,
  criteria,
  decisions,
  metricsFileLimit,
  parseMetricsFile,
  rankingCsv,
  reasons,
  risks,
  statuses,
  type Decision,
  type ResultRow,
} from "@/lib/instagram-intelligence-report";
import { IntelligenceDetail } from "./IntelligenceDetail";

const panel = "space-y-4 rounded-xl border border-border bg-card p-5";
const field =
  "w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground";
const numberFormat = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });
const sortable = {
  position: "Ordem do lote",
  score: "Índice",
  ...Object.fromEntries(criteria.map(([key, label]) => [key, label])),
  medianViews: "Mediana de views",
  confidence: "Confiança",
};

const outcomeLabels = {
  approved: "Aprovados",
  rejected: "Não aprovados",
  review: "Pendentes",
} satisfies Record<Decision, string>;

function currentDecision(row: ResultRow): Decision {
  return row.state === "done" ? row.decision : "review";
}

function currentResult(row: ResultRow): ResultRow {
  return row.state === "done" ? row : { ...row, decision: "review", reason: null };
}

function sortValue(row: ResultRow, key: string) {
  switch (key) {
    case "position":
      return -row.position;
    case "score":
      return row.score;
    case "medianViews":
      return row.medianViews;
    case "confidence":
      return row.confidence && ["low", "medium", "high"].indexOf(row.confidence);
    default:
      return row.notes?.[key as keyof NonNullable<ResultRow["notes"]>];
  }
}

function downloadFile(text: string, type: string, name: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function IntelligenceBatch({
  batch,
  userId,
}: {
  batch: { id: string; name: string };
  userId: string;
}) {
  const [workspace, setWorkspace] = useState("");
  const [file, setFile] = useState<File>();
  const [authorized, setAuthorized] = useState(false);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const [feedback, setFeedback] = useState<{ message: string; error?: boolean }>();
  const [page, setPage] = useState(0);
  const [sort, setSort] = useState("position");
  const [decision, setDecision] = useState<Decision | "">("");
  const [niche, setNiche] = useState("");
  const [risk, setRisk] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [comparison, setComparison] = useState<string[]>([]);
  const sources = useQuery({
    queryKey: ["intelligence-sources", userId],
    queryFn: ({ signal }) => getIntelligenceSources(signal),
    retry: false,
  });
  const results = useQuery({
    queryKey: ["intelligence-results", userId, batch.id],
    queryFn: ({ signal }) => getIntelligenceResults(batch.id, signal),
    gcTime: 0,
    retry: false,
    refetchInterval: (query) =>
      query.state.data?.some((row) => row.state === "queued") ? 5000 : false,
  });
  const rows = useMemo(() => {
    const query = niche.trim().toLocaleLowerCase("pt-BR");
    return (results.data ?? [])
      .filter(
        (row) =>
          (!decision || currentDecision(row) === decision) &&
          (!query ||
            [row.niche, row.subniche].some((value) =>
              value?.toLocaleLowerCase("pt-BR").includes(query),
            )) &&
          (!risk || row.community === risk || row.recommendation === risk),
      )
      .sort(
        (a, b) =>
          (sortValue(b, sort) ?? -Infinity) - (sortValue(a, sort) ?? -Infinity) ||
          a.position - b.position,
      );
  }, [results.data, decision, niche, risk, sort]);
  const maxPage = Math.max(Math.ceil(rows.length / 25) - 1, 0);
  const currentPage = Math.min(page, maxPage);
  const counts = results.data?.reduce(
    (total, row) => ({ ...total, [row.state]: total[row.state] + 1 }),
    { awaiting_source: 0, queued: 0, done: 0, failed: 0 },
  );

  const outcomes = { approved: 0, rejected: 0, review: 0 };
  for (const row of results.data ?? []) outcomes[currentDecision(row)]++;

  function filterByDecision(next: Decision | "") {
    setDecision(next);
    setPage(0);
  }

  async function enqueue(source: "connected" | "file") {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setFeedback(undefined);
    try {
      let count: number;
      if (source === "file") {
        if (!file || !authorized) return;
        if (file.size > metricsFileLimit) throw new Error("O arquivo passa de 4 MB.");
        count = await enqueueIntelligenceImport(
          batch.id,
          file.name,
          parseMetricsFile(await file.text()),
        );
      } else {
        if (!workspace) return;
        count = await enqueueIntelligenceConnected(batch.id, workspace);
      }
      setFeedback({
        message: count
          ? count + " perfil(is) enviado(s) à fila."
          : "Nenhum novo perfil foi enfileirado. Confira se há contas correspondentes ou dados já processados.",
      });
      void results.refetch();
    } catch (error) {
      setFeedback({
        message: error instanceof Error ? error.message : "Falha ao enfileirar perfis.",
        error: true,
      });
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  return (
    <>
      <section className={panel}>
        <h2 className="break-words text-lg font-semibold">Dados de {batch.name}</h2>
        <div className="grid gap-5 md:grid-cols-2">
          <div className="space-y-2">
            <label className="block space-y-2 text-sm">
              <span className="font-medium">Analytics de contas conectadas</span>
              <select
                className={field}
                value={workspace}
                onChange={(event) => setWorkspace(event.target.value)}
              >
                <option value="">Escolher meu espaço</option>
                {sources.data?.map((source) => (
                  <option key={source.id} value={source.id}>
                    {source.name}
                  </option>
                ))}
              </select>
            </label>
            <p className="text-sm text-muted-foreground">
              Usa métricas já coletadas para as contas deste lote em espaços dos quais você é
              proprietário.
            </p>
            {sources.isError && (
              <p role="alert" className="text-sm">
                {sources.error.message}
              </p>
            )}
            {sources.data?.length === 0 && (
              <p className="text-sm">Nenhum espaço próprio com Instagram conectado.</p>
            )}
            <Button disabled={!workspace || busy} onClick={() => void enqueue("connected")}>
              Analisar contas conectadas
            </Button>
          </div>
          <div className="space-y-2">
            <label className="block space-y-2 text-sm">
              <span className="font-medium">Arquivo de métricas autorizadas</span>
              <input
                className={field}
                type="file"
                accept=".json,application/json"
                onChange={(event) => setFile(event.target.files?.[0])}
              />
            </label>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                downloadFile(
                  JSON.stringify(
                    [
                      {
                        username: "seu_perfil",
                        snapshot: {
                          capturedAt: new Date().toISOString(),
                          followers: null,
                          reels: [],
                        },
                      },
                    ],
                    null,
                    2,
                  ),
                  "application/json",
                  "modelo-instagram-intelligence.json",
                )
              }
            >
              Baixar modelo JSON
            </Button>
            <label className="flex items-start gap-2 text-sm">
              <input
                className="mt-1"
                type="checkbox"
                checked={authorized}
                onChange={(event) => setAuthorized(event.target.checked)}
              />
              Tenho autorização para usar os dados deste arquivo.
            </label>
            <Button disabled={!file || !authorized || busy} onClick={() => void enqueue("file")}>
              Importar e analisar
            </Button>
          </div>
        </div>
        {feedback && <p role={feedback.error ? "alert" : "status"}>{feedback.message}</p>}
      </section>
      <section className={panel}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">Processamento e ranking</h2>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void results.refetch()}
            disabled={results.isFetching}
          >
            Atualizar
          </Button>
        </div>
        {counts && (
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4" aria-label="Progresso">
            {Object.entries(counts).map(([key, value]) => (
              <li className="rounded-lg border border-border px-3 py-2 text-sm" key={key}>
                <strong className="mr-2">{value}</strong>
                {statuses[key as ResultRow["state"]]}
              </li>
            ))}
          </ul>
        )}
        {results.isPending && <p role="status">Carregando resultados…</p>}
        {results.isError && <p role="alert">{results.error.message}</p>}
        {results.data && (
          <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrar por resultado">
            <Button
              variant={decision === "" ? "default" : "outline"}
              size="sm"
              aria-pressed={decision === ""}
              onClick={() => filterByDecision("")}
            >
              Todos: {results.data.length}
            </Button>
            {(Object.keys(outcomeLabels) as Decision[]).map((key) => (
              <Button
                key={key}
                variant={decision === key ? "default" : "outline"}
                size="sm"
                aria-pressed={decision === key}
                onClick={() => filterByDecision(key)}
              >
                {outcomeLabels[key]}: {outcomes[key]}
              </Button>
            ))}
          </div>
        )}
        <div className="grid grid-cols-2 gap-2 text-sm md:grid-cols-3">
          <label>
            Ordenar por
            <select
              className={field}
              value={sort}
              onChange={(event) => {
                setSort(event.target.value);
                setPage(0);
              }}
            >
              {Object.entries(sortable).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Nicho ou subnicho
            <input
              className={field}
              value={niche}
              onChange={(event) => {
                setNiche(event.target.value);
                setPage(0);
              }}
            />
          </label>
          <label>
            Risco
            <select
              className={field}
              value={risk}
              onChange={(event) => {
                setRisk(event.target.value);
                setPage(0);
              }}
            >
              <option value="">Qualquer</option>
              {Object.entries(risks).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={!results.data?.length}
            onClick={() => {
              const links = (results.data ?? []).map((row) => instagramProfileUrl(row.username));
              downloadFile(
                links.join("\n") + "\n",
                "text/plain;charset=utf-8",
                "links-instagram.txt",
              );
            }}
          >
            Baixar todos os links (.txt)
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={!rows.length}
            onClick={() =>
              downloadFile(
                "\uFEFF" + rankingCsv(rows.map(currentResult)),
                "text/csv;charset=utf-8",
                "ranking-instagram.csv",
              )
            }
          >
            Exportar seleção do filtro
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={comparison.length < 2}
            onClick={() =>
              downloadFile(
                "\uFEFF" +
                  rankingCsv(
                    (results.data ?? [])
                      .filter((row) => comparison.includes(row.username))
                      .map(currentResult),
                  ),
                "text/csv;charset=utf-8",
                "comparacao-instagram.csv",
              )
            }
          >
            Exportar comparação ({comparison.length})
          </Button>
        </div>
        {results.isSuccess && !rows.length && (
          <p className="text-sm text-muted-foreground">Nenhum perfil neste filtro.</p>
        )}
        {!!rows.length && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[590px] text-left text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th scope="col">Comparar</th>
                  <th scope="col">Perfil</th>
                  <th scope="col">Processamento</th>
                  <th scope="col">Índice</th>
                  <th scope="col">Mediana de views</th>
                  <th scope="col">Decisão</th>
                </tr>
              </thead>
              <tbody>
                {rows.slice(currentPage * 25, currentPage * 25 + 25).map((row) => (
                  <tr className="border-b border-border" key={row.username}>
                    <td>
                      <input
                        type="checkbox"
                        aria-label={"Comparar @" + row.username}
                        checked={comparison.includes(row.username)}
                        onChange={(event) =>
                          setComparison((previous) =>
                            event.target.checked
                              ? [...previous, row.username]
                              : previous.filter((name) => name !== row.username),
                          )
                        }
                      />
                    </td>
                    <td className="py-2">
                      {row.jobId ? (
                        <button
                          className="font-medium text-primary underline"
                          type="button"
                          aria-pressed={selected === row.jobId}
                          onClick={() => setSelected(row.jobId)}
                        >
                          @{row.username}
                        </button>
                      ) : (
                        <span>@{row.username}</span>
                      )}
                      <a
                        className="ml-2 text-xs text-primary underline"
                        href={instagramProfileUrl(row.username)}
                        target="_blank"
                        rel="noreferrer"
                        aria-label={"Abrir @" + row.username + " no Instagram"}
                      >
                        Abrir link
                      </a>
                    </td>
                    <td>
                      {statuses[row.state]}
                      {row.failure && row.state === "failed" && (
                        <small className="block text-muted-foreground">
                          {row.failure === "ambiguous_account"
                            ? "Conta ambígua no espaço"
                            : row.failure === "workspace_revoked"
                              ? "Fonte sem acesso ou desconectada"
                              : "Reenvie os dados para tentar novamente"}
                        </small>
                      )}
                    </td>
                    <td>{row.score == null ? "—" : numberFormat.format(row.score)}</td>
                    <td>{row.medianViews == null ? "—" : numberFormat.format(row.medianViews)}</td>
                    <td>
                      {row.state === "done" ? decisions[row.decision] : "Pendente"}
                      {row.state === "done" && row.reason && reasons[row.reason] && (
                        <small className="block text-muted-foreground">{reasons[row.reason]}</small>
                      )}
                      {row.state !== "done" && row.jobId && (
                        <small className="block text-muted-foreground">
                          A ficha disponível é da análise anterior.
                        </small>
                      )}
                      {row.confidence && (
                        <small className="block text-muted-foreground">
                          Confiança {confidenceLabels[row.confidence].toLowerCase()}
                        </small>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {maxPage > 0 && (
          <nav className="flex flex-wrap items-center gap-2" aria-label="Paginação dos resultados">
            <Button
              size="sm"
              variant="outline"
              disabled={!currentPage}
              onClick={() => setPage(currentPage - 1)}
            >
              Anterior
            </Button>
            <span className="text-sm">
              Página {currentPage + 1} de {maxPage + 1}
            </span>
            <Button
              size="sm"
              variant="outline"
              disabled={currentPage === maxPage}
              onClick={() => setPage(currentPage + 1)}
            >
              Próxima
            </Button>
          </nav>
        )}
      </section>
      {selected && (
        <IntelligenceDetail
          key={selected}
          id={selected}
          userId={userId}
          close={() => setSelected(null)}
          openReport={setSelected}
          onSaved={() => void results.refetch()}
        />
      )}
    </>
  );
}
