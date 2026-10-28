# Telegram Sync 0.6.0 — encaminhar até 100 mensagens no total

Solicitação de 28/10/2026: reproduzir a seleção/encaminhamento das imagens do titular, ocultando nomes de autores, mantendo legendas e limitando a uma única seleção de até 100 mensagens. O titular confirmou **somente 100 mensagens no total**, sem repetir lotes.

## Operação

1. Em Copiar para outro canal, informe origem/destino ou use Selecionar para pesquisar os canais e grupos da conta conectada.
2. Mantenha Até 100 mensagens · ocultar autores e confirme autorização.
3. Preparar encaminhamento apenas lê a seleção e cria uma tarefa pausada. Confira nomes dos canais e quantidade.
4. Iniciar cópia publica a seleção em ordem cronológica e termina.

A seleção começa pelas mensagens mais recentes disponíveis no momento da preparação. Cada mídia conta como uma mensagem. Álbuns são indivisíveis; quando o próximo exceder 100, fica inteiro de fora, sem preencher a diferença com posts ainda mais antigos. Avisos de serviço não entram. Portanto o total pode ser menor que 100. Não há remoção de nomes dentro do texto ou de marcas na mídia.

O modo anterior de histórico completo/substituições é uma escolha separada. Tarefas existentes mantêm seu método, regras e checkpoints. O novo modo não usa regras de substituição e não acompanha novos posts. Recriar uma tarefa é outra seleção das mais recentes e pode duplicar mensagens já copiadas.

## Implementação e verificações

- Fonte do executável: `9077020b7752e4be171059152375cdb93fe97810`.
- Encaminhamento nativo Telethon 1.40.0 com `drop_author=True` e `drop_media_captions=False`. [Documentação primária](https://docs.telethon.dev/en/stable/modules/client.html#telethon.client.messages.MessageMethods.forward_messages), conferida também no código da versão fixada. O teste exercita a construção de um único pedido com até 100 IDs da mesma origem.
- IDs congelados no SQLite. Migração aditiva mantém tarefas antigas como rewrite. Reservas, confirmação, FloodWait e conferência manual de resposta incerta reutilizam as proteções existentes.
- Conteúdo protegido é bloqueado; permissões de origem/destino são verificadas novamente antes de publicar. Mensagem selecionada apagada/inacessível bloqueia o envio para preparar outra seleção.
- 95 testes Python aprovados no Windows local e no CI: limite, álbuns, ordenação, resposta parcial, timeout sem reenvio automático, FloodWait, migração preservando checkpoint, seletor de canais, interface e regressões de login/editor.
- Autoteste Tk/DPAPI do código e smoke test do executável aprovados. Layout verificado em 980×640; capturas do CI revisadas mostram formulário 0.6.0 e tarefa fictícia de 98 mensagens pausada.
- Nenhuma conta/sessão real foi acessada, e nenhum envio real foi executado. Mídias, aparência e permissões em canais reais ainda precisam do teste do titular.

## Download

[Release Windows 0.6.0](https://github.com/guilhermemrbf/feramentasdo00duhot/releases/tag/telegram-sync-desktop-16-1) · [CI aprovado](https://github.com/guilhermemrbf/feramentasdo00duhot/actions/runs/40704068515).

`TelegramSync-Windows.zip`: 19143218 bytes; SHA-256 `fa529deeabc13ba2d36b9f3e662635c8c0fb52b2144f0d6c31f311ae4368af43`. Download integral por streaming, HTTP 200, assinatura ZIP e hash coincidentes com manifesto e digest GitHub. O binário público não foi executado no PC do titular; o CI executou o binário que gerou.

A atualização preserva a pasta local de dados. Nenhuma migração Supabase, provedor pago, regra do Hot Profiles ou configuração do BlueStacks foi alterada.
