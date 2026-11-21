import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { requirePlatformAccess } from "@/integrations/supabase/platform-middleware";
import { driveFolderId } from "@/lib/instagram-drive";
import type { PostkitDatabase } from "@/lib/postkit-database";

const accountInput = z.object({ workspaceId: z.string().uuid(), accountId: z.string().uuid() });
const commandInput = accountInput.extend({
  action: z.enum(["status", "challenge", "connect", "sync", "disconnect"]),
  folderUrl: z.string().max(400).optional(),
});

export const manageInstagramDrive = createServerFn({ method: "POST" })
  .middleware([requirePlatformAccess])
  .validator(commandInput)
  .handler(async ({ data, context }) => {
    const { data: canEdit, error } = await context.supabase.rpc("has_workspace_role", {
      target_workspace: data.workspaceId,
      allowed_roles: ["owner", "admin", "editor"],
    });
    if (error || !canEdit) return { error: "Seu acesso não permite editar esta biblioteca." };

    const drive = await import("@/lib/instagram-drive.server");
    const email = drive.driveIntegrationEmail();
    if (!email) return { available: false as const };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as unknown as SupabaseClient<PostkitDatabase>;
    const apiInput = {
      p_workspace: data.workspaceId,
      p_account: data.accountId,
      p_actor: context.userId,
    };
    try {
      const { data: account, error: accountError } = await context.supabase
        .from("instagram_accounts")
        .select("id")
        .eq("id", data.accountId)
        .eq("workspace_id", data.workspaceId)
        .eq("connection_status", "connected")
        .maybeSingle();
      if (accountError || !account)
        return { error: "Reconecte a conta do Instagram para usar a biblioteca." };
      const { data: source, error: sourceError } = await db
        .from("instagram_drive_sources")
        .select("folder_id,folder_name")
        .eq("workspace_id", data.workspaceId)
        .eq("account_id", data.accountId)
        .maybeSingle();
      if (sourceError) return { error: "Não foi possível abrir a biblioteca do Google Drive." };
      if (data.action === "status")
        return { available: true as const, email, folder: source?.folder_name ?? null };
      if (data.action === "disconnect") {
        const result = await db.rpc("disconnect_instagram_drive_library", apiInput);
        if (result.error) return { error: "Não foi possível desconectar a pasta." };
        return { available: true as const, email, folder: null };
      }

      const linking = data.action === "challenge" || data.action === "connect";
      const folderId = linking ? driveFolderId(data.folderUrl ?? "") : source?.folder_id;
      if (!folderId)
        return {
          error: linking
            ? "Cole o link de uma pasta do Google Drive."
            : "Conecte uma pasta primeiro.",
        };
      if (linking && source && source.folder_id !== folderId)
        return { error: "Desconecte a pasta atual antes de vincular outra." };
      const marker = linking
        ? drive.driveFolderChallenge(data.workspaceId, data.accountId, folderId)
        : undefined;
      if (data.action === "challenge") return { available: true as const, email, marker };

      const scan = await drive.createDriveReader().scan(folderId, marker);
      const saved = await db.rpc("sync_instagram_drive_library", {
        ...apiInput,
        p_folder: folderId,
        p_name: scan.name,
        p_files: scan.files,
        p_connect: linking,
      });
      if (saved.error)
        return {
          error: "Não foi possível salvar a biblioteca. Atualize a página e tente novamente.",
        };
      return {
        available: true as const,
        email,
        folder: scan.name,
        imported: saved.data ?? 0,
        skipped: scan.skipped,
      };
    } catch (reason) {
      return {
        error:
          reason instanceof drive.DriveLibraryError
            ? reason.message
            : "O Google Drive está indisponível. Tente novamente.",
      };
    }
  });
