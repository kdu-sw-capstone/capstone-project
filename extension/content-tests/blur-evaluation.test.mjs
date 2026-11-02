import test from 'node:test';
import assert from 'node:assert/strict';
import {evaluateBlurResults} from '../content/blur-evaluation.mjs';
test('no labels means no accuracy claim',()=>{
  const r=evaluateBlurResults([{index:1,verdict:'SAFE'}],{});
  assert.equal(r.accuracy,null);assert.equal(r.precision,null);assert.equal(r.recall,null);assert.equal(r.unlabeled,1);
});
test('false positives and misses stay distinct; failed analysis is not a safe prediction',()=>{
  const r=evaluateBlurResults([{index:1,verdict:'SENSITIVE'},{index:2,verdict:'SAFE'},{index:3,verdict:'SENSITIVE'},{index:4,verdict:'SAFE'},{index:5,verdict:'FAILED'}],{1:'SENSITIVE',2:'SENSITIVE',3:'SAFE',4:'SAFE',5:'SAFE'});
  assert.equal(r.labeled,4);assert.equal(r.labeled_pending_or_failed,1);assert.equal(r.false_positive,1);assert.equal(r.false_negative,1);assert.equal(r.true_positive,1);assert.equal(r.true_negative,1);assert.equal(r.accuracy,.5);assert.equal(r.precision,.5);assert.equal(r.recall,.5);assert.equal(r.representative_dataset_verified,false);
});
