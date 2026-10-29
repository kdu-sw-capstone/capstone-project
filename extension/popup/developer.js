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
window.FocurvePopupSettings={features:()=>structuredClone(editTarget?.feature_policies??[])};
function updatePolicyOptions(value){
 policy.replaceChildren();
 for(const optionValue of purpose.value==='DISTRACTION'?['BLOCK','RECORD']:['ALLOW']){
  const option=document.createElement('option');option.value=optionValue;option.textContent=labels[optionValue];policy.append(option);
 }
 if(value)policy.value=value;
 window.FocurveA1UI?.sync();
}
purpose.addEventListener('change',()=>updatePolicyOptions());
function setSiteBusy(value){
 siteBusy=value;saveSite.disabled=value;reloadSites.disabled=value;cancelEdit.disabled=value;
 for(const control of siteForm.querySelectorAll('input, select'))control.disabled=value;
 window.FocurveA1UI?.sync(value);
 for(const button of siteList.querySelectorAll('button'))button.disabled=value;
}
function stopEditing(){
 editTarget=null;pendingSave=null;siteForm.reset();updatePolicyOptions();window.FocurveA1UI?.hydrate([]);
 siteMode.textContent='새 사이트 등록';saveSite.textContent='사이트 등록';cancelEdit.hidden=false;
 window.FocurvePopupUI?.editor(false);
}
function startEditing(site){
 if(siteBusy)return;
 editTarget={site_id:site.site_id,version:site.version,feature_policies:structuredClone(site.feature_policies??[])};pendingSave=null;
 window.FocurveA1UI?.hydrate(editTarget.feature_policies);
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
  include_subdomains:document.querySelector('#site-subdomains').checked,purpose:purpose.value,access_policy:policy.value,feature_policies:window.FocurveA1UI?.featuresForSave(editTarget?.feature_policies??[])??structuredClone(editTarget?.feature_policies??[])};
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
let focusSession = null, focusBusy = false, pendingStart = null, focusVerified=false, focusActionError=null;
const focusStates = {EFFECT_VERIFYING:'새 제어 대상 확인 중',NATIVE_VERIFYING:'문서·복원 확인 중',STARTING:'차단 적용 확인 중',RUNNING:'집중 진행 중',ENDING:'차단 해제 확인 중',ENDED:'집중 종료 · 해제 확인 완료',INTERRUPTED:'재시작 또는 정책 변경으로 중단 · 해제 확인 완료',START_FAILED:'시작 실패 · 해제 확인 완료',UNKNOWN:'결과 미확인 · 상태 재확인 필요'};
function showFocus(session) {
 focusSession=session;
 if(focusVerified&&pendingStart&&session?.start_request_id===pendingStart.id&&session.duration_minutes===pendingStart.minutes)pendingStart=null;
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
// Re-read authoritative state after transient recovery; never infer RUNNING from a timer.
let focusRefreshTimer=null, focusRefreshAttempts=0, focusRefreshRevision=0;
function scheduleFocusRecheck(){
 if(focusRefreshAttempts>=5)return;focusRefreshAttempts++;
 focusRefreshTimer=setTimeout(()=>{focusRefreshTimer=null;refreshFocusState().catch(()=>{});},1000);
}
function invalidateFocusReads(){focusRefreshRevision++;if(focusRefreshTimer!==null){clearTimeout(focusRefreshTimer);focusRefreshTimer=null;}}
async function refreshFocusState(){if(focusBusy)return;
 const revision=++focusRefreshRevision;if(focusRefreshTimer!==null){clearTimeout(focusRefreshTimer);focusRefreshTimer=null;}
 focusVerified=false;window.FocurvePopupUI?.renderFocus();
 try{const session=await siteRequest('DEV_SESSION_STATE');
  if(revision!==focusRefreshRevision)return;
  validateFocusSession(session);focusVerified=true;showFocus(session);
  if(['UNKNOWN','NATIVE_VERIFYING','EFFECT_VERIFYING'].includes(session?.status))scheduleFocusRecheck();else focusRefreshAttempts=0;
 }catch(error){
  if(revision!==focusRefreshRevision)return;
  focusVerified=false;window.FocurvePopupUI?.renderFocus();
  if(['REVALIDATION_REQUIRED','STALE_AGGREGATE','GENERATION_CHANGED','RESPONSE_UNCONFIRMED'].includes(error.message))scheduleFocusRecheck();
  throw error;
 }
}
function explainStartPolicy(code){
 const guidance={UNSUPPORTED_POLICY:'Shorts 지원 범위는 HTTPS youtube.com·www.youtube.com의 최상위 문서입니다. 다른 열린 탭의 YouTube 삽입 영상·비지원 하위 도메인 또는 Chrome 차단 규칙 미지원 여부를 확인해주세요. 지원되지 않는 대상은 임의로 제외하지 않습니다.',FEATURE_NOT_IMPLEMENTED:'현재 A1은 전역 키워드·성인 도메인·이미지 가림·사용 시간 수집 활성 정책을 실행하지 않습니다. 저장된 정책은 보존됩니다.',POLICY_COMBINATION_PENDING_B:'현재 A1은 Shorts 제한과 사이트 RECORD 정책이 함께 있는 새 세션을 지원하지 않습니다. 저장된 정책은 보존됩니다.',INVALID_SNAPSHOT:'저장된 정책이 Snapshot 1.1의 전체 검증을 통과하지 못했습니다. 중첩 정책이나 잘못된 필드를 자동 삭제·보정하지 않습니다.'};return guidance[code]??'';
}
startFocus.addEventListener('click',async()=>{
 const minutes=Number(focusMinutes.value);
 if(!Number.isInteger(minutes)||minutes<1||minutes>180){focusResult.textContent='집중 시간은 1~180분 정수로 입력해주세요.';document.querySelector('#focus-feedback').textContent=focusResult.textContent;return;}
 if(!pendingStart||pendingStart.minutes!==minutes)pendingStart={minutes,id:crypto.randomUUID()};
 invalidateFocusReads();focusActionError=null;focusBusy=true;showFocus(focusSession);focusResult.textContent='차단을 적용하고 실제 상태를 확인하고 있습니다…';let actionError=null;
 try{const s=await siteRequest('DEV_SESSION_START',{duration_minutes:minutes},pendingStart.id);validateFocusSession(s,true);pendingStart=null;focusVerified=true;showFocus(s);}
 catch(error){focusActionError=actionError=`시작 결과 확인 실패 (${error.message}). 현재 상태를 확인해주세요.${explainStartPolicy(error.message)?'\n'+explainStartPolicy(error.message):''}`;focusResult.textContent=actionError;}
 finally{focusBusy=false;startFocus.disabled=true;endFocus.disabled=true;refreshFocus.disabled=false;try{await refreshFocusState();if(actionError){focusResult.textContent+='\n'+actionError;document.querySelector('#focus-feedback').textContent=actionError;}}catch{focusResult.textContent+='\n상태 조회 실패. 성공으로 확인되지 않았습니다.';}}
});
endFocus.addEventListener('click',async()=>{
 if(!focusSession)return;invalidateFocusReads();focusActionError=null;focusBusy=true;showFocus(focusSession);focusResult.textContent='차단 해제를 확인하고 있습니다…';let actionError=null;
 try{const s=await siteRequest('DEV_SESSION_END',{session_id:focusSession.session_id});validateFocusSession(s,true);focusVerified=true;showFocus(s);}
 catch(error){focusActionError=actionError=`종료 결과 확인 실패 (${error.message}). 현재 상태를 확인해주세요.`;focusResult.textContent=actionError;}
 finally{focusBusy=false;startFocus.disabled=true;endFocus.disabled=true;refreshFocus.disabled=false;try{await refreshFocusState();if(actionError){focusResult.textContent+='\n'+actionError;document.querySelector('#focus-feedback').textContent=actionError;}}catch{focusResult.textContent+='\n상태 조회 실패. 해제 완료로 확인되지 않았습니다.';}}
});
refreshFocus.addEventListener('click',()=>{refreshFocusState().catch(()=>{startFocus.disabled=true;endFocus.disabled=true;focusResult.textContent='상태 확인 실패. 다시 확인해주세요.';});});
refreshFocusState().catch(()=>{focusResult.textContent='상태 확인 실패. 상태 다시 확인을 눌러주세요.';});

const refreshAccess = document.querySelector('#refresh-access');
const accessResult = document.querySelector('#access-result');
const accessList = document.querySelector('#access-list');
let accessData=null;
let accessBusy=false,accessCursor=null,accessQuery=null;
const accessFields=['access-from','access-to','access-session','access-host','access-kind'];
const accessNext=document.querySelector('#access-next'),accessDetail=document.querySelector('#access-detail');
const kstDay=date=>new Date(date.getTime()+9*3600000).toISOString().slice(0,10);
document.querySelector('#access-to').value=kstDay(new Date());document.querySelector('#access-from').value=kstDay(new Date(Date.now()-6*86400000));
const queryAccess=()=>({from_date:document.querySelector('#access-from').value,to_date:document.querySelector('#access-to').value,session_id:document.querySelector('#access-session').value,host:document.querySelector('#access-host').value.trim().toLowerCase(),event_type:document.querySelector('#access-kind').value});
function accessLock(busy){accessBusy=busy;refreshAccess.disabled=busy;accessNext.disabled=busy;for(const id of accessFields)document.querySelector('#'+id).disabled=busy;}
async function loadAccess(next=false){
 if(accessBusy)return;accessLock(true);accessDetail.hidden=true;accessResult.textContent='저장된 접근 기록을 확인하고 있습니다…';
 try{
  const query=next?{...accessQuery,cursor:accessCursor}:queryAccess(),data=await siteRequest('DEV_ACCESS_LIST',query);
  if(!Array.isArray(data?.items)||!Number.isSafeInteger(data.total_access)||!Number.isSafeInteger(data.repeat_access)||data.total_access<0||data.repeat_access<0||data.repeat_access>data.total_access)throw Error('INVALID_ACCESS_RESPONSE');
  accessData=data;window.FocurvePopupUI?.renderRecords();accessList.replaceChildren();accessQuery={...query};delete accessQuery.cursor;accessCursor=data.next_cursor??null;accessNext.hidden=!accessCursor;
  const select=document.querySelector('#access-session'),selected=select.value;select.replaceChildren(new Option('전체 비회원 세션',''));for(const s of data.sessions??[])select.append(new Option(`${s.started_at?new Date(s.started_at).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'}):s.session_id} · ${s.status}`,s.session_id));select.value=selected;
  const repeatRatio=data.total_access>0?(data.repeat_access/data.total_access*100).toFixed(1)+'%':'자료 없음';
  accessResult.textContent=data.quarantined_count?`기존 이벤트 ${data.quarantined_count}건의 계약 오류를 격리하고 원본을 보존했습니다.`:`수집된 전체 ${data.total_access}회 · 반복 ${data.repeat_access}회 · 반복 비율 ${repeatRatio} (부분 기록 · 미수집 0건으로 추정하지 않음)${data.confirmed_focus_ms===null?' · 확인된 집중 시간 미확인':` · 확인된 종료 구간 ${Math.floor(data.confirmed_focus_ms/1000)}초`}`;
  for(const event of data.items){const row=document.createElement('li'),button=document.createElement('button'),type=event.event_type==='BLOCKED_FEATURE_ACCESS'?'Shorts 제한 접근':event.event_type==='BLOCKED_SITE_ACCESS'?'차단 접근':'기록 접근';button.type='button';button.textContent=`#${event.payload.access_seq} · ${type} · ${event.payload.target_host} · ${new Date(event.occurred_at).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'})}${event.is_repeat?' · 반복':''}`;
   button.addEventListener('click',async()=>{if(accessBusy)return;accessLock(true);try{const detail=await siteRequest('DEV_ACCESS_LIST',{...accessQuery,event_id:event.event_id});if(!detail.detail)throw Error('DETAIL_MISSING');accessDetail.textContent=JSON.stringify(detail.detail,null,2);const adjust=document.createElement('button');adjust.type='button';adjust.textContent='다음 세션 설정 수정';adjust.addEventListener('click',()=>window.FocurvePopupUI?.openSites());accessDetail.append(adjust);accessDetail.hidden=false;}catch{accessResult.textContent='당시 정책 상세를 확인하지 못했습니다. 원본 기록은 유지됩니다.';}finally{accessLock(false);}});row.append(button);accessList.append(row);}
  if(!data.items.length&&!data.quarantined_count){const row=document.createElement('li');row.textContent='선택 조건에 저장된 접근 기록이 없습니다. 수집 완전성을 뜻하지 않습니다.';accessList.append(row);}
 }catch{accessData=null;accessCursor=null;accessNext.hidden=true;window.FocurvePopupUI?.renderRecords();accessResult.textContent='기록을 조회하지 못했습니다. 조건을 확인하고 다시 조회해주세요.';accessList.replaceChildren();}
 finally{accessLock(false);}
}
refreshAccess.addEventListener('click',()=>loadAccess());accessNext.addEventListener('click',()=>loadAccess(true));
for(const id of accessFields)document.querySelector('#'+id).addEventListener('change',()=>{accessCursor=null;accessNext.hidden=true;accessDetail.hidden=true;});
