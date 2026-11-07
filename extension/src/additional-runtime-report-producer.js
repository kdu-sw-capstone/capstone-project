import schema from '../../contracts/additional-mvp/rc1/schema.json' with { type: 'json' };
import { canonical, digest } from '../a1/contract.mjs';

const KEY = 'amvp_journal_v1:runtime-report-producer';
const definition = schema.$defs.RuntimeReport;
const generated = ['report_epoch', 'report_seq', 'payload_sha256'];
const INPUT = definition.required.filter(k => !generated.includes(k));
const SCOPE = ['owner_binding_id', 'executor_id', 'runtime_execution_id'];
const exact = (v, keys) => !!v && typeof v === 'object' && !Array.isArray(v)
  && Object.keys(v).length === keys.length && keys.every(k => Object.hasOwn(v, k));
const fail = code => { throw Error(code); };
const same = (a, b) => canonical(a) === canonical(b);
const scopeOf = r => Object.fromEntries(SCOPE.map(k => [k, r[k]]));
const streamKey = r => canonical(SCOPE.map(k => r[k]));
const positive = n => Number.isSafeInteger(n) && n > 0;
const fresh = () => ({ key: KEY, version: 1, streams: [], rows: [] });

// RuntimeReport has scalar fields only. Fail closed if its frozen definition
// gains semantics this narrow validator does not support.
function field(value, rule) {
  const supported = rule.type === 'integer' ? ['type', 'minimum', 'maximum'] : ['type', 'format', 'pattern', 'enum'];
  if (Object.keys(rule).some(k => !supported.includes(k))) return false;
  if (rule.type === 'integer') return Number.isSafeInteger(value) && value >= (rule.minimum ?? -Infinity) && value <= (rule.maximum ?? Infinity);
  if (rule.type !== 'string' || typeof value !== 'string' || rule.enum && !rule.enum.includes(value)
    || rule.pattern && !new RegExp(rule.pattern).test(value)) return false;
  if (rule.format === 'date-time') return Number.isFinite(Date.parse(value)) && new Date(Date.parse(value)).toISOString() === value;
  // UUID shape/canonical case is also constrained by the frozen pattern.
  return !rule.format || rule.format === 'uuid';
}
function reportShape(value, keys = definition.required) {
  if (!exact(value, keys) || keys.some(k => !field(value[k], definition.properties[k]))) fail('INVALID_REPORT_PRODUCER_INPUT');
}
function validate(state) {
  if (!exact(state, ['key', 'version', 'streams', 'rows']) || state.key !== KEY || state.version !== 1
    || !Array.isArray(state.streams) || !Array.isArray(state.rows)) fail('INVALID_REPORT_PRODUCER_JOURNAL');
  const streams = new Map(), epochs = new Set(), counts = new Map(), ids = new Set();
  for (const stream of state.streams) {
    if (!exact(stream, [...SCOPE, 'report_epoch', 'last_seq']) || !positive(stream.last_seq)
      || [...SCOPE, 'report_epoch'].some(k => !field(stream[k], definition.properties[k]))) fail('INVALID_REPORT_PRODUCER_STREAM');
    const key = streamKey(stream);
    if (streams.has(key) || epochs.has(stream.report_epoch)) fail('INVALID_REPORT_PRODUCER_STREAM');
    streams.set(key, stream); epochs.add(stream.report_epoch);
  }
  for (const row of state.rows) {
    if (!exact(row, ['generation', 'report', 'row_sha256']) || !positive(row.generation)
      || typeof row.row_sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(row.row_sha256)) fail('INVALID_REPORT_PRODUCER_ROW');
    const r = row.report; reportShape(r);
    const key = streamKey(r), stream = streams.get(key), next = (counts.get(key) ?? 0) + 1;
    if (!stream || stream.report_epoch !== r.report_epoch || r.report_seq !== next || ids.has(r.report_id)) fail('INVALID_REPORT_PRODUCER_SEQUENCE');
    ids.add(r.report_id); counts.set(key, next);
  }
  if (state.streams.some(s => counts.get(streamKey(s)) !== s.last_seq)) fail('INVALID_REPORT_PRODUCER_CURSOR');
}

/** Trusted background journal; not a message endpoint, clock, evidence issuer,
 * outbox, or native effect executor. Stable report_id MUST belong to the durable
 * source observation. Actual scope and issued/effect verification are mandatory.
 */
export class RuntimeReportProducer {
  constructor(db, { authorizeScope = async () => false, verifyEvidence = async () => false, capacity = 1024 } = {}) {
    if (!positive(capacity) || typeof authorizeScope !== 'function' || typeof verifyEvidence !== 'function') fail('INVALID_REPORT_PRODUCER_OPTIONS');
    Object.assign(this, { db, authorizeScope, verifyEvidence, capacity });
  }
  async transact(mode, work, expected = null) {
    let failure;
    try { return await this.db.transaction(mode, (tx, done) => {
      const store = tx.objectStore('metadata'), request = store.get(KEY);
      request.onsuccess = () => { try {
        const state = request.result ?? fresh(); validate(state);
        if (expected !== null && !same(state, expected)) fail('REPORT_PRODUCER_CHANGED');
        const result = work(state); if (result?.then) fail('ASYNC_REPORT_PRODUCER_TRANSACTION');
        validate(state); if (mode === 'readwrite') store.put(state);
        done(structuredClone(result));
      } catch (error) { failure = error; tx.abort(); } };
    }); } catch (error) { throw failure ?? Error('REPORT_PRODUCER_STORAGE_UNCONFIRMED', { cause: error }); }
  }
  async recover() {
    const state = await this.transact('readonly', s => s);
    for (const row of state.rows) {
      const { row_sha256, ...record } = row, { report } = row;
      if (await digest(record) !== row_sha256) fail('REPORT_PRODUCER_HASH_MISMATCH');
      const { payload_sha256, ...body } = report;
      if (await digest(body) !== payload_sha256) fail('REPORT_PRODUCER_HASH_MISMATCH');
    }
    return state;
  }
  async authorize(request) {
    if (await this.authorizeScope({ ...scopeOf(request.report), generation: request.generation }) !== true) fail('REPORT_PRODUCER_UNAUTHORIZED');
  }
  async produce(supplied) {
    const request = structuredClone(supplied);
    if (!exact(request, ['generation', 'report']) || !positive(request.generation)) fail('INVALID_REPORT_PRODUCER_INPUT');
    reportShape(request.report, INPUT); await this.authorize(request);
    const snapshot = await this.recover(), input = request.report;
    const old = snapshot.rows.find(row => row.report.report_id === input.report_id);
    if (old) {
      const original = Object.fromEntries(INPUT.map(k => [k, old.report[k]]));
      if (old.generation !== request.generation || !same(original, input)) fail('REPORT_PRODUCER_ID_CONFLICT');
      // A duplicate reads the durable receipt, not a fresh effect observation.
      await this.authorize(request);
      return this.transact('readonly', () => old.report, snapshot);
    }
    const prior = snapshot.streams.find(s => streamKey(s) === streamKey(input));
    if (prior?.last_seq === Number.MAX_SAFE_INTEGER) fail('REPORT_PRODUCER_SEQUENCE_LIMIT');
    if (snapshot.rows.length >= this.capacity) fail('REPORT_PRODUCER_FULL');
    const body = { ...input, report_epoch: prior?.report_epoch ?? crypto.randomUUID(), report_seq: (prior?.last_seq ?? 0) + 1 };
    const report = { ...body, payload_sha256: await digest(body) }; reportShape(report);
    const lastRow = snapshot.rows.filter(row => streamKey(row.report) === streamKey(input)).at(-1);
    const predecessor = lastRow ? { generation: lastRow.generation, report: lastRow.report } : null;
    if (await this.verifyEvidence(structuredClone({ generation: request.generation, report, predecessor })) !== true) fail('REPORT_PRODUCER_EVIDENCE_UNVERIFIED');
    const row = { generation: request.generation, report }, rowHash = await digest(row);
    await this.authorize(request);
    return this.transact('readwrite', state => {
      let stream = state.streams.find(s => streamKey(s) === streamKey(input));
      if (!stream) {
        stream = { ...scopeOf(input), report_epoch: report.report_epoch, last_seq: report.report_seq };
        state.streams.push(stream);
      } else stream.last_seq = report.report_seq;
      state.rows.push({ ...row, row_sha256: rowHash });
      return report;
    }, snapshot);
  }
}
