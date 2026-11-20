import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import react from "@vitejs/plugin-react";
import { nitro } from "nitro/vite";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

const vercelBuild = process.env.VERCEL === "1" || process.env.NITRO_PRESET === "vercel";
let deploymentOrigin: string | undefined;

if (vercelBuild) {
  if (
    !process.env.VITE_SUPABASE_URL ||
    !process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    process.env.VITE_SUPABASE_URL !== process.env.SUPABASE_URL ||
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY !== process.env.SUPABASE_PUBLISHABLE_KEY
  ) {
    throw new Error("Vercel requires explicit, matching build and runtime Supabase settings.");
  }
  const configured = new URL(process.env.APP_BASE_URL ?? "http://localhost");
  if (configured.protocol !== "https:" || configured.href !== configured.origin + "/") {
    throw new Error("Vercel requires APP_BASE_URL to be the public HTTPS origin.");
  }
  const requiredServerKeys = [
    "SUPABASE_SERVICE_ROLE_KEY",
    "META_GRAPH_API_VERSION",
    "INSTAGRAM_OAUTH_STATE_SECRET",
    "INSTAGRAM_TOKEN_ENCRYPTION_KEY",
  ];
  const missing = requiredServerKeys.filter((key) => !process.env[key]?.trim());
  if (missing.length) {
    throw new Error("Missing Vercel server environment variables: " + missing.join(", "));
  }
  deploymentOrigin = configured.origin;
}

export default defineConfig({
  plugins: [
    tsconfigPaths(),
    tailwindcss(),
    tanstackStart({ server: { entry: "server" } }),
    nitro({ preset: vercelBuild ? "vercel" : "node-server" }),
    react(),
  ],
  ...(deploymentOrigin
    ? { define: { "import.meta.env.VITE_SITE_ORIGIN": JSON.stringify(deploymentOrigin) } }
    : {}),
  resolve: { dedupe: ["react", "react-dom", "@tanstack/react-router"] },
  optimizeDeps: { exclude: ["@ffmpeg/ffmpeg", "@ffmpeg/core"] },
});
