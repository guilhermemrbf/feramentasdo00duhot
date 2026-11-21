import { ArrowRight, KeyRound, Mail } from "lucide-react";
import { useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { signInWithGoogle } from "@/lib/google-sign-in";
import { usePlatformAccess } from "./PlatformAccessProvider";

export type FormMode = "register" | "password" | "email";

export function AccessForm({
  invitation = false,
  selectedMode: controlledMode,
  headingId,
  onModeChange,
}: {
  invitation?: boolean;
  selectedMode?: FormMode;
  headingId?: string;
  onModeChange?: (mode: FormMode) => void;
}) {
  const { isLoading } = usePlatformAccess();
  const [localMode, setLocalMode] = useState<FormMode>("register");
  const mode = controlledMode ?? localMode;
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);
  const returnUrl = () => new URL(invitation ? "/convite" : "/", window.location.origin).href;

  async function authenticate(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    setPending(true);
    setMessage(null);
    try {
      if (!event) {
        await signInWithGoogle(returnUrl());
        return;
      }

      const fields = new FormData(event.currentTarget);
      const email = String(fields.get("email")).trim();
      const password = String(fields.get("password") ?? "");
      if (mode === "register") {
        const name = String(fields.get("name")).trim();
        if (!name) throw new Error("Informe seu nome.");
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { full_name: name }, emailRedirectTo: returnUrl() },
        });
        if (error) throw error;
        if (!data.session)
          setMessage({
            text: "Verifique seu e-mail para confirmar o cadastro. Abra o link neste navegador.",
            error: false,
          });
      } else if (mode === "password") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signInWithOtp({
          email,
          options: { emailRedirectTo: returnUrl() },
        });
        if (error) throw error;
        setMessage({
          text: "Enviamos um link de acesso. Abra-o neste navegador para continuar.",
          error: false,
        });
      }
    } catch (error) {
      const code = (error as { code?: string } | null)?.code;
      const copy =
        code === "invalid_credentials"
          ? "E-mail ou senha inválidos. Confira os dados ou use o link por e-mail."
          : code === "email_not_confirmed"
            ? "Confirme seu e-mail pelo link enviado no cadastro."
            : code === "over_email_send_rate_limit"
              ? "Aguarde um momento antes de solicitar outro e-mail."
              : "Não foi possível continuar. Confira seus dados e tente novamente.";
      setMessage({ text: copy, error: true });
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="access-form-panel">
      <h2 id={headingId}>{invitation ? "Entre para usar seu convite" : "Acesse sua conta"}</h2>
      <button
        type="button"
        className="saas-button saas-button-outline w-full justify-center"
        disabled={pending || isLoading}
        onClick={() => void authenticate()}
      >
        <img src="/brand/google-signin.svg" width={18} height={18} alt="" /> Continuar com Google
      </button>
      <div className="access-mode-list" aria-label="Formas de acesso">
        {(
          [
            ["register", "Criar conta"],
            ["password", "Entrar"],
            ["email", "Link por e-mail"],
          ] as const
        ).map(([value, label]) => (
          <button
            type="button"
            aria-pressed={mode === value}
            disabled={pending || isLoading}
            key={value}
            onClick={() => {
              if (!onModeChange) setLocalMode(value);
              onModeChange?.(value);
              setMessage(null);
            }}
          >
            {label}
          </button>
        ))}
      </div>
      <form onSubmit={authenticate} className="access-fields">
        {mode === "register" && (
          <label>
            Nome
            <input name="name" autoComplete="name" maxLength={120} required />
          </label>
        )}
        <label>
          E-mail
          <input name="email" type="email" autoComplete="email" maxLength={254} required />
        </label>
        {mode !== "email" && (
          <label>
            Senha
            <input
              name="password"
              type="password"
              autoComplete={mode === "register" ? "new-password" : "current-password"}
              minLength={mode === "register" ? 8 : undefined}
              required
            />
          </label>
        )}
        <button
          type="submit"
          disabled={pending || isLoading}
          className="saas-button saas-button-primary w-full justify-center"
        >
          {pending
            ? "Aguarde…"
            : mode === "register"
              ? "Criar minha conta"
              : mode === "password"
                ? "Entrar na MouseHot"
                : "Enviar link de acesso"}
          {mode === "email" ? (
            <Mail size={17} aria-hidden />
          ) : mode === "password" ? (
            <KeyRound size={17} aria-hidden />
          ) : (
            <ArrowRight size={17} aria-hidden />
          )}
        </button>
        {message && (
          <p className="access-message" role={message.error ? "alert" : "status"}>
            {message.text}
          </p>
        )}
      </form>
    </div>
  );
}
