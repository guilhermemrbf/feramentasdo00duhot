# Interface do Hot Profiles

Os fluxos novos devem seguir o padrão adotado na versão 0.3.1:

- Começar pela tarefa do usuário e por uma opção recomendada; explicar o próximo passo com os mesmos nomes dos botões.
- Usar linguagem comum, rótulos visíveis, exemplos fictícios e retorno de erro próximo à ação. Não apresentar detalhes de implementação no fluxo principal.
- Oferecer preenchimento rápido e ajustes individuais. Na proxy, colar o endereço deve bastar; não exigir um nome quando ele puder ser gerado.
- Separar formato reconhecido, conexão verificada e isolamento de rede comprovado. Não usar um desses estados como prova do outro.
- Manter senhas ocultas e não as incluir em mensagens, capturas de suporte ou logs. A API não devolve a senha salva. O modo local mantém os cadastros no PC.
- Preservar o preenchimento ao cadastrar uma proxy dentro de um perfil, os dados existentes nas atualizações e o vínculo exclusivo entre perfil e proxy.
- Usar configurações avançadas somente quando ajudam a decisão. Presets de desempenho devem respeitar os requisitos reais da imagem e do computador.
- Novos perfis gerados a partir de um modelo começam vazios e sem proxy: nunca copiar contas, sessões ou a conexão do perfil de origem silenciosamente.
- Manter teclado, foco, rótulos acessíveis, estados de carregamento e rolagem em telas menores.

## Verificação da 0.3.1

O autoteste do aplicativo usa armazenamento temporário e uma proxy fictícia sem conexão externa. Confere botão indisponível com endereço vazio/inválido, conferência sem usuário/senha expostos, salvamento pelo formulário, resposta sem segredo na API e remoção da fixture. O CI Windows exige esse resultado antes de publicar o instalador.

RAM, CPU, resolução, gráficos, modo de memória, presets e vídeo pertencem à versão 0.3.0 e permanecem disponíveis. A 0.3.1 não muda o motor Android, não instala imagens SDK e não modifica migrações ou dados Supabase. A medição de 8,1 FPS da imagem atual e as pendências de rede continuam documentadas em `hot-profiles-performance.md`.
