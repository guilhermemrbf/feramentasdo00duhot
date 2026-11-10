import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, Check, Clock3, Copy, Inbox as InboxIcon, Mail, RefreshCw, ShieldCheck, Trash2, WandSparkles } from "lucide-react";
import { api, ApiError, dateText, messageFor } from "./api";

type Box = { id: string; address: string; expiresAt: string };
type Domain = { domain: string; isDefault: boolean };
type Message = { id: string; sender: string; recipient: string; subject: string; receivedAt: string; isRead: boolean };
type Detail = Message & { textBody: string; htmlBody: string };
type List = { messages: Message[]; next: string | null };
const expiry = (box: Box | null, time: number) => box ? Math.max(0, Date.parse(box.expiresAt) - time) : 0;
const createMailbox = (domain: string, renew = false) =>
  api<Box>("/mailboxes" + (renew ? "/renew" : ""), "POST", domain ? { domain } : {});
const deletedFlag = "tempmail-explicit-delete";

function timeLeft(ms: number) {
  const seconds = Math.ceil(ms / 1000);
  const hrs = Math.floor(seconds / 3600);
  const min = Math.floor((seconds % 3600) / 60);
  if (hrs) return hrs + " h " + min + " min";
  if (min) return min + " min " + (seconds % 60) + " s";
  return seconds + " s";
}

export function Inbox() {
  const [box, setBox] = useState<Box | null>(null);
  const [domains, setDomains] = useState<Domain[]>([]);
  const [domain, setDomain] = useState("");
  const [list, setList] = useState<List>({ messages: [], next: null });
  const [detail, setDetail] = useState<Detail | null>(null);
  const [plain, setPlain] = useState(true);
  const [clock, setClock] = useState(Date.now());
  const [status, setStatus] = useState("Conectando");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(true);
  const [loading, setLoading] = useState(false);
  const [confirm, setConfirm] = useState<"renew" | "delete" | "message" | null>(null);
  const generation = useRef(0);
  const requestOrder = useRef(0);
  const dialog = useRef<HTMLDialogElement>(null);
  const addressField = useRef<HTMLInputElement>(null);

  function resetView(next: Box | null) {
    generation.current++;
    requestOrder.current++;
    setBox(next);
    setList({ messages: [], next: null });
    setDetail(null);
    setLoading(false);
  }

  useEffect(() => {
    let cancelled = false;
    async function initialize() {
      try {
        const available = await api<Domain[]>("/domains");
        if (cancelled) return;
        setDomains(available);
        setDomain(available.find((item) => item.isDefault)?.domain ?? available[0]?.domain ?? "");
        let current: Box | null = null;
        try {
          current = await api<Box>("/mailboxes/current");
        } catch (e) {
          if (!(e instanceof ApiError) || e.status !== 404) throw e;
          if (sessionStorage.getItem(deletedFlag) !== "1" && available.length) {
            const start = async () => createMailbox("");
            current = navigator.locks ? await navigator.locks.request("tempmail-bootstrap", start) : await start();
          }
        }
        if (!cancelled) {
          resetView(current);
          if (current) setDomain(current.address.split("@")[1]);
        }
      } catch (e) {
        if (!cancelled) setError(messageFor(e));
      } finally {
        if (!cancelled) setBusy(false);
      }
    }
    void initialize();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setClock(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const refresh = useCallback(async (older?: string) => {
    const version = generation.current;
    const request = ++requestOrder.current;
    setLoading(true);
    try {
      const data = await api<List>("/messages" + (older ? "?before=" + encodeURIComponent(older) : ""));
      if (version === generation.current && request === requestOrder.current) {
        setList((previous) => {
          if (!older && previous.messages.length > 25) {
            // Keep older pages open during a live update.
            const ids = new Set(data.messages.map((item) => item.id));
            return { messages: [...data.messages, ...previous.messages.slice(25).filter((item) => !ids.has(item.id))], next: previous.next };
          }
          return older ? { messages: [...previous.messages, ...data.messages], next: data.next } : data;
        });
      }
    } catch (e) {
      if (version !== generation.current || request !== requestOrder.current) return;
      if (e instanceof ApiError && e.status === 404 && !older) {
        resetView(null);
        setNotice("A caixa não está mais disponível. Você pode gerar outro endereço.");
      } else {
        setError(messageFor(e));
      }
    } finally {
      if (version === generation.current && request === requestOrder.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!box) return;
    setStatus("Conectando");
    const version = generation.current;
    const connection = new EventSource("/api/events");
    const sync = () => {
      if (generation.current !== version) return;
      setStatus("Ao vivo");
      void refresh();
    };
    connection.addEventListener("ready", sync);
    connection.addEventListener("changed", sync);
    connection.addEventListener("closed", () => {
      connection.close();
      resetView(null);
      setNotice("A caixa foi encerrada. Você pode gerar outro endereço.");
    });
    connection.onerror = () => { if (generation.current === version) setStatus("Reconectando"); };
    void refresh();
    const timer = window.setInterval(() => void refresh(), 30_000);
    return () => { connection.close(); window.clearInterval(timer); };
  }, [box, refresh]);

  useEffect(() => {
    if (box && !expiry(box, clock)) {
      resetView(null);
      setNotice("O tempo deste endereço acabou. Gere outro quando quiser.");
    }
  }, [box, clock]);

  useEffect(() => {
    const element = dialog.current;
    if (confirm && element && !element.open) element.showModal();
    if (!confirm && element?.open) element.close();
  }, [confirm]);

  async function replace() {
    setBusy(true);
    setError("");
    try {
      const next = await createMailbox(domain, Boolean(box));
      sessionStorage.removeItem(deletedFlag);
      resetView(next);
      setNotice("Novo endereço pronto para receber mensagens.");
    } catch (e) {
      setError(messageFor(e));
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    setError("");
    try {
      await api("/mailboxes/current", "DELETE");
      sessionStorage.setItem(deletedFlag, "1");
      resetView(null);
      setNotice("Caixa de entrada e mensagens excluídas.");
    } catch (e) {
      setError(messageFor(e));
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    if (!box) return;
    try {
      await navigator.clipboard.writeText(box.address);
      setNotice("Endereço copiado.");
    } catch {
      addressField.current?.select();
      setNotice("Endereço selecionado. Use o comando de copiar do seu dispositivo.");
    }
  }

  async function openMessage(item: Message) {
    const version = generation.current;
    setError("");
    try {
      const data = await api<Detail>("/messages/" + item.id);
      if (generation.current !== version) return;
      setDetail(data);
      setPlain(Boolean(data.textBody) || !data.htmlBody);
      if (!data.isRead) {
        await api("/messages/" + item.id + "/read", "PATCH");
        if (generation.current === version) {
          setList((old) => ({ ...old, messages: old.messages.map((row) => row.id === item.id ? { ...row, isRead: true } : row) }));
        }
      }
    } catch (e) {
      if (generation.current === version) setError(messageFor(e));
    }
  }

  async function removeMessage() {
    if (!detail) return;
    const id = detail.id;
    try {
      await api("/messages/" + id, "DELETE");
      setDetail(null);
      setList((previous) => ({ ...previous, messages: previous.messages.filter((item) => item.id !== id) }));
      setNotice("Mensagem excluída.");
      void refresh();
    } catch (e) {
      setError(messageFor(e));
    }
  }

  return (
    <>
      <section className="intro">
        <p className="eyebrow"><ShieldCheck size={16} /> E-MAIL DESCARTÁVEL</p>
        <h1>Seu e-mail temporário</h1>
        <p>Copie o endereço e receba mensagens aqui, sem cadastro.</p>
      </section>
      <section className="card address-card" aria-label="Endereço temporário" aria-busy={busy}>
        <div className="line wrap">
          <label htmlFor="address" className="caption">Seu endereço</label>
          {box && <span className="pill"><Clock3 size={15} /> Expira em {timeLeft(expiry(box, clock))}</span>}
        </div>
        <div className="address-line">
          <input id="address" ref={addressField} readOnly value={box?.address ?? ""} placeholder={busy ? "Preparando sua caixa…" : "Nenhum endereço ativo"} />
          <button className="primary" onClick={() => void copy()} disabled={!box || busy}><Copy size={18} /> Copiar endereço</button>
        </div>
        <div className="line wrap">
          <div className="actions">
            <button className="secondary" disabled={busy || !domains.length} onClick={() => box ? setConfirm("renew") : void replace()}><WandSparkles size={16} /> Gerar outro</button>
            <button className="ghost danger" disabled={!box || busy} onClick={() => setConfirm("delete")}><Trash2 size={16} /> Excluir caixa</button>
          </div>
          {domains.length > 1 && <label className="domain-picker">Domínio para o próximo endereço
            <select value={domain} onChange={(event) => setDomain(event.target.value)}>
              {domains.map((item) => <option key={item.domain} value={item.domain}>{item.domain}</option>)}
            </select>
          </label>}
        </div>
        {!busy && !domains.length && <p className="muted">Nenhum domínio ativo. A administração precisa liberar um domínio de recebimento.</p>}
      </section>
      {notice && <p role="status" className="notice"><Check size={17} />{notice}</p>}
      {error && <p role="alert" className="alert">{error}</p>}
      <section className="card mailbox" aria-label="Caixa de entrada">
        <header className="line mailbox-head wrap">
          <div className="title-icon"><InboxIcon size={23} /><div><h2>Caixa de entrada</h2><p>As mensagens novas aparecem automaticamente.</p></div></div>
          <div className="actions">
            <span className={"connection" + (box && status === "Ao vivo" ? " live" : "")}>{box ? status : "Sem caixa ativa"}</span>
            <button className="secondary" onClick={() => { setError(""); void refresh(); }} disabled={!box || loading}><RefreshCw size={16} /> Atualizar</button>
          </div>
        </header>
        {detail ? <article className="detail">
          <div className="line wrap">
            <button className="ghost" onClick={() => setDetail(null)}><ArrowLeft size={16} /> Voltar para mensagens</button>
            <button className="ghost danger" onClick={() => setConfirm("message")}><Trash2 size={16} /> Excluir mensagem</button>
          </div>
          <h3>{detail.subject}</h3>
          <dl className="metadata"><dt>De</dt><dd>{detail.sender}</dd><dt>Para</dt><dd>{detail.recipient}</dd><dt>Recebida em</dt><dd>{dateText(detail.receivedAt)}</dd></dl>
          {detail.htmlBody && detail.textBody && <div className="actions">
            <button className="secondary" aria-pressed={plain} onClick={() => setPlain(true)}>Texto</button>
            <button className="secondary" aria-pressed={!plain} onClick={() => setPlain(false)}>HTML protegido</button>
          </div>}
          {plain ? <pre className="message-body">{detail.textBody || "Mensagem sem conteúdo de texto."}</pre> : <iframe className="message-body" title="Conteúdo protegido da mensagem" sandbox=""
            referrerPolicy="no-referrer" srcDoc={'<!doctype html><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src \'none\'; style-src \'unsafe-inline\'"><style>body{font:16px system-ui;overflow-wrap:anywhere;padding:16px;margin:0;color:#182a45}table{max-width:100%}</style>' + detail.htmlBody} />}
          <p className="muted">Imagens externas, links ativos e anexos ficam bloqueados.</p>
        </article> : list.messages.length ? <ul className="message-list">
          {list.messages.map((item) => <li key={item.id}>
            <button className="message-row" onClick={() => void openMessage(item)}>
              <span className={"mail-icon" + (item.isRead ? "" : " unread")}><Mail size={18} /></span>
              <span className="message-summary"><strong>{item.subject}</strong><span>{item.sender}</span></span>
              <time dateTime={item.receivedAt}>{dateText(item.receivedAt)}</time>
              {!item.isRead && <span className="unread-mark" aria-label="Não lida" />}
            </button>
          </li>)}
        </ul> : <div className="empty"><span><Mail size={30} /></span>
          <h3>{loading || busy ? "Carregando a caixa" : "Nenhuma mensagem por enquanto"}</h3>
          <p>{box ? "Envie um e-mail para o endereço acima. A mensagem aparecerá aqui assim que for recebida." : "Gere um endereço para começar a receber mensagens."}</p>
        </div>}
        {!detail && list.next && <div className="load-more"><button className="secondary" disabled={loading} onClick={() => void refresh(list.next!)}>Carregar mensagens mais antigas</button></div>}
      </section>
      <dialog ref={dialog} className="card confirm" onCancel={() => setConfirm(null)}>
        <h2>{confirm === "renew" ? "Gerar outro endereço?" : confirm === "message" ? "Excluir esta mensagem?" : "Excluir esta caixa?"}</h2>
        <p>{confirm === "message" ? "A mensagem será removida desta caixa." : "O endereço atual deixará de receber e as mensagens desta caixa serão apagadas."}</p>
        <div className="actions"><button className="secondary" autoFocus onClick={() => setConfirm(null)}>Cancelar</button>
          <button className="primary" onClick={() => {
            const action = confirm;
            setConfirm(null);
            if (action === "renew") void replace();
            if (action === "delete") void remove();
            if (action === "message") void removeMessage();
          }}>Confirmar</button></div>
      </dialog>
    </>
  );
}
