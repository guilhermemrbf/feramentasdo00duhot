# Revisão visual da MouseHot

## Direção

- **Produto** — reúne publicação, preparação de mídias e acompanhamento de vendas para quem trabalha com tráfego orgânico e vários perfis.
- **Caráter** — direto, preciso e quente.
- **Ambiente** — uma bancada de operação escura, com instrumentos legíveis e o rato original como marca.
- **Destaques** — apresentação do dashboard com grade suave e a curva de faturamento com os valores reais da conta.
- **Assinatura** — vermelho e laranja nas ações principais, com dourado em pequenos pontos de orientação.

## Diagnóstico

- O ScaleHot reaplicava uma paleta roxa e duas fontes próprias.
- A navegação ativa usava uma borda rosa mais forte que os dados do painel.
- O cumprimento ocupava altura de vitrine em uma tela usada para consultar números.
- Rótulos, valores e ícones dos oito indicadores disputavam a mesma atenção.
- Ações, campos, painéis e catálogos usavam raios e espaçamentos diferentes.
- A entrada pública já define a paleta pedida e serve como origem dos tokens da marca.

## Execução

- [x] Reunir a paleta em src/styles.css e reaproveitar os valores em src/organic-landing.css. Conferir superfícies, contraste da paleta, fontes locais e foco.
- [x] Refinar a estrutura que AppShell já fornece. Preservar a ordem dos links, submenus, catálogo, busca e ações do administrador. Manter controles de toque e conferir navegação em desktop e celular.
- [x] Ajustar hierarquia e densidade do dashboard e dos cards de ferramentas em src/saas.css, src/routes/painel.tsx e src/components/DashboardMetrics.tsx. Manter dados, listas e estados vazios.
- [x] Aplicar os mesmos controles, superfícies e fontes ao Automatic Post, ScaleHot, Gateways, Notificações, Aprovações e ferramentas. Remover a redefinição visual roxa em SalesLayout e scalehot.css. Preservar cores de significado em resultados e status.
- [x] Verificar o build e o diff. Confirmar o dashboard final na sessão Scaleup.

## Validação na prévia

Foram abertas as rotas administrativas, as áreas do ScaleHot e as dez ferramentas adicionais do catálogo. Em largura de 390 px, o Dashboard e Aprovações e convites ficaram dentro da tela e o menu móvel manteve os destinos. O Automatic Post local abriu a tela de entrada, mas a consulta da configuração da operação falhou. O mesmo perfil abriu as seções do Automatic Post na versão publicada.

Na versão final, 191 testes passaram e o build de produção foi concluído. O dashboard da Scaleup foi conferido com os oito indicadores e o filtro de período. A prévia foi mantida no topo da página, com o período original restaurado.
