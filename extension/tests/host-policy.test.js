import test from 'node:test';
import assert from 'node:assert/strict';
import {buildSiteRules,selectSite,supportedSnapshot} from '../src/site-rules.js';
const site=(canonical_host,access_policy,include_subdomains=true)=>({canonical_host,access_policy,include_subdomains});
const page='chrome-extension://test/blocked/blocked.html';
function action(rules,url){return rules.filter(r=>new RegExp(r.condition.regexFilter,'i').test(new URL(url).href)).sort((a,b)=>b.priority-a.priority)[0]?.action.type;}
const cases=[
 [[site('naver.com','BLOCK'),site('chzzk.naver.com','ALLOW')],'chzzk.naver.com','ALLOW', 'allow'],
 [[site('naver.com','BLOCK'),site('chzzk.naver.com','ALLOW',false)],'live.chzzk.naver.com','BLOCK','redirect'],
 [[site('naver.com','ALLOW'),site('chzzk.naver.com','BLOCK')],'live.chzzk.naver.com','BLOCK','redirect'],
 [[site('naver.com','BLOCK'),site('chzzk.naver.com','RECORD')],'live.chzzk.naver.com','RECORD','allow'],
 [[site('naver.com','ALLOW'),site('chzzk.naver.com','BLOCK'),site('clips.chzzk.naver.com','ALLOW',false)],'clips.chzzk.naver.com','ALLOW','allow'],
 [[site('naver.com','ALLOW'),site('chzzk.naver.com','BLOCK'),site('clips.chzzk.naver.com','ALLOW',false)],'x.clips.chzzk.naver.com','BLOCK','redirect'],
 [[site('naver.com','BLOCK'),site('chzzk.naver.com','ALLOW'),site('clips.chzzk.naver.com','BLOCK')],'clips.chzzk.naver.com','BLOCK','redirect'],
];
for(const [sites,host,expected,network] of cases)test(`1.2 selection and network priority: ${host} ${expected}`,()=>{
 for(const ordered of [sites,[...sites].reverse()]){
  assert.equal(selectSite(ordered,'https://'+host+'./').access_policy,expected);
  const rules=buildSiteRules(ordered,[],page);
  assert.equal(action(rules,'https://'+host+'./'),network);
  assert.equal(action(rules,'https://notnaver.com/'),undefined);
  assert.equal(action(rules,'https://naver.com.evil.example/'),undefined);
  assert.deepEqual(rules,buildSiteRules([...ordered].reverse(),[],page));
 }
});
test('1.2 version/strategy pairs are explicit; unknown strategy fails closed',()=>{
 assert.equal(supportedSnapshot({format_version:'1.1'}),true);
 assert.equal(supportedSnapshot({format_version:'1.2',site_match_strategy:'MOST_SPECIFIC_HOST'}),true);
 for(const s of [{format_version:'1.2'},{format_version:'1.2',site_match_strategy:'FIRST'},{format_version:'1.1',site_match_strategy:'MOST_SPECIFIC_HOST'},{format_version:'1.3'},{}])assert.equal(supportedSnapshot(s),false);
});
test('legacy overlap remains rejected; modern duplicate exact host remains rejected',()=>{
 const sites=[site('naver.com','BLOCK'),site('chzzk.naver.com','ALLOW')];
 assert.throws(()=>buildSiteRules(sites,[],page,true),/SNAPSHOT_SCOPE_CONFLICT/);
 assert.throws(()=>buildSiteRules([sites[0],site('naver.com','ALLOW',false)],[],page),/SNAPSHOT_SCOPE_CONFLICT/);
 assert.equal(buildSiteRules(sites,[],page).length,2);
});
test('site exceptions are main-frame allow only; higher-priority global restriction remains effective',()=>{
 const sites=[site('naver.com','BLOCK'),site('chzzk.naver.com','ALLOW')];
 const globalRule={id:1,priority:1000,action:{type:'block'},condition:{regexFilter:'^https?://chzzk\\.naver\\.com/',resourceTypes:['main_frame']}};
 const rules=buildSiteRules(sites,[globalRule],page);
 const exception=rules.find(r=>r.action.type==='allow');
 assert.deepEqual(exception.condition.resourceTypes,['main_frame']);
 assert.equal(rules.some(r=>r.id===1),false);
 assert.equal(action([globalRule,...rules],'https://chzzk.naver.com/'),'block');
});
