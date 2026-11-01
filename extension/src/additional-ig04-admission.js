import contract from '../../contracts/additional-mvp/rc1/schema.json' with {type: 'json'};
import {digest, same} from '../a1/contract.mjs';
import {DocumentControlRegistry} from './document-control-registry.js';

const exact = (v, keys) => v && Object.getPrototypeOf(v) === Object.prototype
  && Object.keys(v).length === keys.length && keys.every(k => Object.hasOwn(v, k));
const uuid = v => typeof v === 'string' && /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(v);
const hash = v => typeof v === 'string' && /^[a-f0-9]{64}$/.test(v);
const positive = v => Number.isSafeInteger(v) && v > 0;
const freeze = v => { if (v && typeof v === 'object') { Object.values(v).forEach(freeze); Object.freeze(v); } return v; };
const fail = code => { throw Error(code); };
const OPEN = Symbol('verified-open');

// Only BindingScope/FocusRef's existing schema vocabulary is interpreted here.
// This is not a validator for Control, Projection, grants or an issued registry.
function scopeMatches(v, s) {
  if (s.$ref) return scopeMatches(v, contract.$defs[s.$ref.split('/').at(-1)]);
  if (s.anyOf) return s.anyOf.some(item => scopeMatches(v, item));
  if (s.enum) return s.enum.includes(v);
  if (Object.hasOwn(s, 'const')) return v === s.const;
  if (s.type === 'null') return v === null;
  if (s.type === 'integer') return Number.isSafeInteger(v) && v >= s.minimum && v <= (s.maximum ?? Infinity);
  if (s.type === 'string') return typeof v === 'string' && [...v].length >= (s.minLength ?? 0)
    && [...v].length <= (s.maxLength ?? Infinity) && (!s.pattern || new RegExp(s.pattern).test(v))
    && (!s.format || s.format === 'uuid' && uuid(v));
  if (s.type === 'object') return exact(v, s.required)
    && Object.entries(s.properties).every(([key, spec]) => scopeMatches(v[key], spec));
  return false;
}
function contextCopy(value) {
  if (!exact(value, ['scope', 'operation_id', 'semantic_sha256'])
    || !scopeMatches(value.scope, contract.$defs.BindingScope)
    || !uuid(value.operation_id) || !hash(value.semantic_sha256)) fail('IG04_INVALID_CONTEXT');
  return freeze(structuredClone(value));
}
function style(v) { return exact(v, ['value', 'priority']) && typeof v.value === 'string'
  && v.value.length <= 4096 && ['', 'important'].includes(v.priority); }
function planCopy(value, context) {
  // Local resource bound, not a change to any Wire or Core cleanup capacity.
  let p; try { if (JSON.stringify(value).length > 32768) fail('IG04_INVALID_PLAN'); p = structuredClone(value); }
  catch { fail('IG04_INVALID_PLAN'); }
  if (!exact(p, ['plan_id', 'claim', 'properties', 'generation', 'document_instance_id', 'gate_id', 'reservation_identity'])
    || !uuid(p.plan_id) || !uuid(p.gate_id) || !uuid(p.document_instance_id)
    || typeof p.claim !== 'string' || !p.claim || p.claim.length > 256
    || p.generation !== context.scope.generation || !Array.isArray(p.properties) || p.properties.length !== 2)
    fail('IG04_INVALID_PLAN');
  const [display, inert] = p.properties;
  if (!exact(display, ['property', 'current', 'restore', 'target']) || display.property !== 'display'
    || !style(display.current) || !style(display.restore) || !style(display.target)
    || display.target.value !== 'none' || display.target.priority !== 'important'
    || !exact(inert, ['property', 'current', 'restore', 'target']) || inert.property !== 'inert'
    || ![inert.current, inert.restore, inert.target].every(v => exact(v, ['value']) && typeof v.value === 'boolean')
    || inert.target.value !== true) fail('IG04_INVALID_PLAN');
  const i = p.reservation_identity;
  if (!exact(i, ['gate_id', 'plan_id', 'context_sha256', 'plan_sha256', 'operation_id', 'generation'])
    || i.gate_id !== p.gate_id || i.plan_id !== p.plan_id || i.operation_id !== context.operation_id
    || i.generation !== p.generation || !hash(i.context_sha256) || !hash(i.plan_sha256)) fail('IG04_INVALID_PLAN');
  return freeze(p);
}

/** Internal pre-reservation admission only. No storage writes, ACK, grant,
 * Content dispatch, result promotion or cleanup authorization is produced.
 * Trusted issued/native providers must verify the full original contracts,
 * frozen IG04 feature and registered channel; defaults deny. */
export class IG04PlanAdmission {
  #context; #registry; #issued; #native; #current; #now; #expires;
  #closed = false; #epoch; #ref; #gate = null;
  constructor(options, token) {
    if (token !== OPEN) fail('IG04_USE_VERIFIED_OPEN');
    this.#context = contextCopy(options.context);
    this.#registry = options.registry;
    this.#issued = options.verifyIssued ?? (() => false);
    this.#native = options.verifyNative ?? (() => false);
    this.#current = options.isCurrent ?? (() => false);
    this.#now = options.now ?? Date.now; this.#expires = options.expiresAt;
    if (!(this.#registry instanceof DocumentControlRegistry)
      || ![this.#issued, this.#native, this.#current, this.#now].every(v => typeof v === 'function')
      || !positive(this.#expires)) fail('IG04_PROVIDERS_REQUIRED');
    const s = this.#context.scope;
    this.#ref = freeze({executorKey: s.executor_id, tab: s.tab_id, frame: s.frame_id, documentKey: s.document_id});
  }
  static async open(options) {
    const gate = new IG04PlanAdmission(options, OPEN);
    try { await gate.#check(); return gate; } catch (error) { gate.invalidate(); throw error; }
  }
  invalidate() { this.#closed = true; }
  verifyContext(candidate) {
    if (this.#closed) return false;
    try {
      const at = this.#now(), result = this.#current(this.#context);
      if (result && typeof result.then === 'function') Promise.resolve(result).catch(() => {});
      if (!Number.isSafeInteger(at) || at < 0 || at >= this.#expires || result !== true) { this.invalidate(); return false; }
      return same(candidate, this.#context);
    } catch { this.invalidate(); return false; }
  }
  getGeneration() { return this.verifyContext(this.#context) ? this.#context.scope.generation : null; }
  assertCurrent() { if (!this.verifyContext(this.#context)) fail('IG04_AUTHORITY_CLOSED'); }
  async #document() {
    const row = await this.#registry.load(this.#ref);
    this.assertCurrent();
    if (!row || !same(row.ref, this.#ref) || row.lifecycle !== 'ACTIVE' || !positive(row.epoch)
      || this.#epoch !== undefined && row.epoch !== this.#epoch) fail('IG04_DOCUMENT_RECHECK_REQUIRED');
    this.#epoch = row.epoch;
  }
  async #check() {
    this.assertCurrent(); await this.#document();
    if (await this.#issued(this.#context) !== true) fail('IG04_ISSUED_UNCONFIRMED');
    this.assertCurrent();
    if (await this.#native(this.#context) !== true) fail('IG04_NATIVE_UNCONFIRMED');
    this.assertCurrent(); await this.#document();
  }
  async verifyPlan(value, {signal} = {}) {
    this.assertCurrent();
    const p = planCopy(value, this.#context);
    if (signal?.aborted) fail('IG04_RESERVATION_ABORTED');
    const {reservation_identity: i, ...base} = p;
    if (i.context_sha256 !== await digest(this.#context)
      || i.plan_sha256 !== await digest({...base, context_sha256: i.context_sha256})) fail('IG04_PLAN_HASH_MISMATCH');
    try { await this.#check(); } catch (error) { this.invalidate(); throw error; }
    if (signal?.aborted) fail('IG04_RESERVATION_ABORTED');
    const identity = [p.gate_id, p.document_instance_id];
    if (this.#gate !== null && !same(this.#gate, identity)) fail('IG04_GATE_MISMATCH');
    this.#gate = identity;
    this.assertCurrent();
    // Caller must still reserve durably and recheck authority immediately
    // before its write. This value is NOT the plan_id ACK expected by Content.
    return p;
  }
}
