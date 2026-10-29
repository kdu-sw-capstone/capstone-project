import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {webcrypto} from 'node:crypto';
import {IDBFactory} from 'fake-indexeddb';
import {makeGuestSnapshot} from '../a1/contract.mjs';
import {A1Core} from '../a1/core.mjs';

function fixture(){
 const context=vm.createContext({indexedDB:new IDBFactory(),crypto:webcrypto,structuredClone,URL,Date});
 for(const name of ['host-policy','local-store','site-store','session-db'])vm.runInContext(fs.readFileSync(new URL('../background/'+name+'.js',import.meta.url),'utf8'),context);
 return {local:vm.runInContext('LocalStore',context),sites:vm.runInContext('GuestSites',context),db:vm.runInContext('SessionDB',context),policy:context.FocurveHostPolicy,indexedDB:context.indexedDB};
}
async function settings(f,owner,write){
 const db=await new Promise((resolve,reject)=>{const q=f.indexedDB.open('focurve-local',1);q.onsuccess=()=>resolve(q.result);q.onerror=()=>reject(q.error);});
 try{return await new Promise((resolve,reject)=>{const tx=db.transaction('owner_settings',write?'readwrite':'readonly'),store=tx.objectStore('owner_settings');let value;
  if(write)store.put(write);else{const q=store.get(owner.owner_key);q.onsuccess=()=>{value=q.result;};}
  tx.oncomplete=()=>resolve(value);tx.onabort=()=>reject(tx.error);
 });}finally{db.close();}
}
test('fresh empty guest settings produce the first valid snapshot without saving a site',async()=>{
 const f=fixture(),owner=await f.local.guestContext(),listed=await f.sites.list();
 assert.equal(owner.settings_version,1);assert.equal(listed.settings_version,1);assert.equal(listed.items.length,0);
 const snapshot=await makeGuestSnapshot({owner,sites:listed.items,sourceVersion:listed.settings_version,createdAt:new Date().toISOString(),limitedProduct11:true},f.policy);
 assert.equal(snapshot.source_version,(await settings(f,owner)).version);assert.equal(snapshot.sites.length,0);
});
test('concurrent initialization keeps one installation and the same positive empty revision',async()=>{
 const f=fixture(),owners=await Promise.all(Array.from({length:8},()=>f.local.guestContext()));
 assert.equal(new Set(owners.map(x=>x.installation_id)).size,1);assert(owners.every(x=>x.settings_version===1));
});
test('existing revision and payload are never rewritten by context lookup',async()=>{
 const f=fixture(),owner=await f.local.guestContext(),row={owner_key:owner.owner_key,version:17,payload:{retained:'unchanged'}};
 await settings(f,owner,row);assert.equal((await f.local.guestContext()).settings_version,17);assert.deepEqual(await settings(f,owner),row);
});
test('legacy zero revision is preserved; snapshot validation is not relaxed or silently normalized',async()=>{
 const f=fixture(),owner=await f.local.guestContext(),row={owner_key:owner.owner_key,version:0,payload:{}};await settings(f,owner,row);
 assert.equal((await f.local.guestContext()).settings_version,0);assert.deepEqual(await settings(f,owner),row);
 const listed=await f.sites.list();await assert.rejects(makeGuestSnapshot({owner,sites:listed.items,sourceVersion:listed.settings_version,createdAt:new Date().toISOString(),limitedProduct11:true},f.policy),/INVALID_SNAPSHOT/);
});

test('fresh settings reach real Guest Core RUNNING and END; terminal contents survive core recreation',async()=>{
 const f=fixture(),session={},storage={get:async k=>({[k]:session[k]}),set:async v=>Object.assign(session,v)};
 let rules=[],clock=Date.now();
 const chrome={runtime:{id:'guest-test',getURL:p=>'chrome-extension://guest-test/'+p},storage:{session:storage},
  tabs:{onRemoved:{addListener(){}},query:async()=>[]},webNavigation:{getAllFrames:async()=>[]},
  declarativeNetRequest:{getSessionRules:async()=>structuredClone(rules),isRegexSupported:async()=>({isSupported:true}),updateSessionRules:async({addRules=[],removeRuleIds=[]})=>{rules=rules.filter(r=>!removeRuleIds.includes(r.id)).concat(structuredClone(addRules));}},
  alarms:{create:async()=>{},clear:async()=>{}}};
 const env={chrome,db:f.db,owner:()=>f.local.guestContext(),sites:f.sites,policy:f.policy};
 const create=async()=>{const c=new A1Core(env,{limitedProduct11:true,p1:true,d1b5:true,nd01:true,dp01:true,nr01:true,now:()=>clock,mono:()=>clock});
  // Scheduling and Chrome APIs are simulated; this is not a browser acceptance result.
  c.requestCheck=()=>{};c.watchReady=true;await c.ready;return c;};
 const core=await create(),requestId=webcrypto.randomUUID(),started=await core.start(2,requestId);
 assert.equal(started.session.status,'RUNNING');assert.equal(started.session.start_request_id,requestId);
 assert.equal(started.session.snapshot.source_version,1);assert.equal(started.session.snapshot.sites.length,0);
 for(let i=0;i<24;i++){clock+=5000;await core.tick();}
 const ended=await f.db.load();assert.equal(ended.session.status,'ENDED');assert.equal(ended.journal.observed,'RELEASED');assert.equal(rules.length,0);
 const rows=await core.registry.rows();assert.equal(rows.filter(r=>r.record_kind==='A1_BINDING'&&r.resolution==='NONE').length,0);
 const before=JSON.stringify(ended);await create();assert.equal(JSON.stringify(await f.db.load()),before);assert.equal((await f.local.guestContext()).settings_version,1);
});
