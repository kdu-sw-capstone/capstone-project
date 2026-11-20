const fail = () => { throw Error('INVALID_CONSERVATIVE_BUDGET_INPUT'); };
const nonnegative = n => Number.isSafeInteger(n) && n >= 0;

/** Pure, local C05 arithmetic for ONE already verified installation/policy/day.
 * debitMs includes existing confirmed/carry/enforced debit exactly once.
 * provisionalMs is the deduplicated unresolved, verified-length/day reservation
 * total, excluding amounts already in debitMs. Neither is a Server-only balance.
 * hasUnconfirmedGap covers ANY unresolved length/day/continuity uncertainty.
 * Caller owns authority/freshness, raw preservation, atomic ledger updates and
 * proof-based resolution. Passing false does not verify or resolve a gap.
 * This does not generate DailyUsage/Receipt, ALLOW, confirmed usage or DNR ACK.
 */
export function calculateConservativeBudget(input) {
  const fields = ['limitMs', 'debitMs', 'provisionalMs', 'hasUnconfirmedGap'];
  if (!input || typeof input !== 'object' || Array.isArray(input)
    || Object.keys(input).length !== fields.length || fields.some(k => !Object.hasOwn(input, k))) fail();
  const {limitMs, debitMs, provisionalMs, hasUnconfirmedGap} = input;
  // Bounds come from the frozen SiteTimePolicy.daily_limit_ms schema; the UI's
  // minute step does not license rounding an otherwise valid integer limit.
  if (limitMs !== null && (!Number.isSafeInteger(limitMs) || limitMs < 60000 || limitMs > 86400000)
    || !nonnegative(debitMs) || !nonnegative(provisionalMs) || typeof hasUnconfirmedGap !== 'boolean') fail();
  const limited = limitMs !== null;
  // Each stored amount is safe, but their sum need not fit a JS safe integer.
  const used = BigInt(debitMs) + BigInt(provisionalMs);
  const exhausted = limited && used >= BigInt(limitMs);
  const hold = limited && hasUnconfirmedGap;
  const remaining = limited ? Number(used >= BigInt(limitMs) ? 0n : BigInt(limitMs) - used) : null;
  const reasons = Object.freeze([
    ...(exhausted ? ['DAILY_LIMIT'] : []),
    ...(hold ? ['MEASUREMENT_UNCONFIRMED'] : []),
  ]);
  return Object.freeze({
    localOnly: true,
    // Arithmetic result only. Unknown time is never reported as normal usage0.
    knownRemainingMs: hasUnconfirmedGap ? null : remaining,
    enforcementRemainingMs: hold ? 0 : remaining,
    measurementUnconfirmed: hasUnconfirmedGap,
    requiresLimitedSiteHold: hold,
    limitExhausted: exhausted,
    requiresBudgetRestriction: exhausted || hold,
    localReasons: reasons,
  });
}
