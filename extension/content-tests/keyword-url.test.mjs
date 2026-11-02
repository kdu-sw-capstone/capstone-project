import test from 'node:test';
import assert from 'node:assert/strict';
import {inspectKeywordUrl, foldKeyword} from '../content/keyword-url.mjs';
const policy = terms => ({enabled:true,match_profile:'URL_BOUNDARY_1',scope:'FOCUS_FROZEN',terms,exceptions:[]});
const vectors = [
  ['https://example.test/search?q=GAMING','gaming',true],
  ['https://example.test/gamings','gaming',false],
  ['https://example.test/gaming-now','gaming',true],
  ['https://example.test/%67aming','gaming',true],
  ['https://example.test/%2567aming','gaming',false],
  ['https://example.test/?gaming=no','gaming',false],
  ['https://example.test/#gaming','gaming',true],
  ['https://example.test/?q=ＡＢＣ','abc',true],
  ['https://example.test/?q=한글게임','게임',false],
  ['https://example.test/?q=게임','게임',true],
  ['https://example.test/?q=video+game','video game',true],
  ['https://example.test/video+game','video game',false],
  ['https://example.test/?q=Stra%C3%9Fe','STRASSE',true],
  ['https://example.test/?q=%CF%82','σ',true],
  ['https://bücher.example/','xn--bcher-kva',true],
  ['https://GAMING.example/','gaming',true],
  ['https://example.test/?q=𐐀gaming','gaming',false],
  ['https://example.test/?gaming&other=no','gaming',false],
  ['https://example.test/?a=ga&b=ming','gaming',false],
];
for (const [url, term, expected] of vectors) test(`contract URL vector ${vectors.findIndex(v => v[0]===url && v[1]===term)}`, () => {
  assert.deepEqual(inspectKeywordUrl(url,policy([term])),{local_only:true,native_verified:false,match_profile:'URL_BOUNDARY_1',status:'CHECKED',matched:expected});
});
test('malformed percent and UTF-8 never return a safe match result',()=>{
  for(const url of ['https://example.test/%ZZ','https://example.test/?q=%FF','https://example.test/#%C0%AF','https://example.test/?%FF=no']) {
    const result=inspectKeywordUrl(url,policy(['gaming']));assert.equal(result.status,'UNCONFIRMED');assert.equal(result.matched,null);
  }
});
test('reject unsupported schemes, private credentials and non-policy hosts',()=>{
  for(const url of ['javascript:gaming','https://user:password@example.test/gaming','https://localhost/gaming','https://127.0.0.1/gaming','https://[::1]/gaming','https://bad_name.test/gaming','https://example.test/\ngaming'])
    assert.equal(inspectKeywordUrl(url,policy(['gaming'])).status,'UNCONFIRMED');
});
test('exceptions obey exact and dotted subdomain boundary; they do not grant global permission',()=>{
  const p=policy(['gaming']);p.exceptions=[{host:'naver.com',include_subdomains:false}];
  assert.equal(inspectKeywordUrl('https://naver.com/gaming',p).status,'EXEMPT');
  assert.equal(inspectKeywordUrl('https://xxx.naver.com/gaming',p).matched,true);
  p.exceptions[0].include_subdomains=true;
  assert.equal(inspectKeywordUrl('https://xxx.naver.com/gaming',p).status,'EXEMPT');
  for(const h of ['evilnaver.com','naver.com.evil.test'])assert.equal(inspectKeywordUrl(`https://${h}/gaming`,p).matched,true);
});
test('bad policies fail closed and disabled policy performs no URL inspection',()=>{
  for(const p of [{}, {...policy(['x']),scope:'OTHER'},policy([]),policy(['']),policy(['x','x']),policy(['ABC','ＡＢＣ']),{...policy(['x']),terms:[1]}])
    assert.equal(inspectKeywordUrl('https://example.test/',p).status,'UNCONFIRMED');
  assert.equal(inspectKeywordUrl('not a url',{...policy(['x']),enabled:false}).status,'DISABLED');
});
test('frozen inputs stay unchanged and output contains no URL, term or authority proof',()=>{
  const p=policy(['private-term']);p.terms=Object.freeze(p.terms);Object.freeze(p.exceptions);Object.freeze(p);
  const before=JSON.stringify(p),result=inspectKeywordUrl('https://example.test/?q=private-term',p);
  assert.equal(JSON.stringify(p),before);assert.equal(result.matched,true);
  assert.ok(!JSON.stringify(result).includes('private-term'));assert.ok(!JSON.stringify(result).includes('example.test'));
  for(const key of ['blocked','APPLIED','restored','cleanup_pending','owner'])assert.ok(!Object.hasOwn(result,key));
  assert.equal(foldKeyword('ＳＴＲＡẞＥ'),'strasse');
});
