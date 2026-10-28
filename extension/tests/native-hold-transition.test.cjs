'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
test('native page has one unique recovery control and status region',()=>{
 const html=fs.readFileSync(__dirname+'/../native-link/index.html','utf8');
 const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(x=>x[1]);
 assert.equal(ids.length,new Set(ids).size);assert.equal(ids.filter(x=>x==='recover-product-hold').length,1);
});
function fixture(enabled=true){
 const nodes={},events={},sent=[];let onMessage,disconnect,connects=0;
 const node=id=>nodes[id]??=({hidden:true,disabled:false,textContent:'',addEventListener(k,f){this[k]=f;}});
 const cfg={contract:'FOCURVE_NATIVE_LINK_CONFIG_1',productHoldRecoveryEnabled:enabled,installationId:'1'.repeat(32),extensionId:'a'.repeat(32),host:'com.focurve.install_'+'1'.repeat(32),notAfterUTC:new Date(Date.now()+900000).toISOString()};
 const auth={phase:'LINKED',owner_user_id:1,executor_id:'owner-install',access_token:'private-access-fixture',refresh_token:'private-refresh-fixture'};
 const local={gate:'CLEAR_LOCAL_ONLY'};
 const port={onMessage:{addListener:f=>onMessage=f},onDisconnect:{addListener:f=>disconnect=f},postMessage:q=>sent.push(q),disconnect(){}};
 const world={Date,Number,Error,JSON,document:{querySelector:id=>node(id)},addEventListener:(k,f)=>events[k]=f,
  FOCURVE_NATIVE_LINK_CONFIG:cfg,FOCURVE_DEPLOYMENT:{},FOCURVE_SAFETY_CONTEXT:{},indexedDB:{},crypto:{},location:{},
  R2LocalSafety:{create:()=>({observe:async()=>local,cancel(){}})},
  chrome:{runtime:{id:cfg.extensionId,connectNative:()=>{connects++;return port;}},storage:{local:{get:async()=>({focurve_member_auth:auth})}}}};
 vm.runInNewContext(fs.readFileSync(__dirname+'/../native-link/hold.js','utf8'),world);events.DOMContentLoaded();
 const query={contract:'FOCURVE_RUNTIME_PROBE_1',operation:'CHECK_HOLD_LOCAL',nonce:'b'.repeat(32),installationId:cfg.installationId,extensionId:cfg.extensionId};
 return {world,auth,cfg,sent,node,query,click:trusted=>node('#recover-product-hold').click?.({isTrusted:trusted}),message:q=>onMessage(q),get connects(){return connects;}};
}
test('old grants do not expose HOLD recovery',()=>{const f=fixture(false);assert(f.node('#recover-product-hold').hidden);assert.equal(f.connects,0);});
test('only one trusted user operation, never focus commands',()=>{const f=fixture();f.click(false);assert.equal(f.connects,0);f.click(true);f.click(true);assert.equal(f.connects,1);assert.equal(f.sent[0].operation,'RECOVER_PRODUCT_HOLD');assert(!f.sent.some(x=>['START','END','CLEANUP','REFRESH'].includes(x.operation)));});
test('expired grant cannot open native port',()=>{const f=fixture();f.cfg.notAfterUTC=new Date(0).toISOString();f.click(true);assert.equal(f.connects,0);});
test('reply includes only safe observation and owner IDs',async()=>{const f=fixture();f.click(true);await f.message(f.query);const q=f.sent[1];assert.equal(q.ok,true);assert.equal(q.result.ownerUserId,1);assert(!JSON.stringify(q).includes('private-'));assert.deepEqual(Object.keys(q.result).sort(),['executorId','local','ownerUserId']);});
test('foreign installation message is rejected',async()=>{const f=fixture();f.click(true);await f.message({...f.query,installationId:'2'.repeat(32)});assert.equal(f.sent[1].ok,false);});
test('auth recovery needed is not silently converted to clear',async()=>{const f=fixture();f.auth.phase='AUTH_RECOVERY_REQUIRED';f.click(true);await f.message(f.query);assert.equal(f.sent[1].ok,false);});
test('transition completion cannot grant READY or START',async()=>{const f=fixture();f.click(true);await f.message({contract:f.query.contract,operation:'COMPLETE',result:{state:'PRODUCT_RECOVERED_FOCUS_LOCKED',servicesRunning:false,focusAdmission:'CLOSED',startAuthorized:false}});assert.match(f.node('#hold-status').textContent,/집중 권한은 닫혀/);});
