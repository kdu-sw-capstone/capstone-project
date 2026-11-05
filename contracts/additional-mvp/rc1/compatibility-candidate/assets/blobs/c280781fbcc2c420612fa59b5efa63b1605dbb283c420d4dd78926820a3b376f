// Internal durable member execution journal. No new Server Journal wire format.
// This store is separate from guest data and member access-event outboxes.
export class MemberJournalStore {
  constructor({ indexedDB = globalThis.indexedDB, name = 'focurve-member-execution' } = {}) {
    this.indexedDB = indexedDB; this.name = name;
  }
  async transaction(mode, work) {
    const db = await new Promise((resolve, reject) => {
      const request = this.indexedDB.open(this.name, 1); let abandoned = false;
      request.onupgradeneeded = () => request.result.createObjectStore('journal', { keyPath: ['owner_key', 'session_id'] });
      request.onsuccess = () => { if (abandoned) { request.result.close(); return; } resolve(request.result); };
      request.onerror = () => reject(new Error('MEMBER_JOURNAL_UNAVAILABLE'));
      request.onblocked = () => { abandoned = true; reject(new Error('MEMBER_JOURNAL_UNAVAILABLE')); };
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
  save(entry, options = {}) {
    const copy = structuredClone(entry);
    if (!/^MEMBER:[1-9][0-9]*$/.test(copy.owner_key)) throw new Error('INVALID_OWNER');
    if (Object.hasOwn(options, 'expected')) {
      const expected = structuredClone(options.expected); let failure;
      return this.transaction('readwrite', (store, done) => {
        const request = store.get([copy.owner_key, copy.session_id]);
        request.onsuccess = () => { try {
          if (JSON.stringify(request.result ?? null) !== JSON.stringify(expected)) {
            failure = new Error('JOURNAL_CONFLICT'); store.transaction.abort(); return;
          }
          store.put(copy); done(null);
        } catch (error) { failure = error; store.transaction.abort(); } };
      }).catch(error => { throw failure ?? error; });
    }
    return this.transaction('readwrite', (store, done) => { store.put(copy); done(null); });
  }

  // Trusted Core callback only. Invoke native dispatch synchronously in the
  // same readonly snapshot as the original operation/footprint. Box its Promise.
  withFootprint(supplied, dispatch, { applying = false } = {}) {
    const expected = structuredClone(supplied); let failure;
    return this.transaction('readonly', (store, done) => {
      const request = store.get([expected.owner_key, expected.session_id]);
      request.onsuccess = () => { try {
        const current = request.result;
        if (!current || ['owner_key', 'session_id', 'executor_id', 'command_id', 'snapshot', 'rules'].some(key => JSON.stringify(current[key]) !== JSON.stringify(expected[key]))
          || current.revision > expected.revision || current.action_seq > expected.action_seq
          || applying && JSON.stringify(current) !== JSON.stringify(expected)) throw new Error('JOURNAL_SCOPE_MISMATCH');
        done(dispatch());
      } catch (error) { failure = error; store.transaction.abort(); } };
    }).catch(error => { throw failure ?? error; });
  }
}
