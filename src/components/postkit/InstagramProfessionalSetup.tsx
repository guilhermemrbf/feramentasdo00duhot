import { useState } from "react";
import { ExternalLink, Instagram } from "lucide-react";

export function InstagramProfessionalSetup({
  disabled,
  onConnect,
}: {
  disabled: boolean;
  onConnect: () => void;
}) {
  const [opened, setOpened] = useState(false);

  return (
    <details className="mt-3 rounded-lg border border-border bg-background/30 p-3 text-sm">
      <summary className="min-h-7 cursor-pointer font-semibold text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        Minha conta ainda é pessoal
      </summary>
      <div className="mt-3 space-y-3" aria-label="Preparar conta profissional">
        <p className="text-muted-foreground">
          Para conectar uma conta pessoal, primeiro mude para um perfil de Criador de conteúdo ou
          Comercial no Instagram.
        </p>
        <ol className="list-decimal space-y-2 pl-5 text-muted-foreground">
          <li>Abra a configuração abaixo e entre no perfil que quer conectar.</li>
          <li>
            Escolha Criador de conteúdo ou Comercial, selecione uma categoria e conclua as
            confirmações do Instagram. Perfis profissionais são públicos; confira essa mudança antes
            de confirmar.
          </li>
          <li>Volte a esta aba e clique em Continuar com Instagram.</li>
        </ol>
        <a
          href="https://www.instagram.com/accounts/convert_to_professional_account/"
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => setOpened(true)}
          className="inline-flex min-h-11 items-center gap-2 rounded-md border border-sky-400/30 px-3 py-2 font-semibold text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ExternalLink aria-hidden="true" className="size-4" />
          Abrir configuração no Instagram
        </a>
        {opened && (
          <p role="status" className="text-xs text-muted-foreground">
            A configuração abre em outra aba. Se não abriu, permita a abertura no navegador e clique
            novamente.
          </p>
        )}
        <button
          type="button"
          disabled={disabled}
          onClick={onConnect}
          className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-md bg-primary px-3 py-2 font-semibold text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
        >
          <Instagram aria-hidden="true" className="size-4" />
          Continuar com Instagram
        </button>
      </div>
    </details>
  );
}
