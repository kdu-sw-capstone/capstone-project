"""Real Chromium Worker/IndexedDB; synthetic HTTP, not MV3/Server integration."""
from pathlib import Path
import http.server
import json
import shutil
import threading
from playwright.sync_api import sync_playwright

root = Path(__file__).resolve().parents[2]
calls = []
mode = 'accepted'


class Handler(http.server.BaseHTTPRequestHandler):
    def log_message(self, *args):
        pass

    def do_GET(self):
        if self.path in ['/background/host-policy.js', '/background/member-events.js']:
            body = (root / self.path.lstrip('/')).read_bytes()
            content_type = 'text/javascript'
        else:
            body, content_type = b'<!doctype html><title>Event recovery</title>', 'text/html'
        self.send_response(200)
        self.send_header('Content-Type', content_type)
        self.end_headers()
        self.wfile.write(body)

    def do_POST(self):
        body = json.loads(self.rfile.read(int(self.headers['Content-Length'])))
        calls.append((self.path, body))
        if len(calls) == 1:
            # The request reached the endpoint; its response is lost.
            self.close_connection = True
            return
        lookup = self.path.endswith('/status')
        ids = body['event_ids'] if lookup else [e['event_id'] for e in body['events']]
        status = ('ACCEPTED' if mode == 'accepted' else 'NOT_RECEIVED') if lookup else 'ACCEPTED'
        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self.end_headers()
        self.wfile.write(json.dumps({'items': [dict(event_id=i, status=status) for i in ids]}).encode())


server = http.server.ThreadingHTTPServer(('127.0.0.1', 0), Handler)
threading.Thread(target=server.serve_forever, daemon=True).start()
try:
    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=True, executable_path=shutil.which('chromium'))
        try:
            for mode in ['accepted', 'not_received']:
                calls.clear()
                # Isolated browser storage for each scenario.
                context = browser.new_context()
                try:
                    page = context.new_page()
                    origin = f'http://127.0.0.1:{server.server_port}'
                    page.goto(origin)
                    result = page.evaluate('''async origin => {
                      const source = `importScripts('${origin}/background/host-policy.js', '${origin}/background/member-events.js');
                        onmessage = async message => {
                          try {
                            const {MemberEventStore, MemberEventDelivery} = FocurveMemberEvents;
                            const credentials = {owner_key:'MEMBER:1',executor_id:'22222222-2222-4222-8222-222222222222',access_token:'synthetic-only'};
                            const store = new MemberEventStore();
                            const delivery = new MemberEventDelivery({baseUrl:'${origin}/api/v1',store,
                              getCredentials:async()=>credentials,random:()=>0,
                              now:()=>Date.now()+(message.data.first?0:40000)});
                            if(message.data.first) await delivery.enqueue({schema_version:'1.2',
                              event_id:'11111111-1111-4111-8111-111111111111',executor_id:credentials.executor_id,
                              session_id:'33333333-3333-4333-8333-333333333333',
                              policy_snapshot_id:'44444444-4444-4444-8444-444444444444',
                              event_type:'RECORDED_ACCESS',occurred_at:'2026-10-10T00:00:00Z',local_seq:1,
                              payload:{access_seq:1,navigation_id:'55555555-5555-4555-8555-555555555555',
                                target_kind:'SITE',target_host:'example.org',target_key:'example.org',
                                matched_policy_host:'example.org',reason:'RECORD',blocked_reasons:[]}});
                            await delivery.flush();
                            postMessage(await store.list(credentials.owner_key,credentials.executor_id));
                          } catch(error) {postMessage({error:error.message});}
                        };`;
                      const url=URL.createObjectURL(new Blob([source],{type:'text/javascript'}));
                      const run=first=>new Promise((resolve,reject)=>{
                        const worker=new Worker(url);
                        const timer=setTimeout(()=>{worker.terminate();reject(new Error('Worker timed out'));},15000);
                        worker.onmessage=e=>{clearTimeout(timer);worker.terminate();resolve(e.data);};
                        worker.onerror=()=>{clearTimeout(timer);worker.terminate();reject(new Error('Worker failed'));};
                        worker.postMessage({first});
                      });
                      try {return {first:await run(true),second:await run(false)};}
                      finally {URL.revokeObjectURL(url);}
                    }''', origin)
                    assert isinstance(result['first'], list) and isinstance(result['second'], list), result
                    first, second = result['first'][0], result['second'][0]
                    assert first['status'] == 'RESPONSE_UNCONFIRMED', first['status']
                    assert second['status'] == 'ACKED', second['status']
                    assert first['event_id'] == second['event_id'] and first['body'] == second['body']
                    assert 'synthetic-only' not in json.dumps(result)
                    expected = ['/api/v1/events/batch', '/api/v1/events/status']
                    if mode == 'not_received':
                        expected.append('/api/v1/events/batch')
                        assert calls[0][1] == calls[2][1], 'retry changed event payload'
                    assert [path for path, _ in calls] == expected
                    assert calls[1][1]['event_ids'] == [first['event_id']]
                    print(f'PASS: {mode}: recreated Worker, status first, immutable event, no stored token')
                finally:
                    context.close()
        finally:
            browser.close()
finally:
    server.shutdown()
    server.server_close()
