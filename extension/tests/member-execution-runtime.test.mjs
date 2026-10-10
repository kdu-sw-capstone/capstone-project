import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';

async function fixture() {
  const listeners = []; let calls = 0;
  const context = vm.createContext({
    MemberAuthRuntime: { status: async () => ({ phase: 'LINKED', owner_user_id: '1', executor_id: 'synthetic', server_url: 'http://localhost/api/v1' }),
      credentials: async () => assert.fail('runtime must not expose credentials to UI') },
    GuestSession: { state: async () => null },
    FocurveMemberExecution: { MemberExecutionClient: class {}, MemberExecutionLoop: class {
      constructor() { this.view = { session_id: 'session' }; }
      async tick() { calls++; return { status: 'RUNNING', session_id: 'session' }; }
      async end(id) { calls++; assert.equal(id, 'session'); return { status: 'RELEASED', session_id: id }; }
    } },
    chrome: { runtime: { id: 'self', getURL: path => 'chrome-extension://self/' + path,
      onMessage: { addListener: fn => listeners.push(fn) }, onStartup: { addListener() {} } },
      alarms: { create: async () => {}, onAlarm: { addListener() {} } }, declarativeNetRequest: {}, tabs: {} }
  });
  vm.runInContext(await readFile(new URL('../background/member-execution-runtime.js', import.meta.url), 'utf8'), context);
  await new Promise(resolve => setTimeout(resolve, 0));
  return { listener: listeners[0], get calls() { return calls; } };
}
test('member execution messages require exact own popup, top frame and bounded request ID', async () => {
  const f = await fixture(), baseline = f.calls;
  const valid = { id: 'self', url: 'chrome-extension://self/popup/popup.html', frameId: 0 };
  const message = { type: 'DEV_MEMBER_EXECUTION_END', request_id: 'test', payload: { session_id: 'session' } };
  for (const sender of [{ ...valid, id: 'other' }, { ...valid, url: 'https://example.org' }, { ...valid, frameId: 1 }])
    assert.equal(f.listener(message, sender, () => assert.fail('untrusted reply')), undefined);
  assert.equal(f.listener({ ...message, request_id: '' }, valid, () => assert.fail('untrusted reply')), undefined);
  assert.equal(f.calls, baseline);
  const reply = await new Promise(resolve => f.listener(message, valid, resolve));
  assert.equal(reply.status, 'OK'); assert.equal(reply.data.status, 'RELEASED');
  assert.equal(reply.data.access_token, undefined);
});
test('public runtime state delegates actual coordinator result without credentials', async () => {
  const f = await fixture();
  const reply = await new Promise(resolve => f.listener({ type: 'DEV_MEMBER_EXECUTION_STATE', request_id: 'test' },
    { id: 'self', url: 'chrome-extension://self/popup/popup.html', frameId: 0 }, resolve));
  assert.equal(reply.data.status, 'RUNNING'); assert.equal(Object.keys(reply.data).length, 2);
});
test('generated classic bundle runs the real coordinator with injectable Chrome/API adapters', async () => {
  const context = vm.createContext({ URL, structuredClone, Date, setTimeout, clearTimeout,
    fetch: async () => assert.fail('unexpected fetch') });
  vm.runInContext(await readFile(new URL('../background/host-policy.js', import.meta.url), 'utf8'), context);
  vm.runInContext(await readFile(new URL('../background/member-execution.js', import.meta.url), 'utf8'), context);
  const result = await vm.runInContext(`new FocurveMemberExecution.MemberExecutionLoop({
    client:{baseUrl:'http://localhost/api/v1',flush:async()=>{},commands:async()=>({commands:[]})},
    getCredentials:async()=>({owner_key:'MEMBER:1',executor_id:'synthetic'}),control:{list:async()=>[]},journal:{},
    idle:async()=>{},dnr:{},tabs:{},blockedPageUrl:'chrome-extension://self/blocked/blocked.html'
  }).tick()`, context);
  assert.equal(result.status, 'IDLE');
});
