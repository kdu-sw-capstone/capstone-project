import {act,fireEvent,render,screen,waitFor,within} from "@testing-library/react";
import {afterEach,beforeEach,expect,it,vi} from "vitest";
import SiteUsagePeriod from "./SiteUsagePeriod";
import {dailyUsage,type DailyUsage} from "./dailyUsageApi";
import type {ConfigRecord} from "./additionalConfigApi";
import {ApiError} from "./api";
vi.mock("./dailyUsageApi",()=>({dailyUsage:vi.fn()}));
const executor="00000000-0000-4000-8000-000000000001",id="00000000-0000-4000-8000-000000000002";
const policy:ConfigRecord={config_id:id,executor_id:executor,version:1,value:{kind:"SITE_TIME",scope:{host:"a-very-long-policy-host.example.org"}},deleted_at:null,saved_state:"SAVED",runtime_apply_state:"PENDING",saved_runtime_revision:1,applied_runtime_revision:null,next_focus_revision:1,updated_at:"2026-10-29T00:00:00.000Z"};
const day=(date:string):DailyUsage=>({policy_id:id,executor_id:executor,day_start_at:new Date(Date.parse(date+"T00:00:00Z")-9*3600000).toISOString(),day_end_at:new Date(Date.parse(date+"T00:00:00Z")+15*3600000).toISOString(),timezone:"Asia/Seoul",timezone_version:1,day_kind:"NORMAL",confirmed_ms:5000,budget_carry_debit_ms:7000,remaining_ms:null,daily_limit_ms:60000,active_reasons:[],enforcement_state:"UNKNOWN",next_usable_at:null,next_usable_status:"UNKNOWN",quality:"PARTIAL",as_of:"2026-11-01T00:00:00.000Z"});
const setRange=(from="2026-10-31",to="2026-11-01")=>{fireEvent.change(screen.getByLabelText("정책 기록 시작일"),{target:{value:from}});fireEvent.change(screen.getByLabelText("정책 기록 종료일"),{target:{value:to}});};
const query=()=>fireEvent.click(screen.getByRole("button",{name:"기간 기록 조회"}));
beforeEach(()=>{vi.mocked(dailyUsage).mockReset().mockImplementation(async(_e,_p,date)=>day(date));});
afterEach(()=>vi.restoreAllMocks());
it("offers KST presets without sending requests until explicit read",()=>{
 vi.spyOn(Date,"now").mockReturnValue(Date.parse("2026-11-01T00:00:00Z"));render(<SiteUsagePeriod executor={executor} policy={policy}/>);
 fireEvent.click(screen.getByText("최근 30일"));expect(dailyUsage).not.toHaveBeenCalled();
 const a=(screen.getByLabelText("정책 기록 시작일") as HTMLInputElement).value,b=(screen.getByLabelText("정책 기록 종료일") as HTMLInputElement).value;expect(Date.parse(b)-Date.parse(a)).toBe(29*86400000);
 fireEvent.click(screen.getByText("오늘"));expect(screen.getByLabelText("정책 기록 시작일")).toHaveValue(b);
});
it("shows per-day source evidence and partial confirmed sum without relabeling host/version or carry",async()=>{
 render(<SiteUsagePeriod executor={executor} policy={policy}/>);setRange();query();const box=await screen.findByLabelText("사이트 정책 기간 기록");
 expect(within(box).getByText("0분 10초")).toBeInTheDocument();expect(within(box).getAllByText("0분 5초")).toHaveLength(2);expect(box).toHaveTextContent("정책 매칭 호스트: a-very-long-policy-host.example.org");expect(box).toHaveTextContent("실제 방문 호스트별 내역은 일일 응답에 없어");expect(box).toHaveTextContent("2/2일 · 기간 전체 수집 완료를 뜻하지 않습니다");expect(box).not.toHaveTextContent("0분 24초");
 expect(screen.getByRole("table")).toHaveAccessibleName(/날짜별 서버 확인 기록/);
});
it("preserves unknown vs missing vs zero and never says the whole period was collected",async()=>{
 vi.mocked(dailyUsage).mockRejectedValueOnce(new ApiError("RESOURCE_NOT_FOUND",404)).mockResolvedValueOnce({...day("2026-11-01"),confirmed_ms:0});render(<SiteUsagePeriod executor={executor} policy={policy}/>);setRange();query();const box=await screen.findByLabelText("사이트 정책 기간 기록");expect(box).toHaveTextContent("검증된 자료 없음");expect(box).toHaveTextContent("미확인");expect(box).toHaveTextContent("0분 0초");expect(box).toHaveTextContent("1/2일");
});
it("retains edited dates during loading and ignores a late response after a period change",async()=>{
 let resolve!:(d:DailyUsage)=>void;vi.mocked(dailyUsage).mockImplementationOnce(()=>new Promise(r=>{resolve=r;}));render(<SiteUsagePeriod executor={executor} policy={policy}/>);setRange();query();await screen.findByRole("status");setRange("2026-11-01","2026-11-01");await act(async()=>resolve(day("2026-10-31")));expect(screen.queryByLabelText("사이트 정책 기간 기록")).not.toBeInTheDocument();expect(screen.getByLabelText("정책 기록 시작일")).toHaveValue("2026-11-01");query();await screen.findByLabelText("사이트 정책 기간 기록");expect(dailyUsage).toHaveBeenCalledTimes(2);
});
it("clears previous data on retry failure and recovers only on explicit successful read",async()=>{
 render(<SiteUsagePeriod executor={executor} policy={policy}/>);setRange("2026-11-01","2026-11-01");query();await screen.findByLabelText("사이트 정책 기간 기록");vi.mocked(dailyUsage).mockRejectedValueOnce(new Error("offline"));query();await screen.findByRole("alert");expect(screen.queryByLabelText("사이트 정책 기간 기록")).not.toBeInTheDocument();query();await screen.findByLabelText("사이트 정책 기간 기록");
});
it.each(["version","executor","deleted","replacement"])("invalidates old responses and context on %s changes",async kind=>{
 let resolve!:(d:DailyUsage)=>void;vi.mocked(dailyUsage).mockImplementationOnce(()=>new Promise(r=>{resolve=r;}));const view=render(<SiteUsagePeriod executor={executor} policy={policy}/>);setRange();query();await waitFor(()=>expect(dailyUsage).toHaveBeenCalledOnce());
 const next={...policy,...(kind==="version"?{version:2}:kind==="deleted"?{deleted_at:"2026-11-01T00:00:00.000Z"}:kind==="replacement"?{config_id:executor}:{executor_id:id})};view.rerender(<SiteUsagePeriod executor={kind==="executor"?id:executor} policy={next}/>);await act(async()=>resolve(day("2026-10-31")));expect(screen.queryByLabelText("사이트 정책 기간 기록")).not.toBeInTheDocument();expect(dailyUsage).toHaveBeenCalledOnce();
});
it("does not revive an old result when dates are changed away and back",async()=>{
 render(<SiteUsagePeriod executor={executor} policy={policy}/>);setRange();query();await screen.findByLabelText("사이트 정책 기간 기록");setRange("2026-11-01","2026-11-01");setRange();expect(screen.queryByLabelText("사이트 정책 기간 기록")).not.toBeInTheDocument();
});
