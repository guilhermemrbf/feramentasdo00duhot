// JavaScript / instagram-signup.mjs / Node.js 22+ / local Chrome or Edge.
import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile, rename } from "node:fs/promises";
import path from "node:path";
import { startBrowser } from "./browser.mjs";

const terminal = new Set(["reported_created", "cancelled", "interrupted", "failed"]);
const day = (date) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
function validate(input) {
  if (!input || typeof input !== "object") throw new Error("Dados de cadastro inválidos.");
  const username = typeof input.username === "string" ? input.username.trim().toLowerCase() : "";
  const fullName = typeof input.fullName === "string" ? input.fullName.trim() : "";
  const contact = typeof input.contact === "string" ? input.contact.trim() : "";
  if (!/^[a-z0-9_][a-z0-9_.]{0,29}$/.test(username)) throw new Error("Nome de usuário inválido.");
  if (!fullName || fullName.length > 100) throw new Error("Dados de nome inválidos.");
  if (
    contact.length > 254 ||
    !(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact) || /^\+[1-9]\d{7,14}$/.test(contact))
  )
    throw new Error("Informe um contato válido: e-mail ou telefone com código do país.");
  if (
    typeof input.password !== "string" ||
    input.password.length < 8 ||
    input.password.length > 128
  )
    throw new Error("Use uma senha entre 8 e 128 caracteres.");
  return { username, fullName, contact, password: input.password };
}

export async function createSignupManager({ directory, start = startBrowser }) {
  const filename = path.join(directory, "instagram-signups.json");
  let history = [];
  try {
    const saved = JSON.parse(await readFile(filename, "utf8"));
    if (!Array.isArray(saved)) throw new Error("Histórico de cadastros inválido.");
    history = saved.slice(0, 200).map(({ id, username, status, createdAt, updatedAt }) => ({
      id,
      username,
      createdAt,
      updatedAt,
      status: terminal.has(status) ? status : "interrupted",
    }));
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  let current = null;
  let closing = false;
  let opening = null;
  let writes = Promise.resolve();
  function save() {
    const bytes = JSON.stringify(history, null, 2);
    writes = writes
      .catch(() => {})
      .then(async () => {
        await mkdir(directory, { recursive: true });
        await writeFile(filename + ".tmp", bytes, { mode: 0o600 });
        await rename(filename + ".tmp", filename);
      });
    return writes;
  }
  const publicRecord = (item) => (item ? { ...item.record } : null);
  const state = () => ({
    current: publicRecord(current),
    history: history.map((item) => ({ ...item })),
    todayAttempts: history.filter((item) => day(new Date(item.createdAt)) === day(new Date()))
      .length,
    dailyLimit: 10,
  });
  async function update(active, status) {
    active.record.status = status;
    active.record.updatedAt = new Date().toISOString();
    await save();
  }
  const manager = {
    state,
    async open(input) {
      let valid = validate(input);
      if (closing) throw new Error("O conector está encerrando.");
      if (current || opening) throw new Error("Encerre o cadastro atual antes de iniciar outro.");
      if (state().todayAttempts >= 10)
        throw new Error("Limite local de 10 tentativas por dia atingido.");
      if (
        history.some(
          (item) => item.username === valid.username && item.status === "reported_created",
        )
      )
        throw new Error("Este usuário já foi confirmado no histórico.");
      const now = new Date().toISOString();
      const record = {
        id: randomUUID(),
        username: valid.username,
        status: "starting",
        createdAt: now,
        updatedAt: now,
      };
      const active = { record, runtime: null, abort: new AbortController() };
      current = active;
      let opened;
      opening = new Promise((resolve) => {
        opened = resolve;
      });
      history = [record, ...history].slice(0, 200);
      try {
        await save();
        if (active.abort.signal.aborted) return state();
        const runtime = await start(
          {
            id: record.id,
            viewport: { width: 1100, height: 800 },
            startUrls: ["https://www.instagram.com/accounts/emailsignup/"],
          },
          directory,
          null,
          () => {
            if (current !== active || active.abort.signal.aborted) return;
            current = null;
            void update(active, "interrupted").catch(() => {});
          },
          active.abort.signal,
          { visible: true },
        );
        active.runtime = runtime;
        if (current !== active || active.abort.signal.aborted) {
          await runtime.stop();
          return state();
        }
        const result = await runtime.signupStep(valid, active.abort.signal);
        if (current === active && !active.abort.signal.aborted) {
          const status = ["submitted", "verification", "manual", "blocked"].includes(result.status)
            ? result.status
            : "manual";
          await update(active, status);
        }
        return state();
      } catch (error) {
        if (current === active && !active.abort.signal.aborted) {
          current = null;
          await active.runtime?.stop().catch(() => {});
          await update(active, "failed");
          // Browser/protocol errors can contain sensitive page data; use a fixed public message.
          throw new Error(
            "Não foi possível iniciar o cadastro. Confira Chrome/Edge instalado e tente abrir o navegador pelo Hot Profiles.",
          );
        }
        if (!active.abort.signal.aborted && active.record.status !== "interrupted") throw error;
        return state();
      } finally {
        valid = null;
        opening = null;
        opened();
      }
    },
    async finish(status) {
      if (!["reported_created", "cancelled"].includes(status))
        throw new Error("Resultado inválido.");
      const active = current;
      if (!active) throw new Error("Não há cadastro aberto.");
      if (active.finishing) return active.finishing;
      if (status === "reported_created" && ["starting", "blocked"].includes(active.record.status))
        throw new Error("Conclua o cadastro no Instagram antes de confirmar.");
      active.finishing = (async () => {
        active.abort.abort();
        // Keep exclusive ownership until the browser is closed; first terminal outcome wins.
        await active.runtime?.stop();
        await update(active, status);
        if (current === active) current = null;
        return state();
      })();
      try {
        return await active.finishing;
      } catch (error) {
        active.finishing = null;
        throw error;
      }
    },
    async close() {
      closing = true;
      const pending = opening;
      if (current) await manager.finish("cancelled");
      await pending;
      await writes;
    },
  };
  return manager;
}
