import test from 'node:test';
import assert from 'node:assert/strict';
import {IDBFactory} from 'fake-indexeddb';
import {createMemberDB} from '../member-a1/db.mjs';
import {AdditionalObservationJournal} from '../src/additional-observation-journal.js';
import {AdditionalTimeRuntime} from '../src/additional-time-runtime.js';
import {AdditionalIdleObserver} from '../src/additional-idle-observer.js';
import {AdditionalForegroundObserver} from '../src/additional-foreground-observer.js';

const event=()=>{
  const listeners=new Set();
  return {addListener:f=>listeners.add(f),removeListener:f=>listeners.delete(f),
    fire:value=>[...listeners].forEach(f=>f(value)),callbacks:()=>[...listeners],size:()=>listeners.size};
};
const tick=()=>new Promise(resolve=>setImmediate(resolve));
const context=()=>({bootId:crypto.randomUUID(),executorId:crypto.randomUUID(),ownerBindingId:crypto.randomUUID()});
function browser(){
  const windows={getLastFocused:async()=>({id:2,focused:true,type:'normal'}),onFocusChanged:event(),onRemoved:event()};
  const tabs={query:async()=>[{id:1,windowId:2,active:true,url:'https://example.org/private?q=secret'}]};
  for(const name of ['onActivated','onUpdated','onRemoved','onReplaced','onAttached','onDetached'])tabs[name]=event();
  const idle={queryState:async()=>'active',setDetectionInterval(){},onStateChanged:event()};
  return {windows,tabs,idle,permissions:{contains:async()=>true,onRemoved:event()}};
}
function idleHarness(){
  const api=browser(),observations=[];
  const observer=new AdditionalIdleObserver({...api,onObservation:o=>observations.push(o),now:()=>100});
  return {...api,observer,observations};
}
function foregroundHarness(){
  const api=browser(),boundaries=[];
  const observer=new AdditionalForegroundObserver({...api,onBoundary:b=>boundaries.push(b),now:()=>100});
  return {...api,observer,boundaries};
}

test('queued idle callback from previous lifecycle cannot reopen a restarted locked observer',async()=>{
  const h=idleHarness();await h.observer.start();const old=h.idle.onStateChanged.callbacks()[0];
  h.observer.stop();h.idle.queryState=async()=>'locked';await h.observer.start();
  const count=h.observations.length;old('active');
  assert.equal(h.observations.length,count);assert.equal(h.observer.state,'locked');
});
test('queued idle callback after permission revocation cannot emit active',async()=>{
  const h=idleHarness();await h.observer.start();const old=h.idle.onStateChanged.callbacks()[0];
  h.permissions.onRemoved.fire({permissions:['idle']});const count=h.observations.length;old('active');
  assert.equal(h.observations.length,count);assert.equal(h.observer.state,'UNAVAILABLE');
});
test('old permission-removal callback cannot revoke a freshly verified idle lifecycle',async()=>{
  const h=idleHarness();await h.observer.start();const old=h.permissions.onRemoved.callbacks()[0];
  await h.observer.start();const count=h.observations.length;old({permissions:['idle']});
  assert.equal(h.observations.length,count);assert.equal(h.observer.state,'active');
});
test('old foreground browser callback cannot trigger a new lifecycle read',async()=>{
  const h=foregroundHarness();await h.observer.start();const old=h.tabs.onActivated.callbacks()[0];
  await h.observer.start();let reads=0;h.tabs.query=async()=>{reads++;return [];};
  const count=h.boundaries.length;old({tabId:999});await tick();
  assert.equal(reads,0);assert.equal(h.boundaries.length,count);
});
test('old foreground permission-removal callback cannot revoke the new lifecycle',async()=>{
  const h=foregroundHarness();await h.observer.start();const old=h.permissions.onRemoved.callbacks();
  await h.observer.start();const count=h.boundaries.length;for(const callback of old)callback({permissions:['tabs'],origins:['<all_urls>']});
  await tick();assert.equal(h.boundaries.length,count);assert.equal(h.boundaries.at(-1).status,'CANDIDATE');
});

test('stale idle callback cannot become a candidate in another durable collector epoch',async()=>{
  const api=browser(),journal=new AdditionalObservationJournal(createMemberDB(new IDBFactory(),crypto.randomUUID()));
  const runtime=new AdditionalTimeRuntime({journal,browser:api});
  await runtime.start(context());const old=api.idle.onStateChanged.callbacks()[0];
  await runtime.stop();api.idle.queryState=async()=>'locked';await runtime.start(context());
  const before=await journal.recover();old('active');await tick();await runtime.flush();
  const after=await journal.recover();assert.equal(after.captures.length,before.captures.length);
  assert.ok(after.captures.filter(c=>c.epoch===after.epoch).every(c=>c.boundary.status!=='CANDIDATE'));
  assert.equal(after.obligations.length,2);await runtime.stop();
});

test('query failure retires already-dispatched active callbacks until explicit restart',async()=>{
  const h=idleHarness();let old;
  h.idle.queryState=async()=>{old=h.idle.onStateChanged.callbacks()[0];throw Error('QUERY_FAILED');};
  await h.observer.start();const count=h.observations.length;old('active');
  assert.equal(h.observations.length,count);assert.equal(h.observer.state,'UNAVAILABLE');
  h.idle.queryState=async()=>'active';await h.observer.start();assert.equal(h.observer.state,'active');
});
test('stopped idle callbacks and permission notifications are inert',async()=>{
  const h=idleHarness();await h.observer.start();const old=h.idle.onStateChanged.callbacks()[0],removed=h.permissions.onRemoved.callbacks()[0];
  h.observer.stop();const count=h.observations.length;old('active');removed({permissions:['idle']});
  assert.equal(h.observations.length,count);assert.equal(h.idle.onStateChanged.size(),0);assert.equal(h.permissions.onRemoved.size(),0);
});
test('current idle events retain threshold60, locked handling and unrelated permission behavior',async()=>{
  const h=idleHarness(),intervals=[],queries=[];
  h.idle.setDetectionInterval=n=>intervals.push(n);h.idle.queryState=async n=>{queries.push(n);return 'active';};
  await h.observer.start();h.permissions.onRemoved.fire({permissions:['storage']});
  h.idle.onStateChanged.fire('locked');assert.equal(h.observer.state,'locked');
  h.idle.onStateChanged.fire('active');assert.equal(h.observer.state,'active');
  assert.deepEqual(intervals,[60]);assert.deepEqual(queries,[60]);assert.equal(h.observations.at(-1).observedMonoMs,100);
});
test('all old browser registrations remain inert after stop and restart while new events still work',async()=>{
  const h=foregroundHarness();await h.observer.start();
  const events=[h.windows.onFocusChanged,h.windows.onRemoved,...Object.values(h.tabs).filter(v=>v?.callbacks)];
  const old=events.map(e=>e.callbacks()[0]);h.observer.stop();const stopped=h.boundaries.length;
  for(const callback of old)callback({});await tick();assert.equal(h.boundaries.length,stopped);
  await h.observer.start();const restarted=h.boundaries.length;
  for(const callback of old)callback({});await tick();assert.equal(h.boundaries.length,restarted);
  assert.ok(events.every(e=>e.size()===1));h.tabs.onActivated.fire({tabId:1});await tick();
  assert.ok(h.boundaries.length>restarted);assert.equal(h.boundaries.at(-1).status,'CANDIDATE');
  assert.equal(h.boundaries.at(-1).target.host,'example.org');assert.ok(!JSON.stringify(h.boundaries).includes('secret'));
});
test('a late failed query from an old start does not retire the current listener',async()=>{
  const h=idleHarness();let reject;
  h.idle.queryState=()=>new Promise((_,r)=>{reject=r;});const first=h.observer.start();await Promise.resolve();
  h.idle.queryState=async()=>'locked';await h.observer.start();reject(Error('OLD_QUERY_FAILED'));await first;
  h.idle.onStateChanged.fire('active');assert.equal(h.observer.state,'active');assert.equal(h.idle.onStateChanged.size(),1);
});
test('old denied permission response cannot remove a new verified listener',async()=>{
  const h=idleHarness();let resolve;
  h.permissions.contains=()=>new Promise(r=>{resolve=r;});const first=h.observer.start();
  h.permissions.contains=async()=>true;await h.observer.start();resolve(false);await first;
  h.idle.onStateChanged.fire('locked');assert.equal(h.observer.state,'locked');assert.equal(h.idle.onStateChanged.size(),1);
});
test('revoked current lifecycle stays unavailable until explicit fresh permission validation',async()=>{
  const h=foregroundHarness();await h.observer.start();const old=h.idle.onStateChanged.callbacks()[0];
  h.permissions.onRemoved.fire({permissions:['idle']});old('active');await tick();
  assert.equal(h.boundaries.at(-1).status,'UNKNOWN');assert.equal(h.boundaries.at(-1).requiresLimitedSiteHold,true);
  h.permissions.contains=async q=>q.permissions?.[0]!=='idle';await h.observer.start();
  assert.equal(h.boundaries.at(-1).status,'UNKNOWN');
  h.permissions.contains=async()=>true;await h.observer.start();assert.equal(h.boundaries.at(-1).status,'CANDIDATE');
});
test('old revocation cannot create durable boundaries or remove a new owner restart obligation',async()=>{
  const api=browser(),journal=new AdditionalObservationJournal(createMemberDB(new IDBFactory(),crypto.randomUUID()));
  const runtime=new AdditionalTimeRuntime({journal,browser:api});
  await runtime.start(context());const old=api.permissions.onRemoved.callbacks();await runtime.stop();
  const owner=context();await runtime.start(owner);const before=await journal.recover();
  for(const callback of old)callback({permissions:['idle','tabs'],origins:['<all_urls>']});
  await tick();await runtime.flush();const after=await journal.recover();assert.deepEqual(after,before);
  assert.deepEqual(after.context,owner);assert.equal(after.obligations.length,2);assert.equal(runtime.state,'OBSERVING');
  await runtime.stop();
});
