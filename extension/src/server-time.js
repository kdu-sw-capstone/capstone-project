// Server Instant wire: UTC, up to nanosecond precision. Browser timers use ms.
// Truncate sub-ms digits conservatively; never round an APPLY deadline later.
export function parseServerTime(value) {
  if (typeof value !== 'string') return NaN;
  const match = /^(\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d)(?:\.(\d{1,9}))?Z$/.exec(value);
  if (!match) return NaN;
  const normalized = match[1] + '.' + (match[2] || '').padEnd(3, '0').slice(0, 3) + 'Z';
  const ms = Date.parse(normalized);
  return Number.isFinite(ms) && new Date(ms).toISOString() === normalized ? ms : NaN;
}
