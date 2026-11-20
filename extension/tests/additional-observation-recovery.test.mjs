import test from 'node:test';
import assert from 'node:assert/strict';
import {IDBFactory} from 'fake-indexeddb';
import {createMemberDB} from '../member-a1/db.mjs';
import {digest} from '../a1/contract.mjs';
import {AdditionalObservationJournal} from '../src/additional-observation-journal.js';
import {AdditionalTimeRuntime} from '../src/additional-time-runtime.js';

const KEY='amvp_journal_v1:time-observations',id=()=>crypto.randomUUID();
const context=()=>({bootId:id(),executorId:id(),ownerBindingId:id()});
const boundary=n=>({revision:n,observedMonoMs:n*50,status:'CANDIDATE',reason:'TEST',collectionEligible:true,
  requiresLimitedSiteHold:false,priorTailRequiresValidation:true,target:{host:'example.org',tabId:1,windowId:2}});
async function raw(db){return db.transaction('readonly',(tx,done)=>{const r=tx.objectStore('metadata').get(KEY);r.onsuccess=()=>done(r.result??null);});}
async function put(db,state){return db.transaction('readwrite',(tx,done)=>{tx.objectStore('metadata').put(state);done();});}
async function reseal(state){
  let previous=null;
  for(const row of state.captures){row.previous=previous;const {hash,...payload}=row;row.hash=await digest(payload);previous=row.hash;}
  const last=state.captures.at(-1);state.cursor=last?{seq:last.seq,hash:last.hash}:null;
  return state;
}
async function fixture(){
  const db=createMemberDB(new IDBFactory(),id()),journal=new AdditionalObservationJournal(db),owner=context();
  const epoch=await journal.start(owner);await journal.append(epoch,id(),boundary(1));
  return {db,journal,owner,epoch};
}
async function corrupted(change){
  const f=await fixture(),state=await raw(f.db);change(state);await put(f.db,await reseal(state));
  return {...f,stored:await raw(f.db),recovered:new AdditionalObservationJournal(f.db)};
}

test('recovery rejects a latest context inconsistent with its restart obligation',async()=>{
  const f=await corrupted(s=>{s.context=context();});
  await assert.rejects(f.recovered.recover());assert.deepEqual(await raw(f.db),f.stored);
});
test('recovery rejects a lost restart obligation even when cursor and hashes match',async()=>{
  const f=await corrupted(s=>{s.obligations=[];});
  await assert.rejects(f.recovered.recover());assert.deepEqual(await raw(f.db),f.stored);
});
test('a resealed foreign-owner capture cannot inherit another epoch obligation',async()=>{
  const f=await corrupted(s=>{s.captures[0].context=context();});
  await assert.rejects(f.recovered.recover());assert.deepEqual(await raw(f.db),f.stored);
});
test('a resealed forged eligibility boundary is not recovered as staging evidence',async()=>{
  const f=await corrupted(s=>{s.captures[0].boundary.requiresLimitedSiteHold=true;});
  await assert.rejects(f.recovered.recover());assert.deepEqual(await raw(f.db),f.stored);
});
for(const action of ['start','append','duplicate'])test(`recovery-to-${action} race cannot accept a changed stored payload`,async()=>{
  const f=await fixture(),original=(await raw(f.db)).captures[0];let armed=true,reads=0;
  const interleaved={transaction:async(mode,work)=>{
    if(mode==='readonly')reads++;
    if(armed&&(action==='duplicate'?mode==='readonly'&&reads===2:mode==='readwrite')){
      armed=false;const state=await raw(f.db);state.captures[0].boundary.reason='CHANGED_AFTER_RECOVERY';await put(f.db,state);
    }
    return f.db.transaction(mode,work);
  }};
  const journal=new AdditionalObservationJournal(interleaved);
  const work=()=>action==='start'?journal.start(context()):action==='append'
    ?journal.append(f.epoch,id(),boundary(2)):journal.append(f.epoch,original.id,boundary(1));
  await assert.rejects(work(),/CURSOR_CONFLICT/);
  const stored=await raw(f.db);assert.equal(stored.epoch,1);assert.equal(stored.captures.length,1);
  assert.equal(stored.captures[0].boundary.reason,'CHANGED_AFTER_RECOVERY');
});
for(const [name,change] of [
  ['capture epoch zero',s=>{s.captures[0].epoch=0;}],
  ['capture future epoch',s=>{s.captures[0].epoch=2;}],
  ['invalid capture boot',s=>{s.captures[0].context.bootId='not-a-boot';}],
  ['obligation index',s=>{s.obligations[0].epoch=2;}],
  ['obligation reason',s=>{s.obligations[0].reason='RESOLVED';}],
  ['hidden extra URL',s=>{s.captures[0].boundary.url='https://private.invalid/query';}],
  ['invalid target',s=>{s.captures[0].boundary.target.host='example.org/path';}],
  ['unknown status',s=>{s.captures[0].boundary.status='CONFIRMED';}],
  ['extra confirmed debit',s=>{s.captures[0].confirmed_ms=5000;}],
  ['extra cursor state',s=>{s.cursor.confirmed=true;}],
])test('invalid persisted state is rejected without replacement: '+name,async()=>{
  const f=await fixture(),state=await raw(f.db);change(state);
  // Rehash altered captures but retain deliberate cursor corruption.
  const cursorExtra=state.cursor.confirmed;await reseal(state);if(cursorExtra)state.cursor.confirmed=cursorExtra;
  await put(f.db,state);const before=await raw(f.db);
  for(const run of [()=>f.journal.recover(),()=>f.journal.start(context()),()=>f.journal.append(f.epoch,id(),boundary(2))]){
    await assert.rejects(run());assert.deepEqual(await raw(f.db),before);
  }
});
for(const field of ['observedMonoMs','revision'])test('recovery rejects same-epoch boundary regression: '+field,async()=>{
  const f=await fixture();await f.journal.append(f.epoch,id(),boundary(2));const state=await raw(f.db);
  state.captures[1].boundary[field]=0;await put(f.db,await reseal(state));const before=await raw(f.db);
  await assert.rejects(f.journal.recover(),/ORDER_INVALID/);assert.deepEqual(await raw(f.db),before);
});
test('valid multi-owner and new-boot history retains original bindings and unresolved obligations',async()=>{
  const f=await fixture(),other=context(),second=await f.journal.start(other);await f.journal.append(second,id(),boundary(0));
  const returning={...f.owner,bootId:id()},third=await f.journal.start(returning);await f.journal.append(third,id(),boundary(0));
  const state=await f.journal.recover();assert.deepEqual(state.captures.map(r=>r.context),[f.owner,other,returning]);
  assert.deepEqual(state.captures.map(r=>r.seq),[1,2,3]);assert.deepEqual(state.obligations.map(o=>o.epoch),[1,2,3]);
  assert.ok(state.obligations.every(o=>o.reason==='RESTART_UNCONFIRMED'));
  assert.ok(state.captures.every(r=>!Object.hasOwn(r,'confirmed_ms')));
});
test('epochs without captures and equal monotonic observations remain valid',async()=>{
  const db=createMemberDB(new IDBFactory(),id()),journal=new AdditionalObservationJournal(db);
  await journal.start(context());const second=await journal.start(context());
  await journal.append(second,id(),boundary(0));await journal.append(second,id(),boundary(0));
  const state=await journal.recover();assert.equal(state.captures.length,2);assert.equal(state.captures[0].epoch,2);assert.equal(state.obligations.length,2);
});
test('a lower capacity does not erase old history during recovery',async()=>{
  const f=await fixture();await f.journal.append(f.epoch,id(),boundary(2));const before=await raw(f.db);
  const limited=new AdditionalObservationJournal(f.db,{capacity:1});assert.deepEqual(await limited.recover(),before);
  await assert.rejects(limited.append(f.epoch,id(),boundary(3)),/CAPACITY_EXHAUSTED/);assert.deepEqual(await raw(f.db),before);
});
test('runtime refuses corrupted recovery before opening its observer and retains UNKNOWN/hold',async()=>{
  const f=await corrupted(s=>{s.context=context();});let starts=0;const statuses=[];
  const runtime=new AdditionalTimeRuntime({journal:f.recovered,onStatus:s=>statuses.push(s),
    createObserver:()=>({start:async()=>{starts++;},stop:()=>{}})});
  await assert.rejects(runtime.start(context()),/OBSERVATION_CONTEXT/);
  assert.equal(starts,0);assert.equal(runtime.state,'FAILED');
  assert.ok(statuses.every(s=>s.measurementQuality==='UNKNOWN'&&s.requiresLimitedSiteHold===true));
  assert.deepEqual(await raw(f.db),f.stored);
});
test('recovery errors preserve unrelated Core metadata',async()=>{
  const f=await corrupted(s=>{s.obligations=[];});const canary={key:'test:other-owner-cleanup',state:'UNKNOWN',claims:[id()]};
  await f.db.transaction('readwrite',(tx,done)=>{tx.objectStore('metadata').put(canary);done();});
  await assert.rejects(f.recovered.start(context()));
  const stored=await f.db.transaction('readonly',(tx,done)=>{const r=tx.objectStore('metadata').get(canary.key);r.onsuccess=()=>done(r.result);});
  assert.deepEqual(stored,canary);
});
