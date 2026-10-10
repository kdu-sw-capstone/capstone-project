// Internal durable member execution journal. No new Server Journal wire format.
// This store is separate from guest data and member access-event outboxes.
export class MemberJournalStore {
  constructor({ indexedDB = globalThis.indexedDB, name = 'focurve-member-execution' } = {}) {
    this.indexedDB = indexedDB; this.name = name;
  }
  async transaction(mode, work) {
    const db = await new Promise((resolve, reject) => {
      const request = this.indexedDB.open(this.name, 1);
      request.onupgradeneeded = () => request.result.createObjectStore('journal', { keyPath: ['owner_key', 'session_id'] });
      request.onsuccess = () => resolve(request.result);
      request.onerror = request.onblocked = () => reject(new Error('MEMBER_JOURNAL_UNAVAILABLE'));
    });
    try {
      return await new Promise((resolve, reject) => {
        const tx = db.transaction('journal', mode); let value;
        tx.oncomplete = () => resolve(value);
        tx.onabort = () => reject(new Error('MEMBER_JOURNAL_UNAVAILABLE'));
        try { work(tx.objectStore('journal'), result => { value = result; }); }
        catch { tx.abort(); }
      });
    } finally { db.close(); }
  }
  load(ownerKey, sessionId) {
    return this.transaction('readonly', (store, done) => {
      const request = store.get([ownerKey, sessionId]);
      request.onsuccess = () => done(request.result ?? null);
    });
  }
  list(ownerKey, executorId) {
    return this.transaction('readonly', (store, done) => {
      const request = store.getAll();
      request.onsuccess = () => done(request.result.filter(entry => entry.owner_key === ownerKey && entry.executor_id === executorId));
    });
  }
  save(entry) {
    const copy = structuredClone(entry);
    if (!/^MEMBER:[1-9][0-9]*$/.test(copy.owner_key)) throw new Error('INVALID_OWNER');
    return this.transaction('readwrite', (store, done) => { store.put(copy); done(null); });
  }
}
