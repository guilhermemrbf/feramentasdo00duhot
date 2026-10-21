# Hot Profiles — arquitetura

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
