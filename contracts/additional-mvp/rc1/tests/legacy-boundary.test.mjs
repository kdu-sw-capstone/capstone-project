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

test('RC2 cleanup null sequence is isolated from both legacy validators',()=>{
  const cleanup=fixtures.messages[5].value;
  assert.equal(cleanup.payload.release_mode,'CLEANUP_ONLY');
  assert.equal(cleanup.payload.control_seq,null);
  assert.equal(guestValid(cleanup,'control_request'),false);
  assert.equal(memberValid(cleanup,'control_request'),false);
});

test('RC2 cleanup semantic digest agrees across Python and existing JS canonical',()=>{
  const {semantic_sha256,channel_credential,...semantic}=fixtures.messages[5].value.payload;
  assert.equal(createHash('sha256').update(guestCanonical(semantic),'utf8').digest('hex'),semantic_sha256);
});


test('legacy actors reject read-only QUERY and its independent result',()=>{
  const f=JSON.parse(readFileSync(new URL('../decision-fixtures.json',import.meta.url),'utf8'));
  for(const m of [f.query,f.response]){
    assert.equal(guestValid(m,'control_request'),false);
    assert.equal(memberValid(m,'control_request'),false);
  }
  const clean={...f.query};delete clean.query_sha256;delete clean.channel_credential;
  assert.equal(createHash('sha256').update(guestCanonical(clean)).digest('hex'),f.query.query_sha256);
});
