# Meta App Review — MouseHot

Atualizado em 16/11/2026. Este documento é o ponto de retomada da liberação para clientes externos. **Rascunho preparado; não enviado nem aprovado.** Não confundir o deploy do site com publicação/aprovação do app na Meta.

## Identificação e escopo

- App: `00duHot Publisher`, ID público `2201393490722211`.
- Portfólio proprietário indicado pela Meta: `00dohot`, ID `1498873732174939`.
- Site: <https://mausehot.lovable.app/>.
- Entrada da integração: <https://mausehot.lovable.app/automacao-instagram?tab=nova-conta>.
- Callback: <https://mausehot.lovable.app/api/instagram/oauth/callback>.
- Configuração ativa: `MauseHot Instagram`, ID público `2579077412515904`.
- Solicitação de revisão existente: `2206501010211459`.
- Login unificado, ativos do Instagram, token de usuário do sistema; configuração solicita **somente `instagram_basic` e `instagram_content_publish`**.
- Não trocar o app/configuração nem criar segredos para preparar a revisão.

## Evidência real e testes

Conexões reais de `_melissaconteudo`, `jane.coroa` e `morenacoletora` confirmadas no fluxo de teste. Biblioteca da terceira conta vazia e independente. Detalhes em [automatic-post-separated-flows.md](automatic-post-separated-flows.md).

Publicações reais previamente confirmadas pelo processador:

| Arquivo | Conta autorizada | ID de mídia Meta | Publicação UTC |
| --- | --- | --- | --- |
| REELS (75).mp4 | `_melissaconteudo` | `18033466910688967` | 15/11/2026 23:35:13 |
| REELS (12).mp4 | `_melissaconteudo` | `18123001862074768` | 15/11/2026 23:36:11 |

O formulário da Meta mostrou **instagram_content_publish — Concluída** para a chamada de teste obrigatória. Não são novas publicações realizadas nesta preparação. Não republicar os vídeos para produzir evidência duplicada.

Em 16/11/2026, `npm test`: **142 passaram, 0 falharam, 0 ignorados**. Testes locais usam fixtures; não comprovam aprovação Meta nem acesso avançado.

## Trabalho realizado no painel

- Corrigido o URL do site antigo para `https://mausehot.lovable.app/` e conferida persistência após recarregar.
- Categoria preenchida: **Negócio e Páginas**, conferida após recarregar.
- Ícone original `public/brand/mark.png` redimensionado para 1024 × 1024, enviado e exibido como `mausehot-meta-icon-1024.png`. Nenhum redesign da marca.
- Instruções de teste web preenchidas/salvas em inglês: URL de produção, login Google, fluxo OAuth Meta, biblioteca, configuração, revisão, publicação e histórico. Explicitado que os revisores usam suas próprias contas e não recebem credenciais pessoais.
- Justificativas de `instagram_content_publish` e `instagram_basic` preenchidas/salvas no rascunho, sem marcar os aceites de uso permitido nem anexar uma gravação inexistente. O painel reconhece as chamadas de teste de ambas como concluídas.
- Pedidos antigos de `pages_show_list`, `pages_read_engagement`, `business_management` e `public_profile` retirados **somente da solicitação de revisão** para corresponder à configuração ativa de duas permissões. Isso não altera tokens, conexões, código dos fluxos legados ou dados das contas.

## Bloqueios constatados

1. **Verificação empresarial:** o painel do app mostra `00dohot — Não verificado` e informa que a verificação é necessária para acesso avançado.
2. **Sessão empresarial diferente:** o link para iniciar verificação abre a Business Suite no portfólio `Noemi santos` (`2056913935013005`). O seletor nessa sessão só disponibilizou esse portfólio, sem apps. Até navegar pelo link do portfólio correto foi redirecionado para o outro. Não iniciar verificação da empresa errada, transferir o app nem remover seu proprietário. Foi solicitada ao operador a entrada no perfil que tem controle total de `00dohot`.
3. **Política de privacidade e exclusão de dados:** URLs ainda ausentes. O repositório principal não tem páginas públicas dessas políticas para a integração Instagram. Não cadastrar URL 404, política da ferramenta de e-mail temporário nem texto que prometa limpeza automática inexistente.
4. **Identificação e contato públicos do responsável:** não estão estabelecidos no repositório. O email privado de contato do Developers não foi copiado nem publicado como contato de privacidade. Dados empresariais/documentos não podem ser inventados.
5. **Gravações:** o formulário exige screencast real do fluxo para as permissões. Não existe gravação anexada. Testes automatizados com fixtures, fotos montadas e afirmação de publicação não substituem essa gravação.
6. **Tratamento de dados:** formulário ainda precisa ser preenchido conforme operadores/suboperadores, controlador e práticas efetivos. Não declarar retenção, auditorias, certificações, atendimento a autoridades ou procedimentos internos que não foram verificados.
7. **Envio e publicação:** `Enviar para análise` está desabilitado enquanto as etapas obrigatórias não forem completadas. O app segue **Não publicado**. Nenhum pedido de acesso avançado foi aprovado por esta tarefa.

## Texto da justificativa — instagram_content_publish

Texto preparado em inglês para o campo de uso permitido:

> MouseHot (published at https://mausehot.lovable.app) lets account owners connect their Instagram professional accounts through Meta Unified Login and schedule their own organic Reels. The owner selects a connected account, uploads videos into its isolated library, adds an optional caption, hashtags and cover, chooses the publication dates/times, reviews the complete queue and explicitly activates it. Our backend uses instagram_content_publish to create an Instagram media container, wait for processing and publish the approved Reel on behalf of that owner. The history shows the actual publishing result and Meta media ID. This permission is essential for the scheduled publication requested by the owner; it is not used for account creation or unsolicited messaging. We have confirmed real publishing on our authorized test account @_melissaconteudo, including media IDs 18033466910688967 and 18123001862074768. Stories with interactive link stickers are prepared as reminders for the owner to publish manually in Instagram; we do not claim to publish those stickers through this permission.

## Texto da justificativa — instagram_basic

> MouseHot uses instagram_basic to identify the professional Instagram accounts that an owner explicitly shares through Meta Unified Login. After the server exchanges and validates the authorization code, it calls /me/assigned_instagram_accounts with the id and username fields and associates those accounts with the authenticated owner's workspace. The user can see the connected username, select the intended destination and maintain a separate media library and publishing queue for each connected account. This prevents scheduling a video for the wrong account. We do not request private data from arbitrary profiles with this permission. The access token is encrypted and stored only on the backend; the Meta app secret is never exposed to the browser. The permission is required to identify the destination account for the owner's requested organic content publication.

## Roteiro verificável de revisão

1. Abrir o endereço de Automatic Post acima numa sessão sem autenticação do MouseHot. Mostrar a entrada Google e acessar com uma conta de revisão autorizada. Não filmar senha, código ou URL de retorno que contenha credenciais.
2. Abrir Conectar nova conta → Conectar Conta. Mostrar o diálogo oficial, seleção de Instagram, portfólio/conta e permissões. Usar conta profissional que pertence ao operador/revisor. A tela de login não exige acesso ao Developers.
3. Concluir OAuth e mostrar o nome de usuário na lista carregada do backend.
4. Abrir biblioteca exclusiva e carregar um MP4 próprio, adequado a teste público. Filmar upload e seleção reais.
5. Escolher legenda, hashtags/capa opcionais, primeira data, horários e conta. Mostrar revisão do lote.
6. Só ativar uma publicação pública com autorização específica para aquela conta e mídia. A autorização para preparar a revisão não escolhe, por si só, qualquer conteúdo da biblioteca para uma nova publicação.
7. Aguardar o resultado real no Histórico e mostrar o Reel no Instagram. Não montar uma confirmação fictícia ou usar status local como prova de publicação externa.
8. Adicionar legendas em inglês à gravação em PT-BR; não fingir que uma interface traduzida foi publicada se não foi.
9. Anexar a gravação nos campos correspondentes e confirmar o uso permitido somente após o aceite necessário do operador. Manter descrição, vídeo e permissões coerentes.

## Inventário técnico para a política de privacidade

Baseado no código atual; não constitui política pública final ou declaração de conformidade jurídica:

| Dados | Uso e armazenamento observados |
| --- | --- |
| Identificador de usuário autenticado e vínculo com workspace | Controle de acesso Google/Lovable Auth/Supabase e associação das operações ao proprietário/equipe |
| ID e username do Instagram, tipo, status, permissões e datas de autorização | Seleção de contas e controle da integração em `instagram_accounts` |
| Token Meta | Cifrado com AES-GCM no backend em `instagram_tokens`, sem políticas de acesso para o cliente autenticado |
| Vídeos, imagens e capas carregados | Biblioteca privada do workspace/conta e URLs temporárias para processamento/publicação |
| Legendas, hashtags, datas/horários, filas, resultados e IDs de mídia | Agendamento e histórico de execução |
| Métricas disponibilizadas por permissões autorizadas | Analytics quando a conta/permissões efetivamente fornecerem esses dados; não afirmar métricas disponíveis universalmente |
| Estado OAuth | HMAC e cookie HttpOnly/Secure em produção, prazo de 10 minutos |

Serviços identificados para este fluxo: Meta/Instagram, Google (autenticação), Lovable (hospedagem/auth/cloud), infraestrutura Supabase usada pelo Cloud (banco e armazenamento). Identidade contratual e localidades dos suboperadores precisam ser confirmadas antes do formulário de tratamento de dados. Não acrescentar fornecedores de IA ou outras ferramentas sem rastrear que recebem esses dados.

Não há implementação encontrada de exclusão completa/desautorização automática da integração. O formulário do Facebook Login para Empresas também mostrou callbacks de desautorização e solicitação de exclusão vazios. Pode-se adotar instruções públicas de solicitação manual inicialmente, mas apenas com contato real, procedimento operacional implementado, responsável definido e prazo informado de forma verdadeira. Revogar acesso na Meta não equivale a remover cópias no armazenamento MouseHot.

Antes de publicar a política, definir identificação do controlador e canal de contato, finalidades/bases aplicáveis, compartilhamento, retenção, atendimento de direitos e descarte. Implementar/testar a rotina escolhida de revogação/exclusão. Não prometer prazos ou automação inexistentes.

O formulário real de tratamento de dados foi aberto. Exige: existência/nomes de operadores; identificação do controlador (o texto aceita pessoa física ou jurídica); país; compartilhamento em resposta a solicitações de segurança nacional nos últimos 12 meses; e processos existentes para analisar/contestar/minimizar/registrar solicitações de autoridades. Não foram marcadas respostas ou preenchida uma identidade por suposição. Avançar com os campos vazios exibe perguntas obrigatórias. A identidade do controlador aceita no formulário não comprova que a verificação empresarial separada será aprovada.

Tentativa adicional de resolver a sessão errada: em Business Suite → Your profiles, foi constatado login por Instagram como `morenacoletora`, sem outros perfis salvos. Selecionado Log in with another account; a aba está na entrada oficial de ferramentas empresariais, com Continue with Facebook/Instagram. O clique Facebook não concluiu uma troca de sessão. Não houve logout global, alteração de senha, armazenamento de credenciais ou mudança do portfólio proprietário do app. O operador deve concluir a entrada com o administrador de `00dohot`.

## Retomada exata

1. Listar abas do navegador interno; não presumir IDs. Preservar a sessão Developers que consegue administrar o app.
2. Aguardar a entrada do operador no portfólio correto e abrir a verificação de **00dohot**, não a de Noemi. Os dados legais e documentos devem ser preenchidos com informações reais. Login/2FA/documentos do operador ficam nas páginas oficiais.
3. Abrir o rascunho `2206501010211459`, confirmar as duas permissões e os textos salvos, finalizar `instagram_basic` e demais seções factuais.
4. Preparar/publicar páginas públicas de privacidade e instruções de exclusão com dados reais, testar sem login e registrar os URLs em Básico. Disponibilizar os links também no fluxo de entrada do MouseHot.
5. Confirmar acesso do revisor ao site com uma conta Google nova, usando workspace isolado. Não partilhar sessões/cookies, credenciais pessoais ou convites para o workspace de produção.
6. Gravar o fluxo real e enviar as gravações; registrar requisitos adicionais do formulário atual. Não enviar um pedido incompleto ou com declarações falsas.
7. Só declarar **enviado** após confirmação explícita do painel com protocolo/status. Aprovação é decisão externa da Meta.
8. Depois de aprovado, publicar o app e testar com conta profissional externa **sem papel de testador**. Esse é o teste que comprova a conexão SaaS. Os três perfis já autorizados não comprovam essa liberação.

## Fontes oficiais consultadas em 16/11/2026

- [Unified Login](https://developers.facebook.com/documentation/instagram-platform/instagram-api-with-unified-login/)
- [Requisitos e diagnóstico](https://developers.facebook.com/documentation/instagram-platform/instagram-api-with-unified-login/eligibility-and-troubleshooting)
- [Permissões](https://developers.facebook.com/documentation/instagram-platform/instagram-api-with-unified-login/permissions)
- [App Review](https://developers.facebook.com/documentation/instagram-platform/app-review)

As fontes distinguem Standard Access para pessoas com função no app de Advanced Access + modo Live para clientes externos. Unified Login exige conta profissional/ativos de portfólio; não exige Página do Facebook. Nenhuma aprovação é simulada no frontend.
