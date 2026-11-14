# Instagram Intelligence — tela única

Base: 92c8bfe, branch feat/instagram-intelligence-v2. Referências visuais: as duas imagens enviadas em 14/11.
1. No teste Chrome/PGlite, validar deduplicação, contadores, cartões e pesos, recarga e viewport móvel. Esperado antes da mudança: ausência do título novo.
2. Em instagram-intelligence.tsx e IntelligenceBatch.tsx, substituir os controles de lote por entrada única, progresso, dois grupos e modelo fixo. Reusar RPCs existentes. Renderizar dados nulos como indisponíveis e nunca reaproveitar aprovação antiga para tarefa em execução.
3. Rodar navegador, suíte completa, TypeScript e build. Revisar o incremento e registrar limitações no guia.
Ruling: recuperar o lote mais recente ao recarregar. O histórico segue persistido; histórico navegável deixaria a tela maior.
Ruling: manter importação e revisão no backend, fora da tela principal. Consultas externas e revisão audiovisual automática ainda não estão conectadas. Sem fonte, a ficha explica por que não houve aprovação.

Revisão independente: recuperado o painel de revisão existente por ?modo=revisao. O fluxo principal não ganha controles. A contagem de processados exclui falha e ausência de fonte e a tela continua consultando lotes sem fonte a cada 30 segundos. O limite de altura das listas mantém a tabela de pesos alcançável.
Ruling: perfis sem fonte entram em Não aprovados com motivo explícito, mas não são contados como analisados; podem mudar de grupo se surgirem dados.
Ruling: modo de revisão na mesma rota para preservar importação, fichas detalhadas, revisão e exportação; operadores precisam conhecer o link do guia.
Verificação: Chrome/PGlite passou desktop, celular, recarga, polling, deduplicação, acesso à revisão e notas ausentes; TypeScript e suíte 137/137 passaram.
Build de produção aprovado. Revisão independente e correções verificadas; integração preservada na branch da versão 2.0.
