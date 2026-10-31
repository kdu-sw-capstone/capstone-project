import { digest } from '../a1/contract.mjs';
import { inspectAdditionalDnr, validateDnrClaims } from './additional-dnr-inventory.js';

const KEY = 'amvp_journal_v1:site-time-dnr-evidence';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const CONTEXT = ['operation_id', 'owner_binding_id', 'executor_id', 'runtime_execution_id', 'package_id', 'runtime_revision', 'generation'];
const fail = code => { throw Error(code); };
const exact = (v, keys) => v && typeof v === 'object' && !Array.isArray(v)
  && Object.keys(v).length === keys.length && keys.every(k => Object.hasOwn(v, k));
const positive = n => Number.isSafeInteger(n) && n > 0;
const physical = c => `${c.rule_key.rule_store}:${c.rule_key.rule_id}`;
const reference = ({ restore_state, ...claim }) => claim;

function validateContext(context) {
  if (!exact(context, CONTEXT) || CONTEXT.slice(0, 5).some(k => !UUID.test(context[k]))
    || !positive(context.runtime_revision) || !positive(context.generation)) fail('INVALID_SITE_TIME_CONTEXT');
}
function validateIntent(intent) {
  if (!exact(intent, ['context', 'policy', 'claims'])) fail('INVALID_SITE_TIME_BINDING');
  validateContext(intent.context);
  // The trusted verifier below must validate the complete issued policy/package.
  if (intent.policy?.kind !== 'SITE_TIME' || !UUID.test(intent.policy.policy_id)
    || !positive(intent.policy.version) || !intent.claims?.length) fail('INVALID_SITE_TIME_BINDING');
  validateDnrClaims(intent.claims.map(c => ({ ...c, restore_state: 'RESERVED' })));
  if (intent.claims.some(c => Object.hasOwn(c, 'restore_state')
    || c.owner_binding_id !== intent.context.owner_binding_id || c.generation !== intent.context.generation)) fail('SITE_TIME_CLAIM_SCOPE_MISMATCH');
}

/** Internal Core evidence only. Does not compile/install rules, issue RuntimeReport,
 * grant policy authority, discharge cleanup or change the existing DNR journal.
 * verifyBinding must resolve the issued operation/package/current owner locally;
 * a caller's policy body, rule hash or browser message is not that proof.
 */
export class SiteTimeDnrEvidence {
  constructor({ coordinator, verifyBinding = () => false, capacity = 1024 }) {
    if (!coordinator?.store?.db || typeof coordinator.exclusive !== 'function' || typeof verifyBinding !== 'function'
      || !Number.isSafeInteger(capacity) || capacity < 1) fail('INVALID_SITE_TIME_EVIDENCE_SERVICE');
    Object.assign(this, { coordinator, verifyBinding, capacity });
  }
  async transaction(mode, reduce) {
    let reason;
    try {
      return await this.coordinator.store.db.transaction(mode, (tx, done) => {
        const metadata = tx.objectStore('metadata'), request = metadata.get(KEY);
        request.onsuccess = () => {
          try {
            const state = request.result ?? { key: KEY, version: 1, entries: [] };
            if (!exact(state, ['key', 'version', 'entries']) || state.key !== KEY || state.version !== 1
              || !Array.isArray(state.entries) || new Set(state.entries.map(e => e.intent?.context?.operation_id)).size !== state.entries.length) fail('INVALID_SITE_TIME_EVIDENCE_JOURNAL');
            const result = reduce(state);
            if (result?.then) fail('ASYNC_SITE_TIME_EVIDENCE_TRANSACTION');
            if (mode === 'readwrite') metadata.put(state);
            done(structuredClone(result));
          } catch (error) { reason = error; tx.abort(); }
        };
      });
    } catch (error) { throw reason ?? Error('SITE_TIME_EVIDENCE_STORAGE_UNCONFIRMED', { cause: error }); }
  }
  async checkedEntry(entry) {
    if (!exact(entry, ['intent', 'intent_sha256', 'registration', 'entry_sha256'])) fail('INVALID_SITE_TIME_EVIDENCE_JOURNAL');
    validateIntent(entry.intent);
    const { entry_sha256, ...payload } = entry;
    if (await digest(entry.intent) !== entry.intent_sha256 || await digest(payload) !== entry_sha256) fail('SITE_TIME_EVIDENCE_HASH_MISMATCH');
    return entry;
  }
  async authorize(intent) {
    if (await this.verifyBinding(structuredClone(intent)) !== true) fail('SITE_TIME_BINDING_UNVERIFIED');
  }
  /** Persist expected policy/operation/claim identities before or after an existing
   * writer acts. This reserves no DNR authority and never adopts an unmanaged rule.
   */
  register(supplied) {
    const copy = structuredClone(supplied);
    if (!exact(copy, ['context', 'policy', 'claims'])) fail('INVALID_SITE_TIME_BINDING');
    const { context, policy, claims } = copy;
    validateDnrClaims(claims);
    const intent = { context, policy, claims: claims.map(reference).sort((a, b) => a.claim_id.localeCompare(b.claim_id)) };
    validateIntent(intent);
    return this.coordinator.exclusive(async () => {
      await this.authorize(intent);
      const hash = await digest(intent), state = await this.transaction('readonly', s => s);
      const prior = state.entries.find(e => e.intent?.context?.operation_id === context.operation_id);
      if (prior) {
        await this.checkedEntry(prior);
        if (prior.intent_sha256 !== hash) fail('SITE_TIME_OPERATION_CONFLICT');
        return { duplicate: true, intent_sha256: hash };
      }
      if (state.entries.length >= this.capacity) fail('SITE_TIME_EVIDENCE_CAPACITY');
      const journal = await this.coordinator.store.read();
      if (intent.claims.some(c => c.writer_epoch !== journal.writer_epoch)) fail('STALE_DNR_WRITER');
      // Same policy/version can have multiple operations, but not different bodies.
      for (const row of state.entries) {
        await this.checkedEntry(row);
        if (row.intent.context.owner_binding_id === context.owner_binding_id
          && row.intent.policy.policy_id === policy.policy_id && row.intent.policy.version === policy.version
          && await digest(row.intent.policy) !== await digest(policy)) fail('SITE_TIME_POLICY_VERSION_CONFLICT');
      }
      const registration = await this.snapshot(intent);
      if (registration.journal_sha256 !== await digest(journal)) fail('SITE_TIME_EVIDENCE_STATE_CHANGED');
      const payload = { intent, intent_sha256: hash, registration };
      const entry = { ...payload, entry_sha256: await digest(payload) };
      return this.transaction('readwrite', current => {
        if (current.entries.length !== state.entries.length) fail('SITE_TIME_EVIDENCE_STATE_CHANGED');
        current.entries.push(entry);
        return { duplicate: false, intent_sha256: hash };
      });
    });
  }
  /** Read-only: exact immutable context required, with authority rechecked. */
  read(suppliedContext) {
    const context = structuredClone(suppliedContext); validateContext(context);
    return this.coordinator.exclusive(async () => {
      const state = await this.transaction('readonly', s => s);
      const entry = state.entries.find(e => e.intent?.context?.operation_id === context.operation_id);
      if (!entry) fail('SITE_TIME_EVIDENCE_NOT_FOUND');
      await this.checkedEntry(entry);
      if (await digest(entry.intent.context) !== await digest(context)) fail('SITE_TIME_CONTEXT_MISMATCH');
      await this.authorize(entry.intent);
      return {
        local_only: true, evidence_kind: 'SITE_TIME_DNR_OBSERVATION', runtime_report: false,
        context, policy_id: entry.intent.policy.policy_id, policy_version: entry.intent.policy.version,
        policy_sha256: await digest(entry.intent.policy), intent_sha256: entry.intent_sha256,
        registration: structuredClone(entry.registration), current: await this.snapshot(entry.intent),
      };
    });
  }
  async snapshot(intent) {
    const journal = await this.coordinator.store.read(), journalHash = await digest(journal);
    const observed = await inspectAdditionalDnr(this.coordinator.dnr, journal.claims);
    const complete = Object.values(observed.observations).every(s => s.status === 'OBSERVED');
    const releaseHash = await digest({ operation: 'RELEASE', owner_binding_id: intent.context.owner_binding_id, generation: intent.context.generation });
    const operations = journal.operations.filter(o => o.claim_ids.some(id => intent.claims.some(c => c.claim_id === id)))
      .map(o => ({
        operation_id: o.id, semantic_sha256: o.hash, state: o.state, claim_ids: [...o.claim_ids],
        scope_verified: o.hash === releaseHash && o.claim_ids.every(id => journal.claims.some(c => c.claim_id === id
          && c.owner_binding_id === intent.context.owner_binding_id && c.generation === intent.context.generation)),
      }));
    const claims = [];
    for (const expected of intent.claims) {
      const registered = journal.claims.find(c => c.claim_id === expected.claim_id);
      const identityMatches = !!registered && await digest(reference(registered)) === await digest(expected);
      const store = observed.observations[expected.rule_key.rule_store];
      const actual = store.rules.find(r => r.rule_key.rule_id === expected.rule_key.rule_id);
      const comparison = store.status !== 'OBSERVED' ? 'UNKNOWN' : !actual ? 'MISSING'
        : actual.rule_sha256 === expected.rule_sha256 ? 'MATCH' : 'MISMATCH';
      const peers = journal.claims.filter(c => c.claim_id !== expected.claim_id && c.restore_state !== 'RELEASED' && physical(c) === physical(expected));
      const pending = operations.some(o => o.state !== 'RELEASED' && o.claim_ids.includes(expected.claim_id));
      const receipt = operations.some(o => o.state === 'RELEASED' && o.scope_verified && o.claim_ids.includes(expected.claim_id));
      const shared = peers.length > 0 && peers.every(c => c.rule_sha256 === expected.rule_sha256);
      const released = complete && identityMatches && registered.restore_state === 'RELEASED' && receipt
        && (peers.length === 0 ? comparison === 'MISSING' : shared && comparison === 'MATCH');
      claims.push({
        ...structuredClone(expected), registered: !!registered, identity_matches: identityMatches,
        restore_state: registered?.restore_state ?? null, comparison,
        actual_rule_sha256: actual?.rule_sha256 ?? null, other_live_claim_ids: peers.map(c => c.claim_id),
        live_footprint_matches: complete && identityMatches && registered.restore_state === 'APPLIED' && !pending && comparison === 'MATCH'
          && peers.every(c => c.rule_sha256 === expected.rule_sha256),
        release_footprint_verified: released,
        cleanup_pending: !!registered && (!identityMatches || registered.restore_state !== 'RELEASED' || !released),
      });
    }
    if (await digest(await this.coordinator.store.read()) !== journalHash) fail('SITE_TIME_EVIDENCE_STATE_CHANGED');
    const result = {
      writer_epoch: journal.writer_epoch, journal_sha256: journalHash,
      // Hashes/keys only: never leak raw rule URLs or browser exception text.
      stores: Object.fromEntries(Object.entries(observed.observations).map(([name, s]) => [name, { status: s.status, error: s.error }])),
      claims, operations, unmanaged_rule_keys: observed.unmanaged_rule_keys,
    };
    return { ...result, snapshot_sha256: await digest(result) };
  }
}
