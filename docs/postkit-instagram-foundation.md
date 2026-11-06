# PostKit — fundação da automação Instagram

## Objetivo

Construir um módulo original de gestão de vídeos e publicação para Instagram, com múltiplos workspaces, biblioteca de mídia, legendas, agendamentos, fila persistente, histórico e métricas. A referência de produto são funcionalidades descritas publicamente por outras plataformas; não se copia código, marca ou implementação proprietária.

## Estado atual

Atualizado em 04/11/2026. Consulte [operação e ativação](postkit-instagram-operation.md) para o estado implementado, testes e pendências.

- A rota `/automacao-instagram` integra autenticação, workspaces, OAuth, upload privado, seleção de vídeos/contas, prévia, agendamento persistente e histórico com cancelamento.
- O worker servidor retoma o processamento por etapas e exige conferência quando o resultado de uma publicação é incerto.
- A publicação real depende de app Meta, conta profissional autorizada, segredos de servidor e agendador. Esses requisitos não são substituídos pelos testes locais.
- Métricas externas, notificações e rotação automática de legendas não foram implementadas nesta entrega.

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

O repositório contém cliente Supabase e integração servidor. A migração da fila foi aplicada e verificada no Lovable em 06/11/2026, após autorização específica para substituir a política de escrita dos posts.

## Próximas entregas de implementação

1. Configurar app Meta, permissões, segredos de servidor e execução periódica do worker; o código OAuth e de publicação já existe.
2. Validar uma publicação real em conta profissional de teste autorizada.
3. Adicionar validação completa de codec/duração e persistência de modelos de legenda e preferências (a fila já persiste).
4. Implementar notificações e insights para métricas disponíveis na API.
5. Considerar carrosséis e Stories separadamente após validar suporte, permissões e limitações atuais.

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
