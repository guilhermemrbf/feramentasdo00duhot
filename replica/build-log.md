# Hot Profiles — primeira base

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
