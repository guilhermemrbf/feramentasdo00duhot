# Telegram Sync 0.5.0 — tela única

O aplicativo Windows agora usa uma janela principal, com dashboard fixo no topo e uma área de operação com rolagem. Não há menu lateral, navegação entre páginas ou janela separada para criar tarefas e conectar a conta. Confirmações de alterações e o seletor de arquivo continuam usando os diálogos do Windows.

| Antes | Agora |
| --- | --- |
| Cinco áreas no menu lateral | Dois objetivos na mesma tela: copiar publicações ou trocar links |
| Dashboard em outra página | Números de cópia sempre visíveis, inclusive ao rolar |
| Formulário de tarefa em janela auxiliar | Origem, destino e criação na própria tela |
| Verificar canais e depois criar | Validação de canais feita ao criar |
| Todos os campos de login visíveis | Código e 2FA mostrados somente quando solicitados |
| Opções e ações com o mesmo destaque | Regras, filtros, histórico, restauração e CSV recolhidos |
| Aplicação de uma prévia após mudar campos | Mudança nos campos exige preparar nova prévia |

## Fluxos

**Copiar:** conectar a conta → escolher Copiar para outro canal → informar origem e destino → confirmar autorização → Criar sincronização → conferir os canais na lista → Iniciar cópia. A tarefa continua nascendo pausada. O modo padrão é somente histórico; acompanhar novos posts é uma escolha explícita. Regras existentes continuam sendo copiadas para a tarefa no momento da criação.

**Editar links:** escolher Trocar links do meu canal → selecionar o canal e informar o novo destino → Ver prévia → conferir antes/depois e escopo → Aplicar alterações → confirmar o resumo final. A análise não modifica publicações. Restauração, conferência de conflitos, proteção dos backups e seleção múltipla foram mantidas.

O dashboard do topo mostra cópias confirmadas, tarefas em execução, pausadas e com atenção. Os contadores da prévia se referem apenas à análise de edição selecionada; não são somados às cópias.

## Preservação e requisitos

Não há migração de banco, novo serviço externo, custo de hospedagem ou mudança no armazenamento das sessões, tarefas e backups. O programa continua local e requer computador ligado, internet, aplicativo aberto e conta com as permissões necessárias nos canais. Atualizar consiste em fechar a versão anterior, extrair o novo ZIP e abrir o executável, preservando `%LOCALAPPDATA%/00duHot/TelegramSync`.

Nenhuma operação inicia apenas ao abrir, alternar o objetivo ou expandir opções. A autorização de cópia continua obrigatória. A política de não reenviar automaticamente publicações ambíguas foi preservada, assim como as restrições do Telegram e a proteção de credenciais pelo DPAPI. Os testes usam conta/transporte simulados; não acessam canais reais.

## Validação

- 74 testes locais aprovados com interface gráfica virtual; os 2 testes de DPAPI exigem Windows.
- Autoteste da interface do código-fonte aprovado.
- Regressão de tamanho verifica dashboard fixo e botões principais dentro da área visível em 980×640.
- Testes verificam janela única sem Notebook/Toplevel de tarefa, campos progressivos de login, seções recolhidas, tarefas pausadas, contadores, seleção e invalidação de prévia após mudança de campos.
- 76 testes aprovados no Windows, incluindo proteção DPAPI e a regressão de janela pequena; autotestes da interface e do EXE também aprovados.
- Site: TypeScript, 51 testes web e build de produção aprovados; nenhuma publicação realizada.

## Download verificado

- Aplicativo: `5ce3e8e4505955f2e062b466b0929dfe18488338`.
- Release: https://github.com/guilhermemrbf/feramentasdo00duhot/releases/tag/telegram-sync-desktop-11-1
- Workflow Windows: https://github.com/guilhermemrbf/feramentasdo00duhot/actions/runs/39886550573
- ZIP: https://github.com/guilhermemrbf/feramentasdo00duhot/releases/download/telegram-sync-desktop-11-1/TelegramSync-Windows.zip
- Tamanho: 19132629 bytes.
- SHA-256: `8ff30d63387f0d778b561c42c3d3ecf518a89d86836cc85f5bce6d1dc57f88a5`.

O ZIP foi baixado, conferido contra SHA256SUMS.txt e validado: arquivo íntegro, executável Windows PE e instruções 0.5.0 corretas. As capturas da interface Windows na release usam dados temporários de teste. O site recebeu apenas instruções e link atualizados para publicação manual pelo titular. Não houve deploy nem contratação de infraestrutura.
