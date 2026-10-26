# Scale Up Hub

Crie uma aplicação web de uma página chamada "Image Link Generator" com as seguintes funcionalidades:

Funcionalidade principal: O usuário arrasta ou clica para selecionar uma imagem (PNG, JPG, GIF, WEBP), a aplicação faz upload dessa imagem para o Cloudinary usando um preset público anônimo, e retorna um link curto e direto para a imagem (ex: https://res.cloudinary.com/...).

Interface:

Área de drag & drop centralizada com ícone e texto "Arraste a imagem aqui ou clique para selecionar"

Preview da imagem após seleção

Barra de progresso durante o upload

Campo com o link gerado, fácil de copiar com um clique

Botão "Copiar link" com feedback visual (ex: "Copiado!")

Botão "Abrir imagem" que abre o link em nova aba

Opções de formato de saída: URL direta, Markdown, HTML, Prompt IA

Botão "Nova imagem" para resetar

Técnico:

Use React + Tailwind

Upload via Cloudinary API: POST https://api.cloudinary.com/v1_1/SEU_CLOUD_NAME/image/upload com FormData contendo file e upload_preset

O Cloudinary name e o upload preset devem ser configuráveis via variáveis de ambiente .env: VITE_CLOUDINARY_CLOUD_NAME e VITE_CLOUDINARY_UPLOAD_PRESET

Tratar erros de upload com mensagem clara para o usuário

Design limpo, moderno, responsivo

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://feramentasdo00duhot.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/03560931-5f6a-41e1-a222-0510d1828a23).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```

## Hot Profiles

Área em `/hot-profiles`: **Meu computador** é o modo padrão, com conector local, navegadores e instâncias Android existentes. O seletor **Nuvem** preserva a implementação Supabase/Browserbase/Genymotion e seus cadastros separados; não há migração automática.

**Ativação e limitações:** [guia da nuvem](docs/hot-profiles-cloud.md) e [.env.example](.env.example). Aplicar a migração, liberar as contas autorizadas e configurar os provedores antes de usar. Android nesta base é temporário; Android com proxy automática e armazenamento persistente ainda depende de infraestrutura adicional.

### Execução local

- **Protótipo Android próprio 0.2.0:** cria celulares vazios com discos por perfil, inicia o Android Emulator do SDK local e apresenta tela e controles dentro do aplicativo. Não requer BlueStacks nesse modo; SDK/imagem não acompanham o instalador. Um celular próprio ativo por vez, rede restrita e isolamento integral ainda em validação. [Arquitetura e evidências](docs/hot-profiles-android-runtime.md).

- [Hot Profiles Desktop 0.1.0 para Windows](https://github.com/guilhermemrbf/feramentasdo00duhot/releases/tag/hot-profiles-desktop-1-1): instalador, janela própria e conector incluído. Reutiliza os perfis locais existentes; não exige Node.js do usuário final nem o site publicado. [Instruções](apps/hot-profiles-desktop/README.md) e [validação](docs/hot-profiles-desktop-validation.md). O suporte Android continua com a limitação de proxy HTTP documentada.

- `npm run profiles:bridge`: inicia o conector local (Node.js 22+).
- `npm run profiles:package`: gera `public/hot-profiles-connector.zip`, disponível no botão de conexão do painel. Execute novamente após alterar os arquivos do conector.
- A interface local está em `src/components/hot-profiles/LegacyLocalWorkspace.tsx` e é o padrão da rota principal.

Instruções do conector: [LEIA-ME](tools/hot-profiles/LEIA-ME.md), [estrutura local](docs/hot-profiles-local.md) e [validação Android no Windows](docs/hot-profiles-windows-validation.md). Dados e emuladores anteriores não são apagados ou migrados automaticamente. Proxy HTTP no Android não comprova roteamento integral dos aplicativos.

## Telegram Sync

Módulo de clonagem e sincronização autorizada de canais e grupos, com substituição de links, painel autenticado e worker Python isolado. Veja [configuração e limites](docs/telegram-sync.md).

### Telegram Sync Desktop gratuito

A rota `/telegram-sync` agora distribui a versão local para Windows, sem banco remoto ou servidor. Código e instruções: [apps/telegram-sync-desktop](apps/telegram-sync-desktop). A implementação cloud anterior foi preservada para evolução futura. O executável é gerado e testado no workflow `Telegram Sync Windows`, apenas em repositórios públicos com executor padrão.
