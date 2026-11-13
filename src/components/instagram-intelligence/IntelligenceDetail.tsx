import { useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { getIntelligenceReport, saveIntelligenceReview } from "@/lib/instagram-intelligence-data";
import {
  accountStatusLabels,
  bands,
  confidenceLabels,
  coverageLabels,
  criteria,
  decisions,
  reasons,
  risks,
  type Assessment,
  type Finding,
  type Inspection,
  type ReportDetail,
  type Risk,
  type SampleReel,
} from "@/lib/instagram-intelligence-report";
import { LocalReelReview } from "./LocalReelReview";

const field =
  "w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground";
const labels = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 });
const show = (value: number | null | undefined, suffix = "") =>
  value == null ? "—" : labels.format(value) + suffix;
const date = (value: string | null) => (value ? new Date(value).toLocaleDateString("pt-BR") : "—");
const metrics = [
  ["followers", "Seguidores", ""],
  ["medianViews", "Mediana de views", ""],
  ["meanViews", "Média de views", ""],
  ["medianLikes", "Mediana de curtidas", ""],
  ["medianComments", "Mediana de comentários", ""],
  ["relativeViews", "Mediana de views sobre seguidores", "%"],
  ["interactionRate", "Interações por visualização", "%"],
  ["topViewShare", "Fatia de views do maior Reel", "%"],
  ["regularity", "Regularidade (percentil 25 / mediana)", "%"],
  ["weeklyFrequency", "Reels por semana na amostra", ""],
  ["recentChange", "Variação entre metades da amostra", "%"],
  ["shares", "Compartilhamentos medidos", ""],
  ["saves", "Salvamentos medidos", ""],
] as const;
const blank: Assessment = {
  niche: "",
  subniche: "",
  microniche: "",
  formats: [],
  themes: [],
  audience: "",
  valueProposition: "",
  opportunities: "",
  weaknesses: "",
  groupReference: "",
  groupEvidence: "",
  subnicheReason: "",
  safetyReason: "",
  qualityReason: "",
  potential: null,
  safety: null,
  quality: null,
  accountStatus: "unverified",
  accountEvidence: "",
  community: "indeterminate",
  recommendation: "indeterminate",
  inspected: [],
  findings: [],
  finalReview: false,
};

function reportLines(
  { username, report, assessment, sourceLabel, completedAt }: ReportDetail,
  onlySafety = false,
) {
  const lines = [
    "Instagram Intelligence — @" + username,
    "https://www.instagram.com/" + username + "/",
    "Processado em " +
      date(completedAt) +
      " · Fonte: " +
      sourceLabel +
      " · Captura: " +
      date(report.capturedAt),
    "Período: " + date(report.periodStart) + " a " + date(report.periodEnd),
    "Critérios v" +
      report.criteriaVersion +
      " · Políticas v" +
      report.policyVersion +
      " · Modelo de IA: " +
      (report.analysisModel ?? "nenhum"),
    decisions[report.decision] + " — " + (reasons[report.reason] ?? report.reason),
    "Confiança: " +
      confidenceLabels[report.confidence] +
      " · Índice de potencial: " +
      show(report.score) +
      (report.band ? " · " + bands[report.band] : ""),
    "Amostra: " +
      report.coverage.sampled +
      " · Com views: " +
      report.coverage.measured +
      " · Revisados: " +
      report.coverage.inspected +
      " · Vídeos completos: " +
      report.coverage.full,
  ];
  if (!onlySafety) {
    lines.push(
      ...criteria.map(
        ([key, label, weight]) =>
          label +
          " (" +
          weight +
          "%): " +
          show(report.notes[key]) +
          " | contribuição " +
          show(report.notes[key] == null ? null : (report.notes[key] * weight) / 100),
      ),
    );
    lines.push(
      ...metrics.map(([key, label, suffix]) => label + ": " + show(report.metrics[key], suffix)),
    );
    if (assessment)
      lines.push(
        "Nicho: " + assessment.niche + " / " + assessment.subniche + " / " + assessment.microniche,
        "Proposta: " + assessment.valueProposition,
        "Público: " + assessment.audience,
        "Formatos: " + assessment.formats.join(", "),
        "Temas: " + assessment.themes.join(", "),
        "Oportunidades: " + assessment.opportunities,
        "Pontos fracos: " + assessment.weaknesses,
        "Justificativa de subnicho: " + assessment.subnicheReason,
        "Justificativa de qualidade: " + assessment.qualityReason,
        "Grupo informado: " + assessment.groupReference + " · " + assessment.groupEvidence,
      );
  }
  lines.push(
    "Comunidade: " + risks[report.community] + " · Recomendação: " + risks[report.recommendation],
    "Status da Conta: " + accountStatusLabels[report.accountStatus],
    "Evidência do Status da Conta: " + (assessment?.accountEvidence || "indisponível"),
    "Justificativa de conformidade: " + (assessment?.safetyReason || "indisponível"),
  );
  for (const item of report.findings)
    lines.push(
      item.url +
        " · " +
        date(item.publishedAt) +
        (item.second != null ? " · " + item.second + "s" : ""),
      item.category +
        " · " +
        risks[item.severity] +
        " · Confiança " +
        confidenceLabels[item.confidence] +
        " · " +
        (item.confirmed ? "Confirmado pelo operador" : "Suspeita"),
      item.evidence,
      item.reason,
      item.action,
      item.policyUrl + " · Consulta " + item.policyConsultedOn,
    );
  if (!onlySafety) {
    for (const item of report.sample) {
      const inspection = assessment?.inspected.find((inspection) => inspection.url === item.url);
      lines.push(
        item.url + " · " + date(item.publishedAt) + " · " + show(item.views) + " views",
        inspection
          ? coverageLabels[inspection.coverage] + " · " + inspection.note
          : "Sem revisão de conteúdo.",
      );
      if (inspection?.model)
        lines.push("Sugestões de " + inspection.model + " · " + inspection.modelNotes);
      if (inspection)
        lines.push(
          ...inspectionFields.flatMap(([key, label]) =>
            inspection[key] ? [label + ": " + inspection[key]] : [],
          ),
        );
    }
  }
  return lines;
}

async function downloadPdf(detail: ReportDetail, onlySafety = false) {
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF();
  pdf.setFontSize(10);
  let y = 16;
  for (const text of reportLines(detail, onlySafety)) {
    for (const line of pdf.splitTextToSize(text, 178) as string[]) {
      if (y > 280) {
        pdf.addPage();
        y = 16;
      }
      pdf.text(line, 16, y);
      y += 5;
    }
  }
  pdf.save((onlySafety ? "conformidade-" : "intelligence-") + detail.username + ".pdf");
}

function Label({ name, children }: { name: string; children: ReactNode }) {
  return (
    <label className="block space-y-1 text-sm">
      <span className="font-medium">{name}</span>
      {children}
    </label>
  );
}

export function IntelligenceDetail({
  id,
  userId,
  close,
  openReport,
  onSaved,
}: {
  id: string;
  userId: string;
  close: () => void;
  openReport: (id: string) => void;
  onSaved: () => void;
}) {
  const detail = useQuery({
    queryKey: ["intelligence-report", userId, id],
    queryFn: ({ signal }) => getIntelligenceReport(id, signal),
    retry: false,
    gcTime: 0,
  });
  const [editing, setEditing] = useState(false);
  const [exportError, setExportError] = useState("");
  const item = detail.data;
  const report = item?.report;
  const assessment = item?.assessment;
  const top =
    report?.sample
      .filter((reel) => reel.views != null)
      .sort((a, b) => (b.views ?? 0) - (a.views ?? 0))
      .slice(0, 3) ?? [];
  const exportPdf = (onlySafety: boolean) => {
    if (!item) return;
    setExportError("");
    void downloadPdf(item, onlySafety).catch(() =>
      setExportError("Falha ao gerar o PDF. Tente novamente."),
    );
  };
  return (
    <section
      className="space-y-5 rounded-xl border border-border bg-card p-5"
      aria-label="Relatório individual"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h2 className="text-lg font-semibold">
          Relatório {item ? "de @" + item.username : "individual"}
        </h2>
        <Button size="sm" variant="outline" onClick={close}>
          Fechar relatório
        </Button>
      </div>
      {detail.isPending && <p role="status">Abrindo relatório…</p>}
      {detail.isError && <p role="alert">{detail.error.message}</p>}
      {report && item && (
        <>
          <div className="space-y-1 text-sm">
            <a
              className="text-primary underline"
              href={"https://www.instagram.com/" + item.username + "/"}
              target="_blank"
              rel="noreferrer"
            >
              Abrir perfil no Instagram
            </a>
            <p>
              Fonte {item.sourceLabel} · Captura {date(report.capturedAt)} · Processado{" "}
              {date(item.completedAt)}
            </p>
            <p>
              Período {date(report.periodStart)} a {date(report.periodEnd)} · Critérios v
              {report.criteriaVersion} · Políticas v{report.policyVersion}
            </p>
            <p>
              {report.coverage.sampled} Reels na amostra · {report.coverage.measured} com views ·{" "}
              {report.coverage.inspected} revisados · {report.coverage.full} vídeos completos
              revisados
            </p>
            <p className="text-muted-foreground">
              A revisão humana fundamenta a classificação de conteúdo.{" "}
              {report.analysisModel && "Sugestões registradas de " + report.analysisModel + "."}
            </p>
          </div>
          <div className="grid gap-3 rounded-lg border border-border p-4 text-sm sm:grid-cols-2">
            <div>
              <p className="font-semibold">
                {decisions[report.decision]} · Confiança{" "}
                {confidenceLabels[report.confidence].toLowerCase()}
              </p>
              <p>{reasons[report.reason] ?? report.reason}</p>
            </div>
            <div>
              <p className="font-semibold">Índice de potencial orgânico {show(report.score)}</p>
              <p>{report.band ? bands[report.band] : "Aguardando os quatro critérios."}</p>
            </div>
          </div>
          <ul className="grid gap-3 sm:grid-cols-2">
            {criteria.map(([key, label, weight]) => {
              const note = report.notes[key];
              return (
                <li key={key} className="space-y-1 rounded-md border border-border p-3 text-sm">
                  <p className="font-medium">
                    {label} · {weight}%
                  </p>
                  <progress
                    className="w-full accent-primary"
                    max={100}
                    value={note ?? 0}
                    aria-label={label}
                    aria-valuetext={note == null ? "Sem nota" : show(note)}
                  />
                  <p>
                    {show(note)} / 100 · {show(note == null ? null : (note * weight) / 100)} pontos
                    ponderados
                  </p>
                </li>
              );
            })}
          </ul>
          <details open className="space-y-2">
            <summary className="cursor-pointer font-semibold">Desempenho</summary>
            <dl className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-3">
              {metrics.map(([key, label, suffix]) => (
                <div className="rounded-md border border-border p-2" key={key}>
                  <dt className="text-muted-foreground">{label}</dt>
                  <dd>{show(report.metrics[key], suffix)}</dd>
                </div>
              ))}
            </dl>
            {!!top.length && (
              <p className="flex flex-wrap gap-3 text-sm">
                Mais vistos na amostra{" "}
                {top.map((reel) => (
                  <a
                    key={reel.url}
                    href={reel.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-primary underline"
                  >
                    {show(reel.views)} views
                  </a>
                ))}
              </p>
            )}
          </details>
          <details open className="space-y-2">
            <summary className="cursor-pointer font-semibold">Subnicho e qualidade</summary>
            {assessment ? (
              <dl className="grid gap-2 text-sm sm:grid-cols-2">
                {(
                  [
                    ["Nicho", assessment.niche],
                    ["Subnicho", assessment.subniche],
                    ["Micronicho", assessment.microniche],
                    ["Formatos", assessment.formats.join(", ")],
                    ["Temas", assessment.themes.join(", ")],
                    ["Proposta de valor", assessment.valueProposition],
                    ["Público aparente", assessment.audience],
                    ["Oportunidades", assessment.opportunities],
                    ["Pontos fracos", assessment.weaknesses],
                    ["Justificativa do subnicho", assessment.subnicheReason],
                    ["Justificativa de qualidade", assessment.qualityReason],
                    [
                      "Grupo e vínculo informado",
                      [assessment.groupReference, assessment.groupEvidence]
                        .filter(Boolean)
                        .join(" · "),
                    ],
                  ] as const
                ).map(([label, value]) => (
                  <div key={label}>
                    <dt className="font-medium">{label}</dt>
                    <dd className="break-words">{value || "—"}</dd>
                  </div>
                ))}
              </dl>
            ) : (
              <p className="text-sm text-muted-foreground">
                Aguardando classificação e justificativas.
              </p>
            )}
          </details>
          <details open className="space-y-2">
            <summary className="cursor-pointer font-semibold">Conformidade</summary>
            <p className="text-sm">
              Comunidade {risks[report.community]} · Recomendações {risks[report.recommendation]}
            </p>
            <p className="text-sm">Status da Conta — {accountStatusLabels[report.accountStatus]}</p>
            {assessment?.accountEvidence && (
              <p className="break-words text-sm">{assessment.accountEvidence}</p>
            )}
            {assessment?.safetyReason && (
              <p className="break-words text-sm">{assessment.safetyReason}</p>
            )}
            {report.findings.length ? (
              <ul className="space-y-2 text-sm">
                {report.findings.map((finding, index) => (
                  <li className="space-y-1 rounded-md border border-border p-3" key={index}>
                    <p className="font-medium">
                      {finding.category} · {risks[finding.severity]} ·{" "}
                      {finding.confirmed ? "Confirmado pelo operador" : "Suspeita"}
                    </p>
                    <a
                      className="text-primary underline"
                      href={finding.url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Publicação de {date(finding.publishedAt)}
                      {finding.second != null ? " · " + finding.second + " s" : ""}
                    </a>
                    <p>
                      {finding.evidence} · {finding.reason}
                    </p>
                    <p>
                      Revisão sugerida {finding.action} · Confiança{" "}
                      {confidenceLabels[finding.confidence]}
                    </p>
                    <a
                      className="text-primary underline"
                      href={finding.policyUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Política oficial consultada em {finding.policyConsultedOn}
                    </a>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">
                Nenhuma ocorrência registrada na amostra.
              </p>
            )}
          </details>
          <details className="space-y-2">
            <summary className="cursor-pointer font-semibold">
              Fichas por Reel ({report.sample.length})
            </summary>
            <ul className="space-y-2 text-sm">
              {report.sample.map((reel) => {
                const evidence = assessment?.inspected.find((entry) => entry.url === reel.url);
                return (
                  <li key={reel.url} className="rounded-md border border-border p-2">
                    <a
                      className="text-primary underline"
                      href={reel.url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Reel de {date(reel.publishedAt)}
                    </a>
                    <p>
                      {show(reel.views)} views · {show(reel.likes)} curtidas · {show(reel.comments)}{" "}
                      comentários · {show(reel.shares)} compartilhamentos · {show(reel.saves)}{" "}
                      salvamentos
                    </p>
                    {reel.measuredAt && <p>Métricas medidas em {date(reel.measuredAt)}</p>}
                    <p>
                      {evidence
                        ? coverageLabels[evidence.coverage] + " · " + evidence.note
                        : "Metadados disponíveis. Revisão de conteúdo pendente."}
                    </p>
                    {evidence?.model && (
                      <p>
                        Sugestões de {evidence.model} · {evidence.modelNotes}
                      </p>
                    )}
                    {evidence &&
                      inspectionFields.map(
                        ([key, label]) =>
                          evidence[key] && (
                            <p key={key}>
                              {label} · {evidence[key]}
                            </p>
                          ),
                      )}
                  </li>
                );
              })}
            </ul>
          </details>
          {!!item.pastReports.length && (
            <details className="space-y-2">
              <summary className="cursor-pointer font-semibold">Capturas anteriores</summary>
              <ul className="space-y-1 text-sm">
                {item.pastReports.map((past) => (
                  <li key={past.id}>
                    <button
                      type="button"
                      className="text-primary underline"
                      onClick={() => openReport(past.id)}
                    >
                      {date(past.date)} · {past.sourceLabel}
                    </button>
                  </li>
                ))}
              </ul>
            </details>
          )}
          {!!item.history.length && (
            <details className="space-y-2">
              <summary className="cursor-pointer font-semibold">Histórico de revisões</summary>
              <ul className="space-y-1 text-sm">
                {item.history.map((entry) => (
                  <li key={entry.id}>
                    {date(entry.date)} · {decisions[entry.decision]} · {show(entry.score)} ·{" "}
                    {reasons[entry.reason] ?? entry.reason}
                  </li>
                ))}
              </ul>
            </details>
          )}
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => exportPdf(false)}>
              Baixar relatório em PDF
            </Button>
            <Button variant="outline" size="sm" onClick={() => exportPdf(true)}>
              Baixar conformidade em PDF
            </Button>
            <Button size="sm" onClick={() => setEditing(!editing)}>
              {editing ? "Fechar revisão" : "Registrar revisão"}
            </Button>
          </div>
          {exportError && <p role="alert">{exportError}</p>}
          {editing && (
            <ReviewForm
              item={item}
              onSaved={() => {
                setEditing(false);
                void detail.refetch();
                onSaved();
              }}
            />
          )}
        </>
      )}
    </section>
  );
}

const inspectionFields = [
  ["format", "Formato"],
  ["theme", "Tema"],
  ["hook", "Gancho inicial"],
  ["editing", "Ritmo e edição"],
  ["overlay", "Texto na tela"],
  ["caption", "Legenda"],
  ["audio", "Áudio ou transcrição"],
  ["cta", "Chamada para ação"],
] as const;
const profileFields = [
  ["niche", "Nicho"],
  ["subniche", "Subnicho"],
  ["microniche", "Micronicho"],
  ["valueProposition", "Proposta de valor"],
  ["audience", "Público aparente"],
  ["opportunities", "Oportunidades e sinais de demanda"],
  ["weaknesses", "Pontos fracos e saturação"],
  ["groupReference", "Identificador de grupo informado"],
  ["groupEvidence", "Evidência não biométrica do vínculo"],
] as const;
const scoredFields = [
  ["potential", "subnicheReason", "Potencial do subnicho"],
  ["safety", "safetyReason", "Segurança e conformidade"],
  ["quality", "qualityReason", "Consistência e qualidade"],
] as const;
const blankInspection: Inspection = { url: "", coverage: "metadata", note: "" };
const blankFinding: Finding = {
  url: "",
  area: "community",
  severity: "moderate",
  confirmed: false,
  policy: "community",
  evidence: "",
  confidence: "medium",
  category: "",
  reason: "",
  action: "",
};

function ReviewForm({ item, onSaved }: { item: ReportDetail; onSaved: () => void }) {
  const [assessment, setAssessment] = useState<Assessment>({ ...blank, ...item.assessment });
  const [selected, setSelected] = useState("");
  const [failure, setFailure] = useState("");
  const [saving, setSaving] = useState(false);
  const inspected = assessment.inspected.find((entry) => entry.url === selected);
  const set = <Key extends keyof Assessment>(key: Key, value: Assessment[Key]) =>
    setAssessment((current) => ({ ...current, [key]: value }));
  const setInspection = (inspection: Inspection) =>
    set("inspected", [
      ...assessment.inspected.filter((entry) => entry.url !== inspection.url),
      inspection,
    ]);
  const setFinding = (index: number, finding: Finding) =>
    set(
      "findings",
      assessment.findings.map((current, position) => (position === index ? finding : current)),
    );

  async function save() {
    if (saving) return;
    setSaving(true);
    setFailure("");
    try {
      await saveIntelligenceReview(item.id, assessment);
      onSaved();
    } catch (error) {
      setFailure(error instanceof Error ? error.message : "Falha ao registrar a revisão.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      className="space-y-4 rounded-lg border border-border p-4"
      onSubmit={(event) => {
        event.preventDefault();
        void save();
      }}
    >
      <h3 className="font-semibold">Revisão de @{item.username}</h3>
      <p className="text-sm text-muted-foreground">
        Registre as observações e mantenha em branco o que não puder sustentar com evidência. A
        ferramenta aplica os pesos e decide a partir das regras fixas.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        {profileFields.map(([key, label]) => (
          <Label key={key} name={label}>
            <input
              className={field}
              maxLength={1500}
              value={assessment[key]}
              onChange={(e) => set(key, e.target.value)}
            />
          </Label>
        ))}
        {(["formats", "themes"] as const).map((key) => (
          <Label
            key={key}
            name={
              key === "formats" ? "Formatos (separe por vírgula)" : "Temas (separe por vírgula)"
            }
          >
            <input
              className={field}
              defaultValue={assessment[key].join(", ")}
              onChange={(e) =>
                set(
                  key,
                  e.target.value
                    .split(",")
                    .map((value) => value.trim())
                    .filter(Boolean),
                )
              }
            />
          </Label>
        ))}
      </div>
      {scoredFields.map(([key, reason, label]) => (
        <div className="grid gap-2 sm:grid-cols-[1fr_2fr]" key={key}>
          <Label name={label + " (0 a 100)"}>
            <input
              className={field}
              type="number"
              min={0}
              max={100}
              step="any"
              value={assessment[key] ?? ""}
              onChange={(e) => set(key, e.target.value === "" ? null : e.target.valueAsNumber)}
            />
          </Label>
          <Label name={"Justificativa de " + label.toLowerCase()}>
            <textarea
              className={field}
              maxLength={1500}
              value={assessment[reason]}
              onChange={(e) => set(reason, e.target.value)}
            />
          </Label>
        </div>
      ))}
      <div className="grid gap-3 sm:grid-cols-2">
        {(["community", "recommendation"] as const).map((key) => (
          <Label
            key={key}
            name={key === "community" ? "Diretrizes da Comunidade" : "Risco de recomendação"}
          >
            <select
              className={field}
              value={assessment[key]}
              onChange={(e) => set(key, e.target.value as Risk)}
            >
              {Object.entries(risks).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </Label>
        ))}
        <Label name="Status da Conta">
          <select
            className={field}
            value={assessment.accountStatus}
            onChange={(e) => set("accountStatus", e.target.value as Assessment["accountStatus"])}
          >
            {Object.entries(accountStatusLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </Label>
        <Label name="Evidência autorizada do Status da Conta">
          <textarea
            className={field}
            maxLength={1500}
            value={assessment.accountEvidence}
            onChange={(e) => set("accountEvidence", e.target.value)}
          />
        </Label>
      </div>
      <Label name={"Reel para revisar (" + assessment.inspected.length + " registrados)"}>
        <ReelSelect sample={item.report.sample} value={selected} change={setSelected} />
      </Label>
      {selected && (
        <div className="space-y-3 rounded-lg border border-border p-3">
          <LocalReelReview
            key={selected}
            url={selected}
            onSaveSuggestion={(suggestion) => {
              const observations = suggestion.observations;
              const modelNotes = [
                ...observations.observations.map((entry) => entry.seconds + "s: " + entry.visible),
              ]
                .filter(Boolean)
                .join(" · ")
                .slice(0, 1000);
              setInspection({
                ...blankInspection,
                ...inspected,
                url: selected,
                model: suggestion.model,
                modelNotes,
                frameTimes: suggestion.frameTimes,
              });
            }}
            onSample={() => {
              if (inspected?.coverage !== "full")
                setInspection({
                  ...blankInspection,
                  ...inspected,
                  url: selected,
                  coverage: "frames",
                });
            }}
          />
          {inspected ? (
            <>
              {inspected.model && (
                <p className="text-sm">Sugestões anexadas · {inspected.modelNotes}</p>
              )}
              <Label name="Material revisado">
                <select
                  className={field}
                  value={inspected.coverage}
                  onChange={(e) =>
                    setInspection({
                      ...inspected,
                      coverage: e.target.value as Inspection["coverage"],
                    })
                  }
                >
                  {Object.entries(coverageLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </Label>
              <Label name="Observação da revisão">
                <textarea
                  required
                  minLength={5}
                  maxLength={1000}
                  className={field}
                  value={inspected.note}
                  onChange={(e) => setInspection({ ...inspected, note: e.target.value })}
                />
              </Label>
              <div className="grid gap-2 sm:grid-cols-2">
                {inspectionFields.map(([key, label]) => (
                  <Label key={key} name={label}>
                    <input
                      className={field}
                      maxLength={1000}
                      value={inspected[key] ?? ""}
                      onChange={(e) => setInspection({ ...inspected, [key]: e.target.value })}
                    />
                  </Label>
                ))}
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setAssessment((current) => ({
                    ...current,
                    inspected: current.inspected.filter((entry) => entry.url !== selected),
                    findings: current.findings.filter((entry) => entry.url !== selected),
                  }));
                }}
              >
                Remover revisão deste Reel
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="ml-2"
                disabled={assessment.findings.length >= 60}
                onClick={() =>
                  set("findings", [...assessment.findings, { ...blankFinding, url: selected }])
                }
              >
                Registrar ocorrência
              </Button>
            </>
          ) : (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setInspection({ ...blankInspection, url: selected })}
            >
              Adicionar ficha de revisão
            </Button>
          )}
        </div>
      )}
      {assessment.findings.map((finding, index) => (
        <fieldset
          className="grid gap-2 rounded-md border border-border p-3 sm:grid-cols-2"
          key={index}
        >
          <legend className="px-1 text-sm font-semibold">
            Ocorrência em {finding.url.split("/")[4]}
          </legend>
          <Label name="Política">
            <select
              className={field}
              value={finding.policy}
              onChange={(e) => {
                const policy = e.target.value as Finding["policy"];
                setFinding(index, {
                  ...finding,
                  policy,
                  area: policy === "community" ? "community" : "recommendation",
                });
              }}
            >
              <option value="community">Diretrizes da Comunidade</option>
              <option value="recommendation">Recomendações</option>
              <option value="originality">Originalidade e recomendações</option>
            </select>
          </Label>
          <Label name="Gravidade">
            <select
              className={field}
              value={finding.severity}
              onChange={(e) => setFinding(index, { ...finding, severity: e.target.value as Risk })}
            >
              {Object.entries(risks).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </Label>
          <Label name="Confiança">
            <select
              className={field}
              value={finding.confidence}
              onChange={(e) =>
                setFinding(index, {
                  ...finding,
                  confidence: e.target.value as Finding["confidence"],
                  confirmed: e.target.value === "high" && finding.confirmed,
                })
              }
            >
              {Object.entries(confidenceLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </Label>
          <Label name="Trecho em segundos">
            <input
              type="number"
              min={0}
              max={99999}
              step="0.001"
              className={field}
              value={finding.second ?? ""}
              onChange={(e) =>
                setFinding(index, {
                  ...finding,
                  second: e.target.value === "" ? null : e.target.valueAsNumber,
                })
              }
            />
          </Label>
          {(
            [
              ["category", "Categoria"],
              ["evidence", "Evidência observada"],
              ["reason", "Regra aplicável e justificativa"],
              ["action", "Revisão sugerida"],
            ] as const
          ).map(([key, label]) => (
            <Label key={key} name={label}>
              <input
                required
                minLength={key === "evidence" ? 10 : 5}
                maxLength={1500}
                className={field}
                value={finding[key]}
                onChange={(e) => setFinding(index, { ...finding, [key]: e.target.value })}
              />
            </Label>
          ))}
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={finding.confirmed}
              disabled={finding.confidence !== "high"}
              onChange={(e) => setFinding(index, { ...finding, confirmed: e.target.checked })}
            />
            Confirmei a ocorrência com evidência
          </label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              set(
                "findings",
                assessment.findings.filter((_, i) => i !== index),
              )
            }
          >
            Remover ocorrência
          </Button>
        </fieldset>
      ))}
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={assessment.finalReview}
          onChange={(e) => set("finalReview", e.target.checked)}
        />
        Concluí a revisão final das evidências
      </label>
      <Button type="submit" disabled={saving}>
        {saving ? "Salvando…" : "Salvar revisão"}
      </Button>
      {failure && <p role="alert">{failure}</p>}
    </form>
  );
}

function ReelSelect({
  sample,
  value,
  change,
}: {
  sample: SampleReel[];
  value: string;
  change: (value: string) => void;
}) {
  return (
    <select
      className={field}
      value={value}
      onChange={(event) => change(event.target.value)}
      disabled={!sample.length}
    >
      <option value="">
        {sample.length ? "Selecione uma publicação" : "Sem publicações na amostra"}
      </option>
      {sample.map((reel) => (
        <option key={reel.url} value={reel.url}>
          {date(reel.publishedAt)} · {show(reel.views)} views · {reel.url.split("/")[4]}
        </option>
      ))}
    </select>
  );
}
