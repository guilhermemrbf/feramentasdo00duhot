# Atualização 00duHot / Telegram Sync 0.4.0

## Experiência

Identidade original com a marca fornecida, paleta neutra, tipografia de sistema e sem gradientes decorativos. Navegação por objetivo, busca global com Ctrl/Cmd+K, favoritos e recentes locais. As nove ferramentas continuam disponíveis. Cada área explica entrada, resultado, etapas e requisitos reais. Nenhum serviço pago foi contratado e o site não foi publicado por esta atualização.

| Ferramenta | Melhoria |
| --- | --- |
| Telegram Sync Windows | Marca incorporada, seleção múltipla, aplicação/restauração por escopo e relatório CSV local |
| Image Links | Upload sequencial, cancelar, repetir falhas manualmente, links escapados e download de lista |
| Criar Tela Privacy | Gerar sem espera artificial, validar referências HTTPS, rascunho local opcional e download de prompt |
| Limpar Metadados | Cancelamento individual, retomada sem repetir concluídos, extensão correta e liberação de recursos |
| Otimizar Criativos | Marca decodificada uma vez por vídeo, cancelamento e reexportação local |
| Gerar Preview | Cancelamento, novas tentativas e extensão de arquivo consistente com o formato real |
| Automatic Post | Horários validados, fila manual honesta no TikTok e bloqueio de programação passada no Instagram |
| Funil | Visual sóbrio, guia e busca de projetos |
| Hot Profiles | Guia de integração e relatório de perfis sem credenciais |

A limpeza em lote com FFmpeg mantém o processamento local, worker único e escrita ZIP sequencial. Não foi substituída. As ferramentas individuais usam um renderizador local compartilhado com liberação de trilhas, frames e URLs temporárias ao concluir, falhar ou cancelar.

## Configurações e limites

- Desktop: API ID/Hash próprios, login Telegram e permissão nos canais. Dados existentes permanecem em `%LOCALAPPDATA%/00duHot/TelegramSync`; computador ligado, aplicativo aberto e internet. Não contorna proteção de conteúdo.
- Image Links: Cloudinary cloud name e unsigned preset existentes precisam estar válidos; arquivos são hospedados publicamente. Limpar a lista local não apaga arquivos hospedados.
- Instagram: Supabase, OAuth Meta, conta profissional, permissões e worker existentes precisam estar configurados. Esta atualização não cria hospedagem para o worker.
- TikTok: fila e publicação manual; não há promessa de postagem automática em segundo plano.
- Hot Profiles: depende do provedor/ponte configurados. Eventuais preços e limites desse provedor são externos; nenhum plano foi contratado.
- Testes automatizados não publicam mensagens reais, não fazem login em contas e não enviam mídia do usuário. Integrações externas precisam ser validadas com as configurações do titular.

## Atualizar

Site: publicar manualmente pelo fluxo atual. Desktop: fechar a versão anterior, extrair o novo ZIP e abrir TelegramSync.exe. Não apagar a pasta de dados. O workflow público testa Tk/DPAPI, compila no Windows, executa o autoteste do EXE e só então publica ZIP e SHA256SUMS. Isso distribui o aplicativo; não faz deploy do site.

## Validação desta atualização

- TypeScript sem erros e build de produção concluído.
- 51 testes web, incluindo seleção/repetição de arquivos, horários, cancelamento, liberação de recursos e relatório sem credenciais.
- 72 testes desktop aprovados no Windows, incluindo GUI e DPAPI. No Linux, 63 passaram e 9 foram corretamente ignorados por exigirem GUI/Windows.
- Navegador: navegação, busca global e exportação de vídeo sintético. O WEBM exportado foi decodificado sem erros e contém vídeo VP8 (240×160) e áudio Opus.
- A captura `workspace-0.4.0.jpg` registra a interface na revisão local.

## Distribuição verificada

Release: https://github.com/guilhermemrbf/feramentasdo00duhot/releases/tag/telegram-sync-desktop-9-1

Código do aplicativo: `760aa6cff33f6952c965ea258d05b9632ce6ea14`. Workflow Windows concluído com sucesso: https://github.com/guilhermemrbf/feramentasdo00duhot/actions/runs/39788016679 . Autotestes do código-fonte e do executável passaram.

ZIP de 19.133.687 bytes, baixado e verificado: arquivo íntegro, executável Windows PE válido e LEIA-ME 0.4.0 com orientações de seleção múltipla. SHA-256: `1467319a33192c3bbb7ca86cae5266e92a77c973f743d2c72d523ce4f7795cca`. Conferido contra SHA256SUMS.txt da release. Capturas reais da interface Windows do fixture temporário estão anexadas à release.

As integrações com contas e serviços reais permanecem dependentes das configurações do titular e não foram exercitadas com credenciais reais neste trabalho.
