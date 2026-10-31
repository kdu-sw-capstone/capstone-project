import {useEffect,useState} from "react";
import {ApiError,message} from "./api";
import {Panel} from "./AdditionalUi";
import {listSiteTimeDeletions,type ConfigRecord} from "./additionalConfigApi";
import {dailyUsage,type DailyUsage} from "./dailyUsageApi";

const duration=(ms:number|null)=>ms===null?"미확인":`${Math.floor(ms/60000)}분 ${Math.floor(ms%60000/1000)}초`;
const localDate=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;};
/** Actual DAY-01 read; server history is not a fresh observation of remaining Core quota. */
export default function DailyUsagePanel({executor,records}:{executor:string;records:ConfigRecord[]}){
 const [includeDeleted,setIncludeDeleted]=useState(false);
 const [history,setHistory]=useState<{key:string;rows:ConfigRecord[];error:string}>({key:"",rows:[],error:""});
 const [selected,setSelected]=useState(""),[date,setDate]=useState(localDate),[reload,setReload]=useState(0);
 const historyKey=executor+"/"+reload;
 useEffect(()=>{
  if(!includeDeleted)return;let disposed=false;const abort=new AbortController();setHistory({key:"",rows:[],error:""});
  void listSiteTimeDeletions(executor,abort.signal).then(rows=>{if(!disposed)setHistory({key:historyKey,rows,error:""});}).catch(error=>{if(!disposed&&!abort.signal.aborted)setHistory({key:historyKey,rows:[],error:message(error)});});
  return()=>{disposed=true;abort.abort();};
 },[executor,includeDeleted,historyKey]);
 const currentHistory=includeDeleted&&history.key===historyKey?history:null;
 const combined=new Map(records.filter(r=>r.executor_id===executor&&r.value.kind==="SITE_TIME"&&r.deleted_at===null).map(r=>[r.config_id,r]));
 for(const row of currentHistory?.rows??[])if(row.executor_id===executor&&row.value.kind==="SITE_TIME"&&row.deleted_at!==null)combined.set(row.config_id,row);
 const policies=[...combined.values()];
 const policy=selected===""?policies[0]?.config_id??"":policies.some(p=>p.config_id===selected)?selected:"";
 const saved=policies.find(p=>p.config_id===policy);
 const key=executor+"/"+includeDeleted+"/"+policy+"/"+saved?.version+"/"+saved?.saved_runtime_revision+"/"+date;
 const [result,setResult]=useState<{key:string;data:DailyUsage|null;error:string}>({key:"",data:null,error:""});
 useEffect(()=>{
  let disposed=false;const abort=new AbortController();setResult({key,data:null,error:""});
  if(!policy||!date)return()=>{disposed=true;abort.abort();};
  void dailyUsage(executor,policy,date,abort.signal).then(data=>{if(!disposed)setResult({key,data,error:""});}).catch(error=>{if(!disposed&&!abort.signal.aborted)setResult({key,data:null,error:error instanceof ApiError&&[404,503].includes(error.status)?"이 날짜의 검증된 자료를 확인하지 못했습니다. 사용량 0 또는 이용 가능 상태를 뜻하지 않습니다.":message(error)});});
  return()=>{disposed=true;abort.abort();};
 },[executor,policy,date,key,reload]);
 const visible=result.key===key?result:{key,data:null,error:""};const data=visible.data;
 return <Panel title="사이트별 하루 이용시간"><p>선택한 설치·정책의 서버 확인 기록입니다. 브라우저의 최신 잔여 한도와 실제 차단은 별도 확인이 필요합니다.</p>
  <label><input type="checkbox" checked={includeDeleted} onChange={e=>{setIncludeDeleted(e.target.checked);setSelected("");}}/>삭제한 사이트 정책도 조회</label>
  {includeDeleted&&(!currentHistory?<p role="status">삭제된 정책 목록을 확인하고 있습니다.</p>:currentHistory.error?<p role="alert">{currentHistory.error} · 삭제된 정책이 없거나 사용량이 0이라는 뜻이 아닙니다.</p>:null)}
  {!policies.length?(!includeDeleted?<p>저장된 사이트 시간 정책이 없습니다.</p>:currentHistory&&!currentHistory.error?<p>이 설치에서 조회된 사이트 시간 정책이 없습니다.</p>:null):<>
   <label>조회할 사이트 정책<select value={policy} onChange={e=>setSelected(e.target.value)}><option value="">정책을 선택하세요</option>{policies.map(p=><option key={p.config_id} value={p.config_id}>{String((p.value.scope as {host?:string}|undefined)?.host??p.config_id)}{p.deleted_at!==null?` · 삭제됨 · 버전 ${p.version}`:""}</option>)}</select></label>
   {saved&&saved.deleted_at!==null&&<p>삭제된 정책의 과거 기록입니다. 현재 차단·해제 상태와 구분합니다.</p>}
   <label>정책 시간대 기준 날짜<input type="date" value={date} onChange={e=>setDate(e.target.value)}/></label>
   {!policy?<p>조회할 사이트 정책을 선택하세요.</p>:!date?<p>조회 날짜를 선택하세요.</p>:visible.error?<p role="alert">{visible.error}</p>:!data?<p role="status">일일 이용시간을 확인하고 있습니다.</p>:<>
    <dl><dt>서버 확인 사용량</dt><dd>{duration(data.confirmed_ms)}</dd><dt>기록에 결속된 하루 한도</dt><dd>{data.daily_limit_ms===null?"설정상 무제한":duration(data.daily_limit_ms)}</dd><dt>승계된 차감량</dt><dd>{duration(data.budget_carry_debit_ms)}</dd><dt>최신 잔여 한도</dt><dd>{data.quality!=="COMPLETE"||data.enforcement_state!=="APPLIED"?"미확인":duration(data.remaining_ms)}</dd><dt>기록 시간대</dt><dd>{data.timezone} · {data.day_kind==="TRANSITION"?"시간대 전환 구간":"자연일"}</dd></dl>
    <p>측정 품질: {data.quality==="COMPLETE"?"확인됨":"부분 자료 또는 미확인"} · 실제 제한: {data.enforcement_state==="APPLIED"?"적용 보고 확인":"미확인"}</p>
    <p>다음 이용 가능 시각: {data.next_usable_status==="KNOWN"&&data.next_usable_at?data.next_usable_at:"미확인"}</p>
   </>}
  </>}
  <button type="button" disabled={!date} onClick={()=>setReload(n=>n+1)}>일일 기록 다시 조회</button>
 </Panel>;
}
