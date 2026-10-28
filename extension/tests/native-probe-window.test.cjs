'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
function fixture(){
 const events={},nodes={},sent=[];let incoming,connects=0;
 const node=id=>nodes[id]??={listeners:{},addEventListener(type,fn){this.listeners[type]=fn;}};
 const reader={create:()=>({observe:async()=>({gate:'CLEAR_LOCAL_ONLY'}),cancel(){}})};
 const world={Date,Number,Error,JSON,location:{},indexedDB:{},crypto:{},document:{querySelector:node},addEventListener:(name,fn)=>events[name]=fn,
  FOCURVE_NATIVE_LINK_CONFIG:{contract:'FOCURVE_NATIVE_LINK_CONFIG_1',extensionId:'a'.repeat(32),installationId:'1'.repeat(32),host:'com.focurve.install_'+'1'.repeat(32),notAfterUTC:new Date(Date.now()+900000).toISOString()},
  R2LocalSafety:reader,FocurveGuestSafety:reader,chrome:{storage:{local:{get:async()=>({})}},runtime:{id:'a'.repeat(32),connectNative(){connects++;return {onMessage:{addListener:fn=>incoming=fn},onDisconnect:{addListener(){}},postMessage:q=>sent.push(q),disconnect(){}};}}}};
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../native-link/probe.js'),'utf8'),world);events.DOMContentLoaded();
 return {world,events,sent,node,start:()=>node('#verify-runtime').listeners.click({isTrusted:true}),message:q=>incoming(q),get connects(){return connects;}};
}
test('probe rejects an invalid deadline before opening a native connection',()=>{
 const f=fixture();f.world.FOCURVE_NATIVE_LINK_CONFIG.notAfterUTC='invalid';f.start();assert.equal(f.connects,0);assert.equal(f.sent.length,0);
});
test('closing an active probe warns and never fabricates STOP or END',()=>{
 const f=fixture();f.start();let warnings=0;f.events.beforeunload({preventDefault(){warnings++;}});f.events.pagehide();
 assert.equal(warnings,1);assert.equal(f.sent.length,1);assert.equal(f.sent[0].operation,'VERIFY_RUNTIME');
});
test('probe close warning ends only after verified completion',async()=>{
 const f=fixture();f.start();await f.message({contract:'FOCURVE_RUNTIME_PROBE_1',operation:'COMPLETE',result:{state:'VERIFIED_STOPPED',normalShutdowns:2,focusAdmission:'CLOSED',restart:true,schemaAndRowCountsPreserved:true}});
 let warnings=0;f.events.beforeunload({preventDefault(){warnings++;}});assert.equal(warnings,0);assert.equal(f.world.FOCURVE_PRODUCT_LIFECYCLE_ACTIVE,false);
});
test('duplicate probe is rejected without calling it a new failed service',async()=>{
 const f=fixture();f.start();await f.message({contract:'FOCURVE_RUNTIME_PROBE_1',operation:'REJECTED',code:'PRODUCT_OPERATION_ALREADY_ACTIVE'});
 assert.match(f.node('#runtime-status').textContent,/시작하지 않았습니다/);assert.equal(f.sent.length,1);
});
