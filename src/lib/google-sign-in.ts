import { supabase } from "@/integrations/supabase/client";

export async function signInWithGoogle(redirectTo: string) {
  if (import.meta.env.VITE_AUTH_PROVIDER === "supabase") {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo },
    });
    if (error) throw error;
    return;
  }

  const { lovable } = await import("@/integrations/lovable");
  const { error } = await lovable.auth.signInWithOAuth("google", { redirect_uri: redirectTo });
  if (error) throw error;
}
