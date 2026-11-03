# Telegram Sync Desktop 0.7.1

Aplicativo gratuito para Windows, dedicado a **Trocar links do meu canal**. A interface contém apenas o editor, a conexão da conta e o histórico de análises e backups. Não depende de Railway, Supabase ou de uma aba Lovable aberta.

## Usar e atualizar

Feche a versão anterior, extraia o ZIP e abra `TelegramSync.exe`. O executável não requer Python. Conta e backups permanecem em `%LOCALAPPDATA%/00duHot/TelegramSync`; não exclua essa pasta durante a atualização.

1. Conecte sua conta no aplicativo, se necessário.
2. Escolha um canal que você administra e informe o novo destino HTTPS.
3. Clique **Analisar canal** para preparar uma prévia sem editar o Telegram.
4. Confira o resultado e confirme **Aplicar todos os links**.

Troca os destinos clicáveis de links ocultos e URLs por extenso, preservando texto visível, linhas, formatação UTF-16 e mídias existentes. Não baixa nem republica arquivos de mídia. Menções e links em botões não são alterados. A conta precisa ser dona do canal ou administradora com permissão para editar mensagens; as permissões são verificadas antes das alterações.

A prévia cobre todos os posts elegíveis da análise. Seleção e filtros servem para conferência, sem reduzir silenciosamente o lote aplicado. Mudar o canal, destino ou opções invalida a aplicação até preparar uma nova prévia. Durante a edição, indicadores e progresso são atualizados na mesma janela. Uma pausa interrompe as próximas edições; um pedido já aceito pelo Telegram pode concluir.

## Backups e recuperação

Textos e entidades originais ficam nas tabelas locais `edit_batches`/`edit_items`. Antes de editar ou restaurar, o programa relê o post; alterações posteriores são preservadas como conflitos. Retomar compara o estado remoto, evitando repetir uma edição já aceita após uma resposta incerta. FloodWait é respeitado e a espera pode ser interrompida. O relatório CSV exclui sessões, credenciais e corpos completos das mensagens.

Credenciais persistidas usam Windows DPAPI. Código de login e senha de duas etapas não persistem. Não há porta HTTP local, serviço pago ou acesso por terceiros à conta. A segurança também depende do dispositivo e do usuário Windows.

## Recursos retirados em 0.7.1

**Copiar para outro canal**, encaminhamento de 100 mensagens, sincronização contínua, substituições durante cópias e agendas de **Automação** foram removidos da interface e do motor executável. Não há worker de publicação em segundo plano. Tarefas e agendas antigas são marcadas como encerradas na abertura, inclusive as pendentes, sem apagar seus registros, checkpoints ou comprovantes de envio. Backups do editor e a conta são preservados. A atualização não apaga publicações no Telegram.

Versões anteriores já instaladas continuam sendo programas independentes; feche-as e use o novo executável. Os documentos de versões anteriores registram o histórico do projeto e não descrevem funções disponíveis nesta versão.

## Executar e empacotar

Windows 10/11 x64 com Python 3.12 e Tcl/Tk: `python -m pip install -r requirements.txt`, depois `python main.py`. Para gerar o executável, execute `./build.ps1` ou o workflow **Telegram Sync Windows** no GitHub Actions do repositório público. O fluxo roda os testes, verifica a interface, empacota com PyInstaller e testa o executável, publicando ZIP e SHA-256 como pré-lançamento. O workflow não executa em repositórios privados para evitar consumo faturável.

Validação: `python -m unittest discover -s tests -v`. Testes usam dados e transporte simulados; os testes Windows incluem Tk e DPAPI. Nenhuma conta real é usada no CI. O executável não inclui assinatura digital comercial.
