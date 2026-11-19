import { useRef, useState } from "react";
import { ChevronRight, Instagram, Unplug } from "lucide-react";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { disconnectInstagramConnection } from "@/lib/api/instagram-connection.functions";
import type { InstagramConnectionDetailsAccount } from "./InstagramConnectionDetails";

const connectionLabels: Record<string, string> = {
  connected: "Conectada",
  expired: "Acesso expirado",
  revoked: "Desconectada",
  pending: "Aguardando autorização",
  error: "Precisa de atenção",
};

export function InstagramAccountCards({
  accounts,
  selected,
  videoCounts,
  onSelect,
  disabled = false,
  management,
}: {
  accounts: InstagramConnectionDetailsAccount[];
  selected?: string;
  videoCounts?: ReadonlyMap<string, number>;
  onSelect: (id: string) => void;
  disabled?: boolean;
  management?: {
    workspaceId: string;
    onDisconnected: (account: InstagramConnectionDetailsAccount) => void;
  };
}) {
  const [target, setTarget] = useState<InstagramConnectionDetailsAccount>();
  const [disconnecting, setDisconnecting] = useState(false);
  const [error, setError] = useState("");
  const returnFocus = useRef<HTMLButtonElement>(null);
  const accountButtons = useRef(new Map<string, HTMLButtonElement>());

  const disconnect = async () => {
    if (!target || !management || disconnecting) return;
    setDisconnecting(true);
    setError("");
    try {
      await disconnectInstagramConnection({
        data: { workspaceId: management.workspaceId, accountId: target.id },
      });
      returnFocus.current = accountButtons.current.get(target.id) ?? null;
      setTarget(undefined);
      management.onDisconnected(target);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Não foi possível desconectar a conta.");
    } finally {
      setDisconnecting(false);
    }
  };

  return (
    <>
      <ul aria-label="Perfis do Instagram" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {accounts.map((account) => {
          const connected = account.connection_status === "connected";
          const videos = videoCounts?.get(account.id) ?? 0;
          return (
            <li
              key={account.id}
              className="min-w-0 rounded-xl border border-border bg-background/50"
            >
              <button
                ref={(node) => {
                  if (node) accountButtons.current.set(account.id, node);
                  else accountButtons.current.delete(account.id);
                }}
                type="button"
                disabled={disabled}
                aria-pressed={selected === account.id}
                aria-label={`Abrir conta @${account.username}`}
                onClick={() => onSelect(account.id)}
                className="group flex min-h-28 w-full items-center gap-3 rounded-xl p-4 text-left transition-colors hover:bg-primary/5 focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-50 aria-pressed:bg-primary/10"
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
                    className={`mt-1 block text-xs ${connected ? "text-emerald-300" : account.connection_status === "revoked" ? "text-muted-foreground" : "text-amber-200"}`}
                  >
                    {connectionLabels[account.connection_status] ?? "Precisa de atenção"}
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
              {management && account.connection_status !== "revoked" && (
                <div className="border-t border-border px-3 py-1">
                  <button
                    type="button"
                    aria-label={`Desconectar @${account.username}`}
                    disabled={disabled || disconnecting}
                    onClick={(event) => {
                      returnFocus.current = event.currentTarget;
                      setError("");
                      setTarget(account);
                    }}
                    className="inline-flex min-h-10 items-center gap-2 rounded-lg px-2 text-sm font-medium text-red-300 hover:bg-red-400/10 focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-50"
                  >
                    <Unplug className="size-4" aria-hidden />
                    Desconectar
                  </button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
      <AlertDialog
        open={!!target}
        onOpenChange={(open) => {
          if (!open && !disconnecting) setTarget(undefined);
        }}
      >
        <AlertDialogContent
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            returnFocus.current?.focus();
          }}
        >
          <AlertDialogHeader>
            <AlertDialogTitle>Desconectar @{target?.username}?</AlertDialogTitle>
            <AlertDialogDescription>
              Os Reels agendados e os lembretes de Stories deste perfil serão cancelados. As
              repetições serão pausadas. A biblioteca e o histórico ficam salvos. Para voltar a
              publicar depois de reconectar, faça um novo agendamento.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {error && (
            <p role="alert" className="text-sm text-red-300">
              {error}
            </p>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={disconnecting}>Manter conectada</AlertDialogCancel>
            <button
              type="button"
              disabled={disconnecting}
              onClick={disconnect}
              className="min-h-10 rounded-md bg-primary px-4 py-2 font-semibold text-primary-foreground disabled:opacity-50"
            >
              {disconnecting ? "Desconectando…" : "Confirmar desconexão"}
            </button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
