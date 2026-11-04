// Optional real browser persistence/locking test. DNR and identity are SYNTHETIC.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=fileURLToPath(new URL('../../',import.meta.url));
for(const actor of ['member-a1','a1'])test(`${actor}: real IndexedDB releases final state snapshot before a pending DNR response; END can commit`,async()=>{
 const browser=await chromium.launch({headless:true,...(process.env.CHROME_EXECUTABLE?{executablePath:process.env.CHROME_EXECUTABLE}:{})});
 try{
  const page=await browser.newPage();await page.route('**/*',async route=>{
   const path=new URL(route.request().url()).pathname;
   if(/^\/(extension\/(src|a1|member-a1|execution)\/[a-z0-9-]+\.(js|mjs|json)|contracts\/additional-mvp\/rc1\/schema\.json)$/.test(path))return route.fulfill({contentType:path.endsWith('.json')?'application/json':'text/javascript',body:await readFile(join(root,path.slice(1)),'utf8')});
   return route.fulfill({contentType:'text/html',body:'<!doctype html><title>Core writer DB test</title>'});
  });await page.goto('https://focurve.test/');
  const result=await page.evaluate(async actor=>{
   const [{A1Core},{createMemberDB},{AdditionalDnrStore},{LegacyDnrWriter},{VERSION}]=await Promise.all([
    import('/extension/'+actor+'/core.mjs'),import('/extension/member-a1/db.mjs'),import('/extension/src/additional-dnr-store.js'),import('/extension/src/additional-dnr-legacy-writer.js'),import('/extension/'+actor+'/contract.mjs')]);
   const db=createMemberDB(indexedDB,'member-state'),root=createMemberDB(indexedDB,'runtime-state'),sid=crypto.randomUUID(),owner='MEMBER:1',epoch=crypto.randomUUID();
   const rule={id:100000,priority:1,action:{type:'block'},condition:{urlFilter:'||example.test^'}};
   const session={owner_key:owner,session_id:sid,executor_id:crypto.randomUUID(),snapshot:{source_version:1},started_at:'2026-10-31T00:00:00.000Z'};
   const journal={owner_key:owner,session_id:sid,desired:'APPLIED',rules:[rule]},a={key:'a1:aggregate:'+sid,session_id:sid,owner_context:owner,executor_id:session.executor_id,record_version:crypto.randomUUID(),intent:'RUN',session_status:'RUNNING'};
   await db.transaction('readwrite',(tx,done)=>{const md=tx.objectStore('metadata');md.put({key:'current',owner_key:owner,session_id:sid,execution_contract:VERSION});md.put(a);md.put({key:'a1:owner-fence',owner_context:owner,epoch,transitioning:false});tx.objectStore('sessions').put(session);tx.objectStore('journal').put(journal);done(null);});
   let invoked,release;const entered=new Promise(r=>{invoked=r;}),pendingChrome=new Promise(r=>{release=r;});
   const dnr={getSessionRules:async()=>[rule],updateSessionRules:()=>{invoked();return pendingChrome;}};
   const writer=new LegacyDnrWriter({store:new AdditionalDnrStore(root),dnr,locks:navigator.locks});
   const core={env:{db,dnrWriter:(r,send)=>writer.write('SESSION',r,send)},chrome:{declarativeNetRequest:dnr},bundle:async()=>({a,state:{session,journal},ownerFenceEpoch:epoch})};
   const write=A1Core.prototype.guardedDnrUpdate.call(core,{session,journal},{removeRuleIds:[rule.id]});await entered;
   let timer;try{await Promise.race([db.transaction('readwrite',(tx,done)=>{tx.objectStore('metadata').put({...a,intent:'END'});done(null);}),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('DB_HELD_BY_NATIVE_PROMISE')),1000);})]);}finally{clearTimeout(timer);release();}
   await write;return db.transaction('readonly',(tx,done)=>{const q=tx.objectStore('metadata').get(a.key);q.onsuccess=()=>done(q.result.intent);});
  },actor);assert.equal(result,'END');
 }finally{await browser.close();}
});
