// Optional native IndexedDB/Web Lock probe. DNR and authority are SYNTHETIC.
// No product Worker, Chrome START or actual rule writes.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=new URL('../../',import.meta.url);

test('native IDB transaction fences DNR and same-length evidence changes under Web Lock',async()=>{
  const browser=await chromium.launch({headless:true,...(process.env.CHROME_EXECUTABLE?{executablePath:process.env.CHROME_EXECUTABLE}:{})});
  try{
    const page=await browser.newPage();
    await page.route('**/*',async route=>{
      const path=new URL(route.request().url()).pathname;
      if(/^\/(extension\/(src|a1|member-a1)\/[a-z-]+\.(js|mjs|json)|contracts\/additional-mvp\/rc1\/schema\.json)$/.test(path))
        return route.fulfill({contentType:path.endsWith('.json')?'application/json':'text/javascript',body:await readFile(fileURLToPath(new URL(path.slice(1),root)),'utf8')});
      return route.fulfill({contentType:'text/html',body:'<!doctype html><title>Isolated evidence CAS</title>'});
    });
    await page.goto('https://focurve.test/');
    const result=await page.evaluate(async()=>{
      const [{createMemberDB},{digest},{AdditionalDnrStore},{AdditionalDnrCoordinator},{SiteTimeDnrEvidence}]=await Promise.all([
        import('/extension/member-a1/db.mjs'),import('/extension/a1/contract.mjs'),import('/extension/src/additional-dnr-store.js'),
        import('/extension/src/additional-dnr-coordinator.js'),import('/extension/src/additional-dnr-site-time-evidence.js')]);
      const base=createMemberDB(indexedDB,'evidence-cas'),key='amvp_journal_v1:site-time-dnr-evidence';let beforeWrite=null,writes=0;
      const db={async transaction(mode,work){if(mode==='readwrite'&&beforeWrite){const fn=beforeWrite;beforeWrite=null;await fn();}return base.transaction(mode,work);}};
      const store=new AdditionalDnrStore(db),rawStore=new AdditionalDnrStore(base);
      const dnr={getSessionRules:async()=>[],getDynamicRules:async()=>[],updateSessionRules:async()=>{writes++;},updateDynamicRules:async()=>{writes++;}};
      const coordinator=new AdditionalDnrCoordinator({store,dnr,assertWritersGuarded:()=>true});
      const epoch=await coordinator.startWriter(),id=()=>crypto.randomUUID();
      const context={operation_id:id(),owner_binding_id:id(),executor_id:id(),runtime_execution_id:id(),package_id:id(),runtime_revision:1,generation:1};
      const input={context,policy:{kind:'SITE_TIME',policy_id:id(),version:1,site_id:null,scope:{host:'example.org',include_subdomains:true},enabled:true,tracking_scope:'BROWSER_ALWAYS',daily_limit_ms:60000,windows:[]},
        claims:[{claim_id:id(),owner_binding_id:context.owner_binding_id,generation:1,writer_epoch:epoch,rule_key:{rule_store:'SESSION',rule_id:100000},rule_sha256:await digest({synthetic:true}),restore_state:'RESERVED'}]};
      const service=new SiteTimeDnrEvidence({coordinator,verifyBinding:()=>true});
      const read=()=>base.transaction('readonly',(tx,done)=>{const r=tx.objectStore('metadata').get(key);r.onsuccess=()=>done(r.result??null);});
      beforeWrite=()=>rawStore.mutate(s=>{s.writer_epoch++;});let rootRejected=false;
      try{await service.register(input);}catch(error){rootRejected=error.message==='SITE_TIME_EVIDENCE_STATE_CHANGED';}
      const noRegistration=await read()===null;
      input.claims[0].writer_epoch=(await rawStore.read()).writer_epoch;await service.register(input);
      let changed;
      beforeWrite=async()=>{
        changed=await read();const entry=changed.entries[0];entry.intent.policy.daily_limit_ms=120000;
        entry.intent_sha256=await digest(entry.intent);const {entry_sha256,...payload}=entry;entry.entry_sha256=await digest(payload);
        await base.transaction('readwrite',(tx,done)=>{tx.objectStore('metadata').put(changed);done();});
      };
      let evidenceRejected=false;
      try{await service.register({...input,context:{...context,operation_id:id()}});}catch(error){evidenceRejected=error.message==='SITE_TIME_EVIDENCE_STATE_CHANGED';}
      return {rootRejected,noRegistration,evidenceRejected,preserved:JSON.stringify(await read())===JSON.stringify(changed),
        rootEpoch:(await rawStore.read()).writer_epoch,writes};
    });
    assert.deepEqual(result,{rootRejected:true,noRegistration:true,evidenceRejected:true,preserved:true,rootEpoch:2,writes:0});
  }finally{await browser.close();}
});
