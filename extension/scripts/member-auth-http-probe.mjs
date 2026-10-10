// Test-only product-module caller. Synthetic Web session/storage/Chrome; actual HTTP PKCE/token rotation.
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { MemberAuth } from '../src/member-auth.js';

const fixture = JSON.parse(process.env.FOCURVE_AUTH_FIXTURE);
let saved = null, clock = Date.now();
const requests = [];
const auth = new MemberAuth({ crypto: webcrypto, now: () => clock,
  store: { get: async () => structuredClone(saved), put: async r => { saved = structuredClone(r); return r; } },
  getInstallation: async () => ({ installation_id: fixture.executor_id }),
  inspectIdle: async () => ({ active_session_id: null, owned_rule_ids: [], pending_action_count: 0 }),
  callbackUri: fixture.callback_uri, clientVersion: '0.1.5', openApproval: async () => {},
  fetch: async (url, options) => { requests.push(url.split('/').at(-1)); return fetch(url, options); } });

async function run() {
  const pending = await auth.begin({ server_url: fixture.base_url, web_origin: fixture.web_origin });
  assert.equal(pending.phase, 'LINK_PENDING');
  assert.equal((await auth.poll()).phase, 'LINK_PENDING');
  // Only this test actor carries a synthetic Web cookie. The product adapter never sees it.
  const approved = await fetch(fixture.base_url + '/extension-link-requests/' + pending.link_request_id + '/approval', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Origin: fixture.web_origin,
      Cookie: 'focurve_session=' + fixture.web_cookie, 'X-CSRF-Token': fixture.csrf },
    body: JSON.stringify({ approve: true }), redirect: 'error' });
  assert.equal(approved.status, 200);
  const linked = await auth.poll();
  assert.equal(linked.phase, 'LINKED'); assert.equal(linked.owner_user_id, fixture.owner_user_id);
  assert.equal(linked.guest_start_allowed, false);
  assert.equal(JSON.stringify(linked).includes(saved.access_token), false);
  const credentials = await auth.credentials(); const oldToken = credentials.access_token;
  const me = await fetch(fixture.base_url + '/auth/me', { headers: { Authorization: 'Bearer ' + oldToken } });
  assert.equal(me.status, 200); assert.equal((await me.json()).user_id, fixture.owner_user_id);
  clock += 850000; // Local token expiry only; server clock/evidence is not forged.
  const next = await Promise.all([auth.credentials(), auth.credentials()]);
  assert.notEqual(next[0].access_token, oldToken); assert.deepEqual(next[0], next[1]);
  assert.equal(requests.filter(path => path === 'refresh').length, 1);
  const current = await fetch(fixture.base_url + '/auth/me', { headers: { Authorization: 'Bearer ' + next[0].access_token } });
  assert.equal(current.status, 200); assert.equal((await current.json()).user_id, fixture.owner_user_id);
  console.log('PASS: actual installation/proof/evidence/Web approval/PKCE exchange/me/serialized refresh HTTP');
}
run().catch(() => { console.error('FAIL: auth HTTP probe; no credentials or response bodies logged'); process.exitCode = 1; });
