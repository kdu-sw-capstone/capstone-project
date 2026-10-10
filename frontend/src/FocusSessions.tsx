import { useEffect, useRef, useState } from "react";
import { request, UiError } from "./api";
import { connectExecution, executionBridgeConfigured, wakeExecution } from "./executionWake";
import SessionNote from "./SessionNote";
import { allPages, clockTime, dateTime, DateFields, Kpi, label, seoulDay, SiteMark, useWork, type Access, type Page, type Policy, type PolicySite, type Session } from "./FocusShared";

export default function FocusSessions({settings,records}:{settings:()=>void;records:(id:string,from:string,to:string)=>void}) {
  const work=useWork(); const [minutes,setMinutes]=useState("30"),[executor,setExecutor]=useState("");
  const [current,setCurrent]=useState<Session|null>(null),[selected,setSelected]=useState<Session|null>(null),[policy,setPolicy]=useState<Policy|null>(null),[selectedPolicy,setSelectedPolicy]=useState<Policy|null>(null),[sites,setSites]=useState<PolicySite[]>([]);
  const [installations,setInstallations]=useState<{executor_id:string}[]>([]),[loaded,setLoaded]=useState(false),[fresh,setFresh]=useState(false),[now,setNow]=useState(Date.now());
  const [today,setToday]=useState<Session[]>([]),[action,setAction]=useState(""),[draft,setDraft]=useState("");
  const key=useRef(crypto.randomUUID()),previous=useRef<string|null>(null),local=useRef<string|null>(null),checked=useRef(false);
  const [localExecutor,setLocalExecutor]=useState<string|null>(null);
  async function load(){
    setFresh(false);
    const s=await request<Session|null>("/sessions/current");
    setCurrent(s);
    const p=s?await request<Policy>(`/sessions/${s.session_id}/policy`):null;
    if (!checked.current) { checked.current=true;local.current=await connectExecution(); }
    const links=await request<{executor_id:string}[]>("/extension-installations");
    const detected=links.some(i=>i.executor_id===local.current)?local.current:null;
    setLocalExecutor(detected);
    const saved=await allPages<PolicySite>("/sites");
    const day=seoulDay();const ended=await allPages<Session>(`/sessions?from_date=${day}&to_date=${day}&status=ENDED`);
    if(!s&&previous.current){const last=await request<Session>(`/sessions/${previous.current}`);setSelectedPolicy(await request<Policy>(`/sessions/${last.session_id}/policy`));setSelected(last);}
    previous.current=s?.session_id??null;
    setCurrent(s);setPolicy(p);setInstallations(links);setSites(saved);setToday(ended);setLoaded(true);setFresh(true);
    setExecutor(old=>detected??(links.some(i=>i.executor_id===old)?old:links[0]?.executor_id??""));
  }
  useEffect(()=>{void work.run(load);const id=setInterval(()=>{void work.run(load);},5000);const tick=setInterval(()=>setNow(Date.now()),1000);return()=>{clearInterval(id);clearInterval(tick);};},[]);
  async function start() {
    setAction("현재 브라우저 연결 확인 중…");
    try {
      const detected=await connectExecution();
      if (executionBridgeConfigured() && !detected) throw new UiError("현재 브라우저의 확장 연결을 확인하지 못했습니다. 확장 버전과 회원 연결 상태를 확인하고 다시 시도하세요.");
      const target=detected??executor;
      if (detected) {
        const links=await request<{executor_id:string}[]>("/extension-installations");
        if (!links.some(i=>i.executor_id===detected)) throw new UiError("현재 브라우저의 확장이 이 Web 계정에 연결되어 있지 않습니다. 같은 계정으로 연결해 주세요.");
        local.current=detected;setLocalExecutor(detected);setExecutor(detected);
      }
      setAction("집중 시작 요청 중…");
      const result=await request<Session>("/sessions","POST",{executor_id:target,duration_minutes:Number(minutes)},{key:key.current});
      void wakeExecution(target);setCurrent(result);previous.current=result.session_id;setSelected(null);key.current=crypto.randomUUID();
      await load();
    } finally { setAction(""); }
  }
  async function end() {
    if (!current) return;
    setAction("집중 종료 요청 중…");
    try {
      const result=await request<Session>(`/sessions/${current.session_id}/end`,"POST",{},{key:key.current});
      setCurrent(result);void wakeExecution(result.executor_id??current.executor_id??executor);key.current=crypto.randomUUID();
    } finally { setAction(""); }
  }
  // Only transition states poll rapidly; stable sessions retain the five-second backup.
  useEffect(()=>{
    if (!current || !["STARTING","ENDING"].includes(current.execution_status)) return;
    const id=setInterval(()=>{void work.run(load);},1000);
    return ()=>clearInterval(id);
  },[current?.execution_status]);
  const session=current??selected, status=session?.execution_status??"READY", ended=status==="ENDED", failed=status==="START_FAILED", ready=!session;
  const endLabel=session?.end_reason==="TIME_EXPIRED"?"목표 완료":session?.end_reason==="MANUAL"?"직접 종료":"종료 완료";
  const title=failed?"집중을 시작하지 못했어요":ready?"집중 세션 준비":ended?(session?.end_reason==="TIME_EXPIRED"?"목표 시간을 채웠어요":session?.end_reason==="MANUAL"?"이번 집중을 직접 종료했어요":"이번 집중을 마쳤어요"):status==="RUNNING"?"집중 세션 진행":"집중 세션 확인";
  // A countdown is a display estimate, never evidence of application or release.
  const remaining=(status==="RUNNING"||status==="ENDING")&&session?.planned_end_at?Math.max(0,new Date(session.planned_end_at).getTime()-now):Math.max(0,(session?.duration_minutes??(Number(minutes)||0))*60000-(session?.active_duration_ms??0));
  const shown=ended?(session?.active_duration_ms??0):remaining;
  const timer=`${String(Math.floor(shown/60000)).padStart(2,"0")}:${String(Math.floor(shown/1000)%60).padStart(2,"0")}`;
  const recordLink=(s:Session)=>records(s.session_id,s.started_at?seoulDay(new Date(s.started_at)):seoulDay(),s.ended_at?seoulDay(new Date(s.ended_at)):seoulDay());
  return <section className="page focus-session" aria-busy={!loaded}>
    <header className="focus-heading"><h3>{title}</h3><p>{ready?"집중 시간과 저장된 정책을 확인한 뒤 시작하세요.":ended?"이번 집중의 결과를 살펴보고 다음 세션을 준비하세요.":"남은 시간과 이번 세션의 정책을 확인하세요."}</p></header>
    <p className="notice" role="note">현재 버전은 Chrome 재시작 후 집중 세션 자동 복구를 지원하지 않습니다. 진행 시간은 기존 종료 예정 시각 기준이며, 자동 복구·중단 중 남은 시간 보존은 후속 통합에서 제공됩니다.</p>
    <div className="focus-kpis three"><Kpi title={ended?"이번 세션 결과":"종료한 세션"} value={!loaded?"—":ended?endLabel:`${today.length}회`} hint={ended?"실제 정책 해제 확인":"오늘 · 진행 세션 제외"}/><Kpi title={ended?"이번 세션 집중 시간":"오늘 집중 시간"} value={!loaded?"—":`${Math.floor((ended?session!.active_duration_ms:today.reduce((n,s)=>n+s.active_duration_ms,0))/60000)}분`} hint="종료한 세션의 확인된 진행 시간"/><Kpi title="확장 프로그램" value={!loaded?"확인 중":installations.length?"회원 연결됨":"미연결"} hint={status==="RUNNING"?"이번 세션의 정책 적용 확인":status==="ENDING"?"정책 해제 결과 확인 중":"회원 연결과 실제 실행 확인은 별도"}/></div>
    <div className="focus-columns">
      <section className="focus-card timer-card" aria-label="집중 타이머">
        <h4>{failed?"시작 실패 · 정책 정리 완료":ready?"이번 집중을 준비하세요":ended?"이번 집중을 마쳤어요":status==="RUNNING"?"지금, 집중을 이어가고 있어요":"확장 프로그램의 결과를 확인하고 있어요"}</h4>
        <div className="focus-timer" data-execution-status={status}><TimerRing ratio={ready?1:shown/Math.max(1,(session?.duration_minutes??1)*60000)}/><span>{ready?"시작 준비":ended?endLabel:label(status)}</span><strong>{timer}</strong><small>{ready||ended?"한 번에 하나씩, 나의 속도로":`목표 시간 ${session?.duration_minutes??"—"}분`}</small></div>
        {ready?<form className="timer-controls" onSubmit={e=>{e.preventDefault();void work.run(start);}}>
          <div className="minute-presets">{[25,30,50].map(value=><button type="button" key={value} disabled={work.busy} aria-pressed={Number(minutes)===value} onClick={()=>{setMinutes(String(value));key.current=crypto.randomUUID();}}>{value}분</button>)}</div>
          <label>집중 시간 (분)<input name="minutes" disabled={work.busy} type="number" min="1" max="180" step="1" required value={minutes} onChange={e=>{setMinutes(e.target.value);key.current=crypto.randomUUID();}}/></label>
          {!localExecutor&&installations.length>1&&<label>실행 설치<select disabled={work.busy} aria-label="실행 설치" value={executor} onChange={e=>{setExecutor(e.target.value);key.current=crypto.randomUUID();}}>{installations.map(i=><option key={i.executor_id}>{i.executor_id}</option>)}</select></label>}
          {localExecutor&&<p role="status">현재 브라우저의 확장을 자동 선택했습니다.</p>}
          <button className="primary" disabled={!loaded||!fresh||work.busy||!executor}>{action||"▶ 집중 시작"}</button>
        </form>:<div className="timer-controls"><p>{clockTime(session?.started_at)} 시작 · {ended?`${clockTime(session?.ended_at)} 종료`:session?.planned_end_at?`${clockTime(session.planned_end_at)} 종료 예정`:"실제 시작 시각 확인 중"}</p>
          {ended&&<EndedAccess session={session!}/>}
          <div className="session-actions">{failed?<button className="primary" onClick={()=>{setSelected(null);setDraft("");}}>다시 집중 준비</button>:ended?<><button className="primary" onClick={()=>recordLink(session!)}>이 세션의 행동 기록</button><button onClick={()=>{setSelected(null);setDraft("");}}>다음 집중 준비</button></>:<><button disabled title="SESSION-05 추가 MVP 연동 전">일시정지 · 사용 불가</button><button className="danger" disabled={!current||!fresh||work.busy||status==="STARTING"||status==="ENDING"} onClick={()=>{void work.run(end);}}>{action||"세션 종료"}</button></>}</div>
          {status==="RUNNING"&&<small>예정 종료까지의 표시 시간입니다. 집중 시간은 확인된 실행 구간으로 집계합니다.</small>}
          {session&&<p className="muted">실행 상태: {label(status)} · 기록 상태: {label(session.record_status)}</p>}
        </div>}
        <div className="execution-message" role="status">{action? action:!loaded?"세션과 연결 상태를 확인하고 있습니다.":status==="STARTING"?"확장 프로그램의 실제 적용 결과를 기다리고 있습니다. Chrome과 확장 프로그램을 열어 주세요.":status==="ENDING"?"정책 해제 결과를 기다리고 있습니다. 타이머가 0이 되어도 해제 확인 전에는 종료 완료가 아닙니다.":failed?"시작에 실패했지만 남은 정책의 해제는 확인했습니다. 연결·설정을 확인한 뒤 다시 준비할 수 있습니다.":status==="UNKNOWN"?"실행 결과가 미확인입니다. 신규 시작은 잠겨 있습니다. 확장 프로그램에서 복구 상태를 확인하거나 세션 종료로 해제를 요청하세요.":ready&&!installations.length?"회원 연결된 Extension이 없습니다. 연결 후 집중을 시작할 수 있습니다.":ended?`정책 해제 완료 · 기록 ${label(session?.record_status)}`:"설정 변경은 다음 세션부터 적용됩니다."}</div>
        <button className="text-button" disabled={work.busy} onClick={()=>{checked.current=false;void work.run(load);}}>연결·실행 상태 다시 확인</button>
        {!fresh&&loaded&&<p role="status">최신 상태를 확인 중입니다. 마지막 확인 화면을 유지하며 실행 조작을 잠시 제한합니다.</p>}{work.error&&<p role="alert">{work.error}</p>}
      </section>
      <section className="focus-card policy-card"><h4>{current?"이번 세션에 고정된 정책":"다음 집중에 적용할 설정"}</h4><p className="muted">{current?"시작할 때 확정된 설정입니다. 현재 설정과 다를 수 있습니다.":"집중 시작 시 아래 저장된 설정이 적용됩니다."}</p><PolicyGroups sites={current?(policy?.sites??[]):sites}/><div className="session-actions"><button onClick={settings}>사이트 설정 확인</button><button className="primary" onClick={settings}>Shorts 제한 설정</button></div>{selectedPolicy&&selected&&!current&&<details className="historical-policy"><summary>선택한 세션의 당시 정책 보기</summary><PolicyGroups sites={selectedPolicy.sites??[]}/></details>}<SessionNote key={session?.session_id??"draft"} sessionId={session?.session_id} draft={draft} onDraft={setDraft}/><small>현재 정책은 시작할 때의 설정을 유지해요. 변경 사항은 다음 세션에 적용됩니다.</small></section>
    </div>
    <SessionHistory refreshKey={`${current?.session_id}:${status}`} open={async(s)=>{if(current){recordLink(s);return;}const detail=await request<Session>(`/sessions/${s.session_id}`);setSelectedPolicy(await request<Policy>(`/sessions/${s.session_id}/policy`));setSelected(detail);setDraft("");window.scrollTo(0,0);}} records={recordLink}/>
    {!installations.length&&loaded&&<details className="extension-guidance"><summary>확장 프로그램 연결 방법</summary><p>Chrome에 FOCURVE 확장 프로그램을 설치 → 확장 프로그램에서 회원 연결 요청 → 이 계정으로 승인 → 연결 상태 다시 확인.</p><p>현재 스냅샷에는 실행 패키지가 없습니다. Extension 담당자의 설치 패키지와 연결 승인 계약을 받아야 실제 차단·수집을 검증할 수 있습니다. 기존 기록과 사이트 설정은 웹에서 확인할 수 있습니다.</p></details>}
  </section>;
}
function PolicyGroups({sites}:{sites:PolicySite[]}) {
  const groups=[{name:"전체 차단",tone:"blocked",items:sites.filter(s=>s.access_policy==="BLOCK")},{name:"허용하고 기록",tone:"recorded",items:sites.filter(s=>s.access_policy==="RECORD")},{name:"내부 기능 제한",tone:"feature",items:sites.filter(s=>s.feature_policies?.some(f=>f.enabled))}];
  return <div className="policy-groups">{groups.map(g=><div className={`policy-group ${g.tone}`} key={g.name}><div className="policy-icons">{g.items.slice(0,2).map(s=><SiteMark key={s.site_id} host={s.canonical_host}/>)}</div><div><strong>{g.name} · {g.items.length}개</strong><small>{g.items.length?g.items.map(s=>g.tone==="feature"?s.canonical_host+" · YouTube Shorts":s.display_name||s.canonical_host).join(" · "):"설정된 대상 없음"}</small></div></div>)}</div>;
}
function SessionHistory({refreshKey,open,records}:{refreshKey:string;open:(s:Session)=>Promise<void>;records:(s:Session)=>void}) {
  const work=useWork();const [items,setItems]=useState<Session[]>([]),[cursor,setCursor]=useState<string|null>(null),[loaded,setLoaded]=useState(false);
  const [from,setFrom]=useState(""),[to,setTo]=useState(""),[filter,setFilter]=useState("ENDED"),[counts,setCounts]=useState<Record<string,{access:number;repeat:number}>>({});
  const [countErrors,setCountErrors]=useState<Record<string,boolean>>({});
  const [applied,setApplied]=useState("");const queryKey=JSON.stringify({from,to,filter});
  async function load(next:string|null=null){const p=await request<Page<Session>>("/sessions?"+new URLSearchParams({...(from?{from_date:from}:{}),...(to?{to_date:to}:{}),...(filter?{status:filter}:{}),...(next?{cursor:next}:{})}));setItems(old=>next?[...old,...p.items]:p.items);setCursor(p.next_cursor);setApplied(queryKey);setLoaded(true);}
  useEffect(()=>{void work.run(()=>load());},[refreshKey]);
  async function count(s:Session){const rows=await allPages<Access>("/access-events?"+new URLSearchParams({session_id:s.session_id,from_date:s.started_at?seoulDay(new Date(s.started_at)):seoulDay(),to_date:s.ended_at?seoulDay(new Date(s.ended_at)):seoulDay()}));setCounts(old=>({...old,[s.session_id]:{access:rows.length,repeat:rows.filter(x=>x.is_repeat).length}}));}
  useEffect(()=>{let disposed=false;async function read(){for(const s of items){if(disposed)return;try{await count(s);}catch{setCountErrors(old=>({...old,[s.session_id]:true}));}}}void read();return()=>{disposed=true;};},[items]);
  return <section className="focus-card session-history-new"><div className="history-heading"><div><h4>최근 종료 세션</h4><p className="muted">세션 결과와 해당 행동 기록을 확인하세요. 기본 조회는 최근 7일입니다.</p></div><details><summary>기간·상태 필터</summary><form onSubmit={e=>{e.preventDefault();void work.run(()=>load());}}><DateFields from={from} to={to} onFrom={setFrom} onTo={setTo}/><label>실행 상태<select value={filter} onChange={e=>setFilter(e.target.value)}><option value="">전체</option>{["ENDED","STARTING","RUNNING","ENDING","START_FAILED","UNKNOWN"].map(v=><option value={v} key={v}>{label(v)}</option>)}</select></label><button disabled={work.busy}>세션 기록 조회</button></form></details></div>
    {loaded&&queryKey!==applied&&<p role="status">필터가 변경되었습니다. 세션 기록 조회를 눌러 적용하세요.</p>}
    <div className="table-scroll"><table className="session-table"><caption className="sr-only">집중 세션 기록</caption><colgroup><col style={{width:"50%"}}/><col style={{width:"20%"}}/><col style={{width:"15%"}}/><col style={{width:"15%"}}/></colgroup><thead><tr><th>시작–종료</th><th>집중 시간</th><th>접근</th><th>반복</th></tr></thead><tbody>{items.map(s=><tr key={s.session_id}><td><button className="row-link" onClick={()=>{void work.run(()=>open(s));}}>{dateTime(s.started_at)} – {clockTime(s.ended_at)}<small>{label(s.execution_status)} · {label(s.record_status)} · 결과 보기</small></button></td><td>{Math.floor(s.active_duration_ms/60000)}분 {Math.floor(s.active_duration_ms/1000)%60}초</td><td><button className="row-link" onClick={()=>records(s)}>{counts[s.session_id]?`${counts[s.session_id].access}회`:countErrors[s.session_id]?"조회 실패 · 기록 확인":"조회 중"}</button></td><td>{counts[s.session_id]?`${counts[s.session_id].repeat}회`:"—"}</td></tr>)}</tbody></table></div>
    {loaded&&!items.length&&<p className="empty-state">해당 기간에 세션 기록이 없습니다.</p>}{cursor&&queryKey===applied&&<button disabled={work.busy} onClick={()=>{void work.run(()=>load(cursor));}}>이전 세션 더 보기</button>}{work.error&&<p role="alert">{work.error}</p>}<small>접근 횟수는 수신된 기록 기준이며 미수집·반영 대기는 0회와 구분해 확인하세요.</small>
  </section>;
}

// Figma's ring geometry: 280 viewBox, centre 140, radius 116, stroke 14.
// Only the arc varies with the displayed time; API execution status remains authoritative.
function TimerRing({ratio}:{ratio:number}) {
  const length=2*Math.PI*116, progress=Math.max(0,Math.min(1,ratio));
  return <svg className="timer-ring" viewBox="0 0 280 280" aria-hidden="true"><circle cx="140" cy="140" r="116" fill="none" stroke="var(--border)" strokeWidth="14"/>{progress>0&&<circle cx="140" cy="140" r="116" fill="none" stroke="var(--brand)" strokeWidth="14" strokeLinecap="round" strokeDasharray={length} strokeDashoffset={length*(1-progress)} transform="rotate(-90 140 140)"/>}</svg>;
}
function EndedAccess({session}:{session:Session}) {
  const work=useWork(),[rows,setRows]=useState<Access[]|null>(null);
  async function load(){setRows(await allPages<Access>("/access-events?"+new URLSearchParams({session_id:session.session_id,from_date:session.started_at?seoulDay(new Date(session.started_at)):seoulDay(),to_date:session.ended_at?seoulDay(new Date(session.ended_at)):seoulDay()})));}
  useEffect(()=>{void work.run(load);},[session.session_id]);
  return <div className="ended-access">{rows?<><p>전체 접근 {rows.length}회 · 사이트 차단 {rows.filter(x=>x.event_type==="BLOCKED_SITE_ACCESS").length}회 · 기록 {rows.filter(x=>x.event_type==="RECORDED_ACCESS").length}회 · Shorts {rows.filter(x=>x.event_type==="BLOCKED_FEATURE_ACCESS").length}회</p><p>그중 반복 접근 {rows.filter(x=>x.is_repeat).length}회 · {label(session.record_status)}</p></>:<p>{work.error?"세션의 접근 요약을 불러오지 못했습니다.":"세션의 접근 요약을 확인하고 있습니다."}</p>}{work.error&&<button onClick={()=>{void work.run(load);}}>접근 요약 다시 확인</button>}</div>;
}
