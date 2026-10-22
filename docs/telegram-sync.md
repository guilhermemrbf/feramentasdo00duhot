# Telegram Sync — instalação e operação

> **Versão atual gratuita:** use o [aplicativo local Windows](../apps/telegram-sync-desktop/README.md). A página `/telegram-sync` oferece o download. As instruções de nuvem abaixo são históricas e opcionais; não são necessárias para usar o aplicativo local.

Não houve deploy ou aplicação automática da migração.

## Ativação manual

1. Aplique `supabase/migrations/20261022010000_telegram_sync.sql` no banco de destino após backup. Use TELEGRAM_DATABASE_URL com usuário exclusivo de servidor, acesso às quatro tabelas e à sequência de auditoria. RLS está habilitado e acesso de anon/authenticated revogado. Configure TLS conforme o provedor.
2. Em `services/telegram-sync`, instale `pip install -r requirements.txt`. Configure TELEGRAM_API_ID/TELEGRAM_API_HASH da aplicação em https://my.telegram.org, TELEGRAM_DATABASE_URL, SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY e TELEGRAM_ENCRYPTION_KEY. Gere a chave com `python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"`. Preserve essa chave em gerenciador de segredos.
3. Execute API e worker em processos separados, com reinício automático: `uvicorn app:app --host 0.0.0.0 --port 8000` e `python worker.py`. O Dockerfile atende ambos, sobrescrevendo o comando para o worker. Mantenha a API em rede privada e configure TELEGRAM_SYNC_SERVICE_URL no servidor web. Nunca coloque segredos em VITE_. A aplicação pública deve usar HTTPS.
4. No computador confiável do titular, execute `python session.py` com API ID/hash no ambiente. OTP/2FA são informados localmente. Cole a sessão secreta no campo protegido do painel. Ela permite acesso à conta; o backend valida, criptografa e não a retorna. Para revogar de fato, encerre a sessão em Telegram > Dispositivos. Remover o cadastro do painel não revoga a sessão Telegram.
5. Faça teste entre dois canais próprios antes de produção: ID/link/@username, emojis, links ocultos, fotos, vídeos, documentos, álbuns, pausa, cancelamento e reinício. Nenhum envio real foi executado durante a implementação.

## Comportamento e limites

O destino exige administração e permissão de postagem. O operador confirma autorização para republicar a origem. IDs privados precisam estar acessíveis à conta; a resolução carrega os diálogos para obter access_hash. Convites privados e links de mensagens são rejeitados. Conteúdo protegido é bloqueado.

Histórico captura o último ID na criação. Contínuo importa o histórico e verifica novos posts a cada ciclo. Lotes cronológicos de 100 mensagens completam o último álbum; PostgreSQL persiste checkpoints, mapeamentos e auditoria. Travas por conexão impedem uso simultâneo da sessão. Pausa/cancelamento valem após o lote atual.

Regras literais simultâneas priorizam o trecho mais longo; links ocultos viram `texto (URL)` antes da substituição. Formatação visual vira texto simples; legendas acima do limite interrompem a tarefa. Regras ficam congeladas na criação. Fotos, vídeos e documentos usam referências MTProto; a ferramenta de metadados e seu FFmpeg não são usados. Tipos não suportados interrompem a tarefa; mensagens de serviço são ignoradas.

Uma reserva durável precede cada envio. Queda durante o envio deixa `sending`; a próxima execução coloca a tarefa em `attention` sem reenviar. Confira o destino/mapeamento antes de recuperar administrativamente no banco. Criar outra tarefa desde o início pode duplicar o histórico. Não se promete exactly-once distribuído. FloodWait adia o ciclo; reserva pendente exige conferência. Erros não expõem credenciais ou respostas brutas Telegram.

Não replica membros, tópicos, respostas, reações, visualizações, edições/exclusões posteriores. Não remove marcas d'água nem contorna proteção. Planos, cotas e cobrança SaaS ficam fora do módulo. Valide carga antes de comercializar.

## Testes

Na pasta do serviço: `python -m unittest discover -s tests`. Na raiz: `npm test`, `npx tsc --noEmit`, `npm run build`. Testes reais de SQL, concorrência, isolamento e Telegram dependem de banco de teste e credenciais e devem preceder uso em produção.

Validação local concluída: 35 testes Node existentes e 14 testes Python (incluindo autenticação, isolamento por proprietário, proteção de conteúdo, criptografia e retomada após envio sem confirmação). TypeScript e lint dos arquivos novos passaram. O build de produção passou com avisos de tamanho de chunks e diretivas de dependências. Esses testes não substituem a validação integrada de PostgreSQL e Telegram com suas credenciais.

## Railway: configuração preparada

Crie dois serviços vazios antes de conectar o repositório, para evitar que a Railway tente construir o frontend. Ambos usam a branch `main` do repositório `guilhermemrbf/feramentasdo00duhot` e Root Directory `/services/telegram-sync`.

| Serviço | Config File (caminho absoluto no repositório) | Comando |
| --- | --- | --- |
| telegram-api | `/services/telegram-sync/railway.api.json` | `python run_api.py` |
| telegram-worker | `/services/telegram-sync/railway.worker.json` | `python worker.py` |

A API usa a porta fornecida por PORT e disponibiliza `/healthz`. API e worker verificam as variáveis obrigatórias e a existência das tabelas antes de iniciar, encerrando com mensagem sem segredos quando a configuração está incompleta. O worker não tem endpoint HTTP nem domínio público. O contexto Docker exclui `.env`, sessões Telegram e arquivos de desenvolvimento.

Como a Lovable e a Railway estão em provedores diferentes, um endereço `*.railway.internal` não é acessível pelo servidor da Lovable. Para essa arquitetura, configure um domínio HTTPS na API Railway e use-o em TELEGRAM_SYNC_SERVICE_URL no servidor da Lovable. O endpoint `/command` continua exigindo JWT Supabase válido, com verificação da propriedade dos recursos. Não exponha o banco de dados ao navegador.

Antes de criar recursos, verifique incidentes em https://status.railway.com/. Em 22/10/2026, a tentativa de criação foi recusada com `Deploys have been paused temporarily`. Nenhum projeto ou serviço foi criado nessa tentativa e nenhuma credencial foi enviada à Railway.
