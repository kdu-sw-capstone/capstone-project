import { digest } from '../a1/contract.mjs';
import { inspectAdditionalDnr, validateDnrClaims } from './additional-dnr-inventory.js';

const LOCK = 'focurve:amvp:dnr-writer';
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const key = c => `${c.rule_key.rule_store}:${c.rule_key.rule_id}`;
const active = state => state.claims.filter(c => c.restore_state !== 'RELEASED');
const sameOwner = (c, owner, generation) => c.owner_binding_id === owner && c.generation === generation;
const fail = code => { throw new Error(code); };
const fence = (state, epoch) => { if (state.writer_epoch !== epoch) fail('STALE_DNR_WRITER'); };
function pendingKeys(state, except) {
  return new Set(state.operations.filter(op => op.state !== 'RELEASED' && op.id !== except)
    .flatMap(op => op.claim_ids.map(id => key(state.claims.find(c => c.claim_id === id)))));
}

/** Internal Worker service, not an RPC endpoint. All legacy writers must first
 * use this SAME lock and honor pending claims. Production activation is denied
 * until the integration adapter proves that coverage. No in-memory lock fallback.
 */
export class AdditionalDnrCoordinator {
  constructor({ store, dnr, locks = globalThis.navigator?.locks,
    assertWritersGuarded = () => fail('LEGACY_WRITER_NOT_FENCED'),
    verifyAdoption = () => false, cleanupCapacity = 1024 }) {
    if (!Number.isSafeInteger(cleanupCapacity) || cleanupCapacity < 0) fail('INVALID_CLEANUP_CAPACITY');
    Object.assign(this, { store, dnr, locks, assertWritersGuarded, verifyAdoption, cleanupCapacity });
  }
  async exclusive(work) {
    if (typeof this.locks?.request !== 'function') fail('DNR_WRITER_LOCK_UNAVAILABLE');
    return this.locks.request(LOCK, { mode: 'exclusive' }, async () => {
      if (await this.assertWritersGuarded() !== true) fail('LEGACY_WRITER_NOT_FENCED');
      return work();
    });
  }
  startWriter() {
    return this.exclusive(() => this.store.mutate(state => {
      if (state.writer_epoch === Number.MAX_SAFE_INTEGER) fail('DNR_WRITER_EPOCH_LIMIT');
      return ++state.writer_epoch;
    }));
  }
  async adopt(epoch, suppliedClaim, suppliedRule) {
    validateDnrClaims([suppliedClaim]);
    const claim = structuredClone(suppliedClaim), rule = structuredClone(suppliedRule);
    return this.exclusive(async () => {
      const state = await this.store.read(); fence(state, epoch);
      if (claim.writer_epoch !== epoch || claim.restore_state !== 'APPLIED'
        || rule.id !== claim.rule_key.rule_id || await digest(rule) !== claim.rule_sha256) fail('DNR_ADOPTION_MISMATCH');
      if (await this.verifyAdoption(claim, rule) !== true) fail('DNR_OWNERSHIP_UNVERIFIED');
      if (state.closed.some(c => sameOwner(c, claim.owner_binding_id, claim.generation))) fail('DNR_OWNER_CLOSED');
      const previous = state.claims.find(c => c.claim_id === claim.claim_id);
      if (previous) {
        if (await digest(previous) !== await digest(claim)) fail('DNR_CLAIM_CONFLICT');
        return 'DUPLICATE';
      }
      if (pendingKeys(state).has(key(claim))) fail('DNR_RELEASE_PENDING');
      const claims = [...active(state), claim];
      const observed = await inspectAdditionalDnr(this.dnr, claims);
      if (observed.comparisons.find(c => c.claim_id === claim.claim_id)?.comparison !== 'MATCH') fail('DNR_FOOTPRINT_UNCONFIRMED');
      return this.store.mutate(current => {
        fence(current, epoch);
        if (active(current).length >= this.cleanupCapacity) fail('CLEANUP_RESERVATION_EXHAUSTED');
        // Claim admission itself reserves one unresolved cleanup obligation.
        current.claims.push(claim);
        return 'ADOPTED';
      });
    });
  }
  async releaseOwner(epoch, { operationId, ownerBindingId, generation }) {
    if (!uuid.test(operationId) || !uuid.test(ownerBindingId)
      || !Number.isSafeInteger(generation) || generation < 1) fail('INVALID_DNR_RELEASE');
    const hash = await digest({ operation: 'RELEASE', owner_binding_id: ownerBindingId, generation });
    return this.exclusive(async () => {
      let state = await this.store.read(); fence(state, epoch);
      let op = state.operations.find(o => o.id === operationId);
      if (op && op.hash !== hash) fail('IDEMPOTENCY_CONFLICT');
      if (op?.state === 'RELEASED') return 'DUPLICATE';
      if (!op) {
        const claims = active(state).filter(c => sameOwner(c, ownerBindingId, generation));
        if (!claims.length) fail('UNOWNED_RELEASE');
        const pending = pendingKeys(state);
        if (claims.some(c => pending.has(key(c)))) fail('DNR_RELEASE_PENDING');
        // Freeze the exact claim set BEFORE invoking either Chrome mutation.
        await this.store.mutate(current => {
          fence(current, epoch);
          const ids = claims.map(c => c.claim_id);
          current.operations.push({ id: operationId, hash, state: 'PREPARED', claim_ids: ids });
          current.closed.push({ owner_binding_id: ownerBindingId, generation });
          for (const c of current.claims) if (ids.includes(c.claim_id)) c.restore_state = 'RELEASE_PENDING';
        });
        state = await this.store.read(); op = state.operations.find(o => o.id === operationId);
      }
      const selected = active(state).filter(c => op.claim_ids.includes(c.claim_id));
      if (selected.length !== op.claim_ids.length || selected.some(c => !sameOwner(c, ownerBindingId, generation))) fail('INVALID_DNR_RELEASE_INTENT');
      try {
        const before = await inspectAdditionalDnr(this.dnr, active(state));
        this.checkObservation(before, selected, false);
        for (const store of ['SESSION', 'DYNAMIC']) {
          const removeRuleIds = [...new Set(selected.filter(c => c.rule_key.rule_store === store)
            .filter(c => {
              const row = before.comparisons.find(r => r.claim_id === c.claim_id);
              return row.comparison === 'MATCH' && row.other_owner_claim_ids.length === 0;
            }).map(c => c.rule_key.rule_id))];
          if (removeRuleIds.length) {
            fence(await this.store.read(), epoch);
            const method = store === 'SESSION' ? 'updateSessionRules' : 'updateDynamicRules';
            if (typeof this.dnr?.[method] !== 'function') fail('DNR_API_UNAVAILABLE');
            await this.dnr[method]({ removeRuleIds });
          }
        }
        const after = await inspectAdditionalDnr(this.dnr, active(state));
        this.checkObservation(after, selected, true);
        return await this.store.mutate(current => {
          fence(current, epoch);
          const intent = current.operations.find(o => o.id === operationId);
          if (!intent || intent.hash !== hash || intent.state === 'RELEASED') fail('INVALID_DNR_RELEASE_INTENT');
          for (const c of current.claims) if (intent.claim_ids.includes(c.claim_id)) c.restore_state = 'RELEASED';
          intent.state = 'RELEASED'; // Claim discharge + receipt commit is atomic.
          return 'RELEASED';
        });
      } catch (error) {
        // Even if this diagnostic update fails, the committed PREPARED intent
        // remains the recovery obligation. Never erase intent or recycle identity.
        try {
          await this.store.mutate(current => {
            fence(current, epoch);
            const intent = current.operations.find(o => o.id === operationId);
            if (intent && intent.state !== 'RELEASED') intent.state = 'IN_DOUBT';
          });
        } catch { /* preserve the original failure; durable intent already exists */ }
        throw error;
      }
    });
  }
  checkObservation(observed, selected, after) {
    if (Object.values(observed.observations).some(store => store.status !== 'OBSERVED')) fail('DNR_READ_UNCONFIRMED');
    for (const claim of selected) {
      const row = observed.comparisons.find(c => c.claim_id === claim.claim_id);
      if (!row || ['MISMATCH', 'CLAIM_CONFLICT', 'UNKNOWN'].includes(row.comparison)) fail('DNR_FOOTPRINT_UNCONFIRMED');
      if (row.other_owner_claim_ids.length && row.comparison !== 'MATCH') fail('SHARED_DNR_UNCONFIRMED');
      if (after && !row.other_owner_claim_ids.length && row.comparison !== 'MISSING') fail('DNR_RELEASE_UNCONFIRMED');
    }
  }
}
