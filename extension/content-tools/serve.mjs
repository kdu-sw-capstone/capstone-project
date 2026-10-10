import http from 'node:http';
import { readFile } from 'node:fs/promises';
const root = new URL('../', import.meta.url);
export const server = http.createServer(async (request, response) => {
  const path = new URL(request.url, 'http://localhost').pathname;
  if (!/^\/(content\/[a-z-]+\.mjs|content-tools\/(harness\.html|harness\.mjs))$/.test(path)) {
    response.writeHead(404); response.end(); return;
  }
  try {
    const data = await readFile(new URL('.' + path, root));
    response.setHeader('Content-Type', path.endsWith('.html') ? 'text/html; charset=utf-8' : 'text/javascript');
    response.end(data);
  } catch { response.writeHead(404); response.end(); }
}).listen(4178, '127.0.0.1', () => console.log('Content fixture: http://127.0.0.1:4178/content-tools/harness.html'));
