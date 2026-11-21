import { createHash, createHmac } from "node:crypto";
import { JWT } from "google-auth-library";
import { DrivePublishError, driveFileLimit, driveVideoMaxBytes } from "./instagram-drive.ts";

const folderMime = "application/vnd.google-apps.folder";
const metadataFields =
  "id,name,mimeType,trashed,size,parents,md5Checksum,headRevisionId,capabilities(canDownload)";
const idPattern = /^[\w-]{10,120}$/;
const safeVersion = /^[\w-]{1,200}$/;
const checksumPattern = /^[a-f0-9]{32}$/;

type DriveFile = {
  id: string;
  name: string;
  mimeType: string;
  trashed?: boolean;
  size?: string;
  parents?: string[];
  md5Checksum?: string;
  headRevisionId?: string;
  capabilities?: { canDownload?: boolean };
};

export type DriveLibraryEntry = {
  file_id: string;
  revision: string;
  checksum: string;
  size_bytes: number;
  filename: string;
  mime: "video/mp4" | "video/quicktime";
};

export class DriveLibraryError extends Error {}

let credentials: JWT | undefined;

export function driveIntegrationEmail() {
  return process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_PRIVATE_KEY?.trim() &&
    process.env.INSTAGRAM_OAUTH_STATE_SECRET?.trim()
    ? process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_EMAIL?.trim() || null
    : null;
}

export function driveFolderChallenge(workspaceId: string, accountId: string, folderId: string) {
  const secret = process.env.INSTAGRAM_OAUTH_STATE_SECRET;
  if (!secret) throw new DriveLibraryError("O Google Drive ainda não está ativado.");
  const token = createHmac("sha256", secret)
    .update(`instagram-drive-folder/v1|${workspaceId}|${accountId}|${folderId}`)
    .digest("hex")
    .slice(0, 32);
  return `MOUSEHOT-${token}`;
}

async function driveToken() {
  const email = driveIntegrationEmail();
  if (!email) throw new DriveLibraryError("O Google Drive ainda não está ativado.");
  credentials ??= new JWT({
    email,
    key: process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_PRIVATE_KEY!.trim().replace(/\\n/g, "\n"),
    scopes: ["https://www.googleapis.com/auth/drive.readonly"],
  });
  const { token } = await credentials.getAccessToken().catch(() => ({ token: null }));
  if (!token) throw new DriveLibraryError("A integração com o Google Drive está indisponível.");
  return token;
}

export function driveLibraryEntry(file: DriveFile, folderId: string): DriveLibraryEntry | null {
  const size = Number(file.size);
  const checksum = file.md5Checksum?.toLowerCase() ?? "";
  if (
    !idPattern.test(file.id) ||
    !safeVersion.test(file.headRevisionId ?? "") ||
    !checksumPattern.test(checksum) ||
    !Number.isSafeInteger(size) ||
    size < 1 ||
    size > driveVideoMaxBytes ||
    file.trashed ||
    !file.parents?.includes(folderId) ||
    !file.capabilities?.canDownload ||
    !file.name ||
    !/\.(mp4|mov)$/i.test(file.name) ||
    !["video/mp4", "video/quicktime"].includes(file.mimeType)
  )
    return null;
  return {
    file_id: file.id,
    revision: file.headRevisionId!,
    checksum,
    size_bytes: size,
    filename: file.name.slice(0, 200),
    mime: file.mimeType === "video/quicktime" ? "video/quicktime" : "video/mp4",
  };
}

export function createDriveReader(token = driveToken, fetcher = fetch) {
  async function request(path: string, params: Record<string, string>, signal: AbortSignal) {
    const url = new URL("https://www.googleapis.com/drive/v3/files" + path);
    url.search = new URLSearchParams({ ...params, supportsAllDrives: "true" }).toString();
    return fetcher(url, {
      signal,
      redirect: "error",
      headers: { Authorization: "Bearer " + (await token()) },
    });
  }

  async function metadata(id: string, signal: AbortSignal) {
    if (!idPattern.test(id)) throw new DriveLibraryError("Identificador do Drive inválido.");
    const response = await request("/" + id, { fields: metadataFields }, signal);
    if (response.status === 403 || response.status === 404) return null;
    if (!response.ok) throw new DriveLibraryError("O Google Drive não respondeu. Tente novamente.");
    return (await response.json()) as DriveFile;
  }

  async function list(query: string, fields: string, signal: AbortSignal, pageToken = "") {
    const response = await request(
      "",
      {
        q: query,
        fields: `nextPageToken,incompleteSearch,files(${fields})`,
        pageSize: "100",
        includeItemsFromAllDrives: "true",
        ...(pageToken ? { pageToken } : {}),
      },
      signal,
    );
    if (!response.ok) throw new DriveLibraryError("Não foi possível listar os arquivos da pasta.");
    const data = (await response.json()) as {
      files?: DriveFile[];
      nextPageToken?: string;
      incompleteSearch?: boolean;
    };
    if (!Array.isArray(data.files) || data.incompleteSearch)
      throw new DriveLibraryError("O Google Drive não retornou a lista completa. Tente novamente.");
    return { files: data.files, next: data.nextPageToken };
  }

  return {
    async scan(folderId: string, marker?: string) {
      const signal = AbortSignal.timeout(25_000);
      const folder = await metadata(folderId, signal);
      if (!folder || folder.trashed || folder.mimeType !== folderMime)
        throw new DriveLibraryError(
          "Compartilhe a pasta do Google Drive com o e-mail da integração como Leitor.",
        );
      const parent = `'${folderId}' in parents and trashed = false`;
      if (marker) {
        if (!/^MOUSEHOT-[a-f0-9]{32}$/.test(marker))
          throw new DriveLibraryError("Confirmação de pasta inválida.");
        const proof = await list(
          `${parent} and mimeType = '${folderMime}' and name = '${marker}'`,
          "id,name",
          signal,
        );
        if (!proof.files.some((item) => item.name === marker))
          throw new DriveLibraryError(
            "Crie a subpasta com o nome de confirmação dentro da pasta de vídeos.",
          );
      }
      const files = new Map<string, DriveLibraryEntry>();
      let skipped = 0;
      let pageToken = "";
      const tokens = new Set<string>();
      do {
        const page = await list(
          `${parent} and (mimeType = 'video/mp4' or mimeType = 'video/quicktime')`,
          metadataFields,
          signal,
          pageToken,
        );
        for (const item of page.files) {
          const entry = driveLibraryEntry(item, folderId);
          if (entry) files.set(entry.file_id, entry);
          else skipped++;
        }
        if (
          files.size > driveFileLimit ||
          tokens.size >= 25 ||
          (page.next && tokens.has(page.next))
        )
          throw new DriveLibraryError("Use uma pasta com até 1.000 vídeos para esta biblioteca.");
        pageToken = page.next ?? "";
        if (pageToken) tokens.add(pageToken);
      } while (pageToken);
      return {
        name: folder.name?.trim().slice(0, 180) || "Google Drive",
        files: [...files.values()],
        skipped,
      };
    },

    async download(
      folderId: string,
      expected: Pick<DriveLibraryEntry, "file_id" | "revision" | "checksum" | "size_bytes">,
      signal: AbortSignal,
    ) {
      const file = await metadata(expected.file_id, signal);
      if (
        !file ||
        file.trashed ||
        !file.parents?.includes(folderId) ||
        !file.capabilities?.canDownload
      )
        throw new DrivePublishError("drive_unavailable");
      const current = driveLibraryEntry(file, folderId);
      if (
        !current ||
        current.revision !== expected.revision ||
        current.checksum !== expected.checksum ||
        current.size_bytes !== expected.size_bytes
      )
        throw new DrivePublishError("drive_changed");
      const response = await request("/" + expected.file_id, { alt: "media" }, signal);
      if (response.status === 403 || response.status === 404)
        throw new DrivePublishError("drive_unavailable");
      if (!response.ok || !response.body) throw new DrivePublishError("drive_transfer");
      return verifyDriveVideoStream(response.body, expected);
    },
  };
}

export function verifyDriveVideoStream(
  body: ReadableStream<Uint8Array>,
  expected: Pick<DriveLibraryEntry, "checksum" | "size_bytes">,
) {
  const hash = createHash("md5");
  const prefix = new Uint8Array(12);
  let received = 0;
  return body.pipeThrough(
    new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller) {
        if (received < prefix.length)
          prefix.set(chunk.subarray(0, prefix.length - received), received);
        received += chunk.byteLength;
        if (received > expected.size_bytes) throw new DrivePublishError("drive_changed");
        hash.update(chunk);
        controller.enqueue(chunk);
      },
      flush() {
        if (received !== expected.size_bytes || hash.digest("hex") !== expected.checksum)
          throw new DrivePublishError("drive_changed");
        if (
          received < prefix.length ||
          new TextDecoder("ascii").decode(prefix.subarray(4, 8)) !== "ftyp"
        )
          throw new DrivePublishError("drive_transfer");
      },
    }),
  );
}
