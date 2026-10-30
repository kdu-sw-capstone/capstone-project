import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { IDBFactory } from 'fake-indexeddb';
import { createMemberDB } from '../member-a1/db.mjs';
import { AdditionalObservationJournal } from '../src/additional-observation-journal.js';
const context = () => ({ bootId: randomUUID(), executorId: randomUUID(), ownerBindingId: randomUUID() });
const boundary = (n = 1) => ({ revision: n, observedMonoMs: n * 50, status: 'CANDIDATE', reason: 'RECHECK',
  collectionEligible: true, requiresLimitedSiteHold: false, priorTailRequiresValidation: true,
  target: { tabId: 10, windowId: 1, host: 'example.com' } });
function setup(options) {
  const idb = new IDBFactory(), name = randomUUID();
  const db = createMemberDB(idb, name);
  return { db, journal: new AdditionalObservationJournal(db, options),
    reopen: () => new AdditionalObservationJournal(createMemberDB(idb, name), options) };
}
test('capture and cursor persist together; duplicate does not add time or rows', async () => {
  const h = setup(), epoch = await h.journal.start(context()), id = randomUUID();
  const row = await h.journal.append(epoch, id, boundary());
  assert.deepEqual(await h.journal.append(epoch, id, boundary()), row);
  const state = await h.reopen().recover();
  assert.equal(state.captures.length, 1); assert.equal(state.cursor.hash, row.hash);
  assert.equal(state.obligations[0].reason, 'RESTART_UNCONFIRMED');
  assert.equal(Object.hasOwn(row, 'confirmed_ms'), false);
  await assert.rejects(h.journal.append(epoch, id, boundary(2)), /CAPTURE_ID_CONFLICT/);
});
test('restart fences old collector and preserves old owner capture and obligation', async () => {
  const h = setup(), a = context(), epoch = await h.journal.start(a);
  await h.journal.append(epoch, randomUUID(), boundary());
  const reopened = h.reopen(), next = await reopened.start(context());
  await assert.rejects(h.journal.append(epoch, randomUUID(), boundary(2)), /STALE_COLLECTOR/);
  await reopened.append(next, randomUUID(), boundary(0));
  const s = await reopened.recover(); assert.equal(s.captures[0].context.ownerBindingId, a.ownerBindingId);
  assert.equal(s.captures[1].previous, s.captures[0].hash); assert.equal(s.obligations.length, 2);
});
test('transaction abort leaves neither cursor nor capture; exact retry succeeds', async () => {
  const h = setup(), epoch = await h.journal.start(context()); let abort = true;
  const faultDB = { transaction: (mode, work) => h.db.transaction(mode, (tx, done) => work(tx, result => {
    if (mode === 'readwrite' && abort) tx.abort(); else done(result);
  })) };
  const faulty = new AdditionalObservationJournal(faultDB), id = randomUUID();
  await assert.rejects(faulty.append(epoch, id, boundary()), /STORAGE_UNCONFIRMED/);
  const s = await h.journal.recover(); assert.equal(s.cursor, null); assert.equal(s.captures.length, 0);
  abort = false; await faulty.append(epoch, id, boundary()); assert.equal((await h.journal.recover()).captures.length, 1);
});
test('concurrent captures cannot fork cursor; loser retries without loss', async () => {
  const h = setup(), epoch = await h.journal.start(context()), ids = [randomUUID(), randomUUID()];
  const results = await Promise.allSettled(ids.map(id => h.journal.append(epoch, id, boundary())));
  for (const [i, result] of results.entries()) if (result.status === 'rejected') {
    assert.match(result.reason.message, /CURSOR_CONFLICT/);
    await h.journal.append(epoch, ids[i], boundary());
  }
  const s = await h.journal.recover(); assert.equal(s.captures.length, 2);
  assert.equal(s.captures[1].previous, s.captures[0].hash);
});
test('capacity preserves pending data, monotonic rollback is rejected', async () => {
  const h = setup({ capacity: 1 }), epoch = await h.journal.start(context());
  await h.journal.append(epoch, randomUUID(), boundary());
  await assert.rejects(h.journal.append(epoch, randomUUID(), boundary(2)), /CAPACITY_EXHAUSTED/);
  assert.equal((await h.journal.recover()).captures.length, 1);
  const j = setup(), e = await j.journal.start(context()); await j.journal.append(e, randomUUID(), boundary(2));
  await assert.rejects(j.journal.append(e, randomUUID(), boundary(1)), /ORDER_INVALID/);
});
test('stored payload corruption is not accepted as a recoverable cursor', async () => {
  const h = setup(), epoch = await h.journal.start(context()); await h.journal.append(epoch, randomUUID(), boundary());
  await h.db.transaction('readwrite', (tx, done) => {
    const store = tx.objectStore('metadata'), r = store.get('amvp_journal_v1:time-observations');
    r.onsuccess = () => { r.result.captures[0].boundary.observedMonoMs = 999; store.put(r.result); done(); };
  });
  await assert.rejects(h.reopen().recover(), /HASH_MISMATCH/);
});
test('no extra URL payload or forged eligibility enters journal', async () => {
  const h = setup(), epoch = await h.journal.start(context());
  await assert.rejects(h.journal.append(epoch, randomUUID(), { ...boundary(), url: 'secret' }), /INVALID_BOUNDARY/);
  await assert.rejects(h.journal.append(epoch, randomUUID(), { ...boundary(), collectionEligible: false }), /INVALID_BOUNDARY/);
  assert.equal((await h.journal.recover()).captures.length, 0);
});

test('unstarted collector cannot create captures with epoch zero', async () => {
  const h = setup();
  await assert.rejects(h.journal.append(0, randomUUID(), boundary()), /INVALID_COLLECTOR_EPOCH/);
  const s = await h.journal.recover(); assert.equal(s.cursor, null); assert.equal(s.captures.length, 0);
});
