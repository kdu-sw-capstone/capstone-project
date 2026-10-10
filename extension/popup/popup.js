const button = document.querySelector("#check-core");
const result = document.querySelector("#result");

button.addEventListener("click", async () => {
  button.disabled = true;
  result.textContent = "Core 응답을 확인하고 있습니다…";
  const requestId = crypto.randomUUID();
  let timeout;

  try {
    const response = await Promise.race([
      chrome.runtime.sendMessage({ type: "DEV_CORE_PING", request_id: requestId }),
      new Promise((_, reject) => {
        timeout = setTimeout(() => reject(new Error("CORE_TIMEOUT")), 5000);
      })
    ]);
    if (response?.request_id !== requestId || response.status !== "OK" ||
        typeof response.data?.client_version !== "string" || response.error !== null) {
      throw new Error("INVALID_CORE_RESPONSE");
    }
    result.textContent = `Core 연결 확인 완료 · 버전 ${response.data.client_version}`;
  } catch {
    result.textContent = "Core 연결을 확인하지 못했습니다. 확장 오류를 확인하고 다시 시도해주세요.";
  } finally {
    clearTimeout(timeout);
    button.disabled = false;
  }
});

const storageButton = document.querySelector("#check-storage");
const storageResult = document.querySelector("#storage-result");
storageButton.addEventListener("click", async () => {
  storageButton.disabled = true;
  storageResult.textContent = "게스트 저장을 확인하고 있습니다…";
  const requestId = crypto.randomUUID();
  let timeout;
  try {
    const response = await Promise.race([
      chrome.runtime.sendMessage({ type: "DEV_GUEST_STORAGE_CHECK", request_id: requestId }),
      new Promise((_, reject) => {
        timeout = setTimeout(() => reject(new Error("CORE_TIMEOUT")), 5000);
      })
    ]);
    const data = response?.data;
    if (response?.request_id !== requestId || response.status !== "OK" ||
        response.error !== null || typeof data?.installation_id !== "string" ||
        data.owner_key !== `GUEST:${data.installation_id}` ||
        !Number.isSafeInteger(data.settings_version)) throw new Error("STORAGE_CHECK_FAILED");
    storageResult.textContent = `저장 확인 완료\n설치 ID: ${data.installation_id}\n소유자: ${data.owner_key}\n설정 버전: ${data.settings_version}`;
  } catch {
    storageResult.textContent = "게스트 저장을 확인하지 못했습니다. 확장 오류를 확인하고 다시 시도해주세요.";
  } finally {
    clearTimeout(timeout);
    storageButton.disabled = false;
  }
});

const siteForm = document.querySelector('#site-form');
const siteResult = document.querySelector('#site-result');
const siteList = document.querySelector('#site-list');
const saveSite = document.querySelector('#save-site');
const reloadSites = document.querySelector('#reload-sites');
const cancelEdit = document.querySelector('#cancel-edit');
const siteMode = document.querySelector('#site-mode');
const purpose = document.querySelector('#site-purpose');
const policy = document.querySelector('#site-policy');
const labels = { DISTRACTION: '방해', FOCUS: '집중', GENERAL: '일반', BLOCK: '차단', RECORD: '기록', ALLOW: '허용' };
const errors = {
 INVALID_URL:'http/https 주소나 도메인을 입력해주세요. IP·localhost·포트·로그인 정보가 있는 주소는 사용할 수 없습니다.',
 INVALID_SITE:'이름(1~100자)과 입력 내용을 확인해주세요.',
 INVALID_POLICY:'집중·일반은 허용, 방해는 차단·기록 정책을 사용합니다.',
 SITE_SCOPE_CONFLICT:'같은 호스트가 이미 등록되었거나 삭제 이력에 남아 있습니다. 기존 항목을 확인해주세요.',
 IDEMPOTENCY_CONFLICT:'재시도 요청이 이전 입력과 다릅니다.',
 VERSION_CONFLICT:'다른 화면에서 설정이 변경됐습니다. 입력은 유지됩니다. 목록 다시 확인 후 최신 설정과 비교해주세요.',
 VERSION_REQUIRED:'변경할 설정 버전이 없습니다. 목록을 다시 확인해주세요.',
 SITE_NOT_FOUND:'이미 삭제됐거나 찾을 수 없는 사이트입니다. 목록을 다시 확인해주세요.',
 LOCAL_DATA_INVALID:'저장된 데이터를 확인할 수 없습니다. 데이터를 삭제하지 말고 오류를 알려주세요.'
};
let pendingSave=null, editTarget=null, siteBusy=false, listRevision=0, siteItems=[], sitesVerified=false;
const pendingDeletes=new Map();
function updatePolicyOptions(value){
 policy.replaceChildren();
 for(const optionValue of purpose.value==='DISTRACTION'?['BLOCK','RECORD']:['ALLOW']){
  const option=document.createElement('option');option.value=optionValue;option.textContent=labels[optionValue];policy.append(option);
 }
 if(value)policy.value=value;
}
purpose.addEventListener('change',()=>updatePolicyOptions());
function setSiteBusy(value){
 siteBusy=value;saveSite.disabled=value;reloadSites.disabled=value;cancelEdit.disabled=value;
 for(const control of siteForm.querySelectorAll('input, select'))control.disabled=value;
 for(const button of siteList.querySelectorAll('button'))button.disabled=value;
}
function stopEditing(){
 editTarget=null;pendingSave=null;siteForm.reset();updatePolicyOptions();
 siteMode.textContent='새 사이트 등록';saveSite.textContent='사이트 등록';cancelEdit.hidden=false;
 window.FocurvePopupUI?.editor(false);
}
function startEditing(site){
 if(siteBusy)return;
 editTarget={site_id:site.site_id,version:site.version};pendingSave=null;
 document.querySelector('#site-url').value=site.canonical_host;
 document.querySelector('#site-name').value=site.display_name;
 document.querySelector('#site-subdomains').checked=site.include_subdomains;
 purpose.value=site.purpose;updatePolicyOptions(site.access_policy);
 siteMode.textContent=`수정 중: ${site.display_name} (버전 ${site.version})`;
 saveSite.textContent='수정 저장';cancelEdit.hidden=false;
 siteResult.textContent='변경은 다음 집중 세션부터 적용됩니다.';
 window.FocurvePopupUI?.editor(true);
 document.querySelector('#site-url').focus();
}
cancelEdit.addEventListener('click',()=>{if(!siteBusy){stopEditing();siteResult.textContent='수정을 취소했습니다. 저장된 설정은 그대로입니다.';}});
async function siteRequest(type,payload,requestId=crypto.randomUUID()){
 let timer;
 try{
  const response=await Promise.race([
   chrome.runtime.sendMessage({type,request_id:requestId,payload}),
   new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('RESPONSE_UNCONFIRMED')),5000);})
  ]);
  if(response?.request_id!==requestId||!['OK','ERROR'].includes(response.status))throw new Error('RESPONSE_UNCONFIRMED');
  if(response.status==='ERROR')throw new Error(response.error?.code||'LOCAL_STORAGE_UNAVAILABLE');
  return response.data;
 }finally{clearTimeout(timer);}
}
function actionButton(text,fn){const button=document.createElement('button');button.type='button';button.textContent=text;button.addEventListener('click',fn);return button;}
function confirmDelete(site,row){
 if(siteBusy||row.querySelector('.site-confirm'))return;
 const confirm=document.createElement('div');confirm.className='site-confirm';
 const warning=document.createElement('p');warning.textContent=`${site.display_name} (${site.canonical_host}) 설정을 삭제할까요? 현재 집중과 과거 기록은 유지됩니다.`;
 const controls=document.createElement('div');controls.className='site-actions';
 controls.append(actionButton('삭제 확인',()=>deleteSite(site)),actionButton('취소',()=>{if(!siteBusy)confirm.remove();}));
 confirm.append(warning,controls);row.append(confirm);
}
async function refreshSites(){
 const revision=++listRevision;const data=await siteRequest('DEV_GUEST_SITE_LIST');
 if(!Array.isArray(data?.items))throw new Error('RESPONSE_UNCONFIRMED');
 if(revision!==listRevision)return;
 siteItems=data.items;sitesVerified=true;
 siteList.replaceChildren();
 for(const site of data.items){
  const row=document.createElement('li');const description=document.createElement('span');
  const name=document.createElement('strong');name.textContent=site.display_name;
  const metadata=document.createElement('small');metadata.textContent=`${site.canonical_host} · ${labels[site.access_policy]}`;
  description.title=`${labels[site.purpose]} / ${labels[site.access_policy]}${site.include_subdomains?' · 하위 도메인 포함':' · 정확한 호스트만'}`;
  description.append(name,metadata);
  const controls=document.createElement('div');controls.className='site-actions';
  controls.append(actionButton('수정',()=>startEditing(site)),actionButton('삭제',()=>confirmDelete(site,row)));
  row.append(description,controls);siteList.append(row);
 }
 if(!data.items.length){const row=document.createElement('li');row.textContent='등록된 사이트가 없습니다.';siteList.append(row);}
 for(const button of siteList.querySelectorAll('button'))button.disabled=siteBusy;
 window.FocurvePopupUI?.renderSites();
}
async function deleteSite(site){
 if(siteBusy)return;setSiteBusy(true);
 const payload={site_id:site.site_id,expected_version:site.version};const body=JSON.stringify(payload);
 let pending=pendingDeletes.get(site.site_id);
 if(!pending||pending.body!==body){pending={body,request_id:crypto.randomUUID()};pendingDeletes.set(site.site_id,pending);}
 try{
  const removed=await siteRequest('DEV_GUEST_SITE_DELETE',payload,pending.request_id);
  if(removed?.site_id!==site.site_id||typeof removed.deleted_at!=='string')throw new Error('RESPONSE_UNCONFIRMED');
  pendingDeletes.delete(site.site_id);if(editTarget?.site_id===site.site_id)stopEditing();
  siteResult.textContent=`삭제 완료: ${site.canonical_host}. 현재 집중과 과거 기록은 유지됩니다.`;
  try{await refreshSites();}catch{siteResult.textContent+=' 목록 조회 실패. 목록 다시 확인을 눌러주세요.';}
 }catch(error){siteResult.textContent=errors[error.message]||'삭제 결과를 확인하지 못했습니다. 목록을 확인하거나 같은 삭제 확인으로 재시도해주세요.';}
 finally{setSiteBusy(false);}
}
siteForm.addEventListener('submit',async event=>{
 event.preventDefault();if(siteBusy)return;setSiteBusy(true);
 const site={url:document.querySelector('#site-url').value,display_name:document.querySelector('#site-name').value,
  include_subdomains:document.querySelector('#site-subdomains').checked,purpose:purpose.value,access_policy:policy.value,feature_policies:[]};
 const editing=editTarget!==null;
 const type=editing?'DEV_GUEST_SITE_UPDATE':'DEV_GUEST_SITE_CREATE';
 const payload=editing?{site_id:editTarget.site_id,expected_version:editTarget.version,site}:site;
 const body=JSON.stringify({type,payload});
 if(!pendingSave||pendingSave.body!==body)pendingSave={body,request_id:crypto.randomUUID()};
 try{
  const saved=await siteRequest(type,payload,pendingSave.request_id);
  if(typeof saved?.canonical_host!=='string')throw new Error('RESPONSE_UNCONFIRMED');
  pendingSave=null;stopEditing();
  siteResult.textContent=`${editing?'수정':'등록'} 완료: ${saved.canonical_host}. 변경은 다음 집중 세션부터 적용됩니다.`;
  try{await refreshSites();}catch{siteResult.textContent+=' 목록 조회 실패. 목록 다시 확인을 눌러주세요.';}
 }catch(error){siteResult.textContent=errors[error.message]||'저장 결과를 확인하지 못했습니다. 입력을 유지한 채 다시 저장을 눌러주세요.';}
 finally{setSiteBusy(false);}
});
reloadSites.addEventListener('click',async()=>{
 if(siteBusy)return;reloadSites.disabled=true;
 try{await refreshSites();siteResult.textContent=editTarget?'최신 목록을 확인했습니다. 수정 입력은 유지됩니다. 충돌한 경우 입력을 따로 보관하고 최신 항목을 다시 선택해 비교해주세요.':'저장된 목록을 확인했습니다.';}
 catch{siteResult.textContent='목록을 확인하지 못했습니다. 다시 시도해주세요.';}
 finally{reloadSites.disabled=siteBusy;}
});
refreshSites().catch(()=>{siteResult.textContent='목록을 확인하지 못했습니다. 목록 다시 확인을 눌러주세요.';});

const startFocus = document.querySelector('#start-focus');
const endFocus = document.querySelector('#end-focus');
const refreshFocus = document.querySelector('#refresh-focus');
const focusMinutes = document.querySelector('#focus-minutes');
const focusResult = document.querySelector('#focus-result');
let focusSession = null, focusBusy = false, pendingStart = null, focusVerified=false;
const focusStates = {STARTING:'차단 적용 확인 중',RUNNING:'집중 진행 중',ENDING:'차단 해제 확인 중',ENDED:'집중 종료 · 해제 확인 완료',INTERRUPTED:'재시작 또는 정책 변경으로 중단 · 해제 확인 완료',START_FAILED:'시작 실패 · 해제 확인 완료',UNKNOWN:'결과 미확인 · 해제 재확인 필요'};
function showFocus(session) {
 focusSession=session;
 const active=session&&!['ENDED','INTERRUPTED','START_FAILED'].includes(session.status);
 startFocus.disabled=focusBusy||Boolean(active);focusMinutes.disabled=focusBusy||Boolean(active);
 endFocus.disabled=focusBusy||!active||session.status==='STARTING';
 refreshFocus.disabled=focusBusy;
 const remaining=session?.planned_end_at?Math.max(0,Math.ceil((Date.parse(session.planned_end_at)-Date.now())/60000)):null;
 focusResult.textContent=session?`${focusStates[session.status]||'상태 미확인'}${session.status==='RUNNING'?`\n남은 시간: 약 ${remaining}분`:''}\n세션 ID: ${session.session_id}${session.last_error_code?`\n오류: ${session.last_error_code}`:''}`:'진행 중인 집중 세션이 없습니다.';
 window.FocurvePopupUI?.renderFocus();
}
function validateFocusSession(session,required=false){
 if(!session){if(required)throw new Error('RESPONSE_UNCONFIRMED');return;}
 if(!Object.hasOwn(focusStates,session.status)||typeof session.session_id!=='string'||!session.session_id||session.status==='RUNNING'&&(!Number.isFinite(Date.parse(session.started_at))||!Number.isFinite(Date.parse(session.planned_end_at))))throw new Error('RESPONSE_UNCONFIRMED');
}
async function refreshFocusState(){
 focusVerified=false;window.FocurvePopupUI?.renderFocus();
 try{const session=await siteRequest('DEV_SESSION_STATE');
  validateFocusSession(session);
  focusVerified=true;showFocus(session);
 }catch(error){focusVerified=false;window.FocurvePopupUI?.renderFocus();throw error;}
}
startFocus.addEventListener('click',async()=>{
 const minutes=Number(focusMinutes.value);
 if(!Number.isInteger(minutes)||minutes<1||minutes>180){focusResult.textContent='집중 시간은 1~180분 정수로 입력해주세요.';document.querySelector('#focus-feedback').textContent=focusResult.textContent;return;}
 if(!pendingStart||pendingStart.minutes!==minutes)pendingStart={minutes,id:crypto.randomUUID()};
 focusBusy=true;showFocus(focusSession);focusResult.textContent='차단을 적용하고 실제 상태를 확인하고 있습니다…';let actionError=null;
 try{const s=await siteRequest('DEV_SESSION_START',{duration_minutes:minutes},pendingStart.id);validateFocusSession(s,true);pendingStart=null;focusVerified=true;showFocus(s);}
 catch(error){actionError=`시작 결과 확인 실패 (${error.message}). 현재 상태를 확인해주세요.`;focusResult.textContent=actionError;}
 finally{focusBusy=false;startFocus.disabled=true;endFocus.disabled=true;refreshFocus.disabled=false;try{await refreshFocusState();if(actionError){focusResult.textContent+='\n'+actionError;document.querySelector('#focus-feedback').textContent=actionError;}}catch{focusResult.textContent+='\n상태 조회 실패. 성공으로 확인되지 않았습니다.';}}
});
endFocus.addEventListener('click',async()=>{
 if(!focusSession)return;focusBusy=true;showFocus(focusSession);focusResult.textContent='차단 해제를 확인하고 있습니다…';let actionError=null;
 try{const s=await siteRequest('DEV_SESSION_END',{session_id:focusSession.session_id});validateFocusSession(s,true);focusVerified=true;showFocus(s);}
 catch(error){actionError=`종료 결과 확인 실패 (${error.message}). 현재 상태를 확인해주세요.`;focusResult.textContent=actionError;}
 finally{focusBusy=false;startFocus.disabled=true;endFocus.disabled=true;refreshFocus.disabled=false;try{await refreshFocusState();if(actionError){focusResult.textContent+='\n'+actionError;document.querySelector('#focus-feedback').textContent=actionError;}}catch{focusResult.textContent+='\n상태 조회 실패. 해제 완료로 확인되지 않았습니다.';}}
});
refreshFocus.addEventListener('click',()=>{refreshFocusState().catch(()=>{startFocus.disabled=true;endFocus.disabled=true;focusResult.textContent='상태 확인 실패. 다시 확인해주세요.';});});
refreshFocusState().catch(()=>{focusResult.textContent='상태 확인 실패. 상태 다시 확인을 눌러주세요.';});

const refreshAccess = document.querySelector('#refresh-access');
const accessResult = document.querySelector('#access-result');
const accessList = document.querySelector('#access-list');
let accessData=null;
refreshAccess.addEventListener('click', async () => {
 refreshAccess.disabled=true;accessResult.textContent='저장된 접근 기록을 확인하고 있습니다…';
 try{
  const data=await siteRequest('DEV_ACCESS_LIST');
  if(!Array.isArray(data?.items)||!Number.isSafeInteger(data.total_access)||!Number.isSafeInteger(data.repeat_access))throw new Error('INVALID_ACCESS_RESPONSE');
  accessData=data;window.FocurvePopupUI?.renderRecords();
  accessList.replaceChildren();
  accessResult.textContent=data.quarantined_count?`기존 이벤트 ${data.quarantined_count}건의 계약 오류를 격리하고 원본을 보존했습니다.`:data.session_id?`이 세션의 수집된 전체 ${data.total_access}회 · 반복 ${data.repeat_access}회 (부분 기록)`:'조회할 집중 세션이 없습니다.';
  for(const event of data.items){
   const row=document.createElement('li');
   const type=event.event_type==='BLOCKED_SITE_ACCESS'?'차단 접근':'기록 접근';
   row.textContent=`#${event.payload.access_seq} · ${type} · ${event.payload.target_host} · ${new Date(event.occurred_at).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'})}${event.is_repeat?' · 반복':''}`;
   accessList.append(row);
  }
  if(data.session_id&&!data.items.length&&!data.quarantined_count){const row=document.createElement('li');row.textContent='이 세션에 저장된 접근 기록이 없습니다.';accessList.append(row);}
 }catch{accessData=null;window.FocurvePopupUI?.renderRecords();accessResult.textContent='기록을 조회하지 못했습니다. 다시 확인해주세요.';accessList.replaceChildren();}
 finally{refreshAccess.disabled=false;}
});
