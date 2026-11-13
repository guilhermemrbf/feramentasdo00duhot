import { useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { StoriesChoice } from "@/lib/instagram-automation-review";
type StoryDB = {
  public: {
    Tables: {
      instagram_story_reminders: {
        Row: {
          id: string;
          workspace_id: string;
          instagram_account_id: string;
          state: string;
          scheduled_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
  };
};
const client = supabase as unknown as SupabaseClient<StoryDB>;
export function InstagramAutomationReview({
  workspaceId,
  accountId,
  username,
  choice,
  onChoice,
  onStoryCount,
  confirmed,
  onConfirm,
  onStories,
  disabled,
}: {
  workspaceId: string;
  accountId: string;
  username: string;
  choice: StoriesChoice;
  onChoice: (v: StoriesChoice) => void;
  onStoryCount: (n: number) => void;
  confirmed: boolean;
  onConfirm: (v: boolean) => void;
  onStories: () => void;
  disabled: boolean;
}) {
  const [count, setCount] = useState<number | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    let active = true;
    setCount(null);
    onStoryCount(0);
    const load = async () => {
      const { count, error } = await client
        .from("instagram_story_reminders")
        .select("id", { count: "exact", head: true })
        .eq("workspace_id", workspaceId)
        .eq("instagram_account_id", accountId)
        .eq("state", "pending")
        .gt("scheduled_at", new Date().toISOString());
      if (active) {
        setError(!!error);
        setCount(error ? null : (count ?? 0));
        onStoryCount(error ? 0 : (count ?? 0));
      }
    };
    void load().catch(() => {
      if (active) {
        setError(true);
        setCount(null);
        onStoryCount(0);
      }
    });
    const timer = setInterval(
      () =>
        void load().catch(() => {
          if (active) {
            setError(true);
            onStoryCount(0);
          }
        }),
      15000,
    );
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [workspaceId, accountId, onStoryCount]);
  return (
    <fieldset
      disabled={disabled}
      className="mt-5 space-y-3 rounded-xl border border-fuchsia-400/25 bg-fuchsia-400/5 p-4"
    >
      <legend className="px-2 font-semibold">Antes de ativar · @{username}</legend>
      <p className="text-sm">Como você quer usar Stories nesta conta?</p>
      <div className="grid gap-3 sm:grid-cols-2">
        {(
          [
            {
              value: "planned",
              title: "Vou preparar Stories",
              text: "Usar a biblioteca e os lembretes desta conta.",
            },
            {
              value: "skip",
              title: "Somente Reels por enquanto",
              text: "Continuar sem Stories. Você pode configurá-los depois.",
            },
          ] as const
        ).map((item) => (
          <label
            key={item.value}
            className={`cursor-pointer rounded-lg border p-3 ${choice === item.value ? "border-fuchsia-400 bg-fuchsia-400/10" : "border-border bg-card"}`}
          >
            <input
              type="radio"
              name="stories-review"
              value={item.value}
              checked={choice === item.value}
              onChange={() => {
                onChoice(item.value);
                onConfirm(false);
              }}
            />{" "}
            <strong className="text-sm">{item.title}</strong>
            <span className="mt-1 block text-xs text-muted-foreground">{item.text}</span>
          </label>
        ))}
      </div>
      {choice === "planned" && (
        <div className="text-sm">
          <p>
            {error
              ? "Não foi possível conferir os Stories. Tente novamente antes de ativar."
              : count === null
                ? "Conferindo biblioteca de Stories…"
                : `${count} Stories futuros preparados para @${username}.`}
          </p>
          <button
            type="button"
            onClick={onStories}
            className="mt-2 rounded-lg border border-fuchsia-400/40 px-3 py-2"
          >
            Abrir biblioteca e preparar Stories
          </button>
          <p className="mt-2 text-xs text-muted-foreground">
            Stories com link são lembretes: você adiciona o link e publica no Instagram. Não serão
            publicados automaticamente. Confira se há Stories para todos os dias desejados.
          </p>
        </div>
      )}
      <label className="flex items-start gap-2 border-t border-border pt-3 text-sm">
        <input
          type="checkbox"
          className="mt-1"
          checked={confirmed}
          onChange={(e) => onConfirm(e.target.checked)}
        />
        Conferi a conta, os vídeos, legenda, hashtags, capa (ou a opção de não usar capa), horários
        e a escolha de Stories. Autorizo esta programação.
      </label>
    </fieldset>
  );
}
