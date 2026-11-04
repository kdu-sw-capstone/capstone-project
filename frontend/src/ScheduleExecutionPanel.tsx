import {useEffect,useState} from "react";
import {Panel} from "./AdditionalUi";
import {message} from "./api";
import type {ConfigRecord} from "./additionalConfigApi";
import {scheduleOccurrences,scheduleHistoryIds,occurrenceLabel,type Occurrence} from "./scheduleActorApi";

/** Reuses the saved config and legacy actor occurrence query; never starts a reservation. */
export default function ScheduleExecutionPanel({executor,records}:{executor:string;records:ConfigRecord[]}){
 const schedules=records.filter(r=>r.executor_id===executor&&r.value.kind==="FOCUS_SCHEDULE");
 const key=JSON.stringify([executor,...schedules.map(r=>[r.config_id,r.version])]);const [retry,setRetry]=useState(0);
 const [view,setView]=useState<{key:string;items:Occurrence[];error:string;loading:boolean}>({key:"",items:[],error:"",loading:true});
 useEffect(()=>{let disposed=false;const abort=new AbortController();setView({key,items:[],error:"",loading:true});
  // Saved active configs alone cannot rediscover a deleted schedule after reentry.
  // The existing owner-bound history route preserves its issued session and fixed end.
  void scheduleHistoryIds(executor,abort.signal).then(values=>Promise.all([...new Set([...values,...schedules.map(r=>r.config_id)])].map(id=>scheduleOccurrences(id,abort.signal)))).then(items=>{if(!disposed)setView({key,items:items.flat(),error:"",loading:false});}).catch(error=>{if(!disposed)setView({key,items:[],error:message(error),loading:false});});
  return()=>{disposed=true;abort.abort();};
 // Identity/version is the request key; a late response cannot describe a new setting or owner.
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[key,retry]);
 const current=view.key===key?view:{key,items:[],error:"",loading:true};
 return <Panel title="예약 실행 상태"><p>예약 설정 저장과 실제 실행·해제는 별도로 확인합니다. 종료 시각은 시작 당시 예약에 고정됩니다.</p>
  {current.loading?<p role="status">예약 실행 기록을 확인하고 있습니다.</p>:current.error?<p role="alert">{current.error} · 실제 실행 성공을 뜻하지 않습니다.</p>:<>
   {!current.items.length&&<p>{schedules.length?"설정 저장됨 · 예약 actor 실행 요청·실제 적용 확인 대기":"확인된 예약 실행 기록이 없습니다. 실행·해제 성공을 뜻하지 않습니다."}</p>}
   <ul>{current.items.map(row=><li key={row.occurrence_id}>예약 버전 {row.schedule_version} · {occurrenceLabel(row)}<p>고정 종료: {row.scheduled_end_at}</p>{!schedules.some(s=>s.config_id===row.schedule_id&&s.version===row.schedule_version)&&<p>이전 설정 버전의 실행 기록입니다.</p>}</li>)}</ul>
  </>}
  {schedules.some(r=>(r.value.when as {recurrence?:string})?.recurrence==="ONCE")&&<p>일회성 예약 actor 연결은 계약 합의 대기입니다. 주간 예약으로 변환하지 않습니다.</p>}
  <button disabled={current.loading} onClick={()=>setRetry(n=>n+1)}>예약 실행 기록 다시 조회</button>
 </Panel>;
}
