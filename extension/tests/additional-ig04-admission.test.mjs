import test from 'node:test';
import assert from 'node:assert/strict';
import {IDBFactory} from 'fake-indexeddb';
import {digest} from '../a1/contract.mjs';
import {DocumentControlRegistry} from '../src/document-control-registry.js';
import {IG04PlanAdmission} from '../src/additional-ig04-admission.js';

const id = () => crypto.randomUUID();
function context() { return {scope: {owner_binding_id: id(), owner_epoch: 1, executor_id: id(),
  runtime_execution_id: id(), package_id: id(), runtime_revision: 1, binding_id: id(), scope_epoch: id(),
  generation: 1, tab_id: 17, frame_id: 0, document_id: 'native-document', document_instance_id: id(),
  url_sha256: 'a'.repeat(64), focus_ref: null}, operation_id: id(), semantic_sha256: 'b'.repeat(64)}; }
async function fixture(overrides = {}) {
  const c = context(), registry = new DocumentControlRegistry({indexedDB: new IDBFactory()});
  const ref = {executorKey: c.scope.executor_id, tab: c.scope.tab_id, frame: 0, documentKey: c.scope.document_id};
  await registry.observe(ref);
  const state = {current: true, issued: true, native: true, at: 1000};
  const options = {context: c, registry, verifyIssued: () => state.issued, verifyNative: () => state.native,
    isCurrent: () => state.current, now: () => state.at, expiresAt: 2000, ...overrides};
  return {c, registry, ref, state, options, open: () => IG04PlanAdmission.open(options)};
}
async function plan(c, options = {}) {
  const base = {plan_id: id(), claim: 'private-claim:1', properties: [
    {property: 'display', current: {value: 'grid', priority: 'important'}, restore: {value: 'grid', priority: 'important'}, target: {value: 'none', priority: 'important'}},
    {property: 'inert', current: {value: false}, restore: {value: false}, target: {value: true}}],
  generation: c.scope.generation, document_instance_id: id(), gate_id: id(), ...options};
  const context_sha256 = await digest(c);
  return {...base, reservation_identity: {gate_id: base.gate_id, plan_id: base.plan_id, context_sha256,
    plan_sha256: await digest({...base, context_sha256}), operation_id: c.operation_id, generation: base.generation}};
}
const deferred = () => { let resolve; const promise = new Promise(r => {resolve = r;}); return {resolve, promise}; };

test('unavailable issued/native/current providers deny; constructor cannot bypass open', async () => {
  assert.throws(() => new IG04PlanAdmission({}), /USE_VERIFIED_OPEN/);
  for (const key of ['verifyIssued', 'verifyNative', 'isCurrent']) {
    const f = await fixture(); delete f.options[key]; await assert.rejects(f.open());
  }
});
test('verified plan is an immutable local value, never a Content ACK or durable write', async () => {
  const f = await fixture(), gate = await f.open(), p = await plan(f.c);
  const before = await f.registry.load(f.ref), result = await gate.verifyPlan(p);
  assert.deepEqual(result, p); assert.notEqual(result, p); assert.equal(Object.isFrozen(result.properties[0].restore), true);
  assert.notEqual(result, p.plan_id); assert.equal(gate.getGeneration(), 1);
  assert.deepEqual(await f.registry.load(f.ref), before);
});
test('context and plan copies cannot be rewritten while asynchronous verification waits', async () => {
  const f = await fixture(), gate = await f.open(), p = await plan(f.c), original = structuredClone(p);
  const wait = deferred(); f.options.verifyNative = () => true;
  // Reopen with a provider that pauses only its post-open verification.
  let calls = 0; f.options.verifyNative = () => ++calls === 1 ? true : wait.promise;
  const g = await f.open(), work = g.verifyPlan(p);
  p.properties[0].restore.value = 'block'; f.c.scope.generation = 99;
  wait.resolve(true); assert.deepEqual(await work, original);
  assert.equal(g.verifyContext(f.c), false); assert.equal(g.getGeneration(), 1);
  gate.invalidate();
});
for (const [name, change] of [
  ['owner epoch', c => {c.scope.owner_epoch = 0;}], ['tab bound', c => {c.scope.tab_id = 2147483648;}],
  ['foreign frame', c => {c.scope.frame_id = 1;}], ['missing field', c => {delete c.scope.document_id;}],
  ['extra scope', c => {c.scope.authorized = true;}], ['operation hash', c => {c.semantic_sha256 = 'fake';}],
  ['focus reference', c => {c.scope.focus_ref = {};}], ['extra context', c => {c.verified = true;}],
]) test('reject malformed context: ' + name, async () => {
  const f = await fixture(); change(f.c); await assert.rejects(f.open(), /INVALID_CONTEXT/);
});
test('valid frozen focus reference is preserved, malformed revision denied', async () => {
  const f = await fixture(); f.c.scope.focus_ref = {session_id: id(), snapshot_id: id(), snapshot_format: '1.2', snapshot_sha256: 'c'.repeat(64), desired_revision: 1};
  const g = await f.open(); assert.equal(g.verifyContext(f.c), true);
  f.c.scope.focus_ref.desired_revision = 0; await assert.rejects(f.open(), /INVALID_CONTEXT/);
});
for (const [name, mutate] of [
  ['original value', p => {p.properties[0].restore.value = 'block';}],
  ['claim', p => {p.claim = 'another-claim';}], ['hash', p => {p.reservation_identity.plan_sha256 = '0'.repeat(64);}],
  ['gate identity', p => {p.reservation_identity.gate_id = id();}],
  ['operation identity', p => {p.reservation_identity.operation_id = id();}],
  ['generation', p => {p.generation++;}], ['target', p => {p.properties[1].target.value = false;}],
  ['extra plan field', p => {p.authorized = true;}],
]) test('tampered plan rejected without registry mutation: ' + name, async () => {
  const f = await fixture(), g = await f.open(), p = await plan(f.c), before = await f.registry.load(f.ref);
  mutate(p); await assert.rejects(g.verifyPlan(p)); assert.deepEqual(await f.registry.load(f.ref), before);
});
for (const provider of ['verifyIssued', 'verifyNative']) test(provider + ' rechecks owner changes during await', async () => {
  const f = await fixture(); let calls = 0; const wait = deferred();
  f.options[provider] = () => ++calls === 1 ? true : wait.promise;
  const g = await f.open(), p = await plan(f.c), work = g.verifyPlan(p);
  f.state.current = false; wait.resolve(true); await assert.rejects(work, /AUTHORITY_CLOSED/);
  f.state.current = true; assert.equal(g.getGeneration(), null);
});
test('strict true required for async verifiers and sync current authority', async () => {
  for (const key of ['verifyIssued', 'verifyNative']) {
    const f = await fixture(); f.options[key] = () => ({verified: true}); await assert.rejects(f.open());
  }
  for (const read of [() => Promise.resolve(true), () => Promise.reject(Error('denied')), () => 1]) {
    const f = await fixture(); f.options.isCurrent = read; await assert.rejects(f.open());
  }
});
test('expiry during verification closes the gate permanently', async () => {
  const f = await fixture(), g = await f.open(), p = await plan(f.c); f.state.at = 2000;
  await assert.rejects(g.verifyPlan(p), /AUTHORITY_CLOSED/); f.state.at = 1000; assert.equal(g.getGeneration(), null);
});
test('native failure is not cleanup permission and does not change unresolved registry obligations', async () => {
  const f = await fixture(); const scope = {ownerKey: 'MEMBER:1', sessionKey: 's', snapshotKey: 'snap', revision: 1, bindingKey: 'b'};
  await f.registry.stage(f.ref, {operationKey: 'existing', action: 'APPLY', controlScope: scope});
  const g = await f.open(), p = await plan(f.c), before = await f.registry.pending(f.ref.executorKey);
  f.state.native = false; await assert.rejects(g.verifyPlan(p), /NATIVE_UNCONFIRMED/);
  assert.deepEqual(await f.registry.pending(f.ref.executorKey), before);
});
test('document replacement and BFCache return invalidate the old admission epoch', async () => {
  const f = await fixture(), g = await f.open(), p = await plan(f.c);
  await f.registry.observe({...f.ref, documentKey: 'replacement'}); await f.registry.observe(f.ref);
  await assert.rejects(g.verifyPlan(p), /DOCUMENT_RECHECK_REQUIRED/); assert.equal(g.getGeneration(), null);
});
test('destroyed and unknown documents cannot open an admission', async () => {
  const f = await fixture(); await f.registry.confirmGone(f.ref); await assert.rejects(f.open(), /DOCUMENT_RECHECK_REQUIRED/);
  const unknown = await fixture(); unknown.c.scope.document_id = 'unregistered'; await assert.rejects(unknown.open(), /DOCUMENT_RECHECK_REQUIRED/);
});
test('plan gate and document UUID remain pinned while plans within one gate can grow', async () => {
  const f = await fixture(), g = await f.open(), p = await plan(f.c); await g.verifyPlan(p);
  const next = await plan(f.c, {gate_id: p.gate_id, document_instance_id: p.document_instance_id, claim: 'private-claim:2'});
  await g.verifyPlan(next); await assert.rejects(g.verifyPlan(await plan(f.c)), /GATE_MISMATCH/);
});
test('aborted requests never produce admission and retain document state', async () => {
  const f = await fixture(), g = await f.open(), p = await plan(f.c), abort = new AbortController(); abort.abort();
  await assert.rejects(g.verifyPlan(p, {signal: abort.signal}), /RESERVATION_ABORTED/);
  assert.equal((await f.registry.load(f.ref)).operations.length, 0);
});
test('final synchronous guard remains necessary after a successful plan check', async () => {
  const f = await fixture(), g = await f.open(); await g.verifyPlan(await plan(f.c)); f.state.current = false;
  assert.throws(() => g.assertCurrent(), /AUTHORITY_CLOSED/);
});
test('abort during native verification does not admit the plan or close valid authority', async () => {
  const f = await fixture(), wait = deferred(); let calls = 0;
  f.options.verifyNative = () => ++calls === 1 ? true : wait.promise;
  const g = await f.open(), p = await plan(f.c), abort = new AbortController();
  const work = g.verifyPlan(p, {signal: abort.signal}); abort.abort(); wait.resolve(true);
  await assert.rejects(work, /RESERVATION_ABORTED/); assert.equal(g.getGeneration(), 1);
});
test('registry read failure closes admission without clearing the original durable row', async () => {
  const f = await fixture(), g = await f.open(), p = await plan(f.c);
  const read = f.registry.load.bind(f.registry), before = await read(f.ref);
  f.registry.load = async () => {throw Error('STORAGE_UNAVAILABLE');};
  await assert.rejects(g.verifyPlan(p), /STORAGE_UNAVAILABLE/);
  assert.equal(g.getGeneration(), null); assert.deepEqual(await read(f.ref), before);
});
