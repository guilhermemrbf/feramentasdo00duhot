# Publicação automática: estado e requisitos

## Escopo implementado nesta etapa

- O adaptador de Reels do Instagram chama a API oficial usando a sequência de criar container, aguardar `FINISHED` e publicar uma única vez.
- Respostas ambíguas da etapa `media_publish` não são repetidas automaticamente. A aplicação precisa reconciliar o estado antes de qualquer nova tentativa para evitar publicação duplicada.
- A URL de mídia é validada como HTTPS e a versão da Graph API vem da variável de ambiente `META_GRAPH_API_VERSION`.
- Testes automatizados cobrem o fluxo simulado do Instagram. Eles não substituem um teste com conta profissional autorizada.

## Pré-requisitos externos para produção no Instagram

1. Criar e configurar um app Meta para Instagram API com Instagram Login, com permissões `instagram_business_basic` e `instagram_business_content_publish` aprovadas para os usuários pretendidos.
2. Definir o domínio HTTPS e cadastrar nele o URI OAuth de redirecionamento. O domínio fica configurável; não há um domínio de produção definido ainda.
3. Configurar `META_GRAPH_API_VERSION`, `META_APP_ID`, `META_APP_SECRET`, `APP_BASE_URL`, `INSTAGRAM_OAUTH_STATE_SECRET` e `INSTAGRAM_TOKEN_ENCRYPTION_KEY` no ambiente de servidor. A chave de estado deve ter alta entropia; a chave dos tokens deve ser uma chave base64 de 32 bytes. Segredos nunca devem usar prefixo `VITE_`.
4. Vincular contas profissionais (Creator ou Business), configurar o Supabase de desenvolvimento e aplicar as migrations depois de revisar o projeto Supabase alvo.
5. O código agora tem início e callback OAuth com verificação de `state` vinculada a cookie, gravação cifrada dos tokens, renovação de tokens perto da expiração e tela de conexão por workspace. Ainda faltam o fluxo de mídia, fila agendada, worker e integração completa da interface antes de considerar a funcionalidade pronta para usuários.
6. Configurar um agendador externo autenticado para chamar o worker no ambiente hospedado e validar o fluxo com uma conta de teste, sem publicar conteúdo real sem aprovação.

## TikTok: bloqueio de elegibilidade

O Direct Post API do TikTok não é elegível para o uso descrito neste repositório: as regras oficiais classificam como não aceitável uma ferramenta privada usada para publicar nas contas próprias ou da equipe. A API também exige uma experiência ampla para criadores, controles específicos de consentimento e, sem auditoria, só permite posts `SELF_ONLY`. Não vamos implementar nem ativar esse caminho para contornar as regras.

Para reconsiderar TikTok, o produto teria que ser direcionado a criadores em geral e aprovado pelo TikTok para `video.publish` e auditoria de Direct Post. Isso é uma mudança de produto e uma aprovação externa, não algo que um commit possa resolver.

## O que ainda impede declarar “100% funcional”

O adaptador do Instagram e o vínculo OAuth estão implementados, mas ainda não formam publicação ponta a ponta. Envio de mídia, persistência da fila, worker agendado, reconciliação, notificações e o restante da interface ainda precisam ser integrados e exercitados. A migration existente prepara parte do modelo de dados, mas não foi aplicada a nenhum banco neste trabalho.
