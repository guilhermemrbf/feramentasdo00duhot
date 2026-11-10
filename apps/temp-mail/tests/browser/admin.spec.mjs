import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";

test("administra domínio e a caixa passa a usar o domínio disponível após desativação", async ({ page, browser }) => {
  const email = process.env.TEST_ADMIN_EMAIL;
  const password = process.env.TEST_ADMIN_PASSWORD;
  expect(email).toBeTruthy();
  expect(password).toBeTruthy();
  const suffix = "operacao-" + randomUUID().slice(0, 8) + ".test";

  await page.goto("/admin");
  await page.getByLabel("E-mail", { exact: true }).fill(email);
  await page.getByLabel("Senha", { exact: true }).fill(password);
  const [session] = await Promise.all([
    page.waitForResponse((response) => response.request().method() === "POST" && response.url().endsWith("/api/admin/login")),
    page.getByRole("button", { name: "Entrar" }).click(),
  ]);
  expect(session.status(), await session.text()).toBe(200);
  await expect(page.getByRole("heading", { name: "Serviços e validade" })).toBeVisible();
  await page.getByLabel("Domínio", { exact: true }).fill(suffix);
  await page.getByRole("button", { name: "Cadastrar" }).click();
  const record = page.locator(".record").filter({ hasText: suffix });
  await expect(record.getByText("Desativado")).toBeVisible();
  await record.getByRole("button", { name: "Ativar", exact: true }).click();
  await expect(record.getByText("Ativo", { exact: true })).toBeVisible();

  const visitor = await browser.newContext({ baseURL: process.env.TEST_BASE_URL ?? "http://localhost:8080" });
  try {
    const inbox = await visitor.newPage();
    await inbox.goto("/");
    const address = inbox.getByLabel("Seu endereço");
    await expect(address).toHaveValue(/@mail\.test$/u);
    const changeAddress = async () => {
      await inbox.getByRole("button", { name: "Gerar outro" }).click();
      await inbox.getByRole("button", { name: "Confirmar", exact: true }).click();
    };
    await inbox.getByLabel("Domínio para o próximo endereço").selectOption(suffix);
    await changeAddress();
    await expect.poll(async () => (await address.inputValue()).split("@")[1]).toBe(suffix);
    await record.getByRole("button", { name: "Desativar", exact: true }).click();
    await expect(record.getByText("Desativado")).toBeVisible();

    await inbox.reload();
    await expect.poll(async () => (await address.inputValue()).split("@")[1]).toBe(suffix);
    await changeAddress();
    await expect(address).toHaveValue(/@mail\.test$/u);
  } finally {
    await visitor.close();
  }
});
