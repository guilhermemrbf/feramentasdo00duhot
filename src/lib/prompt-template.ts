export interface PageData {
  fotoPerfilUrl: string;
  fotoCapaUrl: string;
  nomePerfil: string;
  arrobaPerfil: string;
  descricaoPerfil: string;
}

const TEMPLATE = `PROMPT — CLONAR E PERSONALIZAR MINHA PÁGINA

Quero que você utilize como base o meu próprio projeto/repositório:

https://github.com/guilhermemrbf/privacyjane-2db435e0

Esse projeto é de minha autoria e deve ser utilizado como base direta para a criação da página.

NÃO quero uma página inspirada nesse projeto.

NÃO quero uma página parecida.

NÃO quero que você recrie o projeto do zero.

Quero que você faça um clone funcional da estrutura existente e faça somente as alterações especificadas neste prompt.

Preserve ao máximo:

* estrutura;
* layout;
* componentes;
* estilos;
* espaçamentos;
* responsividade;
* navegação;
* rotas;
* animações;
* comportamentos;
* estrutura visual;
* funcionamento existente;
* experiência do usuário.

Não faça redesign.

Não altere elementos que não foram solicitados.

Não remova funcionalidades existentes sem necessidade.

---

## DADOS PARA PERSONALIZAÇÃO

Foto de perfil:

{{FOTO_PERFIL_URL}}

Foto de capa:

{{FOTO_CAPA_URL}}

Nome do perfil:

{{NOME_PERFIL}}

@ do perfil:

{{ARROBA_PERFIL}}

Nova descrição:

{{DESCRICAO_PERFIL}}

---

## ALTERAÇÕES OBRIGATÓRIAS

### FOTO DE PERFIL

Substitua a foto de perfil existente pela seguinte imagem:

{{FOTO_PERFIL_URL}}

Utilize exatamente essa URL.

---

### FOTO DE CAPA

Substitua a foto de capa existente pela seguinte imagem:

{{FOTO_CAPA_URL}}

Utilize exatamente essa URL.

---

### NOME DO PERFIL

Substitua o nome atual pelo seguinte:

{{NOME_PERFIL}}

Faça a substituição em todos os locais relevantes onde o nome do perfil original estiver sendo utilizado.

---

### @ DO PERFIL

Substitua o @ atual por:

{{ARROBA_PERFIL}}

Preserve exatamente o valor informado.

---

### DESCRIÇÃO

Remova a descrição original existente.

Utilize exclusivamente a seguinte descrição:

{{DESCRICAO_PERFIL}}

IMPORTANTE:

A descrição acima deve ser utilizada exatamente como fornecida.

Não reescreva.

Não resuma.

Não modifique.

Não acrescente informações.

---

# 5. INTEGRAÇÃO COM SYNC PAY

A página deverá utilizar a API da Sync Pay para realizar os pagamentos via Pix.

Utilize exclusivamente a documentação oficial fornecida abaixo para implementar a integração.

## AUTENTICAÇÃO

https://syncpay.apidog.io/gera-o-token-de-utiliza%C3%A7%C3%A3o-da-aplica%C3%A7%C3%A3o-18075876e0.md

## CONSULTA DE SALDO

https://syncpay.apidog.io/retorna-o-saldo-do-usu%C3%A1rio-18308815e0.md

## CONSULTA DE STATUS DA TRANSAÇÃO

https://syncpay.apidog.io/consulta-status-da-transa%C3%A7%C3%A3o-18075877e0.md

## PIX CASH-IN

https://syncpay.apidog.io/solicita%C3%A7%C3%A3o-de-dep%C3%B3sito-via-pix-18075879e0.md

## PIX CASH-OUT

https://syncpay.apidog.io/solicita%C3%A7%C3%A3o-de-saque-pix-18075881e0.md

## WEBHOOK CASH-IN ONCREATE

https://syncpay.apidog.io/oncreate-19542402e0.md

## WEBHOOK CASH-IN ONUPDATE

https://syncpay.apidog.io/onupdate-19542520e0.md

## LISTA DE WEBHOOKS

https://syncpay.apidog.io/listall-19542558e0.md

## CRIAÇÃO DE WEBHOOK

https://syncpay.apidog.io/create-19542617e0.md

## ATUALIZAÇÃO DE WEBHOOK

https://syncpay.apidog.io/update-19542619e0.md

## EXCLUSÃO DE WEBHOOK

https://syncpay.apidog.io/delete-19542627e0.md

## SCHEMA CASH-IN ONCREATE

https://syncpay.apidog.io/oncreate-8297203d0.md

## SCHEMA CASH-IN ONUPDATE

https://syncpay.apidog.io/onupdate-8297540e0.md

## SCHEMA CASH-OUT ONCREATE

https://syncpay.apidog.io/oncreate-8297546d0.md

## SCHEMA CASH-OUT ONUPDATE

https://syncpay.apidog.io/onupdate-8297547d0.md

---

# 6. CREDENCIAIS DA SYNC PAY

A integração utiliza:

* Client ID
* Client Secret

NÃO solicitar que o usuário envie o Client Secret diretamente pelo chat.

NÃO colocar o Client Secret diretamente no código.

NÃO expor o Client Secret no frontend.

NÃO deixar credenciais privadas em arquivos públicos.

As credenciais deverão ser configuradas através do sistema seguro de Secrets / Environment Variables da Lovable.

Utilizar:

SYNC_PAY_CLIENT_ID

SYNC_PAY_CLIENT_SECRET

Quando chegar nessa etapa, informe claramente ao usuário que as credenciais da Sync Pay precisam ser configuradas no armazenamento seguro de Secrets/Environment Variables.

Depois que as credenciais estiverem configuradas, continuar a implementação.

O Client Secret deverá permanecer exclusivamente no ambiente server-side/backend/edge function.

---

# 7. FUNCIONAMENTO DO PAGAMENTO

Implementar o fluxo completo de pagamento utilizando a documentação oficial da Sync Pay.

A página deverá:

1. iniciar a solicitação de pagamento;
2. criar a cobrança Pix;
3. receber os dados da transação;
4. apresentar o QR Code;
5. apresentar o Pix Copia e Cola;
6. permitir que o usuário copie o código;
7. acompanhar o status da transação;
8. identificar quando o pagamento for aprovado;
9. atualizar a interface automaticamente;
10. liberar o próximo passo somente após confirmação válida do pagamento.

Utilizar os webhooks quando necessário.

Não considerar o pagamento aprovado simplesmente porque o usuário retornou para a página.

A confirmação deverá utilizar o mecanismo correto definido pela API da Sync Pay.

---

# 8. SEGURANÇA

A implementação deverá respeitar as seguintes regras:

* nunca expor Client Secret no frontend;
* nunca colocar credenciais diretamente no código;
* nunca colocar credenciais em arquivos públicos;
* utilizar Secrets/Environment Variables;
* manter operações sensíveis no backend/server-side;
* validar respostas da API;
* tratar erros;
* impedir duplicidade de cobrança quando aplicável;
* impedir que uma transação seja marcada como paga sem confirmação real;
* não inventar endpoints;
* não inventar parâmetros;
* não inventar respostas da API.

Se alguma informação não estiver clara na documentação, consultar a documentação antes de implementar.

---

# 9. REGRAS DE PERSONALIZAÇÃO

As informações fornecidas no início deste prompt são as únicas informações que deverão ser alteradas.

Não modificar o restante da página sem necessidade.

Não alterar:

* identidade visual original;
* estrutura;
* layout;
* componentes;
* animações;
* responsividade;
* textos não relacionados à personalização;
* funcionalidades existentes.

A regra principal é:

CLONAR PRIMEIRO. PERSONALIZAR DEPOIS.

---

# 10. VALIDAÇÃO FINAL

Antes de considerar o projeto concluído:

### VISUAL

Verificar:

* desktop;
* mobile;
* foto de perfil;
* foto de capa;
* nome;
* @;
* descrição;
* espaçamentos;
* responsividade;
* componentes;
* animações.

### PAGAMENTO

Verificar:

* autenticação;
* criação da cobrança;
* QR Code;
* Pix Copia e Cola;
* consulta de status;
* confirmação do pagamento;
* webhook;
* tratamento de erros.

### SEGURANÇA

Verificar:

* Client ID configurado;
* Client Secret configurado;
* nenhuma credencial exposta no frontend;
* nenhuma credencial hardcoded;
* comunicação correta entre frontend e backend.

Não considerar a implementação concluída enquanto a integração da Sync Pay não estiver configurada e testada corretamente.

---

# REGRA FINAL

Faça exatamente o que foi solicitado.

Não recrie o projeto.

Não faça uma versão "inspirada".

Não faça redesign.

Não simplifique funcionalidades existentes.

Não invente informações.

Utilize o repositório informado como base direta.

Preserve o projeto original e faça somente as personalizações especificadas.`;

export function buildPrompt(data: PageData): string {
  return TEMPLATE.replaceAll("{{FOTO_PERFIL_URL}}", data.fotoPerfilUrl)
    .replaceAll("{{FOTO_CAPA_URL}}", data.fotoCapaUrl)
    .replaceAll("{{NOME_PERFIL}}", data.nomePerfil)
    .replaceAll("{{ARROBA_PERFIL}}", data.arrobaPerfil)
    .replaceAll("{{DESCRICAO_PERFIL}}", data.descricaoPerfil);
}
