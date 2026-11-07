import { createFileRoute } from "@tanstack/react-router";
import { deleteCookie, getCookie } from "@tanstack/react-start/server";
import { linkedFacebookInstagramPages } from "@/lib/facebook-instagram-pages";

type InstagramTokenResponse = {
  access_token?: string;
  user_id?: number | string;
  expires_in?: number;
};
type InstagramProfile = { user_id?: number | string; username?: string; account_type?: string };
type FacebookPagesResponse = {
  data?: Array<{
    id?: string;
    name?: string;
    access_token?: string;
    instagram_business_account?: { id?: string; username?: string; name?: string };
  }>;
};

function redirectToApp(baseUrl: URL, result: string) {
  const target = new URL("/automacao-instagram", baseUrl);
  target.searchParams.set("instagram", result);
  return new Response(null, { status: 303, headers: { Location: target.href } });
}

export const Route = createFileRoute("/api/instagram/oauth/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const {
          instagramOAuthCookieName,
          getInstagramOAuthConfig,
          verifyInstagramOAuthState,
          encryptInstagramToken,
          instagramOAuthCookieOptions,
        } = await import("@/lib/instagram-oauth.server");
        const cookieName = instagramOAuthCookieName();
        const config = getInstagramOAuthConfig();
        const cookieState = getCookie(cookieName);
        const params = new URL(request.url).searchParams;
        const returnedState = params.get("state");
        const code = params.get("code");
        deleteCookie(cookieName, instagramOAuthCookieOptions());

        if (
          !cookieState ||
          !returnedState ||
          cookieState !== returnedState ||
          !code ||
          params.has("error")
        ) {
          return redirectToApp(config.appBaseUrl, "connection_failed");
        }

        try {
          const { workspaceId, userId, mode } = await verifyInstagramOAuthState(returnedState);
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const [{ data: workspace }, { data: membership }] = await Promise.all([
            supabaseAdmin.from("workspaces").select("owner_id").eq("id", workspaceId).maybeSingle(),
            supabaseAdmin
              .from("workspace_members")
              .select("role")
              .eq("workspace_id", workspaceId)
              .eq("user_id", userId)
              .maybeSingle(),
          ]);
          if (
            !workspace ||
            (workspace.owner_id !== userId &&
              !["owner", "admin", "editor"].includes(membership?.role ?? ""))
          ) {
            throw new Error("Workspace access was revoked during Instagram authorization.");
          }
          if (mode === "facebook_login") {
            return await connectViaFacebookLogin({ code, config, workspaceId, userId });
          }
          const tokenResponse = await fetch("https://api.instagram.com/oauth/access_token", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
              client_id: process.env.META_APP_ID!,
              client_secret: process.env.META_APP_SECRET!,
              grant_type: "authorization_code",
              redirect_uri: config.callbackUrl,
              code,
            }),
          });
          if (!tokenResponse.ok) throw new Error("Instagram authorization code exchange failed.");
          const shortToken = (await tokenResponse.json()) as InstagramTokenResponse;
          if (!shortToken.access_token)
            throw new Error("Instagram did not return an access token.");

          const longTokenUrl = new URL(`${config.graphBaseUrl}/access_token`);
          longTokenUrl.search = new URLSearchParams({
            grant_type: "ig_exchange_token",
            client_secret: process.env.META_APP_SECRET!,
            access_token: shortToken.access_token,
          }).toString();
          const longTokenResponse = await fetch(longTokenUrl);
          if (!longTokenResponse.ok) throw new Error("Instagram long-lived token exchange failed.");
          const longToken = (await longTokenResponse.json()) as InstagramTokenResponse;
          if (!longToken.access_token)
            throw new Error("Instagram did not return a long-lived token.");

          const profileUrl = new URL(`${config.graphBaseUrl}/me`);
          profileUrl.search = new URLSearchParams({
            fields: "user_id,username,account_type",
            access_token: longToken.access_token,
          }).toString();
          const profileResponse = await fetch(profileUrl);
          if (!profileResponse.ok) throw new Error("Instagram profile lookup failed.");
          const profile = (await profileResponse.json()) as InstagramProfile;
          const instagramUserId = String(profile.user_id ?? shortToken.user_id ?? "");
          if (!instagramUserId || !profile.username)
            throw new Error("Instagram profile data is incomplete.");

          const expiry = new Date(
            Date.now() + (longToken.expires_in ?? 5_184_000) * 1000,
          ).toISOString();
          const { data: account, error: accountError } = await supabaseAdmin
            .from("instagram_accounts")
            .upsert(
              {
                workspace_id: workspaceId,
                instagram_user_id: instagramUserId,
                username: profile.username,
                account_type: profile.account_type ?? null,
                connection_status: "pending",
                auth_mode: "instagram_login",
                scopes: ["instagram_business_basic", "instagram_business_content_publish"],
                token_expires_at: expiry,
                last_verified_at: new Date().toISOString(),
                connected_by: userId,
                last_error_code: null,
                last_error_message: null,
              },
              { onConflict: "workspace_id,instagram_user_id" },
            )
            .select("id")
            .single();
          if (accountError || !account) throw new Error("Instagram account could not be saved.");

          const { error: tokenError } = await supabaseAdmin.from("instagram_tokens").upsert({
            account_id: account.id,
            access_token_ciphertext: await encryptInstagramToken(longToken.access_token),
            refresh_token_ciphertext: null,
            encryption_key_version: "v1",
            token_expires_at: expiry,
            updated_at: new Date().toISOString(),
          });
          if (tokenError) throw new Error("Instagram token could not be stored.");

          const { error: activateError } = await supabaseAdmin
            .from("instagram_accounts")
            .update({ connection_status: "connected", last_verified_at: new Date().toISOString() })
            .eq("id", account.id);
          if (activateError) throw new Error("Instagram account could not be activated.");

          return redirectToApp(config.appBaseUrl, "connected");
        } catch {
          return redirectToApp(config.appBaseUrl, "connection_failed");
        }
      },
    },
  },
});

/** Facebook Login flow: exchanges the code for a long-lived user token, lists
 * the user's Facebook Pages and connects every professional Instagram account
 * linked to those Pages. */
async function connectViaFacebookLogin(input: {
  code: string;
  config: ReturnType<
    typeof import("@/lib/instagram-oauth.server").getInstagramOAuthConfig
  >;
  workspaceId: string;
  userId: string;
}) {
  const { code, config, workspaceId, userId } = input;
  const { encryptInstagramToken, FACEBOOK_LOGIN_SCOPES } = await import(
    "@/lib/instagram-oauth.server"
  );
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const shortTokenUrl = new URL(`${config.facebookGraphBaseUrl}/oauth/access_token`);
  shortTokenUrl.search = new URLSearchParams({
    client_id: config.appId,
    client_secret: config.appSecret,
    redirect_uri: config.callbackUrl,
    code,
  }).toString();
  const shortTokenResponse = await fetch(shortTokenUrl);
  if (!shortTokenResponse.ok) throw new Error("Facebook authorization code exchange failed.");
  const shortToken = (await shortTokenResponse.json()) as InstagramTokenResponse;
  if (!shortToken.access_token) throw new Error("Facebook did not return an access token.");

  const longTokenUrl = new URL(`${config.facebookGraphBaseUrl}/oauth/access_token`);
  longTokenUrl.search = new URLSearchParams({
    grant_type: "fb_exchange_token",
    client_id: config.appId,
    client_secret: config.appSecret,
    fb_exchange_token: shortToken.access_token,
  }).toString();
  const longTokenResponse = await fetch(longTokenUrl);
  if (!longTokenResponse.ok) throw new Error("Facebook long-lived token exchange failed.");
  const longToken = (await longTokenResponse.json()) as InstagramTokenResponse;
  if (!longToken.access_token) throw new Error("Facebook did not return a long-lived token.");

  const pagesUrl = new URL(`${config.facebookGraphBaseUrl}/me/accounts`);
  pagesUrl.search = new URLSearchParams({
    fields: "id,name,access_token,instagram_business_account{id,username,name}",
  }).toString();
  const pagesResponse = await fetch(pagesUrl, {
    headers: { Authorization: "Bearer " + longToken.access_token },
    signal: AbortSignal.timeout(15_000),
  });
  if (!pagesResponse.ok) throw new Error("Facebook Pages lookup failed.");
  const pages = (await pagesResponse.json()) as FacebookPagesResponse;
  const professionalAccounts = linkedFacebookInstagramPages(pages.data ?? []);
  if (!professionalAccounts.length) {
    throw new Error("No professional Instagram account is linked to the user's Facebook Pages.");
  }

  const expiry = new Date(
    Date.now() + (longToken.expires_in ?? 5_184_000) * 1000,
  ).toISOString();
  for (const entry of professionalAccounts) {
    const ig = entry.ig!;
    const { data: account, error: accountError } = await supabaseAdmin
      .from("instagram_accounts")
      .upsert(
        {
          workspace_id: workspaceId,
          instagram_user_id: String(ig.id),
          username: ig.username!,
          display_name: ig.name ?? entry.pageName,
          account_type: "BUSINESS",
          connection_status: "pending",
          auth_mode: "facebook_login",
          scopes: [...FACEBOOK_LOGIN_SCOPES],
          token_expires_at: expiry,
          last_verified_at: new Date().toISOString(),
          connected_by: userId,
          last_error_code: null,
          last_error_message: null,
        },
        { onConflict: "workspace_id,instagram_user_id" },
      )
      .select("id")
      .single();
    if (accountError || !account) throw new Error("Instagram account could not be saved.");

    const { error: tokenError } = await supabaseAdmin.from("instagram_tokens").upsert({
      account_id: account.id,
      access_token_ciphertext: await encryptInstagramToken(entry.pageAccessToken!),
      refresh_token_ciphertext: null,
      encryption_key_version: "v1",
      token_expires_at: expiry,
      updated_at: new Date().toISOString(),
    });
    if (tokenError) throw new Error("Instagram token could not be stored.");

    const { error: activateError } = await supabaseAdmin
      .from("instagram_accounts")
      .update({ connection_status: "connected", last_verified_at: new Date().toISOString() })
      .eq("id", account.id);
    if (activateError) throw new Error("Instagram account could not be activated.");
  }

  return redirectToApp(config.appBaseUrl, "connected");
}
