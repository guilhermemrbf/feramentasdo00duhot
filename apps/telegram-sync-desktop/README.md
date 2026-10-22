# Telegram Sync Desktop

Aplicativo Windows local e gratuito, independente de Railway, Supabase e Lovable. Usa Tkinter, Telethon, SQLite e DPAPI do usuário Windows. Não abre porta HTTP, não inclui credenciais de terceiros e não usa serviços pagos.

## Executar do código

No Windows 10/11 x64 com Python 3.12 e Tcl/Tk: `python -m pip install -r requirements.txt`, depois `python main.py`. Em produção, distribua o executável portátil.

## Gerar o executável sem custo de hospedagem

Execute `./build.ps1` no Windows, ou use o workflow **Telegram Sync Windows** do GitHub Actions no repositório público. Ele testa, empacota com PyInstaller, executa o autoteste Windows (incluindo Tk e DPAPI) e publica um pré-lançamento com ZIP e SHA-256. O workflow é bloqueado em repositórios privados para não consumir franquia potencialmente faturável. Não muda a visibilidade de repositórios e não usa executores grandes.

O executável Windows precisa ser gerado no Windows; não se renomeia um binário Linux como `.exe`. Não inclui assinatura digital comercial. O build local requer Python; usuários do executável não precisam instalá-lo. Dados e conta ficam fora do executável em `%LOCALAPPDATA%/00duHot/TelegramSync`, permitindo atualizar o programa sem apagar tarefas.

## Segurança e retomada

Não há backend nem porta local. Telethon conecta diretamente ao Telegram; credenciais persistidas são protegidas com Windows DPAPI. A segurança depende também da conta e do dispositivo Windows. Código de login e senha 2FA não persistem. O programa não registra conteúdo das mensagens ou respostas brutas do provedor. A sessão `StringSession` só existe em memória e no registro criptografado; nenhum arquivo `.session` é criado.

Um lock de processo impede duas cópias de usarem o mesmo banco. O worker assíncrono opera em thread separada da UI e uma única conexão publica lotes curtos. Cada publicação reserva todos os IDs do álbum em transação antes do envio e confirma mapeamento/checkpoint após a resposta. Envios ambíguos nunca são reenviados automaticamente. Ao reiniciar, tarefas em execução viram pausadas; reservas pendentes exigem revisão. Após revisão manual, pode-se confirmar como enviado sem inventar IDs de destino, ou autorizar uma nova tentativa. Álbuns parcialmente publicados exigem revisão fora do fluxo automático.

A sincronização contínua importa o histórico e depois consulta novos posts. Não replica edições/exclusões, membros, reações, tópicos ou respostas. A conversão de entidades preserva URLs ocultas com offsets UTF-16 e converte formatação em texto simples. Fotos, vídeos e documentos são republicados por referências Telegram; não há armazenamento de mídia no SQLite. Regras são literais, simultâneas e congeladas por tarefa.

## Verificação

`python -m unittest discover -s tests -v`. Testes de DPAPI e interface precisam de Windows; o workflow os executa. Testes de integração real exigem conta Telegram e dois canais próprios/autorizados. Não há garantia de entrega exatamente uma vez entre banco e Telegram; o mecanismo de conferência torna a ambiguidade explícita.
