# Automatic Post — Reels e Stories separados

Atualizado em 15/11/2026.

## Fluxos implementados

- **Conectar nova conta** abre a autorização oficial da Meta em uma aba reservada durante o clique. A criação da janela acontece antes da chamada assíncrona para evitar bloqueio de pop-up. Erros de pop-up, acesso ao workspace e configuração ficam visíveis. O conector local é opcional e continua disponível para uma sessão isolada do Chrome.
- **Nova conta de Reels** segue conexão → biblioteca exclusiva → configuração de legenda, hashtags, capa, ordem e 1–10 horários diários → revisão e ativação. Há um botão Próximo ao final. A ativação agenda o lote validado pelo RPC existente.
- **Contas conectadas** oferece atalhos independentes para Biblioteca de Reels, Configurar Reels e Configurar Stories. O assistente inicial não aparece nesse fluxo.
- **Stories** mantém conta selecionada, biblioteca, links, figurinhas e agenda próprios. Conectar outra conta para Stories abre o mesmo OAuth com retorno ao fluxo de Stories, sem o assistente de Reels.
- A ordem de Reels possui botões visíveis de ordem da biblioteca, numérica e aleatória. A sequência gerada fica congelada na prévia; alterações exigem uma nova prévia antes de ativar.

## Persistência e limites

A biblioteca de Stories usa o bucket privado existente `postkit-media`, em `<workspace>/stories/<account>/<uuid>--<filename>`. Não cria registros em `media_assets`, portanto os arquivos não entram na biblioteca nem na fila de Reels. As políticas existentes exigem membro/editor do workspace e protegem o bucket. Dentro de um workspace, os membros autorizados da equipe continuam compartilhando acesso; a separação por conta organiza a mídia, não cria uma nova fronteira de autorização entre colegas.

Uploads validam tamanho (até 50 MB), extensão e assinatura de contêiner. O lote contém até 45 Stories. A biblioteca permanece salva após recarregar. Ao agendar, o objeto é copiado no servidor Storage para o caminho exigido por `instagram_story_reminders`; a cópia mantém a biblioteca reutilizável. A agenda e o calendário exibem somente a conta selecionada. A troca de conta é bloqueada enquanto houver mídia em edição. Nenhuma migration nem mudança de RLS é necessária.

**Stories com links continuam sendo preparo e lembretes para publicação manual no Instagram.** O botão Ativar lembretes não publica o adesivo de link automaticamente. O worker de Reels não lê a tabela de lembretes e sua ativação usa `p_stories=skip` para preservar o contrato existente sem exigir Stories.

## Validação

- `npm test`: 142 testes unitários.
- `node node_modules/typescript/lib/tsc.js --noEmit`.
- `npm run build`.
- `$env:INTELLIGENCE_PG_TEST_DEPS='C:/Users/User/AppData/Local/Temp/mausehot-pg-intelligence'` e `node tests/instagram-reviewed-schedule-postgres.mjs`: PostgreSQL embarcado PGlite, isolamento por conta/mídia, permissão, datas, limite diário e idempotência.
- `node tests/instagram-guided-browser.mjs`: Chrome real com serviços locais de teste. Exercita clique e OAuth server function até URL oficial (navegação Meta interceptada pelo teste), conector opcional, fluxo Próximo, seleção aleatória de 20 Reels em duas contas, revisão, RPC, responsividade, biblioteca de Stories com upload/reabertura/cópia/ativação de lembretes e conexão independente de Stories.

Os serviços locais usam dados sintéticos exclusivamente nos testes. Não validam credenciais de produção, autorização real da Meta, gravação no bucket de produção nem postagem pública. A revisão não publicou mídia real.

## Continuidade operacional

Checkout `C:/Users/User/AppData/Local/Temp/00duhot-mouse-hot-v3`, branch `fix/automatic-post-fluxos`, base `e2c56fc`. O repositório é `guilhermemrbf/feramentasdo00duhot` e o projeto Lovable é `03560931-5f6a-41e1-a222-0510d1828a23`.

O conector Lovable não está disponível nesta sessão. Após integrar o código ao GitHub, verificar a sincronização do preview e realizar a publicação pelo painel Lovable; não enviar comandos pelo chat Lovable. O deploy de produção e uma nova autorização Meta precisam de verificação nesse ambiente autenticado. Nunca declarar deploy ou postagem confirmados com base nos serviços locais de teste.

Principais arquivos: `src/routes/automacao-instagram.tsx`, `src/lib/instagram-connect.ts`, `src/components/postkit/StoryLibrary.tsx`, `src/lib/story-library.ts`, `src/components/postkit/InstagramStories.tsx`, `src/components/postkit/InstagramAutomationReview.tsx`, `src/components/postkit/ReelTimingFields.tsx`. Nenhum outro módulo foi alterado.

## Entrega no GitHub

Código integrado diretamente em `main` no commit `756ee2d15bc69585d2a4c9bc2390a20fa0e69722`, confirmado com `git ls-remote`. O teste final de navegador também iniciou com o processador desativado e comprovou a ativação pelo botão dentro da revisão antes de salvar a fila.

A tentativa de abrir o projeto Lovable no navegador interno retornou `queued` para este chat. A janela disponível do Codex não expôs o painel do projeto para controle. O único Chrome externo estava em outro site e não foi utilizado. O deploy no Lovable e os testes autenticados com Meta/Storage de produção permanecem pendentes. Próximo agente deve usar o commit já integrado; não refazer a implementação nem aplicar migrations.

## Deploy e diagnóstico real — 15/11/2026

- Acesso ao navegador interno recuperado via `setupBrowserRuntime()` do cliente Browser; o retorno é o objeto `agent` (não instala `agent` globalmente). Selecionado browser IAB de ID `2`. Usar controles Browser, não automação Windows do aplicativo ChatGPT.
- Deploy realizado pelo botão Publicar alterações no painel Lovable. Confirmação visual `Seu site foi atualizado`. Produção autenticada em `https://mausehot.lovable.app/automacao-instagram?tab=nova-conta` exibiu o código novo e as duas contas existentes, com 158 vídeos na biblioteca da Melissa.
- Botão Conectar Conta abriu a autorização real Meta. Encontrado erro de ambiente: `APP_BASE_URL` ainda usava `feramentasdo00duhot.lovable.app`, endereço que atualmente retorna `No Lovable project found at this address`. Atualizado somente `APP_BASE_URL` para `https://mausehot.lovable.app` pelo formulário Secrets do Lovable, sem ler ou alterar valores de chaves sensíveis. Republicado e confirmado. Uma nova tentativa apresentou o redirect URI no domínio correto na página da Meta; a autorização final de nova conta ainda não foi concluída.
- Auditoria SQL somente de leitura: 1 post publicado e 158 agendados; 2 dos agendados vencidos naquele instante. Cron do publisher ativo ainda apontava para o endereço antigo; Analytics já estava no domínio novo.
- Migration `20261115210000_repair_instagram_publisher_origin.sql` criada, testada em PGlite e aplicada no editor SQL do Lovable. Corrige somente o domínio do cron e da função de ativação, preservando permissões, segredos do Vault, datas, filas e conteúdo. Leitura posterior confirmou ambos os endpoints em `mausehot.lovable.app`, ativos.
- Teste `tests/instagram-worker-origin-postgres.mjs` comprova origem do ativador, correção dos dois cronjobs, preservação de agendas/referências de autorização/outros jobs e idempotência. Nenhum registro da fila foi cancelado, apagado ou remarcado.

Pendências: completar login/consentimento real de uma nova conta; confirmar URI novo na configuração do app Meta caso a Meta rejeite; acompanhar a retomada dos 2 posts vencidos até confirmação de mídia ou erro objetivo. A ausência de login/consentimento não pode ser tratada como conexão concluída. Não publicar novos lotes de teste sobre os 158 já agendados.

## Publicações reais confirmadas e nova conta

Após corrigir o cron, os dois agendamentos vencidos foram processados pela Meta e confirmados na tabela de produção, sem erros:

| Arquivo | Conta | Confirmação Meta | Publicação UTC |
| --- | --- | --- | --- |
| REELS (75).mp4 | @_melissaconteudo | 18033466910688967 | 2026-11-15 23:35:13.301032+00 |
| REELS (12).mp4 | @_melissaconteudo | 18123001862074768 | 2026-11-15 23:36:11.249225+00 |

Ambos chegaram a `status=published`, `publish_phase=done`, com `last_error_message=null`. Eram itens da fila existente; nenhum lote novo foi criado. Os horários de Brasília foram 20h35 e 20h36. O Reel (38) de 09/11 já estava publicado e não foi republicado durante esta validação.

No Meta Developers, a configuração MauseHot Instagram (`2579077412515904`, app `2201393490722211`) mostrava somente o callback antigo. Registrado `https://mausehot.lovable.app/api/instagram/oauth/callback` e conferido o alerta `URL de redirecionamento salvo`, o seletor e a URL gerada no domínio novo. O operador já autenticou Facebook/Meta e o novo perfil Instagram @morenacoletora, inclusive a verificação por email, diretamente nas telas oficiais. Não registrar senhas, códigos, cookies ou URLs completas de OAuth no relatório.

O novo perfil encontrou `App not active` durante a autorização. O app continua não publicado/em desenvolvimento. As contas anteriores são Testadores do Instagram e @morenacoletora ainda não constava. Convite preparado em Funções do app → Adicionar pessoas → Testador do Instagram, com a opção exata `morenacoletora` selecionada. Pedido de autorização para enviar o convite apresentado ao operador; até este registro não houve confirmação recebida nem envio. Depois do envio, abrir a seção Apps e sites do perfil já autenticado, aceitar o convite com confirmação de qualquer termo/acesso exigido, repetir Conectar Conta a partir da produção e confirmar a TERCEIRA conta na lista e no banco. Não confundir o login de Instagram ou um aviso da interface com persistência de uma nova conexão.

Abas IAB no navegador ID 2: Lovable 1, produção 2, Developers/configuração 6, Instagram autenticado 7, OAuth com App not active 8, Developers/funções com convite preparado 9. Reutilizar apenas após listar e conferir os IDs, pois o operador também pode fechar/navegar as abas. A função `setupBrowserRuntime()` retorna `agent`; `agent.browsers.get('2')` seleciona a sessão interna. A consulta de abas deve sempre remover query e fragmento antes de exibir URLs, pois o retorno de login pode conter credenciais transitórias.

A observação de produção identificou uma questão menor para revisão futura: se Conectar Conta for acionado antes da primeira carga das contas, a lista inicial vazia pode causar um aviso de conta antiga tratada como recém-conectada. O banco continuou com 2 contas e nenhum novo vínculo foi inferido desse aviso. A tentativa seguinte foi iniciada com a lista carregada. Este comportamento não foi alterado, pois o ajuste em andamento foi limitado aos domínios, conforme orientação do operador.

## Continuidade do convite autorizado

O operador confirmou explicitamente **Sim, adicionar como testador** para @morenacoletora no app 00duHot Publisher. Não pedir novamente essa autorização para o mesmo destinatário e função. O envio permanece pendente: o navegador interno retornou `transport closed before response`, inclusive após reinicialização do runtime e reset do kernel Node. Solicitada reabertura do painel interno. Retomar conferindo a tela de Funções e clicar Adicionar no convite preparado; depois aceitar o convite na conta Instagram e repetir OAuth. Confirmar terceira conta persistida. As duas publicações reais anteriores e o deploy continuam confirmados.

## Retomada pelo Unified Computer Use

Controle interno restabelecido pelo novo `mcp__cua_repl`. Página real de Funções mostrou @morenacoletora já incluída como Testador do Instagram com status Pendente; não foi enviado convite duplicado. Aberta a página Apps e sites na sessão Instagram autenticada de morenacoletora e selecionada a aba Convites do testador. O convite 00duHot Publisher-IG está visível com botão Aceitar. A tela informa aceite dos Termos da Plataforma e Políticas do Desenvolvedor e declaração de vínculo de teste com a equipe. Solicitada confirmação específica desse aceite; ainda não executado nesta retomada. A autorização anterior para adicionar o testador permanece registrada e não deve ser pedida novamente.

Produção aberta em nova aba autenticada; lista ainda contém somente Melissa e Jane. Próximo passo é aceitar o convite após a resposta correspondente e clicar Conectar Conta na produção. As abas atuais devem ser redescobertas no IAB, sem reutilizar IDs de sessões anteriores. Captura do convite: C:/Users/User/AppData/Local/Temp/mausehot-convite-testador.png.

## Conclusão da conexão real — 16/11/2026

As pendências descritas nas seções anteriores foram concluídas. Após autorização explícita do operador, aceito o convite 00duHot Publisher-IG na sessão de @morenacoletora. Instagram exibiu Autorizado para você em 15 de novembro de 2026. Iniciada nova tentativa pelo botão Conectar Conta da produção, selecionado Continuar com Instagram e Entrar como morenacoletora, preservando o aceite de termos já autorizado.

Na retomada após o retorno OAuth, a página autenticada de produção carregou três contas como Conectada: @_melissaconteudo, @jane.coroa e @morenacoletora. Esse resultado confirmou o novo vínculo na lista carregada do backend. Selecionada morenacoletora, o assistente mostrou 0 vídeos desta conta. Abrir biblioteca de @morenacoletora apresentou Biblioteca de @morenacoletora e biblioteca vazia, com upload de pasta/avulsos e Próximo desabilitado até adicionar mídia. Os 158 vídeos da Melissa não foram atribuídos à nova conta.

A aba da biblioteca foi preservada como entrega no navegador interno. Captura: C:/Users/User/AppData/Local/Temp/mausehot-morenacoletora-conectada.png. Não foi criado agendamento nem publicado vídeo na nova conta, porque sua biblioteca está vazia. A validação de publicação real permanece a dos dois agendamentos da Melissa, já confirmados com IDs e horários acima. O próximo uso normal é importar os vídeos exclusivos do novo perfil, configurar e revisar antes de ativar. Stories continuam no fluxo separado de biblioteca e lembretes.

O ciclo solicitado de deploy, reparo dos domínios, conexão real de uma nova conta e comprovação da publicação real de Reels foi concluído. Nenhuma outra publicação foi criada nesta retomada e nenhuma credencial foi salva na documentação.
