"""Native Chromium Worker/IndexedDB + synthetic HTTP; not the product Extension or Server."""
from pathlib import Path
import http.server
import threading
import json
import shutil
from playwright.sync_api import sync_playwright

root = Path(__file__).resolve().parents[2]
bodies = []


class Handler(http.server.BaseHTTPRequestHandler):
    def log_message(self, *args):
        pass

    def do_GET(self):
        if self.path.startswith('/src/'):
            body = (root / self.path.lstrip('/')).read_text().encode()
            content_type = 'text/javascript'
        else:
            body, content_type = b'<!doctype html><title>Execution transport test</title>', 'text/html'
        self.send_response(200)
        self.send_header('Content-Type', content_type)
        self.end_headers()
        self.wfile.write(body)

    def do_POST(self):
        bodies.append(self.rfile.read(int(self.headers['Content-Length'])))
        if len(bodies) == 1:
            # Request read, response unavailable: the client must retain its raw body.
            self.close_connection = True
            return
        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self.end_headers()
        self.wfile.write(b'{"result":"DUPLICATE","desired_revision":2}')


server = http.server.ThreadingHTTPServer(('127.0.0.1', 0), Handler)
threading.Thread(target=server.serve_forever, daemon=True).start()
try:
    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=True, executable_path=shutil.which('chromium'))
        page = browser.new_page()
        origin = f'http://127.0.0.1:{server.server_port}'
        page.goto(origin)
        result = page.evaluate('''async origin => {
          const source = `import {MemberExecutionClient, MemberReportStore} from '${origin}/src/member-execution-client.js';
            const credentials = {owner_key:'MEMBER:1',executor_id:'22222222-2222-4222-8222-222222222222',access_token:'synthetic-only'};
            onmessage = async event => {
              try {
                const store = new MemberReportStore();
                const client = new MemberExecutionClient({baseUrl:'${origin}/api/v1',store,getCredentials:async()=>credentials,
                  now:()=>Date.now() + (event.data.first ? 0 : 31000)});
                if (event.data.first) await client.enqueue({report_id:'99999999-9999-4999-8999-999999999999',
                  command_id:'88888888-8888-4888-8888-888888888888',session_id:'33333333-3333-4333-8333-333333333333',
                  executor_id:credentials.executor_id,desired_revision:1,result:'RELEASED',observed_at:new Date().toISOString(),intervals:[]});
                await client.flush();
                const rows = await store.list(credentials.owner_key, credentials.executor_id);
                postMessage({status:rows[0].status,ack:rows[0].ack,credentialStored:JSON.stringify(rows).includes('synthetic-only')});
              } catch(error) {postMessage({error:error.name + ':' + error.message});}
            };`;
          const url = URL.createObjectURL(new Blob([source], {type:'text/javascript'}));
          const run = first => new Promise((resolve,reject) => {
            const worker = new Worker(url, {type:'module'});
            const timer = setTimeout(()=>{worker.terminate();reject(new Error('Worker test timed out'));},15000);
            worker.onmessage = event => {clearTimeout(timer);worker.terminate();resolve(event.data);};
            worker.onerror = ()=>{clearTimeout(timer);worker.terminate();reject(new Error('Worker module failed'));};
            worker.postMessage({first});
          });
          const first = await run(true), second = await run(false);
          URL.revokeObjectURL(url); return {first,second};
        }''', origin)
        assert result['first']['status'] == 'RESPONSE_UNCONFIRMED', result
        assert result['second']['status'] == 'ACKED', result
        assert result['second']['ack'] == {'result': 'DUPLICATE', 'desired_revision': 2}, result
        assert not result['first']['credentialStored'] and not result['second']['credentialStored']
        assert len(bodies) == 2 and bodies[0] == bodies[1]
        print('PASS: native Chromium Worker + real IndexedDB; recreated Worker retries identical report, no stored credentials')
        browser.close()
finally:
    server.shutdown()
