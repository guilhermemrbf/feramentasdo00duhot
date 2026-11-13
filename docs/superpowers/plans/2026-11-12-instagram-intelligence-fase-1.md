# Instagram Intelligence — Fase 1

> Implementação direta com Superpowers. A entrega termina na validação da arquitetura e do fluxo de importação.

O MauseHot já usa React, TanStack Start, Supabase e login Google. A nova rota usa o mesmo catálogo e sessão. Duas tabelas novas armazenam lotes privados e seus perfis, com ordem de importação e horário de cadastro. O navegador valida e mostra uma prévia; uma função SQL valida de novo e grava tudo em uma transação. As tabelas permitem leitura do próprio usuário por RLS e a função é o único caminho de gravação para usuários autenticados.

Manter a implementação no stack existente reduz integrações nesta fase. A Fase 2 poderá adicionar tarefas e capturas com limites próprios, vinculadas ao lote e ao perfil. Os adaptadores futuros devem distinguir fonte pública autorizada, Insights de contas autorizadas e dados entregues pelo proprietário. O Status da Conta, conteúdo, métricas, notas e decisões ficam fora do fluxo desta fase. Um perfil cadastrado é apenas um identificador, sem confirmação de existência.

## Execução e validação

1. **Importação.** Criar testes antes do parser para links de perfil, nomes, duplicatas, URLs inválidas e limite de 1.000. Preservar ordem, ignorar parâmetros de compartilhamento e nunca buscar URLs durante a importação. Rejeitar toda a entrada quando houver inválidos ou quando passar do limite; mostrar onde corrigir.
2. **Banco.** Criar migration isolada e teste SQL da transação, limite, RLS, usuários anônimos, gravadores diretos e isolamento entre donos. Validar em PostgreSQL local sem credenciais de produção.
3. **Tela.** Integrar rota, catálogo, botão Google, formulário com prévia, lista de lotes e perfis paginados. Exibir mensagens reais de erro e estado vazio. Verificar catálogo, build e fluxo no navegador. Concluir com revisão independente e commit.

## Critérios da próxima fase

- Nenhum lote de teste usa perfis de clientes, tokens ou credenciais reais.
- A integração hospedada requer aplicação da migration e validação da sessão Google no ambiente de destino.
- A coleta e a análise ficam para a próxima fase após a validação desta arquitetura.
- Diretrizes da Comunidade, recomendações, propriedade intelectual e permissões de API serão fontes versionadas e separadas. A [Meta distingue conteúdo permitido e elegibilidade para recomendações](https://about.fb.com/br/news/2020/08/publicando-nossas-diretrizes-de-recomendacoes/). Verificar permissões concretas de cada adaptador antes de ativar a coleta.

## Como validar localmente

```powershell
$intelligencePg = Join-Path ([IO.Path]::GetTempPath()) 'mausehot-pg-intelligence'
npm install --prefix $intelligencePg --no-audit --no-fund @electric-sql/pglite@0.5.16
$env:INTELLIGENCE_PG_TEST_DEPS = $intelligencePg
node tests/instagram-intelligence-postgres.mjs
node --experimental-strip-types --test tests/instagram-intelligence-import.test.mjs tests/workspace-redesign.test.mjs
npm run build
```

O teste SQL executa a migration em PostgreSQL local via PGlite. As funções de sessão do Supabase são representadas por funções de teste, com papéis distintos e usuários sintéticos. Uma restrição inserida apenas no teste força uma falha depois da criação do lote e comprova que a gravação inteira é revertida. O teste não exige credenciais, servidor Docker, rede com a Meta ou banco hospedado.

### Decisões da Fase 1

- O acesso é individual por dono. Compartilhar lotes em equipes exigirá um vínculo e regras próprias quando fizer parte do escopo.
- A função SQL usa `SECURITY DEFINER`, com `search_path` vazio e dono obtido da sessão. As tabelas bloqueiam gravações diretas para garantir que toda importação valide o tamanho e grave uma lista completa.
- O login Google é o que já existe no MauseHot. A fase não adiciona provedor de identidade, infraestrutura de filas ou acesso externo à mídia.
