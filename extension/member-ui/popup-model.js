/* Presentation controller. Session/authentication implementation remains the R3 worker. */
(function(root){
 'use strict';
 const uncertain=new Set(['UNKNOWN','START_FAILED','RESPONSE_UNCONFIRMED','UNCONFIRMED']);
 const idle=new Set(['IDLE','ENDED']);
 function present(data,held=false){
  const linked=data?.phase==='LINKED'&&data.error===null&&data.recovery_pending===false;
  const status=data?.display_status??data?.local_status;
  const blocked=held||!data||uncertain.has(status)||data.authentication_hold===true&&!['UNREGISTERED','REGISTERED'].includes(data.phase)||data.recovery_pending===true||Boolean(data.error);
  const running=linked&&!blocked&&status==='RUNNING'&&data.server_confirmed_running===true;
  const canRecover=!held&&!uncertain.has(status)&&data?.phase==='AUTH_RECOVERY_REQUIRED'&&data.recovery_available===true;
  const canRecoverConfirm=!held&&!uncertain.has(status)&&data?.phase==='LINK_PENDING'&&data.recovery_pending===true&&data.recovery_available===true;
  return {linked,running,canRecover,canRecoverConfirm,canStart:linked&&!blocked&&idle.has(status),canManage:linked&&!blocked&&idle.has(status),canEnd:running,
   canConnect:!held&&['UNREGISTERED','REGISTERED'].includes(data?.phase)&&(!data.error||data.phase==='REGISTERED'&&data.error==='LINK_EXPIRED')&&data.recovery_pending!==true&&data.guest_start_allowed===true,
   canClaim:!held&&data?.phase==='LINK_PENDING'&&data.recovery_pending===false,
   headline:canRecover?'계정을 다시 확인해 주세요':canRecoverConfirm?'웹에서 연결을 승인해 주세요':blocked?'상태 확인이 필요해요':running?'지금, 집중하고 있어요':linked&&status==='ENDED'?'집중을 마쳤어요':linked&&idle.has(status)?'집중할 준비가 되었어요':linked?'집중 상태를 확인하고 있어요':'나만의 집중을 시작하세요',
   detail:canRecover?'기존 계정과 기록은 유지돼요. 같은 FOCURVE 계정으로 다시 로그인하고 연결을 승인해 주세요.':canRecoverConfirm?'로그인한 웹에서 승인한 뒤 아래 승인 확인을 눌러 주세요. 집중은 시작하지 않아요.':blocked?'결과를 확인할 수 없어 시작과 종료를 멈췄어요. 기존 기록은 안전하게 보존합니다.':running?'저장한 사이트 정책으로 집중을 돕고 있어요.':linked&&status==='ENDED'?'기록과 통계는 웹 대시보드에서 확인해 주세요.':linked?'설정 변경은 다음 집중부터 적용돼요.':'비회원으로 사용하거나 웹에서 계정을 만들어 연결할 수 있어요.'};
 }
 function friendlyError(code){
  if(code==='RECOVERY_NOT_ADMISSIBLE'||code==='RECOVERY_OBLIGATION_UNCONFIRMED')return '현재 상태에서는 재연결할 수 없어요. 기존 기록을 보존하고 실행 안내를 확인해 주세요.';
  if(code==='INSTALLATION_START_WINDOW_CLOSED')return '이번 실행에서 새 집중을 끝낼 시간이 부족해요. 정상 종료 후 다시 실행해 주세요.';
  if(code==='INSTALLATION_STOPPING')return '프로그램을 종료하고 있어요. 새 집중은 다음 실행에서 시작해 주세요.';
  if(code==='INSTALLATION_NOT_READY')return '프로그램의 연결 준비가 아직 끝나지 않았어요. 실행 창의 안내를 확인해 주세요.';
  if(code==='RELEASE_API_MISMATCH')return '설치된 웹과 확장의 연결 설정이 달라요. 설치 안내에서 연결 설정을 확인해 주세요.';
  if(code==='LINK_EXPIRED')return '연결 요청이 만료되었어요. 웹에서 연결 상태를 확인해 주세요.';
  if(code==='MAIL_UNAVAILABLE')return '아직 이메일 발송이 설정되지 않았어요. 설치 관리자에게 메일 설정을 요청해 주세요.';
  return '작업 결과를 확인하지 못했어요. 데이터를 지우거나 같은 작업을 반복하지 말고 설치 안내를 확인해 주세요.';
 }
 function controller({send,config,matches,onChange,onError,onResult=()=>{},reserve=async()=>{},confirm=async()=>{},onHold=async()=>{},readyAllowed=()=>true,startAllowed=()=>true,initialHold=false,uuid=()=>crypto.randomUUID(),timeoutMs=12000}){
  let state=null,busy=false,held=initialHold,closed=false,epoch=0;
  function view(){const p=present(state,held),ready=readyAllowed();return {...p,ready,canStart:p.canStart&&ready&&startAllowed(),canEnd:p.canEnd&&ready,canConnect:p.canConnect&&ready,canClaim:p.canClaim&&ready,canManage:p.canManage&&ready,busy};}
  function render(){if(!closed)onChange({...view(),state});}
  async function act(action,payload={}){
   const recovery=action==='RECOVER_BEGIN'||action==='RECOVER_CONFIRM';
   if(busy||closed||action!=='STATE'&&!recovery&&!readyAllowed())return false;
   const p=present(state,held);
   if(held||action==='RECOVER_BEGIN'&&!p.canRecover||action==='RECOVER_CONFIRM'&&!p.canRecoverConfirm||action==='START'&&!p.canStart||action==='END'&&!p.canEnd||action==='CONNECT'&&!p.canConnect||action==='CLAIM'&&!p.canClaim||action==='DISCONNECT'&&!(p.linked&&p.canStart))return false;
   if(action==='START'&&(!startAllowed(payload.minutes)||!Number.isInteger(payload.minutes)||payload.minutes<1||payload.minutes>180))return false;
   const transfer=['IMPORT_LIST','IMPORT_SELECTED','SETTINGS_LIST','SETTINGS_SELECTED'].includes(action);
   if(transfer&&(!p.linked||!p.canStart))return false;
   if(action.endsWith('_SELECTED')&&(!Array.isArray(payload.ids)||!payload.ids.length||payload.ids.length>100||payload.ids.some(v=>typeof v!=='string'||!v||v.length>256)||new Set(payload.ids).size!==payload.ids.length))return false;
   if(!['STATE','START','END','CONNECT','CLAIM','DISCONNECT','IMPORT_LIST','IMPORT_SELECTED','SETTINGS_LIST','SETTINGS_SELECTED','RECOVER_BEGIN','RECOVER_CONFIRM'].includes(action))return false;
   const generation=++epoch;busy=true;render();let timer;const requestId=uuid(),mutation=action!=='STATE'&&!action.endsWith('_LIST');
   try{
    const body=action==='CONNECT'?config():action==='RECOVER_BEGIN'?{config:config(),approval_id:requestId}:payload;
    if(mutation)await reserve({requestId,action,...(action==='CONNECT'&&state?.phase==='REGISTERED'&&state.error==='LINK_EXPIRED'?{previousDefinitiveError:'LINK_EXPIRED'}:{})});
    if(closed||generation!==epoch)return false;
    const response=await Promise.race([send({type:'INDEPENDENT_MEMBER_UI',request_id:requestId,action,payload:body}),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('RESPONSE_UNCONFIRMED')),timeoutMs);})]);
    if(closed||generation!==epoch)return false;
    if(!response?.ok&&mutation&&['INSTALLATION_STOPPING','INSTALLATION_START_WINDOW_CLOSED','INSTALLATION_NOT_READY'].includes(response?.error)){await confirm(requestId);onError(friendlyError(response.error));return false;}
    if(!response?.ok||!response.data||typeof response.data!=='object')throw Error(response?.error??'RESPONSE_UNCONFIRMED');
    const data=response.data;
    if(data.phase&&!matches(data))throw Error('RELEASE_API_MISMATCH');
    if(uncertain.has(data.local_status)||uncertain.has(data.display_status))throw Error('RESPONSE_UNCONFIRMED');
    // Mutating responses are not necessarily auth snapshots. Fetch STATE once,
    // never repeat START/END/CONNECT after uncertain or lost responses.
    if(transfer){onResult(action,data);if(mutation)await confirm(requestId);return true;}
    if(action==='STATE'||data.phase)state=data;
    else state={...state,...data};
    if(mutation)await confirm(requestId);return true;
   }catch(e){if(!closed&&generation===epoch){held=true;try{await onHold({requestId,action});}catch{}onError(friendlyError(e.message));}return false;}
   finally{clearTimeout(timer);busy=false;render();}
  }
  return Object.freeze({act,view,close:()=>{closed=true;epoch++;},held:()=>held});
 }
 root.FocurveUserPopup=Object.freeze({present,friendlyError,controller});
 if(typeof module!=='undefined')module.exports=root.FocurveUserPopup;
})(globalThis);
