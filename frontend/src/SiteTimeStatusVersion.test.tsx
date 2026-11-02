import {fireEvent,render,screen,cleanup} from "@testing-library/react";
import {afterEach,it,expect,vi} from "vitest";
import SiteTimeStatus from "./SiteTimeStatus";
import {clearCsrf} from "./api";
const executor="00000000-0000-4000-8000-000000000001",id="00000000-0000-4000-8000-000000000002";
const json=(v:unknown)=>new Response(JSON.stringify(v),{headers:{"Content-Type":"application/json"}});
afterEach(()=>{cleanup();clearCsrf();vi.unstubAllGlobals();});
function config(version:number,state:string){return {config_id:id,executor_id:executor,version,value:{kind:"SITE_TIME",policy_id:id,version,scope:{host:"example.org"}},deleted_at:state==="NOT_APPLICABLE"?"2026-11-01T00:00:00.000Z":null,saved_state:"SAVED",runtime_apply_state:state,saved_runtime_revision:version,applied_runtime_revision:state==="APPLIED"?version:null,next_focus_revision:version,updated_at:"2026-11-01T00:00:00.000Z"};}
function fixture(value:()=>ReturnType<typeof config>){
 const fetch=vi.fn(async(url:string)=>{
  const u=new URL(url,"http://localhost");
  if(u.pathname===`/api/v1/amvp/configs/${id}`)return json(value());
  if(u.pathname===`/api/v1/amvp/site-time-policies/${id}/usage`){
   const start=u.searchParams.get("date")+"T00:00:00.000Z",end=new Date(Date.parse(start)+86400000).toISOString();
   return json({executor_id:executor,policy_id:id,day_start_at:start,day_end_at:end,timezone:"UTC",timezone_version:1,day_kind:"NORMAL",confirmed_ms:5000,budget_carry_debit_ms:0,daily_limit_ms:60000,remaining_ms:null,active_reasons:[],enforcement_state:"UNKNOWN",next_usable_at:null,next_usable_status:"UNKNOWN",quality:"PARTIAL",as_of:start});
  }
  throw new Error(url);
 });vi.stubGlobal("fetch",fetch);return fetch;
}
it.each(["APPLIED","NOT_APPLICABLE"])("rejects a newly fetched older %s projection instead of promoting it for the selected version",async(state)=>{
 const fetch=fixture(()=>config(2,state));render(<SiteTimeStatus executor={executor} configId={id} configurationVersion={3}/>);
 expect(await screen.findByRole("alert")).toHaveTextContent("버전");
 expect(screen.queryByText("적용 확인됨")).not.toBeInTheDocument();expect(screen.queryByText("삭제된 설정의 실제 해제 확인됨")).not.toBeInTheDocument();expect(screen.queryByText("0분 5초")).not.toBeInTheDocument();
 expect(fetch).toHaveBeenCalledOnce();expect(fetch.mock.calls[0][0]).toContain(`/amvp/configs/${id}`);
});
it("retries with a fresh GET; only the selected-or-newer version can reveal status and historical usage",async()=>{
 let version=2;const fetch=fixture(()=>config(version,"PENDING"));render(<SiteTimeStatus executor={executor} configId={id} configurationVersion={3}/>);
 await screen.findByRole("alert");version=3;fireEvent.click(screen.getByRole("button",{name:"선택한 정책 다시 조회"}));
 await screen.findByText(/서버 조회 버전 3/);expect(screen.getByText("저장됨 · 적용 대기")).toBeInTheDocument();expect(screen.getByText("0분 5초")).toBeInTheDocument();expect(screen.queryByRole("alert")).not.toBeInTheDocument();expect(fetch).toHaveBeenCalledTimes(4);
});
it("allows a newer stable server version without treating historical usage as application evidence",async()=>{
 fixture(()=>config(4,"UNKNOWN"));render(<SiteTimeStatus executor={executor} configId={id} configurationVersion={3}/>);
 await screen.findByText(/서버 조회 버전 4/);expect(screen.getByText("적용 결과 미확인")).toBeInTheDocument();expect(screen.getByText("0분 5초")).toBeInTheDocument();expect(screen.queryByText("적용 확인됨")).not.toBeInTheDocument();
});
