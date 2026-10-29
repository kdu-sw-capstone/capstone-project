'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
function fixture(enabled=true){
 const nodes={},events={},sent=[],stored={};let message,disconnect,connects=0;
 const node=id=>nodes[id]??=({hidden:true,disabled:false,textContent:'',listeners:{},addEventListener(type,fn){this.listeners[type]=fn;}});
 const cfg={contract:'FOCURVE_NATIVE_LINK_CONFIG_1',userSessionEnabled:enabled,installationId:'1'.repeat(32),extensionId:'a'.repeat(32),host:'com.focurve.install_'+'1'.repeat(32),notAfterUTC:new Date(Date.now()+3600000).toISOString()};
 const port={onMessage:{addListener:fn=>message=fn},onDisconnect:{addListener:fn=>disconnect=fn},postMessage:q=>sent.push(q),disconnect(){}};
 const reader={create:()=>({observe:async()=>({gate:'CLEAR_LOCAL_ONLY'}),cancel(){}})};
 const world={navigator:{locks:{request:async(name,fn)=>fn()}},Date,Error,Number,JSON,document:{getElementById:node},addEventListener:(type,fn)=>events[type]=fn,FOCURVE_NATIVE_LINK_CONFIG:cfg,FOCURVE_DEPLOYMENT:{origin:'https://localhost:28455'},FOCURVE_SAFETY_CONTEXT:{},R2LocalSafety:reader,FocurveGuestSafety:reader,indexedDB:{},crypto:{},location:{},chrome:{runtime:{id:cfg.extensionId,connectNative:()=>{connects++;return port;},sendMessage:async()=>({ok:true,result:{quiesced:true}})},storage:{local:{get:async()=>({...stored}),set:async values=>Object.assign(stored,values)}}}};
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../native-link/session.js'),'utf8'),world);events.DOMContentLoaded();
 const start=trusted=>node('open-user-session').listeners.click?.({isTrusted:trusted});
 const ready=()=>({contract:'FOCURVE_RUNTIME_PROBE_1',operation:'SESSION_READY',result:{origin:world.FOCURVE_DEPLOYMENT.origin,launchId:'b'.repeat(32),launchDeadlineUTC:cfg.notAfterUTC,automaticSTART_END:false}});
 return {nodes,node,world,cfg,sent,stored,start,ready,events,get connects(){return connects;},message:q=>message(q),disconnected:()=>disconnect()};
}
test('user service UI is not enabled by an old probe-only grant',()=>{const f=fixture(false);assert.equal(f.node('open-user-session').hidden,true);assert.equal(f.connects,0);});
test('no lifecycle command is sent before a trusted user click',()=>{const f=fixture();assert.equal(f.sent.length,0);f.start(false);assert.equal(f.sent.length,0);f.start(true);assert.equal(f.sent[0].operation,'OPEN_USER_SESSION');assert.equal(f.connects,1);});
test('duplicate start does not open a second lifecycle port',()=>{const f=fixture();f.start(true);f.start(true);assert.equal(f.connects,1);assert.equal(f.sent.length,1);});
test('invalid and insufficient deadlines do not connect',()=>{for(const end of ['invalid',new Date(Date.now()+60000).toISOString()]){const f=fixture();f.cfg.notAfterUTC=end;f.start(true);assert.equal(f.connects,0);}});
test('ready exposes only the bound web origin and scoped normal stop',async()=>{const f=fixture();f.start(true);await f.message(f.ready());assert.equal(f.node('session-dashboard').href,'https://localhost:28455/');f.node('stop-user-session').listeners.click({isTrusted:true});assert.equal(f.sent[1].operation,'STOP_USER_SESSION');assert.equal(f.sent[1].launchId,'b'.repeat(32));assert(!f.sent.some(x=>['START','END','EVALUATE'].includes(x.operation)));});
test('a foreign ready origin does not become a dashboard link',async()=>{const f=fixture();f.start(true);const q=f.ready();q.result.origin='https://other.invalid';await f.message(q);assert.equal(f.node('session-dashboard').hidden,true);assert.equal(f.sent.at(-1).ok,false);});
test('disconnect preserves a failed UI and never retries or sends END',()=>{const f=fixture();f.start(true);f.disconnected();assert.equal(f.connects,1);assert.equal(f.sent.length,1);assert.equal(f.node('stop-user-session').disabled,true);});
test('only exact confirmed normal stop displays completion',async()=>{const f=fixture();f.start(true);await f.message(f.ready());await f.message({contract:'FOCURVE_RUNTIME_PROBE_1',operation:'COMPLETE',result:{state:'USER_SESSION_STOPPED',normalShutdowns:1,servicesRunning:false,focusAdmission:'CLOSED'}});assert.match(f.node('session-status').textContent,/정상 종료/);assert.equal(f.world.FOCURVE_PRODUCT_LIFECYCLE_ACTIVE,false);});

test('closing an active controller warns without issuing stop or focus commands',async()=>{
 const f=fixture();let prevented=0;const event={preventDefault(){prevented++;}};
 f.events.beforeunload?.(event);assert.equal(prevented,0);
 f.start(true);await f.message(f.ready());f.events.beforeunload(event);
 assert.equal(prevented,1);assert.equal(event.returnValue,'');assert.equal(f.sent.length,1);
 f.events.pagehide();assert.equal(f.sent.length,1);
});
test('confirmed completion removes the close warning but disconnect is never completion',async()=>{
 const f=fixture();f.start(true);await f.message(f.ready());
 f.node('stop-user-session').listeners.click({isTrusted:true});
 assert.match(f.node('session-status').textContent,/닫지 마세요/);
 f.disconnected();assert.doesNotMatch(f.node('session-status').textContent,/정상 종료했습니다/);
});
test('stop acknowledgment is launch bound and cannot finish or repeat a shutdown',async()=>{
 const f=fixture();f.start(true);await f.message(f.ready());
 const q={contract:'FOCURVE_RUNTIME_PROBE_1',operation:'STOPPING',installationId:f.cfg.installationId,extensionId:f.cfg.extensionId,launchId:'b'.repeat(32),reason:'USER_REQUEST'};
 await f.message(q);assert.equal(f.node('stop-user-session').disabled,true);assert.match(f.node('session-status').textContent,/닫지 마세요/);
 f.node('stop-user-session').listeners.click({isTrusted:true});assert.equal(f.sent.length,1);
 assert.notEqual(f.world.FOCURVE_PRODUCT_LIFECYCLE_ACTIVE,false);
});
test('a controller rejected as already active never claims a new session or sends stop',async()=>{
 const f=fixture();f.start(true);await f.message({contract:'FOCURVE_RUNTIME_PROBE_1',operation:'REJECTED',code:'PRODUCT_OPERATION_ALREADY_ACTIVE'});
 assert.match(f.node('session-status').textContent,/시작하지 않았습니다/);assert.equal(f.sent.length,1);
 assert.equal(f.node('session-dashboard').hidden,true);assert.equal(f.world.FOCURVE_PRODUCT_LIFECYCLE_ACTIVE,false);
});
test('foreign stop acknowledgement cannot be accepted as a normal shutdown',async()=>{
 const f=fixture();f.start(true);await f.message(f.ready());
 await f.message({contract:'FOCURVE_RUNTIME_PROBE_1',operation:'STOPPING',installationId:f.cfg.installationId,extensionId:f.cfg.extensionId,launchId:'c'.repeat(32),reason:'USER_REQUEST'});
 assert.match(f.node('session-status').textContent,/확인하지 못해/);assert.equal(f.sent.at(-1).ok,false);
});
test('after normal completion a page close causes no warning or additional command',async()=>{
 const f=fixture();f.start(true);await f.message(f.ready());
 await f.message({contract:'FOCURVE_RUNTIME_PROBE_1',operation:'COMPLETE',result:{state:'USER_SESSION_STOPPED',normalShutdowns:1,servicesRunning:false,focusAdmission:'CLOSED'}});
 let warnings=0;f.events.beforeunload({preventDefault(){warnings++;}});
 assert.equal(warnings,0);assert.equal(f.sent.length,1);
});

test('disconnect cannot be reversed by a late ready or completion message',async()=>{
 const f=fixture();f.start(true);f.disconnected();
 const failure=f.node('session-status').textContent;
 await f.message(f.ready());
 await f.message({contract:'FOCURVE_RUNTIME_PROBE_1',operation:'COMPLETE',result:{state:'USER_SESSION_STOPPED',normalShutdowns:1,servicesRunning:false,focusAdmission:'CLOSED'}});
 assert.equal(f.node('session-status').textContent,failure);
 assert.equal(f.node('session-popup').hidden,true);assert.equal(f.node('session-dashboard').hidden,true);
 assert.equal(f.node('stop-user-session').disabled,true);f.start(true);assert.equal(f.connects,1);
});

for(const action of ['address replacement','tab close','refresh'])test(`${action} warns and channel loss never retries, stops or claims service shutdown`,async()=>{
 const f=fixture();f.start(true);await f.message(f.ready());let warnings=0;
 f.events.beforeunload({preventDefault(){warnings++;}});f.events.pagehide();f.disconnected();
 assert.equal(warnings,1);assert.equal(f.sent.length,1);assert.equal(f.connects,1);
 assert.match(f.node('session-status').textContent,/종료 여부.*확인할 수 없/);
 assert.equal(f.node('session-popup').hidden,true);assert.equal(f.node('session-dashboard').hidden,true);
 assert(!f.sent.some(q=>['STOP_USER_SESSION','START','END','RECOVER_PRODUCT_HOLD'].includes(q.operation)));
});

test('popup link is exposed only while the service is confirmed ready',async()=>{
 const f=fixture();assert.equal(f.node('session-popup').hidden,true);f.start(true);await f.message(f.ready());
 assert.equal(f.node('session-popup').hidden,false);
 await f.message({contract:'FOCURVE_RUNTIME_PROBE_1',operation:'STOPPING',installationId:f.cfg.installationId,extensionId:f.cfg.extensionId,launchId:'b'.repeat(32),reason:'USER_REQUEST'});
 assert.equal(f.node('session-popup').hidden,true);
});

test('a safety reply finishing after disconnect is discarded without posting to the closed port',async()=>{
 const f=fixture();f.start(true);let resume;const wait=new Promise(resolve=>resume=resolve);
 let reads=0;f.world.chrome.storage.local.get=async()=>{if(++reads===1)await wait;return {};};
 const pending=f.message({contract:'FOCURVE_RUNTIME_PROBE_1',operation:'CHECK_LOCAL',installationId:f.cfg.installationId,extensionId:f.cfg.extensionId,nonce:'c'.repeat(32)});
 f.disconnected();resume();await pending;
 assert.equal(f.sent.length,1);assert.equal(f.node('session-popup').hidden,true);
 assert.match(f.node('session-status').textContent,/종료 여부.*확인할 수 없/);
});

test('a refreshed control document never reconnects or starts automatically',()=>{
 const previous=fixture();previous.start(true);previous.events.pagehide();previous.disconnected();
 const refreshed=fixture();assert.equal(refreshed.connects,0);assert.equal(refreshed.sent.length,0);
 assert.equal(refreshed.node('session-popup').hidden,true);
});


test('channel loss invalidates only its own READY admission and preserves obligations',async()=>{
 const f=fixture();f.start(true);await f.message(f.ready());
 Object.assign(f.stored,{focurve_installation_ready_launch:'b'.repeat(32),journal:'preserved',dnr:'preserved',auth:'preserved'});
 f.disconnected();await new Promise(setImmediate);
 assert.equal(f.stored.focurve_installation_ready_launch,null);
 assert.equal(f.stored.focurve_installation_channel_failure.previouslyReady,'b'.repeat(32));
 assert.equal(f.stored.journal,'preserved');assert.equal(f.stored.dnr,'preserved');assert.equal(f.stored.auth,'preserved');
 assert.equal(f.sent.length,1);
});
test('a late old controller disconnect never closes a newer launch admission',async()=>{
 const f=fixture();f.start(true);await f.message(f.ready());
 f.stored.focurve_installation_ready_launch='c'.repeat(32);f.disconnected();await new Promise(setImmediate);
 assert.equal(f.stored.focurve_installation_ready_launch,'c'.repeat(32));assert.equal(f.stored.focurve_installation_channel_failure,undefined);
});
