# Scale Up Hub — reconstrução profissional

## Objetivo
Transformar a aplicação atual em um hub SaaS escuro, compacto e profissional, preservando integralmente o upload Cloudinary, o suporte a múltiplas imagens e a geração do prompt oficial.

## Entregas
- Criar uma estrutura compartilhada do Scale Up Hub com wordmark e navegação para início, Image Links e Criar Página.
- Separar a página inicial do uso da ferramenta: a home apresentará as duas ferramentas em cards compactos e funcionais.
- Criar uma rota própria para o Image Link Generator, mantendo upload múltiplo, progresso, formatos, cópia, abertura e erros.
- Reformular Criar Minha Página com uploads compactos, campos organizados, estados claros, resultado legível, cópia e edição.
- Aplicar o visual escuro escolhido com fundo grafite, bordas discretas, uma única cor de destaque, tipografia moderna e microinterações breves.
- Atualizar títulos e descrições de compartilhamento de cada página para Scale Up Hub.
- Validar desktop e celular, navegação, upload simulado, geração do prompt, cópia e ausência de sobreposições.

## Limites
- A integração Sync Pay não será executada dentro do Scale Up Hub; ela continuará sendo uma instrução do prompt gerado para o projeto futuro.
- Nenhuma credencial privada será solicitada, armazenada ou exposta.
- A lógica existente de Cloudinary e o template oficial serão reutilizados, sem recriação desnecessária.

## Detalhes técnicos
- Manter TanStack Start, React e Tailwind v4.
- Criar componentes compartilhados de estrutura e botões antes das páginas que os importam.
- Usar apenas tokens semânticos definidos no CSS global, incluindo estados de sucesso e superfícies elevadas.
- Adicionar `/image-links` e manter `/criar-pagina`; `/` passa a ser a home do hub.
