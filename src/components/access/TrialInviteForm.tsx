import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Clipboard, Link2 } from "lucide-react";
import { useRef, useState, type FormEvent } from "react";
import { usePlatformAccess } from "./PlatformAccessProvider";
import { platformRpc, rpcData } from "@/lib/platform-access-client";

export function TrialInviteForm() {
  const { user, status } = usePlatformAccess();
  const queryClient = useQueryClient();
  const linkField = useRef<HTMLInputElement>(null);
  const [link, setLink] = useState("");
  const [copied, setCopied] = useState(false);
  const invite = useMutation({
    mutationFn: async (email: string) => {
      const token = await rpcData(
        platformRpc.rpc("platform_admin_create_invite", { p_email: email }),
      );
      if (!token) throw new Error("Convite indisponível");
      const url = new URL("/convite", window.location.origin);
      url.hash = token;
      return url.href;
    },
    onSuccess: (url) => {
      setLink(url);
      setCopied(false);
      void queryClient.invalidateQueries({ queryKey: ["admin-approvals", user?.id] });
    },
  });

  if (status !== "admin") return null;

  function generate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (invite.isPending) return;
    invite.mutate(String(new FormData(event.currentTarget).get("email")).trim());
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
    } catch {
      linkField.current?.focus();
      linkField.current?.select();
    }
  }

  return (
    <form className="trial-invite-form access-fields" onSubmit={generate}>
      <div className="trial-invite-controls">
        <label>
          E-mail do convidado
          <input name="email" type="email" required maxLength={254} autoComplete="off" />
        </label>
        <button
          type="submit"
          className="trial-invite-submit tool-action"
          disabled={invite.isPending}
        >
          <Link2 size={17} aria-hidden />
          {invite.isPending ? "Gerando…" : "Gerar link de 15 minutos"}
        </button>
      </div>
      <p className="trial-invite-guidance">
        O link expira em 15 minutos. Ao iniciar, o convidado tem 15 minutos de teste.
      </p>
      {invite.isError && (
        <p role="alert">Não consegui gerar o convite. Confira o e-mail e tente novamente.</p>
      )}
      {link && (
        <div className="trial-invite-result">
          <p role="status">{copied ? "Link copiado." : "Convite pronto para enviar."}</p>
          <div className="trial-invite-controls">
            <label>
              Link do convite
              <input
                ref={linkField}
                value={link}
                readOnly
                onFocus={(event) => event.target.select()}
              />
            </label>
            <button
              className="saas-button saas-button-outline"
              type="button"
              onClick={() => void copyLink()}
            >
              <Clipboard size={16} aria-hidden /> Copiar link
            </button>
          </div>
        </div>
      )}
    </form>
  );
}
