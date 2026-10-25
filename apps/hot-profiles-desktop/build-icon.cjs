// Convert the existing project mark to a Windows ICO without another image tool.
const { app, nativeImage } = require("electron");
const fs = require("node:fs");
const path = require("node:path");
app.whenReady().then(() => {
  const source = nativeImage.createFromPath(path.resolve(__dirname, "../../public/brand/mark.png"));
  if (source.isEmpty()) throw new Error("Marca original não encontrada.");
  const png = source.resize({ width: 256, height: 256 }).toPNG();
  const header = Buffer.alloc(22);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(1, 4);
  header.writeUInt16LE(1, 10);
  header.writeUInt16LE(32, 12);
  header.writeUInt32LE(png.length, 14);
  header.writeUInt32LE(22, 18);
  fs.mkdirSync(path.join(__dirname, "assets"), { recursive: true });
  fs.writeFileSync(path.join(__dirname, "assets/icon.ico"), Buffer.concat([header, png]));
  app.exit(0);
});
