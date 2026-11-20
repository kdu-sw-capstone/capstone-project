import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {calculateConservativeBudget as calculate} from '../src/additional-conservative-budget.js';
const input = patch => ({limitMs:60000,debitMs:10000,provisionalMs:5000,hasUnconfirmedGap:false,...patch});

test('verified unresolved reservation consumes budget without manufacturing confirmed usage',()=>{
  const value=input(),before=structuredClone(value),result=calculate(value);
  assert.equal(result.knownRemainingMs,45000);assert.equal(result.enforcementRemainingMs,45000);
  assert.equal(result.requiresBudgetRestriction,false);assert.deepEqual(result.localReasons,[]);
  assert.equal(result.localOnly,true);assert.ok(!Object.hasOwn(result,'confirmed_ms'));assert.deepEqual(value,before);
});
test('unknown length or day has no numeric known balance and requires only limited-site hold',()=>{
  const result=calculate(input({hasUnconfirmedGap:true}));
  assert.equal(result.knownRemainingMs,null);assert.equal(result.enforcementRemainingMs,0);
  assert.equal(result.requiresLimitedSiteHold,true);assert.equal(result.limitExhausted,false);
  assert.deepEqual(result.localReasons,['MEASUREMENT_UNCONFIRMED']);
});
test('a preexisting exhausted limit is preserved while measurement is unconfirmed',()=>{
  const result=calculate(input({debitMs:60000,hasUnconfirmedGap:true}));
  assert.equal(result.limitExhausted,true);assert.equal(result.knownRemainingMs,null);
  assert.deepEqual(result.localReasons,['DAILY_LIMIT','MEASUREMENT_UNCONFIRMED']);
});
for(const [name,debit,reserved,expected] of [
  ['one millisecond left',59999,0,1],['exact exhaustion',55000,5000,0],
  ['over limit',60001,0,0],['zero debit',0,0,60000],
])test('exact millisecond arithmetic: '+name,()=>{
  const result=calculate(input({debitMs:debit,provisionalMs:reserved}));
  assert.equal(result.enforcementRemainingMs,expected);assert.equal(result.limitExhausted,expected===0);
});
test('sum beyond safe integer saturates without wrapping or unsafe output',()=>{
  const result=calculate(input({debitMs:Number.MAX_SAFE_INTEGER,provisionalMs:Number.MAX_SAFE_INTEGER}));
  assert.equal(result.knownRemainingMs,0);assert.equal(result.enforcementRemainingMs,0);assert.equal(result.limitExhausted,true);
});
test('unlimited policy does not block because of uncertainty or inherited debit',()=>{
  for(const hasUnconfirmedGap of [true,false]){
    const result=calculate(input({limitMs:null,debitMs:Number.MAX_SAFE_INTEGER,hasUnconfirmedGap}));
    assert.equal(result.knownRemainingMs,null);assert.equal(result.enforcementRemainingMs,null);
    assert.equal(result.requiresBudgetRestriction,false);assert.equal(result.requiresLimitedSiteHold,false);
    assert.equal(result.measurementUnconfirmed,hasUnconfirmedGap);assert.deepEqual(result.localReasons,[]);
  }
});
test('approved policy schema minimum maximum and integer granularity remain unchanged',()=>{
  const schema=JSON.parse(readFileSync(new URL('../../contracts/additional-mvp/rc1/schema.json',import.meta.url),'utf8'));
  const shape=schema.$defs.SiteTimePolicy.properties.daily_limit_ms.anyOf.find(s=>s.type==='integer');
  for(const limitMs of [shape.minimum,shape.minimum+1,shape.maximum])
    assert.equal(calculate(input({limitMs,debitMs:0,provisionalMs:0})).knownRemainingMs,limitMs);
  for(const limitMs of [shape.minimum-1,shape.maximum+1])assert.throws(()=>calculate(input({limitMs})),/INVALID_CONSERVATIVE/);
});
for(const field of ['debitMs','provisionalMs'])test('malformed amounts cannot become free time: '+field,()=>{
  for(const value of [-1,0.5,NaN,Infinity,-Infinity,Number.MAX_SAFE_INTEGER+1,null,undefined,'5000',true])
    assert.throws(()=>calculate(input({[field]:value})),/INVALID_CONSERVATIVE/);
});
test('malformed policy and uncertainty values are rejected',()=>{
  for(const limitMs of [undefined,'60000',true,NaN,Infinity,60000.5,0,-1,Number.MAX_SAFE_INTEGER])
    assert.throws(()=>calculate(input({limitMs})),/INVALID_CONSERVATIVE/);
  for(const hasUnconfirmedGap of [undefined,null,0,1,'false',{},[]])
    assert.throws(()=>calculate(input({hasUnconfirmedGap})),/INVALID_CONSERVATIVE/);
});
test('incomplete or foreign fields do not silently default to zero or a normal state',()=>{
  for(const value of [null,undefined,[],{},60000])assert.throws(()=>calculate(value),/INVALID_CONSERVATIVE/);
  for(const field of Object.keys(input())){const value=input();delete value[field];assert.throws(()=>calculate(value),/INVALID_CONSERVATIVE/);}
  for(const field of ['verified','owner','remaining_ms','confirmed_ms','receipt'])
    assert.throws(()=>calculate({...input(),[field]:true}),/INVALID_CONSERVATIVE/);
});
test('equal verified replacement of provisional debit preserves the budget and prior debit',()=>{
  const before=calculate(input()),after=calculate(input({debitMs:15000,provisionalMs:0}));
  assert.deepEqual(after,before);
  // This tests arithmetic only; the calculator cannot authenticate a resolution.
  assert.equal(calculate(input({debitMs:15000,provisionalMs:0,hasUnconfirmedGap:true})).knownRemainingMs,null);
});
test('known balance stays monotone when existing debit or unresolved reservation increases',()=>{
  let seed=73;
  for(let i=0;i<300;i++){
    seed=(Math.imul(seed,1664525)+1013904223)>>>0;
    const value=input({limitMs:60000+seed%86340001,debitMs:seed%100000000,provisionalMs:seed%100000});
    const before=calculate(value).enforcementRemainingMs;
    for(const field of ['debitMs','provisionalMs']){
      const after=calculate({...value,[field]:value[field]+1}).enforcementRemainingMs;
      assert.ok(after<=before);assert.ok(after>=0);
    }
  }
});
test('immutable deterministic output never claims ALLOW, APPLIED, cleared obligation or receipt',()=>{
  const result=calculate(input());assert.deepEqual(result,calculate(input()));
  assert.ok(Object.isFrozen(result));assert.ok(Object.isFrozen(result.localReasons));
  assert.throws(()=>result.localReasons.push('ALLOW'),TypeError);
  for(const key of ['allowed','applied','receipt','operation_id','cleanup_complete','confirmed_ms','quality'])
    assert.ok(!Object.hasOwn(result,key));
});
