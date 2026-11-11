import { cp, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const root = dirname(fileURLToPath(import.meta.url));
const fixture = process.argv.includes("--fixture");
const outdir = resolve(root, "dist", fixture ? "fixture" : "release/Mouse Hot");
await mkdir(outdir, { recursive: true });
const manifest = JSON.parse(await readFile(resolve(root, "manifest.json"), "utf8"));
if (fixture) {
  manifest.name += " — teste local";
  manifest.host_permissions = ["http://127.0.0.1/*"];
  manifest.content_scripts = [{
    matches: ["http://127.0.0.1/*"], js: ["src/content/content.js"], run_at: "document_idle",
  }];
}
await Promise.all([
  writeFile(resolve(outdir, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n"),
  cp(resolve(root, "assets/icons"), resolve(outdir, "icons"), { recursive: true }),
  cp(resolve(root, "src/popup/index.html"), resolve(outdir, "src/popup/index.html")),
  ...(fixture ? [
    cp(resolve(root, "src/panel/index.html"), resolve(outdir, "src/panel/index.html")),
    cp(resolve(root, "src/styles"), resolve(outdir, "src/styles"), { recursive: true }),
  ] : []),
  build({
    absWorkingDir: root, outdir, outbase: ".", bundle: true, target: "chrome120",
    entryPoints: ["src/background/service-worker.js", "src/content/content.js", ...(fixture ? ["src/panel/panel.js"] : [])],
    define: { __MOUSE_HOT_FIXTURE__: String(fixture) },
    legalComments: "none", minify: true,
  }),
]);
console.log(outdir);
