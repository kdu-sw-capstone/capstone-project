const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const read=n=>fs.readFileSync(path.join(__dirname,'..',n),'utf8');
function fixture(){
 const listeners={},imports=[],observed=[],forgotten=[],errors=[];
 const event=n=>({addListener:f=>(listeners[n]??=[]).push(f)});
 const context={URL,Date,setTimeout:()=>0,clearTimeout(){},console:{error:(...v)=>errors.push(v),info(){},warn(){}},importScripts:(...v)=>imports.push(...v),AccessStore:{forget:async()=>{}},GuestSession:{tick:async()=>{},observe:async()=>{},forget:async()=>{}},
 chrome:{runtime:{id:'trial',getURL:p=>'chrome-extension://trial/'+p.replace(/^\//,''),onMessage:event('message'),onStartup:event('startup')},alarms:{onAlarm:event('alarm')},tabs:{onUpdated:event('updated'),onRemoved:event('removed')},webNavigation:{onBeforeNavigate:event('before'),onCommitted:event('commit'),onErrorOccurred:event('error'),onHistoryStateUpdated:event('history')}}};
 vm.createContext(context);vm.runInContext(read('background/service-worker.js'),context);
 const identity={owner_key:'MEMBER:1',executor_id:'installation-1',authority:'https://localhost:18445/api/v1'};
 context.__memberA1={identity:async()=>identity};
 vm.runInContext(read('member-ui/access-runtime.js'),context);
 context.testAccess={identity,collector:{observe:async(stage,d)=>{observed.push([stage,d.tabId]);return null;},forget:async tab=>forgotten.push(tab)},flush:async()=>{}};
 vm.runInContext('observeMemberFeature=()=>{};memberSiteAccess=async()=>testAccess;memberAccessInit={adapter:__memberA1,promise:Promise.resolve(testAccess)};',context);
 const emit=async(n,v)=>{for(const f of listeners[n]??[])f(v);await new Promise(r=>setImmediate(r));await new Promise(r=>setImmediate(r));};
 return {context,imports,observed,forgotten,errors,emit};
}
test('actual Worker composition dispatches navigation once without loading the undefined legacy actor',async()=>{
 const f=fixture(),d={tabId:1,frameId:0,url:'https://example.org/',timeStamp:Date.now()};
 for(const n of ['before','commit','error'])await f.emit(n,d);
 await f.emit('removed',1);
 assert.deepEqual(f.observed,[['before',1],['commit',1],['error',1]]);assert.deepEqual(f.forgotten,[1]);assert.deepEqual(f.errors,[]);
 assert(!f.imports.some(x=>x.includes('member-execution-runtime.js')));
 assert(!read('background/service-worker.js').includes('MemberExecutionRuntime.'));
});
test('safety and product-control documents never enter the member access collector',async()=>{
 const f=fixture();
 for(const name of ['safety/index.html','native-link/index.html']){
  for(const n of ['before','commit','error'])await f.emit(n,{tabId:2,frameId:0,url:'chrome-extension://trial/'+name});
  await f.emit('removed',2);
 }
 assert.deepEqual(f.observed,[]);assert.deepEqual(f.forgotten,[]);assert.deepEqual(f.errors,[]);
});
test('tab closure cannot clear another member actor pending navigation',async()=>{
 const f=fixture();f.context.__memberA1={identity:async()=>({owner_key:'MEMBER:2'})};await f.emit('removed',1);
 assert.deepEqual(f.forgotten,[]);
});
