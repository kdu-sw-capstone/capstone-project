import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {IDBFactory} from 'fake-indexeddb';
import {MemberAccessStore} from '../src/member-access.js';
import {transferOriginals,MemberEventStore,MemberEventDelivery} from '../src/member-events.js';
function fixture(){
 const db=new IDBFactory(),store=new MemberAccessStore({indexedDB:db});
 const credentials={owner_key:'MEMBER:1',executor_id:randomUUID(),access_token:'synthetic-test-only'};
 const event={schema_version:'1.2',event_id:randomUUID(),executor_id:credentials.executor_id,session_id:randomUUID(),policy_snapshot_id:randomUUID(),
  event_type:'RECORDED_ACCESS',occurred_at:'2026-10-10T00:00:00Z',local_seq:1,payload:{access_seq:1,navigation_id:randomUUID(),target_kind:'SITE',target_host:'example.org',target_key:'example.org',matched_policy_host:'example.org',reason:'RECORD',blocked_reasons:[]}};
 const original={scope:'synthetic scope',owner_key:credentials.owner_key,executor_id:credentials.executor_id,base_url:'http://localhost/api/v1',event_id:event.event_id,body:JSON.stringify(event)};
 const outbox=new MemberEventStore({indexedDB:db});
 const delivery=new MemberEventDelivery({baseUrl:original.base_url,store:outbox,getCredentials:async()=>credentials,fetch:async()=>assert.fail('transfer only stages bytes')});
 const save=rows=>store.transaction('readwrite',(tx,done)=>{for(const row of rows)tx.objectStore('originals').put(row);done(null);});
 const originals=()=>store.originals(credentials.owner_key,credentials.executor_id,original.base_url);
 return {store,original,delivery,outbox,save,originals};
}
test('bad staging original is durably marked and preserved; following healthy original still transfers',async()=>{
 const f=fixture(),bad={...f.original,event_id:randomUUID(),body:'broken bytes'};await f.save([bad,f.original]);
 const result=await transferOriginals([bad,f.original],f.store,f.delivery);assert.deepEqual(result,[f.original]);
 const rows=await f.originals();const damaged=rows.find(r=>r.event_id===bad.event_id);
 assert.equal(damaged.review_required,true);assert.equal(damaged.body,bad.body);
 assert.equal((await f.outbox.list(f.original.owner_key,f.original.executor_id)).length,1);
 const restored=new MemberAccessStore({indexedDB:f.store.indexedDB});
 assert.equal((await restored.originals(f.original.owner_key,f.original.executor_id,f.original.base_url)).find(r=>r.event_id===bad.event_id).review_required,true);
 await transferOriginals(rows,restored,{enqueue:async e=>assert.equal(e.event_id,f.original.event_id)});
});
test('conflicting outbox receipt leaves staging for review instead of making it eligible for ACK cleanup',async()=>{
 const f=fixture();await f.save([f.original]);await f.outbox.put({...f.original,body:'different immutable original',status:'ACKED'});
 assert.deepEqual(await transferOriginals([f.original],f.store,f.delivery),[]);
 assert.equal((await f.originals())[0].review_required,true);assert.equal((await f.originals())[0].body,f.original.body);
});
test('authentication or storage failure is not misclassified as damaged original',async()=>{
 const f=fixture();await f.save([f.original]);
 for(const code of ['MEMBER_AUTH_REQUIRED','MEMBER_OWNER_CHANGED','MEMBER_STORAGE_UNAVAILABLE']){
  await assert.rejects(transferOriginals([f.original],f.store,{enqueue:async()=>{throw new Error(code);}}),new RegExp(code));
  assert.equal((await f.originals())[0].review_required,undefined);
 }
 await assert.rejects(f.store.review(f.original.scope,f.original.event_id,'changed bytes'),/ACCESS_STORAGE_UNAVAILABLE/);
 assert.equal((await f.originals())[0].body,f.original.body);
});

test('outbox write failure leaves durable original unchanged and retries same ID after storage recovery',async()=>{
 const f=fixture();await f.save([f.original]);
 const put=f.outbox.put.bind(f.outbox);let fail=true;
 f.outbox.put=async row=>{if(fail)throw new Error('MEMBER_STORAGE_UNAVAILABLE');return put(row);};
 await assert.rejects(transferOriginals([f.original],f.store,f.delivery),/MEMBER_STORAGE_UNAVAILABLE/);
 assert.equal((await f.originals())[0].body,f.original.body);assert.equal((await f.originals())[0].review_required,undefined);
 fail=false;await transferOriginals(await f.originals(),f.store,f.delivery);
 const sent=[];f.delivery.fetch=async(_,options)=>{const events=JSON.parse(options.body).events;sent.push(...events);return new Response(JSON.stringify({items:events.map(e=>({event_id:e.event_id,status:'ACCEPTED'}))}));};
 const receipts=await f.delivery.flush();assert.equal(sent[0].event_id,f.original.event_id);assert.equal(JSON.stringify(sent[0]),f.original.body);
 assert.equal(receipts[0].status,'ACKED');assert.equal((await f.originals()).length,1);
});

test('ACK write loss preserves in-flight original; restored sender queries status without repeating batch',async()=>{
 const f=fixture();await f.save([f.original]);await transferOriginals([f.original],f.store,f.delivery);
 const put=f.outbox.put.bind(f.outbox);let fail=true,batches=0,statusQueries=0;
 f.outbox.put=async row=>{if(fail&&['ACKED','RESPONSE_UNCONFIRMED'].includes(row.status))throw new Error('MEMBER_STORAGE_UNAVAILABLE');return put(row);};
 f.delivery.fetch=async(url,options)=>{const body=JSON.parse(options.body);if(url.endsWith('/status'))statusQueries++;else batches++;
  return new Response(JSON.stringify({items:(body.event_ids||body.events.map(e=>e.event_id)).map(event_id=>({event_id,status:'ACCEPTED'}))}));};
 await assert.rejects(f.delivery.flush(),/MEMBER_STORAGE_UNAVAILABLE/);assert.equal((await f.outbox.list(f.original.owner_key,f.original.executor_id))[0].status,'IN_FLIGHT');
 assert.equal((await f.originals())[0].body,f.original.body);
 fail=false;const receipts=await f.delivery.flush();assert.equal(receipts[0].status,'ACKED');assert.equal(batches,1);assert.equal(statusQueries,1);
});
