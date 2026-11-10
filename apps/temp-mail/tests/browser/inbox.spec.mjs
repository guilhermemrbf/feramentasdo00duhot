import { test, expect } from "@playwright/test";
import { mailFixture, sendMail } from "../fixtures.mjs";

test("copiar, receber SMTP ao vivo, abrir HTML protegido e apagar a caixa", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Seu e-mail temporário" })).toBeVisible();
  const field = page.getByLabel("Seu endereço");
  await expect(field).toHaveValue(/@mail\.test$/u);
  const address = await field.inputValue();
  await page.getByRole("button", { name: "Copiar endereço" }).click();
  await expect(page.getByRole("status")).toContainText("Endereço copiado");
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(address);
  await expect(page.getByText("Ao vivo", { exact: true })).toBeVisible();
  const requests = [];
  page.on("request", (request) => { if (request.url().includes("tracker.invalid")) requests.push(request.url()); });
  expect(await sendMail(address, mailFixture(address, "E2E Correio Temporário"), { port: 1026 })).toBe(250);
  const received = page.getByRole("button", { name: /E2E Correio Temporário/u });
  await expect(received).toBeVisible({ timeout: 20000 });
  await received.click();
  await expect(page.getByText("Mensagem de teste SMTP real.")).toBeVisible();
  await page.getByRole("button", { name: "HTML protegido" }).click();
  const body = page.frameLocator('iframe[title="Conteúdo protegido da mensagem"]');
  await expect(body.getByText("protegido")).toBeVisible();
  await expect(body.locator("img, a, script")).toHaveCount(0);
  expect(requests).toEqual([]);
  await page.getByRole("button", { name: "Excluir caixa" }).click();
  await page.getByRole("button", { name: "Confirmar", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("mensagens excluídas");
  await expect(field).toHaveValue("");
  expect(await sendMail(address, null)).toBe(550);
  await page.reload();
  await expect(field).toHaveValue("");
});

test("interface de celular cabe na tela e cria um endereço", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.getByLabel("Seu endereço")).toHaveValue(/@mail\.test$/u);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  const original = await page.getByLabel("Seu endereço").inputValue();
  await page.getByRole("button", { name: "Gerar outro" }).click();
  await page.getByRole("button", { name: "Confirmar", exact: true }).click();
  await expect(page.getByLabel("Seu endereço")).not.toHaveValue(original);
  await expect(page.getByLabel("Seu endereço")).toHaveValue(/@mail\.test$/u);
  expect(await sendMail(original, null)).toBe(550);
});
