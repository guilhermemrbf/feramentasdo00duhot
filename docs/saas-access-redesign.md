# MouseHot como SaaS

## Fluxo

- A entrada pública está em `/`. O formulário fica no topo, antes do catálogo. Google, senha e link por e-mail usam a implementação de Auth do Supabase.
- Um cadastro confirmado começa pendente. O painel consulta o status periodicamente. A aprovação ou recusa fica registrada no Supabase.
- Na conta administradora, **Visão geral → Gerar link de 15 minutos** abre diretamente o formulário em `/aprovacoes#convites`. **Aprovações e convites** também está no menu lateral. O primeiro vínculo usa o ID imutável da conta verificada Scale Up já cadastrada no Auth.
- Um convite fica vinculado ao e-mail, pode ser resgatado uma vez em até sete dias e libera 15 minutos a partir do botão **Iniciar meus 15 minutos**. A expiração usa o relógio do banco. A plataforma armazena o hash do token. O link é exibido uma vez para cópia.
- O teste inclui Limpar Metadados, Otimizar Criativos e Gerar Preview. Postagens, conexões externas, Storage privado e dados operacionais exigem acesso aprovado.
- A migração restringe o Data API do Supabase, a leitura direta das tabelas protegidas, o Storage PostKit e as funções de servidor que atuam em nome de usuários. O worker existente conserva o acesso de serviço.

## Homologação isolada

1. Use um projeto Supabase separado do projeto de produção e um host de homologação protegido. A branch `feat/saas-access-redesign` parte de `85cb501`. Configure as variáveis do projeto de homologação conforme `docs/supabase-vercel-migration.md`.
2. Configure o provedor Google e as URLs de redirecionamento do host para `/` e `/convite`. Habilite confirmação de e-mail e configure o serviço de envio do Supabase para validar cadastro por senha e link de login.
3. Aplique as migrações em ordem, incluindo `20261121200000_platform_access.sql`. Caso a conta Scale Up ainda não exista na base de homologação, peça ao proprietário que entre com o Google na página inicial. Após confirmar que apareceu o cadastro verificado correto, o operador vincula manualmente o ID no SQL Editor do projeto de homologação.

```sql
insert into private.platform_administrators(user_id)
select id
from auth.users
where lower(email) = 'scaleupperformance@gmail.com'
  and email_confirmed_at is not null
  and deleted_at is null
on conflict do nothing;
```

4. Peça ao proprietário que atualize o painel. A conta deve mostrar **Aprovações e convites**. Valide com um segundo e-mail que o cadastro aguarda aprovação, o link só funciona para o destinatário e a expiração fecha a ferramenta. Valide um cadastro aprovado com Supabase Auth real.
5. Para a publicação, combine a ativação da migração com a atualização da aplicação. A migração restringe acesso de contas ainda pendentes assim que é ativada. Confira o vínculo da administração e revise os cadastros existentes antes da janela de mudança. O deploy em produção do Automatic Post e da biblioteca do Drive segue na versão anterior até a homologação.

## Verificação reproduzível

- `npm test` e `node node_modules/typescript/bin/tsc --noEmit`.
- `node tests/fresh-supabase-migrations-postgres.mjs`, com PGlite e as extensões configuradas no ambiente de teste.
- `node --experimental-strip-types tests/instagram-guided-browser.mjs`, com Chromium e playwright-core. Usa serviços de teste para o login e as integrações.
- `npm run build` com `NITRO_PRESET=vercel`, seguido de `node --experimental-strip-types tests/vercel-build-smoke.mjs`. Use variáveis de um ambiente de teste.

## Resultado da revisão visual inicial

O Design Taste Frontend encerrou em `GATE: OPEN 7` após três rodadas. As sete observações são a ausência de uma imagem adicional na área de cadastro, a altura do recorte na primeira dobra, a pilha da transição do catálogo, duas linhas internas do recorte e as bordas dos dois grupos do rodapé. Cinco exceções foram registradas no relatório local para manter o rodapé compacto, a transição do próprio kit e o recorte centralizado com seu alinhamento interno. As capturas de 1440 px e 390 px foram revisadas. A publicação exige a homologação real descrita acima.

## Revisão da entrada e do acesso rápido

A abertura ganhou fundo escuro, contraste com o formulário claro e animação de entrada com respeito à preferência por movimento reduzido. O teste de navegador verificou o login na primeira dobra a 390×844 e 1440×900, a troca de modo de acesso, o atalho da conta administradora, o foco direto no gerador e a criação do convite. O fluxo de homologação real permanece na seção acima.

## Página de venda

A entrada em `/` usa grafite e vinho até o rodapé. `LaunchPage` mantém o formulário no topo e leva os pedidos de acesso ao modo de cadastro. `LaunchWorkflow` apresenta três etapas da operação, com navegação por botões e uma transição que respeita a preferência por movimento reduzido. O teste de navegador verifica a troca de etapas e o acesso ao cadastro pela chamada no fim da página.

Para retomar a validação da entrega, confira o deploy da branch `feat/saas-access-redesign` na Vercel e siga a homologação acima com o Supabase de teste antes de promover a nova página para o domínio principal.
