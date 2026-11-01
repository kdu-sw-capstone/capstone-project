import schema from '../../contracts/additional-mvp/rc1/schema.json' with { type: 'json' };
import { canonical, digest } from '../a1/contract.mjs';

const KEY = 'amvp_journal_v1:runtime-report-outbox';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const fail = code => { throw Error(code); };
const same = (a, b) => canonical(a) === canonical(b);
const exact = (v, keys) => v && typeof v === 'object' && !Array.isArray(v)
  && Object.keys(v).length === keys.length && keys.every(k => Object.hasOwn(v, k));
const scopeOf = report => ({ owner_binding_id: report.owner_binding_id, executor_id: report.executor_id });
const streamOf = r => canonical([r.owner_binding_id, r.executor_id, r.runtime_execution_id, r.report_epoch]);
const fresh = () => ({ key: KEY, version: 1, rows: [], batches: [] });
const terminal = row => row.delivery !== 'PENDING';
const keywords = new Set(['$ref', 'type', 'properties', 'required', 'additionalProperties', 'items', 'minItems', 'maxItems', 'minimum', 'maximum', 'minLength', 'maxLength', 'pattern', 'format', 'const', 'enum', 'anyOf']);

// Read the frozen RC2 definitions rather than introducing a new message schema.
// Only the keywords/formats used by report/ACK envelopes are supported; fail
// closed if those definitions gain unsupported validation semantics.
function matches(value, s) {
  if (!s || Object.keys(s).some(k => !keywords.has(k))) return false;
  if (s.type && !['null', 'integer', 'string', 'array', 'object'].includes(s.type)) return false;
  if (s.$ref) return matches(value, schema.$defs[s.$ref.split('/').at(-1)]);
  if (s.anyOf && !s.anyOf.some(branch => matches(value, branch))) return false;
  if (Object.hasOwn(s, 'const') && !same(value, s.const) || s.enum && !s.enum.includes(value)) return false;
  if (s.type === 'null' && value !== null) return false;
  if (s.type === 'integer' && (!Number.isSafeInteger(value) || value < (s.minimum ?? -Infinity) || value > (s.maximum ?? Infinity))) return false;
  if (s.type === 'string') {
    if (typeof value !== 'string' || [...value].length < (s.minLength ?? 0) || [...value].length > (s.maxLength ?? Infinity) || s.pattern && !new RegExp(s.pattern).test(value)) return false;
    if (s.format === 'uuid' && !UUID.test(value)) return false;
    if (s.format === 'date-time' && (!Number.isFinite(Date.parse(value)) || new Date(Date.parse(value)).toISOString() !== value)) return false;
    if (s.format && !['uuid', 'date-time'].includes(s.format)) return false;
  }
  if (s.type === 'array' && (!Array.isArray(value) || value.length < (s.minItems ?? 0) || value.length > (s.maxItems ?? Infinity) || value.some(v => !matches(v, s.items)))) return false;
  if (s.type === 'object') {
    if (!value || typeof value !== 'object' || Array.isArray(value) || s.required.some(k => !Object.hasOwn(value, k))) return false;
    if (s.additionalProperties === false && Object.keys(value).some(k => !Object.hasOwn(s.properties, k))) return false;
    if (Object.entries(s.properties).some(([k, field]) => Object.hasOwn(value, k) && !matches(value[k], field))) return false;
  }
  return true;
}
const wire = (value, name) => { if (!matches(value, schema.$defs[name])) fail('INVALID_' + name.toUpperCase()); };
function scope(value) { if (!exact(value, ['owner_binding_id', 'executor_id']) || !Object.values(value).every(v => typeof v === 'string' && UUID.test(v))) fail('INVALID_REPORT_SCOPE'); }
function validate(state) {
  if (!exact(state, ['key', 'version', 'rows', 'batches']) || state.key !== KEY || state.version !== 1 || !Array.isArray(state.rows) || !Array.isArray(state.batches)) fail('INVALID_REPORT_OUTBOX');
  const ids = new Set(), streams = new Map(), batchIds = new Set();
  for (const row of state.rows) {
    if (!exact(row, ['report', 'delivery', 'ack']) || !['PENDING', 'ACKED', 'REJECTED'].includes(row.delivery)) fail('INVALID_REPORT_ROW');
    const r = row.report; wire(r, 'RuntimeReport');
    if (ids.has(r.report_id)) fail('REPORT_ID_CONFLICT'); ids.add(r.report_id);
    const stream = streamOf(r), next = (streams.get(stream) ?? 0) + 1;
    if (r.report_seq !== next) fail('REPORT_SEQUENCE_GAP'); streams.set(stream, next);
    if (row.ack !== null) {
      wire(row.ack, 'ItemAck');
      if (row.ack.item_id !== r.report_id || row.ack.payload_sha256 !== r.payload_sha256) fail('REPORT_ACK_MISMATCH');
    }
    if (row.delivery === 'ACKED' && !['ACCEPTED', 'DUPLICATE'].includes(row.ack?.status)
      || row.delivery === 'REJECTED' && row.ack?.status !== 'REJECTED'
      || row.delivery === 'PENDING' && row.ack !== null && !['PENDING_DEPENDENCY', 'NOT_RECEIVED'].includes(row.ack.status)) fail('REPORT_ACK_MISMATCH');
  }
  for (const batch of state.batches) {
    if (!exact(batch, ['body', 'sha256'])) fail('INVALID_REPORT_BATCH');
    wire(batch.body, 'ReportBatch');
    if (batchIds.has(batch.body.batch_id) || !/^[a-f0-9]{64}$/.test(batch.sha256)) fail('INVALID_REPORT_BATCH'); batchIds.add(batch.body.batch_id);
    const reportIds = new Set();
    for (const report of batch.body.reports) {
      if (reportIds.has(report.report_id) || report.executor_id !== batch.body.executor_id
        || report.owner_binding_id !== batch.body.reports[0].owner_binding_id
        || !state.rows.some(row => same(row.report, report))) fail('INVALID_REPORT_BATCH');
      reportIds.add(report.report_id);
    }
  }
}

/** Trusted background-only delivery staging. Never constructs effect state,
 * report epoch/seq, native evidence, policy success or transport authority.
 * Actual issued evidence/current owner/authenticated ACK adapters are REQUIRED.
 */
export class RuntimeReportOutbox {
  constructor(db, { authorizeScope = async () => false, verifyReport = async () => false,
    verifyAck = async () => false, capacity = 1024 } = {}) {
    if (!Number.isSafeInteger(capacity) || capacity < 1) fail('INVALID_OUTBOX_CAPACITY');
    Object.assign(this, { db, authorizeScope, verifyReport, verifyAck, capacity });
  }
  async transact(mode, work, expected = null) {
    let failure;
    try { return await this.db.transaction(mode, (tx, done) => {
      const store = tx.objectStore('metadata'), request = store.get(KEY);
      request.onsuccess = () => { try {
        const state = request.result ?? fresh(); validate(state);
        if (expected !== null && !same(state, expected)) fail('REPORT_OUTBOX_CHANGED');
        const result = work(state); if (result?.then) fail('ASYNC_REPORT_TRANSACTION');
        validate(state); if (mode === 'readwrite') store.put(state);
        done(structuredClone(result));
      } catch (error) { failure = error; tx.abort(); } };
    }); } catch (error) { throw failure ?? Error('REPORT_STORAGE_UNCONFIRMED', { cause: error }); }
  }
  async recover() {
    const state = await this.transact('readonly', s => s);
    for (const { report } of state.rows) { const { payload_sha256, ...body } = report; if (await digest(body) !== payload_sha256) fail('REPORT_HASH_MISMATCH'); }
    for (const batch of state.batches) if (await digest(batch.body) !== batch.sha256) fail('REPORT_BATCH_HASH_MISMATCH');
    return state;
  }
  async authorize(value) { scope(value); if (await this.authorizeScope(structuredClone(value)) !== true) fail('REPORT_SCOPE_UNAUTHORIZED'); }
  async enqueue(supplied) {
    const report = structuredClone(supplied); wire(report, 'RuntimeReport');
    const { payload_sha256, ...body } = report;
    if (await digest(body) !== payload_sha256) fail('REPORT_HASH_MISMATCH');
    const owner = scopeOf(report); await this.authorize(owner);
    if (await this.verifyReport(structuredClone(report)) !== true) fail('REPORT_EVIDENCE_UNVERIFIED');
    const snapshot = await this.recover(); await this.authorize(owner);
    return this.transact('readwrite', state => {
      const old = state.rows.find(row => row.report.report_id === report.report_id);
      if (old) { if (!same(old.report, report)) fail('REPORT_ID_CONFLICT'); return old; }
      const last = state.rows.filter(row => streamOf(row.report) === streamOf(report)).at(-1);
      if (report.report_seq !== (last?.report.report_seq ?? 0) + 1) fail('REPORT_SEQUENCE_GAP');
      if (state.rows.length >= this.capacity) fail('REPORT_OUTBOX_FULL');
      const row = { report, delivery: 'PENDING', ack: null }; state.rows.push(row); return row;
    }, snapshot);
  }
  async batch(suppliedScope) {
    const owner = structuredClone(suppliedScope); await this.authorize(owner);
    const snapshot = await this.recover();
    const existing = snapshot.batches.find(batch => batch.body.executor_id === owner.executor_id
      && batch.body.reports[0].owner_binding_id === owner.owner_binding_id
      && batch.body.reports.some(r => snapshot.rows.some(row => row.report.report_id === r.report_id && !terminal(row))));
    if (existing) { await this.authorize(owner); return this.transact('readonly', () => existing.body, snapshot); }
    const reports = snapshot.rows.filter(row => !terminal(row) && same(scopeOf(row.report), owner)).slice(0, 100).map(row => row.report);
    if (!reports.length) return null;
    const body = { stream: 'RUNTIME_REPORT', schema_version: 'AMVP_RUNTIME_REPORT_1', batch_id: crypto.randomUUID(), executor_id: owner.executor_id, reports };
    wire(body, 'ReportBatch'); const record = { body, sha256: await digest(body) }; await this.authorize(owner);
    return this.transact('readwrite', state => {
      if (state.batches.length >= this.capacity) fail('REPORT_BATCH_CAPACITY');
      state.batches.push(record); return body;
    }, snapshot);
  }
  async acknowledge(suppliedScope, suppliedAck) {
    const owner = structuredClone(suppliedScope), ack = structuredClone(suppliedAck); await this.authorize(owner); wire(ack, 'BatchAck');
    const snapshot = await this.recover(), batch = snapshot.batches.find(b => b.body.batch_id === ack.batch_id);
    if (!batch || batch.body.executor_id !== owner.executor_id || batch.body.reports[0].owner_binding_id !== owner.owner_binding_id) fail('REPORT_BATCH_SCOPE_MISMATCH');
    const ids = new Set();
    for (const item of ack.items) {
      if (ids.has(item.item_id) || !batch.body.reports.some(r => r.report_id === item.item_id && r.payload_sha256 === item.payload_sha256)) fail('REPORT_ACK_MISMATCH');
      ids.add(item.item_id);
    }
    if (await this.verifyAck(structuredClone(owner), structuredClone(batch.body), structuredClone(ack)) !== true) fail('REPORT_ACK_UNVERIFIED');
    await this.authorize(owner);
    return this.transact('readwrite', state => {
      for (const item of ack.items) {
        const row = state.rows.find(r => r.report.report_id === item.item_id);
        if (terminal(row)) continue; // Late responses never downgrade terminal delivery.
        row.ack = item;
        if (['ACCEPTED', 'DUPLICATE'].includes(item.status)) row.delivery = 'ACKED';
        else if (item.status === 'REJECTED') row.delivery = 'REJECTED';
      }
      return ack;
    }, snapshot);
  }
}
