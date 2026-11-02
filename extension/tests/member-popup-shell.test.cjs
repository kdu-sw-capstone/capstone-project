const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {JSDOM}=require('jsdom');
const dir=path.join(__dirname,'../member-ui');
async function fixture({hold=false,items=[]}={}){
 const dom=new JSDOM(fs.readFileSync(path.join(dir,'popup.html'),'utf8'),{url:'chrome-extension://'+'a'.repeat(32)+'/member-ui/popup.html',runScripts:'outside-only'}),w=dom.window,calls=[],store={};
 w.chrome={tabs:{query:async()=>[{url:'https://www.example.com/watch',favIconUrl:'javascript:bad()'}]},storage:{local:{get:async key=>({[key]:hold}),set:async row=>Object.assign(store,row),remove:async key=>delete store[key]}},runtime:{sendMessage:async m=>{calls.push(m);return {ok:true,request_id:m.request_id,data:null};}}};
 w.structuredClone=structuredClone;w.navigator.locks={request:async(_n,_o,fn)=>fn({})};
 let change,save;
 w.FocurveMemberSites={controller:o=>{change=o.onChange;return {list:async()=>{change({items,busy:false,held:hold,error:'',loaded:true});return true;},save:async(s,selected)=>{save={s,selected};return false;},remove:async()=>false,close(){}};}};
 w.eval(fs.readFileSync(path.join(dir,'../background/host-policy.js'),'utf8'));w.eval(fs.readFileSync(path.join(dir,'shell.js'),'utf8'));
 const state={ready:true,linked:true,canStart:true,canManage:true,busy:false,running:false,state:{owner_user_id:'1',executor_id:'11111111-1111-4111-8111-111111111111',server_url:'https://localhost:18445/api/v1',phase:'LINKED',local_status:'IDLE',session_id:null}};
 w.FocurvePopupShell.state(state);await new Promise(r=>setTimeout(r,15));
 return {dom,w,calls,store,state,getSave:()=>save,change};
}
test('default current tab uses actual host, most-specific saved policy and no unsafe favicon',async()=>{
 const f=await fixture({items:[{site_id:'1',canonical_host:'example.com',include_subdomains:true,purpose:'FOCUS',access_policy:'ALLOW',display_name:'Original'}]});
 try{const d=f.w.document;assert.equal(d.querySelector('#current-domain').textContent,'www.example.com');assert.match(d.querySelector('#current-policy').textContent,/집중.*허용/);assert.equal(d.querySelector('#current-icon').hidden,true);assert.equal(d.querySelector('#current-view').hidden,false);assert.equal(d.querySelector('#focus-view').hidden,true);d.querySelector('#quick-add').click();assert.equal(d.querySelector('#member-site-url').value,'example.com');d.querySelector('#member-site-form').dispatchEvent(new f.w.Event('submit',{cancelable:true}));await new Promise(r=>setTimeout(r,0));assert.equal(f.getSave().s.display_name,'Original');}finally{f.w.dispatchEvent(new f.w.Event('pagehide'));f.dom.window.close();}
});
test('new site name is automatic, bounded independently from the full domain; errors keep input',async()=>{
 const f=await fixture();try{const d=f.w.document;d.querySelector('#member-site-add').click();const host='a'.repeat(60)+'.'+'b'.repeat(60)+'.example.com';d.querySelector('#member-site-url').value=host;d.querySelector('#member-site-form').dispatchEvent(new f.w.Event('submit',{cancelable:true}));await new Promise(r=>setTimeout(r,0));assert.equal(f.getSave().s.url,host);assert.equal([...f.getSave().s.display_name].length,100);assert.equal(d.querySelector('#member-site-url').value,host);assert.equal(d.querySelector('#member-site-form').hidden,false);}finally{f.w.dispatchEvent(new f.w.Event('pagehide'));f.dom.window.close();}
});
test('policy radio keyboard retains supported combinations and contains no check glyphs',async()=>{
 const f=await fixture();try{const d=f.w.document;d.querySelector('#member-site-add').click();d.querySelector('#member-purpose button').focus();d.querySelector('#member-purpose').dispatchEvent(new f.w.KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true}));assert.equal(d.querySelector('#member-purpose [aria-checked=true]').textContent,'방해');assert.equal(d.querySelectorAll('#member-policy button').length,2);assert.equal(d.querySelector('#member-policy [aria-checked=true]').textContent,'차단');assert(!/[✓✔☑✅]/u.test(d.querySelector('#member-site-form').textContent));}finally{f.w.dispatchEvent(new f.w.Event('pagehide'));f.dom.window.close();}
});
test('UNKNOWN site hold disables all mutations, theme changes load local assets, timer needs evidence',async()=>{
 const f=await fixture({hold:true});try{const d=f.w.document;assert.equal(d.querySelector('#quick-add').disabled,true);assert.equal(d.querySelector('#member-site-add').disabled,true);assert.match(d.querySelector('#member-sites-state').textContent,/UNKNOWN/);f.w.FocurvePopupShell.state({...f.state,running:true,canStart:false,canManage:false,state:{session_id:'session-a'}});await new Promise(r=>setTimeout(r,0));assert.equal(d.querySelector('#member-countdown').textContent,'--:--');d.documentElement.dataset.theme='dark';await new Promise(r=>setTimeout(r,0));assert(d.querySelector('[data-asset=settings]').getAttribute('src').endsWith('dark-settings.svg'));assert.equal(f.calls.filter(m=>['CREATE','UPDATE','DELETE'].includes(m.action)).length,0);}finally{f.w.dispatchEvent(new f.w.Event('pagehide'));f.dom.window.close();}
});
test('linked account transition immediately discards previous editor and list',async()=>{
 const f=await fixture({items:[{site_id:'1',canonical_host:'example.com',include_subdomains:true,purpose:'FOCUS',access_policy:'ALLOW',display_name:'Previous account'}]});
 try{const d=f.w.document;d.querySelector('#quick-add').click();assert.equal(d.querySelector('#member-site-url').value,'example.com');f.w.FocurvePopupShell.state({...f.state,state:{...f.state.state,owner_user_id:'2'}});assert.equal(d.querySelector('#member-site-form').hidden,true);assert.equal(d.querySelector('#member-site-url').value,'');assert.equal(d.querySelector('#member-site-list').children.length,0);}finally{f.w.dispatchEvent(new f.w.Event('pagehide'));f.dom.window.close();}
});
