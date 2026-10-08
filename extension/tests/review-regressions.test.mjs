import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import { webcrypto } from 'node:crypto';
import { IDBFactory } from 'fake-indexeddb';

// 제품 classic scripts와 실제 저장 transaction을 실행하되 Chrome APIs/IndexedDB는 모의입니다.
async function fixture() {
 let time = Date.parse('2026-10-08T10:00:00Z');
 let rules = [], releaseFailures = 0, boot = true, ruleUpdates = 0;
 class Clock extends Date { constructor(...args){super(...(args.length ? args : [time]));} static now(){return time;} }
 const bindings = {URL, Date:Clock, crypto:webcrypto, TextEncoder, structuredClone,
  indexedDB:new IDBFactory(), setTimeout,
  chrome:{runtime:{getURL:path=>'chrome-extension://test/'+path},
   storage:{session:{get:async()=>({focurve_boot:boot}),set:async()=>{boot=true;}}},
   alarms:{create:async()=>{},clear:async()=>{}},tabs:{query:async()=>[],update:async()=>{}},
   declarativeNetRequest:{getSessionRules:async()=>structuredClone(rules),isRegexSupported:async()=>({isSupported:true}),
    updateSessionRules:async({addRules=[],removeRuleIds=[]})=>{
     if(removeRuleIds.length && releaseFailures-- > 0)throw new Error('MOCK_RELEASE_FAILURE');
     ruleUpdates++;
     rules=rules.filter(r=>!removeRuleIds.includes(r.id)).concat(structuredClone(addRules));
    }}}};
 async function spawnWorker(){
 const context=vm.createContext({...bindings});
 for(const file of ['host-policy','local-store','site-store','session-db','access-store','session-core'])
  vm.runInContext(await readFile(new URL('../background/'+file+'.js',import.meta.url),'utf8'), context);
 return vm.runInContext('({sites:GuestSites,core:GuestSession,access:AccessStore,db:SessionDB,local:LocalStore})',context);
 }
 const api=await spawnWorker();
 return {...api,spawnWorker,dropRule:id=>{rules=rules.filter(r=>r.id!==id);},advance:ms=>{time+=ms;},restart:()=>{boot=false;},failRelease:n=>{releaseFailures=n;},
  get time(){return time;},get rules(){return rules;},get ruleUpdates(){return ruleUpdates;}};
}
const input=(host='example.com',policy='BLOCK')=>({url:host,display_name:host,include_subdomains:true,
 purpose:policy==='ALLOW'?'GENERAL':'DISTRACTION',access_policy:policy,feature_policies:[]});
const uuid=()=>webcrypto.randomUUID();
// 이전 제품에는 onErrorOccurred handler가 없으므로 오류 이벤트가 전달되지 않습니다.
const failed=(f,details)=>f.access.fail?f.core.observe('error',details):Promise.resolve();
async function running(f){await f.sites.create(input(),uuid());return f.core.start(25,uuid());}
const navigation=(f,url,timeStamp=100)=>({tabId:1,frameId:0,url,timeStamp,observed_at:f.time,transitionType:'typed'});
function blocked(session){return 'chrome-extension://test/blocked/blocked.html?host=example.com&session='+session.session.session_id;}

test('review 1: interrupted release retries retain terminal status and confirmed duration',async()=>{
 const f=await fixture();const started=await running(f);
 f.advance(10_000);await f.core.tick();f.advance(50_000);f.restart();f.failRelease(2);
 await assert.rejects(f.core.tick(),{message:'MOCK_RELEASE_FAILURE'});
 const pending=await f.db.load();assert.equal(pending.session.status,'UNKNOWN');
 assert.equal(pending.journal.terminal_intent.status,'INTERRUPTED');
 f.advance(60_000);await assert.rejects(f.core.tick(),{message:'MOCK_RELEASE_FAILURE'});
 f.advance(60_000);const ended=await f.core.tick();
 assert.equal(ended.session.status,'INTERRUPTED');assert.equal(ended.session.active_duration_ms,10_000);
 assert.equal(ended.journal.terminal_intent.confirmed_end_at,new Date(Date.parse(started.session.started_at)+10_000).toISOString());
 assert.equal(f.rules.length,0);
});
test('review 1: user end failure retries do not add release waiting time',async()=>{
 const f=await fixture();const started=await running(f);f.advance(10_000);f.failRelease(1);
 await assert.rejects(f.core.end(started.session.session_id));f.advance(60_000);
 const ended=await f.core.tick();assert.equal(ended.session.status,'ENDED');assert.equal(ended.session.active_duration_ms,10_000);
});
test('review 2: failed navigation cannot turn blocked page reload into access',async()=>{
 const f=await fixture();const session=await running(f);
 await f.core.observe('before',navigation(f,'https://example.com/'));
 await failed(f,navigation(f,'https://example.com/',110));
 await f.core.observe('commit',{...navigation(f,blocked(session),120),transitionType:'reload'});
 assert.equal((await f.core.records()).total_access,0);
});
test('review 2: late old failure preserves next navigation on the same host',async()=>{
 const f=await fixture();const session=await running(f);
 await f.core.observe('before',navigation(f,'https://example.com/old',100));
 await f.core.observe('before',navigation(f,'https://example.com/new',200));
 await failed(f,navigation(f,'https://example.com/old',210));
 await f.core.observe('commit',navigation(f,blocked(session),220));
 assert.equal((await f.core.records()).total_access,1);
});
test('review 2: stale same-URL failure and subframe failure preserve new pending navigation',async()=>{
 const f=await fixture();const session=await running(f);const url='https://example.com/';
 await f.core.observe('before',navigation(f,url,200));
 await failed(f,navigation(f,url,150));
 await failed(f,{...navigation(f,url,210),frameId:1});
 await f.core.observe('commit',navigation(f,blocked(session),220));
 assert.equal((await f.core.records()).total_access,1);
});
for(const policy of ['BLOCK','RECORD'])test(`review 3: ${policy} policy and persisted event use canonical trailing-dot host`,async()=>{
 const f=await fixture();await f.sites.create(input('example.com',policy),uuid());const session=await f.core.start(25,uuid());
 await f.core.observe('before',navigation(f,'https://EXAMPLE.com./path'));
 await f.core.observe('commit',navigation(f,policy==='BLOCK'?blocked(session):'https://example.com./path',120));
 const result=await f.core.records();assert.equal(result.total_access,1);
 assert.equal(result.items[0].payload.target_host,'example.com');assert.equal(result.items[0].payload.target_key,'SITE:example.com');
 assert.equal(f.core.normalizeHost('https://bücher.example./'),'xn--bcher-kva.example');
});
test('review 4: deleted host restores ID and creation time, increments versions, and replays once',async()=>{
 const f=await fixture();const original=await f.sites.create(input(),uuid());
 const removed=await f.sites.remove(original.site_id,original.version,uuid());assert.equal(removed.version,2);
 f.advance(1000);const request=uuid();const restored=await f.sites.create(input('EXAMPLE.com','RECORD'),request);
 assert.equal(restored.site_id,original.site_id);assert.equal(restored.created_at,original.created_at);
 assert.equal(restored.version,3);assert.equal(restored.deleted_at,undefined);assert.equal(restored.access_policy,'RECORD');
 assert.equal((await f.sites.list()).items.length,1);assert.equal((await f.sites.list()).settings_version,3);
 const replay=await f.sites.create(input('EXAMPLE.com','RECORD'),request);assert.equal(replay.version,3);
 assert.equal((await f.sites.list()).settings_version,3);
 await assert.rejects(f.sites.create(input(),uuid()),{message:'SITE_SCOPE_CONFLICT'});
 await assert.rejects(f.sites.update(restored.site_id,1,input(),uuid()),{message:'VERSION_CONFLICT'});
});

test('review 1: legacy release journal without terminal intent recovers conservatively',async()=>{
 const f=await fixture();await running(f);f.advance(10_000);await f.core.tick();
 const state=await f.db.load();state.session.status='UNKNOWN';state.session.end_reason='POLICY_MISMATCH';
 state.journal.desired='RELEASED';await f.db.save(state);f.advance(60_000);
 const ended=await f.core.tick();assert.equal(ended.session.status,'INTERRUPTED');assert.equal(ended.session.active_duration_ms,10_000);
});

test('1.2 guest registration normalizes root dot, allows nested hosts, and rejects exact duplicates',async()=>{
 const f=await fixture();const parent=await f.sites.create(input('NAVER.com.'),uuid());
 const child=await f.sites.create(input('chzzk.naver.com','ALLOW'),uuid());
 assert.equal(parent.canonical_host,'naver.com');assert.notEqual(child.site_id,parent.site_id);
 await assert.rejects(f.sites.create(input('naver.com/path'),uuid()),{message:'SITE_SCOPE_CONFLICT'});
 await assert.rejects(f.sites.create(input('user:pass@naver.com'),uuid()),{message:'INVALID_URL'});
 await assert.rejects(f.sites.create(input('naver.com:443'),uuid()),{message:'INVALID_URL'});
 await assert.rejects(f.sites.update(child.site_id,child.version,input('naver.com'),uuid()),{message:'SITE_SCOPE_CONFLICT'});
 await f.sites.remove(parent.site_id,parent.version,uuid());
 await assert.rejects(f.sites.update(child.site_id,child.version,input('naver.com'),uuid()),{message:'SITE_SCOPE_CONFLICT'});
 assert.equal((await f.sites.create(input('naver.com'),uuid())).site_id,parent.site_id);
});
test('1.2 guest snapshots are sorted/immutable; ALLOW overrides parent BLOCK without generating access',async()=>{
 const f=await fixture();await f.sites.create(input('naver.com'),uuid());
 const child=await f.sites.create(input('chzzk.naver.com','ALLOW'),uuid());
 const started=await f.core.start(25,uuid());const snapshot=structuredClone(started.session.snapshot);
 assert.equal(snapshot.format_version,'1.2');assert.equal(snapshot.site_match_strategy,'MOST_SPECIFIC_HOST');
 assert.deepEqual(Array.from(snapshot.sites,s=>s.canonical_host),['chzzk.naver.com','naver.com']);
 await f.core.observe('before',navigation(f,'https://chzzk.naver.com./'));
 await f.core.observe('commit',navigation(f,'https://chzzk.naver.com./',120));
 assert.equal((await f.core.records()).total_access,0);
 await f.sites.update(child.site_id,child.version,input('chzzk.naver.com','BLOCK'),uuid());
 assert.deepEqual((await f.core.state()).session.snapshot,snapshot);
 await f.core.end(started.session.session_id);const next=await f.core.start(25,uuid());
 assert.equal(next.session.snapshot.sites[0].access_policy,'BLOCK');
 assert.equal(f.rules.every(r=>r.action.type==='redirect'),true);
});
test('1.2 child RECORD event wins over parent BLOCK and uses child target',async()=>{
 const f=await fixture();await f.sites.create(input('naver.com'),uuid());
 await f.sites.create(input('chzzk.naver.com','RECORD'),uuid());await f.core.start(25,uuid());
 await f.core.observe('before',navigation(f,'https://live.chzzk.naver.com./'));
 await f.core.observe('commit',navigation(f,'https://live.chzzk.naver.com./',120));
 const {items,total_access}=await f.core.records();assert.equal(total_access,1);
 assert.equal(items[0].event_type,'RECORDED_ACCESS');assert.equal(items[0].schema_version,'1.1');
 assert.equal(items[0].payload.target_host,'live.chzzk.naver.com');assert.equal(items[0].payload.target_key,'SITE:chzzk.naver.com');
});
test('existing 1.1 guest recovery preserves original snapshot and rule IDs',async()=>{
 const f=await fixture();await running(f);const state=await f.db.load();state.session.snapshot.format_version='1.1';
 delete state.session.snapshot.site_match_strategy;await f.db.save(state);
 const old=structuredClone(state.session.snapshot),rules=structuredClone(f.rules);
 await f.core.tick();assert.deepEqual((await f.db.load()).session.snapshot,old);assert.deepEqual(f.rules,rules);
});
test('unsupported stored strategy never reports RUNNING and releases owned rules',async()=>{
 const f=await fixture();await running(f);const state=await f.db.load();state.session.snapshot.site_match_strategy='FIRST';await f.db.save(state);
 await assert.rejects(f.core.tick(),{message:'SNAPSHOT_VERSION_UNSUPPORTED'});
 assert.equal((await f.db.load()).session.status,'INTERRUPTED');assert.equal(f.rules.length,0);
});

test('fresh Worker VM retains 1.2 RUNNING snapshot and rules despite changed settings',async()=>{
 const f=await fixture();await f.sites.create(input('naver.com'),uuid());
 const child=await f.sites.create(input('chzzk.naver.com','ALLOW'),uuid());
 const started=await f.core.start(25,uuid());const snapshot=structuredClone(started.session.snapshot),rules=structuredClone(f.rules),updates=f.ruleUpdates;
 await f.sites.update(child.site_id,child.version,input('chzzk.naver.com','BLOCK'),uuid());
 f.advance(10_000);const worker=await f.spawnWorker();assert.notEqual(worker.core,f.core);
 const recovered=await worker.core.state();assert.equal(recovered.session.status,'RUNNING');
 assert.equal(recovered.session.session_id,started.session.session_id);
 assert.deepEqual(recovered.session.snapshot,snapshot);assert.deepEqual(f.rules,rules);assert.equal(f.ruleUpdates,updates);
 await worker.core.end(started.session.session_id);assert.equal(f.rules.length,0);
 const next=await worker.core.start(25,uuid());assert.equal(next.session.snapshot.sites[0].access_policy,'BLOCK');
});
test('fresh Worker VM with missing child allow releases remaining rules without reapply',async()=>{
 const f=await fixture();await f.sites.create(input('naver.com'),uuid());await f.sites.create(input('chzzk.naver.com','ALLOW'),uuid());
 await f.core.start(25,uuid());const updates=f.ruleUpdates;
 f.dropRule(f.rules.find(r=>r.action.type==='allow').id);f.advance(10_000);
 const worker=await f.spawnWorker();const recovered=await worker.core.state();
 assert.equal(recovered.session.status,'INTERRUPTED');assert.equal(recovered.session.end_reason,'POLICY_MISMATCH');
 assert.equal(f.rules.length,0);assert.equal(f.ruleUpdates,updates+1);
 assert.equal(recovered.session.active_duration_ms,0);
});
test('fresh Worker VM retries failed interrupted release with persisted intention and confirmed boundary',async()=>{
 const f=await fixture();await running(f);f.advance(10_000);await f.core.tick();
 f.restart();f.advance(50_000);f.failRelease(1);
 await assert.rejects(f.core.tick(),{message:'MOCK_RELEASE_FAILURE'});
 const pending=await f.db.load();f.advance(60_000);
 const worker=await f.spawnWorker();const recovered=await worker.core.state();
 assert.equal(recovered.session.status,'INTERRUPTED');assert.equal(recovered.session.active_duration_ms,10_000);
 assert.deepEqual(recovered.journal.terminal_intent,pending.journal.terminal_intent);assert.equal(f.rules.length,0);
});
test('fresh Worker VM commits persisted pending RECORD observation once',async()=>{
 const f=await fixture();await f.sites.create(input('example.com','RECORD'),uuid());await f.core.start(25,uuid());
 await f.core.observe('before',navigation(f,'https://example.com./',100));
 const worker=await f.spawnWorker();await worker.core.tick();
 await worker.core.observe('commit',navigation(f,'https://example.com./',120));
 await worker.core.observe('commit',navigation(f,'https://example.com./',120));
 const result=await worker.core.records();assert.equal(result.total_access,1);
 assert.equal(result.items[0].payload.target_host,'example.com');
});
test('fresh Worker VM after planned end confirms release instead of resuming expired focus',async()=>{
 const f=await fixture();await running(f);f.advance(26*60_000);
 const worker=await f.spawnWorker();const recovered=await worker.core.state();
 assert.equal(recovered.session.status,'ENDED');assert.equal(recovered.session.end_reason,'TIME_LIMIT');assert.equal(f.rules.length,0);
});
