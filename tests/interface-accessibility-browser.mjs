import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { mkdir } from "node:fs/promises";
import { createServer } from "vite";
import react from "@vitejs/plugin-react";
import tailwind from "@tailwindcss/vite";
const require = createRequire(
  resolve(process.env.INTELLIGENCE_PG_TEST_DEPS || ".", "package.json"),
);
const { chromium } = require("playwright-core");
const server = await createServer({
  configFile: false,
  cacheDir: "node_modules/.vite-interface-test",
  optimizeDeps: { entries: ["tests/fixtures/interface.html"] },
  server: { host: "127.0.0.1", port: 4386, strictPort: true },
  plugins: [react(), tailwind()],
  resolve: { alias: { "@": resolve("src") } },
});
await server.listen();
const browser = await chromium.launch({
  executablePath:
    process.env.INTELLIGENCE_CHROME || "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: true,
});
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
page.on("pageerror", (e) => console.error("PAGE", e.message));
const out = resolve(".superpowers/sdd/2026-11-14-interface-acessivel");
await mkdir(out, { recursive: true });
function luminance(rgb) {
  return rgb
    .slice(0, 3)
    .map((c) => {
      c /= 255;
      return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    })
    .reduce((sum, c, i) => sum + c * [0.2126, 0.7152, 0.0722][i], 0);
}
function contrast(a, b) {
  const x = luminance(a),
    y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}
async function colors(locator) {
  return locator.evaluate((el) => {
    const s = getComputedStyle(el);
    return {
      fg: s.color.match(/[\d.]+/g).map(Number),
      bg: s.backgroundColor.match(/[\d.]+/g).map(Number),
    };
  });
}
try {
  await page.goto("http://127.0.0.1:4386/tests/fixtures/interface.html");
  await page.getByRole("button", { name: "Salvar", exact: true }).waitFor();
  const accent=await colors(page.getByTestId("accent-text"));
  const bodyBg=await page.locator("body").evaluate(el=>getComputedStyle(el).backgroundColor.match(/[\d.]+/g).map(Number));
  assert(contrast(accent.fg,bodyBg)>=4.5,"Texto vermelho deve atender AA sobre fundo escuro");
  const primary = await colors(page.getByRole("button", { name: "Salvar", exact: true }));
  assert(
    primary.bg[0] > primary.bg[1] * 2 && primary.bg[0] > primary.bg[2] * 2,
    "Ação principal deve ser vermelha",
  );
  assert(contrast(primary.fg, primary.bg) >= 4.5, "Texto do botão deve atender AA");
  for (const name of ["Salvar", "Pequeno", "Grande", "Ação"]) {
    const box = await page.getByRole("button", { name, exact: true }).boundingBox();
    assert(box.height >= 44, name + " deve ter pelo menos 44px");
  }
  assert(await page.getByRole("button", { name: "Indisponível" }).isDisabled());
  const select = page.getByRole("combobox", { name: "Conta", exact: true });
  await select.click();
  await page.getByRole("option", { name: "Conta B", exact: true }).click();
  assert.match(await select.innerText(), /Conta B/);
  await select.focus();
  await page.keyboard.press("Space");
  await page.getByRole("listbox").waitFor();
  await page.keyboard.press("Home");
  await page.waitForFunction(() => document.activeElement?.textContent === "Conta A");
  await page.keyboard.press("Enter");
  await page.waitForFunction(() =>
    document.querySelector('[aria-label="Conta"]')?.textContent?.includes("Conta A"),
  );
  await page.getByRole("button", { name: /Data:/ }).click();
  const selected = page.locator('[data-selected-single="true"]');
  const day = await colors(selected);
  assert(contrast(day.fg, day.bg) >= 4.5, "Data selecionada legível");
  await page.keyboard.press("Escape");
  await page.getByRole("textbox", { name: /Legenda/ }).fill("Minha legenda");
  await page.getByRole("textbox", { name: /Hashtags/ }).fill("#teste #conteudo");
  assert((await page.getByText("Minha legenda", { exact: false }).count()) > 0);
  await page.getByRole("combobox", { name: "Quantos Reels por dia?" }).click();
  await page.getByRole("option", { name: "10 Reels por dia", exact: true }).click();
  assert.equal(await page.locator('input[type="time"]').count(), 10);
  await page.screenshot({ path: resolve(out, "controls-desktop.png"), fullPage: true });
  await page.setViewportSize({ width: 360, height: 800 });
  assert(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    "Controles não podem transbordar no celular",
  );
  await page.getByRole("button", { name: /Data:/ }).click();
  const cal = page.locator('[data-slot="calendar"]');
  const box = await cal.boundingBox();
  assert(box.x >= 0 && box.x + box.width <= 360, "Calendário cabe no celular");
  await page.keyboard.press("Escape");
  await page.screenshot({ path: resolve(out, "controls-mobile.png"), fullPage: true });
  console.log(
    "PASS: contraste, tamanho, estados, seletor por teclado, calendário, legendas, 10 horários e mobile.",
  );
} finally {
  await browser.close();
  await server.close();
}
