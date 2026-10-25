import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { LegacyLocalWorkspace } from "@/components/hot-profiles/LegacyLocalWorkspace";
import type { HotConnection } from "@/lib/hot-profiles";
import "@/styles.css";

declare global {
  interface Window {
    hotProfilesDesktop: { connect: () => Promise<HotConnection> };
    hotProfilesReady?: boolean;
  }
}

function Desktop() {
  const [connection, setConnection] = useState<HotConnection | null>(null);
  const [error, setError] = useState("");
  async function connect() {
    setError("");
    try {
      setConnection(await window.hotProfilesDesktop.connect());
    } catch {
      setError(
        "Não foi possível iniciar o serviço local. Feche o conector antigo, se estiver aberto, e reabra o aplicativo. Seus dados foram preservados.",
      );
    }
  }
  useEffect(() => {
    void connect();
  }, []);
  useEffect(() => {
    window.hotProfilesReady = !!connection;
  }, [connection]);
  if (connection) return <LegacyLocalWorkspace standalone desktopConnection={connection} />;
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-5 bg-background p-8 text-center text-foreground">
      <img src="/brand/mark.png" alt="00duHot" width={64} height={64} />
      <h1 className="text-2xl font-bold">Hot Profiles</h1>
      <p
        role={error ? "alert" : "status"}
        className="max-w-lg text-sm leading-7 text-muted-foreground"
      >
        {error || "Preparando seus ambientes locais…"}
      </p>
      {error && (
        <button className="rounded border border-primary px-4 py-2" onClick={() => void connect()}>
          Tentar novamente
        </button>
      )}
    </main>
  );
}
createRoot(document.getElementById("root")!).render(<Desktop />);
