# Hot Profiles Desktop — Windows 0.2.0 experimental

Aplicativo local com janela própria, instalador por usuário e execução do conector incluída. Reutiliza os formulários, central de proxies, sessões, navegador e adaptador Android do projeto. Não depende de site publicado, Supabase, Railway ou Node.js instalado pelo usuário. Não inclui um emulador, Chrome/Edge ou proxy contratada.

Esta versão acrescenta **celular próprio do Hot Profiles**: cria um Android vazio por perfil, inicia o motor Android Emulator do SDK local sem janela externa e apresenta tela e controles na aba Sessões. Não depende do BlueStacks para esse modo. É um protótipo para primeiros testes, com tela por capturas, toque, gestos e teclado ASCII; não oferece vídeo fluido, áudio ou câmera.

O instalador inclui o gerenciador e o provedor de runtime; **o SDK e a imagem Android não estão incluídos**. Tenha Android Emulator, Platform Tools e uma imagem x86_64 instalados em `%USERPROFILE%\AppData\Local\Android\Sdk`. Desenvolvedores podem indicar outra pasta com `HOT_PROFILES_ANDROID_SDK`. A imagem Google Play existente é usada somente localmente; não foi copiada para o pacote. Compatibilidade de aplicativos e serviços Google ainda precisa de validação.

## Uso

1. Execute o instalador Windows e abra **Hot Profiles** pelo atalho. Não precisa de administrador nem código de pareamento.
2. Feche o conector antigo antes de abrir o aplicativo: ambos usam a mesma pasta de dados e o bloqueio impede duas cópias simultâneas.
3. Cadastre uma proxy e um perfil. Use uma conexão diferente por perfil e confira o resultado dos testes; cadastros separados não garantem IPs diferentes no fornecedor.
4. Para navegador, tenha Chrome ou Edge instalado. Para Android próprio: Novo perfil → Celular Android → Criar / usar celular próprio do Hot Profiles → Salvar → Iniciar. O primeiro boot pode levar alguns minutos. Comece com um único celular e libere RAM antes de iniciar. Sem proxy, o protótipo usa rede restrita para testar tela e controles.
5. Encerre os ambientes pelo painel. Encerrar um celular próprio desliga o motor e preserva seu disco. Ao fechar o aplicativo, os ambientes próprios também são encerrados. Se o encerramento falhar, a janela permanece aberta para tentar novamente.
6. O adaptador BlueStacks antigo continua disponível para perfis existentes. Somente nesse modo é necessário abrir uma instância externa e habilitar ADB local; encerrar seu controle não desliga o BlueStacks. Cadastros e instâncias existentes não são convertidos ou importados.

Os perfis e proxies continuam em `%LOCALAPPDATA%\00duHot\HotProfiles`, fora da instalação. Atualizar ou desinstalar o programa preserva essa pasta. Faça backup de toda a pasta, incluindo a chave local. O aplicativo não importa cookies do navegador nos aplicativos Android: use login normal do titular. A execução local não remove requisitos ou restrições das redes sociais.

## Limites de rede

No Android próprio, o runtime solicita rede virtual restrita em Wi-Fi e rádio, desativa IPv6 nessas redes e conecta a proxy HTTP pelo canal ADB privado. Não oferece saída direta como alternativa quando a proxy falha. Aplicativos que ignoram proxy HTTP podem ficar sem conexão; isso ainda não é um túnel transparente para todos os aplicativos. A interface mantém isolamento integral como não comprovado até a bateria completa de testes de DNS, UDP, IPv6 e aplicativos. Não use cadastros sensíveis nos primeiros testes.

O teste com uma proxy real demonstrou que o HTTP explícito passa pelo gateway, mas TCP direto do Android pode ignorar o proxy HTTP do sistema. Esta versão mantém o aviso de isolamento não comprovado; não oferece VPN, bloqueio integral quando a proxy falha ou validação de todos os aplicativos/DNS/UDP/IPv6. Essa camada ainda precisa ser desenvolvida e testada. O navegador também precisa de validação específica de IP, DNS e caminhos de saída antes de prometer isolamento integral.

O resultado acima se refere ao adaptador BlueStacks antigo. Não confundir a restrição solicitada pelo motor próprio com a configuração HTTP isolada desse adaptador. IPs reais e duas instâncias simultâneas ainda precisam de teste específico no motor próprio.

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

Com `--self-test-android`, o autoteste cria um celular próprio temporário pelo serviço, aciona Iniciar na interface e exige a tela Android dentro do visualizador. Requer o SDK instalado e memória livre; não é executado implicitamente nos computadores dos usuários. O teste opt-in `node tools/hot-profiles/verify-runtime.mjs --run-empty-device --directory <pasta exclusiva>` verifica boot, captura, comandos, tráfego por proxy simulada local, falha da proxy, acesso direto ao host e persistência após reiniciar. A pasta de teste é preservada para diagnóstico e contém apenas o Android vazio criado pelo próprio teste.
