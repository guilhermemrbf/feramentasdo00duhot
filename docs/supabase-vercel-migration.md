# Migração do MouseHot para Supabase e Vercel

O GitHub continua como fonte do aplicativo. A Vercel hospeda TanStack Start, o SSR e as rotas HTTP. O projeto independente do Supabase mantém PostgreSQL, Google Auth, Storage e os agendadores. Os vídeos continuam no bucket privado do Supabase e são enviados diretamente pelo navegador.

## Preparação da homologação

1. Crie ou selecione um projeto de homologação do Supabase na organização administrada pelo titular. Use esse projeto para o primeiro ensaio e somente contas de teste.
2. Instale as migrações em um banco vazio. A migração `20261110165000` traz para a sequência Supabase uma coluna que antes existia só em Drizzle. Em um banco já usado, examine o catálogo e o histórico antes de aplicar SQL ou reparar o registro de migrações. Não reaplique toda a sequência sobre um dump que já contenha o esquema.
3. No projeto Supabase, habilite Google Auth. No Google Cloud, registre o callback fornecido pelo Supabase de homologação, no formato `https://<projeto>.supabase.co/auth/v1/callback`. Configure o Site URL e a lista de redirecionamentos do Supabase para o host da aplicação de homologação. Use a origem exata do host para o Automatic Post e o Instagram Intelligence. O SDK troca o código usando PKCE.
4. Vincule o repositório na Vercel e selecione a branch da migração para a homologação. Configure as variáveis abaixo no ambiente correspondente. O build da Vercel exige a configuração explícita do Supabase do destino e um `APP_BASE_URL` HTTPS. O domínio e as URLs canônicas de privacidade e exclusão vêm dessa origem.
5. Em um app Meta de teste, registre o callback da aplicação em `<APP_BASE_URL>/api/instagram/oauth/callback` com a mesma origem. Teste o login Google, a retomada da sessão, o vínculo Instagram, bibliotecas privadas de Reels e Stories, um upload, o agendamento e uma publicação autorizada. Use uma conta de teste e verifique que duas operações não leem arquivos ou publicações uma da outra.

### Variáveis na Vercel

| Variáveis                                                          | Uso                                                                                                                                                                                           |
| ------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `VITE_SUPABASE_URL` e `SUPABASE_URL`                               | Mesma URL explícita do projeto de destino.                                                                                                                                                    |
| `VITE_SUPABASE_PUBLISHABLE_KEY` e `SUPABASE_PUBLISHABLE_KEY`       | Mesma chave pública do projeto de destino.                                                                                                                                                    |
| `SUPABASE_SERVICE_ROLE_KEY`                                        | Chave de servidor do destino, armazenada como segredo.                                                                                                                                        |
| `APP_BASE_URL`                                                     | Origem HTTPS da aplicação. Use uma origem estável por ambiente.                                                                                                                               |
| `META_GRAPH_API_VERSION`                                           | Versão configurada da Graph API, de acordo com o modo de login utilizado.                                                                                                                     |
| `INSTAGRAM_OAUTH_STATE_SECRET`                                     | Segredo aleatório de assinatura do estado OAuth, separado entre ambientes.                                                                                                                    |
| `INSTAGRAM_TOKEN_ENCRYPTION_KEY`                                   | Chave em base64 de 32 bytes. No destino final, é necessária a chave original para decifrar registros copiados. Na homologação use chave separada e dados de teste, sem tokens reais copiados. |
| `META_APP_ID`, `META_APP_SECRET`, `META_INSTAGRAM_LOGIN_CONFIG_ID` | App da plataforma para as operações legadas. Cadastre o novo callback antes da virada.                                                                                                        |
| `VITE_CLOUDINARY_CLOUD_NAME`, `VITE_CLOUDINARY_UPLOAD_PRESET`      | Cloud e preset público de upload do Image Links. Use os valores do provedor do ambiente.                                                                                                      |
| `VITE_TEMP_MAIL_URL`                                             | URL da implantação do Correio Temporário, quando disponível.                                                                                                                                  |

Mantenha segredos do servidor em variáveis sem `VITE_`. Revise demais variáveis usadas pelos módulos ativos em `.env.example`. Ambientes de homologação usam recursos independentes. O código usa Google Auth nativo do Supabase com PKCE. Use o preset Nitro da Vercel no deploy.

Publique um novo deploy depois de salvar variáveis de produção. Na Visão geral do Automatic Post, um vínculo com o app da plataforma e uma configuração de servidor incompleta indicam que o cadastro da operação existe, mas falta configuração no deploy ativo. Confira as três variáveis Meta no ambiente de Produção e teste se **Conectar Instagram** abre a tela oficial de autorização.

### Agendadores do Automatic Post

Depois de aplicar `20261120150000` e `20261120153000`, configure o destino pelo SQL Editor, como operador do banco. Substitua a origem pelo endereço HTTPS do projeto implantado.

```sql
select private.configure_instagram_worker_destination('https://host.exemplo');
select jobname, active from cron.job
where jobname in ('00duhot-instagram-worker', '00duhot-instagram-analytics');
```

A primeira chamada configura os dois jobs pausados e impede a ativação pelo botão do aplicativo. Quando o destino estiver pronto para publicar, habilite:

```sql
select private.configure_instagram_worker_destination('https://host.exemplo', true);
```

O destino gera a autorização de execução no próprio Vault quando necessário. Para verificar a saúde, confira os status dos dois jobs, as respostas HTTP e o resultado de um Reel de teste. Certifique-se de que a Vercel permite que as chamadas do Supabase cheguem à rota do worker, mantendo a autenticação da aplicação. Em um ambiente de homologação, use dados e credenciais de teste.

## Transferência da operação existente

1. **Origem.** Reative o banco do Lovable e exporte o banco completo e os objetos dos buckets pelo fluxo oficial. Verifique a disponibilidade da chave original de criptografia do Instagram em seu gerenciador de segredos. Sem ela, usuários podem ter de reconectar as contas e redigitar segredos de apps Meta. Não envie arquivos ou segredos pelo chat.
2. **Restauração.** Ensaiar em destino separado preservando IDs de usuários e dados, relações, políticas de acesso e os caminhos dos objetos. Reconstrua os buckets privados conforme as políticas. Use um restore coordenado com o histórico de migrações. Inventarie o cron e o Vault. Recrie as autorizações de worker no destino. Exclua do restore a linha de `private.instagram_worker_auth` que aponta para o Vault antigo e a configuração de destino anterior, se estiver presente.
3. **Legado.** No primeiro deploy, a migração `20261120100000` marca as operações que já têm token na hora da aplicação. Se o esquema destino já estiver montado e o dump da origem anteceder essa migração, após importar os dados faça o backfill abaixo. Compare o total com as operações que tinham conexões no snapshot. Se a origem já tiver essa migração, migre a tabela de configuração original.

```sql
insert into public.instagram_workspace_apps(workspace_id)
select distinct a.workspace_id
from public.instagram_accounts a
join public.instagram_tokens t on t.account_id = a.id
on conflict (workspace_id) do nothing;
```

4. **Conferência.** Na cópia, confira contagens de usuários, operações, contas e publicações. Compare objetos de Storage e seus caminhos e valide uma sessão autorizada com as regras de acesso existentes. Para testar a cópia sem disparar a fila real, mantenha a publicação em pausa. Use dados e credenciais de teste para o ensaio completo de publicação.
5. **Virada.** Planeje uma janela sem gravações, pause os jobs antigos e deixe terminar as publicações em andamento. Reconcilie as linhas em processamento com a Meta antes de executar no destino. Faça a última cópia de dados e arquivos. Depois de conferir o DNS, os callbacks e a conexão ao destino, habilite somente os jobs novos. Mantenha a origem para recuperação e confirme uma primeira publicação no destino. Após a virada, voltar exige reconciliar as mudanças já gravadas no Supabase novo.

O endereço `mausehot.lovable.app` pertence ao provedor anterior. O alias pretendido no novo projeto é `mausehot.vercel.app`. Confirme a atribuição na Vercel e configure login e callbacks da Meta para o endereço atribuído. Mantenha a origem como referência de recuperação durante a homologação.

### Estado do destino

O projeto Supabase `mausehot` (`hibuqeckyklnfjawztzf`, São Paulo) recebeu 34 migrações. A aplicação usa o domínio `mausehot.vercel.app` e o login com Google retornou à plataforma. Na verificação de 21/11/2026, havia uma operação administrativa com o vínculo de plataforma restaurado, zero contas de Instagram, zero publicações e zero itens de mídia. A recuperação dos registros e arquivos históricos depende da exportação da origem. Antes de executar a fila, verifique o estado atual dos jobs e conclua o teste real com uma conta autorizada.

## Verificação da publicação

1. Confirme o domínio associado ao projeto Vercel, o commit publicado e o estado `Ready`. O perfil Hobby é voltado a uso pessoal e não comercial. Para disponibilizar o SaaS comercial, use um plano que comporte esse uso.
2. No domínio novo, abra as ferramentas do catálogo e confirme que elas carregam. O teste `node --experimental-strip-types tests/vercel-build-smoke.mjs` usa a função gerada e valida também os redirecionamentos, os assets e os limites de autenticação.
3. Valide as operações que dependem de serviços externos: autenticação Google, OAuth da Meta, envio ao Cloudinary, publicação de um Reel de teste, métricas e armazenamento privado. O Correio Temporário tem implantação própria. Ferramentas Windows e a extensão Chrome exigem seu ambiente local para teste funcional.

## Referências

- [Exportação e migração do Lovable](https://docs.lovable.dev/tips-tricks/external-deployment-hosting)
- [Implantação do TanStack Start na Vercel](https://vercel.com/kb/guide/deploy-a-tanstack-start-app-to-vercel)
- [Backup e restauração do Supabase](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore)
