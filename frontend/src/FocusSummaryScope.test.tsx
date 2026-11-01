import {StrictMode} from "react";
import {render,screen,fireEvent,cleanup,waitFor,within,act} from "@testing-library/react";
import {afterEach,it,expect,vi} from "vitest";
import Sessions from "./FocusSessions";
import {clearCsrf} from "./api";
const a="11111111-1111-4111-8111-111111111111",b="22222222-2222-4222-8222-222222222222";
const json=(v:unknown,status=200)=>new Response(JSON.stringify(v),{status,headers:{"Content-Type":"application/json"}});
function deferred(){let resolve!:(v:Response)=>void;const promise=new Promise<Response>(r=>{resolve=r;});return {promise,resolve};}
const sessions=[a,b].map((session_id,i)=>({session_id,execution_status:"ENDED",record_status:"PARTIAL",duration_minutes:10,active_duration_ms:1000,started_at:`2026-11-01T0${i+1}:00:00Z`,ended_at:`2026-11-01T0${i+1}:10:00Z`}));
const event={event_id:"event-a",session_id:a,event_type:"RECORDED_ACCESS",is_repeat:true};
afterEach(()=>{cleanup();clearCsrf();vi.unstubAllGlobals();});
function fixture(first:Promise<Response>,second:Promise<Response>|(()=>Promise<Response>)){
 let selected="";const requests:{sessionId:string;signal?:AbortSignal|null}[]=[];
 vi.stubGlobal("scrollTo",vi.fn());
 vi.stubGlobal("fetch",vi.fn(async(url:string,init?:RequestInit)=>{
  if(url.endsWith("/sessions/current"))return json(null);
  if(url.endsWith("/extension-installations"))return json([{executor_id:a}]);
  if(url.includes("/amvp/configs?"))return json({items:[],next_cursor:null,has_more:false});
  if(url.endsWith("/policy"))return json({sites:[]});
  if(url.endsWith("/note"))return json({text:"",version:0});
  if(url.includes("/sessions?"))return json({items:sessions,next_cursor:null});
  for(const session of sessions)if(url.endsWith("/sessions/"+session.session_id)){selected=session.session_id;return json(session);}
  if(url.includes("/access-events?")){
   const id=new URL(url,"http://localhost").searchParams.get("session_id");
   // History row counts already loaded before selection; only defer selected detail reads.
   if(id===selected){requests.push({sessionId:id,signal:init?.signal});return (id===a?first:typeof second==="function"?second():second).then(r=>r.clone());}
   return json({items:[],next_cursor:null});
  }
  if(url.includes("/sites"))return json({items:[],next_cursor:null});
  throw new Error(url);
 }));return requests;
}
async function select(index:number){const rows=within(screen.getByRole("table",{name:"집중 세션 기록"})).getAllByRole("row");await act(async()=>{fireEvent.click(within(rows[index+1]).getAllByRole("button")[0]);});await screen.findByRole("button",{name:"다음 집중 준비"});}
async function ready(strict=false){const view=<Sessions settings={()=>{}} records={()=>{}}/>;render(strict?<StrictMode>{view}</StrictMode>:view);await waitFor(()=>expect(within(screen.getByRole("table",{name:"집중 세션 기록"})).getAllByText("0회")).toHaveLength(4));await screen.findByText("저장된 반복 설정이 없습니다.");}
it.each([200,401])("old session's delayed %i summary cannot block or overwrite the newly selected session",async(status)=>{
 const old=deferred(),next=deferred(),expired=vi.fn();window.addEventListener("focurve:authentication-expired",expired);
 try{
  const reads=fixture(old.promise,next.promise);await ready();await select(0);
  await waitFor(()=>expect(reads.some(r=>r.sessionId===a&&r.signal)).toBe(true));await select(1);
  expect(reads.find(r=>r.sessionId===a&&r.signal)?.signal?.aborted).toBe(true);
  await act(async()=>next.resolve(json({items:[],next_cursor:null})));
  await screen.findByText(/전체 접근 0회 · 사이트 차단 0회/);
  await act(async()=>old.resolve(status===200?json({items:[event],next_cursor:null}):json({error:{code:"UNAUTHENTICATED"}},401)));
  expect(screen.getByText(/전체 접근 0회 · 사이트 차단 0회/)).toBeInTheDocument();
  expect(screen.queryByText(/전체 접근 1회/)).not.toBeInTheDocument();expect(expired).not.toHaveBeenCalled();
 }finally{window.removeEventListener("focurve:authentication-expired",expired);}
});
it("changing sessions clears the former summary; failed current reads remain unknown and can be retried",async()=>{
 const next=deferred();let recovered=false;const reads=fixture(Promise.resolve(json({items:[event],next_cursor:null})),()=>recovered?Promise.resolve(json({items:[],next_cursor:null})):next.promise);await ready();await select(0);
 await screen.findByText(/전체 접근 1회/);await select(1);
 expect(screen.queryByText(/전체 접근 1회/)).not.toBeInTheDocument();
 expect(screen.queryByText(/전체 접근 0회/)).not.toBeInTheDocument();
 await act(async()=>next.resolve(json({error:{code:"VALIDATION_FAILED"}},422)));
 await screen.findByText("세션의 접근 요약을 불러오지 못했습니다.");
 expect(screen.queryByText(/전체 접근 0회/)).not.toBeInTheDocument();
 // A fresh successful current-session response is required before showing zero.
 const beforeRetry=reads.filter(r=>r.sessionId===b).length;recovered=true;
 fireEvent.click(screen.getByRole("button",{name:"접근 요약 다시 확인"}));
 await screen.findByText(/전체 접근 0회 · 사이트 차단 0회/);
 expect(reads.filter(r=>r.sessionId===b)).toHaveLength(beforeRetry+1);
});

it("a live summary 401 still expires authentication and never becomes a successful zero",async()=>{
 const expired=vi.fn();window.addEventListener("focurve:authentication-expired",expired);
 try{fixture(Promise.resolve(json({items:[],next_cursor:null})),Promise.resolve(json({error:{code:"UNAUTHENTICATED"}},401)));await ready();await select(1);
  await screen.findByText("세션의 접근 요약을 불러오지 못했습니다.");expect(expired).toHaveBeenCalledOnce();expect(screen.queryByText(/전체 접근 0회/)).not.toBeInTheDocument();
 }finally{window.removeEventListener("focurve:authentication-expired",expired);}
});
it("StrictMode effect recreation still loads the current summary",async()=>{
 fixture(Promise.resolve(json({items:[event],next_cursor:null})),Promise.resolve(json({items:[],next_cursor:null})));await ready(true);await select(0);
 await screen.findByText(/전체 접근 1회 · 사이트 차단 0회 · 기록 1회 · Shorts 0회/);expect(screen.getByText(/그중 반복 접근 1회/)).toBeInTheDocument();
});
