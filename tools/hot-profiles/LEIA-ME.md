# Hot Profiles — conector

1. Instale Node.js 22 ou superior do site oficial https://nodejs.org.
2. Extraia todo o ZIP em uma pasta e abra **Iniciar Hot Profiles.cmd**.
3. No 00duHot, abra **Hot Profiles → Conectar computador** e digite o código atual da janela. O código é renovado automaticamente a cada 15 minutos, sem fechar suas sessões.
4. Mantenha a janela aberta durante o uso. Ctrl+C encerra o conector e suas sessões de navegador. A instância Android permanece ligada, com a configuração anterior de proxy restaurada.

O conector escuta somente 127.0.0.1:47900. Nunca abra essa porta na internet. O navegador pode pedir permissão de rede local. A autorização do painel termina ao fechar sua aba ou reiniciar o conector.

## Navegadores

Chrome ou Edge precisa estar instalado. Cada perfil usa uma pasta própria, sem importar seu navegador pessoal. Cookies, logins e armazenamento daquele perfil permanecem para a próxima abertura. A tela é transmitida ao painel; clique, role e use Enviar texto ou o teclado após clicar na tela. Abas são independentes dentro do mesmo perfil.

O recurso não altera fingerprints do sistema. O navegador é executado em modo headless. Uploads/downloads de arquivos dentro de sites, áudio, câmera, microfone e aceleração de vídeo não fazem parte desta primeira base. Use os ambientes para suas contas e projetos autorizados.

## Android / BlueStacks

BlueStacks 5 deve estar instalado no caminho padrão. Clique em **Criar instância no BlueStacks** para abrir o gerenciador oficial, crie uma instância independente e dê um nome a ela. A criação do disco e a instalação do Android são feitas pelo BlueStacks; o site não distribui o emulador.

Abra a instância e ative **Configurações → Avançado → Android Debug Bridge → Salvar**. No cadastro do Hot Profiles, clique **Atualizar** e selecione essa instância. Uma instância não pode pertencer a dois perfis. Dados e aplicativos anteriores da instância não são apagados.

O formulário mostra **ADB conectado** somente após resposta real do ADB; uma porta no arquivo do BlueStacks é apenas candidata. Divergências de portas e endpoints ambíguos aparecem como avisos. O conector não assume 5555 para instâncias sem porta válida. Aliases como `emulator-5554` e `127.0.0.1:5555` representam o mesmo endpoint e não permitem compartilhar o Android entre perfis. O vínculo confirmado fica salvo no cadastro local e é conferido novamente ao iniciar; não é usado como prova de conexão futura.

Na sessão Android, **Conferir configuração de rede** consulta se o proxy HTTP aplicado continua configurado. Isso não testa IP público, DNS ou todos os aplicativos. O aviso **Isolamento de rede ainda não comprovado** permanece mesmo quando a configuração confere. Sem proxy gerenciada, o conector preserva a configuração de rede já existente na instância; ela pode conter uma proxy anterior.

A tela usa capturas periódicas via ADB; não é streaming de vídeo com áudio. Toque, arraste, use a roda e os botões Voltar/Início/Recentes. O envio de texto via ADB aceita caracteres ASCII sem acento; o teclado do Android continua utilizável.

Proxies HTTP/HTTPS/SOCKS5 com autenticação são intermediados por um gateway local. No Android, ele é configurado como proxy HTTP do sistema. O endereço padrão 127.0.0.1 usa encaminhamento reverso pelo ADB, sem expor o gateway na sua rede. Em instalação sem suporte a esse recurso, configure o endereço do host visto pelo emulador (por exemplo, 10.0.2.2). Aplicativos que ignoram o proxy do sistema não são redirecionados. A verificação de proxy cria um túnel a example.com:443; não determina reputação/localização ou garante o tráfego de todos os aplicativos.

Encerre normalmente pelo painel e Ctrl+C no conector para restaurar o proxy anterior do Android. Se o processo for encerrado à força ou houver queda de energia durante uma sessão com proxy, confira a configuração de proxy do Android antes de usá-lo novamente.

### Teste Android com destinos apenas locais

Com uma instância já aberta e ADB **local** habilitado, um teste opcional permite conferir o caminho HTTP sem usar contas nem uma proxy contratada:

```text
node verify-android.mjs --device bluestacks:Pie64
```

Substitua `Pie64` pelo identificador da sua instância. O teste altera temporariamente o proxy HTTP, usa ADB reverse e servidores simulados ligados somente a 127.0.0.1, confere resposta 502 quando a proxy simulada para e restaura o proxy anterior ao terminar normalmente, inclusive em erro tratado. Não abra outro controlador da mesma instância durante o teste. Não encerre o processo à força. O teste não acessa aplicativos, contas, IP externo ou DNS real e não certifica isolamento do dispositivo. Não habilita nem desabilita ADB; ao terminar, restaure manualmente a opção se a habilitou só para o teste.

Validado no BlueStacks 5.22.285.1013 / Android 9 / HD-Adb 1.0.36 no Windows. Duas rotas de proxy e falha sem fallback foram testadas com servidores locais simulados no Windows; duas instâncias Android simultâneas, IPs externos e DNS real continuam pendentes. Cookies do navegador não são importados em aplicativos Android: use login normal do titular, cujos dados permanecem na instância.

## Dados e configuração

Os dados ficam em `%LOCALAPPDATA%\00duHot\HotProfiles`. Faça backup da pasta inteira, incluindo **secrets.key**. Senhas dos proxies são criptografadas com chave local; o acesso à sua conta Windows e aos backups continua importante. O painel não recebe a senha salva de volta e não exporta cookies.

Excluir um cadastro de perfil preserva a pasta de dados do navegador e a máquina Android para evitar perda acidental. Não apaga contas em serviços externos. Para remover dados do disco, primeiro encerre as sessões e faça seu backup.

Opções avançadas, ao executar no terminal:

```text
node bridge.mjs --port 47900 --data-dir "D:\Meus ambientes"
node bridge.mjs --allow-origin https://seu-dominio.com
```

A origem publicada já autorizada é `https://feramentasdo00duhot.lovable.app`. Para outro domínio, use `--allow-origin` com uma origem exata, sem caminho. Não use URLs ou endereços de terceiros como conector: o painel só aceita localhost/127.0.0.1.

Para caminhos não padrão: variáveis de ambiente `HOT_PROFILES_BROWSER` (Chrome/Edge) e `HOT_PROFILES_ADB` (adb). Apenas executáveis já instalados e confiáveis.

## Central de proxies e desempenho

O Hot Profiles abre em **Meu computador**. O modo **Nuvem** continua disponível em um cadastro separado; alternar a tela não encerra sessões. Nenhum serviço pago é contratado pelo modo local. O computador precisa continuar ligado. Proxies são fornecidos por você; eventuais custos do provedor de proxy não estão incluídos.

Em **Proxies**, adicione ou edite conexões e filtre as disponíveis ou vinculadas. O nome do perfil vinculado aparece no cartão. No formulário de perfil, você pode cadastrar uma nova proxy sem perder o preenchimento. Cada proxy só pode ser associada a um novo perfil por vez. Uma cópia da configuração de navegador começa sem proxy para você escolher outra. Para liberar uma proxy, encerre a sessão e edite o vínculo no perfil anterior. Cadastros antigos compartilhados são preservados, mas não podem abrir simultaneamente a mesma conexão. Endereço, protocolo e usuário repetidos são recusados; usuários diferentes do mesmo gateway podem representar sessões distintas do provedor, mas não garantem IPs diferentes.

Sem proxy selecionado, o ambiente usa a conexão normal do computador. O teste de conexão confirma apenas que o proxy aceita um túnel, não localização, reputação ou exclusividade de IP. No Android, aplicações que ignoram o proxy HTTP do sistema continuam fora desse roteamento; não há VPN de dispositivo completo nesta base.

O painel mostra RAM total/livre, processadores lógicos e limite de sessões. O limite padrão é uma estimativa conservadora de 1 a 4 ambientes. Não é uma garantia da quantidade de Androids suportada. Se necessário, após medir o uso no Gerenciador de Tarefas, configure explicitamente de 1 a 8:

```text
node bridge.mjs --max-sessions 2
```

Só a sessão selecionada tem prévia atualizada. O seletor **Econômica / Equilibrada / Mais rápida** controla a frequência das capturas; não muda o Android ou a velocidade do site. Abas ocultas não pedem capturas. O conector compartilha capturas concorrentes e mantém somente o último frame em cache por 250 ms, invalidando-o após uma ação. Android usa capturas ADB, sem áudio; não é streaming de alta taxa de quadros. Ao encerrar o controle, o emulador permanece ligado. Feche instâncias sem uso pelo gerenciador para liberar CPU/RAM.

Para um Android completo, instale e configure seu emulador, com virtualização ativada, e use uma instância independente por perfil. Criar um perfil no painel não cria nem baixa uma máquina Android. A alternativa mais leve é começar por perfis de navegador. Valide primeiro um ambiente e uma proxy antes de aumentar a simultaneidade.
