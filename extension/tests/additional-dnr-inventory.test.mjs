import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { digest } from '../a1/contract.mjs';
import { inspectAdditionalDnr } from '../src/additional-dnr-inventory.js';

const examples = JSON.parse(await readFile(new URL('../../contracts/additional-mvp/rc1/examples.json', import.meta.url)));
const rule = { id: 100000, priority: 1, action: { type: 'block' }, condition: { urlFilter: '||example.test^' } };
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
async function claim(store = 'SESSION', fields = {}) {
  return { ...structuredClone(examples.definitions.DnrClaim), claim_id: id(1), owner_binding_id: id(2),
    generation: 1, writer_epoch: 1, restore_state: 'APPLIED',
    rule_key: { rule_store: store, rule_id: rule.id }, rule_sha256: await digest(rule), ...fields };
}
function api(session = [rule], dynamic = []) {
  return { async getSessionRules() { return session; }, async getDynamicRules() { return dynamic; },
    updateSessionRules() { assert.fail('inventory must not mutate SESSION'); },
    updateDynamicRules() { assert.fail('inventory must not mutate DYNAMIC'); } };
}

test('same numeric ID in different stores is compared independently', async () => {
  const changed = { ...rule, priority: 2 };
  const result = await inspectAdditionalDnr(api([rule], [changed]), [await claim(), await claim('DYNAMIC', { claim_id: id(3) })]);
  assert.deepEqual(result.comparisons.map(row => row.comparison), ['MATCH', 'MISMATCH']);
  assert.deepEqual(result.comparisons.map(row => row.rule_key.rule_store), ['SESSION', 'DYNAMIC']);
});
test('shared rule retains all other owner and generation obligations', async () => {
  const claims = [await claim(), await claim('SESSION', { claim_id: id(3), owner_binding_id: id(4) }),
    await claim('SESSION', { claim_id: id(5), generation: 2 })];
  const before = structuredClone(claims);
  const result = await inspectAdditionalDnr(api(), claims);
  assert.deepEqual(result.comparisons[0].other_owner_claim_ids, [id(3), id(5)]);
  assert.ok(result.comparisons.every(row => row.comparison === 'MATCH'));
  assert.deepEqual(claims, before);
});
test('conflicting registry footprints cannot be considered verified ownership', async () => {
  const result = await inspectAdditionalDnr(api(), [await claim(), await claim('SESSION', { claim_id: id(3), rule_sha256: 'f'.repeat(64) })]);
  assert.ok(result.comparisons.every(row => row.comparison === 'CLAIM_CONFLICT'));
});
test('missing session rule never becomes a released claim or a browser restart proof', async () => {
  const result = await inspectAdditionalDnr(api([], [rule]), [await claim(), await claim('DYNAMIC', { claim_id: id(3) })]);
  assert.equal(result.comparisons[0].comparison, 'MISSING');
  assert.equal(result.comparisons[0].restore_state, 'APPLIED');
  assert.equal(result.comparisons[1].comparison, 'MATCH');
});
test('one failed store remains UNKNOWN while the other is observed', async () => {
  const dnr = api();
  dnr.getSessionRules = async () => { throw new Error('private URL must not escape'); };
  const result = await inspectAdditionalDnr(dnr, [await claim()]);
  assert.equal(result.comparisons[0].comparison, 'UNKNOWN');
  assert.equal(result.observations.DYNAMIC.status, 'OBSERVED');
  assert.ok(!JSON.stringify(result).includes('private URL'));
});
test('unavailable or malformed browser results are not absence evidence', async () => {
  for (const dnr of [{}, api([rule, rule]), api(null)]) {
    const result = await inspectAdditionalDnr(dnr, [await claim()]);
    assert.equal(result.comparisons[0].comparison, 'UNKNOWN');
  }
});
test('unmanaged rules and released historical claims are never adopted', async () => {
  const result = await inspectAdditionalDnr(api([rule], [rule]), [await claim('SESSION', { restore_state: 'RELEASED' })]);
  assert.deepEqual(result.comparisons, []);
  assert.deepEqual(result.unmanaged_rule_keys, [{ rule_store: 'SESSION', rule_id: rule.id }, { rule_store: 'DYNAMIC', rule_id: rule.id }]);
});
test('invalid registry identities fail before Chrome access', async () => {
  const good = await claim();
  const bad = [null, {}, [good, good], [{ ...good, writer_epoch: 0 }], [{ ...good, generation: true }],
    [{ ...good, unexpected: 1 }], [{ ...good, rule_key: { rule_store: 'STATIC', rule_id: 1 } }]];
  const dnr = { getSessionRules() { assert.fail('must validate first'); }, getDynamicRules() { assert.fail('must validate first'); } };
  for (const value of bad) await assert.rejects(inspectAdditionalDnr(dnr, value), /INVALID_DNR_CLAIMS/);
});
test('caller changes during the asynchronous read cannot rewrite captured claims', async () => {
  const claims = [await claim()];
  const dnr = api();
  dnr.getSessionRules = async () => { claims[0].owner_binding_id = id(99); return [rule]; };
  const result = await inspectAdditionalDnr(dnr, claims);
  assert.equal(result.comparisons[0].owner_binding_id, id(2));
});
