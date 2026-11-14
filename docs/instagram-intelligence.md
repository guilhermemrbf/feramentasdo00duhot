# Instagram Intelligence

No MauseHot, acesse **Instagram Intelligence** e entre com a conta Google. Salve um lote de até 1.000 perfis e selecione uma fonte autorizada. Os relatórios ficam visíveis ao dono do lote.

## Fontes de dados

- **Contas conectadas** consulta as capturas já coletadas pelo Analytics de um espaço do qual você é proprietário. Somente contas conectadas que correspondam aos perfis do lote entram na fila. Uma conta sem métricas fica sem nota de desempenho. A data de captura do lote é distinta da data em que cada métrica foi coletada.
- **Arquivo autorizado** aceita um array JSON de até 1.000 entradas e 4 MB. Cada entrada tem username e snapshot, com capturedAt em UTC, followers opcional e reels. Cada Reel precisa de URL canônica do Instagram com barra final e publishedAt em UTC. Aceita views, likes, comments, shares e saves como inteiros não negativos, ausentes ou nulos. A interface oferece um modelo. Preencha com números obtidos em uma exportação legítima ou fornecidos pelo proprietário. O nome do arquivo é salvo como fonte declarada.
- Os dados usados em cada relatório e as revisões ficam registrados. Uma nova captura pode deixar o perfil em análise novamente e a captura anterior permanece disponível.

## Revisão

O cálculo prioriza a mediana de views, normaliza por seguidores e combina com interação por view e regularidade. A nota final usa 35/25/30/10 e só aparece com os quatro critérios disponíveis. As notas de subnicho, conformidade e qualidade dependem de justificativa de revisão. Os limiares operacionais estão versionados na migration. O relatório preserva a cobertura, as datas e a versão de critérios e políticas.

Na ficha de um Reel, abra o vídeo autorizado no computador e extraia uma amostra com frames iniciais e pontos distribuídos ao longo do arquivo. Registre se examinou o vídeo completo, frames, miniatura ou metadados. Áudio e transcrição podem ser registrados na ficha a partir de material autorizado. Use o Status da Conta informado pelo proprietário somente com evidência. Registre ocorrências com publicação, trecho, regra e justificativa. O risco de recomendação tem avaliação própria.

A IA opcional da ficha usa Ollama no mesmo computador e o modelo qwen3.5:0.8b. Inicie ollama serve e instale o modelo com ollama pull qwen3.5:0.8b. Se a origem da interface for bloqueada, inclua apenas a origem exata do preview em OLLAMA_ORIGINS e reinicie o Ollama. O navegador também pode pedir acesso à rede local. O recurso lê frames selecionados e devolve observações para conferência. As sugestões não determinam notas, conformidade ou aprovação. Apenas as observações anexadas pelo operador são enviadas com a revisão para o MauseHot. Vídeo e frames não vão ao servidor do aplicativo.

A classificação automática multimodal de um lote, a transcrição automática e a consulta direta ao Status da Conta não fazem parte deste fluxo. Perfis sem fonte autorizada permanecem pendentes.

## Operação e testes

Aplique em homologação as migrations de importação e processamento em ordem. O ambiente hospedado precisa do pg_cron e do coletor Analytics já configurado. O agendamento 00duhot-instagram-intelligence roda a cada minuto e processa até 25 tarefas por execução. Falhas transitórias têm até três tentativas com espera crescente. Um ambiente local sem pg_cron pode executar select private.process_instagram_intelligence_jobs(25) como administrador em um banco descartável. Verifique a presença da tarefa em cron.job após a instalação.

Para os testes integrados, instale @electric-sql/pglite e playwright-core em um diretório temporário e aponte INTELLIGENCE_PG_TEST_DEPS para ele. Os scripts usam contas e publicações sintéticas. O teste de navegador exige FFmpeg e Chrome, configurável por INTELLIGENCE_CHROME.

    npm test
    node node_modules/typescript/bin/tsc --noEmit
    npm run build
    node tests/instagram-intelligence-postgres.mjs
    node tests/instagram-intelligence-processing-postgres.mjs

Para o teste de navegador, suba o Vite em 127.0.0.1:4382 com VITE_SUPABASE_URL=http://127.0.0.1:4383 e VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_intelligence_fixture. Em outro terminal, execute node tests/instagram-intelligence-browser.mjs. O teste inicia um adaptador HTTP para o PostgreSQL local e usa uma sessão sintética. Com Ollama disponível, INTELLIGENCE_TEST_OLLAMA=1 também testa a inferência visual real.

## Continuidade do Instagram Intelligence 2.0 — 13/11/2026

A branch `feat/instagram-intelligence-v2` reaproveita o TanStack Start/React, o PostgreSQL do Lovable e o worker SQL existente. O botão **Analisar** cria o lote e agenda na mesma transação as contas próprias com fonte inequívoca. Perfis sem fonte automática continuam no lote e aceitam uma importação autorizada. Em produção, o cron existente roda a cada minuto e teve execução bem-sucedida. A leitura administrativa encontrou uma conexão Facebook Login e uma Unified Login. Nenhuma registrava escopo de Insights e a conexão Facebook não tinha credencial vigente de Analytics.

O adaptador server-side de Business Discovery usa o Graph oficial, lê até quatro páginas de publicações, preserva métricas ausentes e devolve no máximo 30 Reels. As views públicas podem incluir tráfego pago e orgânico e cruzamento com o Facebook. Erros ambíguos retornam indisponibilidade; um erro genérico da Meta não distingue perfil pessoal, privado e inexistente. O adaptador ainda não está ligado ao processamento dos lotes.

Para o diagnóstico real, configure no ambiente do servidor `META_GRAPH_API_VERSION` (referência oficial consultada: v27.0), `INSTAGRAM_DISCOVERY_ACCOUNT_ID` (ID numérico da conta profissional de origem) e `INSTAGRAM_DISCOVERY_ACCESS_TOKEN` (token de usuário autorizado pelo app Meta para a origem). Guarde o token no cofre de segredos, sem prefixo VITE_. Execute `node --experimental-strip-types tests/instagram-intelligence-discovery-live.mjs perfil`. A saída resume cobertura e categoria de erro sem mostrar dados do perfil, token ou URLs temporárias. Valide a credencial com uma conta externa pública Business/Creator e teste Insights separadamente com uma conta própria que concedeu a permissão. As variáveis do diagnóstico precisam ser fornecidas no ambiente que o executar.

Próxima etapa: integrar a fonte externa à fila com lease e retentativas, validar os campos efetivamente retornados pela Meta, persistir a origem dos dados e integrar o worker FFmpeg e o modelo multimodal. O motor atual continua usando revisão explícita para aprovação. Não aplicar a migration de Analisar a um frontend de produção antes de coordenar a publicação do incremento.

Verificação do incremento: 137 testes da suíte, TypeScript, build de produção, dois testes integrados no PostgreSQL e fluxo em Chrome com dados sintéticos passaram. O diagnóstico real interrompeu antes da chamada à Meta porque as variáveis de origem não estavam configuradas. Incremento mantido em branch para continuidade.


A lista de resultados tem filtros com totais por decisão e mostra o motivo disponível em cada perfil. Durante reanálise ou falha, o filtro e o CSV tratam a decisão atual como pendente. A ficha histórica permanece disponível com indicação na lista. A validação no Chrome com PostgreSQL local conferiu a troca de filtros, o motivo e as exportações. TypeScript também passou.
