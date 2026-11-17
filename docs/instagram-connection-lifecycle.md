# Instagram — relatório final e contexto de continuidade

## Estado em 17/11/2026

**Ciclo oficial com conta autorizada: CONCLUÍDO E VALIDADO.**

A conta nova **@teresalisbomm** foi conectada pela interface publicada, consultada pela API oficial, desconectada e reconectada pela interface. Os dados permaneceram salvos após recarregar. O servidor confirmou a remoção do token na desconexão e uma nova credencial criptografada após a reconexão.

**Onboarding público sem convite de testador: AGUARDANDO AÇÃO EXTERNA — NÃO VALIDADO.** O app continua não publicado, sem Advanced Access/App Review aprovado. Este teste não libera clientes externos nem elimina as exigências da Meta para novos perfis enquanto o app estiver em desenvolvimento. Ver `meta-app-review.md`.

## Ambiente e versão

- Checkout: `C:/Users/User/AppData/Local/Temp/00duhot-mouse-hot-v3`.
- Produção: https://mausehot.lovable.app/automacao-instagram?tab=contas
- Lovable: projeto `03560931-5f6a-41e1-a222-0510d1828a23`.
- Banco Lovable Cloud/Supabase: `fzptbxfyhwypmpfrjlko`.
- Ciclo de conexão implementado e validado em produção no commit **882a756**, em 16/11.
- Código atual de produção: **269a18f**, publicado em 17/11 com resposta Lovable **Seu site foi atualizado**. Acrescenta o guia de preparação de perfis pessoais e a continuação pelo mesmo OAuth oficial. Nenhuma migration ou mudança de tokens foi necessária nessa etapa.
- Preservar os outros módulos, bibliotecas e a fila ativa de `_melissaconteudo`. Nenhum novo Reel foi publicado como parte deste teste de conexão.

## Método oficial e tipos de conta

O botão principal usa **Instagram API with Unified Login**, já configurado nesta instalação. Abre a autorização oficial em popup; o conector local é opcional. São suportadas contas profissionais **Business/Creator**. O fluxo usa um portfólio empresarial e não exige uma Página do Facebook. Não usar endpoints privados, cookies extraídos ou senhas coletadas pela aplicação.

Fontes oficiais consultadas:

- https://developers.facebook.com/documentation/instagram-platform/instagram-api-with-unified-login/
- https://developers.facebook.com/documentation/instagram-platform/instagram-api-with-unified-login/authentication
- https://developers.facebook.com/documentation/instagram-platform/instagram-api-with-instagram-login/business-login

App: `00duHot Publisher`, ID `2201393490722211`, configuração `2579077412515904`.
Callback: `https://mausehot.lovable.app/api/instagram/oauth/callback`.
Permissões de publicação validadas no grant real: **instagram_basic**, **instagram_content_publish**; o grant também incluiu `public_profile`. Não foram solicitadas permissões adicionais de comentários/insights nesta etapa.

## Implementação

- `src/lib/api/instagram-connection.functions.ts`: POST autenticado, autorização por operação/conta, consulta real de perfil e desconexão pela RPC. Token inválido/expirado exige reconexão; falha de rede não é apresentada como revogação.
- `src/lib/instagram-connection-profile.ts`: identidade validada, nome/foto quando disponibilizados, foto HTTPS restrita a hosts Meta. Timeout de dez segundos; uma tentativa adicional com campos básicos quando os opcionais forem indisponíveis. Erros não expõem a resposta bruta nem tokens.
- `src/components/postkit/InstagramConnectionDetails.tsx`: ID, permissões, datas, verificar, reconectar e desconectar com confirmação.
- `src/components/postkit/InstagramProfessionalSetup.tsx`: passo a passo opcional para abrir a conversão oficial de perfil pessoal, confirmação do proprietário e retomada do OAuth; nunca simula conversão ou conexão. A mudança para perfil público é explicada antes da saída para o Instagram.
- `src/routes/automacao-instagram.tsx`: integra os controles às contas sem substituir bibliotecas ou fluxos de Stories/Reels.
- `src/lib/instagram-unified-login.server.ts` e `src/routes/api.instagram.oauth.callback.ts`: preservam validação de state/identidade do app/permissões, troca segura de código, persistência atômica e notificação da janela original. Registram `client_business_id` e configuração do grant.
- `src/lib/instagram-oauth.server.ts`: só disponibiliza token de conta marcada como conectada. Tokens permanecem AES-GCM no backend. Unified Login não é enviado ao endpoint de refresh do Instagram Login; expiração/revogação exige nova autorização quando não houver renovação suportada.
- `src/lib/postkit-database.ts`: tipos aditivos, sem editar arquivos gerados do Supabase.

### Banco

`supabase/migrations/20261116235000_instagram_connection_lifecycle.sql` foi aplicada no SQL editor do Lovable Cloud e verificada em produção. Adiciona cinco campos de metadados e a RPC `disconnect_instagram_account`.

A RPC apaga o token local somente da conta/operação autorizadas, marca revogada, cancela Reels agendados e lembretes pendentes de Stories, pausa loops e preserva mídia/histórico. Recusa desconexão com post em processamento. Reconectar não restaura agendamentos cancelados. Não revoga globalmente um grant Meta compartilhado com outras contas.

Produção: cinco colunas confirmadas; desconexão negada ao papel anônimo; autenticados passam por verificação interna de owner/admin/editor; clientes autenticados não podem executar o salvamento de tokens. RLS da tabela de tokens continua sem política de leitura para clientes.

## Evidências do teste real

| Etapa | Resultado observado |
|---|---|
| Perfil existente, 22:52 | API confirmou @morenacoletora, nome Noemi santos, foto e ID; nome/foto persistiram após reload. |
| Diagnóstico de App not active | A sessão estava em @guimr__, ausente das funções de teste. Convite enviado com autorização específica; permaneceu pendente porque o proprietário escolheu outra conta. |
| Nova conta | Sessão identificada como @teresalisbomm. As configurações mostraram que era pessoal. O proprietário concluiu a conversão para profissional e o aceite do convite de teste diretamente nas telas oficiais. |
| OAuth novo, 23:17 | Clique na plataforma abriu Meta; Instagram reconheceu teresalisbomm. Após o aceite do proprietário, a janela retornou/fechou e MouseHot exibiu a conta nova na biblioteca própria, com zero vídeos. |
| API, 23:18 | Verificar acesso retornou nome teresa e ID **17841455323323892**. A interface mostrou Acesso confirmado pela API oficial da Meta. Não foi fornecida foto nesse retorno. |
| Persistência | Nova navegação/reload manteve conta, nome, ID, permissões, data e estado conectado. |
| Banco antes da desconexão | `client_business_id` salvo, configuração 2579077412515904, token criptografado presente; zero Reels pendentes/em processamento, zero Stories pendentes e zero loops ativos dessa conta. Nenhum valor de token foi lido/exibido. |
| Desconexão real, 23:21 | Confirmação pela interface; servidor mostrou revoked, disconnected_at preenchido e ausência do token. As outras três contas permaneceram conectadas. |
| Reconexão real, 23:24 | Botão Reconectar Instagram iniciou autorização nova; proprietário confirmou na Meta. Callback restaurou a mesma conta, com nova data de conexão, disconnected_at nulo e novo token criptografado presente. |
| Verificação final | Após nova navegação, Verificar acesso consultou a API usando a nova autorização e confirmou o perfil novamente. |

Horários em America/Sao_Paulo; o banco registra UTC (17/11 às 02:17, 02:21 e 02:24 correspondem a 16/11 no Brasil).

Evidências locais reais, não fixtures:

- `C:/Users/User/AppData/Local/Temp/mausehot-instagram-conexao-validada-final-20261116.jpg`.
- `C:/Users/User/AppData/Local/Temp/mausehot-teresa-api-confirmada-20261116.jpg`.
- `C:/Users/User/AppData/Local/Temp/mausehot-teresa-desconexao-validada-20261116.jpg`.
- `C:/Users/User/AppData/Local/Temp/mausehot-instagram-api-verificada-20261116.jpg`.

## Testes e verificações locais

- **152 testes unitários passaram**: state/assinatura/expiração, cifra, grants, permissões, paginação, identidade, campos opcionais, URL de foto, erros e outras regressões existentes.
- **TypeScript passou**: `node node_modules/typescript/bin/tsc --noEmit`.
- **Build passou**: `npm run build`, cliente e servidor Nitro/Cloudflare.
- **PostgreSQL/PGlite passou**: `tests/instagram-connection-lifecycle-postgres.mjs` usa migrations reais de foundation/RLS, auth mode, Unified Login, Stories, loops e lifecycle. Verifica papéis, isolamento, tokens, rollback com publicação em andamento, cancelamentos, preservação, idempotência, reconexão e grants expirados. Dados e catálogo storage são fixtures locais. Não comprova concorrência de múltiplos servidores de produção.
- **Navegador local passou**: `tests/instagram-guided-browser.mjs`, OAuth interceptado apenas no teste, retorno correlacionado, verificação sem token sem falso sucesso, confirmação/cancelamento da desconexão e persistência após reload. Também preservou testes de bibliotecas, Stories, Reels e responsividade. Não confundir com as evidências reais acima.
- O build público não continha os identificadores de configuração de segredos `INSTAGRAM_TOKEN_ENCRYPTION_KEY`, `META_APP_SECRET` ou `SUPABASE_SERVICE_ROLE_KEY`.

O pacote local `@radix-ui/react-alert-dialog@1.1.15` tinha manifest mas não dist; foi restaurado do pacote oficial npm sem mudar dependências/lock. Nesta instalação `npx tsc` resolveu um pacote homônimo incorreto; usar o compilador local pelo comando acima.

## Execução em ambiente limpo

```powershell
Set-Location 'C:/Users/User/AppData/Local/Temp/00duhot-mouse-hot-v3'
npm ci
node node_modules/typescript/bin/tsc --noEmit
npm test
npm run dev
```

Para integração local, instalar dependências auxiliares e executar navegador e build sequencialmente (compartilham artefatos Vite/Nitro):

```powershell
npm install --prefix C:/Users/User/AppData/Local/Temp/mausehot-pg-intelligence @electric-sql/pglite playwright-core
$env:INTELLIGENCE_PG_TEST_DEPS='C:/Users/User/AppData/Local/Temp/mausehot-pg-intelligence'
node tests/instagram-connection-lifecycle-postgres.mjs
node --experimental-strip-types tests/instagram-guided-browser.mjs
npm run build
```

O teste de navegador usa Chrome no caminho indicado no script. A execução local precisa das configurações públicas do Supabase; consultas reais precisam dos secrets abaixo. Não copiar tokens de produção para fixtures.

## Configuração administrativa

Backend: `APP_BASE_URL`, `META_APP_ID`, `META_APP_SECRET`, `META_GRAPH_API_VERSION`, `META_INSTAGRAM_LOGIN_CONFIG_ID`, `INSTAGRAM_OAUTH_STATE_SECRET`, `INSTAGRAM_TOKEN_ENCRYPTION_KEY` (32 bytes em base64), `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`. Secrets ficam no servidor; nunca em `VITE_*`, código ou logs. O ID de configuração possui fallback somente para o app conhecido desta instalação.

Nenhuma configuração adicional de secret foi necessária neste teste real. O usuário final não copia token ou usa terminal. Para novos perfis fora das funções do app, a aprovação pública da Meta continua sendo uma dependência externa.

## Como conectar e contexto para outro agente

1. Abrir a produção → Conectar nova conta → Conectar Instagram.
2. Escolher Continuar com Instagram, conferir o @ e autorizar na Meta.
3. Aguardar retorno e seguir para a biblioteca exclusiva da conta.
4. Em Contas conectadas → Detalhes e acesso da conta, verificar acesso, reconectar ou desconectar.

O ciclo desta missão está validado com **teresalisbomm**, que terminou **conectada**. A página de contas ficou aberta no navegador interno como resultado. Não pedir login novamente apenas por retomar o chat e não reiniciar testes já concluídos sem novo defeito.

Na retomada de 17/11, o guia de perfil pessoal foi testado localmente, publicado e inspecionado no domínio real. O link abriu o Instagram e as quatro contas permaneceram na lista. A preparação para aprovação foi atualizada em `meta-app-review.md` e `meta-app-review-submission-package.md`; o pedido **não foi enviado**, por verificação empresarial, vídeos reais e informações de operadores ainda pendentes.

Permanecem fora do resultado validado:

- Liberação pública/App Review/Advanced Access e eventual verificação empresarial. O proprietário não tem empresa registrada; não inventar CNPJ, documentos ou garantias de aprovação.
- `guimr__`: convite enviado e pendente, **não aceitar** sem nova autorização específica; o proprietário preferiu outro perfil.
- `jane.caliente`: convite pendente, conexão não concluída. Não atribuir a causa a senha sem prova e nunca abrir recuperação de senha como parte deste fluxo.
- Publicação de mídia da Teresa: não testada nesta missão, biblioteca ainda vazia. O teste realizado foi conexão/leitura/desconexão/reconexão.
