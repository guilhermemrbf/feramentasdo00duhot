import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/privacidade")({
  head: () => ({
    meta: [
      { title: "Política de privacidade — MauseHot" },
      {
        name: "description",
        content:
          "Como o MauseHot trata os dados do Automatic Post e da integração com o Instagram.",
      },
    ],
    links: [{ rel: "canonical", href: "https://mausehot.lovable.app/privacidade" }],
  }),
  component: Privacy,
});

function Privacy() {
  return (
    <main className="mx-auto min-h-screen max-w-3xl px-5 py-10 text-sm leading-7 text-foreground sm:px-8">
      <a href="/" className="inline-flex items-center gap-3 font-semibold">
        <img src="/brand/mark.png" alt="" width={40} height={40} className="rounded-lg" />
        MauseHot
      </a>
      <h1 className="mt-8 text-3xl font-bold tracking-tight">Política de privacidade</h1>
      <p className="mt-2 text-muted-foreground">Atualizada em 16 de novembro de 2026.</p>
      <p className="mt-6">
        Este aviso descreve o tratamento de dados no Automatic Post, no acesso ao seu espaço de
        trabalho e na conexão de contas do Instagram ao MauseHot. O responsável por essa operação é
        Guilherme Machado Rocha, pessoa física, no Brasil. O nome comercial MauseHot não representa
        uma declaração de constituição de pessoa jurídica.
      </p>
      <p className="mt-3">
        Contato para privacidade e atendimento de direitos:{" "}
        <a
          className="break-all font-medium underline underline-offset-4"
          href="mailto:guilhermemachado.face@gmail.com"
        >
          guilhermemachado.face@gmail.com
        </a>
        .
      </p>

      <section className="mt-8 space-y-3" aria-labelledby="privacy-data">
        <h2 id="privacy-data" className="text-xl font-semibold">
          Quais dados são tratados
        </h2>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            Dados de identificação da sessão Google, como identificador, nome e e-mail
            disponibilizados no login, e vínculo com o espaço de trabalho.
          </li>
          <li>
            Identificador, nome de usuário, tipo e situação das contas do Instagram que você
            autoriza, permissões concedidas e datas da conexão.
          </li>
          <li>Tokens de autorização necessários para executar as ações autorizadas na Meta.</li>
          <li>
            Vídeos, imagens, capas, legendas, hashtags, horários e configurações que você envia ou
            escolhe para programar publicações.
          </li>
          <li>
            Histórico de processamento, resultados, identificadores das publicações e métricas
            quando a Meta as disponibiliza com as permissões concedidas.
          </li>
          <li>
            Informações técnicas necessárias à operação e ao diagnóstico de falhas, como data,
            status e categoria de erro.
          </li>
        </ul>
        <p>
          Você informa senhas e códigos de autenticação nas páginas oficiais do Google e da Meta.
          Não solicitamos esses dados nos formulários do MauseHot.
        </p>
      </section>

      <section className="mt-8 space-y-3" aria-labelledby="privacy-purpose">
        <h2 id="privacy-purpose" className="text-xl font-semibold">
          Para que usamos os dados
        </h2>
        <p>
          Usamos esses dados para autenticar o acesso, separar os espaços e as bibliotecas de cada
          conta, executar publicações que você configurou e ativou, mostrar seus resultados e
          atender solicitações de suporte e de privacidade. A conexão não permite consultar dados
          privados de contas que não autorizaram o acesso.
        </p>
        <p>
          O tratamento se relaciona à prestação do serviço solicitado, à autorização das integrações
          e às obrigações aplicáveis à operação. A autorização exibida pela Meta define quais ações
          o aplicativo pode executar na conta; ela pode ser retirada nas configurações da Meta. Não
          vendemos os dados recebidos pela integração.
        </p>
      </section>

      <section className="mt-8 space-y-3" aria-labelledby="privacy-providers">
        <h2 id="privacy-providers" className="text-xl font-semibold">
          Serviços envolvidos
        </h2>
        <p>
          Google participa da autenticação. Meta e Instagram recebem as ações de conexão e
          publicação. Lovable Cloud e a infraestrutura Supabase utilizada pela aplicação fornecem
          hospedagem, autenticação, banco de dados e armazenamento. Esses serviços tratam os dados
          necessários ao funcionamento da integração, de acordo com seus papéis e termos aplicáveis.
        </p>
        <p>
          O processamento pode envolver infraestrutura fora do Brasil. Entre em contato para obter
          informações sobre a configuração aplicável à sua solicitação. Uma ordem legal válida
          também pode exigir tratamento ou disponibilização de dados, nos limites aplicáveis.
        </p>
      </section>

      <section className="mt-8 space-y-3" aria-labelledby="privacy-security">
        <h2 id="privacy-security" className="text-xl font-semibold">
          Proteção e armazenamento
        </h2>
        <p>
          Os tokens do Instagram são cifrados no backend e não são disponibilizados pela biblioteca
          pública da aplicação. O acesso aos registros é controlado pelo usuário e pelo espaço de
          trabalho. As mídias ficam em armazenamento privado e podem ser disponibilizadas
          temporariamente à Meta para processar a publicação solicitada.
        </p>
        <p>
          Bibliotecas, configurações e históricos permanecem armazenados para uso da ferramenta.
          Atualmente não existe um prazo único de exclusão automática para esses registros. A
          exclusão é tratada mediante solicitação; eventuais exceções de conservação devem ser
          informadas ao solicitante. Cópias de segurança e registros necessários à segurança ou ao
          cumprimento de obrigações podem ter ciclos de retenção distintos.
        </p>
      </section>

      <section className="mt-8 space-y-3" aria-labelledby="privacy-browser">
        <h2 id="privacy-browser" className="text-xl font-semibold">
          Cookies e dados no navegador
        </h2>
        <p>
          Usamos cookies e armazenamento do navegador para manter a sessão, validar o retorno da
          autorização e lembrar preferências do espaço de trabalho. Apagar esses dados pode encerrar
          sua sessão, mas não exclui automaticamente bibliotecas ou registros mantidos no servidor.
        </p>
      </section>

      <section className="mt-8 space-y-3" aria-labelledby="privacy-rights">
        <h2 id="privacy-rights" className="text-xl font-semibold">
          Seus direitos e como solicitar exclusão
        </h2>
        <p>
          Você pode solicitar informações sobre o tratamento, acesso, correção e exclusão de dados,
          além de retirar a autorização da integração. O atendimento é manual pelo contato acima.
          Podemos precisar confirmar sua titularidade antes de alterar ou fornecer informações da
          conta. Não envie senhas, tokens, códigos de verificação ou documentos na solicitação
          inicial.
        </p>
        <a
          className="inline-block font-medium underline underline-offset-4"
          href="/exclusao-de-dados"
        >
          Ver instruções para excluir os dados e revogar o acesso
        </a>
        <p>
          Excluir dados do MauseHot não apaga automaticamente publicações já enviadas ao Instagram.
          Esses conteúdos e os dados mantidos pela Meta seguem os controles e políticas daquele
          serviço.
        </p>
      </section>

      <p className="mt-8 border-t border-border pt-5 text-muted-foreground">
        Alterações neste aviso serão publicadas nesta página com a data de atualização.
      </p>
    </main>
  );
}
