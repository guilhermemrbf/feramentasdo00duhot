import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";
import { access, mkdir, readFile, writeFile, readdir, open, unlink } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import net from "node:net";
import { fail, uuid } from "./storage.mjs";
import { startAndroid } from "./android.mjs";

const execute = promisify(execFile);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const allocatedPorts = new Set();
const present = async (file) => {
  try {
    await access(file);
    return true;
  } catch {
    return false;
  }
};
export function imageProperties(content) {
  return Object.fromEntries(
    content
      .split(/\r?\n/)
      .filter((line) => /^[\w.]+=/.test(line))
      .map((line) => {
        const at = line.indexOf("=");
        return [line.slice(0, at), line.slice(at + 1).trim()];
      }),
  );
}

export async function discoverRuntime() {
  const sdk = path.resolve(
    process.env.HOT_PROFILES_ANDROID_SDK || path.join(os.homedir(), "AppData/Local/Android/Sdk"),
  );
  const emulator = path.join(sdk, "emulator/emulator.exe");
  const adb = path.join(sdk, "platform-tools/adb.exe");
  const images = [];
  const root = path.join(sdk, "system-images");
  for (const api of await readdir(root).catch(() => [])) {
    for (const tag of await readdir(path.join(root, api)).catch(() => [])) {
      const directory = path.join(root, api, tag, "x86_64");
      try {
        const properties = imageProperties(
          await readFile(path.join(directory, "source.properties"), "utf8"),
        );
        if (
          properties["SystemImage.Abi"] === "x86_64" &&
          (await present(path.join(directory, "system.img")))
        )
          images.push({
            directory,
            api: properties["AndroidVersion.ApiLevel"],
            description: properties["Pkg.Desc"] || tag,
          });
      } catch {}
    }
  }
  images.sort((a, b) => Number(a.api) - Number(b.api) || a.directory.localeCompare(b.directory));
  const image = images[0] || null;
  const available = (await present(emulator)) && (await present(adb)) && !!image;
  return {
    available,
    sdk,
    emulator,
    adb,
    image,
    message: available
      ? `Motor Android local disponível · API ${image.api} · x86_64. Primeiro boot pode demorar alguns minutos.`
      : "Instale Android Emulator, Platform Tools e uma imagem x86_64 no SDK Android local. O instalador Hot Profiles não inclui imagens Android.",
  };
}

export function runtimeConfig(image) {
  if (/[\r\n]/.test(image.directory)) fail("Caminho da imagem Android inválido.");
  return `AvdId=HotProfiles\navd.ini.encoding=UTF-8\nabi.type=x86_64\nhw.cpu.arch=x86_64\nhw.cpu.ncore=2\nhw.ramSize=1536\nhw.lcd.width=540\nhw.lcd.height=960\nhw.lcd.density=240\nhw.keyboard=yes\nhw.gpu.enabled=yes\nhw.gpu.mode=auto\nhw.audioInput=no\nhw.audioOutput=no\nhw.camera.back=none\nhw.camera.front=none\nhw.sdCard=no\ndisk.dataPartition.size=2G\nfastboot.forceColdBoot=yes\nimage.sysdir.1=${image.directory.replace(/\\/g, "/")}/\nshowDeviceFrame=no\n`;
}

export function runtimeArguments(name, consolePort) {
  return [
    "-avd",
    name,
    "-port",
    String(consolePort),
    "-no-window",
    "-memory",
    "1536",
    "-no-audio",
    "-no-boot-anim",
    "-no-snapshot",
    "-gpu",
    "auto",
    "-feature",
    "-WiFiPacketStream",
    "-no-metrics",
    "-wifi-user-mode-options",
    "restrict=on,ipv6=off",
    "-network-user-mode-options",
    "restrict=on,ipv6=off",
  ];
}

async function reserve(port = 0) {
  const server = net.createServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", resolve);
  });
  return {
    port: server.address().port,
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}
async function consolePair() {
  for (let port = 5600; port < 5680; port += 2) {
    if (allocatedPorts.has(port)) continue;
    let first, second;
    try {
      first = await reserve(port);
      second = await reserve(port + 1);
      allocatedPorts.add(port);
      return {
        port,
        close: async () => {
          await first.close();
          await second.close();
        },
      };
    } catch {
      await first?.close();
    }
  }
  fail("Não há um par de portas locais disponível para o Android.", 409);
}

export async function startLocalAndroid(
  profile,
  directory,
  gateway,
  signal,
  onResolved,
  options = {},
) {
  if (!uuid(profile.id) || profile.deviceId !== `runtime:${profile.id}`)
    fail("Identidade do celular local inválida.");
  if (signal?.aborted) fail("Abertura cancelada.", 409);
  const configuration = await discoverRuntime();
  if (!configuration.available) fail(configuration.message, 409);
  if (os.freemem() < 1024 ** 3)
    fail("Libere pelo menos 1 GB de RAM antes de iniciar o Android local.", 409);
  const base = path.join(directory, "android-runtime");
  const device = path.join(base, `${profile.id}.avd`);
  const name = `hp_${profile.id.replaceAll("-", "")}`;
  await mkdir(device, { recursive: true });
  const lockPath = path.join(device, "hot-profiles.lock");
  // A crashed owner is never silently replaced. This also protects writable disks
  // from being opened by a second service using the same data directory.
  let lock;
  try {
    lock = await open(lockPath, "wx");
    await lock.writeFile(String(process.pid));
  } catch {
    fail(
      "Este celular está em uso ou precisa de recuperação após encerramento inesperado. Preserve os dados e confira o processo Android.",
      409,
    );
  }
  let server,
    ports,
    child,
    exited = false,
    runtime,
    stopping = false,
    stopped = false,
    diagnostic = "";
  const androidHome = path.join(base, "control");
  const env = {
    ...process.env,
    ANDROID_HOME: configuration.sdk,
    ANDROID_SDK_ROOT: configuration.sdk,
    ANDROID_AVD_HOME: base,
    ANDROID_USER_HOME: androidHome,
    ANDROID_EMULATOR_HOME: androidHome,
    ADB_VENDOR_KEYS: path.join(androidHome, "adbkey"),
    ADB_LOCAL_TRANSPORT_MAX_PORT: "0",
  };
  delete env.ADB_SERVER_SOCKET;
  let adbPort;
  const run = async (binary, args, commandOptions = {}) =>
    (
      await execute(binary, ["-P", String(adbPort), ...args], {
        windowsHide: true,
        timeout: 12000,
        maxBuffer: 16 * 1024 * 1024,
        env,
        ...commandOptions,
      })
    ).stdout;
  const stop = async () => {
    if (stopped) return;
    if (stopping) fail("O Android já está encerrando. Aguarde.", 409);
    stopping = true;
    try {
      if (child && !exited) {
        try {
          await run(configuration.adb, ["-s", `emulator-${ports.port}`, "emu", "kill"]);
        } catch {}
        for (let n = 0; n < 50 && !exited; n++) await sleep(200);
        if (!exited) {
          child.kill();
          for (let n = 0; n < 25 && !exited; n++) await sleep(200);
        }
        if (!exited) fail("O motor Android ainda está encerrando. Tente parar novamente.", 409);
      }
      if (adbPort) await run(configuration.adb, ["kill-server"]).catch(() => {});
      await lock.close();
      await unlink(lockPath);
      allocatedPorts.delete(ports?.port);
      stopped = true;
    } finally {
      stopping = false;
    }
  };
  try {
    await mkdir(androidHome, { recursive: true });
    let image = configuration.image;
    const manifest = path.join(device, "runtime.json");
    try {
      const previous = JSON.parse(await readFile(manifest, "utf8"));
      if (
        typeof previous.imageDirectory !== "string" ||
        !(await present(path.join(previous.imageDirectory, "system.img")))
      )
        fail(
          "A imagem original deste celular não está disponível. Restaure o SDK antes de iniciar.",
          409,
        );
      image = { ...image, directory: previous.imageDirectory };
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
      await writeFile(
        manifest,
        JSON.stringify({ version: 1, imageDirectory: image.directory, api: image.api }),
        { flag: "wx" },
      );
    }
    if (!(await present(path.join(device, "config.ini"))))
      await writeFile(path.join(device, "config.ini"), runtimeConfig(image), { flag: "wx" });
    await writeFile(path.join(base, `${name}.ini`), `avd.ini.encoding=UTF-8\npath=${device}\n`);
    server = await reserve();
    adbPort = server.port;
    await server.close();
    env.ANDROID_ADB_SERVER_PORT = String(adbPort);
    await run(configuration.adb, ["start-server"]);
    ports = await consolePair();
    await ports.close();
    child = spawn(configuration.emulator, runtimeArguments(name, ports.port), {
      windowsHide: true,
      env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let launchError;
    child.on("error", (error) => {
      launchError = error;
      exited = true;
    });
    child.on("exit", () => {
      exited = true;
      if (runtime && !stopping) options.onUnexpectedExit?.();
    });
    const collect = (bytes) => {
      diagnostic = (
        diagnostic +
        bytes
          .toString()
          .replace(
            /androidboot\.qemu\.adb\.pubkey=[^\r\n]*/g,
            "androidboot.qemu.adb.pubkey=[redacted]",
          )
      ).slice(-6000);
    };
    child.stdout.on("data", collect);
    child.stderr.on("data", collect);
    const serial = `emulator-${ports.port}`;
    let booted = false;
    for (let n = 0; n < (options.bootAttempts || 180); n++) {
      if (signal?.aborted) fail("Abertura cancelada.", 409);
      if (exited)
        fail(
          `O motor Android encerrou antes do boot.${launchError ? " Verifique o executável do SDK." : " Confira memória, imagem e aceleração."}`,
          409,
        );
      try {
        if (
          (
            await run(configuration.adb, ["-s", serial, "shell", "getprop", "sys.boot_completed"], {
              timeout: 2500,
            })
          ).trim() === "1"
        ) {
          booted = true;
          break;
        }
      } catch {}
      await sleep(1000);
    }
    if (!booted)
      fail(
        "O Android não terminou o primeiro boot em tempo. Libere memória e tente novamente.",
        409,
      );
    await run(configuration.adb, ["-s", serial, "shell", "input", "keyevent", "224"]);
    await run(
      configuration.adb,
      [
        "-s",
        serial,
        "shell",
        "am",
        "start",
        "-W",
        "-a",
        "android.intent.action.MAIN",
        "-c",
        "android.intent.category.HOME",
      ],
      { timeout: 60000, signal },
    );
    await sleep(3000);
    const effective = { ...profile, hostAddress: "127.0.0.1" };
    runtime = await startAndroid(effective, gateway, signal, onResolved, {
      findAdb: async () => configuration.adb,
      discoverAndroid: async () => ({
        devices: [
          {
            id: profile.deviceId,
            provider: "adb",
            ready: true,
            adbEnabled: true,
            serial,
            endpoint: `127.0.0.1:${ports.port + 1}`,
          },
        ],
      }),
      adb: run,
    });
    return {
      ...runtime,
      async frame() {
        if (exited) fail("O motor Android encerrou. Encerre a sessão e inicie novamente.", 409);
        return runtime.frame();
      },
      async control(input) {
        if (exited) fail("O motor Android encerrou. Encerre a sessão e inicie novamente.", 409);
        return runtime.control(input);
      },
      stop,
      // Configuration evidence only: restrict mode must pass live network probes
      // before any UI or report can claim device-wide isolation.
      async network() {
        return {
          ...(await runtime.network()),
          mode: "restricted-http",
          message: gateway
            ? "Motor próprio com rede restrita e proxy HTTP via canal ADB local. Aplicativos que ignoram HTTP podem ficar sem conexão. Isolamento integral ainda em validação."
            : "Motor próprio em rede restrita, sem proxy. Use esta sessão para testar tela e controles; internet direta não é oferecida neste protótipo.",
        };
      },
      async diagnosticCommand(args) {
        return run(configuration.adb, ["-s", serial, ...args]);
      },
      diagnostic: () => diagnostic,
    };
  } catch (error) {
    await options.onDiagnostic?.(diagnostic);
    try {
      await stop();
    } catch (cleanup) {
      throw Object.assign(
        new AggregateError([error, cleanup], `${error.message} ${cleanup.message}`),
        { cleanupRuntime: { stop } },
      );
    }
    throw error;
  }
}
