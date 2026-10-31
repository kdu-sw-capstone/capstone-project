import { digest } from '../a1/contract.mjs';
import contract from '../../contracts/additional-mvp/rc1/schema.json' with { type: 'json' };

const stores = ['SESSION', 'DYNAMIC'];
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const hash = /^[a-f0-9]{64}$/;
const positive = value => Number.isSafeInteger(value) && value > 0;
const keyOf = key => `${key.rule_store}:${key.rule_id}`;
const exactKeys = (value, keys) => value && typeof value === 'object' && !Array.isArray(value)
  && Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));

// These are durable, trusted registry claims, never claims supplied by a web page.
export function validateDnrClaims(claims) {
  if (!Array.isArray(claims)) throw new Error('INVALID_DNR_CLAIMS');
  const seen = new Set();
  for (const claim of claims) {
    if (!exactKeys(claim, contract.$defs.DnrClaim.required)
      || !uuid.test(claim.claim_id) || !uuid.test(claim.owner_binding_id)
      || !positive(claim.generation) || !positive(claim.writer_epoch)
      || !hash.test(claim.rule_sha256)
      || !contract.$defs.DnrClaim.properties.restore_state.enum.includes(claim.restore_state)
      || !exactKeys(claim.rule_key, contract.$defs.DnrRuleKey.required)
      || !stores.includes(claim.rule_key.rule_store)
      || !positive(claim.rule_key.rule_id) || claim.rule_key.rule_id > 2147483647
      || seen.has(claim.claim_id)) throw new Error('INVALID_DNR_CLAIMS');
    seen.add(claim.claim_id);
  }
}

async function readStore(dnr, store) {
  try {
    const method = store === 'SESSION' ? 'getSessionRules' : 'getDynamicRules';
    if (typeof dnr?.[method] !== 'function') return { status: 'UNKNOWN', error: 'DNR_API_UNAVAILABLE', rules: [] };
    const rules = structuredClone(await dnr[method]());
    if (!Array.isArray(rules)) throw new Error('INVALID_RULES');
    const ids = new Set();
    for (const rule of rules) {
      if (!rule || !positive(rule.id) || rule.id > 2147483647 || ids.has(rule.id)
        || !rule.action || !rule.condition) throw new Error('INVALID_RULES');
      ids.add(rule.id);
    }
    return {
      status: 'OBSERVED', error: null,
      rules: await Promise.all(rules.map(async rule => ({
        rule_key: { rule_store: store, rule_id: rule.id }, rule_sha256: await digest(rule), rule,
      }))),
    };
  } catch {
    // Do not leak rule URLs or browser error messages to diagnostic consumers.
    return { status: 'UNKNOWN', error: 'DNR_READ_UNCONFIRMED', rules: [] };
  }
}

/** Read-only comparison. Two Chrome stores are NOT an atomic snapshot. No result
 * authorizes removal, adoption, a RELEASED receipt or session completion. A writer
 * must revalidate under the shared fence/lock immediately before any mutation.
 */
export async function inspectAdditionalDnr(dnr, registryClaims) {
  validateDnrClaims(registryClaims);
  const claims = structuredClone(registryClaims);
  const [session, dynamic] = await Promise.all(stores.map(store => readStore(dnr, store)));
  const observations = { SESSION: session, DYNAMIC: dynamic };
  const active = claims.filter(claim => claim.restore_state !== 'RELEASED');
  const groups = new Map();
  for (const claim of active) {
    const key = keyOf(claim.rule_key);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(claim);
  }
  const comparisons = active.map(claim => {
    const group = groups.get(keyOf(claim.rule_key));
    const store = observations[claim.rule_key.rule_store];
    const actual = store.rules.find(row => row.rule_key.rule_id === claim.rule_key.rule_id);
    const conflict = new Set(group.map(row => row.rule_sha256)).size !== 1;
    const comparison = conflict ? 'CLAIM_CONFLICT' : store.status !== 'OBSERVED' ? 'UNKNOWN'
      : !actual ? 'MISSING' : actual.rule_sha256 !== claim.rule_sha256 ? 'MISMATCH' : 'MATCH';
    return {
      claim_id: claim.claim_id, owner_binding_id: claim.owner_binding_id,
      generation: claim.generation, writer_epoch: claim.writer_epoch,
      restore_state: claim.restore_state, rule_key: claim.rule_key, comparison,
      actual_rule_sha256: actual?.rule_sha256 ?? null,
      other_owner_claim_ids: group.filter(row => row.owner_binding_id !== claim.owner_binding_id
        || row.generation !== claim.generation).map(row => row.claim_id),
    };
  });
  return {
    observations, comparisons,
    unmanaged_rule_keys: stores.flatMap(store => observations[store].rules)
      .filter(row => !groups.has(keyOf(row.rule_key))).map(row => row.rule_key),
  };
}
