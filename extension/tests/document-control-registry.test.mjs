import test from 'node:test';
import assert from 'node:assert/strict';
import { IDBFactory } from 'fake-indexeddb';
import { DocumentControlRegistry } from '../src/document-control-registry.js';
const ref = { executorKey: 'executor-1', tab: 7, frame: 0, documentKey: 'chrome-document-a' };
const scope = { ownerKey: 'GUEST:executor-1', sessionKey: 'session-1', snapshotKey: 'snapshot-1', revision: 1, bindingKey: 'binding-1' };
const apply = (operationKey = 'operation-1', controlScope = scope) => ({ operationKey, action: 'APPLY', controlScope });
const release = (operationKey = 'release-1', controlScope = scope) => ({ operationKey, action: 'RELEASE', controlScope });
async function fixture(options = {}) {
  const indexedDB = new IDBFactory(), registry = new DocumentControlRegistry({ indexedDB, ...options });
  await registry.observe(ref); return { registry, indexedDB };
}
test('commit before dispatch; recreated registry recovers original ticket without assuming success', async () => {
  const { registry, indexedDB } = await fixture(), staged = await registry.stage(ref, apply());
  const recovered = new DocumentControlRegistry({ indexedDB }), rows = await recovered.pending(ref.executorKey);
  assert.equal(rows[0].obligations[0].state, 'UNCONFIRMED');
  assert.deepEqual(rows[0].operations[0].ticket, staged.ticket);
  assert.equal((await recovered.stage(ref, apply())).duplicate, true);
  assert.equal((await recovered.load(ref)).sequence, 1);
});
test('independent instances allocate sequences atomically and fence older results', async () => {
  const { registry, indexedDB } = await fixture(), other = new DocumentControlRegistry({ indexedDB });
  await other.observe(ref);
  const results = await Promise.all([registry.stage(ref, apply()), other.stage(ref, apply('operation-2', { ...scope, bindingKey: 'binding-2' }))]);
  assert.deepEqual(results.map(item => item.ticket.sequence).sort(), [1, 2]);
  const older = results.find(item => item.ticket.sequence === 1);
  await assert.rejects(registry.complete(older.ticket, 'CONFIRMED'), /STALE_CONTROL_RESULT/);
});
test('duplicate apply after release returns historical result without reapplication; conflict is atomic', async () => {
  const { registry } = await fixture(), a = await registry.stage(ref, apply()); await registry.complete(a.ticket, 'CONFIRMED');
  const r = await registry.stage(ref, release()); await registry.complete(r.ticket, 'CONFIRMED');
  const old = await registry.stage(ref, apply()); assert.equal(old.result, 'CONFIRMED'); assert.equal(old.ticket.sequence, 1);
  assert.equal((await registry.load(ref)).obligations[0].state, 'RESTORED');
  await assert.rejects(registry.stage(ref, apply('operation-1', { ...scope, revision: 2 })), /OPERATION_CONFLICT/);
  assert.equal((await registry.load(ref)).sequence, 2);
});
test('replacement retains BFCache cleanup and rejects previous document apply result', async () => {
  const { registry } = await fixture(), a = await registry.stage(ref, apply()), next = { ...ref, documentKey: 'chrome-document-b' };
  await registry.observe(next); await assert.rejects(registry.complete(a.ticket, 'CONFIRMED'), /STALE_CONTROL_RESULT/);
  assert.equal((await registry.load(ref)).lifecycle, 'INACTIVE'); assert.equal((await registry.load(next)).sequence, 0);
  const r = await registry.stage(ref, release()); await registry.complete(r.ticket, 'CONFIRMED');
  await registry.observe(ref); assert.equal((await registry.load(ref)).sequence, 2);
});
test('confirmed destruction preserves original result and cannot remove the replacement active slot', async () => {
  const { registry } = await fixture(), a = await registry.stage(ref, apply()), next = { ...ref, documentKey: 'chrome-document-b' };
  await registry.observe(next); await registry.confirmGone(ref);
  const row = await registry.load(ref); assert.equal(row.obligations[0].state, 'DOCUMENT_GONE'); assert.equal(row.operations[0].result, null);
  await assert.rejects(registry.complete(a.ticket, 'CONFIRMED'), /STALE_CONTROL_RESULT/);
  await registry.stage(next, apply()); await assert.rejects(registry.observe(ref), /DOCUMENT_ALREADY_GONE/);
  assert.equal((await registry.load(next)).lifecycle, 'ACTIVE');
});
test('failed cleanup survives recreation; owner/session transitions and wrong cleanup binding reject', async () => {
  const { registry, indexedDB } = await fixture(); await registry.stage(ref, apply());
  const r = await registry.stage(ref, release()); await registry.complete(r.ticket, 'FAILED');
  const recovered = new DocumentControlRegistry({ indexedDB });
  assert.equal((await recovered.pending(ref.executorKey))[0].obligations[0].state, 'CLEANUP_UNCONFIRMED');
  await recovered.observe(ref);
  for (const change of [{ ownerKey: 'MEMBER:2' }, { sessionKey: 'session-2' }])
    await assert.rejects(recovered.stage(ref, apply('new-apply', { ...scope, ...change, bindingKey: 'binding-2' })), /CLEANUP_REQUIRED/);
  await assert.rejects(recovered.stage(ref, release('wrong', { ...scope, ownerKey: 'MEMBER:2' })), /UNKNOWN_CLEANUP_BINDING/);
  const retry = await recovered.stage(ref, release('release-2')); await recovered.complete(retry.ticket, 'CONFIRMED');
  await recovered.observe(ref);
  await recovered.stage(ref, apply('new-apply', { ...scope, ownerKey: 'MEMBER:2', bindingKey: 'binding-2' }));
});
test('release fences late apply; duplicate completion is inert and conflicting result rejects', async () => {
  const { registry } = await fixture(), a = await registry.stage(ref, apply()), r = await registry.stage(ref, release());
  await assert.rejects(registry.complete(a.ticket, 'CONFIRMED'), /STALE_CONTROL_RESULT/);
  await registry.complete(r.ticket, 'CONFIRMED');
  assert.deepEqual(await registry.complete(r.ticket, 'CONFIRMED'), { accepted: false, duplicate: true });
  await assert.rejects(registry.complete(r.ticket, 'FAILED'), /CONTROL_RESULT_CONFLICT/);
});
test('executor and tab isolate document state and pending obligations', async () => {
  const { registry } = await fixture(); await registry.stage(ref, apply());
  for (const other of [{ ...ref, tab: 8 }, { ...ref, executorKey: 'executor-2' }]) {
    await registry.observe(other); assert.equal((await registry.load(other)).sequence, 0);
  }
  assert.equal((await registry.pending('executor-2')).length, 0); assert.equal((await registry.pending(ref.executorKey)).length, 1);
});
test('credential-bearing scope and subframe input reject before persistence', async () => {
  const { registry } = await fixture();
  assert.throws(() => registry.stage(ref, apply('operation-1', { ...scope, token: 'must-not-store' })), /INVALID_CONTROL_SCOPE/);
  assert.throws(() => registry.observe({ ...ref, frame: 1 }), /INVALID_DOCUMENT_REFERENCE/);
  assert.equal((await registry.load(ref)).operations.length, 0);
});
test('capacity exhaustion stops apply but never blocks cleanup', async () => {
  const { registry } = await fixture({ operationLimit: 1 }); await registry.stage(ref, apply());
  await assert.rejects(registry.stage(ref, apply('operation-2', { ...scope, bindingKey: 'binding-2' })), /REGISTRY_CAPACITY/);
  const r = await registry.stage(ref, release()); await registry.complete(r.ticket, 'CONFIRMED');
  assert.equal((await registry.pending(ref.executorKey)).length, 0);
});
test('unavailable IndexedDB cannot yield a dispatch ticket', async () => {
  const registry = new DocumentControlRegistry({ indexedDB: { open() { throw new Error('storage unavailable'); } } });
  await assert.rejects(registry.observe(ref), /storage unavailable/);
});

test('reactivated document cannot accept pre-inactivation completion even with the same sequence', async () => {
  const { registry } = await fixture(), a = await registry.stage(ref, apply());
  await registry.observe({ ...ref, documentKey: 'chrome-document-b' }); await registry.observe(ref);
  await assert.rejects(registry.complete(a.ticket, 'CONFIRMED'), /STALE_CONTROL_RESULT/);
  assert.equal((await registry.load(ref)).obligations[0].state, 'UNCONFIRMED');
});
test('worker recreation requires trusted document recheck before new apply or pending apply completion', async () => {
  const { registry, indexedDB } = await fixture(), a = await registry.stage(ref, apply());
  const recovered = new DocumentControlRegistry({ indexedDB });
  await assert.rejects(recovered.stage(ref, apply('new', { ...scope, bindingKey: 'binding-2' })), /DOCUMENT_RECHECK_REQUIRED/);
  await assert.rejects(recovered.complete(a.ticket, 'CONFIRMED'), /DOCUMENT_RECHECK_REQUIRED/);
  await recovered.observe(ref); await recovered.complete(a.ticket, 'CONFIRMED');
});
test('transaction abort after put never yields a dispatch ticket and rolls back intent and sequence', async () => {
  const { registry } = await fixture(); const original = registry.transaction.bind(registry);
  registry.transaction = (mode, work) => original(mode, (documents, slots, done, run) => {
    const put = documents.put.bind(documents);
    documents.put = value => { put(value); throw new Error('synthetic write failure'); };
    work(documents, slots, done, run);
  });
  await assert.rejects(registry.stage(ref, apply()), /synthetic write failure/);
  registry.transaction = original;
  const row = await registry.load(ref); assert.equal(row.sequence, 0); assert.equal(row.obligations.length, 0);
});

test('same session cannot regress revision or change frozen snapshot while cleanup remains permitted', async () => {
  const { registry } = await fixture();
  await registry.stage(ref, apply('revision-2', { ...scope, revision: 2 }));
  await assert.rejects(registry.stage(ref, apply('old', { ...scope, bindingKey: 'binding-2' })), /STALE_SCOPE_REVISION/);
  await assert.rejects(registry.stage(ref, apply('changed', { ...scope, revision: 2, bindingKey: 'binding-2', snapshotKey: 'other' })), /FROZEN_SNAPSHOT_CONFLICT/);
  const r = await registry.stage(ref, release('cleanup', { ...scope, revision: 2 }));
  await registry.complete(r.ticket, 'CONFIRMED');
});
