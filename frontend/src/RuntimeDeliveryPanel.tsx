import {useEffect,useState} from "react";
import {Panel} from "./AdditionalUi";
import {message} from "./api";
import {listConfigs,type ConfigRecord} from "./additionalConfigApi";
import {configDelivery} from "./runtimeDeliveryState";
import SiteTimeStatus from "./SiteTimeStatus";

const names={CONTENT:"콘텐츠 설정",SITE_TIME:"사이트 이용시간 설정",FOCUS_SCHEDULE:"예약 집중",CADENCE:"반복 집중·휴식"};
/** Independently mountable read-side panel; uses the existing API and UI components. */
export default function RuntimeDeliveryPanel({executor,records,onRefresh}:{executor:string;records?:ConfigRecord[];onRefresh?:()=>void}){
 const [reload,setReload]=useState(0),[result,setResult]=useState<{executor:string;rows:ConfigRecord[]|null;error:string}>({executor,rows:null,error:""});
 const [selected,setSelected]=useState<{executor:string;id:string}|null>(null);
 useEffect(()=>{if(records!==undefined)return;let disposed=false;const abort=new AbortController();setResult({executor,rows:null,error:""});
  void listConfigs(executor,abort.signal).then(rows=>{if(!disposed)setResult({executor,rows,error:""});}).catch(error=>{if(!disposed)setResult({executor,rows:null,error:message(error)});});
  return()=>{disposed=true;abort.abort();};
 },[executor,reload,records]);
 const visible=records!==undefined?(records.every(row=>row.executor_id===executor)?{executor,rows:records,error:""}:{executor,rows:null,error:"다른 브라우저의 설정은 표시하지 않습니다. 다시 조회해 주세요."}):result.executor===executor?result:{executor,rows:null,error:""};
 return <Panel title="설정 적용 상태"><p>설정 저장과 실제 브라우저 적용을 따로 확인합니다. 집중 시작·종료는 이 화면에서 실행하지 않습니다.</p>
  {visible.error?<p role="alert">{visible.error}</p>:visible.rows===null?<p role="status">현재 브라우저의 설정을 확인하고 있습니다.</p>:visible.rows.length===0?<p>저장된 추가 설정이 없습니다.</p>:<ul>{visible.rows.map(row=>{const delivery=configDelivery(row);return <li key={row.config_id}><strong>{names[row.value.kind]}</strong><p>{delivery.label}</p>{row.value.kind==="SITE_TIME"&&<button type="button" onClick={()=>setSelected({executor,id:row.config_id})}>이 정책의 적용·일일 기록 확인</button>}</li>;})}</ul>}
  {selected?.executor===executor&&visible.rows?.filter(row=>row.config_id===selected.id&&row.value.kind==="SITE_TIME").map(row=><SiteTimeStatus key={executor+"/"+row.config_id} executor={executor} configId={row.config_id} configurationVersion={row.version}/>)}
  <button type="button" onClick={()=>onRefresh?onRefresh():setReload(value=>value+1)} disabled={visible.rows===null&&!visible.error}>다시 조회</button>
 </Panel>;
}
