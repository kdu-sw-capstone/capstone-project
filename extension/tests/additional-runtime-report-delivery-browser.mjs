// Native IndexedDB only; owner/evidence/authenticated transport are SYNTHETIC.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=fileURLToPath(new URL('../../',import.meta.url));
test('native IDB reopens identical lost-response batch and commits partial then duplicate ACK without touching cleanup',async()=>{
 const browser=await chromium.launch({headless:true,...(process.env.CHROME_EXECUTABLE?{executablePath:process.env.CHROME_EXECUTABLE}:{})});
 try{
  const page=await browser.newPage();await page.route('**/*',async route=>{
   const path=new URL(route.request().url()).pathname;
   if(/^\/(extension\/(src|a1|member-a1)\/[a-z0-9-]+\.(js|mjs|json)|contracts\/additional-mvp\/rc1\/schema\.json)$/.test(path))return route.fulfill({contentType:path.endsWith('.json')?'application/json':'text/javascript',body:await readFile(join(root,path.slice(1)),'utf8')});
   return route.fulfill({contentType:'text/html',body:'<!doctype html><title>Report delivery persistence</title>'});
  });await page.goto('https://focurve.test/');
  const result=await page.evaluate(async()=>{
   const [{RuntimeReportOutbox},{RuntimeReportDelivery},{createMemberDB},{digest}]=await Promise.all([import('/extension/src/additional-runtime-report-outbox.js'),import('/extension/src/additional-runtime-report-delivery.js'),import('/extension/member-a1/db.mjs'),import('/extension/a1/contract.mjs')]);
   const id=()=>crypto.randomUUID(),owner={owner_binding_id:id(),executor_id:id()},epoch=id();
   const config={authorizeScope:async()=>true,verifyReport:async()=>true,verifyAck:async()=>true};
   const db=createMemberDB(indexedDB,'delivery-test'),outbox=new RuntimeReportOutbox(db,config);
   await db.transaction('readwrite',(tx,done)=>{tx.objectStore('metadata').put({key:'unrelated:cleanup',pending:true});done();});
   for(const seq of [1,2]){const raw={report_id:id(),...owner,runtime_execution_id:id(),report_epoch:epoch,report_seq:seq,operation_id:id(),package_id:id(),runtime_revision:1,state:'UNKNOWN',reason:'ERROR',evidence_sha256:'a'.repeat(64),observed_at:'2026-11-02T00:00:00.000Z'};await outbox.enqueue({...raw,payload_sha256:await digest(raw)});}
   const options={outbox,authorizeScope:async()=>true,isCurrent:()=>true};let first;
   try{await new RuntimeReportDelivery({...options,send:async body=>{first=body;throw Error('LOST_RESPONSE');}}).deliver(owner);throw Error('EXPECTED_FAILURE');}catch(e){if(e.cause?.message!=='LOST_RESPONSE')throw e;}
   const reopened=new RuntimeReportOutbox(createMemberDB(indexedDB,'delivery-test'),config),bodies=[];
   const make=partial=>new RuntimeReportDelivery({...options,outbox:reopened,send:async body=>{bodies.push(body);const b=JSON.parse(body);return {batch_id:b.batch_id,items:(partial?b.reports.slice(0,1):b.reports).map(r=>({item_id:r.report_id,payload_sha256:r.payload_sha256,status:'DUPLICATE',error_code:null}))};}});
   await make(true).deliver(owner);const partial=(await reopened.recover()).rows.map(r=>r.delivery);await make(false).deliver(owner);
   const state=await reopened.recover(),cleanup=await db.transaction('readonly',(tx,done)=>{const r=tx.objectStore('metadata').get('unrelated:cleanup');r.onsuccess=()=>done(r.result);});
   return {same:bodies.every(b=>b===first),partial,final:state.rows.map(r=>r.delivery),effectStates:state.rows.map(r=>r.report.state),cleanup};
  });assert.deepEqual(result,{same:true,partial:['ACKED','PENDING'],final:['ACKED','ACKED'],effectStates:['UNKNOWN','UNKNOWN'],cleanup:{key:'unrelated:cleanup',pending:true}});
 }finally{await browser.close();}
});
