'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const read=n=>fs.readFileSync(path.join(__dirname,'..',n),'utf8');
const executor='11111111-1111-4111-8111-111111111111',origin='https://localhost:29511';
function fixture(open=false){
 let listener,fetches=0,ticks=0,statusReads=0,initializes=0;
 const now=Date.now(),saved={phase:'LINKED',owner_user_id:'1',executor_id:executor,server_url:origin+'/api/v1',web_origin:origin,installation_proof:'p'.repeat(40),access_token:'PRIVATE_ACCESS_SENTINEL'.repeat(3),refresh_token:'PRIVATE_REFRESH_SENTINEL'.repeat(3),access_expires_at:now-1,error:null};
 const world={URL,AbortController,setTimeout,clearTimeout,console:{warn(){}},FocurveUserAdmission:{withServices:async fn=>{if(!open)throw Error('INSTALLATION_STOPPING');return fn();}}};
 vm.runInNewContext(read('background/member-auth.js'),world);
 const store={get:async()=>structuredClone(saved),put:async value=>{Object.assign(saved,value);return structuredClone(value);}};
 const auth=new world.FocurveMemberAuth.MemberAuth({store,getInstallation:async()=>({installation_id:executor}),inspectIdle:async()=>({}),callbackUri:'chrome-extension://'+'a'.repeat(32)+'/popup/popup.html',clientVersion:'0.1.25',now:()=>now,fetch:async()=>{fetches++;throw Error('PRIVATE_TRANSPORT_SENTINEL');}});
 const originalStatus=auth.status.bind(auth);auth.status=()=>{statusReads++;return originalStatus();};
 vm.runInNewContext(read('integration/member-web-bridge.js'),world);
 const actor={identity:async()=>({owner_key:'MEMBER:1',executor_id:executor}),tick:async()=>{ticks++;await auth.credentials();return{local_status:'IDLE'};}};
 world.installMemberWebBridge({runtime:{onMessageExternal:{addListener:fn=>listener=fn}},auth,initialize:async()=>{initializes++;return actor;},baseline:async()=>{}});
 const sender={url:origin+'/#sessions',origin,frameId:0,tab:{id:1}};
 const message=type=>({type,request_id:'request-1',owner_context:null,payload:type==='FOCURVE_EXECUTION_WAKE'?{executor_id:executor}:{}});
 return {saved,auth,world,actor,sender,message,send:(type,s=sender)=>new Promise(resolve=>listener(message(type),s,resolve)),stats:()=>({fetches,ticks,statusReads,initializes}),open:()=>{open=true;}};
}
for(const type of ['FOCURVE_EXECUTION_CONNECT','FOCURVE_EXECUTION_WAKE'])test(type+' cannot refresh or poison linked credentials after product quiesce',async()=>{
 const f=fixture(false),before=structuredClone(f.saved),reply=await f.send(type);await new Promise(r=>setImmediate(r));
 assert.equal(f.stats().fetches,0);assert.equal(f.stats().ticks,0);assert.equal(f.stats().initializes,0);assert.equal(f.stats().statusReads,0);
 assert.deepEqual(f.saved,before);assert.equal(reply.status,'ERROR');assert(!JSON.stringify(reply).includes('PRIVATE_'));
});
test('open services retain the existing uncertain-refresh failure instead of hiding or resetting it',async()=>{
 const f=fixture(true),reply=await f.send('FOCURVE_EXECUTION_CONNECT');
 assert.equal(reply.status,'ERROR');assert.equal(f.stats().ticks,1);assert.equal(f.stats().fetches,1);assert.equal(f.saved.phase,'AUTH_RECOVERY_REQUIRED');
 assert.equal(f.saved.error,'AUTH_RESPONSE_UNCONFIRMED');assert(!JSON.stringify(reply).includes('PRIVATE_'));
});
test('open services still return only the bound executor after a successful ordinary lookup',async()=>{
 const f=fixture(true);f.saved.access_expires_at=Date.now()+3600000;const reply=await f.send('FOCURVE_EXECUTION_CONNECT');
 assert.equal(reply.status,'OK');assert.equal(reply.data.executor_id,executor);assert.deepEqual(Object.keys(reply.data),['executor_id']);assert.equal(f.stats().ticks,1);assert.equal(f.stats().fetches,0);
});
test('a service fence closing between auth inspection and lookup rejects before the actor is initialized',async()=>{
 const f=fixture(true);let calls=0;f.world.FocurveUserAdmission.withServices=async fn=>{if(++calls>1)throw Error('INSTALLATION_STOPPING');return fn();};
 const reply=await f.send('FOCURVE_EXECUTION_CONNECT');assert.equal(reply.status,'ERROR');assert.equal(f.stats().initializes,0);assert.equal(f.stats().fetches,0);assert.equal(f.saved.phase,'LINKED');
});

async function bootstrapFixture(open){
 let alarm,ticks=0;
 const actor={identity:async()=>({owner_key:'MEMBER:1',executor_id:executor}),tick:async()=>{ticks++;}};
 const world={URL,indexedDB:{},console:{warn(){}},__memberA1:actor,
  FocurveMemberRoot:{RootAuthority:class{}},MemberA1DBFactory:()=>({}),
  FocurveMemberIntegration:{MemberIntegrationAdapter:class{}},FocurveMemberAuth:{AuthStore:class{}},
  FocurveUserAdmission:{withServices:async fn=>{if(!open)throw Error('INSTALLATION_STOPPING');return fn();}},
  chrome:{runtime:{getURL:p=>'chrome-extension://'+'a'.repeat(32)+'/'+p,getManifest:()=>({version:'0.1.25'}),onMessage:{addListener(){}}},declarativeNetRequest:{},tabs:{},alarms:{onAlarm:{addListener:fn=>alarm=fn}}}};
 vm.runInNewContext(read('integration/member-a1-bootstrap.js'),world);await world.__memberA1Ready;
 return {get ticks(){return ticks;},close:()=>{open=false;},poll:async()=>{alarm({name:'focurve-member-a1-check'});await new Promise(r=>setImmediate(r));}};
}
test('actual Worker bootstrap and periodic member poll do not contact stopped services',async()=>{
 const f=await bootstrapFixture(false);assert.equal(f.ticks,0);await f.poll();assert.equal(f.ticks,0);
});
test('actual Worker polling still runs when open and stops after product quiesce',async()=>{
 const f=await bootstrapFixture(true);assert.equal(f.ticks,1);await f.poll();assert.equal(f.ticks,2);f.close();await f.poll();assert.equal(f.ticks,2);
});


test('real expired credential refresh failure maps to the guest AUTH_STATE boundary, without restoring auth',async()=>{
 // Independent synthetic state; this is not a reading of the protected installation.
 const f=fixture(true);await assert.rejects(f.auth.credentials(),/AUTH_RESPONSE_UNCONFIRMED/);
 assert.equal(f.saved.phase,'AUTH_RECOVERY_REQUIRED');assert.equal(f.saved.error,'AUTH_RESPONSE_UNCONFIRMED');
 const world={setTimeout,clearTimeout,URL};vm.runInNewContext(read('safety/guest-reader.js'),world);
 const eid='a'.repeat(32),href='chrome-extension://'+eid+'/safety/index.html';
 const env={location:{href},deployment:{contract:'STANDALONE_API_1',origin,api:origin+'/api/v1'},context:{contract:'R2_DEDICATED_PROFILE_1',extensionId:eid,origin,profileInstance:'a'.repeat(32)},chrome:{runtime:{id:eid,getURL:p=>'chrome-extension://'+eid+'/'+p},tabs:{getCurrent:async()=>({url:href,incognito:false})},storage:{local:{get:async()=>({focurve_member_auth:structuredClone(f.saved)})}}}};
 const before=structuredClone(f.saved),r=await world.FocurveGuestSafety.create(env).observe();
 assert.equal(r.gate,'UNKNOWN');assert.equal(r.failureStage,'AUTH_STATE');assert.equal(r.authState.phase,'AUTH_RECOVERY_REQUIRED');assert.equal(r.authState.errorCode,'AUTH_RESPONSE_UNCONFIRMED');assert.deepEqual(Array.from(r.authState.rejectionConditions),['PHASE_NOT_GUEST','MEMBER_OWNER_PRESENT','MEMBER_TOKEN_PRESENT','ERROR_PRESENT']);assert.equal(r.authState.accessExpiry,'EXPIRED');
 assert.deepEqual(f.saved,before);assert(!JSON.stringify(r).includes('PRIVATE_'));assert.equal(r.counts,null);
});


async function popupAlarmFixture(open,missing=false){
 const f=fixture(open);let alarm;
 Object.assign(f.world,{importScripts(){},__memberA1:f.actor,chrome:{runtime:{getURL:p=>'chrome-extension://'+'a'.repeat(32)+'/'+p,onMessage:{addListener(){}}},alarms:{create(){},onAlarm:{addListener:fn=>alarm=fn}}}});
 if(missing)delete f.world.FocurveUserAdmission;
 vm.runInNewContext(read('member-ui/runtime.js'),f.world);
 return {...f,poll:async()=>{alarm({name:'focurve-member-server-poll'});await new Promise(r=>setImmediate(r));await new Promise(r=>setImmediate(r));}};
}

test('member popup periodic alarm cannot refresh expired credentials after services close',async()=>{
 const f=await popupAlarmFixture(false),before=structuredClone(f.saved);await f.poll();
 assert.equal(f.stats().ticks,0);assert.equal(f.stats().fetches,0);assert.deepEqual(f.saved,before);
});

test('member popup periodic alarm remains blocked when admission is unavailable',async()=>{
 const f=await popupAlarmFixture(false,true),before=structuredClone(f.saved);await f.poll();
 assert.equal(f.stats().ticks,0);assert.equal(f.stats().fetches,0);assert.deepEqual(f.saved,before);
});

test('member popup periodic alarm still polls open services and preserves a real uncertain auth failure',async()=>{
 const f=await popupAlarmFixture(true);await f.poll();
 assert.equal(f.stats().ticks,1);assert.equal(f.stats().fetches,1);assert.equal(f.saved.phase,'AUTH_RECOVERY_REQUIRED');assert.equal(f.saved.error,'AUTH_RESPONSE_UNCONFIRMED');
});
