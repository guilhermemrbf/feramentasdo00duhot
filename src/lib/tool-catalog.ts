function publicMailUrl(value: string | undefined) {
  if (!value) return null;
  try {
    const url = new URL(value);
    const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
    if (url.username || url.password || url.href !== url.origin + "/") return null;
    if (url.protocol === "https:" || (import.meta.env?.DEV && local && url.protocol === "http:")) {
      return url.href;
    }
  } catch {
    return null;
  }
  return null;
}

export const TEMP_MAIL_URL = publicMailUrl(import.meta.env?.VITE_TEMP_MAIL_URL);

const ALL_TOOLS = [
  {
    id: "controlHub",
    action: "Baixar para Windows",
    path: "/fazenda-de-celulares",
    name: "Fazenda de Celulares",
    category: "Ambientes",
    mode: "Aplicativo Windows",
    summary:
      "Conecte múltiplos celulares via USB ao seu computador Windows e gerencie os dispositivos em um único ambiente, com mais organização e controle para sua operação digital.",
    overview: {
      title: "Controle seus celulares pelo Windows",
      highlights: ["Conexão de vários iPhones via USB", "Tela e controle em aparelhos compatíveis"],
    },
    input: "iPhones compatíveis e cabos USB de dados.",
    output:
      "Lista de iPhones conectados e tela do aparelho selecionado, com mouse e teclado em versões compatíveis.",
    steps: [
      "Baixe e instale a Fazenda de Celulares no Windows.",
      "Conecte os iPhones desbloqueados por USB e confirme a confiança nos aparelhos.",
      "Selecione o iPhone e clique em Conectar e abrir tela.",
    ],
    requirement:
      "Windows 10/11 de 64 bits. A janela exibe um iPhone por vez. Para usar mouse e teclado, o aparelho precisa de iOS 27 ou superior e Modo de Desenvolvedor ativo.",
  },
  {
    id: "tempMail",
    action: "Abrir caixa de entrada",
    path: "/email-temporario",
    name: "Correio Temporário",
    category: "Ambientes",
    mode: "Caixa de entrada",
    summary: "Receba mensagens em um endereço de e-mail descartável.",
    overview: {
      title: "Receba mensagens em um e-mail temporário",
      highlights: ["Caixa de entrada privada", "Expiração automática"],
    },
    input: "Um endereço temporário gerado para seu navegador.",
    output: "Mensagens em uma caixa privada com atualização ao vivo e expiração.",
    steps: [
      "Abra a ferramenta e copie seu endereço temporário.",
      "Aguarde as mensagens na caixa de entrada.",
      "Exclua a caixa quando terminar ou deixe que expire.",
    ],
    requirement: "O serviço de recebimento precisa estar conectado.",
  },
  {
    id: "telegram",
    action: "Trocar links do canal",
    path: "/telegram-sync",
    name: "Telegram Sync",
    category: "Conteúdo",
    mode: "Aplicativo Windows",
    summary: "Revise e substitua links em publicações de um canal que você administra.",
    overview: {
      title: "Atualize links no seu canal do Telegram",
      highlights: ["Prévia antes de aplicar", "Backup local"],
    },
    input: "Sua conta Telegram, seu canal e o novo link de destino.",
    output: "Edição dos links com prévia, acompanhamento e backup local.",
    steps: [
      "Baixe o aplicativo e conecte sua conta.",
      "Escolha seu canal, informe o novo link e analise os posts.",
      "Confira o antes e depois e confirme a aplicação dos links.",
    ],
    requirement:
      "Computador Windows ligado, aplicativo aberto, internet e permissão para editar os posts do canal.",
  },
  {
    id: "downloader",
    action: "Baixar a extensão",
    path: "/mouse-hot-downloader",
    name: "Mouse Hot Downloader",
    category: "Conteúdo",
    mode: "Extensão para Chrome",
    summary: "Baixe fotos, vídeos e Reels do Instagram e do TikTok, direto no computador.",
    overview: {
      title: "Salve as mídias que você precisa",
      highlights: ["Extensão para Chrome", "Arquivos salvos no computador"],
    },
    input: "Um perfil ou publicação que você tem permissão para baixar.",
    output: "Arquivos salvos na pasta Downloads do Chrome, um por vez.",
    steps: [
      "Baixe o ZIP e extraia a pasta Mouse Hot.",
      "Instale a pasta em Extensões no Chrome.",
      "Abra a rede social, clique em Ver mídias e escolha o que baixar.",
    ],
    requirement: "Google Chrome 120 ou mais recente em um computador.",
  },
  {
    id: "images",
    action: "Criar links dos arquivos",
    path: "/image-links",
    name: "Image Links",
    category: "Conteúdo",
    mode: "Hospedagem pública",
    summary: "Gere links públicos de imagens e vídeos para usar em páginas, posts ou mensagens.",
    overview: {
      title: "Transforme seus arquivos em links",
      highlights: ["Hospedagem de imagens e vídeos", "Links diretos, Markdown e HTML"],
    },
    input: "Imagens ou vídeos nos formatos aceitos.",
    output: "URLs diretas, Markdown, HTML ou referências para prompts.",
    steps: [
      "Selecione os arquivos que deseja hospedar.",
      "Acompanhe o envio e confira os resultados.",
      "Copie os links no formato que preferir.",
    ],
    requirement: "Usa o Cloudinary configurado no projeto. Os arquivos enviados ficam públicos.",
  },
  {
    id: "pages",
    action: "Preparar minha página",
    path: "/criar-pagina",
    name: "Criar Tela Privacy",
    category: "Conteúdo",
    mode: "Gerador de prompt",
    summary: "Reúna o nome, a descrição e as imagens do perfil em um prompt para criar sua página.",
    overview: {
      title: "Prepare sua página de perfil",
      highlights: ["Foto, capa e descrição", "Prompt pronto para copiar"],
    },
    input: "Fotos de perfil e capa, nome, usuário e descrição.",
    output: "Prompt completo e instruções complementares para sua IA programadora.",
    steps: [
      "Preencha os dados do perfil e as duas imagens.",
      "Revise os campos e gere o prompt.",
      "Copie ou baixe o texto e use na sua IA programadora.",
    ],
    requirement:
      "Esta ferramenta gera instruções; a criação e publicação da página acontecem na ferramenta de destino.",
  },
  {
    id: "metadata",
    action: "Limpar meus arquivos",
    path: "/limpar-metadados",
    name: "Limpar Metadados",
    category: "Preparação",
    mode: "No navegador",
    summary: "Limpe os metadados de fotos e vídeos no navegador, em um arquivo ou em lote.",
    overview: {
      title: "Remova os metadados dos seus arquivos",
      highlights: ["Processamento local no navegador", "Exportação em ZIP para lotes"],
    },
    input: "Fotos e vídeos compatíveis com seu navegador.",
    output: "Novos arquivos processados; a área de lote também exporta ZIP.",
    steps: [
      "Escolha o tipo de mídia ou use a área de processamento em lote.",
      "Adicione arquivos e inicie a limpeza.",
      "Confira os resultados e baixe os arquivos.",
    ],
    requirement:
      "O processamento permanece neste dispositivo. A exportação individual de vídeo usa WEBM; os limites do lote aparecem na própria área.",
  },
  {
    id: "creatives",
    action: "Personalizar meus materiais",
    path: "/otimizar-criativos",
    name: "Otimizar Criativos",
    category: "Preparação",
    mode: "No navegador",
    summary:
      "Aplique sua marca em fotos e vídeos e escolha a posição e a opacidade da sobreposição.",
    overview: {
      title: "Coloque sua marca nos criativos",
      highlights: ["Sobreposição de texto ou imagem", "Processamento local no navegador"],
    },
    input: "Criativos e, se desejar, uma imagem ou texto de marca.",
    output: "Imagens WEBP e vídeos WEBM com sua marca aplicada.",
    steps: [
      "Escolha os criativos e personalize a marca.",
      "Defina posição e opacidade antes de processar.",
      "Gere e baixe os materiais finalizados.",
    ],
    requirement: "Os arquivos ficam no navegador. Vídeos são renderizados durante sua reprodução.",
  },
  {
    id: "preview",
    action: "Criar uma prévia",
    path: "/gerar-preview",
    name: "Gerar Preview",
    category: "Preparação",
    mode: "No navegador",
    summary: "Crie prévias com desfoque ou pixelização na intensidade escolhida.",
    overview: {
      title: "Gere uma prévia antes de compartilhar",
      highlights: ["Efeitos para fotos e vídeos", "Intensidade ajustável"],
    },
    input: "Fotos ou vídeos, efeito e intensidade.",
    output: "Uma nova mídia com o efeito aplicado.",
    steps: [
      "Escolha o tipo de mídia e adicione os arquivos.",
      "Selecione desfoque ou pixelização e ajuste a intensidade.",
      "Gere a prévia e baixe o resultado.",
    ],
    requirement:
      "O processamento é local. Confira o resultado antes de compartilhar; desfoque não é garantia de anonimização.",
  },
  {
    id: "social",
    action: "Programar no Instagram",
    path: "/automacao-instagram",
    name: "Automatic Post · Instagram",
    aliases: "Hot Profiles Stories",
    category: "Automação",
    mode: "Instagram Reels",
    summary: "Separe os vídeos por conta, programe Reels e confira o resultado no histórico.",
    overview: {
      title: "Sua operação no Instagram",
      highlights: ["Biblioteca de Reels", "Fila de publicações"],
    },
    input: "Vídeos, legendas, horários e conta profissional do Instagram autorizada no workspace.",
    output: "Programações salvas de Reels e acompanhamento das confirmações no Histórico.",
    steps: [
      "Abra seu workspace e conecte uma conta profissional do Instagram.",
      "Envie os vídeos e revise as legendas, contas e horários.",
      "Salve a programação de Reels e acompanhe as confirmações no Histórico.",
    ],
    requirement:
      "Conta profissional do Instagram autorizada; a conexão via Facebook exige uma Página vinculada. O serviço de publicação precisa estar ativo para executar os horários salvos. Agendar não confirma uma publicação: confira o Histórico.",
  },
  {
    id: "sales",
    action: "Acompanhar vendas",
    path: "/vendas",
    name: "ScaleHot · Vendas",
    category: "Automação",
    mode: "Webhooks de vendas",
    summary:
      "Acompanhe as vendas recebidas dos seus gateways e receba alertas quando uma nova venda for aprovada.",
    overview: {
      title: "Acompanhe as vendas da sua operação",
      highlights: ["Faturamento e histórico", "Webhooks e notificações"],
    },
    input: "Eventos enviados por um gateway conectado ao seu webhook.",
    output: "Métricas em reais, histórico e notificações nos dispositivos ativados.",
    steps: [
      "Abra Integrações no ScaleHot, escolha um gateway e copie a URL.",
      "Cole a URL na plataforma de pagamento e selecione os eventos de vendas e estornos.",
      "Ative os alertas no seu dispositivo e envie uma notificação de teste.",
    ],
    requirement: "Conta MouseHot aprovada e eventos enviados por um gateway configurado.",
  },
  {
    id: "intelligence",
    action: "Analisar perfis",
    path: "/instagram-intelligence",
    name: "Instagram Intelligence",
    category: "Planejamento",
    mode: "Análise de perfis",
    summary:
      "Compare desempenho, potencial e conformidade de até 1.000 perfis em uma análise privada.",
    overview: {
      title: "Compare perfis antes de decidir",
      highlights: ["Notas e justificativas", "Análise com as métricas disponíveis"],
    },
    input: "Perfis do Instagram e métricas de fontes autorizadas.",
    output: "Perfis aprovados e não aprovados, com notas e justificativas disponíveis.",
    steps: [
      "Entre com Google e cole os links ou @usuários.",
      "Clique em Analisar e acompanhe o progresso.",
      "Confira as notas e os motivos de cada resultado.",
    ],
    requirement:
      "A análise depende de métricas disponíveis e de revisão autorizada para classificar conteúdo e conformidade.",
  },
  {
    id: "funnels",
    action: "Organizar meu funil",
    path: "/funil",
    name: "Funil",
    category: "Planejamento",
    mode: "Workspace local",
    summary: "Desenhe o caminho de uma campanha e conecte as decisões em um quadro visual.",
    overview: {
      title: "Monte o caminho da sua campanha",
      highlights: ["Quadro visual editável", "Exportação e compartilhamento"],
    },
    input: "Etapas, textos, imagens e conexões do fluxo.",
    output: "Um board editável com opções de organização, exportação e compartilhamento.",
    steps: [
      "Abra um funil ou crie um novo.",
      "Adicione etapas e conecte o caminho de cada decisão.",
      "Salve, exporte ou compartilhe usando os controles do board.",
    ],
    requirement:
      "O workspace usa o armazenamento deste navegador. Guarde uma exportação antes de limpar os dados do navegador.",
  },
  {
    id: "profiles",
    action: "Preparar um perfil",
    path: "/hot-profiles",
    name: "Hot Profiles",
    category: "Automação",
    mode: "Preparação de perfis",
    summary: "Prepare e organize novos perfis para o agendamento de conteúdo no Instagram.",
    overview: {
      title: "Organize a preparação dos seus perfis",
      highlights: ["Fichas de perfil", "Agendas de Reels e Stories"],
    },
    input: "Nome, @, foto, bio, link do produto e seleção dos primeiros Reels.",
    output: "Fichas em etapas com acesso às agendas de Reels e Stories.",
    steps: [
      "Prepare a ficha e os primeiros vídeos.",
      "Crie a conta no Instagram e conecte o perfil profissional pelo login oficial.",
      "Revise a programação de Reels e prepare os Stories.",
    ],
    requirement:
      "Entre no MauseHot para salvar fichas. Para agendar, conecte uma conta profissional que você administra.",
  },
] as const;
export const TOOL_CATALOG = ALL_TOOLS.filter(
  (tool) => tool.id !== "profiles" && (tool.id !== "tempMail" || Boolean(TEMP_MAIL_URL)),
);
export type Tool = (typeof ALL_TOOLS)[number];
export type ToolPath = Tool["path"];
export const CATEGORIES = [
  "Todas",
  "Conteúdo",
  "Preparação",
  "Automação",
  "Planejamento",
  "Ambientes",
] as const;
export function normalizeSearch(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}
export function findTool(path: string) {
  return TOOL_CATALOG.find((tool) => tool.path === path);
}
export function searchTools(query: string, category = "Todas") {
  const terms = normalizeSearch(query).split(/\s+/).filter(Boolean);
  return TOOL_CATALOG.filter(
    (tool) =>
      (category === "Todas" || tool.category === category) &&
      terms.every((term) =>
        normalizeSearch(
          `${tool.name} ${tool.action} ${tool.summary} ${tool.category} ${tool.mode} ${tool.input} ${tool.output} ${tool.requirement} ${"aliases" in tool ? tool.aliases : ""}`,
        ).includes(term),
      ),
  );
}
export type ToolPreferences = { favorites: string[]; recent: string[] };
export function cleanPreferences(input: unknown): ToolPreferences {
  const data = input && typeof input === "object" ? (input as Record<string, unknown>) : {};
  const ids = new Set<string>(ALL_TOOLS.map((tool) => tool.id));
  const clean = (value: unknown) =>
    Array.isArray(value)
      ? [
          ...new Set(
            value
              .filter((id): id is string => typeof id === "string" && ids.has(id))
              .map((id) => (id === "profiles" ? "social" : id)),
          ),
        ].slice(0, 9)
      : [];
  return { favorites: clean(data.favorites), recent: clean(data.recent) };
}
