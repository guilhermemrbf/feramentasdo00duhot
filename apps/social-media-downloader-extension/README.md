# 00 do Hot — extensão para baixar mídias (MVP)

Extensão independente para Chrome/Edge com Manifest V3, instalada localmente sem modificar a aplicação web.

## Instalação

1. Abra chrome://extensions no Chrome (ou edge://extensions no Edge).
2. Ative Modo do desenvolvedor.
3. Escolha Carregar sem compactação e selecione a pasta apps/social-media-downloader-extension.
4. Acesse um post/Reel do Instagram ou vídeo/foto do TikTok e atualize a aba caso ela já estivesse aberta.
5. Clique no ícone da extensão, selecione Baixar ou Baixar disponíveis.
6. Se houver carrossel, avance os slides no site e escolha Atualizar na extensão.

Os arquivos são destinados a Downloads/00-do-hot/instagram ou Downloads/00-do-hot/tiktok, com nomes sem caracteres perigosos e resolução de nomes repetidos pelo navegador.

## O que realmente faz

- Examina apenas elementos de imagem e vídeo que já estão no DOM da aba permitida. Não exige senha nem coleta tokens.
- Usa chrome.downloads para URLs diretas HTTPS encontradas no elemento de mídia.
- Exibe quando um vídeo usa blob: (streaming/mídia em memória), sem fingir que foi baixado.
- Identifica imagem/vídeo, fornece download individual e inicia múltiplos downloads sob ação explícita do usuário.
- Consulta o estado real do download no Chrome enquanto o popup estiver aberto. Iniciar download NÃO significa concluir.
- Em feeds e carrosséis, a detecção é limitada às mídias já carregadas; navegue no site e atualize para descobrir outras.

## Limitações importantes

- URLs temporárias podem expirar ou ser recusadas pelo CDN. O Chrome pode interromper o download.
- Uma imagem na grade pode ser apenas a miniatura, não o original. A extensão não promete resolução original.
- Conteúdo privado sem autorização, mídia protegida, streams por segmentos/MSE ou vídeos com blob: não são contornados.
- Não acessa APIs privadas, não faz interceptação de rede, não remove DRM e não automatiza login.
- A extensão foi criada isoladamente porque não havia código de extensão no repositório consultado; se a versão antiga estiver no computador, compare antes de substituí-la.
- Não há servidor externo nem transmissão de mídias para infraestrutura própria.
- Use somente com arquivos cuja obtenção é permitida e respeite direitos autorais e termos das plataformas.

## Testes

A partir da raiz do projeto, execute:

    npm test

Ou somente o conjunto novo:

    node --test tests/social-media-downloader-extension.test.mjs

Os testes de unidade usam documentos e API Chrome simulados. A validação de download de arquivos reais ainda precisa ser feita manualmente em Chrome/Edge com conteúdo autorizado; não trate mocks como comprovação de download real.
