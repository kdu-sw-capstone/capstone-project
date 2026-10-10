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
 assert.deepEqual(Object.keys(result).sort(),['counts','next_retry_at','retry_after_at','total']);
});
test('delivery summary excludes other account, installation and staging server',()=>{
 assert.equal(summarize([row('a','ACKED',{owner_key:'MEMBER:2'}),row('b','ACKED',{executor_id:'old'})],
 [row('c','QUEUED',{base_url:'https://other.example/api/v1'})],scope).total,0);
});
test('unknown delivery state remains unconfirmed and inconsistent original is an error',()=>{
 assert.equal(summarize([row('a','UNKNOWN')],[],scope).counts.RESPONSE_UNCONFIRMED,1);
 assert.throws(()=>summarize([row('a')],[row('a','QUEUED',{body:'changed'})],scope),/CONFLICT/);
});

test('review-required staging supersedes conflicting receipt without masquerading as server rejection or ACK',()=>{
 const summary=summarize([row('a','ACKED')],[row('a','QUEUED',{body:'different original',review_required:true})],scope);
 assert.equal(summary.total,1);assert.equal(summary.counts.LOCAL_REVIEW_REQUIRED,1);
 assert.equal(summary.counts.ACKED,0);assert.equal(summary.counts.REJECTED,0);
});

test('retry schedule mirrors scope-wide server deadline and earliest pending local backoff',()=>{
 const result=summarize([row('a','RESPONSE_UNCONFIRMED',{retry_after_at:60000,next_attempt_at:65000}),row('b','QUEUED',{next_attempt_at:0}),row('other','ACKED',{owner_key:'MEMBER:2',retry_after_at:90000})],[],scope,1000);
 assert.equal(result.retry_after_at,60000);assert.equal(result.next_retry_at,60000);
 const local=summarize([row('a','RESPONSE_UNCONFIRMED',{next_attempt_at:32000.25}),row('b','PENDING_DEPENDENCY',{next_attempt_at:42000})],[],scope,1000);
 assert.equal(local.retry_after_at,0);assert.equal(local.next_retry_at,32001);
});
test('terminal/review-only records do not claim automatic retry; staging is eligible and expired deadlines are removed',()=>{
 assert.equal(summarize([row('a','ACKED'),row('b','REJECTED'),row('c','LOCAL_REVIEW_REQUIRED')],[],scope,1000).next_retry_at,null);
 const result=summarize([row('a','ACKED',{retry_after_at:60000})],[row('b')],scope,1000);
 assert.equal(result.next_retry_at,60000);
 const expired=summarize([row('a','QUEUED',{retry_after_at:500,next_attempt_at:500})],[],scope,1000);
 assert.equal(expired.retry_after_at,0);assert.equal(expired.next_retry_at,1000);
});
