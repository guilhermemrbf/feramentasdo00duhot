import { createFileRoute } from "@tanstack/react-router";
import { deleteCookie, getCookie } from "@tanstack/react-start/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { linkedFacebookInstagramPages } from "@/lib/facebook-instagram-pages";
import type { PostkitDatabase } from "@/lib/postkit-database";
import { getMetaGraphBaseUrl } from "@/lib/social-publishing.server";

type InstagramTokenResponse = {
  access_token?: string;
  user_id?: number | string;
  expires_in?: number;
};
type InstagramProfile = { user_id?: number | string; username?: string; account_type?: string };
type FacebookInstagramProfile = { id?: string; username?: string; name?: string };
type FacebookInstagramAccount = { id?: string; username?: string; name?: string };
type FacebookPagesResponse = {
  data?: Array<{
    id?: string;
    name?: string;
    access_token?: string;
    instagram_business_account?: FacebookInstagramAccount;
    connected_instagram_account?: FacebookInstagramAccount;
  }>;
};

function redirectToApp(baseUrl: URL, result: string, reason?: string) {
  const target = new URL("/automacao-instagram", baseUrl);
  target.searchParams.set("instagram", result);
  if (reason) target.searchParams.set("instagram_reason", reason);
  return new Response(null, { status: 303, headers: { Location: target.href } });
}

function oauthFailureReason(error: unknown): string {
  const message = error instanceof Error ? error.message : "";
  const known: Record<string, string> = {
    "Workspace access was revoked during Instagram authorization.": "workspace_access",
    "Facebook authorization code exchange failed.": "facebook_code_exchange",
    "Facebook did not return an access token.": "facebook_token_missing",
    "Facebook long-lived token exchange failed.": "facebook_token_exchange",
    "Facebook did not return a long-lived token.": "facebook_long_token_missing",
    "Facebook Pages lookup failed.": "facebook_pages_lookup",
    "Facebook Instagram profile lookup failed.": "facebook_instagram_profile_lookup",
    "Instagram Unified Login code exchange failed.": "unified_code_exchange",
    "Instagram Unified Login grant is invalid.": "unified_grant",
    "Instagram Unified Login permissions were not granted.": "unified_permissions",
    "Instagram Unified Login account lookup failed.": "unified_account_lookup",
    "No Instagram accounts were shared in Unified Login.": "unified_accounts_empty",
    "Facebook returned no accessible Pages.": "facebook_pages_empty",
    "Facebook Pages did not include Page access tokens.": "facebook_page_token_missing",
    "No professional Instagram account was found on the authorized Pages.":
      "instagram_not_linked_to_page",
    "Professional Instagram profile data is incomplete.": "facebook_instagram_profile_lookup",
    "Instagram account could not be saved.": "account_save",
    "Instagram token could not be stored.": "token_save",
    "Instagram account could not be activated.": "account_activation",
  };
  return known[message] ?? "server_configuration_or_unexpected";
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

        if (params.has("error")) {
          return redirectToApp(config.appBaseUrl, "connection_failed", "meta_denied");
        }
        if (!cookieState || !returnedState || cookieState !== returnedState) {
          return redirectToApp(config.appBaseUrl, "connection_failed", "state_validation");
        }
        if (!code) {
          return redirectToApp(
            config.appBaseUrl,
            "connection_failed",
            "authorization_code_missing",
          );
        }

        try {
          const { workspaceId, userId, mode, analytics } =
            await verifyInstagramOAuthState(returnedState);
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
            return await connectViaFacebookLogin({ code, config, workspaceId, userId, analytics });
          }
          if (mode === "instagram_unified_login") {
            const { readInstagramUnifiedGrant } =
              await import("@/lib/instagram-unified-login.server");
            const grant = await readInstagramUnifiedGrant(code, {
              ...config,
              facebookGraphBaseUrl: getMetaGraphBaseUrl("instagram_unified_login"),
            });
            const postkit = supabaseAdmin as unknown as SupabaseClient<PostkitDatabase>;
            const { error } = await postkit.rpc("save_instagram_unified_accounts", {
              p_workspace_id: workspaceId,
              p_user_id: userId,
              p_accounts: grant.accounts,
              p_scopes: grant.scopes,
              p_token_ciphertext: await encryptInstagramToken(grant.token),
              p_expires_at: grant.expiry,
            });
            if (error) throw new Error("Instagram account could not be saved.");
            return redirectToApp(config.appBaseUrl, "connected");
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
        } catch (error) {
          const reason = oauthFailureReason(error);
          console.error("[instagram-oauth] connection failed", { reason });
          return redirectToApp(config.appBaseUrl, "connection_failed", reason);
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
  config: ReturnType<typeof import("@/lib/instagram-oauth.server").getInstagramOAuthConfig>;
  workspaceId: string;
  userId: string;
  analytics?: boolean;
}) {
  const { code, config, workspaceId, userId, analytics } = input;
  const { encryptInstagramToken, FACEBOOK_LOGIN_SCOPES } =
    await import("@/lib/instagram-oauth.server");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const postkit = supabaseAdmin as unknown as SupabaseClient<PostkitDatabase>;

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
  const analyticsToken = analytics
    ? await fetch(`${config.facebookGraphBaseUrl}/me/permissions`, {
        headers: { Authorization: `Bearer ${longToken.access_token}` },
        signal: AbortSignal.timeout(7_000),
      })
        .then(async (response) => {
          if (!response.ok) return undefined;
          const permissions = (await response.json()) as {
            data?: Array<{ permission: string; status: string }>;
          };
          return permissions.data?.some(
            (permission) =>
              permission.permission === "instagram_manage_insights" &&
              permission.status === "granted",
          )
            ? encryptInstagramToken(longToken.access_token!)
            : undefined;
        })
        .catch(() => undefined)
    : undefined;

  const pagesUrl = new URL(`${config.facebookGraphBaseUrl}/me/accounts`);
  pagesUrl.search = new URLSearchParams({
    fields:
      "id,name,access_token,instagram_business_account{id,username,name},connected_instagram_account{id,username,name}",
  }).toString();
  const pagesResponse = await fetch(pagesUrl, {
    headers: { Authorization: "Bearer " + longToken.access_token },
    signal: AbortSignal.timeout(15_000),
  });
  if (!pagesResponse.ok) throw new Error("Facebook Pages lookup failed.");
  const pages = (await pagesResponse.json()) as FacebookPagesResponse;
  const availablePages = pages.data ?? [];
  if (!availablePages.length) throw new Error("Facebook returned no accessible Pages.");
  if (!availablePages.some((page) => page.access_token)) {
    throw new Error("Facebook Pages did not include Page access tokens.");
  }
  if (
    !availablePages.some(
      (page) => page.instagram_business_account?.id || page.connected_instagram_account?.id,
    )
  ) {
    throw new Error("No professional Instagram account was found on the authorized Pages.");
  }
  const professionalAccounts = linkedFacebookInstagramPages(availablePages);
  if (!professionalAccounts.length) {
    throw new Error("Professional Instagram profile data is incomplete.");
  }

  const expiry = new Date(Date.now() + (longToken.expires_in ?? 5_184_000) * 1000).toISOString();
  for (const entry of professionalAccounts) {
    const ig = entry.ig!;
    let username = ig.username;
    let displayName = ig.name ?? entry.pageName;
    if (!username) {
      const profileUrl = new URL(`${config.facebookGraphBaseUrl}/${encodeURIComponent(ig.id)}`);
      profileUrl.search = new URLSearchParams({ fields: "id,username,name" }).toString();
      const profileResponse = await fetch(profileUrl, {
        headers: { Authorization: "Bearer " + entry.pageAccessToken },
        signal: AbortSignal.timeout(15_000),
      });
      if (!profileResponse.ok) throw new Error("Facebook Instagram profile lookup failed.");
      const profile = (await profileResponse.json()) as FacebookInstagramProfile;
      username = profile.username;
      displayName = profile.name ?? displayName;
    }
    if (!username) throw new Error("Facebook Instagram profile lookup failed.");

    const { data: account, error: accountError } = await supabaseAdmin
      .from("instagram_accounts")
      .upsert(
        {
          workspace_id: workspaceId,
          instagram_user_id: String(ig.id),
          username,
          display_name: displayName,
          account_type: entry.isBusinessAccount ? "BUSINESS" : null,
          connection_status: "pending",
          auth_mode: "facebook_login",
          scopes: analyticsToken
            ? [...FACEBOOK_LOGIN_SCOPES, "instagram_manage_insights"]
            : [...FACEBOOK_LOGIN_SCOPES],
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

    const { error: tokenError } = await postkit.from("instagram_tokens").upsert({
      account_id: account.id,
      access_token_ciphertext: await encryptInstagramToken(entry.pageAccessToken!),
      refresh_token_ciphertext: null,
      encryption_key_version: "v1",
      token_expires_at: expiry,
      updated_at: new Date().toISOString(),
      ...(analyticsToken
        ? {
            analytics_access_token_ciphertext: analyticsToken,
            analytics_token_expires_at: expiry,
          }
        : {}),
    });
    if (tokenError) throw new Error("Instagram token could not be stored.");

    const { error: activateError } = await supabaseAdmin
      .from("instagram_accounts")
      .update({ connection_status: "connected", last_verified_at: new Date().toISOString() })
      .eq("id", account.id);
    if (activateError) throw new Error("Instagram account could not be activated.");
  }

  return redirectToApp(
    config.appBaseUrl,
    analytics && !analyticsToken ? "insights_not_granted" : "connected",
  );
}
