(async () => {
 'use strict';const $=id=>document.getElementById(id);let deployment;
 try{deployment=FocurveDeploymentBinding.config();$('dashboard').href=deployment.web_origin+'/';$('dashboard').setAttribute('aria-disabled','false');for(const [id,view] of [['focus-web','sessions'],['sites-web','sites']]){const link=$(id);link.href=deployment.web_origin+'/?view='+view;link.setAttribute('aria-disabled','false');}}
 catch{$('headline').textContent='설치 설정을 확인해 주세요';$('description').textContent='연결 설정이 완성되지 않아 집중을 시작할 수 없어요.';return;}
 let currentLaunch=false;
 try{
  const pinned=globalThis.FOCURVE_DEPLOYMENT,abort=new AbortController(),timer=setTimeout(()=>abort.abort(),3000);
  try{
   const response=await fetch(chrome.runtime.getURL('launch-context.json')+'?popup='+crypto.randomUUID(),{cache:'no-store',credentials:'omit',redirect:'error',signal:abort.signal});
   if(!response.ok)throw Error('INSTALLATION_CONTEXT_UNCONFIRMED');
   const context=await response.json(),deadline=Date.parse(context?.launchDeadlineUTC);
   if(context?.contract!=='STANDALONE_LAUNCH_1'||context.extensionId!==chrome.runtime.id||context.api!==pinned?.api||context.origin!==pinned?.origin||!/^[a-f0-9]{32}$/.test(context.launchId??'')||!Number.isFinite(deadline)||deadline<=Date.now())throw Error('INSTALLATION_CONTEXT_UNCONFIRMED');
   globalThis.FOCURVE_DEPLOYMENT=Object.freeze({...pinned,launchId:context.launchId,launchDeadlineUTC:context.launchDeadlineUTC});currentLaunch=true;
  }finally{clearTimeout(timer);}
 }catch{/* Keep focus disabled when current public launch identity is unavailable. */}
 const holdKey='focurve_user_ui_hold';let initialHold=true,installationReady=false;const media=window.matchMedia?.('(prefers-color-scheme: dark)');
 const applyTheme=()=>{document.documentElement.dataset.theme=$('theme').value==='system'?(media?.matches?'dark':'light'):$('theme').value;};
 try{const stored=await chrome.storage.local.get([holdKey,'focurve_ui_theme','focurve_installation_ready_launch']);initialHold=Boolean(stored[holdKey]);installationReady=currentLaunch&&Boolean(globalThis.FOCURVE_DEPLOYMENT?.launchId)&&stored.focurve_installation_ready_launch===globalThis.FOCURVE_DEPLOYMENT.launchId;if(['light','dark','system'].includes(stored.focurve_ui_theme))$('theme').value=stored.focurve_ui_theme;}catch{$('notice').textContent='저장 상태를 확인하지 못했어요. 집중을 시작하지 말고 설치 안내를 확인해 주세요.';}
 applyTheme();$('theme').onchange=async()=>{applyTheme();try{await chrome.storage.local.set({focurve_ui_theme:$('theme').value});}catch{$('notice').textContent='화면에는 적용했지만 설정을 저장하지 못했어요.';}};
 media?.addEventListener('change',applyTheme);
 const app=FocurveUserPopup.controller({initialHold,readyAllowed:()=>installationReady,startAllowed:minutes=>{const n=minutes??Number($('minutes').value),deadline=Date.parse(globalThis.FOCURVE_DEPLOYMENT?.launchDeadlineUTC);return Number.isFinite(deadline)&&Date.now()+n*60000<=deadline-600000;},reserve:async row=>{if(row.previousDefinitiveError)await chrome.storage.local.set({['focurve_auth_observation_'+row.requestId]:{code:row.previousDefinitiveError,atUTC:new Date().toISOString()}});await chrome.storage.local.set({[holdKey]:{...row,atUTC:new Date().toISOString()}});},confirm:async requestId=>{const current=(await chrome.storage.local.get(holdKey))[holdKey];if(current?.requestId!==requestId)throw Error('RESPONSE_UNCONFIRMED');await chrome.storage.local.remove(holdKey);},onHold:row=>chrome.storage.local.set({[holdKey]:{...row,atUTC:new Date().toISOString(),unconfirmed:true}}),send:m=>chrome.runtime.sendMessage(m),config:()=>deployment,matches:s=>FocurveDeploymentBinding.stateMatches(s),onError:text=>{$('notice').textContent=text;},onResult:(action,data)=>{
  if(action.endsWith('_LIST')){const area=$(action==='IMPORT_LIST'?'import-items':'settings-items');area.replaceChildren();if(!Array.isArray(data))throw Error('RESPONSE_UNCONFIRMED');for(const item of data){const label=document.createElement('label'),input=document.createElement('input');input.type='checkbox';input.value=item.source_item_id;input.disabled=item.imported===true;label.append(input,document.createTextNode(String(item.label??item.ended_at??'보존된 기록')+(item.imported?' · 가져옴':'')));area.append(label);}$('import-notice').textContent=data.length?'가져올 항목을 선택해 주세요.':'가져올 항목이 없어요.';}
  else{$('import-notice').textContent='가져오기 요청이 처리됐어요. 웹에서 결과를 확인해 주세요.';}
 },onChange:v=>{
  $('headline').textContent=v.headline;$('description').textContent=v.detail;$('account-badge').textContent=v.linked?'회원 연결됨':v.state?.guest_start_allowed?'비회원':'확인 필요';
  if(!v.ready&&!v.canRecover&&!v.canRecoverConfirm){$('headline').textContent='프로그램을 준비하고 있어요';$('description').textContent='실행 창의 설치 안내를 완료해 주세요. 아직 연결이나 집중을 시작하지 않아요.';}
  if(v.canConnect&&v.state?.error==='LINK_EXPIRED'){$('headline').textContent='연결 요청이 만료됐어요';$('description').textContent='이전 요청은 그대로 보존해요. 필요하면 계정 연결하기로 새 요청을 만들 수 있어요.';}
  $('start').disabled=v.busy||!v.canStart;$('end').disabled=v.busy||!v.canEnd;$('end').hidden=!v.running;$('start').hidden=v.running;$('minutes').disabled=v.busy||!v.canManage;
  $('recovery').hidden=!(v.canRecover||v.canRecoverConfirm);$('recover-begin').disabled=v.busy||!v.canRecover;$('recover-confirm').disabled=v.busy||!v.canRecoverConfirm;
  $('connect').disabled=v.busy||!v.canConnect;$('claim').disabled=v.busy||!v.canClaim;$('connection').hidden=v.linked;
  $('guest').hidden=!(v.ready&&v.state?.guest_start_allowed===true&&!v.linked&&!app.held());$('disconnect').disabled=v.busy||!v.canManage;
  for(const id of ['import-list','settings-list','import-selected','settings-selected'])$(id).disabled=v.busy||!v.canManage;
  $('policy').textContent=v.running?'현재 세션의 고정된 사이트 정책을 적용 중이에요.':v.canStart?'웹에서 저장한 정책이 다음 집중에 적용돼요.':v.canManage?'종료 준비 시간을 확보하도록 집중 시간을 더 짧게 설정해 주세요.':'적용 여부를 아직 확인하지 못했어요.';
 }});
 chrome.storage.onChanged?.addListener((changes,area)=>{if(area==='local'&&Object.hasOwn(changes,'focurve_installation_ready_launch')){installationReady=currentLaunch&&Boolean(globalThis.FOCURVE_DEPLOYMENT?.launchId)&&changes.focurve_installation_ready_launch.newValue===globalThis.FOCURVE_DEPLOYMENT.launchId;if(!app.held())void app.act('STATE');}});
 async function run(action,payload){const work=async()=>{const ok=await app.act(action,payload);if(ok&&action!=='STATE')await app.act('STATE');};if(action==='STATE')await work();else await navigator.locks.request('focurve-user-ui-operation',{ifAvailable:true},async lock=>{if(lock)await work();else $('notice').textContent='다른 화면에서 처리 중이에요. 같은 작업을 반복하지 마세요.';});}
 $('import-list').onclick=()=>run('IMPORT_LIST');$('settings-list').onclick=()=>run('SETTINGS_LIST');
 $('import-selected').onclick=()=>run('IMPORT_SELECTED',{ids:[...$('import-items').querySelectorAll('input:checked')].map(x=>x.value)});$('settings-selected').onclick=()=>run('SETTINGS_SELECTED',{ids:[...$('settings-items').querySelectorAll('input:checked')].map(x=>x.value)});
 $('recover-begin').onclick=()=>run('RECOVER_BEGIN');$('recover-confirm').onclick=()=>run('RECOVER_CONFIRM');
 $('connect').onclick=()=>run('CONNECT');$('claim').onclick=()=>run('CLAIM');$('start').onclick=()=>run('START',{minutes:Number($('minutes').value)});
 $('minutes').oninput=()=>{$('start').disabled=app.view().busy||!app.view().canStart;};
 $('end').onclick=()=>{if(app.view().canEnd)$('end-dialog').showModal();};$('continue').onclick=()=>$('end-dialog').close();
 $('confirm-end').onclick=()=>{$('end-dialog').close();void run('END');};
 $('disconnect').onclick=()=>run('DISCONNECT');
 const poll=setInterval(()=>{if(!app.held())void app.act('STATE');},5000);
 window.addEventListener('pagehide',()=>{clearInterval(poll);media?.removeEventListener('change',applyTheme);app.close();},{once:true});
 if(initialHold){$('headline').textContent='이전 작업의 확인이 필요해요';$('description').textContent='결과가 확인되지 않은 작업이 있어요. 시작·종료·재연결을 반복하지 말고 설치 기록을 보존해 주세요.';$('account-badge').textContent='확인 필요';}
 else void run('STATE');
})();
