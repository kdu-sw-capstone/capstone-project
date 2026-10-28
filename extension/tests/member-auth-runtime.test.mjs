import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';

async function fixture(state = null, rules = []) {
  let options; let calls = 0; const listeners = [];
  const context = vm.createContext({
    FocurveMemberAuth: { AuthStore: class {}, MemberAuth: class {
      constructor(input) { options = input; }
      async status() { calls++; return { phase: 'UNREGISTERED', guest_start_allowed: true }; }
    } },
    GuestSession: { state: async () => state }, LocalStore: { guestContext: async () => ({ installation_id: 'test' }) },
    chrome: { runtime: { id: 'self', getURL: path => 'chrome-extension://self/' + path,
      getManifest: () => ({ version: '0.1.5' }), onMessage: { addListener: fn => listeners.push(fn) } },
      alarms: { onAlarm: { addListener() {} } }, declarativeNetRequest: { getSessionRules: async () => rules } }
  });
  vm.runInContext(await readFile(new URL('../background/member-auth-runtime.js', import.meta.url), 'utf8'), context);
  return { options, listener: listeners[0], get calls() { return calls; } };
}

test('only exact extension popup/top frame may request auth; no Content or Web callers', async () => {
  const f = await fixture(); const message = { type: 'FOCURVE_AUTH_STATUS', request_id: 'test' };
  const valid = { id: 'self', url: 'chrome-extension://self/popup/popup.html', frameId: 0 };
  for (const sender of [{ ...valid, id: 'other' }, { ...valid, url: 'https://example.com' },
    { ...valid, url: 'chrome-extension://self/content.html' }, { ...valid, frameId: 1 }]) {
    assert.equal(f.listener(message, sender, () => assert.fail('must not respond')), undefined);
  }
  assert.equal(f.calls, 0);
  const reply = await new Promise(resolve => assert.equal(f.listener(message, valid, resolve), true));
  assert.equal(reply.data.phase, 'UNREGISTERED'); assert.equal(f.calls, 1);
});

test('idle evidence observes actual owned rules while preserving unrelated rules', async () => {
  const state = { session: { status: 'ENDED', session_id: 's' }, journal: { observed: 'RELEASED', rules: [{ id: 100001 }] } };
  const clear = await fixture(state, [{ id: 7 }]); const first = await clear.options.inspectIdle();
  assert.equal(first.active_session_id, null); assert.equal(first.pending_action_count, 0); assert.equal(first.owned_rule_ids.length, 0);
  const residual = await fixture(state, [{ id: 7 }, { id: 100001 }]);
  assert.deepEqual(Array.from((await residual.options.inspectIdle()).owned_rule_ids), [100001]);
});

test('unconfirmed release or active session cannot be submitted as idle', async () => {
  for (const status of ['RUNNING', 'ENDING', 'UNKNOWN']) {
    const f = await fixture({ session: { status, session_id: 's' }, journal: { observed: 'UNCONFIRMED', rules: [] } });
    const result = await f.options.inspectIdle(); assert.equal(result.active_session_id, 's'); assert.equal(result.pending_action_count, 1);
  }
});

test('missing journal with residual rules cannot be certified as idle or silently cleared', async () => {
  const f = await fixture(null, [{ id: 100001 }]);
  assert.equal((await f.options.inspectIdle()).pending_action_count, 1);
});
