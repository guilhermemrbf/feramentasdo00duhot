# Instagram Intelligence — Processamento e relatórios

O módulo usa a rota React, a sessão Google e o PostgreSQL do MauseHot. O coletor de Analytics existente fornece métricas oficiais das contas conectadas às quais o operador tem acesso. A importação de JSON oferece uma segunda fonte autorizada e pede a confirmação de autorização e registra o nome do arquivo e a data de captura.

- [x] Testar e implementar fila persistente com tarefas por perfil, lotes de execução limitados, retentativas e isolamento por dono. Capturar somente contas conectadas dos espaços autorizados pelo operador.
- [x] Validar importação com métricas opcionais e manter capturas imutáveis. Usar a janela inicial de 30 dias e expandir até 90 dias quando houver menos de 20 Reels recentes, com limite de 30.
- [x] Calcular indicadores, notas fixas e decisão no banco. Exigir justificativas, evidência e revisão explícita. Separar diretrizes da comunidade de recomendação e preservar a versão das regras.
- [x] Integrar status da fila, fontes, ranking, revisão individual, relatório e exportações na rota. Exibir lacunas de coleta e cobertura.
- [x] Verificar SQL PostgreSQL, casos A–H, lote de 1.000, build e suíte. Revisar a branch e registrar o que depende de validação com contas reais.

A execução hospedada usa pg_cron, já adotado no módulo de Analytics. Cada execução processa uma quantidade limitada de tarefas com SKIP LOCKED, sem chamadas HTTP durante a transação. O relatório registra o material efetivamente disponível. Um conector de vídeo ou IA só pode constar como fonte efetiva depois de implementado e validado.

Testes executados com PostgreSQL local e Chrome usando dados sintéticos. A revisão independente levou a testes adicionais de recorrência, captura antiga, retentativas e acesso a relatórios após falha. A validação da coleta real e do pg_cron em Lovable continua sendo uma etapa de homologação.
