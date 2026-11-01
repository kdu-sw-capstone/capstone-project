// Real browser IndexedDB only; owner/effect verification is SYNTHETIC.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=fileURLToPath(new URL('../../',import.meta.url));
test('native IndexedDB keeps producer epoch/sequence and body across new connections',async()=>{
 const browser=await chromium.launch({headless:true,...(process.env.CHROME_EXECUTABLE?{executablePath:process.env.CHROME_EXECUTABLE}:{})});
 try{
  const page=await browser.newPage();await page.route('**/*',async route=>{
   const path=new URL(route.request().url()).pathname;
   if(/^\/(extension\/(src|a1|member-a1)\/[a-z0-9-]+\.(js|mjs|json)|contracts\/additional-mvp\/rc1\/schema\.json)$/.test(path))return route.fulfill({contentType:path.endsWith('.json')?'application/json':'text/javascript',body:await readFile(join(root,path.slice(1)),'utf8')});
   return route.fulfill({contentType:'text/html',body:'<!doctype html><title>Producer persistence</title>'});
  });await page.goto('https://focurve.test/');
  const result=await page.evaluate(async()=>{
   const [{RuntimeReportProducer},{createMemberDB}]=await Promise.all([import('/extension/src/additional-runtime-report-producer.js'),import('/extension/member-a1/db.mjs')]);
   const owner={owner_binding_id:crypto.randomUUID(),executor_id:crypto.randomUUID(),runtime_execution_id:crypto.randomUUID()},config={authorizeScope:async s=>Object.entries(owner).every(([k,v])=>s[k]===v)&&s.generation===1,verifyEvidence:async()=>true};
   const input={generation:1,report:{report_id:crypto.randomUUID(),...owner,operation_id:crypto.randomUUID(),package_id:crypto.randomUUID(),runtime_revision:1,state:'UNKNOWN',reason:'ERROR',evidence_sha256:'a'.repeat(64),observed_at:'2026-11-01T00:00:00.000Z'}};
   const db=createMemberDB(indexedDB,'producer-browser');await db.transaction('readwrite',(tx,done)=>{tx.objectStore('metadata').put({key:'cleanup:unrelated',pending:true});done(null);});
   const one=await new RuntimeReportProducer(db,config).produce(input),again=new RuntimeReportProducer(createMemberDB(indexedDB,'producer-browser'),config),replay=await again.produce(input);
   const two=await again.produce({...input,report:{...input.report,report_id:crypto.randomUUID()}}),state=await again.recover();
   const cleanup=await db.transaction('readonly',(tx,done)=>{const q=tx.objectStore('metadata').get('cleanup:unrelated');q.onsuccess=()=>done(q.result);});
   return {same:JSON.stringify(one)===JSON.stringify(replay),epoch:one.report_epoch===two.report_epoch,seq:[one.report_seq,two.report_seq],rows:state.rows.length,cursor:state.streams[0].last_seq,cleanup};
  });assert.deepEqual(result,{same:true,epoch:true,seq:[1,2],rows:2,cursor:2,cleanup:{key:'cleanup:unrelated',pending:true}});
 }finally{await browser.close();}
});
