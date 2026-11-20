# Conexão direta do Instagram — 16/11/2026

Para o fluxo posterior de cadastro por operação, consulte [Primeiros passos no Automatic Post](instagram-workspace-onboarding.md).

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
- As páginas públicas `/privacidade` e `/exclusao-de-dados` responderam HTTP 200 também no domínio publicado, com o contato autorizado e sem exigir login.
- O teste de navegador usa dados sintéticos somente no ambiente local. Não equivale a nova autorização ou publicação na Meta de produção.
- O build identificou uma incompatibilidade de empacotamento: `BroadcastChannel` sem qualificação no componente era convertido em uma dependência Node `worker_threads` pelo alvo Cloudflare. Corrigido para `window.BroadcastChannel` dentro do efeito do navegador, sem adicionar polyfills ou dependências. Confirmar o build final antes do deploy. Não executar build e teste Vite com o mesmo diretório de saída em paralelo.

## Publicação e teste real

- Código integrado em `main`: `d6e858e` (fluxo direto) e `6bb1ccf` (confirmação da conta indicada pelo callback).
- Deploy realizado pela interface do Lovable, sem enviar comandos ao chat. Confirmação exibida: **Seu site foi atualizado**.
- Em `https://mausehot.lovable.app/automacao-instagram?tab=nova-conta`, o botão Conectar Instagram abriu a autorização oficial. Escolhido Continuar com o Instagram e a sessão já autorizada `morenacoletora`.
- A Meta mostrou o portfólio **Noemi santos** e apenas `morenacoletora`, com as permissões existentes de acesso ao perfil/publicações e criação de posts. A reconexão reutilizou essas autorizações; não houve concessão de novas permissões ou convite.
- Após Salvar, a janela fechou automaticamente e a aba original exibiu **@morenacoletora conectada. Continue para a biblioteca desta conta.** A seção passou a Biblioteca de Reels e o seletor marcou `@morenacoletora`.
- A biblioteca de `morenacoletora` continuou com **0 vídeos**, separada de `_melissaconteudo` (**158**) e `jane.coroa` (**472**). O botão Próximo permaneceu desabilitado sem vídeos, preservando a validação do fluxo.
- Nenhum novo Reel foi publicado neste teste de conexão. Não foi testado um perfil externo sem função no app; esta validação comprova reconexão real de uma conta de teste já autorizada.

## Continuidade

A conexão direta das contas autorizadas está entregue e publicada. Para novas contas próprias no app em desenvolvimento, seguir a ajuda de Funções do app e Convites do testador quando a Meta exigir. Para SaaS sem convites, continuar a revisão descrita em `meta-app-review.md`; não anunciar acesso público aprovado. A proposta de cada cliente configurar seu próprio app permanece fora desta entrega. Não alterar RLS, segredos, app proprietário ou autorizações para esconder a exigência externa.
