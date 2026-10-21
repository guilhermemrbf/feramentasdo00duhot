# Hot Profiles — arquitetura

## Revisão vigente: execução na nuvem (2026-10-21)

O usuário mudou o requisito: sem execução no computador do visitante. Mantidos React/TanStack Start/Tailwind e Supabase existentes. Três tabelas na migração `20261021010000_hot_profiles_cloud.sql`: perfis, proxies e sessões; UUIDs, donos, FKs compostas para impedir referência entre contas, índices e datas UTC. Somente servidor tem permissão de acesso. Um JWT validado identifica o dono e uma lista de UUIDs autorizados restringe consumo de serviços pagos.

Interface `/hot-profiles` → server functions autenticadas → Supabase/Browserbase/Genymotion oficiais. Senhas de proxy AES-GCM no servidor; segredos e IDs de controle dos provedores não chegam ao estado público. Contexto do navegador por perfil; Android SaaS descartável nesta integração. Contratos, configuração e limites em [guia da nuvem](../docs/hot-profiles-cloud.md).

| Operação            | Acesso                        | Resultado                                                            |
| ------------------- | ----------------------------- | -------------------------------------------------------------------- |
| getHotCloudSetup    | Público                       | Presença de configuração, sem segredos nem promessa de conectividade |
| workspace           | Conta autorizada              | Cadastros e sessões do próprio dono, sem credenciais                 |
| save/delete-profile | Conta autorizada              | Cadastro validado; mutação serializada; sem alteração em execução    |
| save/delete-proxy   | Conta autorizada              | Segredo criptografado; referência e uso ativo protegidos             |
| start               | Conta autorizada              | Reserva única por perfil, limites e inicialização no provedor        |
| sync                | Dono da sessão                | Estado real e recuperação de criação ambígua                         |
| viewer              | Dono da sessão em execução    | Link de Live View ou token WebRTC limitado à instância               |
| navigate            | Dono de navegador em execução | Nova aba HTTP/HTTPS por CDP, sem execução de código genérico         |
| stop                | Dono da sessão                | Pedido de encerramento e confirmação posterior do provedor           |

Riscos pendentes: aplicação da migração e credenciais reais; rede e persistência Android; validação real multiusuário e de custos dos provedores. Não é possível executar Android dentro de um Cloudflare Worker: esse processo ocorre na infraestrutura Genymotion. Sem reuso de endpoints privados ou código do Dolphin.

## Arquitetura local anterior (histórico)

## Escolhas

- Web: React, TanStack Start e Tailwind já utilizados pelo 00duHot; rota /hot-profiles.
- Execução: conector Node.js 22+ independente, sem dependências adicionais, limitado a 127.0.0.1:47900.
- Persistência: arquivo JSON versionado, gravação atômica e serializada em diretório exclusivo; credenciais dos proxies criptografadas com AES-256-GCM e chave local. Não persistir credenciais no site.
- Autorização: origens explícitas, verificação de Host, pareamento temporário com limite de tentativas, token em sessionStorage e Authorization, jamais em URLs. Sem serviço público de controle remoto.
- Browser: Chrome/Edge instalado, processo headless e user-data-dir exclusivo por perfil. CDP somente em loopback; comandos públicos específicos, sem endpoint de shell ou execução de JavaScript.
- Android: ADB oficial do BlueStacks/SDK, somente instâncias descobertas; seleção exclusiva por perfil. Screencap, toque, arrastar, texto e navegação Android. Não desligar nem apagar a máquina virtual ao desconectar.
- Rede: gateway HTTP local por sessão encaminha CONNECT por proxy HTTP/HTTPS ou SOCKS5, incluindo autenticação; navegador não recebe a senha pela linha de comando. Android usa o gateway pelo endereço do host configurado.
- Nuvem: o Lovable publica a interface; o computador conectado conserva seus dados e executa as sessões. Sem dependência do Supabase nesta base de usuário local. Não introduzir tabelas de nuvem sem autenticação real de contas/equipes.

## Dados (equivalente ao esquema)

Três coleções: profiles, proxies, activities. IDs UUID; referências de proxy verificadas; exclusão de proxy em uso bloqueada; Android exclusivo; perfil em execução não pode ser editado/apagado. updatedAt/createdAt ISO UTC. Segredos omitidos em respostas, logs e duplicações. Exclusão remove o cadastro, preserva os dados do navegador no disco para evitar perda acidental; a interface explica essa ação.

## API local

| Método                | Rota                          | Resultado                                               |
| --------------------- | ----------------------------- | ------------------------------------------------------- |
| POST                  | /pair                         | Troca código temporário por token                       |
| GET                   | /v1/state                     | Perfis, proxies sem senha, sessões e histórico          |
| GET                   | /v1/devices                   | Instâncias e capacidades locais                         |
| POST / PATCH / DELETE | /v1/profiles[/id]             | Gestão validada de perfis                               |
| POST / PATCH / DELETE | /v1/proxies[/id]              | Gestão de proxies                                       |
| POST                  | /v1/proxies/id/check          | Conexão TCP/TLS e handshake de proxy                    |
| POST                  | /v1/profiles/id/start ou stop | Execução com bloqueio por perfil/dispositivo            |
| GET                   | /v1/sessions/id/frame         | Imagem atual e dimensões reais                          |
| GET / POST            | /v1/sessions/id/tabs          | Listar/criar abas do navegador                          |
| POST                  | /v1/sessions/id/control       | Navegar, tecla, texto, toque, arrasto, rolagem, diálogo |
| POST                  | /v1/android/manager           | Abrir o gerenciador oficial de instâncias               |

Todos os /v1 exigem token e origem autorizada. Corpo limitado, URLs http/https, coordenadas e comandos limitados, executáveis fixos descobertos, sem shell arbitrário. Processos e sockets encerrados no desligamento. Corridas serializadas na persistência e inicialização por perfil. Não expor portas na rede local/internet.

## Ordem de construção

1. Conector, persistência e validação; pareamento e cadastro (S01, S02, S05).
2. Perfis de Chrome/Edge reais e proxies (S03, S04).
3. Descoberta e controle Android, criação assistida pelo gerenciador oficial (S02, S04).
4. Responsividade, recuperação de erros, documentação e integração no Git.
