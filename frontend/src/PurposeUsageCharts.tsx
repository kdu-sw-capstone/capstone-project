import "./purpose-usage.css";

// Presentation-only input types. They are not an HTTP/Wire contract and are not
// populated from current /sites, access counts, or focus-session duration.
export const PURPOSES = ["FOCUS", "DISTRACTION", "GENERAL"] as const;
export type Purpose = typeof PURPOSES[number];
export const PURPOSE_LABELS: Record<Purpose,string> = {FOCUS:"집중",DISTRACTION:"방해",GENERAL:"일반"};
export const PURPOSE_COLORS: Record<Purpose,string> = {FOCUS:"#579fff",DISTRACTION:"#7dd3e8",GENERAL:"#bdd6ef"};
export type PurposeTimes = Record<Purpose,number|null>;
type PendingState = {status:"loading"}|{status:"unknown";reason?:string}|{status:"empty"}|{status:"error";message:string};
export type PurposeUsageState = PendingState|{status:"ready";totals:PurposeTimes};
export type PurposeUsageDay = {date:string;milliseconds:PurposeTimes};
export type PurposeUsageDaysState = PendingState|{status:"ready";days:readonly PurposeUsageDay[]};
export const PURPOSE_USAGE_UNAVAILABLE = "분류별 이용시간의 확인된 집계가 아직 연결되지 않았어요. 미확인은 0분이나 이용 기록 없음과 다릅니다.";
const amount = (value:unknown):value is number => typeof value==="number"&&Number.isSafeInteger(value)&&value>=0;
const validTimes = (times:PurposeTimes) => !!times&&PURPOSES.every(p=>times[p]===null||amount(times[p]));
export function usageDuration(milliseconds:number|null):string {
  if(milliseconds===null)return "미확인";
  if(!amount(milliseconds))return "미확인";
  if(milliseconds===0)return "0분";
  const seconds=Math.floor(milliseconds/1000);
  if(seconds===0)return "1초 미만";
  const parts=[Math.floor(seconds/3600)?Math.floor(seconds/3600)+"시간":"",Math.floor(seconds/60)%60?Math.floor(seconds/60)%60+"분":"",seconds%60?seconds%60+"초":""];
  return parts.filter(Boolean).join(" ");
}
function statusText(state:PendingState):string {
  return state.status==="loading"?"분류별 이용시간을 확인하고 있어요.":state.status==="empty"?"확인된 이용 기록이 없습니다.":state.status==="error"?state.message:state.reason??PURPOSE_USAGE_UNAVAILABLE;
}
function dot(purpose:Purpose) {
  return <span aria-hidden="true" className="purpose-dot" style={{background:PURPOSE_COLORS[purpose]}}/>;
}
export function PurposeUsageDonut({state}:{state:PurposeUsageState}) {
  const ready=state.status==="ready"&&validTimes(state.totals);
  const complete=ready&&PURPOSES.every(p=>state.totals[p]!==null);
  const total=complete?PURPOSES.reduce((sum,p)=>sum+state.totals[p]!,0):null;
  const validTotal=total!==null&&Number.isSafeInteger(total);
  const known=complete&&validTotal;
  const first=known&&total>0?state.totals.FOCUS!/total*100:0;
  const second=known&&total>0?(state.totals.FOCUS!+state.totals.DISTRACTION!)/total*100:0;
  const neutralLabel=state.status==="empty"?"기록 없음":state.status==="loading"?"확인 중":"미확인";
  const accessible=known?`사이트 이용시간 ${usageDuration(total)}: ${PURPOSES.map(p=>PURPOSE_LABELS[p]+" "+usageDuration(state.totals[p])).join(", ")}`:state.status==="empty"?"사이트 이용 기록 없음 · 비율 없음":"사이트 이용시간 비율 미확인";
  const pending:PendingState=state.status==="ready"?{status:"unknown",reason:ready?(complete?"이용시간 합계의 수치를 확인하지 못해 전체 비율을 계산하지 않습니다.":"일부 분류의 이용시간이 미확인이라 전체 비율을 계산하지 않습니다."):"분류별 이용시간의 수치를 확인하지 못했어요."}:state;
  return <div className="purpose-time-view">
    <div className="distribution purpose-time-distribution">
      <div className="donut" role="img" aria-label={accessible} style={{background:known&&total>0?`conic-gradient(${PURPOSE_COLORS.FOCUS} 0% ${first}%, ${PURPOSE_COLORS.DISTRACTION} ${first}% ${second}%, ${PURPOSE_COLORS.GENERAL} ${second}% 100%)`:"var(--border)"}}><div><strong>{known?usageDuration(total):neutralLabel}</strong><small>사이트 이용시간</small></div></div>
      <div className="purpose-time-legend"><ul>{PURPOSES.map(p=><li key={p}>{dot(p)}<span>{PURPOSE_LABELS[p]}</span><strong>{ready?usageDuration(state.totals[p]):state.status==="empty"?"기록 없음":"미확인"}</strong><small>{known&&total>0?(state.totals[p]!/total*100).toFixed(1)+"%":"—"}</small></li>)}</ul>
    {!known&&<p className="muted purpose-time-status" role={state.status==="error"?"alert":"status"}>{statusText(pending)}</p>}
    {known&&total===0&&<p className="muted purpose-time-status">확인된 이용시간은 0분이며 계산할 비율이 없습니다.</p>}
    </div></div>
  </div>;
}
function validDays(days:readonly PurposeUsageDay[]):boolean {
  if(!Array.isArray(days)||days.length!==7)return false;
  let previous:number|undefined;
  for(const day of days){
    if(!day||!/^\d{4}-\d\d-\d\d$/.test(day.date)||!validTimes(day.milliseconds))return false;
    const timestamp=Date.parse(day.date+"T00:00:00.000Z");
    if(!Number.isFinite(timestamp)||new Date(timestamp).toISOString().slice(0,10)!==day.date||previous!==undefined&&timestamp-previous!==86400000)return false;
    previous=timestamp;
  }
  return true;
}
export default function PurposeUsageByDay({state={status:"unknown"}}:{state?:PurposeUsageDaysState}) {
  const ready=state.status==="ready"&&validDays(state.days);
  const days=ready?state.days:[];
  const known=days.flatMap(day=>PURPOSES.map(p=>day.milliseconds[p]).filter(amount));
  const peak=Math.max(1,...known);
  const partial=days.some(day=>PURPOSES.some(p=>day.milliseconds[p]===null));
  const pending:PendingState=state.status==="ready"?{status:"error",message:"최근 7일 분류별 이용시간의 날짜·수치를 확인하지 못했어요."}:state;
  return <section className="card purpose-usage-days" aria-label="최근 7일 분류별 사이트 이용시간" data-status={ready?"ready":pending.status}>
    <div className="panel-heading"><h4>최근 7일 · 분류별 사이트 이용시간</h4></div>
    <p className="muted">사이트 이용시간을 분류별로 비교합니다. 확인된 집중량이나 집중 세션 시간과는 다릅니다.</p>
    <ul className="purpose-usage-legend" aria-label="이용시간 분류">{PURPOSES.map(p=><li key={p}>{dot(p)}{PURPOSE_LABELS[p]}</li>)}</ul>
    {ready?<>
      <div className="purpose-bars" role="img" aria-label={`최근 7일 분류별 사이트 이용시간 막대그래프. ${days[0].date}부터 ${days[6].date}까지.${partial?" 일부 값 미확인. 미확인은 0으로 표시하지 않습니다.":""} 날짜별 값은 아래 표에서 확인할 수 있습니다.`}>
        {days.map(day=><div className="purpose-day" key={day.date}><div className="purpose-day-bars">{PURPOSES.map(p=>{const value=day.milliseconds[p];return value===null?<span className="purpose-bar-unknown" key={p} aria-hidden="true">?</span>:<span className="purpose-bar" key={p} aria-hidden="true" style={{height:`${value/peak*100}%`,background:PURPOSE_COLORS[p]}}/>;})}</div><span className="purpose-day-label">{day.date.slice(5).replace("-","/")}</span></div>)}
      </div>
      <details className="purpose-values"><summary>날짜별 이용시간 값 보기</summary><div className="purpose-values-scroll"><table><caption>최근 7일 · 분류별 사이트 이용시간</caption><thead><tr><th scope="col">날짜</th>{PURPOSES.map(p=><th scope="col" key={p}>{PURPOSE_LABELS[p]}</th>)}</tr></thead><tbody>{days.map(day=><tr key={day.date}><th scope="row">{day.date}</th>{PURPOSES.map(p=><td key={p}>{usageDuration(day.milliseconds[p])}</td>)}</tr>)}</tbody></table></div></details>
      {partial&&<p className="muted" role="status">일부 이용시간은 미확인입니다. 물음표는 0분을 뜻하지 않습니다.</p>}
    </>:<><div className="purpose-bars-placeholder" aria-hidden="true"/><p className="purpose-days-status" role={pending.status==="error"?"alert":"status"}>{statusText(pending)}</p></>}
  </section>;
}
