import test from 'node:test';
import assert from 'node:assert/strict';
import {A1Core} from '../member-a1/core.mjs';
import {MemberA1Adapter} from '../integration/member-a1-adapter.mjs';
import {MODE} from '../member-a1/protocol.mjs';
import {fixture} from './member-fixture.mjs';

function confirmation(row){
 const n=row.body.transition_context;
 return {contract:'NR01_REPORT_CONFIRMATION_1',report_id:row.body.report_id,command_id:row.body.command_id,state:{
  session_id:row.body.session_id,owner_user_id:'1',executor_id:row.body.executor_id,
  policy_snapshot_id:row.root_binding.snapshot_ref.policy_snapshot_id,desired_revision:row.body.desired_revision,
  execution_status:'RUNNING',native_transition_contract:'NR01_1',time_accounting_mode:MODE,
  ...(n?{native_transition:{transition_id:n.transition_id,phase:'CONFIRMED',root_generation:n.root_generation}}:{})
 }};
}

async function publication({legacy=false,postDelay=0,getDelay=0,mutate=()=>{}}={}){
 const f=await fixture({nd01:true,dp01:true,nr01:true,d1b5:true,p1:true,limitedProduct11:true});
 Object.assign(f.command,{native_transition_contract:'NR01_1',dom_transition_contract:'DP01_1',document_transition_contract:'ND01_1'});
 await f.core.startCommand(f.command);
 const i={owner_key:f.owner.owner_key,executor_id:f.owner.installation_id,authority:'http://127.0.0.1/fixture'};
 const adapter=new MemberA1Adapter({auth:{status:async()=>({owner_user_id:'1',executor_id:i.executor_id,server_url:i.authority})},core:f.core,db:f.db,authority:{},inspectGuest:async()=>({})});
 const calls=[];let reply;
 adapter.request=async(path,body)=>{
  calls.push({path,body});
  if(body){
   const row=await adapter.read('member:outbox:'+body.report_id);
   reply=confirmation(row);mutate(reply,f);
   f.advance(body.result==='APPLIED'?postDelay:0);
   return {result:'ACCEPTED',desired_revision:body.desired_revision,...(!legacy&&body.result==='APPLIED'?{execution_confirmation:reply}:{})};
  }
  f.advance(getDelay);return reply.state;
 };
 f.env.onNativeWait=async()=>{await adapter.report(f.command,'REVALIDATING');await adapter.flush();};
 f.env.onNativeConfirmed=async()=>{await adapter.report(f.command,'APPLIED');await adapter.flush();};
 return {f,adapter,calls};
}

test('near-deadline confirmation is not held by the legacy follow-up GET; report POST remains mandatory',async t=>{
 // HTTP durations use f.advance; keep request timers on that deterministic timeline.
 t.mock.timers.enable({apis:['setTimeout','Date'],now:Date.now()});
 for(const legacy of [true,false]){
  const {f,adapter,calls}=await publication({legacy,postDelay:49,getDelay:84});
  await f.core.nrBegin(await f.core.bundle());f.advance(4934);
  const tick=async()=>{for(let k=0;k<8&&(await f.core.bundle()).a.session_status==='NATIVE_VERIFYING';k++)await f.core.tick();};
  if(legacy)await assert.rejects(tick(),{message:'REVALIDATION_REQUIRED'});else await tick();
  assert.equal((await f.core.bundle()).a.session_status,legacy?'UNKNOWN':'RUNNING');
  assert.equal(calls.filter(x=>!x.body).length,legacy?1:0);
  assert.equal(calls.filter(x=>x.body?.result==='APPLIED').length,1);
  if(!legacy)assert.equal((await adapter.status()).server_confirmed_running,true);
 }
});

test('delayed report ACK still fails the original five-second fence with inline confirmation',async t=>{
 t.mock.timers.enable({apis:['setTimeout','Date'],now:Date.now()});
 const {f}=await publication({postDelay:67});await f.core.nrBegin(await f.core.bundle());f.advance(4934);
 await assert.rejects(f.core.tick(),{message:'REVALIDATION_REQUIRED'});
 assert.equal((await f.core.bundle()).a.session_status,'UNKNOWN');
});

test('same recorded elapsed-time workload: old coalescing plus GET is 67ms late; immediate check plus inline ACK stays inside the unchanged fence',async t=>{
 // HTTP durations use f.advance; keep request timers on that deterministic timeline.
 t.mock.timers.enable({apis:['setTimeout','Date'],now:Date.now()});
 // A deterministic model of measured durations, not an attribution of the
 // missing historical Worker stack or proof of actual Chrome performance.
 for(const legacy of [true,false]){
  const {f}=await publication({legacy,postDelay:49,getDelay:19});
  let requested;
  f.core.requestCheck=options=>{requested=options;};
  await f.core.nrBegin(await f.core.bundle());
  assert.equal(requested.immediate,true);
  const deadline=(await f.core.bundle()).a.native_transition.deadline_at;
  // 4934ms observed local confirmation = 4884ms work + prior 50ms coalescing.
  // Whether that timer accounts for the historical gap remains an inference.
  f.advance(4884+(legacy?50:0));
  const publish=f.env.onNativeConfirmed;
  f.env.onNativeConfirmed=async()=>{f.advance(47);await publish();f.advance(18);};
  if(legacy)await assert.rejects(f.core.tick(),{message:'REVALIDATION_REQUIRED'});else await f.core.tick();
  assert.equal(f.core.now()-deadline,legacy?67:-2);
  assert.equal((await f.core.bundle()).a.session_status,legacy?'UNKNOWN':'RUNNING');
 }
});

for(const field of ['report_id','command_id','contract'])test('inline ACK rejects mismatched '+field+' without a fallback query',async()=>{
 const {f,calls}=await publication({mutate:x=>{x[field]='wrong';}});
 await f.core.nrBegin(await f.core.bundle());await assert.rejects(f.core.tick(),{message:'REPORT_ACK_UNCONFIRMED'});
 assert.equal((await f.core.bundle()).a.session_status,'UNKNOWN');assert.equal(calls.filter(x=>!x.body).length,0);
});

for(const field of ['owner_user_id','executor_id','session_id','policy_snapshot_id'])test('same snapshot scope checks reject inline '+field+' mismatch',async()=>{
 const {f}=await publication({mutate:x=>{x.state[field]='wrong';}});
 await f.core.nrBegin(await f.core.bundle());await assert.rejects(f.core.tick(),{message:'SERVER_SCOPE_MISMATCH'});
 assert.equal((await f.core.bundle()).a.session_status,'UNKNOWN');
});

test('stale generation or revision and late negative state cannot become a confirmed UI projection',async()=>{
 for(const kind of ['generation','revision','failure','unknown']){
  const {f,adapter}=await publication({mutate:x=>{
   if(kind==='generation')x.state.native_transition.root_generation++;
   if(kind==='revision')x.state.desired_revision++;
   if(kind==='failure')x.state.first_nr_failure={code:'ROOT_UNCONFIRMED'};
   if(kind==='unknown')x.state.execution_status='UNKNOWN';
  }});
  await f.core.nrBegin(await f.core.bundle());
  if(kind==='unknown')await assert.rejects(f.core.tick(),{message:'SERVER_EXECUTION_UNCONFIRMED'});else await f.core.tick();
  assert.equal((await adapter.status()).server_confirmed_running,false);
 }
});

test('lost ACK leaves immutable outbox pending and repeat flush uses the same report ID',async()=>{
 const {f,adapter}=await publication();await f.core.nrBegin(await f.core.bundle());
 let id,posts=0;const request=adapter.request.bind(adapter);
 adapter.request=async(path,body)=>{
  if(body?.result==='APPLIED'){posts++;if(!id){id=body.report_id;throw Error('RESPONSE_LOST');}assert.equal(body.report_id,id);}
  return request(path,body);
 };
 await assert.rejects(f.core.tick(),{message:'RESPONSE_LOST'});
 assert.equal((await adapter.read('member:outbox:'+id)).acked,false);
 await adapter.flush();assert.equal(posts,2);
 assert.equal((await f.core.bundle()).a.session_status,'UNKNOWN','late success never clears UNKNOWN');
 assert.equal((await adapter.status()).server_confirmed_running,false);
});

test('duplicate confirmation and concurrent flush keep one immutable report and one POST',async()=>{
 const {f,adapter,calls}=await publication();await f.core.nrBegin(await f.core.bundle());await f.core.tick();
 const original=calls.find(x=>x.body?.result==='APPLIED').body.report_id;
 const first=await adapter.report(f.command,'APPLIED'),second=await adapter.report(f.command,'APPLIED');
 assert.equal(first.report_id,original);assert.equal(second.report_id,original);
 await Promise.all([adapter.flush(),adapter.flush()]);
 assert.equal(calls.filter(x=>x.body?.result==='APPLIED').length,1);
});

for(const phase of ['report-ACK','legacy-state-GET'])test('a non-returning '+phase+' cannot hold the Core beyond the existing deadline; late completion preserves UNKNOWN',async t=>{
 const {f,adapter}=await publication({legacy:phase==='legacy-state-GET'});
 await f.core.nrBegin(await f.core.bundle());
 let entered,release,finished;
 const atRequest=new Promise(resolve=>{entered=resolve;}),gate=new Promise(resolve=>{release=resolve;}),completed=new Promise(resolve=>{finished=resolve;});
 const request=adapter.request.bind(adapter),publish=f.env.onNativeConfirmed;
 adapter.request=async(path,body)=>{
  if(phase==='report-ACK'&&body?.result==='APPLIED'||phase==='legacy-state-GET'&&!body){entered();await gate;}
  return request(path,body);
 };
 f.env.onNativeConfirmed=async()=>{try{return await publish();}finally{finished();}};
 t.mock.timers.enable({apis:['setTimeout','Date'],now:Date.now()});
 let outcome;
 const tick=f.core.tick().then(()=>{outcome='RESOLVED';},error=>{outcome=error.message;});
 try{
  await atRequest;f.advance(5000);t.mock.timers.tick(5000);
  // Drain real IndexedDB work while the artificial HTTP request stays pending.
  for(let k=0;k<100&&outcome===undefined;k++)await f.core.bundle();
  assert.equal(outcome,'REVALIDATION_REQUIRED');
  const before=await f.core.bundle();assert.equal(before.a.session_status,'UNKNOWN');
  const first=structuredClone(before.a.nr_first_failure),rules=structuredClone(f.rules());
  release();await completed;await tick;
  const after=await f.core.bundle();assert.equal(after.a.session_status,'UNKNOWN');
  assert.deepEqual(after.a.nr_first_failure,first);assert.deepEqual(f.rules(),rules);
  assert.equal((await adapter.status()).server_confirmed_running,false);
 }finally{release();await completed;await tick;}
});

test('a non-returning REVALIDATING report also expires within the original fence without opening local APPLY',async t=>{
 const {f,adapter,calls}=await publication();let entered,release,finished,outcome;
 const atRequest=new Promise(resolve=>{entered=resolve;}),gate=new Promise(resolve=>{release=resolve;}),completed=new Promise(resolve=>{finished=resolve;});
 const request=adapter.request.bind(adapter);
 adapter.request=async(path,body)=>{if(body?.result==='REVALIDATING'){entered();try{await gate;return await request(path,body);}finally{finished();}}return request(path,body);};
 t.mock.timers.enable({apis:['setTimeout','Date'],now:Date.now()});
 const begin=f.core.nrBegin(await f.core.bundle()).then(()=>{outcome='RESOLVED';},e=>{outcome=e.message;});
 try{
  await atRequest;f.advance(5000);t.mock.timers.tick(5000);
  for(let k=0;k<100&&outcome===undefined;k++)await f.core.bundle();
  assert.equal(outcome,'REVALIDATION_REQUIRED');assert.equal((await f.core.bundle()).a.session_status,'UNKNOWN');
  assert.equal(calls.some(x=>x.body?.result==='APPLIED'),false);
  release();await completed;await begin;
  assert.equal((await f.core.bundle()).a.session_status,'UNKNOWN');
  assert.equal((await adapter.status()).server_confirmed_running,false);
 }finally{release();await completed;await begin;}
});

test('failed actual Content response cannot publish an APPLIED confirmation',async()=>{
 const {f,calls}=await publication();await f.core.nrBegin(await f.core.bundle());
 const send=f.chrome.tabs.sendMessage;
 f.chrome.tabs.sendMessage=async(tab,m,options)=>m.payload?.operation==='APPLY'?{request_id:m.request_id,status:'ERROR',error:{code:'INVALID_EFFECT_EVIDENCE'}}:send(tab,m,options);
 await assert.rejects(f.core.tick());
 assert.equal(calls.some(x=>x.body?.result==='APPLIED'),false);
 assert.equal((await f.core.bundle()).a.session_status,'UNKNOWN');
});

test('Worker recreation cannot reuse the prior generation inline ACK as current RUNNING proof',async()=>{
 const {f,adapter}=await publication();
 Object.defineProperty(adapter,'core',{get:()=>f.core});
 await f.core.nrBegin(await f.core.bundle());await f.core.tick();
 assert.equal((await adapter.status()).server_confirmed_running,true);
 const before=await f.core.bundle();f.advance(1000);await f.restart();
 const pending=await f.core.bundle();assert.equal(pending.a.session_id,before.a.session_id);
 assert.notEqual(pending.a.native_transition.transition_id,before.a.native_transition.transition_id);
 assert.equal((await adapter.status()).server_confirmed_running,false);
 for(let k=0;k<8&&(await f.core.bundle()).a.session_status==='NATIVE_VERIFYING';k++)await f.core.tick();
 assert.equal((await adapter.status()).server_confirmed_running,true);
});

test('non-returning Worker-recreation report retains the session and first failure after boot deadline',async t=>{
 const {f,adapter}=await publication();Object.defineProperty(adapter,'core',{get:()=>f.core});
 await f.core.nrBegin(await f.core.bundle());await f.core.tick();
 const sid=(await f.core.bundle()).a.session_id;
 let entered,release,finished,outcome;
 const atRequest=new Promise(resolve=>{entered=resolve;}),gate=new Promise(resolve=>{release=resolve;}),completed=new Promise(resolve=>{finished=resolve;});
 const request=adapter.request.bind(adapter);
 adapter.request=async(path,body)=>{if(body?.result==='REVALIDATING'){entered();try{await gate;return await request(path,body);}finally{finished();}}return request(path,body);};
 t.mock.timers.enable({apis:['setTimeout','Date'],now:Date.now()});f.advance(1000);
 const boot=f.restart().then(()=>{outcome='RESOLVED';},e=>{outcome=e.message;});
 try{
  await atRequest;f.advance(5000);t.mock.timers.tick(5000);
  for(let k=0;k<100&&outcome===undefined;k++)await f.core.bundle();
  assert.equal(outcome,'REVALIDATION_REQUIRED');
  const before=await f.core.bundle();assert.equal(before.a.session_id,sid);assert.equal(before.a.session_status,'UNKNOWN');
  const first=structuredClone(before.a.nr_first_failure);release();await completed;await boot;
  assert.deepEqual((await f.core.bundle()).a.nr_first_failure,first);
  assert.equal((await adapter.status()).server_confirmed_running,false);
 }finally{release();await completed;await boot;}
});

test('existing same-session Core END after Worker recreation requires a fresh matching native document and preserves first failure',async t=>{
 t.mock.timers.enable({apis:['setTimeout','Date'],now:Date.now()});
 const {f,adapter}=await publication({postDelay:67});Object.defineProperty(adapter,'core',{get:()=>f.core});
 await f.core.nrBegin(await f.core.bundle());f.advance(4934);
 await assert.rejects(f.core.tick(),{message:'REVALIDATION_REQUIRED'});
 const before=await f.core.bundle(),first=structuredClone(before.a.nr_first_failure);
 await f.restart();assert.equal((await f.core.bundle()).a.session_status,'UNKNOWN');
 await f.core.end(f.command.session_id);
 const after=await f.core.bundle();assert.equal(after.a.session_id,before.a.session_id);
 assert.equal(after.a.session_status,'ENDED');assert.deepEqual(after.a.nr_first_failure,first);
 assert.equal(f.rules().length,0);assert.equal(after.state.journal.observed,'RELEASED');
});

test('NR immediate check preempts a coalesced timer without parallel ticks and survives a UI hold',async t=>{
 const tasks=new Map();let next=0,ticks=0,finish;
 t.mock.method(globalThis,'setTimeout',(fn,delay)=>{tasks.set(++next,{fn,delay});return next;});
 t.mock.method(globalThis,'clearTimeout',id=>tasks.delete(id));
 const core={requestCheck:A1Core.prototype.requestCheck,tick:()=>{ticks++;return new Promise(resolve=>{finish=resolve;});}};
 core.requestCheck();assert.equal([...tasks.values()][0].delay,50);
 core.requestCheck({immediate:true});assert.equal(tasks.size,1);assert.equal([...tasks.values()][0].delay,0);
 const urgentTimer=core.checkTimer;core.requestCheck({immediate:true});assert.equal(core.checkTimer,urgentTimer,'repeated notifications cannot postpone an urgent timer');
 const run=()=>{const [id,task]=tasks.entries().next().value;tasks.delete(id);task.fn();};
 run();core.requestCheck({immediate:true});assert.equal(ticks,1);assert.equal(tasks.size,0);
 finish();await new Promise(resolve=>queueMicrotask(()=>queueMicrotask(resolve)));
 assert.equal([...tasks.values()][0].delay,0);
 core.uiPending=true;run();assert.equal(ticks,1);assert.equal(core.checkUrgent,true);
 core.uiPending=false;core.requestCheck();assert.equal([...tasks.values()][0].delay,0);
});
