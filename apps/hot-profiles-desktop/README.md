# Hot Profiles Desktop — Windows 0.1.0

Aplicativo local com janela própria, instalador por usuário e execução do conector incluída. Reutiliza os formulários, central de proxies, sessões, navegador e adaptador Android do projeto. Não depende de site publicado, Supabase, Railway ou Node.js instalado pelo usuário. Não inclui um emulador, Chrome/Edge ou proxy contratada.

## Uso

1. Execute o instalador Windows e abra **Hot Profiles** pelo atalho. Não precisa de administrador nem código de pareamento.
2. Feche o conector antigo antes de abrir o aplicativo: ambos usam a mesma pasta de dados e o bloqueio impede duas cópias simultâneas.
3. Cadastre uma proxy e um perfil. Use uma conexão diferente por perfil e confira o resultado dos testes; cadastros separados não garantem IPs diferentes no fornecedor.
4. Para navegador, tenha Chrome ou Edge instalado. Cada perfil guarda seus próprios dados. Para Android, tenha BlueStacks instalado e escolha uma instância independente com ADB local habilitado.
5. Encerre os ambientes pelo painel. Ao fechar a janela, o aplicativo tenta encerrar navegadores e restaurar o proxy Android. Se a restauração falhar, a janela permanece aberta para você conferir e tentar novamente. A instância Android permanece ligada; feche-a pelo BlueStacks para liberar memória.

Os perfis e proxies continuam em `%LOCALAPPDATA%\00duHot\HotProfiles`, fora da instalação. Atualizar ou desinstalar o programa preserva essa pasta. Faça backup de toda a pasta, incluindo a chave local. O aplicativo não importa cookies do navegador nos aplicativos Android: use login normal do titular. A execução local não remove requisitos ou restrições das redes sociais.

## Limites de rede

O teste com uma proxy real demonstrou que o HTTP explícito passa pelo gateway, mas TCP direto do Android pode ignorar o proxy HTTP do sistema. Esta versão mantém o aviso de isolamento não comprovado; não oferece VPN, bloqueio integral quando a proxy falha ou validação de todos os aplicativos/DNS/UDP/IPv6. Essa camada ainda precisa ser desenvolvida e testada. O navegador também precisa de validação específica de IP, DNS e caminhos de saída antes de prometer isolamento integral.

Não expor as portas locais na internet. O serviço usa porta dinâmica em 127.0.0.1 e autenticação transmitida ao painel somente pelo canal privado do aplicativo, sem token em URL, arquivo de configuração ou log. O renderer tem sandbox, isolamento de contexto e não possui acesso Node.js. Conteúdo externo não é carregado na janela principal.

Queda de energia ou encerramento forçado pelo Windows pode impedir a restauração do proxy Android. Nessa situação, confira a configuração da instância antes de usá-la novamente. Abrir o painel não habilita ADB nem inicia seu daemon quando a depuração está desabilitada e não existe servidor ADB local.

O instalador inicial não possui assinatura digital comercial. Ele não instala serviços Windows nem configura inicialização automática. Não há atualizador automático: novas versões são baixadas por ação do usuário. Não é preciso desinstalar o BlueStacks ou apagar instâncias para atualizar o Hot Profiles.

## Desenvolvimento e verificação

Na raiz do repositório, instale as dependências do projeto. Depois:

```text
npm ci --prefix apps/hot-profiles-desktop
npm run profiles:desktop:build
npm run profiles:desktop:start
```

Build Windows: `npm run dist:win --prefix apps/hot-profiles-desktop` gera instalador NSIS e ZIP portátil na pasta `apps/hot-profiles-desktop/dist/release`. Para baixar antecipadamente o runtime em ambientes com scripts bloqueados: `node apps/hot-profiles-desktop/node_modules/electron/install.js`.

O autoteste `HotProfiles.exe --self-test --self-test-report <caminho.json> --self-test-screenshot <caminho.png>` usa pasta temporária exclusiva, confere renderer, API autenticada e persistência após reiniciar o serviço. Não usa os cadastros reais do usuário, contas sociais ou proxies externas. O workflow público Windows também instala em uma pasta temporária do executor, testa o aplicativo instalado e confere que a desinstalação preserva um marcador de dados. Não executa deploy do site e não usa executores pagos ou repositório privado.

Com `--self-test-browser`, ele também abre e encerra um Chrome/Edge real em perfil temporário vazio, sem contas ou URLs externas. A interface e o executável empacotado passaram nesse teste no Windows do titular; isso não substitui a validação de proxy/DNS e aplicativos Android descrita nos limites acima.
