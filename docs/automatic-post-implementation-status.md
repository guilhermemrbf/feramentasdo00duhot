# Publicação automática: estado e requisitos

## Escopo implementado nesta etapa

- O adaptador de Reels do Instagram chama a API oficial usando a sequência de criar container, aguardar `FINISHED` e publicar uma única vez.
- Respostas ambíguas da etapa `media_publish` não são repetidas automaticamente. A aplicação precisa reconciliar o estado antes de qualquer nova tentativa para evitar publicação duplicada.
- A URL de mídia é validada como HTTPS e a versão da Graph API vem da variável de ambiente `META_GRAPH_API_VERSION`.
- O app tem OAuth de Instagram Login, estado assinado associado a cookie, tokens cifrados com Web Crypto, renovação de token e conexão multi-workspace.
- A biblioteca envia MP4/MOV para o bucket privado; a fila salva agendamentos por conta e workspace, respeita o fuso horário do workspace e tem uma migration de claim concorrente para o worker.
- O endpoint `POST /api/instagram/worker` processa itens vencidos, registra tentativas e encaminha resultados ambíguos para revisão manual. Ele exige `LOVABLE_CRON_SECRET` e um agendador externo.
- Testes automatizados cobrem os fluxos simulados. Eles não substituem um teste com Supabase e conta profissional autorizada.

## Pré-requisitos externos para produção no Instagram

1. Criar e configurar um app Meta para Instagram API com Instagram Login, com permissões `instagram_business_basic` e `instagram_business_content_publish` aprovadas para os usuários pretendidos.
2. Definir o domínio HTTPS e cadastrar nele o URI OAuth de redirecionamento. O domínio fica configurável; não há um domínio de produção definido ainda.
3. Configurar `META_GRAPH_API_VERSION`, `META_APP_ID`, `META_APP_SECRET`, `APP_BASE_URL`, `INSTAGRAM_OAUTH_STATE_SECRET` e `INSTAGRAM_TOKEN_ENCRYPTION_KEY` no ambiente de servidor. A chave de estado deve ter alta entropia; a chave dos tokens deve ser uma chave base64 de 32 bytes. Segredos nunca devem usar prefixo `VITE_`.
4. Vincular contas profissionais (Creator ou Business), configurar o Supabase de desenvolvimento e aplicar as migrations depois de revisar o projeto Supabase alvo.
5. O código agora tem OAuth, criptografia, envio privado de vídeos, fila por workspace e worker. Ainda falta configurar e aplicar as migrations no projeto Supabase de desenvolvimento, validar a migration do worker e preencher os segredos no ambiente privado.
6. Configurar `LOVABLE_CRON_SECRET` e um agendador externo autenticado para chamar o worker hospedado. Só então validar a publicação com uma conta profissional de teste; publicação real continua desativada neste trabalho.

## TikTok: bloqueio de elegibilidade

O Direct Post API do TikTok não é elegível para o uso descrito neste repositório: as regras oficiais classificam como não aceitável uma ferramenta privada usada para publicar nas contas próprias ou da equipe. A API também exige uma experiência ampla para criadores, controles específicos de consentimento e, sem auditoria, só permite posts `SELF_ONLY`. Não vamos implementar nem ativar esse caminho para contornar as regras.

Para reconsiderar TikTok, o produto teria que ser direcionado a criadores em geral e aprovado pelo TikTok para `video.publish` e auditoria de Direct Post. Isso é uma mudança de produto e uma aprovação externa, não algo que um commit possa resolver.

## O que ainda impede declarar “100% funcional”

O caminho do Instagram está implementado até o endpoint do worker, mas ainda não pode ser comprovado de ponta a ponta: não há domínio, credenciais Meta, projeto Supabase de desenvolvimento ou agendador configurados. A migration nova do claim da fila e as migrations PostKit existentes não foram aplicadas; validação técnica de vídeo, histórico/notifications e revisões de falhas também precisam de validação real. Nenhum post real foi publicado.
