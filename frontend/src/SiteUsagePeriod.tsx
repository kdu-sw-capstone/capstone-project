import {useEffect,useState} from "react";
import {message} from "./api";
import type {ConfigRecord} from "./additionalConfigApi";
import {kstToday,periodEnding,siteUsagePeriod,type UsagePeriod} from "./siteUsagePeriodApi";

const duration=(v:number|null)=>v===null?"미확인":`${Math.floor(v/60000)}분 ${Math.floor(v%60000/1000)}초`;
/** Existing DAY-01 projection, one selected policy only. No cross-policy/device sum. */
export default function SiteUsagePeriod({executor,policy}:{executor:string;policy:ConfigRecord|undefined}){
 const identity=JSON.stringify([executor,policy?.config_id,policy?.version,policy?.saved_runtime_revision,policy?.deleted_at,policy?.value]);
 return <PeriodReader key={identity} executor={executor} policy={policy}/>;
}
function PeriodReader({executor,policy}:{executor:string;policy:ConfigRecord|undefined}){
 const [from,setFrom]=useState(kstToday),[to,setTo]=useState(kstToday),[attempt,setAttempt]=useState(0);
 const policyId=policy?.config_id;
 const context=JSON.stringify([executor,policyId,from,to]);
 const [query,setQuery]=useState({key:"",attempt:0});
 const [result,setResult]=useState<{key:string;attempt:number;data:UsagePeriod|null;error:string;busy:boolean}>({key:"",attempt:0,data:null,error:"",busy:false});
 useEffect(()=>{
  if(!policyId||query.key!==context)return;
  let disposed=false;const abort=new AbortController();
  setResult({key:context,attempt:query.attempt,data:null,error:"",busy:true});
  void siteUsagePeriod(executor,policyId,from,to,abort.signal).then(data=>{if(!disposed)setResult({key:context,attempt:query.attempt,data,error:"",busy:false});}).catch(error=>{if(!disposed&&!abort.signal.aborted)setResult({key:context,attempt:query.attempt,data:null,error:message(error),busy:false});});
  return()=>{disposed=true;abort.abort();};
 },[context,query,executor,policyId,from,to]);
 const visible=result.key===context&&result.attempt===query.attempt&&query.key===context?result:null;
 const host=String((policy?.value.scope as {host?:string}|undefined)?.host??"");
 function changed(){setQuery({key:"",attempt:0});}
 function preset(days:number){const range=periodEnding(kstToday(),days);changed();setFrom(range.from);setTo(range.to);}
 return <fieldset><legend>선택한 사이트 정책의 기간별 기록</legend>
  <p>빠른 선택은 KST 오늘 기준입니다. 날짜별 조회는 원장에 저장된 시간대를 따르며, 기간 합계는 KST 정상일만 지원합니다. 최대 31일을 순서대로 조회합니다.</p>
  <div className="additional-actions"><button type="button" onClick={()=>preset(1)}>오늘</button><button type="button" onClick={()=>preset(7)}>최근 7일</button><button type="button" onClick={()=>preset(30)}>최근 30일</button></div>
  <div className="additional-grid"><label>정책 기록 시작일<input type="date" required value={from} onChange={e=>{changed();setFrom(e.target.value);}}/></label><label>정책 기록 종료일<input type="date" required min={from} value={to} onChange={e=>{changed();setTo(e.target.value);}}/></label></div>
  <button type="button" disabled={!policy} onClick={()=>{const n=attempt+1;setAttempt(n);setQuery({key:context,attempt:n});}}>기간 기록 조회</button>
  {visible?.busy&&<p role="status">기간 기록을 조회하고 있습니다. 입력을 변경하면 이전 요청을 취소합니다.</p>}
  {visible?.error&&<p role="alert">{visible.error} · 기존 결과를 표시하지 않습니다. 기간 기록 조회로 다시 시도하세요.</p>}
  {visible?.data&&<div aria-label="사이트 정책 기간 기록">
   <p style={{overflowWrap:"anywhere"}}>정책 매칭 호스트: {host} · 등록 ID {policy?.config_id} · 현재 참조 버전 {policy?.version}. 과거 정책 버전과 실제 방문 호스트별 내역은 일일 응답에 없어 구분 조회할 수 없습니다. 삭제·재등록된 ID의 자료를 합치지 않습니다.</p>
   <dl><dt>확인된 날짜의 확정량 합계</dt><dd>{duration(visible.data.confirmedMs)}</dd><dt>확정량을 확인한 날짜</dt><dd>{visible.data.confirmedDays}/{visible.data.days.length}일 · 기간 전체 수집 완료를 뜻하지 않습니다.</dd></dl>
   {!visible.data.calendarCompatible&&<p role="status">KST와 다른 시간대·전환일 또는 겹치는 구간이 있어 기간 합계를 표시하지 않습니다. 원본 시간대의 날짜별 기록만 확인하세요.</p>}
   <div style={{overflowX:"auto"}}><table><caption>날짜별 서버 확인 기록 · 부분 자료 포함</caption><thead><tr><th scope="col">기록 날짜</th><th scope="col">확정량</th><th scope="col">수집 상태</th><th scope="col">기록 시간대 · 조회 시각(UTC)</th></tr></thead><tbody>{visible.data.days.map(row=><tr key={row.date}><th scope="row">{row.date}</th><td>{duration(row.data&&["COMPLETE","PARTIAL"].includes(row.data.quality)?row.data.confirmed_ms:null)}</td><td>{row.data?{COMPLETE:"수집 완료",PARTIAL:"부분 자료",UNKNOWN:"미확인",NOT_COLLECTED:"미수집",NO_DATA:"자료 없음"}[row.data.quality]:row.unavailable==="UNCONFIRMED"?"조회 미확정":"검증된 자료 없음"}</td><td>{row.data?`${row.data.timezone} · ${row.data.as_of}`:"미확인"}</td></tr>)}</tbody></table></div>
   <p>서로 다른 시점의 일일 조회이며 원자 기간 Snapshot이 아닙니다. 승계 차감·미확인 구간은 합산하지 않으며 최신 한도·실제 차단·해제 성공을 뜻하지 않습니다.</p>
  </div>}
 </fieldset>;
}
