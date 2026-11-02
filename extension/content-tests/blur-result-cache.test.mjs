import test from 'node:test';
import assert from 'node:assert/strict';
import {BlurResultCache} from '../content-tools/blur-site/result-cache.mjs';
test('cached numeric result is isolated; expired, failed, other profile/pixels cannot be reused',()=>{
  let now=0;const cache=new BlurResultCache({limit:2,ttl:10,now:()=>now});const result={verdict:'SENSITIVE',stages:[{score:.9}]};
  cache.set('profile:pixels',result);result.stages[0].score=0;const hit=cache.get('profile:pixels');assert.equal(hit.stages[0].score,.9);hit.stages[0].score=0;assert.equal(cache.get('profile:pixels').stages[0].score,.9);
  assert.equal(cache.get('other:pixels'),null);cache.set('failed',{verdict:'FAILED'});assert.equal(cache.get('failed'),null);
  now=10;assert.equal(cache.get('profile:pixels'),null);
});
test('cache eviction is bounded LRU and never changes verdict',()=>{
  const cache=new BlurResultCache({limit:2});cache.set('a',{verdict:'SAFE'});cache.set('b',{verdict:'SENSITIVE'});cache.get('a');cache.set('c',{verdict:'SAFE'});assert.equal(cache.get('b'),null);assert.equal(cache.get('a').verdict,'SAFE');assert.equal(cache.get('c').verdict,'SAFE');
});
