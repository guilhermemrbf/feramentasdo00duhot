# Hot Profiles — integração Lovable, React e Supabase

## Código e preview

O projeto indicado pelo repositório é [03560931-5f6a-41e1-a222-0510d1828a23](https://lovable.dev/projects/03560931-5f6a-41e1-a222-0510d1828a23), ligado a `guilhermemrbf/feramentasdo00duhot`. O README indica `main` como branch de sincronização. O Lovable sincroniza uma branch por vez; é preciso confirmar no editor se a branch ativa continua sendo `main`.

Alterações mantidas somente na branch do PR não ficam automaticamente disponíveis no preview da main. A integração deve ser feita por merge normal, preservando os commits, sem force push. Depois, conferir o preview dentro do Lovable. Sincronização de código e publicação do site são etapas diferentes; em 27/10/2026 o titular autorizou também a publicação automática pelo Lovable.

Na conferência de 25/10/2026, o acesso inicial ao projeto privado estava bloqueado. Depois de o titular entrar com sua conta, o editor ficou acessível. O PR #14 foi integrado à `main` pelo merge `103ecd95aca5d1a2e23f0af00a788702a50d7756`, preservando o histórico. O editor Lovable mostrou a entrada **Pushed from GitHub — Merge Hot Profiles local desktop and Lovable frontend integration**. A prévia foi atualizada e as rotas local e nuvem foram conferidas dentro do próprio projeto, sem publicação.

## Frontend esperado

- `/hot-profiles`: modo **Meu computador** por padrão, central local de perfis/proxies e botão **Baixar aplicativo Windows**.
- O download central em `src/lib/downloads.ts` aponta para o instalador 0.3.1 experimental da release verificada `hot-profiles-desktop-5-1`; o link não depende de contratar hospedagem ou instalar Node.js no computador do usuário. O Android próprio requer SDK/imagem locais, fora do instalador.
- `/hot-profiles?mode=cloud`: modo **Nuvem** anterior preservado, com seu login e cadastros próprios.
- O site pode controlar o conector tradicional por localhost e pareamento. O aplicativo desktop usa seu próprio painel e canal privado; não permite que o site se conecte automaticamente ao serviço privado do aplicativo. Feche um antes de abrir outro sobre a mesma pasta de dados.
- O aviso de isolamento Android não comprovado permanece visível. A presença de proxy cadastrada não significa bloqueio de conexão direta.

## Backend Supabase

O arquivo `supabase/config.toml` identifica o projeto `fzptbxfyhwypmpfrjlko`. Isso é um identificador de configuração versionado, não prova de acesso ao banco remoto ou de migrações já aplicadas.

O modo nuvem continua usando `src/lib/api/hot-cloud.functions.ts`, `src/lib/hot-cloud.server.ts`, o cliente Supabase gerado e a migração cloud já existente. Nesta entrega, esses módulos, migrações, tabelas, RLS, usuários, segredos e dados não foram alterados. Não há uma nova migração ou Edge Function para publicar o instalador desktop ou o botão de download.

Os perfis, proxies, senhas e sessões do modo local permanecem no PC, em `%LOCALAPPDATA%\00duHot\HotProfiles`. Eles não devem ser enviados ao Supabase para fazer esta integração. Não duplicar o backend local no Supabase, não migrar dados automaticamente e não colocar chave de serviço em variáveis `VITE_*`.

O estado operacional do Supabase remoto (migrações aplicadas, configuração de Auth, RLS e credenciais dos provedores) só pode ser confirmado com acesso autorizado ao ambiente. Ele não foi anunciado como validado a partir da inspeção de código.

No preview real, **Configurar nuvem** respondeu pelo backend e mostrou **Configuração encontrada** para acesso por e-mail e banco de perfis/proxies. Contas autorizadas, proteção das senhas e provedores Browserbase/Genymotion ficaram **A configurar**, como esperado para a execução cloud ainda não ativada. Esse diagnóstico confirma presença de configuração; não comprova consultas ao banco, RLS, login de usuário ou sessões nos provedores. Nenhum desses recursos foi criado, alterado ou contratado nesta conferência.

## Resultado da conferência de 25/10/2026

- 85 testes, TypeScript e build de produção aprovados antes da integração.
- Preview local mostrou **Meu computador**, **Baixar aplicativo Windows** e o destino exato da release verificada `hot-profiles-desktop-1-1`.
- O seletor **Nuvem**, o fluxo de autenticação anterior e o diagnóstico do backend continuaram disponíveis, sem iniciar ambientes pagos.
- O editor indicou **Publish, unpublished changes available**. Nenhuma publicação foi acionada; o site público continua dependendo da ação manual do titular pelo Lovable.
- As capturas de conferência ficaram no diretório local ignorado `.hot-profiles`, sem credenciais, sessões de aplicativos ou dados reais de perfis.

## Atualização de 26/10/2026

O commit `627205c6a2f9884720359d66fea92c0fa6462ab4` foi enviado à main após 88 testes, verificações de tipos e builds. O editor exibiu **Pushed from GitHub — feat(hot-profiles): add owned Android runtime and Windows 0.2.0 prototype**, e sua prévia foi atualizada sem publicar. O novo formulário compartilhado oferece celular próprio do Hot Profiles; o runtime executa no Windows e não no backend Supabase.

A release `hot-profiles-desktop-3-1` aponta para esse commit. Instalador e ZIP foram verificados integralmente por HTTP 200 e SHA-256 antes de atualizar os links centrais do frontend. [Evidências da versão 0.2.0](hot-profiles-desktop-020-validation.md). O modo nuvem, configurações e migrações Supabase foram preservados.

## Conferência no preview Lovable

A atualização de desempenho foi integrada pelo commit `4f71c2316adf3244e5793e7b17c5124f67dcb4a3`, com 92 testes, tipos e builds aprovados. O frontend compartilhado oferece os ajustes somente quando o conector informa suporte; versões antigas mostram orientação de atualização. Vídeo contínuo usa o serviço local autenticado e não passa pelo Supabase. [Release 0.3.0](https://github.com/guilhermemrbf/feramentasdo00duhot/releases/tag/hot-profiles-desktop-4-1) e [evidências](hot-profiles-performance.md). Nenhuma publicação do site ou migração Supabase foi executada.

1. Confirmar o repositório e a branch ativa `main` no Git sync.
2. Abrir `/hot-profiles` no preview e conferir o modo local, o botão do aplicativo e a release de destino.
3. Abrir o seletor Nuvem e confirmar que o fluxo anterior de autenticação/configuração continua presente, sem criar sessões pagas.
4. Conferir o aviso Android e os diagnósticos locais sem abrir contas sociais.
5. Publicar pelo Lovable somente quando o titular decidir. Não executar `supabase db push`, migrações, deploy de funções ou alterações de segredos apenas para atualizar essa interface.

Referências oficiais: [sincronização GitHub](https://docs.lovable.dev/integrations/github) e [publicação de versões](https://docs.lovable.dev/features/publish).


## Publicação de 27/10/2026 — versão 0.3.1

O titular autorizou publicação automática desta vez. O código `f82246f` simplifica cadastro de proxy e orientação de primeiro uso; `7625260` fixa os downloads verificados. Os dois commits apareceram na sincronização GitHub do editor. A prévia foi reconstruída pelo botão Atualizar prévia, exibiu 0.3.1, e a publicação terminou com **Seu site foi atualizado**.

A [página pública Hot Profiles](https://feramentasdo00duhot.lovable.app/hot-profiles) foi aberta após o deploy e mostrou o instalador desktop-5-1. O conector tradicional também foi atualizado para local-6-1. [Testes, hashes e limites da entrega](hot-profiles-031-validation.md). As observações anteriores de publicação manual acima são registros históricos e foram substituídas pela autorização desta entrega. Nenhuma migração ou credencial Supabase foi modificada.
