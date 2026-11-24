import { Clock3, ShieldCheck, UserRound } from "lucide-react";
import { createFileRoute, useRouterState } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { platformRpc, rpcData, type Lead, type TrialInvite } from "@/lib/platform-access-client";
import { usePlatformAccess } from "@/components/access/PlatformAccessProvider";
import { TrialInviteForm } from "@/components/access/TrialInviteForm";

export const Route = createFileRoute("/aprovacoes")({
  head: () => ({
    meta: [{ title: "Aprovações e convites | Mousefy" }, { name: "robots", content: "noindex" }],
  }),
  component: ApprovalsPage,
});

const dateFormat = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" });
const decisions = { pending: "Pendente", approved: "Aprovado", denied: "Recusado" };
const emptyLeads: Lead[] = [];
const emptyInvites: TrialInvite[] = [];

function ApprovalsPage() {
  const { user } = usePlatformAccess();
  const queryClient = useQueryClient();
  const hash = useRouterState({ select: (state) => state.location.hash });
  const inviteSection = useRef<HTMLElement>(null);

  useEffect(() => {
    if (hash !== "convites") return;
    inviteSection.current?.scrollIntoView({ block: "nearest" });
    inviteSection.current?.focus({ preventScroll: true });
  }, [hash]);
  const key = ["admin-approvals", user?.id];
  const [filter, setFilter] = useState<Lead["decision"] | "all">("pending");
  const [formRevision, setFormRevision] = useState(0);
  const [notice, setNotice] = useState("");
  const requests = useQuery({
    queryKey: key,
    queryFn: async () => {
      const [leads, invites] = await Promise.all([
        rpcData(platformRpc.rpc("platform_admin_leads")),
        rpcData(platformRpc.rpc("platform_admin_invites")),
      ]);
      return { leads: leads ?? emptyLeads, invites: invites ?? emptyInvites };
    },
  });
  const decision = useMutation({
    mutationFn: ({ id, next }: { id: string; next: "approved" | "denied" }) =>
      rpcData(platformRpc.rpc("platform_admin_decide", { p_user: id, p_decision: next })),
    onSuccess: (_data, { next }) =>
      setNotice(next === "approved" ? "Cadastro aprovado." : "Acesso recusado."),
    onError: () =>
      setNotice(
        "Não foi possível aplicar a decisão. Confira se o e-mail foi confirmado e tente novamente.",
      ),
    onSettled: () => queryClient.invalidateQueries({ queryKey: key }),
  });
  const revoke = useMutation({
    mutationFn: (id: string) =>
      rpcData(platformRpc.rpc("platform_admin_revoke_invite", { p_id: id })),
    onSuccess: () => {
      setFormRevision((revision) => revision + 1);
      setNotice("Convite revogado.");
    },
    onError: () => setNotice("Não foi possível revogar o convite."),
    onSettled: () => queryClient.invalidateQueries({ queryKey: key }),
  });

  const leads = requests.data?.leads ?? emptyLeads;
  const invites = requests.data?.invites ?? emptyInvites;
  const visibleLeads = leads.filter((lead) => filter === "all" || lead.decision === filter);
  const pending = leads.filter((lead) => lead.decision === "pending").length;

  return (
    <AppShell>
      <main className="admin-workspace mx-auto max-w-7xl p-4 sm:p-8">
        <header className="operate-heading">
          <div>
            <h1>Aprovações e convites</h1>
            <p>Analise os cadastros e libere acesso ao Mousefy ou envie um teste individual.</p>
          </div>
          {requests.isSuccess && (
            <span className="workspace-badge">
              {pending} {pending === 1 ? "pendente" : "pendentes"}
            </span>
          )}
        </header>
        {requests.isError && (
          <p role="alert" className="access-message">
            Não foi possível consultar os cadastros.{" "}
            <button type="button" onClick={() => void requests.refetch()}>
              Tentar novamente
            </button>
          </p>
        )}
        <p role="status" className="admin-notice">
          {notice}
        </p>
        <div className="admin-columns">
          <section className="admin-section" aria-labelledby="admin-leads">
            <div className="admin-section-heading">
              <h2 id="admin-leads">
                <UserRound size={20} aria-hidden /> Cadastros
              </h2>
              <label>
                Mostrar{" "}
                <select
                  className="field"
                  value={filter}
                  onChange={(event) => setFilter(event.target.value as typeof filter)}
                >
                  <option value="pending">Pendentes</option>
                  <option value="approved">Aprovados</option>
                  <option value="denied">Recusados</option>
                  <option value="all">Todos</option>
                </select>
              </label>
            </div>
            {requests.isPending && (
              <p className="admin-empty" role="status">
                Carregando cadastros…
              </p>
            )}
            {requests.isSuccess && !visibleLeads.length && (
              <p className="admin-empty">Nenhum cadastro nesta lista.</p>
            )}
            <ul className="admin-list">
              {visibleLeads.map((lead) => (
                <li key={lead.id}>
                  <div>
                    <strong>{lead.name || lead.email || "Cadastro sem nome"}</strong>
                    {lead.name && lead.email && <p>{lead.email}</p>}
                    <small>
                      {dateFormat.format(new Date(lead.created_at))} ·{" "}
                      {lead.verified_at ? "E-mail confirmado" : "E-mail a confirmar"}
                    </small>
                  </div>
                  <span className="workspace-badge">{decisions[lead.decision]}</span>
                  <div className="admin-row-actions">
                    {lead.decision !== "approved" && (
                      <button
                        type="button"
                        className="tool-action"
                        disabled={decision.isPending || !lead.verified_at}
                        onClick={() => decision.mutate({ id: lead.id, next: "approved" })}
                      >
                        <ShieldCheck size={16} aria-hidden /> Aprovar
                      </button>
                    )}
                    {lead.decision === "pending" && (
                      <button
                        type="button"
                        className="saas-button saas-button-outline"
                        disabled={decision.isPending}
                        onClick={() => decision.mutate({ id: lead.id, next: "denied" })}
                      >
                        Recusar
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </section>
          <section
            id="convites"
            ref={inviteSection}
            tabIndex={-1}
            className="admin-section admin-invite-section"
            aria-labelledby="admin-invites"
          >
            <div className="admin-section-heading">
              <h2 id="admin-invites">
                <Clock3 size={20} aria-hidden /> Convites de 15 minutos
              </h2>
            </div>
            <div className="admin-invite-form">
              <TrialInviteForm key={formRevision} />
            </div>
            {requests.isSuccess && !invites.length && (
              <p className="admin-empty">Nenhum convite criado.</p>
            )}
            <ul className="admin-list">
              {invites.map((item) => {
                const elapsed = Date.parse(item.expires_at) <= Date.now();
                return (
                  <li key={item.id}>
                    <div>
                      <strong>{item.email}</strong>
                      <small>
                        {item.revoked_at
                          ? "Revogado"
                          : item.used_at
                            ? "Usado"
                            : elapsed
                              ? "Expirado"
                              : "Disponível"}
                      </small>
                    </div>
                    {!item.revoked_at && (!elapsed || item.used_at) && (
                      <button
                        type="button"
                        className="saas-button saas-button-outline"
                        disabled={revoke.isPending}
                        onClick={() => revoke.mutate(item.id)}
                      >
                        Revogar
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        </div>
      </main>
    </AppShell>
  );
}
