'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {JSDOM}=require('jsdom');
const page=path.join(__dirname,'../native-link');
async function fixture({expired=false,missing=false,theme='light',error=null}={}){
 const dom=new JSDOM(fs.readFileSync(page+'/index.html','utf8'),{runScripts:'outside-only',url:'https://native-ui.invalid/'}),w=dom.window;
 let calls=0,click,changed,removed=0;const keys=[];
 const c={contract:'FOCURVE_NATIVE_LINK_CONFIG_1',installationId:'1'.repeat(32),extensionId:'a'.repeat(32),host:'com.focurve.install_'+'1'.repeat(32),notAfterUTC:new Date(Date.now()+(expired?-1000:3600000)).toISOString()};
 w.FOCURVE_NATIVE_LINK_CONFIG=missing?null:c;
 w.matchMedia=()=>({matches:true,addEventListener(){},removeEventListener(){removed++;}});
 w.chrome={runtime:{id:c.extensionId,sendNativeMessage(host,q,done){calls++;if(error){w.chrome.runtime.lastError={message:error};done();delete w.chrome.runtime.lastError;}else done({...q,state:'CONNECTED',capability:'LINK_ONLY_NO_SERVICE_CONTROL'});}},
  storage:{local:{get:async k=>{keys.push(k);return {focurve_ui_theme:theme};},set(){throw Error('NO_WRITES_ALLOWED');}},onChanged:{addListener:f=>changed=f,removeListener(){removed++;}}}};
 const button=w.document.querySelector('#connect-native');button.addEventListener=(name,fn)=>{if(name==='click')click=fn;};
 for(const n of ['client.js','theme.js','ui.js'])w.eval(fs.readFileSync(page+'/'+n,'utf8'));
 await new Promise(r=>setImmediate(r));
 return {dom,w,c,button,keys,click:async trusted=>click({isTrusted:trusted}),changed:(x,a='local')=>changed(x,a),get calls(){return calls;},get removed(){return removed;},status:w.document.querySelector('#native-status')};
}
test('expired native approval is shown before any user action',async()=>{const f=await fixture({expired:true});try{assert(f.button.disabled);assert.equal(f.status.dataset.state,'EXPIRED');assert.match(f.status.textContent,/승인 시간이 끝/);assert.equal(f.calls,0);}finally{f.dom.window.close();}});
test('incomplete configuration is distinguished from expiry',async()=>{const f=await fixture({missing:true});try{assert(f.button.disabled);assert.equal(f.status.dataset.state,'SETUP_REQUIRED');assert.equal(f.calls,0);}finally{f.dom.window.close();}});
test('connect is explicit HELLO only and cannot imply service readiness',async()=>{const f=await fixture();try{assert.equal(f.calls,0);await f.click(false);assert.equal(f.calls,0);await f.click(true);assert.equal(f.calls,1);assert.equal(f.status.dataset.state,'CONNECTED');assert.match(f.status.textContent,/서비스는 아직 시작하지/);}finally{f.dom.window.close();}});
test('transport error is sanitized and never auto retries',async()=>{const f=await fixture({error:'C:/private-path/access-token-fixture'});try{await f.click(true);await f.click(true);assert.equal(f.calls,1);assert(f.button.disabled);assert.equal(f.status.dataset.state,'UNCONFIRMED');assert(!f.status.textContent.includes('private-path'));assert(!f.status.textContent.includes('access-token'));}finally{f.dom.window.close();}});
test('light dark and system display preferences are read without state writes',async()=>{for(const [value,expected] of [['light','light'],['dark','dark'],['system','dark'],['invalid','light']]){const f=await fixture({theme:value});try{assert.equal(f.w.document.documentElement.dataset.theme,expected);assert.deepEqual(JSON.parse(JSON.stringify(f.keys)),[['focurve_ui_theme']]);assert.equal(f.calls,0);f.w.dispatchEvent(new f.w.Event('pagehide'));assert.equal(f.removed,2);}finally{f.dom.window.close();}}});
test('native page keeps all IDs unique and every local script present',()=>{const d=new JSDOM(fs.readFileSync(page+'/index.html','utf8'));try{const ids=[...d.window.document.querySelectorAll('[id]')].map(x=>x.id);assert.equal(ids.length,new Set(ids).size);for(const script of d.window.document.querySelectorAll('script[src]'))assert(fs.existsSync(path.resolve(page,script.getAttribute('src'))));assert.equal(d.window.document.querySelectorAll('#recover-product-hold').length,1);}finally{d.window.close();}});

test('focus and dashboard links target separate documents and retain the service controller',()=>{
 const d=new JSDOM(fs.readFileSync(page+'/index.html','utf8'),{url:'https://native-ui.invalid/native-link/index.html'});
 try{
  const popup=d.window.document.querySelector('#session-popup');
  assert.equal(popup.getAttribute('href'),'../member-ui/popup.html');assert.equal(popup.hidden,true);
  for(const link of [popup,d.window.document.querySelector('#session-dashboard')]){
   assert.equal(link.target,'_blank');assert(link.relList.contains('noopener'));assert(link.relList.contains('noreferrer'));
  }
  assert.match(d.window.document.title,/서비스 제어/);
  assert.match(d.window.document.querySelector('#user-session-section').textContent,/주소를 바꾸거나 새로고침·닫기 하지 마세요/);
 }finally{d.window.close();}
});
