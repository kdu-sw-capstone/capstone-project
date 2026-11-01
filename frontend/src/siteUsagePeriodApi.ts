import {ApiError,UiError} from "./api";
import {dailyUsage,type DailyUsage} from "./dailyUsageApi";

// Bound the existing per-day reads; this is not a new Server/API range contract.
export const maxPeriodDays=31;
const dayMs=86400000;
function dateNumber(date:string){
 const n=Date.parse(date+"T00:00:00.000Z");
 if(!/^\d{4}-\d\d-\d\d$/.test(date)||!Number.isFinite(n)||new Date(n).toISOString().slice(0,10)!==date)throw new UiError("조회 기간의 날짜를 확인하세요.");
 return n;
}
export function kstToday(now=new Date()){
 return new Date(now.getTime()+9*3600000).toISOString().slice(0,10);
}
export function periodEnding(to:string,days:number){
 if(!Number.isInteger(days)||days<1||days>maxPeriodDays)throw new UiError("조회 기간은 최대 31일입니다.");
 return {from:new Date(dateNumber(to)-(days-1)*dayMs).toISOString().slice(0,10),to};
}
export function periodDates(from:string,to:string){
 const first=dateNumber(from),last=dateNumber(to),count=(last-first)/dayMs+1;
 if(count<1||count>maxPeriodDays)throw new UiError("시작일·종료일을 확인하세요. 한 번에 최대 31일을 조회합니다.");
 return Array.from({length:count},(_,i)=>new Date(first+i*dayMs).toISOString().slice(0,10));
}
export type PeriodDay={date:string;data:DailyUsage|null;unavailable:"NOT_VERIFIED"|"UNCONFIRMED"|null};
export type UsagePeriod={days:PeriodDay[];confirmedMs:number|null;confirmedDays:number;calendarCompatible:boolean};
/** Sum only proven prefixes in disjoint KST natural days. Carry is never measured time. */
export function summarizePeriod(days:PeriodDay[]):UsagePeriod{
 let sum=0,count=0,end="",compatible=true;
 for(const row of days){
  const d=row.data;if(!d)continue;
  const start=new Date(dateNumber(row.date)-9*3600000).toISOString(),next=new Date(dateNumber(row.date)+15*3600000).toISOString();
  if(d.timezone!=="Asia/Seoul"||d.day_kind!=="NORMAL"||d.day_start_at!==start||d.day_end_at!==next||(end&&d.day_start_at<end)){compatible=false;continue;}
  end=d.day_end_at;
  if(d.confirmed_ms===null||!["COMPLETE","PARTIAL"].includes(d.quality))continue;
  if(!Number.isSafeInteger(d.confirmed_ms)||d.confirmed_ms<0||sum>Number.MAX_SAFE_INTEGER-d.confirmed_ms)throw new UiError("기간 합계의 측정 근거를 확인하지 못했습니다.");
  sum+=d.confirmed_ms;count++;
 }
 return {days,confirmedMs:compatible&&count>0?sum:null,confirmedDays:count,calendarCompatible:compatible};
}
export async function siteUsagePeriod(executor:string,policy:string,from:string,to:string,signal:AbortSignal):Promise<UsagePeriod>{
 const dates=periodDates(from,to),rows:PeriodDay[]=[];
 for(const date of dates){
  signal.throwIfAborted();
  try{const data=await dailyUsage(executor,policy,date,signal);signal.throwIfAborted();rows.push({date,data,unavailable:null});}
  catch(error){
   signal.throwIfAborted();
   if(error instanceof ApiError&&error.status===404)rows.push({date,data:null,unavailable:"NOT_VERIFIED"});
   else if(error instanceof ApiError&&error.status===503&&["STORE_UNCONFIRMED","TEMPORARILY_UNAVAILABLE"].includes(error.code))rows.push({date,data:null,unavailable:"UNCONFIRMED"});
   else throw error;
  }
 }
 return summarizePeriod(rows);
}
