import { randomUUID, randomBytes, createCipheriv, createDecipheriv } from "node:crypto";
import { readFile, writeFile, mkdir, rename } from "node:fs/promises";
import { unlinkSync } from "node:fs";
import path from "node:path";
import net from "node:net";

import { proxyKey, proxyOwner } from "./policy.mjs";
import { localSerial } from "./android-discovery.mjs";

export function fail(message, status = 400) {
  throw Object.assign(new Error(message), { status });
}
export const uuid = (value) => typeof value === "string" && /^[a-f0-9-]{36}$/i.test(value);
export const text = (value, max = 200) =>
  typeof value === "string" && value.trim().length <= max ? value.trim() : "";
export function webUrl(value) {
  try {
    const url = new URL(value);
    if (!["https:", "http:"].includes(url.protocol) || url.username || url.password)
      fail("Use um endereço HTTP ou HTTPS sem credenciais.");
    return url.href;
  } catch {
    fail("Informe um endereço HTTP ou HTTPS válido.");
  }
}
export const portNumber = (value) =>
  Number.isInteger(Number(value)) && Number(value) > 0 && Number(value) <= 65535;
export const validHost = (value) => {
  if (typeof value !== "string" || value.length > 253) return false;
  if (net.isIP(value)) return true;
  if (/^[\d.]+$/.test(value)) return false;
  return value.split(".").every((label) => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i.test(label));
};

export async function createStore(directory) {
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const lockfile = path.join(directory, "connector.lock");
  try {
    await writeFile(lockfile, String(process.pid), { flag: "wx", mode: 0o600 });
  } catch (error) {
    if (error.code !== "EEXIST") throw error;
    const pid = Number(await readFile(lockfile, "utf8"));
    if (!Number.isInteger(pid) || pid < 1)
      fail(
        "O bloqueio da pasta local está inválido. Preserve os arquivos e verifique seu backup.",
        500,
      );
    let alive = true;
    try {
      process.kill(pid, 0);
    } catch (check) {
      if (check.code === "ESRCH") alive = false;
    }
    if (alive)
      fail("Esta pasta já está aberta em outro conector. Encerre-o antes de continuar.", 409);
    unlinkSync(lockfile);
    await writeFile(lockfile, String(process.pid), { flag: "wx", mode: 0o600 });
  }
  process.once("exit", () => {
    try {
      unlinkSync(lockfile);
    } catch {}
  });
  const filename = path.join(directory, "workspace.json");
  const keyfile = path.join(directory, "secrets.key");
  let key;
  try {
    key = await readFile(keyfile);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    key = randomBytes(32);
    await writeFile(keyfile, key, { mode: 0o600, flag: "wx" });
  }
  if (key.length !== 32)
    fail("A chave local está inválida. Preserve os arquivos e restaure seu backup.", 500);
  let data = { version: 1, profiles: [], proxies: [], activities: [] };
  try {
    data = JSON.parse(await readFile(filename, "utf8"));
    if (
      data.version !== 1 ||
      !Array.isArray(data.profiles) ||
      !Array.isArray(data.proxies) ||
      !Array.isArray(data.activities)
    )
      throw new Error("schema");
  } catch (error) {
    if (error.code !== "ENOENT")
      fail("Não foi possível abrir os dados locais. Nenhum arquivo foi substituído.", 500);
  }
  let queue = Promise.resolve();
  function save() {
    const snapshot = JSON.stringify(data, null, 2);
    const operation = queue.then(async () => {
      const temporary = `${filename}.${randomUUID()}.tmp`;
      await writeFile(temporary, snapshot, { mode: 0o600 });
      await rename(temporary, filename);
    });
    queue = operation.catch(() => {});
    return operation;
  }
  function seal(value) {
    if (!value) return "";
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", key, iv);
    const content = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
    return Buffer.concat([iv, cipher.getAuthTag(), content]).toString("base64");
  }
  function unseal(value) {
    if (!value) return "";
    const buffer = Buffer.from(value, "base64");
    const decipher = createDecipheriv("aes-256-gcm", key, buffer.subarray(0, 12));
    decipher.setAuthTag(buffer.subarray(12, 28));
    return Buffer.concat([decipher.update(buffer.subarray(28)), decipher.final()]).toString("utf8");
  }
  function publicProxy(proxy) {
    const { secret, ...rest } = proxy;
    return { ...rest, hasPassword: !!secret };
  }
  function profileInput(input, previous) {
    const name = text(input.name, 80);
    if (!name) fail("Dê um nome ao perfil, com até 80 caracteres.");
    if (!["browser", "android"].includes(input.kind)) fail("Escolha Navegador ou Android.");
    if (previous && input.kind !== previous.kind)
      fail("O tipo de um perfil existente não pode ser alterado.");
    const proxyId = input.proxyId || null;
    if (proxyId && !data.proxies.some((p) => p.id === proxyId))
      fail("O proxy selecionado não existe.");
    if (proxyId !== previous?.proxyId && proxyOwner(data.profiles, proxyId, previous?.id))
      fail(
        "Este proxy já está vinculado a outro perfil. Cadastre uma conexão diferente ou libere o vínculo anterior.",
        409,
      );
    const tags = Array.isArray(input.tags)
      ? [...new Set(input.tags.map((t) => text(t, 30)).filter(Boolean))].slice(0, 8)
      : [];
    const notes = text(input.notes ?? "", 2000);
    if (typeof input.notes !== "string" || input.notes.length > 2000)
      fail("Use uma observação de até 2.000 caracteres.");
    const startUrls = Array.isArray(input.startUrls)
      ? input.startUrls.filter(Boolean).slice(0, 5).map(webUrl)
      : [];
    if (input.kind === "android" && startUrls.length > 1)
      fail("O Android aceita uma página inicial. Use somente uma linha.");
    const viewport = {
      width: Number(input.viewport?.width ?? 1280),
      height: Number(input.viewport?.height ?? 800),
    };
    if (
      !Number.isInteger(viewport.width) ||
      viewport.width < 360 ||
      viewport.width > 1920 ||
      !Number.isInteger(viewport.height) ||
      viewport.height < 480 ||
      viewport.height > 1200
    )
      fail("Escolha uma resolução entre 360 × 480 e 1920 × 1200.");
    let deviceId = input.kind === "android" ? text(input.deviceId, 150) : "";
    if (deviceId.startsWith("adb:")) {
      const serial = localSerial(deviceId.slice(4));
      if (!serial) fail("Use somente um endpoint ADB local válido.");
      deviceId = `adb:${serial}`;
    }
    if (input.kind === "android" && !deviceId) fail("Escolha uma instância Android independente.");
    if (
      deviceId &&
      data.profiles.some(
        (p) =>
          p.id !== previous?.id &&
          (p.deviceId === deviceId ||
            (deviceId.startsWith("adb:") &&
              (localSerial(p.deviceId?.slice(4)) === localSerial(deviceId.slice(4)) ||
                p.androidBinding?.endpoint === localSerial(deviceId.slice(4))))),
      )
    )
      fail(
        "Este Android já está vinculado a outro perfil. Crie outra instância para manter os dados separados.",
      );
    const hostAddress = input.hostAddress || "127.0.0.1";
    if (!validHost(hostAddress))
      fail("Informe um endereço válido do computador visto pelo Android.");
    return {
      name,
      kind: input.kind,
      tags,
      notes,
      proxyId,
      startUrls,
      viewport,
      deviceId,
      ...(previous?.deviceId === deviceId && previous.androidBinding
        ? { androidBinding: previous.androidBinding }
        : {}),
      hostAddress,
    };
  }
  return {
    directory,
    data,
    save,
    async bindAndroid(id, binding) {
      const profile = data.profiles.find((p) => p.id === id && p.kind === "android");
      if (!profile || !localSerial(binding.endpoint)) fail("Vínculo Android inválido.");
      if (
        data.profiles.some(
          (p) =>
            p.id !== id &&
            (p.deviceId === binding.deviceId ||
              p.androidBinding?.endpoint === binding.endpoint ||
              (p.deviceId?.startsWith("adb:") &&
                localSerial(p.deviceId.slice(4)) === binding.endpoint)),
        )
      )
        fail(
          "Este endpoint Android já pertence a outro perfil. Confira os vínculos antes de iniciar.",
          409,
        );
      const previous = profile.androidBinding;
      profile.androidBinding = binding;
      try {
        await save();
      } catch (error) {
        profile.androidBinding = previous;
        throw error;
      }
    },
    publicProxy,
    proxy(id) {
      const item = data.proxies.find((p) => p.id === id);
      return item ? { ...item, password: unseal(item.secret) } : null;
    },
    async putProfile(input, id) {
      const previous = id ? data.profiles.find((p) => p.id === id) : null;
      if (id && !previous) fail("Perfil não encontrado.", 404);
      const values = profileInput(input, previous);
      const now = new Date().toISOString();
      const profile = {
        ...values,
        id: previous?.id || randomUUID(),
        createdAt: previous?.createdAt || now,
        updatedAt: now,
      };
      if (previous) data.profiles[data.profiles.indexOf(previous)] = profile;
      else data.profiles.unshift(profile);
      try {
        await save();
      } catch (error) {
        if (previous) data.profiles[data.profiles.indexOf(profile)] = previous;
        else data.profiles = data.profiles.filter((p) => p.id !== profile.id);
        throw error;
      }
      return profile;
    },
    async putProxy(input, id) {
      const previous = id ? data.proxies.find((p) => p.id === id) : null;
      if (id && !previous) fail("Proxy não encontrado.", 404);
      const name = text(input.name, 80);
      const host = text(input.host, 253);
      if (
        !name ||
        !validHost(host) ||
        !portNumber(input.port) ||
        !["http", "https", "socks5"].includes(input.protocol)
      )
        fail("Confira nome, protocolo, host e porta do proxy.");
      if (
        typeof input.username !== "string" ||
        input.username.length > 200 ||
        typeof input.password !== "string" ||
        input.password.length > 1000
      )
        fail("Credenciais inválidas.");
      if (/[\r\n]/.test(input.username + input.password) || input.username.includes(":"))
        fail("Credenciais contêm caracteres não aceitos.");
      if (
        input.protocol === "socks5" &&
        (Buffer.byteLength(input.username) > 255 || Buffer.byteLength(input.password) > 255)
      )
        fail("Credenciais SOCKS5 aceitam até 255 bytes por campo.");
      const candidate = {
        protocol: input.protocol,
        host,
        port: input.port,
        username: input.username,
      };
      if (
        data.proxies.some(
          (proxy) => proxy.id !== previous?.id && proxyKey(proxy) === proxyKey(candidate),
        )
      )
        fail("Este endereço, protocolo e usuário já estão cadastrados na central de proxies.", 409);
      const now = new Date().toISOString();
      const item = {
        id: previous?.id || randomUUID(),
        name,
        protocol: input.protocol,
        host,
        port: Number(input.port),
        username: input.username,
        secret: input.clearPassword
          ? ""
          : input.password
            ? seal(input.password)
            : previous?.secret || "",
        createdAt: previous?.createdAt || now,
        updatedAt: now,
      };
      if (previous) data.proxies[data.proxies.indexOf(previous)] = item;
      else data.proxies.unshift(item);
      try {
        await save();
      } catch (error) {
        if (previous) data.proxies[data.proxies.indexOf(item)] = previous;
        else data.proxies = data.proxies.filter((p) => p.id !== item.id);
        throw error;
      }
      return publicProxy(item);
    },
    async remove(collection, id) {
      const previous = data[collection];
      data[collection] = previous.filter((p) => p.id !== id);
      if (previous.length === data[collection].length) fail("Cadastro não encontrado.", 404);
      try {
        await save();
      } catch (error) {
        data[collection] = previous;
        throw error;
      }
    },
    async activity(action, profile) {
      data.activities.unshift({
        id: randomUUID(),
        action,
        profileId: profile?.id,
        name: profile?.name,
        at: new Date().toISOString(),
      });
      data.activities = data.activities.slice(0, 80);
      await save();
    },
  };
}
