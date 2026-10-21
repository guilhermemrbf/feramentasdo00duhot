# Hot Profiles na nuvem

## O que mudou

A rota `/hot-profiles` agora usa o back-end do site. O visitante não precisa instalar um conector, deixar Chrome aberto ou executar BlueStacks. O código da implementação local anterior está preservado em `LegacyLocalWorkspace.tsx` e `tools/hot-profiles/`; não é carregado pela rota principal. Nenhum dado local é migrado automaticamente.

Há cadastro/edição/exclusão de proxies e perfis, tags, observações, duplicação de configuração, busca, sessões em abas, encerramento com confirmação do estado pelo provedor e visualização em tela cheia.

## Ativação (administrador)

1. Conectar o Supabase do projeto, usando as variáveis listadas em `.env.example`. A chave `SUPABASE_SERVICE_ROLE_KEY` é exclusivamente do servidor.
2. Aplicar a migração `supabase/migrations/20261021010000_hot_profiles_cloud.sql` pelo fluxo de migrações Supabase do projeto (`supabase db push` em projeto vinculado) ou executar o arquivo no SQL Editor. Não executar duas vezes manualmente. As tabelas e a função de mutação têm RLS/revogação de acesso para `anon` e `authenticated`; apenas o servidor autorizado usa a chave de serviço.
3. No Supabase Auth, habilitar acesso por e-mail, configurar envio de e-mail, Site URL e redirect permitido `https://SEU-SITE/hot-profiles`. Para acesso por código, colocar `{{ .Token }}` no template de magic link. O formulário aceita códigos de seis a oito dígitos; links também usam o tratamento de sessão do cliente Supabase existente. Não cadastrar o usuário em serviços externos pelo código.
4. Incluir o UUID do usuário de Supabase Auth em `HOT_PROFILES_ALLOWED_USER_IDS`, separado por vírgulas se houver mais de um. Sem esta lista, nenhuma conta pode consultar ou consumir recursos do Hot Profiles. O registro de uma conta pública não concede execução paga.
5. Gerar 32 bytes aleatórios e configurar sua representação hexadecimal em `HOT_PROFILES_ENCRYPTION_KEY`. Guardar uma cópia em gerenciador de segredos. A troca dessa chave sem recriptografar os registros impede a leitura das senhas antigas.
6. Criar a própria conta Browserbase e configurar `BROWSERBASE_API_KEY` e `BROWSERBASE_PROJECT_ID`. Usar um plano que permita sessões persistentes/keepAlive e proxies externos. Não foram criadas contas nem assumidos compromissos de pagamento nesta implementação.
7. Criar a própria conta Genymotion SaaS. Configurar `GENYMOTION_API_TOKEN` e uma recipe ARM64 pronta em `GENYMOTION_RECIPE_ID`. O painel não recebe a chave global do provedor.
8. Publicar o site pelo Lovable, como combinado. O deploy da interface não cria contas nos provedores nem aplica automaticamente esta migração.

O botão **Configurar nuvem** mostra somente a presença da configuração; não anuncia conexão verificada. Com as credenciais ausentes, o painel continua utilizável para explorar os formulários, mas não inventa cadastros salvos ou sessões.

## Navegadores e proxies

- Criação e reutilização de um Browserbase Context independente por perfil, `persist: true`. A duplicação cria uma configuração nova, sem copiar cookies e contas.
- Proxy HTTP/HTTPS com host, porta, usuário e senha. A importação por URL ou `host:porta:usuario:senha` ocorre apenas na memória do formulário. Senhas são criptografadas com AES-256-GCM, IV aleatório e autenticação adicional do UUID do dono e do registro. As respostas incluem apenas `hasPassword`.
- Campo de senha vazio mantém o segredo anterior; a caixa de remoção apaga o segredo. Perfis em execução bloqueiam edição/exclusão do perfil e da proxy usada.
- SOCKS5 pode ser guardado, mas o adaptador Browserbase bloqueia seu uso: a documentação pública do provedor anuncia HTTP/HTTPS. Não há fallback silencioso para rede direta quando uma proxy não é suportada ou falha.
- A API Browserbase valida a proxy ao criar a sessão; não há alegação de teste de reputação, geolocalização ou IP de saída no cadastro.
- Controle por Live View oficial em iframe; novas abas são abertas pelo CDP público com comandos específicos. A conexão CDP fica no servidor. Os links de Live View são capacidades da sessão, mantidas em memória e nunca no armazenamento persistente do navegador.
- Encerrar solicita `REQUEST_RELEASE` e sincroniza o estado real. O envio do pedido não é tratado como encerramento confirmado.
- Excluir cadastro remove somente os dados do painel e seu histórico. O contexto com dados do navegador é mantido no provedor; a confirmação informa a necessidade de remoção definitiva pelo painel do provedor.

## Android: limites explícitos desta integração

- Inicialização/estado/encerramento pela API pública Genymotion SaaS. Tela e interação pelo SDK oficial WebRTC, versão CDN fixada em 4.3.1, com token limitado à instância.
- São instâncias **temporárias** (`start-disposable`). O usuário confirma antes de iniciar que os aplicativos, contas e arquivos são perdidos ao encerrar. Não prometer perfis Android persistentes nesta etapa.
- Android com proxy vinculada **não inicia**. A API de ciclo de vida não oferece configuração de egress autenticado. Para suportar isso, será preciso contratar/configurar uma infraestrutura com rede dedicada (por exemplo, Genymotion Device Image em VPC com gateway de saída e armazenamento persistente) e criar um adaptador específico de rede. Configurar proxy do cliente gmsaas não configura os aplicativos Android.
- O SDK suporta toque/teclado/navegação/rotação/clipboard; câmera, microfone, mudança de identificadores, instalação via upload e desligamento externo ficam desabilitados nesta base. O aparelho não é um iframe de site com viewport móvel.
- Cada sessão solicita máximo de 30 minutos, com inatividade de dez minutos no Android. Fechar a aba não encerra o provedor imediatamente. O operador deve usar **Encerrar ambiente** e conferir o painel do provedor se houver erro.

## Concorrência e recuperação

A função SQL serializa mutações por usuário. Uma restrição única impede mais de uma sessão ativa por perfil. O início confere se perfil/proxy mudaram entre leitura e reserva, limita quatro sessões simultâneas e vinte inicializações por hora por usuário. O servidor recebe a identidade de um JWT validado, nunca do corpo enviado pelo navegador.

IDs de provedores e ciphertexts não são devolvidos no estado público. Todas as consultas administrativas filtram explicitamente o UUID do dono. A comunicação com provedores usa URLs fixas, tempo limite e não retorna corpos de erro que poderiam repetir credenciais. Endereços de streaming são verificados contra os domínios oficiais.

Falha de rede durante criação pode significar que o provedor criou a sessão. O registro fica em atenção, bloqueando outra criação. Depois de um minuto, a sincronização procura o identificador imutável da solicitação nos metadados Browserbase ou no nome de instância Genymotion. O operador pode sincronizar/encerrar; falhas não liberam silenciosamente o perfil. Contextos eventualmente criados antes de uma falha de gravação precisam ser revisados no provedor.

Revogar uma conta na lista impede novas chamadas; encerre primeiro os recursos dessa conta pelo painel. A aplicação não inclui exclusão de conta de autenticação; FKs `restrict` impedem remover o dono enquanto existirem registros. Não trocar credenciais de provedor com sessões abertas.

## Estado de validação

Tipos, lint, build e navegação dos formulários podem ser conferidos sem contas de nuvem. Testar criação real, persistência, isolamento com dois usuários, proxy real, Android/WebRTC e encerramento faturável exige aplicar a migração e configurar as próprias contas. Essas execuções não foram realizadas com credenciais fictícias nem foram anunciadas como concluídas.

## Fontes oficiais

- [Browserbase: proxies](https://docs.browserbase.com/platform/identity/proxies)
- [Browserbase: contexts](https://docs.browserbase.com/platform/browser/core-features/contexts)
- [Browserbase: Live View](https://docs.browserbase.com/platform/browser/observability/session-live-view)
- [Browserbase: API de sessões](https://docs.browserbase.com/reference/api/create-a-session)
- [Genymotion SaaS: API pública](https://developer.genymotion.com/saas/)
- [Genymotion: integração web](https://docs.genymotion.com/tools/javascript_sdk/)
- [Genymotion: SDK oficial](https://github.com/Genymobile/genymotion-device-web-player)
