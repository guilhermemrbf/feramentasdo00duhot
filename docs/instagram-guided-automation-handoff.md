# Continuidade — Instagram unificado
Atualizado: 2026-11-13. Ainda em desenvolvimento, NÃO publicado.

## Onde
Checkout: C:/Users/User/AppData/Local/Temp/00duhot-mouse-hot-v3
Branch: feat/instagram-guided-automation, base origin/main 678feed.
Plano: docs/superpowers/plans/2026-11-13-instagram-guided-automation.md
Ledger: .superpowers/sdd/2026-11-13-instagram-guided-automation/progress.md

## Pedido
Conexão de Instagram em Chrome isolado por tentativa, unificar Hot Profiles e Automate Post; biblioteca separada por conta, legenda/hashtags/capa/1–10 horários por dia, revisar Stories antes de ativar. Não publicar conteúdo real durante testes. Sem perguntas de rotina. Manter continuidade para outro agente.

## Feito, ainda sem commit
- Lido PDF: criação/configuração de contas, 10 Reels + 1 Story com link + 1 post/dia. Implementação segue pedido de conectar contas existentes. Não constrói signup automático.
- FreeLLMAPI ask e health falharam localhost:31415; seguir sem esse serviço.
- Conector POST /v1/instagram-login validado por origem/token, perfil Chrome único visível, cookie OAuth temporário; sem copiar sessão do app ou Instagram.
- Dois testes login RED→GREEN, um teste revisão RED→GREEN.
- Novo RPC SQL para validar conta/mídia/Stories/limite diário e inserir fila atomicamente.
- Cards de passos e revisão na interface; dependem de testes e refinamentos.

## Próximo
1. Compilação TS em execução, corrigir erros.
2. Validar SQL PGlite usando deps C:/Users/User/AppData/Local/Temp/mausehot-pg-intelligence. Atenção: has_workspace_role usa workspace_role[], status posts enum, ambos precisam casts corretos.
3. Testar Chrome real só com fixture localhost, verificar cookie OAuth e isolamento; nenhuma conta real.
4. E2E UI com mocks, suíte completa, build, gerar public/hot-profiles-connector.zip.
5. Revisão independente de branch conforme executing-plans, corrigir importantes.
6. Commit, GitHub e deploy Lovable autorizados previamente, sem usar chat Lovable. Aplicar nova migration só após passar nos testes. Não declarar produção pronta antes de verificar.

## Decisões
Manter object storage existente, sem migrar para Drive. Stories com link continuam preparo e lembretes manuais; não dizer que link clicável publica via API. Usar novo contexto por login, uma janela por vez, fechar antes da próxima. Não tocar em sessões pessoais.

## Validação intermediária
- 133/133 testes da suíte passaram fora do sandbox (servidores locais). TypeScript e build passaram.
- SQL PGlite: gate, mídia de outra conta, Stories de outra conta, idempotência, limite e histórico em outros dias passaram. Casts dos enums corrigidos.
- Chrome real: dois perfis descartáveis, cookie OAuth presente e cookie da conta anterior ausente, sem tocar navegador pessoal.
- E2E encontrou gate de worker consultado apenas na aba Configurações; corrigido para consultar também ao abrir Agendar Reels, aguardando nova execução.
