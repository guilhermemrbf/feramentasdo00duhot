# MouseHot — pacote de preparação para App Review

Preparado em 17/11/2026. **Não enviado; não aprovado.**

App `2201393490722211`; rascunho `2206501010211459`; portfólio proprietário `00dohot` (`1498873732174939`).

## Situação verificável

| Item | Estado |
|---|---|
| OAuth oficial, consulta do perfil, persistência, desconexão e reconexão | Validados com @teresalisbomm em produção em 16/11 |
| Políticas públicas | Publicadas em /privacidade e /exclusao-de-dados e cadastradas na Meta |
| Perfil pessoal | Novo caminho no MouseHot abre a configuração oficial; usuário confirma a conversão no Instagram e depois retoma OAuth |
| Chamada instagram_basic | Meta mostra Concluída; descrição atualizada/salva |
| Chamada instagram_content_publish | Concluída no teste real anterior; não republicar conteúdo apenas para fingir nova prova |
| Portfólio empresarial | 00dohot não verificado; formulário exige verificação |
| Operadores e países de tratamento | Incompletos; não inferir todos os países de processamento pela sede do fornecedor |
| Screencasts | Nenhum arquivo real anexado; a tentativa com OBS não produziu gravação |
| Envio | Desabilitado, não enviado |
| Contas sem função de teste | Aguardam Advanced Access e modo Live; não validadas |

## Configuração a preservar

- Site: https://mausehot.lovable.app/
- Entrada: https://mausehot.lovable.app/automacao-instagram?tab=nova-conta
- Callback: https://mausehot.lovable.app/api/instagram/oauth/callback
- Política: https://mausehot.lovable.app/privacidade
- Exclusão: https://mausehot.lovable.app/exclusao-de-dados (instruções, não callback automático).
- Login: Unified Login, configuração `2579077412515904`.
- Permissões da solicitação: `instagram_basic`, `instagram_content_publish`.
- Não adicionar anúncios, mensagens, comentários ou insights apenas para tentar liberar o login.
- Não expor app secret, token, senha, código OAuth ou sessão pessoal em vídeo, texto, URL pública ou repositório.

## Texto de uso de instagram_basic — salvo na Meta

MouseHot uses instagram_basic to identify the professional Instagram accounts that an owner explicitly shares through Meta Unified Login. Our backend exchanges and validates the authorization code, checks the granted permissions, reads /me/assigned_instagram_accounts and stores the shared account IDs and usernames in that authenticated owner's isolated workspace. The account list shows the username, connection state, granted permissions and connection date. A server-side verification reads the authorized account's id, username, name and profile_picture_url when those optional fields are available. This lets the owner confirm the destination before uploading media or scheduling Reels, preventing publication to the wrong account. Each account has its own library and queue. Owners can disconnect a single account or reconnect through the official flow. Access tokens are encrypted on the backend and never returned to the browser. Instagram passwords are entered only on Meta-hosted pages. Owners with personal accounts can open Instagram's official professional-account setup and return to complete OAuth; MouseHot never treats that confirmation alone as a successful connection. We validated this end-to-end with our authorized professional test account @teresalisbomm, including API profile verification, persistence after reload, local disconnection and reconnection. We do not use this permission to read private information from arbitrary profiles.

## Texto de uso de instagram_content_publish — já salvo no rascunho

MouseHot (published at https://mausehot.lovable.app) lets account owners connect their Instagram professional accounts through Meta Unified Login and schedule their own organic Reels. The owner selects a connected account, uploads videos into its isolated library, adds an optional caption, hashtags and cover, chooses the publication dates/times, reviews the complete queue and explicitly activates it. Our backend uses instagram_content_publish to create an Instagram media container, wait for processing and publish the approved Reel on behalf of that owner. The history shows the actual publishing result and Meta media ID. This permission is essential for the scheduled publication requested by the owner; it is not used for account creation or unsolicited messaging. We have confirmed real publishing on our authorized test account @_melissaconteudo, including media IDs 18033466910688967 and 18123001862074768. Stories with interactive link stickers are prepared as reminders for the owner to publish manually in Instagram; we do not claim to publish those stickers through this permission.

## Instruções para o analista — orientação em inglês

1. Open https://mausehot.lovable.app/automacao-instagram?tab=nova-conta and use Continue with Google to sign in. The application associates data with the authenticated user's own workspace. Do not use the owner's credentials or request access to their production workspace.
2. Select Conectar Instagram. Meta opens its hosted authorization flow. Select Continue with Instagram, sign in to an authorized professional account, choose its business portfolio and the Instagram account to share, then review the requested profile and publishing permissions.
3. Complete the authorization. The application returns automatically and displays the account loaded from its backend. Open Contas conectadas, expand Detalhes e acesso da conta and select Verificar acesso to retrieve the authorized profile through the official API.
4. To demonstrate instagram_basic, show the username, Instagram ID, granted permissions and verification result, then reload and show that the account persists. Profile pictures are displayed only when returned by the API.
5. To demonstrate instagram_content_publish, select that account's own library, upload a test MP4 owned by the reviewer/operator, configure caption/hashtags and posting time, review the destination and queue, confirm the review and activate it. Show the actual publishing result in History and open the Reel on Instagram. Do not use an unrelated account's library or publish without the account owner's authorization.
6. Reconnect and Disconnect controls are available in the account details. Disconnection removes only that account's local credential, preserves the library/history, cancels its pending scheduled posts/reminders and pauses repeats. Reconnection does not reactivate cancelled posts.
7. For personal accounts, open Minha conta ainda é pessoal, follow Abrir configuração no Instagram and complete the official professional-account setup. Return to MouseHot, confirm the setup and select Continuar conexão do Instagram. This checkbox does not simulate a successful connection; OAuth and backend verification are still required.

Estas instruções devem acompanhar uma gravação real. O teste com login Google de uma conta de revisor nova não foi feito nesta retomada; não afirmar que houve esse teste. O código de criação/isolamento de workspace foi inspecionado, e os testes locais cobrem o fluxo com fixtures.

## Gravação real a produzir

- Capturar a interface publicada e a autorização real, incluindo seleção da conta e resultado consultado pelo backend.
- Excluir da captura senha, OTP, app secret, tokens, códigos de callback e conteúdo privado de outras contas. Capturar somente a área necessária da aplicação/consentimento.
- Mostrar a conta/arquivo escolhidos e a confirmação humana de publicação. Resultados anteriores podem ser apresentados como histórico, mas não como uma publicação nova no vídeo.
- Incluir explicações em inglês sobre os botões em português. Textos sugeridos: “Connect your professional Instagram account”; “Authorize profile identification and content publishing”; “The server confirms the account”; “Each account has a separate media library”; “Review the destination before activating”; “Show the actual published Reel”; “Disconnect and reconnect without affecting other accounts”.
- Produzir as legendas com o tempo do vídeo real, depois de gravar. Não fabricar timestamps nem apresentar sequência de screenshots como screencast.
- Só marcar a declaração de uso permitido após o responsável confirmar a declaração mostrada pela Meta.

## Dados externos necessários

1. **Verificação do proprietário:** concluir o fluxo oficial de 00dohot com dados e documentos efetivamente aceitos pela Meta. O operador havia informado que não tem empresa registrada. Não inventar registro, usar outra empresa ou presumir que CPF substitui documento empresarial neste fluxo.
2. **Tratamento por fornecedores:** confirmar entidades jurídicas e países efetivos de armazenamento/processamento/acesso remoto que recebem os Dados da Plataforma. A lista de subprocessadores da Lovable é uma fonte, mas “global” e “UE por padrão” não comprovam todos os países desta instância.
3. **Vídeos reais e acesso do analista:** anexar o material real e garantir uma forma de teste externo, sem compartilhar sessão pessoal. Somente então revisar as declarações e enviar.

Pergunta pronta para o fornecedor, ainda não enviada: “Para o projeto Lovable Cloud fzptbxfyhwypmpfrjlko, quais entidades jurídicas e países processam ou acessam dados da aplicação (incluindo identificadores e tokens Meta), considerando hospedagem, banco, armazenamento, logs e suporte remoto? Qual documento contratual comprova a lista?” Não enviar mensagens ao fornecedor sem instrução específica do proprietário.

## Fontes oficiais

- https://developers.facebook.com/documentation/instagram-platform/instagram-api-with-unified-login/permissions
- https://developers.facebook.com/documentation/instagram-platform/instagram-api-with-unified-login/business-onboarding
- https://developers.facebook.com/documentation/instagram-platform/instagram-api-with-unified-login/eligibility-and-troubleshooting
- https://developers.facebook.com/documentation/instagram-platform/app-review
