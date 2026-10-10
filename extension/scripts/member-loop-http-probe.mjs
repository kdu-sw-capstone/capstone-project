// Product loop + actual Server HTTP/MySQL. Chrome DNR/tabs/idle and auth are synthetic.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { IDBFactory } from 'fake-indexeddb';
import { MemberExecutionClient, MemberReportStore } from '../src/member-execution-client.js';
import { MemberJournalStore } from '../src/member-journal-store.js';
import { MemberExecutionLoop } from '../src/member-execution-loop.js';
const fixture = JSON.parse(process.env.FOCURVE_HTTP_FIXTURE);
const credentials = { owner_key: fixture.owner_key, executor_id: fixture.executor_id, access_token: process.env.FOCURVE_TEST_BEARER };
const indexedDB = new IDBFactory(), journal = new MemberJournalStore({ indexedDB });
const control = new MemberJournalStore({ indexedDB, name: 'loop-control' });
const client = new MemberExecutionClient({ baseUrl: fixture.base_url, getCredentials: async () => credentials,
  store: new MemberReportStore({ indexedDB }) });
let actual = [], additions = 0;
const options = { client, journal, control, getCredentials: async () => credentials, idle: async () => {},
  blockedPageUrl: 'chrome-extension://synthetic/blocked/blocked.html', tabs: { query: async () => [] },
  dnr: { getSessionRules: async () => structuredClone(actual), isRegexSupported: async () => ({ isSupported: true }),
    updateSessionRules: async ({ addRules = [], removeRuleIds = [] }) => {
      additions += addRules.length; actual = actual.filter(rule => !removeRuleIds.includes(rule.id)).concat(structuredClone(addRules));
    } } };
const loop = new MemberExecutionLoop(options);
assert.equal((await loop.tick()).status, 'RUNNING'); assert.ok(actual.length);
const recreated = new MemberExecutionLoop(options);
assert.equal((await recreated.tick()).status, 'RUNNING'); assert.equal(additions, 1);
if (fixture.local_end) {
  assert.equal((await recreated.end(fixture.session_id)).status, 'RELEASED');
} else {
  await client.end(fixture.session_id, randomUUID()); await recreated.tick();
}
assert.equal(actual.length, 0); await recreated.tick();
assert.equal((await control.load(credentials.owner_key, fixture.session_id)).phase, 'FINAL');
console.log('PASS: execution adapters product loop; actual session/context/reconcile HTTP, synthetic DNR, no reapply');
