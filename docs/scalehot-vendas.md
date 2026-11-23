# ScaleHot · Vendas na MouseHot

O **Dashboard** da MouseHot (`/painel`) apresenta faturamento líquido, lucro, total de taxas, vendas reembolsadas, gráfico diário, últimas transações, meta mensal e filtros de período para contas aprovadas. A ferramenta **ScaleHot · Vendas** (`/vendas`) também continua disponível. **Gateways** (`/vendas/integracoes`) e **Notificações** (`/vendas/notificacoes`) ficam na barra lateral da MouseHot.

## Ativação

1. Aplique `20261122213000_scalehot_sales.sql` no Supabase da MouseHot antes de publicar o módulo. Preserve o banco do ScaleHot até validar as novas conexões.
2. Use o domínio oficial em `APP_BASE_URL`. O endereço gerado usa essa origem.
3. Para o push, gere um par estável com `npx web-push generate-vapid-keys`. Configure `SALES_PUSH_PUBLIC_KEY`, `SALES_PUSH_PRIVATE_KEY` e `SALES_PUSH_SUBJECT` na Vercel. O assunto é um contato válido em `mailto:` ou uma URL HTTPS do operador. Guarde o par fora do repositório. Trocar a chave exige nova inscrição dos dispositivos.
4. Configure `SALES_PUSH_WORKER_SECRET` e um agendamento de servidor de um minuto que envie POST para `/api/vendas/processar` com `Authorization: Bearer ...`. Guarde o segredo no cofre do agendador. A primeira tentativa ocorre ao registrar a venda. O agendamento processa as entregas que ficaram pendentes, inclusive quando o gateway não enviar outro evento.
5. Em **Gateways**, na barra lateral da MouseHot, escolha OmegaPay, Syncpay ou Wiinpay e crie uma conexão. Copie o endereço privado exibido e cadastre-o no painel do gateway. Se perder o endereço, crie a substituição, verifique o primeiro evento e desative a anterior.
6. No iPhone, adicione a MouseHot à Tela de Início pelo Safari. Abra o ícone, entre com sua conta, acesse **Notificações** e toque em **Ativar neste dispositivo**. Envie uma notificação de teste. Uma resposta positiva do serviço de push indica que ele aceitou o envio. Confira visualmente a entrega no aparelho.

## Webhooks

OmegaPay, Syncpay e Wiinpay estão disponíveis para novas conexões. Os adaptadores anteriores permanecem no receptor para preservar a leitura de registros legados. Antes de trocar uma conexão de produção, envie um evento de teste pelo painel do próprio gateway. O painel consolida somente BRL.

Eventos duplicados devolvem HTTP 200 e não somam outra venda. Eventos aprovados ou estornados válidos retornam HTTP 201 na primeira gravação. Eventos intermediários são ignorados. O receptor mantém os valores normalizados, a referência e o horário, sem armazenar nome, e-mail ou o corpo completo do gateway. O alerta da tela bloqueada não inclui valor nem dados do comprador. Gastos com anúncios, lucro, ROI e impostos dependem de dados externos que ainda não fazem parte da integração.

Os endereços antigos do ScaleHot usam outra origem. Cadastre os endereços novos no painel de cada provedor. O histórico anterior permanece no ScaleHot e a MouseHot exibe os eventos que receber após a conexão. Valide as integrações uma de cada vez, compare uma nova transação no painel e confirme a notificação no aparelho antes de retirar o webhook antigo.

## Verificação

- `npm test` verifica os oito formatos, as transições que contam para venda, os valores em centavos e os destinos aceitos para Web Push.
- `node tests/sales-postgres.mjs` usa PGlite. Aponte `INTELLIGENCE_PG_TEST_DEPS` para a instalação auxiliar, como nos demais testes de PostgreSQL do projeto. Cobre gravação, duplicidade, isolamento, revogação e a fila de alertas.

## Rastreamento de vendas

O caminho no painel é **ScaleHot → Rastreamento de vendas**. Aplique `20261123120000_scalehot_attribution.sql` após a migration de vendas e `20261123122000_scalehot_tracking_report.sql` para o dashboard. Em **Desempenho**, consulte receita, cobertura de atribuição e a evolução diária dos últimos 7, 14 ou 30 dias no fuso de São Paulo. A tabela mostra até 50 campanhas ou anúncios por receita bruta atribuída. Em **Integrações**, vincule a loja e a conta Meta. O gateway continua sendo a fonte financeira.

1. Cadastre o domínio HTTPS da loja e selecione a conexão ativa de OmegaPay, Syncpay ou Wiinpay que receberá o pedido. Guarde a URL e a chave geradas no servidor da loja.
2. Quando um visitante chegar por uma campanha e tiver dado consentimento para a coleta, envie o evento de clique abaixo. Envie apenas os parâmetros de campanha necessários, omitindo dados do comprador. Guarde o `clickToken` retornado na sessão do checkout controlada pela loja.
3. Depois de criar o pedido pelo checkout, envie seu identificador exato no evento de vínculo. O identificador precisa coincidir com o ID que o adaptador do gateway extrai do webhook aprovado. Valide esse contrato com um pedido de teste do provedor escolhido. Uma venda recebida antes do vínculo passa a aparecer na campanha depois que o vínculo for confirmado.

Nas duas chamadas, use POST da sua aplicação para a URL gerada, com `Authorization: Bearer <chave-da-loja>` e `Content-Type: application/json`. A chave deve ficar no servidor do checkout.

```json
{
  "action": "click",
  "advertisingConsent": true,
  "landingUrl": "https://loja.example/?utm_source=meta&utm_medium=paid_social&utm_campaign=lancamento&mh_campaign_id=123&mh_ad_id=456"
}
```

```json
{
  "action": "bind",
  "clickToken": "<token da resposta do clique>",
  "externalId": "<ID exato do pedido reconhecido pelo webhook>"
}
```

Um vínculo confirmado pode ser reenviado com o mesmo token. A troca do token depois do vínculo retorna conflito. A atribuição considera cliques nas 168 horas anteriores à aprovação. A chave da loja pode ser revogada pelo painel. Registros financeiros e associações históricas permanecem disponíveis após a revogação. Configure um novo domínio ou uma nova chave antes de alterar a integração do checkout.

A captura inicial usa integração servidor a servidor com uma loja sob seu controle e funciona com UTMs, ID da campanha e ID do anúncio. O piloto de checkout hospedado depende de confirmar que o provedor permite associar o ID do pedido.

### Meta Ads

1. Aplique também `20261123121000_scalehot_meta_ads.sql`. Na Meta, habilite a Marketing API e autorize a leitura `ads_read` para a conta piloto. Cadastre o callback exato `https://<seu-domínio>/api/vendas/ads/meta/callback` na configuração do login de anúncios. [Autorização da Marketing API](https://developers.facebook.com/documentation/ads-commerce/marketing-api/get-started/authorization)
2. Configure `SCALEHOT_META_ADS_ENCRYPTION_KEY` com 32 bytes aleatórios em Base64 e guarde o valor no cofre da hospedagem. O conector usa `META_APP_ID`, `META_APP_SECRET` e `META_GRAPH_API_VERSION` por padrão. Para um app separado, preencha o par `SCALEHOT_META_ADS_APP_ID` e `SCALEHOT_META_ADS_APP_SECRET`. Habilite `SCALEHOT_META_ADS_ENABLED=1` só depois de validar a configuração.
3. Em **Integrações → Anúncios → Meta Ads**, conecte, autorize e escolha uma conta de anúncios. Compare gasto, cliques e impressões com o Ads Manager nos mesmos dias completos, moeda e fuso. Desconectar apaga a credencial da MouseHot. A revogação abrangente do app fica nas configurações da Meta, pois ela também pode afetar o Automatic Post quando as duas funções usam o mesmo app.

### Google Ads e Webhooks

Aplique `20261124123000_scalehot_google_integrations.sql`. Para **Integrações → Anúncios → Google Ads**, habilite a Google Ads API, cadastre `https://<seu-domínio>/api/vendas/ads/google/callback` no cliente OAuth Web e configure os valores `SCALEHOT_GOOGLE_ADS_*` de `.env.example`. Use um token de desenvolvedor liberado para o ambiente da conta e uma versão ativa da API. O login Google da MouseHot usa outra configuração e não autoriza o acesso a contas de anúncios. [Autorização do Google Ads](https://developers.google.com/google-ads/api/rest/auth)

Em **Integrações → Webhooks → Adicionar credencial**, informe um nome e copie a URL e o token. Para provedores que aceitam um token separado, envie `x-api-token: <token>` ou `Authorization: Bearer <token>`. Para provedores que aceitam somente uma URL, copie a URL com token. O token fica disponível somente na criação. É possível revogar a credencial personalizada pela lista de Webhooks. Os conectores nativos de OmegaPay, Syncpay e Wiinpay continuam em **Gateways**.

O webhook personalizado aceita POST em JSON no formato `{"transaction_id":"loja-pedido-123","status":"approved","currency":"BRL","amount_cents":400,"net_cents":350}`. Use `refunded`, `chargeback` ou `med` nas atualizações, com o mesmo ID do pedido. O líquido é opcional e o horário pode ser informado em `occurred_at` com fuso. Também é aceito o formato de checkout com `orderId`, `status` e `commission` (valores em BRL); `isTest: true` não entra nos totais. Use identificadores únicos entre as integrações personalizadas da mesma conta. Para JSON fora desses formatos, transforme os eventos do gateway antes de enviar. Use apenas uma integração para o mesmo pedido.

Em **Integrações → Pixels**, escolha **Adicionar pixel → Google Ads** e cadastre o ID e o rótulo de uma ação de conversão do seu Google Ads. Use os valores no checkout e dispare a conversão após o pagamento confirmado, com valor, moeda e identificador único do pedido. Confirme o recebimento no Google Ads ou no Tag Assistant. [Instalar e verificar a tag do Google Ads](https://support.google.com/google-ads/answer/6331314)

A versão inicial consulta o gasto agregado sob demanda. Para ligar o gasto a campanhas e anúncios, persistir o histórico, calcular CPA/ROAS, enviar eventos de conversão e ampliar para Google/TikTok, seguir o [plano do ScaleHot](./superpowers/plans/2026-11-23-scalehot-atribuicao.md).

### Testes locais do rastreamento

- `npm test` cobre a validação do clique e a leitura de anúncios com respostas Meta controladas.
- `node tests/scalehot-attribution-postgres.mjs` verifica isolamento, atribuição, webhook já recebido, estorno, revogação e consumo único do state OAuth com PGlite.
- `node tests/scalehot-tracking-browser.mjs` usa Chrome e uma API local de teste. O guia de validação real exige separadamente um gateway, checkout e uma conta Meta reais.


## Pixel da Meta e vendas atribuídas

Em **Integrações → Pixels → Adicionar pixel → Meta Ads**, cadastre o ID do dataset, o token da API de Conversões e a origem HTTPS do checkout. O piloto usa o webhook assinado de transações Syncpay. Configure o produto para enviar ao endereço do Pixel e cadastre no formulário o segredo fornecido pela Syncpay. Use um único webhook financeiro por produto. OmegaPay e Wiinpay continuam no financeiro.

No servidor da loja, envie POST ao endpoint de checkout exibido, com a chave descartável de exibição em `Authorization: Bearer <chave>`. Ao obter consentimento, envie `{action:"click", advertisingConsent:true, landingUrl}` com a URL de chegada. Guarde o clickToken na sessão. Ao criar o pedido envie `{action:"bind", clickToken, referenceId, checkoutUrl}`, usando o reference_id da Syncpay. Sem fbclid a compra não é enviada por este conector à Meta. O relatório do Pixel mostra separadamente os eventos de teste.

Aplique as migrations 20261123140000 e 20261123141000 depois das migrations de vendas. A segunda cria as chaves no Supabase Vault e agenda o envio a cada minuto quando houver compras pendentes. O worker usa META_GRAPH_API_VERSION da Vercel. Se houver chaves manuais preexistentes na Vercel, preserve a chave de criptografia usada pelos Pixels e mantenha o segredo do worker sincronizado com o Vault. Confira uma compra piloto em Testar eventos antes de remover o código de teste.
