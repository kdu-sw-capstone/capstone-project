import {request,UiError} from "./api";
export type Occurrence={occurrence_id:string;schedule_id:string;schedule_version:number;scheduled_start_at:string;scheduled_end_at:string;status:"PENDING"|"WAITING_CONFLICT"|"STARTING"|"RUNNING"|"FINISHED"|"SKIPPED";reason:string|null;session_id:string|null};
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
export async function scheduleHistoryIds(executor:string,signal?:AbortSignal):Promise<string[]>{
 if(!uuid.test(executor))throw new UiError("설치 식별자를 확인하지 못했습니다.");
 const page=await request<{items:{schedule_id:string;executor_id:string}[];has_more:boolean;next_cursor:string|null}>(`/schedules?${new URLSearchParams({executor_id:executor})}`,"GET",undefined,{signal});
 if(!page||!Array.isArray(page.items)||page.has_more!==false||page.next_cursor!==null||page.items.some(r=>!uuid.test(r.schedule_id)||r.executor_id!==executor)||new Set(page.items.map(r=>r.schedule_id)).size!==page.items.length)throw new UiError("이전 예약 기록의 설치를 확인하지 못했습니다.");
 return page.items.map(r=>r.schedule_id);
}
export async function scheduleOccurrences(schedule:string,signal?:AbortSignal):Promise<Occurrence[]>{
 if(!uuid.test(schedule))throw new UiError("예약 식별자를 확인하지 못했습니다.");
 const result=await request<{items:Occurrence[];has_more:boolean;next_cursor:string|null}>(`/schedules/${schedule}/occurrences`,"GET",undefined,{signal});
 if(!result||!Array.isArray(result.items)||result.has_more!==false||result.next_cursor!==null)throw new UiError("예약 실행 기록을 끝까지 확인하지 못했습니다.");
 const seen=new Set<string>();for(const row of result.items){
  if(!row||!uuid.test(row.occurrence_id)||seen.has(row.occurrence_id)||row.schedule_id!==schedule||!Number.isSafeInteger(row.schedule_version)||row.schedule_version<1||!["PENDING","WAITING_CONFLICT","STARTING","RUNNING","FINISHED","SKIPPED"].includes(row.status)||(row.reason!==null&&typeof row.reason!=="string")||(row.session_id!==null&&!uuid.test(row.session_id))||!Number.isFinite(Date.parse(row.scheduled_start_at))||!Number.isFinite(Date.parse(row.scheduled_end_at))||Date.parse(row.scheduled_start_at)>=Date.parse(row.scheduled_end_at))throw new UiError("예약 실행의 신원·상태를 확인하지 못했습니다.");seen.add(row.occurrence_id);
 }return result.items;
}
export function occurrenceLabel(row:Occurrence):string{
 if(row.reason==="EXECUTION_FAILED")return row.status==="FINISHED"&&row.session_id?"실행 실패 · 해제·복원 확인 · 원본 기록 보존":"실행 실패 · 원본 기록 보존";
 if(row.reason==="EXECUTION_UNKNOWN")return row.status==="FINISHED"&&row.session_id?"실행 결과 UNKNOWN 보존 · 해제·복원 확인":"실행 결과 UNKNOWN · 적용·해제 미확인";
 if(row.reason==="EVIDENCE_UNCONFIRMED")return "실행 결과 UNKNOWN · 적용·해제 미확인";
 if(row.reason==="CONFIG_CHANGED")return "설정 변경·삭제로 미시작 예약 취소";
 if(row.reason!==null&&!["EXPIRED","NONEXISTENT_TIME"].includes(row.reason))return "실행 결과 UNKNOWN · 적용·해제 미확인";
 if(row.status==="SKIPPED")return row.reason==="EXPIRED"?"잔여 60초 미만 또는 만료 · 건너뜀":"예약 건너뜀";
 if(row.status==="FINISHED"&&row.session_id)return "예약 종료 · 실제 해제·복원 확인";
 if(row.status==="RUNNING"&&row.session_id)return "예약 실행 · 실제 적용 확인";
 if(row.status==="WAITING_CONFLICT")return "기존 집중 우선 · 고정 종료까지 대기";
 return "실행 요청 대기 · 실제 적용 미확인";
}
