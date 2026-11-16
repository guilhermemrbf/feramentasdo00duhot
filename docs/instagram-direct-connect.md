# Conexão direta do Instagram — 16/11/2026

## Escopo desta entrega

O operador confirmou que quer usar o próprio app Meta já configurado, com conexão iniciada dentro do MouseHot, sem depender do chat. O app conecta contas de teste e publica Reels; **não está aprovado para conexão pública sem funções/convites**. O cadastro de app próprio para cada futuro cliente foi discutido, mas não foi implementado nesta entrega. Não afirmar que o backend atual suporta credenciais Meta por cliente.

## Mudanças

- Botão principal **Conectar Instagram** abre a autorização oficial diretamente, inclusive a partir de Contas conectadas. App ID, configuração, callback e segredos permanecem pré-configurados no servidor.
- O caminho normal usa o navegador atual. A opção de uma sessão Chrome independente/conector ficou em Opções de navegador, preservando o funcionamento existente.
- O botão aguarda a primeira leitura das contas e bloqueia tentativas simultâneas. Há recuperação explícita para falha na leitura, cancelamento e limite de espera.
- A consulta de contas ignora respostas de requisições que perderam validade após uma nova consulta/mudança de contexto.
- O retorno do OAuth avisa a aba original por BroadcastChannel e pode fechar a janela após uma confirmação de recebimento. A mensagem só sinaliza que o frontend deve consultar o backend; não concede acesso e não prova conexão por si só.
- O sucesso só é exibido depois de ler um registro conectado no workspace autenticado. Na reconexão de uma conta existente, a atualização de `last_verified_at` precisa corresponder também ao ID Instagram informado pelo callback. Assim uma atualização de token em segundo plano não seleciona outra conta por engano. O aviso contém apenas os IDs da conta e do workspace, sem credenciais.
- No assistente de Reels, a conta confirmada leva à sua biblioteca. Stories mantém seu fluxo e biblioteca separados.
- A tela de retorno sem sessão continua disponível para navegadores isolados. A política CSP permite apenas o script com nonce aleatório; nenhum código OAuth, state, token ou descrição arbitrária da Meta é refletido no HTML/mensagem.

## Segurança e limites

Nenhuma mudança de RLS, esquema, permissões Meta, segredo ou proprietário do app. O email de administrador não é usado para contornar verificações da Meta ou conceder acesso a outro workspace. As autorizações continuam vinculadas à sessão e ao workspace já verificados no servidor.

Perfis que ainda não têm acesso ao app em desenvolvimento podem receber App not active. A ajuda inclui os links oficiais de Funções do app e Convites do testador. O software não cria convites ou aceita termos em nome do usuário. A liberação pública depende das etapas de verificação/revisão da Meta registradas em [meta-app-review.md](meta-app-review.md).

## Validação

- `npm test`: **143 passaram, 0 falharam**.
- `node node_modules/typescript/lib/tsc.js --noEmit`: passou.
- `npm run build`: passou, inclusive após vincular o aviso de retorno ao ID da conta reconectada.
- `node --experimental-strip-types tests/instagram-guided-browser.mjs`, com `INTELLIGENCE_PG_TEST_DEPS=C:/Users/User/AppData/Local/Temp/mausehot-pg-intelligence`: passou em Chrome real, com serviços locais de teste.
- O teste de navegador usa o HTML real de retorno e sua CSP. Comprova bloqueio do botão durante a primeira consulta pendente, abertura do OAuth, ausência de vínculo `opener`, notificação sem alteração de banco não produzindo sucesso, reconexão persistida da conta indicada levando à biblioteca e fechamento automático da janela. Também mantém a validação de biblioteca/agendamento de Reels, worker, isolamento por conta, biblioteca de Stories e layout móvel. Passou antes do build final isolado.
- As páginas públicas de privacidade/exclusão do commit anterior responderam HTTP 200 localmente, com contato e sem exigir login; a validação publicada ainda depende do deploy.
- O teste de navegador usa dados sintéticos somente no ambiente local. Não equivale a nova autorização ou publicação na Meta de produção.
- O build identificou uma incompatibilidade de empacotamento: `BroadcastChannel` sem qualificação no componente era convertido em uma dependência Node `worker_threads` pelo alvo Cloudflare. Corrigido para `window.BroadcastChannel` dentro do efeito do navegador, sem adicionar polyfills ou dependências. Confirmar o build final antes do deploy. Não executar build e teste Vite com o mesmo diretório de saída em paralelo.

## Continuidade

Antes de declarar entrega publicada: confirmar build isolado, integrar o commit em main, publicar via UI do Lovable (sem comandos no chat Lovable), abrir `/automacao-instagram?tab=nova-conta` em produção e conferir o botão/ajuda/contas. Quando a sessão permitir, repetir a conexão de uma conta de teste já autorizada e comprovar o retorno automático; não publicar novos Reels para testar apenas conexão. Salvar evidência e atualizar este registro com o que realmente foi validado.
