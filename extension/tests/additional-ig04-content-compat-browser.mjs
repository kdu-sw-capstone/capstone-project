import {createRequire} from 'node:module';
import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {execFileSync} from 'node:child_process';
const require = createRequire(import.meta.url);
const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const coreRoot = fileURLToPath(new URL('../../', import.meta.url));
if (!process.env.IG04_CONTENT_ROOT) throw Error('IG04_CONTENT_ROOT_REQUIRED');
const contentRoot = resolve(process.env.IG04_CONTENT_ROOT);
const expectedContent = '8f454c937c905ed7ad4e0650274e27b2830812ea';
assert.equal(execFileSync('git', ['rev-parse', 'HEAD'], {cwd: contentRoot, encoding: 'utf8'}).trim(), expectedContent);
assert.equal(execFileSync('git', ['status', '--porcelain', '--', 'extension/content'], {cwd: contentRoot, encoding: 'utf8'}).trim(), '');
const browser = await chromium.launch({headless: true, ...(process.env.CHROME_EXECUTABLE ? {executablePath: process.env.CHROME_EXECUTABLE} : {})});
try {
  const page = await browser.newPage();
  await page.route('**/*', async route => {
    const path = new URL(route.request().url()).pathname;
    if (path.startsWith('/core/')) {
      const file = resolve(coreRoot, path.slice(6));
      await route.fulfill({contentType: path.endsWith('.json') ? 'application/json' : 'text/javascript', body: await readFile(file)});
    } else if (/^\/content\/[a-z-]+\.mjs$/.test(path)) {
      await route.fulfill({contentType: 'text/javascript', body: await readFile(resolve(contentRoot, 'extension' + path))});
    } else await route.fulfill({contentType: 'text/html', body: '<!doctype html><main><article><ul><li id="comment" style="display:grid!important"><a href="/p/sample/c/1/">time</a><span>comment</span></li></ul></article></main>'});
  });
  await page.goto('https://www.instagram.com/p/sample/');
  await page.evaluate(async () => {
    const {IG04PlanAdmission} = await import('/core/extension/src/additional-ig04-admission.js');
    const {DocumentControlRegistry} = await import('/core/extension/src/document-control-registry.js');
    const {ContentSessionAdapter} = await import('/content/session-adapter.mjs');
    const id = () => crypto.randomUUID();
    const context = {scope: {owner_binding_id:id(),owner_epoch:1,executor_id:id(),runtime_execution_id:id(),
      package_id:id(),runtime_revision:1,binding_id:id(),scope_epoch:id(),generation:1,tab_id:1,frame_id:0,
      document_id:'synthetic-document',document_instance_id:id(),url_sha256:'a'.repeat(64),focus_ref:null},operation_id:id(),semantic_sha256:'b'.repeat(64)};
    window.current = true;
    const registry = new DocumentControlRegistry({name:'ig04-compat'});
    const ref = {executorKey:context.scope.executor_id,tab:1,frame:0,documentKey:context.scope.document_id};
    await registry.observe(ref);
    const admission = await IG04PlanAdmission.open({context,registry,isCurrent:()=>window.current,
      verifyIssued:()=>true,verifyNative:()=>true,expiresAt:Date.now()+60000});
    window.registry = registry; window.ref = ref;
    window.adapter = new ContentSessionAdapter(document,{owner_binding_id:context.scope.owner_binding_id,
      binding_id:context.scope.binding_id,features:[{feature_id:'IG-04',enabled:true,required:true}],
      isCurrent:()=>admission.verifyContext(context),ig04Reservation:{context,
        getGeneration:()=>admission.getGeneration(),verifyContext:c=>admission.verifyContext(c),
        reserve:async plan=>{
          try {window.admitted=await admission.verifyPlan(plan);}
          catch(error){window.admissionError=error.message;throw error;}
          // Admission supplies no durable ACK. Keep Content pending and effects zero.
          return new Promise(()=>{});
        }}});
    adapter.start();
  });
  await page.waitForFunction(() => window.admitted || window.admissionError);
  const result = await page.evaluate(async () => ({error:window.admissionError??null,
    identity:window.admitted?.reservation_identity??null,hidden:document.querySelector('#comment').inert,
    operations:(await registry.load(ref)).operations.length,pending:(await adapter.evidenceSnapshot()).gate.reservations.length}));
  assert.equal(result.error,null); assert.ok(result.identity?.context_sha256);
  assert.equal(result.hidden,false); assert.equal(result.operations,0); assert.equal(result.pending,1);
  await page.evaluate(()=>{window.current=false;adapter.release();});
  assert.equal(await page.evaluate(()=>adapter.inspect().cleanup_pending),true);
  console.log('PASS 1/1: actual Content 8f454c93 plan admitted; browser IndexedDB remains unchanged; no ACK/effect; cleanup debt retained. Mock issued/native providers; not product acceptance.');
} finally {await browser.close();}
