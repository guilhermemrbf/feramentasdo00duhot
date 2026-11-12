# Download sequencial no Mouse Hot

> Use superpowers:subagent-driven-development para executar cada tarefa com revisão.

**Objetivo:** baixar um arquivo por vez e mostrar os demais aguardando, com continuidade quando um item falhar.

**Arquitetura:** a fila persistente do service worker controla a única transferência ativa. A seleção e a identificação das mídias continuam no fluxo da extensão. Um teste no Chrome observa a ordem real das transferências, além dos arquivos finais.

**Stack:** JavaScript, Chrome Manifest V3, Chrome Downloads API e Node.js.

**Requisito:** relato do usuário em 12/11/2026. A versão 3.0.4 permitia duas transferências simultâneas por desenho, confirmado no código e no teste que exigia pico de duas. Isso não identifica a causa de todos os vídeos falharem no computador do usuário.

## Global Constraints

- No máximo uma transferência ativa na fila de mídia, inclusive quando se tenta retomar uma transferência pausada.
- Itens que ainda não começaram aguardam na fila persistente. Um item terminal com falha ou cancelado libera a próxima transferência.
- Um item pausado ocupa sua vez até retomada ou cancelamento. Uma falha temporária programada pode dar passagem a outro item disponível.
- Preservar as permissões, a verificação da assinatura dos arquivos e as restrições de acesso às origens de mídia.
- Entregar ZIP instalável da extensão em versão 3.0.5. Nenhum serviço externo novo.

## Review Focus

- Limite em execução, retomada manual, falhas consecutivas e recuperação ao reabrir o Chrome.
- Como um item falho aparece na fila e se ele deixa os próximos avançarem.
- Prova de que os vídeos são MP4s completos e de que o teste anterior realmente violava a nova regra.

### Task 1: Aplicar a fila sequencial

**Files:** `apps/mouse-hot-downloader/src/background/queue-manager.js`, `apps/mouse-hot-downloader/tests/queue-manager.test.mjs`.

**Interfaces:** preservar `makeQueue(notify)` e os métodos públicos. `start` e `changed` continuam iniciando trabalho, e `act` continua pausando, cancelando e retomando.

- [x] Criar testes de fila com a API Chrome simulada. Com três itens, o primeiro permanece em progresso, os demais ficam em `queued`. Depois de falha terminal do segundo, o terceiro inicia. Um item pausado mantém sua vez, inclusive após chamadas repetidas a `start`, e a retomada respeita qualquer transferência ativa. Provar que mais de quatro verificações consecutivas com falha não dependem da próxima execução periódica.
- [x] Executar `node --test tests/queue-manager.test.mjs` na extensão. Esperado antes da mudança: duas transferências são iniciadas na mesma janela e/ou o quinto item não é processado automaticamente.
- [x] Aplicar limite de uma transferência, atualizar o erro de retomada e retomar trabalho pendente após o limite de verificações por execução, com recuperação pelo alarme existente.
- [x] Rodar `npm test`, conferir `git diff --check` e registrar commit da tarefa com os arquivos de fila.

### Task 2: Provar a ordem no Chrome e empacotar

**Files:** `apps/mouse-hot-downloader/tests/chrome-e2e.mjs`, `src/panel/panel.js`, `manifest.json`, `package.json`, `package-lock.json`, `README.md` da extensão.

**Interfaces:** consome a fila da tarefa 1 sem mudar suas interfaces. O teste usa a seleção do perfil, observa a fila enquanto o primeiro MP4 está incompleto e compara os bytes salvos.

- [x] Adaptar o teste de pico para o novo limite e acrescentar um lote com primeiro MP4 lento, falha no segundo e terceiro MP4 válido. No build antigo, a regressão deve acusar mais de uma transferência ativa. Confirmar a continuidade, a ordem e os bytes exatos dos dois vídeos.
- [x] Executar `npm test`, `npm run build`, `node build.mjs --fixture` e `npm run test:chrome`. Quando disponível, validar lote de Reels públicos no navegador descartável, comparando horários de início e fim no Chrome.
- [x] Atualizar para 3.0.5, empacotar o build de produção e comparar o conteúdo do ZIP com o build. Registrar o commit na branch da extensão.

## Referência investigada

O pacote 1.7.4 do ScaleReels Downloader da Chrome Web Store foi analisado como artefato estático. SHA-256 do CRX: `25A5A7C447A69154D3ABA099E1FF031D0D7696568BC5722CA3B3AA8238C2A5EF`. O worker declara até duas tarefas simultâneas e usa a aba da rede social como parte da obtenção da mídia. O Mouse Hot adota o limite de uma transferência pedido neste projeto. Evidências REA: `ev_0a9e591c2b4d6cac277370e332ea07bb6e2ea85f8065ff06469df1764fef1bf6` e `ev_e6d459170657a963dc477d09d797af1ec8294638699939f92bbf99a2ce6a0dd3`.

## Evidências da entrega

- A versão 3.0.4 falhou na regressão com pico de duas transferências. A 3.0.5 manteve uma ativa e duas aguardando. Com o segundo Reel recebendo HTTP 403 durante a transferência, o primeiro e o terceiro foram salvos com todos os bytes esperados.
- No Instagram público, o Chrome salvou dois Reels completos no mesmo lote. O primeiro terminou às 16:21:28,965 e o segundo começou às 16:21:29,213, no horário de São Paulo.
- Os 64 testes automatizados e a suíte de integração no Chrome 157 passaram. Os nove arquivos do ZIP conferem com o build de produção e o README.
- A fila deixa transferências que já estavam ativas antes da atualização terminarem. O teste público valida o limite e a gravação dos arquivos. A causa da falha na sessão do usuário permanece sem confirmação.
