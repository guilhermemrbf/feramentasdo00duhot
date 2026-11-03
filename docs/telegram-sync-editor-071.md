# Telegram Sync 0.7.1 — somente editor de links

Em 03/11/2026, o titular cancelou o desenvolvimento do encaminhamento por cliques e pediu manter apenas **Trocar links do meu canal**.

## Mudanças entregues no pacote

- A janela abre diretamente no editor, com conexão da conta, indicadores, análise, prévia, aplicação, pausa, restauração e CSV.
- Removidos os formulários de cópia entre canais, sincronização contínua, substituições durante cópias e agendas de automação.
- Removidos o motor de envio/encaminhamento, os módulos de automação e o worker periódico. Abrir o aplicativo não conecta nem publica mensagens.
- Na abertura, tarefas antigas ainda pendentes e agendas são encerradas. Seleções, checkpoints, registros de envio e backups existentes são preservados. Conta e backups do editor permanecem utilizáveis.
- A página, o catálogo e o atalho da plataforma passam a anunciar somente o editor. O encaminhador cloud sem consumidores foi retirado do frontend. O Supabase e os dados remotos não foram alterados.

## Verificações

- 82 testes locais do aplicativo passaram, incluindo permissão de edição, prévia, aplicação, conflitos, restauração, FloodWait, login, UI Windows e migração das filas antigas com dados fictícios.
- 92 testes da plataforma passaram. A primeira execução teve bloqueios de arquivos temporários/localhost; a execução com as permissões apropriadas passou sem mudanças no código dessas ferramentas.
- Compilação de produção da plataforma concluída. Lint dos arquivos frontend alterados sem erros; dois avisos anteriores permanecem em AppShell.
- Autoteste Windows do código-fonte e do executável passou no CI. A imagem `ui-editor.png` do CI foi inspecionada: apenas o editor, v0.7.1, com canal e análise fictícios.
- Uma captura local atingiu outra janela e foi descartada. A geração de capturas do autoteste ficou restrita ao CI; a imagem pública foi obtida do ambiente isolado de testes.
- Nenhuma sessão, credencial ou conteúdo de canal real foi usado nos testes. Não houve edições ou envios reais no Telegram nesta mudança.

## Pacote verificado

- Fonte: `79674243cf9647decca00222423ed18bb7e1fe1b`.
- CI: https://github.com/guilhermemrbf/feramentasdo00duhot/actions/runs/41635346909 — sucesso.
- Release: https://github.com/guilhermemrbf/feramentasdo00duhot/releases/tag/telegram-sync-desktop-18-1.
- ZIP: `TelegramSync-Windows.zip`, **19.115.032 bytes**.
- SHA-256: `a7a90c0d088ee837ba23e8d1d59791896b94dd8e3b7d2bb31202eeba02d54625`.
- O download completo respondeu HTTP 200, tem assinatura ZIP e coincide com o manifesto SHA256SUMS e o digest publicado pelo GitHub. O binário baixado não foi executado no PC do titular; o executável foi testado no Windows do CI.

## Atualização

Feche o executável anterior antes de abrir o novo. A atualização usa a pasta de dados existente e não desinstala versões antigas nem apaga publicações no Telegram. O aplicativo não inclui assinatura digital comercial. A publicação da página Lovable será registrada após sua confirmação no editor e no site público.
