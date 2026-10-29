import test from 'node:test';
import assert from 'node:assert/strict';
import {featureEntry} from '../content/entry.mjs';
import {inspectAdultDomain} from '../content/adult-domain.mjs';
test('EVENT-03 candidates use supported routes only; do not create access records', () => {
  assert.equal(featureEntry('https://www.youtube.com/shorts/a'),'YOUTUBE_SHORTS');
  assert.equal(featureEntry('https://www.instagram.com/reels/a'),'INSTAGRAM_REELS');
  for (const url of ['https://www.youtube.com/watch?v=shorts','https://www.youtube.com/shortstuff','https://youtube.com.evil.example/shorts/a','http://youtube.com/shorts/a','chrome-extension://test/blocked/blocked.html','bad']) assert.equal(featureEntry(url),null);
});
test('OPTION-10: dedicated exceptions respect host boundary and do not alter keyword or site policy', () => {
  const policy={enabled:true,exceptions:[{host:'example.com',include_subdomains:true}],custom_hosts:[]};
  assert.deepEqual(inspectAdultDomain('sub.example.com',policy,()=>true),{blocked:false,status:'SUPPORTED'});
  assert.equal(inspectAdultDomain('notexample.com',policy,()=>true).blocked,true);
  assert.deepEqual(policy,{enabled:true,exceptions:[{host:'example.com',include_subdomains:true}],custom_hosts:[]});
});
test('OPTION-10: missing/failed catalog never reports safe; custom host needs catalog availability', () => {
  const policy={enabled:true,exceptions:[],custom_hosts:[{host:'example.com',include_subdomains:false}]};
  assert.deepEqual(inspectAdultDomain('example.com',policy),{blocked:false,status:'FAILED'});
  assert.equal(inspectAdultDomain('example.com',policy,()=>false).blocked,true);
  assert.equal(inspectAdultDomain('elsewhere.com',policy,()=>{throw Error('missing');}).status,'FAILED');
});
