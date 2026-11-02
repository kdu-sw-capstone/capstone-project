// Actual IndexedDB/Web Lock; DNR, identity and remote command context are SYNTHETIC.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=fileURLToPath(new URL('../../',import.meta.url));
test('real SiteController journal CAS preserves a newer operation during the DNR lock queue',async()=>{
 const browser=await chromium.launch({headless:true,...(process.env.CHROME_EXECUTABLE?{executablePath:process.env.CHROME_EXECUTABLE}:{})});
 try{
  const page=await browser.newPage();await page.route('**/*',async route=>{
   const path=new URL(route.request().url()).pathname;
   if(/^\/(extension\/(src|a1|member-a1|background)\/[a-z0-9-]+\.(js|mjs|json)|contracts\/additional-mvp\/rc1\/schema\.json)$/.test(path))return route.fulfill({contentType:path.endsWith('.json')?'application/json':'text/javascript',body:await readFile(join(root,path.slice(1)),'utf8')});
   return route.fulfill({contentType:'text/html',body:'<!doctype html><title>Site DNR journal CAS</title>'});
  });await page.goto('https://focurve.test/');
  const result=await page.evaluate(async()=>{
   const [{SiteController},{MemberJournalStore},{installMemberDnrWriter}]=await Promise.all([import('/extension/src/site-controller.js'),import('/extension/src/member-journal-store.js'),import('/extension/src/additional-dnr-legacy-writer.js')]);
   await import('/extension/background/member-auth.js');let rules=[],adds=0;
   const dnr={getSessionRules:async()=>structuredClone(rules),isRegexSupported:async()=>({isSupported:true}),updateSessionRules:async({addRules=[],removeRuleIds=[]})=>{if(addRules.length)adds++;rules=rules.filter(r=>!removeRuleIds.includes(r.id)).concat(structuredClone(addRules));}};
   installMemberDnrWriter({declarativeNetRequest:dnr},indexedDB,navigator.locks);
   const journal=new MemberJournalStore(),identity={owner_key:'MEMBER:42',executor_id:crypto.randomUUID()},context={...identity,session_id:crypto.randomUUID(),revision:1,desired:'APPLIED',reconciled:true};
   const command=()=>{const at=new Date().toISOString();return {command_id:crypto.randomUUID(),session_id:context.session_id,executor_id:context.executor_id,type:'APPLY_POLICY',desired_revision:1,duration_minutes:5,created_at:at,execute_before:new Date(Date.now()+30000).toISOString(),snapshot:{format_version:'1.2',site_match_strategy:'MOST_SPECIFIC_HOST',policy_snapshot_id:crypto.randomUUID(),owner_user_id:'42',executor_id:context.executor_id,created_at:at,source_version:1,content_policy:FocurveHostPolicy.defaultContent(),sites:[{site_id:'1',canonical_host:'example.com',display_name:'Example',include_subdomains:false,purpose:'DISTRACTION',access_policy:'BLOCK',feature_policies:[],version:1,created_at:at,updated_at:at}]}};};
   let localCommand;
   const controller=new SiteController({dnr,journal,tabs:{query:async()=>[]},getContext:async()=>context,getDnrContext:async()=>({...context,command_id:localCommand.command_id}),blockedPageUrl:'chrome-extension://test/blocked/index.html'});
   const first=command();localCommand=first;await controller.apply(first);context.revision=2;context.desired='RELEASED';await controller.release({...first,command_id:crypto.randomUUID(),type:'RELEASE_POLICY',desired_revision:2});
   const normal={observed:(await journal.load(identity.owner_key,first.session_id)).observed,rules:rules.length};
   context.session_id=crypto.randomUUID();context.revision=1;context.desired='APPLIED';
   let held,unlock,queued;const entered=new Promise(r=>{held=r;}),release=new Promise(r=>{unlock=r;}),waiting=new Promise(r=>{queued=r;});
   const blocker=navigator.locks.request('focurve:amvp:dnr-writer',async()=>{held();await release;});await entered;
   const writer=controller.dnrWriter;controller.dnrWriter=(r,send)=>{queued();return writer(r,send);};
   const next=command();localCommand=next;const pending=controller.apply(next).then(()=>null,error=>error.message);await waiting;
   const old=await journal.load(identity.owner_key,next.session_id),replacement={...old,command_id:crypto.randomUUID(),revision:2,action_seq:2};await journal.save(replacement);
   unlock();await blocker;const error=await pending,current=await journal.load(identity.owner_key,next.session_id);
   return {normal,error,same:current.command_id===replacement.command_id,revision:current.revision,adds,rules:rules.length};
  });assert.deepEqual(result,{normal:{observed:'RELEASED',rules:0},error:'ROLLBACK_UNCONFIRMED',same:true,revision:2,adds:1,rules:0});
 }finally{await browser.close();}
});
