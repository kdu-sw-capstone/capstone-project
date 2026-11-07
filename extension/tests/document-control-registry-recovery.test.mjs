import test from 'node:test';
import assert from 'node:assert/strict';
import {IDBFactory} from 'fake-indexeddb';
import {DocumentControlRegistry} from '../src/document-control-registry.js';
const ref={executorKey:'executor-a',tab:7,frame:0,documentKey:'native-doc-a'};
const scope={ownerKey:'GUEST:executor-a',sessionKey:'session-a',snapshotKey:'snapshot-a',revision:1,bindingKey:'binding-a'};
const apply=(operationKey='apply-a',controlScope=scope)=>({operationKey,action:'APPLY',controlScope});
const release=(operationKey='release-a',controlScope=scope)=>({operationKey,action:'RELEASE',controlScope});
const key=r=>[r.executorKey,r.tab,r.frame,r.documentKey];
async function fixture(){
  const indexedDB=new IDBFactory(),registry=new DocumentControlRegistry({indexedDB});
  await registry.observe(ref);const staged=await registry.stage(ref,apply());
  const raw=()=>registry.transaction('readonly',(docs,_slots,done)=>{const r=docs.get(key(ref));r.onsuccess=()=>done(r.result);});
  const change=async work=>{const row=await raw();work(row);await registry.transaction('readwrite',(docs,_slots,done)=>{docs.put(row);done();});return row;};
  return {indexedDB,registry,staged,raw,change,recovered:()=>new DocumentControlRegistry({indexedDB})};
}
test('lost obligation cannot become an empty successful pending recovery',async()=>{
  const h=await fixture(),before=await h.change(row=>{row.obligations=[];});
  await assert.rejects(h.recovered().pending(ref.executorKey),/INVALID_DOCUMENT_REGISTRY/);
  assert.deepEqual(await h.raw(),before);
});
test('RESTORED without a confirmed release cannot hide an unresolved apply',async()=>{
  const h=await fixture(),before=await h.change(row=>{row.obligations[0].state='RESTORED';});
  await assert.rejects(h.recovered().pending(ref.executorKey),/INVALID_DOCUMENT_REGISTRY/);
  assert.deepEqual(await h.raw(),before);
});
test('stored ticket cannot point to a different binding from its original intent',async()=>{
  const h=await fixture(),before=await h.change(row=>{row.operations[0].ticket.controlScope={...row.operations[0].ticket.controlScope,bindingKey:'other-binding'};});
  await assert.rejects(h.recovered().load(ref),/INVALID_DOCUMENT_REGISTRY/);assert.deepEqual(await h.raw(),before);
});
test('corrupt slot cannot make observing one executor inactivate another executor document',async()=>{
  const h=await fixture(),other={...ref,executorKey:'executor-b',documentKey:'native-doc-b'};
  await h.registry.observe(other);const before=await h.registry.load(other);
  await h.registry.transaction('readwrite',(_docs,slots,done)=>{slots.put({key:[ref.executorKey,ref.tab,ref.frame],documentKey:key(other)});done();});
  await assert.rejects(h.recovered().observe({...ref,documentKey:'native-doc-new'}),/INVALID_DOCUMENT_REGISTRY/);
  assert.deepEqual(await h.registry.load(other),before);
});

for(const [name,change] of [
  ['wrong stored reference',row=>{row.ref={...row.ref,documentKey:'other-doc'};}],
  ['sequence does not match retained operations',row=>{row.sequence++;}],
  ['zero epoch',row=>{row.epoch=0;}],
  ['future ticket epoch',row=>{row.operations[0].ticket.epoch=row.epoch+1;}],
  ['unknown lifecycle',row=>{row.lifecycle='CACHED';}],
  ['orphan obligation',row=>{row.obligations.push({scope:{...scope,bindingKey:'orphan'},state:'UNCONFIRMED'});}],
  ['duplicate obligation',row=>{row.obligations.push(structuredClone(row.obligations[0]));}],
  ['APPLY_CONFIRMED without a result',row=>{row.obligations[0].state='APPLY_CONFIRMED';}],
  ['DOCUMENT_GONE without gone lifecycle',row=>{row.obligations[0].state='DOCUMENT_GONE';}],
  ['unknown operation result',row=>{row.operations[0].result='SUCCESS';}],
  ['unknown stored credential field',row=>{row.credential='must-not-be-a-registry-field';}],
])test('all target-document paths reject and preserve malformed v1 data: '+name,async()=>{
  const h=await fixture(),before=await h.change(change),recovered=h.recovered();
  for(const work of [()=>recovered.load(ref),()=>recovered.pending(ref.executorKey),()=>recovered.observe(ref),
    ()=>recovered.stage(ref,release()),()=>recovered.complete(h.staged.ticket,'CONFIRMED'),()=>recovered.confirmGone(ref)]){
    await assert.rejects(work(),/INVALID_DOCUMENT_REGISTRY/);assert.deepEqual(await h.raw(),before);
  }
});
test('a slot that has lost its document cannot silently recreate empty history',async()=>{
  const h=await fixture();await h.registry.transaction('readwrite',(docs,_slots,done)=>{docs.delete(key(ref));done();});
  await assert.rejects(h.recovered().observe(ref),/INVALID_DOCUMENT_REGISTRY/);
  await assert.rejects(h.recovered().observe({...ref,documentKey:'replacement'}),/INVALID_DOCUMENT_REGISTRY/);
  assert.equal(await h.raw(),undefined);
});
test('failed replacement rolls back an earlier inactivation in the same transaction',async()=>{
  const h=await fixture(),other={...ref,documentKey:'doc-b'};
  await h.registry.observe(other);await h.registry.stage(other,apply('apply-b',{...scope,bindingKey:'binding-b'}));await h.registry.observe(ref);
  await h.registry.transaction('readwrite',(docs,_slots,done)=>{const r=docs.get(key(other));r.onsuccess=()=>{r.result.obligations=[];docs.put(r.result);done();};});
  const before=await h.raw();await assert.rejects(h.recovered().observe(other),/INVALID_DOCUMENT_REGISTRY/);
  assert.deepEqual(await h.raw(),before);assert.equal(before.lifecycle,'ACTIVE');
});
test('corruption owned by a different identifiable executor does not block valid pending recovery',async()=>{
  const h=await fixture(),other={...ref,executorKey:'executor-b',documentKey:'doc-b'};
  await h.registry.observe(other);await h.registry.stage(other,apply('apply-b',{...scope,ownerKey:'GUEST:executor-b',bindingKey:'binding-b'}));
  await h.registry.transaction('readwrite',(docs,_slots,done)=>{const r=docs.get(key(other));r.onsuccess=()=>{r.result.obligations=[];docs.put(r.result);done();};});
  assert.equal((await h.recovered().pending(ref.executorKey)).length,1);
  await assert.rejects(h.recovered().pending(other.executorKey),/INVALID_DOCUMENT_REGISTRY/);
});
test('epoch exhaustion cannot persist an unsafe inactivation or gone transition',async()=>{
  const h=await fixture(),before=await h.change(row=>{row.epoch=Number.MAX_SAFE_INTEGER;});
  await assert.rejects(h.registry.observe({...ref,documentKey:'next'}),/INVALID_DOCUMENT_REGISTRY/);
  await assert.rejects(h.registry.confirmGone(ref),/INVALID_DOCUMENT_REGISTRY/);assert.deepEqual(await h.raw(),before);
});
test('valid failed cleanup remains pending after recreation and a verified retry can complete it',async()=>{
  const h=await fixture(),r=await h.registry.stage(ref,release());await h.registry.complete(r.ticket,'FAILED');
  const recovered=h.recovered();assert.equal((await recovered.pending(ref.executorKey))[0].obligations[0].state,'CLEANUP_UNCONFIRMED');
  const retry=await recovered.stage(ref,release('release-b'));await recovered.complete(retry.ticket,'CONFIRMED');
  assert.equal((await recovered.pending(ref.executorKey)).length,0);
  assert.equal((await recovered.stage(ref,apply())).duplicate,true);
});
test('gone document preserves historical confirmed completion while original obligations stay gone',async()=>{
  const h=await fixture();await h.registry.complete(h.staged.ticket,'CONFIRMED');await h.registry.confirmGone(ref);
  assert.deepEqual(await h.recovered().complete(h.staged.ticket,'CONFIRMED'),{accepted:false,duplicate:true});
  assert.equal((await h.recovered().load(ref)).obligations[0].state,'DOCUMENT_GONE');
  assert.equal((await h.recovered().pending(ref.executorKey)).length,0);
});
