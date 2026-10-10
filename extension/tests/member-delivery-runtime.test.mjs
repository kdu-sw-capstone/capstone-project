import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {summarize} from '../src/member-events.js';
async function fixture(changeDuringRead=false){
 let listener, owner='1', flushes=0, storageFail=false, coordinator;
 const context=vm.createContext({
  MemberAuthRuntime:{status:async()=>({phase:'LINKED',owner_user_id:owner,executor_id:'installation',server_url:'http://localhost/api/v1'}),credentials:async()=>assert.fail('read-only summary must not obtain bearer token')},
  GuestSession:{state:async()=>null},
  FocurveMemberEvents:{summarize,MemberEventStore:class {async list(){if(storageFail)throw new Error('MEMBER_STORAGE_UNAVAILABLE');if(changeDuringRead)owner='2';return [{owner_key:'MEMBER:1',executor_id:'installation',event_id:'event',status:'REJECTED',body:'private original'}];}},
   MemberEventDelivery:class {constructor({store}){this.store=store;}async flush(){flushes++;if(storageFail)throw new Error('MEMBER_STORAGE_UNAVAILABLE');return [];}}},
  FocurveMemberExecution:{MemberExecutionClient:class {},MemberExecutionLoop:class {constructor(){coordinator=this;this.view={};this.access={store:{originals:async()=>[]}};}async tick(){return {status:'IDLE'};}}},
  chrome:{runtime:{id:'self',getURL:path=>'chrome-extension://self/'+path,onMessage:{addListener:fn=>listener=fn},onMessageExternal:{addListener(){}},onStartup:{addListener(){}}},alarms:{get:async()=>({}),clear:async()=>true,create:async()=>{},onAlarm:{addListener(){}}},tabs:{},declarativeNetRequest:{}}
 });
 vm.runInContext(await readFile(new URL('../background/member-execution-runtime.js',import.meta.url),'utf8'),context);
 await new Promise(resolve=>setTimeout(resolve,0));
 return {send:(type='MEMBER_DELIVERY_STATE',sender={id:'self',url:'chrome-extension://self/popup/popup.html',frameId:0},payload={})=>new Promise(resolve=>{const accepted=listener({type,request_id:'test',payload},sender,resolve);if(!accepted)resolve(null);}),get flushes(){return flushes;},setStorageFailure(value){storageFail=value;},setCaptureError(){coordinator.accessError='ACCESS_STORAGE_UNCONFIRMED';}};
}
test('popup summary contains counts only and does not cause delivery or expose original',async()=>{
 const f=await fixture(),baseline=f.flushes,result=await f.send();
 assert.equal(result.status,'OK');assert.equal(result.data.counts.REJECTED,1);
 assert.equal(f.flushes,baseline);assert.equal(JSON.stringify(result).includes('private original'),false);
 assert.equal(JSON.stringify(result).includes('MEMBER:1'),false);
 const rechecked=await f.send('MEMBER_DELIVERY_RECHECK');
 assert.equal(f.flushes,baseline+1);assert.equal(rechecked.data.counts.REJECTED,1);
});
test('account change during IndexedDB read refuses stale owner counts',async()=>{
 assert.equal((await (await fixture(true)).send()).status,'ERROR');
});
test('summary rejects content frames and supplied owner selectors',async()=>{
 const f=await fixture();assert.equal(await f.send('MEMBER_DELIVERY_STATE',{id:'self',url:'https://example.org',frameId:0}),null);
 assert.equal(await f.send('MEMBER_DELIVERY_STATE',undefined,{owner_key:'MEMBER:2'}),null);
});

test('storage failure is a typed popup error; successful retry clears only delivery warning',async()=>{
 const f=await fixture();f.setStorageFailure(true);
 const failed=await f.send('MEMBER_DELIVERY_RECHECK');assert.equal(failed.status,'ERROR');assert.equal(failed.error.code,'DELIVERY_STORAGE_UNAVAILABLE');
 assert.equal((await f.send('DEV_MEMBER_EXECUTION_STATE')).data.access_error,'ACCESS_DELIVERY_STORAGE_UNCONFIRMED');
 f.setStorageFailure(false);assert.equal((await f.send('MEMBER_DELIVERY_RECHECK')).status,'OK');
 assert.equal((await f.send('DEV_MEMBER_EXECUTION_STATE')).data.access_error,undefined);
});
test('recovered delivery does not erase capture storage loss warning',async()=>{
 const f=await fixture();f.setCaptureError();f.setStorageFailure(true);await f.send('MEMBER_DELIVERY_RECHECK');
 f.setStorageFailure(false);await f.send('MEMBER_DELIVERY_RECHECK');
 assert.equal((await f.send('DEV_MEMBER_EXECUTION_STATE')).data.access_error,'ACCESS_STORAGE_UNCONFIRMED');
});
test('read-only storage failure keeps data unconfirmed rather than returning empty success',async()=>{
 const f=await fixture();f.setStorageFailure(true);const result=await f.send();
 assert.equal(result.status,'ERROR');assert.equal(result.data,null);assert.equal(result.error.code,'DELIVERY_STORAGE_UNAVAILABLE');
});
