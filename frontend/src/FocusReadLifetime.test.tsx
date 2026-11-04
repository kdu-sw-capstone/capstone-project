import {StrictMode} from "react";
import {act,cleanup,render,screen,waitFor} from "@testing-library/react";
import {afterEach,beforeEach,expect,it,vi} from "vitest";
import FocusSessions from "./FocusSessions";
import {clearCsrf} from "./api";
import {connectExecution} from "./executionWake";
vi.mock("./executionWake",()=>({connectExecution:vi.fn(),executionBridgeConfigured:()=>false,wakeExecution:vi.fn()}));
const sid="10000000-0000-4000-8000-000000000001",executor="10000000-0000-4000-8000-000000000002";
const session={session_id:sid,executor_id:executor,execution_status:"RUNNING",record_status:"PARTIAL",duration_minutes:10,active_duration_ms:1000};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{"Content-Type":"application/json"}});
function defer<T>(){let resolve!:(v:T)=>void;const promise=new Promise<T>(r=>{resolve=r;});return {promise,resolve};}
function fixture(pendingPath:string,pending:Promise<Response>){
 let deferOld=true;
 const calls:{path:string;signal?:AbortSignal|null;method:string}[]=[];
 vi.stubGlobal("fetch",vi.fn(async(url:string,init?:RequestInit)=>{
  const path=url.replace("/api/v1","");calls.push({path,signal:init?.signal,method:init?.method??"GET"});
  if(deferOld&&path===pendingPath)return pending;
  if(path==="/sessions/current")return json(pendingPath.endsWith("/policy")?session:null);
  if(path==="/extension-installations")return json([{executor_id:executor}]);
  if(path.endsWith("/policy"))return json({sites:[]});
  if(path.includes("/focus-control"))return json({error:{code:"NOT_FOUND"}},404);
  if(path.endsWith("/note"))return json({text:"",version:0});
  return json({items:[],next_cursor:null,has_more:false});
 }));
 return {calls,newOwner:()=>{deferOld=false;}};
}
const show=(strict=false)=>{const view=<FocusSessions settings={()=>{}} records={()=>{}}/>;return render(strict?<StrictMode>{view}</StrictMode>:view);};
beforeEach(()=>{vi.mocked(connectExecution).mockResolvedValue(null);});
afterEach(()=>{cleanup();clearCsrf();vi.mocked(connectExecution).mockReset();vi.unstubAllGlobals();});
it.each(["/sessions/current",`/sessions/${sid}/policy`])("discarded %s 401 cannot expire a new account view",async path=>{
 const pending=defer<Response>(),expired=vi.fn();window.addEventListener("focurve:authentication-expired",expired);
 try{
  const f=fixture(path,pending.promise),old=show();await waitFor(()=>expect(f.calls.some(c=>c.path===path)).toBe(true));old.unmount();f.newOwner();show();
  await screen.findByText("저장된 반복 설정이 없습니다.");
  await act(async()=>pending.resolve(json({error:{code:"UNAUTHENTICATED"}},401)));
  expect(expired).not.toHaveBeenCalled();expect(f.calls.find(c=>c.path===path)?.signal?.aborted).toBe(true);
 }finally{window.removeEventListener("focurve:authentication-expired",expired);}
});
it.each(["/sessions/current",`/sessions/${sid}/policy`])("discarded successful %s cannot launch dependent reads",async path=>{
 const pending=defer<Response>(),f=fixture(path,pending.promise),old=show();
 await waitFor(()=>expect(f.calls.some(c=>c.path===path)).toBe(true));old.unmount();const before=f.calls.length;
 await act(async()=>pending.resolve(json(path.endsWith("/policy")?{sites:[]}:session)));
 expect(f.calls).toHaveLength(before);expect(f.calls.find(c=>c.path===path)?.signal?.aborted).toBe(true);
});
it("a discarded CONNECT reply cannot launch installation discovery",async()=>{
 const pending=defer<string|null>();vi.mocked(connectExecution).mockReturnValue(pending.promise);const f=fixture("unused",Promise.resolve(json(null))),old=show();
 await waitFor(()=>expect(connectExecution).toHaveBeenCalled());old.unmount();const before=f.calls.length;await act(async()=>pending.resolve(executor));expect(f.calls).toHaveLength(before);
});
it.each(["/sessions/current",`/sessions/${sid}/policy`])("live %s 401 still expires authentication once and never enables START or END",async path=>{
 const expired=vi.fn();window.addEventListener("focurve:authentication-expired",expired);
 try{fixture(path,Promise.resolve(json({error:{code:"UNAUTHENTICATED"}},401)));show();await waitFor(()=>expect(expired).toHaveBeenCalledOnce());expect(screen.getByRole("button",{name:path.endsWith("/policy")?"세션 종료":/집중 시작/})).toBeDisabled();}
 finally{window.removeEventListener("focurve:authentication-expired",expired);}
});
it("StrictMode recreates a live discovery and preserves UNKNOWN without any write",async()=>{
 const f=fixture("/sessions/current",Promise.resolve(json({...session,execution_status:"UNKNOWN"})));show(true);
 await screen.findByText("실행 상태: 결과 확인 필요 · 기록 상태: 일부 수집");await waitFor(()=>expect(screen.getByText("저장된 반복 설정이 없습니다.")).toBeInTheDocument());
 expect(f.calls.filter(c=>c.path==="/sessions/current")).toHaveLength(1);
 expect(f.calls.some(c=>c.path==="/sites")).toBe(true);expect(f.calls.every(c=>c.method==="GET")).toBe(true);expect(screen.queryByRole("button",{name:/집중 시작/})).not.toBeInTheDocument();
});
