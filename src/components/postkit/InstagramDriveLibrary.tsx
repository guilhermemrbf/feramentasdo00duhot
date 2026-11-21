import { useState, type FormEvent } from "react";
import { FolderSync } from "lucide-react";
import { Button } from "@/components/ui/button";
import { manageInstagramDrive } from "@/lib/api/instagram-drive.functions";

type DriveAction = "status" | "challenge" | "connect" | "sync" | "disconnect";

export function InstagramDriveLibrary({
  workspaceId,
  accountId,
  onLibraryChange,
}: {
  workspaceId: string;
  accountId: string;
  onLibraryChange: () => void;
}) {
  const [email, setEmail] = useState("");
  const [folder, setFolder] = useState<string | null>(null);
  const [url, setUrl] = useState("");
  const [marker, setMarker] = useState("");
  const [pending, setPending] = useState<DriveAction | null>(null);
  const [notice, setNotice] = useState("");

  async function run(action: DriveAction) {
    setPending(action);
    setNotice("");
    try {
      const result = await manageInstagramDrive({
        data: { action, workspaceId, accountId, folderUrl: url },
      });
      if (result.error) {
        setNotice(result.error);
        return;
      }
      if (!result.available || !result.email) {
        setNotice("A integração com Google Drive ainda não foi ativada nesta instalação.");
        return;
      }
      setEmail(result.email);
      if (result.marker) setMarker(result.marker);
      if (result.folder !== undefined) setFolder(result.folder);
      if (action === "connect" || action === "sync") {
        setMarker("");
        setNotice(
          result.skipped
            ? `${result.imported} vídeo(s) na biblioteca. ${result.skipped} arquivo(s) sem acesso ou incompatíveis.`
            : `${result.imported} vídeo(s) do Drive na biblioteca.`,
        );
        onLibraryChange();
      }
      if (action === "disconnect") {
        setUrl("");
        setMarker("");
        setNotice(
          "Pasta desvinculada da biblioteca. Você pode retirar o acesso de leitura no Drive.",
        );
        onLibraryChange();
      }
    } catch {
      setNotice("Não foi possível abrir o Google Drive. Tente novamente.");
    } finally {
      setPending(null);
    }
  }

  function connect(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void run(marker ? "connect" : "challenge");
  }

  return (
    <details
      className="rounded-xl border border-border bg-card px-4 py-3"
      onToggle={(event) => {
        if (event.currentTarget.open && !email && !pending) void run("status");
      }}
    >
      <summary className="cursor-pointer text-sm font-semibold text-foreground">
        <FolderSync className="mr-2 inline size-4 text-brand-red" aria-hidden />
        Google Drive para Reels
      </summary>
      <div className="mt-3 space-y-3 text-sm">
        {email && folder && (
          <>
            <p>
              Pasta conectada <strong className="break-words">{folder}</strong>
            </p>
            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" disabled={!!pending} onClick={() => void run("sync")}>
                Atualizar vídeos
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!!pending}
                onClick={() => void run("disconnect")}
              >
                Desvincular pasta
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Ao desvincular, os Reels agendados a partir desta pasta perderão a fonte.
            </p>
          </>
        )}
        {email && !folder && (
          <form className="space-y-3" onSubmit={connect}>
            <p className="text-muted-foreground">
              Compartilhe uma pasta privada como <strong>Leitor</strong> com{" "}
              <code className="break-all text-foreground">{email}</code>. Coloque os MP4 ou MOV de
              até 50 MB diretamente nessa pasta.
            </p>
            <label className="block space-y-1 font-medium">
              <span>Link da pasta do Google Drive</span>
              <input
                type="url"
                required
                maxLength={400}
                value={url}
                disabled={!!pending}
                onChange={(event) => {
                  setUrl(event.target.value);
                  setMarker("");
                }}
                placeholder="https://drive.google.com/drive/folders/…"
                className="block min-h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              />
            </label>
            {marker && (
              <label className="block space-y-1">
                <span>Crie uma subpasta vazia com este nome dentro da pasta de vídeos.</span>
                <input
                  readOnly
                  value={marker}
                  onFocus={(event) => event.target.select()}
                  className="block min-h-10 w-full rounded-md border border-border bg-secondary px-3 font-mono text-xs"
                />
              </label>
            )}
            <Button type="submit" size="sm" disabled={!!pending}>
              {marker ? "Conectar e importar vídeos" : "Gerar nome de confirmação"}
            </Button>
          </form>
        )}
        <p role="status" className="text-sm text-muted-foreground">
          {pending ? "Consultando a biblioteca…" : notice}
        </p>
      </div>
    </details>
  );
}
