import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {IDBFactory} from 'fake-indexeddb';
import {MemberAccessStore,MemberAccessCollector} from '../src/member-access.js';
import {MemberEventStore,MemberEventDelivery} from '../src/member-events.js';

function fixture() {
  const at=Date.parse('2026-10-10T00:00:01Z'),db=new IDBFactory();
  const c={owner_key:'MEMBER:1',executor_id:randomUUID(),base_url:'http://localhost/api/v1',session_id:randomUUID(),revision:1,
    applied_at:'2026-10-10T00:00:00Z',snapshot:{policy_snapshot_id:randomUUID(),sites:[{canonical_host:'example.org',include_subdomains:true,access_policy:'BLOCK'},
      {canonical_host:'example.com',include_subdomains:true,access_policy:'RECORD'},{canonical_host:'allow.example.com',include_subdomains:true,access_policy:'ALLOW'}]}};
  let current=c;
  const store=new MemberAccessStore({indexedDB:db});
  const opts={getContext:async()=>current,store,blockedPageUrl:'chrome-extension://synthetic/blocked/blocked.html',randomUUID,digest:async url=>'hash:'+url.length};
  const collector=new MemberAccessCollector(opts);
  const before=(url='https://www.example.com/path?private=excluded',tabId=1)=>({url,tabId,frameId:0,timeStamp:at,observed_at:at});
  const commit=(url='https://www.example.com/path?private=excluded',tabId=1)=>({...before(url,tabId),timeStamp:at+1,observed_at:at+1,transitionType:'typed',transitionQualifiers:[],documentLifecycle:'active'});
  return {c,db,store,opts,collector,before,commit,setContext(value){current=value;},originals:()=>store.originals(c.owner_key,c.executor_id,c.base_url)};
}
test('RECORD uses actual host and frozen matched host, commits once, and increments sequences atomically',async()=>{
  const f=fixture();
  for(let i=0;i<3;i++) {
    await f.collector.observe('before',f.before());
    const event=await f.collector.observe('commit',f.commit());
    assert.equal(event.payload.access_seq,i+1);assert.equal(event.local_seq,i+1);
    assert.equal(event.payload.target_key,'www.example.com');assert.equal(event.payload.matched_policy_host,'example.com');
    assert.deepEqual(event.payload.blocked_reasons,[]);
    assert.equal(await f.collector.observe('commit',f.commit()),null);
  }
  const rows=await f.originals();assert.equal(rows.length,3);
  assert.equal(rows.some(r=>r.body.includes('/path')||r.body.includes('private=')),false);
});
test('BLOCK records the original attempted host only after the exact real blocked-page commit',async()=>{
  const f=fixture();await f.collector.observe('before',f.before('https://sub.example.org/a'));
  const url='chrome-extension://synthetic/blocked/blocked.html?host=example.org&reason=USER_SITE';
  await f.collector.observe('before',f.before(url));
  const event=await f.collector.observe('commit',f.commit(url));
  assert.equal(event.event_type,'BLOCKED_SITE_ACCESS');assert.equal(event.payload.target_host,'sub.example.org');
  assert.deepEqual(event.payload.blocked_reasons,['USER_SITE']);
  await f.collector.observe('before',f.before(url));assert.equal(await f.collector.observe('commit',f.commit(url)),null);
});
test('automatic transitions, subframes, prerender, ALLOW exceptions and initial policy redirects are excluded',async()=>{
  const f=fixture();
  for(const change of [{transitionType:'auto_subframe'},{transitionQualifiers:['client_redirect']},{documentLifecycle:'prerender'},{url:'https://other.example.com/'}]) {
    await f.collector.observe('before',f.before());assert.equal(await f.collector.observe('commit',{...f.commit(),...change}),null);
  }
  await f.collector.observe('before',{...f.before(),frameId:1});assert.equal(await f.collector.observe('commit',f.commit()),null);
  await f.collector.observe('before',f.before('https://allow.example.com/'));assert.equal(await f.collector.observe('commit',f.commit('https://allow.example.com/')),null);
  f.setContext(null);await f.collector.observe('before',f.before('https://sub.example.org/'));assert.equal((await f.originals()).length,0);
});
test('owner, session, revision or snapshot changes invalidate pending without emitting events',async()=>{
  for(const mutate of [c=>c.owner_key='MEMBER:2',c=>c.session_id=randomUUID(),c=>c.revision++,c=>c.snapshot.policy_snapshot_id=randomUUID()]) {
    const f=fixture();await f.collector.observe('before',f.before());mutate(f.c);
    assert.equal(await f.collector.observe('commit',f.commit()),null);assert.equal((await f.originals()).length,0);
  }
});
test('Worker recreation preserves pending and sequence; tab removal and matching errors clear only their navigation',async()=>{
  const f=fixture();await f.collector.observe('before',f.before());
  const recreated=new MemberAccessCollector({...f.opts,store:new MemberAccessStore({indexedDB:f.db})});
  assert.equal((await recreated.observe('commit',f.commit())).local_seq,1);
  await recreated.observe('before',f.before());
  await recreated.observe('error',{...f.commit(),timeStamp:f.before().timeStamp-1});
  assert.ok(await f.store.pending(1));await recreated.forget(1);assert.equal(await f.store.pending(1),null);
  await recreated.observe('before',f.before());await recreated.observe('error',f.commit());assert.equal(await f.store.pending(1),null);
  await recreated.observe('before',f.before());assert.equal((await recreated.observe('commit',f.commit())).local_seq,2);
});
test('response loss preserves the exact original; authenticated status resolves ACK without another event',async()=>{
  const f=fixture();await f.collector.observe('before',f.before());const event=await f.collector.observe('commit',f.commit());
  const credentials={owner_key:f.c.owner_key,executor_id:f.c.executor_id,access_token:'synthetic'};
  let now=0,posts=0;
  const delivery=new MemberEventDelivery({baseUrl:f.c.base_url,store:new MemberEventStore({indexedDB:f.db}),getCredentials:async()=>credentials,now:()=>now,random:()=>0,
    fetch:async(url)=>{if(url.endsWith('/batch')){posts++;throw new Error('lost after acceptance');}return new Response(JSON.stringify({items:[{event_id:event.event_id,status:'ACCEPTED'}]}));}});
  const original=(await f.originals())[0];await delivery.enqueue(JSON.parse(original.body),credentials);await delivery.flush();
  now=31000;const rows=await delivery.flush();assert.equal(rows[0].status,'ACKED');assert.equal(rows[0].body,original.body);assert.equal(posts,1);
  await f.store.acknowledged(original.scope,original.event_id);assert.equal((await f.originals()).length,0);
});
test('account switch between original capture and enqueue cannot stage another account event',async()=>{
  const f=fixture();await f.collector.observe('before',f.before());const event=await f.collector.observe('commit',f.commit());
  const store=new MemberEventStore({indexedDB:f.db});
  const delivery=new MemberEventDelivery({baseUrl:f.c.base_url,store,getCredentials:async()=>({owner_key:'MEMBER:2',executor_id:f.c.executor_id,access_token:'synthetic'})});
  await assert.rejects(delivery.enqueue(event,{owner_key:f.c.owner_key,executor_id:f.c.executor_id}),/MEMBER_OWNER_CHANGED/);
  assert.equal((await store.list('MEMBER:2',f.c.executor_id)).length,0);assert.equal((await f.originals()).length,1);
});
test('storage failure never consumes a navigation or sequence as a successful event',async()=>{
  const f=fixture();await f.collector.observe('before',f.before());
  f.store.consume=async()=>{throw new Error('quota');};
  await assert.rejects(f.collector.observe('commit',f.commit()),/quota/);
  assert.equal((await f.originals()).length,0);assert.ok(await f.store.pending(1));
});
test('a closed IndexedDB connection reports the capture storage error and preserves drafts across retry',async()=>{
  const f=fixture();await f.collector.observe('before',f.before());
  const original=await f.store.pending(1),factory=f.store.indexedDB;
  let fail=true;
  f.store.indexedDB={open(...args){
    const request=factory.open(...args);
    request.addEventListener('success',()=>{if(fail){fail=false;request.result.close();}});
    return request;
  }};
  await assert.rejects(f.collector.observe('commit',f.commit()),/ACCESS_STORAGE_UNAVAILABLE/);
  assert.deepEqual(await f.store.pending(1),original);
  const event=await f.collector.observe('commit',f.commit());
  assert.equal(event.event_id,original.event_id);assert.equal(event.local_seq,1);
  assert.equal((await f.originals()).length,1);
});
