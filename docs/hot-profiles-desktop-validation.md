# Hot Profiles Desktop 0.1.0 — validação de 25/10/2026

## Entrega

Aplicativo Windows x64 com instalador NSIS por usuário e ZIP portátil. O painel React e os módulos do conector foram reutilizados. A janela inicia seu próprio serviço autenticado em loopback e recebe a conexão pelo canal privado do processo, sem pareamento manual. O usuário final não precisa instalar Node.js, abrir terminal ou publicar o site.

Os dados continuam em `%LOCALAPPDATA%\00duHot\HotProfiles`, incluindo os perfis, proxies e diretórios de navegador existentes. Não houve migração automática. O conector anterior e o aplicativo não devem abrir a mesma pasta simultaneamente; o bloqueio existente foi preservado. Instalação e desinstalação não apagam essa pasta. A nuvem e o Telegram Sync não foram alterados.

## Testes no Windows do titular

- 85 testes do projeto aprovados, incluindo os limites HTTP do desktop e a recusa do bootstrap desktop fora do canal privado.
- TypeScript do projeto e do renderer desktop sem erros. Builds do site e da interface desktop concluídos; nenhum deploy foi executado.
- Aplicativo executado a partir do código e depois como `HotProfiles.exe` empacotado, usando somente pasta temporária de teste.
- Renderer sem Node.js, API local autenticada, requisição sem token recusada e origem do site recusada no serviço privado desktop.
- Cadastro temporário criado pela API, Chrome/Edge real aberto e encerrado em perfil vazio e cadastro preservado depois de reiniciar o serviço.
- Captura da interface inspecionada; dados sintéticos, sem contas, cookies ou proxies reais.
- O autoteste não instalou o aplicativo no PC do titular e não abriu Instagram, TikTok ou outras contas sociais.

## Instalação no Windows do CI

O [workflow 40167772483](https://github.com/guilhermemrbf/feramentasdo00duhot/actions/runs/40167772483), no commit `89640ee68d506f934dc63b776ad8f79cf401ff48`, concluiu com sucesso:

1. Instalação das dependências do lockfile e os 85 testes do projeto.
2. TypeScript e compilação da interface local.
3. Geração do instalador e ZIP portátil.
4. Instalação em pasta temporária do executor Windows.
5. Autoteste do aplicativo instalado, incluindo navegador real e persistência após reiniciar o serviço.
6. Desinstalação e conferência de preservação de marcador na pasta de dados.
7. Publicação do instalador, ZIP, manifesto SHA-256, relatório do autoteste e captura sintética.

O workflow só executa em repositório público, em executor Windows padrão, sem infraestrutura contratada. Não faz deploy do site.

## Downloads públicos conferidos

[Release Hot Profiles Desktop 1-1](https://github.com/guilhermemrbf/feramentasdo00duhot/releases/tag/hot-profiles-desktop-1-1), versão 0.1.0:

- Instalador `HotProfiles-0.1.0-x64.exe`: 123.734.476 bytes, SHA-256 `c4912ae7092553f22159dd701554d5c4cb2667f6ad4adb74c2974cc1ae7a104b`.
- Portátil `HotProfiles-0.1.0-x64.zip`: 155.526.877 bytes, SHA-256 `0959c8088abd66cef062acfc31086eb73ff9e379bccd17008bce5adb5e028822`.

Ambos responderam HTTP 200 e foram lidos integralmente em fluxo, conferindo o hash contra o manifesto público e o digest dos assets do GitHub, além da assinatura de formato PE/ZIP. O botão central de download da aplicação só foi atualizado após essa verificação. O commit seguinte de downloads/documentação não altera o executável publicado.

## Limites

Esta entrega instala o gerenciador local; não instala um emulador, navegador, driver de rede ou APK de VPN. BlueStacks e Chrome/Edge são requisitos separados. O instalador inicial não tem assinatura digital comercial.

A camada de isolamento integral do Android continua pendente. O [teste real de proxy](hot-profiles-windows-validation.md) comprovou que o TCP direto pode ignorar o proxy HTTP do sistema e continuar funcionando quando o gateway perde sua proxy. O painel mantém esse limite explícito. DNS, UDP/QUIC, IPv6 e aplicativos específicos não foram certificados.

O encerramento normal tenta restaurar o proxy Android e mantém a janela aberta se a limpeza falhar. Queda de energia ou encerramento forçado ainda exige conferir a configuração da instância. Nenhum recurso promete anonimato, IP exclusivo do fornecedor ou ausência de restrições das redes sociais.
