import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { MemberAuth, AuthStore } from '../src/member-auth.js';

const callbackUri = 'chrome-extension://aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/popup/popup.html';
const config = { server_url: 'http://127.0.0.1:8080/api/v1', web_origin: 'http://127.0.0.1:5173' };
const secret = char => char.repeat(43);
function fixture() {
  let saved = null, time = Date.now(), idle = true, mode = 'PENDING';
  const id = webcrypto.randomUUID(), requestId = webcrypto.randomUUID();
  const calls = [], opened = [];
  const store = { get: async () => structuredClone(saved), put: async record => { saved = structuredClone(record); return record; } };
  const fetch = async (url, options) => {
    calls.push({ url, ...options });
    const body = options.body && JSON.parse(options.body);
    let result;
    if (url.endsWith('/extension-installations')) result = { executor_id: id, installation_proof: secret('p') };
    else if (url.endsWith('/extension-link-requests')) result = { link_request_id: requestId,
      verification_uri: config.web_origin + '/#link?id=' + requestId, expires_at: new Date(time + 300000).toISOString() };
    else if (url.endsWith('/evidence')) result = { accepted: true };
    else if (url.endsWith('/claim')) result = mode === 'PENDING' ? { status: 'PENDING' } : { status: 'APPROVED', code: secret('c'), state: saved.state };
    else if (url.endsWith('/extension-tokens')) result = { access_token: secret('a'), refresh_token: secret('r'), expires_in: 900 };
    else if (url.endsWith('/refresh')) result = { access_token: secret('b'), refresh_token: secret('s'), expires_in: 900 };
    else if (url.endsWith('/auth/me')) result = { user_id: '42' };
    else throw new Error('UNEXPECTED_TEST_ENDPOINT');
    return new Response(JSON.stringify(result), { status: 200 });
  };
  const options = { store, crypto: webcrypto, fetch, now: () => time, callbackUri, clientVersion: '0.1.5',
    getInstallation: async () => ({ installation_id: id }),
    inspectIdle: async () => ({ active_session_id: idle ? null : webcrypto.randomUUID(), owned_rule_ids: [], pending_action_count: 0 }),
    openApproval: async url => opened.push(url) };
  const auth = new MemberAuth(options);
  return { auth, store, options, calls, opened, id, get saved() { return saved; }, approve: () => { mode = 'APPROVED'; },
    active: () => { idle = false; }, advance: ms => { time += ms; }, restart: () => new MemberAuth(options) };
}

test('install/proof/PKCE/evidence/pending/approval/me follow real contracts without exposing secrets', async () => {
  const f = fixture(); const pending = await f.auth.begin(config);
  assert.equal(pending.phase, 'LINK_PENDING'); assert.equal(pending.guest_start_allowed, false);
  assert.equal((await f.auth.poll()).phase, 'LINK_PENDING');
  const link = f.calls.find(call => call.url.endsWith('/extension-link-requests'));
  const body = JSON.parse(link.body);
  assert.equal(body.callback_uri, callbackUri); assert.equal(body.code_challenge.length, 43);
  assert.equal(body.code_challenge, Buffer.from(await webcrypto.subtle.digest('SHA-256', new TextEncoder().encode(f.saved.verifier))).toString('base64url'));
  assert.equal(link.headers['X-Installation-Proof'], secret('p'));
  f.approve(); const linked = await f.auth.poll();
  assert.equal(linked.phase, 'LINKED'); assert.equal(linked.owner_user_id, '42');
  assert.equal(f.saved.verifier, undefined); assert.equal(f.saved.state, undefined);
  for (const value of [secret('p'), secret('a'), secret('r')]) assert.equal(JSON.stringify(linked).includes(value), false);
  assert.deepEqual(f.opened, [config.web_origin + '/#link?id=' + pending.link_request_id]);
  assert.equal(f.calls.every(call => call.redirect === 'error' && call.credentials === 'omit'), true);
});

test('active guest session blocks installation before any mutation or HTTP', async () => {
  const f = fixture(); f.active(); await assert.rejects(f.auth.begin(config), /GUEST_SESSION_ACTIVE/);
  assert.equal(f.calls.length, 0); assert.equal(f.saved, null);
});

test('LINK_PENDING persists across worker recreation and blocks new guest starts', async () => {
  const f = fixture(); await f.auth.begin(config); const restarted = f.restart();
  await assert.rejects(restarted.guardGuestStart(() => { throw new Error('must not start'); }), /ACCOUNT_TRANSITION_ACTIVE/);
  f.approve(); assert.equal((await restarted.poll()).phase, 'LINKED');
});

test('wrong claim state rejects before token exchange and never reports linked', async () => {
  const f = fixture(); const original = f.options.fetch;
  f.options.fetch = async (url, options) => url.endsWith('/claim') ?
    new Response(JSON.stringify({ status: 'APPROVED', state: 'wrong', code: secret('c') })) : original(url, options);
  const auth = f.restart(); await auth.begin(config); await assert.rejects(auth.poll(), /INVALID_AUTH_RESPONSE/);
  assert.equal(f.saved.phase, 'LINK_PENDING'); assert.equal(f.calls.some(call => call.url.endsWith('/extension-tokens')), false);
});

test('registration response loss preserves executor and prohibits duplicate registration/new ID', async () => {
  const f = fixture(); f.options.fetch = async () => { throw new Error('response lost'); }; const auth = f.restart();
  await assert.rejects(auth.begin(config), /AUTH_RESPONSE_UNCONFIRMED/);
  assert.equal(f.saved.phase, 'REGISTRATION_UNCONFIRMED'); assert.equal(f.saved.executor_id, f.id);
  await assert.rejects(auth.begin(config), /ACCOUNT_TRANSITION_ACTIVE/);
});

test('exchange response loss never replays the consumed code', async () => {
  const f = fixture(); const original = f.options.fetch; let exchanges = 0;
  f.options.fetch = async (url, options) => { if (url.endsWith('/extension-tokens')) { exchanges++; throw new Error('lost'); } return original(url, options); };
  const auth = f.restart(); await auth.begin(config); f.approve(); await assert.rejects(auth.poll(), /AUTH_RESPONSE_UNCONFIRMED/);
  assert.equal(f.saved.phase, 'AUTH_RECOVERY_REQUIRED');
  assert.equal((await f.restart().poll()).phase, 'AUTH_RECOVERY_REQUIRED'); assert.equal(exchanges, 1);
});

test('simultaneous credentials rotate refresh exactly once and persist the replacement', async () => {
  const f = fixture(); await f.auth.begin(config); f.approve(); await f.auth.poll(); f.advance(850000);
  const results = await Promise.all([f.auth.credentials(), f.auth.credentials()]);
  assert.equal(results[0].access_token, secret('b')); assert.deepEqual(results[0], results[1]);
  assert.equal(f.calls.filter(call => call.url.endsWith('/refresh')).length, 1); assert.equal(f.saved.refresh_token, secret('s'));
});

test('refresh response loss retains original securely without reusing it on restart', async () => {
  const f = fixture(); await f.auth.begin(config); f.approve(); await f.auth.poll(); f.advance(850000);
  let requests = 0; const original = f.options.fetch;
  f.options.fetch = async (url, options) => { if (url.endsWith('/refresh')) { requests++; throw new Error('lost'); } return original(url, options); };
  await assert.rejects(f.restart().credentials(), /AUTH_RESPONSE_UNCONFIRMED/);
  await assert.rejects(f.restart().credentials(), /MEMBER_AUTH_REQUIRED/);
  assert.equal(requests, 1); assert.equal(f.saved.phase, 'AUTH_RECOVERY_REQUIRED');
  assert.equal(f.saved.refresh_token, secret('r'));
});

test('definitive link rejection and expiration safely restore guest eligibility', async () => {
  const f = fixture(); const original = f.options.fetch;
  f.options.fetch = async (url, options) => url.endsWith('/extension-link-requests') ?
    new Response(JSON.stringify({ error: { code: 'INVALID_CALLBACK' } }), { status: 422 }) : original(url, options);
  const auth = f.restart(); await assert.rejects(auth.begin(config), /INVALID_CALLBACK/);
  assert.equal((await auth.status()).guest_start_allowed, true);
  const valid = f.auth; await valid.begin(config); f.advance(301000);
  assert.equal((await valid.status()).phase, 'REGISTERED'); assert.equal(f.saved.verifier, undefined);
});

test('storage failure before registration prevents network and preserves original guest state', async () => {
  const f = fixture(); f.store.put = async () => { throw new Error('STORAGE_FAILED'); };
  await assert.rejects(f.auth.begin(config), /STORAGE_FAILED/); assert.equal(f.calls.length, 0);
});

test('installation mismatch and unsafe Server URLs refuse authentication', async () => {
  const f = fixture(); for (const server_url of ['http://example.com/api/v1', 'https://u:p@example.com/api/v1', 'https://example.com/api/v1?x=1'])
    await assert.rejects(f.auth.begin({ ...config, server_url }), /INVALID_SERVER_CONFIG/);
  await f.auth.begin(config); await f.store.put({ ...f.saved, executor_id: webcrypto.randomUUID() });
  await assert.rejects(f.auth.status(), /AUTH_INSTALLATION_MISMATCH/);
});

test('real Chrome store boundary restricts access before reading/writing any secrets', async () => {
  const calls = []; let data = {};
  const store = new AuthStore({ setAccessLevel: async options => { assert.equal(options.accessLevel, 'TRUSTED_CONTEXTS'); calls.push('protect'); },
    get: async () => { calls.push('get'); return data; }, set: async value => { calls.push('set'); data = value; } });
  await store.put({ phase: 'REGISTERED' }); await store.get(); assert.deepEqual(calls, ['protect', 'set', 'protect', 'get']);
  await assert.rejects(new AuthStore({ get: async () => { throw new Error('must not read'); } }).get(), /AUTH_STORAGE_UNAVAILABLE/);
});

test('network delay after exchange cannot allow a competing guest start', async () => {
  const f = fixture(); await f.auth.begin(config); f.approve();
  let release; const original = f.auth.fetch;
  f.auth.fetch = async (url, options) => {
    if (url.endsWith('/extension-tokens')) await new Promise(resolve => { release = resolve; });
    return original(url, options);
  };
  const linking = f.auth.poll();
  while (!release) await new Promise(resolve => setTimeout(resolve, 1));
  let started = false; const start = f.auth.guardGuestStart(async () => { started = true; });
  const rejected = assert.rejects(start, /ACCOUNT_TRANSITION_ACTIVE/);
  release(); assert.equal((await linking).phase, 'LINKED'); await rejected; assert.equal(started, false);
});

test('linked status check verifies Server identity and rejects revoked tokens without deleting data', async () => {
  const f = fixture(); await f.auth.begin(config); f.approve(); await f.auth.poll();
  const original = f.auth.fetch;
  f.auth.fetch = async (url, options) => url.endsWith('/auth/me') ?
    new Response(JSON.stringify({ error: { code: 'INVALID_TOKEN' } }), { status: 401 }) : original(url, options);
  await assert.rejects(f.auth.poll(), /INVALID_TOKEN/);
  assert.equal(f.saved.phase, 'AUTH_RECOVERY_REQUIRED'); assert.equal(f.saved.refresh_token, secret('r'));
  await assert.rejects(f.auth.guardGuestStart(() => {}), /ACCOUNT_TRANSITION_ACTIVE/);
});
