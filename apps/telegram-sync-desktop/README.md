# Telegram Sync Desktop

Aplicativo Windows local e gratuito, independente de Railway, Supabase e Lovable. Usa Tkinter, Telethon, SQLite e DPAPI do usuário Windows. Não abre porta HTTP, não inclui credenciais de terceiros e não usa serviços pagos.

## Executar do código

No Windows 10/11 x64 com Python 3.12 e Tcl/Tk: `python -m pip install -r requirements.txt`, depois `python main.py`. Em produção, distribua o executável portátil.

## Gerar o executável sem custo de hospedagem

Execute `./build.ps1` no Windows, ou use o workflow **Telegram Sync Windows** do GitHub Actions no repositório público. Ele testa, empacota com PyInstaller, executa o autoteste Windows (incluindo Tk e DPAPI) e publica um pré-lançamento com ZIP e SHA-256. O workflow é bloqueado em repositórios privados para não consumir franquia potencialmente faturável. Não muda a visibilidade de repositórios e não usa executores grandes.

O executável Windows precisa ser gerado no Windows; não se renomeia um binário Linux como `.exe`. Não inclui assinatura digital comercial. O build local requer Python; usuários do executável não precisam instalá-lo. Dados e conta ficam fora do executável em `%LOCALAPPDATA%/00duHot/TelegramSync`, permitindo atualizar o programa sem apagar tarefas.

## Segurança e retomada

Não há backend nem porta local. Telethon conecta diretamente ao Telegram; credenciais persistidas são protegidas com Windows DPAPI. A segurança depende também da conta e do dispositivo Windows. Código de login e senha 2FA não persistem. Os logs não registram conteúdo das mensagens ou respostas brutas do provedor. O editor de canais guarda textos e entidades originais no SQLite local para restauração; esses backups não incluem arquivos de mídia e não são enviados a outro servidor. A sessão `StringSession` só existe em memória e no registro criptografado; nenhum arquivo `.session` é criado.

Um lock de processo impede duas cópias de usarem o mesmo banco. O worker assíncrono opera em thread separada da UI e uma única conexão publica lotes curtos. Cada publicação reserva todos os IDs do álbum em transação antes do envio e confirma mapeamento/checkpoint após a resposta. Envios ambíguos nunca são reenviados automaticamente. Ao reiniciar, tarefas em execução viram pausadas; reservas pendentes exigem revisão. Após revisão manual, pode-se confirmar como enviado sem inventar IDs de destino, ou autorizar uma nova tentativa. Álbuns parcialmente publicados exigem revisão fora do fluxo automático.

A sincronização contínua importa o histórico e depois consulta novos posts. Não replica edições/exclusões, membros, reações, tópicos ou respostas. A conversão de entidades preserva URLs ocultas com offsets UTF-16 e converte formatação em texto simples. Fotos, vídeos e documentos são republicados por referências Telegram; não há armazenamento de mídia no SQLite. Regras são literais, simultâneas e congeladas por tarefa.

## Verificação

`python -m unittest discover -s tests -v`. Testes de DPAPI e interface precisam de Windows; o workflow os executa. Testes de integração real exigem conta Telegram e dois canais próprios/autorizados. Não há garantia de entrega exatamente uma vez entre banco e Telegram; o mecanismo de conferência torna a ambiguidade explícita.

## Correção 0.1.1

O login agora permite até três novas tentativas na camada MTProto, necessárias quando o Telegram exige troca de data center. A versão anterior, com `request_retries=0`, era reproduzivelmente incapaz de concluir `auth.sendCode` após `PHONE_MIGRATE`. O teste de regressão exercita o código real `_call` do Telethon com transporte simulado, sem conta ou tráfego Telegram. Depois do login, a conexão é fechada e restaurada sob a política de publicação sem repetição automática. Erros conhecidos têm mensagens específicas; erros desconhecidos mostram apenas o nome da classe, nunca a resposta bruta ou as credenciais. Telefone aceita formatação comum e é normalizado antes do envio.

## Editor de canais 0.2.0

A aba **Editar links no canal** usa a conta salva para listar canais administrados, analisar todo o histórico sem alterá-lo e exibir uma prévia persistente. Troca os destinos de entidades `MessageEntityTextUrl` (Ctrl+K), mantendo o texto clicável, formatação UTF-16 e mídias existentes. URLs por extenso podem ser incluídas por opção: o texto visível permanece e o destino clicável é alterado. Menções e posts com teclados de botões são ignorados. A prévia considera todos os links elegíveis, não apenas links de bot ou textos específicos: confira antes de aplicar.

O destino inicial é `https://t.me/vipacessoliberado_bot`. A opção de limpeza remove apenas linhas cujo texto, sem emojis/espaços/pontuação, seja “outros grupos” ou “Hentai”. Não apaga publicações inteiras, não altera títulos de canais e não baixa arquivos. Uma legenda que ficaria vazia é ignorada.

O editor exige canal broadcast e conta dona ou administradora com `edit_messages`, tanto na análise quanto na aplicação/restauração. A proteção contra encaminhamento não bloqueia a edição legítima do próprio canal. Sincronizações precisam ser pausadas antes de editar. A aplicação requer confirmação do canal, ID, destino e quantidade no aplicativo. Não há alterações ao apenas abrir, listar canais ou analisar.

Backups e propostas ficam nas tabelas locais `edit_batches`/`edit_items`, separados das filas de sincronização. Antes de cada edição o conteúdo é relido: se mudou desde a prévia, é marcado como conflito e preservado. A restauração só é aplicada se o post ainda corresponde à proposta; não sobrescreve alterações posteriores. Interrupções e respostas ambíguas ficam pausadas; a retomada primeiro compara o estado remoto, sem repetir uma edição já confirmada. Análises incompletas não podem ser aplicadas. FloodWait é persistido e impede retomada antes do prazo. O programa respeita os limites do Telegram, mas não pode garantir ausência de novos limites.

Testes automatizados usam transporte simulado. A verificação final no canal real depende da sessão e da confirmação do usuário no Windows; não há credenciais de Telegram disponíveis no ambiente de desenvolvimento.

## Interface 0.3.0

Visual inspirado no painel 00duHot: fundo escuro, destaque azul, menu lateral, cartões de indicadores e páginas com rolagem. Sem bibliotecas adicionais, servidor HTTP, cobrança ou migração do banco existente. A sessão, as tarefas, as regras e os backups continuam na mesma pasta.

A visão geral mostra os resultados das sincronizações. “Publicadas” conta somente registros `sent`, incluindo os confirmados pelo operador; `skipped` e `sending` não são publicados. A coluna antiga `processed` inclui ignoradas e não é mais exibida como publicadas. O número da última mensagem nunca vira porcentagem, pois IDs podem ter lacunas. A tabela tem busca, filtros por estado e ações habilitadas conforme a tarefa selecionada. A criação abre um formulário em três etapas e continua criando tarefas pausadas.

O editor tem indicadores próprios para a análise selecionada, progresso sobre o conjunto conhecido de propostas e comparação original/proposta lado a lado. Durante a análise, o progresso é indeterminado. Estados e contadores são atualizados sem recarregar os backups a cada edição. Busca e filtro alteram apenas a visualização: a aplicação mantém o escopo da análise salva e confirma a quantidade completa antes de editar. Restauração e conferência de envio permanecem com confirmação explícita.

Os testes reais de Tk verificam navegação, busca, filtros, publicação versus ignoradas/sem confirmação, atualizações do editor, ações bloqueadas e rolagem em 980×640. Executam no Windows no workflow; em Linux requerem display gráfico. Não acessam Telegram. Horários da atividade usam o fuso local do computador.

## Interface e seleção 0.4.0

Marca original 00duHot incorporada ao executável, paleta neutra e destaque dourado discreto. O editor aceita seleção múltipla com Ctrl/Shift e escopo explícito: toda a análise ou somente os selecionados. O motor local valida todos os IDs antes de conectar ao Telegram; seleção inválida não inicia operações. Propostas não selecionadas continuam pendentes e a análise permanece disponível para retomada. Filtros de busca continuam alterando apenas a visualização.

O relatório CSV é exportado somente por ação do operador. Inclui canal, destino, ID, título, situação e contagem de links; exclui sessão, API Hash e corpos completos. Campos com prefixos interpretáveis como fórmulas por planilhas são escapados. Não há alteração de esquema do banco. A marca é incluída com `--add-data` e o autoteste verifica que foi carregada tanto do código quanto do executável.
