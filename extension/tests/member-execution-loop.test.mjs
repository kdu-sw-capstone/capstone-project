import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { IDBFactory } from 'fake-indexeddb';
import { MemberExecutionClient, MemberReportStore } from '../src/member-execution-client.js';
import { MemberAccessStore } from '../src/member-access.js';
import { MemberJournalStore } from '../src/member-journal-store.js';
import { MemberExecutionLoop } from '../src/member-execution-loop.js';
import { bundleMemberWorker } from '../scripts/build-member-worker.js';
import { readFileSync } from 'node:fs';

function fixture() {
  let now = Date.parse('2026-10-10T00:00:00Z'), rules = [], additions = 0, posts = [], lose = false;
  const ex = randomUUID(), sessionId = randomUUID(), snapshotId = randomUUID();
  const credentials = { owner_key: 'MEMBER:1', executor_id: ex, access_token: 'synthetic' };
  const session = { session_id: sessionId, executor_id: ex, policy_snapshot_id: snapshotId, duration_minutes: 1,
    desired_revision: 1, execution_status: 'STARTING', automatic_recovery_supported: false, time_accounting_mode: 'LEGACY_WALL_CLOCK' };
  const snapshot = { format_version: '1.2', site_match_strategy: 'MOST_SPECIFIC_HOST', policy_snapshot_id: snapshotId,
    executor_id: ex, owner_user_id: '1', sites: [{ canonical_host: 'example.org', include_subdomains: true,
      access_policy: 'BLOCK', feature_policies: [] }], content_policy: Object.fromEntries(
        ['keywords', 'adult_domains', 'image_blur', 'usage_tracking'].map(key => [key, { enabled: false }])) };
  const apply = { command_id: randomUUID(), session_id: sessionId, executor_id: ex, desired_revision: 1,
    type: 'APPLY_POLICY', created_at: new Date(now).toISOString(), execute_before: new Date(now + 60000).toISOString(),
    duration_minutes: 1, snapshot };
  let commands = [apply];
  const db = new IDBFactory(), journal = new MemberJournalStore({ indexedDB: db });
  const control = new MemberJournalStore({ indexedDB: db, name: 'control' });
  const store = new MemberReportStore({ indexedDB: db });
  const fetch = async (url, options) => {
    let body;
    if (url.endsWith('/commands')) body = { commands, next_cursor: '', server_time: new Date(now).toISOString() };
    else if (url.endsWith('/reports')) {
      const report = JSON.parse(options.body); posts.push(report);
      if (report.result === 'APPLIED') { session.execution_status = 'RUNNING'; commands = []; }
      if (report.result === 'RELEASED') { session.execution_status = 'ENDED'; commands = []; }
      if (report.result === 'FAILED') {
        session.desired_revision = 2; session.execution_status = 'UNKNOWN';
        commands = [{ ...apply, command_id: randomUUID(), type: 'RELEASE_POLICY', desired_revision: 2 }];
      }
      if (lose) { lose = false; throw new Error('loss'); }
      body = { result: 'ACCEPTED', desired_revision: session.desired_revision };
    } else if (url.endsWith('/reconcile')) {
      const request = JSON.parse(options.body); posts.push(request);
      if (request.local_actions.length) { session.execution_status = 'ENDED'; commands = []; }
      body = { desired_state: session.execution_status === 'RUNNING' ? 'APPLIED' : 'RELEASED',
        revision: session.desired_revision, acknowledged_actions: request.local_actions.map(action => ({ action_id: action.action_id, status: 'ACCEPTED' })) };
    } else body = structuredClone(session);
    return new Response(JSON.stringify(body));
  };
  const client = new MemberExecutionClient({ baseUrl: 'http://localhost/api/v1', getCredentials: async () => credentials,
    store, fetch, now: () => now });
  const options = { accessStore:new MemberAccessStore({indexedDB:db}), client, getCredentials: async () => credentials, journal, control, idle: async () => {},
    dnr: { getSessionRules: async () => structuredClone(rules), isRegexSupported: async () => ({ isSupported: true }),
      updateSessionRules: async ({ addRules = [], removeRuleIds = [] }) => {
        additions += addRules.length; rules = rules.filter(rule => !removeRuleIds.includes(rule.id)).concat(addRules);
      } }, tabs: { query: async () => [] }, blockedPageUrl: 'chrome-extension://synthetic/blocked/blocked.html', now: () => now };
  const loop = new MemberExecutionLoop(options);
  return { loop, options, client, journal, control, store, sessionId, apply, credentials, session, posts,
    advance: ms => { now += ms; }, lose: () => { lose = true; }, rules: () => rules, additions: () => additions,
    clear: () => { rules = []; }, release: () => { session.desired_revision = 2; session.execution_status = 'ENDING';
      commands = [{ ...apply, command_id: randomUUID(), desired_revision: 2, type: 'RELEASE_POLICY' }]; },
    replay: () => { commands = [apply]; }, addForeign: () => { rules.push({ id: 9000, action: { type: 'block' } }); } };
}

test('classic Worker bundle exactly matches source modules', () => {
  assert.equal(readFileSync(new URL('../background/member-execution.js', import.meta.url), 'utf8'), bundleMemberWorker());
});
test('apply requires actual rules, reports observed RUN, replay/recovery never reapplies or resets timer', async () => {
  const f = fixture(); await f.loop.tick(); assert.ok(f.rules().length);
  const entry = await f.control.load('MEMBER:1', f.sessionId);
  assert.equal(f.posts[0].result, 'APPLIED'); assert.equal(entry.phase, 'APPLIED');
  const recreated = new MemberExecutionLoop(f.options); await recreated.tick();
  assert.equal(recreated.view.status, 'RUNNING'); assert.equal(f.additions(), 1);
  f.advance(1000); await recreated.tick();
  assert.equal((await f.control.load('MEMBER:1', f.sessionId)).planned_end_at, entry.planned_end_at);
});
test('Server release is confirmed only after removing owned rules and closing same interval', async () => {
  const f = fixture(); await f.loop.tick(); f.advance(1000); f.release(); await f.loop.tick();
  assert.equal(f.rules().length, 0);
  const reports = f.posts.filter(post => post.result);
  assert.deepEqual(reports.map(report => report.result), ['APPLIED', 'RELEASED']);
  assert.equal(reports[1].intervals[0].interval_id, reports[0].intervals[0].interval_id);
  assert.equal(reports[1].intervals[0].duration_ms, 1000);
  await f.loop.tick(); assert.equal((await f.control.load('MEMBER:1', f.sessionId)).phase, 'FINAL');
});
test('timer removes policy before immutable local END/reconcile and excludes unobserved gap', async () => {
  const f = fixture(); await f.loop.tick(); f.advance(20000); await f.loop.tick();
  f.advance(41000); await f.loop.tick(); assert.equal(f.rules().length, 0);
  const action = f.posts.find(post => post.local_actions?.length).local_actions[0];
  assert.equal(action.reason, 'EXPIRED'); assert.equal(action.local_action_seq, 1);
  assert.equal(action.report.command_id, null); assert.equal(action.report.intervals[0].duration_ms, 20000);
});
test('missing session rules after Worker recreation never automatically reapply or END', async () => {
  const f = fixture(); await f.loop.tick(); f.advance(1000); await f.loop.tick(); f.clear(); f.advance(10000);
  const recreated = new MemberExecutionLoop(f.options); await recreated.tick();
  assert.equal(recreated.view.status, 'RECOVERY_REQUIRED'); assert.equal(f.additions(), 1);
  assert.equal(f.posts.some(post => post.local_actions?.length), false);
  await recreated.end(f.sessionId);
  const action = f.posts.find(post => post.local_actions?.length).local_actions[0];
  assert.equal(action.reason, 'MANUAL'); assert.equal(action.report.intervals[0].duration_ms, 1000);
});
test('rules lost while awaiting Server reconcile cannot confirm RUNNING/checkpoint', async () => {
  const f = fixture(), reconcile = f.client.reconcile.bind(f.client);
  f.client.reconcile = async body => { const response = await reconcile(body); f.clear(); return response; };
  assert.equal((await f.loop.tick()).status, 'RECOVERY_REQUIRED');
  assert.equal((await f.control.load('MEMBER:1', f.sessionId)).phase, 'RECOVERY_REQUIRED');
  assert.equal(f.additions(), 1);
});
test('lost APPLY report replays original ID/body before Worker recovery, without new DNR', async () => {
  const f = fixture(); f.lose(); await f.loop.tick(); const first = f.posts[0]; f.advance(30000);
  await new MemberExecutionLoop(f.options).tick();
  assert.deepEqual(f.posts.filter(post => post.result)[1], first); assert.equal(f.additions(), 1);
});
test('locally applied but undelivered report never shows IDLE or Server-confirmed RUNNING', async () => {
  const f = fixture(); const request = f.client.request.bind(f.client);
  f.client.request = async (path, ...args) => { if (path.endsWith('/reports')) throw new Error('offline before send'); return request(path, ...args); };
  assert.equal((await f.loop.tick()).status, 'UNCONFIRMED'); assert.ok(f.rules().length);
  assert.equal(f.session.execution_status, 'STARTING');
});
test('unsupported feature policy fails wholly, no DNR; cleanup RELEASE may finish no RUN', async () => {
  const f = fixture(); f.apply.snapshot.sites[0].feature_policies.push({ feature_code: 'YOUTUBE_SHORTS' });
  await f.loop.tick(); assert.equal(f.additions(), 0); assert.equal(f.posts[0].result, 'FAILED');
  assert.equal(f.posts[0].error_code, 'FEATURE_NOT_IMPLEMENTED'); await f.loop.tick();
  assert.equal(f.posts.filter(post => post.result).at(-1).result, 'RELEASED');
});
test('foreign rules prevent a fresh APPLY and remain untouched', async () => {
  const f = fixture(); f.addForeign(); await assert.rejects(f.loop.tick(), /EXECUTION_EVIDENCE_REQUIRED/);
  assert.equal(f.rules().length, 1); assert.equal(f.posts.length, 0);
});
test('pending preparation is cleaned, never resumed from a second APPLY', async () => {
  const f = fixture(); await f.loop.tick(); const row = await f.control.load('MEMBER:1', f.sessionId);
  row.phase = 'PREPARING'; row.reports = []; await f.control.save(row);
  const recreated = new MemberExecutionLoop(f.options); await recreated.tick();
  assert.equal(f.rules().length, 0); assert.equal(f.additions(), 1); assert.equal(recreated.view.status, 'RECOVERY_REQUIRED');
});
test('expiry cleanup commits local END before failed credential refresh, then retries identical action', async () => {
  const f = fixture(); await f.loop.tick(); f.advance(61000);
  let offline = true;
  const loop = new MemberExecutionLoop({ ...f.options, getIdentity: async () => f.credentials,
    getCredentials: async () => { if (offline) throw new Error('offline refresh'); return f.credentials; },
    client: { ...f.client, baseUrl: f.client.baseUrl, reconcile: async body => {
      if (offline) throw new Error('offline'); return f.client.reconcile(body);
    } } });
  await assert.rejects(loop.tick(), /offline/); assert.equal(f.rules().length, 0);
  const saved = await f.control.load('MEMBER:1', f.sessionId);
  assert.equal(saved.phase, 'ENDING'); assert.equal(saved.local_end.reason, 'EXPIRED');
  offline = false;
  await f.loop.tick(); const action = f.posts.find(post => post.local_actions?.length).local_actions[0];
  assert.deepEqual(action, saved.local_end);
});
test('stale Server revision prevents any initial DNR change', async () => {
  const f = fixture(); f.session.desired_revision = 2;
  await assert.rejects(f.loop.tick(), /STALE_COMMAND/); assert.equal(f.additions(), 0); assert.equal(f.posts.length, 0);
});
test('unknown/new time-accounting mode cannot execute as legacy wall clock', async () => {
  const f = fixture(); f.session.automatic_recovery_supported = true;
  await assert.rejects(f.loop.tick(), /TIME_ACCOUNTING_UNSUPPORTED/); assert.equal(f.additions(), 0);
});
test('ownership conflict refuses cleanup and never sends a RELEASED or local END', async () => {
  const f = fixture(); await f.loop.tick();
  f.rules()[0].priority++;
  await assert.rejects(f.loop.end(f.sessionId), /RULE_OWNERSHIP_CONFLICT/);
  assert.ok(f.rules().length); assert.equal(f.posts.some(post => post.local_actions?.length), false);
});
test('completed Server RELEASE is not converted into another END when timer later expires', async () => {
  const f = fixture(); await f.loop.tick(); f.release(); await f.loop.tick(); f.advance(61000); await f.loop.tick();
  assert.equal(f.posts.some(post => post.local_actions?.length), false);
  assert.equal((await f.control.load('MEMBER:1', f.sessionId)).phase, 'FINAL');
});
test('concurrent terminal Server state verifies release and preserves unacknowledged local action', async () => {
  const f = fixture(); await f.loop.tick(); f.session.execution_status = 'ENDED';
  f.client.reconcile = async () => { const error = new Error('conflict'); error.status = 409; throw error; };
  await f.loop.end(f.sessionId); const row = await f.control.load('MEMBER:1', f.sessionId);
  assert.equal(f.rules().length, 0); assert.equal(row.phase, 'FINAL'); assert.equal(row.local_action_unconfirmed, true);
  assert.ok(row.local_end.action_id);
});

test('member navigation requires verified RUNNING context and actual owned rules, and excludes termination',async()=>{
  const f=fixture();const initial=Date.parse(f.apply.created_at);
  const before={frameId:0,tabId:1,timeStamp:initial+1,observed_at:initial+1,url:'https://sub.example.org/a'};
  assert.equal(await f.loop.observe('before',before),null);
  await f.loop.tick();assert.equal(f.loop.view.status,'RUNNING');
  await f.loop.observe('before',before);
  const commit={...before,timeStamp:initial+2,observed_at:initial+2,url:'chrome-extension://synthetic/blocked/blocked.html?host=example.org&reason=USER_SITE',transitionType:'typed'};
  const event=await f.loop.observe('commit',commit);assert.equal(event.payload.target_host,'sub.example.org');
  await f.loop.observe('before',before);f.clear();assert.equal(await f.loop.observe('commit',commit),null);
  assert.equal((await f.loop.access.store.originals('MEMBER:1',f.credentials.executor_id,f.client.baseUrl)).length,1);
  f.loop.view.status='ENDING';assert.equal(await f.loop.observe('before',before),null);
});

test('capture storage failure suspends collection, durably marks fault and removes only owned rules until user END',async()=>{
 const f=fixture();await f.loop.tick();f.addForeign();let observations=0;
 f.loop.access.observe=async()=>{observations++;throw new Error('ACCESS_STORAGE_UNAVAILABLE');};
 await assert.rejects(f.loop.observe('before',{tabId:1}),/ACCESS_STORAGE_UNAVAILABLE/);
 assert.equal(f.loop.view.status,'RECOVERY_REQUIRED');assert.equal(f.loop.view.capture_release_confirmed,true);
 assert.deepEqual(f.rules().map(r=>r.id),[9000]);assert.equal(f.session.execution_status,'RUNNING');
 assert.equal((await f.control.load(f.credentials.owner_key,f.sessionId)).capture_storage_fault,true);
 assert.equal(await f.loop.observe('commit',{tabId:1}),null);assert.equal(observations,1);
 const recreated=new MemberExecutionLoop(f.options);const result=await recreated.tick();
 assert.equal(result.status,'RECOVERY_REQUIRED');assert.equal(result.capture_release_confirmed,true);
 assert.equal(await recreated.observe('before',{tabId:1}),null);
 const ended=await recreated.end(f.sessionId);assert.equal(ended.status,'RELEASED');assert.equal(f.session.execution_status,'ENDED');
 const row=await f.control.load(f.credentials.owner_key,f.sessionId);assert.equal(row.local_end.reason,'MANUAL');
});
test('cleanup failure never claims release and queued observations remain suspended; later tick retries cleanup',async()=>{
 const f=fixture();await f.loop.tick();const update=f.options.dnr.updateSessionRules;let fail=true,observations=0;
 f.options.dnr.updateSessionRules=async args=>{if(fail&&args.removeRuleIds.length)throw new Error('DNR_FAILED');return update(args);};
 f.loop.access.observe=async()=>{observations++;throw new Error('ACCESS_STORAGE_UNAVAILABLE');};
 const results=await Promise.allSettled([f.loop.observe('before',{tabId:1}),f.loop.observe('commit',{tabId:1})]);
 assert.equal(results[0].status,'rejected');assert.equal(results[1].value,null);assert.equal(observations,1);
 assert.equal(f.loop.view.capture_release_confirmed,false);assert.ok(f.rules().length);
 fail=false;const result=await f.loop.tick();assert.equal(result.capture_release_confirmed,true);assert.equal(f.rules().length,0);
});
test('control persistence failure retains suspension and no release success; later writable tick persists fault before cleanup',async()=>{
 const f=fixture();await f.loop.tick();const save=f.control.save.bind(f.control);let fail=true;
 f.control.save=async row=>{if(fail&&row.capture_storage_fault)throw new Error('CONTROL_STORAGE_UNAVAILABLE');return save(row);};
 f.loop.access.observe=async()=>{throw new Error('ACCESS_STORAGE_UNAVAILABLE');};
 await assert.rejects(f.loop.observe('before',{tabId:1}),/CONTROL_STORAGE_UNAVAILABLE/);
 assert.equal(f.loop.view.capture_release_confirmed,false);assert.equal(await f.loop.observe('commit',{tabId:1}),null);
 assert.ok(f.rules().length);fail=false;assert.equal((await f.loop.tick()).capture_release_confirmed,true);
 assert.equal((await f.control.load(f.credentials.owner_key,f.sessionId)).capture_storage_fault,true);
});

test('capture suspension still honors existing Web RELEASE and scheduled expiry without new END reason',async()=>{
 for(const ending of ['WEB','EXPIRED']){
  const f=fixture();await f.loop.tick();f.loop.access.observe=async()=>{throw new Error('ACCESS_STORAGE_UNAVAILABLE');};
  await assert.rejects(f.loop.observe('before',{tabId:1}));
  if(ending==='WEB')f.release();else f.advance(61000);
  const result=await f.loop.tick();assert.equal(result.status,'RELEASED');assert.equal(f.session.execution_status,'ENDED');
  assert.equal(f.rules().length,0);
  const row=await f.control.load(f.credentials.owner_key,f.sessionId);
  if(ending==='EXPIRED')assert.equal(row.local_end.reason,'EXPIRED');
 }
});
test('actual access transaction creation failure triggers durable capture suspension and owned release',async()=>{
 const f=fixture();await f.loop.tick();f.addForeign();
 const store=f.options.accessStore,factory=store.indexedDB;let fail=true;
 store.indexedDB={open(...args){const request=factory.open(...args);
  request.addEventListener('success',()=>{if(fail){fail=false;request.result.close();}});return request;}};
 const at=Date.parse('2026-10-10T00:00:00Z');
 await assert.rejects(f.loop.observe('before',{url:'https://example.org/',tabId:1,frameId:0,timeStamp:at,observed_at:at}),/ACCESS_STORAGE_UNAVAILABLE/);
 assert.equal(f.loop.view.status,'RECOVERY_REQUIRED');assert.equal(f.loop.view.capture_release_confirmed,true);
 assert.deepEqual(f.rules().map(r=>r.id),[9000]);
 assert.equal((await f.control.load(f.credentials.owner_key,f.sessionId)).capture_storage_fault,true);
 const recreated=new MemberExecutionLoop(f.options);await recreated.tick();
 assert.equal(await recreated.observe('before',{url:'https://example.org/',tabId:1,frameId:0,timeStamp:at,observed_at:at}),null);
 assert.equal(f.session.execution_status,'RUNNING');
});
