// JavaScript / verify-signup.mjs / Node.js 22+ and Chrome / offline intercepted fixture.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { findBrowser } from "./browser.mjs";
import { signupPage } from "./signup-page.mjs";

class CDP {
  constructor(url) {
    this.socket = new WebSocket(url);
    this.pending = new Map();
    this.id = 0;
    this.ready = new Promise((resolve, reject) => {
      this.socket.addEventListener("open", resolve, { once: true });
      this.socket.addEventListener("error", reject, { once: true });
    });
    this.socket.addEventListener("message", ({ data }) => {
      const message = JSON.parse(data);
      if (message.id) {
        const pending = this.pending.get(message.id);
        if (!pending) return;
        this.pending.delete(message.id);
        clearTimeout(pending.timer);
        if (message.error) pending.reject(new Error(message.error.message));
        else pending.resolve(message.result);
      } else this.onEvent?.(message);
    });
  }
  async send(method, params = {}) {
    await this.ready;
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(
        () => {
          this.pending.delete(id);
          reject(new Error("CDP timeout: " + method));
        },
        method === "Page.navigate" ? 60000 : 12000,
      );
      this.pending.set(id, { resolve, reject, timer });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }
  async evaluate(expression) {
    const result = await this.send("Runtime.evaluate", {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    assert.equal(result.exceptionDetails, undefined, JSON.stringify(result.exceptionDetails));
    return result.result.value;
  }
}
const profile = await mkdtemp(path.join(tmpdir(), "signup-chrome-"));
const binary = await findBrowser();
assert.ok(binary, "Install Chrome or Edge to run browser verification");
const chrome = spawn(
  binary,
  [
    `--user-data-dir=${profile}`,
    "--remote-debugging-port=0",
    "--remote-debugging-address=127.0.0.1",
    "--headless=new",
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-background-networking",
    "about:blank",
  ],
  { windowsHide: true, stdio: "ignore" },
);
let page, root;
try {
  let port;
  for (let i = 0; i < 100; i++) {
    try {
      port = (await readFile(path.join(profile, "DevToolsActivePort"), "utf8")).split("\n")[0];
      break;
    } catch {
      await delay(100);
    }
  }
  assert.ok(port, "Chrome must start");
  const endpoint = `http://127.0.0.1:${port}`;
  root = new CDP((await (await fetch(endpoint + "/json/version")).json()).webSocketDebuggerUrl);
  page = new CDP(
    (await (await fetch(endpoint + "/json/list")).json()).find((item) => item.type === "page")
      .webSocketDebuggerUrl,
  );
  await page.send("Page.enable");
  let fixture = `<!doctype html><html><body><form><input name="emailOrPhone"><input name="fullName"><input name="username"><input name="password" type="password"><button type="submit">Cadastre-se</button></form><script>window.submits=0;document.querySelector('form').addEventListener('submit',e=>{e.preventDefault();window.submits++;});</script></body></html>`;
  // Every request is fulfilled locally. This test never contacts Instagram.
  page.onEvent = (event) => {
    if (event.method === "Fetch.requestPaused")
      void page.send("Fetch.fulfillRequest", {
        requestId: event.params.requestId,
        responseCode: 200,
        responseHeaders: [{ name: "Content-Type", value: "text/html; charset=utf-8" }],
        body: Buffer.from(fixture).toString("base64"),
      });
  };
  await page.send("Fetch.enable", { patterns: [{ urlPattern: "*" }] });
  await page.send("Page.navigate", { url: "https://www.instagram.com/accounts/emailsignup/" });
  for (let i = 0; i < 50 && !(await page.evaluate("!!document.querySelector('form')")); i++)
    await delay(100);
  const input = {
    contact: "fixture@example.com",
    fullName: "Fixture Owner",
    username: "fixture_owner",
    password: "fixture-secret-123",
  };
  const run = () => page.evaluate(`(${signupPage.toString()})(${JSON.stringify(input)})`);
  assert.equal((await run()).status, "submitted");
  assert.equal(await page.evaluate("window.submits"), 1);
  assert.equal(
    await page.evaluate("document.querySelector('[name=username]').value"),
    "fixture_owner",
  );
  await run();
  assert.equal(await page.evaluate("window.submits"), 1, "must not submit the same form twice");
  await page.evaluate("document.body.innerHTML='<input name=security_code>'");
  assert.equal((await run()).status, "verification");
  await page.evaluate("document.body.innerHTML='Tente novamente mais tarde'");
  assert.equal((await run()).status, "blocked");
  await page.evaluate("document.body.innerHTML='<input name=username>'");
  assert.equal((await run()).status, "waiting");
  await page.send("Page.navigate", { url: "https://example.com/accounts/emailsignup/" });
  for (let i = 0; i < 50 && (await page.evaluate("location.hostname")) !== "example.com"; i++)
    await delay(50);
  assert.equal((await run()).status, "manual");
  assert.equal(await page.evaluate("document.querySelector('[name=password]').value"), "");
  console.log(
    "PASS: real Chrome fixture — filling, submission, no duplicate, verification pause, block, missing fields and origin guard. No real signup attempted.",
  );
  if (process.env.SIGNUP_UI_URL) {
    await page.send("Fetch.disable");
    await page.send("Emulation.setDeviceMetricsOverride", {
      width: 1280,
      height: 1100,
      deviceScaleFactor: 1,
      mobile: false,
    });
    await page.send("Page.navigate", { url: process.env.SIGNUP_UI_URL });
    for (let i = 0; i < 150; i++) {
      if ((await page.evaluate("document.body.innerText")).includes("Dados da nova conta")) break;
      await delay(200);
    }
    const text = await page.evaluate("document.body.innerText");
    assert.ok(text.includes("InstaStart"));
    assert.ok(text.includes("Dados da nova conta"), text.slice(0, 1000));
    assert.equal(
      await page.evaluate(
        "document.querySelector('input[name=password]').disabled || document.querySelector('input[name=password]').closest('fieldset').disabled",
      ),
      true,
    );
    const screenshot = await page.send("Page.captureScreenshot", {
      format: "png",
      captureBeyondViewport: true,
    });
    await writeFile("signup-ui.png", Buffer.from(screenshot.data, "base64"));
    console.log(
      "PASS: portal page rendered, credentials disabled until paired; screenshot signup-ui.png",
    );
  }
} finally {
  await root?.send("Browser.close").catch(() => {});
  page?.socket.close();
  root?.socket.close();
  await delay(600);
  if (chrome.exitCode === null) chrome.kill();
  // The path is the exact temporary profile created above, not a user profile.
  if (!profile.startsWith(path.join(tmpdir(), "signup-chrome-")))
    throw new Error("Unexpected test profile path");
  await rm(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
}
