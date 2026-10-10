import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
const executor = '11111111-1111-4111-8111-111111111111';
async function fixture() {
  let external, alarmListener, calls = 0, now = 1000, tickImpl;
  const alarms = new Map(), created = [];
  const auth = { phase:'LINKED',owner_user_id:'1',executor_id:executor,server_url:'http://127.0.0.1:8080/api/v1',web_origin:'http://127.0.0.1:5173' };
  class Clock extends Date { static now() { return now; } }
  const context = vm.createContext({URL,Date:Clock,MemberAuthRuntime:{status:async()=>({...auth}),credentials:()=>assert.fail('external wake must not return credentials')},
    GuestSession:{state:async()=>null},FocurveMemberEvents:{MemberEventStore:class {},MemberEventDelivery:class {async flush(){return [];}}},FocurveMemberExecution:{MemberExecutionClient:class {},MemberExecutionLoop:class {
      constructor(){this.access={store:{originals:async()=>[]}};this.view={session_id:null};} async tick(){calls++;if(tickImpl)return tickImpl();return now<2000?{status:'RUNNING',planned_end_at:new Date(2000).toISOString()}:{status:'IDLE'};}
    }},chrome:{runtime:{id:'self',getURL:p=>'chrome-extension://self/'+p,onMessage:{addListener(){}},onMessageExternal:{addListener:f=>{external=f;}},onStartup:{addListener(){}}},
      alarms:{get:async name=>alarms.get(name),create:async(name,opts)=>{created.push(name);alarms.set(name,{scheduledTime:opts.when,...opts});},clear:async name=>alarms.delete(name),onAlarm:{addListener:f=>{alarmListener=f;}}},declarativeNetRequest:{},tabs:{}}});
  vm.runInContext(await readFile(new URL('../background/member-execution-runtime.js',import.meta.url),'utf8'),context);
  await new Promise(r=>setImmediate(r));
  const message={type:'FOCURVE_EXECUTION_WAKE',request_id:'wake',owner_context:null,payload:{executor_id:executor}};
  const sender={url:auth.web_origin+'/',frameId:0,tab:{id:1}};
  return {external,message,sender,auth,alarms,created,alarmListener,get calls(){return calls;},setTick(fn){tickImpl=fn;},advance(value){now=value;}};
}
test('Web wake checks bound origin/executor, acknowledges hint only and immediately polls without waiting for periodic alarm',async()=>{
  const f=await fixture(), baseline=f.calls;
  const reply=await new Promise(r=>f.external(f.message,f.sender,r));
  await new Promise(r=>setImmediate(r));
  assert.equal(reply.data.received,true);assert.equal(f.calls,baseline+1);
  assert.deepEqual(Object.keys(reply.data),['received']);
  assert.equal(f.created.filter(x=>x==='focurve-member-execution').length,1);
});
test('other origins/ports, wrong executor, auth recovery and arbitrary message commands cannot trigger polling',async()=>{
  const f=await fixture(), baseline=f.calls;
  for(const change of [{sender:{...f.sender,url:'http://127.0.0.1:6000/'}},{sender:{...f.sender,url:'https://evil.example/'}},{message:{...f.message,payload:{executor_id:'22222222-2222-4222-8222-222222222222'}}}]){
    const reply=await new Promise(r=>f.external(change.message||f.message,change.sender||f.sender,r));assert.equal(reply.data.received,false);
  }
  f.auth.phase='AUTH_RECOVERY_REQUIRED';assert.equal((await new Promise(r=>f.external(f.message,f.sender,r))).data.received,false);
  assert.equal(f.calls,baseline);
  for(const sender of [{...f.sender,id:'other-extension'},{...f.sender,frameId:1},{url:f.sender.url,frameId:0}])
    assert.equal(f.external(f.message,sender,()=>assert.fail('rejected sender')),undefined);
  assert.equal(f.external({...f.message,payload:{executor_id:executor,snapshot:{}}},f.sender,()=>assert.fail('command injection')),undefined);
});
test('wake during an in-flight tick retains one follow-up, so a quick END is not lost',async()=>{
  const f=await fixture(), baseline=f.calls;
  let complete;f.setTick(()=>new Promise(r=>{complete=r;}));
  await new Promise(r=>f.external(f.message,f.sender,r));
  await new Promise(r=>setImmediate(r));
  for(let i=0;i<4;i++)await new Promise(r=>f.external(f.message,f.sender,r));
  assert.equal(f.calls,baseline+1);
  f.setTick(null);complete({status:'IDLE'});await new Promise(r=>setImmediate(r));
  assert.equal(f.calls,baseline+2);
  assert.equal(f.created.filter(x=>x==='focurve-member-execution').length,1);
});
test('CONNECT waits for authenticated polling before exposing only the local installation',async()=>{
  const f=await fixture();let complete;
  f.setTick(()=>new Promise(r=>{complete=r;}));
  const message={...f.message,type:'FOCURVE_EXECUTION_CONNECT',payload:{}};
  let answered=false;const pending=new Promise(r=>f.external(message,f.sender,data=>{answered=true;r(data);}));
  await new Promise(r=>setImmediate(r));assert.equal(answered,false);
  complete({status:'IDLE'});const reply=await pending;
  assert.deepEqual(Object.keys(reply.data),['executor_id']);assert.equal(reply.data.executor_id,executor);
});
test('CONNECT rejects failed polling, auth changes, wrong origin and injected fields',async()=>{
  const f=await fixture(),message={...f.message,type:'FOCURVE_EXECUTION_CONNECT',payload:{}};
  f.setTick(async()=>{throw new Error('network unavailable');});
  assert.equal((await new Promise(r=>f.external(message,f.sender,r))).status,'ERROR');
  f.setTick(async()=>{f.auth.executor_id='22222222-2222-4222-8222-222222222222';return {status:'IDLE'};});
  assert.equal((await new Promise(r=>f.external(message,f.sender,r))).status,'ERROR');
  const baseline=f.calls;
  const reply=await new Promise(r=>f.external(message,{...f.sender,url:'http://127.0.0.1:6000/'},r));
  assert.equal(reply.data.executor_id,undefined);assert.equal(f.calls,baseline);
  assert.equal(f.external({...message,payload:{executor_id:executor}},f.sender,()=>assert.fail('injected CONNECT')),undefined);
});
test('deadline alarm triggers the authenticated coordinator directly and is cleared after completion',async()=>{
  const f=await fixture(), baseline=f.calls;assert.equal(f.alarms.get('focurve-member-deadline').scheduledTime,2000);
  f.advance(2000);f.alarmListener({name:'focurve-member-deadline'});await new Promise(r=>setImmediate(r));
  assert.equal(f.calls,baseline+1);assert.equal(f.alarms.has('focurve-member-deadline'),false);
});
