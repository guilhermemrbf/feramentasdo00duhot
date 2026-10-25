import http from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";

export async function serveLocalUi(directory) {
  let origin;
  const root = path.resolve(directory);
  const server = http.createServer(async (request, response) => {
    const headers = {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy":
        "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src http://127.0.0.1:*; frame-src 'none'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'",
    };
    try {
      if (
        request.headers.host !== new URL(origin).host ||
        !["GET", "HEAD"].includes(request.method)
      )
        throw new Error("denied");
      const source = request.headers["sec-fetch-site"];
      if (source && !["none", "same-origin"].includes(source)) throw new Error("denied");
      const pathname = decodeURIComponent(new URL(request.url, origin).pathname);
      const relative = pathname === "/" ? "index.html" : pathname.slice(1);
      const filename = path.resolve(root, relative);
      if (
        !filename.startsWith(root + path.sep) ||
        relative.includes("\\") ||
        relative.includes(":")
      )
        throw new Error("denied");
      const bytes = await readFile(filename);
      const mime = {
        ".html": "text/html; charset=utf-8",
        ".js": "text/javascript; charset=utf-8",
        ".css": "text/css; charset=utf-8",
        ".png": "image/png",
        ".woff2": "font/woff2",
        ".svg": "image/svg+xml",
      };
      response.writeHead(200, {
        ...headers,
        "Content-Type": mime[path.extname(filename)] || "application/octet-stream",
      });
      response.end(request.method === "HEAD" ? undefined : bytes);
    } catch {
      response.writeHead(404, { ...headers, "Content-Type": "text/plain; charset=utf-8" });
      response.end("Recurso local não encontrado.");
    }
  });
  server.requestTimeout = 15000;
  server.headersTimeout = 10000;
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  origin = `http://127.0.0.1:${server.address().port}`;
  return {
    origin,
    close: () =>
      new Promise((resolve) => {
        server.closeAllConnections();
        server.close(resolve);
      }),
  };
}
