import test from 'node:test';
import assert from 'node:assert/strict';
import { ClaimLedger } from '../content/claim-ledger.mjs';

function fixture() {
  const values = new Map([['display', ['grid', '']], ['filter', ['brightness(.8)', '']]]);
  let denied = null, silent = null;
  const document = { defaultView: { getComputedStyle: e => ({ display: e.style.getPropertyValue('display') }) } };
  const element = { ownerDocument: document, inert: false, isConnected: true, style: {
    getPropertyValue: name => values.get(name)?.[0] ?? '',
    getPropertyPriority: name => values.get(name)?.[1] ?? '',
    setProperty(name, value, priority = '') {
      if (name === denied) throw Error('fixture setter denied');
      if (name !== silent) values.set(name, [value, priority]);
    },
    removeProperty(name) { if (name === denied) throw Error('fixture setter denied'); if (name !== silent) values.delete(name); },
  } };
  return { document, element, ledger: new ClaimLedger(document), deny: name => denied = name, ignore: name => silent = name };
}

test('shared node stays hidden until the final independent owner releases', () => {
  const { ledger, element } = fixture();
  assert.equal(ledger.hide('focus:comments', element), true);
  assert.equal(ledger.hide('runtime:gate', element), true);
  assert.equal(ledger.release('focus:comments').restored, true);
  assert.equal(element.style.getPropertyValue('display'), 'none');
  assert.equal(element.inert, true);
  assert.equal(ledger.inspect('runtime:gate').remaining_targets, 1);
  assert.equal(ledger.release('runtime:gate').restored, true);
  assert.equal(element.style.getPropertyValue('display'), 'grid');
  assert.equal(element.inert, false);
});

test('grayscale composes with page filter and two owners without accumulating', () => {
  const { ledger, element } = fixture();
  for (let i = 0; i < 3; i++) assert.equal(ledger.grayscale('focus:gray', element), true);
  ledger.grayscale('second:gray', element);
  assert.equal(element.style.getPropertyValue('filter'), 'brightness(.8) grayscale(1)');
  ledger.release('focus:gray');
  assert.equal(element.style.getPropertyValue('filter'), 'brightness(.8) grayscale(1)');
  ledger.release('second:gray');
  assert.equal(element.style.getPropertyValue('filter'), 'brightness(.8)');
});

test('page edits survive release with and without an intermediate rescan', () => {
  for (const rescan of [false, true]) {
    const { ledger, element } = fixture();
    ledger.hide('focus:hide', element);
    element.style.setProperty('display', 'flex', 'important'); element.inert = false;
    if (rescan) ledger.hide('focus:hide', element);
    assert.equal(ledger.release('focus:hide').restored, true);
    assert.equal(element.style.getPropertyValue('display'), 'flex');
    assert.equal(element.style.getPropertyPriority('display'), 'important');
    assert.equal(element.inert, false);
  }
});

test('removing one owner reconciles a page edit and preserves it for final release', () => {
  const { ledger, element } = fixture();
  ledger.hide('A', element); ledger.hide('B', element);
  element.style.setProperty('display', 'flex'); element.inert = false;
  ledger.release('A');
  assert.equal(element.style.getPropertyValue('display'), 'none');
  assert.equal(element.inert, true);
  ledger.release('B');
  assert.equal(element.style.getPropertyValue('display'), 'flex');
  assert.equal(element.inert, false);
});

test('hide and filter resources can be independently released on the same node', () => {
  const { ledger, element } = fixture();
  ledger.hide('hide', element); ledger.grayscale('gray', element);
  ledger.release('hide');
  assert.equal(element.style.getPropertyValue('display'), 'grid');
  assert.equal(element.style.getPropertyValue('filter'), 'brightness(.8) grayscale(1)');
  ledger.release('gray');
  assert.equal(ledger.inspect().remaining_targets, 0);
});

test('a failed restore remains owned and can be retried', () => {
  const { ledger, element, deny } = fixture();
  ledger.hide('owner', element); deny('display');
  const failed = ledger.release('owner');
  assert.equal(failed.restored, false); assert.equal(failed.remaining_targets, 1);
  assert.equal(failed.error_count, 1);
  deny(null);
  assert.equal(ledger.release('owner').restored, true);
  assert.equal(element.style.getPropertyValue('display'), 'grid');
});

test('silent setter failure and detached nodes do not discard unresolved cleanup', () => {
  const { ledger, element, ignore } = fixture();
  ledger.hide('owner', element); element.isConnected = false; ignore('display');
  assert.equal(ledger.release('owner').restored, false);
  assert.equal(ledger.inspect('owner').remaining_targets, 1);
  ignore(null);
  assert.equal(ledger.release('owner').restored, true);
});

test('new effects close on lifecycle invalidation; original cleanup remains available', () => {
  const { ledger, element } = fixture();
  ledger.hide('owner', element); ledger.suspend();
  assert.throws(() => ledger.hide('new', element), /DOCUMENT_EFFECTS_CLOSED/);
  assert.equal(ledger.release('owner').restored, true);
});

test('cross-document nodes and empty claim identities cannot mutate effects', () => {
  const { ledger, element } = fixture();
  const other = fixture();
  assert.throws(() => ledger.hide('owner', other.element), /FOREIGN_DOCUMENT/);
  assert.throws(() => ledger.hide('', element), /INVALID_CLAIM_ID/);
  assert.equal(element.style.getPropertyValue('display'), 'grid');
});
