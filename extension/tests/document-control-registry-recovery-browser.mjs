// Optional native IndexedDB probe. Lifecycle/effect/native references synthetic.
// No product Worker, MV3 permissions, DNR or DOM effects.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFile} from 'node:fs/promises';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
test('native IDB recovery rejects orphan obligations and foreign slots without modifying original state',async()=>{
  const browser=await chromium.launch({headless:true,...(process.env.CHROME_EXECUTABLE?{executablePath:process.env.CHROME_EXECUTABLE}:{})});
  try{
    const page=await browser.newPage();
    const source=await readFile(new URL('../src/document-control-registry.js',import.meta.url),'utf8');
    await page.route('**/*',route=>route.fulfill({contentType:route.request().url().endsWith('/registry.js')?'text/javascript':'text/html',
      body:route.request().url().endsWith('/registry.js')?source:'<!doctype html><title>Registry recovery</title>'}));
    await page.goto('https://focurve.test/');
    const result=await page.evaluate(async()=>{
      const {DocumentControlRegistry}=await import('/registry.js');
      const ref={executorKey:'executor-a',tab:7,frame:0,documentKey:'doc-a'};
      const scope={ownerKey:'GUEST:executor-a',sessionKey:'session-a',snapshotKey:'snapshot-a',revision:1,bindingKey:'binding-a'};
      const key=r=>[r.executorKey,r.tab,r.frame,r.documentKey];
      const registry=new DocumentControlRegistry({name:'corrupt-obligation'});
      await registry.observe(ref);await registry.stage(ref,{operationKey:'apply-a',action:'APPLY',controlScope:scope});
      const raw=()=>registry.transaction('readonly',(docs,_slots,done)=>{const r=docs.get(key(ref));r.onsuccess=()=>done(r.result);});
      await registry.transaction('readwrite',(docs,_slots,done)=>{const r=docs.get(key(ref));r.onsuccess=()=>{r.result.obligations=[];docs.put(r.result);done();};});
      const before=await raw();let debtRejected=false;
      try{await new DocumentControlRegistry({name:'corrupt-obligation'}).pending(ref.executorKey);}catch(e){debtRejected=e.message==='INVALID_DOCUMENT_REGISTRY';}
      const originalPreserved=JSON.stringify(await raw())===JSON.stringify(before);
      const otherRegistry=new DocumentControlRegistry({name:'corrupt-slot'}),foreign={...ref,executorKey:'executor-b',documentKey:'doc-b'};
      await otherRegistry.observe(ref);await otherRegistry.observe(foreign);const foreignBefore=await otherRegistry.load(foreign);
      await otherRegistry.transaction('readwrite',(_docs,slots,done)=>{slots.put({key:[ref.executorKey,ref.tab,ref.frame],documentKey:key(foreign)});done();});
      let slotRejected=false;
      try{await new DocumentControlRegistry({name:'corrupt-slot'}).observe({...ref,documentKey:'new-doc'});}catch(e){slotRejected=e.message==='INVALID_DOCUMENT_REGISTRY';}
      const foreignPreserved=JSON.stringify(await otherRegistry.load(foreign))===JSON.stringify(foreignBefore);
      return {debtRejected,originalPreserved,slotRejected,foreignPreserved};
    });
    assert.deepEqual(result,{debtRejected:true,originalPreserved:true,slotRejected:true,foreignPreserved:true});
  }finally{await browser.close();}
});
