import { useState } from "react";
import { Instagram, Loader2, RefreshCw, Unplug } from "lucide-react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import {
  disconnectInstagramConnection,
  verifyInstagramConnection,
  type InstagramConnectionCheck,
} from "@/lib/api/instagram-connection.functions";
import { instagramProfilePicture } from "@/lib/instagram-connection-profile";

export type InstagramConnectionDetailsAccount = {
  id: string;
  instagram_user_id: string;
  username: string;
  display_name: string | null;
  connection_status: string;
  account_type: string | null;
  scopes: string[];
  token_expires_at: string | null;
  last_verified_at: string | null;
  connected_at: string | null;
  created_at: string;
  profile_picture_url: string | null;
};

function connectionDate(value: string | null | undefined, timeZone: string) {
  if (!value || !Number.isFinite(Date.parse(value))) return "Não informado";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone,
  }).format(new Date(value));
}

const permissionNames: Record<string, string> = {
  instagram_basic: "Identificar perfil e publicações",
  instagram_content_publish: "Publicar conteúdo autorizado",
  instagram_business_basic: "Identificar perfil e publicações",
  instagram_business_content_publish: "Publicar conteúdo autorizado",
};

export function InstagramConnectionDetails({
  account,
  workspaceId,
  timeZone,
  disabled,
  onChanged,
  onReconnect,
}: {
  account: InstagramConnectionDetailsAccount;
  workspaceId: string;
  timeZone: string;
  disabled: boolean;
  onChanged: () => void;
  onReconnect: () => void;
}) {
  const [checking, setChecking] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);
  const [check, setCheck] = useState<InstagramConnectionCheck | null>(null);
  const [error, setError] = useState("");
  const [pictureFailed, setPictureFailed] = useState(false);
  const picture = instagramProfilePicture(
    check?.profile?.pictureUrl ?? account.profile_picture_url,
  );
  const ready = account.connection_status === "connected";

  return (
    <div className="min-w-0 flex-1">
      <div className="flex min-w-0 items-center gap-3">
        {picture && !pictureFailed ? (
          <img
            src={picture}
            alt={`Foto de @${account.username}`}
            width={40}
            height={40}
            referrerPolicy="no-referrer"
            className="size-10 rounded-full object-cover"
            onError={() => setPictureFailed(true)}
          />
        ) : (
          <Instagram aria-hidden="true" className="size-7 shrink-0 text-fuchsia-300" />
        )}
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">
            @{check?.profile?.username ?? account.username}
          </p>
          <p className="text-xs text-muted-foreground">
            {ready ? "Pode ser usada em Reels e Stories" : "Conecte esta conta novamente"}
          </p>
        </div>
      </div>
      <details className="mt-3 text-xs" aria-label={`Conexão de @${account.username}`}>
        <summary className="cursor-pointer font-medium text-foreground underline-offset-4 hover:underline">
          Detalhes e acesso da conta
        </summary>
        <dl className="mt-3 grid gap-2 text-muted-foreground">
          <div>
            <dt className="font-semibold text-foreground">Nome do perfil</dt>
            <dd>
              {check?.profile?.name ?? account.display_name ?? "Não disponibilizado pela Meta"}
            </dd>
          </div>
          <div>
            <dt className="font-semibold text-foreground">Identificador do Instagram</dt>
            <dd className="break-all">{account.instagram_user_id}</dd>
          </div>
          <div>
            <dt className="font-semibold text-foreground">Última conexão autorizada</dt>
            <dd>{connectionDate(account.connected_at, timeZone)}</dd>
          </div>
          <div>
            <dt className="font-semibold text-foreground">Última verificação</dt>
            <dd>{connectionDate(check?.checkedAt ?? account.last_verified_at, timeZone)}</dd>
          </div>
          <div>
            <dt className="font-semibold text-foreground">Validade informada pela Meta</dt>
            <dd>
              {account.token_expires_at
                ? connectionDate(account.token_expires_at, timeZone)
                : "Sem data de expiração informada; o acesso pode ser revogado na Meta."}
            </dd>
          </div>
          <div>
            <dt className="font-semibold text-foreground">Permissões autorizadas</dt>
            <dd>
              {account.scopes?.length ? (
                <ul className="mt-1 list-disc pl-4">
                  {account.scopes.map((scope) => (
                    <li key={scope}>{permissionNames[scope] ?? scope}</li>
                  ))}
                </ul>
              ) : (
                "Nenhuma permissão ativa registrada"
              )}
            </dd>
          </div>
          {!picture && (
            <div>
              <dt className="font-semibold text-foreground">Foto de perfil</dt>
              <dd>Consulte o acesso para buscar a foto, quando a Meta disponibilizar.</dd>
            </div>
          )}
        </dl>
        <div className="mt-3 flex flex-wrap gap-2">
          {ready && (
            <button
              type="button"
              disabled={checking || disconnecting || disabled}
              className="inline-flex min-h-10 items-center gap-2 rounded-md border border-border px-3 py-2 font-medium disabled:opacity-50"
              onClick={async () => {
                setChecking(true);
                setError("");
                try {
                  const result = await verifyInstagramConnection({
                    data: { workspaceId, accountId: account.id },
                  });
                  setCheck(result);
                  setPictureFailed(false);
                  onChanged();
                } catch (e) {
                  setError(e instanceof Error ? e.message : "Não foi possível verificar a conta.");
                } finally {
                  setChecking(false);
                }
              }}
            >
              {checking ? (
                <Loader2 aria-hidden="true" className="size-4 animate-spin" />
              ) : (
                <RefreshCw aria-hidden="true" className="size-4" />
              )}
              {checking ? "Consultando a Meta…" : "Verificar acesso"}
            </button>
          )}
          <button
            type="button"
            disabled={checking || disconnecting || disabled}
            onClick={onReconnect}
            className="min-h-10 rounded-md border border-border px-3 py-2 font-medium disabled:opacity-50"
          >
            Reconectar Instagram
          </button>
          {account.connection_status !== "revoked" && (
            <button
              type="button"
              disabled={checking || disconnecting || disabled}
              onClick={() => {
                setError("");
                setConfirmDisconnect(true);
              }}
              className="inline-flex min-h-10 items-center gap-2 rounded-md border border-red-400/30 px-3 py-2 font-medium text-red-300 disabled:opacity-50"
            >
              <Unplug aria-hidden="true" className="size-4" />
              Desconectar desta operação
            </button>
          )}
        </div>
        {check && (
          <p
            role="status"
            className={`mt-3 rounded-md border p-2 ${check.outcome === "verified" && ready ? "border-emerald-400/30 text-emerald-300" : "border-amber-400/30 text-amber-200"}`}
          >
            {ready
              ? check.message
              : "Esta conta está desconectada ou precisa ser autorizada novamente."}
          </p>
        )}
        {error && (
          <p role="alert" className="mt-3 text-red-300">
            {error}
          </p>
        )}
      </details>
      <AlertDialog
        open={confirmDisconnect}
        onOpenChange={(open) => {
          if (!disconnecting) setConfirmDisconnect(open);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Desconectar @{account.username}?</AlertDialogTitle>
            <AlertDialogDescription>
              Os Reels agendados e os lembretes pendentes de Stories desta conta serão cancelados, e
              as repetições serão pausadas. Sua biblioteca e o histórico permanecem salvos. As
              outras contas continuam conectadas. Reconectar depois não reativa os agendamentos
              cancelados.
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
              className="min-h-10 rounded-md bg-primary px-4 py-2 font-semibold text-primary-foreground disabled:opacity-50"
              onClick={async () => {
                setDisconnecting(true);
                setError("");
                try {
                  await disconnectInstagramConnection({
                    data: { workspaceId, accountId: account.id },
                  });
                  setCheck(null);
                  setConfirmDisconnect(false);
                  onChanged();
                } catch (e) {
                  setError(e instanceof Error ? e.message : "Não foi possível desconectar.");
                } finally {
                  setDisconnecting(false);
                }
              }}
            >
              {disconnecting ? "Desconectando…" : "Confirmar desconexão"}
            </button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
