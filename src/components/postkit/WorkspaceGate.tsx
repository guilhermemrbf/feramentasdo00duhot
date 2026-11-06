import { useEffect, useState, type ReactNode } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { Loader2, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import type { PostkitDatabase } from "@/lib/postkit-database";
import {
  createPostkitInvitation,
  ensurePostkitSession,
  hashPostkitInvitation,
} from "@/lib/postkit-access";

export type Workspace = { id: string; name: string; timezone: string; owner_id: string };
const STORAGE_KEY = "postkit.workspace";
const client = () => supabase as unknown as SupabaseClient<PostkitDatabase>;
let opening: Promise<{ list: Workspace[]; selected: string; userId: string }> | null = null;

function openWorkspace() {
  if (opening) return opening;
  opening = (async () => {
    const session = await ensurePostkitSession(supabase.auth);
    let selected = "";
    try {
      selected = localStorage.getItem(STORAGE_KEY) ?? "";
    } catch {
      /* optional */
    }
    const invite = new URLSearchParams(window.location.hash.slice(1)).get("postkit-invite");
    if (invite) {
      const accepted = await client().rpc("accept_postkit_device_invite", {
        p_token_hash: await hashPostkitInvitation(invite),
      });
      if (accepted.error || !accepted.data) {
        throw new Error("O convite expirou ou já foi usado. Peça um novo convite à equipe.");
      }
      selected = accepted.data;
      window.history.replaceState(null, "", window.location.pathname + window.location.search);
      try {
        localStorage.setItem(STORAGE_KEY, selected);
      } catch {
        /* optional */
      }
    }
    const result = await client().rpc("ensure_postkit_workspace");
    if (result.error || !result.data?.length) {
      throw new Error("Não foi possível abrir sua operação. Tente novamente em instantes.");
    }
    return { list: result.data, selected, userId: session.user.id };
  })();
  void opening
    .finally(() => {
      opening = null;
    })
    .catch(() => undefined);
  return opening;
}

export function WorkspaceGate({ children }: { children: (ws: Workspace) => ReactNode }) {
  const [list, setList] = useState<Workspace[] | null>(null);
  const [currentId, setCurrentId] = useState("");
  const [userId, setUserId] = useState("");
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    setError("");
    void openWorkspace()
      .then((value) => {
        if (active) {
          setList(value.list);
          setCurrentId(value.selected);
          setUserId(value.userId);
        }
      })
      .catch((reason) => {
        if (active)
          setError(
            reason instanceof Error ? reason.message : "Não foi possível abrir sua operação.",
          );
      });
    return () => {
      active = false;
    };
  }, [retry]);
  const current = list?.find((workspace) => workspace.id === currentId) ?? list?.[0];
  if (!current)
    return (
      <AppShell>
        <div className="mx-auto my-16 max-w-md rounded-lg border border-border bg-card p-6 text-center">
          {error ? (
            <>
              <p role="alert" className="text-sm">
                {error}
              </p>
              <button
                className="mt-4 rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground"
                onClick={() => setRetry((value) => value + 1)}
              >
                Tentar novamente
              </button>
            </>
          ) : (
            <>
              <Loader2 className="mx-auto size-6 animate-spin text-primary" />
              <p className="mt-3 text-sm">Abrindo sua operação…</p>
              <p className="mt-1 text-xs text-muted-foreground">Sem cadastro e sem senha.</p>
            </>
          )}
        </div>
      </AppShell>
    );
  return (
    <AppShell>
      <div className="mx-auto max-w-7xl px-5 pt-5">
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card px-4 py-3 text-xs">
          <span className="text-muted-foreground">Sua operação</span>
          <select
            aria-label="Operação atual"
            value={current.id}
            className="rounded-md border border-border bg-background p-2"
            onChange={(event) => {
              setCurrentId(event.target.value);
              try {
                localStorage.setItem(STORAGE_KEY, event.target.value);
              } catch {
                /* optional */
              }
            }}
          >
            {list?.map((workspace) => (
              <option key={workspace.id} value={workspace.id}>
                {workspace.name}
              </option>
            ))}
          </select>
          <span className="ml-auto text-muted-foreground">Acesso salvo neste navegador</span>
        </div>
        <TeamAccess key={current.id} workspace={current} userId={userId} />
      </div>
      {children(current)}
    </AppShell>
  );
}

function TeamAccess({ workspace, userId }: { workspace: Workspace; userId: string }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [invitation, setInvitation] = useState<{ url: string; hash: string } | null>(null);
  const [message, setMessage] = useState("");
  const [members, setMembers] = useState<{ user_id: string; role: string; created_at: string }[]>(
    [],
  );
  const owner = workspace.owner_id === userId;
  const loadMembers = async () => {
    const result = await supabase
      .from("workspace_members")
      .select("user_id,role,created_at")
      .eq("workspace_id", workspace.id);
    if (result.error) throw result.error;
    setMembers(result.data ?? []);
  };
  const invite = async () => {
    if (busy) return;
    setBusy(true);
    setMessage("");
    try {
      if (invitation)
        await client().rpc("revoke_postkit_device_invite", { p_token_hash: invitation.hash });
      const value = await createPostkitInvitation();
      const created = await client().rpc("create_postkit_device_invite", {
        p_workspace_id: workspace.id,
        p_token_hash: value.hash,
      });
      if (created.error) throw created.error;
      setInvitation({
        url: `${window.location.origin}/automacao-instagram#postkit-invite=${value.token}`,
        hash: value.hash,
      });
    } catch {
      setMessage("Não foi possível criar o convite. Tente novamente.");
    } finally {
      setBusy(false);
    }
  };
  const revoke = async () => {
    if (busy || !invitation) return;
    setBusy(true);
    try {
      const result = await client().rpc("revoke_postkit_device_invite", {
        p_token_hash: invitation.hash,
      });
      if (result.error) throw result.error;
      setInvitation(null);
      setMessage("Convite cancelado.");
    } catch {
      setMessage("Não foi possível cancelar o convite.");
    } finally {
      setBusy(false);
    }
  };
  const remove = async (memberId: string) => {
    if (!owner || busy) return;
    setBusy(true);
    try {
      const result = await supabase
        .from("workspace_members")
        .delete()
        .eq("workspace_id", workspace.id)
        .eq("user_id", memberId)
        .select("user_id");
      if (result.error || !result.data?.length) throw new Error("Not removed");
      await loadMembers();
      setMessage("Acesso do dispositivo revogado.");
    } catch {
      setMessage("Não foi possível revogar o acesso.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="mt-3 text-xs">
      <button
        className="inline-flex items-center gap-2 text-muted-foreground"
        onClick={() => {
          setOpen(!open);
          if (!open)
            void loadMembers().catch(() =>
              setMessage("Sem conexão para carregar os dispositivos."),
            );
        }}
      >
        <Users className="size-4" /> Equipe e dispositivos
      </button>
      {open && (
        <div className="mt-3 space-y-3 rounded-lg border border-border bg-card p-4">
          <p>
            Este navegador guarda seu acesso. Antes de limpar os dados do navegador ou trocar de
            computador, vincule outro dispositivo da equipe.
          </p>
          {owner ? (
            <>
              <p>
                O convite permite que outro dispositivo gerencie vídeos, contas e agendamentos desta
                operação. Compartilhe somente com sua equipe. Válido por 30 minutos, uma única vez.
              </p>
              <button
                disabled={busy}
                onClick={() => void invite()}
                className="rounded-md bg-primary px-3 py-2 text-primary-foreground disabled:opacity-50"
              >
                {busy ? "Aguarde…" : "Gerar convite para a equipe"}
              </button>
              {invitation && (
                <div className="space-y-2">
                  <input
                    aria-label="Convite de acesso da equipe"
                    className="w-full rounded-md border border-border bg-background p-2"
                    readOnly
                    value={invitation.url}
                  />
                  <div className="flex gap-3">
                    <button
                      onClick={() =>
                        void navigator.clipboard
                          .writeText(invitation.url)
                          .then(() => setMessage("Convite copiado."))
                          .catch(() => setMessage("Selecione e copie o convite acima."))
                      }
                    >
                      Copiar convite
                    </button>
                    <button disabled={busy} onClick={() => void revoke()}>
                      Cancelar convite
                    </button>
                  </div>
                </div>
              )}
              {members
                .filter((member) => member.user_id !== userId)
                .map((member, index) => (
                  <div
                    key={member.user_id}
                    className="flex items-center justify-between gap-3 border-t border-border pt-2"
                  >
                    <span>
                      Dispositivo {index + 1} · adicionado em{" "}
                      {new Intl.DateTimeFormat("pt-BR").format(new Date(member.created_at))}
                    </span>
                    <button disabled={busy} onClick={() => void remove(member.user_id)}>
                      Revogar acesso
                    </button>
                  </div>
                ))}
            </>
          ) : (
            <p>
              Você está em uma operação compartilhada. Para vincular outro dispositivo, peça um
              convite ao responsável.
            </p>
          )}
          {message && (
            <p role="status" className="text-muted-foreground">
              {message}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
