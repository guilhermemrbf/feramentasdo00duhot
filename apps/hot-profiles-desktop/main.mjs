import { app, BrowserWindow, dialog, ipcMain, shell, utilityProcess, nativeImage } from "electron";
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
        await stopService().catch(() => {});
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
      backgroundThrottling: !selfTest,
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
  testStage = "android-settings-form";
  await window.webContents.executeJavaScript(`(async()=>{
    for(let n=0;n<100&&!document.body.textContent.includes('Aplicativo local conectado');n++)await new Promise(r=>setTimeout(r,100));
    [...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Novo perfil')?.click();
    await new Promise(r=>setTimeout(r,200));
    document.querySelector('input[value="android"]')?.click();
    for(let n=0;n<100&&!document.querySelector('select[aria-label="RAM do Android"]');n++)await new Promise(r=>setTimeout(r,100));
    if(!document.querySelector('select[aria-label="RAM do Android"]')||!document.querySelector('select[aria-label="Núcleos de CPU"]'))throw new Error('Android hardware controls missing');
    [...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Leve')?.click();
    await new Promise(r=>setTimeout(r,100));
    document.querySelector('select[aria-label="RAM do Android"]')?.closest('fieldset')?.scrollIntoView({block:'start'});
    await new Promise(r=>setTimeout(r,150));
  })()`);
  const settingsScreenshot = argument("--self-test-settings-screenshot");
  if (settingsScreenshot)
    await writeFile(settingsScreenshot, (await window.webContents.capturePage()).toPNG());
  await window.webContents.executeJavaScript(
    `document.querySelector('button[aria-label="Fechar janela"]')?.click()`,
  );
  testStage = "proxy-quick-form";
  await window.webContents.executeJavaScript(`(async()=>{
    const wait=()=>new Promise(r=>setTimeout(r,100));
    const button=(text)=>[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===text);
    button('Proxies')?.click(); await wait(); button('Adicionar proxy')?.click(); await wait();
    const dialog=()=>document.querySelector('[role="dialog"]');
    const input=dialog()?.querySelector('input[type="password"]');
    const submit=()=>dialog()?.querySelector('button[type="submit"]') || [...(dialog()?.querySelectorAll('button')||[])].find(b=>b.textContent.trim()==='Adicionar proxy');
    if(!input || !submit()?.disabled)throw new Error('Quick form missing or empty submit enabled');
    const fill=(el,value)=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el,value);el.dispatchEvent(new Event('input',{bubbles:true}));};
    fill(input,'http://fixture.invalid/path'); await wait();
    if(!submit()?.disabled)throw new Error('Invalid proxy accepted');
    fill(input,'fixture.invalid:8080:fixture-user:fixture-password'); await wait();
    const review=dialog()?.querySelector('[aria-label="Conferência da proxy"]');
    if(!review?.textContent.includes('HTTP') || review.textContent.includes('fixture-password') || review.textContent.includes('fixture-user') || submit()?.disabled)throw new Error('Proxy preview missing or credentials exposed');
  })()`);
  const proxyScreenshot = argument("--self-test-proxy-screenshot");
  if (proxyScreenshot) {
    window.showInactive();
    await new Promise((resolve) => setTimeout(resolve, 500));
    await writeFile(proxyScreenshot, (await window.webContents.capturePage()).toPNG());
    window.hide();
  }
  await window.webContents.executeJavaScript(`(async()=>{
    const wait=()=>new Promise(r=>setTimeout(r,100));
    const dialog=document.querySelector('[role="dialog"]');
    dialog.querySelector('form').requestSubmit();
    for(let n=0;n<100&&document.querySelector('[role="dialog"]');n++)await wait();
    if(document.querySelector('[role="dialog"]'))throw new Error('Quick save did not finish');
    const c=await window.hotProfilesDesktop.connect();
    const response=await fetch(c.url+'/v1/state',{headers:{Authorization:'Bearer '+c.token}});
    const state=await response.json(); const p=state.proxies.find(p=>p.host==='fixture.invalid');
    if(!p || p.port!==8080 || !p.hasPassword || p.username!=='fixture-user' || 'password' in p || 'secret' in p)throw new Error('Proxy roundtrip failed');
    const removed=await fetch(c.url+'/v1/proxies/'+p.id,{method:'DELETE',headers:{Authorization:'Bearer '+c.token}});
    if(!removed.ok)throw new Error('Proxy fixture cleanup failed');
    [...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Perfis')?.click();
    await wait();
  })()`);
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
  const videoSmoke = process.argv.includes("--self-test-video");
  let videoMeasurements = null;
  const androidSmoke = process.argv.includes("--self-test-android") || videoSmoke;
  if (androidSmoke) {
    testStage = "own-android-in-desktop";
    await window.webContents.executeJavaScript(`(async()=>{
      const c=await window.hotProfilesDesktop.connect();
      const call=async(route,input)=>{const r=await fetch(c.url+route,{method:input?'POST':'GET',headers:{Authorization:'Bearer '+c.token,...(input?{'Content-Type':'application/json'}:{})},body:input?JSON.stringify(input):undefined});const data=await r.json();if(!r.ok)throw new Error(data.error||'Android API failed');return data;};
      const p=await call('/v1/profiles',{kind:'android',deviceId:'runtime:new',name:'Android próprio de teste',notes:'Celular vazio temporário',tags:['teste'],startUrls:[],androidSettings:{ramMb:4096,cpuCores:4,resolution:'360x640',graphics:'auto',memoryMode:'low',fps:30,animations:false,imageId:''}});
      const wait=ms=>new Promise(r=>setTimeout(r,ms));
      let clicked=false;
      for(let n=0;n<50;n++){const row=[...document.querySelectorAll('article')].find(e=>e.querySelector('h3')?.textContent===p.name);if(row){[...row.querySelectorAll('button')].find(e=>e.textContent.trim()==='Iniciar')?.click();clicked=true;break;}await wait(300);}
      if(!clicked)throw new Error('Android start button unavailable');
      let running=false;
      for(let n=0;n<240;n++){const state=await call('/v1/state');const s=state.sessions.find(s=>s.profileId===p.id);if(s?.status==='error')throw new Error(s.error);if(s?.status==='running'){if(s.runtimeInfo?.cpuCores!==4||s.runtimeInfo.resolution!=='360x640'||s.runtimeInfo.effectiveRamMb<4096)throw new Error('Android settings not applied');running=true;break;}await wait(1500);}
      if(!running)throw new Error('Own Android boot timed out');
      const f=await call('/v1/sessions/'+p.id+'/frame');if(!f.image?.startsWith('data:image/png;base64,'))throw new Error('Own Android screen missing');
      await call('/v1/sessions/'+p.id+'/control',{action:'key',key:'home'});
      for(let n=0;n<100;n++){if(document.querySelector('img[alt="Tela atual de Android próprio de teste"],canvas[data-live="true"]'))return true;await wait(300);}
      throw new Error('Own Android screen not shown in desktop viewer');
    })()`);
    let rendered = false;
    for (let n = 0; n < 60; n++) {
      const source = await window.webContents.executeJavaScript(
        `document.querySelector('canvas[data-live="true"]')?.toDataURL('image/png') || document.querySelector('img[alt="Tela atual de Android próprio de teste"]')?.src || ''`,
      );
      if (source) {
        const pixels = nativeImage.createFromDataURL(source).toBitmap();
        let minimum = 255,
          maximum = 0;
        for (let at = 0; at < pixels.length; at += 64) {
          for (let channel = 0; channel < 3; channel++) {
            minimum = Math.min(minimum, pixels[at + channel]);
            maximum = Math.max(maximum, pixels[at + channel]);
          }
        }
        if (maximum - minimum > 24) {
          rendered = true;
          break;
        }
      }
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    if (!rendered) throw new Error("Android viewer received only blank frames");
    if (videoSmoke) {
      testStage = "android-video-decoding";
      videoMeasurements = await window.webContents.executeJavaScript(`(async()=>{
        const c=await window.hotProfilesDesktop.connect();const state=await(await fetch(c.url+'/v1/state',{headers:{Authorization:'Bearer '+c.token}})).json();const p=state.profiles.find(p=>p.kind==='android');
        const start=performance.now();
        for(let n=0;n<40;n++){
          const canvas=document.querySelector('canvas[data-live="true"]');
          if(Number(canvas?.dataset.frames)>=20){
            const headers={Authorization:'Bearer '+c.token,'Content-Type':'application/json'};
            await fetch(c.url+'/v1/sessions/'+p.id+'/control',{method:'POST',headers,body:JSON.stringify({action:'settings'})});
            await new Promise(r=>setTimeout(r,4000));
            const first=Number(canvas.dataset.frames),sampleStart=performance.now(),latencies=[];
            for(let k=0;k<12;k++){const before=performance.now();await fetch(c.url+'/v1/sessions/'+p.id+'/control',{method:'POST',headers,body:JSON.stringify({action:'scroll',deltaY:k%2?-100:100})});latencies.push(performance.now()-before);await new Promise(r=>setTimeout(r,200));}
            const elapsed=performance.now()-sampleStart,decoded=Number(canvas.dataset.frames)-first;
            [...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Perfis')?.click();
            let paused=false;for(let k=0;k<40;k++){const s=await(await fetch(c.url+'/v1/state',{headers})).json();if(s.sessions.find(s=>s.profileId===p.id)?.runtimeInfo?.videoClients===0){paused=true;break;}await new Promise(r=>setTimeout(r,100));}
            if(!paused)throw new Error('Video encoder did not stop when leaving the viewer');
            const row=[...document.querySelectorAll('article')].find(e=>e.querySelector('h3')?.textContent===p.name);[...row.querySelectorAll('button')].find(b=>b.textContent.trim()==='Abrir')?.click();
            let resumed=false;for(let k=0;k<100;k++){if(Number(document.querySelector('canvas[data-live="true"]')?.dataset.frames)>=5){resumed=true;break;}await new Promise(r=>setTimeout(r,200));}
            if(!resumed)throw new Error('Video did not resume after returning to viewer');
            return {framesDecoded:first+decoded,sampleFrames:decoded,sampleMs:Math.round(elapsed),receivedFps:Math.round(decoded*10000/elapsed)/10,meanGestureRoundTripMs:Math.round(latencies.reduce((a,b)=>a+b,0)/latencies.length),encoderPausedWhenLeaving:true,videoResumed:true};
          }
          await fetch(c.url+'/v1/sessions/'+p.id+'/control',{method:'POST',headers:{Authorization:'Bearer '+c.token,'Content-Type':'application/json'},body:JSON.stringify({action:'swipe',x:180,y:500,toX:180,toY:150})});
          await new Promise(r=>setTimeout(r,500));
        }
        throw new Error('Continuous Android video did not decode enough frames');
      })()`);
    }
  }
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
    proxyQuickForm: true,
    profileSurvivesServiceRestart: true,
    realBrowserStartStop: browserSmoke,
    realAndroidInDesktop: androidSmoke,
    realAndroidVideo: videoSmoke,
    videoMeasurements,
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
