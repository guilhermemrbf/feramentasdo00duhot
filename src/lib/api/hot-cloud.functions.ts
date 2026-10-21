import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { cloudCommandSchema, type CloudReply } from "@/lib/hot-cloud";

export const getHotCloudSetup = createServerFn({ method: "GET" }).handler(async () => {
  const { cloudSetup } = await import("@/lib/hot-cloud.server");
  return cloudSetup();
});

export const hotCloudAction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(cloudCommandSchema)
  .handler(async ({ data, context }): Promise<CloudReply> => {
    const { executeCloudCommand, CloudError } = await import("@/lib/hot-cloud.server");
    try {
      return {
        ok: true,
        data: JSON.stringify((await executeCloudCommand(context.userId, data)) ?? null),
      };
    } catch (reason) {
      return {
        ok: false,
        error:
          reason instanceof CloudError
            ? reason.message
            : "Não foi possível concluir. Atualize o painel e tente novamente.",
      };
    }
  });
