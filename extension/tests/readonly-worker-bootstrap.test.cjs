const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../../distribution/diagnostics/readonly-worker.js'),'utf8');
test('installed diagnostic entry is exactly the already-tested inert Worker',()=>{
 assert.equal(fs.readFileSync(path.join(__dirname,'../../distribution/installer/readonly-worker.js'),'utf8'),source);
});
function deniedWorld(){
 const calls=[];const deny=name=>new Proxy(function(){},{get(){calls.push(name);throw Error('SIDE_EFFECT_API_REACHED');},apply(){calls.push(name);throw Error('SIDE_EFFECT_API_REACHED');}});
 return {calls,world:{chrome:deny('chrome'),indexedDB:deny('indexedDB'),fetch:deny('fetch'),importScripts:deny('importScripts'),setTimeout:deny('timer'),setInterval:deny('timer'),GuestSession:deny('guest-recovery'),MemberAuthRuntime:deny('auth'),__memberA1:deny('member-core')}};
}
test('read-only entry and recreation never access product imports, auth, storage, network, timers or DNR',()=>{
 for(let boot=0;boot<3;boot++){
  const f=deniedWorld();vm.runInNewContext(source,f.world);assert.equal(f.world.FOCURVE_READONLY_BOOTSTRAP.productInitialized,false);assert.deepEqual(f.calls,[]);
 }
});
test('read-only entry provides no START, END, cleanup, recovery or Native message endpoint',()=>{
 const f=deniedWorld(),before=Object.keys(f.world);vm.runInNewContext(source,f.world);
 assert.deepEqual(Object.keys(f.world).filter(k=>!before.includes(k)),['FOCURVE_READONLY_BOOTSTRAP']);assert(Object.isFrozen(f.world.FOCURVE_READONLY_BOOTSTRAP));assert.deepEqual(f.calls,[]);
});
test('ordinary actual Worker registers startup handlers and immediately dispatches guest recovery',()=>{
 const handlers={},imports=[];let guestTicks=0;
 const event=name=>({addListener:f=>(handlers[name]??=[]).push(f)});
 const world={URL,Set,Date,console,setTimeout,importScripts:(...names)=>imports.push(...names),GuestSession:{tick:async()=>{guestTicks++;}},chrome:{runtime:{getURL:p=>'chrome-extension://'+'a'.repeat(32)+'/'+p,onMessage:event('message'),onStartup:event('startup')},alarms:{onAlarm:event('alarm')},tabs:{onUpdated:event('updated'),onRemoved:event('removed')},webNavigation:{onBeforeNavigate:event('before'),onCommitted:event('commit'),onErrorOccurred:event('error')}}};
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../background/service-worker.js'),'utf8'),world);
 assert.equal(guestTicks,1);assert(imports.includes('../integration/member-a1-bootstrap.js'));
 for(const callback of handlers.startup)callback();assert.equal(guestTicks,2);
});
