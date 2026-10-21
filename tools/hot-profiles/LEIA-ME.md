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

A tela usa capturas periódicas via ADB; não é streaming de vídeo com áudio. Toque, arraste, use a roda e os botões Voltar/Início/Recentes. O envio de texto via ADB aceita caracteres ASCII sem acento; o teclado do Android continua utilizável.

Proxies HTTP/HTTPS/SOCKS5 com autenticação são intermediados por um gateway local. No Android, ele é configurado como proxy HTTP do sistema. O endereço padrão 127.0.0.1 usa encaminhamento reverso pelo ADB, sem expor o gateway na sua rede. Em instalação sem suporte a esse recurso, configure o endereço do host visto pelo emulador (por exemplo, 10.0.2.2). Aplicativos que ignoram o proxy do sistema não são redirecionados. A verificação de proxy cria um túnel a example.com:443; não determina reputação/localização ou garante o tráfego de todos os aplicativos.

Encerre normalmente pelo painel e Ctrl+C no conector para restaurar o proxy anterior do Android. Se o processo for encerrado à força ou houver queda de energia durante uma sessão com proxy, confira a configuração de proxy do Android antes de usá-lo novamente.

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
