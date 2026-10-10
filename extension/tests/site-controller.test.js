import test from 'node:test';
import assert from 'node:assert/strict';
import { SiteController } from '../src/site-controller.js';
import { buildSiteRules, matchesSite } from '../src/site-rules.js';

const executor = '11111111-1111-4111-8111-111111111111';
const session = '22222222-2222-4222-8222-222222222222';
const commandId = '33333333-3333-4333-8333-333333333333';
const time = Date.parse('2026-10-08T00:00:00Z');
const page = 'chrome-extension://test/blocked/index.html';
const site = (host = 'example.com', subdomains = true, policy = 'BLOCK') =>
  ({ canonical_host: host, include_subdomains: subdomains, access_policy: policy });
const command = () => ({ command_id: commandId, session_id: session, executor_id: executor,
  type: 'APPLY_POLICY', desired_revision: 1, duration_minutes: 25, reason: 'START', created_at: new Date(time).toISOString(),
  execute_before: new Date(time + 30000).toISOString(), snapshot: {
    policy_snapshot_id: '44444444-4444-4444-8444-444444444444', format_version: '1.1',
    executor_id: executor, created_at: new Date(time).toISOString(), source_version: 1,
    sites: [site()], content_policy: {},
  } });

function fixture() {
  let rules = [], entry = null;
  const f = { changes: [], saved: [], now: time, tabs: [{ id: 7, url: 'https://example.com/video' }],
    context: { owner_key: `GUEST:${executor}`, executor_id: executor, session_id: session,
      revision: 1, desired: 'APPLIED', reconciled: true },
    get rules() { return rules; }, set rules(value) { rules = value; },
    get entry() { return structuredClone(entry); },
  };
  f.dnr = {
    getSessionRules: async () => structuredClone(rules),
    isRegexSupported: async () => ({ isSupported: true }),
    updateSessionRules: async change => {
      f.changes.push(structuredClone(change));
      rules = rules.filter(rule => !change.removeRuleIds?.includes(rule.id));
      if (change.addRules) rules.push(...structuredClone(change.addRules));
    },
  };
  f.journal = { load: async () => structuredClone(entry), save: async value => {
    f.saved.push(structuredClone(value)); entry = structuredClone(value);
  } };
  f.newController = () => new SiteController({ dnr: f.dnr,
    tabs: { query: async () => structuredClone(f.tabs), update: async (id, value) => {
      f.tabs.find(tab => tab.id === id).url = value.url;
    } }, journal: f.journal, getContext: async () => f.context,
    blockedPageUrl: page, now: () => f.now, wait: async () => {} });
  f.controller = f.newController();
  f.release = () => {
    f.context.revision = 2; f.context.desired = 'RELEASED';
    return { ...command(), type: 'RELEASE_POLICY', desired_revision: 2, command_id: '55555555-5555-4555-8555-555555555555' };
  };
  return f;
}

test('site layer: HTTP(S), exact host, subdomain boundary, www preserved, ALLOW/RECORD untouched', () => {
  const rules = buildSiteRules([site(), site('www.sample.org', false), site('allow.test', true, 'ALLOW'), site('record.test', true, 'RECORD')], [{ id: 1 }], page);
  assert.deepEqual(rules.map(rule => rule.id), [2, 3]);
  assert.deepEqual(rules[0].condition.resourceTypes, ['main_frame']);
  const rootRule = rules.find(rule => new URL(rule.action.redirect.url).searchParams.get('host') === 'example.com');
  const wwwRule = rules.find(rule => new URL(rule.action.redirect.url).searchParams.get('host') === 'www.sample.org');
  const regex = new RegExp(rootRule.condition.regexFilter, 'i');
  for (const url of ['https://example.com', 'https://example.com./', 'http://a.b.example.com/path', 'https://EXAMPLE.COM:443/?secret=x', 'https://user@example.com/path']) assert.equal(regex.test(url), true, url);
  for (const url of ['https://evil-example.com', 'https://example.com.evil.test', 'https://else.test/example.com', 'ftp://example.com']) assert.equal(regex.test(url), false, url);
  assert.equal(new RegExp(wwwRule.condition.regexFilter).test('https://sample.org'), false);
  assert.equal(matchesSite(site('example.com', false), 'https://a.example.com'), false);
  assert.equal(matchesSite(site(), 'https://a.example.com./'), true);
  assert.ok(!rules[0].action.redirect.url.includes('secret'));
});

test('reject malformed/duplicate snapshot before constructing rules', () => {
  for (const host of ['EXAMPLE.com', 'localhost', 'a.localhost', '127.0.0.1', 'a.com:80', 'x/y.com', '.example.com', 'a..com', '-bad.com']) {
    assert.throws(() => buildSiteRules([site(host)], [], page), /INVALID_SNAPSHOT_HOST/);
  }
  assert.throws(() => buildSiteRules([site(), site()], [], page), /SNAPSHOT_SCOPE_CONFLICT/);
});

test('AC-EXT-02-01 partial: durable journal precedes DNR, actual rules and open tabs confirmed', async () => {
  const f = fixture();
  const update = f.dnr.updateSessionRules;
  f.dnr.updateSessionRules = async value => { assert.equal(f.entry.observed, 'UNCONFIRMED'); await update(value); };
  assert.deepEqual(await f.controller.apply(command()), { observed: 'APPLIED', duplicate: false });
  assert.equal(f.entry.observed, 'APPLIED');
  assert.match(f.tabs[0].url, /blocked\/index.html\?host=example.com&reason=USER_SITE/);
});

test('AC-EXT-02-01/02 partial: executor, revision, owner, ending and reconciliation reject without mutation', async () => {
  for (const mutate of [
    (f, c) => { c.executor_id = session; }, (f, c) => { c.session_id = executor; },
    f => { f.context.revision = 2; }, f => { f.context.desired = 'RELEASED'; },
    f => { f.context.reconciled = false; }, f => { f.context.owner_key = 'MEMBER:42'; },
  ]) {
    const f = fixture(), c = command(); mutate(f, c);
    await assert.rejects(f.controller.apply(c));
    assert.equal(f.saved.length, 0); assert.equal(f.changes.length, 0);
  }
});

test('AC-EXT-02-02 partial: expired/missing/invalid APPLY deadline cannot add rules', async () => {
  for (const deadline of [undefined, 'bad', new Date(time).toISOString(), new Date(time - 1).toISOString()]) {
    const f = fixture(), c = command(); c.execute_before = deadline;
    await assert.rejects(f.controller.apply(c), /APPLY_EXPIRED/);
    assert.equal(f.changes.length, 0);
  }
});

test('trusted member owner matches snapshot; payload cannot override context owner', async () => {
  const f = fixture(), c = command();
  f.context.owner_key = 'MEMBER:42'; c.snapshot.owner_user_id = '42';
  await f.controller.apply(c);
  assert.equal(f.entry.owner_key, 'MEMBER:42');
});

test('duplicate command and re-created worker do not add new rules', async () => {
  const f = fixture(); await f.controller.apply(command());
  assert.equal((await f.newController().apply(command())).duplicate, true);
  assert.equal(f.changes.length, 1);
  assert.deepEqual(await f.newController().inspect(f.context.owner_key, session), { desired: 'APPLIED', observed: 'APPLIED', duration_minutes: 25, applied_at: new Date(time).toISOString(), planned_end_at: new Date(time + 25 * 60000).toISOString() });
});

test('AC-EXT-02-03 partial: missing rules after restart only inspected; old APPLY never reinstalled', async () => {
  const f = fixture(); await f.controller.apply(command()); f.rules = [];
  const recreated = f.newController();
  assert.equal((await recreated.inspect(f.context.owner_key, session)).observed, 'RELEASED');
  await assert.rejects(recreated.apply(command()), /RECONCILE_REQUIRED/);
  assert.equal(f.changes.length, 1);
});

test('snapshot changes with same command rejected; immutable copy kept', async () => {
  const f = fixture(), c = command(); const pending = f.controller.apply(c);
  c.snapshot.sites[0].canonical_host = 'changed.test'; await pending;
  assert.equal(f.entry.snapshot.sites[0].canonical_host, 'example.com');
  await assert.rejects(f.controller.apply(c), /JOURNAL_CONFLICT/);
});

test('BOUND-17 partial: pre-apply persistence failure makes no browser changes', async () => {
  const f = fixture(); f.journal.save = async () => { throw new Error('QUOTA'); };
  await assert.rejects(f.controller.apply(command()), /QUOTA/);
  assert.equal(f.changes.length, 0);
});

test('unsupported regex reported; no journal success or rules installed', async () => {
  const f = fixture(); f.dnr.isRegexSupported = async () => ({ isSupported: false });
  await assert.rejects(f.controller.apply(command()), /RULE_UNSUPPORTED/);
  assert.equal(f.changes.length, 0);
});

test('apply failure cleans only owned rules; never claims APPLIED', async () => {
  const f = fixture(); f.rules = [{ id: 99, priority: 1, action: { type: 'block' }, condition: { urlFilter: 'other.test' } }];
  const other = structuredClone(f.rules);
  const update = f.dnr.updateSessionRules;
  f.dnr.updateSessionRules = async change => { if (change.addRules) throw new Error('DNR_FAILED'); await update(change); };
  await assert.rejects(f.controller.apply(command()), /DNR_FAILED/);
  assert.deepEqual(f.rules, other); assert.equal(f.entry.observed, 'RELEASED');
});

test('partial apply observation rolls back and does not return success', async () => {
  const f = fixture(); f.dnr.updateSessionRules = async () => {};
  await assert.rejects(f.controller.apply(command()), /APPLY_UNCONFIRMED/);
  assert.equal(f.entry.observed, 'RELEASED');
});

test('expiry during journal commit prevents late APPLY', async () => {
  const f = fixture(), save = f.journal.save;
  f.journal.save = async entry => { await save(entry); f.now = time + 30000; };
  await assert.rejects(f.controller.apply(command()), /APPLY_EXPIRED/);
  assert.equal(f.changes.some(change => change.addRules), false);
});

test('termination racing with apply removes rules before reporting failure', async () => {
  const f = fixture(), update = f.dnr.updateSessionRules;
  f.dnr.updateSessionRules = async change => { await update(change); if (change.addRules) f.context.desired = 'RELEASED'; };
  await assert.rejects(f.controller.apply(command()), /STALE_COMMAND/);
  assert.equal(f.rules.length, 0); assert.equal(f.entry.observed, 'RELEASED');
});

test('release keeps unrelated rules; re-created worker can retry release', async () => {
  const f = fixture(); await f.controller.apply(command());
  const other = { id: 99, priority: 1, action: { type: 'block' }, condition: { urlFilter: 'other.test' } };
  f.rules.push(other);
  const release = f.release();
  assert.equal((await f.newController().release(release)).observed, 'RELEASED');
  assert.deepEqual(f.rules, [other]);
  await f.newController().release(release);
  assert.equal(f.entry.desired, 'RELEASED');
});

test('rule ID collision does not delete another feature rule', async () => {
  const f = fixture(); await f.controller.apply(command());
  f.rules[0].priority = 1;
  const other = structuredClone(f.rules);
  await assert.rejects(f.controller.release(f.release()), /RULE_OWNERSHIP_CONFLICT/);
  assert.deepEqual(f.rules, other); assert.equal(f.entry.observed, 'UNCONFIRMED');
});

test('release failure remains unconfirmed; later release retries', async () => {
  const f = fixture(); await f.controller.apply(command());
  const update = f.dnr.updateSessionRules;
  f.dnr.updateSessionRules = async () => { throw new Error('RELEASE_FAILED'); };
  const release = f.release(); await assert.rejects(f.controller.release(release), /RELEASE_FAILED/);
  assert.equal(f.entry.observed, 'UNCONFIRMED');
  f.dnr.updateSessionRules = update;
  await f.newController().release(release); assert.equal(f.entry.observed, 'RELEASED');
});

test('failed rollback is surfaced and journal retained', async () => {
  const f = fixture(); f.dnr.updateSessionRules = async () => { throw new Error('DNR_FAILED'); };
  await assert.rejects(f.controller.apply(command()), /ROLLBACK_UNCONFIRMED/);
  assert.equal(f.entry.observed, 'UNCONFIRMED'); assert.equal(f.entry.desired, 'RELEASED');
});

test('empty BLOCK set and all-ALLOW snapshot perform no DNR additions', async () => {
  const f = fixture(), c = command(); c.snapshot.sites = [site('example.com', true, 'ALLOW')];
  await f.controller.apply(c); assert.equal(f.changes.length, 0);
  assert.equal(f.tabs[0].url, 'https://example.com/video');
});

test('open-tab redirect not confirmed: fail and roll back after bounded retries', async () => {
  const f = fixture();
  const controller = new SiteController({ dnr: f.dnr, journal: f.journal,
    getContext: async () => f.context, blockedPageUrl: page, now: () => f.now, wait: async () => {},
    tabs: { query: async () => f.tabs, update: async () => {} } });
  await assert.rejects(controller.apply(command()), /TAB_APPLY_UNCONFIRMED/);
  assert.equal(f.rules.length, 0); assert.equal(f.entry.observed, 'RELEASED');
});

test('tab closed during redirect is not a live unprotected target', async () => {
  const f = fixture();
  const controller = new SiteController({ dnr: f.dnr, journal: f.journal,
    getContext: async () => f.context, blockedPageUrl: page, now: () => f.now,
    tabs: { query: async () => f.tabs, update: async () => { f.tabs = []; throw new Error('TAB_CLOSED'); } } });
  assert.equal((await controller.apply(command())).observed, 'APPLIED');
});

test('post-apply storage failure rolls back; storage uncertainty remains explicit', async () => {
  const f = fixture(), save = f.journal.save; let count = 0;
  f.journal.save = async entry => { if (++count > 1) throw new Error('QUOTA'); await save(entry); };
  await assert.rejects(f.controller.apply(command()), /ROLLBACK_UNCONFIRMED/);
  assert.equal(f.rules.length, 0);
  assert.equal(f.entry.observed, 'UNCONFIRMED');
});

test('foreign-owner inspection rejected without disclosing journal', async () => {
  const f = fixture(); await f.controller.apply(command());
  await assert.rejects(f.controller.inspect('MEMBER:42', session), /EXECUTION_SCOPE_MISMATCH/);
});

test('release can clean expired apply rules; deadline only limits APPLY', async () => {
  const f = fixture(); await f.controller.apply(command()); f.now += 60000;
  assert.equal((await f.controller.release(f.release())).observed, 'RELEASED');
  assert.equal(f.rules.length, 0);
});

test('partial rule loss on re-created worker is UNCONFIRMED and not reapplied', async () => {
  const f = fixture(), c = command(); c.snapshot.sites.push(site('second.test'));
  await f.controller.apply(c); f.rules.pop();
  assert.equal((await f.newController().inspect(f.context.owner_key, session)).observed, 'UNCONFIRMED');
  await assert.rejects(f.newController().apply(c), /RECONCILE_REQUIRED/);
  assert.equal(f.changes.length, 1);
});

test('1.2 adapter selects child ALLOW before diverting tabs and verifies/retries owned rules',async()=>{
 const f=fixture(),c=command();c.snapshot.format_version='1.2';c.snapshot.site_match_strategy='MOST_SPECIFIC_HOST';
 c.snapshot.sites=[site('naver.com'),site('chzzk.naver.com',true,'ALLOW')];
 f.tabs=[{id:7,url:'https://chzzk.naver.com/'},{id:8,url:'https://www.naver.com/'}];
 await f.controller.apply(c);assert.equal(f.tabs[0].url,'https://chzzk.naver.com/');
 assert.match(f.tabs[1].url,/host=naver.com/);assert.equal(f.rules.length,2);
 await f.newController().apply(c);assert.equal(f.changes.length,1);
 await f.controller.release(f.release());assert.equal(f.rules.length,0);
});
test('unknown 1.2 strategy rejected before journal or Chrome mutations',async()=>{
 const f=fixture(),c=command();c.snapshot.format_version='1.2';c.snapshot.site_match_strategy='FIRST';
 await assert.rejects(f.controller.apply(c),/SNAPSHOT_VERSION_UNSUPPORTED/);
 assert.equal(f.saved.length,0);assert.equal(f.changes.length,0);
});


test('nanosecond Server timestamps apply and persist original wire boundaries', async () => {
 const f=fixture(),c=command();c.created_at='2026-10-08T00:00:00.000000001Z';c.execute_before='2026-10-08T00:00:30.123456789Z';
 await f.controller.apply(c);
 assert.equal(f.saved[0].apply_execute_before,c.execute_before);
 assert.equal(f.saved[0].duration_minutes,25);
 assert.equal(f.entry.apply_created_at,c.created_at);
 const before=f.entry;f.now+=1000;
 await f.newController().apply(c);
 assert.deepEqual(f.entry,before);assert.equal(f.changes.length,1);
});
test('duration invalid or absent rejected before storage/rules; existing rules preserved',async()=>{
 for(const value of [undefined,null,'25',0,-1,181,1.5,Infinity,NaN]){
  const f=fixture();await f.controller.apply(command());const previous=f.entry,changes=f.changes.length;
  const c=command();c.duration_minutes=value;
  await assert.rejects(f.newController().apply(c),/INVALID_DURATION/);
  assert.deepEqual(f.entry,previous);assert.equal(f.changes.length,changes);
 }
});
test('1/25/180 minute goals survive recreated controller inspection and release without duration',async()=>{
 for(const duration of [1,25,180]){
  const f=fixture(),c=command();c.duration_minutes=duration;await f.controller.apply(c);
  const state=await f.newController().inspect(f.context.owner_key,session);
  assert.equal(state.duration_minutes,duration);assert.equal(Date.parse(state.planned_end_at)-Date.parse(state.applied_at),duration*60000);
  const release=f.release();delete release.duration_minutes;
  await f.newController().release(release);assert.equal(f.entry.duration_minutes,duration);assert.equal(f.rules.length,0);
 }
});
test('same command changed goal or timestamp conflicts without resetting saved timer',async()=>{
 for(const field of ['duration_minutes','created_at','execute_before']){
  const f=fixture(),c=command();await f.controller.apply(c);const original=f.entry;
  if(field==='duration_minutes')c[field]=30;else c[field]=new Date(time+10000).toISOString();
  await assert.rejects(f.newController().apply(c),/JOURNAL_CONFLICT/);
  assert.deepEqual(f.entry,original);assert.equal(f.changes.length,1);
 }
});

test('member goal and command survive new IndexedDB journal/controller instances',async()=>{
 const { IDBFactory }=await import('fake-indexeddb');
 const { MemberJournalStore }=await import('../src/member-journal-store.js');
 const indexedDB=new IDBFactory();const f=fixture();f.context.owner_key='MEMBER:42';
 f.journal=new MemberJournalStore({indexedDB});const c=command();c.snapshot.owner_user_id='42';c.duration_minutes=180;
 await f.newController().apply(c);
 const first=await f.journal.load('MEMBER:42',session);
 f.journal=new MemberJournalStore({indexedDB});f.now+=1000;
 await f.newController().apply(c);
 assert.deepEqual(await f.journal.load('MEMBER:42',session),first);
 assert.equal((await f.newController().inspect('MEMBER:42',session)).duration_minutes,180);
 assert.equal(await f.journal.load('MEMBER:43',session),null);
 const release=f.release();delete release.duration_minutes;
 await f.newController().release(release);
 assert.equal((await f.journal.load('MEMBER:42',session)).duration_minutes,180);
 assert.equal(f.rules.length,0);
});

test('expired nanosecond deadline and invalid calendar dates preserve existing execution',async()=>{
 for(const change of [{execute_before:'2026-10-08T00:00:00.000000001Z'},{created_at:'2026-02-30T00:00:00.123456789Z'}]){
  const f=fixture();await f.controller.apply(command());const entry=f.entry;
  await assert.rejects(f.newController().apply({...command(),...change}),/APPLY_EXPIRED_OR_INVALID|INVALID_COMMAND/);
  assert.deepEqual(f.entry,entry);assert.equal(f.changes.length,1);
 }
});
