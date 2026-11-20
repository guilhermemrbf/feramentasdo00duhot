# MouseHot

Painel de operação digital com TanStack Start, Vercel e Supabase independente. Veja o [roteiro de implantação e migração](docs/supabase-vercel-migration.md).

## Desenvolvimento

Use Node.js 24 e Bun com o lockfile versionado. Configure as variáveis de desenvolvimento a partir de [.env.example](.env.example), com um projeto Supabase separado.

```sh
bun install --frozen-lockfile
npm run dev
npm test
```

O deploy de produção usa o domínio configurado em APP_BASE_URL e as variáveis do projeto Vercel. Image Links usa o Cloudinary configurado para a aplicação.

## Hot Profiles

Área em `/hot-profiles`: **Meu computador** é o modo padrão, com conector local, navegadores e instâncias Android existentes. O seletor **Nuvem** preserva a implementação Supabase/Browserbase/Genymotion e seus cadastros separados; não há migração automática.

**Ativação e limitações:** [guia da nuvem](docs/hot-profiles-cloud.md) e [.env.example](.env.example). Aplicar a migração, liberar as contas autorizadas e configurar os provedores antes de usar. Android nesta base é temporário; Android com proxy automática e armazenamento persistente ainda depende de infraestrutura adicional.

### Execução local

- **Atualização 0.3.1:** cadastro rápido de proxy por endereço, conferência visual e guia proxy → perfil → iniciar. [Validação](docs/hot-profiles-031-validation.md).
- **Atualização 0.3.0:** ajustes de RAM/CPU/GPU/resolução/FPS por perfil, presets, vídeo H.264 e botão **Novo igual** para criar outro celular vazio com as mesmas configurações. [Detalhes e medições](docs/hot-profiles-performance.md). A imagem Android atual impõe um mínimo de 4 GB; não há promessa de 30/60 FPS ou de fluidez em aplicativos sociais.

- **Protótipo Android próprio 0.2.0:** cria celulares vazios com discos por perfil, inicia o Android Emulator do SDK local e apresenta tela e controles dentro do aplicativo. Não requer BlueStacks nesse modo; SDK/imagem não acompanham o instalador. Um celular próprio ativo por vez, rede restrita e isolamento integral ainda em validação. [Arquitetura e evidências](docs/hot-profiles-android-runtime.md).

- [Hot Profiles Desktop 0.3.1 experimental para Windows](https://github.com/guilhermemrbf/feramentasdo00duhot/releases/tag/hot-profiles-desktop-5-1): instalador, janela própria e conector incluído. Preserva os perfis locais existentes; não exige Node.js do usuário final nem o site publicado. O Android próprio usa SDK/imagem previamente instalados. [Instruções](apps/hot-profiles-desktop/README.md) e [validação de desempenho](docs/hot-profiles-performance.md). Isolamento integral de rede e compatibilidade de aplicativos ainda não comprovados.

- `npm run profiles:bridge`: inicia o conector local (Node.js 22+).
- `npm run profiles:package`: gera `public/hot-profiles-connector.zip`, disponível no botão de conexão do painel. Execute novamente após alterar os arquivos do conector.
- A interface local está em `src/components/hot-profiles/LegacyLocalWorkspace.tsx` e é o padrão da rota principal.

Instruções do conector: [LEIA-ME](tools/hot-profiles/LEIA-ME.md), [estrutura local](docs/hot-profiles-local.md) e [validação Android no Windows](docs/hot-profiles-windows-validation.md). Dados e emuladores anteriores não são apagados ou migrados automaticamente. Proxy HTTP no Android não comprova roteamento integral dos aplicativos.

## Telegram Sync

Aplicativo Windows para **Trocar links do meu canal**, com análise, prévia, aplicação e restauração de backups locais. Cópia entre canais e agendas foram retiradas na versão 0.7.1. Veja [instruções e limites](apps/telegram-sync-desktop/README.md).

### Telegram Sync Desktop gratuito

A rota `/telegram-sync` distribui o editor local para Windows, sem banco remoto ou servidor. Código e instruções: [apps/telegram-sync-desktop](apps/telegram-sync-desktop). A implementação cloud anterior é histórica e não está integrada à plataforma. O executável é gerado e testado no workflow `Telegram Sync Windows`, apenas em repositórios públicos com executor padrão.
