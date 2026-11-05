import {useEffect,useState} from "react";
import {Panel} from "./AdditionalUi";
import {ApiError,message} from "./api";
import type {ConfigRecord} from "./additionalConfigApi";
import {scheduleOccurrences,scheduleHistoryIds,occurrenceLabel,type Occurrence} from "./scheduleActorApi";

/** Reuses the saved config and legacy actor occurrence query; never starts a reservation. */
export default function ScheduleExecutionPanel({executor,records}:{executor:string;records:ConfigRecord[]}){
 const schedules=records.filter(r=>r.executor_id===executor&&r.value.kind==="FOCUS_SCHEDULE");
 const key=JSON.stringify([executor,...schedules.map(r=>[r.config_id,r.version])]);const [retry,setRetry]=useState(0);
 const [view,setView]=useState<{key:string;items:Occurrence[];error:string;loading:boolean}>({key:"",items:[],error:"",loading:true});
 useEffect(()=>{let disposed=false;const abort=new AbortController();setView({key,items:[],error:"",loading:true});
  let authenticationExpired=false;
  const expire=(error:ApiError)=>{if(disposed||abort.signal.aborted||authenticationExpired)return;authenticationExpired=true;abort.abort();setView({key,items:[],error:message(error),loading:false});window.dispatchEvent(new Event("focurve:authentication-expired"));};
  // Saved active configs alone cannot rediscover a deleted schedule after reentry.
  // The existing owner-bound history route preserves its issued session and fixed end.
  const load=async()=>{
   const errors:string[]=[];let history:string[]=[];
   try{history=await scheduleHistoryIds(executor,abort.signal);}catch(error){
    if(disposed)return;if(error instanceof ApiError&&error.status===401)throw error;
    errors.push("이전 예약 목록을 확인하지 못했습니다. 삭제된 예약 이력은 일부 누락될 수 있습니다. "+message(error));
   }
   if(disposed)return;
   const results=await Promise.allSettled([...new Set([...history,...schedules.map(r=>r.config_id)])].map(id=>scheduleOccurrences(id,abort.signal).catch(error=>{if(error instanceof ApiError&&error.status===401)expire(error);throw error;})));
   if(disposed||authenticationExpired)return;const items:Occurrence[]=[];
   for(const result of results){if(result.status==="fulfilled")items.push(...result.value);else{
    if(result.reason instanceof ApiError&&result.reason.status===401)throw result.reason;
    errors.push("일부 예약 실행 기록을 확인하지 못했습니다. "+message(result.reason));
   }}
   setView({key,items,error:[...new Set(errors)].join(" "),loading:false});
  };
  void load().catch(error=>{if(error instanceof ApiError&&error.status===401){expire(error);return;}if(disposed||abort.signal.aborted||authenticationExpired)return;setView({key,items:[],error:message(error),loading:false});});
  return()=>{disposed=true;abort.abort();};
 // Identity/version is the request key; a late response cannot describe a new setting or owner.
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[key,retry]);
 const current=view.key===key?view:{key,items:[],error:"",loading:true};
 return <Panel title="예약 실행 상태"><p>예약 설정 저장과 실제 실행·해제는 별도로 확인합니다. 종료 시각은 시작 당시 예약에 고정됩니다.</p>
  {current.loading?<p role="status">예약 실행 기록을 확인하고 있습니다.</p>:<>
   {current.error&&<p role="alert">{current.error} · 조회되지 않은 실행·해제 상태는 미확인입니다. 실제 실행 성공을 뜻하지 않습니다.</p>}
   {!current.items.length&&!current.error&&<p>{schedules.length?"설정 저장됨 · 예약 actor 실행 요청·실제 적용 확인 대기":"확인된 예약 실행 기록이 없습니다. 실행·해제 성공을 뜻하지 않습니다."}</p>}
   <ul>{current.items.map(row=><li key={row.occurrence_id}>예약 버전 {row.schedule_version} · {occurrenceLabel(row)}<p>고정 종료: {row.scheduled_end_at}</p>{!schedules.some(s=>s.config_id===row.schedule_id&&s.version===row.schedule_version)&&<p>이전 설정 버전의 실행 기록입니다.</p>}</li>)}</ul>
  </>}
  {schedules.some(r=>(r.value.when as {recurrence?:string})?.recurrence==="ONCE")&&<p>일회성 예약 actor 연결은 계약 합의 대기입니다. 주간 예약으로 변환하지 않습니다.</p>}
  <button disabled={current.loading} onClick={()=>setRetry(n=>n+1)}>예약 실행 기록 다시 조회</button>
 </Panel>;
}
