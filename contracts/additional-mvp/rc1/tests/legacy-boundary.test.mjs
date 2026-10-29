import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {valid as guestValid,canonical as guestCanonical} from '../../../../extension/a1/contract.mjs';
import {valid as memberValid} from '../../../../extension/member-a1/contract.mjs';
const fixtures=JSON.parse(readFileSync(new URL('../wire-fixtures.json',import.meta.url),'utf8'));
test('old Guest and Member validators safely reject the new content control',()=>{
  const control=fixtures.messages[0].value;
  assert.equal(guestValid(control,'control_request'),false);
  assert.equal(memberValid(control,'control_request'),false);
});
test('new release cannot be interpreted as legacy APPLY_POLICY/D06 control',()=>{
  const release=fixtures.messages[2].value;
  assert.equal(guestValid(release,'control_request'),false);
  assert.equal(memberValid(release,'control_request'),false);
});
test('Python contract canonical hash agrees with existing JS canonical for the shared integer profile',()=>{
  const v=fixtures.canonical_vector;
  assert.equal(createHash('sha256').update(guestCanonical(v.value),'utf8').digest('hex'),v.sha256);
});
