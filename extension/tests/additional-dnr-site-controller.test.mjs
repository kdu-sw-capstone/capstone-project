import test from 'node:test';
import assert from 'node:assert/strict';
import {locks} from 'node:worker_threads';
import {IDBFactory,IDBObjectStore} from 'fake-indexeddb';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {SiteController} from '../src/site-controller.js';
import {MemberJournalStore} from '../src/member-journal-store.js';
import {createMemberDB} from '../member-a1/db.mjs';
import {AdditionalDnrStore} from '../src/additional-dnr-store.js';
import {LegacyDnrWriter} from '../src/additional-dnr-legacy-writer.js';
import {bundleMemberWorker} from '../scripts/build-member-worker.js';
import {completeSnapshot,completeSite} from './fixtures/snapshot.mjs';

async function fixture(){
 const indexedDB=new IDBFactory(),journal=new MemberJournalStore({indexedDB}),runtime=new AdditionalDnrStore(createMemberDB(indexedDB,'runtime'));
 const authContext=vm.createContext({URL});vm.runInContext(readFileSync(new URL('../background/member-auth.js',import.meta.url),'utf8'),authContext);
 const Auth=authContext.FocurveMemberAuth;let time=Date.now(),rules=[],adds=0;
 const context={owner_key:'MEMBER:42',executor_id:crypto.randomUUID(),session_id:crypto.randomUUID(),revision:1,desired:'APPLIED',reconciled:true};
 const command={command_id:crypto.randomUUID(),session_id:context.session_id,executor_id:context.executor_id,type:'APPLY_POLICY',desired_revision:1,duration_minutes:5,created_at:new Date(time).toISOString(),execute_before:new Date(time+30000).toISOString(),snapshot:completeSnapshot({format_version:'1.1',policy_snapshot_id:crypto.randomUUID(),executor_id:context.executor_id,owner_user_id:'42',sites:[completeSite({canonical_host:'example.com',include_subdomains:false,access_policy:'BLOCK'},'42')]})};
 const dnr={getSessionRules:async()=>structuredClone(rules),isRegexSupported:async()=>({isSupported:true}),updateSessionRules:async({addRules=[],removeRuleIds=[]})=>{if(addRules.length)adds++;rules=rules.filter(r=>!removeRuleIds.includes(r.id)).concat(structuredClone(addRules));}};
 const writer=new LegacyDnrWriter({store:runtime,dnr,locks});
 const f={indexedDB,journal,runtime,Auth,context,command,dnr,writer,getContext:async()=>structuredClone(context),rules:()=>structuredClone(rules),adds:()=>adds,advance:ms=>{time+=ms;},now:()=>time};
 f.controller=new SiteController({dnr,journal,tabs:{query:async()=>[]},getContext:()=>f.getContext(),getDnrContext:async()=>({...await f.getContext(),command_id:f.command.command_id}),blockedPageUrl:'chrome-extension://test/blocked/index.html',now:f.now,dnrWriter:(r,send)=>writer.write('SESSION',r,send),dnrAuthorityState:()=>Auth.AuthStore.writeState()});
 f.entry=()=>journal.load(context.owner_key,context.session_id);
 f.release=()=>{context.revision=2;context.desired='RELEASED';return {...command,command_id:crypto.randomUUID(),type:'RELEASE_POLICY',desired_revision:2};};
 f.protect=async()=>runtime.mutate(s=>{s.writer_epoch=2;s.claims.push({claim_id:crypto.randomUUID(),owner_binding_id:crypto.randomUUID(),generation:1,writer_epoch:1,rule_key:{rule_store:'SESSION',rule_id:1},rule_sha256:'a'.repeat(64),restore_state:'UNCONFIRMED'});});
 return f;
}
async function queue(f,operation){
 let held,unlock,queued;const entered=new Promise(r=>{held=r;}),release=new Promise(r=>{unlock=r;}),waiting=new Promise(r=>{queued=r;});
 const blocker=locks.request('focurve:amvp:dnr-writer',async()=>{held();await release;});await entered;
 f.controller.dnrWriter=(r,send)=>{queued();return f.writer.write('SESSION',r,send);};
 const work=operation();work.catch(()=>{});
 try{await Promise.race([waiting,work.then(()=>{throw Error('NO_DNR_GATE');})]);}catch(error){unlock();await blocker;throw error;}
 return {work,release:async()=>{unlock();await blocker;}};
}
test('SiteController normal durable APPLY/RELEASE uses common writer and CAS',async()=>{
 const f=await fixture();assert.equal((await f.controller.apply(f.command)).observed,'APPLIED');assert.equal(f.rules().length,1);
 assert.equal((await f.controller.release(f.release())).observed,'RELEASED');assert.equal(f.rules().length,0);assert.equal((await f.entry()).observed,'RELEASED');
});
test('protected runtime ID blocks SiteController add and rollback without claiming release',async()=>{
 const f=await fixture();await f.protect();await assert.rejects(f.controller.apply(f.command),/ROLLBACK_UNCONFIRMED/);
 assert.equal(f.adds(),0);assert.equal((await f.entry()).observed,'UNCONFIRMED');assert.equal((await f.runtime.read()).claims[0].restore_state,'UNCONFIRMED');
});
test('protected runtime claim preserves actual rules and pending release journal',async()=>{
 const f=await fixture();await f.controller.apply(f.command);await f.protect();await assert.rejects(f.controller.release(f.release()),/DNR_RUNTIME_CLAIM_PROTECTED/);
 assert.equal(f.rules().length,1);assert.equal((await f.entry()).observed,'UNCONFIRMED');assert.equal((await f.entry()).desired,'RELEASED');
});
for(const change of ['owner','executor','revision','deadline','identity-failure'])test(`queued SiteController add rejects ${change}`,async()=>{
 const f=await fixture(),queued=await queue(f,()=>f.controller.apply(f.command));
 if(change==='owner')f.context.owner_key='MEMBER:43';if(change==='executor')f.context.executor_id=crypto.randomUUID();if(change==='revision')f.context.revision++;
 if(change==='deadline')f.advance(31000);if(change==='identity-failure')f.getContext=async()=>{throw Error('IDENTITY_UNAVAILABLE');};
 const rejected=assert.rejects(queued.work,/SNAPSHOT_OWNER_MISMATCH|OWNER_CHANGED|EXECUTION_SCOPE_MISMATCH|STALE_COMMAND|APPLY_EXPIRED_OR_INVALID|IDENTITY_UNAVAILABLE/);await queued.release();await rejected;
 assert.equal(f.adds(),0);assert.equal(f.rules().length,0);
});
test('auth write starting after fresh context read blocks final SiteController dispatch',async()=>{
 const f=await fixture();let once=true;
 f.controller.dnrWriter=(r,dispatch)=>f.writer.write('SESSION',r,send=>{
  const original=f.journal.withFootprint.bind(f.journal);
  f.journal.withFootprint=(entry,callback,options)=>{
   if(once&&options.applying){once=false;new f.Auth.AuthStore({setAccessLevel:async()=>{},set:async()=>{}}).put({phase:'LINKED'}).catch(()=>{});}
   return original(entry,callback,options);
  };return dispatch(send);
 });
 await assert.rejects(f.controller.apply(f.command),/OWNER_CHANGED/);assert.equal(f.adds(),0);assert.equal(f.rules().length,0);
});
test('queued old-owner cleanup remains available with durable exact footprint',async()=>{
 const f=await fixture();await f.controller.apply(f.command);const release=f.release(),queued=await queue(f,()=>f.controller.release(release));
 f.context.owner_key='MEMBER:43';await queued.release();await queued.work;assert.equal(f.rules().length,0);
 assert.equal((await f.journal.load('MEMBER:42',f.command.session_id)).observed,'RELEASED');
});
test('queued physical rule replacement cannot be removed by SiteController',async()=>{
 const f=await fixture();await f.controller.apply(f.command);const queued=await queue(f,()=>f.controller.release(f.release()));
 const foreign={id:1,priority:1,action:{type:'block'},condition:{urlFilter:'||foreign.example^'}};await f.dnr.updateSessionRules({removeRuleIds:[1],addRules:[foreign]});
 const rejected=assert.rejects(queued.work,/RULE_OWNERSHIP_CONFLICT/);await queued.release();await rejected;assert.deepEqual(f.rules(),[foreign]);
});
test('new journal operation while queued cannot be overwritten by old rollback',async()=>{
 const f=await fixture(),queued=await queue(f,()=>f.controller.apply(f.command));const original=await f.entry(),replacement={...original,command_id:crypto.randomUUID(),revision:2,action_seq:2};
 await f.journal.save(replacement);const rejected=assert.rejects(queued.work,/ROLLBACK_UNCONFIRMED/);await queued.release();await rejected;
 assert.equal(f.adds(),0);assert.deepEqual(await f.entry(),replacement);
});
test('late RELEASE cannot confirm or overwrite a replacement journal',async()=>{
 const f=await fixture();await f.controller.apply(f.command);const queued=await queue(f,()=>f.controller.release(f.release())),pending=await f.entry();
 const replacement={...pending,command_id:crypto.randomUUID(),revision:3,action_seq:3,observed:'UNCONFIRMED'};await f.journal.save(replacement);
 const rejected=assert.rejects(queued.work,/JOURNAL_SCOPE_MISMATCH/);await queued.release();await rejected;assert.deepEqual(await f.entry(),replacement);assert.equal(f.rules().length,1);
});
test('CAS creation and update reject stale journal versions without mutation',async()=>{
 const f=await fixture();await f.controller.apply(f.command);const row=await f.entry(),next={...row,revision:2};
 await assert.rejects(f.journal.save(next,{expected:null}),/JOURNAL_CONFLICT/);assert.deepEqual(await f.entry(),row);
 await f.journal.save(next,{expected:row});await assert.rejects(f.journal.save(row,{expected:row}),/JOURNAL_CONFLICT/);assert.deepEqual(await f.entry(),next);
});
test('missing durable footprint callback denies gate-enabled writes',async()=>{
 const f=await fixture();f.journal.withFootprint=undefined;await assert.rejects(f.controller.apply(f.command),/ROLLBACK_UNCONFIRMED/);assert.equal(f.adds(),0);assert.equal((await f.entry()).observed,'UNCONFIRMED');
});
test('request outside the journal footprint never reaches native DNR',async()=>{
 const f=await fixture();await f.controller.apply(f.command);const entry=await f.entry();
 await assert.rejects(f.controller.writeOwned(entry,{removeRuleIds:[999]}),/JOURNAL_SCOPE_MISMATCH/);assert.equal(f.rules().length,1);
});
test('native promise never holds the Member journal transaction',async()=>{
 const f=await fixture();await f.controller.apply(f.command);const native=f.dnr.updateSessionRules;let entered,complete;
 const waiting=new Promise(r=>{entered=r;});f.dnr.updateSessionRules=r=>{entered();return new Promise(resolve=>{complete=()=>resolve(native(r));});};
 const release=f.controller.release(f.release());await waiting;let timer;
 try{await Promise.race([f.journal.transaction('readwrite',(store,done)=>{store.put({owner_key:'MEMBER:99',session_id:crypto.randomUUID(),marker:true});done(null);}),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('DB_HELD_BY_NATIVE')),1000);})]);}finally{clearTimeout(timer);complete();}
 await release;assert.equal(f.rules().length,0);
});
test('generated Member loop cleanup discovers the installed gate and preserves protected obligations',async()=>{
 const f=await fixture();await f.controller.apply(f.command);await f.protect();
 const world=vm.createContext({URL,Date,crypto,structuredClone,setTimeout,clearTimeout,indexedDB:f.indexedDB,FocurveHostPolicy:globalThis.FocurveHostPolicy,FocurveMemberAuth:f.Auth,FocurveMemberDnrWriter:{write:(r,send)=>f.writer.write('SESSION',r,send)}});
 const source=readFileSync(new URL('../background/member-execution.js',import.meta.url),'utf8');assert.equal(source,bundleMemberWorker());vm.runInContext(source+'\nglobalThis.loopType=FocurveMemberExecution.MemberExecutionLoop;',world);
 const identity={owner_key:f.context.owner_key,executor_id:f.context.executor_id};
 const loop=new world.loopType({client:{baseUrl:'https://api.test'},getCredentials:async()=>identity,getIdentity:async()=>identity,idle:async()=>{},journal:f.journal,accessStore:{},dnr:f.dnr,tabs:{query:async()=>[]},blockedPageUrl:'chrome-extension://test/blocked/index.html'});
 await assert.rejects(loop.cleanup({...identity,session_id:f.context.session_id,base_url:'https://api.test'}),/DNR_RUNTIME_CLAIM_PROTECTED/);
 assert.equal(f.rules().length,1);assert.equal((await f.entry()).observed,'UNCONFIRMED');
});

test('invalid persisted Snapshot does not block legitimate exact SiteController RELEASE',async()=>{
 const f=await fixture();await f.controller.apply(f.command);const row=await f.entry();row.snapshot.format_version='unsupported';await f.journal.save(row);
 await f.controller.release(f.release());assert.equal(f.rules().length,0);assert.equal((await f.entry()).snapshot.format_version,'unsupported');assert.equal((await f.entry()).observed,'RELEASED');
});
test('native APPLY failure propagates after exact rollback without a false APPLIED',async()=>{
 const f=await fixture(),native=f.dnr.updateSessionRules;f.dnr.updateSessionRules=r=>r.addRules?.length?Promise.reject(Error('NATIVE_REJECTED')):native(r);
 await assert.rejects(f.controller.apply(f.command),/NATIVE_REJECTED/);assert.equal(f.rules().length,0);assert.equal((await f.entry()).observed,'RELEASED');
});
test('CAS post-effect put failure aborts and rolls back without overwriting journal',async()=>{
 const f=await fixture(),original=IDBObjectStore.prototype.put;let once=true;
 IDBObjectStore.prototype.put=function(value,...args){if(once&&this.transaction.db.name==='focurve-member-execution'&&value.observed==='APPLIED'){once=false;throw Error('QUOTA');}return original.call(this,value,...args);};
 try{await assert.rejects(f.controller.apply(f.command),/QUOTA/);}finally{IDBObjectStore.prototype.put=original;}
 assert.equal(f.rules().length,0);assert.equal((await f.entry()).observed,'RELEASED');
});

test('gate-enabled standalone controller cannot invent a local command authority',async()=>{
 const f=await fixture();f.controller.getDnrContext=null;
 await assert.rejects(f.controller.apply(f.command),/LOCAL_DNR_CONTEXT_UNAVAILABLE/);assert.equal(f.adds(),0);assert.equal((await f.entry()).observed,'RELEASED');
});
test('generated Member APPLY does not nest Auth.serial or HTTP while holding the DNR lock',async()=>{
 const f=await fixture(),base='https://api.test/api/v1',identity={owner_key:f.context.owner_key,executor_id:f.context.executor_id};
 const record={phase:'LINKED',server_url:base,web_origin:'https://web.test',owner_user_id:'42',executor_id:identity.executor_id};
 const auth=new f.Auth.MemberAuth({store:{get:async()=>structuredClone(record)},getInstallation:async()=>({installation_id:identity.executor_id}),fetch:()=>{throw Error('UNEXPECTED_HTTP');}});
 let inside=false,unlock,holder;
 const globalGate={write:(r,dispatch)=>f.writer.write('SESSION',r,async send=>{
  if(!r.addRules?.length)return dispatch(send);
  let held;const entered=new Promise(resolve=>{held=resolve;}),release=new Promise(resolve=>{unlock=resolve;});
  holder=auth.serial(async()=>{held();await release;});await entered;inside=true;
  try{return await dispatch(send);}finally{inside=false;unlock();}
 })};
 const world=vm.createContext({URL,Date,crypto,structuredClone,setTimeout,clearTimeout,indexedDB:f.indexedDB,FocurveHostPolicy:globalThis.FocurveHostPolicy,FocurveMemberAuth:f.Auth,FocurveMemberDnrWriter:globalGate,__memberIntegration:{auth}});
 vm.runInContext(readFileSync(new URL('../background/member-execution.js',import.meta.url),'utf8')+'\nglobalThis.loopType=FocurveMemberExecution.MemberExecutionLoop;',world);
 const client={baseUrl:base,session:async()=>{assert.equal(inside,false,'remote context cannot run under DNR lock');return {executor_id:identity.executor_id,desired_revision:1,execution_status:'STARTING',automatic_recovery_supported:false,time_accounting_mode:'LEGACY_WALL_CLOCK',policy_snapshot_id:f.command.snapshot.policy_snapshot_id,duration_minutes:5};}};
 const loop=new world.loopType({client,getCredentials:async()=>{await auth.status();return identity;},idle:async()=>{},journal:f.journal,accessStore:{},dnr:f.dnr,tabs:{query:async()=>[]},blockedPageUrl:'chrome-extension://test/blocked/index.html',now:f.now});loop.command=f.command;
 const work=loop.controller.apply(f.command);work.catch(()=>{});let timer;
 try{await Promise.race([work,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('AUTH_DNR_DEADLOCK')),1000);})]);}
 finally{clearTimeout(timer);unlock?.();}
 await holder;assert.equal(f.rules().length,1);assert.equal((await f.entry()).observed,'APPLIED');
});
