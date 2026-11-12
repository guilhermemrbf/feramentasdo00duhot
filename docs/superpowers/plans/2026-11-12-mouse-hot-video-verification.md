# Plano — corrigir falhas de verificação dos vídeos

> Execução com superpowers:subagent-driven-development na branch `codex/mouse-hot-v3`.

**Meta:** recuperar transferências quando o servidor aceita o vídeo completo e entregar um pacote validado no Chrome.

**Evidência inicial:** a captura aponta falha antes da transferência. O erro atual agrupa falhas de rede e tempo limite. O REA observou a página pública do ScaleReels (`ev_534615d3c3faa5a6171320419ffdc6a1ff008890ef2d0fcce54abe8546471605`), que mostra agendamento e publicação, sem evidência pública do transporte do downloader. As páginas dos Reels do print apresentaram o acesso do Instagram no navegador descartável (`ev_750eff79a5db7b864a5595d7e74c9279c2e11fd4a564471a99ddd9e256e686cd`, `ev_2786c317f1792188be21615139d734eaddef2082d2b6a9c5033332e8e56612f1`). Isso não identifica a resposta que o CDN deu à conta do usuário.

### Task 1: Diagnóstico da origem e reprodução

- [x] Provar com os Reels indicados, quando o Instagram os expuser anonimamente, se existe URL direta e se a verificação recebe HTTP, erro de rede ou limite de tempo. Sem sessões do usuário nem registro de URL assinada.
- [x] Reproduzir a falha com uma origem que rejeita leitura parcial e aceita GET normal. Distinguir essa condição de origem indisponível, timeout e bloqueio explícito.

### Task 2: Corrigir verificação e preservar guardas

- [x] Quando a leitura parcial falhar por rede, resposta de Range incompatível ou limite de tempo, tentar um GET normal do mesmo vídeo direto com prazo limitado e leitura apenas do prefixo.
- [x] Respeitar erros de autorização, seguir sem redirects e conferir assinatura antes de enviar ao Chrome. Manter alternativas por URL e informar a causa concreta quando nenhuma forma funcionar.
- [x] Adicionar testes unitários e demonstrar no Chrome que o arquivo completo foi gravado no caso que falhava.
- [x] Fazer o botão de tentar novamente buscar um endereço atualizado para o arquivo que falhou e mostrar somente o estado mais recente da mídia no painel.

### Task 3: Revisão e entrega

- [x] Fazer revisão independente, suíte da extensão, teste no Chrome e checagem pública real quando disponível.
- [x] Empacotar a versão 3.0.3, verificar o ZIP e registrar o commit na branch de extensão.

### Evidências

- A regressão de Chrome contra a versão anterior falhou ao tentar gravar o MP4 quando o servidor de teste recusou a leitura parcial. O Chrome gravou os bytes completos com a verificação corrigida. Um segundo cenário confirmou que a versão anterior do botão repetia o endereço expirado; com a correção, o vídeo é salvo sem baixar outra cópia da foto do mesmo carrossel.
- O build 3.0.3, carregado em um Chrome descartável, baixou os dois Reels do print pela sobreposição: `DZS5noEhxVb` (2.313.134 bytes, H.264, 12,27 s) e `DZTkgmvOODZ` (1.108.133 bytes, H.264, 6,5 s). Os arquivos tinham assinatura MP4 e foram inspecionados com ffprobe. A reprodução pública não identifica a causa exata da falha no computador do usuário.
- A revisão independente encontrou uma reutilização de fonte antiga quando a publicação não devolvia o arquivo procurado. Um teste unitário reproduziu o problema e confirmou que a tentativa agora exige uma fonte retornada pela nova consulta para aquela mídia.
- A suíte da extensão passou com 49 testes, e a suíte de navegador passou no Chrome 157. O ZIP foi conferido arquivo por arquivo contra o build de produção.
