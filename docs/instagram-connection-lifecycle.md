# Instagram: conexão, verificação e desconexão

## Contexto para continuidade — 16/11/2026

Checkout: `C:/Users/User/AppData/Local/Temp/00duhot-mouse-hot-v3`.
Produção: https://mausehot.lovable.app/automacao-instagram.
Lovable: projeto `03560931-5f6a-41e1-a222-0510d1828a23`, banco `fzptbxfyhwypmpfrjlko`.

A missão atual é comprovar o ciclo oficial de conexão. Não alterar outros módulos, recuperar senhas ou publicar Reels apenas para testar login. A conta `_melissaconteudo` tem uma fila ativa que deve ser preservada. Na pré-verificação de produção desta etapa, `morenacoletora` e `jane.coroa` tinham zero posts pendentes/em processamento.

## Método e limites

O botão principal usa **Instagram API with Unified Login**, já configurado nesta instalação. Abre a autorização oficial em popup; o conector local é opcional. Contas suportadas: profissionais Business/Creator. O fluxo usa um portfólio empresarial e não exige uma Página do Facebook. Documentação oficial:

- https://developers.facebook.com/documentation/instagram-platform/instagram-api-with-unified-login/
- https://developers.facebook.com/documentation/instagram-platform/instagram-api-with-unified-login/authentication

O app atual `2201393490722211`, configuração `2579077412515904`, solicita `instagram_basic` e `instagram_content_publish`. Callback: `https://mausehot.lovable.app/api/instagram/oauth/callback`.

Configuração administrativa do backend (nenhum visitante deve preencher estes campos): `APP_BASE_URL`, `META_APP_ID`, `META_APP_SECRET`, `META_GRAPH_API_VERSION`, `META_INSTAGRAM_LOGIN_CONFIG_ID`, `INSTAGRAM_OAUTH_STATE_SECRET`, `INSTAGRAM_TOKEN_ENCRYPTION_KEY` (32 bytes em base64), `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`. Os valores secretos pertencem ao armazenamento de secrets do servidor; não publicar em `VITE_*`, código ou logs. O ID de configuração tem fallback somente para o app já conhecido desta instalação.

O app ainda não tem aprovação pública/Advanced Access. A conexão de uma conta de teste autorizada não comprova onboarding público de clientes SaaS. Ver `meta-app-review.md`. A tentativa com `jane.caliente` não foi concluída: convite pendente e login recusado pelo Instagram; a causa exata não está comprovada. Não repetir recuperação de senha, expressamente cancelada pelo proprietário.

## Implementação desta etapa

- `src/lib/api/instagram-connection.functions.ts`: funções POST autenticadas, autorização por operação e conta. A verificação consulta o perfil na Graph API pelo backend. Token inválido/expirado pede reconexão; falha de rede não é apresentada como revogação.
- `src/lib/instagram-connection-profile.ts`: resposta de identidade validada, foto HTTPS de CDN Meta, erro sanitizado. Consulta limitada a dez segundos; uma única tentativa adicional com campos básicos quando os opcionais forem indisponíveis.
- `src/components/postkit/InstagramConnectionDetails.tsx`: nome/foto quando fornecidos, ID, permissões, datas, verificar, reconectar e desconectar com confirmação.
- `src/routes/automacao-instagram.tsx`: integra os controles às contas existentes sem substituir bibliotecas ou fluxos de Stories/Reels.
- `src/lib/instagram-unified-login.server.ts` e callback: preservam validação de state, identidade do app e permissões; registram `client_business_id` e configuração usados no grant.
- Tokens permanecem AES-GCM no servidor. Unified Login não é enviado ao endpoint de refresh do Instagram Login. A expiração informada pela Meta exige nova autorização quando não existir renovação suportada.

### Banco

`supabase/migrations/20261116235000_instagram_connection_lifecycle.sql` foi **aplicada pelo SQL editor do Lovable Cloud**, com resposta `Query succeeded` nesta etapa. Acrescenta cinco campos de metadados e a RPC `disconnect_instagram_account`.

A RPC desconecta apenas a conta e operação autorizadas: apaga seu token local, marca revogada, cancela posts agendados e lembretes pendentes de Stories, pausa loops, preserva mídia/histórico e outras contas. Recusa a operação se existir post em processamento. Reconectar não restaura automaticamente agendamentos cancelados. Não revoga globalmente um grant da Meta compartilhado por outras contas.

## Verificações

Já executados nesta etapa:

- `node --experimental-strip-types --test tests/*.test.mjs`: **152 passaram**, repetidos após a alteração de texto de erro e guarda SQL de expiração.
- `node node_modules/typescript/bin/tsc --noEmit`: passou.
- `tests/instagram-connection-lifecycle-postgres.mjs`: passou com PGlite usando migrations reais de foundation/RLS, auth mode, Unified Login, Stories, loops e lifecycle. Cobre papéis, isolamento, tokens, rollback de publicação em andamento, cancelamento, preservação, idempotência, reconexão e rejeição de grant expirado. Catálogo storage e registros são exclusivamente fixtures.

- `tests/instagram-guided-browser.mjs`: passou, incluindo autorização oficial interceptada apenas no teste, retorno correlacionado, verificação sem token sem falso sucesso, confirmação/cancelamento da desconexão e persistência após reload. Preservou testes de bibliotecas, Stories, Reels e responsividade.
- Banco de produção: cinco colunas confirmadas; RPC de desconexão negada ao papel anônimo, permitida ao autenticado com validação interna; salvamento de tokens não permitido ao cliente autenticado.

- `npm run build`: passou, gerando cliente e servidor Nitro/Cloudflare.

## Resultado na produção

- Código commit `882a756`, enviado ao `main`; Lovable confirmou **Seu site foi atualizado**.
- A versão publicada exibiu os três perfis existentes e os novos controles.
- Em **16/11/2026 às 22:52 (America/Sao_Paulo)**, o botão **Verificar acesso** de `@morenacoletora` consultou a API oficial com seu grant real. Retornou nome `Noemi santos`, foto e identificador `17841457368026440`, e a interface mostrou **Acesso confirmado pela API oficial da Meta**.
- Após recarregar a aplicação, nome, foto e horário de verificação permaneceram salvos. Não foi necessário copiar tokens, usar terminal ou iniciar o conector.
- Evidência local: `C:/Users/User/AppData/Local/Temp/mausehot-instagram-api-verificada-20261116.jpg` (captura da aplicação publicada, não fixture).
- O botão **Reconectar Instagram** abriu uma nova aba oficial da Meta → **Continuar com o Instagram** → formulário de login do Instagram. Falta o proprietário entrar para concluir **este novo teste OAuth**. Nenhum login foi inventado e nenhuma senha foi alterada.
- A conta real não foi desconectada antes de validar a nova autorização; seu grant existente foi preservado. O ciclo de desconexão/reconexão foi validado com fixtures locais e migrations reais, ainda não repetido integralmente na produção.

**Status da missão completa: AGUARDANDO AÇÃO EXTERNA — NÃO VALIDADO.** A consulta real de perfil e a persistência passaram; o novo teste de autorização e o ciclo completo ao vivo ainda estão pendentes. Não confundir isso com aprovação pública do app pela Meta.

O ambiente local tinha o pacote `@radix-ui/react-alert-dialog@1.1.15` com manifest mas sem `dist`; restaurado do pacote oficial npm, sem alteração de dependências/lock. O compilador funciona via `node node_modules/typescript/bin/tsc`, embora `npx tsc` nesta instalação tenha resolvido um pacote npm homônimo incorreto.

Comandos PowerShell:

```powershell
Set-Location 'C:/Users/User/AppData/Local/Temp/00duhot-mouse-hot-v3'
npm ci
node node_modules/typescript/bin/tsc --noEmit
npm test
$env:INTELLIGENCE_PG_TEST_DEPS='C:/Users/User/AppData/Local/Temp/mausehot-pg-intelligence'
node tests/instagram-connection-lifecycle-postgres.mjs
node --experimental-strip-types tests/instagram-guided-browser.mjs
npm run build
```

O diretório auxiliar deve ter `@electric-sql/pglite` e `playwright-core`; o teste de navegador usa Chrome instalado no caminho indicado no script. Executar navegador e build sequencialmente (compartilham artefatos do Vite/Nitro). Os testes de navegador usam API e dados sintéticos locais, não comprovam autorização da Meta.

## Próximo passo obrigatório / handoff

O navegador interno está aberto: aba 23 aplicação publicada, aba 25 login oficial do Instagram (handoff ao proprietário), aba 24 Lovable. Foi solicitada a entrada de `@morenacoletora` diretamente no Instagram, sem enviar senha/código ao chat. A tentativa OAuth expira em dez minutos; se necessário, cancelar a tentativa antiga pela interface e iniciar novamente, aproveitando a sessão autenticada do Instagram.

Quando o proprietário voltar à aplicação, comprovar a alteração de `connected_at`, `client_business_id` e `login_config_id` da autorização real, consultar novamente o perfil e recarregar. Se a Meta negar um campo, investigar o erro estável sem imprimir tokens, códigos OAuth, cookies ou URLs completas de autorização.

Antes de testar desconexão real, confirmar novamente que esta conta está sem posts em processamento/agendados, loops e Stories pendentes; não tocar em Melissa. Depois testar remoção local do grant e nova autorização pela interface, observando as confirmações exigidas pelo navegador. Se aparecer CAPTCHA, verificação, termos ou novos escopos, solicitar a ação específica do proprietário e deixar a aba interna aberta. Jamais usar recuperação de senha como parte deste fluxo.
