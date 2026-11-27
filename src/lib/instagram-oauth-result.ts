// Static callback screen: an isolated browser deliberately has no app session.
// Never reflect OAuth code, state, tokens or arbitrary provider error descriptions.
import { INSTAGRAM_CONNECTION_CHANNEL } from "./instagram-connect.ts";

export type InstagramConnectionNotification = {
  workspaceId: string;
  instagramAccountIds: string[];
};

type InstagramRecovery = "meta_asset_setup";

export function instagramOAuthResult(
  result: string,
  reason?: string,
  connection?: InstagramConnectionNotification,
) {
  const success = result === "connected" || result === "insights_not_granted";
  const recovery: InstagramRecovery | undefined =
    reason === "unified_accounts_empty" ? "meta_asset_setup" : undefined;
  const details: Record<string, string> = {
    state_validation:
      "A autorização expirou ou não corresponde a esta janela. Inicie uma nova conexão.",
    meta_denied:
      "A autorização foi cancelada ou negada no Instagram. Nenhum novo acesso foi confirmado.",
    authorization_code_missing:
      "O Instagram não retornou o código de autorização. Tente novamente.",
    workspace_access: "Seu acesso à operação mudou. Confira as permissões da equipe.",
    workspace_app_changed:
      "O cadastro do app Meta mudou durante a autorização. Confira os dados do app e inicie uma nova conexão.",
    unified_permissions: "A Meta não concedeu as permissões necessárias para conectar e publicar.",
    unified_accounts_empty: "Nenhuma conta profissional foi compartilhada com o aplicativo.",
    unified_business_lookup:
      "A Meta não retornou o portfólio desta autorização. Confira a conta profissional e conecte novamente.",
    facebook_pages_empty: "Nenhuma Página acessível foi retornada pela Meta.",
    instagram_not_linked_to_page:
      "A Meta não encontrou o Instagram profissional nas Páginas autorizadas.",
    account_save: "Não foi possível salvar a conta. Tente novamente no painel.",
    token_save: "Não foi possível guardar a autorização com segurança. Tente novamente.",
    account_activation: "Não foi possível ativar a conta. Tente novamente no painel.",
  };
  const title = success ? "Conta conectada" : "Não foi possível conectar";
  const safeReason = reason && Object.hasOwn(details, reason) ? reason : undefined;
  const returnPath = success
    ? "/automacao-instagram?tab=contas"
    : "/automacao-instagram?tab=nova-conta&amp;instagram=connection_failed" +
      (safeReason ? "&amp;instagram_reason=" + encodeURIComponent(safeReason) : "");
  const nonce = crypto.randomUUID();
  const accountContext =
    connection && /^[\da-f-]{36}$/i.test(connection.workspaceId)
      ? {
          workspaceId: connection.workspaceId,
          instagramAccountIds: connection.instagramAccountIds.filter((id) => /^\d+$/.test(id)),
        }
      : null;
  // The channel is only a refresh hint. The original tab rechecks its own
  // workspace through the authenticated API before displaying success.
  const notification = `(() => {
    try {
      if (!('BroadcastChannel' in window)) return;
      const channel = new BroadcastChannel('${INSTAGRAM_CONNECTION_CHANNEL}');
      const id = crypto.randomUUID();
      channel.onmessage = ({ data }) => {
        if (!${JSON.stringify(recovery)} && data?.type === 'ack' && data.id === id) {
          channel.close();
          window.close();
        }
      };
      channel.postMessage({ type: 'oauth-result', id, success: ${success}, recovery: ${JSON.stringify(recovery)}, connection: ${JSON.stringify(accountContext)}, reason: ${JSON.stringify(safeReason)} });
      setTimeout(() => channel.close(), 5000);
    } catch { /* Isolated browsers keep the manual return instructions. */ }
  })();`;
  const detail =
    result === "insights_not_granted"
      ? "A conta foi conectada, mas a Meta não liberou as métricas. Você pode revisar essa permissão no painel."
      : success
        ? "A autorização foi salva com segurança. Sua lista de contas no Mousefy será atualizada."
        : (details[safeReason ?? ""] ??
          "A conexão não foi concluída. Confira se a conta profissional tem acesso ao aplicativo na Meta e tente novamente.");
  const recoveryAction =
    (recovery === "meta_asset_setup"
      ? '<p>Abra a Meta para adicionar o Instagram ao seu portfólio. Quando concluir, volte ao Mousefy e inicie a conexão novamente.</p><p><a href="https://business.facebook.com/latest/settings/instagram-accounts" target="_blank" rel="noopener noreferrer">Adicionar conta na Meta</a></p>'
      : "") + `<p><a href="${returnPath}">Voltar ao Mousefy</a></p>`;
  return new Response(
    `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title} · Mousefy</title><style>body{margin:0;background:#111217;color:#f4f4f5;font:16px/1.6 system-ui;min-height:100vh;display:grid;place-items:center}main{max-width:36rem;padding:2rem;margin:1rem;border:1px solid #45454c;border-radius:1rem;background:#1c1c23}h1{font-size:1.5rem;color:${success ? "#86efac" : "#fcd34d"}}p{color:#d4d4d8}strong{color:#fff}a{display:inline-block;color:#fff;background:#d9253b;padding:.65rem 1rem;border-radius:.5rem;font-weight:700;text-decoration:none}</style></head><body><main><p>Mousefy · Conexão do Instagram</p><h1>${title}</h1><p>${detail}</p>${recoveryAction}<p><strong>Volte à aba original do Mousefy se esta janela não fechar automaticamente.</strong></p><p>${success ? "Confira a conta na lista e continue pela biblioteca de vídeos." : recovery ? "A etapa de associação também foi aberta na aba original do Mousefy." : "Na aba original, clique em Conectar Instagram para repetir o login em uma sessão nova."}</p></main><script nonce="${nonce}">${notification}</script></body></html>`,
    {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
        "Referrer-Policy": "no-referrer",
        "Content-Security-Policy": `default-src 'none'; script-src 'nonce-${nonce}'; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'`,
        "X-Content-Type-Options": "nosniff",
      },
    },
  );
}
