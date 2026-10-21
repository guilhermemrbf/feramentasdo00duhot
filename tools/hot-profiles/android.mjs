import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";
import { readFile, access } from "node:fs/promises";
import path from "node:path";
import { fail, webUrl } from "./storage.mjs";

const execute = promisify(execFile);
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const blueDirectory = "C:/Program Files/BlueStacks_nxt";
const quote = (value) => `'${String(value).replace(/'/g, `'"'"'`)}'`;
async function exists(filename) {
  try {
    await access(filename);
    return true;
  } catch {
    return false;
  }
}
export async function findAdb() {
  const files = [
    process.env.HOT_PROFILES_ADB,
    path.join(blueDirectory, "HD-Adb.exe"),
    process.env.LOCALAPPDATA &&
      path.join(process.env.LOCALAPPDATA, "Android/Sdk/platform-tools/adb.exe"),
    "/usr/bin/adb",
  ];
  for (const file of files.filter(Boolean)) if (await exists(file)) return file;
  return null;
}
async function adb(binary, args, options = {}) {
  try {
    return (
      await execute(binary, args, {
        timeout: 12000,
        maxBuffer: 16 * 1024 * 1024,
        windowsHide: true,
        ...options,
      })
    ).stdout;
  } catch {
    fail(
      "O Android não respondeu. Confira se a instância está aberta e se o ADB está ativado no BlueStacks.",
      409,
    );
  }
}
async function config() {
  try {
    const content = await readFile(
      path.join(process.env.PROGRAMDATA || "C:/ProgramData", "BlueStacks_nxt/bluestacks.conf"),
      "utf8",
    );
    const entries = Object.fromEntries(
      [...content.matchAll(/^([^=\r\n]+)="([^"\r\n]*)"/gm)].map((match) => [match[1], match[2]]),
    );
    const names = [
      ...new Set(
        Object.keys(entries).flatMap(
          (key) => key.match(/^bst\.instance\.([A-Za-z0-9_]+)\.display_name$/)?.[1] || [],
        ),
      ),
    ];
    return {
      enabled: entries["bst.enable_adb_access"] === "1",
      instances: names.map((instance) => ({
        id: `bluestacks:${instance}`,
        instance,
        name: entries[`bst.instance.${instance}.display_name`] || instance,
        port: Number(entries[`bst.instance.${instance}.adb_port`]) || 5555,
      })),
    };
  } catch {
    return { enabled: false, instances: [] };
  }
}
export async function discoverAndroid() {
  const binary = await findAdb();
  const configuration = await config();
  let connected = [];
  if (binary) {
    try {
      connected = (await adb(binary, ["devices"]))
        .split(/\r?\n/)
        .map((line) => line.trim().split(/\s+/))
        .filter(
          ([serial, status]) =>
            status === "device" && /^(emulator-\d+|127\.0\.0\.1:\d+)$/.test(serial),
        )
        .map(([serial]) => serial);
    } catch {}
  }
  const devices = configuration.instances.map((instance) => {
    const serial = connected.find(
      (serial) =>
        serial === `127.0.0.1:${instance.port}` || serial === `emulator-${instance.port - 1}`,
    );
    return {
      ...instance,
      provider: "bluestacks",
      serial,
      ready: !!serial,
      adbEnabled: configuration.enabled,
    };
  });
  for (const serial of connected) {
    if (
      !devices.some(
        (device) =>
          serial === `127.0.0.1:${device.port}` || serial === `emulator-${device.port - 1}`,
      )
    )
      devices.push({
        id: `adb:${serial}`,
        name: `Android ${serial}`,
        serial,
        provider: "adb",
        ready: true,
        adbEnabled: true,
      });
  }
  return {
    adbAvailable: !!binary,
    managerAvailable: await exists(path.join(blueDirectory, "HD-MultiInstanceManager.exe")),
    devices,
  };
}
export async function openAndroidManager() {
  const binary = path.join(blueDirectory, "HD-MultiInstanceManager.exe");
  if (!(await exists(binary))) fail("O gerenciador do BlueStacks não foi encontrado.", 409);
  await new Promise((resolve, reject) => {
    const child = spawn(binary, [], { windowsHide: true, detached: true, stdio: "ignore" });
    child.once("error", () =>
      reject(new Error("Não foi possível abrir o gerenciador de instâncias.")),
    );
    child.once("spawn", () => {
      child.unref();
      resolve();
    });
  });
  return { ok: true };
}

export async function startAndroid(profile, gateway, signal) {
  const binary = await findAdb();
  if (!binary)
    fail("Instale o BlueStacks ou Android SDK Platform Tools para conectar um Android.", 409);
  const discovery = await discoverAndroid();
  const device = discovery.devices.find((item) => item.id === profile.deviceId);
  if (!device)
    fail(
      "Esta instância não foi encontrada. Edite o perfil e selecione uma instância disponível.",
      409,
    );
  if (!device.adbEnabled)
    fail(
      "Ative Android Debug Bridge no BlueStacks: Configurações → Avançado → Android Debug Bridge → Salvar.",
      409,
    );
  let serial = device.serial || `127.0.0.1:${device.port}`;
  if (device.provider === "bluestacks") {
    const player = path.join(blueDirectory, "HD-Player.exe");
    if (!(await exists(player))) fail("BlueStacks App Player não foi encontrado.", 409);
    if (!device.ready)
      await new Promise((resolve, reject) => {
        const child = spawn(player, ["--instance", device.instance], {
          windowsHide: true,
          detached: true,
          stdio: "ignore",
        });
        child.once("error", () =>
          reject(new Error("Não foi possível iniciar esta instância do BlueStacks.")),
        );
        child.once("spawn", () => {
          child.unref();
          resolve();
        });
      });
    let ready = false;
    for (let attempt = 0; attempt < 35; attempt++) {
      if (signal?.aborted) fail("Abertura cancelada.", 409);
      try {
        if (!device.serial) await adb(binary, ["connect", serial], { timeout: 2500 });
        const status = await adb(binary, ["-s", serial, "shell", "getprop", "sys.boot_completed"], {
          timeout: 2500,
        });
        if (status.trim() === "1") {
          ready = true;
          break;
        }
      } catch {}
      await delay(1200);
    }
    if (!ready)
      fail("O Android ainda está iniciando. Aguarde o BlueStacks terminar e tente novamente.", 409);
  }
  const command = (args) => adb(binary, ["-s", serial, ...args]);
  if (signal?.aborted) fail("Abertura cancelada.", 409);
  let previousProxy = null;
  let appliedProxy = null;
  let reversePort = null;
  try {
    if (gateway) {
      previousProxy = (await command(["shell", "settings", "get", "global", "http_proxy"])).trim();
      if (profile.hostAddress === "127.0.0.1") {
        await command(["reverse", "--no-rebind", `tcp:${gateway.port}`, `tcp:${gateway.port}`]);
        reversePort = gateway.port;
      }
      appliedProxy = `${profile.hostAddress}:${gateway.port}`;
      await command(["shell", "settings", "put", "global", "http_proxy", appliedProxy]);
      const result = (await command(["shell", "settings", "get", "global", "http_proxy"])).trim();
      if (result !== appliedProxy) fail("O Android não permitiu configurar seu proxy.", 409);
    }
    if (profile.startUrls[0])
      await command([
        "shell",
        "am",
        "start",
        "-a",
        "android.intent.action.VIEW",
        "-d",
        quote(profile.startUrls[0]),
      ]);
  } catch (error) {
    if (appliedProxy) {
      try {
        await command([
          "shell",
          "settings",
          "put",
          "global",
          "http_proxy",
          previousProxy && previousProxy !== "null" ? previousProxy : ":0",
        ]);
      } catch {}
    }
    if (reversePort) {
      try {
        await command(["reverse", "--remove", `tcp:${reversePort}`]);
      } catch {}
    }
    throw error;
  }
  let width = 720,
    height = 1280;
  return {
    async frame() {
      const bytes = await adb(binary, ["-s", serial, "exec-out", "screencap", "-p"], {
        encoding: "buffer",
      });
      if (
        bytes.length < 24 ||
        !bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
      )
        fail("A tela do Android não está disponível. Aguarde o dispositivo.", 409);
      width = bytes.readUInt32BE(16);
      height = bytes.readUInt32BE(20);
      return {
        image: `data:image/png;base64,${bytes.toString("base64")}`,
        width,
        height,
        tabs: [],
        dialog: null,
      };
    },
    async control(input) {
      const point = (x, y) => {
        if (!Number.isFinite(x) || !Number.isFinite(y)) fail("Posição inválida.");
        return [
          String(Math.round(Math.max(0, Math.min(width - 1, x)))),
          String(Math.round(Math.max(0, Math.min(height - 1, y)))),
        ];
      };
      if (input.action === "tap")
        return command(["shell", "input", "tap", ...point(input.x, input.y)]);
      if (input.action === "swipe")
        return command([
          "shell",
          "input",
          "swipe",
          ...point(input.x, input.y),
          ...point(input.toX, input.toY),
          "300",
        ]);
      if (input.action === "scroll") {
        const x = width / 2,
          y = height / 2;
        return command([
          "shell",
          "input",
          "swipe",
          ...point(x, y + height * (input.deltaY > 0 ? 0.2 : -0.2)),
          ...point(x, y + height * (input.deltaY > 0 ? -0.2 : 0.2)),
          "300",
        ]);
      }
      if (input.action === "text") {
        if (
          typeof input.text !== "string" ||
          input.text.length > 1000 ||
          /[^\x20-\x7e]/.test(input.text)
        )
          fail(
            "Nesta versão, o envio de texto ao Android aceita caracteres sem acentos (até 1.000). O teclado do próprio Android também está disponível.",
          );
        return command(["shell", "input", "text", quote(input.text.replace(/ /g, "%s"))]);
      }
      const keys = {
        back: "4",
        home: "3",
        recent: "187",
        Enter: "66",
        Backspace: "67",
        Tab: "61",
        Escape: "4",
        Delete: "112",
        ArrowLeft: "21",
        ArrowRight: "22",
        ArrowUp: "19",
        ArrowDown: "20",
      };
      if (input.action === "key" && keys[input.key])
        return command(["shell", "input", "keyevent", keys[input.key]]);
      if (input.action === "navigate")
        return command([
          "shell",
          "am",
          "start",
          "-a",
          "android.intent.action.VIEW",
          "-d",
          quote(webUrl(input.url)),
        ]);
      fail("Comando Android não suportado.");
    },
    async stop() {
      if (appliedProxy) {
        const current = (
          await command(["shell", "settings", "get", "global", "http_proxy"])
        ).trim();
        if (current === appliedProxy)
          await command([
            "shell",
            "settings",
            "put",
            "global",
            "http_proxy",
            previousProxy && previousProxy !== "null" ? previousProxy : ":0",
          ]);
      }
      if (reversePort) {
        await command(["reverse", "--remove", `tcp:${reversePort}`]);
        reversePort = null;
      }
    },
  };
}
