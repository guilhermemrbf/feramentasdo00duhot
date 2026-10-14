# PostKit — fundação da automação Instagram

## Objetivo

Construir um módulo original de gestão de vídeos e publicação para Instagram, com múltiplos workspaces, biblioteca de mídia, legendas, agendamentos, fila persistente, histórico e métricas. A referência de produto são funcionalidades descritas publicamente por outras plataformas; não se copia código, marca ou implementação proprietária.

## Estado atual

- A rota `/automacao-instagram` apresenta o painel, contas, biblioteca, agendamento, legendas/hashtags e configurações.
- A biblioteca e a fila desta primeira etapa são locais à sessão do navegador. Selecionar arquivos não significa fazer upload.
- Nenhuma conta é conectada e nenhuma publicação real é feita.
- As migrations abaixo definem uma fundação de dados e segurança; ainda precisam ser aplicadas e testadas em um projeto Supabase controlado pela equipe.
- A API oficial da Meta, OAuth, Edge Functions, agendador, notificações e métricas ainda não estão ligados à interface.

## Modelo de dados inicial

Migration `20261013010000_postkit_instagram_foundation.sql` cria:

- `workspaces` e `workspace_members`: isolamento multiusuário e papéis.
- `instagram_accounts` e `instagram_tokens`: identidade/conexão separada dos segredos OAuth.
- `media_assets`: metadados dos arquivos.
- `caption_sets` e `hashtag_groups`: conteúdo reutilizável.
- `publishing_schedules` e `posts`: preferências e itens de publicação.
- `publish_attempts`, `publish_logs`, `post_metrics_snapshots` e `notifications`: operação, auditoria e observabilidade.

Migration `20261013011000_postkit_private_media_storage.sql` cria o bucket privado `postkit-media` e políticas de objeto com base no primeiro segmento do caminho, que deve ser o UUID do workspace.

RLS está habilitado nas tabelas. Tokens não têm políticas de acesso para o cliente autenticado: operações de token devem passar por código confiável no servidor. Não exponha service-role keys ou tokens OAuth no bundle do React.

## Como preparar Supabase

1. Crie ou escolha o projeto Supabase correto e confirme que é o ambiente de desenvolvimento.
2. Instale/atualize o Supabase CLI e faça login.
3. Na raiz do repositório, execute `supabase link --project-ref SEU_PROJECT_REF`.
4. Revise as migrations e aplique primeiro no ambiente de desenvolvimento: `supabase db push`.
5. Execute testes com pelo menos dois usuários em workspaces separados, confirmando que cada um não consegue consultar, alterar ou baixar dados do outro.
6. Configure secrets apenas depois de existir o código servidor correspondente. Nunca coloque credenciais privadas em variáveis `VITE_*`.

Este repositório ainda não contém configuração de projeto Supabase nem um cliente Supabase instalado/configurado. Não aplique as migrations em produção sem revisão e testes.

## Próximas entregas de implementação

1. Criar ambiente de desenvolvimento Supabase e validar migrations/RLS.
2. Integrar autenticação do app ao Supabase e criar fluxo de criação/seleção de workspace.
3. Integrar biblioteca à tabela `media_assets` e ao bucket privado, incluindo limites de upload e validação real de formato/duração.
4. Persistir legendas, hashtags, preferências e fila.
5. Criar app Meta for Developers, OAuth e callback servidor; guardar tokens fora do acesso do cliente.
6. Implementar publicação de Reels com as permissões e tipos de conta aceitos pela API no momento da integração.
7. Implementar fila agendada com execução no servidor, idempotência, controle de concorrência, retries seguros e tratamento de resultados ambíguos.
8. Implementar histórico e notificações.
9. Adicionar insights apenas para métricas que a API disponibilize para o tipo de conta e conteúdo.
10. Considerar carrosséis e Stories separadamente após validar suporte, permissões e limitações atuais da API.

## Regras de segurança e confiabilidade

- Cada consulta/alteração precisa respeitar workspace e RLS.
- OAuth, token exchange, publicação e tarefas agendadas são operações server-side.
- Nunca repetir automaticamente uma publicação quando o resultado da tentativa anterior for ambíguo sem reconciliação.
- Persistir horários em UTC e manter o fuso de apresentação por workspace/conta.
- Registrar tentativa, identificadores devolvidos pela Meta, erros e horários sem gravar tokens ou segredos em logs.
- Usar apenas endpoints e permissões oficiais disponíveis e aprovados para o aplicativo.
- Tratar cada tipo de conteúdo como uma capacidade separada, sem prometer que Reels, carrosséis e Stories têm o mesmo fluxo.

## Critério para considerar o sistema operacional

- Usuário autenticado e dados isolados por workspace.
- Upload privado persistido, validado e reutilizável.
- Conta elegível conectada via OAuth oficial sem expor credenciais.
- Agendamento persiste mesmo após sair do navegador.
- Publicação real testada em conta autorizada, com confirmação e histórico.
- Falhas, expiração de autorização, rate limits e operações ambíguas tratados com segurança.
- Testes automatizados de regras RLS, agendamento, idempotência e processamento da fila.
- Build, lint e testes aprovados antes de liberar a funcionalidade.
