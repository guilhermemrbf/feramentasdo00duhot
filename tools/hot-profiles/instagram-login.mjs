import { randomUUID } from "node:crypto";
import { startBrowser } from "./browser.mjs";

export function validateInstagramLogin(input, origin) {
  const provider = new URL(input?.authorizationUrl);
  const callback = new URL(provider.searchParams.get("redirect_uri"));
  const local = new URL(origin);
  const secure = local.protocol === "https:";
  const isLocal = ["127.0.0.1", "localhost"].includes(local.hostname);
  if (
    (!secure && !(local.protocol === "http:" && isLocal)) ||
    local.origin !== origin ||
    provider.protocol !== "https:" ||
    provider.username ||
    provider.password ||
    provider.hash ||
    !(
      (provider.hostname === "www.instagram.com" && provider.pathname === "/oauth/authorize") ||
      (provider.hostname === "www.facebook.com" &&
        /^\/(v[0-9]+\.[0-9]+\/)?dialog\/oauth$/.test(provider.pathname))
    ) ||
    callback.origin !== origin ||
    callback.pathname !== "/api/instagram/oauth/callback" ||
    callback.search ||
    callback.hash ||
    callback.username ||
    callback.password ||
    input.cookie?.url !== origin ||
    input.cookie?.name !== (secure ? "__Host-instagram-oauth" : "instagram-oauth-state") ||
    typeof input.cookie?.value !== "string" ||
    input.cookie.value.length < 10 ||
    input.cookie.value.length > 4096 ||
    input.cookie.value !== provider.searchParams.get("state") ||
    input.cookie.maxAge !== 600
  )
    throw new Error("Autorização inválida. Inicie a conexão pelo MauseHot.");
  return {
    authorizationUrl: provider.href,
    cookie: {
      name: input.cookie.name,
      value: input.cookie.value,
      url: origin + "/",
      path: "/",
      httpOnly: true,
      secure,
      sameSite: "Lax",
      expires: Math.floor(Date.now() / 1000) + 600,
    },
  };
}

export function createInstagramLoginManager({ directory, start = startBrowser }) {
  let current = null;
  let opening = false;
  return {
    async open(input, origin) {
      const valid = validateInstagramLogin(input, origin);
      if (current || opening)
        throw new Error("Feche a janela de conexão anterior antes de conectar outra conta.");
      opening = true;
      const sessionId = randomUUID();
      let ended = false;
      try {
        const runtime = await start(
          {
            id: sessionId,
            viewport: { width: 1100, height: 800 },
            startUrls: [valid.authorizationUrl],
          },
          directory,
          null,
          () => {
            ended = true;
            if (current?.sessionId === sessionId) current = null;
          },
          undefined,
          { visible: true, cookies: [valid.cookie] },
        );
        if (ended) {
          await runtime.stop();
          throw new Error("A janela foi fechada antes de iniciar o login.");
        }
        current = { runtime, sessionId };
        return { sessionId };
      } finally {
        opening = false;
      }
    },
    async close() {
      const active = current;
      if (active) {
        await active.runtime.stop();
        if (current === active) current = null;
      }
    },
  };
}
