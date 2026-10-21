# Hot Profiles — back-end

## Nuvem (vigente)

- Implementados server functions com autenticação Supabase existente e validação Zod. Lista de UUIDs autorizados no servidor limita acesso a contas aprovadas.
- Migração com três tabelas e RPC transacional; RLS habilitada e privilégios diretos de anon/authenticated revogados. Todas as consultas do servidor filtram o dono.
- Senhas criptografadas AES-GCM com IV aleatório e AAD por dono/registro. Chave de criptografia e chaves dos provedores apenas no servidor; estado público contém `hasPassword`.
- Perfis ativos bloqueiam edição/exclusão e alteração da proxy; reserva única no banco; limite por conta de quatro ambientes e vinte aberturas/hora. Versões conferidas antes de iniciar.
- APIs públicas Browserbase (context/session/debug/release) e Genymotion (start/get/access-token/stop). Nenhuma API privada do Dolphin.
- Criação ambígua bloqueia nova sessão e permite recuperação; encerramento só é considerado concluído após estado final. Limite solicitado de 30 minutos no provedor.
- Login usa o cliente Supabase e o mecanismo de armazenamento já existente no projeto. Não foi feita migração global de autenticação para cookies httpOnly; as chamadas autenticadas seguem o middleware bearer existente.
- Configuração em `.env.example`; ativação e limites em `docs/hot-profiles-cloud.md`.

### Pendências reais

Credenciais/contas dos provedores, chave de serviço, lista de usuários autorizados e chave de criptografia ausentes no ambiente. Migração ainda não aplicada. Não foram validadas operações de nuvem faturáveis, isolamento por duas contas reais ou proxy do usuário. Android com proxy automática e persistência não implementado; execução com proxy vinculada é bloqueada. Backups de banco devem ser confirmados no Supabase antes da ativação. Não declarar checklist de produção concluído.

## Conector local (histórico)

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
