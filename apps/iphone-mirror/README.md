# Fazenda de Celulares

Aplicativo para Windows 10/11 de 64 bits para ver a tela do iPhone por USB e controlá-lo no iOS 27 ou posterior. Execute o instalador e abra **Fazenda de Celulares** no menu Iniciar. A instalação usa a conta atual do Windows.

## Usar por USB

1. Conecte um iPhone desbloqueado com cabo de dados. Confirme **Confiar** no iPhone se o aviso aparecer.
2. Clique em **Buscar iPhones**, selecione o aparelho e clique em **Conectar e abrir tela**.
3. Se o aplicativo indicar Modo de Desenvolvedor, ative em **Ajustes → Privacidade e Segurança → Modo de Desenvolvedor** e confirme no iPhone depois que ele reiniciar. Na primeira conexão de vídeo do iOS 27, a preparação dos serviços do iOS pode precisar de internet e demorar alguns minutos.
4. Para trocar de iPhone, clique em **Parar** e escolha o outro aparelho. A janela apresenta um aparelho por vez.

Se a busca ficar vazia, confira se o iPhone aparece no app Dispositivos Apple, experimente outra porta do PC e um cabo que transmita dados. Se a etapa de vídeo falhar com câmera ou microfone em uso, feche no iPhone o aplicativo que os estiver usando. [Guia da Apple para reconhecimento USB](https://support.apple.com/pt-br/108643) · [Modo de Desenvolvedor](https://developer.apple.com/documentation/xcode/enabling-developer-mode-on-a-device).

## Modos de imagem

| Histórico dos aparelhos | Modo selecionado | Requisitos |
| --- | --- | --- |
| iPhone12,3 · iOS 27.2 | Vídeo contínuo por USB em HEVC | Cabo de dados, confiança, Modo de Desenvolvedor e imagem de desenvolvimento com o serviço de vídeo |
| iPhone13,2 · iOS 26.6.1 | Capturas sucessivas via Instruments | Cabo de dados, confiança e Modo de Desenvolvedor |

A seleção vale para qualquer iPhone detectado com iOS 17.4 ou posterior. A transmissão do iOS 27 usa o túnel local do pymobiledevice3 e um decodificador HEVC incluso. A janela não grava as imagens. [Guia upstream de espelhamento](https://doronz88.github.io/pymobiledevice3/latest/guides/screen-mirroring/) · [Captura Instruments](https://doronz88.github.io/pymobiledevice3/latest/cli/developer/#dvt-screenshot).

## Usar o mouse e o teclado

Pressione **Voltar** ou **Alt + ←** para executar o gesto lateral do iOS em telas que aceitam essa navegação. **Início** retorna à Tela de Início. Com o vídeo ao vivo, clique na imagem para tocar e passar o foco do teclado ao iPhone. Clique e arraste para deslizar ou use a roda do mouse para rolar. Os botões **Início**, **Bloquear** e **Volume** ficam na lateral. **Ctrl+V**, com foco na imagem, envia o texto da área de transferência ao iPhone e cola no campo em foco. Isso também funciona para texto acentuado. A digitação direta usa o layout de teclado físico configurado no iPhone.

Pressione **F11** ou clique em **Tela cheia** para recolher a lateral e ampliar a imagem. Pressione **Esc** para voltar. O aplicativo encaixa a imagem sem cortar a tela do iPhone. Ao clicar na imagem, um círculo marca o ponto tocado e **Teclado no iPhone** indica para onde vão as teclas.

Ao sair da imagem, o aplicativo solta as teclas que ficaram pressionadas. Os comandos seguem pela sessão USB do aparelho selecionado. No iOS 26 ou anterior o modo por capturas permanece visual. Para login, desbloqueio e confirmações, continue seguindo as telas apresentadas pelo iOS.

## Outros caminhos no Windows

- **AirPlay por Wi-Fi.** O iPhone e o PC precisam da mesma rede e o Windows precisa de um receptor, como UxPlay. O receptor é um componente separado deste executável. [AirPlay da Apple](https://support.apple.com/en-gb/102661) · [UxPlay para Windows](https://github.com/FDH2/UxPlay#building-uxplay-on-microsoft-windows-using-msys2-with-the-mingw-64-compiler).
- **HDMI com placa de captura USB.** Nos iPhones acima, um adaptador Lightning Digital AV fornece HDMI. Ligue o HDMI a uma placa de captura USB do PC e selecione a placa como fonte de vídeo, por exemplo no OBS. Esse método usa a saída de vídeo do iPhone. [Adaptadores AV documentados pela Apple](https://support.apple.com/pt-br/108399).

## Gerar e verificar

Em Windows x64 com NSIS 3, Python 3.12 e Tcl/Tk:

```powershell
.\build.ps1
.\.venv\Scripts\python.exe -m unittest -v test_mirror
```

O script gera o instalador Windows em dist depois de validar o decodificador HEVC e a consulta USB no aplicativo empacotado. O log fica em %LOCALAPPDATA%/iPhoneEspelho/espelho.log.

Validação da versão 0.2.0 em 18/11/2026 no Windows. A janela do executável de Downloads abriu e respondeu. O diagnóstico do mesmo binário carregou HEVC e fez a busca USB com o serviço Apple ativo. A busca retornou zero aparelhos. Quatro testes passaram, incluindo a decodificação de um quadro HEVC gerado no teste. Ainda falta receber o primeiro quadro de um iPhone físico.

Validação da versão 0.3.0 em 18/11/2026. O iPhone físico com iOS 27.2 enviou vídeo por USB, e o teste recebeu um quadro de 507 × 1100 após o redimensionamento. A sessão abriu os serviços de entrada e enviou com sucesso um relatório de liberação de toque e um de liberação de teclado. O executável em Downloads abriu e estabeleceu o canal local de vídeo. Oito testes passaram. A verificação visual da resposta a cliques e digitação na janela deve ser feita em um app local, como uma nota em branco.

Validação da versão 0.4.0 em 18/11/2026. Dez testes passaram. Um teste de janela com imagem de referência conferiu o encaixe sem distorção, a transição para tela cheia e a volta da lateral. A altura da imagem passou de 775 para 864 pixels na configuração testada. O executável de Downloads abriu maximizado, detectou o iPhone físico e estabeleceu a conexão local de vídeo depois de **Conectar e abrir tela**.

Validação da versão 0.5.0 em 18/11/2026. Os 13 testes automatizados passaram. O executável de Downloads detectou um iPhone pelo USB, carregou o decodificador HEVC e exibiu a tela real do aparelho em sua janela. O teste da janela com o iPhone físico em iOS 26.6.1 exibiu capturas reais, alternou para tela cheia, restaurou a lateral e encerrou a sessão. No mesmo aparelho, alternando a espera antiga de 450 ms e a captura sem essa espera, o intervalo mediano observado caiu de cerca de 680–690 ms para cerca de 225–235 ms. Essa medida descreve o intervalo entre capturas USB durante o teste.

No iOS 26.6.1 conectado, o túnel do aparelho não anunciou os serviços de vídeo contínuo, toque e teclado ou botões usados pelo modo com controle. A busca por identificadores WebDriverAgent e .xctrunner não encontrou um agente instalado. Para controle com esse mesmo modo no iPhone 12, a Apple lista o modelo como compatível com o iOS 27. O controle nesse aparelho após atualização ainda precisa ser validado. Caso seja necessário manter o iOS 26, o Appium no Windows exige WebDriverAgent previamente assinado e instalado ou administrado externamente. [Compatibilidade do iOS 27](https://support.apple.com/guide/iphone/iphone-models-compatible-with-ios-27-iphe3fa5df43/27/ios/27) · [Appium no Windows](https://appium.github.io/appium-xcuitest-driver/latest/guides/non-macos-hosts/).

Na comparação física, o iPhone com iOS 27.2 ligado por USB anunciou os três serviços usados pelo modo ao vivo (vídeo, toque e teclado, e botões). O Modo de Desenvolvedor estava ativo nos dois aparelhos. O recorte da barra de status do iOS 27.2 durante a sessão mostrou o ícone roxo de monitor com uma pessoa. O iPhone 12 de testes, com iOS 26.6.1, forneceu capturas por USB e não anunciou esses serviços. Nenhum teste comparativo de latência de toque foi feito entre os dois aparelhos. A próxima validação do iPhone 12, após atualização para iOS 27, é verificar vídeo ao vivo, clique, arraste e digitação em um app de teste pelo Windows.

Validação da versão 0.6.0 em 19/11/2026. Dezesseis testes automatizados do aplicativo passaram. A janela Windows abriu com a marca atual, detectou o estado sem dispositivo e voltou da tela cheia. O iPhone 12 com iOS 27.2.1 respondeu a cliques, digitação e rolagem no teste anterior com a versão 0.5.0, inclusive com AssistiveTouch ativo. Os novos gestos da versão 0.6.0 ainda aguardam repetição no aparelho físico. Consulte THIRD-PARTY-NOTICES.md para licenças e fontes.
