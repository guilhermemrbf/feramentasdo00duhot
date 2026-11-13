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
    id: "tempMail",
    path: "/email-temporario",
    name: "Correio Temporário",
    category: "Ambientes",
    mode: "Caixa de entrada",
    summary: "Receba mensagens em um endereço de e-mail descartável.",
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
    path: "/telegram-sync",
    name: "Telegram Sync",
    category: "Conteúdo",
    mode: "Aplicativo Windows",
    summary: "Troque os links de posts existentes em um canal que você administra.",
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
    path: "/mouse-hot-downloader",
    name: "Mouse Hot Downloader",
    category: "Conteúdo",
    mode: "Extensão para Chrome",
    summary: "Baixe fotos, vídeos e Reels do Instagram e do TikTok, direto no computador.",
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
    path: "/image-links",
    name: "Image Links",
    category: "Conteúdo",
    mode: "Hospedagem pública",
    summary: "Transforme imagens e vídeos em links prontos para compartilhar.",
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
    path: "/criar-pagina",
    name: "Criar Tela Privacy",
    category: "Conteúdo",
    mode: "Gerador de prompt",
    summary: "Organize dados e imagens para gerar o prompt da sua página.",
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
    path: "/limpar-metadados",
    name: "Limpar Metadados",
    category: "Preparação",
    mode: "No navegador",
    summary: "Remova dados incorporados em fotos e vídeos, individualmente ou em lote.",
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
    path: "/otimizar-criativos",
    name: "Otimizar Criativos",
    category: "Preparação",
    mode: "No navegador",
    summary: "Reexporte materiais e aplique sua marca em imagens e vídeos.",
    input: "Criativos e, se desejar, uma imagem ou texto de marca.",
    output: "Imagens WEBP e vídeos WEBM com o overlay configurado.",
    steps: [
      "Escolha os criativos e personalize a marca.",
      "Defina posição e opacidade antes de processar.",
      "Gere e baixe os materiais finalizados.",
    ],
    requirement: "Os arquivos ficam no navegador. Vídeos são renderizados durante sua reprodução.",
  },
  {
    id: "preview",
    path: "/gerar-preview",
    name: "Gerar Preview",
    category: "Preparação",
    mode: "No navegador",
    summary: "Crie prévias com desfoque ou pixelização na intensidade escolhida.",
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
    path: "/automacao-instagram",
    name: "Automatic Post · Instagram",
    category: "Automação",
    mode: "Instagram Reels",
    summary: "Organize vídeos, legendas e programações de Reels no Instagram.",
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
    id: "funnels",
    path: "/funil",
    name: "Funil",
    category: "Planejamento",
    mode: "Workspace local",
    summary: "Desenhe, conecte e organize as etapas da sua operação.",
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
    path: "/hot-profiles",
    name: "Hot Profiles",
    category: "Automação",
    mode: "Preparação de perfis",
    summary: "Prepare e organize novos perfis para o agendamento de conteúdo no Instagram.",
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
  (tool) => tool.id !== "tempMail" || Boolean(TEMP_MAIL_URL),
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
  return TOOL_CATALOG.find(
    (tool) => tool.path === path,
  );
}
export function searchTools(query: string, category = "Todas") {
  const terms = normalizeSearch(query).split(/\s+/).filter(Boolean);
  return TOOL_CATALOG.filter(
    (tool) =>
      (category === "Todas" || tool.category === category) &&
      terms.every((term) =>
        normalizeSearch(
          `${tool.name} ${tool.summary} ${tool.category} ${tool.mode} ${tool.input} ${tool.output} ${tool.requirement}`,
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
          ...new Set(value.filter((id): id is string => typeof id === "string" && ids.has(id))),
        ].slice(0, 9)
      : [];
  return { favorites: clean(data.favorites), recent: clean(data.recent) };
}
