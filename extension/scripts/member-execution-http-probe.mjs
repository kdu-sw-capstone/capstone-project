// Real HTTP/MySQL; synthetic credentials, DNR/tabs/context and fake IndexedDB.
// This is not a product Chrome Worker or recovery/reconcile acceptance test.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { IDBFactory } from 'fake-indexeddb';
import { MemberExecutionClient, MemberReportStore } from '../src/member-execution-client.js';
import { MemberJournalStore } from '../src/member-journal-store.js';
import { SiteController } from '../src/site-controller.js';

const fixture = JSON.parse(process.env.FOCURVE_HTTP_FIXTURE);
const credentials = { owner_key: fixture.owner_key, executor_id: fixture.executor_id,
  access_token: process.env.FOCURVE_TEST_BEARER };
const indexedDB = new IDBFactory(), store = new MemberReportStore({ indexedDB });
const journal = new MemberJournalStore({ indexedDB });
let clock = Date.now(), loseResponse = true; const sent = [];
const options = { baseUrl: fixture.base_url, getCredentials: async () => credentials, store, now: () => clock,
  fetch: async (url, options) => {
    const response = await fetch(url, options);
    if (url.endsWith('/reports')) {
      sent.push(options.body); assert.equal(response.status, 200);
      if (loseResponse) { loseResponse = false; await response.json(); throw new Error('SYNTHETIC_LOST_RESPONSE'); }
    }
    return response;
  } };
const client = new MemberExecutionClient(options);
const apply = (await client.commands()).commands.find(command => command.session_id === fixture.session_id);
assert.equal(apply.duration_minutes, 1);
let context = { ...credentials, session_id: fixture.session_id, revision: apply.desired_revision,
  desired: 'APPLIED', reconciled: true }; // Synthetic trusted Core fixture, not a Server reconcile.
delete context.access_token;
let actual = [];
const controller = new SiteController({ journal, getContext: async () => context,
  blockedPageUrl: 'chrome-extension://synthetic/blocked/blocked.html', tabs: { query: async () => [] },
  dnr: { getSessionRules: async () => structuredClone(actual), isRegexSupported: async () => ({ isSupported: true }),
    updateSessionRules: async ({ addRules = [], removeRuleIds = [] }) => {
      actual = actual.filter(rule => !removeRuleIds.includes(rule.id)).concat(structuredClone(addRules));
    } } });
await controller.apply(apply); assert.ok(actual.length > 0);
const entry = await journal.load(credentials.owner_key, fixture.session_id);
assert.equal(Date.parse(entry.planned_end_at) - Date.parse(entry.applied_at), 60000);
const interval = { interval_id: randomUUID(), kind: 'RUN', start_at: entry.applied_at, quality: 'CONFIRMED' };
const report = { report_id: randomUUID(), command_id: apply.command_id, executor_id: credentials.executor_id,
  session_id: apply.session_id, desired_revision: apply.desired_revision, result: 'APPLIED',
  observed_at: entry.applied_at, intervals: [interval] };
await client.enqueue(report); await client.flush();
assert.equal((await store.list(credentials.owner_key, credentials.executor_id))[0].status, 'RESPONSE_UNCONFIRMED');
clock += 30000;
await new MemberExecutionClient({ ...options, store: new MemberReportStore({ indexedDB }) }).flush();
assert.equal(sent[0], sent[1]);
assert.equal((await store.list(credentials.owner_key, credentials.executor_id))[0].ack.result, 'DUPLICATE');
const ended = await fetch(fixture.base_url + '/sessions/' + fixture.session_id + '/end', {
  method: 'POST', headers: { Authorization: 'Bearer ' + credentials.access_token, 'Idempotency-Key': randomUUID() },
  credentials: 'omit', redirect: 'error' });
assert.equal(ended.status, 202);
const release = (await client.commands()).commands.find(command => command.session_id === fixture.session_id);
assert.equal(release.type, 'RELEASE_POLICY');
context = { ...context, revision: release.desired_revision, desired: 'RELEASED' };
await controller.release(release); assert.equal(actual.length, 0);
const releasedAt = new Date().toISOString();
await client.enqueue({ ...report, report_id: randomUUID(), command_id: release.command_id,
  desired_revision: release.desired_revision, result: 'RELEASED', observed_at: releasedAt,
  intervals: [{ ...interval, end_at: releasedAt, duration_ms: Date.parse(releasedAt) - Date.parse(interval.start_at) }] });
await client.flush();
assert.ok((await store.list(credentials.owner_key, credentials.executor_id)).every(row => row.status === 'ACKED'));
assert.equal((await client.commands()).commands.length, 0);
console.log('PASS: execution adapters -> actual HTTP/MySQL; synthetic DNR apply/release, immutable lost-response replay');
