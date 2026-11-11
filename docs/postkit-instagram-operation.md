# Automatic Post — Instagram

Implementação de 04/11/2026, integrada ao 00duHot na rota `/automacao-instagram`. Código original; a pesquisa pública está em `scalereels-pesquisa-00duhot.md`.

## Publicação verificada em 06/11/2026

- Commit de implementação `39616d4`, enviado à main e sincronizado no projeto Lovable `03560931-5f6a-41e1-a222-0510d1828a23`.
- Migrações de worker e fila aplicadas em transação pelo editor SQL do Lovable. O usuário autorizou especificamente a substituição da política de posts após bloqueio da revisão automática.
- Consulta posterior confirmou os seis itens: função de fila, função de cancelamento, nova política de agendamento, remoção da antiga política ampla, worker restrito ao servidor e função antiga desativada para service_role.
- Lovable confirmou “Seu site foi atualizado”. A rota pública `https://feramentasdo00duhot.lovable.app/automacao-instagram` carregou a tela de login.
- Nenhum segredo foi cadastrado e nenhuma publicação Instagram foi executada. Login para validação interativa, app Meta/conta profissional, segredos e agendador continuam necessários para validar a operação completa.

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
- O segredo do worker é criado no servidor e guardado no Vault do Supabase; o frontend nunca recebe seu valor.

Cadastrar o callback `<APP_BASE_URL>/api/instagram/oauth/callback` no painel da Meta. O botão **Conectar Conta** usa o Login Unificado. A configuração deve aceitar contas profissionais do Instagram como ativo obrigatório, com token de usuário do sistema e permissões `instagram_basic` e `instagram_content_publish`. O app 00duHot Publisher tem configuração própria. Em outro app Meta, defina o ID da configuração compatível em `META_INSTAGRAM_LOGIN_CONFIG_ID`. O usuário escolhe os perfis no portfólio empresarial durante a autorização.

A opção **Ajuda para conectar** orienta o administrador a convidar contas de teste e indica onde aceitar o convite no Instagram. Para liberar o Login Unificado a clientes externos, conclua a análise do app e obtenha acesso avançado às permissões no painel da Meta. A autorização por Página continua disponível para as métricas das contas conectadas anteriormente por esse fluxo.

Na aba Configurações do PostKit, uma pessoa owner/admin ativa o processamento. A ativação cria um segredo aleatório no servidor, guarda o valor no Vault do Supabase, grava apenas seu hash para validação e agenda `POST /api/instagram/worker` pelo `pg_cron`/`pg_net` a cada minuto. Uma chamada executa uma etapa; o tempo total depende da preparação da Meta e da fila. A frequência de um minuto não significa publicação exata em um minuto.

Antes da liberação operacional: conectar conta de teste, enviar vídeo autorizado, agendar e verificar ID/resultado no Instagram; testar cancelamento, desconexão e recuperação. Não declarar publicação real aprovada com base em mocks.

## Verificações locais

- `npm test`: 102 testes aprovados, incluindo falha de conexão, checkpoint perdido, retomada sem recriar contêiner e bloqueio de reenvio incerto. Testes de rede local exigem permissões de portas/temporários do Windows.
- `npx tsc --noEmit`: aprovado.
- `npm run build`: cliente e servidor aprovados; avisos preexistentes de tamanho de bundle permanecem.
- ESLint dos arquivos alterados: aprovado.
- `node tools/postkit/check-database.mjs`: 25 verificações em PostgreSQL/PGlite, com dois workspaces fictícios, RLS, funções restritas, reserva, cancelamento e rollback atômico. Executa em memória, sem credenciais. A extensão pgcrypto é omitida somente neste teste porque gen_random_uuid já existe no PostgreSQL embutido.

Dependência opcional gratuita do teste SQL, fora do pacote distribuído: `npm install --prefix .hot-profiles/postkit-sql-check --ignore-scripts @electric-sql/pglite@0.3.14`.

O cabeçalho do arquivo e limite de 500 MB são uma verificação inicial, não validação completa de codec, duração ou conformidade de Reel. A Meta faz a validação final. URLs temporárias de leitura são enviadas somente à API para processar a publicação solicitada.
