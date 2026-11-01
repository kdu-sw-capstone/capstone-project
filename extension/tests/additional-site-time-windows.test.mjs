import test from 'node:test';
import assert from 'node:assert/strict';
import {evaluateSiteTimeWindows as evaluate} from '../src/additional-site-time-windows.js';
const NOW='2026-11-02T10:30:00.000Z';
const once=(start='2026-11-02T10:00:00.000Z',end='2026-11-02T11:00:00.000Z',kind='BLOCK_WINDOW')=>({window_id:crypto.randomUUID(),kind,enabled:true,when:{recurrence:'ONCE',start_at:start,end_at:end}});
const weekly=(patch={},kind='BLOCK_WINDOW')=>({window_id:crypto.randomUUID(),kind,enabled:true,when:{recurrence:'WEEKLY',weekdays:[1],start_local:'23:00',end_local:'01:00',end_day_offset:1,timezone:'Asia/Seoul',dst_gap:'SKIP',dst_overlap:'EARLIER_ONCE',...patch}});
const policy=(windows=[],patch={})=>({kind:'SITE_TIME',policy_id:crypto.randomUUID(),version:1,site_id:null,scope:{host:'example.test',include_subdomains:true},enabled:true,tracking_scope:'BROWSER_ALWAYS',daily_limit_ms:null,windows,...patch});
const run=(policies,nowAt=NOW,host='example.test')=>evaluate({policies,host,nowAt});
const blocked=result=>result.decision==='WINDOW_BLOCK_REQUIRED';
test('ONCE uses exact half-open millisecond boundaries',()=>{
 const p=policy([once()]);for(const [at,want] of [['2026-11-02T09:59:59.999Z',false],['2026-11-02T10:00:00.000Z',true],['2026-11-02T10:59:59.999Z',true],['2026-11-02T11:00:00.000Z',false]])assert.equal(blocked(run([p],at)),want);
});
test('ONCE crossing UTC midnight and a future expired window are not caught up',()=>{
 const p=policy([once('2026-11-02T23:00:00.000Z','2026-11-03T01:00:00.000Z')]);assert.equal(blocked(run([p],'2026-11-03T00:00:00.000Z')),true);assert.equal(blocked(run([p],'2026-11-03T01:00:00.000Z')),false);
});
test('host matching uses exact label boundaries and include_subdomains',()=>{
 const p=policy([once()]);assert.equal(blocked(run([p],NOW,'a.b.example.test')),true);
 for(const host of ['evil-example.test','example.test.evil','other.test'])assert.equal(run([p],NOW,host).policies.length,0);
 p.scope.include_subdomains=false;assert.equal(run([p],NOW,'a.example.test').policies.length,0);assert.equal(blocked(run([p])),true);
});
test('every matching parent and child constraint applies; a child allow cannot remove parent block',()=>{
 const parent=policy([once()]),child=policy([once(undefined,undefined,'ALLOW_WINDOW')],{scope:{host:'child.example.test',include_subdomains:false}});
 const r=run([parent,child],NOW,'child.example.test');assert.equal(r.policies.length,2);assert.deepEqual(r.reasons,['BLOCK_WINDOW']);assert.deepEqual(r.policies[1].reasons,[]);
});
test('ALLOW windows form a union inside one policy',()=>{
 const p=policy([once('2026-11-02T09:00:00.000Z','2026-11-02T11:00:00.000Z','ALLOW_WINDOW'),once('2026-11-02T10:00:00.000Z','2026-11-02T12:00:00.000Z','ALLOW_WINDOW')]);
 const r=run([p]);assert.equal(r.decision,'NO_WINDOW_BLOCK');assert.equal(r.policies[0].matched_window_ids.length,2);assert.deepEqual(run([p],'2026-11-02T12:00:00.000Z').reasons,['OUTSIDE_ALLOW_WINDOW']);
});
test('ALLOW constraints across policies compose with AND',()=>{
 const a=policy([once(undefined,undefined,'ALLOW_WINDOW')]),b=policy([once('2026-11-02T12:00:00.000Z','2026-11-02T13:00:00.000Z','ALLOW_WINDOW')]);const r=run([a,b]);
 assert.deepEqual(r.reasons,['OUTSIDE_ALLOW_WINDOW']);assert.deepEqual(r.policies[0].reasons,[]);assert.deepEqual(r.policies[1].reasons,['OUTSIDE_ALLOW_WINDOW']);
});
test('BLOCK windows take precedence even while an ALLOW window matches',()=>{
 const r=run([policy([once(),once(undefined,undefined,'ALLOW_WINDOW')])]);assert.deepEqual(r.reasons,['BLOCK_WINDOW']);assert.equal(r.policies[0].matched_window_ids.length,2);
});
test('disabled policies and windows do not impose a window constraint',()=>{
 const off=once();off.enabled=false;const p=policy([off]);assert.deepEqual(run([p]).reasons,[]);p.enabled=false;assert.equal(run([p]).policies.length,0);
});
test('unlimited quota never overrides an outside-ALLOW restriction',()=>{
 const r=run([policy([once('2026-11-02T12:00:00.000Z','2026-11-02T13:00:00.000Z','ALLOW_WINDOW')])]);assert.deepEqual(r.reasons,['OUTSIDE_ALLOW_WINDOW']);assert.equal(r.requires_quota_evaluation,false);
});
test('NO_WINDOW_BLOCK never grants full ALLOW or pretends quota has been evaluated',()=>{
 const r=run([policy([],{daily_limit_ms:60000})]);assert.equal(r.decision,'NO_WINDOW_BLOCK');assert.equal(r.requires_quota_evaluation,true);assert.equal(r.local_only,true);assert.equal(Object.hasOwn(r,'allowed'),false);assert.equal(Object.hasOwn(r,'remaining_ms'),false);
 const nonmatch=policy([],{scope:{host:'other.test',include_subdomains:false},daily_limit_ms:60000});assert.equal(run([nonmatch]).requires_quota_evaluation,false);
});
test('WEEKLY overnight uses the starting weekday across local midnight',()=>{
 const p=policy([weekly()]);assert.equal(blocked(run([p],'2026-11-02T14:00:00.000Z')),true);assert.equal(blocked(run([p],'2026-11-02T15:30:00.000Z')),true);assert.equal(blocked(run([p],'2026-11-02T16:00:00.000Z')),false);assert.equal(blocked(run([p],'2026-11-01T14:30:00.000Z')),false);
});
test('a weekly ALLOW still restricts outside its scheduled weekday',()=>{
 const p=policy([weekly({},'ALLOW_WINDOW')]);assert.deepEqual(run([p],'2026-11-04T14:30:00.000Z').reasons,['OUTSIDE_ALLOW_WINDOW']);
});
test('DST gap at start skips the occurrence; skipped ALLOW is not expanded',()=>{
 const w=weekly({weekdays:[7],start_local:'02:10',end_local:'03:10',end_day_offset:0,timezone:'America/New_York'}),p=policy([w]);
 const r=run([p],'2026-03-08T07:00:00.000Z');assert.equal(blocked(r),false);assert.equal(r.policies[0].skipped_occurrences[0].reason,'DST_GAP');
 w.kind='ALLOW_WINDOW';assert.deepEqual(run([p],'2026-03-08T07:00:00.000Z').reasons,['OUTSIDE_ALLOW_WINDOW']);
});
test('DST gap at end skips the whole window instead of shifting its endpoint',()=>{
 const p=policy([weekly({weekdays:[7],start_local:'01:30',end_local:'02:30',end_day_offset:0,timezone:'America/New_York'})]);const r=run([p],'2026-03-08T06:45:00.000Z');assert.equal(blocked(r),false);assert.equal(r.policies[0].skipped_occurrences.length,1);
});
test('DST fold resolves both ambiguous endpoints to the earlier occurrence only',()=>{
 const p=policy([weekly({weekdays:[7],start_local:'01:30',end_local:'01:45',end_day_offset:0,timezone:'America/New_York'})]);assert.equal(blocked(run([p],'2026-11-01T05:35:00.000Z')),true);assert.equal(blocked(run([p],'2026-11-01T06:35:00.000Z')),false);
});
test('one contiguous window across a fold includes the repeated hour without duplicate window IDs',()=>{
 const p=policy([weekly({weekdays:[7],start_local:'00:30',end_local:'02:30',end_day_offset:0,timezone:'America/New_York'})]),r=run([p],'2026-11-01T06:35:00.000Z');assert.equal(blocked(r),true);assert.equal(r.policies[0].matched_window_ids.length,1);assert.equal(blocked(run([p],'2026-11-01T07:30:00.000Z')),false);
});
test('Lord Howe thirty-minute fold does not replay the later occurrence',()=>{
 const p=policy([weekly({weekdays:[7],start_local:'01:40',end_local:'01:50',end_day_offset:0,timezone:'Australia/Lord_Howe'})]);assert.equal(blocked(run([p],'2026-04-04T14:45:00.000Z')),true);assert.equal(blocked(run([p],'2026-04-04T15:15:00.000Z')),false);
});
test('Apia missing calendar day skips the nonexistent Friday start',()=>{
 const p=policy([weekly({weekdays:[5],timezone:'Pacific/Apia'})]);const r=run([p],'2011-12-30T10:30:00.000Z');assert.equal(blocked(r),false);assert.equal(r.policies[0].skipped_occurrences[0].local_start_date,'2011-12-30');
});
test('24-hour local window across fall-back retains its full 25-hour physical interval',()=>{
 const p=policy([weekly({weekdays:[7],start_local:'01:00',end_local:'01:00',end_day_offset:1,timezone:'America/New_York'})]);assert.equal(blocked(run([p],'2026-11-02T05:30:00.000Z')),true);assert.equal(blocked(run([p],'2026-11-02T06:00:00.000Z')),false);
});
test('historical backward date-line fold can contain an occurrence whose start date label is tomorrow',()=>{
 const p=policy([weekly({weekdays:[6],start_local:'14:00',end_local:'13:00',end_day_offset:1,timezone:'America/Juneau'})]);
 assert.equal(blocked(run([p],'1867-10-19T06:00:00.000Z')),true);assert.equal(blocked(run([p],'1867-10-20T21:57:41.000Z')),false);
});
test('malformed policy shape, dates, duration, flags and zones reject the full input',()=>{
 for(const patch of [{version:0},{version:Number.MAX_SAFE_INTEGER+1},{enabled:'yes'},{kind:{}},{tracking_scope:{}},{extra:true},{daily_limit_ms:1}])assert.throws(()=>run([policy([],{...patch})]),/INVALID_SITE_TIME_WINDOW_INPUT/);
 for(const w of [once(NOW,NOW),once(NOW,'2026-11-03T10:30:00.001Z'),once('2026-02-30T00:00:00.000Z'),weekly({start_local:'01:00',end_local:'01:00',end_day_offset:0}),weekly({weekdays:[1,1]}),weekly({timezone:'+09:00'}),weekly({timezone:'CST'}),weekly({timezone:'Mars/Olympus'}),weekly({timezone:'asia/seoul'})])assert.throws(()=>run([policy([w])]),/INVALID_SITE_TIME_WINDOW_INPUT/);
 const disabled=policy([],{enabled:false,unknown:true});assert.throws(()=>run([disabled]),/INVALID_SITE_TIME_WINDOW_INPUT/);
});
test('duplicate policy or window identities never silently select one version',()=>{
 const p=policy([once()]);assert.throws(()=>run([p,{...p,version:2}]),/INVALID_SITE_TIME_WINDOW_INPUT/);p.windows.push({...p.windows[0],kind:'ALLOW_WINDOW'});assert.throws(()=>run([p]),/INVALID_SITE_TIME_WINDOW_INPUT/);
});
test('canonical punycode is accepted; raw URLs, Unicode, uppercase and trailing dots are refused',()=>{
 const p=policy([once()],{scope:{host:'xn--bcher-kva.test',include_subdomains:true}});assert.equal(blocked(run([p],NOW,'a.xn--bcher-kva.test')),true);
 for(const host of ['https://example.test','EXAMPLE.TEST','example.test.','bücher.test'])assert.throws(()=>run([],NOW,host),/INVALID_SITE_TIME_WINDOW_INPUT/);
});
test('input stays frozen and the evaluator never reads Date.now or creates effect evidence',()=>{
 const p=policy([once()]),before=JSON.stringify(p);Object.freeze(p.windows);Object.freeze(p);const saved=Date.now;Date.now=()=>{throw Error('UNTRUSTED_CLOCK');};
 try{const r=run([p]);assert.equal(r.evaluated_at,NOW);assert.equal(Object.hasOwn(r,'applied'),false);}finally{Date.now=saved;}
 assert.equal(JSON.stringify(p),before);
});
test('Schema maxima are honored without truncating the matching set',()=>{
 const p=policy(Array.from({length:100},()=>once()));assert.equal(run([p]).policies[0].matched_window_ids.length,100);p.windows.push(once());assert.throws(()=>run([p]),/INVALID_SITE_TIME_WINDOW_INPUT/);
 const policies=Array.from({length:200},()=>policy());assert.equal(run(policies).policies.length,200);assert.throws(()=>run([...policies,policy()]),/INVALID_SITE_TIME_WINDOW_INPUT/);
});
