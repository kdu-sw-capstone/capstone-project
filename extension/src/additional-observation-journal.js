import { digest } from '../a1/contract.mjs';

const KEY = 'amvp_journal_v1:time-observations';
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const hash = /^[a-f0-9]{64}$/;
const fail = code => { throw Error(code); };
const fresh = () => ({ key: KEY, version: 1, epoch: 0, context: null, cursor: null, captures: [], obligations: [] });
function validate(s) {
  if (s?.key !== KEY || s.version !== 1 || !Number.isSafeInteger(s.epoch) || s.epoch < 0
    || !Array.isArray(s.captures) || !Array.isArray(s.obligations)) fail('INVALID_OBSERVATION_JOURNAL');
  let previous = null;
  const ids = new Set();
  for (const [i, row] of s.captures.entries()) {
    if (!uuid.test(row.id) || ids.has(row.id) || row.seq !== i + 1
      || row.previous !== previous || !hash.test(row.hash)) fail('INVALID_OBSERVATION_CHAIN');
    ids.add(row.id); previous = row.hash;
  }
  const last = s.captures.at(-1);
  if (last ? s.cursor?.seq !== last.seq || s.cursor?.hash !== last.hash : s.cursor !== null) fail('INVALID_OBSERVATION_CURSOR');
}
/** Local observation staging, NOT ClockedUsageSegment or a Server outbox.
 * No duration/confirmed debit is manufactured before privileged calibration.
 * Capacity exhaustion fails closed; pending captures are never evicted.
 */
export class AdditionalObservationJournal {
  constructor(db, { capacity = 4096 } = {}) {
    if (!Number.isSafeInteger(capacity) || capacity < 1) fail('INVALID_CAPACITY');
    this.db = db;
    this.capacity = capacity;
  }
  async transact(mode, reducer) {
    let cause;
    try {
      return await this.db.transaction(mode, (tx, done) => {
        const store = tx.objectStore('metadata');
        const request = store.get(KEY);
        request.onsuccess = () => {
          try {
            const state = request.result ?? fresh(); validate(state);
            const result = reducer(state);
            if (result?.then) fail('ASYNC_TRANSACTION');
            validate(state);
            if (mode === 'readwrite') store.put(state);
            done(structuredClone(result));
          } catch (error) { cause = error; tx.abort(); }
        };
      });
    } catch (error) { throw cause ?? new Error('OBSERVATION_STORAGE_UNCONFIRMED', { cause: error }); }
  }
  async recover() {
    const state = await this.transact('readonly', s => s);
    // Hash outside the IDB transaction; recovery never changes authority or data.
    for (const row of state.captures) {
      const { hash: expected, ...payload } = row;
      if (await digest(payload) !== expected) fail('OBSERVATION_HASH_MISMATCH');
    }
    return state;
  }
  async start(context) {
    const captured = structuredClone(context);
    if (!captured || Object.keys(captured).sort().join(',') !== 'bootId,executorId,ownerBindingId'
      || Object.values(captured).some(value => typeof value !== 'string' || !uuid.test(value))) fail('INVALID_CAPTURE_CONTEXT');
    await this.recover();
    return this.transact('readwrite', s => {
      if (s.epoch === Number.MAX_SAFE_INTEGER) fail('EPOCH_EXHAUSTED');
      if (s.obligations.length >= this.capacity) fail('OBSERVATION_CAPACITY_EXHAUSTED');
      const epoch = ++s.epoch;
      s.context = captured;
      // Each start requires verified recovery; no assumption that a closed browser used zero time.
      s.obligations.push({ epoch, context: captured, reason: 'RESTART_UNCONFIRMED' });
      return epoch;
    });
  }
  async append(epoch, id, boundary) {
    if (!Number.isSafeInteger(epoch) || epoch < 1) fail('INVALID_COLLECTOR_EPOCH');
    if (!uuid.test(id)) fail('INVALID_CAPTURE_ID');
    const b = structuredClone(boundary);
    if (!b || !Number.isSafeInteger(b.revision) || b.revision < 0
      || !Number.isFinite(b.observedMonoMs) || b.observedMonoMs < 0
      || !['UNKNOWN','INELIGIBLE','CANDIDATE'].includes(b.status)
      || typeof b.reason !== 'string' || b.reason.length > 80
      || b.collectionEligible !== (b.status === 'CANDIDATE')
      || b.requiresLimitedSiteHold !== (b.status === 'UNKNOWN')
      || b.priorTailRequiresValidation !== true
      || Object.keys(b).sort().join(',') !== 'collectionEligible,observedMonoMs,priorTailRequiresValidation,reason,requiresLimitedSiteHold,revision,status,target') fail('INVALID_BOUNDARY');
    if (b.status === 'CANDIDATE') {
      if (!b.target || Object.keys(b.target).sort().join(',') !== 'host,tabId,windowId'
        || !Number.isSafeInteger(b.target.tabId) || b.target.tabId < 0
        || !Number.isSafeInteger(b.target.windowId) || b.target.windowId < 0
        || typeof b.target.host !== 'string' || !b.target.host || b.target.host.length > 253
        || /[\s/?#@]/.test(b.target.host)) fail('INVALID_TARGET');
    } else if (b.target !== null) fail('INVALID_TARGET');
    const snapshot = await this.recover();
    if (snapshot.epoch !== epoch) fail('STALE_COLLECTOR');
    const existing = snapshot.captures.find(row => row.id === id);
    if (existing) {
      if (existing.epoch !== epoch || await digest(existing.boundary) !== await digest(b)) fail('CAPTURE_ID_CONFLICT');
      // Recheck fencing even on duplicate return.
      return this.transact('readonly', s => { if (s.epoch !== epoch) fail('STALE_COLLECTOR'); return existing; });
    }
    const payload = { id, epoch, context: snapshot.context, seq: (snapshot.cursor?.seq ?? 0) + 1,
      previous: snapshot.cursor?.hash ?? null, boundary: b };
    const row = { ...payload, hash: await digest(payload) };
    return this.transact('readwrite', s => {
      if (s.epoch !== epoch) fail('STALE_COLLECTOR');
      if (s.cursor?.hash !== snapshot.cursor?.hash) fail('CURSOR_CONFLICT');
      if (s.captures.length >= this.capacity) fail('OBSERVATION_CAPACITY_EXHAUSTED');
      const last = s.captures.at(-1);
      if (last?.epoch === epoch && (b.observedMonoMs < last.boundary.observedMonoMs
        || b.revision < last.boundary.revision)) fail('OBSERVATION_ORDER_INVALID');
      s.captures.push(row);
      s.cursor = { seq: row.seq, hash: row.hash };
      return row;
    });
  }
}
