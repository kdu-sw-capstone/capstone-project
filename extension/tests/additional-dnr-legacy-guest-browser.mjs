// Actual browser IndexedDB/Web Lock; Chrome DNR, identity and auth are SYNTHETIC.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=fileURLToPath(new URL('../../',import.meta.url));
test('legacy real browser scope precondition preserves an A1 handoff while DNR is queued',async()=>{
 const browser=await chromium.launch({headless:true,...(process.env.CHROME_EXECUTABLE?{executablePath:process.env.CHROME_EXECUTABLE}:{})});
 try{
  const page=await browser.newPage();await page.route('**/*',async route=>{
   const path=new URL(route.request().url()).pathname;
   if(/^\/(extension\/(src|a1|member-a1|execution)\/[a-z0-9-]+\.(js|mjs|json)|contracts\/additional-mvp\/rc1\/schema\.json)$/.test(path))return route.fulfill({contentType:path.endsWith('.json')?'application/json':'text/javascript',body:await readFile(join(root,path.slice(1)),'utf8')});
   return route.fulfill({contentType:'text/html',body:'<!doctype html><title>Legacy scope test</title>'});
  });await page.goto('https://focurve.test/');
  await page.evaluate(()=>{
   const owner={installation_id:crypto.randomUUID()};owner.owner_key='GUEST:'+owner.installation_id;
   window.rules=[];window.adds=0;
   window.chrome={runtime:{getURL:p=>'chrome-extension://test/'+p},storage:{session:{get:async()=>({focurve_boot:true}),set:async()=>{}}},alarms:{create:async()=>{},clear:async()=>{}},tabs:{query:async()=>[]},declarativeNetRequest:{getSessionRules:async()=>structuredClone(rules),isRegexSupported:async()=>({isSupported:true}),updateSessionRules:async({addRules=[],removeRuleIds=[]})=>{if(addRules.length)adds++;window.rules=rules.filter(r=>!removeRuleIds.includes(r.id)).concat(structuredClone(addRules));}}};
   window.LocalStore={guestContext:async()=>owner};const at=new Date().toISOString();
   window.GuestSites={list:async()=>({items:[{site_id:crypto.randomUUID(),canonical_host:'example.com',display_name:'Example',include_subdomains:false,purpose:'DISTRACTION',access_policy:'BLOCK',feature_policies:[],version:1,created_at:at,updated_at:at}],settings_version:1}),validate:()=>{}};
   window.__memberIntegration={auth:{load:async()=>({phase:'UNREGISTERED'})}};window.__memberRootAuthority={idle:async()=>true};
  });
  const sources=await Promise.all(['host-policy.js','session-db.js','member-auth.js','session-core.js'].map(name=>readFile(join(root,'extension/background',name),'utf8')));
  await page.addScriptTag({content:sources.join('\n')+'\nglobalThis.legacy=GuestSession;globalThis.db=SessionDB;'});
  const result=await page.evaluate(async()=>{
   const {installMemberDnrWriter}=await import('/extension/src/additional-dnr-legacy-writer.js');
   const gate=installMemberDnrWriter(chrome,indexedDB,navigator.locks,{});window.FocurveMemberDnrWriter=gate;
   await legacy.start(5,crypto.randomUUID());const first=await db.load();await legacy.end(first.session.session_id);
   const normal={status:(await db.load()).session.status,rules:rules.length};
   let unlock,held,queued;const release=new Promise(r=>{unlock=r;}),entered=new Promise(r=>{held=r;}),waiting=new Promise(r=>{queued=r;});
   const blocker=navigator.locks.request('focurve:amvp:dnr-writer',async()=>{held();await release;});await entered;
   window.FocurveMemberDnrWriter={write:(r,send)=>{queued();return gate.write(r,send);}};
   const pending=legacy.start(5,crypto.randomUUID()).then(()=>null,e=>e.message);await waiting;const old=await db.load(),sid=crypto.randomUUID(),contract='d06-guest-a1-candidate-2';
   await db.transaction('readwrite',(tx,done)=>{tx.objectStore('sessions').put({...old.session,session_id:sid,status:'RUNNING',execution_contract:contract});tx.objectStore('journal').put({...old.journal,session_id:sid});tx.objectStore('metadata').put({key:'current',owner_key:old.session.owner_key,session_id:sid,execution_contract:contract});done(null);});
   unlock();await blocker;const error=await pending,current=await db.load();return {normal,error,same:current.session.session_id===sid,contract:current.execution_contract,adds,rules:rules.length};
  });assert.deepEqual(result,{normal:{status:'ENDED',rules:0},error:'RELEASE_UNCONFIRMED',same:true,contract:'d06-guest-a1-candidate-2',adds:1,rules:0});
 }finally{await browser.close();}
});
