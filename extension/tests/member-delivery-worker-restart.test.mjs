import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {IDBFactory} from 'fake-indexeddb';
import {MemberAccessStore} from '../src/member-access.js';
import {MemberEventStore,MemberEventDelivery,summarize,transferOriginals} from '../src/member-events.js';
async function waitFor(promise){let timer;try{return await Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('recovery did not complete')),2000);})]);}finally{clearTimeout(timer);}}
const source=await readFile(new URL('../background/member-execution-runtime.js',import.meta.url),'utf8');
async function fixture(){
 const db=new IDBFactory(),executor=randomUUID(),base='http://localhost/api/v1';
 let owner='1',now=1000,fetchImpl,readHook;
 let markClean,markSwitch;const cleaned=new Promise(resolve=>markClean=resolve),switched=new Promise(resolve=>markSwitch=resolve);
 const calls=[];
 const event={schema_version:'1.2',event_id:randomUUID(),executor_id:executor,session_id:randomUUID(),policy_snapshot_id:randomUUID(),event_type:'RECORDED_ACCESS',occurred_at:'2026-10-10T00:00:00Z',local_seq:1,payload:{access_seq:1,navigation_id:randomUUID(),target_kind:'SITE',target_host:'example.org',target_key:'example.org',matched_policy_host:'example.org',reason:'RECORD',blocked_reasons:[]}};
 const original={scope:'frozen-synthetic-scope',owner_key:'MEMBER:1',executor_id:executor,base_url:base,event_id:event.event_id,body:JSON.stringify(event)};
 const access=new MemberAccessStore({indexedDB:db});
 await access.transaction('readwrite',(tx,done)=>{tx.objectStore('originals').put(original);done(null);});
 const fetch=async(url,options)=>{const body=JSON.parse(options.body);calls.push({url,body,authorization:options.headers.Authorization});return fetchImpl(url,body);};
 const response=body=>new Response(JSON.stringify({items:(body.event_ids||body.events.map(e=>e.event_id)).map(event_id=>({event_id,status:'ACCEPTED'}))}));
 fetchImpl=async(_,body)=>response(body);
 function worker(commandFails=false){
  let listener;
  class Store extends MemberEventStore{constructor(options){super({...options,indexedDB:db});}}
  class Delivery extends MemberEventDelivery{constructor(options){super({...options,fetch,now:()=>now,random:()=>0});}}
  class Access extends MemberAccessStore{constructor(){super({indexedDB:db});}async originals(...args){const rows=await super.originals(...args);if(readHook){const hook=readHook;readHook=null;hook();}return rows;}async acknowledged(...args){await super.acknowledged(...args);markClean();}}
  const context=vm.createContext({
   MemberAuthRuntime:{status:async()=>({phase:'LINKED',owner_user_id:owner,executor_id:executor,server_url:base}),credentials:async()=>({owner_key:'MEMBER:'+owner,executor_id:executor,access_token:'synthetic-'+owner})},
   GuestSession:{state:async()=>null},FocurveMemberEvents:{MemberEventStore:Store,MemberEventDelivery:Delivery,summarize,transferOriginals},
   FocurveMemberExecution:{MemberExecutionClient:class {},MemberExecutionLoop:class {constructor(){this.view={};this.access={store:new Access()};}async tick(){if(commandFails)throw new Error('COMMAND_UNAVAILABLE');return {status:'IDLE'};}}},
   chrome:{runtime:{id:'self',getURL:p=>'chrome-extension://self/'+p,onMessage:{addListener:f=>listener=f},onMessageExternal:{addListener(){}},onStartup:{addListener(){}}},alarms:{get:async()=>({}),create:async()=>{},clear:async()=>true,onAlarm:{addListener(){}}},tabs:{},declarativeNetRequest:{}}
  });
  vm.runInContext(source,context);
  return {send:(type='MEMBER_DELIVERY_RECHECK')=>new Promise(resolve=>listener({type,request_id:randomUUID(),payload:{}},{id:'self',url:'chrome-extension://self/popup/popup.html',frameId:0},resolve))};
 }
 return {worker,event,original,calls,response,cleaned,switched,switchNow(){owner='2';},setFetch(fn){fetchImpl=fn;},advance(){now+=40000;},switchOnRead(){readHook=()=>{owner='2';markSwitch();};},originals:()=>access.originals('MEMBER:1',executor,base)};
}
test('fresh Worker runtime resumes lost reply with status lookup, identical ID and no repeated accepted batch',async()=>{
 const f=await fixture();let received=false;
 f.setFetch(async(_,body)=>{received=true;throw new Error('LOST_REPLY');});
 const first=f.worker();assert.equal((await first.send()).data.counts.RESPONSE_UNCONFIRMED,1);assert.equal(received,true);assert.equal((await f.originals()).length,1);
 const raw=f.calls[0].body.events[0];f.advance();f.setFetch(async(url,body)=>{assert.ok(url.endsWith('/status'));return f.response(body);});
 const fresh=f.worker();assert.equal((await fresh.send()).data.counts.ACKED,1);
 assert.equal(f.calls.filter(c=>c.url.endsWith('/batch')).length,1);assert.equal(f.calls[1].body.event_ids[0],f.event.event_id);
 assert.equal(JSON.stringify(raw),f.original.body);assert.equal((await f.originals()).length,0);
});
test('overlapping popup rechecks share one pump and send a single batch',async()=>{
 const f=await fixture();let release;
 f.setFetch(async(_,body)=>new Promise(resolve=>{release=()=>resolve(f.response(body));}));
 const worker=f.worker(),one=worker.send(),two=worker.send();
 while(!release)await new Promise(resolve=>setImmediate(resolve));
 release();const results=await Promise.all([one,two]);assert.equal(results.every(r=>r.status==='OK'),true);
 assert.equal(f.calls.filter(c=>c.url.endsWith('/batch')).length,1);assert.equal((await f.originals()).length,0);
});
test('account transition during staging read stops old pass before any network or cleanup',async()=>{
 const f=await fixture();f.switchOnRead();const worker=f.worker();
 await waitFor(f.switched);const current=await worker.send('MEMBER_DELIVERY_STATE');
 assert.equal(current.status,'OK');assert.equal(current.data.total,0);assert.equal(f.calls.length,0);
 assert.equal((await f.originals())[0].body,f.original.body);
});
test('startup restores durable delivery even when command endpoint polling fails',async()=>{
 const f=await fixture();const worker=f.worker(true);
 await waitFor(f.cleaned);
 const summary=await worker.send('MEMBER_DELIVERY_STATE');assert.equal(summary.status,'OK');assert.equal(summary.data.counts.ACKED,1);
 assert.equal(f.calls.length,1);assert.equal(f.calls[0].body.events[0].event_id,f.event.event_id);
});

test('account transition after server acceptance retains old staging and hides old receipt counts',async()=>{
 const f=await fixture();f.setFetch(async(_,body)=>{f.switchNow();return f.response(body);});
 const worker=f.worker();const interrupted=await worker.send();assert.equal(interrupted.status,'ERROR');
 assert.equal(f.calls.length,1);assert.equal(f.calls[0].authorization,'Bearer synthetic-1');
 assert.equal((await f.originals())[0].body,f.original.body);
 const current=await worker.send('MEMBER_DELIVERY_STATE');assert.equal(current.status,'OK');assert.equal(current.data.total,0);
});
