import http from 'node:http';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../dist/', import.meta.url));
const port = 4173;
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json; charset=utf-8', '.ico': 'image/x-icon' };

try { await stat(path.join(root, 'index.html')); }
catch { console.error('请先运行 npm run build，或双击 start-local.cmd。'); process.exit(1); }

const server = http.createServer(async (request, response) => {
  if (!['GET', 'HEAD'].includes(request.method)) { response.writeHead(405); response.end(); return; }
  try {
    const pathname = decodeURIComponent(new URL(request.url, `http://127.0.0.1:${port}`).pathname);
    if (pathname === '/health') { response.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); response.end(JSON.stringify({ app: 'foam-sku', version: '1.0.0' })); return; }
    const filename = path.resolve(root, `.${pathname === '/' ? '/index.html' : pathname}`);
    if (!filename.startsWith(root)) { response.writeHead(403); response.end(); return; }
    if (!(await stat(filename)).isFile()) { response.writeHead(404); response.end(); return; }
    response.writeHead(200, { 'Content-Type': types[path.extname(filename)] || 'application/octet-stream', 'Cache-Control': pathname.startsWith('/assets/') ? 'public, max-age=31536000, immutable' : 'no-store' });
    if (request.method === 'HEAD') { response.end(); return; }
    createReadStream(filename).on('error', () => response.destroy()).pipe(response);
  } catch { response.writeHead(404); response.end('Not found'); }
});

server.on('error', async error => {
  if (error.code === 'EADDRINUSE') {
    try {
      const existing = await fetch(`http://127.0.0.1:${port}/health`);
      if ((await existing.json()).app === 'foam-sku') { console.log(`FOAM SKU 已在运行：http://127.0.0.1:${port}/`); process.exit(0); }
    } catch { /* Another application owns this port. */ }
  }
  console.error(`无法启动本地服务：${error.message}`); process.exit(1);
});
server.listen(port, '127.0.0.1', () => console.log(`FOAM SKU 本地服务：http://127.0.0.1:${port}/\n按 Ctrl+C 停止。`));
