# Mouse Hot para Chrome

Extensão para guardar fotos e vídeos autorizados do Instagram e do TikTok. A mídia é salva pelo Chrome na pasta de downloads configurada, dentro de `Mouse Hot/Instagram` ou `Mouse Hot/TikTok`, organizada por perfil.

## Instalar o ZIP de teste

1. Extraia o ZIP inteiro.
2. No Google Chrome, abra `chrome://extensions` e ative **Modo do desenvolvedor**.
3. Clique em **Carregar sem compactação** e selecione a pasta **Mouse Hot**, onde está o arquivo `manifest.json`.
4. Recarregue um perfil ou uma publicação do Instagram ou TikTok. A barra **Mouse Hot** aparece no canto inferior direito.
5. Clique em **Abrir** na barra, depois em **Baixar** para um arquivo, ou selecione vários e clique em **Baixar seleção**.

Se a versão 0.1.0 estiver instalada, desative-a na tela de extensões antes de carregar esta versão. O ícone na barra do Chrome abre os atalhos do TikTok e do Telegram Web.

Em perfis, **Rolar e procurar** encontra publicações à medida que a página carrega. Se o perfil mostra apenas uma miniatura, use **Abrir** para localizar o arquivo na publicação. A extensão consegue reconhecer a versão MP4 que o próprio Instagram inclui nos dados da página, mesmo quando o player usa `blob:`. A fila confirma a conclusão quando o Chrome termina de salvar.

Se a página disponibilizar apenas segmentos ou um player sem arquivo direto, o painel indica a limitação. URLs temporárias podem exigir que a publicação seja aberta de novo. Quando o autor não puder ser identificado, o arquivo fica na pasta `perfil-nao-identificado`. Use apenas conteúdo que você tenha autorização para baixar.

## Código e validação

É necessário Node.js 24 para reproduzir os testes. O pacote da extensão funciona com Chrome 120 ou mais recente.

```sh
npm ci
npm test
npm run build
node build.mjs --fixture
npm run test:chrome
```

O build instalável fica em `dist/release/Mouse Hot`. Os testes de navegador usam FFmpeg, um Chrome com suporte ao carregamento via DevTools e um perfil descartável. É possível definir o executável por `MOUSE_HOT_CHROME`. A opção `MOUSE_HOT_LIVE=1` inclui uma checagem pública do Instagram, sem conta, e uma leitura de até 512 bytes do MP4 para validar o formato. `dist/fixture` inclui permissões de loopback para os testes e é independente do build distribuído.
