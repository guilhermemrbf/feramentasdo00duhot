import { z } from "zod";

const measured = z.number().int().min(0).max(999_999_999_999).nullish();
const publicationUrl =
  /^https:\/\/(?:www\.)?instagram\.com\/(?:reel|reels|p|tv)\/([A-Za-z0-9_-]{1,32})\/$/;
const isoDate = z.string().datetime();
const snapshotSchema = z
  .object({
    capturedAt: isoDate,
    followers: measured,
    reels: z
      .array(
        z
          .object({
            url: z.string().regex(publicationUrl),
            publishedAt: isoDate,
            views: measured,
            likes: measured,
            comments: measured,
            shares: measured,
            saves: measured,
          })
          .strict(),
      )
      .max(90),
  })
  .strict();
const importSchema = z
  .array(
    z
      .object({
        username: z
          .string()
          .regex(/^[a-z0-9_]+(?:\.[a-z0-9_]+)*$/)
          .max(30),
        snapshot: snapshotSchema,
      })
      .strict(),
  )
  .min(1)
  .max(1000)
  .superRefine((items, context) => {
    const users = new Set<string>();
    for (const [index, item] of items.entries()) {
      if (users.has(item.username))
        context.addIssue({
          code: "custom",
          path: [index, "username"],
          message: "Perfil repetido.",
        });
      users.add(item.username);
      const posts = new Set<string>();
      for (const [position, reel] of item.snapshot.reels.entries()) {
        const code = publicationUrl.exec(reel.url)?.[1];
        if (
          Date.parse(reel.publishedAt) > Date.parse(item.snapshot.capturedAt) ||
          (code && posts.has(code))
        ) {
          context.addIssue({
            code: "custom",
            path: [index, "snapshot", "reels", position],
            message: "Data inválida ou Reel repetido.",
          });
        }
        if (code) posts.add(code);
      }
    }
  });

export const metricsFileLimit = 4_000_000;
export type ImportItem = z.infer<typeof importSchema>[number];
export type SampleReel = ImportItem["snapshot"]["reels"][number] & { measuredAt?: string | null };
export type Risk = "low" | "moderate" | "high" | "critical" | "indeterminate";
export type Decision = "approved" | "rejected" | "review";
export type Confidence = "low" | "medium" | "high";
export type AccountStatus = "eligible" | "restricted" | "unverified";
export type Source = "connected_analytics" | "owner_import";
export type Coverage = "full" | "frames" | "metadata" | "thumbnail";

export function parseMetricsFile(text: string): ImportItem[] {
  if (new TextEncoder().encode(text).length > metricsFileLimit)
    throw new Error("O arquivo passa de 4 MB.");
  let content: unknown;
  try {
    content = JSON.parse(text);
  } catch {
    throw new Error("Não foi possível ler o JSON. Confira o modelo de importação.");
  }
  const result = importSchema.safeParse(content);
  if (!result.success) {
    const issue = result.error.issues[0];
    throw new Error(
      "Confira o campo " +
        (issue?.path.join(".") || "lista de perfis") +
        ". " +
        (issue?.code === "custom" ? issue.message : "O formato não corresponde ao modelo."),
    );
  }
  return result.data;
}

export type Inspection = {
  url: string;
  coverage: Coverage;
  note: string;
  format?: string;
  theme?: string;
  hook?: string;
  editing?: string;
  overlay?: string;
  caption?: string;
  audio?: string;
  cta?: string;
  model?: string;
  modelNotes?: string;
  frameTimes?: number[];
};
export type Finding = {
  url: string;
  area: "community" | "recommendation";
  severity: Risk;
  confirmed: boolean;
  policy: "community" | "recommendation" | "originality";
  evidence: string;
  confidence: Confidence;
  category: string;
  reason: string;
  action: string;
  second?: number | null;
};
export type Assessment = {
  niche: string;
  subniche: string;
  microniche: string;
  valueProposition: string;
  audience: string;
  formats: string[];
  themes: string[];
  opportunities: string;
  weaknesses: string;
  groupReference: string;
  groupEvidence: string;
  subnicheReason: string;
  safetyReason: string;
  qualityReason: string;
  potential: number | null;
  safety: number | null;
  quality: number | null;
  accountStatus: AccountStatus;
  accountEvidence: string;
  community: Risk;
  recommendation: Risk;
  inspected: Inspection[];
  findings: Finding[];
  finalReview: boolean;
};
export const criteria = [
  ["performance", "Desempenho e engajamento", 35],
  ["potential", "Potencial do subnicho", 25],
  ["safety", "Segurança e conformidade", 30],
  ["quality", "Consistência e qualidade", 10],
] as const;
type Notes = Record<(typeof criteria)[number][0], number | null>;
export type Report = {
  criteriaVersion: string;
  policyVersion: string;
  analysisModel: string | null;
  capturedAt: string;
  periodStart: string | null;
  periodEnd: string | null;
  sample: SampleReel[];
  coverage: { sampled: number; measured: number; inspected: number; full: number };
  metrics: Record<
    | "followers"
    | "medianViews"
    | "meanViews"
    | "medianLikes"
    | "medianComments"
    | "interactionRate"
    | "relativeViews"
    | "topViewShare"
    | "regularity"
    | "weeklyFrequency"
    | "recentChange"
    | "shares"
    | "saves",
    number | null
  >;
  notes: Notes;
  score: number | null;
  band: "excellent" | "very_good" | "good" | "regular" | "low" | null;
  confidence: Confidence;
  decision: Decision;
  reason: string;
  accountStatus: AccountStatus;
  community: Risk;
  recommendation: Risk;
  findings: (Finding & {
    policyUrl: string;
    policyDescription: string;
    policyConsultedOn: string;
    publishedAt: string;
  })[];
};
export type ResultRow = {
  username: string;
  position: number;
  jobId: string | null;
  state: "awaiting_source" | "queued" | "done" | "failed";
  failure: string | null;
  source: Source | null;
  sourceLabel: string | null;
  completedAt: string | null;
  score: number | null;
  notes: Notes | null;
  confidence: Confidence | null;
  medianViews: number | null;
  decision: Decision;
  reason: string | null;
  community: Risk | null;
  recommendation: Risk | null;
  niche: string | null;
  subniche: string | null;
  groupReference: string | null;
};
export type ReportDetail = {
  id: string;
  username: string;
  source: Source;
  sourceLabel: string;
  completedAt: string;
  reviewedAt: string | null;
  assessment: Assessment | null;
  pastReports: { id: string; date: string; sourceLabel: string }[];
  report: Report;
  history: { id: number; date: string; decision: Decision; score: number | null; reason: string }[];
};

export const decisions: Record<Decision, string> = {
  approved: "Aprovado",
  rejected: "Reprovado",
  review: "Em análise",
};
export const confidenceLabels: Record<Confidence, string> = {
  low: "Baixa",
  medium: "Média",
  high: "Alta",
};
export const risks: Record<Risk, string> = {
  low: "Baixo",
  moderate: "Moderado",
  high: "Alto",
  critical: "Crítico",
  indeterminate: "Indeterminado",
};
export const accountStatusLabels: Record<AccountStatus, string> = {
  unverified: "Não verificado",
  eligible: "Elegível segundo a evidência revisada",
  restricted: "Restrição registrada na revisão",
};
export const coverageLabels: Record<Coverage, string> = {
  full: "Vídeo completo revisado",
  frames: "Amostra de frames",
  metadata: "Metadados",
  thumbnail: "Miniatura",
};
export const reasons: Record<string, string> = {
  no_review: "Aguardando revisão de conteúdo e do Status da Conta.",
  insufficient_data: "Os dados ou as evidências ainda são insuficientes.",
  confirmed_critical: "Risco crítico confirmado com evidência.",
  confirmed_recurring: "Risco alto confirmado em pelo menos três publicações.",
  account_restricted: "A revisão registrou uma restrição no Status da Conta.",
  risk_review: "Há sinais de risco alto ou crítico para revisar.",
  account_unverified: "Falta evidência autorizada do Status da Conta.",
  low_potential: "O índice de potencial ficou abaixo de 60.",
  score_review: "O índice ficou entre 60 e 79,9.",
  below_approval_threshold: "O índice de potencial ficou abaixo de 30/100.",
  limited_coverage: "A aprovação exige confiança alta e pelo menos 20 Reels completos revisados.",
  safety_review: "A conformidade ainda não atende aos requisitos de aprovação.",
  final_review: "Falta concluir a revisão final.",
  review_complete: "Nota, cobertura, conformidade e revisão atendem aos critérios.",
};
export const statuses: Record<ResultRow["state"], string> = {
  awaiting_source: "Aguardando dados",
  queued: "Na fila",
  done: "Processado",
  failed: "Falhou",
};
export const bands: Record<NonNullable<Report["band"]>, string> = {
  excellent: "Excelente",
  very_good: "Muito bom",
  good: "Bom",
  regular: "Regular",
  low: "Baixo potencial",
};

export function csvCell(value: string | number | null | undefined) {
  const text = String(value ?? "");
  const safe = typeof value === "string" && /^[\s\p{Cf}]*[=+\-@]/u.test(text) ? "'" + text : text;
  return '"' + safe.replaceAll('"', '""') + '"';
}

export function rankingCsv(rows: ResultRow[]) {
  const columns = [
    "Perfil",
    "Decisão",
    "Índice",
    ...criteria.map(([, label]) => label),
    "Mediana de views",
    "Confiança",
    "Nicho",
    "Subnicho",
    "Comunidade",
    "Recomendação",
    "Grupo",
    "Fonte",
    "Motivo",
    "Relatório",
  ];
  const values = rows.map((row) => [
    row.username,
    decisions[row.decision],
    row.score,
    ...criteria.map(([key]) => row.notes?.[key]),
    row.medianViews,
    row.confidence && confidenceLabels[row.confidence],
    row.niche,
    row.subniche,
    row.community && risks[row.community],
    row.recommendation && risks[row.recommendation],
    row.groupReference,
    row.sourceLabel,
    reasons[row.reason ?? ""] ?? statuses[row.state],
    row.jobId,
  ]);
  return [columns, ...values].map((line) => line.map(csvCell).join(";")).join("\r\n");
}
