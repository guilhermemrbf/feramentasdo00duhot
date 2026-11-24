import { Bell, ChartColumn, Receipt, ShieldAlert } from "lucide-react";
import { useState, type FormEvent, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import {
  REPORT_HOURS,
  readMouseHotNoticePreferences,
  type MouseHotNoticePreferences,
} from "@/lib/mousehot-notice-preferences";
import { SettingsCardHeading, SettingsSectionHeading } from "./SettingsHeadings";

const enabledOptions = { off: "Desabilitado", on: "Habilitado" };
const visibilityOptions = { off: "Esconder", on: "Mostrar" };
const reportStyles = {
  profit: "Status de Lucro",
  detailed: "Resumo Detalhado",
  creative: "Notificações Criativas",
} satisfies Record<MouseHotNoticePreferences["reportStyle"], string>;
const reportExamples = {
  profit: "Seu lucro até agora é de R$ 239,87.",
  detailed: "Faturamento de R$ 340,00 · Lucro de R$ 239,87 · 4 vendas",
  creative: "Resumo da operação · 4 vendas e R$ 239,87 de lucro.",
} satisfies Record<MouseHotNoticePreferences["reportStyle"], string>;

export function SettingsNotifications({
  dashboard,
  metadata,
  approved,
}: {
  dashboard: string;
  metadata: Record<string, unknown>;
  approved: ReactNode;
}) {
  const [preferences, setPreferences] = useState(() => readMouseHotNoticePreferences(metadata));
  const [saved, setSaved] = useState(preferences);
  const [threshold, setThreshold] = useState(String(preferences.metaThreshold));
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ text: string; error?: boolean }>();

  function update<Key extends keyof MouseHotNoticePreferences>(
    key: Key,
    value: MouseHotNoticePreferences[Key],
  ) {
    setPreferences((previous) => ({ ...previous, [key]: value }));
    setFeedback(undefined);
  }

  const next = readMouseHotNoticePreferences({
    mousehot_notice_preferences: { ...preferences, metaThreshold: Number(threshold) },
  });
  const dirty = JSON.stringify(next) !== JSON.stringify(saved);
  const thresholdValue = Number(threshold);
  const validThreshold = thresholdValue >= 0.01 && thresholdValue <= 1_000_000;

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving || !dirty || !validThreshold) return;
    setSaving(true);
    setFeedback(undefined);
    try {
      const { error } = await supabase.auth.updateUser({
        data: { mousehot_notice_preferences: next },
      });
      if (error) throw error;
      setSaved(next);
      setFeedback({ text: "Preferências salvas." });
    } catch {
      setFeedback({
        text: "Não foi possível salvar as preferências. Tente novamente.",
        error: true,
      });
    } finally {
      setSaving(false);
    }
  }

  const formattedThreshold = new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: preferences.metaCurrency,
  }).format(validThreshold ? thresholdValue : 0);
  const salePreview = [
    preferences.salesAmount === "net" && "Valor líquido de R$ 84,90",
    preferences.salesAmount === "gross" && "Valor da venda de R$ 100,00",
    preferences.showProduct && "Produto de exemplo",
    preferences.showCampaign && "UTM campanha-exemplo",
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <section id="notificacoes" className="settings-section" aria-labelledby="settings-alerts">
      <SettingsSectionHeading id="settings-alerts" title="Notificações" icon={Bell}>
        Personalize os avisos de venda, os relatórios e os alertas de conta.
      </SettingsSectionHeading>
      <div className="settings-guide">
        <strong>Como funciona</strong>
        <ol>
          <li>Use as prévias para conferir o formato das notificações.</li>
          <li>Salve as preferências que quer manter na conta.</li>
          <li>Em App e plano, ative os avisos de venda aprovada em cada dispositivo.</li>
        </ol>
      </div>
      <form className="settings-columns" onSubmit={save}>
        <section className="settings-card settings-fields" aria-labelledby="settings-notice-sales">
          <SettingsCardHeading
            id="settings-notice-sales"
            title="Notificações de Venda"
            icon={Receipt}
          >
            Ative vendas aprovadas neste dispositivo. As demais opções abaixo personalizam a prévia.
          </SettingsCardHeading>
          <Choice
            label="Enviar vendas pendentes"
            options={enabledOptions}
            value={preferences.pendingSales ? "on" : "off"}
            onChange={(value) => update("pendingSales", value === "on")}
          />
          <label>Enviar vendas aprovadas {approved}</label>
          <Choice
            label="Valor exibido"
            options={{ net: "Valor líquido", gross: "Valor bruto", hidden: "Esconder" }}
            value={preferences.salesAmount}
            onChange={(value) => update("salesAmount", value)}
          />
          <Choice
            label="Nome do produto"
            options={visibilityOptions}
            value={preferences.showProduct ? "on" : "off"}
            onChange={(value) => update("showProduct", value === "on")}
          />
          <Choice
            label="Campanha UTM"
            options={visibilityOptions}
            value={preferences.showCampaign ? "on" : "off"}
            onChange={(value) => update("showCampaign", value === "on")}
          />
          <NoticePreview
            title={`${preferences.pendingSales ? "Venda pendente" : "Venda aprovada"} | ${dashboard}`}
            body={salePreview || "Confira a venda no dashboard."}
          />
        </section>
        <section className="settings-card settings-fields" aria-labelledby="settings-notice-report">
          <SettingsCardHeading
            id="settings-notice-report"
            title="Notificações de Relatório"
            icon={ChartColumn}
          >
            Salve os horários e o formato. O envio automático de relatórios ainda está indisponível.
          </SettingsCardHeading>
          <fieldset className="settings-choice-group">
            <legend>Horários · São Paulo</legend>
            {REPORT_HOURS.map((hour) => {
              const label = `Notificação das ${String(hour).padStart(2, "0")}:00`;
              return (
                <label className="settings-toggle-row" key={hour}>
                  {label}
                  <Switch
                    checked={preferences.reportHours.includes(hour)}
                    onCheckedChange={(enabled) =>
                      update(
                        "reportHours",
                        enabled
                          ? [...preferences.reportHours, hour]
                          : preferences.reportHours.filter((value) => value !== hour),
                      )
                    }
                  />
                </label>
              );
            })}
          </fieldset>
          <fieldset className="settings-choice-group">
            <legend>Padrão de notificação</legend>
            {Object.entries(reportStyles).map(([style, label]) => (
              <label className="settings-radio-row" key={style}>
                <input
                  type="radio"
                  name="mousehot-report-style"
                  value={style}
                  checked={preferences.reportStyle === style}
                  onChange={() =>
                    update("reportStyle", style as MouseHotNoticePreferences["reportStyle"])
                  }
                />
                {label}
              </label>
            ))}
          </fieldset>
          <NoticePreview title={dashboard} body={reportExamples[preferences.reportStyle]} />
        </section>
        <section className="settings-card settings-wide" aria-labelledby="settings-notice-meta">
          <SettingsCardHeading
            id="settings-notice-meta"
            title="Alertas de conta Meta"
            icon={ShieldAlert}
          >
            Configure suas preferências para suspensão e cobrança. O envio automático de alertas da
            Meta ainda está indisponível.
          </SettingsCardHeading>
          <div className="settings-columns">
            <div className="settings-fields">
              <Choice
                label="Conta suspensa / desativada"
                options={enabledOptions}
                value={preferences.metaSuspended ? "on" : "off"}
                onChange={(value) => update("metaSuspended", value === "on")}
              />
              <Choice
                label="Pagamento pendente"
                options={enabledOptions}
                value={preferences.metaUnsettled ? "on" : "off"}
                onChange={(value) => update("metaUnsettled", value === "on")}
              />
              <Choice
                label="Limite de cobrança próximo"
                options={enabledOptions}
                value={preferences.metaBilling ? "on" : "off"}
                onChange={(value) => update("metaBilling", value === "on")}
              />
              <div className="settings-columns">
                <Choice
                  label="Moeda do alerta"
                  options={{ BRL: "Real (R$)", USD: "Dólar (US$)", EUR: "Euro (€)" }}
                  value={preferences.metaCurrency}
                  onChange={(value) => update("metaCurrency", value)}
                />
                <label>
                  Avisar quando faltar (valor)
                  <input
                    className="field"
                    type="number"
                    required
                    min="0.01"
                    max="1000000"
                    step="0.01"
                    value={threshold}
                    onChange={(event) => {
                      setThreshold(event.target.value);
                      setFeedback(undefined);
                    }}
                  />
                </label>
              </div>
            </div>
            <NoticePreview
              title="Limite de cobrança próximo"
              body={`Conta de anúncios de exemplo · faltam ${formattedThreshold} para a cobrança.`}
            />
          </div>
        </section>
        <div className="settings-save settings-wide">
          {feedback && <p role={feedback.error ? "alert" : "status"}>{feedback.text}</p>}
          <Button
            type="submit"
            className="workspace-primary-action"
            disabled={!dirty || saving || !validThreshold}
          >
            {saving ? "Salvando…" : "Salvar preferências de notificação"}
          </Button>
        </div>
      </form>
    </section>
  );
}

function Choice<Value extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: Record<Value, string>;
  value: Value;
  onChange: (value: Value) => void;
}) {
  return (
    <label>
      {label}
      <select
        className="field"
        value={value}
        onChange={(event) => onChange(event.target.value as Value)}
      >
        {Object.entries(options).map(([key, title]) => (
          <option key={key} value={key}>
            {String(title)}
          </option>
        ))}
      </select>
    </label>
  );
}

function NoticePreview({ title, body }: { title: string; body: string }) {
  return (
    <div className="settings-preview">
      <small>Prévia de notificação · Exemplo</small>
      <div>
        <img src="/brand/pwa-192.png" alt="" width="32" height="32" loading="lazy" />
        <div>
          <strong>{title}</strong>
          <p>{body}</p>
        </div>
      </div>
    </div>
  );
}
