import { readFile, writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { deflateRawSync } from "node:zlib";

// Reproducible, dependency-free ZIP containing only the companion's distributable source.
const directory = path.dirname(fileURLToPath(import.meta.url));
const destination = path.resolve(directory, "../../public");
const files = [
  "bridge.mjs",
  "storage.mjs",
  "proxy.mjs",
  "browser.mjs",
  "android.mjs",
  "Iniciar Hot Profiles.cmd",
  "LEIA-ME.md",
];
const table = Array.from({ length: 256 }, (_, index) => {
  let crc = index;
  for (let bit = 0; bit < 8; bit++) crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
  return crc >>> 0;
});
const crc32 = (bytes) => {
  let crc = 0xffffffff;
  for (const value of bytes) crc = table[(crc ^ value) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
};
const local = [],
  central = [];
let offset = 0;
for (const filename of files) {
  const name = Buffer.from(`Hot Profiles/${filename}`);
  const content = await readFile(path.join(directory, filename));
  const compressed = deflateRawSync(content);
  const crc = crc32(content);
  const header = Buffer.alloc(30);
  header.writeUInt32LE(0x04034b50, 0);
  header.writeUInt16LE(20, 4);
  header.writeUInt16LE(0x800, 6);
  header.writeUInt16LE(8, 8);
  header.writeUInt16LE(0x5d55, 12);
  header.writeUInt32LE(crc, 14);
  header.writeUInt32LE(compressed.length, 18);
  header.writeUInt32LE(content.length, 22);
  header.writeUInt16LE(name.length, 26);
  const entry = Buffer.alloc(46);
  entry.writeUInt32LE(0x02014b50, 0);
  entry.writeUInt16LE(20, 4);
  entry.writeUInt16LE(20, 6);
  entry.writeUInt16LE(0x800, 8);
  entry.writeUInt16LE(8, 10);
  entry.writeUInt16LE(0x5d55, 14);
  entry.writeUInt32LE(crc, 16);
  entry.writeUInt32LE(compressed.length, 20);
  entry.writeUInt32LE(content.length, 24);
  entry.writeUInt16LE(name.length, 28);
  entry.writeUInt32LE(offset, 42);
  local.push(header, name, compressed);
  central.push(entry, name);
  offset += header.length + name.length + compressed.length;
}
const directoryBytes = Buffer.concat(central);
const end = Buffer.alloc(22);
end.writeUInt32LE(0x06054b50, 0);
end.writeUInt16LE(files.length, 8);
end.writeUInt16LE(files.length, 10);
end.writeUInt32LE(directoryBytes.length, 12);
end.writeUInt32LE(offset, 16);
await mkdir(destination, { recursive: true });
await writeFile(
  path.join(destination, "hot-profiles-connector.zip"),
  Buffer.concat([...local, directoryBytes, end]),
);
console.log(`Conector empacotado: ${files.length} arquivos, sem dados ou credenciais.`);
