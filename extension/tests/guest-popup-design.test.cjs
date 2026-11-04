const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {JSDOM}=require('jsdom');
const base=path.join(__dirname,'../popup');
const read=name=>fs.readFileSync(path.join(base,name),'utf8');
const site=(host,purpose='DISTRACTION',policy='BLOCK')=>({site_id:'site-'+host,version:1,canonical_host:host,display_name:'Existing name',purpose,access_policy:policy,include_subdomains:true,feature_policies:[]});
async function fixture({items=[],url='https://www.youtube.com/watch?v=demo',listFailure=false,saveFailure=false,readbackMissing=false,wrongSavedPolicy=false,session=null}={}){
 const dom=new JSDOM(read('popup.html'),{url:'chrome-extension://'+'a'.repeat(32)+'/popup/popup.html',runScripts:'outside-only'}),w=dom.window,calls=[];
 w.structuredClone=structuredClone;w.matchMedia=()=>({matches:false,addEventListener(){},removeEventListener(){}});
 w.chrome={tabs:{query:async()=>[{url,favIconUrl:'https://example.com/favicon.ico'}]},storage:{local:{get:async()=>({focurve_ui_theme:'light'}),set:async()=>{}}},runtime:{sendMessage:async message=>{
  calls.push(message);let data=null,error=null;
  if(message.type==='DEV_GUEST_SITE_LIST'){data={items};if(listFailure)error='LOCAL_STORAGE_UNAVAILABLE';}
  else if(message.type==='DEV_SESSION_STATE')data=session;
  else if(message.type==='DEV_GUEST_SITE_CREATE'){if(saveFailure)error='LOCAL_STORAGE_UNAVAILABLE';else {data={...site(new URL('https://'+message.payload.url).hostname),...message.payload,canonical_host:new URL('https://'+message.payload.url).hostname};if(wrongSavedPolicy)data.access_policy='ALLOW';if(!readbackMissing)items.push(data);}}
  return {request_id:message.request_id,status:error?'ERROR':'OK',data,...(error?{error:{code:error}}:{})};
 }}};
 w.eval(fs.readFileSync(path.join(base,'../background/host-policy.js'),'utf8')+'\n'+read('popup.js')+'\n'+read('popup-ui.js'));
 await new Promise(r=>setTimeout(r,20));
 return {dom,w,calls,$:id=>w.document.getElementById(id),flush:()=>new Promise(r=>setTimeout(r,20))};
}
test('guest opens current site with actual canonical domain, three persistent tabs and unsupported URL protection',async()=>{
 const f=await fixture();try{assert.equal(f.$('current-page').hidden,false);assert.equal(f.$('focus-page').hidden,true);assert.equal(f.$('current-domain').textContent,'www.youtube.com');assert.equal(f.$('main-tabs').querySelectorAll('button').length,3);assert.equal(f.$('quick-add-site').disabled,false);}finally{f.dom.window.close();}
 const bad=await fixture({url:'chrome://extensions'});try{assert.equal(bad.$('quick-add-site').disabled,true);assert.match(bad.$('current-domain').textContent,/支持|지원/);}finally{bad.dom.window.close();}
});
test('current stored policy uses existing most-specific matcher and never claims runtime application',async()=>{
 const f=await fixture({items:[site('youtube.com'),site('www.youtube.com','FOCUS','ALLOW')]});try{assert.match(f.$('current-policy').textContent,/집중.*허용/);assert.doesNotMatch(f.$('current-policy').textContent,/적용 중|차단 중/);f.$('quick-add-site').click();assert.equal(f.$('site-name').value,'Existing name');assert.equal(f.$('site-editor').hidden,false);}finally{f.dom.window.close();}
});
test('policy radio keyboard preserves supported pairs without checkmarks',async()=>{
 const f=await fixture();try{f.$('quick-add-site').click();const focus=f.$('purpose-choices').querySelector('[data-value=FOCUS]');focus.click();assert.equal(f.$('site-purpose').value,'FOCUS');assert.equal(f.$('site-policy').value,'ALLOW');assert.equal(f.$('policy-choices').children.length,1);focus.focus();focus.dispatchEvent(new f.w.KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true}));assert.equal(f.$('site-purpose').value,'DISTRACTION');assert.equal(f.$('site-policy').value,'BLOCK');assert.equal(f.$('policy-choices').children.length,2);assert.doesNotMatch(f.$('purpose-choices').textContent,/✓|✔|☑|✅/);}finally{f.dom.window.close();}
});
test('new display name is canonical and at most100 code points; edits retain saved display name',async()=>{
 const f=await fixture();try{assert.equal(f.w.automaticSiteName(' HTTPS://EXAMPLE.COM./path '),'example.com');const host=['a'.repeat(63),'b'.repeat(63),'example','com'].join('.');assert.equal([...f.w.automaticSiteName(host)].length,100);assert.equal(new URL('https://'+host).hostname.length>100,true);f.$('quick-add-site').click();f.$('site-form').dispatchEvent(new f.w.Event('submit',{bubbles:true,cancelable:true}));await f.flush();const save=f.calls.find(m=>m.type==='DEV_GUEST_SITE_CREATE');assert.equal(save.payload.display_name,'www.youtube.com');assert.equal(save.payload.url,'www.youtube.com');}finally{f.dom.window.close();}
});
test('loading error does not become empty or enable quick add; failed save retains form values and request id',async()=>{
 const failed=await fixture({listFailure:true});try{assert.equal(failed.$('quick-add-site').disabled,true);assert.match(failed.$('site-result').textContent,/확인하지 못/);assert.doesNotMatch(failed.$('site-count').textContent,/등록된 사이트가 없습니다/);}finally{failed.dom.window.close();}
 const f=await fixture({saveFailure:true});try{f.$('quick-add-site').click();for(let i=0;i<2;i++){f.$('site-form').dispatchEvent(new f.w.Event('submit',{bubbles:true,cancelable:true}));await f.flush();}assert.equal(f.$('site-url').value,'www.youtube.com');assert.equal(f.$('site-editor').hidden,false);const saves=f.calls.filter(m=>m.type==='DEV_GUEST_SITE_CREATE');assert.equal(saves.length,2);assert.equal(saves[0].request_id,saves[1].request_id);}finally{f.dom.window.close();}
});
test('duration presets only edit duration; UNKNOWN cannot show running timer or send END',async()=>{
 const f=await fixture({session:{session_id:'preserved',status:'UNKNOWN'}});try{f.$('main-tabs').querySelector('[data-page=focus]').click();f.$('focus-presets').querySelector('[data-minutes="50"]').click();assert.equal(f.calls.some(m=>m.type==='DEV_SESSION_START'),false);assert.equal(f.$('focus-countdown').hidden,true);assert.equal(f.$('request-end').disabled,true);}finally{f.dom.window.close();}
 const normal=await fixture();try{normal.$('focus-presets').querySelector('[data-minutes="50"]').click();assert.equal(normal.$('focus-minutes').value,'50');assert.equal(normal.$('focus-ready-time').textContent,'50:00');normal.$('focus-presets').querySelector('[data-minutes=custom]').click();assert.equal(normal.$('duration-label').hidden,false);assert.equal(normal.calls.some(m=>m.type==='DEV_SESSION_START'),false);}finally{normal.dom.window.close();}
});

test('write ACK cannot clear input or announce success without matching intent and readback',async()=>{
 for(const options of [{readbackMissing:true},{wrongSavedPolicy:true}]){const f=await fixture(options);try{f.$('quick-add-site').click();f.$('site-form').dispatchEvent(new f.w.Event('submit',{bubbles:true,cancelable:true}));await f.flush();assert.equal(f.$('site-editor').hidden,false);assert.equal(f.$('site-url').value,'www.youtube.com');assert.doesNotMatch(f.$('site-result').textContent,/등록 완료/);assert.match(f.$('site-result').textContent,/확인하지 못/);}finally{f.dom.window.close();}}
});
