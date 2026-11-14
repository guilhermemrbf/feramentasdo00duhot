# Interface acessível — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** tornar todas as ferramentas web mais fáceis de reconhecer e usar em vermelho, preto e branco.
**Architecture:** tokens globais + componentes compartilhados, catálogo central como fonte dos textos, ajustes pontuais nos fluxos existentes.
**Tech Stack:** React 19, TanStack, Tailwind 4, Radix, Lucide; testes Node e Chrome.
**Spec:** docs/superpowers/specs/2026-11-14-interface-acessivel-design.md

## Global Constraints
- Não alterar backend, auth, banco, IDs de ferramentas, rotas ou arquivos gerados.
- Preservar cores semânticas, pesos e organização simples do Intelligence.
- Não instalar dependências; testes de navegador usam playwright-core existente via INTELLIGENCE_PG_TEST_DEPS.
- Contexto de continuidade em docs/interface-acessivel-handoff.md.

## Review Focus
- Texto vermelho em fundos escuros e texto branco em botões: contraste >= 4.5 (Task 1).
- Seleção de datas/menus sem depender de hover; teclado e popup mobile (Task 1).
- Busca, favoritos e URLs existentes preservados, nenhum botão morto (Task 2).
- Mobile 360px sem overflow, nomes longos e menu acessível (Task 2).
- Agendamento e Intelligence preservam validações; nenhuma mudança de pontuação (Task 3).

### Task 1: Tema e controles compartilhados
**Files:** src/styles.css; classes text-brand-red nos componentes e rotas existentes; src/components/ui/button.tsx, tabs.tsx, select.tsx, calendar.tsx; tests/interface-accessibility-browser.mjs; tests/fixtures/interface-controls.tsx
**Interfaces:** tokens --primary/--primary-foreground para ações; --primary vermelho escuro para ações; --brand-red vermelho claro para textos. Preservar props dos controles.
- [x] Teste de navegador em fixture: contraste AA, botões >=44px, calendário/seletores visíveis, teclado funcional. Executar antes de alterar (Expected: FAIL contraste/tamanho).
- [x] Implementar tema preto neutro, branco e vermelho, bordas/foco/hover/seleção distintos. Aplicar tokens sem sobrescrever canvas ou mídia.
- [x] Executar teste (Expected: PASS), TypeScript (Expected: exit 0) e commit.

### Task 2: Catálogo e navegação orientados a tarefas
**Files:** src/lib/tool-catalog.ts; src/components/AppShell.tsx; src/routes/index.tsx; testes de navegador da Task 1.
**Interfaces:** campo action no catálogo; TOOL_ICONS continua único; PageIntro usa ícone do catálogo e guia em 3 passos.
- [x] Testar busca por tarefa, link com ação específica e ícone, favoritos, menu mobile (Expected: FAIL novo texto).
- [x] Aplicar títulos simples, cartões e cabeçalhos com pictogramas por função, instruções diretas e área de busca visível.
- [x] Executar testes web e catálogo (Expected: PASS); commit.

### Task 3: Ferramentas, verificação e entrega
**Files:** src/routes/*.tsx afetadas; src/components/postkit/ReelCaptionFields.tsx, ReelTimingFields.tsx, DailyTimeSlots.tsx; docs/interface-acessivel-handoff.md; docs/frontend-guidelines.md.
**Interfaces:** não alterar callbacks nem contratos; todas as telas recebem tokens Task 1 e catálogo Task 2.
- [x] Auditar todas as rotas; validar contraste e largura no navegador, incluindo tela única Intelligence e formulários (Expected: PASS após ajustes).
- [x] Remover dourado fixo do Intelligence, simplificar linguagem e reforçar hierarquia do agendamento; preservar significado de status.
- [x] Rodar npm test, npx tsc --noEmit, npm run build, testes guiados/Intelligence e teste visual (Expected: todos exit 0).
- [x] Revisão independente da branch, corrigir achados importantes, documentar limites e contexto. Commit e integração/publicação acompanhados em docs/interface-acessivel-handoff.md; entrega remota ainda pendente nesta revisão local.
