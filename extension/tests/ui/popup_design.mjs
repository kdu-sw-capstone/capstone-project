/** Installed Chrome renderer + mocked Chrome/HTTP. No product MV3/Core/Server acceptance.
 * PLAYWRIGHT_MODULE=<absolute playwright directory> CHROME_EXECUTABLE=<chrome.exe>
 * node extension/tests/ui/popup_design.mjs
 */
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const extension=path.resolve(fileURLToPath(new URL('../../',import.meta.url)));
const output=path.resolve(extension,'../.local/popup-design');
await mkdir(path.join(output,'screenshots'),{recursive:true});
const deployment={contract:'STANDALONE_API_1',api:'https://localhost:18445/api/v1',origin:'https://localhost:18445',launchId:'b'.repeat(32),launchDeadlineUTC:new Date(Date.now()+7200000).toISOString()};
const server=createServer(async(req,res)=>{
 try {
  const name=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  if(name==='/release-config.js'){res.setHeader('Content-Type','text/javascript');res.end('globalThis.FOCURVE_DEPLOYMENT='+JSON.stringify(deployment));return;}
  if(name==='/launch-context.json'){res.setHeader('Content-Type','application/json');res.end(JSON.stringify({...deployment,contract:'STANDALONE_LAUNCH_1',extensionId:'a'.repeat(32)}));return;}
  const target=path.resolve(extension,'.'+name);
  if(!target.startsWith(extension+path.sep))throw Error('path');
  res.setHeader('Content-Type',({'.js':'text/javascript','.css':'text/css','.html':'text/html','.svg':'image/svg+xml','.png':'image/png'})[path.extname(target)]||'application/octet-stream');res.end(await readFile(target));
 }catch{res.statusCode=404;res.end('missing');}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const origin='http://127.0.0.1:'+server.address().port;
const checks=[],failures=[];
let browser,browserVersion;
function mock({theme='light',member=true,items=1,scenario='idle'}){
 const scope={owner_key:'MEMBER:1',executor_id:'11111111-1111-4111-8111-111111111111',authority:'https://localhost:18445/api/v1'};
 const rows=Array.from({length:items},(_,i)=>({site_id:member?String(i+1):'11111111-1111-4111-8111-'+String(i+1).padStart(12,'0'),version:1,canonical_host:i?'example'+i+'.com':'registered.example',display_name:i?'사이트 '+i:'등록 사이트',purpose:'DISTRACTION',access_policy:'BLOCK',include_subdomains:true,feature_policies:[]}));
 window.mock={scope,items:rows,scenario,calls:[],member,resolveList:null};
 const storage={focurve_ui_theme:theme,focurve_installation_ready_launch:'b'.repeat(32)};
 if(scenario==='hold')storage.focurve_user_ui_hold={unconfirmed:true,requestId:'preserved'};
 const status=()=>({phase:member?'LINKED':'UNREGISTERED',owner_user_id:member?'1':undefined,executor_id:scope.executor_id,guest_start_allowed:!member,error:null,recovery_pending:false,local_status:window.mock.scenario==='running'?'RUNNING':'IDLE',session_id:window.mock.scenario==='running'?'session1':null,server_confirmed_running:window.mock.scenario==='running',server_url:'https://localhost:18445/api/v1',web_origin:'https://localhost:18445'});
 window.chrome={storage:{local:{get:async()=>structuredClone(storage),set:async data=>Object.assign(storage,data),remove:async key=>{delete storage[key];}},onChanged:{addListener(){}}},tabs:{query:async()=>[{url:window.mock.scenario==='long'?'https://'+'a'.repeat(60)+'.'+'b'.repeat(60)+'.example/':'https://unregistered.example/path',favIconUrl:''}]},runtime:{id:'a'.repeat(32),getURL:p=>location.origin+'/'+p,sendMessage:async m=>{
  window.mock.calls.push(structuredClone(m));
  if(m.type==='INDEPENDENT_MEMBER_UI'){
   if(m.action==='START')window.mock.scenario='running';if(m.action==='END')window.mock.scenario='idle';
   return {ok:true,data:status()};
  }
  if(m.type==='INDEPENDENT_MEMBER_SITES'){
   if(m.action==='TIMING')return {ok:true,request_id:m.request_id,scope,data:{session_id:'session1',planned_end_at:new Date(Date.now()+1500000).toISOString()}};
   if(m.action==='LIST'){
    if(window.mock.scenario==='loading')await new Promise(resolve=>window.mock.resolveList=resolve);
    if(window.mock.scenario==='error')return {request_id:m.request_id,ok:false,error:'HTTP_503',status:503,definitive:true};
    return {ok:true,request_id:m.request_id,scope,data:{items:window.mock.items,next_cursor:null,has_more:false}};
   }
   if(m.action==='GET'){const found=window.mock.items.find(x=>x.site_id===m.payload.site_id);return found?{ok:true,request_id:m.request_id,scope,data:found}:{ok:false,request_id:m.request_id,scope,error:'SITE_NOT_FOUND',status:404,definitive:true};}
   if(m.action==='CREATE'||m.action==='UPDATE'){
    const data={...m.payload.site,canonical_host:new URL('https://'+m.payload.site.url.replace(/^https?:\/\//,'')).hostname,site_id:m.payload.site_id||String(window.mock.items.length+1),version:m.action==='CREATE'?1:m.payload.version+1};delete data.url;
    window.mock.items=window.mock.items.filter(x=>x.site_id!==data.site_id);window.mock.items.push(data);return {ok:true,request_id:m.request_id,scope,data};
   }
   if(m.action==='DELETE'){window.mock.items=window.mock.items.filter(x=>x.site_id!==m.payload.site_id);return {ok:true,request_id:m.request_id,scope,data:{site_id:m.payload.site_id,deleted:true}};}
  }
  let data=null;
  if(m.type.startsWith('FOCURVE_AUTH_'))data=status();
  if(m.type==='DEV_GUEST_SITE_LIST')data={items:window.mock.items,next_cursor:null,has_more:false};
  if(m.type==='DEV_SESSION_STATE')data=null;
  if(m.type==='DEV_ACCESS_LIST')data={items:[],total_access:0,repeat_access:0,next_cursor:null,has_more:false};
  if(m.type==='DEV_GUEST_SITE_CREATE'){
   data={...m.payload,canonical_host:new URL('https://'+m.payload.url.replace(/^https?:\/\//,'')).hostname,site_id:crypto.randomUUID(),version:1};delete data.url;window.mock.items.push(data);
  }
  if(m.type==='DEV_GUEST_SITE_UPDATE'){const old=window.mock.items.find(x=>x.site_id===m.payload.site_id);data={...old,...m.payload.site,canonical_host:m.payload.site.url,version:old.version+1};delete data.url;window.mock.items=window.mock.items.map(x=>x.site_id===old.site_id?data:x);}
  if(m.type==='DEV_GUEST_SITE_DELETE'){data={site_id:m.payload.site_id,deleted_at:new Date().toISOString()};window.mock.items=window.mock.items.filter(x=>x.site_id!==m.payload.site_id);}
  return {request_id:m.request_id,status:'OK',data,error:null};
 }}};
}
async function pageFor(options={}){
 const page=await browser.newPage({viewport:{width:480,height:600},deviceScaleFactor:1});
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.route('**/*',route=>route.request().url().startsWith(origin)?route.continue():route.abort());
 await page.addInitScript(mock,options);
 await page.goto(origin+(options.member===false?'/popup/popup.html':'/member-ui/popup.html'));
 await page.waitForTimeout(150);
 if(options.member!==false&&options.scenario!=='hold')await page.waitForFunction(()=>mock.calls.length||document.getElementById('headline')?.textContent==='설치 설정을 확인해 주세요',undefined,{timeout:4000}).catch(()=>{});
 return {page,errors};
}
async function check(name,fn){try{await fn();checks.push(name);console.log('PASS '+name);}catch(e){failures.push({name,error:e.stack});console.log('FAIL '+name+': '+e.message);}}
async function geometry(page){
 const result=await page.evaluate(()=>{const main=document.querySelector('.app-shell').getBoundingClientRect(),tabs=document.querySelector('.bottom-tabs').getBoundingClientRect();return {width:main.width,height:main.height,tabsY:tabs.y,tabsBottom:tabs.bottom,bodyWidth:document.body.scrollWidth};});
 assert.deepEqual(result,{width:480,height:600,tabsY:516,tabsBottom:580,bodyWidth:480});
 const missing=await page.locator('img:visible').evaluateAll(images=>images.filter(image=>!image.complete||!image.naturalWidth||!image.naturalHeight).map(image=>image.getAttribute('src')));
 assert.deepEqual(missing,[],'Every visible Figma asset must resolve locally.');
}
async function screenshot(page,name){await page.screenshot({path:path.join(output,'screenshots',name+'.png')});}
try{
 browser=await chromium.launch({headless:true,...(process.env.CHROME_EXECUTABLE?{executablePath:process.env.CHROME_EXECUTABLE}:{channel:'chrome'})});
 browserVersion=browser.version();
 for(const member of [true,false])for(const theme of ['light','dark'])await check(`${member?'member':'guest'} ${theme} current 480×600`,async()=>{
  const {page,errors}=await pageFor({member,theme});try{await geometry(page);assert.equal(await page.locator('#current-domain').textContent(),'unregistered.example');assert.equal(await page.locator('html').getAttribute('data-theme'),theme);await screenshot(page,`${member?'member':'guest'}-${theme}-current`);assert.deepEqual(errors,[]);}finally{await page.close();}
 });
 await check('member sites scroll, keyboard choice, presets and CRUD readback',async()=>{
  const {page,errors}=await pageFor({member:true,items:8});try{
   await page.locator('[data-view=sites]').click();await page.waitForTimeout(60);const scroll=await page.locator('#member-site-list').evaluate(n=>({height:n.clientHeight,scroll:n.scrollHeight}));assert.equal(scroll.height,252);assert(scroll.scroll>scroll.height,JSON.stringify({scroll,state:await page.locator('#member-sites-state').textContent(),errors,calls:await page.evaluate(()=>mock.calls)}));await geometry(page);await screenshot(page,'member-list');
   await page.locator('#member-site-add').click();await page.locator('#member-site-url').fill('created.example');await page.locator('#member-purpose [role=radio]').first().focus();await page.keyboard.press('ArrowRight');assert.equal(await page.locator('#member-purpose [aria-checked=true]').textContent(),'방해');await screenshot(page,'member-form');assert(await page.locator('#member-site-save').evaluate(n=>n.getBoundingClientRect().bottom<=516));await page.locator('#member-site-save').click();await page.waitForTimeout(80);assert(await page.locator('#member-site-list').textContent().then(t=>t.includes('created.example')));
   let row=page.locator('#member-site-list li').filter({hasText:'created.example'});await row.getByRole('button',{name:'수정',exact:true}).click();await page.locator('#member-policy').getByRole('radio',{name:'허용하고 기록',exact:true}).click();await page.locator('#member-site-save').click();await page.waitForTimeout(80);assert(await row.textContent().then(t=>t.includes('허용하고 기록')));await row.getByRole('button',{name:'삭제',exact:true}).click();assert.equal(await page.evaluate(()=>mock.calls.filter(x=>x.action==='DELETE').length),0);await row.getByRole('button',{name:'삭제 확인',exact:true}).click();await page.waitForTimeout(80);assert.equal(await row.count(),0);
   await page.locator('[data-view=focus]').click();await page.locator('[data-minutes="50"]').click();assert.equal(await page.locator('#minutes').inputValue(),'50');assert.equal(await page.locator('#member-countdown').textContent(),'50:00');await screenshot(page,'member-focus-preset');await page.locator('[data-minutes=custom]').click();await page.locator('#minutes').fill('17');assert.equal(await page.locator('#member-countdown').textContent(),'17:00');await screenshot(page,'member-focus');assert(await page.locator('#start').evaluate(n=>n.getBoundingClientRect().bottom<=516),'Custom duration start CTA must fit above navigation.');assert.deepEqual(errors,[]);
  }finally{await page.close();}
 });
 await check('guest tabs, site form, radio keyboard, CRUD and duration presets',async()=>{
  const {page,errors}=await pageFor({member:false,items:8});try{
   await page.locator('.bottom-tabs [data-page=sites]').click();assert.equal(await page.locator('#site-list').evaluate(n=>n.clientHeight),252);assert(await page.locator('#site-list').evaluate(n=>n.scrollHeight>n.clientHeight));await screenshot(page,'guest-list');
   await page.locator('#add-site').click();await page.locator('#site-url').fill('guest-created.example');await page.locator('#purpose-choices [role=radio]').first().focus();await page.keyboard.press('ArrowRight');assert.equal(await page.locator('#purpose-choices [aria-checked=true]').textContent(),'방해');await screenshot(page,'guest-form');await page.locator('#save-site').click();await page.waitForTimeout(80);assert(await page.locator('#site-list').textContent().then(t=>t.includes('guest-created.example')));
   const row=page.locator('#site-list li').filter({hasText:'guest-created.example'});await row.getByRole('button',{name:'수정',exact:true}).click();await page.locator('#policy-choices').getByRole('radio',{name:'허용하고 기록',exact:true}).click();await page.locator('#save-site').click();await page.waitForTimeout(80);assert(await row.textContent().then(t=>t.includes('기록')));await row.getByRole('button',{name:'삭제',exact:true}).click();assert.equal(await page.evaluate(()=>mock.calls.filter(x=>x.type==='DEV_GUEST_SITE_DELETE').length),0);await row.getByRole('button',{name:'삭제 확인',exact:true}).click();await page.waitForTimeout(80);assert.equal(await row.count(),0);
   await page.locator('.bottom-tabs [data-page=focus]').click();await page.locator('#focus-presets [data-minutes="50"]').click();assert.equal(await page.locator('#focus-minutes').inputValue(),'50');await screenshot(page,'guest-focus');assert.deepEqual(errors,[]);
  }finally{await page.close();}
 });
 for(const scenario of ['loading','error','hold','long'])await check('member '+scenario+' state',async()=>{
  const {page,errors}=await pageFor({member:true,scenario,items:0});try{
   if(scenario==='loading'||scenario==='error'){await page.locator('[data-view=sites]').click();assert(await page.locator('#member-sites-state').textContent().then(Boolean));}
   if(scenario==='hold'){await page.locator('[data-view=focus]').click();assert(await page.locator('#start').isDisabled());}
   if(scenario==='long'){assert(await page.locator('#current-domain').evaluate(n=>n.scrollWidth<=n.clientWidth));}
   await geometry(page);await screenshot(page,'member-'+scenario);assert.deepEqual(errors,[]);
  }finally{await page.close();}
 });
 await check('member verified running timing and unsupported pause absence',async()=>{
  const {page,errors}=await pageFor({member:true,scenario:'running'});try{await page.locator('[data-view=focus]').click();assert.match(await page.locator('#member-countdown').textContent(),/^2[45]:[0-5][0-9]$/);assert.equal(await page.getByRole('button',{name:'일시정지',exact:true}).count(),0);assert(await page.locator('#end').isVisible());await screenshot(page,'member-running');assert.deepEqual(errors,[]);}finally{await page.close();}
 });
}finally{await browser?.close();await new Promise(resolve=>server.close(resolve));await writeFile(path.join(output,'result.json'),JSON.stringify({environment:'Installed Chrome headless renderer; mocked Chrome runtime/storage/HTTP, no MV3/Core/Server acceptance',browserVersion,nodeVersion:process.version,checkedAtUTC:new Date().toISOString(),checks,failures},null,2));}
if(failures.length)process.exitCode=1;
