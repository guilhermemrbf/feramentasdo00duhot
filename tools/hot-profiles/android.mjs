import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";
import { readFile, access } from "node:fs/promises";
import path from "node:path";
import net from "node:net";
import { fail, webUrl } from "./storage.mjs";
import {
  parseBlueStacks,
  androidDevices,
  endpointCandidates,
  localSerial,
} from "./android-discovery.mjs";

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
    return parseBlueStacks(content);
  } catch {
    return { readable: false, enabled: false, remoteEnabled: false, instances: [] };
  }
}
function listening(port) {
  return new Promise((resolve) => {
    const socket = net.connect({ host: "127.0.0.1", port });
    const finish = (result) => {
      socket.destroy();
      resolve(result);
    };
    socket.setTimeout(500, () => finish(false));
    socket.once("error", () => finish(false));
    socket.once("connect", () => finish(true));
  });
}
export async function discoverAndroid() {
  const binary = await findAdb();
  const configuration = await config();
  let output = "",
    adbResponding = false;
  if (binary) {
    try {
      // Only probe local configured endpoints. A listening socket alone is not ADB readiness.
      if (configuration.enabled) {
        const ports = [
          ...new Set(configuration.instances.flatMap((i) => endpointCandidates(configuration, i))),
        ];
        await Promise.all(
          ports.map(async (port) => {
            if (await listening(port)) {
              try {
                await adb(binary, ["connect", `127.0.0.1:${port}`], { timeout: 2500 });
              } catch {}
            }
          }),
        );
      }
      output = await adb(binary, ["devices"]);
      adbResponding = true;
    } catch {}
  }
  const devices = androidDevices(configuration, output);
  return {
    adbAvailable: !!binary,
    adbResponding,
    configReadable: configuration.readable,
    adbRemoteEnabled: configuration.remoteEnabled,
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

export async function startAndroid(
  profile,
  gateway,
  signal,
  onResolved = async () => {},
  dependencies = {},
) {
  const runAdb = dependencies.adb || adb;
  const discover = dependencies.discoverAndroid || discoverAndroid;
  const binary = await (dependencies.findAdb || findAdb)();
  if (!binary)
    fail("Instale o BlueStacks ou Android SDK Platform Tools para conectar um Android.", 409);
  const discovery = await discover();
  const device = discovery.devices.find(
    (item) =>
      item.id === profile.deviceId ||
      (profile.deviceId.startsWith("adb:") &&
        item.endpoint &&
        item.endpoint === localSerial(profile.deviceId.slice(4))),
  );
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
  if (device.provider === "bluestacks" && !device.ready && !device.candidateEndpoints?.length)
    fail(
      "Esta instância não tem uma porta ADB local inequívoca. Confira as opções avançadas no BlueStacks.",
      409,
    );
  let serial = device.serial;
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
        const current = (await discover()).devices.find((item) => item.id === device.id);
        serial = current?.serial;
        if (!serial) {
          await delay(1200);
          continue;
        }
        const status = await runAdb(
          binary,
          ["-s", serial, "shell", "getprop", "sys.boot_completed"],
          {
            timeout: 2500,
          },
        );
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
  if (!serial)
    fail("Nenhum endpoint ADB confirmado para esta instância. Atualize os dispositivos.", 409);
  const binding = {
    deviceId: device.id,
    endpoint: localSerial(serial),
    verifiedAt: new Date().toISOString(),
  };
  await onResolved(binding);
  const command = (args) => runAdb(binary, ["-s", serial, ...args]);
  if (signal?.aborted) fail("Abertura cancelada.", 409);
  let previousProxy = null;
  let appliedProxy = null;
  let reversePort = null;
  const restoreProxy = () =>
    command(
      previousProxy === "null"
        ? ["shell", "settings", "delete", "global", "http_proxy"]
        : ["shell", "settings", "put", "global", "http_proxy", previousProxy || ":0"],
    );
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
        await restoreProxy();
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
    binding,
    async network() {
      const current = (await command(["shell", "settings", "get", "global", "http_proxy"])).trim();
      return {
        checkedAt: new Date().toISOString(),
        endpoint: binding.endpoint,
        mode: appliedProxy ? "system-http" : "unmanaged",
        systemProxyMatches: appliedProxy ? current === appliedProxy : null,
        deviceWideVerified: false,
        egressIp: null,
        dnsVerified: false,
        failClosed: false,
        message: appliedProxy
          ? current === appliedProxy
            ? "Proxy HTTP configurada no Android. IP de saída, DNS e bloqueio de conexão direta não comprovados. Aplicativos podem ignorar essa proxy."
            : "A configuração de proxy do Android mudou. O roteamento desta sessão precisa ser conferido."
          : "Sem proxy gerenciada pelo Hot Profiles. A configuração de rede anterior da instância foi preservada.",
      };
    },
    async frame() {
      const bytes = await runAdb(binary, ["-s", serial, "exec-out", "screencap", "-p"], {
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
        if (current === appliedProxy) await restoreProxy();
      }
      if (reversePort) {
        await command(["reverse", "--remove", `tcp:${reversePort}`]);
        reversePort = null;
      }
    },
  };
}
