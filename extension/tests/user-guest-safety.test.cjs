'use strict';const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const {create}=loadClassic('../safety/guest-reader.js');
const existing={};vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../safety/reader.js'),'utf8'),existing);const core=existing.R2LocalSafety;
const install='01111111-1111-4111-8111-111111111111',eid='a'.repeat(32),origin='https://localhost:18445';
function fixture({auth,rule=false,foreign=false,fail=false,timeout=false,extra=[],changes=false}={}){
 const defs=[{name:'focurve-local',data:{metadata:[{key:'installation_id',value:install}],owner_settings:[]}},{name:'focurve-execution',data:{metadata:[],sessions:[],journal:[],events:[],intervals:[],outbox:[]}},{name:'focurve-a0-registry',data:{registry:[]}},...extra];let readCount=0,opens=0,closes=0,writes=0;
 const env={core,timeoutMs:timeout?8:15000,location:{href:'chrome-extension://'+eid+'/safety/index.html'},deployment:{contract:'STANDALONE_API_1',origin,api:origin+'/api/v1'},context:{contract:'R2_DEDICATED_PROFILE_1',extensionId:foreign?'b'.repeat(32):eid,origin,profileInstance:'a'.repeat(32)},chrome:{runtime:{id:eid,getURL:p=>'chrome-extension://'+eid+'/'+p},tabs:{getCurrent:async()=>({url:'chrome-extension://'+eid+'/safety/index.html',incognito:false})},storage:{local:{get:async()=>auth?{focurve_member_auth:auth}:{},set:()=>{writes++;throw Error('NO_WRITES');}}},declarativeNetRequest:{getSessionRules:async()=>rule?[{id:1}]:[],getDynamicRules:async()=>[]}},indexedDB:{databases:async()=>defs.map(d=>({name:d.name,version:1})),open:name=>{opens++;const q={};if(timeout)return q;queueMicrotask(()=>{if(fail){q.onerror();return;}const d=defs.find(x=>x.name===name),schema=core.schema(name);q.result={version:1,objectStoreNames:Object.keys(d.data),close:()=>closes++,transaction:(names,mode)=>{assert.equal(mode,'readonly');const tx={abort:()=>{},objectStore:s=>({keyPath:schema[s],getAll:()=>{const r={};queueMicrotask(()=>{r.result=structuredClone(d.data[s]);if(changes&&++readCount>Object.keys(d.data).length*defs.length)r.result.push({key:'changed'});r.onsuccess();if(++done===names.length)queueMicrotask(()=>tx.oncomplete());});return r;},put:()=>{writes++;throw Error('NO_WRITES');}})};let done=0;return tx;}};q.onsuccess();});return q;}}};
 return {env,stats:()=>({opens,closes,writes})};
}
test('fresh guest clearance uses read-only snapshots and releases handles',async()=>{const f=fixture(),r=await create(f.env).observe();assert.equal(r.gate,'CLEAR_LOCAL_ONLY');assert.equal(f.stats().writes,0);assert.equal(f.stats().opens,f.stats().closes);assert.deepEqual(r.resources,{openConnections:0,activeReadTransactions:0,pendingNativeCalls:0});});
test('registered unlinked installation is verified against local identity, not erased',async()=>{const f=fixture({auth:{phase:'REGISTERED',executor_id:install,installation_proof:'p'.repeat(40),server_url:origin+'/api/v1',web_origin:origin,error:null}});const r=await create(f.env).observe();assert.equal(r.gate,'CLEAR_LOCAL_ONLY');assert(!JSON.stringify(r).includes('p'.repeat(40)));});
test('actual DNR obligation blocks clearance',async()=>{const r=await create(fixture({rule:true}).env).observe();assert.equal(r.gate,'BLOCKED');assert.equal(r.counts.sessionRules,1);});
test('unreleased binding is not excluded',async()=>{const rows={metadata:[{key:'a1:binding:one',record_kind:'A1_BINDING',resolution:'NONE',cleanup_pending:false}],sessions:[],journal:[],events:[],intervals:[],outbox:[]};const r=await create(fixture({extra:[{name:'focurve-member-a1:'+ 'a'.repeat(64),data:rows}]}).env).observe();assert.equal(r.gate,'BLOCKED');assert.equal(r.counts.unresolvedBindings,1);});
test('retained historical member debt is projected without owner transition or cleanup',async()=>{const rows={metadata:[],sessions:[{status:'ENDED',executor_id:install}],journal:[{desired:'RELEASED',observed:'RELEASED'}],events:[],intervals:[],outbox:[]};const f=fixture({extra:[{name:'focurve-member-a1:'+'a'.repeat(64),data:rows}]});assert.equal((await create(f.env).observe()).gate,'CLEAR_LOCAL_ONLY');assert.equal(f.stats().writes,0);});
test('profile mismatch and pending auth never read or expose secret values',async()=>{const f=fixture({foreign:true});assert.equal((await create(f.env).observe()).gate,'UNKNOWN');assert.equal(f.stats().opens,0);const r=await create(fixture({auth:{phase:'LINK_PENDING',refresh_token:'SECRET_DO_NOT_PRINT'}}).env).observe();assert.equal(r.gate,'UNKNOWN');assert(!JSON.stringify(r).includes('SECRET_DO_NOT_PRINT'));});
test('unknown schema is UNKNOWN, not zero obligations',async()=>{const r=await create(fixture({extra:[{name:'unrecognized-store',data:{items:[]}}]}).env).observe();assert.equal(r.gate,'UNKNOWN');assert.equal(r.counts,null);});
test('database failure and timeout remain UNKNOWN',async()=>{for(const options of [{fail:true},{timeout:true}]){const r=await create(fixture(options).env).observe();assert.equal(r.gate,'UNKNOWN');assert.equal(r.counts,null);}});

function loadClassic(name){const m={exports:{}};Function('module',fs.readFileSync(path.join(__dirname,name),'utf8'))(m);return m.exports;}

function retainedMember(options={}){
 const owner='MEMBER:1',scope=require('node:crypto').createHash('sha256').update(core.canonical({owner_key:owner,executor_id:install,authority:origin+'/api/v1'})).digest('hex');
 const sid='22222222-2222-4222-8222-222222222222',event='33333333-3333-4333-8333-333333333333';
 const original={scope:'retained',event_id:event,owner_key:owner,executor_id:install,base_url:origin+'/api/v1',body:'same-body',review_required:false};
 const ack={owner_key:owner,executor_id:install,event_id:event,body:'same-body',status:'ACKED'};
 const marker={tab_id:'feature-marker:1:44444444-4444-4444-8444-444444444444',scope:JSON.stringify([origin+'/api/v1',owner,install,sid,1,event]),fingerprint:'a'.repeat(64),entry_fingerprint:'b'.repeat(64)};
 const data={metadata:[],sessions:[{owner_key:owner,executor_id:install,session_id:sid,status:options.active?'RUNNING':'ENDED'}],journal:[{desired:'RELEASED',observed:'RELEASED'}],events:[],intervals:[],outbox:[]};
 if(options.binding)data.metadata.push({key:'a1:binding:test',record_kind:'A1_BINDING',resolution:'NONE',cleanup_pending:true});
 if(options.unacked)ack.status='PENDING';if(options.bodyMismatch)ack.body='different';if(options.ownerMismatch)ack.owner_key='MEMBER:2';if(options.review)original.review_required=true;
 if(options.badMarker)marker.entry_fingerprint='bad';
 const suffix=options.badNamespace?'a'.repeat(64):scope;
 return [{name:'focurve-member-a1:'+suffix,data},{name:'member-a1-site-access:'+suffix,data:{pending:[marker],sequences:[],originals:[original]}},{name:'member-a1-site-events:'+suffix,data:{events:[ack]}}];
}
test('disconnected member ACKed originals and passive markers retain their hash-bound observation scope',async()=>{
 const f=fixture({extra:retainedMember()}),r=await create(f.env).observe();assert.equal(r.gate,'CLEAR_LOCAL_ONLY');assert.equal(r.counts.pendingOutbox,0);assert.equal(f.stats().writes,0);assert.equal(f.stats().opens,f.stats().closes);
});
test('disconnected member pending, mismatched, reviewed and malformed evidence never clears',async()=>{
 for(const key of ['unacked','bodyMismatch','ownerMismatch','review','badMarker','badNamespace']){const f=fixture({extra:retainedMember({[key]:true})}),r=await create(f.env).observe();assert.equal(r.gate,'BLOCKED',key);assert(r.counts.pendingOutbox>0,key);assert.equal(f.stats().writes,0);}
});
test('retained receipt correlation does not hide active sessions, bindings or actual rules',async()=>{
 for(const key of ['active','binding','rule']){const f=fixture({extra:retainedMember({[key]:true}),rule:key==='rule'}),r=await create(f.env).observe();assert.equal(r.gate,'BLOCKED',key);assert.equal(r.counts.pendingOutbox,0);assert(r.counts.activeSessions+r.counts.unresolvedBindings+r.counts.sessionRules>0);}
});

test('product-only native control document uses the same read-only safety projection',async()=>{const f=fixture();f.env.productLifecycle=true;f.env.location.href='chrome-extension://'+eid+'/native-link/index.html';f.env.chrome.tabs.getCurrent=async()=>({url:f.env.location.href,incognito:false});const r=await create(f.env).observe();assert.equal(r.gate,'CLEAR_LOCAL_ONLY');assert.equal(f.stats().writes,0);});
test('native control document cannot impersonate the default safety document',async()=>{const f=fixture();f.env.location.href='chrome-extension://'+eid+'/native-link/index.html';assert.equal((await create(f.env).observe()).gate,'UNKNOWN');});

test('unknown auth state preserves the actual rejection stage without exposing credentials',async()=>{
 const f=fixture({auth:{phase:'AUTH_RECOVERY_REQUIRED',access_token:'DO_NOT_LOG_TOKEN',error:'DO_NOT_LOG_PRIVATE_ERROR'}}),r=await create(f.env).observe();
 assert.equal(r.gate,'UNKNOWN');assert.equal(r.counts,null);assert.deepEqual(r.issues,['AUTH_TRANSITION_OR_MEMBER_STATE']);assert.equal(r.failureStage,'AUTH_STATE');
 assert.equal(f.stats().opens,0);assert.equal(f.stats().writes,0);assert(!JSON.stringify(r).includes('DO_NOT_LOG'));
});
test('database failure is distinguishable from auth failure while remaining UNKNOWN',async()=>{
 const f=fixture({fail:true}),r=await create(f.env).observe();assert.equal(r.gate,'UNKNOWN');assert.deepEqual(r.issues,['DATABASE_READ_FAILED']);assert.equal(r.failureStage,'DATABASE_READ');assert.equal(r.counts,null);assert.equal(f.stats().writes,0);
});
test('an unexpected private native error is replaced by a fixed reason rather than printed',async()=>{
 const f=fixture();f.env.chrome.storage.local.get=async()=>{throw Error('DO_NOT_LOG_NATIVE_PRIVATE_ERROR');};const r=await create(f.env).observe();
 assert.equal(r.gate,'UNKNOWN');assert.deepEqual(r.issues,['GUEST_OBSERVATION_UNCONFIRMED']);assert.equal(r.failureStage,'AUTH_READ');assert(!JSON.stringify(r).includes('DO_NOT_LOG'));
});


test('auth-state rejection reports only fixed classifications and the exact failed predicates',async()=>{
 const base={phase:'REGISTERED',executor_id:install,installation_proof:'p'.repeat(40),server_url:origin+'/api/v1',web_origin:origin,error:null};
 const cases=[
  [{...base,phase:'REFRESHING'},'REFRESHING','TRANSITION',['PHASE_NOT_GUEST']],
  [{...base,phase:'AUTH_RECOVERY_REQUIRED',error:'AUTH_RESPONSE_UNCONFIRMED'},'AUTH_RECOVERY_REQUIRED','UNCONFIRMED',['PHASE_NOT_GUEST','ERROR_PRESENT']],
  [{...base,phase:'LINKED',owner_user_id:'1',access_token:'PRIVATE_TOKEN'},'LINKED','MEMBER',['PHASE_NOT_GUEST','MEMBER_OWNER_PRESENT','MEMBER_TOKEN_PRESENT']],
  [{...base,error:'PRIVATE_ERROR'},'REGISTERED','GUEST_REGISTERED',['ERROR_PRESENT']],
  [{...base,web_origin:'https://private.invalid'},'REGISTERED','GUEST_REGISTERED',['REGISTERED_DEPLOYMENT_MISMATCH']],
  [{...base,installation_proof:'bad'},'REGISTERED','GUEST_REGISTERED',['REGISTERED_PROOF_INVALID']],
  [{phase:'UNREGISTERED',executor_id:install},'UNREGISTERED','GUEST_UNREGISTERED',['UNREGISTERED_INSTALLATION_PRESENT']],
  [{...base,phase:'PRIVATE_PHASE'},'UNRECOGNIZED','UNRECOGNIZED',['PHASE_NOT_GUEST']],
  [{...base,recovery_pending:true},'REGISTERED','GUEST_REGISTERED',['RECOVERY_PENDING']]
 ];
 for(const [auth,phase,classification,conditions] of cases){
  const f=fixture({auth}),r=await create(f.env).observe();
  assert.equal(r.gate,'UNKNOWN');assert.equal(r.counts,null);assert.equal(r.failureStage,'AUTH_STATE');
  assert.equal(r.authState.phase,phase);assert.equal(r.authState.classification,classification);assert.deepEqual(r.authState.rejectionConditions,conditions);
  assert.equal(f.stats().opens,0);assert.equal(f.stats().writes,0);assert(!JSON.stringify(r).includes('PRIVATE_'));assert(!JSON.stringify(r).includes('p'.repeat(40)));
 }
});

test('expired access token is classified without refreshing or declaring guest clearance',async()=>{
 const f=fixture({auth:{phase:'LINKED',owner_user_id:'1',access_token:'PRIVATE_ACCESS',refresh_token:'PRIVATE_REFRESH',access_expires_at:Date.now()-1000,error:null}});
 const r=await create(f.env).observe();assert.equal(r.gate,'UNKNOWN');assert.equal(r.authState.accessExpiry,'EXPIRED');assert.equal(r.authState.classification,'MEMBER');assert.equal(f.stats().writes,0);assert.equal(f.stats().opens,0);assert(!JSON.stringify(r).includes('PRIVATE_'));
});

test('normal LINKED is routed to member observation; transition is not treated as a clean guest',async()=>{
 for(const [phase,selected] of [['LINKED','MEMBER'],['REFRESHING','GUEST'],['AUTH_RECOVERY_REQUIRED','GUEST']]){
  let query,member=0,guest=0;
  const world={chrome:{storage:{local:{get:async()=>({focurve_member_auth:{phase}})}}},indexedDB:{},crypto:{},location:{},
   R2LocalSafety:{create:()=>({observe:async()=>{member++;return {gate:'UNKNOWN',issues:['MEMBER_CHECK_REQUIRED']};},cancel(){}})},
   FocurveGuestSafety:{create:()=>({observe:async()=>{guest++;return {gate:'UNKNOWN',issues:['AUTH_TRANSITION_OR_MEMBER_STATE']};},cancel(){}})},
   document:{querySelector:s=>s==='#inspect'?{addEventListener:(_,f)=>query=f}:{textContent:''}},addEventListener(){}};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../safety/ui.js'),'utf8'),world);await query();
  assert.equal(member,selected==='MEMBER'?1:0);assert.equal(guest,selected==='GUEST'?1:0);
 }
});
