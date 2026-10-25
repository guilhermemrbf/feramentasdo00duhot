# Hot Profiles — evidências no Windows (24/10/2026)

## Base e preservação

Base oficial: `175372142e3b756ab01a6bc47f2acd31a33bed8f`, branch remota `main`. Dois checkouts antigos encontrados foram preservados: um com modificações e arquivos não rastreados; outro com três commits locais adicionais. O novo checkout começou limpo. O AGENTS.md da raiz foi lido; regras de mídia local/FFmpeg não foram alteradas. Telegram Sync, nuvem e dados reais do conector não foram modificados. Nenhum deploy foi executado.

O README descrevia a nuvem como interface principal, mas a rota atual já selecionava o modo local por padrão. O README foi alinhado ao código.

## REA

Nenhuma ferramenta REA exposta no cliente desta conversa. CLI local 6.7.0, skill 42; `doctor --client codex --json` reportou registro Codex ausente/config_drift, Node 24.22.1 saudável e provedores nativos/Android indisponíveis ou não configurados. A versão do servidor MCP ativo não foi confirmada. Não houve instalação, setup nem mudança de configuração REA. A investigação usou o código existente, comandos públicos ADB e metadados locais; não houve decompilação.

## BlueStacks e ADB reais

- Executável: `C:\Program Files\BlueStacks_nxt\HD-Player.exe`, versão 5.22.285.1013, PE x64, assinatura Authenticode válida de Now.gg, INC.
- SHA-256: `D2F8509D025F90BD23604AA1C8F6981C456468BCEAB4DB4A30BB380806826F39`.
- HD-Adb incluído: 1.0.36, revisão `6e8ac8fa2d76-android`.
- Antes do teste: ADB local e remoto desabilitados; portas 5037/5555/5595 sem escuta no diagnóstico inicial.
- `Pie64` iniciada sem recriar discos. A habilitação temporária de ADB foi confirmada expressamente pelo usuário e feita por ele na UI oficial porque o controle estava fora dos limites da automação.
- `adb devices`: `emulator-5554` respondeu; após conexão explícita local, `127.0.0.1:5555` também respondeu. São aliases, não duas instâncias.
- Android reportou versão 9 e `sys.boot_completed=1`. `toybox nc` existe; `curl` não foi encontrado no PATH do Android. Nenhuma ferramenta foi instalada no Android.
- `Pie64_4`: porta configurada 5595, status antigo 5555. Não respondeu como endpoint independente nesta validação. A descoberta corrigida não a marcou pronta usando a conexão da Pie64.
- Acesso ADB remoto permaneceu desabilitado durante o teste. O daemon ADB local foi iniciado para a validação; sua presença anterior não foi presumida.

## Rede: o que foi e não foi comprovado

`node tools/hot-profiles/verify-android.mjs --device bluestacks:Pie64` passou no Android real:

1. Aplicação temporária e leitura de volta do proxy HTTP global.
2. ADB reverse para um gateway de teste em 127.0.0.1.
3. Requisição HTTP explícita do Android → gateway → proxy simulada → destino simulado, todos os servidores no host em loopback.
4. Proxy simulada desligada → HTTP 502, sem segunda entrega ao destino.
5. Restauração conferida do valor anterior de proxy e remoção do encaminhamento de teste.

A primeira tentativa de teste não aguardava a resposta após EOF no netcat do Android 9; o cliente de teste foi corrigido para manter stdin aberto por dois segundos. O teste final passou. Esse ajuste não é evidência sobre o comportamento dos aplicativos.

Não houve navegação em contas, captura de tela Android, importação de cookies, leitura de sessões de aplicativos, proxy contratada ou destino externo. O diagnóstico da sessão não devolve o valor bruto da proxy anterior.

**Não comprovados:** IP de saída externo por perfil, DNS real pela proxy, roteamento de aplicativos que ignoram HTTP proxy, UDP/QUIC e bloqueio de toda conexão direta quando a proxy falha. O gateway não oferece fallback direto, mas isso não impede um aplicativo de ignorá-lo. O painel mantém o aviso de isolamento não comprovado.

O computador reportou aproximadamente 7,7 GB de RAM total e 0,9 GB livre com uma instância aberta. Não foi iniciada uma segunda instância simultânea. Separação de duas proxies e falha sem fallback foram validadas por testes de servidores simulados no Windows, não por dois Androids reais.

## Requisitos restantes

Validação automatizada nesta entrega: **83 testes aprovados** no Windows (`npm test`), TypeScript sem erros (`tsc --noEmit`) e build de produção concluído (`npm run build`). O build emitiu avisos de tamanho de chunks e opções/importações de dependências, sem falha. Nenhum comando de deploy foi executado. O ZIP foi regenerado pelo script existente; um teste descompacta e compara seus 11 arquivos com as fontes e confere todos os imports locais. Atributos de fim de linha mantêm o pacote reproduzível entre Windows e Linux.

- Duas proxies de teste fornecidas pelo titular, cadastradas localmente, sem credenciais no Git.
- Medição de memória e capacidade antes de duas instâncias reais simultâneas.
- Confirmação do endpoint ativo da Pie64_4 quando aberta.
- Para oferecer isolamento integral: escolher e implementar roteamento por instância que cubra os aplicativos necessários, DNS e comportamento fail-closed; validar com destinos de teste e proxy indisponível. Esta entrega não instala VPN, certificados, drivers ou regras de firewall.
- Publicação manual do site pelo titular após incorporar a branch. Nenhuma configuração cloud foi aplicada.

Referências primárias consultadas: [BlueStacks: habilitar ADB](https://support.bluestacks.com/hc/en-us/articles/23925869130381-How-to-enable-Android-Debug-Bridge-on-BlueStacks-5) e [Android: ADB e seleção de dispositivos](https://developer.android.com/tools/adb). Instruções públicas não substituem as evidências coletadas neste Windows.
