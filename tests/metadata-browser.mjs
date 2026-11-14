import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { mkdtemp, readFile, readdir, rm, rmdir, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { crc32 } from "node:zlib";
import { join, resolve } from "node:path";
import { BlobReader, BlobWriter, ZipReader } from "@zip.js/zip.js";

const require = createRequire(resolve(process.env.INTELLIGENCE_PG_TEST_DEPS || ".", "package.json"));
const { chromium } = require("playwright-core");
const base = process.env.UI_TEST_URL || "http://127.0.0.1:4393";
const temp = await mkdtemp(join(tmpdir(), "mausehot-cleaner-"));
const sentinel = "MAUSEHOT_TEST_PRIVATE_LOCATION";
const video = join(temp, "tagged.mp4");
const mov = join(temp, "tagged.mov");
const webm = join(temp, "tagged.webm");
const badVideo = join(temp, "invalid.mp4");
const photo = join(temp, "tagged.jpg");
const png = join(temp, "tagged.png");
const webp = join(temp, "photo.webp");
let server;
let browser;
const ffmpeg = (...args) => execFileSync("ffmpeg", ["-v", "error", "-y", ...args]);
const ffprobe = (path) => JSON.parse(execFileSync("ffprobe", [
  "-v", "error", "-show_format", "-show_streams", "-of", "json", path,
], { encoding: "utf8" }));

function inspectVideo(path, input) {
  const source = ffprobe(input), cleaned = ffprobe(path);
  assert.doesNotMatch(JSON.stringify(cleaned.format.tags ?? {}), new RegExp(sentinel));
  assert.equal(cleaned.format.tags?.comment, undefined);
  for (const stream of cleaned.streams) {
    const original = source.streams.find((item) => item.codec_type === stream.codec_type);
    assert.equal(stream.codec_name, original.codec_name);
  }
  assert.deepEqual(cleaned.streams.map((item) => item.codec_type).sort(), ["audio", "video"]);
  assert(Math.abs(Number(cleaned.format.duration) - Number(source.format.duration)) <= 0.05);
}

try {
  ffmpeg("-f", "lavfi", "-i", "testsrc2=s=128x96:r=24:d=1",
    "-f", "lavfi", "-i", "sine=frequency=440:duration=1", "-c:v", "libx264",
    "-c:a", "aac", "-metadata", "comment=" + sentinel, video);
  ffmpeg("-i", video, "-c", "copy", mov);
  ffmpeg("-i", video, "-c:v", "libvpx-vp9", "-c:a", "libopus", webm);
  await writeFile(badVideo, "invalid media");
  ffmpeg("-f", "lavfi", "-i", "color=c=red:s=32x32", "-frames:v", "1", photo);
  const raw = await readFile(photo);
  const comment = Buffer.from(sentinel);
  const jpeg = Buffer.concat([raw.subarray(0, 2), Buffer.from([255, 254, 0, comment.length + 2]), comment, raw.subarray(2)]);
  await writeFile(photo, jpeg);
  ffmpeg("-f", "lavfi", "-i", "color=c=red:s=32x32", "-frames:v", "1", png);
  ffmpeg("-f", "lavfi", "-i", "color=c=red:s=32x32", "-frames:v", "1", webp);
  const pngBytes = await readFile(png);
  const text = Buffer.from("tEXtComment\0" + sentinel);
  const textChunk = Buffer.alloc(text.length + 8);
  textChunk.writeUInt32BE(text.length - 4, 0);
  text.copy(textChunk, 4);
  textChunk.writeUInt32BE(crc32(text), textChunk.length - 4);
  await writeFile(png, Buffer.concat([pngBytes.subarray(0, 33), textChunk, pngBytes.subarray(33)]));
  assert.equal(ffprobe(video).format.tags.comment, sentinel);

  if (!process.env.UI_TEST_URL) {
    server = spawn(process.execPath, ["node_modules/vite/bin/vite.js", "--host", "127.0.0.1", "--port", "4393", "--strictPort"], {
      env: { ...process.env, VITE_SUPABASE_URL: "http://127.0.0.1:4389", VITE_SUPABASE_PUBLISHABLE_KEY: "fixture-anon" },
      stdio: "ignore", windowsHide: true,
    });
    for (let attempt = 0; attempt < 100; attempt++) {
      if (await fetch(base).then((response) => response.ok, () => false)) break;
      await new Promise((done) => setTimeout(done, 500));
    }
  }
  browser = await chromium.launch({
    executablePath: process.env.INTELLIGENCE_CHROME || "C:/Program Files/Google/Chrome/Application/chrome.exe",
    headless: true,
  });
  const page = await browser.newPage({ acceptDownloads: true });
  page.on("pageerror", (error) => console.error("Erro do navegador:", error.message));
  page.on("requestfailed", (request) => console.error("Recurso:", request.url(), request.failure()));
  page.on("response", (response) => {
    if (response.status() >= 400 || /ffmpeg|\.wasm/.test(response.url())) {
      console.log("HTTP", response.status(), response.url(), response.headers()["content-type"]);
    }
  });
  await page.addInitScript(() => Object.defineProperty(crypto, "randomUUID", { value: undefined }));
  await page.goto(base + "/limpar-metadados");
  const batch = page.getByRole("region", { name: "Limpeza de Metadados em Massa" });
  const batchInput = batch.getByLabel("Arquivos para limpeza em massa");
  await page.waitForFunction(() => Object.keys(document.querySelector('input[aria-label="Arquivos para limpeza em massa"]') || {}).some((key) => key.startsWith("__reactProps")));
  await batchInput.setInputFiles([photo, png, webp, badVideo, video, mov, webm]);
  await batch.getByRole("button", { name: "Iniciar limpeza em massa" }).click();
  await batch.getByText("Processamento concluído!", { exact: true }).waitFor({ timeout: 90000 });
  const downloadBatch = page.waitForEvent("download");
  await batch.getByRole("button", { name: "Baixar ZIP com arquivos limpos" }).click();
  const zip = await readFile(await (await downloadBatch).path());
  const reader = new ZipReader(new BlobReader(new Blob([zip])));
  try {
    const entries = await reader.getEntries();
    const report = entries.find((entry) => entry.filename === "relatorio-limpeza.txt");
    const summary = await (await report.getData(new BlobWriter())).text();
    console.log(summary);
    assert.match(summary, /sucesso: 6; falhas: 1/);
    assert.match(summary, /invalid\.mp4: Vídeo corrompido/);
    assert.deepEqual(entries.map((entry) => entry.filename).sort(), ["photo.webp", "relatorio-limpeza.txt", "tagged.jpg", "tagged.mov", "tagged.mp4", "tagged.png", "tagged.webm"]);
    for (const entry of entries.filter((item) => item.filename !== "relatorio-limpeza.txt")) {
      const data = Buffer.from(await (await entry.getData(new BlobWriter())).arrayBuffer());
      assert.equal(data.includes(sentinel), false, entry.filename);
      if (/\.(jpg|png|webp)$/.test(entry.filename)) {
        await page.evaluate(async (bytes) => {
          const bitmap = await createImageBitmap(new Blob([new Uint8Array(bytes)]));
          if (bitmap.width !== 32 || bitmap.height !== 32) throw new Error("Imagem não preservada");
          bitmap.close();
        }, [...data]);
      } else {
        const path = join(temp, "clean-" + entry.filename);
        await writeFile(path, data);
        inspectVideo(path, join(temp, entry.filename));
      }
    }
  } finally {
    await reader.close();
  }
  console.log("PASS lote JPEG, PNG, WebP, MP4, MOV e WEBM com ZIP validado e vídeo inválido excluído.");

  await page.getByRole("button", { name: /^Vídeos/ }).click();
  const input = page.locator('input[type="file"]').first();
  await input.setInputFiles({ name: "tagged.mov", mimeType: "application/octet-stream", buffer: await readFile(mov) });
  await page.getByRole("button", { name: "Limpar metadados", exact: true }).click({ timeout: 5000 });
  const individual = page.getByRole("article").filter({ hasText: "tagged.mov" });
  const downloadSingle = page.waitForEvent("download", { timeout: 90000 });
  await individual.getByRole("button", { name: "Baixar", exact: true }).click({ timeout: 90000 });
  const result = await downloadSingle;
  assert.equal(result.suggestedFilename(), "limpo-tagged.mov");
  inspectVideo(await result.path(), mov);
  console.log("PASS vídeo individual MOV com áudio e sem comentário.");
} finally {
  await browser?.close();
  server?.kill();
  for (const filename of await readdir(temp)) await rm(join(temp, filename));
  await rmdir(temp);
}
