import {canonical, digest} from '../a1/contract.mjs';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const HASH = /^[a-f0-9]{64}$/;
const positive = n => Number.isSafeInteger(n) && n > 0;
const exact = (v, keys) => !!v && typeof v === 'object' && !Array.isArray(v)
  && Object.keys(v).length === keys.length && keys.every(k => Object.hasOwn(v, k));
const fail = code => { throw Error(code); };
const same = (a,b) => canonical(a) === canonical(b);

/** Background-only local handoff. producer.recover() is a COMPLETE immutable
 * journal snapshot; outbox.enqueue() resolves only after durable admission.
 * Neither adapter may grant authority from message-body flags. No RPC, transport,
 * effect execution, source deletion, ACK generation, or independent cursor here.
 */
export class RuntimeReportReplay {
  constructor({producer, outbox, authorizeScope = async () => false, capacity = 1024}) {
    if (typeof producer?.recover !== 'function' || typeof outbox?.enqueue !== 'function' || typeof outbox?.recover !== 'function'
      || typeof authorizeScope !== 'function' || !positive(capacity)) fail('INVALID_REPORT_REPLAY_OPTIONS');
    Object.assign(this, {producer, outbox, authorizeScope, capacity});
    this.running = false;
  }
  async authorize(scope) {
    if (await this.authorizeScope(structuredClone(scope)) !== true) fail('REPORT_REPLAY_UNAUTHORIZED');
  }
  async source() {
    const state = structuredClone(await this.producer.recover());
    if (!Array.isArray(state?.rows) || state.rows.length > this.capacity) fail('REPORT_REPLAY_SOURCE_UNCONFIRMED');
    const ids = new Set(), sequences = new Map();
    for (const row of state.rows) {
      if (!exact(row, ['generation', 'report', 'row_sha256']) || !positive(row.generation)
        || typeof row.row_sha256 !== 'string' || !HASH.test(row.row_sha256)) fail('REPORT_REPLAY_SOURCE_UNCONFIRMED');
      const {report, generation, row_sha256} = row;
      if (!report || ['report_id','owner_binding_id','executor_id','runtime_execution_id','report_epoch'].some(k => typeof report[k] !== 'string' || !UUID.test(report[k]))
        || !positive(report.report_seq) || typeof report.payload_sha256 !== 'string' || !HASH.test(report.payload_sha256)
        || ids.has(report.report_id)) fail('REPORT_REPLAY_SOURCE_UNCONFIRMED');
      const {payload_sha256, ...body} = report;
      if (await digest(body) !== payload_sha256 || await digest({generation, report}) !== row_sha256) fail('REPORT_REPLAY_SOURCE_UNCONFIRMED');
      // RPT-01 sequence namespace. Never sort timestamps or reissue identities.
      const key = canonical([report.owner_binding_id, report.report_epoch]);
      if (report.report_seq !== (sequences.get(key) ?? 0) + 1) fail('REPORT_REPLAY_SOURCE_UNCONFIRMED');
      sequences.set(key, report.report_seq); ids.add(report.report_id);
    }
    return state.rows;
  }
  async replay(suppliedScope) {
    const scope = structuredClone(suppliedScope);
    if (!exact(scope, ['owner_binding_id','executor_id']) || Object.values(scope).some(v => typeof v !== 'string' || !UUID.test(v))) fail('INVALID_REPORT_REPLAY_SCOPE');
    if (this.running) fail('REPORT_REPLAY_BUSY');
    this.running = true;
    const progress = {local_only:true, snapshot_count:null, staged_count:0, reused_count:0, enqueued_count:0, last_staged_report_id:null, at_report_id:null,
      deliveries:{PENDING:0, ACKED:0, REJECTED:0}};
    try {
      await this.authorize(scope);
      const rows = (await this.source()).filter(({report}) => report.owner_binding_id === scope.owner_binding_id && report.executor_id === scope.executor_id);
      progress.snapshot_count = rows.length;
      await this.authorize(scope);
      const target = structuredClone(await this.outbox.recover()), cached = new Map();
      if (!Array.isArray(target?.rows) || target.rows.length > this.capacity) fail('REPORT_REPLAY_TARGET_UNCONFIRMED');
      for (const receipt of target.rows) {
        if (!exact(receipt, ['report','delivery','ack']) || typeof receipt.report?.report_id !== 'string'
          || !UUID.test(receipt.report.report_id) || cached.has(receipt.report.report_id)
          || !Object.hasOwn(progress.deliveries, receipt.delivery)) fail('REPORT_REPLAY_TARGET_UNCONFIRMED');
        cached.set(receipt.report.report_id, receipt);
      }
      // Existing durable receipts are historical observations, not new evidence.
      for (const {report} of rows) {
        const old = cached.get(report.report_id);
        if (old && !same(old.report, report)) fail('REPORT_REPLAY_TARGET_CONFLICT');
      }
      for (const {report} of rows) {
        progress.at_report_id = report.report_id; await this.authorize(scope);
        // enqueue MUST revalidate current evidence/authority itself and commit.
        // Retry the full source snapshot; existing durable receipts are reused.
        const reused = cached.has(report.report_id);
        const receipt = reused ? cached.get(report.report_id) : structuredClone(await this.outbox.enqueue(structuredClone(report)));
        if (!exact(receipt, ['report','delivery','ack']) || !same(receipt.report, report)
          || !Object.hasOwn(progress.deliveries, receipt.delivery)) fail('REPORT_REPLAY_TARGET_UNCONFIRMED');
        progress.staged_count++; progress[reused ? 'reused_count' : 'enqueued_count']++;
        progress.last_staged_report_id = report.report_id; progress.deliveries[receipt.delivery]++;
        await this.authorize(scope); progress.at_report_id = null;
      }
      await this.authorize(scope);
      return {...structuredClone(progress), snapshot_complete:true};
    } catch (cause) {
      const error = Error('REPORT_REPLAY_INCOMPLETE', {cause});
      error.progress = structuredClone(progress); // Local diagnostic, not a durable receipt.
      throw error;
    } finally { this.running = false; }
  }
}
