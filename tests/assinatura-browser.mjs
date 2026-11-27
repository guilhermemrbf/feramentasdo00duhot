import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { join, resolve } from "node:path";

const require = createRequire(
  resolve(process.env.INTELLIGENCE_PG_TEST_DEPS || ".", "package.json"),
);
const { chromium } = require("playwright-core");
const web = "http://127.0.0.1:4399";
const user = {
  id: "00000000-0000-4000-8000-000000000001",
  email: "fixture@example.test",
  email_confirmed_at: new Date().toISOString(),
  role: "authenticated",
  app_metadata: { provider: "email" },
  user_metadata: {},
};
const plans = [
  ["b51f6f0f-4d23-48c8-a2e7-1037849aa8a9", 49.9, "49,90"],
  ["26a29855-68aa-4a80-bd53-2200ce44c471", 89.9, "89,90"],
  ["44aa1915-be2f-4b0c-b386-7b75181c23eb", 129.9, "129,90"],
  ["66b2964c-c281-4c8c-b902-ced6d567bcbd", 269.9, "269,90"],
];
const code = "000201-PAYMENT-FIXTURE-ONLY";
const limits = [
  [50, 3],
  [100, 5],
  [150, 8],
  ["1.000", 15],
];
const now = Math.floor(Date.now() / 1000);
const encode = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
const token = [
  encode({ alg: "HS256" }),
  encode({ sub: user.id, role: "authenticated", iat: now, exp: now + 3600 }),
  "fixture",
].join(".");
let subscription;
const enrollments = [];
const api = createServer(async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", web);
  res.setHeader("Access-Control-Allow-Headers", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PATCH,OPTIONS");
  res.setHeader("Content-Type", "application/json");
  if (req.method === "OPTIONS") return res.writeHead(204).end();
  const { pathname } = new URL(req.url, web);
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const input = chunks.length ? JSON.parse(Buffer.concat(chunks).toString()) : {};
  let response;
  if (pathname.endsWith("/auth/v1/user")) response = user;
  else if (pathname.includes("/auth/v1/admin/users/")) response = { user };
  else if (pathname.endsWith("/platform_access_status")) {
    response = { status: "pending", server_now: new Date().toISOString() };
  } else if (pathname.endsWith("/syncpay_checkout_ready")) response = true;
  else if (pathname.endsWith("/syncpay_subscriptions")) {
    if (req.method === "POST") {
      subscription = { ...input, status: "enrolling", payment_status: "aguardando" };
    }
    if (req.method === "PATCH") Object.assign(subscription, input);
    response = req.headers.accept?.includes("vnd.pgrst.object")
      ? subscription
      : subscription
        ? [subscription]
        : [];
  } else if (pathname.endsWith("/auth-token")) response = { access_token: "fixture" };
  else if (pathname.endsWith("/subscription-products")) {
    response = {
      meta: {
        integration: {
          plans: plans.map(([token, amount]) => ({
            token,
            amount,
            name: "Mensal",
            periodicity_days: 30,
            billing_methods: ["pix_automatico", "qr_code"],
          })),
        },
      },
    };
  } else if (pathname.endsWith("/enroll")) {
    enrollments.push([pathname.split("/").at(-2), input.billing_method]);
    response = {
      subscription_token: "00000000-0000-4000-8000-000000000004",
      payment:
        input.billing_method === "pix_automatico" ? { qr_code: code } : { qr_code_pix: code },
    };
  } else if (pathname.endsWith("/charges")) {
    response = {
      data:
        subscription?.payment_status === "pendente"
          ? [
              { cycle_number: 2, amount: 49.9, status: "pending", payment: { qr_code_pix: code } },
              { cycle_number: 1, amount: 49.9, status: "paid", payment: { qr_code_pix: code } },
            ]
          : [],
    };
  } else response = [];
  res.end(JSON.stringify(response ?? null));
});
await new Promise((done) => api.listen(0, "127.0.0.1", done));
const apiUrl = "http://127.0.0.1:" + api.address().port;
const fixture = `
  const fetchReal = globalThis.fetch;
  globalThis.fetch = (input, options) => {
    if (typeof input === "string" && input.startsWith("https://api.syncpayments.com.br/")) {
      input = input.replace("https://api.syncpayments.com.br", ${JSON.stringify(apiUrl)});
    }
    return fetchReal(input, options);
  };
`;
const vite = spawn(
  process.execPath,
  [
    "--import=data:text/javascript;base64," + Buffer.from(fixture).toString("base64"),
    "node_modules/vite/bin/vite.js",
    "--host",
    "127.0.0.1",
    "--port",
    "4399",
    "--strictPort",
  ],
  {
    windowsHide: true,
    env: {
      ...process.env,
      APP_BASE_URL: web,
      VITE_SUPABASE_URL: apiUrl,
      SUPABASE_URL: apiUrl,
      VITE_SUPABASE_PUBLISHABLE_KEY: "fixture-anon",
      SUPABASE_PUBLISHABLE_KEY: "fixture-anon",
      SUPABASE_SERVICE_ROLE_KEY: "fixture-service",
      SYNCPAY_CLIENT_ID: "fixture-id",
      SYNCPAY_CLIENT_SECRET: "fixture-secret",
      SYNCPAY_SPLIT: "",
    },
  },
);
let output = "";
for (const stream of [vite.stdout, vite.stderr])
  stream.on("data", (chunk) => {
    output += chunk;
  });
let browser;
try {
  for (let attempt = 0; attempt < 60; attempt++) {
    try {
      if ((await fetch(web + "/assinatura", { signal: AbortSignal.timeout(2000) })).ok) break;
    } catch {}
    assert.equal(vite.exitCode, null, output);
    await new Promise((done) => setTimeout(done, 500));
  }
  browser = await chromium.launch({
    executablePath:
      process.env.CHROME_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe",
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"], { origin: web });
  await page.addInitScript(
    ({ token, user, now }) => {
      localStorage.setItem(
        "sb-127-auth-token",
        JSON.stringify({
          access_token: token,
          refresh_token: "fixture",
          token_type: "bearer",
          expires_at: now + 3600,
          user,
        }),
      );
    },
    { token, user, now },
  );
  await page.goto(web + "/assinatura");
  for (const [index, [, , price]] of plans.entries()) {
    const card = page.getByRole("article").filter({ hasText: price });
    const [instagram, ads] = limits[index];
    await card.getByText(`Até ${instagram} contas do Instagram`, { exact: true }).waitFor();
    await card.getByText(`Até ${ads} contas de anúncio`, { exact: true }).waitFor();
    await card.getByText("Até 3 contas no Telegram", { exact: true }).waitFor();
    await card.getByText("Todas as ferramentas", { exact: true }).waitFor();
    await card.getByRole("button", { name: /Selecionar plano/ }).click();
    await page.getByRole("heading", { name: "Finalizar assinatura" }).waitFor();
    const summary = page.getByRole("complementary", { name: "Resumo do plano" });
    await summary.getByText(new RegExp(price + ".*30 dias")).waitFor();
    await summary.getByText(`Até ${instagram} contas do Instagram`, { exact: true }).waitFor();
    await summary.getByText("Até 3 contas no Telegram", { exact: true }).waitFor();
    await page.getByRole("button", { name: "Voltar aos planos" }).click();
  }
  assert.deepEqual(enrollments, []);
  for (const [index, method] of ["qr_code", "pix_automatico"].entries()) {
    subscription = undefined;
    if (index === 1) await page.setViewportSize({ width: 390, height: 844 });
    await page.reload();
    const [id, , price] = plans[index];
    await page
      .getByRole("article")
      .filter({ hasText: price })
      .getByRole("button", { name: /Selecionar plano/ })
      .click();
    await page
      .getByRole("radio", { name: method === "qr_code" ? /Pix Copia e Cola/ : /Pix Automático/ })
      .check();
    await page.getByLabel("Nome completo ou razão social").fill("Pessoa de teste");
    await page.getByLabel("CPF ou CNPJ").fill("11122233344");
    if (process.env.CHECKOUT_SCREENSHOTS) {
      await page.screenshot({
        path: join(process.env.CHECKOUT_SCREENSHOTS, `mousefy-checkout-${method}.png`),
        fullPage: true,
      });
    }
    await page.getByRole("button", { name: "Gerar Pix" }).click();
    await page.getByRole("heading", { name: "Aguardando o primeiro pagamento" }).waitFor();
    const qr = page.getByRole("img", { name: "QR Code do pagamento Pix" });
    await qr.waitFor({ timeout: 8000 });
    assert.ok(await qr.evaluate((img) => img.complete && img.naturalWidth >= 256));
    const copyButton = page.getByRole("button", { name: "Copiar código Pix" });
    const qrBox = await qr.boundingBox();
    const copyBox = await copyButton.boundingBox();
    assert.ok(copyBox.y >= qrBox.y + qrBox.height, "A ação de copiar deve ficar abaixo do QR");
    await copyButton.click();
    assert.equal(await page.getByRole("heading", { name: "Cobranças", exact: true }).count(), 0);
    assert.equal(await page.evaluate(() => navigator.clipboard.readText()), code);
    assert.deepEqual(enrollments.at(-1), [id, method]);
    if (process.env.CHECKOUT_SCREENSHOTS) {
      await page.screenshot({
        path: join(process.env.CHECKOUT_SCREENSHOTS, `mousefy-qr-${method}.png`),
        fullPage: true,
      });
    }
    await page.reload();
    await qr.waitFor();
    assert.ok(await qr.evaluate((img) => img.complete && img.naturalWidth >= 256));
    if (method === "qr_code") {
      subscription.payment_status = "pendente";
      await page.reload();
      const state = page.getByRole("region", { name: "Estado da assinatura" });
      const renewalQr = state.getByRole("img", { name: "QR Code do pagamento Pix" });
      await renewalQr.waitFor();
      assert.equal(await page.getByRole("heading", { name: "Cobranças", exact: true }).count(), 0);
      assert.equal(await renewalQr.count(), 1);
      assert.ok(await renewalQr.evaluate((img) => img.complete && img.naturalWidth >= 256));
    }
  }
  console.log("Quatro seleções, dois fluxos Pix e renovação verificados em desktop e mobile.");
} catch (error) {
  console.error(output);
  throw error;
} finally {
  await browser?.close();
  vite.kill();
  api.close();
}
