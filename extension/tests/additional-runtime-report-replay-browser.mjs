// Actual Chromium IndexedDB + actual PR76/78 modules. Authority/effect/ACK are SYNTHETIC.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=fileURLToPath(new URL('../../',import.meta.url));
test('native IndexedDB handoff resumes lost admission reply and preserves source/cleanup after ACK',async()=>{
 const browser=await chromium.launch({headless:true,...(process.env.CHROME_EXECUTABLE?{executablePath:process.env.CHROME_EXECUTABLE}:{})});
 try{
  const page=await browser.newPage();await page.route('**/*',async route=>{
   const path=new URL(route.request().url()).pathname;
   if(/^\/(extension\/(src|a1|member-a1)\/[a-z0-9-]+\.(js|mjs|json)|contracts\/additional-mvp\/rc1\/schema\.json)$/.test(path)){
    const replacement=path.endsWith('/additional-runtime-report-producer.js')?process.env.REPORT_PRODUCER_MODULE:path.endsWith('/additional-runtime-report-outbox.js')?process.env.REPORT_OUTBOX_MODULE:null;
    return route.fulfill({contentType:path.endsWith('.json')?'application/json':'text/javascript',body:await readFile(replacement||join(root,path.slice(1)),'utf8')});
   }
   return route.fulfill({contentType:'text/html',body:'<!doctype html><title>Replay persistence</title>'});
  });await page.goto('https://focurve.test/');
  const result=await page.evaluate(async()=>{
   const [{RuntimeReportProducer},{RuntimeReportOutbox},{RuntimeReportReplay},{createMemberDB}]=await Promise.all([import('/extension/src/additional-runtime-report-producer.js'),import('/extension/src/additional-runtime-report-outbox.js'),import('/extension/src/additional-runtime-report-replay.js'),import('/extension/member-a1/db.mjs')]);
   const scope={owner_binding_id:crypto.randomUUID(),executor_id:crypto.randomUUID()},execution=crypto.randomUUID(),auth=async s=>s.owner_binding_id===scope.owner_binding_id&&s.executor_id===scope.executor_id,producerConfig={authorizeScope:auth,verifyEvidence:async()=>true},outboxConfig={authorizeScope:auth,verifyReport:async()=>true,verifyAck:async()=>true};
   const db=createMemberDB(indexedDB,'replay-browser'),producer=new RuntimeReportProducer(db,producerConfig);
   for(let i=0;i<2;i++)await producer.produce({generation:1,report:{report_id:crypto.randomUUID(),...scope,runtime_execution_id:execution,operation_id:crypto.randomUUID(),package_id:crypto.randomUUID(),runtime_revision:1,state:'UNKNOWN',reason:'ERROR',evidence_sha256:'a'.repeat(64),observed_at:'2026-11-01T00:00:00.000Z'}});
   const source=await producer.recover();await db.transaction('readwrite',(tx,done)=>{tx.objectStore('metadata').put({key:'unrelated:cleanup',pending:true});done(null);});
   const box=new RuntimeReportOutbox(db,outboxConfig),send=box.enqueue.bind(box);box.enqueue=async r=>{await send(r);throw Error('REPLY_LOST');};let incomplete=false;
   try{await new RuntimeReportReplay({producer,outbox:box,authorizeScope:auth}).replay(scope);}catch(e){if(e.cause?.message!=='REPLY_LOST')throw e;incomplete=e.progress.staged_count===0;}
   const reopened=createMemberDB(indexedDB,'replay-browser'),p=new RuntimeReportProducer(reopened,producerConfig),outbox=new RuntimeReportOutbox(reopened,{...outboxConfig,verifyReport:async r=>{if(r.report_seq===1)throw Error('OLD_EVIDENCE');return true;}}),replay=new RuntimeReportReplay({producer:p,outbox,authorizeScope:auth});
   const resumed=await replay.replay(scope),batch=await outbox.batch(scope);await outbox.acknowledge(scope,{batch_id:batch.batch_id,items:batch.reports.map((r,i)=>({item_id:r.report_id,payload_sha256:r.payload_sha256,status:i?'REJECTED':'ACCEPTED',error_code:null}))});
   const again=await replay.replay(scope),cleanup=await reopened.transaction('readonly',(tx,done)=>{const q=tx.objectStore('metadata').get('unrelated:cleanup');q.onsuccess=()=>done(q.result);});
   return {incomplete,reused:resumed.reused_count,enqueued:resumed.enqueued_count,afterAck:again.deliveries,sourceSame:JSON.stringify(source)===JSON.stringify(await p.recover()),cleanup};
  });assert.deepEqual(result,{incomplete:true,reused:1,enqueued:1,afterAck:{PENDING:0,ACKED:1,REJECTED:1},sourceSame:true,cleanup:{key:'unrelated:cleanup',pending:true}});
 }finally{await browser.close();}
});
