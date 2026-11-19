import { ChevronRight, Instagram } from "lucide-react";
import type { InstagramConnectionDetailsAccount } from "./InstagramConnectionDetails";

export function InstagramAccountCards({
  accounts,
  selected,
  videoCounts,
  onSelect,
  disabled = false,
}: {
  accounts: InstagramConnectionDetailsAccount[];
  selected?: string;
  videoCounts?: ReadonlyMap<string, number>;
  onSelect: (id: string) => void;
  disabled?: boolean;
}) {
  return (
    <ul aria-label="Perfis do Instagram" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {accounts.map((account) => {
        const connected = account.connection_status === "connected";
        const videos = videoCounts?.get(account.id) ?? 0;
        return (
          <li key={account.id} className="min-w-0">
            <button
              type="button"
              disabled={disabled}
              aria-pressed={selected === account.id}
              aria-label={`Abrir conta @${account.username}`}
              onClick={() => onSelect(account.id)}
              className="group flex min-h-28 w-full items-center gap-3 rounded-xl border border-border bg-background/50 p-4 text-left transition-colors hover:border-primary/70 hover:bg-primary/5 focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-50 aria-pressed:border-primary aria-pressed:bg-primary/10"
            >
              {account.profile_picture_url ? (
                <img
                  src={account.profile_picture_url}
                  alt=""
                  width={44}
                  height={44}
                  referrerPolicy="no-referrer"
                  loading="lazy"
                  className="size-11 shrink-0 rounded-xl border border-border object-cover"
                />
              ) : (
                <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-brand-red">
                  <Instagram className="size-5" aria-hidden />
                </span>
              )}
              <span className="min-w-0 flex-1">
                <strong className="block truncate text-sm">@{account.username}</strong>
                <span
                  className={`mt-1 block text-xs ${connected ? "text-emerald-300" : "text-amber-200"}`}
                >
                  {connected ? "Conectada" : "Precisa de atenção"}
                </span>
                {videoCounts && (
                  <span className="mt-1 block text-xs text-muted-foreground">
                    {videos} {videos === 1 ? "vídeo na biblioteca" : "vídeos na biblioteca"}
                  </span>
                )}
              </span>
              <ChevronRight
                className="size-4 shrink-0 text-muted-foreground group-hover:text-brand-red"
                aria-hidden
              />
            </button>
          </li>
        );
      })}
    </ul>
  );
}
