import { parseServerTime } from './server-time.js';

const uuid = value => typeof value === 'string' && /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value);
const revision = value => Number.isSafeInteger(value) && value > 0;
const time = value => Number.isFinite(parseServerTime(value));
const owner = value => typeof value === 'string' && /^MEMBER:[1-9][0-9]*$/.test(value);
const fields = (value, allowed) => value && typeof value === 'object' && !Array.isArray(value)
  && Object.keys(value).every(key => allowed.includes(key));

// Internal caller only: execution observations must originate in trusted Core.
// This validates the existing wire, not whether Chrome actually applied a policy.
export function validateExecutionReport(report) {
  if (!fields(report, ['report_id', 'command_id', 'session_id', 'executor_id', 'desired_revision',
    'result', 'observed_at', 'intervals', 'error_code', 'rollback_confirmed', 'local_action_seq'])
    || !['report_id', 'command_id', 'session_id', 'executor_id'].every(key => uuid(report[key]))
    || !revision(report.desired_revision) || !time(report.observed_at)
    || !['APPLIED', 'RELEASED', 'FAILED', 'UNCONFIRMED'].includes(report.result)
    || !Array.isArray(report.intervals) || report.intervals.length > 1
    || report.error_code != null && (typeof report.error_code !== 'string' || !/^[A-Z][A-Z0-9_]{0,79}$/.test(report.error_code))
    || report.rollback_confirmed != null && typeof report.rollback_confirmed !== 'boolean'
    || report.local_action_seq != null && !revision(report.local_action_seq)) throw new Error('INVALID_EXECUTION_REPORT');
  for (const interval of report.intervals) {
    const start = parseServerTime(interval?.start_at), end = parseServerTime(interval?.end_at);
    if (!fields(interval, ['interval_id', 'kind', 'start_at', 'end_at', 'duration_ms', 'quality'])
      || !uuid(interval.interval_id) || interval.kind !== 'RUN'
      || !['CONFIRMED', 'UNCONFIRMED'].includes(interval.quality) || !Number.isFinite(start)
      || start > parseServerTime(report.observed_at)
      || interval.end_at != null && (!Number.isFinite(end) || end < start || end > parseServerTime(report.observed_at))
      || interval.duration_ms != null && (!Number.isSafeInteger(interval.duration_ms)
        || interval.duration_ms < 0 || !Number.isFinite(end) || interval.duration_ms !== end - start))
      throw new Error('INVALID_EXECUTION_REPORT');
  }
  if (report.result === 'APPLIED' && (report.intervals.length !== 1 || report.intervals[0].end_at != null)
    || report.result === 'RELEASED' && report.intervals.some(interval => interval.end_at == null))
    throw new Error('INVALID_EXECUTION_REPORT');
  return report;
}

// Separate from guest data, execution journal and access events. Persist raw body
// BEFORE sending; never store Authorization, proof or refresh tokens here.
export class MemberReportStore {
  constructor({ indexedDB = globalThis.indexedDB, name = 'focurve-member-reports' } = {}) {
    Object.assign(this, { indexedDB, name });
  }
  async transaction(work) {
    const db = await new Promise((resolve, reject) => {
      const request = this.indexedDB.open(this.name, 1); let abandoned = false;
      request.onupgradeneeded = () => request.result.createObjectStore('reports',
        { keyPath: ['owner_key', 'executor_id', 'report_id'] });
      request.onsuccess = () => { if (abandoned) { request.result.close(); return; } resolve(request.result); };
      request.onerror = () => reject(new Error('REPORT_STORAGE_UNAVAILABLE'));
      request.onblocked = () => { abandoned = true; reject(new Error('REPORT_STORAGE_UNAVAILABLE')); };
    });
    try {
      return await new Promise((resolve, reject) => {
        const tx = db.transaction('reports', 'readwrite'); let value, failure;
        tx.oncomplete = () => resolve(value);
        tx.onabort = () => reject(failure || new Error('REPORT_STORAGE_UNAVAILABLE'));
        try { work(tx.objectStore('reports'), result => { value = result; }, error => { failure = error; tx.abort(); }); }
        catch (error) { failure = error; tx.abort(); }
      });
    } finally { db.close(); }
  }
  insert(row) {
    const copy = structuredClone(row);
    return this.transaction((store, done, fail) => {
      const request = store.get([copy.owner_key, copy.executor_id, copy.report_id]);
      request.onsuccess = () => {
        const previous = request.result;
        if (previous && (previous.body !== copy.body || previous.base_url !== copy.base_url)) {
          fail(new Error('REPORT_CONFLICT')); return;
        }
        if (!previous) store.put(copy);
        done(previous || copy);
      };
    });
  }
  list(ownerKey, executorId) {
    return this.transaction((store, done) => {
      const request = store.getAll();
      request.onsuccess = () => done(request.result.filter(row => row.owner_key === ownerKey && row.executor_id === executorId));
    });
  }
  update(row) {
    const copy = structuredClone(row);
    return this.transaction((store, done, fail) => {
      const request = store.get([copy.owner_key, copy.executor_id, copy.report_id]);
      request.onsuccess = () => {
        const previous = request.result;
        if (!previous || previous.body !== copy.body || previous.base_url !== copy.base_url) {
          fail(new Error('REPORT_CONFLICT')); return;
        }
        store.put(copy); done(null);
      };
    });
  }
}

export class MemberExecutionClient {
  constructor({ baseUrl, getCredentials, store = new MemberReportStore(),
    fetch = globalThis.fetch.bind(globalThis), now = Date.now, timeoutMs = 10000 }) {
    const url = new URL(baseUrl);
    if (url.username || url.password || url.search || url.hash || url.pathname !== '/api/v1'
      || !(url.protocol === 'https:' || url.protocol === 'http:' && ['127.0.0.1', 'localhost'].includes(url.hostname)))
      throw new Error('INVALID_SERVER_CONFIG');
    Object.assign(this, { baseUrl: url.href, getCredentials, store, fetch, now, timeoutMs });
    this.queue = Promise.resolve();
  }
  async credentials() {
    const result = await this.getCredentials();
    if (!owner(result?.owner_key) || !uuid(result.executor_id) || typeof result.access_token !== 'string'
      || !result.access_token) throw new Error('INVALID_EXECUTION_CREDENTIALS');
    return result;
  }
  async request(path, credentials, body, headers = {}) {
    const controller = new AbortController(), timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await this.fetch(this.baseUrl + path, { method: body == null ? 'GET' : 'POST',
        headers: { ...headers, Authorization: 'Bearer ' + credentials.access_token,
          ...(body == null ? {} : { 'Content-Type': 'application/json' }) },
        ...(body == null ? {} : { body }), credentials: 'omit', redirect: 'error', cache: 'no-store', signal: controller.signal });
      if (!response.ok) { const error = new Error('EXECUTION_HTTP_' + response.status); error.status = response.status; throw error; }
      return await response.json();
    } finally { clearTimeout(timer); }
  }
  async session(sessionId) {
    if (!uuid(sessionId)) throw new Error('INVALID_SESSION');
    const credentials = await this.credentials();
    const result = await this.request('/sessions/' + sessionId, credentials);
    if (result?.session_id !== sessionId || result.executor_id !== credentials.executor_id
      || !revision(result.desired_revision) || !['STARTING', 'RUNNING', 'ENDING', 'UNKNOWN', 'ENDED', 'START_FAILED'].includes(result.execution_status))
      throw new Error('INVALID_SESSION_RESPONSE');
    return result;
  }
  async end(sessionId, key) {
    if (!uuid(sessionId) || !uuid(key)) throw new Error('INVALID_SESSION');
    return this.request('/sessions/' + sessionId + '/end', await this.credentials(), '{}', { 'Idempotency-Key': key });
  }
  async reconcile(body) {
    const credentials = await this.credentials();
    const result = await this.request('/executors/' + credentials.executor_id + '/reconcile', credentials, JSON.stringify(body));
    if (!revision(result?.revision) || !['APPLIED', 'RELEASED'].includes(result.desired_state)
      || !Array.isArray(result.acknowledged_actions)) throw new Error('INVALID_RECONCILE_RESPONSE');
    return result;
  }
  async commands() {
    const credentials = await this.credentials();
    const response = await this.request('/executors/' + credentials.executor_id + '/commands', credentials);
    if (!Array.isArray(response?.commands) || typeof response.next_cursor !== 'string' || !time(response.server_time))
      throw new Error('INVALID_COMMAND_RESPONSE');
    for (const command of response.commands) {
      if (!uuid(command?.command_id) || !uuid(command.session_id) || command.executor_id !== credentials.executor_id
        || !revision(command.desired_revision) || !time(command.created_at)
        || !['APPLY_POLICY', 'RELEASE_POLICY'].includes(command.type)) throw new Error('INVALID_COMMAND_RESPONSE');
      if (command.type === 'APPLY_POLICY' && (!Number.isInteger(command.duration_minutes)
        || command.duration_minutes < 1 || command.duration_minutes > 180 || !time(command.execute_before)
        || command.snapshot?.executor_id !== credentials.executor_id
        || String(command.snapshot?.owner_user_id) !== credentials.owner_key.slice(7))) throw new Error('INVALID_COMMAND_RESPONSE');
    }
    const current = await this.credentials();
    if (current.owner_key !== credentials.owner_key || current.executor_id !== credentials.executor_id)
      throw new Error('EXECUTION_OWNER_CHANGED');
    // Receipt is not permission to apply; trusted Core must reconcile/recheck
    // revision, expiry and supported policies before using SiteController.
    return structuredClone(response);
  }
  async enqueue(report, expectedScope = null) {
    const body = JSON.stringify(validateExecutionReport(structuredClone(report)));
    const credentials = await this.credentials();
    if (expectedScope && (expectedScope.owner_key !== credentials.owner_key || expectedScope.executor_id !== credentials.executor_id))
      throw new Error('EXECUTION_SCOPE_MISMATCH');
    if (JSON.parse(body).executor_id !== credentials.executor_id) throw new Error('EXECUTION_SCOPE_MISMATCH');
    return this.store.insert({ owner_key: credentials.owner_key, executor_id: credentials.executor_id,
      report_id: JSON.parse(body).report_id, base_url: this.baseUrl, body, status: 'PENDING', next_attempt_at: 0 });
  }
  flush() {
    const result = this.queue.then(() => this.deliver()); this.queue = result.catch(() => {}); return result;
  }
  async deliver() {
    const scope = await this.credentials();
    for (const row of await this.store.list(scope.owner_key, scope.executor_id)) {
      if (row.base_url !== this.baseUrl || ['ACKED', 'REJECTED'].includes(row.status) || row.next_attempt_at > this.now()) continue;
      const current = await this.credentials();
      if (current.owner_key !== scope.owner_key || current.executor_id !== scope.executor_id) throw new Error('EXECUTION_OWNER_CHANGED');
      try {
        const report = validateExecutionReport(JSON.parse(row.body));
        if (report.report_id !== row.report_id || report.executor_id !== scope.executor_id) throw new Error('INVALID_EXECUTION_REPORT');
      } catch {
        row.status = 'REJECTED'; row.error = 'INVALID_EXECUTION_REPORT';
        await this.store.update(row); continue;
      }
      try {
        const ack = await this.request('/executors/' + scope.executor_id + '/reports', current, row.body);
        if (!['ACCEPTED', 'DUPLICATE'].includes(ack?.result) || !revision(ack.desired_revision)) throw new Error('INVALID_REPORT_ACK');
        // ACK acknowledges a report only. In particular, a larger revision does
        // not authorize RUNNING or reapplication of an obsolete APPLY.
        row.status = 'ACKED'; row.ack = { result: ack.result, desired_revision: ack.desired_revision };
      } catch (error) {
        row.status = error.status >= 400 && error.status < 500 && ![401, 408, 429].includes(error.status)
          ? 'REJECTED' : 'RESPONSE_UNCONFIRMED';
        row.next_attempt_at = this.now() + 30000;
        row.error = error.status ? 'EXECUTION_HTTP_' + error.status : 'REPORT_RESPONSE_UNCONFIRMED';
      }
      // A storage failure leaves the original report pending. Safe identical
      // resend is valid even when Server already received it.
      await this.store.update(row);
    }
  }
}
