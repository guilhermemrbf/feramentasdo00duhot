import { useState } from "react";
import { HOT_CONNECTION_KEY, pairComputer } from "@/lib/hot-profiles";
export function InstagramLocalLogin({
  onReady,
  onClose,
}: {
  onReady: () => void;
  onClose: () => void;
}) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <section
      className="mt-4 rounded-xl border border-sky-400/30 bg-sky-400/5 p-5"
      aria-label="Conectar navegador local"
    >
      <h2 className="font-semibold">Uma sessão nova para cada Instagram</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Abra o conector Hot Profiles neste computador. Ele abrirá uma janela independente do Chrome,
        sem reutilizar o login das outras contas.
      </p>
      <a
        className="mt-3 inline-block text-sm text-sky-300 underline"
        href="/hot-profiles-connector.zip"
        download
      >
        Baixar conector atualizado para Windows
      </a>
      <p className="mt-2 text-xs text-muted-foreground">
        Extraia o ZIP e execute Iniciar Hot Profiles.cmd. Requer Node.js 22 ou superior. Mantenha o
        conector aberto.
      </p>
      <form
        className="mt-4 flex flex-wrap items-end gap-3"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError("");
          try {
            const c = await pairComputer("http://127.0.0.1:47900", code);
            sessionStorage.setItem(HOT_CONNECTION_KEY, JSON.stringify(c));
            onReady();
          } catch (e) {
            setError(e instanceof Error ? e.message : "Não foi possível conectar.");
          } finally {
            setBusy(false);
          }
        }}
      >
        <label className="text-sm">
          Código de 6 números do conector
          <input
            className="field mt-1"
            inputMode="numeric"
            pattern="[0-9]{6}"
            maxLength={6}
            required
            value={code}
            onChange={(e) => setCode(e.target.value)}
            autoComplete="off"
          />
        </label>
        <button
          disabled={busy}
          className="rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground"
        >
          {busy ? "Conectando…" : "Conectar e abrir Instagram"}
        </button>
        <button type="button" onClick={onClose} className="px-3 py-2 text-sm">
          Cancelar
        </button>
      </form>
      {error && (
        <p role="alert" className="mt-3 text-sm text-amber-200">
          {error}
        </p>
      )}
    </section>
  );
}
