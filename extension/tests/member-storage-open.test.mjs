import test from 'node:test';
import assert from 'node:assert/strict';
import { IDBFactory } from 'fake-indexeddb';
import { MemberAccessStore } from '../src/member-access.js';
import { MemberEventStore } from '../src/member-events.js';
import { MemberJournalStore } from '../src/member-journal-store.js';
import { MemberReportStore } from '../src/member-execution-client.js';

const stores = [
  [MemberAccessStore, s => s.pending(1), 'ACCESS_STORAGE_UNAVAILABLE', 'pending'],
  [MemberEventStore, s => s.list('MEMBER:1', 'synthetic-executor'), 'MEMBER_STORAGE_BLOCKED', 'events'],
  [MemberJournalStore, s => s.list('MEMBER:1', 'synthetic-executor'), 'MEMBER_JOURNAL_UNAVAILABLE', 'journal'],
  [MemberReportStore, s => s.transaction((_store, done) => done(null)), 'REPORT_STORAGE_UNAVAILABLE', 'reports'],
];
for (const [Store, read, code, objectStore] of stores) {
  test(`${Store.name} closes late successful open after reporting blocked storage`, async () => {
    const factory = new IDBFactory(), name = Store.name;
    // Hold an older connection so the next real version upgrade is blocked.
    const held = await new Promise((resolve, reject) => {
      const request = factory.open(name, 1);
      request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
    });
    let request;
    const indexedDB = { open: () => { request = factory.open(name, 2); return request; } };
    try {
      const store = new Store({ indexedDB, name });
      await assert.rejects(read(store), error => error.message === code);
      const opened = new Promise((resolve, reject) => {
        request.addEventListener('success', resolve);
        request.addEventListener('error', () => reject(request.error));
      });
      held.close(); await opened;
      assert.throws(() => request.result.transaction(objectStore), { name: 'InvalidStateError' });
      const upgraded = await new Promise((resolve, reject) => {
        const next = factory.open(name, 3);
        next.onblocked = () => reject(new Error('rejected operation leaked an open connection'));
        next.onsuccess = () => resolve(next.result); next.onerror = () => reject(next.error);
      });
      upgraded.close();
    } finally { held.close(); request?.result?.close(); }
  });
}

test('MemberEventStore maps a closed connection to the existing delivery storage error', async () => {
  const factory = new IDBFactory();
  const indexedDB = { open(...args) {
    const request = factory.open(...args);
    request.addEventListener('success', () => request.result.close());
    return request;
  } };
  const store = new MemberEventStore({ indexedDB });
  await assert.rejects(store.list('MEMBER:1', 'synthetic-executor'), /MEMBER_STORAGE_UNAVAILABLE/);
});
