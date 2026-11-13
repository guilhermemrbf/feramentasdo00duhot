// Static callback screen: an isolated browser deliberately has no app session.
// Never reflect OAuth code, state, tokens or arbitrary provider error descriptions.
export function instagramOAuthResult(result: string, reason?: string) {
  const success = result === "connected" || result === "insights_not_granted";
  const details: Record<string, string> = {
    state_validation:
      "A autorização expirou ou não corresponde a esta janela. Inicie uma nova conexão.",
    meta_denied:
      "A autorização foi cancelada ou negada no Instagram. Nenhum novo acesso foi confirmado.",
    authorization_code_missing:
      "O Instagram não retornou o código de autorização. Tente novamente.",
    workspace_access: "Seu acesso à operação mudou. Confira as permissões da equipe.",
    unified_permissions: "A Meta não concedeu as permissões necessárias para conectar e publicar.",
    unified_accounts_empty: "Nenhuma conta profissional foi compartilhada com o aplicativo.",
    facebook_pages_empty: "Nenhuma Página acessível foi retornada pela Meta.",
    instagram_not_linked_to_page:
      "A Meta não encontrou o Instagram profissional nas Páginas autorizadas.",
    account_save: "Não foi possível salvar a conta. Tente novamente no painel.",
    token_save: "Não foi possível guardar a autorização com segurança. Tente novamente.",
    account_activation: "Não foi possível ativar a conta. Tente novamente no painel.",
  };
  const title = success ? "Conta conectada" : "Não foi possível conectar";
  const detail =
    result === "insights_not_granted"
      ? "A conta foi conectada, mas a Meta não liberou as métricas. Você pode revisar essa permissão no painel."
      : success
        ? "A autorização foi salva com segurança. Sua lista de contas no MauseHot será atualizada."
        : (details[reason ?? ""] ??
          "A conexão não foi concluída. Confira se a conta profissional tem acesso ao aplicativo na Meta e tente novamente.");
  return new Response(
    `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title} · MauseHot</title><style>body{margin:0;background:#111217;color:#f4f4f5;font:16px/1.6 system-ui;min-height:100vh;display:grid;place-items:center}main{max-width:36rem;padding:2rem;margin:1rem;border:1px solid #45454c;border-radius:1rem;background:#1c1c23}h1{font-size:1.5rem;color:${success ? "#86efac" : "#fcd34d"}}p{color:#d4d4d8}strong{color:#fff}</style></head><body><main><p>MauseHot · Conexão do Instagram</p><h1>${title}</h1><p>${detail}</p><p><strong>Volte à aba original do MauseHot e feche esta janela.</strong></p><p>${success ? "Confira a conta na lista e continue pela biblioteca de vídeos." : "Na aba original, clique em Conectar Conta para repetir o login em uma sessão nova."}</p></main></body></html>`,
    {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
        "Referrer-Policy": "no-referrer",
        "Content-Security-Policy":
          "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'",
        "X-Content-Type-Options": "nosniff",
      },
    },
  );
}
