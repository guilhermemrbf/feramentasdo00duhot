# Conector local Hot Profiles

- Controle acessível somente em loopback, Host e origens explícitas verificados.
- Pareamento com código temporário e cinco tentativas por minuto. Código renovado a cada 15 minutos. Token de sessão aleatório de 256 bits, somente em memória do conector e sessionStorage do painel.
- Dados locais versionados; gravação atômica; trava por pasta para evitar dois conectores sobrescrevendo a mesma base.
- Senhas AES-256-GCM; sem senha salva nas respostas, logs, parâmetros de processos ou pacote distribuído. Chave armazenada na conta Windows local; backup precisa preservar a pasta inteira.
- CRUD valida referências, tipos, portas, host, URLs, dimensões e exclusividade de Android. Perfil/proxy em execução não pode ser alterado. Exclusão do cadastro preserva dados do navegador e discos Android.
- Gateway restrito a loopback, HTTP CONNECT/HTTPS/SOCKS5. Proxy aplicado no processo do navegador; Android usa proxy HTTP do sistema e ADB reverse quando configurado com 127.0.0.1. Configuração anterior restaurada em encerramento normal.
- Sessões limitadas a oito; controle enfileirado com limite por sessão; uma captura por vez; apenas sessão visível recebe capturas; telas pausam quando o painel está oculto.
- CDP permitido apenas nos perfis criados pelo conector, com diretório próprio. API expõe operações específicas, sem Runtime.evaluate nem shell genérico.
- ADB usa executável instalado, dispositivos virtuais descobertos e comandos fixos, com escape de argumentos de texto/URL. A captura Android inicial precisa funcionar antes de marcar a sessão em execução. No Chrome, o CDP confirma o processo e a tela é atualizada após a composição da página.
- Nenhuma tabela, autenticação, pagamento ou serviço de nuvem novo: esta etapa administra os ambientes do computador pareado. Multiusuário/equipes exigirão outro modelo de autorização antes de introduzir dados compartilhados.

## Limitações operacionais

Fechamento forçado/queda de energia pode impedir restauração do proxy Android; revisar configuração do emulador nesse caso. Certos aplicativos ignoram o proxy do sistema. Os dados de sessões e as telas permanecem entre o computador e o painel; não são enviados ao servidor do Lovable pela implementação. O computador precisa permanecer ligado e conectado.

## Validação desta entrega

Tipos, formatação e ESLint conferidos. Navegador real, abas, navegação, clique, modo ampliado, encerramento e persistência do cadastro conferidos pela UI. Proxies reais e tela Android dependem das configurações/credenciais do usuário; não foram declarados como aprovados.
