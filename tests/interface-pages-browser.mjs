import { spawn } from "node:child_process";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { resolve } from "node:path";
const require = createRequire(
  resolve(process.env.INTELLIGENCE_PG_TEST_DEPS || ".", "package.json"),
);
const { chromium } = require("playwright-core");
const web = process.env.UI_TEST_URL || "http://127.0.0.1:4388";
const vite = process.env.UI_TEST_URL
  ? null
  : spawn(
      process.execPath,
      ["node_modules/vite/bin/vite.js", "--host", "127.0.0.1", "--port", "4388", "--strictPort"],
      {
        windowsHide: true,
        stdio: "ignore",
        env: {
          ...process.env,
          VITE_SUPABASE_URL: "http://127.0.0.1:4389",
          VITE_SUPABASE_PUBLISHABLE_KEY: "fixture-anon",
        },
      },
    );
if (vite)
  for (let i = 0; i < 100; i++) {
    try {
      if ((await fetch(web, { signal: AbortSignal.timeout(2000) })).ok) break;
    } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
const browser = await chromium.launch({
  executablePath:
    process.env.INTELLIGENCE_CHROME || "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: true,
});
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
page.on("pageerror", (e) => {
  errors.push(e.message);
  console.error("PAGE", e.message);
});
const url = web;
const out = process.env.UI_TEST_SCREENSHOTS;
try {
  await page.goto(url);
  const headline = page.getByRole("heading", { name: "Sua operação digital em um só lugar" });
  const explore = page.getByRole("button", { name: "Ver todas as ferramentas", exact: true });
  await headline.waitFor();
  await page.waitForFunction(() =>
    Object.keys(document.querySelector(".home-intro button") || {}).some((k) =>
      k.startsWith("__reactProps"),
    ),
  );
  assert.equal(await page.getByRole("main").getByRole("link").count(), 0);
  await page.getByRole("heading", { name: "Programe seu Instagram", exact: true }).waitFor();
  const nav = page.getByRole("navigation", { name: "Navegação principal", exact: true });
  await explore.click();
  assert.equal(
    await page.evaluate(() => document.activeElement?.hasAttribute("data-main-tool")),
    true,
  );
  assert.equal(
    await nav
      .getByRole("link", { name: "Automatic Post · Instagram", exact: true })
      .getAttribute("href"),
    "/automacao-instagram",
  );
  await nav
    .getByRole("button", {
      name: "Adicionar Automatic Post · Instagram aos favoritos",
      exact: true,
    })
    .click();
  assert.equal(
    await nav
      .getByRole("button", {
        name: "Remover Automatic Post · Instagram dos favoritos",
        exact: true,
      })
      .getAttribute("aria-pressed"),
    "true",
  );
  await page.reload();
  await nav
    .getByRole("button", { name: "Remover Automatic Post · Instagram dos favoritos", exact: true })
    .waitFor();
  const saved = nav.locator("details").filter({ hasText: "Favoritas e recentes" });
  await saved.getByText("Favoritas e recentes", { exact: true }).click();
  await saved.getByRole("link", { name: "Automatic Post · Instagram", exact: true }).waitFor();
  await saved.getByText("Favoritas e recentes", { exact: true }).click();
  if (out)
    await page.screenshot({ path: resolve(out, "mousehot-home-desktop.png"), fullPage: true });
  await page.getByRole("button", { name: /Buscar ferramenta/ }).click();
  await page.getByRole("textbox", { name: "Nome ou tarefa que deseja realizar" }).fill("privacy");
  const search = page.getByRole("dialog");
  await search.getByRole("link", { name: /Criar Tela Privacy/ }).click();
  await page.getByRole("heading", { name: "Criar Tela Privacy", exact: true }).waitFor();
  await page.getByText("O que preciso para usar?", { exact: true }).click();
  await page.getByRole("heading", { name: "Antes de começar", exact: true }).waitFor();
  for (const path of [
    "/criar-pagina",
    "/image-links",
    "/gerar-preview",
    "/limpar-metadados",
    "/otimizar-criativos",
    "/mouse-hot-downloader",
    "/telegram-sync",
    "/email-temporario",
    "/funil",
    "/instagram-intelligence",
  ]) {
    for (const width of [1440, 360]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(url + path);
      await page.locator("h1").first().waitFor();
      assert(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
        path + " transbordou em " + width,
      );
    }
    console.log("PASS route desktop/mobile:", path);
  }
  for (const width of [320, 360, 768, 1024]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(url);
    await headline.waitFor();
    assert(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      "home transbordou em " + width,
    );
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(url);
  await page.waitForFunction(() =>
    Object.keys(document.querySelector(".home-intro button") || {}).some((k) =>
      k.startsWith("__reactProps"),
    ),
  );
  if (out)
    await page.screenshot({ path: resolve(out, "mousehot-home-mobile.png"), fullPage: true });
  await explore.click();
  const menu = page.getByRole("dialog", { name: "Menu de ferramentas" });
  await menu.getByRole("link", { name: "Criar Tela Privacy", exact: true }).waitFor();
  await page.keyboard.press("Escape");
  await menu.waitFor({ state: "hidden" });
  await page.getByRole("button", { name: "Abrir menu de ferramentas" }).click();
  await menu.getByRole("link", { name: "Criar Tela Privacy", exact: true }).click();
  await page.getByRole("heading", { name: "Criar Tela Privacy", exact: true }).waitFor();
  await menu.waitFor({ state: "hidden" });
  assert.deepEqual(errors, []);
  console.log(
    "PASS: Home responsiva e sem catálogo duplicado, barra lateral, favoritos persistentes, busca, guia, navegação móvel e dez páginas públicas.",
  );
} finally {
  await browser.close();
  vite?.kill();
}
