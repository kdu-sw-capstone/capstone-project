import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {summarize} from '../src/member-events.js';
async function fixture(changeDuringRead=false){
 let listener, owner='1', flushes=0;
 const context=vm.createContext({
  MemberAuthRuntime:{status:async()=>({phase:'LINKED',owner_user_id:owner,executor_id:'installation',server_url:'http://localhost/api/v1'}),credentials:async()=>assert.fail('read-only summary must not obtain bearer token')},
  GuestSession:{state:async()=>null},
  FocurveMemberEvents:{summarize,MemberEventStore:class {async list(){if(changeDuringRead)owner='2';return [{owner_key:'MEMBER:1',executor_id:'installation',event_id:'event',status:'REJECTED',body:'private original'}];}},
   MemberEventDelivery:class {constructor({store}){this.store=store;}async flush(){flushes++;return [];}}},
  FocurveMemberExecution:{MemberExecutionClient:class {},MemberExecutionLoop:class {constructor(){this.view={};this.access={store:{originals:async()=>[]}};}async tick(){return {status:'IDLE'};}}},
  chrome:{runtime:{id:'self',getURL:path=>'chrome-extension://self/'+path,onMessage:{addListener:fn=>listener=fn},onMessageExternal:{addListener(){}},onStartup:{addListener(){}}},alarms:{get:async()=>({}),clear:async()=>true,create:async()=>{},onAlarm:{addListener(){}}},tabs:{},declarativeNetRequest:{}}
 });
 vm.runInContext(await readFile(new URL('../background/member-execution-runtime.js',import.meta.url),'utf8'),context);
 await new Promise(resolve=>setTimeout(resolve,0));
 return {send:(type='MEMBER_DELIVERY_STATE',sender={id:'self',url:'chrome-extension://self/popup/popup.html',frameId:0},payload={})=>new Promise(resolve=>{const accepted=listener({type,request_id:'test',payload},sender,resolve);if(!accepted)resolve(null);}),get flushes(){return flushes;}};
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
