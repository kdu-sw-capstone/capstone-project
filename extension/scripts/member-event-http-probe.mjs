// Test-only Node caller of the product adapter. No Chrome or real member login is simulated as verified.
import assert from 'node:assert/strict';
import { IDBFactory } from 'fake-indexeddb';
import { MemberEventDelivery, MemberEventStore } from '../src/member-events.js';

const fixture = JSON.parse(process.env.FOCURVE_HTTP_FIXTURE);
const credentials = { owner_key: fixture.owner_key, executor_id: fixture.events[0].executor_id,
  access_token: process.env.FOCURVE_TEST_BEARER };
const store = new MemberEventStore({ indexedDB: new IDBFactory() });
let clock = Date.now(); let loseResponse = true;
const calls = [];
const delivery = new MemberEventDelivery({ baseUrl: fixture.base_url, store,
  getCredentials: async () => credentials, now: () => clock, random: () => 0,
  fetch: async (url, options) => {
    calls.push(url.split('/').at(-1));
    const response = await fetch(url, options);
    if (url.endsWith('/batch') && loseResponse) {
      assert.equal(response.status, 200);
      const body = await response.json();
      assert.ok(body.items.every(item => item.status === 'ACCEPTED'));
      loseResponse = false;
      throw new Error('SYNTHETIC_RESPONSE_LOSS_AFTER_REAL_SERVER_ACCEPT');
    }
    return response;
  } });
for (const event of fixture.events) await delivery.enqueue(event);
assert.ok((await delivery.flush()).every(row => row.status === 'RESPONSE_UNCONFIRMED'));
clock += 31000;
assert.ok((await delivery.flush()).every(row => row.status === 'ACKED'));
assert.deepEqual(calls, ['batch', 'status']);

// Simulate a durable outbox retry of exactly the original event, not a new ID/body.
for (const row of await store.list(credentials.owner_key, credentials.executor_id)) {
  assert.equal(row.body, JSON.stringify(fixture.events.find(e => e.event_id === row.event_id)));
  await store.put({ ...row, status: 'QUEUED', next_attempt_at: 0 });
}
assert.ok((await delivery.flush()).every(row => row.status === 'ACKED'));
assert.deepEqual(calls, ['batch', 'status', 'batch']);
console.log('PASS: product Node adapter -> actual HTTP -> MySQL; response-loss status lookup and identical replay');
