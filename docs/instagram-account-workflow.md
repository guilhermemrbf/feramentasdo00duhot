# Automatic Post por conta

- Rota de produção: https://mausehot.lovable.app/automacao-instagram
- A visão geral distingue os totais da operação do recorte selecionado e destaca cada publicação da fila com perfil, data, horário e situação.
- Em **Contas conectadas**, abra o perfil para acessar a biblioteca, agendar Reels, configurar Stories ou ver resultados desse perfil. O agendamento segue Vídeos → Legenda e capa → Dias e horários → Revisão. O envio de Reels e a biblioteca de Stories continuam independentes.
- **Resultados** mostra a cobertura por perfil. Uma métrica sem leitura fica em branco. As visualizações são acumuladas para as publicações selecionadas, e o período filtra pela data da publicação.
- **Melhores publicações** usa os Reels publicados nos últimos 30 dias. A ordem é curtidas + comentários, com visualizações como primeiro desempate. Reels sem visualizações podem entrar no ranking quando curtidas e comentários estiverem disponíveis.

## Operação e continuidade

Aplique a migration 20261119170000_instagram_rank_reels_by_engagement.sql antes de publicar a interface. Ela atualiza duas funções existentes e preserva as permissões de leitura por operação. Em 19/11/2026 foi executada no SQL Editor do Lovable e conferida pela definição das funções e pela ausência de acesso anônimo ao ranking.

O diagnóstico inicial da operação mostrou quatro contas sem o escopo instagram_manage_insights. No Unified Login, inclua esse escopo na configuração oficial, no nível de acesso adequado, e obtenha nova autorização das contas para habilitar Insights. Para perfis do Facebook Login, a ação **Autorizar métricas** usa o fluxo oficial existente. A autorização para publicar é separada. A integração funciona com dados oficiais da Meta e não utiliza valores estimados.

As tentativas feitas pelo coletor retornam catalogError, graph e profileGraph quando disponíveis. Esses campos contêm categorias e códigos, sem conteúdo da Meta, IDs de perfis ou credenciais. A resposta do coletor está disponível no histórico interno do job Analytics. Se seguidores ou métricas continuarem ausentes, consulte a cobertura para identificar onde a aquisição parou, em vez de preencher zeros.

## Verificação local

- npm run build
- node ./node_modules/typescript/bin/tsc --noEmit
- npm test
- node tests/instagram-engagement-postgres.mjs
- node tests/instagram-reviewed-schedule-postgres.mjs
- node tests/instagram-guided-browser.mjs

Os três últimos testes usam dados de teste. Instale PGlite e playwright-core em um diretório auxiliar e defina INTELLIGENCE_PG_TEST_DEPS para esse diretório. O teste de navegador usa Chrome instalado no caminho padrão do Windows. O conector Hot Profiles pode acusar uma divergência de finais de linha no README dentro do ZIP distribuído. A divergência já existia antes das alterações no Automatic Post.
