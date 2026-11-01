import {useEffect,useState} from "react";
import {message} from "./api";
import {Panel} from "./AdditionalUi";
import {configDelivery} from "./runtimeDeliveryState";
import {siteTimeStatus,type SiteTimeStatus as Status} from "./siteTimeStatusApi";

const localDate=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;};
const duration=(ms:number|null)=>ms===null?"미확인":`${Math.floor(ms/60000)}분 ${Math.floor(ms%60000/1000)}초`;
/** The existing CFG02 and DAY-01 reads stay separate evidence, even on one screen. */
export default function SiteTimeStatus({executor,configId,configurationVersion}:{executor:string;configId:string;configurationVersion:number}){
 const [date,setDate]=useState(localDate),[reload,setReload]=useState(0);
 const key=JSON.stringify([executor,configId,configurationVersion,date,reload]);
 const [view,setView]=useState<{key:string;data:Status|null;error:string}>({key:"",data:null,error:""});
 useEffect(()=>{let disposed=false;const abort=new AbortController();setView({key,data:null,error:""});
  if(date)void siteTimeStatus(executor,configId,date,abort.signal).then(data=>{if(!disposed)setView({key,data,error:""});}).catch(error=>{if(!disposed&&!abort.signal.aborted)setView({key,data:null,error:message(error)});});
  return()=>{disposed=true;abort.abort();};
 },[executor,configId,date,key]);
 const current=view.key===key?view:{key,data:null,error:""},data=current.data;
 return <Panel title="선택한 사이트의 상태">
  <p>정책 적용·일일 기록·삭제 후 해제는 각각 별도로 확인합니다.</p>
  <label>정책 시간대 기준 날짜<input type="date" value={date} onChange={e=>setDate(e.target.value)}/></label>
  {!date?<p>조회 날짜를 선택하세요.</p>:current.error?<p role="alert">{current.error}</p>:!data?<p role="status">선택한 정책의 서버 기록을 확인하고 있습니다.</p>:<>
   <p>{String((data.config.value.scope as {host?:string}|undefined)?.host??data.config.config_id)} · 서버 조회 버전 {data.config.version}</p>
   <p>{configDelivery(data.config).label}</p>
   {data.config.deleted_at!==null&&<p>삭제된 정책입니다. 사용 기록이 남아 있어도 실제 해제 확인과는 별개입니다.</p>}
   {data.usageUnavailable?<p>이 날짜의 검증된 이용시간을 확인하지 못했습니다. 사용량 0·이용 가능·해제 완료를 뜻하지 않습니다.</p>:data.usage&&<>
    <dl><dt>서버 확인 사용량</dt><dd>{duration(data.usage.confirmed_ms)}</dd><dt>기록에 결속된 하루 한도</dt><dd>{data.usage.daily_limit_ms===null?"설정상 무제한":duration(data.usage.daily_limit_ms)}</dd></dl>
    <p>측정 품질: {data.usage.quality==="COMPLETE"?"확인됨":"부분 자료 또는 미확인"} · 자료 기준: {data.usage.as_of}</p>
   </>}
   <p>일일 기록은 현재 정책의 적용·최신 잔여 한도·해제 성공을 증명하지 않습니다.</p>
  </>}
  <button type="button" disabled={!date} onClick={()=>setReload(n=>n+1)}>선택한 정책 다시 조회</button>
 </Panel>;
}
