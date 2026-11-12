# Mouse Hot para Chrome

Extensão para guardar fotos e vídeos autorizados do Instagram e do TikTok. A mídia é salva pelo Chrome na pasta de downloads configurada, dentro de `Mouse Hot/Instagram` ou `Mouse Hot/TikTok`, organizada por perfil.

## Instalar o ZIP de teste

1. Extraia o ZIP inteiro.
2. No Google Chrome, abra `chrome://extensions` e ative **Modo do desenvolvedor**.
3. Clique em **Carregar sem compactação** e selecione a pasta **Mouse Hot**, onde está o arquivo `manifest.json`.
4. Recarregue um perfil ou uma publicação do Instagram ou TikTok. A barra **Mouse Hot** aparece no canto inferior direito.
5. Abra a barra e clique em **Baixar** na publicação que deseja salvar. Para um lote, marque as publicações ou use **Selecionar tudo** e clique em **Baixar seleção**.

Se uma versão anterior estiver instalada, desative-a na tela de extensões antes de carregar a pasta da versão 3.0. O ícone na barra do Chrome abre os atalhos do Instagram e do TikTok.

Quando a grade do Instagram mostra só uma miniatura, **Baixar** consulta a própria publicação em segundo plano. As fotos e os vídeos de um carrossel são arquivos separados. **Baixar todas as mídias** procura mais publicações ao rolar o perfil e envia somente fotos e vídeos para a fila. **Exportar dados (JSON)** é uma ação separada que salva `perfil.json` com os campos visíveis identificados. Se quiser baixar um arquivo novamente, use **Baixar** na publicação.

O painel informa quando chega ao limite de 350 itens ou 75 segundos de rolagem por busca. A resolução dos arquivos acontece depois da rolagem. A extensão pode verificar o vídeo sem pedir um trecho quando a leitura parcial falha. Se o Instagram fornecer mais de uma versão direta do vídeo, a fila tenta outra quando a origem falha ou o Chrome informa um erro de rede. No Instagram, **Tentar de novo** consulta a publicação para obter o endereço atual do arquivo que falhou. O painel sinaliza publicações e partes de carrosséis sem arquivo disponível. A fila confirma a conclusão quando o Chrome termina de salvar. Se o navegador estiver configurado para perguntar onde salvar cada download, o Chrome pode solicitar o destino de cada arquivo.

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
