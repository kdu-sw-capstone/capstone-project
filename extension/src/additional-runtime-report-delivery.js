import {canonical} from '../a1/contract.mjs';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const fail = code => { throw Error(code); };

/** Background-only, ONE attempt for an existing durable RPT-01 batch.
 * send(body,{signal,isCurrent}) is a trusted authenticated transport, not fetch
 * authority. It must recheck isCurrent at its actual IO boundary after any
 * credential/capability await, send exactly body, and return its bound BatchAck.
 * Outbox verifyAck remains responsible for authenticating that response.
 * No polling/retry, source creation, ACK fabrication or policy effects here.
 */
export class RuntimeReportDelivery {
  #attempt = null;
  constructor({outbox, send, authorizeScope = async () => false, isCurrent = () => false, timeoutMs = 10000}) {
    if (typeof outbox?.batch !== 'function' || typeof outbox?.acknowledge !== 'function'
      || typeof send !== 'function' || typeof authorizeScope !== 'function' || typeof isCurrent !== 'function'
      || !Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 2147483647) fail('INVALID_REPORT_DELIVERY_OPTIONS');
    Object.assign(this, {outbox, send, authorizeScope, isCurrent, timeoutMs});
  }
  stop() { this.#attempt?.abort(Error('REPORT_DELIVERY_CANCELLED')); }
  async deliver(suppliedScope) {
    const owner = structuredClone(suppliedScope);
    if (!owner || typeof owner !== 'object' || Array.isArray(owner)
      || Object.keys(owner).sort().join(',') !== 'executor_id,owner_binding_id'
      || Object.values(owner).some(v => typeof v !== 'string' || !UUID.test(v))) fail('INVALID_REPORT_DELIVERY_SCOPE');
    Object.freeze(owner); // Validated flat UUID fields; no recursive caller data.
    if (this.#attempt) fail('REPORT_DELIVERY_BUSY');
    const controller = new AbortController(), {signal} = controller;
    this.#attempt = controller;
    let cancel, phase = 'AUTHORIZE';
    const cancelled = new Promise((_, reject) => { cancel = () => reject(signal.reason); });
    signal.addEventListener('abort', cancel, {once:true});
    const timer = setTimeout(() => controller.abort(Error('REPORT_DELIVERY_TIMEOUT')), this.timeoutMs);
    const wait = promise => Promise.race([promise, cancelled]);
    const isCurrent = () => {
      if (signal.aborted || this.#attempt !== controller) return false;
      try { return this.isCurrent(owner) === true; } catch { return false; }
    };
    const current = () => { if (!isCurrent()) fail('REPORT_DELIVERY_AUTHORITY_LOST'); };
    const authorize = async () => {
      if (await wait(this.authorizeScope(owner)) !== true) fail('REPORT_DELIVERY_UNAUTHORIZED');
      current();
    };
    try {
      await authorize();
      phase = 'BATCH';
      // Real RuntimeReportOutbox validates Schema/hash and durably retains body.
      const batch = structuredClone(await wait(this.outbox.batch(owner)));
      current();
      if (batch === null) return Object.freeze({local_only:true, batch_id:null, submitted_count:0, ack_persisted:false});
      if (!batch || batch.stream !== 'RUNTIME_REPORT' || batch.schema_version !== 'AMVP_RUNTIME_REPORT_1'
        || !UUID.test(batch.batch_id) || batch.executor_id !== owner.executor_id
        || !Array.isArray(batch.reports) || !batch.reports.length || batch.reports.length > 100
        || batch.reports.some(r => r.owner_binding_id !== owner.owner_binding_id || r.executor_id !== owner.executor_id)) fail('REPORT_DELIVERY_BATCH_UNCONFIRMED');
      const body = canonical(batch);
      if (new TextEncoder().encode(body).byteLength > 1048576) fail('REPORT_DELIVERY_TOO_LARGE');
      phase = 'SEND';
      await authorize();
      current(); // No await between the final local fence and transport dispatch.
      const ack = structuredClone(await wait(this.send(body, Object.freeze({signal, isCurrent}))));
      current();
      phase = 'ACK';
      await authorize();
      // Once handed off, acknowledge may commit despite cancellation. Never
      // erase/revert it: the real outbox owns authority, CAS and atomic commit.
      await wait(this.outbox.acknowledge(owner, ack));
      current();
      return Object.freeze({local_only:true, batch_id:batch.batch_id, submitted_count:batch.reports.length, ack_persisted:true});
    } catch (cause) {
      const error = Error('REPORT_DELIVERY_INCOMPLETE', {cause});
      error.phase = phase; // Local diagnostic only; no credentials/body attached.
      throw error;
    } finally {
      clearTimeout(timer);
      signal.removeEventListener('abort', cancel);
      if (this.#attempt === controller) this.#attempt = null;
      controller.abort();
    }
  }
}
