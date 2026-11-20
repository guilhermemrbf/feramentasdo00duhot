# Primeiros passos no Automatic Post

O proprietário de uma operação nova entra com o Google, abre o Automatic Post e encontra **Primeiros passos** na **Visão geral**. Cada operação cadastra um app Meta próprio. Membros de uma operação compartilhada usam a mesma configuração e apenas proprietários e administradores podem salvá-la.

## Configure a Meta e conecte o Instagram

1. Em [Meta for Developers](https://developers.facebook.com/apps/), crie um app no seu portfólio empresarial e selecione o caso de uso para gerenciar conteúdo e mensagens no Instagram.
2. No Login Unificado, configure Instagram como ativo obrigatório e selecione token de usuário do sistema. Conceda `instagram_basic` e `instagram_content_publish`. Se quiser consultar métricas, inclua `instagram_manage_insights`.
3. Copie a URI exibida em **Primeiros passos** e cadastre-a exatamente em **URIs de redirecionamento OAuth válidos**. Em produção ela usa HTTPS e o domínio definitivo do MauseHot.
4. Copie **ID do app** e **Segredo do app** de **Configurações do app → Básico**. Copie **ID da configuração** do Login Unificado. Cole os três campos no MauseHot e clique em **Validar e salvar app**. O servidor consulta a Meta para conferir o app e seu segredo. O ID da configuração e as permissões são verificados no fluxo de conexão.
5. Clique em **Conectar Instagram**. Use um perfil profissional Business ou Criador, selecione o portfólio e compartilhe o perfil no formulário oficial. Quando a conta aparecer no MauseHot, envie o primeiro vídeo e programe um Reel. A Visão geral acompanha o progresso até a primeira publicação.

Em desenvolvimento, a Meta restringe o app a perfis com as funções adequadas. Quando for necessário convidar um testador, faça isso em **Funções do app** e aceite o convite no Instagram do perfil. Caso o app precise atender perfis fora das funções habilitadas, consulte os requisitos de acesso, revisão e modo Live. O app de um cliente é administrado pelo próprio cliente. Veja o [guia de configuração](https://developers.facebook.com/documentation/instagram-platform/instagram-api-with-unified-login/get-started) e as [permissões](https://developers.facebook.com/documentation/instagram-platform/instagram-api-with-unified-login/permissions) da Meta.

## Publicação e continuidade

- Aplique `20261120100000_instagram_workspace_apps.sql` ao Supabase antes de publicar o código. A migração registra o modo anterior só nas operações que já possuíam um token salvo no momento da aplicação. Credenciais e configurações do app da plataforma continuam no servidor para essas operações. Operações novas passam pelo cadastro obrigatório.
- O backend usa `APP_BASE_URL`, `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `META_GRAPH_API_VERSION`, `INSTAGRAM_OAUTH_STATE_SECRET` e `INSTAGRAM_TOKEN_ENCRYPTION_KEY`. Use uma chave de 32 bytes codificada em base64 e preserve-a para decifrar tokens e segredos existentes. O modo anterior também usa `META_APP_ID`, `META_APP_SECRET` e `META_INSTAGRAM_LOGIN_CONFIG_ID`.
- A tabela de apps é acessível só pelo backend. O segredo é criptografado e vinculado ao ID da operação, ao app e à configuração. O OAuth usa a versão do cadastro gravada no `state` e rejeita autorizações iniciadas com uma versão substituída durante o login. O callback valida o token, o app de origem e os escopos antes de persistir a conta.
- Para corrigir o ID da configuração ou atualizar o segredo, abra **Visão geral → Gerenciar app Meta** e informe o segredo novamente. Para trocar o ID do app, primeiro desconecte as contas ligadas ao app anterior.
- Para a primeira validação após a publicação, use uma nova operação e um app Meta de teste autorizado. Cadastre as três informações, conecte um Instagram profissional, recarregue a Visão geral e confira que a conta permanece conectada. Agende um Reel autorizado e confirme sua publicação na fila e no Instagram. Confira também a operação legada antes de abrir o SaaS ao público.

## Testes de desenvolvimento

- `npm test` cobre assinatura do `state`, integridade de tokens e vínculo criptográfico do segredo à operação.
- `node tests/instagram-connection-lifecycle-postgres.mjs` aplica as migrações em PGlite e verifica acesso, isolamento e salvamento da conta.
- `node --experimental-strip-types tests/instagram-guided-browser.mjs` usa Chrome e respostas Meta/Supabase controladas para exercitar login existente e cadastro de uma operação nova até o callback e a reabertura do painel. Os dois testes de integração aceitam `INTELLIGENCE_PG_TEST_DEPS` apontando para um diretório com `@electric-sql/pglite` e `playwright-core`.

## Recuperar o vínculo da operação administradora

A operação que já usava o app Meta da plataforma deve continuar utilizando as credenciais de servidor existentes. Se a Visão geral pedir o cadastro de outro app após uma migração, localize em **Supabase → Authentication → Users** o UUID da conta Google que é proprietária da operação. Em **Table Editor → workspaces**, confirme o UUID da operação e a correspondência com `owner_id`. Uma mesma conta pode ter mais de uma operação.

No SQL Editor, execute [o script de recuperação](../tools/restore-instagram-platform-workspace.sql) com os dois UUIDs verificados. Ele vincula só a operação indicada, preserva vínculos existentes e recusa sobrescrever um app próprio. O vínculo reaproveita `META_APP_ID`, `META_APP_SECRET` e `META_INSTAGRAM_LOGIN_CONFIG_ID` no servidor. Confira a presença dessas variáveis e a URI de callback cadastrada no app da Meta sem copiar segredos para o navegador ou para o repositório.

Ao reabrir a Visão geral, verifique que o app da plataforma está vinculado à operação. Se o Supabase de destino ainda estiver sem os registros anteriores, restaure as contas, os tokens, o histórico e os arquivos pelo [procedimento de migração](./supabase-vercel-migration.md#transferência-da-operação-existente). Uma nova autorização do Instagram pode vincular perfis para uso futuro quando os tokens antigos não puderem ser recuperados. Confira também os jobs de publicação e métricas e a resposta de cada worker antes de colocar a fila real em execução.

## Estado da entrega

O código está na branch `feat/home-saas`. Os testes locais confirmaram que a operação nova só abre o Automatic Post após registrar seu app e conectar o perfil, que a conta reaparece após atualizar a página e que uma configuração substituída invalida autorizações anteriores. No navegador, foram mantidos os fluxos das contas existentes e das bibliotecas de Reels e Stories.

O build de produção e o TypeScript passaram. A suíte geral executou 156 testes, com 155 aprovados e uma falha já observada no Hot Profiles quando o Git converte as quebras de linha do README para CRLF.

Para retomar em produção, aplique a migração, publique o build e valide com um app Meta real de uma operação nova. As validações automatizadas usam dados e respostas de teste separados da produção.
