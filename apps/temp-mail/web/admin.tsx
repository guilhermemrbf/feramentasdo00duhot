import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Activity, Globe, LockKeyhole, LogOut, RefreshCw } from "lucide-react";
import { api, ApiError, dateText, messageFor } from "./api";

type Summary = {
  counters: Record<string, string>;
  active: number; domains: number; pending: number; failed: number; ttlHours: number;
  services: Record<string, boolean>;
};
type Domain = { id: string; domain: string; status: string; isDefault: boolean };
type Box = { id: string; status: string; createdAt: string; expiresAt: string; domain: { domain: string }; _count: { messages: number } };
type Job = { id: string; status: string; receivedAt: string };
type Log = { id: string; event: string; severity: string; source: string; createdAt: string };
type Page<T> = { items: T[]; hasMore: boolean };
type Tab = "domains" | "mailboxes" | "messages" | "logs";
const labels: Record<Tab, string> = { domains: "Domínios", mailboxes: "Caixas", messages: "Processamento", logs: "Auditoria" };

export function Admin() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [boot, setBoot] = useState(true);
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<Tab>("domains");
  const [page, setPage] = useState(1);
  const [boxStatus, setBoxStatus] = useState("");
  const [domains, setDomains] = useState<Domain[]>([]);
  const [boxes, setBoxes] = useState<Box[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [logs, setLogs] = useState<Log[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [ttl, setTtl] = useState(24);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);

  const load = useCallback(async () => {
    const data = await api<Summary>("/admin/dashboard");
    setSummary(data);
    return data;
  }, []);
  const list = useCallback(async (signal?: AbortSignal) => {
    if (tab === "domains") {
      const rows = await api<Domain[]>("/admin/domains", "GET", undefined, signal);
      setDomains(rows);
      setHasMore(false);
      return;
    }
    const query = "?page=" + page + (tab === "mailboxes" && boxStatus ? "&status=" + boxStatus : "");
    if (tab === "mailboxes") {
      const rows = await api<Page<Box>>("/admin/mailboxes" + query, "GET", undefined, signal);
      setBoxes(rows.items);
      setHasMore(rows.hasMore);
    } else if (tab === "messages") {
      const rows = await api<Page<Job>>("/admin/messages" + query, "GET", undefined, signal);
      setJobs(rows.items);
      setHasMore(rows.hasMore);
    } else {
      const rows = await api<Page<Log>>("/admin/logs" + query, "GET", undefined, signal);
      setLogs(rows.items);
      setHasMore(rows.hasMore);
    }
  }, [tab, page, boxStatus]);

  function handle(error: unknown) {
    if (error instanceof ApiError && error.status === 401) setSummary(null);
    setError(messageFor(error));
  }

  useEffect(() => {
    void load().then((data) => setTtl(data.ttlHours)).catch((e) => {
      if (!(e instanceof ApiError && e.status === 401)) handle(e);
    }).finally(() => setBoot(false));
  }, [load]);

  const loggedIn = Boolean(summary);
  useEffect(() => {
    if (!loggedIn) return;
    const controller = new AbortController();
    void list(controller.signal).catch((e) => { if (!controller.signal.aborted) handle(e); });
    return () => controller.abort();
  }, [loggedIn, list]);

  async function action(work: () => Promise<unknown>, success: string, refresh = true) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await work();
      if (refresh) {
        await load();
        await list();
      }
      setNotice(success);
    } catch (e) {
      handle(e);
    } finally {
      setBusy(false);
    }
  }

  function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    void action(async () => {
      await api("/admin/login", "POST", { email: values.get("email"), password: values.get("password") });
      setTtl((await load()).ttlHours);
    }, "Sessão iniciada.", false);
  }
  function addDomain(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const domain = new FormData(form).get("domain");
    void action(async () => {
      await api("/admin/domains", "POST", { domain });
      form.reset();
    }, "Domínio cadastrado. Configure o DNS antes de ativar.");
  }

  if (boot) return <p role="status">Verificando sessão administrativa…</p>;
  if (!summary) return (
    <section className="card panel login">
      <p className="eyebrow"><LockKeyhole size={17} /> ÁREA RESTRITA</p>
      <h1>Administração</h1>
      <p>Entre com a conta configurada pelo operador do serviço.</p>
      {error && <p className="alert" role="alert">{error}</p>}
      <form onSubmit={login} className="stack">
        <label>E-mail<input type="email" name="email" autoComplete="username" required /></label>
        <label>Senha<input type="password" name="password" autoComplete="current-password" required maxLength={256} /></label>
        <button className="primary" disabled={busy}>Entrar</button>
      </form>
    </section>
  );

  const total = (key: string) => Number(summary.counters[key] ?? 0).toLocaleString("pt-BR");
  const stats = [
    ["Caixas criadas", total("mailboxes_created")], ["Caixas ativas", summary.active],
    ["Caixas expiradas", total("mailboxes_expired")], ["Mensagens recebidas", total("messages_received")],
    ["Mensagens processadas", total("messages_processed")], ["Falhas de processamento", total("messages_failed")],
    ["Volume recebido (bytes)", total("bytes_received")], ["Domínios cadastrados", summary.domains],
  ];
  return (
    <div className="stack admin">
      <div className="line wrap">
        <div><p className="eyebrow"><Activity size={17} /> OPERAÇÃO DO CORREIO</p><h1>Administração</h1></div>
        <div className="actions">
          <button className="secondary" disabled={busy} onClick={() => void action(async () => {}, "Dados atualizados.")}><RefreshCw size={16} /> Atualizar</button>
          <button className="ghost" disabled={busy} onClick={() => void action(async () => {
            await api("/admin/logout", "POST");
            setSummary(null);
          }, "", false)}><LogOut size={16} /> Sair</button>
        </div>
      </div>
      {error && <p className="alert" role="alert">{error}</p>}
      {notice && <p className="notice" role="status">{notice}</p>}
      <div className="stats">{stats.map(([label, value]) => <div className="card stat" key={label}><span>{label}</span><strong>{value}</strong></div>)}</div>
      <section className="card panel stack">
        <h2>Serviços e validade</h2>
        <div className="actions">
          {Object.entries({ database: "Banco", redis: "Redis", worker: "Worker", smtp: "Ingestão SMTP" }).map(([key, label]) =>
            <span key={key} className={"connection" + (summary.services[key] ? " live" : "")}>{label}: {summary.services[key] ? "ativo" : "indisponível"}</span>)}
          <span className="pill">Pendentes: {summary.pending}</span><span className="pill">Aguardando revisão: {summary.failed}</span>
        </div>
        <form className="actions" onSubmit={(event) => {
          event.preventDefault();
          void action(() => api("/admin/settings", "POST", { ttlHours: ttl }), "Validade atualizada para novas caixas.");
        }}>
          <label className="inline-label">Validade das novas caixas (horas)
            <input type="number" min={1} max={168} required value={ttl || ""} onChange={(event) => setTtl(Number(event.target.value))} />
          </label>
          <button className="primary" disabled={busy}>Salvar validade</button>
        </form>
      </section>
      <section className="card panel stack">
        <nav className="actions" aria-label="Seções administrativas">
          {(Object.keys(labels) as Tab[]).map((key) => <button key={key} className="secondary"
            aria-pressed={key === tab} disabled={busy} onClick={() => {
              setTab(key); setPage(1); setHasMore(false); setPendingDelete(null);
            }}>{labels[key]}</button>)}
        </nav>
        <h2>{labels[tab]}</h2>
        {tab === "domains" && <>
          <form className="actions" onSubmit={addDomain}>
            <label className="inline-label">Domínio<input name="domain" required maxLength={253} placeholder="correio.seudominio.com.br" /></label>
            <button className="primary" disabled={busy}><Globe size={16} /> Cadastrar</button>
          </form>
          <p className="muted">Aponte o MX de cada domínio para o host do Postfix, com registro A ou AAAA próprio. Libere a porta 25 e verifique o DNS antes de ativar.</p>
          <div className="records">
            {domains.map((domain) => <div className="record" key={domain.id}>
              <div><strong>{domain.domain}</strong><small>{domain.status === "active" ? "Ativo" : "Desativado"}{domain.isDefault ? " · Padrão" : ""}</small></div>
              <div className="actions">
                <button className="secondary" disabled={busy} onClick={() => void action(() => api("/admin/domains/" + domain.id, "PATCH", {
                  status: domain.status === "active" ? "disabled" : "active",
                }), "Status atualizado.")}>{domain.status === "active" ? "Desativar" : "Ativar"}</button>
                {domain.status === "active" && !domain.isDefault && <button className="secondary" disabled={busy} onClick={() =>
                  void action(() => api("/admin/domains/" + domain.id, "PATCH", { isDefault: true }), "Domínio padrão atualizado.")}>Tornar padrão</button>}
              </div>
            </div>)}
            {!domains.length && <p>Nenhum domínio cadastrado.</p>}
          </div>
        </>}
        {tab === "mailboxes" && <>
          <label className="inline-label">Status <select value={boxStatus} onChange={(event) => { setBoxStatus(event.target.value); setPage(1); }}>
            <option value="">Todas</option><option value="active">Ativas</option><option value="expired">Expiradas</option><option value="deleted">Excluídas</option>
          </select></label>
          <div className="records">{boxes.map((item) => <div className="record" key={item.id}>
            <div><strong>{item.domain.domain}</strong><small>{item.status === "active" && Date.parse(item.expiresAt) <= Date.now() ? "expired" : item.status} · {item._count.messages} mensagens</small>
              <small>Criada em {dateText(item.createdAt)} · Validade até {dateText(item.expiresAt)}</small></div>
            {item.status === "active" && (pendingDelete === item.id ?
              <div className="actions"><button className="ghost" onClick={() => setPendingDelete(null)}>Cancelar</button>
                <button className="secondary danger" disabled={busy} onClick={() => void action(async () => {
                  await api("/admin/mailboxes/" + item.id, "DELETE");
                  setPendingDelete(null);
                }, "Caixa excluída.")}>Confirmar exclusão</button></div> :
              <button className="ghost danger" disabled={busy} onClick={() => setPendingDelete(item.id)}>Excluir caixa</button>)}
          </div>)}{!boxes.length && <p>Nenhuma caixa encontrada.</p>}</div>
        </>}
        {tab === "messages" && <div className="records">{jobs.map((job) => <div className="record" key={job.id}>
          <div><strong>{job.status === "failed" ? "Falha" : "Na fila"}</strong><small>Recebida em {dateText(job.receivedAt)}</small></div>
          {job.status === "failed" && <button className="secondary" disabled={busy} onClick={() =>
            void action(() => api("/admin/messages/" + job.id + "/retry", "POST"), "Mensagem reenfileirada.")}>Reprocessar</button>}
        </div>)}{!jobs.length && <p>Sem mensagens pendentes ou com falha.</p>}</div>}
        {tab === "logs" && <div className="records">{logs.map((log) => <div className="record" key={log.id}>
          <div><strong>{log.event}</strong><small>{log.source} · {log.severity}</small></div><time>{dateText(log.createdAt)}</time>
        </div>)}{!logs.length && <p>Sem eventos registrados.</p>}</div>}
        {tab !== "domains" && <div className="actions">
          <button className="secondary" disabled={page === 1 || busy} onClick={() => setPage((n) => n - 1)}>Anterior</button>
          <span>Página {page}</span><button className="secondary" disabled={!hasMore || busy} onClick={() => setPage((n) => n + 1)}>Próxima</button>
        </div>}
      </section>
    </div>
  );
}
