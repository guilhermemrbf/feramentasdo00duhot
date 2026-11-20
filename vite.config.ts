// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, nitro (build-only using cloudflare as a default target),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

const vercelBuild = process.env.VERCEL === "1" || process.env.NITRO_PRESET === "vercel";
let deploymentOrigin: string | undefined;

if (vercelBuild) {
  // The Git-tracked Lovable .env is not a deployment configuration for Vercel.
  if (
    process.env.VITE_AUTH_PROVIDER !== "supabase" ||
    !process.env.VITE_SUPABASE_URL ||
    !process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    process.env.VITE_SUPABASE_URL !== process.env.SUPABASE_URL ||
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY !== process.env.SUPABASE_PUBLISHABLE_KEY
  ) {
    throw new Error(
      "Vercel requires native Supabase Auth and explicit, matching build and runtime Supabase settings.",
    );
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
  ...(vercelBuild ? { nitro: { preset: "vercel" } } : {}),
  vite: {
    ...(deploymentOrigin
      ? { define: { "import.meta.env.VITE_SITE_ORIGIN": JSON.stringify(deploymentOrigin) } }
      : {}),
    server: { allowedHosts: ["terminal.local"] },
    optimizeDeps: { exclude: ["@ffmpeg/ffmpeg", "@ffmpeg/core"] },
  },
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
});
