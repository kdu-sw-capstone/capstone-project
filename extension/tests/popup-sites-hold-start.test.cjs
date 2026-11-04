'use strict';
// Full popup scripts over shared mocked Chrome storage/runtime and one Web Lock.
// No product Core, Native, Server, profile or installed extension is executed.
const {test,beforeEach}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),{execFileSync}=require('node:child_process');
const {JSDOM}=require('jsdom');
const root=path.resolve(__dirname,'../..');
function source(relative){const ref=process.env.FOCURVE_POPUP_TEST_SOURCE_REF;return ref?execFileSync('git',['show',ref+':extension/'+relative],{cwd:root,encoding:'utf8'}):fs.readFileSync(path.join(root,'extension',relative),'utf8');}
const SITE_HOLD='focurve_member_sites_ui_hold',USER_HOLD='focurve_user_ui_hold';
const EXECUTOR='11111111-1111-4111-8111-111111111111',SESSION='22222222-2222-4222-8222-222222222222';
const pause=()=>new Promise(resolve=>setImmediate(resolve));
let caseName;beforeEach(context=>{caseName=context.name;});
async function settle(){for(let i=0;i<10;i++)await pause();}
class SharedWorld {
 constructor(){
  this.caseName=caseName;
  this.api='https://localhost:18445/api/v1';this.origin='https://localhost:18445';this.extension='a'.repeat(32);this.launch='b'.repeat(32);
  this.data={focurve_installation_ready_launch:this.launch};this.calls=[];this.popups=[];this.lockBusy=false;this.waiters=[];this.lockFailure=false;this.state={phase:'LINKED',error:null,recovery_pending:false,guest_start_allowed:false,owner_user_id:'1',executor_id:EXECUTOR,server_url:this.api,local_status:'IDLE',server_confirmed_running:false,session_id:null};
  this.rows=[];this.createUnknown=false;this.beforeGet=null;this.beforeSet=null;this.beforeAcquire=null;this.runtimeHook=null;this.lockUnavailable=false;
  // Delayed notifications intentionally keep popup B's cache stale. Dispatch
  // safety must also hold before Chrome delivers a storage.onChanged callback.
  this.delayEvents=true;this.events=[];
 }
 scope(){return {owner_key:'MEMBER:'+this.state.owner_user_id,executor_id:this.state.executor_id,authority:this.state.server_url};}
 count(action,popup){return this.calls.filter(c=>c.message.action===action&&(!popup||c.popup===popup)).length;}
 async lock(name,options,callback,popup){
  if(typeof options==='function'){callback=options;options={};}
  if(this.beforeAcquire)await this.beforeAcquire({popup,name});
  if(this.lockFailure)throw Error('MOCK_LOCK_UNAVAILABLE');
  if(this.lockUnavailable)return callback(null);
  if(this.lockBusy){if(options?.ifAvailable)return callback(null);await new Promise(resolve=>this.waiters.push(resolve));}
  this.lockBusy=true;try{return await callback({name,mode:'exclusive'});}finally{this.lockBusy=false;this.waiters.shift()?.();}
 }
 notify(changes){const deliver=()=>{for(const p of this.popups)for(const listener of p.listeners)listener(structuredClone(changes),'local');};if(this.delayEvents)this.events.push(deliver);else queueMicrotask(deliver);}
 async storageGet(popup,keys){
  if(this.beforeGet)await this.beforeGet({popup,keys});
  const requested=typeof keys==='string'?[keys]:Array.isArray(keys)?keys:Object.keys(keys??this.data),result={};
  for(const key of requested)if(Object.hasOwn(this.data,key))result[key]=structuredClone(this.data[key]);
  return result;
 }
 async storageSet(popup,values){if(this.beforeSet)await this.beforeSet({popup,values});const changes={};for(const [key,value] of Object.entries(values)){changes[key]={oldValue:structuredClone(this.data[key]),newValue:structuredClone(value)};this.data[key]=structuredClone(value);}this.notify(changes);}
 async storageRemove(_popup,keys){const changes={};for(const key of typeof keys==='string'?[keys]:keys){changes[key]={oldValue:structuredClone(this.data[key])};delete this.data[key];}this.notify(changes);}
 async send(popup,message){
  this.calls.push({popup,message:structuredClone(message)});
  if(this.runtimeHook){const override=await this.runtimeHook({popup,message});if(override!==undefined)return override;}
  if(message.type==='INDEPENDENT_MEMBER_UI'){
   if(message.action==='STATE')return {ok:true,data:structuredClone(this.state)};
   if(message.action==='START'){this.state={...this.state,local_status:'RUNNING',server_confirmed_running:true,session_id:SESSION};return {ok:true,data:structuredClone(this.state)};}
   if(message.action==='END'){this.state={...this.state,local_status:'ENDED',server_confirmed_running:false};return {ok:true,data:structuredClone(this.state)};}
   throw Error('UNEXPECTED_MEMBER_ACTION_'+message.action);
  }
  if(message.type!=='INDEPENDENT_MEMBER_SITES')throw Error('UNEXPECTED_MESSAGE_TYPE');
  const response=data=>({ok:true,request_id:message.request_id,scope:this.scope(),data});
  if(message.scope&&JSON.stringify(message.scope)!==JSON.stringify(this.scope()))return {ok:false,request_id:message.request_id,error:'OWNER_MISMATCH',definitive:true};
  if(message.action==='LIST')return response({items:structuredClone(this.rows),next_cursor:null,has_more:false});
  if(message.action==='TIMING')return response({planned_end_at:null,session_id:null,server_confirmed_running:false});
  if(message.action==='CREATE'){
   if(this.createUnknown)return {ok:false,request_id:message.request_id,error:'RESPONSE_UNCONFIRMED',definitive:false};
   const {url,...site}=message.payload.site,saved={...site,canonical_host:new URL(url.includes('://')?url:'https://'+url).hostname,site_id:String(this.rows.length+1),version:1};this.rows.push(saved);return response(saved);
  }
  if(message.action==='GET'){const row=this.rows.find(s=>s.site_id===message.payload.site_id);return row?response(row):{ok:false,request_id:message.request_id,error:'SITE_NOT_FOUND',status:404,definitive:true};}
  throw Error('UNEXPECTED_SITES_ACTION_'+message.action);
 }
 async open(name,{developer=false}={}){
  const entry=developer?'developer.html':'popup.html',dom=new JSDOM(source('member-ui/'+entry),{url:'chrome-extension://'+this.extension+'/member-ui/'+entry,runScripts:'outside-only'}),w=dom.window,p={name,dom,w,listeners:[],intervals:[]};this.popups.push(p);
  const interval=w.setInterval.bind(w);w.setInterval=(fn,ms)=>{p.intervals.push(fn);return interval(fn,ms);};
  w.structuredClone=structuredClone;w.matchMedia=()=>({matches:false,addEventListener(){},removeEventListener(){}});
  w.FOCURVE_DEPLOYMENT={api:this.api,origin:this.origin,launchId:this.launch,launchDeadlineUTC:new Date(Date.now()+4*3600000).toISOString(),...(developer?{developerDiagnostics:true}:{})};
  w.fetch=async()=>({ok:true,json:async()=>({contract:'STANDALONE_LAUNCH_1',extensionId:this.extension,...w.FOCURVE_DEPLOYMENT})});
  w.FocurveDeploymentBinding={config:()=>({server_url:this.api,web_origin:this.origin}),stateMatches:s=>s.server_url===this.api};
  w.chrome={tabs:{query:async()=>[{url:'https://example.com'}]},runtime:{id:this.extension,getURL:p=>'chrome-extension://'+this.extension+'/'+p,sendMessage:m=>this.send(name,m)},storage:{onChanged:{addListener:fn=>p.listeners.push(fn),removeListener:fn=>{p.listeners=p.listeners.filter(f=>f!==fn);}},local:{get:k=>this.storageGet(name,k),set:v=>this.storageSet(name,v),remove:k=>this.storageRemove(name,k)}}};
  w.navigator.locks={request:(n,o,fn)=>this.lock(n,o,fn,name)};
  const dialog=w.document.querySelector('#end-dialog');if(dialog){dialog.showModal=function(){this.open=true;};dialog.close=function(){this.open=false;};}
  for(const file of developer?['member-ui/popup-model.js','member-ui/developer.js']:['background/host-policy.js','member-ui/popup-model.js','member-ui/sites-model.js','member-ui/shell.js','member-ui/user.js'])w.eval(source(file));
  await settle();assert(this.count('STATE',name)>0,'fixture initial STATE must run');if(!developer)assert(this.count('LIST',name)>0,'fixture real sites model must load');
  return p;
 }
 close(){for(const {w,dom} of this.popups){w.dispatchEvent(new w.Event('pagehide'));dom.window.close();}const evidence=process.env.FOCURVE_POPUP_TEST_EVIDENCE_FILE;if(evidence){const file=path.resolve(evidence),rows=fs.existsSync(file)?JSON.parse(fs.readFileSync(file,'utf8')):[];rows.push({case:this.caseName,source_ref:process.env.FOCURVE_POPUP_TEST_SOURCE_REF??'working-tree',dispatches:this.calls.map(c=>({popup:c.popup,type:c.message.type,action:c.message.action})),counts:Object.fromEntries(['STATE','LIST','CREATE','START','END'].map(action=>[action,this.count(action)])),site_marker:structuredClone(this.data[SITE_HOLD])??null,user_marker:structuredClone(this.data[USER_HOLD])??null});fs.writeFileSync(file,JSON.stringify(rows,null,2)+'\n');}}
}
function marker(){return {requestId:'33333333-3333-4333-8333-333333333333',action:'SITE_CREATE',scope:{owner_key:'MEMBER:1',executor_id:EXECUTOR,authority:'https://localhost:18445/api/v1'},unconfirmed:true};}
async function forceStart(p){const fn=p.w.document.getElementById('start').onclick;assert.equal(typeof fn,'function');await fn();await settle();}
async function save(p,host='example.com'){const d=p.w.document;d.getElementById('member-site-add').onclick();d.getElementById('member-site-url').value=host;await d.getElementById('member-site-form').onsubmit(new p.w.Event('submit',{cancelable:true}));await settle();}
async function forceEnd(p){p.w.document.getElementById('end').onclick();p.w.document.getElementById('confirm-end').onclick();await settle();}
async function pair(){const world=new SharedWorld();const a=await world.open('A'),b=await world.open('B');return {world,a,b};}

test('A: popup A unknown site write blocks stale popup B START without B saving',async()=>{const {world,a,b}=await pair();try{world.createUnknown=true;await save(a);const preserved=structuredClone(world.data[SITE_HOLD]);assert(preserved);assert.equal(world.count('CREATE'),1);await forceStart(b);assert.equal(world.count('START'),0);assert.deepEqual(world.data[SITE_HOLD],preserved);}finally{world.close();}});
test('B: reserve rejection in stale popup B keeps local hold and does not clear A evidence',async()=>{const {world,a,b}=await pair();try{world.createUnknown=true;await save(a);const preserved=structuredClone(world.data[SITE_HOLD]);await save(b,'other.example.com');assert.equal(world.count('CREATE'),1);await forceStart(b);assert.equal(b.w.FocurvePopupShell.startBlocked(),true);assert.equal(world.count('START'),0);assert.deepEqual(world.data[SITE_HOLD],preserved);}finally{world.close();}});
test('C: fresh durable storage read error prevents START dispatch and preserves marker bytes',async()=>{const {world,b}=await pair();try{const preserved=marker();world.data[SITE_HOLD]=preserved;world.beforeGet=async({popup,keys})=>{if(popup==='B'&&(keys===SITE_HOLD||Array.isArray(keys)&&keys.includes(SITE_HOLD)))throw Error('MOCK_READ_FAILED');};await forceStart(b);assert.equal(world.count('START'),0);assert.deepEqual(world.data[SITE_HOLD],preserved);}finally{world.close();}});
test('D: Web Lock failure fails closed before any START dispatch',async()=>{const {world,b}=await pair();try{world.lockFailure=true;await forceStart(b);assert.equal(world.count('START'),0);assert.equal(world.data[USER_HOLD],undefined);}finally{world.close();}});
test('E: hold appearing after cached display and before lock acquisition is checked inside lock',async()=>{const {world,b}=await pair();try{const preserved=marker();world.beforeAcquire=async({popup})=>{if(popup==='B'){world.data[SITE_HOLD]=preserved;world.beforeAcquire=null;}};await forceStart(b);assert.equal(world.count('START'),0);assert.deepEqual(world.data[SITE_HOLD],preserved);}finally{world.close();}});
test('F: hold appearing during START reservation still prevents actual runtime START',async()=>{const {world,b}=await pair();try{const preserved=marker();world.beforeSet=async({popup,values})=>{if(popup==='B'&&values[USER_HOLD]?.action==='START'){world.data[SITE_HOLD]=preserved;world.beforeSet=null;}};await forceStart(b);assert.equal(world.count('START'),0);assert.deepEqual(world.data[SITE_HOLD],preserved);}finally{world.close();}});
test('G: owner change during pre-START reservation is rejected before START dispatch',async()=>{const {world,b}=await pair();try{world.beforeSet=async({popup,values})=>{if(popup==='B'&&values[USER_HOLD]?.action==='START'){world.state={...world.state,owner_user_id:'2'};world.beforeSet=null;}};await forceStart(b);assert.equal(world.count('START'),0);}finally{world.close();}});
test('H: normal confirmed popup path dispatches one START and one existing END',async()=>{const {world,b}=await pair();try{await forceStart(b);assert.equal(world.count('START'),1);assert.equal(world.data[USER_HOLD],undefined);await forceEnd(b);assert.equal(world.count('END'),1);assert.equal(world.state.local_status,'ENDED');}finally{world.close();}});
test('I: unrelated site hold keeps legitimate running END available without deleting evidence',async()=>{const world=new SharedWorld();world.state={...world.state,local_status:'RUNNING',server_confirmed_running:true,session_id:SESSION};const preserved=marker();world.data[SITE_HOLD]=preserved;try{const b=await world.open('B');await forceEnd(b);assert.equal(world.count('END'),1);assert.equal(world.count('START'),0);assert.deepEqual(world.data[SITE_HOLD],preserved);}finally{world.close();}});
test('J: externally resolved hold permits a fresh verified popup path, with no automatic START',async()=>{const world=new SharedWorld();world.data[SITE_HOLD]=marker();try{const old=await world.open('old');await forceStart(old);assert.equal(world.count('START'),0);delete world.data[SITE_HOLD];const fresh=await world.open('fresh');assert.equal(world.count('START'),0);await forceStart(fresh);assert.equal(world.count('START'),1);}finally{world.close();}});
test('K: two simultaneous popup START intents dispatch at most once through the common Web Lock',async()=>{const {world,a,b}=await pair();try{await Promise.all([forceStart(a),forceStart(b)]);assert.equal(world.count('START'),1);assert.equal(world.data[USER_HOLD],undefined);}finally{world.close();}});
test('L: pre-send site reservation read failure latches local held even when no remote write was sent',async()=>{const {world,b}=await pair();try{world.beforeGet=async({popup,keys})=>{if(popup==='B'&&(keys===SITE_HOLD||Array.isArray(keys)&&keys.includes(SITE_HOLD)))throw Error('MOCK_RESERVE_READ_FAILED');};await save(b);assert.equal(world.count('CREATE'),0);world.beforeGet=null;await forceStart(b);assert.equal(b.w.FocurvePopupShell.startBlocked(),true);assert.equal(world.count('START'),0);}finally{world.close();}});
test('M: unavailable common Web Lock callback cannot dispatch START or reserve a mutation',async()=>{const {world,b}=await pair();try{world.lockUnavailable=true;await forceStart(b);assert.equal(world.count('START'),0);assert.equal(world.data[USER_HOLD],undefined);}finally{world.close();}});
test('N: executor or known generation changing during START reservation rejects fresh STATE',async()=>{for(const changed of [{executor_id:'44444444-4444-4444-8444-444444444444'},{generation:2}]){const world=new SharedWorld();world.state.generation=1;try{const b=await world.open('B');world.beforeSet=async({values})=>{if(values[USER_HOLD]?.action==='START'){Object.assign(world.state,changed);world.beforeSet=null;}};await forceStart(b);assert.equal(world.count('START'),0);}finally{world.close();}}});
test('O: old pending STATE cannot authorize START after a newer observed owner state arrives',async()=>{const {world,b}=await pair();try{let release,observed;const waiting=new Promise(resolve=>observed=resolve),old=structuredClone(world.state);world.runtimeHook=async({popup,message})=>{if(popup==='B'&&message.action==='STATE'){world.runtimeHook=null;observed();return new Promise(resolve=>release=()=>resolve({ok:true,data:old}));}};const starting=forceStart(b);await waiting;world.state={...world.state,owner_user_id:'2'};await b.intervals.at(-1)();await settle();release();await starting;assert.equal(world.count('START'),0);assert.equal(b.w.document.getElementById('member-site-list').children.length,0);}finally{world.close();}});
test('P: external normal hold-clear event rechecks data in the same old popup before explicit START',async()=>{const world=new SharedWorld();world.delayEvents=false;world.data[SITE_HOLD]=marker();try{const b=await world.open('B');await forceStart(b);assert.equal(world.count('START'),0);const lists=world.count('LIST','B');await world.storageRemove('approved-fixture-resolver',SITE_HOLD);await settle();assert(world.count('LIST','B')>lists,'clear must reload rather than silently discard local hold');assert.equal(world.count('START'),0);await forceStart(b);assert.equal(world.count('START'),1);}finally{world.close();}});
test('Q: own successful CREATE notifications keep controller alive through readback and later START',async()=>{const world=new SharedWorld();world.delayEvents=false;try{const b=await world.open('B');await save(b);assert.equal(world.count('CREATE'),1);assert.equal(world.count('GET'),1);assert.equal(world.data[SITE_HOLD],undefined);assert.equal(b.w.FocurvePopupShell.startBlocked(),false);assert.equal(b.w.document.getElementById('member-site-form').hidden,true);assert.match(b.w.document.getElementById('member-site-list').textContent,/example.com/);await forceStart(b);assert.equal(world.count('START'),1);}finally{world.close();}});
test('R: pending pre-START check holds the common lock against another popup site write',async()=>{const {world,a,b}=await pair();try{let release,observed;const waiting=new Promise(resolve=>observed=resolve);world.runtimeHook=async({popup,message})=>{if(popup==='B'&&message.action==='STATE'){world.runtimeHook=null;observed();return new Promise(resolve=>release=()=>resolve({ok:true,data:structuredClone(world.state)}));}};const starting=forceStart(b);await waiting;assert.equal(world.lockBusy,true);await save(a);assert.equal(world.count('CREATE'),0);assert.equal(world.data[SITE_HOLD],undefined);release();await starting;assert.equal(world.count('START'),1);}finally{world.close();}});
test('S: present malformed null or false site marker blocks START without rewriting the value',async()=>{for(const malformed of [null,false]){const {world,b}=await pair();try{world.data[SITE_HOLD]=malformed;await forceStart(b);assert.equal(world.count('START'),0);assert(Object.hasOwn(world.data,SITE_HOLD));assert.equal(world.data[SITE_HOLD],malformed);}finally{world.close();}}});
test('T: loaded developer START shares hold guard and lock while legitimate END remains available',async()=>{const world=new SharedWorld();try{const dev=await world.open('Dev',{developer:true});world.data[SITE_HOLD]=marker();const preserved=structuredClone(world.data[SITE_HOLD]);await forceStart(dev);assert.equal(world.count('START'),0);assert.deepEqual(world.data[SITE_HOLD],preserved);delete world.data[SITE_HOLD];await dev.w.document.getElementById('state').onclick();await settle();await forceStart(dev);assert.equal(world.count('START'),1);world.data[SITE_HOLD]=preserved;await dev.w.document.getElementById('end').onclick();await settle();assert.equal(world.count('END'),1);assert.deepEqual(world.data[SITE_HOLD],preserved);}finally{world.close();}});
test('U: developer and regular popup simultaneous START cannot bypass the shared Web Lock',async()=>{const world=new SharedWorld();try{const member=await world.open('Member'),dev=await world.open('Dev',{developer:true});await Promise.all([forceStart(member),forceStart(dev)]);assert.equal(world.count('START'),1);}finally{world.close();}});
test('V: stale popup cannot overwrite a different existing user command hold',async()=>{const {world,b}=await pair();try{const preserved={...marker(),action:'START'};world.data[USER_HOLD]=preserved;await forceStart(b);assert.equal(world.count('START'),0);assert.deepEqual(world.data[USER_HOLD],preserved);}finally{world.close();}});
test('W: old account form cannot bind to a new actor after asynchronous lock acquisition',async()=>{const world=new SharedWorld();try{const popup=await world.open('same-popup'),beforeLists=world.count('LIST');world.beforeAcquire=async({popup:name})=>{if(name!=='same-popup')return;world.beforeAcquire=null;world.state={...world.state,owner_user_id:'2'};await popup.intervals.at(-1)();await settle();assert(world.count('LIST')>beforeLists,'new account actor must really initialize before the old lock callback resumes');};await save(popup,'account-a.example.com');assert.equal(world.count('CREATE'),0,'old account A input must not be dispatched through the new account B model');assert.equal(world.rows.length,0);assert.equal(world.data[SITE_HOLD],undefined);assert.equal(world.data[USER_HOLD],undefined);assert.equal(popup.w.document.getElementById('member-site-url').value,'');}finally{world.close();}});
test('X: delayed losing START in the same popup cannot clear the winning reservation scope',async()=>{
 const world=new SharedWorld();try{
  const popup=await world.open('same-popup');let releasePreflight,enteredPreflight,releaseLosing,enteredLosing,releaseReserve,enteredReserve;
  const preflight=new Promise(resolve=>enteredPreflight=resolve),losing=new Promise(resolve=>enteredLosing=resolve),reserve=new Promise(resolve=>enteredReserve=resolve);
  world.runtimeHook=async({message})=>{if(message.action==='STATE'){world.runtimeHook=null;enteredPreflight();return new Promise(resolve=>releasePreflight=()=>resolve({ok:true,data:structuredClone(world.state)}));}};
  const winner=forceStart(popup);await preflight;
  world.beforeAcquire=async()=>{world.beforeAcquire=null;enteredLosing();await new Promise(resolve=>releaseLosing=resolve);};
  const loser=forceStart(popup);await losing;
  world.beforeSet=async({values})=>{if(values[USER_HOLD]?.action==='START'){world.beforeSet=null;enteredReserve();await new Promise(resolve=>releaseReserve=resolve);}};
  releasePreflight();await reserve;releaseLosing();await loser;releaseReserve();await winner;
  assert.equal(world.count('START'),1,'the duplicate losing request must neither dispatch nor invalidate the valid winner');
  assert.equal(world.data[USER_HOLD],undefined,'a confirmed winner must not become a fabricated UNKNOWN hold');
  assert.equal(world.data[SITE_HOLD],undefined);
 }finally{world.close();}
});
