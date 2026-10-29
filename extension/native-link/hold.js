/* Product-owned, grant-pinned HOLD transition. No refresh/START/END. */
'use strict';
addEventListener('DOMContentLoaded',()=>{
 const c=globalThis.FOCURVE_NATIVE_LINK_CONFIG,b=document.querySelector('#recover-product-hold'),s=document.querySelector('#hold-status');
 if(c?.productHoldRecoveryEnabled!==true)return;
 document.querySelector('#hold-section').hidden=false;
 b.hidden=false;let active=false,finished=false,pending=false;
 if(c.contract!=='FOCURVE_NATIVE_LINK_CONFIG_1'||!Number.isFinite(Date.parse(c.notAfterUTC))||Date.now()+180000>=Date.parse(c.notAfterUTC)){
  b.disabled=true;s.textContent='현재 복구 승인 시간이 없거나 안전하게 완료할 시간이 부족합니다. 서비스를 시작하지 않았습니다.';
 }
 const reader=R2LocalSafety.create({chrome,indexedDB,crypto,location,deployment:globalThis.FOCURVE_DEPLOYMENT,context:globalThis.FOCURVE_SAFETY_CONTEXT,productLifecycle:true});
 addEventListener('beforeunload',e=>{if(active&&!finished){e.preventDefault();e.returnValue='';}});
 b.addEventListener('click',e=>{
  if(!e.isTrusted||active||globalThis.FOCURVE_PRODUCT_LIFECYCLE_ACTIVE)return;
  if(c.contract!=='FOCURVE_NATIVE_LINK_CONFIG_1'||c.extensionId!==chrome.runtime.id||Date.now()+180000>=Date.parse(c.notAfterUTC)||!Number.isFinite(Date.parse(c.notAfterUTC))){s.textContent='복구 승인 시간 또는 설치 연결을 확인하지 못했습니다. 시작하지 않았습니다.';return;}
  active=true;globalThis.FOCURVE_PRODUCT_LIFECYCLE_ACTIVE=true;b.disabled=true;
  s.textContent='현재 의무와 회원 신원을 확인합니다. 완료 안내까지 이 창을 열어 두세요.';
  const port=chrome.runtime.connectNative(c.host);
  port.onMessage.addListener(async q=>{
   try{
    if(q?.contract!=='FOCURVE_RUNTIME_PROBE_1')throw Error('CONTRACT');
    if(q.operation==='COMPLETE'){
     const r=q.result;
     if(r?.state!=='PRODUCT_RECOVERED_FOCUS_LOCKED'||r.servicesRunning!==false||r.focusAdmission!=='CLOSED'||r.startAuthorized!==false)throw Error('RESULT');
     finished=true;globalThis.FOCURVE_PRODUCT_LIFECYCLE_ACTIVE=false;
     s.textContent='보존된 중단 상태를 정식 처리했습니다. 서비스는 종료돼 있고 집중 권한은 닫혀 있습니다. 다음 실행 승인을 기다려 주세요.';port.disconnect();return;
    }
    if(q.operation==='FAILED'||q.operation==='REJECTED'){
     finished=true;
     const reasons={
      PRODUCT_HOLD_MEMBER_MISMATCH:'회원과 설치 신원이 일치하지 않아 중단했습니다.',
      PRODUCT_HOLD_LOCAL_NOT_CLEAR:'현재 로컬 안전 상태를 확인하지 못했거나 미해소 의무가 있어 중단했습니다.',
      PRODUCT_HOLD_DATABASE_UNSAFE_OR_OWNER_MISMATCH:'현재 DB의 회원 신원 또는 미해소 의무를 확인하지 못해 중단했습니다.',
      PRODUCT_OPERATION_ALREADY_ACTIVE:'다른 제어 작업이 진행 중이어서 이 화면에서는 실행하지 않았습니다.',
      PRODUCT_HOLD_GRANT_EXPIRED:'승인된 실행 시간이 끝나 진행하지 않았습니다.'
     };
     s.textContent=(reasons[q.code]??'복구 결과를 확정하지 못했습니다.')+' 기존 상태와 기록을 보존합니다. 다시 누르지 마세요.';
     port.disconnect();return;
    }
    if(pending||q.operation!=='CHECK_HOLD_LOCAL'||q.installationId!==c.installationId||q.extensionId!==c.extensionId||!/^[a-f0-9]{32}$/.test(q.nonce??''))throw Error('SCOPE');
    pending=true;
    const before=await chrome.storage.local.get(['focurve_member_auth','focurve_user_ui_hold']);
    const auth=before.focurve_member_auth;
    if(before.focurve_user_ui_hold||auth?.phase!=='LINKED'||!/^[1-9][0-9]*$/.test(String(auth.owner_user_id))||!Number.isSafeInteger(Number(auth.owner_user_id)))throw Error('AUTH');
    const local=await reader.observe();
    const after=await chrome.storage.local.get(['focurve_member_auth','focurve_user_ui_hold']);
    if(JSON.stringify(before)!==JSON.stringify(after))throw Error('CHANGED');
    port.postMessage({contract:q.contract,nonce:q.nonce,installationId:c.installationId,extensionId:c.extensionId,ok:true,
     result:{local,ownerUserId:Number(auth.owner_user_id),executorId:auth.executor_id}});pending=false;
   }catch{
    s.textContent='안전 상태를 확정하지 못해 중단했습니다. 재시작하거나 집중을 누르지 마세요.';
    try{port.postMessage({contract:'FOCURVE_RUNTIME_PROBE_1',ok:false});}catch{}
   }
  });
  port.onDisconnect.addListener(()=>{void chrome.runtime.lastError;if(!finished)s.textContent='연결이 끊겼습니다. 결과를 확정하지 않고 보존합니다. 다시 누르지 마세요.';});
  port.postMessage({contract:'FOCURVE_RUNTIME_PROBE_1',operation:'RECOVER_PRODUCT_HOLD',installationId:c.installationId,extensionId:c.extensionId});
 });
 addEventListener('pagehide',()=>reader.cancel(),{once:true});
});
