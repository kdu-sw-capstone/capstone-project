"""Native Chromium Worker + IndexedDB restart probe; Chrome document observations are synthetic."""
from pathlib import Path
import http.server
import threading
import shutil
from playwright.sync_api import sync_playwright

source = Path(__file__).resolve().parents[2] / 'src' / 'document-control-registry.js'
class Handler(http.server.BaseHTTPRequestHandler):
    def log_message(self, *args):
        pass
    def do_GET(self):
        script = self.path == '/registry.js'
        body = source.read_bytes() if script else b'<!doctype html><title>Registry probe</title>'
        self.send_response(200)
        self.send_header('Content-Type', 'text/javascript' if script else 'text/html')
        self.end_headers()
        self.wfile.write(body)

server = http.server.ThreadingHTTPServer(('127.0.0.1', 0), Handler)
threading.Thread(target=server.serve_forever, daemon=True).start()
try:
    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=True, executable_path=shutil.which('chromium'))
        page = browser.new_page()
        page.goto(f'http://127.0.0.1:{server.server_port}')
        result = page.evaluate('''async () => {
          const moduleUrl = location.origin + '/registry.js';
          const ref = {executorKey:'executor-1',tab:7,frame:0,documentKey:'document-a'};
          const scope = {ownerKey:'GUEST:executor-1',sessionKey:'session-1',snapshotKey:'snapshot-1',revision:1,bindingKey:'binding-1'};
          const source = `import {DocumentControlRegistry} from '${moduleUrl}';
            const registry = new DocumentControlRegistry();
            onmessage = async ({data}) => {
              try { postMessage({ok:true,value:await registry[data.method](...data.args)}); }
              catch (error) { postMessage({ok:false,error:error.message}); }
            };`;
          const blob = URL.createObjectURL(new Blob([source], {type:'text/javascript'}));
          const make = () => new Worker(blob, {type:'module'});
          const call = (worker, method, ...args) => new Promise((resolve,reject) => {
            worker.onmessage = ({data}) => resolve(data);
            worker.onerror = event => reject(new Error(event.message));
            worker.postMessage({method,args});
          });
          const expect = (condition, message) => {if (!condition) throw new Error(message);};
          let worker = make();
          expect((await call(worker,'observe',ref)).ok,'observe failed');
          const staged = await call(worker,'stage',ref,{operationKey:'apply-1',action:'APPLY',controlScope:scope});
          expect(staged.ok,'stage failed'); worker.terminate();
          worker = make();
          const pending = await call(worker,'pending','executor-1');
          expect(pending.ok && pending.value[0].operations[0].ticket.sequence===1,'durable ticket lost');
          expect(pending.value[0].obligations[0].state==='UNCONFIRMED','false applied');
          const noRecheck = await call(worker,'complete',staged.value.ticket,'CONFIRMED');
          expect(!noRecheck.ok && noRecheck.error==='DOCUMENT_RECHECK_REQUIRED','recovery guard absent');
          expect((await call(worker,'observe',{...ref,documentKey:'document-b'})).ok,'replacement failed');
          const old = await call(worker,'complete',staged.value.ticket,'CONFIRMED');
          expect(!old.ok,'stale result accepted');
          const release = await call(worker,'stage',ref,{operationKey:'release-1',action:'RELEASE',controlScope:scope});
          expect(release.ok && release.value.ticket.sequence===2,'cleanup ticket missing');
          expect((await call(worker,'complete',release.value.ticket,'FAILED')).ok,'cleanup failure lost');
          worker.terminate(); worker=make();
          const rows = await call(worker,'pending','executor-1');
          expect(rows.value[0].obligations[0].state==='CLEANUP_UNCONFIRMED','cleanup obligation lost');
          const retry = await call(worker,'stage',ref,{operationKey:'release-2',action:'RELEASE',controlScope:scope});
          expect((await call(worker,'complete',retry.value.ticket,'CONFIRMED')).ok,'cleanup retry failed');
          expect((await call(worker,'pending','executor-1')).value.length===0,'restored obligation pending');
          worker.terminate(); URL.revokeObjectURL(blob);
          return {restart:true,staleRejected:true,cleanupRetry:true};
        }''')
        assert result == {'restart': True, 'staleRejected': True, 'cleanupRetry': True}, result
        print('PASS: native IndexedDB across terminated/recreated Workers; stale rejection; cleanup failure/retry')
        browser.close()
finally:
    server.shutdown()
    server.server_close()
