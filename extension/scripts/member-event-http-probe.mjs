// Test-only Node caller of the product adapter. No Chrome or real member login is simulated as verified.
import assert from 'node:assert/strict';
import { IDBFactory } from 'fake-indexeddb';
import { MemberAccessStore, MemberAccessCollector } from '../src/member-access.js';
import { MemberEventDelivery, MemberEventStore } from '../src/member-events.js';

const fixture = JSON.parse(process.env.FOCURVE_HTTP_FIXTURE);
const credentials = { owner_key: fixture.owner_key, executor_id: fixture.events[0].executor_id,
  access_token: process.env.FOCURVE_TEST_BEARER };
const db=new IDBFactory(), originals=new MemberAccessStore({indexedDB:db});
const store = new MemberEventStore({ indexedDB: db });
// Native navigation and Core context are synthetic; product capture, storage and delivery are real JS.
const first=fixture.events[0],ids=fixture.events.flatMap(e=>[e.payload.navigation_id,e.event_id]);
const collector=new MemberAccessCollector({store:originals,randomUUID:()=>ids.shift(),blockedPageUrl:'chrome-extension://synthetic/blocked/blocked.html',
  getContext:async()=>({owner_key:credentials.owner_key,executor_id:credentials.executor_id,base_url:fixture.base_url,session_id:first.session_id,
    revision:1,applied_at:new Date(Date.parse(first.occurred_at)-1).toISOString(),snapshot:{policy_snapshot_id:first.policy_snapshot_id,
      sites:[{canonical_host:'naver.com',include_subdomains:true,access_policy:'RECORD'}]}})});
const captured=[];
for(const e of fixture.events) {
  const at=Date.parse(e.occurred_at),details={frameId:0,tabId:1,url:'https://'+e.payload.target_host+'/synthetic',timeStamp:at-1,observed_at:at-1};
  await collector.observe('before',details);
  const event=await collector.observe('commit',{...details,timeStamp:at,observed_at:at,transitionType:'typed',transitionQualifiers:[]});
  assert.equal(event.event_id,e.event_id);assert.equal(event.payload.access_seq,e.payload.access_seq);captured.push(event);
}
fixture.events=captured;
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
for (const event of fixture.events) await delivery.enqueue(event,credentials);
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
assert.equal((await originals.originals(credentials.owner_key,credentials.executor_id,fixture.base_url)).length,4);
console.log('PASS: product Node adapter -> actual HTTP -> MySQL; response-loss status lookup and identical replay');
