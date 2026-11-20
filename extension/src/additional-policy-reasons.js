const runtime = new Set(['DAILY_LIMIT', 'BLOCK_WINDOW', 'OUTSIDE_ALLOW_WINDOW',
  'ADULT_DOMAIN', 'KEYWORD', 'MEASUREMENT_UNCONFIRMED']);
const fail = () => { throw Error('INVALID_POLICY_REASONS_INPUT'); };
const exact = (v, keys) => v && typeof v === 'object' && !Array.isArray(v)
  && Object.keys(v).length === keys.length && keys.every(k => Object.hasOwn(v, k));

/** Pure C06 composition for ONE already verified current host/scope.
 * focusAccess comes from the existing frozen, most-specific host selection.
 * runtimeReasons must include ALL matching constraints, including local budget
 * hold when required. An unavailable provider must not be represented as [].
 * Exceptions are separately verified matches for their own feature only.
 * Caller verifies authority, source/profile, completeness and freshness.
 * No host selection, purpose remapping, DNR/DOM effect, release or Receipt here.
 */
export function composePolicyReasons(input) {
  if (!exact(input, ['focusAccess', 'runtimeReasons', 'exceptions'])) fail();
  const {focusAccess, runtimeReasons, exceptions} = input;
  if (!['ALLOW', 'BLOCK', 'RECORD'].includes(focusAccess) || !Array.isArray(runtimeReasons)
    || !exact(exceptions, ['adultDomain', 'keyword'])
    || typeof exceptions.adultDomain !== 'boolean' || typeof exceptions.keyword !== 'boolean') fail();
  const reasons = new Set();
  for (const reason of runtimeReasons) {
    if (!runtime.has(reason)) fail();
    if (reason === 'ADULT_DOMAIN' && exceptions.adultDomain || reason === 'KEYWORD' && exceptions.keyword) continue;
    reasons.add(reason);
  }
  if (focusAccess === 'BLOCK') reasons.add('USER_SITE');
  return Object.freeze({
    localOnly: true,
    // This is a plan candidate, never permission to apply/restore or an ACK.
    candidateAccess: reasons.size ? 'BLOCK' : focusAccess,
    requiresRestriction: reasons.size > 0,
    // MEASUREMENT_UNCONFIRMED is an internal C05 hold, not a new Wire enum.
    localReasons: Object.freeze([...reasons].sort()),
  });
}
