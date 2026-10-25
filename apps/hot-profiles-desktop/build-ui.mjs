import { build } from "../../node_modules/vite/dist/node/index.js";
import { copyFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
await build({ configFile: fileURLToPath(new URL("./vite.config.ts", import.meta.url)) });
const destination = new URL("./dist/ui/brand/", import.meta.url);
await mkdir(destination, { recursive: true });
await copyFile(
  new URL("../../public/brand/mark.png", import.meta.url),
  new URL("mark.png", destination),
);
