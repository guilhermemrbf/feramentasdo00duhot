# ScaleHot · Reconstrução da área de operação

## Referência observada

O Resumo da Metricfy tem faixa de filtros, título e ações, grade de cinco indicadores no desktop e gráficos abaixo. O menu observado abre Meta, Pixels, Eventos, Produtos, Taxas, Despesas e Integrações. A conexão de anúncios, Webhooks e Pixel já têm componentes no MouseHot. UTMs reúne instruções e atribuição recente.

## Execução

- Manter o menu principal do MouseHot e colocar as áreas da operação no menu interno do ScaleHot. Usar o painel escuro e a densidade da referência, com vermelho e laranja da marca.
- Compor o Resumo a partir de vendas registradas, atribuição e relatórios das contas autorizadas. Comparar somente períodos compatíveis. Identificar dados indisponíveis com “—”.
- Reaproveitar conexão de anúncios, pixels, gateways e histórico. Mostrar os eventos que a MouseHot realmente recebe e orientar a configuração de UTMs de acordo com o contrato atual do rastreamento.
- Persistir despesas e regras financeiras por conta. Proteger a leitura e alterações com RLS. Calcular lucro com repasse conhecido, estornos, despesas, taxas e gasto confirmado.
- Validar navegação e visual na Scaleup, executar testes e build. Entregar localmente junto da migração.

## Limites da versão

O repositório da referência e seu banco de dados não estão disponíveis. O ScaleHot continua consultando os dados da MouseHot. O catálogo de planos, a conta e as notificações de venda usam a estrutura da MouseHot. Ficam fora desta entrega múltiplos dashboards, regras de recorrência, CRM de leads, métricas de navegação e as subabas de páginas e conjuntos de anúncios.

## Dados e implantação

A migração `20261124223000_scalehot_operation.sql` adiciona os lançamentos por conta, o relatório e a associação opcional de `product_name` em vendas futuras de webhooks personalizados. As vendas anteriores continuam registradas e aparecem como “Sem produto informado” quando o gateway não enviou um nome. O relatório mantém a janela de atribuição da aprovação nos estornos.

O filtro de conta usa as contas Meta e Google autorizadas e limita as métricas de anúncio. Vendas e estornos vêm dos gateways. O filtro Campanha usa vendas atribuídas. ROAS e CPA usam vendas atribuídas à mídia paga e dados de anúncio em BRL. Custos são lançamentos em reais por data. Métricas sem fonte aparecem com “—”.

O painel foi aberto na prévia autenticada da Scaleup. Os filtros, o menu, a personalização e a ordenação com as setas foram verificados. O banco de produção continua na versão anterior. Na prévia, o painel mostra as vendas disponíveis e informa quando a consulta avançada ou os lançamentos ainda não estão disponíveis.
