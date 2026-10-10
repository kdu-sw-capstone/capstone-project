import {useEffect, useState} from "react";
import {request, message, ApiError} from "./api";
import QueryTimestamp from "./QueryTimestamp";
import "./hourly-access.css";

type Bucket = {hour:number; timezone:string; total_access:number|null; repeat_access:number|null; blocked_access:number|null; quality:string; as_of:string};
export default function HourlyAccessPattern({from,to,refreshKey=0}:{from?:string;to?:string;refreshKey?:number}) {
  const [data,setData]=useState<Bucket[]|null>(null);
  const [loading,setLoading]=useState(true),[error,setError]=useState("");
  const [retry,setRetry]=useState(0);
  useEffect(()=>{
    const controller=new AbortController();
    setLoading(true);setError("");setData(null);
    const query=new URLSearchParams({...(from?{from_date:from}:{}),...(to?{to_date:to}:{})});
    void request<Bucket[]>("/statistics/hourly?"+query,"GET",undefined,{signal:controller.signal}).then(rows=>{
      if(controller.signal.aborted)return;
      if(!Array.isArray(rows)||rows.length!==24||rows.some((r,i)=>r.hour!==i||r.timezone!=="Asia/Seoul"||
        !["COMPLETE","PARTIAL","NO_DATA","NOT_COLLECTED"].includes(r.quality)||
        [r.total_access,r.repeat_access,r.blocked_access].some(n=>n!==null&&(!Number.isSafeInteger(n)||n<0))))
        throw new ApiError("SERVER_RESPONSE_INVALID",502);
      setData(rows);
    }).catch(e=>{if(!controller.signal.aborted)setError(message(e));})
      .finally(()=>{if(!controller.signal.aborted)setLoading(false);});
    return()=>controller.abort();
  },[from,to,retry,refreshKey]);
  const maximum=Math.max(1,...(data??[]).map(r=>r.total_access??0));
  const quality=data?.[0].quality;
  return <section className="card access-pattern">
    <div className="panel-heading"><h4>시간대별 접근 패턴</h4><span className="badge">추가 분석 · 한국 시간</span></div>
    <p className="muted">발생 시각 기준 접근 건수 · 집중 시간이나 사이트 이용 시간이 아닙니다.</p>
    {loading&&<p role="status">시간대별 접근을 확인하고 있습니다.</p>}
    {error&&<div><p role="alert">{error}</p><button onClick={()=>setRetry(n=>n+1)}>시간대 분석 다시 조회</button></div>}
    {data&&<>
      {quality==="PARTIAL"&&<p role="status">일부 기록이 미확인입니다. 수신된 건수만 표시하며 빈 시간대는 미확인으로 표시합니다.</p>}
      {quality==="NOT_COLLECTED"&&<p role="status">접근 기록이 수집되지 않았습니다.</p>}
      {quality==="NO_DATA"&&<p>조회 기간에 접근 기록이 없습니다.</p>}
      <div className="hourly-chart-scroll"><div className="hourly-chart" role="img" aria-label="한국 시간 0시부터 23시까지 접근 건수. 상세 건수 표에서 확인할 수 있습니다.">
        {data.map(r=><div className="hourly-column" key={r.hour} title={`${r.hour}시: ${r.total_access===null?"미확인":r.total_access+"건"}`}>
          <span className="hourly-value">{r.total_access??"?"}</span>
          <div className="hourly-track"><span style={{height:(r.total_access??0)/maximum*100+"%"}}/></div>
          <span>{r.hour}</span>
        </div>)}
      </div></div>
      <details className="hourly-details"><summary>시간대별 상세 건수</summary><div className="hourly-table-scroll"><table><caption>한국 시간 기준 접근 집계</caption><thead><tr><th>시간대</th><th>전체 접근</th><th>반복 접근</th><th>차단 접근</th></tr></thead><tbody>
        {data.map(r=><tr key={r.hour}><th>{r.hour}시–{r.hour+1}시</th><td>{r.total_access??"미확인"}</td><td>{r.repeat_access??"미확인"}</td><td>{r.blocked_access??"미확인"}</td></tr>)}
      </tbody></table></div></details>
      <QueryTimestamp value={data[0].as_of}/>
    </>}
  </section>;
}
