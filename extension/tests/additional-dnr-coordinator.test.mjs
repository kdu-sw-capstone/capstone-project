import test from 'node:test';
import assert from 'node:assert/strict';
import { locks } from 'node:worker_threads';
import { IDBFactory } from 'fake-indexeddb';
import { createMemberDB } from '../member-a1/db.mjs';
import { digest } from '../a1/contract.mjs';
import { AdditionalDnrStore } from '../src/additional-dnr-store.js';
import { AdditionalDnrCoordinator } from '../src/additional-dnr-coordinator.js';

const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const rule = (n = 100000) => ({ id: n, priority: 1, action: { type: 'block' }, condition: { urlFilter: '||example.test^' } });
const own = (operation = 50, owner = 2, generation = 1) => ({ operationId: id(operation), ownerBindingId: id(owner), generation });
async function harness(options = {}) {
  const indexedDB = new IDBFactory();
  const base = createMemberDB(indexedDB, 'dnr-test');
  let abortWhen = () => false;
  const db = { transaction(mode, work) {
    return base.transaction(mode, (tx, done) => work(tx, result => {
      if (abortWhen(mode, result)) tx.abort(); else done(result);
    }));
  } };
  const store = new AdditionalDnrStore(db), banks = { SESSION: [], DYNAMIC: [] }, calls = [];
  const dnr = {};
  for (const [bank, suffix] of [['SESSION', 'Session'], ['DYNAMIC', 'Dynamic']]) {
    dnr[`get${suffix}Rules`] = async () => structuredClone(banks[bank]);
    dnr[`update${suffix}Rules`] = async ({ removeRuleIds }) => {
      calls.push({ bank, removeRuleIds: [...removeRuleIds] });
      banks[bank] = banks[bank].filter(r => !removeRuleIds.includes(r.id));
    };
  }
  // Fixture-only integration proof. Real service wiring must fence every legacy writer.
  const args = { store, dnr, locks, assertWritersGuarded: () => true, verifyAdoption: () => true, ...options };
  const service = new AdditionalDnrCoordinator(args), epoch = await service.startWriter();
  async function adopt(bank = 'SESSION', owner = 2, claimId = 1, generation = 1, value = rule()) {
    if (!banks[bank].some(r => r.id === value.id)) banks[bank].push(structuredClone(value));
    const claim = { claim_id: id(claimId), owner_binding_id: id(owner), generation,
      rule_key: { rule_store: bank, rule_id: value.id }, rule_sha256: await digest(value),
      writer_epoch: epoch, restore_state: 'APPLIED' };
    await service.adopt(epoch, claim, value);
    return claim;
  }
  return { db, base, store, service, epoch, banks, dnr, calls, args, adopt,
    fault: fn => { abortWhen = fn; }, freshStore: () => new AdditionalDnrStore(createMemberDB(indexedDB, 'dnr-test')) };
}

test('same ID across stores: release own session and preserve other runtime plus unmanaged rules', async () => {
  const h = await harness(); await h.adopt(); await h.adopt('DYNAMIC', 3, 3);
  h.banks.SESSION.push(rule(999));
  assert.equal(await h.service.releaseOwner(h.epoch, own()), 'RELEASED');
  assert.deepEqual(h.banks.SESSION.map(r => r.id), [999]);
  assert.deepEqual(h.banks.DYNAMIC.map(r => r.id), [100000]);
  const state = await h.freshStore().read();
  assert.equal(state.claims[0].restore_state, 'RELEASED');
  assert.equal(state.claims[1].restore_state, 'APPLIED');
  assert.equal(state.operations[0].state, 'RELEASED');
});
test('shared rule is removed only after final owner releases', async () => {
  const h = await harness(); await h.adopt(); await h.adopt('SESSION', 3, 3);
  await h.service.releaseOwner(h.epoch, own());
  assert.equal(h.calls.length, 0); assert.equal(h.banks.SESSION.length, 1);
  await h.service.releaseOwner(h.epoch, own(51, 3));
  assert.equal(h.banks.SESSION.length, 0); assert.equal(h.calls.length, 1);
});
test('no effects if durable intent transaction aborts', async () => {
  const h = await harness(); await h.adopt(); h.fault(mode => mode === 'readwrite');
  await assert.rejects(h.service.releaseOwner(h.epoch, own()), /DNR_STORAGE_UNCONFIRMED/);
  assert.equal(h.calls.length, 0); assert.equal(h.banks.SESSION.length, 1);
  h.fault(() => false);
  assert.equal((await h.store.read()).operations.length, 0);
});
test('effect then receipt write failure survives new store and writer; retry does not remove twice', async () => {
  const h = await harness(); await h.adopt();
  h.fault((mode, result) => mode === 'readwrite' && result === 'RELEASED');
  await assert.rejects(h.service.releaseOwner(h.epoch, own()), /DNR_STORAGE_UNCONFIRMED/);
  assert.equal(h.banks.SESSION.length, 0);
  assert.equal((await h.store.read()).claims[0].restore_state, 'RELEASE_PENDING');
  h.fault(() => false);
  const next = new AdditionalDnrCoordinator({ ...h.args, store: h.freshStore() });
  const epoch = await next.startWriter();
  await assert.rejects(h.service.releaseOwner(h.epoch, own()), /STALE_DNR_WRITER/);
  assert.equal(await next.releaseOwner(epoch, own()), 'RELEASED');
  assert.equal(await next.releaseOwner(epoch, own()), 'DUPLICATE');
  assert.equal(h.calls.length, 1);
});
test('crash between stores keeps intent and retries only remaining physical rule', async () => {
  const h = await harness(); await h.adopt(); await h.adopt('DYNAMIC', 2, 3);
  const update = h.dnr.updateDynamicRules;
  h.dnr.updateDynamicRules = async () => { throw Error('injected API failure'); };
  await assert.rejects(h.service.releaseOwner(h.epoch, own()), /injected/);
  assert.equal(h.banks.SESSION.length, 0); assert.equal(h.banks.DYNAMIC.length, 1);
  assert.equal((await h.store.read()).operations[0].state, 'IN_DOUBT');
  h.dnr.updateDynamicRules = update;
  assert.equal(await h.service.releaseOwner(h.epoch, own()), 'RELEASED');
  assert.deepEqual(h.calls.map(c => c.bank), ['SESSION', 'DYNAMIC']);
});
test('changed rule or failed store read prevents any deletion', async () => {
  for (const mode of ['changed', 'failed']) {
    const h = await harness(); await h.adopt(); await h.adopt('DYNAMIC', 2, 3);
    if (mode === 'changed') h.banks.DYNAMIC[0].priority = 9;
    else h.dnr.getDynamicRules = async () => { throw Error('offline'); };
    await assert.rejects(h.service.releaseOwner(h.epoch, own()), /DNR_(FOOTPRINT|READ)_UNCONFIRMED/);
    assert.equal(h.calls.length, 0);
    assert.equal((await h.store.read()).operations[0].state, 'IN_DOUBT');
  }
});
test('API resolved promise is not release proof; a still-present rule keeps obligation', async () => {
  const h = await harness(); await h.adopt(); h.dnr.updateSessionRules = async () => {};
  await assert.rejects(h.service.releaseOwner(h.epoch, own()), /DNR_RELEASE_UNCONFIRMED/);
  assert.equal((await h.store.read()).claims[0].restore_state, 'RELEASE_PENDING');
});
test('duplicate identity is bound to owner/generation and unowned requests cannot succeed', async () => {
  const h = await harness(); await h.adopt(); await h.service.releaseOwner(h.epoch, own());
  assert.equal(await h.service.releaseOwner(h.epoch, own()), 'DUPLICATE');
  await assert.rejects(h.service.releaseOwner(h.epoch, own(50, 3)), /IDEMPOTENCY_CONFLICT/);
  await assert.rejects(h.service.releaseOwner(h.epoch, own(51, 3)), /UNOWNED_RELEASE/);
  assert.equal(h.calls.length, 1);
});
test('cleanup capacity reserves before adoption and returns only after confirmed release', async () => {
  const h = await harness({ cleanupCapacity: 1 }); await h.adopt();
  await assert.rejects(h.adopt('DYNAMIC', 3, 3), /CLEANUP_RESERVATION_EXHAUSTED/);
  assert.equal(h.banks.DYNAMIC.length, 1);
  h.dnr.updateSessionRules = async () => { throw Error('failed'); };
  await assert.rejects(h.service.releaseOwner(h.epoch, own()));
  await assert.rejects(h.adopt('DYNAMIC', 3, 3), /CLEANUP_RESERVATION_EXHAUSTED/);
  h.dnr.updateSessionRules = async () => { h.banks.SESSION = []; };
  await h.service.releaseOwner(h.epoch, own());
  await h.adopt('DYNAMIC', 3, 3);
  assert.equal((await h.store.read()).operations[0].state, 'RELEASED');
});
test('pending keys block adoption and terminal owners cannot resurrect claims', async () => {
  const h = await harness(); await h.adopt();
  h.dnr.updateSessionRules = async () => { throw Error('failed'); };
  await assert.rejects(h.service.releaseOwner(h.epoch, own()));
  await assert.rejects(h.adopt('SESSION', 3, 3), /DNR_RELEASE_PENDING/);
  await assert.rejects(h.adopt('DYNAMIC', 2, 4), /DNR_OWNER_CLOSED/);
});
test('common Web Lock serializes writer takeover after an in-flight release', async () => {
  const h = await harness(); await h.adopt();
  let proceed, entered;
  const waiting = new Promise(resolve => { entered = resolve; });
  const hold = new Promise(resolve => { proceed = resolve; });
  h.dnr.updateSessionRules = async () => { entered(); await hold; h.banks.SESSION = []; };
  const release = h.service.releaseOwner(h.epoch, own()); await waiting;
  const next = new AdditionalDnrCoordinator(h.args);
  const takeover = next.startWriter();
  assert.equal((await h.store.read()).writer_epoch, h.epoch);
  proceed(); assert.equal(await release, 'RELEASED');
  assert.equal(await takeover, h.epoch + 1);
  await assert.rejects(h.service.releaseOwner(h.epoch, own()), /STALE_DNR_WRITER/);
});
test('adoption requires external ownership evidence and production activation requires legacy guard', async () => {
  const h = await harness({ verifyAdoption: () => false });
  await assert.rejects(h.adopt(), /DNR_OWNERSHIP_UNVERIFIED/);
  const unguarded = new AdditionalDnrCoordinator({ store: h.store, dnr: h.dnr, locks });
  await assert.rejects(unguarded.startWriter(), /LEGACY_WRITER_NOT_FENCED/);
  const unlocked = new AdditionalDnrCoordinator({ ...h.args, locks: null });
  await assert.rejects(unlocked.startWriter(), /DNR_WRITER_LOCK_UNAVAILABLE/);
});
test('sidecar leaves legacy metadata and Journal1.1 rows intact', async () => {
  const h = await harness();
  const old = { owner_key: 'GUEST:legacy', session_id: 'legacy', rules: [rule()] };
  await h.base.transaction('readwrite', (tx, done) => {
    tx.objectStore('metadata').put({ key: 'current', owner_key: old.owner_key, session_id: old.session_id });
    tx.objectStore('journal').put(old); done(null);
  });
  await h.adopt(); await h.service.releaseOwner(h.epoch, own());
  const legacy = await h.base.transaction('readonly', (tx, done) => {
    const r = tx.objectStore('journal').get([old.owner_key, old.session_id]); r.onsuccess = () => done(r.result);
  });
  assert.deepEqual(legacy, old);
});
test('revoked writer integration proof blocks even a receipt replay', async () => {
  const h = await harness(); await h.adopt(); await h.service.releaseOwner(h.epoch, own());
  h.service.assertWritersGuarded = () => false;
  await assert.rejects(h.service.releaseOwner(h.epoch, own()), /LEGACY_WRITER_NOT_FENCED/);
  assert.equal(h.calls.length, 1);
});
test('corrupt persisted receipt cannot silently discharge still-pending claims', async () => {
  const h = await harness(); await h.adopt();
  h.dnr.updateSessionRules = async () => { throw Error('failed'); };
  await assert.rejects(h.service.releaseOwner(h.epoch, own()));
  await h.base.transaction('readwrite', (tx, done) => {
    const md = tx.objectStore('metadata'), r = md.get('amvp_journal_v1:dnr');
    r.onsuccess = () => { r.result.operations[0].state = 'RELEASED'; md.put(r.result); done(null); };
  });
  await assert.rejects(h.service.releaseOwner(h.epoch, own()), /INVALID_DNR_JOURNAL/);
  assert.equal(h.banks.SESSION.length, 1);
});
