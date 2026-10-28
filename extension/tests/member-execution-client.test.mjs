import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { IDBFactory } from 'fake-indexeddb';
import { MemberExecutionClient, MemberReportStore, validateExecutionReport } from '../src/member-execution-client.js';

const json = (value, status = 200) => new Response(JSON.stringify(value), { status });
function fixture(fetch) {
  let credentials = { owner_key: 'MEMBER:1', executor_id: randomUUID(), access_token: 'synthetic-only' };
  const indexedDB = new IDBFactory(), store = new MemberReportStore({ indexedDB }); let now = 0;
  const options = { baseUrl: 'http://127.0.0.1:8080/api/v1', getCredentials: async () => credentials,
    store, fetch, now: () => now };
  const client = new MemberExecutionClient(options);
  const report = { report_id: randomUUID(), command_id: randomUUID(), session_id: randomUUID(),
    executor_id: credentials.executor_id, desired_revision: 1, result: 'APPLIED',
    observed_at: '2026-10-10T00:00:00.000Z', intervals: [{ interval_id: randomUUID(), kind: 'RUN',
      start_at: '2026-10-10T00:00:00.000Z', quality: 'CONFIRMED' }] };
  return { client, options, store, indexedDB, report, credentials,
    rows: () => store.list('MEMBER:1', report.executor_id), advance: () => { now += 30000; },
    changeOwner: () => { credentials = { ...credentials, owner_key: 'MEMBER:2' }; } };
}
const ack = (revision = 1, result = 'ACCEPTED') => json({ result, desired_revision: revision });

test('actual IDB commit precedes POST, persisted body has no credentials and ACK preserves raw bytes', async () => {
  let f;
  f = fixture(async (url, options) => {
    assert.match(url, /\/executors\/.+\/reports$/);
    assert.equal((await f.rows())[0].body, options.body);
    assert.equal(options.credentials, 'omit'); assert.equal(options.redirect, 'error');
    return ack();
  });
  const raw = JSON.stringify(f.report); await f.client.enqueue(f.report); await f.client.flush();
  const row = (await f.rows())[0]; assert.equal(row.body, raw); assert.equal(row.status, 'ACKED');
  assert.equal(JSON.stringify(row).includes('synthetic-only'), false);
});

test('lost response and recreated client retry identical ID/body with DUPLICATE acknowledgement', async () => {
  const bodies = []; let first = true;
  const f = fixture(async (_url, options) => {
    bodies.push(options.body); if (first) { first = false; throw new TypeError('response lost'); }
    return ack(2, 'DUPLICATE');
  });
  await f.client.enqueue(f.report); await f.client.flush();
  assert.equal((await f.rows())[0].status, 'RESPONSE_UNCONFIRMED');
  await f.client.flush(); assert.equal(bodies.length, 1); f.advance();
  const recreated = new MemberExecutionClient({ ...f.options, store: new MemberReportStore({ indexedDB: f.indexedDB }) });
  await recreated.flush(); await recreated.flush();
  assert.equal(bodies.length, 2); assert.equal(bodies[0], bodies[1]);
  assert.deepEqual((await f.rows())[0].ack, { result: 'DUPLICATE', desired_revision: 2 });
});

test('duplicate enqueue retains ACK and conflicting body is rejected atomically', async () => {
  const f = fixture(async () => ack()); await f.client.enqueue(f.report); await f.client.flush();
  await f.client.enqueue(f.report); assert.equal((await f.rows())[0].status, 'ACKED');
  await assert.rejects(f.client.enqueue({ ...f.report, desired_revision: 2 }), /REPORT_CONFLICT/);
  assert.equal((await f.rows())[0].body, JSON.stringify(f.report));
});

test('concurrent same-ID different bodies never overwrite the first durable report', async () => {
  const f = fixture();
  const results = await Promise.allSettled([f.client.enqueue(f.report), f.client.enqueue({ ...f.report, desired_revision: 2 })]);
  assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
  assert.equal((await f.rows()).length, 1);
});

test('403/409/422 reports are quarantined; 401/429/503 remain pending for identical retry', async () => {
  for (const status of [403, 409, 422, 401, 429, 503]) {
    let calls = 0; const f = fixture(async () => { calls++; return json({}, status); });
    await f.client.enqueue(f.report); await f.client.flush(); f.advance(); await f.client.flush();
    const permanent = [403, 409, 422].includes(status);
    assert.equal((await f.rows())[0].status, permanent ? 'REJECTED' : 'RESPONSE_UNCONFIRMED');
    assert.equal(calls, permanent ? 1 : 2);
  }
});

test('malformed ACK cannot mark a report acknowledged', async () => {
  for (const response of [{}, { result: 'OK', desired_revision: 1 }, { result: 'ACCEPTED', desired_revision: '1' }]) {
    const f = fixture(async () => json(response)); await f.client.enqueue(f.report); await f.client.flush();
    assert.equal((await f.rows())[0].status, 'RESPONSE_UNCONFIRMED');
  }
});

test('older accepted report records newer revision without asserting current application', async () => {
  const f = fixture(async () => ack(3)); await f.client.enqueue(f.report); await f.client.flush();
  const row = (await f.rows())[0]; assert.equal(row.ack.desired_revision, 3);
  assert.equal(row.observed, undefined); assert.equal(row.execution_status, undefined);
});

test('owner changes, different installation and server never receive existing outbox', async () => {
  let calls = 0; const f = fixture(async () => { calls++; return ack(); });
  await f.client.enqueue(f.report); f.changeOwner(); await f.client.flush(); assert.equal(calls, 0);
  await assert.rejects(f.client.enqueue({ ...f.report, executor_id: randomUUID() }), /EXECUTION_SCOPE_MISMATCH/);
  const other = new MemberExecutionClient({ ...f.options, baseUrl: 'http://localhost:8080/api/v1',
    getCredentials: async () => f.credentials });
  await other.flush(); assert.equal(calls, 0); assert.equal((await f.rows())[0].status, 'PENDING');
});

test('caller mutation while credential lookup awaits cannot alter the durable payload', async () => {
  const f = fixture(); const raw = JSON.stringify(f.report);
  const saving = f.client.enqueue(f.report); f.report.desired_revision = 99; await saving;
  assert.equal((await f.rows())[0].body, raw);
});

test('invalid reports, open release interval and inconsistent duration are rejected', () => {
  const f = fixture(); const original = f.report;
  for (const change of [{ access_token: 'must-not-store' }, { command_id: null }, { desired_revision: 0 },
    { observed_at: '2026-02-30T00:00:00Z' }, { result: 'RUNNING' }, { result: 'RELEASED' }])
    assert.throws(() => validateExecutionReport({ ...original, ...change }), /INVALID_EXECUTION_REPORT/);
  const release = structuredClone(original); release.result = 'RELEASED'; release.observed_at = '2026-10-10T00:00:01Z';
  Object.assign(release.intervals[0], { end_at: release.observed_at, duration_ms: 1000 });
  assert.equal(validateExecutionReport(release), release);
  release.intervals[0].duration_ms = 999; assert.throws(() => validateExecutionReport(release), /INVALID_EXECUTION_REPORT/);
});

test('command lookup accepts nanosecond times; missing duration or wrong owner fails without execution', async () => {
  const f = fixture();
  const command = { command_id: randomUUID(), session_id: randomUUID(), executor_id: f.credentials.executor_id,
    type: 'APPLY_POLICY', desired_revision: 1, created_at: '2026-10-10T00:00:00.123456789Z',
    execute_before: '2026-10-10T00:01:00Z', duration_minutes: 25,
    snapshot: { owner_user_id: 1, executor_id: f.credentials.executor_id } };
  let response = { commands: [command], next_cursor: '', server_time: command.created_at };
  const client = new MemberExecutionClient({ ...f.options, fetch: async () => json(response) });
  assert.deepEqual((await client.commands()).commands, [command]);
  delete command.duration_minutes; await assert.rejects(client.commands(), /INVALID_COMMAND_RESPONSE/);
  command.duration_minutes = 25; command.snapshot.owner_user_id = 2;
  await assert.rejects(client.commands(), /INVALID_COMMAND_RESPONSE/);
  response = { commands: [], next_cursor: '', server_time: '2026-02-30T00:00:00Z' };
  await assert.rejects(client.commands(), /INVALID_COMMAND_RESPONSE/);
});

test('owner change during command response prevents delivery to Core', async () => {
  const f = fixture(); const client = new MemberExecutionClient({ ...f.options, fetch: async () => {
    f.changeOwner(); return json({ commands: [], next_cursor: '', server_time: '2026-10-10T00:00:00Z' });
  } });
  await assert.rejects(client.commands(), /EXECUTION_OWNER_CHANGED/);
});

test('native default fetch stays bound to global receiver', async () => {
  const original = globalThis.fetch; let calls = 0;
  globalThis.fetch = async function () { assert.equal(this, globalThis); calls++; return ack(); };
  try {
    const f = fixture(); await f.client.enqueue(f.report); await f.client.flush(); assert.equal(calls, 1);
  } finally { globalThis.fetch = original; }
});

test('unavailable IDB never sends reports; unsafe Server URLs are rejected', async () => {
  let calls = 0; const f = fixture(async () => { calls++; return ack(); });
  const client = new MemberExecutionClient({ ...f.options, store: new MemberReportStore({ indexedDB: { open() { throw new Error('blocked'); } } }) });
  await assert.rejects(client.enqueue(f.report)); assert.equal(calls, 0);
  for (const baseUrl of ['http://example.com/api/v1', 'http://user:password@localhost/api/v1',
    'http://localhost/api/v1?token=x', 'http://localhost/api/v1/'])
    assert.throws(() => new MemberExecutionClient({ ...f.options, baseUrl }), /INVALID_SERVER_CONFIG/);
});

test('corrupted or misbound durable reports are quarantined without HTTP', async () => {
  let calls = 0; const f = fixture(async () => { calls++; return ack(); });
  await f.store.insert({ owner_key: 'MEMBER:1', executor_id: f.report.executor_id, report_id: f.report.report_id,
    base_url: f.options.baseUrl, body: JSON.stringify({ ...f.report, executor_id: randomUUID() }), status: 'PENDING', next_attempt_at: 0 });
  await f.client.flush(); assert.equal(calls, 0);
  assert.equal((await f.rows())[0].status, 'REJECTED');
});
