# InstaStart — Cadastro Instagram

Ferramenta do portal MauseHot em `/criar-conta-instagram`. Executa um cadastro acompanhado no Chrome/Edge local, usando o conector Hot Profiles. Não depende da API oficial nem de bibliotecas privadas do Instagram.

## Uso

1. Na página InstaStart, baixe o conector atualizado (`/hot-profiles-connector.zip`). Extraia e abra `Iniciar Hot Profiles.cmd`. Requer Node.js 22+ e Chrome ou Edge instalados.
2. Digite o código mostrado pelo conector. A página usa a mesma conexão local do Hot Profiles.
3. Informe nome, usuário, contato próprio e senha. Ao iniciar, uma janela visível abre o cadastro. Se os quatro campos e o botão forem reconhecidos, o formulário é preenchido e enviado uma única vez.
4. Complete data de nascimento, códigos e verificações na janela do Instagram. Se houver uma tela desconhecida, continue diretamente nessa janela. Nenhuma conta é marcada como criada automaticamente.
5. Após conferir que entrou na conta, marque a confirmação e registre o resultado. A confirmação é declarada pelo operador e identificada assim no histórico. Cancelar fecha somente o navegador desse cadastro.

O limite local é de dez tentativas por dia no fuso America/Sao_Paulo. Ele conta também tentativas recusadas, canceladas ou com falha; não é uma quota oficial nem garantia de dez contas aceitas. Uma operação fica ativa por vez. Não há repetição automática, rotação de proxies ou resolução automática de CAPTCHA.

## Dados e distribuição

- O formulário envia os dados diretamente ao conector autenticado em loopback. Nenhuma rota de servidor MauseHot recebe o cadastro.
- A senha não é persistida no histórico; guarde-a no seu gerenciador. O código de verificação é inserido diretamente no Instagram.
- `instagram-signups.json`, no diretório de dados do conector, retém até 200 tentativas contendo identificador, usuário, estado e datas. Trabalho aberto em um reinício aparece interrompido.
- Como nos navegadores Hot Profiles existentes, cookies e armazenamento do navegador permanecem no diretório `browsers/<id>` local. Esses arquivos não são incluídos no ZIP distribuído. Não há exportação de credenciais.
- O conector antigo publicado em releases não contém esta função. O botão InstaStart aponta ao ZIP recompilado junto com a aplicação. O instalador Hot Profiles Desktop existente não foi republicado.

## Pesquisa

Consulta em 14–15 de novembro de 2026:

- A [API oficial](https://developers.facebook.com/documentation/instagram-platform/instagram-api-with-instagram-login) documenta gestão de contas profissionais existentes, não um endpoint público de cadastro.
- O [`instagrapi`](https://github.com/subzeroid/instagrapi/blob/master/instagrapi/mixins/signup.py) implementa fluxos privados. A [discussão #1935](https://github.com/subzeroid/instagrapi/issues/1935) registra limitações de criação, e a [#2676](https://github.com/subzeroid/instagrapi/issues/2676) mostra que HTTP 200 pode acompanhar rejeição. Nenhuma dessas fontes comprova disponibilidade diária para esta instalação.
- Há publicidade comercial de criadores de contas, por exemplo [SusocialPro](https://blog.susocialpro.com/Instagram-Account-Generator/Instagram-Account-Creator-How-to-Create-and-Manage-Multiple-Instagram-Accounts-in-2026/21629). É uma alegação do fornecedor, não um teste independente realizado nesta entrega. Não foi instalado software desse fornecedor nem enviados dados a ele.
- O [Playwright](https://playwright.dev/docs/locators) confirma a abordagem de automação de interface. A implementação reaproveita o transporte CDP já existente para não adicionar dependências ao conector.

## Verificação reproduzível

Verificações da entrega: 146 testes do repositório passaram, compilação de produção passou,
lint dos arquivos novos passou e teste de Chrome com fixture passou. A revisão independente
encontrou duas condições de corrida no encerramento; ambas foram corrigidas com testes de regressão.
[Captura da interface no Chrome](instastart-ui.png).

A checagem global `tsc --noEmit` não está verde: apresentou 65 diagnósticos em
dependências e módulos existentes (Supabase, formulários, PDF e rotas de servidor).
Os mesmos diagnósticos foram encontrados na cópia da base; essa cópia também apresentou
27 diagnósticos adicionais de resolução de tipos Node. Não houve diagnóstico nos arquivos
novos do InstaStart. A compilação de produção e os testes passaram, mas isso não substitui
uma checagem global de tipos aprovada.

```powershell
node tools/hot-profiles/package.mjs
npm test
node tools/hot-profiles/verify-signup.mjs
npm run build
```

O teste de Chrome intercepta as páginas e responde com uma fixture local: nenhum pedido de criação é enviado ao Instagram. Verifica preenchimento, envio único, campos ausentes, origem incorreta, verificação e bloqueio. Para testar também a interface, inicie a prévia e defina `SIGNUP_UI_URL=http://127.0.0.1:8080/criar-conta-instagram` antes de rodar o verificador; ele salva `signup-ui.png`.

**Limite de validação:** não houve criação real de conta, recebimento de código nem teste de dez contas por dia. O funcionamento comprovado é o do aplicativo e da automação contra a fixture; compatibilidade com o cadastro real depende da tela apresentada pelo Instagram.
