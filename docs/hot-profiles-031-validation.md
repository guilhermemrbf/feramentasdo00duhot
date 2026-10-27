# Hot Profiles 0.3.1 — cadastro e publicação

## Mudanças

Cadastro de proxy por endereço completo como opção inicial; conferência visual sem expor usuário/senha, nome automático opcional, edição individual e orientação de verificação após salvar. Guia de três passos no painel local. Os formulários compartilhados atualizam o aplicativo Windows e o frontend React do Lovable, inclusive o formulário de proxy do modo nuvem.

Padrão para próximas funcionalidades: [interface do Hot Profiles](hot-profiles-ux.md).

## Verificações locais

- 92 testes aprovados, incluindo rejeição de porta zero, porta acima de 65535, múltiplas linhas e tabulações no endereço colado.
- TypeScript raiz e desktop aprovados; build de produção do site e do painel desktop aprovados.
- ESLint nos arquivos de interface alterados: nenhum erro; um aviso preexistente de dependência de efeito em LegacyLocalWorkspace.
- Autoteste Electron 0.3.1 com armazenamento exclusivo temporário: formulário rápido, formato inválido bloqueado, conferência sem credenciais, salvamento, resposta da API sem segredo, limpeza da proxy fictícia, persistência após reiniciar o serviço e abertura/encerramento de navegador vazio.
- Captura local conferida visualmente em `.hot-profiles/proxy-031-final.png`. Apenas dados fictícios.

## Limites preservados

Nenhuma imagem SDK instalada, licença aceita ou configuração do BlueStacks alterada. Nenhuma conta social ou sessão pessoal acessada. Nenhuma migração, chave, política RLS ou dado Supabase alterado. O modo local mantém cadastros no PC.

RAM/CPU/GPU/resolução/FPS, presets e vídeo da 0.3.0 continuam disponíveis. O motor Android não foi alterado nesta atualização; o Android não foi reiniciado neste ciclo de interface. A medição anterior de 8,1 FPS na imagem atual não foi substituída por promessa de fluidez. Imagem alternativa mais leve foi adiada pelo titular. Compatibilidade com Instagram/TikTok, proxy transparente para todos os aplicativos, DNS/UDP/IPv6 e duas instâncias simultâneas continuam pendentes.

## Distribuição e site

Fonte do instalador: `f82246f983b2371b74ab3640909c1e8ac456aee5`.

- [CI Windows](https://github.com/guilhermemrbf/feramentasdo00duhot/actions/runs/40444979968): instalação real do pacote, formulário de proxy, API autenticada, navegador vazio, reinício do serviço e desinstalação preservando marcador aprovados. Android não é iniciado neste CI.
- [Release desktop 0.3.1](https://github.com/guilhermemrbf/feramentasdo00duhot/releases/tag/hot-profiles-desktop-5-1): instalador, ZIP portátil, manifesto SHA-256, relatório de autoteste e captura publicados.
- Instalador: 123749107 bytes, SHA-256 `326cbdceb6ece328fddd9eed6a914c6379273c658f1d42102899076f1977c8f9`.
- ZIP: 155542862 bytes, SHA-256 `6f2b372ec7a52c381a4428c0056e6ae7221a40c62a1c5c41163e601a67f27a18`.
- [Conector](https://github.com/guilhermemrbf/feramentasdo00duhot/releases/tag/hot-profiles-local-6-1): testes Windows/Linux aprovados; 37918 bytes, SHA-256 `8eed405f53d780b923ddb329f7fc4f5f026f54891ce2255723801c4f56996a8a`.
- Downloads lidos integralmente por streaming: HTTP 200, tamanho, assinatura PE/ZIP, digest GitHub e manifesto coincidentes. Nenhum binário baixado foi executado no PC do titular.

Publicação Lovable pendente da atualização dos links verificados na main.
