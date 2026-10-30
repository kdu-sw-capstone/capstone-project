import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { IDBFactory } from 'fake-indexeddb';
import { createMemberDB } from '../member-a1/db.mjs';
import { AdditionalObservationJournal } from '../src/additional-observation-journal.js';
import { AdditionalTimeRuntime } from '../src/additional-time-runtime.js';
const context = () => ({ bootId: randomUUID(), executorId: randomUUID(), ownerBindingId: randomUUID() });
const boundary = n => ({ revision: n, observedMonoMs: n, reason: 'TEST', status: 'UNKNOWN', target: null,
  collectionEligible: false, requiresLimitedSiteHold: true, priorTailRequiresValidation: true });
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
function setup({ journal, maxPending } = {}) {
  const real = new AdditionalObservationJournal(createMemberDB(new IDBFactory(), randomUUID()));
  let emit, stopped = 0; const statuses = [];
  const runtime = new AdditionalTimeRuntime({ journal: journal ?? real, maxPending, onStatus: s => statuses.push(s),
    createObserver: ({ onBoundary }) => { emit = onBoundary; return {
      start: async () => { emit(boundary(1)); }, stop: () => { stopped++; }
    }; } });
  return { runtime, journal: real, emit: b => emit(b), statuses, stopped: () => stopped };
}
test('real journal persists callback order and stop drains accepted observations', async () => {
  const h = setup(); await h.runtime.start(context());
  for (let i = 2; i <= 10; i++) h.emit(boundary(i));
  await h.runtime.stop(); const s = await h.journal.recover();
  assert.deepEqual(s.captures.map(c => c.boundary.revision), [1,2,3,4,5,6,7,8,9,10]);
  assert.equal(h.runtime.state, 'STOPPED');
  assert.ok(h.statuses.every(s => s.measurementQuality === 'UNKNOWN'));
});
test('failed append retains pending capture and stops further observations', async () => {
  let calls = 0;
  const h = setup({ journal: { start: async () => 1, append: async () => { calls++; throw Error('DISK_FAILURE'); } } });
  await assert.rejects(h.runtime.start(context()), /DISK_FAILURE/);
  h.emit(boundary(2)); assert.equal(calls, 1); assert.equal(h.runtime.queue.length, 1);
  assert.equal(h.runtime.state, 'FAILED'); assert.ok(h.stopped() > 0);
  await assert.rejects(h.runtime.stop(), /DISK_FAILURE/);
  await assert.rejects(h.runtime.start(context()), /RUNTIME_NOT_STOPPED/);
});
test('overflow fails closed while in-flight durable write may finish', async () => {
  const wait = deferred(); let count = 0;
  const h = setup({ maxPending: 2, journal: { start: async () => 1, append: async () => { count++; await wait.promise; } } });
  const starting = h.runtime.start(context()); await Promise.resolve(); await Promise.resolve();
  h.emit(boundary(2)); h.emit(boundary(3)); assert.equal(h.runtime.state, 'FAILED');
  wait.resolve(); await assert.rejects(starting, /QUEUE_EXHAUSTED/);
  assert.equal(count, 1); assert.equal(h.runtime.queue.length, 1);
});
test('stop while journal startup is pending cannot reopen observer', async () => {
  const wait = deferred(); let writes = 0;
  const h = setup({ journal: { start: () => wait.promise, append: async () => { writes++; } } });
  const starting = h.runtime.start(context()); await h.runtime.stop();
  await assert.rejects(h.runtime.start(context()), /RUNTIME_NOT_STOPPED/);
  wait.resolve(1); await starting;
  assert.equal(h.runtime.state, 'STOPPED'); assert.equal(writes, 0);
});
test('restart uses new epoch, caller mutation cannot rewrite queued capture', async () => {
  const h = setup(); await h.runtime.start(context()); const b = boundary(2); h.emit(b); b.revision = 999;
  await h.runtime.stop(); await h.runtime.start(context()); await h.runtime.stop();
  const s = await h.journal.recover(); assert.deepEqual(s.captures.map(c => c.boundary.revision), [1,2,1]);
  assert.equal(s.captures.at(-1).epoch, 2);
});

test('actual foreground observer callbacks flow through runtime into durable journal', async () => {
  const event = () => ({ addListener() {}, removeListener() {} });
  const tabs = { query: async () => [{ id: 1, windowId: 2, active: true, url: 'https://example.com/' }] };
  for (const key of ['onActivated','onUpdated','onRemoved','onReplaced','onAttached','onDetached']) tabs[key] = event();
  const journal = new AdditionalObservationJournal(createMemberDB(new IDBFactory(), randomUUID()));
  const runtime = new AdditionalTimeRuntime({ journal, browser: { tabs,
    windows: { getLastFocused: async () => ({ id: 2, focused: true, type: 'normal' }), onFocusChanged: event(), onRemoved: event() },
    idle: { queryState: async () => 'active', setDetectionInterval() {}, onStateChanged: event() },
    permissions: { contains: async () => true, onRemoved: event() } } });
  await runtime.start(context()); await runtime.stop();
  const s = await journal.recover();
  assert.ok(s.captures.some(c => c.boundary.status === 'CANDIDATE'));
  assert.equal(s.captures.at(-1).boundary.reason, 'STOP');
  assert.equal(s.captures.at(-1).boundary.status, 'UNKNOWN');
});
