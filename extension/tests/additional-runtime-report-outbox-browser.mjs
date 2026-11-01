// Actual browser persistence only. Report evidence, owner and transport ACK are SYNTHETIC.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=fileURLToPath(new URL('../../',import.meta.url));
test('real IndexedDB preserves immutable report/batch across reopen and ACK without touching cleanup metadata',async()=>{
 const browser=await chromium.launch({headless:true,...(process.env.CHROME_EXECUTABLE?{executablePath:process.env.CHROME_EXECUTABLE}:{})});
 try{
  const page=await browser.newPage();await page.route('**/*',async route=>{
   const path=new URL(route.request().url()).pathname;
   if(/^\/(extension\/(src|a1|member-a1)\/[a-z0-9-]+\.(js|mjs|json)|contracts\/additional-mvp\/rc1\/schema\.json)$/.test(path))return route.fulfill({contentType:path.endsWith('.json')?'application/json':'text/javascript',body:await readFile(join(root,path.slice(1)),'utf8')});
   return route.fulfill({contentType:'text/html',body:'<!doctype html><title>Report outbox persistence</title>'});
  });await page.goto('https://focurve.test/');
  const result=await page.evaluate(async()=>{
   const [{RuntimeReportOutbox},{createMemberDB},{digest}]=await Promise.all([import('/extension/src/additional-runtime-report-outbox.js'),import('/extension/member-a1/db.mjs'),import('/extension/a1/contract.mjs')]);
   const db=createMemberDB(indexedDB,'report-test'),owner={owner_binding_id:crypto.randomUUID(),executor_id:crypto.randomUUID()};
   const config={authorizeScope:async s=>s.owner_binding_id===owner.owner_binding_id&&s.executor_id===owner.executor_id,verifyReport:async()=>true,verifyAck:async()=>true};
   const body={report_id:crypto.randomUUID(),...owner,runtime_execution_id:crypto.randomUUID(),report_epoch:crypto.randomUUID(),report_seq:1,operation_id:crypto.randomUUID(),package_id:crypto.randomUUID(),runtime_revision:1,state:'UNKNOWN',reason:'ERROR',evidence_sha256:'a'.repeat(64),observed_at:'2026-11-01T00:00:00.000Z'},report={...body,payload_sha256:await digest(body)};
   await db.transaction('readwrite',(tx,done)=>{tx.objectStore('metadata').put({key:'unrelated:cleanup',pending:true});done(null);});
   const first=new RuntimeReportOutbox(db,config);await first.enqueue(report);const batch=await first.batch(owner);
   const reopened=new RuntimeReportOutbox(createMemberDB(indexedDB,'report-test'),config),retry=await reopened.batch(owner);
   await reopened.acknowledge(owner,{batch_id:batch.batch_id,items:[{item_id:report.report_id,payload_sha256:report.payload_sha256,status:'DUPLICATE',error_code:null}]});
   const state=await reopened.recover(),cleanup=await db.transaction('readonly',(tx,done)=>{const q=tx.objectStore('metadata').get('unrelated:cleanup');q.onsuccess=()=>done(q.result);});
   return {same:JSON.stringify(batch)===JSON.stringify(retry),delivery:state.rows[0].delivery,reportSame:JSON.stringify(state.rows[0].report)===JSON.stringify(report),empty:await reopened.batch(owner)===null,cleanup};
  });assert.deepEqual(result,{same:true,delivery:'ACKED',reportSame:true,empty:true,cleanup:{key:'unrelated:cleanup',pending:true}});
 }finally{await browser.close();}
});
