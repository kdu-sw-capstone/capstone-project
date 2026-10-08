import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

const sourcePath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../background/session-core.js');
const source = await readFile(sourcePath, 'utf8');

function makeCore({ owner, stored = null, rules = [], expireAfterRegexCheck = false, regexAdvanceMs = 0,
  sites = [{ canonical_host: 'blocked.example', display_name: 'blocked', include_subdomains: true,
    purpose: 'DISTRACTION', access_policy: 'BLOCK', feature_policies: [] }], tabs = [] } = {}) {
  let now = Date.now();
  let persisted = stored;
  let currentRules = structuredClone(rules);
  let ruleUpdates = 0;
  let currentTabs = structuredClone(tabs);
  const movedTabs = [];
  class ClockDate extends Date {
    constructor(...args) { super(...(args.length ? args : [now])); }
    static now() { return now; }
  }
  const contextOwner = owner ?? { installation_id: 'install-a', owner_key: 'GUEST:install-a' };
  const context = {
    URL,
    Date: ClockDate,
    crypto: { randomUUID },
    structuredClone,
    chrome: {
      runtime: { getURL: value => 'chrome-extension://test/' + value },
      storage: { session: { get: async () => ({ focurve_boot: true }), set: async () => {} } },
      alarms: { create: async () => {}, clear: async () => {} },
      tabs: {
        query: async () => structuredClone(currentTabs),
        update: async (id, change) => {
          movedTabs.push(id);
          currentTabs = currentTabs.map(tab => tab.id === id ? { ...tab, ...change, pendingUrl: undefined } : tab);
        },
      },
      declarativeNetRequest: {
        getSessionRules: async () => structuredClone(currentRules),
        isRegexSupported: async () => {
          now += expireAfterRegexCheck ? 31_000 : regexAdvanceMs;
          return { isSupported: true };
        },
        updateSessionRules: async ({ addRules = [], removeRuleIds = [] }) => {
          ruleUpdates += 1;
          currentRules = currentRules.filter(rule => !removeRuleIds.includes(rule.id)).concat(structuredClone(addRules));
        },
      },
    },
    LocalStore: { guestContext: async () => contextOwner },
    GuestSites: {
      list: async () => ({ items: sites, settings_version: 1 }),
      validate: () => true,
    },
    SessionDB: {
      load: async () => persisted,
      byRequest: async () => null,
      save: async state => { persisted = state; return state; },
      expire: async () => {},
    },
    AccessStore: {},
  };
  const core = vm.runInNewContext(source + '\nGuestSession;', context);
  return { core, movedTabs, get persisted() { return persisted; }, get rules() { return currentRules; }, get ruleUpdates() { return ruleUpdates; } };
}

const site = (canonical_host, include_subdomains = false) => ({ canonical_host, include_subdomains });

test('site matching accepts exact host and HTTP(S), and rejects suffix lookalikes', () => {
  const core = makeCore().core;
  const target = site('example.com', true);
  assert.equal(core.matches(target, 'https://example.com/path'), true);
  assert.equal(core.matches(target, 'http://www.example.com/'), true);
  assert.equal(core.matches(target, 'https://notexample.com/'), false);
  assert.equal(core.matches(target, 'file://example.com/'), false);
  assert.equal(core.matches(target, 'not a URL'), false);
});

test('exact-host policy does not match subdomains', () => {
  const core = makeCore().core;
  assert.equal(core.matches(site('example.com'), 'https://example.com/'), true);
  assert.equal(core.matches(site('example.com'), 'https://www.example.com/'), false);
});

test('rule generation applies BLOCK only and skips existing rule IDs', () => {
  const core = makeCore().core;
  const session = { session_id: 'session-1', snapshot: { sites: [
    { ...site('blocked.example', true), access_policy: 'BLOCK' },
    { ...site('record.example'), access_policy: 'RECORD' },
    { ...site('allowed.example'), access_policy: 'ALLOW' },
  ] } };
  const rules = core.buildRules(session, [{ id: 100000 }, { id: 100001 }]);
  assert.equal(rules.length, 1);
  assert.equal(rules[0].id, 100002);
  assert.equal(rules[0].action.redirect.url,
    'chrome-extension://test/blocked/blocked.html?host=blocked.example&session=session-1');
  assert.equal(rules[0].condition.resourceTypes.includes('main_frame'), true);
});

test('guest APPLY expires before execution and leaves no blocking rule', async () => {
  const fixture = makeCore({ expireAfterRegexCheck: true });
  await assert.rejects(fixture.core.start(25, randomUUID()), { message: 'APPLY_EXPIRED' });
  assert.equal(fixture.persisted.session.status, 'START_FAILED');
  assert.equal(fixture.persisted.session.last_error_code, 'APPLY_EXPIRED');
  assert.equal(fixture.rules.length, 0);
});

test('guest APPLY at the exact deadline is rejected before installing rules', async () => {
  const fixture = makeCore({ regexAdvanceMs: 30_000 });
  await assert.rejects(fixture.core.start(25, randomUUID()), { message: 'APPLY_EXPIRED' });
  assert.equal(fixture.persisted.session.status, 'START_FAILED');
  assert.equal(fixture.rules.length, 0);
});

for (const deadline of [undefined, 'invalid', '']) {
  test(`worker recovery rejects an invalid APPLY deadline: ${String(deadline)}`, async () => {
    const initial = makeCore();
    await initial.core.start(25, randomUUID());
    const stored = structuredClone(initial.persisted);
    stored.session.status = 'STARTING';
    stored.journal.observed = 'UNCONFIRMED';
    stored.journal.execute_before = deadline;
    const recovered = makeCore({ stored, rules: initial.rules });
    const result = await recovered.core.state();
    assert.equal(result.session.status, 'START_FAILED');
    assert.equal(result.journal.observed, 'RELEASED');
    assert.equal(recovered.rules.length, 0);
  });
}

test('guest session from a different installation owner is rejected before recovery', async () => {
  const stored = {
    session: { owner_key: 'GUEST:install-old', executor_id: 'install-old', session_id: 'session-old', status: 'RUNNING' },
    journal: { owner_key: 'GUEST:install-old', session_id: 'session-old', desired: 'APPLIED', rules: [] },
  };
  const fixture = makeCore({ stored });
  await assert.rejects(fixture.core.state(), { message: 'OWNER_MISMATCH' });
  assert.equal(fixture.ruleUpdates, 0);
});

test('worker reconnect retains a RUNNING session when journal rules match', async () => {
  const rule = { id: 100000, priority: 100, action: { type: 'redirect', redirect: { url: 'chrome-extension://test/blocked/blocked.html?host=blocked.example&session=session-a' } }, condition: { regexFilter: '^https?://blocked\\.example(:[0-9]+)?([/?#]|$)', isUrlFilterCaseSensitive: false, resourceTypes: ['main_frame'] } };
  const owner = { installation_id: 'install-a', owner_key: 'GUEST:install-a' };
  const stored = {
    session: { owner_key: owner.owner_key, executor_id: owner.installation_id, session_id: 'session-a', status: 'RUNNING', duration_minutes: 25, started_at: new Date().toISOString(), planned_end_at: new Date(Date.now() + 60_000).toISOString(), snapshot: { sites: [] } },
    journal: { owner_key: owner.owner_key, session_id: 'session-a', desired: 'APPLIED', observed: 'APPLIED', rules: [rule] },
  };
  const fixture = makeCore({ owner, stored, rules: [rule] });
  const result = await fixture.core.state();
  assert.equal(result.session.status, 'RUNNING');
  assert.equal(fixture.ruleUpdates, 0);
});


test('worker reconnect releases the session when journal rules do not match', async () => {
  const rule = { id: 100000, priority: 100, action: { type: 'redirect', redirect: { url: 'chrome-extension://test/blocked/blocked.html?host=blocked.example&session=session-b' } }, condition: { regexFilter: '^https?://blocked\\.example(:[0-9]+)?([/?#]|$)', isUrlFilterCaseSensitive: false, resourceTypes: ['main_frame'] } };
  const owner = { installation_id: 'install-a', owner_key: 'GUEST:install-a' };
  const stored = {
    session: { owner_key: owner.owner_key, executor_id: owner.installation_id, session_id: 'session-b', status: 'RUNNING', duration_minutes: 25, started_at: new Date().toISOString(), planned_end_at: new Date(Date.now() + 60_000).toISOString(), snapshot: { sites: [] } },
    journal: { owner_key: owner.owner_key, session_id: 'session-b', desired: 'APPLIED', observed: 'APPLIED', rules: [rule] },
  };
  const fixture = makeCore({ owner, stored, rules: [] });
  const result = await fixture.core.state();
  assert.equal(result.session.status, 'INTERRUPTED');
  assert.equal(result.journal.desired, 'RELEASED');
  assert.equal(fixture.rules.length, 0);
});

const hostCases = [
  ['https://example.com/', true, true],
  ['http://EXAMPLE.COM/path?x=1', true, true],
  ['https://example.com./', true, true],
  ['http://example.com.:8080/path', true, true],
  ['https://www.example.com/', false, true],
  ['https://a.b.example.com./', false, true],
  ['https://notexample.com/', false, false],
  ['https://example.com.evil.test/', false, false],
  ['https://example.com.evil.test./', false, false],
  ['https://example.com../', false, false],
  ['https://example.com@evil.test/', false, false],
  ['https://user:password@example.com./', true, true],
  ['https://evil.test/path/example.com', false, false],
  ['file://example.com/path', false, false],
  ['not a URL', false, false],
];

for (const includeSubdomains of [false, true]) {
  test(`guest matcher and generated DNR regex agree on host boundaries (subdomains=${includeSubdomains})`, () => {
    const core = makeCore().core;
    const target = { ...site('example.com', includeSubdomains), access_policy: 'BLOCK' };
    const [rule] = core.buildRules({ session_id: 'boundary', snapshot: { sites: [target] } }, []);
    const regex = new RegExp(rule.condition.regexFilter, 'i');
    for (const [raw, exact, subdomains] of hostCases) {
      const expected = includeSubdomains ? subdomains : exact;
      assert.equal(core.matches(target, raw), expected, `Core: ${raw}`);
      let serialized = raw;
      try { serialized = new URL(raw).href; } catch {}
      assert.equal(regex.test(serialized), expected, `DNR regex: ${raw}`);
    }
    assert.deepEqual(Array.from(rule.condition.resourceTypes), ['main_frame']);
  });
}

test('guest domain matching preserves explicit www and uses IDNA ASCII host', () => {
  const core = makeCore().core;
  const targets = [
    [site('www.example.com'), 'https://www.example.com./', 'https://example.com/'],
    [site('xn--bcher-kva.example'), 'https://bücher.example./', 'https://other.example/'],
  ];
  for (const [target, positive, negative] of targets) {
    const [rule] = core.buildRules({ session_id: 'idna', snapshot: { sites: [{ ...target, access_policy: 'BLOCK' }] } }, []);
    const regex = new RegExp(rule.condition.regexFilter, 'i');
    assert.equal(core.matches(target, positive), true);
    assert.equal(regex.test(new URL(positive).href), true);
    assert.equal(core.matches(target, negative), false);
    assert.equal(regex.test(new URL(negative).href), false);
  }
});

function policySite(host, policy, includeSubdomains = false) {
  return { ...site(host, includeSubdomains), display_name: host,
    purpose: policy === 'ALLOW' ? 'GENERAL' : 'DISTRACTION', access_policy: policy, feature_policies: [] };
}

test('guest start diverts only BLOCK tabs including trailing dots; end preserves unrelated rules', async () => {
  const unrelated = { id: 7, priority: 1, action: { type: 'block' }, condition: { urlFilter: 'unrelated.test', resourceTypes: ['main_frame'] } };
  const fixture = makeCore({
    sites: [policySite('example.com', 'BLOCK', true), policySite('record.example', 'RECORD'), policySite('allow.example', 'ALLOW')],
    rules: [unrelated],
    tabs: [
      { id: 1, url: 'https://example.com./' },
      { id: 2, url: 'https://a.example.com./' },
      { id: 3, url: 'https://notexample.com/' },
      { id: 4, url: 'https://example.com.evil.test/' },
      { id: 5, url: 'https://record.example./' },
      { id: 6, url: 'https://allow.example./' },
      { id: 7, url: 'https://safe.example/', pendingUrl: 'https://example.com./' },
    ],
  });
  const started = await fixture.core.start(25, randomUUID());
  assert.equal(started.session.status, 'RUNNING');
  assert.deepEqual(fixture.movedTabs, [1, 2, 7]);
  assert.equal(fixture.rules.length, 2);
  assert.equal(fixture.rules[1].action.type, 'redirect');
  const ended = await fixture.core.end(started.session.session_id);
  assert.equal(ended.session.status, 'ENDED');
  assert.equal(ended.journal.observed, 'RELEASED');
  assert.deepEqual(fixture.rules, [unrelated]);
});

test('guest current snapshot stays fixed and the next session uses changed BLOCK/ALLOW settings', async () => {
  const sites = [policySite('example.com', 'BLOCK')];
  const fixture = makeCore({ sites });
  const first = await fixture.core.start(25, randomUUID());
  const firstRules = structuredClone(fixture.rules);
  sites.splice(0, 1, policySite('example.com', 'ALLOW'), policySite('next.example', 'BLOCK'));
  const current = await fixture.core.state();
  assert.equal(current.session.snapshot.sites.length, 1);
  assert.equal(current.session.snapshot.sites[0].access_policy, 'BLOCK');
  assert.deepEqual(fixture.rules, firstRules);
  await fixture.core.end(first.session.session_id);
  assert.equal(fixture.rules.length, 0);
  const second = await fixture.core.start(25, randomUUID());
  assert.notEqual(second.session.session_id, first.session.session_id);
  assert.equal(second.session.snapshot.sites.length, 2);
  assert.equal(fixture.rules.length, 1);
  const pattern = new RegExp(fixture.rules[0].condition.regexFilter, 'i');
  assert.equal(pattern.test('https://example.com./'), false);
  assert.equal(pattern.test('https://next.example./'), true);
});
