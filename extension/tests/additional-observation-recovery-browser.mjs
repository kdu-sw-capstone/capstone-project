// Optional native IndexedDB probe. No extension Worker, usage clock or policy START.
// PLAYWRIGHT_MODULE and CHROME_EXECUTABLE use existing installations.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=new URL('../../',import.meta.url);

test('native IndexedDB rejects changed journal without overwriting evidence or other metadata',async()=>{
  const browser=await chromium.launch({headless:true,...(process.env.CHROME_EXECUTABLE?{executablePath:process.env.CHROME_EXECUTABLE}:{})});
  try{
    const page=await browser.newPage();
    await page.route('**/*',async route=>{
      const path=new URL(route.request().url()).pathname;
      if(/^\/extension\/(src|a1|member-a1)\/[a-z-]+\.(js|mjs|json)$/.test(path))
        return route.fulfill({contentType:path.endsWith('.json')?'application/json':'text/javascript',body:await readFile(fileURLToPath(new URL(path.slice(1),root)),'utf8')});
      return route.fulfill({contentType:'text/html',body:'<!doctype html><title>Isolated journal recovery</title>'});
    });
    await page.goto('https://focurve.test/');
    const result=await page.evaluate(async()=>{
      const [{createMemberDB},{AdditionalObservationJournal}]=await Promise.all([
        import('/extension/member-a1/db.mjs'),import('/extension/src/additional-observation-journal.js')]);
      const db=createMemberDB(indexedDB,'recovery-probe'),key='amvp_journal_v1:time-observations';
      const context=()=>({bootId:crypto.randomUUID(),executorId:crypto.randomUUID(),ownerBindingId:crypto.randomUUID()});
      const raw=()=>db.transaction('readonly',(tx,done)=>{const r=tx.objectStore('metadata').get(key);r.onsuccess=()=>done(r.result);});
      const journal=new AdditionalObservationJournal(db),epoch=await journal.start(context());
      await journal.append(epoch,crypto.randomUUID(),{revision:1,observedMonoMs:50,status:'UNKNOWN',reason:'PROBE',
        collectionEligible:false,requiresLimitedSiteHold:true,priorTailRequiresValidation:true,target:null});
      const valid=await journal.recover();
      const changed=structuredClone(valid);changed.context=context();
      await db.transaction('readwrite',(tx,done)=>{const store=tx.objectStore('metadata');store.put(changed);store.put({key:'probe-canary',value:'keep'});done();});
      const rejected=[];
      for(const run of [()=>journal.recover(),()=>journal.start(context())]){
        try{await run();rejected.push(false);}catch{rejected.push(true);}
      }
      const canary=await db.transaction('readonly',(tx,done)=>{const r=tx.objectStore('metadata').get('probe-canary');r.onsuccess=()=>done(r.result);});
      return {rejected,preserved:JSON.stringify(await raw())===JSON.stringify(changed),canary:canary.value,
        originalRows:valid.captures.length,obligations:valid.obligations.length};
    });
    assert.deepEqual(result,{rejected:[true,true],preserved:true,canary:'keep',originalRows:1,obligations:1});
  }finally{await browser.close();}
});
