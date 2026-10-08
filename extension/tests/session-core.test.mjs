import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

const sourcePath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../background/session-core.js');
const source = await readFile(sourcePath, 'utf8');

function makeCore({ owner, stored = null, rules = [], expireAfterRegexCheck = false, regexAdvanceMs = 0 } = {}) {
  let now = Date.now();
  let persisted = stored;
  let currentRules = structuredClone(rules);
  let ruleUpdates = 0;
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
      tabs: { query: async () => [] },
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
      list: async () => ({ items: [{ canonical_host: 'blocked.example', display_name: 'blocked', include_subdomains: true, purpose: 'DISTRACTION', access_policy: 'BLOCK', feature_policies: [] }], settings_version: 1 }),
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
  return { core, get persisted() { return persisted; }, get rules() { return currentRules; }, get ruleUpdates() { return ruleUpdates; } };
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
