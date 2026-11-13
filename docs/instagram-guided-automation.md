# Instagram: conexão e programação por conta

Hot Profiles agora aparece no Automatic Post, em um caminho de cinco cartões: conta, biblioteca de Reels, configurações, Stories e revisão. O endereço antigo continua funcionando e os favoritos antigos são convertidos para o painel unificado. Os ambientes locais legados continuam disponíveis por /hot-profiles?mode=local.

## Como usar
1. Baixe /hot-profiles-connector.zip, extraia tudo e execute Iniciar Hot Profiles.cmd. Requer Node 22+ e Chrome ou Edge.
2. No Automatic Post, Conectar Conta pede o código do conector na primeira vez e abre uma janela de navegador isolada. Autorize a conta profissional pela Meta. Feche a janela depois de autorizar; a lista de contas no painel é atualizada por até dez minutos.
3. Selecione uma conta. Envie a pasta de vídeos para a biblioteca dessa conta.
4. Escolha ordem, legenda, hashtags, capa JPEG opcional e 1–10 horários por dia. O padrão inicial é 10, das 04:00 às 22:00 (editável). Sem repetição, a programação termina ao acabar os vídeos escolhidos.
5. Gere a prévia. Escolha preparar Stories ou seguir somente com Reels. Para preparar Stories, adicione os arquivos e salve os lembretes da mesma conta; depois volte à revisão de Reels.
6. Confirme o checklist e ative a programação. Trocar conta ou alterar a programação exige nova revisão. Consulte o histórico para confirmar cada publicação.

## Limites reais
- Abrir nova aba não isola cookies. O conector cria um diretório separado por tentativa e prepara somente o cookie temporário OAuth, sem reutilizar sessões pessoais. O retorno continua exigindo state assinado e cookie correspondente. Se o conector falhar, o app não usa silenciosamente a sessão antiga.
- Uma janela de conexão por vez. Não é preciso manter navegadores abertos para publicar. Isso não elimina restrições, verificações ou necessidade de permissões da Meta.
- Stories com link são preparo e lembrete para publicação manual no Instagram. Eles não são enviados automaticamente pelo worker de Reels. A revisão confere ao menos um lembrete futuro, não promete cobertura diária de todo o lote.
- Vídeos ficam no object storage existente; PostgreSQL guarda metadados. Google Drive não foi integrado ou apresentado como disponível.
- O PDF também sugere criação de contas e post no feed diário. Esta entrega conecta contas existentes e organiza a rotina de Reels/Stories; não implementa criação automática de contas ou rotina de feed.
- A migration acrescenta um RPC invoker, preservando RLS. Verifica conta/mídia, Stories, horários futuros, 10 Reels/dia nos dias solicitados e idempotência. O histórico de outros dias não bloqueia novos lotes. Agendamentos legados e loops não são alterados retroativamente.

## Verificação
npm test
node node_modules/typescript/bin/tsc --noEmit
npm run build
node tools/hot-profiles/package.mjs

Com INTELLIGENCE_PG_TEST_DEPS apontando a uma pasta que contenha @electric-sql/pglite e playwright-core:
node tests/instagram-reviewed-schedule-postgres.mjs
node tests/instagram-guided-browser.mjs
node tests/instagram-isolated-browser.mjs

Os testes usam contas/mídias sintéticas e não publicam na Meta. O último abre duas janelas temporárias com uma página local e verifica isolamento real de cookies. Não exige credenciais. Ao publicar, aplique a migration 20261113190000_instagram_reviewed_schedule.sql antes do frontend.
