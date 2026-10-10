import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { IDBFactory } from 'fake-indexeddb';
import { validate, MemberEventStore, MemberEventDelivery } from '../src/member-events.js';

test('default event fetch retains WorkerGlobalScope receiver', async () => {
  const original = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async function () {
    if (this !== globalThis) throw new TypeError('Illegal invocation');
    calls++;
    return new Response(JSON.stringify({ accepted: true }));
  };
  try {
    const credentials = { owner_key: 'MEMBER:1', executor_id: randomUUID(), access_token: 'synthetic-test-only' };
    const delivery = new MemberEventDelivery({ baseUrl: 'http://127.0.0.1:8080/api/v1',
      getCredentials: async () => credentials });
    assert.deepEqual(await delivery.request('/events', {}, credentials), { accepted: true });
    assert.equal(calls, 1);
  } finally { globalThis.fetch = original; }
});

function fixture(fetch) {
  const credentials = { owner_key: 'MEMBER:1', executor_id: randomUUID(), access_token: 'synthetic-test-only' };
  const store = new MemberEventStore({ indexedDB: new IDBFactory() });
  let time = 1000;
  const delivery = new MemberEventDelivery({ baseUrl: 'http://127.0.0.1:8080/api/v1', store,
    getCredentials: async () => credentials, fetch, now: () => time, random: () => 0 });
  const event = (host = 'chzzk.naver.com', seq = 1) => ({ schema_version: '1.2', event_id: randomUUID(),
    executor_id: credentials.executor_id, session_id: randomUUID(), policy_snapshot_id: randomUUID(),
    event_type: 'RECORDED_ACCESS', occurred_at: '2026-10-10T00:00:00.000Z', local_seq: seq,
    payload: { access_seq: seq, navigation_id: randomUUID(), target_kind: 'SITE', target_host: host,
      target_key: host, matched_policy_host: 'naver.com', reason: 'RECORD', blocked_reasons: [] } });
  return { credentials, store, delivery, event, advance: () => { time += 31000; } };
}
const response = items => new Response(JSON.stringify({ items }), { status: 200 });
const rows = f => f.store.list(f.credentials.owner_key, f.credentials.executor_id);

test('Event 1.2 actual hosts and policy hosts remain separate; invalid canonical hosts are rejected', () => {
  const f = fixture();
  for (const host of ['chzzk.naver.com', 'www.naver.com']) assert.equal(validate(f.event(host)).payload.target_key, host);
  for (const host of ['NAVER.com', 'example.com.', 'example.com:443', 'example.com/path', '127.0.0.1', 'localhost', 'a..com', 'a_1.com'])
    assert.throws(() => validate(f.event(host)), /INVALID_EVENT_CONTRACT/);
  const e = f.event(); delete e.payload.matched_policy_host;
  assert.throws(() => validate(e), /INVALID_EVENT_CONTRACT/);
  e.payload.matched_policy_host = null; assert.equal(validate(e), e);
});

test('legacy event bytes and ID remain unchanged; new fields are not silently converted to 1.1', async () => {
  const f = fixture(); const e = f.event(); e.schema_version = '1.1'; e.payload.target_key = 'SITE:chzzk.naver.com';
  delete e.payload.matched_policy_host; delete e.payload.blocked_reasons;
  const raw = JSON.stringify(e); await f.delivery.enqueue(e); assert.equal((await rows(f))[0].body, raw);
  e.payload.matched_policy_host = 'naver.com'; await assert.rejects(f.delivery.enqueue(e), /INVALID_EVENT_CONTRACT/);
  assert.equal((await rows(f))[0].body, raw);
});

test('multiple reasons remain one event with FEATURE type and representative reason priority', () => {
  const f = fixture(); const e = f.event('www.youtube.com');
  Object.assign(e, { event_type: 'BLOCKED_FEATURE_ACCESS' });
  Object.assign(e.payload, { target_kind: 'FEATURE', feature_code: 'YOUTUBE_SHORTS', matched_policy_host: 'youtube.com',
    blocked_reasons: ['KEYWORD', 'FEATURE'], reason: 'KEYWORD' });
  assert.equal(validate(e), e);
  e.payload.reason = 'FEATURE'; assert.throws(() => validate(e), /INVALID_EVENT_CONTRACT/);
  e.payload.reason = 'KEYWORD'; e.payload.blocked_reasons.push('KEYWORD'); assert.throws(() => validate(e), /INVALID_EVENT_CONTRACT/);
});

test('mixed item ACKs: accepted/duplicate finalize; rejected quarantines; pending remains pending', async () => {
  const statuses = ['ACCEPTED', 'DUPLICATE', 'REJECTED', 'PENDING_DEPENDENCY'];
  const f = fixture(async (_url, options) => response(JSON.parse(options.body).events.map((e, i) =>
    ({ event_id: e.event_id, status: statuses[i], ...(i === 2 ? { error: 'POLICY_MISMATCH' } : {}) }))));
  const events = statuses.map((_, i) => f.event('chzzk.naver.com', i + 1));
  for (const e of events) await f.delivery.enqueue(e);
  await f.delivery.flush();
  const result = await rows(f);
  for (let i = 0; i < events.length; i++) {
    const row = result.find(r => r.event_id === events[i].event_id);
    assert.equal(row.status, ['ACKED', 'ACKED', 'REJECTED', 'PENDING_DEPENDENCY'][i]);
    assert.equal(row.body, JSON.stringify(events[i]));
  }
});

test('lost response checks server status and never resends an accepted event', async () => {
  const calls = []; let id;
  const f = fixture(async (url, options) => { calls.push(url); if (url.endsWith('/batch')) {
    id = JSON.parse(options.body).events[0].event_id; throw new Error('lost response');
  } return response([{ event_id: id, status: 'ACCEPTED' }]); });
  const e = f.event(); await f.delivery.enqueue(e); await f.delivery.flush();
  assert.equal((await rows(f))[0].status, 'RESPONSE_UNCONFIRMED');
  await f.delivery.flush(); assert.equal(calls.length, 1);
  f.advance(); await f.delivery.flush();
  assert.equal((await rows(f))[0].status, 'ACKED');
  assert.deepEqual(calls.map(s => s.split('/').at(-1)), ['batch', 'status']);
});

test('503 then NOT_RECEIVED retries identical raw event after backoff, with no credentials in storage', async () => {
  const calls = []; let count = 0; let e;
  const f = fixture(async (url, options) => {
    calls.push({ url, options });
    if (url.endsWith('/status')) return response([{ event_id: e.event_id, status: 'NOT_RECEIVED' }]);
    if (++count === 1) return new Response('', { status: 503 });
    return response([{ event_id: e.event_id, status: 'DUPLICATE' }]);
  });
  e = f.event(); await f.delivery.enqueue(e); await f.delivery.flush();
  assert.equal((await rows(f))[0].status, 'RESPONSE_UNCONFIRMED');
  f.advance(); await f.delivery.flush(); assert.equal((await rows(f))[0].status, 'ACKED');
  assert.deepEqual(JSON.parse(calls[0].options.body), JSON.parse(calls[2].options.body));
  assert.equal(calls[0].options.redirect, 'error'); assert.equal(calls[0].options.credentials, 'omit');
  assert.equal(JSON.stringify(await rows(f)).includes(f.credentials.access_token), false);
});

test('worker restart preserves in-flight event and performs status lookup before any resend', async () => {
  const f = fixture(); const e = f.event(); await f.delivery.enqueue(e);
  const r = (await rows(f))[0]; await f.store.put({ ...r, status: 'IN_FLIGHT' });
  const calls = [];
  const restarted = new MemberEventDelivery({ baseUrl: 'http://localhost:8080/api/v1', store: f.store,
    getCredentials: async () => f.credentials, fetch: async url => {
      calls.push(url); return response([{ event_id: e.event_id, status: 'DUPLICATE' }]); } });
  await restarted.flush(); assert.equal((await rows(f))[0].status, 'ACKED');
  assert.equal(calls.length, 1); assert.ok(calls[0].endsWith('/status'));
});

test('pending and malformed item responses never count as success', async () => {
  let e; let mode = 'pending';
  const f = fixture(async () => response(mode === 'pending' ? [{ event_id: e.event_id, status: 'PENDING_DEPENDENCY' }] : []));
  e = f.event(); await f.delivery.enqueue(e); await f.delivery.flush();
  assert.equal((await rows(f))[0].status, 'PENDING_DEPENDENCY');
  f.advance(); mode = 'missing'; await f.delivery.flush();
  assert.equal((await rows(f))[0].status, 'RESPONSE_UNCONFIRMED');
});

test('guest authentication and other executor are rejected before storing or transmitting', async () => {
  let called = 0; const f = fixture(async () => { called++; }); const e = f.event();
  e.executor_id = randomUUID(); await assert.rejects(f.delivery.enqueue(e), /EXECUTOR_MISMATCH/);
  f.credentials.owner_key = 'GUEST:1'; await assert.rejects(f.delivery.flush(), /MEMBER_AUTH_REQUIRED/);
  assert.equal(called, 0);
});

test('owner change never sends old owner events under another member token', async () => {
  let called = 0; const f = fixture(async () => { called++; }); await f.delivery.enqueue(f.event());
  const owner = f.credentials.owner_key; f.credentials.owner_key = 'MEMBER:2';
  assert.deepEqual(await f.delivery.flush(), []); assert.equal(called, 0);
  assert.equal((await f.store.list(owner, f.credentials.executor_id))[0].status, 'QUEUED');
});

test('401 keeps raw event awaiting authentication and never ACKs it', async () => {
  const f = fixture(async () => new Response('', { status: 401 })); const e = f.event();
  await f.delivery.enqueue(e); await f.delivery.flush();
  const r = (await rows(f))[0]; assert.equal(r.status, 'AUTH_REQUIRED'); assert.equal(r.body, JSON.stringify(e));
});

test('same ID changed body is rejected without altering the durable original', async () => {
  const f = fixture(); const e = f.event(); await f.delivery.enqueue(e); const raw = (await rows(f))[0].body;
  e.local_seq++; await assert.rejects(f.delivery.enqueue(e), /EVENT_CONFLICT/);
  assert.equal((await rows(f))[0].body, raw);
});

test('storage failure prevents network transmission and does not mark success', async () => {
  let called = 0; const f = fixture(async () => { called++; }); await f.delivery.enqueue(f.event());
  f.store.put = async () => { throw new Error('MEMBER_STORAGE_UNAVAILABLE'); };
  await assert.rejects(f.delivery.flush(), /MEMBER_STORAGE_UNAVAILABLE/); assert.equal(called, 0);
});

test('public HTTP, URL credentials and non-API paths are rejected before sending tokens', () => {
  for (const baseUrl of ['http://example.com/api/v1', 'https://u:p@example.com/api/v1', 'https://example.com/other', 'https://example.com/api/v1?x=1'])
    assert.throws(() => new MemberEventDelivery({ baseUrl }), /INVALID_SERVER_URL/);
});

test('owner switch during durable transition is caught immediately before request', async () => {
  let called = 0; const f = fixture(async () => { called++; }); await f.delivery.enqueue(f.event());
  const originalPut = f.store.put.bind(f.store);
  f.store.put = async record => {
    const result = await originalPut(record);
    if (record.status === 'IN_FLIGHT') f.credentials.owner_key = 'MEMBER:2';
    return result;
  };
  await f.delivery.flush(); assert.equal(called, 0);
  const saved = await f.store.list('MEMBER:1', f.credentials.executor_id);
  assert.equal(saved[0].status, 'RESPONSE_UNCONFIRMED'); assert.equal(saved[0].error, 'MEMBER_OWNER_CHANGED');
});
