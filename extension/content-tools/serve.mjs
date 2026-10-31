import http from 'node:http';
import { readFile } from 'node:fs/promises';
const root = new URL('../', import.meta.url);
export const server = http.createServer(async (request, response) => {
  const path = new URL(request.url, 'http://localhost').pathname;
  if (!/^\/(content\/[a-z-]+\.mjs|ui\/restriction\.mjs|content-tools\/(harness|claims)\.(html|mjs))$/.test(path)) {
    response.writeHead(404); response.end(); return;
  }
  try {
    const data = await readFile(new URL('.' + path, root));
    response.setHeader('Content-Type', path.endsWith('.html') ? 'text/html; charset=utf-8' : 'text/javascript');
    response.end(data);
  } catch { response.writeHead(404); response.end(); }
}).listen(4178, '127.0.0.1', () => {
  console.log('공통 제한·복원 시험: http://127.0.0.1:4178/content-tools/claims.html');
  console.log('기존 키워드 시험: http://127.0.0.1:4178/content-tools/harness.html');
});
