# Padrão de interface MouseHot

Toda nova função deve priorizar pessoas iniciantes. Reutilize a base visual em src/styles.css e os componentes ui; não crie temas paralelos.

- Preto e cinza neutro nas superfícies; branco nos textos; vermelho nas ações principais. Use bg-primary/text-primary-foreground nos botões e text-brand-red (vermelho claro) em textos sobre fundos escuros. Nunca branco sobre vermelho claro.
- Use o logo existente e ícones Lucide relacionados à tarefa, sempre acompanhados de um nome. Cadastre rotas, instruções, resumo e ação em tool-catalog.ts; associe ícone em TOOL_ICONS.
- Uma ação principal por etapa, com verbo e resultado: Programar no Instagram, Criar uma prévia. Evite jargão sem explicação.
- PageIntro apresenta título, ícone, resumo e três passos. Ajuda técnica complementar fica em O que preciso para usar.
- Campos têm rótulos visíveis e exemplos, erro junto ao campo e estados de carregamento. Informar o resultado real sem prometer integrações não conectadas.
- Botões principais e seletores com pelo menos 44px; foco visível; seleção identificável sem hover; não depender só da cor.
- Preservar cores semânticas (sucesso, atenção, erro) e as quatro cores/pesos do Intelligence. Não recolorir arquivos, canvas ou mídias exportadas.
- Verificar teclado, contraste AA, textos longos e largura de 360px. Rodar testes existentes antes de commit. Não alterar contratos de API para uma mudança visual.
- Intelligence permanece em uma tela simples, com um botão ANALISAR e resultados inline. Sem adicionar menu lateral a essa ferramenta.
