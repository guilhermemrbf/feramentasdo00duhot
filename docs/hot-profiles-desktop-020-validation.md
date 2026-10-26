# Hot Profiles Desktop 0.2.0 experimental — validação

Data: 26/10/2026. Fonte do aplicativo: `627205c6a2f9884720359d66fea92c0fa6462ab4` na main.

## Downloads verificados

[Release pública](https://github.com/guilhermemrbf/feramentasdo00duhot/releases/tag/hot-profiles-desktop-3-1) e [workflow Windows](https://github.com/guilhermemrbf/feramentasdo00duhot/actions/runs/40328448942).

| Arquivo | Bytes | SHA-256 |
| --- | ---: | --- |
| HotProfiles-0.2.0-x64.exe | 123740594 | f2c2bb466a404afa1250f4c2db7819ce3012a5cfd9ed3661dad0aab4ddc433a9 |
| HotProfiles-0.2.0-x64.zip | 155533538 | 9dcd47f36179fca78f8a5a882360eb84dc988ed3132091b4331b565623378c83 |

Os dois arquivos foram lidos integralmente por streaming a partir das URLs públicas, sem execução dos downloads. HTTP 200, tamanho, assinaturas PE/ZIP e hashes conferidos com o manifesto público e o digest dos assets GitHub.

## Evidências

- 88 testes aprovados, TypeScript da raiz e do desktop e builds do frontend e desktop concluídos.
- No Windows local, Android vazio iniciou pelo provedor próprio; tela inicial real foi exibida dentro do visualizador do executável empacotado. O teste exige a imagem específica da sessão e rejeita quadros sem conteúdo visível. Comandos de toque, gestos e teclado foram enviados ao dispositivo de teste.
- O teste de runtime confirmou HTTP por proxy simulada local, bloqueio dos destinos diretos locais ensaiados, erro 502 após desligar a proxy e marcador persistente após reiniciar o mesmo celular. Não comprova IP externo, todos os caminhos de DNS/UDP/IPv6 ou compatibilidade de aplicativos sociais.
- O pacote também passou no teste de navegador vazio e nas barreiras de autenticação/origem da API. No runner Windows público, o instalador foi instalado, o aplicativo testado e a desinstalação preservou o marcador de dados.
- Não foram utilizados contas sociais, senhas de proxies reais ou dados de instâncias pessoais. Os processos Android/ADB privados dos testes foram encerrados.

[Relatório técnico público](https://github.com/guilhermemrbf/feramentasdo00duhot/releases/download/hot-profiles-desktop-3-1/hot-profiles-runtime-validation.json). O CI verifica instalação e navegador; o teste de Android real foi realizado localmente, e não no runner.

## Primeiro teste do usuário

Feche a versão anterior do Hot Profiles antes de atualizar. Instale 0.2.0, abra **Novo perfil → Celular Android → Criar / usar celular próprio do Hot Profiles**, salve e clique em **Iniciar**. Comece com um novo perfil sem proxy para testar tela e controles com rede restrita; depois associe uma proxy àquele perfil. Não converter nem importar instâncias pessoais do BlueStacks.

O SDK Android e a imagem x86_64 precisam estar instalados no computador; o instalador não os redistribui. A instância própria não requer BlueStacks. O primeiro boot pode levar alguns minutos. O protótipo aceita um celular próprio ativo por vez. Tela por capturas, teclado ASCII, sem áudio/câmera; proxy HTTP não equivale a túnel integral para todos os aplicativos. A imagem API 37.1 instalada impõe 4 GB de RAM ao Android e recomenda 16 GB no host, limitando desempenho no PC de 7,7 GB.

Frontend compartilhado com Lovable, sincronizado pela main. Supabase e o modo nuvem anterior não receberam alterações ou migrações. Publicação do site continua manual pelo titular no Lovable.
