import {useEffect,useRef,useState} from "react";
import {request,message,UiError} from "./api";
import {Panel} from "./AdditionalUi";

export type UsageStatistics={scope:"INSTALLATION"|"ACCOUNT_TOTAL";quota_debit:false;aggregation:"SUM_OF_DEVICE_USAGE";from_date:string;to_date:string;browser_ms:number|null;focus_ms:number|null;repeat_count:number|null;repeat_ratio:number|null;quality:"COMPLETE"|"PARTIAL"|"UNKNOWN"|"NOT_COLLECTED"|"NO_DATA";as_of:string};
function latestDate(from:string){const epoch=Date.parse(from+"T00:00:00Z");if(!Number.isFinite(epoch))return undefined;try{return new Date(epoch+365*86400000).toISOString().slice(0,10);}catch{return undefined;}}
function duration(value:number|null){return value===null?"미확인":`${Math.floor(value/60000)}분 ${Math.floor(value/1000)%60}초`;}
export function parseUsage(value:UsageStatistics,scope:string,from:string,to:string){
 if(!value||value.scope!==scope||value.from_date!==from||value.to_date!==to||value.quota_debit!==false||value.aggregation!=="SUM_OF_DEVICE_USAGE"||!["COMPLETE","PARTIAL","UNKNOWN","NOT_COLLECTED","NO_DATA"].includes(value.quality))throw new UiError("이용시간 조회 범위와 응답을 확인하지 못했습니다.");
 for(const field of [value.browser_ms,value.focus_ms,value.repeat_count])if(field!==null&&(!Number.isSafeInteger(field)||field<0))throw new UiError("이용시간 수치를 확인하지 못했습니다.");
 if(value.repeat_ratio!==null&&(typeof value.repeat_ratio!=="number"||!Number.isFinite(value.repeat_ratio)||value.repeat_ratio<0||value.repeat_ratio>1))throw new UiError("반복 비율을 확인하지 못했습니다.");
 return value;
}
export default function BrowserUsageStatistics(){
 const day=new Intl.DateTimeFormat("sv-SE",{timeZone:"Asia/Seoul"}).format(new Date());
 const [from,setFrom]=useState(day),[to,setTo]=useState(day),[scope,setScope]=useState<"INSTALLATION"|"ACCOUNT_TOTAL">("INSTALLATION"),[executor,setExecutor]=useState("");
 const [installations,setInstallations]=useState<{executor_id:string;client_version:string}[]>([]),[linksReady,setLinksReady]=useState(false),[linkRetry,setLinkRetry]=useState(0);
 const [data,setData]=useState<UsageStatistics|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(""),[linkError,setLinkError]=useState("");
 const generation=useRef(0),pending=useRef<AbortController|null>(null);
 useEffect(()=>{let disposed=false;const controller=new AbortController();setLinksReady(false);setLinkError("");void request<{executor_id:string;client_version:string}[]>("/extension-installations","GET",undefined,{signal:controller.signal}).then(rows=>{if(!disposed){setInstallations(rows);setLinksReady(true);}}).catch(e=>{if(!disposed)setLinkError(message(e));});return()=>{disposed=true;controller.abort();};},[linkRetry]);
 useEffect(()=>()=>{++generation.current;pending.current?.abort();},[]);
 function changed(){setData(null);setError("");}
 async function load(){
  if(busy)return;const current=++generation.current;setBusy(true);setData(null);setError("");const controller=new AbortController();pending.current=controller;
  try {const query=new URLSearchParams({scope,from_date:from,to_date:to});if(scope==="INSTALLATION")query.set("executor_id",executor);
   const response=await request<UsageStatistics>("/amvp/statistics/browser-usage?"+query,"GET",undefined,{signal:controller.signal});if(current===generation.current)setData(parseUsage(response,scope,from,to));
  }catch(e){if(current===generation.current)setError(message(e));}finally{if(current===generation.current)setBusy(false);}
 }
 return <section className="additional-ui"><Panel title="브라우저 이용시간"><p>확정된 기기별 이용시간의 합계입니다. 집중 시간과 중첩될 수 있으므로 두 시간을 합하지 않습니다. 계정 전체 조회는 설치별 한도를 변경하지 않습니다.</p>
  {linkError&&<div role="alert">{linkError}<button onClick={()=>setLinkRetry(n=>n+1)}>설치 목록 다시 조회</button></div>}
  <form onSubmit={e=>{e.preventDefault();void load();}}><fieldset disabled={busy}><legend>이용시간 조회 범위</legend><div className="additional-grid">
   <label>조회 범위<select value={scope} onChange={e=>{changed();setScope(e.target.value as typeof scope);}}><option value="INSTALLATION">설치별</option><option value="ACCOUNT_TOTAL">계정 전체</option></select></label>
   {scope==="INSTALLATION"&&<label>이용시간 대상 설치<select value={executor} required disabled={!linksReady} onChange={e=>{changed();setExecutor(e.target.value);}}><option value="">설치를 선택하세요</option>{installations.map(i=><option key={i.executor_id} value={i.executor_id}>{i.client_version} · {i.executor_id}</option>)}</select></label>}
   <label>이용시간 시작 날짜<input type="date" required value={from} onChange={e=>{changed();setFrom(e.target.value);}}/></label><label>이용시간 종료 날짜<input type="date" required value={to} min={from} max={latestDate(from)} onChange={e=>{changed();setTo(e.target.value);}}/></label>
  </div><p>각 원장에 저장된 시간대의 날짜 기준, 최대 366일을 조회합니다.</p><button disabled={scope==="INSTALLATION"&&(!linksReady||!executor)}>이용시간 조회</button></fieldset></form>
  {busy&&<p role="status">이용시간을 조회하고 있습니다.</p>}{error&&<p role="alert">{error}</p>}
  {data&&<div aria-label="브라우저 이용시간 결과"><dl><dt>확정 브라우저 시간</dt><dd>{duration(data.browser_ms)}</dd><dt>집중 시간</dt><dd>{duration(data.focus_ms)}</dd><dt>반복 접근</dt><dd>{data.repeat_count===null?"미확인":`${data.repeat_count}회`}</dd><dt>수집 상태</dt><dd>{{COMPLETE:"수집 완료",PARTIAL:"일부 수집",UNKNOWN:"미확인",NOT_COLLECTED:"미수집",NO_DATA:"자료 없음"}[data.quality]}</dd></dl><p>조회 기간 {data.from_date}~{data.to_date} · 조회 시각 {data.as_of}</p><p>격리·미확인 시간은 확정량에 더하지 않습니다. 미확인 항목은 0으로 표시하지 않습니다.</p></div>}
 </Panel></section>;
}
