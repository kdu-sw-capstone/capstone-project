import {request,UiError} from "./api";
export type FocusRef={session_id:string;snapshot_id:string;snapshot_format:"1.1"|"1.2";snapshot_sha256:string;desired_revision:number};
export type FocusState={operation_id:string;focus_ref:FocusRef;state:"STARTING"|"RUNNING"|"PAUSING"|"PAUSED"|"RESUMING"|"ENDING"|"ENDED"|"START_FAILED"|"UNKNOWN";confirmed_ms:number;remaining_ms:number;runtime_policy_unchanged:true;last_error_code:string|null};
type Context={owner_binding_id:string;executor_id:string;owner_epoch:number;capability_receipt_id:string;attachment_id:string|null;version:number;start_allowed:boolean;execute_before:string};
export type FocusView={state:FocusState;context:Context};
export type FocusAction="START"|"PAUSE"|"RESUME"|"END";
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const integer=(n:unknown,min=0)=>typeof n==="number"&&Number.isSafeInteger(n)&&n>=min;
const utc=(v:unknown)=>typeof v==="string"&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(v)&&Number.isFinite(Date.parse(v));
const keys=(v:object,names:string[])=>Object.keys(v).sort().join(",")===names.sort().join(",");
function invalid():never{throw new UiError("집중 제어의 신원·버전·실행 결과를 확인하지 못했습니다. 작업을 반복하지 마세요.");}
export function parseFocusState(raw:unknown,session:string):FocusState{
 const s=raw as FocusState,r=s?.focus_ref;
 if(!s||!keys(s,["operation_id","focus_ref","state","confirmed_ms","remaining_ms","runtime_policy_unchanged","last_error_code"])||!uuid.test(s.operation_id)||!r||!keys(r,["session_id","snapshot_id","snapshot_format","snapshot_sha256","desired_revision"])||r.session_id!==session||!uuid.test(r.session_id)||!uuid.test(r.snapshot_id)||!["1.1","1.2"].includes(r.snapshot_format)||!/^([a-f0-9]{64})$/.test(r.snapshot_sha256)||!integer(r.desired_revision,1)||!["STARTING","RUNNING","PAUSING","PAUSED","RESUMING","ENDING","ENDED","START_FAILED","UNKNOWN"].includes(s.state)||!integer(s.confirmed_ms)||!integer(s.remaining_ms)||s.runtime_policy_unchanged!==true||(s.last_error_code!==null&&(typeof s.last_error_code!=="string"||s.last_error_code.length<1||s.last_error_code.length>80)))invalid();
 return s;
}
/** Read-only same-origin query, headers supply transport metadata absent from strict FocusState.
 * Mutations still use the existing auth/CSRF/idempotence client. No Core capability negotiation. */
export async function readFocusControl(session:string,executor:string,signal?:AbortSignal):Promise<FocusView|null>{
 if(!uuid.test(session)||!uuid.test(executor))invalid();
 const response=await fetch(`/api/v1/amvp/focus/${session}/state`,{credentials:"same-origin",cache:"no-store",signal});
 if(response.status===404||response.status===503)return null;
 if(!response.ok)throw new UiError("집중 제어 상태 조회에 실패했습니다. 마지막 상태를 실행 성공으로 판단하지 마세요.");
 const state=parseFocusState(await response.json(),session);let c:Context|null=null;
 try{c=JSON.parse(response.headers.get("X-Focurve-Control-Context")??"null") as Context;}catch{invalid();}
 if(!c||!uuid.test(c.owner_binding_id)||c.executor_id!==executor||!uuid.test(c.capability_receipt_id)||!integer(c.owner_epoch,1)||!integer(c.version,1)||typeof c.start_allowed!=="boolean"||(c.attachment_id!==null&&!uuid.test(c.attachment_id))||!utc(c.execute_before)||response.headers.get("ETag")!==`"${c.version}"`)invalid();
 return {state,context:c};
}
export function focusControlWrite(view:FocusView,action:FocusAction,duration:number|null=null){
 const key=crypto.randomUUID(),operation=crypto.randomUUID(),frozen=structuredClone(view),c=frozen.context;
 if(action==="START"?(!c.start_allowed||!integer(duration,1)||duration!>180):duration!==null)invalid();
 if(action==="PAUSE"&&frozen.state.state!=="RUNNING"||action==="RESUME"&&frozen.state.state!=="PAUSED"||action==="END"&&!["RUNNING","PAUSED"].includes(frozen.state.state))invalid(); // UNKNOWN never offers an ordinary UI END
 const body={stream:"FOCUS_CONTROL",schema_version:"AMVP_FOCUS_CONTROL_1",request_id:crypto.randomUUID(),owner_binding_id:c.owner_binding_id,executor_id:c.executor_id,owner_epoch:c.owner_epoch,capability_receipt_id:c.capability_receipt_id,execute_before:c.execute_before,command:{operation_id:operation,focus_ref:frozen.state.focus_ref,action,expected_version:c.version,attachment_id:c.attachment_id,duration_minutes:duration}};
 return {async send(){const result=parseFocusState(await request(`/amvp/focus/${frozen.state.focus_ref.session_id}/commands`,"POST",body,{key,version:c.version}),frozen.state.focus_ref.session_id);
  if(result.operation_id!==operation||!sameFocusRef(result.focus_ref,frozen.state.focus_ref))invalid();return result; // request response is never actual effect proof
 }};
}
export function focusControlLabel(state:FocusState["state"]){return {STARTING:"시작 요청 대기",RUNNING:"집중 · 실제 적용 확인",PAUSING:"일시정지·해제 확인 대기",PAUSED:"일시정지 · 집중 제한 해제 확인",RESUMING:"재개·적용 확인 대기",ENDING:"종료·복원 확인 대기",ENDED:"종료 · 해제·복원 확인",START_FAILED:"시작 실패 · 원본 기록 보존",UNKNOWN:"UNKNOWN · 실행 결과 미확인"}[state];}
export function sameFocusRef(a:FocusRef,b:FocusRef){return a.session_id===b.session_id&&a.snapshot_id===b.snapshot_id&&a.snapshot_format===b.snapshot_format&&a.snapshot_sha256===b.snapshot_sha256&&a.desired_revision===b.desired_revision;}
