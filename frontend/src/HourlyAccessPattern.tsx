import {useEffect,useState} from "react";
import {request,message,UiError} from "./api";
import {metricPercentage} from "./metricPercentage";

type HourMetrics={total_access:number|null;repeat_access:number|null;blocked_access:number|null;repeat_ratio:number|null;active_duration_ms:number|null;quality:"COMPLETE"|"PARTIAL"|"NO_DATA"|"NOT_COLLECTED"|"REVIEW_REQUIRED";as_of:string};
const amount=(value:unknown)=>typeof value==="number"&&Number.isSafeInteger(value)&&value>=0;
export function parseHours(value:unknown):HourMetrics[]{
 if(!Array.isArray(value)||value.length!==24)throw new UiError("시간대별 기록의 24개 구간을 확인하지 못했습니다.");
 for(const row of value){
  const at=typeof row?.as_of==="string"?Date.parse(row.as_of):NaN;
  if(!row||!["COMPLETE","PARTIAL","NO_DATA","NOT_COLLECTED","REVIEW_REQUIRED"].includes(row.quality)||!Number.isFinite(at)||!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(row.as_of)||new Date(at).toISOString()!==row.as_of||![row.total_access,row.repeat_access,row.blocked_access,row.active_duration_ms].every(v=>v===null||amount(v)))throw new UiError("시간대별 기록의 수집 근거를 확인하지 못했습니다.");
  const known=row.total_access!==null;
  if(known?(row.repeat_access===null||row.blocked_access===null||row.repeat_access>row.total_access||row.blocked_access>row.total_access||row.quality==="NOT_COLLECTED"||row.total_access===0&&row.repeat_ratio!==null||row.total_access>0&&(typeof row.repeat_ratio!=="number"||!Number.isFinite(row.repeat_ratio)||Math.abs(row.repeat_ratio-row.repeat_access/row.total_access)>1e-12)):(row.repeat_access!==null||row.blocked_access!==null||row.repeat_ratio!==null||row.quality==="COMPLETE"||row.quality==="NO_DATA"))throw new UiError("시간대별 접근 수치의 결속을 확인하지 못했습니다.");
 }
 return value;
}
export default function HourlyAccessPattern({from,to}:{from?:string;to?:string}){
 const key=JSON.stringify([from,to]);const [retry,setRetry]=useState(0),[view,setView]=useState<{key:string;rows:HourMetrics[]|null;error:string}>({key:"",rows:null,error:""});
 useEffect(()=>{let disposed=false;const abort=new AbortController();setView({key,rows:null,error:""});const query=new URLSearchParams();if(from)query.set("from_date",from);if(to)query.set("to_date",to);
  void request<unknown>("/statistics/hourly"+(query.size?"?"+query:""),"GET",undefined,{signal:abort.signal}).then(value=>{const rows=parseHours(value);if(!disposed)setView({key,rows,error:""});}).catch(error=>{if(!disposed&&!abort.signal.aborted)setView({key,rows:null,error:message(error)});});
  return()=>{disposed=true;abort.abort();};
 },[key,retry]);
 const current=view.key===key?view:{key,rows:null,error:""};
 return <section className="card access-pattern"><div className="panel-heading"><h4>시간대별 접근 패턴</h4><button disabled={!current.rows&&!current.error} onClick={()=>setRetry(n=>n+1)}>시간대별 기록 다시 조회</button></div>
  <p className="muted">한국 시간 기준 · 접수된 접근 기록의 하한값입니다. 빈 시간대는 0건·수집 완료를 뜻하지 않습니다. 이용시간·실제 제한 효과와 구분합니다.</p>
  {current.error?<p role="alert">{current.error}</p>:!current.rows?<p role="status">시간대별 접근 기록을 확인하고 있습니다.</p>:<div className="table-card"><table><caption>00시부터 23시까지 시간대별 접근·반복 기록</caption><thead><tr><th>시간대</th><th>접근</th><th>반복 접근</th><th>차단 접근</th><th>반복 비율</th><th>수집 상태</th></tr></thead><tbody>{current.rows.map((row,hour)=><tr key={hour}><th scope="row">{String(hour).padStart(2,"0")}시</th><td>{row.total_access??"미확인"}</td><td>{row.repeat_access??"미확인"}</td><td>{row.blocked_access??"미확인"}</td><td>{row.repeat_ratio===null?"미확인":metricPercentage(row.repeat_ratio)+"%"}</td><td>{{COMPLETE:"수집 완료",PARTIAL:"일부 수집",NO_DATA:"자료 없음",NOT_COLLECTED:"미수집",REVIEW_REQUIRED:"추가 확인 필요"}[row.quality]}</td></tr>)}</tbody></table><p>조회 기준 시각 {current.rows[0].as_of}</p></div>}
 </section>;
}

