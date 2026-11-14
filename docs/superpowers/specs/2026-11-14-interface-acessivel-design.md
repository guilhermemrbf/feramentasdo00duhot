# Interface acessível MouseHot

Pedido: aplicar vermelho, preto e branco em todo o frontend da plataforma web, priorizando usuários iniciantes. Preservar logo, funções, rotas, dados e APIs. Manter cores semânticas de sucesso, alerta e critérios do Intelligence.

Decisão técnica: evoluir o sistema visual existente (React, TanStack, Tailwind, Radix), sem dependências novas. Uma reconstrução de cada fluxo duplicaria código e aumentaria risco. A identidade será compartilhada via tokens e componentes, com ícones reconhecíveis por ferramenta, navegação legível, ajuda em três passos e ações específicas no catálogo.

Escopo: todas as rotas web e seus controles compartilhados; cabeçalhos, catálogo, busca, menu móvel, formulários, calendário, seletores, agendamento e Intelligence. Aplicativos instaláveis e extensões têm distribuição própria e não serão reconstruídos neste pedido de frontend da plataforma. Não modificar autorização, banco, processamento, conteúdo exportado ou arquivos de usuários.

Critérios: vermelho com branco deve atender contraste AA; vermelho de texto deve ser mais claro que vermelho de botão; controles principais com 44px; foco visível; ausência de overflow a 360px; nomes e explicações em português; Intelligence continua com uma tela, um botão de análise e quatro critérios inalterados.

Autonomia: usuário dispensou perguntas de rotina e autorizou implementação/commit/deploy em mensagens anteriores. Usar GitHub para código e Lovable apenas preview/deploy. FreeLLMAPI local indisponível na porta documentada 31415; seguir sem depender dele.
