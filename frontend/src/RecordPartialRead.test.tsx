import {render,screen,fireEvent,cleanup,waitFor,act} from "@testing-library/react";
import {afterEach,it,expect,vi} from "vitest";
import Records from "./BehaviorRecords";
import {clearCsrf} from "./api";
const sid="10000000-0000-4000-8000-000000000001";
const json=(v:unknown,status=200)=>new Response(JSON.stringify(v),{status,headers:{"Content-Type":"application/json"}});
const item={event_id:"confirmed-event",session_id:sid,occurred_at:"2026-11-01T01:00:00.000Z",target_host:"confirmed.example",target_key:"SITE:confirmed.example",event_type:"RECORDED_ACCESS",target_access_index:1,is_repeat:false,quality:"PARTIAL"};
const session={session_id:sid,execution_status:"ENDED",record_status:"PARTIAL",active_duration_ms:1000,started_at:item.occurred_at,ended_at:item.occurred_at};
function deferred(){let resolve!:(r:Response)=>void;const promise=new Promise<Response>(r=>{resolve=r;});return {promise,resolve};}
afterEach(()=>{cleanup();clearCsrf();vi.unstubAllGlobals();});
function fixture(summary:()=>Promise<Response>,sessions:()=>Promise<Response>,access?:(url:string)=>Promise<Response>){
 const fetch=vi.fn(async(url:string,init?:RequestInit)=>{
  if(url.includes("/access-events?"))return access?access(url):json({items:[item],next_cursor:null});
  if(url.includes("/statistics/summary?"))return summary();
  if(url.includes("/sessions?"))return sessions();
  throw new Error(url);
 });vi.stubGlobal("fetch",fetch);render(<Records initialHost="" initialRange={{from:"",to:""}} settings={()=>{}}/>);return fetch;
}
it.each(["summary","sessions"])("keeps confirmed records when the auxiliary %s request fails",async(failed)=>{
 fixture(()=>Promise.resolve(failed==="summary"?json({error:{code:"TEMPORARILY_UNAVAILABLE"}},503):json({quality:"PARTIAL"})),()=>Promise.resolve(failed==="sessions"?json({error:{code:"TEMPORARILY_UNAVAILABLE"}},503):json({items:[session],next_cursor:null})));
 await screen.findByRole("button",{name:/confirmed.example.*상세/});
 expect(await screen.findByRole("alert")).toHaveTextContent(failed==="summary"?"수집 상태":"세션 필터");expect(screen.queryByText("조회된 접근 기록이 없습니다.")).not.toBeInTheDocument();
});
it("pending auxiliary reads do not hold the verified record list or the explicit retry lock",async()=>{
 const summary=deferred(),sessions=deferred();fixture(()=>summary.promise,()=>sessions.promise);
 await screen.findByRole("button",{name:/confirmed.example.*상세/});expect(screen.getByRole("button",{name:"조회"})).toBeEnabled();
 expect(screen.getByText(/전체 수집 상태.*확인 중/)).toBeInTheDocument();
 await act(async()=>{summary.resolve(json({quality:"PARTIAL"}));sessions.resolve(json({items:[],next_cursor:null}));});
});

it.each([200,401])("a fresh explicit read discards old auxiliary %i responses and keeps current filters and records",async(status)=>{
 const oldSummary=deferred(),oldSessions=deferred(),expired=vi.fn();let fresh=false;const other={...session,session_id:"20000000-0000-4000-8000-000000000002"};window.addEventListener("focurve:authentication-expired",expired);
 try{
  const fetch=fixture(()=>fresh?Promise.resolve(json({quality:"PARTIAL"})):oldSummary.promise,()=>fresh?Promise.resolve(json({items:[other],next_cursor:null})):oldSessions.promise);
  await screen.findByRole("button",{name:/confirmed.example.*상세/});await waitFor(()=>expect(fetch.mock.calls.filter(c=>c[0].includes("/statistics/summary?"))).toHaveLength(1));
  const signal=fetch.mock.calls.find(c=>c[0].includes("/statistics/summary?"))![1]!.signal!;fresh=true;
  fireEvent.change(screen.getByLabelText("대상 도메인"),{target:{value:"confirmed.example"}});fireEvent.click(screen.getByRole("button",{name:"조회"}));
  await waitFor(()=>expect([...screen.getByRole<HTMLSelectElement>("combobox",{name:"세션"}).options].some(o=>o.value===other.session_id)).toBe(true));expect(signal.aborted).toBe(true);
  await act(async()=>{oldSummary.resolve(status===200?json({quality:"COMPLETE"}):json({error:{code:"UNAUTHENTICATED"}},401));oldSessions.resolve(json({items:[session],next_cursor:null}));});
  expect(document.querySelector(".collection-status")).toHaveTextContent("일부 수집");expect(screen.getByLabelText("대상 도메인")).toHaveValue("confirmed.example");expect([...screen.getByRole<HTMLSelectElement>("combobox",{name:"세션"}).options].some(o=>o.value===sid)).toBe(false);expect(expired).not.toHaveBeenCalled();
 }finally{window.removeEventListener("focurve:authentication-expired",expired);}
});
it("explicit retry clears both auxiliary failures only after fresh successful responses",async()=>{
 let failed=true;const fetch=fixture(()=>Promise.resolve(failed?json({error:{code:"TEMPORARILY_UNAVAILABLE"}},503):json({quality:"PARTIAL"})),()=>Promise.resolve(failed?json({error:{code:"TEMPORARILY_UNAVAILABLE"}},503):json({items:[session],next_cursor:null})));
 await waitFor(()=>expect(screen.getAllByRole("alert")).toHaveLength(2));expect(screen.getByRole("button",{name:/confirmed.example.*상세/})).toBeEnabled();failed=false;fireEvent.click(screen.getByRole("button",{name:"조회"}));
 await waitFor(()=>expect(screen.queryAllByRole("alert")).toHaveLength(0));await waitFor(()=>expect([...screen.getByRole<HTMLSelectElement>("combobox",{name:"세션"}).options].some(o=>o.value===sid)).toBe(true));
 expect(document.querySelector(".collection-status")).toHaveTextContent("일부 수집");expect(fetch.mock.calls.every(c=>!c[1]?.method||c[1].method==="GET")).toBe(true);
});
it("a failed primary record request keeps the previous list and does not relabel it as an empty successful read",async()=>{
 let failed=false;const fetch=fixture(()=>Promise.resolve(json({quality:"PARTIAL"})),()=>Promise.resolve(json({items:[],next_cursor:null})),()=>Promise.resolve(failed?json({error:{code:"TEMPORARILY_UNAVAILABLE"}},503):json({items:[item],next_cursor:null})));
 await screen.findByRole("button",{name:/confirmed.example.*상세/});await waitFor(()=>expect(document.querySelector(".collection-status")).toHaveTextContent("일부 수집"));failed=true;fireEvent.click(screen.getByRole("button",{name:"조회"}));
 await screen.findByText("조회에 실패해 마지막 성공 결과를 유지합니다.");expect(screen.getByRole("button",{name:/confirmed.example.*상세/})).toBeInTheDocument();expect(screen.queryByText("조회된 접근 기록이 없습니다.")).not.toBeInTheDocument();expect(fetch.mock.calls.filter(c=>c[0].includes("/statistics/summary?"))).toHaveLength(1);
});
it("current auxiliary authentication failures still expire the member session once",async()=>{
 const expired=vi.fn();window.addEventListener("focurve:authentication-expired",expired);
 try{fixture(()=>Promise.resolve(json({error:{code:"UNAUTHENTICATED"}},401)),()=>Promise.resolve(json({error:{code:"UNAUTHENTICATED"}},401)));await waitFor(()=>expect(screen.getAllByRole("alert")).toHaveLength(2));expect(expired).toHaveBeenCalledOnce();}
 finally{window.removeEventListener("focurve:authentication-expired",expired);}
});
it("pagination keeps verified rows and UNKNOWN coverage without repeating failed auxiliary reads",async()=>{
 const fetch=fixture(()=>Promise.resolve(json({error:{code:"TEMPORARILY_UNAVAILABLE"}},503)),()=>Promise.resolve(json({items:[],next_cursor:null})),url=>Promise.resolve(json({items:[url.includes("cursor=")?{...item,event_id:"second",target_host:"second.example"}:item],next_cursor:url.includes("cursor=")?null:"page-two"})));
 await screen.findByRole("alert");fireEvent.click(screen.getByRole("button",{name:"이전 기록 더 보기"}));await screen.findByRole("button",{name:/second.example.*상세/});expect(screen.getByRole("button",{name:/confirmed.example.*상세/})).toBeInTheDocument();expect(document.querySelector(".collection-status")).toHaveTextContent("결과 확인 필요");expect(fetch.mock.calls.filter(c=>c[0].includes("/statistics/summary?"))).toHaveLength(1);expect(fetch.mock.calls.filter(c=>c[0].includes("/sessions?"))).toHaveLength(1);
});
