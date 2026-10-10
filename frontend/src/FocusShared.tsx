import { useRef, useState } from "react";
import { ApiError, message, request } from "./api";

export type Page<T> = { items: T[]; next_cursor: string | null };
export type Session = { executor_id?:string; version?:number|string; version_increment_blocked?:boolean; session_id: string; execution_status: string; record_status: string; duration_minutes: number; active_duration_ms: number; started_at?: string; planned_end_at?: string; ended_at?: string; end_reason?: string; overrun_ms?: number; automatic_recovery_supported?: boolean; time_accounting_mode?: string };
export type PolicySite = { site_id: string; canonical_host: string; display_name?: string; purpose?: string; include_subdomains?: boolean; access_policy: string; feature_policies?: {feature_code:string;enabled:boolean}[] };
export type Policy = { sites?: PolicySite[] };
export type Access = { event_id:string; session_id:string; occurred_at:string; target_host:string; target_key:string; feature_code?:string; event_type:string; is_repeat:boolean; target_access_index:number; quality:string; reason?:string|null; blocked_reasons?:string[]|null; matched_policy_host?:string|null; repeat_count?:number; policy?:Policy };
export const seoulDay = (date = new Date()) => new Intl.DateTimeFormat("en-CA", {timeZone:"Asia/Seoul",year:"numeric",month:"2-digit",day:"2-digit"}).format(date);
export const dateTime = (value?:string) => value ? new Date(value).toLocaleString("ko-KR",{timeZone:"Asia/Seoul",hour12:false}) : "시작 미확인";
export const clockTime = (value?:string) => value ? new Date(value).toLocaleTimeString("en-GB",{timeZone:"Asia/Seoul",hour12:false}) : "—";
export function label(value?:string) { return ({STARTING:"시작 확인 중",RUNNING:"집중 진행 중",ENDING:"해제 확인 중",ENDED:"종료 완료",START_FAILED:"시작 실패",UNKNOWN:"결과 확인 필요",PENDING:"반영 대기",PARTIAL:"일부 수집",COMPLETE:"수집 완료",NO_DATA:"자료 없음",CONFIRMED:"확인됨",UNCONFIRMED:"미확인",REVIEW_REQUIRED:"추가 확인 필요",BLOCK:"전체 차단",RECORD:"허용하고 기록",ALLOW:"허용",FOCUS:"집중",DISTRACTION:"방해",GENERAL:"일반"} as Record<string,string>)[value??""] ?? value ?? "미확인"; }
const reasonNames:Record<string,string> = {USER_SITE:"사이트 정책 차단",ADULT_DOMAIN:"성인 사이트 제한",KEYWORD:"키워드 제한",FEATURE:"내부 기능 제한"};
export function blockingReasonLabel(item:Access) {
  if (item.event_type==="RECORDED_ACCESS") return "";
  const reasons=item.blocked_reasons ?? (item.reason && item.reason!=="RECORD" ? [item.reason] : []);
  return [...new Set(reasons)].map(reason=>reasonNames[reason] ?? "알 수 없는 차단 사유").join(" · ");
}
export const resultLabel = (item:Access) => blockingReasonLabel(item) || (item.event_type==="BLOCKED_SITE_ACCESS" ? "전체 차단" : item.event_type==="BLOCKED_FEATURE_ACCESS" ? "내부 기능 제한" : item.event_type==="RECORDED_ACCESS" ? "허용하고 기록" : "처리 결과 미확인");
export const resultClass = (item:Access) => item.event_type==="BLOCKED_SITE_ACCESS" ? "blocked" : item.event_type==="BLOCKED_FEATURE_ACCESS" ? "feature" : "recorded";
export const targetName = (item:Access) => item.feature_code==="YOUTUBE_SHORTS" ? "YouTube Shorts" : item.target_host;
export function useWork() {
  const [busy,setBusy]=useState(false),[error,setError]=useState("");
  const lock=useRef(false);
  async function run(fn:()=>Promise<void>) { if(lock.current)return; lock.current=true;setBusy(true);setError("");try{await fn();}catch(e){setError(message(e));if(e instanceof ApiError&&e.status===401)window.dispatchEvent(new Event("focurve:authentication-expired"));}finally{lock.current=false;setBusy(false);} }
  return {busy,error,run,setError};
}
export async function allPages<T>(path:string, signal?:AbortSignal):Promise<T[]> {
  const items:T[]=[]; let cursor:string|null=null; const seen=new Set<string>();
  do { const p:Page<T>=await request(path+(cursor?(path.includes("?")?"&":"?")+"cursor="+encodeURIComponent(cursor):""),"GET",undefined,{signal}); items.push(...(p.items??[]));cursor=p.next_cursor;if(cursor){if(seen.has(cursor))throw new Error("Repeated cursor");seen.add(cursor);} } while(cursor);
  return items;
}
export function Kpi({title,value,hint}:{title:string;value:string;hint:string}) {return <div className="focus-kpi"><h4>{title}</h4><strong>{value}</strong><small>{hint}</small></div>;}
export function SiteMark({host}:{host:string}) {return <span className="site-mark" aria-hidden="true">{host==="youtube.com"?<img src="/assets/figma/session-youtube.png" alt=""/>:<img src="/assets/figma/light-imgDashIconGlobe.svg" alt=""/>}</span>;}
export function DateFields({from,to,onFrom,onTo}:{from:string;to:string;onFrom:(s:string)=>void;onTo:(s:string)=>void}) {return <><label>시작 날짜<input type="date" value={from} onChange={e=>onFrom(e.currentTarget.value)} onInput={e=>onFrom(e.currentTarget.value)}/></label><label>종료 날짜<input type="date" value={to} onChange={e=>onTo(e.currentTarget.value)} onInput={e=>onTo(e.currentTarget.value)}/></label></>;}
