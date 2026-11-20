import { createFileRoute } from "@tanstack/react-router";
import { siteOrigin } from "@/lib/site-origin";

export const Route = createFileRoute("/exclusao-de-dados")({
  head: () => ({
    meta: [
      { title: "Exclusão de dados — MauseHot" },
      {
        name: "description",
        content: "Como solicitar a exclusão dos dados da integração Instagram no MauseHot.",
      },
    ],
    links: siteOrigin ? [{ rel: "canonical", href: siteOrigin + "/exclusao-de-dados" }] : [],
  }),
  component: DataDeletion,
});

function DataDeletion() {
  const email = "guilhermemachado.face@gmail.com";
  const requestLink = `mailto:${email}?subject=${encodeURIComponent("MauseHot — solicitação de exclusão de dados")}`;
  return (
    <main className="mx-auto min-h-screen max-w-3xl px-5 py-10 text-sm leading-7 text-foreground sm:px-8">
      <a href="/" className="inline-flex items-center gap-3 font-semibold">
        <img src="/brand/mark.png" alt="" width={40} height={40} className="rounded-lg" />
        MauseHot
      </a>
      <h1 className="mt-8 text-3xl font-bold tracking-tight">Exclusão de dados</h1>
      <p className="mt-2 text-muted-foreground">
        Integração Instagram · atualizada em 16 de novembro de 2026.
      </p>
      <p className="mt-6">
        O responsável pelo atendimento é Guilherme Machado Rocha, no Brasil. Você pode solicitar a
        exclusão dos dados da sua integração sem precisar entrar no MauseHot.
      </p>

      <section className="mt-8 space-y-3" aria-labelledby="deletion-request">
        <h2 id="deletion-request" className="text-xl font-semibold">
          1. Envie sua solicitação
        </h2>
        <p>
          Escreva para{" "}
          <a className="break-all font-medium underline underline-offset-4" href={requestLink}>
            {email}
          </a>{" "}
          com o assunto <strong>MauseHot — solicitação de exclusão de dados</strong>.
        </p>
        <ul className="list-disc space-y-2 pl-5">
          <li>Informe o e-mail usado para entrar no MauseHot e o @ do Instagram relacionado.</li>
          <li>Diga se deseja remover uma integração específica ou todos os dados do seu espaço.</li>
          <li>
            Não envie senha, token de acesso, código de verificação ou documento na mensagem
            inicial.
          </li>
        </ul>
        <p>
          O atendimento é manual. Enviar a mensagem não executa uma exclusão instantânea.
          Responderemos pelo mesmo canal para confirmar o recebimento, verificar a titularidade e
          informar a previsão de atendimento e eventuais pendências. A conclusão ou uma
          justificativa para eventual retenção também será comunicada por esse canal.
        </p>
      </section>

      <section className="mt-8 space-y-3" aria-labelledby="deletion-access">
        <h2 id="deletion-access" className="text-xl font-semibold">
          2. Retire a autorização na Meta
        </h2>
        <p>
          Para interromper o acesso pela integração, abra as configurações de apps e sites ou
          integrações empresariais da sua conta no Instagram/Meta, encontre
          <strong> 00duHot Publisher / 00duHot Publisher-IG</strong> e remova a autorização. Esses
          são os nomes do aplicativo Meta usado pelo MauseHot.
        </p>
        <p>
          Retirar a autorização não é a mesma coisa que excluir os dados armazenados no MauseHot.
          Envie também a solicitação do passo anterior. Uma publicação já entregue à Meta pode ter
          sido concluída antes da retirada de acesso.
        </p>
      </section>

      <section className="mt-8 space-y-3" aria-labelledby="deletion-scope">
        <h2 id="deletion-scope" className="text-xl font-semibold">
          3. O que será verificado no atendimento
        </h2>
        <p>
          Conforme o alcance da solicitação confirmada, o atendimento inclui a autorização
          armazenada, os dados da conta conectada, filas e configurações relacionadas, mídias da
          biblioteca e históricos/métricas vinculados. O responsável verificará os vínculos para
          preservar dados de outros usuários ou contas que não façam parte do pedido.
        </p>
        <p>
          Dados cuja conservação seja necessária por obrigação aplicável ou por segurança serão
          identificados na resposta, quando houver. A solicitação não exclui automaticamente
          publicações já feitas no Instagram, dados mantidos pela Meta ou arquivos no seu
          dispositivo. Esses itens precisam ser gerenciados nos respectivos serviços ou
          dispositivos.
        </p>
      </section>

      <footer className="mt-8 border-t border-border pt-5">
        <a className="font-medium underline underline-offset-4" href="/privacidade">
          Política de privacidade
        </a>
      </footer>
    </main>
  );
}
