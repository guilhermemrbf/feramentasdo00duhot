# Hot Profiles — integração Lovable, React e Supabase

## Código e preview

O projeto indicado pelo repositório é [03560931-5f6a-41e1-a222-0510d1828a23](https://lovable.dev/projects/03560931-5f6a-41e1-a222-0510d1828a23), ligado a `guilhermemrbf/feramentasdo00duhot`. O README indica `main` como branch de sincronização. O Lovable sincroniza uma branch por vez; é preciso confirmar no editor se a branch ativa continua sendo `main`.

Alterações mantidas somente na branch do PR não ficam automaticamente disponíveis no preview da main. A integração deve ser feita por merge normal, preservando os commits, sem force push. Depois, conferir o preview dentro do Lovable. Sincronização de código e publicação do site são etapas diferentes; a publicação permanece manual, pelo titular na Lovable.

Na conferência de 25/10/2026, o navegador disponível retornou **You don't have access** para o projeto privado. Isso não confirma falha de sincronização nem autoriza afirmar que o preview foi validado. É necessário entrar com uma conta que tenha acesso ao projeto para conferir o preview real.

## Frontend esperado

- `/hot-profiles`: modo **Meu computador** por padrão, central local de perfis/proxies e botão **Baixar aplicativo Windows**.
- O download central em `src/lib/downloads.ts` aponta para o instalador 0.1.0 da release verificada `hot-profiles-desktop-1-1`; o link não depende de contratar hospedagem ou instalar Node.js no computador do usuário.
- `/hot-profiles?mode=cloud`: modo **Nuvem** anterior preservado, com seu login e cadastros próprios.
- O site pode controlar o conector tradicional por localhost e pareamento. O aplicativo desktop usa seu próprio painel e canal privado; não permite que o site se conecte automaticamente ao serviço privado do aplicativo. Feche um antes de abrir outro sobre a mesma pasta de dados.
- O aviso de isolamento Android não comprovado permanece visível. A presença de proxy cadastrada não significa bloqueio de conexão direta.

## Backend Supabase

O arquivo `supabase/config.toml` identifica o projeto `fzptbxfyhwypmpfrjlko`. Isso é um identificador de configuração versionado, não prova de acesso ao banco remoto ou de migrações já aplicadas.

O modo nuvem continua usando `src/lib/api/hot-cloud.functions.ts`, `src/lib/hot-cloud.server.ts`, o cliente Supabase gerado e a migração cloud já existente. Nesta entrega, esses módulos, migrações, tabelas, RLS, usuários, segredos e dados não foram alterados. Não há uma nova migração ou Edge Function para publicar o instalador desktop ou o botão de download.

Os perfis, proxies, senhas e sessões do modo local permanecem no PC, em `%LOCALAPPDATA%\00duHot\HotProfiles`. Eles não devem ser enviados ao Supabase para fazer esta integração. Não duplicar o backend local no Supabase, não migrar dados automaticamente e não colocar chave de serviço em variáveis `VITE_*`.

O estado operacional do Supabase remoto (migrações aplicadas, configuração de Auth, RLS e credenciais dos provedores) só pode ser confirmado com acesso autorizado ao ambiente. Ele não foi anunciado como validado a partir da inspeção de código.

## Conferência no preview Lovable

1. Confirmar o repositório e a branch ativa `main` no Git sync.
2. Abrir `/hot-profiles` no preview e conferir o modo local, o botão do aplicativo e a release de destino.
3. Abrir o seletor Nuvem e confirmar que o fluxo anterior de autenticação/configuração continua presente, sem criar sessões pagas.
4. Conferir o aviso Android e os diagnósticos locais sem abrir contas sociais.
5. Publicar pelo Lovable somente quando o titular decidir. Não executar `supabase db push`, migrações, deploy de funções ou alterações de segredos apenas para atualizar essa interface.

Referências oficiais: [sincronização GitHub](https://docs.lovable.dev/integrations/github) e [publicação de versões](https://docs.lovable.dev/features/publish).
