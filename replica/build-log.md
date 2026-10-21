# Hot Profiles — entregas

## Base web/nuvem — 2026-10-21

Pedido atual: remover dependência de execução local, implementar frontend/backend de proxy e preparar integração recomendada, pois o usuário ainda não possui conta/servidor de Android na nuvem.

- Painel principal convertido para nuvem; antiga UI preservada em componente separado. Nada foi removido dos perfis locais ou dos emuladores do usuário.
- Formulários de perfil/proxy, acesso por e-mail, configuração de serviços, busca, filtros, duplicação, sessões em abas, controle por Live View/WebRTC e tela cheia implementados.
- Back-end autenticado, lista de contas autorizadas, migração SQL, criptografia, referências entre registros do mesmo dono e proteção contra corridas implementados. Credenciais globais e ciphertexts não são retornados ao navegador.
- Adaptadores oficiais Browserbase e Genymotion SaaS implementados. Android temporário e ausência de proxy automática/persistência explicitamente informados; Android com proxy não inicia.
- Conferência manual na UI: importação `http://demo:demo@example.com:8080` preencheu campos corretamente; sem login, salvar exibiu a exigência de entrada e não criou cadastro. Nenhuma proxy real foi usada.
- Cinco casos do importador aprovados executando a função original do formulário: URL HTTP autenticada, formato host:porta:usuário:senha com dois-pontos na senha, HTTPS com porta padrão, SOCKS5 com caracteres codificados e entrada inválida. Somente valores fictícios; nenhum cadastro externo criado.
- Conferidos formulários de navegador/Android, avisos de serviço não configurado, acesso por e-mail (sem envio), abas Perfis/Proxies/Sessões e layout a 390 pixels. Tamanho original do navegador restaurado. Imagens da UI salvas na pasta outputs da tarefa.
- TypeScript, ESLint dos arquivos alterados e build de produção conferidos. Integração real de provedores, aplicação da migração, persistência remota e isolamento com dois usuários reais ainda dependem de infraestrutura/credenciais e não foram declarados validados.

Publicação da interface pelo Lovable permanece manual, conforme escolha anterior do usuário. O guia `docs/hot-profiles-cloud.md` explica a ativação, custos e limitações.

## Primeira base local (histórico)

2026-10-21

- S01 central: implementada, menu e início integrados. Lista, filtros por tipo/nome/tags, vazio, estado desconectado, contadores e ações. Conferência visual em 390 e 1440 pixels; sem overflow horizontal no conteúdo desktop.
- S02 perfil: implementado. Navegador cadastrado e persistido após reiniciar conector. Perfil Android cadastrado apontando explicitamente para a instância existente, sem cloná-la ou alterar aplicativos. Criar um novo celular usa uma instância independente pelo gerenciador oficial.
- S03 proxies: cadastro/edição/exclusão condicionada, credenciais criptografadas, associação e verificação de túnel implementados. Nenhuma credencial real fornecida nesta etapa: tráfego com o proxy do usuário ainda precisa ser validado.
- S04 sessões: navegador Chrome real aberto no painel. Duas abas; navegação Example Domain → Wikipedia, clique na página levou à Wikipédia em português; modo ampliado e encerramento conferidos. Android: descoberta das instâncias funciona; a configuração local mantém ADB desativado e bloqueia a abertura real. Não declarar Android validado sem ativar ADB e capturar sua tela.
- S05 conexão: pareamento real conferido; reinício invalida token, informa reconexão e recupera perfis sem sobrescrever dados. Download do conector empacotado com fontes e guia, sem dependências externas de npm.

## Continuação

1. Ativar ADB no menu oficial do BlueStacks e conferir tela/toques/proxy no Android.
2. Validar um proxy fornecido pelo usuário, incluindo aplicativos Android que respeitem o proxy do sistema.
3. Publicar a interface manualmente no Lovable, conforme o fluxo já combinado.

Não implementados nesta base: infraestrutura Android em nuvem, fingerprints proprietários, áudio/vídeo em tempo real, captura de câmera/microfone e transferência de arquivos dentro das páginas remotas. A tela usa capturas periódicas. A API não oferece execução de comandos arbitrários, importação de cookies ou acesso ao navegador pessoal.
