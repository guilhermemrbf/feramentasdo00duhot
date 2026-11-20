export type MetaGuideStep = {
  title: string;
  instruction: string;
  controls: readonly string[];
  expected: string;
  images: readonly [filename: string, alt: string][];
  tip?: string;
  commonIssue?: string;
};

export const metaGuide: readonly MetaGuideStep[] = [
  {
    title: "Crie o app na Meta",
    instruction:
      "Em developers.facebook.com, clique em Meus apps e depois em Criar app. Preencha o nome e o e-mail e avance.",
    controls: ["Meus apps", "Criar app", "Avançar"],
    expected: "A tela “Criar um app”, com os campos Nome do app e Email de contato do app.",
    images: [["01-criar-app", "Tela Criar um app, com os campos de nome e e-mail de contato"]],
  },
  {
    title: "Escolha o caso de uso e crie o app",
    instruction:
      "Marque Gerenciar mensagens e conteúdo no Instagram, escolha o portfólio em Empresa e avance até Criar aplicativo. A Meta pode pedir sua senha de novo.",
    controls: ["Gerenciar mensagens e conteúdo no Instagram", "Avançar", "Criar aplicativo"],
    expected:
      "A lista de casos de uso, com os filtros à esquerda, e a Visão geral com o botão verde Criar aplicativo.",
    images: [
      ["02-caso-de-uso", "Lista de casos de uso com Gerenciar mensagens e conteúdo no Instagram"],
      ["04-visao-geral-criar", "Visão geral do app com o botão Criar aplicativo"],
    ],
    tip: "Em Empresa, escolha o portfólio empresarial que administra as contas da operação.",
  },
  {
    title: "Crie a configuração do login",
    instruction:
      "Em Casos de uso, clique em Personalizar e abra API setup with Unified login. Em 1. Configure seu app, clique em Criar nova configuração e confirme em Criar do modelo.",
    controls: [
      "Casos de uso",
      "Personalizar",
      "API setup with Unified login",
      "1. Configure seu app",
      "Criar nova configuração",
      "Criar do modelo",
    ],
    expected:
      "Após criar a configuração, o quadro do login unificado mostra a Identificação da configuração.",
    images: [
      ["12-criar-configuracao", "Configuração do app com o botão Criar nova configuração"],
      ["13-criar-do-modelo", "Confirmação dos detalhes de login com o botão Criar do modelo"],
    ],
    tip: "Nos apps mais recentes, o aviso cinza indica que o fluxo disponível é o Login Unificado.",
  },
  {
    title: "Adicione a permissão das métricas",
    instruction:
      "No quadro da configuração, clique em Prévia e depois em Editar. Em Editar permissões, marque instagram_manage_insights e salve.",
    controls: ["Prévia", "Editar", "Editar permissões", "Salvar"],
    expected:
      "A janela “Editar permissões”, com a lista da configuração. As permissões obrigatórias continuam marcadas.",
    images: [
      ["14-editar-permissoes", "Janela Editar permissões com instagram_manage_insights marcada"],
    ],
    tip: "A permissão dá acesso às métricas que a Meta disponibiliza para as contas autorizadas.",
    commonIssue:
      "Se o perfil já estiver conectado sem métricas, conclua a atualização da configuração e autorize a leitura novamente pela área de resultados.",
  },
  {
    title: "Cadastre a URL de redirecionamento",
    instruction:
      "Volte em API setup with Unified login. Em 1. Configure seu app, cole a URL abaixo em Registrar um novo URL de redirecionamento e clique em Salvar. Depois, escolha-a no campo de cima.",
    controls: [
      "API setup with Unified login",
      "Registrar um novo URL de redirecionamento",
      "Salvar",
      "Selecione o URL registrado",
    ],
    expected: "A URL selecionada no campo de cima e, logo abaixo, a URL de login gerada pela Meta.",
    images: [
      [
        "15-url-de-redirecionamento",
        "Configuração do app com a URL de redirecionamento selecionada",
      ],
    ],
    tip: "A imagem mostra o endereço do ambiente anterior. Use a URL do MouseHot que aparece acima.",
    commonIssue:
      "Se a Meta informar que o redirecionamento é inválido, confira o domínio e o caminho completos. Copie novamente pelo botão deste passo.",
  },
  {
    title: "Copie as três credenciais do seu app",
    instruction:
      "Copie a Identificação da configuração no quadro do login unificado. Em Configurações do app → Básico, copie o ID do Aplicativo e a Chave Secreta do Aplicativo. Cole os três abaixo.",
    controls: [
      "Identificação da configuração",
      "Configurações do app",
      "Básico",
      "ID do Aplicativo",
      "Chave Secreta do Aplicativo",
      "Mostrar",
    ],
    expected:
      "Em Básico, o ID do Aplicativo à esquerda e a Chave Secreta do Aplicativo à direita, escondida até você clicar em Mostrar.",
    images: [
      [
        "16-identificacao-da-configuracao",
        "Quadro do Login Unificado com a identificação da configuração",
      ],
      [
        "17-id-e-chave-do-aplicativo",
        "Configurações básicas com o ID e a chave oculta do aplicativo",
      ],
    ],
    tip: "A chave é gravada cifrada no servidor. O MouseHot nunca volta a exibir o valor.",
    commonIssue:
      "Use o ID e a chave do mesmo aplicativo. A identificação da configuração vem do quadro do Login Unificado.",
  },
  {
    title: "Prepare a conta profissional do Instagram",
    instruction:
      "Se o aplicativo estiver em desenvolvimento, abra Funções do app, entre na aba Testadores e clique em Adicionar pessoas. Marque Testador do Instagram, digite o @ da conta e adicione.",
    controls: [
      "Funções do app",
      "Funções",
      "Testadores",
      "Adicionar pessoas",
      "Testador do Instagram",
      "Adicionar",
    ],
    expected:
      "A janela “Adicionar pessoas ao seu aplicativo”, com Testador do Instagram em Funções adicionais.",
    images: [
      ["10-funcoes-testadores", "Funções do app com a aba Testadores e o botão Adicionar pessoas"],
      ["11-testador-do-instagram", "Janela Adicionar pessoas com a opção Testador do Instagram"],
    ],
    tip: "A conta precisa ser profissional. Aceite o convite no Instagram em Configurações → Sites e apps → Convites de testador. Depois, autorize a conexão na tela oficial da Meta.",
    commonIssue:
      "Confira se está no perfil correto, se ele é profissional e se aceitou o convite quando o app está em desenvolvimento. Para perfis externos, siga as exigências de publicação e acesso da Meta.",
  },
];
