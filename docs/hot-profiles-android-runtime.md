# Motor Android local do Hot Profiles

## Objetivo confirmado

Criar celulares virtuais gerenciados pelo Hot Profiles, sem depender do BlueStacks instalado. O usuário cria um perfil, associa uma proxy e inicia seu Android dentro da janela do aplicativo Windows. Cada celular tem armazenamento persistente próprio. O frontend React do Lovable apresenta controles e estados; o runtime e os dados Android ficam no computador, não no Supabase.

O adaptador BlueStacks existente não atende a esse objetivo. Nenhuma instância existente deve ser convertida, importada ou alterada implicitamente. O novo runtime deve ser um provedor separado e preservar os cadastros atuais.

## Diagnóstico somente de leitura — 26/10/2026

- Windows 11 Pro, versão 10.0.26300; Intel Core i5-1145G7, oito processadores lógicos.
- Memória física: 7,7 GB; aproximadamente 1,8 GB disponíveis durante a consulta. Disco C: aproximadamente 51,5 GB livres na consulta pelo sandbox.
- SDK encontrado em `C:\Users\User\AppData\Local\Android\Sdk`, com emulator e platform-tools presentes.
- `emulator.exe -version`: Android Emulator 37.1.11.0, build 15917651, derivado do QEMU.
- `emulator.exe -accel-check`: código de aceleração 0; `WHPX(10.0.26300) is installed and usable.`
- A consulta CIM informa HypervisorPresent=true e flags de firmware/SLAT=false. Não concluir que virtualização está indisponível a partir dessas flags: o teste direto do motor confirmou WHPX utilizável.
- Metadados da imagem instalada: API 37.1, x86_64, Google Play, páginas de 16 KB, revisão 9. Isso não comprova compatibilidade com os aplicativos desejados nem autorização para redistribuição.
- Nenhum Android iniciado, ADB iniciado, perfil existente lido, credencial acessada, configuração de Windows alterada ou pacote instalado por este diagnóstico.

## Decisão de arquitetura para o protótipo

Usar o motor Android Emulator já disponível como base técnica de um primeiro dispositivo descartável criado pelo Hot Profiles. Isso comprova inicialização e integração sem BlueStacks; não representa um motor escrito do zero nem um runtime já pronto para distribuição. Manter executável, imagem e ferramenta de criação explicitamente configurados e com versões verificadas; não selecionar uma instância pessoal existente.

Separar quatro componentes:

1. Provedor de runtime: preparar dispositivo, iniciar, aguardar boot, consultar estado, parar e recuperar após falha. Identidade estável, diretório exclusivo por perfil e reserva de recursos/portas.
2. Tela e entrada: transportar imagem e comandos de toque/teclado por canal local autenticado até a janela Electron. Um processo em segundo plano ou janela externa não satisfaz sozinho a exigência de Android dentro do aplicativo.
3. Rede: rota exclusiva por dispositivo, proxy autenticada por gateway local e bloqueio de saída direta, inclusive quando o gateway falhar. Tratar DNS, IPv6 e UDP explicitamente. A opção HTTP do emulador não constitui prova de isolamento integral.
4. Distribuição: selecionar artefatos e imagens redistribuíveis, fixar hashes, listar licenças e obrigações de código-fonte, empacotar e atualizar o runtime. Não incluir automaticamente a imagem Google Play instalada no instalador.

## Marcos e evidências exigidas

### M1 — Um Android próprio inicializa

Criar dispositivo vazio em diretório de teste exclusivo, inicializá-lo com o motor configurado e confirmar boot. Parar pelo Hot Profiles; iniciar novamente e verificar persistência de um marcador sintético. Não usar contas ou aplicativos pessoais. Primeiro validar imagem/ABI/versão adequadas; a imagem já instalada não é automaticamente a escolhida para o produto.

### M2 — Android utilizável dentro da janela

Exibir a tela na sessão do Hot Profiles e validar toque, teclado, rotação e encerramento. Não apresentar somente captura estática como integração concluída. Medir latência e consumo real antes de oferecer várias instâncias.

### M3 — Proxy por celular e bloqueio comprovado

Testar TCP, HTTP/HTTPS, resolução DNS, IPv6 e UDP, definindo o que será encaminhado ou bloqueado. Parar a proxy e provar que nenhuma conexão direta substitui a rota. Reiniciar o dispositivo e repetir. Só então apresentar isolamento como validado. O adaptador HTTP atual já demonstrou desvio de rota e não atende a este marco.

### M4 — Dois perfis e instalador

Com recursos suficientes, iniciar dois celulares com discos e proxies distintos; verificar persistência, IPs de saída e ausência de troca de rotas entre perfis. Preparar instalador com artefatos autorizados e atualizações verificáveis. Validar frontend no preview Lovable. Publicação do site continua manual pelo usuário; este plano não executa deploy.

## Protótipo implementado — 0.2.0

O provedor `android-runtime.mjs` cria os arquivos do dispositivo em `android-runtime/<UUID>.avd` dentro da pasta de dados do Hot Profiles. Usa SDK externo, ADB privado em porta dinâmica, nomes e discos exclusivos e bloqueio de escrita concorrente. O painel cria perfis com identidade `runtime:<UUID>` e abre a tela pelo visualizador existente, com capturas sucessivas e comandos de toque, gestos e teclado ASCII. Encerrar a sessão desliga o motor e preserva o disco. O protótipo permite somente um celular próprio ativo por vez.

Teste real com Android vazio no computador do titular passou: boot, captura renderizada, comandos, HTTP por proxy simulada local, rejeição de acesso direto ao servidor local de controle, 502 com a proxy desligada, persistência de marcador sintético após reiniciar e encerramento. Não foram usados contas sociais, senhas de proxy reais ou dispositivos pessoais. O relatório e a imagem sintética ficam na pasta ignorada `.hot-profiles/runtime-smoke`.

O teste inicial mostrou que Wi-Fi via Netsim ignorava a restrição de rede. O provedor agora desativa `WiFiPacketStream` e aplica `restrict=on,ipv6=off` ao backend clássico de Wi-Fi e rádio. A proxy HTTP usa ADB reverse para o gateway local. A evidência de bloqueio é limitada aos destinos locais ensaiados: `deviceWideVerified`, `dnsVerified` e `failClosed` continuam falsos. Não há túnel transparente para aplicativos que ignoram proxy HTTP.

A GPU automática corrigiu a captura preta observada com SwiftShader/Vulkan desabilitado. A imagem API 37.1 instalada impõe 4 GB ao dispositivo apesar do pedido de 1,5 GB e recomenda 16 GB no host. Portanto, o desempenho neste PC de 7,7 GB é limitado; uma imagem estável mais leve ainda deve ser avaliada. Nenhuma imagem foi redistribuída no instalador.

O executável empacotado 0.2.0 passou no teste de criação/início pela interface e exibição da tela inicial real do Android na aba Sessões. O autoteste exige o elemento de imagem específico da sessão e conteúdo não uniforme; logotipo e quadros vazios não satisfazem a verificação. A abertura aguarda o launcher, pois `sys.boot_completed=1` sozinho pode preceder o desenho da tela. A interface rola para a sessão ao iniciá-la. O navegador vazio e as barreiras da API também passaram no pacote. Relatório técnico sem dados pessoais: [hot-profiles-runtime-validation.json](hot-profiles-runtime-validation.json).

## Requisitos ainda pendentes

- Seleção e validação da imagem Android e compatibilidade dos aplicativos, inclusive ABI e dependências de serviços Google. AOSP não implica Google Play incluído.
- Distribuição e atualização do runtime/imagem sem depender de SDK previamente instalado. O protótipo cria dispositivos diretamente a partir da imagem local, sem importar AVDs existentes.
- Transporte de vídeo fluido, áudio, câmera, rotação e texto Unicode. O visualizador atual usa capturas sucessivas; não declarar equivalência funcional completa ao BlueStacks.
- Controle de rede integral, DNS/UDP/IPv6 e validação com aplicativos reais; testes locais não comprovam isolamento completo na internet.
- RAM disponível suficiente para o teste de um dispositivo; concorrência deve depender de medição. Não prometer vários Androids neste computador com o estado atual de memória.
- Para compilar uma imagem AOSP completa, ambiente de build separado e recursos adequados. A documentação oficial exige pelo menos 400 GB livres; os aproximadamente 51,5 GB atuais não atendem a esse requisito. Executar um artefato pronto não exige compilar todo o AOSP aqui.

HxD/REA podem apoiar uma análise específica do BlueStacks, mas não são pré-requisitos para construir sobre o código público do Android Emulator/QEMU. Nenhuma decompilação foi realizada neste diagnóstico.

## Referências primárias

- https://android.googlesource.com/platform/external/qemu/+/emu-dev/
- https://developer.android.com/studio/run/emulator-commandline
- https://developer.android.com/studio/run/emulator-acceleration
- https://source.android.com/docs/setup/start/requirements
