"""Native Worker/IndexedDB failure injection; no MV3, actual quota exhaustion or Server."""
from pathlib import Path
import http.server
import json
import shutil
import threading
from playwright.sync_api import sync_playwright

root = Path(__file__).resolve().parents[2]


class Handler(http.server.BaseHTTPRequestHandler):
    def log_message(self, *args):
        pass

    def do_GET(self):
        path = (root / self.path.lstrip('/')).resolve()
        if path.is_relative_to(root) and path.suffix == '.js' and path.is_file():
            body, content_type = path.read_bytes(), 'text/javascript'
        else:
            body, content_type = b'<!doctype html><title>Access storage recovery</title>', 'text/html'
        self.send_response(200)
        self.send_header('Content-Type', content_type)
        self.end_headers()
        self.wfile.write(body)


server = http.server.ThreadingHTTPServer(('127.0.0.1', 0), Handler)
threading.Thread(target=server.serve_forever, daemon=True).start()
try:
    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=True, executable_path=shutil.which('chromium'))
        try:
            page = browser.new_page()
            origin = f'http://127.0.0.1:{server.server_port}'
            page.goto(origin)
            result = page.evaluate('''async origin => {
              const source = `import {MemberAccessStore,MemberAccessCollector} from '${origin}/src/member-access.js';
                onmessage=async message=>{
                  try {
                    const store=new MemberAccessStore();
                    const at=Date.parse('2026-10-10T00:00:01Z');
                    const context={owner_key:'MEMBER:1',executor_id:'22222222-2222-4222-8222-222222222222',
                      base_url:'http://localhost/api/v1',session_id:'33333333-3333-4333-8333-333333333333',revision:1,
                      applied_at:'2026-10-10T00:00:00Z',snapshot:{policy_snapshot_id:'44444444-4444-4444-8444-444444444444',
                        sites:[{canonical_host:'example.org',include_subdomains:true,access_policy:'RECORD'}]}};
                    const collector=new MemberAccessCollector({store,getContext:async()=>context,
                      blockedPageUrl:'chrome-extension://synthetic/blocked/blocked.html'});
                    const details={url:'https://example.org/private?secret=excluded',tabId:1,frameId:0,
                      timeStamp:at,observed_at:at,transitionType:'typed',transitionQualifiers:[],documentLifecycle:'active'};
                    let closedError,abortError,draft;
                    if(message.data.first){
                      await collector.observe('before',details);await collector.observe('commit',details);
                      await collector.observe('before',details);draft=await store.pending(1);
                      let fail=true;
                      store.indexedDB={open(...args){const request=indexedDB.open(...args);
                        request.addEventListener('success',()=>{if(fail){fail=false;request.result.close();}});return request;}};
                      try{await collector.observe('commit',details);}catch(e){closedError=e.message;}
                      store.indexedDB=indexedDB;
                      const nativeAdd=IDBObjectStore.prototype.add;
                      IDBObjectStore.prototype.add=function(...args){
                        const request=nativeAdd.apply(this,args);
                        if(this.name==='originals')request.addEventListener('success',()=>this.transaction.abort());return request;
                      };
                      try{await collector.observe('commit',details);}catch(e){abortError=e.message;}
                      finally{IDBObjectStore.prototype.add=nativeAdd;}
                    }else{
                      draft=await store.pending(1);await collector.observe('commit',details);
                    }
                    postMessage({closedError,abortError,draft,pending:await store.pending(1),
                      originals:await store.originals(context.owner_key,context.executor_id,context.base_url)});
                  }catch(error){postMessage({error:error.message});}
                };`;
              const url=URL.createObjectURL(new Blob([source],{type:'text/javascript'}));
              const run=first=>new Promise((resolve,reject)=>{
                const worker=new Worker(url,{type:'module'});
                const timer=setTimeout(()=>{worker.terminate();reject(new Error('Worker timed out'));},15000);
                worker.onmessage=e=>{clearTimeout(timer);worker.terminate();resolve(e.data);};
                worker.onerror=e=>{clearTimeout(timer);worker.terminate();reject(new Error('Worker failed: '+e.message));};
                worker.postMessage({first});
              });
              try{return {first:await run(true),second:await run(false)};}
              finally{URL.revokeObjectURL(url);}
            }''', origin)
            first, second = result['first'], result['second']
            assert 'error' not in first and 'error' not in second, result
            assert first['closedError'] == first['abortError'] == 'ACCESS_STORAGE_UNAVAILABLE'
            assert first['pending'] == first['draft'] == second['draft']
            assert len(first['originals']) == 1 and len(second['originals']) == 2
            assert first['originals'][0] in second['originals'], 'previous original changed'
            recovered = next(row for row in second['originals'] if row['event_id'] == first['draft']['event_id'])
            event = json.loads(recovered['body'])
            assert event['local_seq'] == event['payload']['access_seq'] == 2
            assert second['pending'] is None
            assert all('/private' not in row['body'] and 'secret=' not in row['body'] for row in second['originals'])
            print('PASS: native closed connection and aborted write preserve draft, old original and sequences across Worker recreation')
        finally:
            browser.close()
finally:
    server.shutdown()
    server.server_close()
