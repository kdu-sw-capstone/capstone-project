import { AdditionalDnrStore } from './additional-dnr-store.js';
import { createMemberDB } from '../member-a1/db.mjs';

const LOCK = 'focurve:amvp:dnr-writer';
const positiveId = n => Number.isSafeInteger(n) && n > 0 && n <= 2147483647;
const fail = code => { throw Error(code); };
// Reuse the existing installation-wide RootAuthority DB/metadata, not an owner DB.
export const LEGACY_DNR_REGISTRY_DB = 'focurve-member-a1-root-authority';

export class LegacyDnrWriter {
  constructor({ store, dnr, locks = globalThis.navigator?.locks }) { Object.assign(this, { store, dnr, locks }); }
  write(storeName, supplied, dispatchAtCurrentState) {
    const request = structuredClone(supplied);
    if (!['SESSION', 'DYNAMIC'].includes(storeName) || !request || Array.isArray(request)
      || Object.keys(request).some(k => !['addRules', 'removeRuleIds'].includes(k))
      || !Object.keys(request).length || typeof dispatchAtCurrentState !== 'function') fail('INVALID_LEGACY_DNR_WRITE');
    const adds = request.addRules ?? [], removes = request.removeRuleIds ?? [];
    if (!Array.isArray(adds) || !Array.isArray(removes) || adds.some(r => !positiveId(r?.id)) || removes.some(n => !positiveId(n))
      || new Set(adds.map(r => r.id)).size !== adds.length || new Set(removes).size !== removes.length) fail('INVALID_LEGACY_DNR_WRITE');
    if (typeof this.locks?.request !== 'function') fail('DNR_WRITER_LOCK_UNAVAILABLE');
    return this.locks.request(LOCK, { mode: 'exclusive' }, async () => {
      const journal = await this.store.read();
      const ids = new Set([...adds.map(r => r.id), ...removes]);
      // RESERVED/UNCONFIRMED/old-epoch claims still carry obligations. Same hash
      // does not grant a legacy actor permission to overwrite/remove a runtime claim.
      if (journal.claims.some(c => c.restore_state !== 'RELEASED' && c.rule_key.rule_store === storeName && ids.has(c.rule_key.rule_id))) fail('DNR_RUNTIME_CLAIM_PROTECTED');
      const method = storeName === 'SESSION' ? 'updateSessionRules' : 'updateDynamicRules';
      if (typeof this.dnr?.[method] !== 'function') fail('DNR_API_UNAVAILABLE');
      let dispatched = false;
      const send = () => {
        if (dispatched) fail('DNR_WRITE_ALREADY_DISPATCHED');
        dispatched = true;
        // Box an immediately handled Promise: IndexedDB must not wait for Chrome.
        return { outcome: Promise.resolve(this.dnr[method](request)).then(value => ({ ok: true, value }), error => ({ ok: false, error })) };
      };
      // The actor invokes send synchronously within its final local state check.
      // No authentication/storage await may be appended after that check.
      const box = await dispatchAtCurrentState(send);
      if (!dispatched || !box?.outcome) fail('DNR_WRITE_NOT_DISPATCHED');
      const outcome = await box.outcome;
      if (!outcome.ok) throw outcome.error;
      return outcome.value;
    });
  }
}

/** Shared physical gate for the current Member/Guest A1 actors. Older legacy
 * writers are NOT covered; this does not enable assertWritersGuarded.
 */
export function installMemberDnrWriter(chromeApi, indexedDB, locks, world = globalThis) {
  if (Object.hasOwn(world, 'FocurveMemberDnrWriter') || Object.hasOwn(world, 'FocurveDnrWriter')) fail('DNR_WRITER_ALREADY_INSTALLED');
  const store = new AdditionalDnrStore(createMemberDB(indexedDB, LEGACY_DNR_REGISTRY_DB));
  const writer = new LegacyDnrWriter({ store, dnr: chromeApi.declarativeNetRequest, locks });
  const service = Object.freeze({ store, registry_db: LEGACY_DNR_REGISTRY_DB,
    write: (request, dispatch) => writer.write('SESSION', request, dispatch) });
  Object.defineProperty(world, 'FocurveMemberDnrWriter', { value: service, configurable: false, writable: false });
  // Preserve the shipped Member name; both actors use the identical lock/store.
  Object.defineProperty(world, 'FocurveDnrWriter', { value: service, configurable: false, writable: false });
  return service;
}
