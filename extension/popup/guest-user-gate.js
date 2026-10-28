/* UI-only uncertainty retention; Core/guest operations remain the existing worker contracts. */
(() => {
 'use strict';const holdKey='focurve_user_ui_hold',readyKey='focurve_installation_ready_launch';let held=true,ready=false,heldCode=null;
 const original=siteRequest;
 const message='이전 작업 결과를 확인하지 못했어요. 시작·종료를 반복하지 말고 설치 기록을 보존해 주세요.';
 async function retain(action,error,requestId){held=true;try{
  const current=(await chrome.storage.local.get(holdKey))[holdKey];
  // Preserve the first uncertainty, including old markers without an error code.
  // A later STATE failure must not replace the original mutation or its ID.
  if(!current||current.unconfirmed!==true&&current.action===action&&current.requestId===requestId)await chrome.storage.local.set({[holdKey]:{...(current??{action,requestId,atUTC:new Date().toISOString()}),unconfirmed:true,errorCode:focusErrorCode(error)}});
  const first=(await chrome.storage.local.get(holdKey))[holdKey];heldCode=typeof first?.errorCode==='string'?focusErrorCode({message:first.errorCode}):null;
 }catch{}render();}
 function render(){if(held||!ready){for(const button of [startFocus,endFocus,document.getElementById('request-end'),...document.querySelectorAll('.account-button')])if(!button.disabled)button.disabled=true;const text=document.getElementById('focus-feedback'),value=held?message+(heldCode?' 오류 코드: '+heldCode:''):'실행 창에서 프로그램 준비를 먼저 완료해 주세요.';if(text.textContent!==value)text.textContent=value;}}
 document.addEventListener('click',event=>{if((held||!ready)&&event.target.closest('.account-button')){event.preventDefault();event.stopImmediatePropagation();render();}},true);
 chrome.storage.local.get([holdKey,readyKey]).then(v=>{held=Boolean(v[holdKey]);heldCode=typeof v[holdKey]?.errorCode==='string'?focusErrorCode({message:v[holdKey].errorCode}):null;ready=Boolean(globalThis.FOCURVE_DEPLOYMENT?.launchId)&&v[readyKey]===globalThis.FOCURVE_DEPLOYMENT.launchId;render();}).catch(()=>retain('STORAGE_READ'));
 chrome.storage.onChanged.addListener((changes,area)=>{if(area!=='local')return;if(Object.hasOwn(changes,holdKey)){held=Boolean(changes[holdKey].newValue);heldCode=typeof changes[holdKey].newValue?.errorCode==='string'?focusErrorCode({message:changes[holdKey].newValue.errorCode}):null;}if(Object.hasOwn(changes,readyKey))ready=Boolean(globalThis.FOCURVE_DEPLOYMENT?.launchId)&&changes[readyKey].newValue===globalThis.FOCURVE_DEPLOYMENT.launchId;render();});
 async function dispatch(type,payload,requestId){
  requestId=requestId??crypto.randomUUID();
  const mutation=['DEV_SESSION_START','DEV_SESSION_END'].includes(type);
  if(mutation){const current=(await chrome.storage.local.get(holdKey))[holdKey];if(!ready)throw Error('INSTALLATION_NOT_READY');if(held||current)throw Error('USER_OPERATION_UNCONFIRMED');
   if(type==='DEV_SESSION_END'&&(!focusVerified||focusSession?.status!=='RUNNING'))throw Error('USER_OPERATION_UNCONFIRMED');
   await chrome.storage.local.set({[holdKey]:{action:type,requestId,atUTC:new Date().toISOString()}});
  }
  try{
   const data=await original(type,payload,requestId);
   if(type.startsWith('DEV_SESSION_')&&['UNKNOWN','START_FAILED'].includes(data?.status))throw Error('USER_OPERATION_UNCONFIRMED');
   if(mutation){const current=(await chrome.storage.local.get(holdKey))[holdKey];if(!current||current.action!==type||current.requestId!==requestId||current.unconfirmed===true)throw Error('RESPONSE_UNCONFIRMED');await chrome.storage.local.remove(holdKey);held=false;}
   return data;
  }catch(e){if(mutation&&['INSTALLATION_NOT_READY','INSTALLATION_STOPPING','INSTALLATION_START_WINDOW_CLOSED'].includes(e.message)){await chrome.storage.local.remove(holdKey);held=false;}else if(mutation||type==='DEV_SESSION_STATE')await retain(type,e,requestId);throw e;}
 }
 siteRequest=(type,payload,requestId)=>['DEV_SESSION_START','DEV_SESSION_END'].includes(type)?navigator.locks.request('focurve-user-ui-operation',{ifAvailable:true},lock=>{if(!lock)throw Error('USER_OPERATION_UNCONFIRMED');return dispatch(type,payload,requestId);}):dispatch(type,payload,requestId);
 const observer=new MutationObserver(render);observer.observe(document.getElementById('focus-page'),{subtree:true,attributes:true,attributeFilter:['disabled','hidden']});
 addEventListener('pagehide',()=>observer.disconnect(),{once:true});
})();
