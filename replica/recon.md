# Hot Profiles — investigação funcional

Data: 2026-10-21. Escopo autorizado: acrescentar ao 00duHot uma central própria de perfis de navegador e Android, com proxies e sessões em abas. Público: operação do usuário. A interface e o código são originais; nenhum executável, recurso ou endpoint privado do Dolphin foi copiado.

## Fontes públicas

| Fonte                                     | URL                                                                                                                | Uso                                    |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | -------------------------------------- |
| Dolphin: criação e execução de perfis     | https://docs.dolphin-anty.com/en/getting-started/quick-start-in-dolphin-anty                                       | Cadastro, filtros, tags, iniciar/parar |
| Dolphin: áreas da interface               | https://docs.dolphin-anty.com/en/interface-dolphin-anty/application-interface-dolphin-anty                         | Lista de perfis e central de proxies   |
| Chromium: configuração de rede            | https://www.chromium.org/developers/design-documents/network-settings/                                             | Proxy por processo                     |
| Chrome: diretório dedicado para depuração | https://developer.chrome.com/blog/remote-debugging-port                                                            | Isolamento do navegador pessoal        |
| CDP: tela e navegação                     | https://chromedevtools.github.io/devtools-protocol/tot/Page/                                                       | Sessões reais de navegador             |
| CDP: controles                            | https://chromedevtools.github.io/devtools-protocol/tot/Input/                                                      | Teclado, clique e rolagem              |
| Android: ADB                              | https://developer.android.com/tools/adb                                                                            | Dispositivos, tela e comandos oficiais |
| BlueStacks: ADB                           | https://support.bluestacks.com/hc/en-us/articles/23925869130381-How-to-enable-Android-Debug-Bridge-on-BlueStacks-5 | Ativação pelo menu oficial             |

## Telas e estados

| ID  | Tela                | Acesso           | Estados                                                           |
| --- | ------------------- | ---------------- | ----------------------------------------------------------------- |
| S01 | Central de perfis   | /hot-profiles    | Desconectado, conectando, vazio, lista, filtro vazio, erro        |
| S02 | Criar/editar perfil | Novo perfil      | Navegador, Android, validação, dispositivo indisponível, salvando |
| S03 | Proxies             | Guia Proxies     | Vazio, lista, cadastro, edição, verificação, falha                |
| S04 | Sessões             | Guia Sessões     | Abas, iniciando, tela real, interrompida, erro, sem sessão        |
| S05 | Conectar computador | Botão de conexão | Instruções, pareamento, conectado, desconectado                   |

## Fluxos

- F01: conectar computador → código de pareamento → listar perfis locais.
- F02: criar perfil de navegador → opcionalmente associar proxy → iniciar → navegar na sessão → parar → reabrir com dados preservados.
- F03: criar proxy HTTP/HTTPS/SOCKS5 → verificar conectividade → associar ao perfil.
- F04: criar uma instância no gerenciador oficial → habilitar ADB → associar a um perfil Android → iniciar → controlar tela → desconectar e restaurar proxy anterior.
- F05: filtrar por nome/tags/tipo → editar ou duplicar navegador → confirmar exclusão de configuração parada.

## Modelo e componentes

Profile: id, kind, name, tags, notes, proxyId, startUrls, deviceId, viewport, createdAt, updatedAt. Proxy: id, name, protocol, host, port, username, segredo criptografado. Session: profileId, status, startedAt, erro; vive no conector. Activity: ação e horário sem conteúdo navegado. Device: instância detectada ou emulador ADB autorizado.

Componentes: lista filtrável, indicadores de estado, seletor de tipo, modal acessível, guia de conexão, formulários, abas de sessões, tela remota e barra Android.

## Limites

- Não reproduzir o motor proprietário/fingerprints do Dolphin ou distribuir o Android/BlueStacks.
- O site sozinho não contém uma máquina virtual: um conector local executa o Chrome/Edge e comunica com o Android instalado.
- Cada Android precisa de uma instância independente. Criar um cadastro não duplica o disco de um celular existente.
- Proxy Android é o proxy HTTP do sistema; aplicativos que o ignoram precisam de solução de rede própria, fora desta etapa.
- Não importar cookies ou perfis pessoais existentes. Não alterar instâncias já existentes automaticamente.

Tamanho: M para a base local; streaming de alta frequência, hospedagem de celulares na nuvem e colaboração multiusuário são etapas posteriores.
