# PostKit — Automatic Post: fundação do front-end TikTok e Instagram

## Objetivo

Construir um módulo próprio para preparar vídeos, legendas e programação de conteúdo do TikTok, compartilhando padrões de navegação e experiência com a automação Instagram. A referência é funcional; não copiamos código, marca ou implementação privada de terceiros.

## Estado do front-end

A rota `/automacao-tiktok` foi criada com:

- Visão geral e indicadores que distinguem estado local de resultados reais.
- Área de contas com o fluxo oficial de conexão marcado como pendente.
- Seleção múltipla e arrastar/soltar de arquivos MP4, MOV e WEBM.
- Lista local de arquivos com tamanho, tipo e remoção.
- Editor de legenda e hashtags com prévia do texto.
- Geração de uma prévia local da fila com quantidade, data inicial, horários e limite diário.
- Preferências locais de fuso horário, intervalo e horários.
- Navegação integrada à central de ferramentas e à barra lateral.

## Limitações explícitas

- Selecionar arquivos não faz upload nem cria persistência.
- A fila gerada é apenas uma prévia no estado React e desaparece ao sair/recarregar a página.
- Nenhuma conta TikTok é conectada e nenhuma publicação real é realizada.
- Os indicadores de publicação real não são inventados.
- A rota não contém tokens, chaves privadas nem chamadas diretas à API do TikTok.

## Etapa de backend futura

1. Confirmar as capacidades atuais da API oficial do TikTok e os requisitos de acesso do aplicativo.
2. Definir autenticação, workspaces e isolamento por usuário.
3. Implementar OAuth no servidor e armazenar tokens com segurança.
4. Implementar upload persistente, validação de mídia e metadados.
5. Persistir legendas, hashtags, configurações e itens da fila.
6. Implementar processamento de publicação no servidor, com idempotência, limites, auditoria e tratamento de estados ambíguos.
7. Exibir histórico e métricas apenas quando houver dados confirmados pelas APIs disponíveis.
8. Adicionar testes automatizados, executar lint/build e verificar os fluxos antes de considerar a integração operacional.

## Critério de aceite desta fase

- A rota está registrada no TanStack Router.
- O módulo está acessível pela central de ferramentas e pela navegação principal.
- Biblioteca, texto e prévia de programação têm interações locais.
- A interface informa claramente que não há persistência ou publicação real.

O build e o lint ainda precisam ser executados em ambiente de desenvolvimento; os commits no GitHub, isoladamente, não provam que a aplicação compila.
