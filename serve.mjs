// serve.mjs — entry point de produção
// Serve arquivos estáticos de dist/client/ + SSR de dist/server/server.js
import { readFile } from "node:fs/promises";
import { join, extname } from "node:path";
import { fileURLToPath } from "node:url";
import { serve } from "srvx/node";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const clientDir = join(__dirname, "dist/client");
const PORT = Number(process.env.PORT) || 3000;

const ssr = (await import("./dist/server/server.js")).default;
const fetchHandler = typeof ssr === "function" ? ssr : ssr.fetch.bind(ssr);

const MIME = {
  ".js": "application/javascript",
  ".mjs": "application/javascript",
  ".css": "text/css",
  ".html": "text/html",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".json": "application/json",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".ttf": "font/ttf",
  ".webp": "image/webp",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".mp4": "video/mp4",
};

serve({
  port: PORT,
  fetch: async (request) => {
    const url = new URL(request.url);
    const filePath = join(clientDir, url.pathname);
    try {
      const data = await readFile(filePath);
      const ext = extname(filePath).toLowerCase();
      return new Response(data, {
        headers: {
          "Content-Type": MIME[ext] ?? "application/octet-stream",
          "Cache-Control": url.pathname.startsWith("/assets/")
            ? "public, max-age=31536000, immutable"
            : "no-cache",
        },
      });
    } catch {
      // não é arquivo estático — delega ao SSR
    }
    return fetchHandler(request);
  },
});

console.log(`[ra-routes] server listening on :${PORT}`);
