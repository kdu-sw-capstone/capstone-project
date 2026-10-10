import test from 'node:test';
import assert from 'node:assert/strict';
import {summarize} from '../src/member-events.js';
const scope={owner_key:'MEMBER:1',executor_id:'installation',base_url:'http://localhost/api/v1'};
const row=(event_id,status='QUEUED',extra={})=>({...scope,event_id,status,body:'original',...extra});
test('delivery summary deduplicates durable staging and outbox; terminal rejections stay distinct',()=>{
 const result=summarize([row('a','ACKED'),row('b','REJECTED'),row('c','RESPONSE_UNCONFIRMED')],
  [row('a'),row('b'),row('d')],scope);
 assert.equal(result.total,4);assert.equal(result.counts.ACKED,1);assert.equal(result.counts.REJECTED,1);
 assert.equal(result.counts.QUEUED,1);assert.equal(result.counts.RESPONSE_UNCONFIRMED,1);
 assert.deepEqual(Object.keys(result).sort(),['counts','total']);
});
test('delivery summary excludes other account, installation and staging server',()=>{
 assert.equal(summarize([row('a','ACKED',{owner_key:'MEMBER:2'}),row('b','ACKED',{executor_id:'old'})],
 [row('c','QUEUED',{base_url:'https://other.example/api/v1'})],scope).total,0);
});
test('unknown delivery state remains unconfirmed and inconsistent original is an error',()=>{
 assert.equal(summarize([row('a','UNKNOWN')],[],scope).counts.RESPONSE_UNCONFIRMED,1);
 assert.throws(()=>summarize([row('a')],[row('a','QUEUED',{body:'changed'})],scope),/CONFLICT/);
});
