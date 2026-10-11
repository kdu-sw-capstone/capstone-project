"""Native browser Worker fetch + product request helpers; synthetic HTTP, not Extension/Server integration."""
from pathlib import Path
import http.server, threading, json, shutil
from playwright.sync_api import sync_playwright
root = Path(__file__).resolve().parents[2]
calls = []
class Handler(http.server.BaseHTTPRequestHandler):
    def log_message(self, *args): pass
    def do_GET(self):
        name = self.path.split('?')[0]
        if name.startswith('/background/'):
            body = (root / name.lstrip('/')).read_text()
            if '?baseline' in self.path:
                body = body.replace('globalThis.fetch.bind(globalThis)', 'globalThis.fetch')
            content_type = 'text/javascript'
        else: body, content_type = '<!doctype html><title>Worker transport regression</title>', 'text/html'
        self.send_response(200); self.send_header('Content-Type', content_type); self.end_headers(); self.wfile.write(body.encode())
    def do_POST(self):
        self.rfile.read(int(self.headers.get('Content-Length', 0)))
        calls.append(self.path)
        self.send_response(201); self.send_header('Content-Type', 'application/json'); self.end_headers()
        self.wfile.write(b'{"accepted":true}')
server = http.server.ThreadingHTTPServer(('127.0.0.1', 0), Handler)
threading.Thread(target=server.serve_forever, daemon=True).start()
try:
    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=True, executable_path=shutil.which('chromium'))
        page = browser.new_page(); origin = f'http://127.0.0.1:{server.server_port}'
        page.goto(origin)
        for baseline in [True, False]:
            calls.clear()
            result = page.evaluate('''async ({origin, baseline}) => {
              const source = `importScripts('${origin}/background/member-auth.js${baseline?'?baseline':''}', '${origin}/background/member-events.js${baseline?'?baseline':''}');
                (async () => {
                  const credentials = {owner_key:'MEMBER:1',executor_id:'22222222-2222-4222-8222-222222222222',access_token:'synthetic-only'};
                  const auth = new FocurveMemberAuth.MemberAuth({});
                  const events = new FocurveMemberEvents.MemberEventDelivery({baseUrl:'${origin}/api/v1',getCredentials:async()=>credentials});
                  const output = [];
                  for (const run of [()=>auth.request({server_url:'${origin}/api/v1'},'/extension-installations',{}),()=>events.request('/events',{},credentials)]) {
                    try { output.push({ok:true,data:await run()}); } catch(e) { output.push({ok:false,name:e.name,message:e.message}); }
                  }
                  postMessage(output);
                })();`;
              return await new Promise((resolve,reject) => {
                const url=URL.createObjectURL(new Blob([source],{type:'text/javascript'}));
                const worker=new Worker(url); const timer=setTimeout(()=>{worker.terminate();reject(Error('worker timeout'));},15000);
                worker.onmessage=e=>{clearTimeout(timer);worker.terminate();URL.revokeObjectURL(url);resolve(e.data);};
                worker.onerror=e=>{clearTimeout(timer);worker.terminate();reject(Error(e.message));};
              });
            }''', {'origin':origin,'baseline':baseline})
            if baseline:
                assert all(not r['ok'] for r in result), result
                assert 'Illegal invocation' in result[1]['message'], result
                assert result[0]['message'] == 'AUTH_RESPONSE_UNCONFIRMED', result
                assert not calls, calls
            else:
                assert all(r['ok'] and r['data']['accepted'] for r in result), result
                assert calls == ['/api/v1/extension-installations','/api/v1/events'], calls
            print(json.dumps({'baseline':baseline,'results':result,'http_requests':len(calls)}))
        print('PASS: original failure and fixed auth/event transport in native browser Worker; Chromium '+browser.version)
        browser.close()
finally:
    server.shutdown(); server.server_close()
