# Automatic Post — Instagram

Implementação de 04/11/2026, integrada ao 00duHot na rota `/automacao-instagram`. Código original; a pesquisa pública está em `scalereels-pesquisa-00duhot.md`.

## Fluxo disponível

1. Entrar no 00duHot e escolher/criar um workspace.
2. Conectar uma conta profissional pelo OAuth oficial do Instagram (requer configuração Meta).
3. Enviar vídeos MP4/MOV para o bucket privado e selecionar quais entram no lote.
4. Escolher contas, horários, quantidade, legenda e hashtags. Repetir vídeos exige seleção explícita.
5. Gerar a prévia e conferir cada conta, arquivo e horário antes de salvar. As contas ficam vinculadas à prévia, mesmo se o formulário for alterado posteriormente.
6. Acompanhar os últimos 100 registros no Histórico. Cancelamento somente antes do processamento; o arquivo permanece na biblioteca.

Prévia e preferências do formulário permanecem na sessão. Biblioteca, contas e agendamentos salvos persistem no banco. Não há rotação de legendas, edição de vídeo, importação por cookies ou publicação TikTok nesta entrega.

## Fila por etapas

O endpoint `POST /api/instagram/worker` exige Bearer validado por `authenticateCronRequest`. Cada chamada processa uma etapa de um post. O banco concede uma reserva de dois minutos; não se mantém uma requisição esperando o vídeo terminar.

- `create`: cria contêiner na Meta e persiste seu ID.
- `waiting`: consulta o contêiner salvo uma vez. `IN_PROGRESS` agenda nova consulta após pelo menos 30 segundos.
- `publishing`: persiste o marcador **antes** de chamar `media_publish`. Somente confirmação com ID permite marcar publicado.
- Resposta perdida, publicação interrompida ou contêiner já publicado: `needs_review`; sem reenvio automático.
- Processamento acima de 23 horas: falha explícita. Erros de preparação também exigem revisão e novo agendamento.

Um sucesso e sua tentativa são atualizados na mesma transação. O cliente não pode alterar status de publicação ou reservas. O cancelamento usa uma função que verifica papel e workspace. O mesmo lote usa chaves de idempotência persistentes durante a sessão. Não há garantia de horário exato: a frequência/capacidade do agendador determina a latência.

Se a resposta da criação do contêiner se perder antes de persistir o ID, pode restar um contêiner não publicado na Meta. Isso não justifica repetir `media_publish`. Limites/rate limits da Meta continuam válidos.

## Ativação no Lovable

Aplicar em ordem as migrations da fundação, armazenamento privado, worker de 17/10 e `20261103010000_instagram_resumable_queue.sql`. A nova migração restringe a política de escrita dos posts e desabilita a função antiga de claim. Verificar esquema antes de aplicar; não executar duas vezes o mesmo ALTER TABLE.

Configurar no servidor (nunca no frontend ou em `VITE_*`):

- `APP_BASE_URL`: origem HTTPS definitiva do aplicativo.
- `META_APP_ID`, `META_APP_SECRET`, `META_GRAPH_API_VERSION` compatível.
- `INSTAGRAM_OAUTH_STATE_SECRET` e `INSTAGRAM_TOKEN_ENCRYPTION_KEY` conforme os validadores do servidor.
- Credenciais de servidor Supabase já usadas pelo projeto.
- `LOVABLE_CRON_SECRET` para a chamada autenticada do agendador; não registrar o valor em logs ou arquivos versionados.

Cadastrar callback `<APP_BASE_URL>/api/instagram/oauth/callback` no app Meta. Autorizar `instagram_business_basic` e `instagram_business_content_publish`; verificar acesso de teste/revisão exigido pela Meta antes de atender outras contas. O usuário informou que ainda não possui app Meta/conta profissional de teste configurados.

No agendador do Lovable, chamar o endpoint autenticado periodicamente (começar a cada minuto). Uma chamada executa uma etapa de um post; antes de aumentar volume medir atraso da fila e ajustar capacidade com os limites da plataforma. A frequência de um minuto não significa publicação garantida em um minuto.

Antes da liberação operacional: conectar conta de teste, enviar vídeo autorizado, agendar e verificar ID/resultado no Instagram; testar cancelamento, desconexão e recuperação. Não declarar publicação real aprovada com base em mocks.

## Verificações locais

- `npm test`: 102 testes aprovados, incluindo falha de conexão, checkpoint perdido, retomada sem recriar contêiner e bloqueio de reenvio incerto. Testes de rede local exigem permissões de portas/temporários do Windows.
- `npx tsc --noEmit`: aprovado.
- `npm run build`: cliente e servidor aprovados; avisos preexistentes de tamanho de bundle permanecem.
- ESLint dos arquivos alterados: aprovado.
- `node tools/postkit/check-database.mjs`: 25 verificações em PostgreSQL/PGlite, com dois workspaces fictícios, RLS, funções restritas, reserva, cancelamento e rollback atômico. Executa em memória, sem credenciais. A extensão pgcrypto é omitida somente neste teste porque gen_random_uuid já existe no PostgreSQL embutido.

Dependência opcional gratuita do teste SQL, fora do pacote distribuído: `npm install --prefix .hot-profiles/postkit-sql-check --ignore-scripts @electric-sql/pglite@0.3.14`.

O cabeçalho do arquivo e limite de 500 MB são uma verificação inicial, não validação completa de codec, duração ou conformidade de Reel. A Meta faz a validação final. URLs temporárias de leitura são enviadas somente à API para processar a publicação solicitada.
