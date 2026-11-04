/** Pure Core scheduling helpers, not actor commands or start authority.
 * Server member occurrence identity/session creation stays in its existing actor.
 * Caller must persist duplicate prevention, revalidate owner/config/clock and use
 * D06 actual effect verification before declaring a session running.
 */
const invalid = () => { throw Error('INVALID_SCHEDULE_INPUT'); };
const instant = value => {
  if (typeof value !== 'string' || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(value)) invalid();
  const n = Date.parse(value);
  if (!Number.isSafeInteger(n) || new Date(n).toISOString() !== value) invalid();
  return n;
};
const parts = (formatter, at) => Object.fromEntries(formatter.formatToParts(at)
  .filter(p => ['year','month','day','hour','minute','second'].includes(p.type)).map(p => [p.type, Number(p.value)]));
const wall = p => {
  const d = new Date(0); d.setUTCFullYear(p.year, p.month - 1, p.day);
  d.setUTCHours(p.hour, p.minute, p.second, 0); return d.getTime();
};
export function weeklyStart({ localDate, startLocal, timezone, weekdays }) {
  if (typeof localDate !== 'string' || !/^\d{4}-\d\d-\d\d$/.test(localDate)
    || typeof startLocal !== 'string' || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(startLocal)
    || typeof timezone !== 'string' || !timezone || timezone.length > 80
    || !Array.isArray(weekdays) || !weekdays.length || weekdays.length > 7
    || new Set(weekdays).size !== weekdays.length || weekdays.some(d => !Number.isInteger(d) || d < 1 || d > 7)) invalid();
  const nominal = instant(`${localDate}T${startLocal}:00.000Z`);
  const weekday = new Date(nominal).getUTCDay() || 7;
  // Construct before weekday decision, so an invalid zone never silently passes.
  let formatter;
  try { formatter = new Intl.DateTimeFormat('en-GB-u-ca-iso8601-nu-latn', {
    timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23'
  }); } catch { invalid(); }
  if (!weekdays.includes(weekday)) return { status: 'NOT_SCHEDULED', startAt: null };
  const candidates = new Set();
  // Enumerate nearby local offsets, not an assumed +/-1h DST correction. This
  // handles non-hour folds/gaps and historical second offsets via format parts.
  for (let delta = -26 * 60; delta <= 26 * 60; delta++) {
    const probe = nominal + delta * 60000;
    const offset = wall(parts(formatter, probe)) - probe;
    candidates.add(nominal - offset);
  }
  const matches = [...candidates].filter(at => wall(parts(formatter, at)) === nominal).sort((a,b) => a-b);
  return matches.length ? { status: 'SCHEDULED', startAt: new Date(matches[0]).toISOString() }
    : { status: 'SKIPPED', reason: 'DST_GAP', startAt: null };
}

/** The supplied start must already be an authenticated/resolved occurrence.
 * This result cannot replace durable claim/idempotency or trusted time evidence.
 */
export function evaluateOccurrence({ startAt, durationMinutes, nowAt, activeSession, alreadyIssued, recovered }) {
  const start = instant(startAt), now = instant(nowAt);
  if (!Number.isInteger(durationMinutes) || durationMinutes < 1 || durationMinutes > 180
    || [activeSession, alreadyIssued, recovered].some(v => typeof v !== 'boolean')) invalid();
  const end = start + durationMinutes * 60000;
  if (!Number.isSafeInteger(end) || !Number.isFinite(new Date(end).getTime())) invalid();
  const fixedEndAt = new Date(end).toISOString();
  if (alreadyIssued) return { decision: 'ALREADY_ISSUED', fixedEndAt };
  if (now < start) return { decision: 'NOT_DUE', fixedEndAt };
  if (end - now < 60000) return { decision: 'SKIPPED', reason: 'EXPIRED', fixedEndAt };
  if (activeSession) return { decision: 'WAITING_CONFLICT', fixedEndAt };
  // Browser restart is not permission to catch up a missed focus occurrence.
  if (recovered) return { decision: 'WAIT_USER', fixedEndAt };
  return { decision: 'READY', fixedEndAt };
}
