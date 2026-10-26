# Hot Profiles 0.3.0 — desempenho e perfis

[Download Windows](https://github.com/guilhermemrbf/feramentasdo00duhot/releases/tag/hot-profiles-desktop-4-1), fonte `4f71c2316adf3244e5793e7b17c5124f67dcb4a3`, [CI Windows aprovado](https://github.com/guilhermemrbf/feramentasdo00duhot/actions/runs/40365104657). Instalador e ZIP públicos foram lidos integralmente por streaming: HTTP 200, bytes e assinaturas PE/ZIP corretos, SHA-256 conferido com manifesto e digest GitHub. Instalador: 123747511 bytes, SHA-256 `c156181ff452d04879a72d0cd7ffb2e3d2723cab7f71d1c5363d59fd6f7bd70f`. ZIP: 155541343 bytes, SHA-256 `63cee43399c3b6058703708db9e15f38ed5b91e0c95e8f67da2b5bec31eb55f1`.

## Alterações

As configurações opcionais `androidSettings` são validadas no servidor e persistidas no perfil. O adaptador próprio aplica RAM/CPU/FPS/GPU à linha de comando e atualiza somente campos de hardware na configuração do AVD, preservando imagem, tamanho do disco e campos desconhecidos do motor. Não há migração ou limpeza dos dados Android. Perfis antigos recebem valores padrão; o SDK preserva a imagem original de cada disco.

Os presets ajustam recursos, resolução e animações. No modo econômico, o motor usa `-lowram`. CPU além da disponível, valores inválidos e RAM que não reserve ao menos 1 GB para o host são recusados. O formato de páginas de 16 KB é identificado nos metadados da imagem; opções abaixo de 4096 MB ficam indisponíveis na interface para essa imagem. RAM efetiva e CPU vêm da configuração de hardware produzida pelo motor, e podem diferir do pedido devido a limites da imagem.

O botão Novo igual reaproveita somente os campos do cadastro, usando `runtime:new`, nova identidade e proxy nula. A pasta de disco é criada somente na primeira inicialização do novo perfil. Androids externos continuam sem duplicação de dados ou de instância.

## Transmissão

O modo próprio oferece `/v1/sessions/<id>/video`, sujeito às mesmas barreiras de origem e autenticação do restante da API. Um processo ADB privado usa o `screenrecord` do Android para emitir H.264 por stdout, sem arquivo de gravação. Existe um encoder por sessão visualizada. Pressão de rede excessiva encerra a conexão em vez de acumular um atraso ilimitado; encerramento e desconexão limpam o processo de transporte. O encoder tem duração limitada e o cliente reconecta com novos parâmetros SPS/PPS.

O frontend separa unidades Annex B com memória limitada, agrupa slices por quadro e inclui SPS/PPS nos IDRs. WebCodecs decodifica diretamente em canvas, fecha cada VideoFrame e pausa o transporte ao sair da sessão ou ocultar a página. Capturas PNG permanecem como alternativa em caso de incompatibilidade ou sobrecarga. Cliques e gestos usam as dimensões reais do canvas. Capturas salvas enquanto o vídeo está ativo usam o quadro atual do canvas.

O limite de FPS configura a frequência virtual do motor; não garante quadros constantes do encoder, decoder ou aplicativo. Telas paradas podem produzir poucos quadros. O modo Nuvem e o Supabase não recebem imagens nem configurações locais.

## Evidência local — 26/10/2026

- 92 testes automatizados aprovados, incluindo fragmentação H.264, slices, limites de buffer, parâmetros inválidos, preservação dos campos de disco, persistência e duplicação com identidade distinta, sem proxy.
- Teste real do executável empacotado: CPU 4, RAM efetiva 4096 MB, resolução 360×640 e vídeo no canvas. Foram decodificados 140 quadros; no trecho com rolagens, 95 quadros em 11666 ms, aproximadamente 8,1 quadros/s. Pausa do encoder ao sair da sessão e retomada ao voltar aprovadas.
- A duração média das chamadas de gesto foi 763 ms e inclui o swipe de 300 ms; não é medida de latência ponta a ponta do vídeo. O teste usou Android vazio e Configurações, sem contas ou aplicativos sociais.
- A imagem local API 37.1/16 KB manteve o mínimo de 4096 MB mesmo com pedido inferior. Somente dados desta imagem/máquina foram medidos. Uma imagem padrão mais leve precisa de avaliação separada; não foi instalada automaticamente nem houve aceitação automática de nova licença SDK.
- O teste anterior de criptografia Instagram tinha uma alteração aleatória do último caractere Base64 que às vezes não mudava os bytes. O teste agora altera um caractere significativo garantidamente distinto. Nenhum código de OAuth, segredo ou configuração Supabase foi alterado.

## Limites

Não foi comprovada fluidez em Instagram/TikTok. O PC tem cerca de 8 GB físicos, e a imagem atual reserva 4 GB para o Android. Instalação de imagem estável mais leve, maior capacidade de concorrência, áudio/câmera, Unicode completo e proxy transparente de todos os aplicativos permanecem pendentes. A rede restrita e o aviso de isolamento não comprovado continuam; esta alteração de desempenho não transforma proxy HTTP em VPN.

Referências primárias: [opções do motor](https://developer.android.com/studio/run/emulator-commandline), [screenrecord AOSP](https://android.googlesource.com/platform/frameworks/av/+/refs/heads/master/cmds/screenrecord/screenrecord.cpp), [H.264 em WebCodecs](https://www.w3.org/TR/webcodecs-avc-codec-registration/).
