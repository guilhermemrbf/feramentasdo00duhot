import { app, BrowserWindow, dialog, ipcMain, shell, utilityProcess } from "electron";
import { fileURLToPath } from "node:url";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { serveLocalUi } from "./local-server.mjs";

const directory = path.dirname(fileURLToPath(import.meta.url));
const selfTest = process.argv.includes("--self-test");
const argument = (name) => {
  const n = process.argv.indexOf(name);
  return n >= 0 ? process.argv[n + 1] : undefined;
};
let window,
  ui,
  child,
  connection,
  ready,
  quitting = false,
  mayExit = false;
let temporary;
let testStage = "startup",
  serviceDiagnostic = "";
const single = selfTest || app.requestSingleInstanceLock();
if (!single) app.quit();
else {
  app.on("second-instance", () => {
    if (window?.isMinimized()) window.restore();
    window?.show();
    window?.focus();
  });
  app.on("window-all-closed", () => app.quit());
  ipcMain.handle("hot-profiles:connect", async (event) => {
    if (
      !window ||
      event.sender !== window.webContents ||
      event.senderFrame !== window.webContents.mainFrame ||
      new URL(event.senderFrame.url).origin !== ui?.origin
    )
      throw new Error("Janela não autorizada.");
    if (!child) startService();
    await ready;
    if (!connection) throw new Error("Serviço local indisponível.");
    return connection;
  });
  app.on("before-quit", (event) => {
    if (mayExit) return;
    event.preventDefault();
    if (quitting) return;
    quitting = true;
    void (async () => {
      try {
        await stopService();
        await ui?.close();
        mayExit = true;
        app.exit(0);
      } catch {
        quitting = false;
        if (window && !window.isDestroyed()) {
          window.show();
          await dialog.showMessageBox(window, {
            type: "warning",
            title: "Confira seus ambientes",
            message: "Não foi possível encerrar todos os ambientes com segurança.",
            detail:
              "O aplicativo continua aberto. Confira o Android e tente encerrar as sessões pelo painel antes de fechar novamente.",
            buttons: ["Voltar ao painel"],
          });
        }
      }
    })();
  });
  void app.whenReady().then(async () => {
    try {
      if (selfTest) {
        temporary = await mkdtemp(path.join(os.tmpdir(), "hot-profiles-desktop-test-"));
        const cache = path.join(temporary, "desktop");
        await mkdir(cache);
        app.setPath("userData", cache);
      }
      testStage = "local-ui-server";
      ui = await serveLocalUi(path.join(directory, "dist/ui"));
      testStage = "service-start";
      startService();
      testStage = "window-create";
      createWindow();
      testStage = "ui-load";
      await window.loadURL(ui.origin);
      testStage = "self-test";
      if (selfTest) await runSelfTest();
    } catch (error) {
      if (selfTest) {
        const destination = argument("--self-test-report");
        if (destination)
          await writeFile(
            destination,
            JSON.stringify({
              ok: false,
              error: "DESKTOP_SELF_TEST_FAILED",
              stage: testStage,
              detail: String(error.message).replace(/[A-Za-z0-9_-]{40,}/g, "[redacted]"),
              serviceDiagnostic,
            }),
          );
        child?.kill();
        await ui?.close();
        mayExit = true;
        app.exit(1);
      } else {
        await dialog.showMessageBox({
          type: "error",
          title: "Hot Profiles",
          message: "Não foi possível abrir o aplicativo.",
          detail:
            "Feche o conector antigo, se estiver aberto, e tente novamente. Os dados dos seus perfis foram preservados.",
        });
        child?.kill();
        await ui?.close();
        mayExit = true;
        app.exit(1);
      }
    }
  });
}

function startService() {
  connection = null;
  const connector = app.isPackaged
    ? path.join(process.resourcesPath, "connector/bridge.mjs")
    : path.resolve(directory, "../../tools/hot-profiles/bridge.mjs");
  const data = temporary
    ? path.join(temporary, "profiles")
    : path.join(process.env.LOCALAPPDATA || app.getPath("home"), "00duHot/HotProfiles");
  child = utilityProcess.fork(
    connector,
    ["--port", "0", "--data-dir", data, "--desktop-origin", ui.origin],
    { stdio: "pipe", serviceName: "Hot Profiles — execução local" },
  );
  const current = child;
  // No stdout/stderr from the service is copied to a log: it may contain pairing data.
  current.stdout?.resume();
  current.stderr?.on("data", (bytes) => {
    if (selfTest)
      serviceDiagnostic += bytes
        .toString()
        .replace(/[A-Za-z0-9_-]{40,}/g, "[redacted]")
        .slice(0, 3000);
  });
  ready = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Serviço local demorou para iniciar.")), 20000);
    current.on("message", (message) => {
      if (message?.type !== "hot-profiles:ready") return;
      if (
        !Number.isInteger(message.port) ||
        message.port < 1 ||
        message.port > 65535 ||
        typeof message.token !== "string" ||
        !/^[A-Za-z0-9_-]{43}$/.test(message.token)
      ) {
        clearTimeout(timer);
        reject(new Error("Resposta local inválida."));
        return;
      }
      connection = {
        url: `http://127.0.0.1:${message.port}`,
        token: message.token,
        computer: message.computer,
      };
      clearTimeout(timer);
      resolve();
    });
    current.once("exit", () => {
      clearTimeout(timer);
      if (child === current) {
        child = null;
        connection = null;
      }
      reject(new Error("Serviço local encerrado."));
    });
  });
  // The renderer receives a generic failure through IPC, never the raw process error.
  ready.catch(() => {});
}

async function stopService() {
  if (!child) return;
  await ready.catch(() => {});
  const current = child;
  if (!current) return;
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error("Encerramento pendente."));
    }, 20000);
    const onExit = () => {
      cleanup();
      resolve();
    };
    const onMessage = (message) => {
      if (message?.type === "hot-profiles:shutdown-blocked") {
        cleanup();
        reject(new Error("Restauração Android pendente."));
      }
    };
    function cleanup() {
      clearTimeout(timer);
      current.off("exit", onExit);
      current.off("message", onMessage);
    }
    current.once("exit", onExit);
    current.on("message", onMessage);
    current.postMessage({ type: "hot-profiles:shutdown" });
  });
}

function createWindow() {
  window = new BrowserWindow({
    width: 1280,
    height: 850,
    minWidth: 900,
    minHeight: 640,
    title: "Hot Profiles — 00duHot",
    show: !selfTest,
    backgroundColor: "#111111",
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(directory, "preload.cjs"),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      devTools: !app.isPackaged && !selfTest,
    },
  });
  window.on("close", (event) => {
    if (!mayExit) {
      event.preventDefault();
      app.quit();
    }
  });
  window.webContents.on("will-navigate", (event, url) => {
    if (new URL(url).origin !== ui.origin) event.preventDefault();
  });
  window.webContents.setWindowOpenHandler(({ url }) => {
    try {
      const target = new URL(url);
      if (
        target.protocol === "https:" &&
        target.hostname === "github.com" &&
        target.pathname.startsWith("/guilhermemrbf/feramentasdo00duhot/")
      )
        void shell.openExternal(target.href);
    } catch {}
    return { action: "deny" };
  });
  window.webContents.session.setPermissionRequestHandler((_contents, _permission, callback) =>
    callback(false),
  );
  window.webContents.session.setPermissionCheckHandler(() => false);
  window.webContents.on("will-attach-webview", (event) => event.preventDefault());
}

async function runSelfTest() {
  testStage = "service-ready";
  await ready;
  testStage = "http-auth-boundary";
  const unauthorized = await fetch(connection.url + "/v1/state");
  const foreign = await fetch(connection.url + "/v1/state", {
    headers: {
      Origin: "https://feramentasdo00duhot.lovable.app",
      Authorization: "Bearer " + connection.token,
    },
  });
  if (unauthorized.status !== 401 || foreign.status !== 403)
    throw new Error("Desktop HTTP boundary failed");
  testStage = "renderer-ready";
  for (let n = 0; n < 100; n++) {
    if (await window.webContents.executeJavaScript("Boolean(window.hotProfilesReady)")) break;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  if (!(await window.webContents.executeJavaScript("Boolean(window.hotProfilesReady)")))
    throw new Error("Renderer not ready");
  testStage = "profile-api";
  const result = await window.webContents.executeJavaScript(`(async()=>{
    const c=await window.hotProfilesDesktop.connect();
    const call=async(route,input)=>{const response=await fetch(c.url+route,{method:input?'POST':'GET',headers:{Authorization:'Bearer '+c.token,...(input?{'Content-Type':'application/json'}:{})},body:input?JSON.stringify(input):undefined});if(!response.ok)throw new Error('Local API failed');return response.json();};
    const state=await call('/v1/state');
    if(state.profiles.length) throw new Error('Self test must use empty temporary data');
    const p=await call('/v1/profiles',{kind:'browser',name:'Teste desktop local',notes:'Dados temporários de verificação',tags:['teste'],proxyId:null,startUrls:[],viewport:{width:1280,height:800}});
    return {id:p.id,nodeExposed:typeof window.require!=='undefined',api:true};
  })()`);
  if (result.nodeExposed) throw new Error("Node exposed");
  const browserSmoke = process.argv.includes("--self-test-browser");
  if (browserSmoke) {
    testStage = "real-browser-start-stop";
    await window.webContents.executeJavaScript(`(async()=>{
      const c=await window.hotProfilesDesktop.connect();const headers={Authorization:'Bearer '+c.token,'Content-Type':'application/json'};
      const prefix=c.url+'/v1/profiles/'+${JSON.stringify(result.id)};
      const started=await fetch(prefix+'/start',{method:'POST',headers,body:'{}'});
      if(!started.ok)throw new Error('Browser start rejected');
      let running=false;
      for(let n=0;n<120;n++){
        const state=await(await fetch(c.url+'/v1/state',{headers})).json();const session=state.sessions.find(s=>s.profileId===${JSON.stringify(result.id)});
        if(session?.status==='running'){running=true;break;}if(session?.status==='error')throw new Error('Browser startup failed');
        await new Promise(resolve=>setTimeout(resolve,150));
      }
      if(!running)throw new Error('Browser startup timeout');
      const stopped=await fetch(prefix+'/stop',{method:'POST',headers,body:'{}'});
      if(!stopped.ok)throw new Error('Browser stop rejected');
    })()`);
  }
  testStage = "service-restart";
  await stopService();
  startService();
  await ready;
  await new Promise((resolve) => {
    window.webContents.once("did-finish-load", resolve);
    window.reload();
  });
  for (let n = 0; n < 100; n++) {
    if (await window.webContents.executeJavaScript("Boolean(window.hotProfilesReady)")) break;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  testStage = "persisted-profile";
  const persisted = await window.webContents.executeJavaScript(
    `(async()=>{const c=await window.hotProfilesDesktop.connect();const s=await(await fetch(c.url+'/v1/state',{headers:{Authorization:'Bearer '+c.token}})).json();return s.profiles.some(p=>p.id===${JSON.stringify(result.id)});})()`,
  );
  if (!persisted) throw new Error("Persistence failed");
  testStage = "screenshot";
  await new Promise((resolve) => setTimeout(resolve, 1500));
  const screenshot = argument("--self-test-screenshot");
  if (screenshot) await writeFile(screenshot, (await window.webContents.capturePage()).toPNG());
  testStage = "shutdown";
  await stopService();
  await ui.close();
  const report = {
    ok: true,
    renderer: true,
    authenticatedLocalApi: true,
    unauthenticatedRequestRejected: true,
    foreignOriginRejected: true,
    profileSurvivesServiceRestart: true,
    realBrowserStartStop: browserSmoke,
    nodeIntegration: false,
    packaged: app.isPackaged,
    version: app.getVersion(),
  };
  const destination = argument("--self-test-report");
  if (destination) await writeFile(destination, JSON.stringify(report, null, 2));
  // Chromium owns its cache until process exit on Windows. Only the test's
  // profile store is removed here; the OS temporary cache can be cleaned later.
  await rm(path.join(temporary, "profiles"), { recursive: true, force: true });
  mayExit = true;
  app.exit(0);
}
