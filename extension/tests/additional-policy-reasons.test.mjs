import test from 'node:test';
import assert from 'node:assert/strict';
import {composePolicyReasons as compose} from '../src/additional-policy-reasons.js';
const input = patch => ({focusAccess:'ALLOW',runtimeReasons:[],exceptions:{adultDomain:false,keyword:false},...patch});

for(const [name,value,reasons] of [
  ['focus ALLOW cannot bypass quota',input({runtimeReasons:['DAILY_LIMIT']}),['DAILY_LIMIT']],
  ['focus RECORD cannot bypass block window',input({focusAccess:'RECORD',runtimeReasons:['BLOCK_WINDOW']}),['BLOCK_WINDOW']],
  ['adult exception cannot remove quota',input({runtimeReasons:['ADULT_DOMAIN','DAILY_LIMIT'],exceptions:{adultDomain:true,keyword:false}}),['DAILY_LIMIT']],
  ['keyword exception cannot remove adult',input({runtimeReasons:['KEYWORD','ADULT_DOMAIN'],exceptions:{adultDomain:false,keyword:true}}),['ADULT_DOMAIN']],
  ['quota cannot erase focus BLOCK',input({focusAccess:'BLOCK',runtimeReasons:['DAILY_LIMIT']}),['DAILY_LIMIT','USER_SITE']],
  ['outside allowed window remains a block',input({runtimeReasons:['OUTSIDE_ALLOW_WINDOW']}),['OUTSIDE_ALLOW_WINDOW']],
])test(name,()=>{
  const result=compose(value);assert.equal(result.candidateAccess,'BLOCK');assert.equal(result.requiresRestriction,true);
  assert.deepEqual(result.localReasons,reasons);assert.equal(result.localOnly,true);
});
test('both exceptions preserve independent windows, quota, measurement hold and focus block',()=>{
  const result=compose(input({focusAccess:'BLOCK',runtimeReasons:['KEYWORD','ADULT_DOMAIN','DAILY_LIMIT','BLOCK_WINDOW','OUTSIDE_ALLOW_WINDOW','MEASUREMENT_UNCONFIRMED'],exceptions:{adultDomain:true,keyword:true}}));
  assert.deepEqual(result.localReasons,['BLOCK_WINDOW','DAILY_LIMIT','MEASUREMENT_UNCONFIRMED','OUTSIDE_ALLOW_WINDOW','USER_SITE']);
});
test('no runtime reasons retains each frozen focus access without inventing a receipt',()=>{
  for(const focusAccess of ['ALLOW','RECORD','BLOCK']){
    const result=compose(input({focusAccess}));assert.equal(result.candidateAccess,focusAccess);
    assert.deepEqual(result.localReasons,focusAccess==='BLOCK'?['USER_SITE']:[]);
    assert.equal(result.requiresRestriction,focusAccess==='BLOCK');
  }
});
test('multiple matching policies retain every distinct constraint and ignore order/duplicates',()=>{
  const first=['DAILY_LIMIT','BLOCK_WINDOW','OUTSIDE_ALLOW_WINDOW','BLOCK_WINDOW','DAILY_LIMIT'];
  assert.deepEqual(compose(input({runtimeReasons:first})),compose(input({runtimeReasons:[...first].reverse()})));
  assert.deepEqual(compose(input({runtimeReasons:first})).localReasons,['BLOCK_WINDOW','DAILY_LIMIT','OUTSIDE_ALLOW_WINDOW']);
});
test('measurement hold cannot be lifted by focus ALLOW or feature exceptions',()=>{
  const result=compose(input({runtimeReasons:['MEASUREMENT_UNCONFIRMED'],exceptions:{adultDomain:true,keyword:true}}));
  assert.equal(result.candidateAccess,'BLOCK');assert.deepEqual(result.localReasons,['MEASUREMENT_UNCONFIRMED']);
});
test('absence of a reason-specific restriction is not changed by its exception',()=>{
  assert.equal(compose(input({exceptions:{adultDomain:true,keyword:true}})).candidateAccess,'ALLOW');
  assert.equal(compose(input({focusAccess:'RECORD',exceptions:{adultDomain:true,keyword:true}})).candidateAccess,'RECORD');
});
test('unsupported or unavailable reason values cannot silently become unrestricted',()=>{
  for(const reason of ['UNKNOWN','NOT_FOUND','ALLOW','USER_SITE','RELEASED','',null,undefined,0,true,{}])
    assert.throws(()=>compose(input({runtimeReasons:[reason]})),/INVALID_POLICY_REASONS/);
  assert.throws(()=>compose(input({runtimeReasons:new Array(1)})),/INVALID_POLICY_REASONS/);
});
test('runtime provider output must be an explicit array',()=>{
  for(const runtimeReasons of [null,undefined,'DAILY_LIMIT',false,0,{},new Set(['DAILY_LIMIT']),Promise.resolve([])])
    assert.throws(()=>compose(input({runtimeReasons})),/INVALID_POLICY_REASONS/);
});
test('focus policy cannot be inferred from a purpose label or absent input',()=>{
  for(const focusAccess of ['FOCUS','DISTRACTION','GENERAL','UNKNOWN',null,undefined,false,{}])
    assert.throws(()=>compose(input({focusAccess})),/INVALID_POLICY_REASONS/);
  assert.throws(()=>compose({...input(),purpose:'GENERAL'}),/INVALID_POLICY_REASONS/);
});
test('exceptions require exact own feature boolean flags',()=>{
  for(const exceptions of [null,undefined,{},[],{adultDomain:true},{adultDomain:'true',keyword:false},{adultDomain:false,keyword:1},{adultDomain:true,keyword:true,quota:true}])
    assert.throws(()=>compose(input({exceptions})),/INVALID_POLICY_REASONS/);
});
test('missing fields and malformed input do not default to ALLOW',()=>{
  for(const value of [null,undefined,{},[],true,'ALLOW'])assert.throws(()=>compose(value),/INVALID_POLICY_REASONS/);
  for(const key of Object.keys(input())){const value=input();delete value[key];assert.throws(()=>compose(value),/INVALID_POLICY_REASONS/);}
});
test('inputs remain unchanged and output is immutable and deterministic',()=>{
  const value=input({runtimeReasons:['KEYWORD','DAILY_LIMIT']}),before=structuredClone(value),result=compose(value);
  assert.deepEqual(value,before);assert.deepEqual(result,compose(value));assert.ok(Object.isFrozen(result));assert.ok(Object.isFrozen(result.localReasons));
  assert.throws(()=>result.localReasons.push('ALLOW'),TypeError);assert.throws(()=>{result.candidateAccess='ALLOW';},TypeError);
});
test('candidate does not mutate policies or claim any application, timing or cleanup proof',()=>{
  const result=compose(input());
  for(const key of ['applied','receipt','operation_id','confirmed_ms','quality','cleanup_complete','release_scope','session_status'])assert.ok(!Object.hasOwn(result,key));
  assert.deepEqual(Object.keys(result).sort(),['candidateAccess','localOnly','localReasons','requiresRestriction']);
});
