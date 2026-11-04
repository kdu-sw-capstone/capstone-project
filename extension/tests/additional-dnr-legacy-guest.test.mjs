import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {locks} from 'node:worker_threads';
import {IDBFactory,IDBObjectStore} from 'fake-indexeddb';
import {createMemberDB} from '../member-a1/db.mjs';
import {AdditionalDnrStore} from '../src/additional-dnr-store.js';
import {LegacyDnrWriter} from '../src/additional-dnr-legacy-writer.js';
import {completeSite} from './fixtures/snapshot.mjs';

async function fixture(){
 let owner={installation_id:crypto.randomUUID()},phase='UNREGISTERED',time=Date.now(),rules=[],adds=0;
 owner.owner_key='GUEST:'+owner.installation_id;
 class Clock extends Date{constructor(...args){super(...(args.length?args:[time]));}static now(){return time;}}
 const indexedDB=new IDBFactory(),dnr={getSessionRules:async()=>structuredClone(rules),isRegexSupported:async()=>({isSupported:true}),updateSessionRules:async({addRules=[],removeRuleIds=[]})=>{if(addRules.length)adds++;rules=rules.filter(r=>!removeRuleIds.includes(r.id)).concat(structuredClone(addRules));}};
 const context=vm.createContext({indexedDB,crypto,Date:Clock,URL,structuredClone,setTimeout,clearTimeout,
  chrome:{runtime:{getURL:p=>'chrome-extension://test/'+p},storage:{session:{get:async()=>({focurve_boot:true}),set:async()=>{}}},alarms:{create:async()=>{},clear:async()=>{}},tabs:{query:async()=>[]},declarativeNetRequest:dnr},
  LocalStore:{guestContext:async()=>structuredClone(owner)},GuestSites:{list:async()=>({items:[completeSite({canonical_host:'example.com',include_subdomains:false,purpose:'DISTRACTION',access_policy:'BLOCK',feature_policies:[]})],settings_version:1}),validate:()=>{}},
  __memberIntegration:{auth:{load:async()=>({phase})}},__memberRootAuthority:{idle:async()=>true},AccessStore:{}});
 for(const file of ['host-policy.js','session-db.js','member-auth.js','session-core.js'])vm.runInContext(readFileSync(new URL('../background/'+file,import.meta.url),'utf8'),context);
 const db=vm.runInContext('SessionDB',context),core=vm.runInContext('GuestSession',context),store=new AdditionalDnrStore(createMemberDB(indexedDB,'legacy-runtime'));
 const writer=new LegacyDnrWriter({store,dnr,locks});context.FocurveMemberDnrWriter={write:(r,send)=>writer.write('SESSION',r,send)};
 const protect=async()=>store.mutate(s=>{s.writer_epoch=2;s.claims.push({claim_id:crypto.randomUUID(),owner_binding_id:crypto.randomUUID(),generation:1,writer_epoch:1,rule_key:{rule_store:'SESSION',rule_id:100000},rule_sha256:'a'.repeat(64),restore_state:'UNCONFIRMED'});});
 return {context,db,core,store,writer,dnr,protect,start:()=>core.start(5,crypto.randomUUID()),rules:()=>structuredClone(rules),adds:()=>adds,owner:()=>owner,setOwner:o=>{owner=o;},setPhase:p=>{phase=p;},advance:ms=>{time+=ms;}};
}
async function queue(f,operation){
 let unlock,held,queued;const release=new Promise(r=>{unlock=r;}),entered=new Promise(r=>{held=r;}),waiting=new Promise(r=>{queued=r;});
 const blocker=locks.request('focurve:amvp:dnr-writer',async()=>{held();await release;});await entered;
 f.context.FocurveMemberDnrWriter.write=(r,send)=>{queued();return f.writer.write('SESSION',r,send);};
 const work=operation();work.catch(()=>{});
 try{await Promise.race([waiting,work.then(()=>{throw Error('OPERATION_FINISHED_BEFORE_DNR_GATE');})]);}
 catch(error){unlock();await blocker;throw error;}
 return {work,release:async()=>{unlock();await blocker;}};
}

test('legacy GuestSession normal START/END uses real DB with the shared gate',async()=>{
 const f=await fixture();await f.start();const b=await f.db.load();assert.equal(b.session.status,'RUNNING');assert.ok(f.rules().length>0);
 await f.core.end(b.session.session_id);assert.equal(f.rules().length,0);assert.equal((await f.db.load()).journal.observed,'RELEASED');
});
test('legacy GuestSession cannot overwrite or clean a protected runtime claim',async()=>{
 const f=await fixture();await f.protect();await assert.rejects(f.start(),/RELEASE_UNCONFIRMED/);
 assert.equal(f.adds(),0);assert.equal(f.rules().length,0);assert.equal((await f.store.read()).claims[0].restore_state,'UNCONFIRMED');assert.equal((await f.db.load()).session.status,'UNKNOWN');
});
test('legacy END preserves pending cleanup when runtime claim protects an owned ID',async()=>{
 const f=await fixture();await f.start();const b=await f.db.load();await f.protect();
 await assert.rejects(f.core.end(b.session.session_id),/DNR_RUNTIME_CLAIM_PROTECTED/);assert.ok(f.rules().length>0);
 const after=await f.db.load();assert.equal(after.session.status,'UNKNOWN');assert.equal(after.journal.desired,'RELEASED');assert.equal(after.journal.observed,'APPLIED');
});
for(const change of ['owner','executor','auth','identity-failure','deadline'])test(`queued legacy APPLY rejects ${change} before add`,async()=>{
 const f=await fixture(),queued=await queue(f,()=>f.start());
 if(change==='owner')f.setOwner({...f.owner(),owner_key:'GUEST:'+crypto.randomUUID()});
 if(change==='executor')f.setOwner({...f.owner(),installation_id:crypto.randomUUID()});
 if(change==='auth')f.setPhase('LINKED');
 if(change==='identity-failure')f.context.LocalStore.guestContext=async()=>{throw Error('IDENTITY_UNAVAILABLE');};
 if(change==='deadline')f.advance(31000);
 const rejected=assert.rejects(queued.work,/OWNER_MISMATCH|ACCOUNT_TRANSITION_ACTIVE|IDENTITY_UNAVAILABLE|APPLY_EXPIRED/);await queued.release();await rejected;
 assert.equal(f.adds(),0);assert.equal(f.rules().length,0);
});
test('legacy cleanup remains possible after current owner changes during queue',async()=>{
 const f=await fixture();await f.start();const b=await f.db.load(),queued=await queue(f,()=>f.core.end(b.session.session_id));
 f.setOwner({...f.owner(),owner_key:'GUEST:'+crypto.randomUUID()});await queued.release();await queued.work;
 assert.equal(f.rules().length,0);assert.equal((await f.db.load()).session.status,'ENDED');
});
test('queued native ownership replacement is never deleted by legacy cleanup',async()=>{
 const f=await fixture();await f.start();const b=await f.db.load(),id=f.rules()[0].id,queued=await queue(f,()=>f.core.end(b.session.session_id));
 const foreign={id,priority:1,action:{type:'block'},condition:{urlFilter:'||foreign.example^'}};
 await f.dnr.updateSessionRules({removeRuleIds:[id],addRules:[foreign]});const rejected=assert.rejects(queued.work,/RULE_OWNERSHIP_CONFLICT/);
 await queued.release();await rejected;assert.deepEqual(f.rules(),[foreign]);assert.equal((await f.db.load()).session.status,'UNKNOWN');
});
test('handoff to A1 during queue cannot be applied to or overwritten by legacy recovery',async()=>{
 const f=await fixture(),queued=await queue(f,()=>f.start()),old=await f.db.load();
 const replacement={...old.session,session_id:crypto.randomUUID(),execution_contract:'d06-guest-a1-candidate-2',status:'RUNNING'};
 await f.db.transaction('readwrite',(tx,done)=>{tx.objectStore('sessions').put(replacement);tx.objectStore('journal').put({...old.journal,session_id:replacement.session_id});tx.objectStore('metadata').put({key:'current',owner_key:replacement.owner_key,session_id:replacement.session_id,execution_contract:replacement.execution_contract});done(null);});
 const rejected=assert.rejects(queued.work,/RELEASE_UNCONFIRMED/);await queued.release();await rejected;
 const after=await f.db.load();assert.equal(after.session.session_id,replacement.session_id);assert.equal(after.execution_contract,replacement.execution_contract);assert.equal(f.adds(),0);
});
test('scoped legacy recovery cannot replace a different legacy execution',async()=>{
 const f=await fixture();await f.start();const old=await f.db.load(),replacement=structuredClone(old);replacement.session.session_id=crypto.randomUUID();replacement.journal.session_id=replacement.session.session_id;
 await f.db.save(replacement);
 await assert.rejects(f.db.save(old,null,{scope:{owner_key:old.session.owner_key,session_id:old.session.session_id}}),/LOCAL_STORAGE_UNAVAILABLE/);
 assert.equal((await f.db.load()).session.session_id,replacement.session.session_id);
});
test('failed END intent persistence still permits exact cleanup without claiming completion',async()=>{
 const f=await fixture();await f.start();const b=await f.db.load(),original=IDBObjectStore.prototype.put;let failOnce=true;
 IDBObjectStore.prototype.put=function(value,...args){const request=original.call(this,value,...args);if(failOnce&&this.transaction.db.name==='focurve-execution'&&this.name==='journal'&&value.desired==='RELEASED'){failOnce=false;const tx=this.transaction;queueMicrotask(()=>tx.abort());}return request;};
 try{await assert.rejects(f.core.end(b.session.session_id),/LOCAL_STORAGE_UNAVAILABLE/);}finally{IDBObjectStore.prototype.put=original;}
 assert.equal(f.rules().length,0);assert.notEqual((await f.db.load()).session.status,'ENDED');
});
test('auth write after current owner read prevents final legacy APPLY dispatch',async()=>{
 const f=await fixture(),original=f.context.LocalStore.guestContext;let once=true;
 f.context.FocurveMemberDnrWriter.write=(r,send)=>f.writer.write('SESSION',r,dispatch=>{
  if(r.addRules?.length)f.context.LocalStore.guestContext=async()=>{const owner=await original();if(once){once=false;const Store=f.context.FocurveMemberAuth.AuthStore;await new Store({setAccessLevel:async()=>{},set:async()=>{}}).put({phase:'REGISTERED'});}return owner;};
  return send(dispatch);
 });
 await assert.rejects(f.start(),/OWNER_MISMATCH/);assert.equal(f.adds(),0);assert.equal(f.rules().length,0);
});

test('invalid stored Snapshot cannot block legitimate legacy RELEASE',async()=>{
 const f=await fixture();await f.start();const b=await f.db.load();b.session.snapshot.format_version='unsupported';await f.db.save(b);
 await assert.rejects(f.core.tick(),/SNAPSHOT_VERSION_UNSUPPORTED/);assert.equal(f.rules().length,0);
 const after=await f.db.load();assert.equal(after.session.status,'INTERRUPTED');assert.equal(after.session.snapshot.format_version,'unsupported');
});
test('native response wait does not hold the legacy readonly transaction',async()=>{
 const f=await fixture();await f.start();const b=await f.db.load(),native=f.dnr.updateSessionRules;let entered,complete;
 const waiting=new Promise(r=>{entered=r;});f.dnr.updateSessionRules=r=>{entered();return new Promise(resolve=>{complete=()=>resolve(native(r));});};
 const end=f.core.end(b.session.session_id);await waiting;let timer;
 try{await Promise.race([f.db.transaction('readwrite',(tx,done)=>{tx.objectStore('metadata').put({key:'test:while-native-pending',ok:true});done(null);}),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('DB_HELD_BY_NATIVE')),1000);})]);}finally{clearTimeout(timer);complete();}
 await end;assert.equal((await f.db.load()).session.status,'ENDED');assert.equal(f.rules().length,0);
});
test('scoped new legacy START replaces only a fully released prior execution',async()=>{
 const f=await fixture();await f.start();const first=await f.db.load();await f.core.end(first.session.session_id);await f.start();
 const second=await f.db.load();assert.notEqual(second.session.session_id,first.session.session_id);assert.equal(second.session.status,'RUNNING');
});
test('terminal status alone does not allow scoped creation over an unresolved journal',async()=>{
 const f=await fixture();await f.start();const old=await f.db.load();old.session.status='ENDED';await f.db.save(old);
 const next=structuredClone(old);next.session.session_id=crypto.randomUUID();next.journal.session_id=next.session.session_id;next.session.status='STARTING';
 await assert.rejects(f.db.save(next,null,{scope:{owner_key:next.session.owner_key,session_id:next.session.session_id},create:true}),/LOCAL_STORAGE_UNAVAILABLE/);
 assert.equal((await f.db.load()).session.session_id,old.session.session_id);
});
