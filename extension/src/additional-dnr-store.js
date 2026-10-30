import { validateDnrClaims } from './additional-dnr-inventory.js';

const KEY = 'amvp_journal_v1:dnr';
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const fresh = () => ({ key: KEY, version: 1, writer_epoch: 0, claims: [], operations: [], closed: [] });
function validate(state) {
  if (!state || state.key !== KEY || state.version !== 1
    || !Number.isSafeInteger(state.writer_epoch) || state.writer_epoch < 0
    || !Array.isArray(state.operations) || !Array.isArray(state.closed)) throw new Error('INVALID_DNR_JOURNAL');
  validateDnrClaims(state.claims);
  const ids = new Set();
  for (const op of state.operations) {
    if (!op || !uuid.test(op.id) || ids.has(op.id)
      || !['PREPARED', 'IN_DOUBT', 'RELEASED'].includes(op.state)
      || !Array.isArray(op.claim_ids) || !op.claim_ids.length
      || new Set(op.claim_ids).size !== op.claim_ids.length
      || op.claim_ids.some(id => !state.claims.some(c => c.claim_id === id
        && c.restore_state === (op.state === 'RELEASED' ? 'RELEASED' : 'RELEASE_PENDING')))
      || !/^[a-f0-9]{64}$/.test(op.hash)) throw new Error('INVALID_DNR_JOURNAL');
    ids.add(op.id);
  }
  if (state.closed.some(c => !c || !uuid.test(c.owner_binding_id)
    || !Number.isSafeInteger(c.generation) || c.generation < 1)) throw new Error('INVALID_DNR_JOURNAL');
}

/** Existing execution DB transaction interface; no legacy Journal1.1 rewrite or
 * new DB version. The synchronous reducer must never await Chrome/network work.
 */
export class AdditionalDnrStore {
  constructor(executionDB) { this.db = executionDB; }
  async transact(mode, reducer) {
    let reason;
    try {
      return await this.db.transaction(mode, (tx, done) => {
        const metadata = tx.objectStore('metadata');
        const request = metadata.get(KEY);
        request.onsuccess = () => {
          try {
            const state = request.result ?? fresh();
            validate(state);
            const result = reducer(state);
            if (result?.then) throw new Error('ASYNC_DNR_TRANSACTION');
            validate(state);
            if (mode === 'readwrite') metadata.put(state);
            done(structuredClone(result));
          } catch (error) { reason = error; tx.abort(); }
        };
      });
    } catch (error) { throw reason ?? new Error('DNR_STORAGE_UNCONFIRMED', { cause: error }); }
  }
  read() { return this.transact('readonly', state => state); }
  mutate(reducer) { return this.transact('readwrite', reducer); }
}
