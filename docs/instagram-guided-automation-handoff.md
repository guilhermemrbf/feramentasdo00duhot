# Continuidade — Instagram unificado
Atualizado em 2026-11-13. Implementação validada; integração/publicação em andamento.

## Localização
Checkout: C:/Users/User/AppData/Local/Temp/00duhot-mouse-hot-v3
Branch: feat/instagram-guided-automation, base main 678feed.
Plano: docs/superpowers/plans/2026-11-13-instagram-guided-automation.md.
Projeto Lovable: 03560931-5f6a-41e1-a222-0510d1828a23.
GitHub: guilhermemrbf/feramentasdo00duhot.

## Implementado
- Menu unificado no Automatic Post, favoritos antigos Hot Profiles convertidos. URL antiga redireciona a contas; mode=local/cloud preservados.
- Conectar Conta usa Hot Profiles autenticado em loopback e abre Chrome/Edge visível com diretório novo por tentativa. Cookie temporário OAuth transferido, sem sessão pessoal do navegador/app. Uma janela por vez.
- Retorno OAuth apresenta sucesso/falha em página pública estática segura, sem exigir login MauseHot. Corrigido na revisão independente.
- Conta → biblioteca própria → legenda/hashtags/capa/1–10 horários → Stories → checklist → ativação. Padrão 10 Reels/dia, sem repetir vídeos.
- RPC schedule_reviewed_instagram_reels valida papel no workspace, conta conectada, mídia pertencente à conta, datas, limite por dia, Stories e idempotência.
- Conector distribuível: public/hot-profiles-connector.zip.

## Evidências
135/135 testes, TypeScript e build passaram. PGlite comprovou isolamento, idempotência, Stories de outra conta, horários vencidos, limite diário e histórico não relacionado. Chrome real: 2 perfis separados, cookie OAuth presente e cookie anterior ausente. Playwright: 20 Reels da conta A, 10/dia, biblioteca B excluída, gate de Stories, confirmação RPC, sem overflow mobile e callback negado sem Google login. Tudo com fixtures locais, nenhuma publicação na Meta.

## Revisão
gpt-6-astra indisponível por cota; gpt-6.1-terra realizou a revisão final. Um achado importante (callback oculto pelo login) corrigido com teste RED→GREEN e suíte verde. Menor adiado: texto do catálogo diz programar Reels e Stories; fluxo e documentação esclarecem que Stories com link são lembretes manuais.

## Decisões e limites
- Object storage existente mantido, PostgreSQL só metadados; sem Drive. Custo: armazenamento atual permanece.
- Não implementados signup automático nem post de feed diário do PDF; pedido principal conecta contas existentes.
- Stories com link continuam preparo e lembretes para publicar manualmente; há checagem de ao menos um futuro, não cobertura diária automática do lote inteiro.
- Editores podem ler status do worker; ativar worker continua restrito a owner/admin. Custo: status ativo/inativo visível aos editores.
- Agendamentos e loops legados mantidos; novo checklist cobre a programação guiada. Custo: caminhos legados não recebem a nova revisão de Stories.
- Diretórios de login ficam locais e não são reutilizados em outras tentativas; sem remover dados automaticamente. Custo: uso de disco e retenção local de sessões.
- Não realizado login real Meta durante testes; permissões particulares de cada conta precisam ser concedidas pelo operador no fluxo normal.
- FreeLLMAPI ask e health falharam em localhost:31415; trabalho continuou sem ele.
- Checkout isolado existente reaproveitado; commits/push/deploy cobertos por autorização do usuário. Nenhuma postagem real autorizada por este teste.

## Finalização operacional
Aplicar apenas a nova migration 20261113190000_instagram_reviewed_schedule.sql após confirmar a função inexistente (já conferido). Fazer push/PR/merge em main, aguardar sincronização Lovable e publicar pelo connector (nunca chat Lovable). Verificar versão de produção no navegador interno e download do conector. Registrar abaixo os IDs reais ao concluir.
