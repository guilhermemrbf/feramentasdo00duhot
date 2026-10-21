import { spawn } from "node:child_process";
import { access, mkdir } from "node:fs/promises";
import path from "node:path";
import net from "node:net";
import { fail, webUrl } from "./storage.mjs";

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
export async function findBrowser() {
  const candidates = [
    process.env.HOT_PROFILES_BROWSER,
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
  ];
  for (const candidate of candidates.filter(Boolean)) {
    try {
      await access(candidate);
      return candidate;
    } catch {}
  }
  return null;
}
async function freePort() {
  const server = net.createServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const port = server.address().port;
  await new Promise((resolve) => server.close(resolve));
  return port;
}

class CDP {
  constructor(url, onEvent = () => {}) {
    this.socket = new WebSocket(url);
    this.counter = 0;
    this.pending = new Map();
    this.ready = new Promise((resolve, reject) => {
      this.socket.addEventListener("open", resolve, { once: true });
      this.socket.addEventListener(
        "error",
        () => reject(new Error("Não foi possível conectar ao navegador.")),
        { once: true },
      );
    });
    this.socket.addEventListener("message", (event) => {
      const message = JSON.parse(event.data);
      if (message.id) {
        const pending = this.pending.get(message.id);
        if (!pending) return;
        clearTimeout(pending.timer);
        this.pending.delete(message.id);
        if (message.error) pending.reject(new Error("O navegador não pôde concluir esta ação."));
        else pending.resolve(message.result);
      } else onEvent(message);
    });
    this.socket.addEventListener("close", () => {
      for (const pending of this.pending.values()) {
        clearTimeout(pending.timer);
        pending.reject(new Error("A sessão do navegador foi encerrada."));
      }
      this.pending.clear();
    });
  }
  async send(method, params = {}) {
    await this.ready;
    if (this.socket.readyState !== 1) fail("A sessão do navegador foi encerrada.", 409);
    const id = ++this.counter;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error("O navegador demorou para responder."));
      }, 12000);
      this.pending.set(id, { resolve, reject, timer });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }
  close() {
    this.socket.close();
  }
}

export async function startBrowser(profile, directory, gateway, onClose, signal) {
  const binary = await findBrowser();
  if (!binary) fail("Instale Chrome ou Edge neste computador para iniciar um navegador.", 409);
  const userDirectory = path.join(directory, "browsers", profile.id);
  await mkdir(userDirectory, { recursive: true });
  const port = await freePort();
  const args = [
    `--user-data-dir=${userDirectory}`,
    `--remote-debugging-port=${port}`,
    "--remote-debugging-address=127.0.0.1",
    "--headless=new",
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-background-networking",
    `--window-size=${profile.viewport.width},${profile.viewport.height}`,
    "--force-webrtc-ip-handling-policy=disable_non_proxied_udp",
  ];
  if (gateway) args.push(`--proxy-server=http://127.0.0.1:${gateway.port}`);
  args.push("about:blank");
  const child = spawn(binary, args, { windowsHide: true, stdio: "ignore" });
  let exited = false;
  child.once("error", () => {
    exited = true;
  });
  child.once("exit", () => {
    exited = true;
    onClose();
  });
  const endpoint = `http://127.0.0.1:${port}`;
  let browserInfo;
  for (let attempt = 0; attempt < 60 && !exited && !signal?.aborted; attempt++) {
    try {
      const response = await fetch(`${endpoint}/json/version`, {
        signal: AbortSignal.timeout(500),
      });
      browserInfo = await response.json();
      break;
    } catch {
      await delay(200);
    }
  }
  if (!browserInfo?.webSocketDebuggerUrl) {
    child.kill();
    fail("O navegador não iniciou. Confira se este perfil já está aberto em outro conector.", 409);
  }
  const root = new CDP(browserInfo.webSocketDebuggerUrl);
  const pages = new Map();
  let activeTab = null;
  let dialog = null;
  const tabs = async () => {
    const response = await fetch(`${endpoint}/json/list`, { signal: AbortSignal.timeout(2500) });
    const list = (await response.json()).filter((item) => item.type === "page");
    if (!list.some((tab) => tab.id === activeTab)) activeTab = list[0]?.id || null;
    for (const [id, page] of pages) {
      if (!list.some((tab) => tab.id === id)) {
        page.close();
        pages.delete(id);
      }
    }
    return list;
  };
  async function page() {
    const list = await tabs();
    const tab = list.find((item) => item.id === activeTab);
    if (!tab) fail("A sessão não tem abas abertas. Crie uma nova aba.", 409);
    if (!pages.has(tab.id)) {
      const connection = new CDP(tab.webSocketDebuggerUrl, (event) => {
        if (event.method === "Page.javascriptDialogOpening")
          dialog = { type: event.params.type, message: event.params.message.slice(0, 500) };
        if (event.method === "Page.javascriptDialogClosed") dialog = null;
      });
      pages.set(tab.id, connection);
      await connection.send("Page.enable");
      await connection.send("Emulation.setDeviceMetricsOverride", {
        width: profile.viewport.width,
        height: profile.viewport.height,
        deviceScaleFactor: 1,
        mobile: false,
      });
    }
    return pages.get(tab.id);
  }
  const session = {
    async tabs() {
      return (await tabs()).map((tab) => ({
        id: tab.id,
        title: tab.title || "Nova aba",
        url: tab.url,
        active: tab.id === activeTab,
      }));
    },
    async addTab(url) {
      const result = await root.send("Target.createTarget", {
        url: url ? webUrl(url) : "about:blank",
      });
      activeTab = result.targetId;
      await page();
      return session.tabs();
    },
    async frame() {
      const connection = await page();
      if (dialog)
        return {
          image: null,
          dialog,
          width: profile.viewport.width,
          height: profile.viewport.height,
          tabs: await session.tabs(),
        };
      const result = await connection.send("Page.captureScreenshot", {
        format: "jpeg",
        quality: 72,
        captureBeyondViewport: false,
      });
      return {
        image: `data:image/jpeg;base64,${result.data}`,
        width: profile.viewport.width,
        height: profile.viewport.height,
        tabs: await session.tabs(),
        dialog: null,
      };
    },
    async control(input) {
      if (input.action === "tab") {
        if (!(await tabs()).some((tab) => tab.id === input.tabId)) fail("Aba não encontrada.");
        activeTab = input.tabId;
        dialog = null;
        await page();
        return;
      }
      if (input.action === "closeTab") {
        const list = await tabs();
        if (list.length <= 1) fail("Mantenha ao menos uma aba aberta.");
        if (!list.some((tab) => tab.id === input.tabId)) fail("Aba não encontrada.");
        await root.send("Target.closeTarget", { targetId: input.tabId });
        dialog = null;
        return;
      }
      const connection = await page();
      if (input.action === "navigate") {
        await connection.send("Page.navigate", { url: webUrl(input.url) });
        return;
      }
      if (input.action === "reload") {
        await connection.send("Page.reload");
        return;
      }
      if (input.action === "back" || input.action === "forward") {
        const history = await connection.send("Page.getNavigationHistory");
        const entry = history.entries[history.currentIndex + (input.action === "back" ? -1 : 1)];
        if (entry) await connection.send("Page.navigateToHistoryEntry", { entryId: entry.id });
        return;
      }
      if (input.action === "dialog") {
        await connection.send("Page.handleJavaScriptDialog", {
          accept: !!input.accept,
          promptText: typeof input.text === "string" ? input.text.slice(0, 1000) : "",
        });
        dialog = null;
        return;
      }
      if (input.action === "text") {
        if (typeof input.text !== "string" || input.text.length > 4000) fail("Texto muito longo.");
        await connection.send("Input.insertText", { text: input.text });
        return;
      }
      if (input.action === "key") {
        const codes = {
          a: 65,
          Enter: 13,
          Backspace: 8,
          Tab: 9,
          Escape: 27,
          Delete: 46,
          ArrowLeft: 37,
          ArrowUp: 38,
          ArrowRight: 39,
          ArrowDown: 40,
          Home: 36,
          End: 35,
          PageUp: 33,
          PageDown: 34,
        };
        if (!codes[input.key]) fail("Tecla não suportada.");
        await connection.send("Input.dispatchKeyEvent", {
          type: "keyDown",
          key: input.key,
          windowsVirtualKeyCode: codes[input.key],
          modifiers: (input.shift ? 8 : 0) | (input.ctrl ? 2 : 0),
        });
        await connection.send("Input.dispatchKeyEvent", {
          type: "keyUp",
          key: input.key,
          windowsVirtualKeyCode: codes[input.key],
        });
        return;
      }
      const coordinates = (x, y) => {
        if (!Number.isFinite(x) || !Number.isFinite(y)) fail("Posição inválida.");
        return {
          x: Math.max(0, Math.min(profile.viewport.width - 1, x)),
          y: Math.max(0, Math.min(profile.viewport.height - 1, y)),
        };
      };
      const position = coordinates(input.x, input.y);
      if (input.action === "scroll") {
        await connection.send("Input.dispatchMouseEvent", {
          type: "mouseWheel",
          ...position,
          deltaX: Math.max(-1600, Math.min(1600, Number(input.deltaX) || 0)),
          deltaY: Math.max(-1600, Math.min(1600, Number(input.deltaY) || 0)),
        });
        return;
      }
      if (!["tap", "swipe"].includes(input.action)) fail("Comando não suportado.");
      await connection.send("Input.dispatchMouseEvent", {
        type: "mousePressed",
        ...position,
        button: "left",
        clickCount: 1,
      });
      let end = position;
      if (input.action === "swipe") {
        end = coordinates(input.toX, input.toY);
        for (let step = 1; step <= 8; step++)
          await connection.send("Input.dispatchMouseEvent", {
            type: "mouseMoved",
            x: position.x + ((end.x - position.x) * step) / 8,
            y: position.y + ((end.y - position.y) * step) / 8,
            button: "left",
            buttons: 1,
          });
      }
      await connection.send("Input.dispatchMouseEvent", {
        type: "mouseReleased",
        ...end,
        button: "left",
        clickCount: 1,
      });
    },
    async stop() {
      for (const page of pages.values()) page.close();
      pages.clear();
      try {
        await root.send("Browser.close");
      } catch {}
      root.close();
      if (!exited) {
        await Promise.race([new Promise((resolve) => child.once("exit", resolve)), delay(3000)]);
        if (!exited) child.kill();
      }
    },
  };
  try {
    const connection = await page();
    if (profile.startUrls[0]) await connection.send("Page.navigate", { url: profile.startUrls[0] });
    for (const url of profile.startUrls.slice(1)) await session.addTab(url);
    return session;
  } catch (error) {
    await session.stop();
    throw error;
  }
}
