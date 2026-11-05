import {useEffect,useRef,useState} from "react";
import {ApiError,request} from "./api";
import "./daily-focus-goal.css";

export type Goal={goal_minutes:number|null;timezone:string|null;version:number;goal_effective_date:string|null;updated_at:string|null;confirmed_ms:number|null;last_confirmed_at:string|null;date:string|null;time_status:string;partial_day?:boolean;has_unconfirmed_session?:boolean};
type Write={body:{goal_minutes:number|null;timezone:string|null};version:number;key:string};
export function goalMinutes(hours:string,minutes:string){
 if(!/^\d{1,2}$/.test(hours)||!/^\d{1,2}$/.test(minutes))throw Error("목표는 시간·분으로 입력해 주세요.");
 const h=Number(hours),m=Number(minutes),n=h*60+m;
 if(m>59||n<1||n>1440)throw Error("목표는 1~1,440분으로 입력해 주세요.");return n;
}
export function focusTime(ms:number){const minutes=Math.floor(ms/60000);return `${Math.floor(minutes/60)}시간 ${minutes%60}분`;}
function valid(value:Goal){
 if(!value||!Number.isSafeInteger(value.version)||value.version<0||!(value.goal_minutes===null||Number.isInteger(value.goal_minutes)&&value.goal_minutes>=1&&value.goal_minutes<=1440)||!(value.timezone===null||typeof value.timezone==="string")||!(value.confirmed_ms===null||Number.isSafeInteger(value.confirmed_ms)&&value.confirmed_ms>=0))throw Error("목표 조회 결과를 확인하지 못했습니다.");
 return value;
}
export default function DailyFocusGoal({owner,editor=false}:{owner:string;editor?:boolean}){
 return <GoalView key={owner} editor={editor}/>;
}
function GoalView({editor}:{editor:boolean}){
 const [value,setValue]=useState<Goal|null>(null),[error,setError]=useState(""),[writeError,setWriteError]=useState(""),[busy,setBusy]=useState(false),[editing,setEditing]=useState(false);
 const [hours,setHours]=useState("0"),[minutes,setMinutes]=useState("0"),[timezone,setTimezone]=useState(""),[pending,setPending]=useState<Write|null>(null);
 const scope=useRef({current:false}),reading=useRef(false),writing=useRef(false),readEpoch=useRef(0),editRevision=useRef<number|null>(null),loadRef=useRef<()=>Promise<Goal|undefined>>(async()=>undefined);
 const readAbort=useRef<AbortController|null>(null);
 const confirmedVersion=useRef(0);
 // A retired GET must neither block a post-save read nor unlock its successor.
 function retireRead(){readEpoch.current++;readAbort.current?.abort();readAbort.current=null;reading.current=false;}
 useEffect(()=>{
  const life={current:true};scope.current=life;
  const fail=(e:unknown)=>{if(!life.current)return;setError(e instanceof Error?e.message:"결과를 확인하지 못했습니다.");if(e instanceof ApiError&&e.status===401)window.dispatchEvent(new Event("focurve:authentication-expired"));};
  const load=async()=>{if(!life.current||reading.current||writing.current)return;reading.current=true;const epoch=readEpoch.current,abort=new AbortController();readAbort.current=abort;try{
   const row=valid(await request<Goal>("/daily-focus-goal/today","GET",undefined,{signal:abort.signal}));if(!life.current||epoch!==readEpoch.current)return;
   if(row.version<confirmedVersion.current)throw Error("저장된 목표보다 이전 버전의 조회입니다. 목표 상태를 다시 확인해 주세요.");
   confirmedVersion.current=row.version;setValue(row);setError("");return row;
  }catch(e){if(epoch===readEpoch.current)fail(e);}finally{if(life.current&&epoch===readEpoch.current){reading.current=false;readAbort.current=null;}}};
  loadRef.current=load;void load();const timer=setInterval(()=>void load(),5000);
  const changed=()=>{retireRead();void load();};window.addEventListener("focurve:goal-changed",changed);
  return()=>{life.current=false;retireRead();clearInterval(timer);window.removeEventListener("focurve:goal-changed",changed);};
 },[]);
 function edit(){if(!value)return;editRevision.current=value.version;const n=value.goal_minutes??0;setHours(String(Math.floor(n/60)));setMinutes(String(n%60));setTimezone(value.timezone??"");setEditing(true);}
 async function refresh(){const life=scope.current;const row=await loadRef.current();if(life.current&&row&&editing&&!pending)editRevision.current=row.version;}
 async function save(unset=false){
  if(!value||writing.current)return;const life=scope.current;let intent=pending;
  try{if(!intent)intent={body:{goal_minutes:unset?null:goalMinutes(hours,minutes),timezone:timezone||null},version:editRevision.current??value.version,key:crypto.randomUUID()};}
  catch(e){setWriteError((e as Error).message);return;}
  setPending(intent);retireRead();writing.current=true;setBusy(true);setWriteError("");
  try{const ack=await request<Goal>("/daily-focus-goal","PUT",intent.body,{version:intent.version,key:intent.key});if(!life.current)return;
   if(ack?.goal_minutes!==intent.body.goal_minutes||ack?.timezone!==intent.body.timezone||ack?.version!==intent.version+1)throw Error("목표 저장 응답 불일치");
   confirmedVersion.current=Math.max(confirmedVersion.current,ack.version);
   setPending(null);setEditing(false);window.dispatchEvent(new Event("focurve:goal-changed"));
  }catch(e){if(!life.current)return;
   if(e instanceof ApiError&&[400,403,412,422,428].includes(e.status))setPending(null);
   setWriteError(e instanceof ApiError&&e.status===412?"다른 화면에서 목표를 변경했습니다. 재조회 후 입력을 확인하고 저장해 주세요.":"저장 결과를 확인하지 못했습니다. 입력을 유지합니다. 미확정 요청은 같은 요청으로 재확인하세요.");
   if(e instanceof ApiError&&e.status===401)window.dispatchEvent(new Event("focurve:authentication-expired"));
  }finally{if(life.current){writing.current=false;setBusy(false);void loadRef.current();}}
 }
 const zones=[...new Set(["UTC",...(Intl.supportedValuesOf?.("timeZone")??["Asia/Seoul"]),...(timezone?[timezone]:[])])];
 return <section className={editor?"settings-card daily-goal":"card daily-goal daily-goal-progress"} aria-label={editor?"하루 집중 목표 설정":"오늘의 집중 목표"}>
  <div className="daily-goal-heading"><h4>{editor?"하루 집중 목표":"오늘의 집중"}</h4>{editor&&<button disabled={!value||busy||!!pending} onClick={edit}>목표 수정</button>}</div>
  {!value&&<p role="status">목표와 확인 집중량을 조회하고 있습니다.</p>}
  {value&&<>
   {editor?<p>{value.goal_minutes===null?"목표 미설정":`현재 목표 ${focusTime(value.goal_minutes*60000)}`} · 회원 계정 공통</p>:<>
    <strong className="daily-goal-total">{value.confirmed_ms===null?"집중량 확인 필요":focusTime(value.confirmed_ms)}</strong>
    {value.goal_minutes!==null&&value.confirmed_ms!==null?<><progress aria-label="하루 목표 진행률" max={value.goal_minutes*60000} value={Math.min(value.confirmed_ms,value.goal_minutes*60000)}/><div className="daily-goal-totals"><span>목표 {focusTime(value.goal_minutes*60000)} · {Math.floor(value.confirmed_ms/(value.goal_minutes*60000)*100)}%</span><span>{focusTime(Math.max(0,value.goal_minutes*60000-value.confirmed_ms))} 남음</span></div></>:<p>목표 또는 시간대를 설정하면 진행률을 표시합니다.</p>}
   </>}
   <p className="muted">{value.timezone?`${value.date??"오늘"} · ${value.timezone}`:"계정 시간대를 먼저 선택해 주세요. 자동으로 KST를 적용하지 않습니다."}</p>
   {!editor&&<p className="muted">{value.last_confirmed_at?`마지막 확인 ${new Date(value.last_confirmed_at).toLocaleString("ko-KR",{timeZone:value.timezone??"UTC"})}`:"수신된 확인 집중 구간이 없습니다."} · 새 확인 결과를 조회해 갱신합니다.</p>}
   {value.partial_day&&<p>시간대 변경 이후의 오늘 확인량입니다. 이전 시간대 기록은 보존됩니다.</p>}
   {value.has_unconfirmed_session&&<p>미확인 세션 구간은 합계에서 제외했습니다. 이전 확인 구간은 유지합니다.</p>}
  </>}
  {editing&&<form onSubmit={e=>{e.preventDefault();void save();}}>
   <fieldset disabled={busy||!!pending} className="daily-goal-inputs"><label><input aria-label="목표 시간" type="number" min="0" max="24" step="1" value={hours} onChange={e=>setHours(e.target.value)}/>시간</label><label><input aria-label="목표 분" type="number" min="0" max="59" step="1" value={minutes} onChange={e=>setMinutes(e.target.value)}/>분</label>
    <label>계정 시간대<select aria-label="계정 시간대" value={timezone} onChange={e=>setTimezone(e.target.value)}><option value="" disabled={!!value?.timezone}>미설정</option>{zones.map(zone=><option key={zone}>{zone}</option>)}</select></label>
   </fieldset><p>목표 변경은 오늘부터 적용합니다. 시간대 변경은 변경 이후에만 적용하며 과거 목표 없는 날의 달성률은 추정하지 않습니다.</p>
   <div className="settings-actions"><button type="submit" disabled={busy}>{pending?"같은 저장 요청 재확인":"목표 저장"}</button><button type="button" disabled={busy||!!pending} onClick={()=>setEditing(false)}>취소</button><button type="button" disabled={busy||!!pending} onClick={()=>void save(true)}>목표 미설정으로 변경</button></div>
  </form>}
  {(error||writeError)&&<p role="alert">{writeError||error}</p>}
  <button disabled={busy} onClick={()=>void refresh()}>목표 상태 재조회</button>
 </section>;
}
