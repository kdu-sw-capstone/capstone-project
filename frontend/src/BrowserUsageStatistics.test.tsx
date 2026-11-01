import {fireEvent,render,screen,waitFor} from "@testing-library/react";
import {beforeEach,expect,it,vi} from "vitest";
import BrowserUsageStatistics,{parseUsage,type UsageStatistics} from "./BrowserUsageStatistics";
import {request} from "./api";
vi.mock("./api",()=>({request:vi.fn(),message:(e:Error)=>e.message,UiError:class extends Error{}}));
const executor="00000000-0000-4000-8000-000000000001";
const result:UsageStatistics={scope:"INSTALLATION",quota_debit:false,aggregation:"SUM_OF_DEVICE_USAGE",from_date:"2026-10-29",to_date:"2026-10-29",browser_ms:null,focus_ms:null,repeat_count:null,repeat_ratio:null,quality:"UNKNOWN",as_of:"2026-10-29T00:00:00.000Z"};
beforeEach(()=>{vi.mocked(request).mockReset();});
it("does not turn unknown or missing metrics into zero",async()=>{
 vi.mocked(request).mockImplementation(async(path)=>path==="/extension-installations"?[{executor_id:executor,client_version:"test"}]:result);
 render(<BrowserUsageStatistics/>);await waitFor(()=>expect(screen.getByLabelText("이용시간 대상 설치")).toBeEnabled());fireEvent.change(screen.getByLabelText("이용시간 대상 설치"),{target:{value:executor}});
 fireEvent.change(screen.getByLabelText("이용시간 시작 날짜"),{target:{value:"2026-10-29"}});fireEvent.change(screen.getByLabelText("이용시간 종료 날짜"),{target:{value:"2026-10-29"}});fireEvent.click(screen.getByText("이용시간 조회"));
 const box=await screen.findByLabelText("브라우저 이용시간 결과");expect(box).toHaveTextContent("미확인");expect(box).not.toHaveTextContent("0분 0초");expect(vi.mocked(request).mock.calls.at(-1)?.[0]).toContain("scope=INSTALLATION");
});
it("clears stale metrics when the requested scope changes",async()=>{
 vi.mocked(request).mockImplementation(async(path)=>path==="/extension-installations"?[]:{...result,scope:"ACCOUNT_TOTAL",browser_ms:5000,quality:"PARTIAL"});render(<BrowserUsageStatistics/>);
 fireEvent.change(screen.getByLabelText("조회 범위"),{target:{value:"ACCOUNT_TOTAL"}});fireEvent.change(screen.getByLabelText("이용시간 시작 날짜"),{target:{value:"2026-10-29"}});fireEvent.change(screen.getByLabelText("이용시간 종료 날짜"),{target:{value:"2026-10-29"}});fireEvent.click(screen.getByText("이용시간 조회"));expect(await screen.findByText("0분 5초")).toBeInTheDocument();
 expect(vi.mocked(request).mock.calls.at(-1)?.[0]).not.toContain("executor_id");fireEvent.change(screen.getByLabelText("조회 범위"),{target:{value:"INSTALLATION"}});expect(screen.queryByLabelText("브라우저 이용시간 결과")).not.toBeInTheDocument();
});
it("refuses mismatched scope, date, quota flag or invalid numeric responses",()=>{
 for(const patch of [{scope:"ACCOUNT_TOTAL"},{from_date:"2026-10-28"},{quota_debit:true},{browser_ms:-1},{repeat_ratio:2}])expect(()=>parseUsage({...result,...patch} as UsageStatistics,"INSTALLATION","2026-10-29","2026-10-29")).toThrow();
});
it.each([undefined,null,"","invalid","2026-02-30T00:00:00.000Z","2026-10-29T00:00:00Z","2026-10-29T09:00:00.000+09:00",123])("rejects an unverified statistics observation time: %s",as_of=>{
 expect(()=>parseUsage({...result,as_of} as UsageStatistics,"INSTALLATION","2026-10-29","2026-10-29")).toThrow();
});
it("removes prior metrics after an unverified response and recovers only on a valid explicit read",async()=>{
 let response:unknown={...result,scope:"ACCOUNT_TOTAL",browser_ms:5000,quality:"PARTIAL"};vi.mocked(request).mockImplementation(async path=>path==="/extension-installations"?[]:response);
 render(<BrowserUsageStatistics/>);fireEvent.change(screen.getByLabelText("조회 범위"),{target:{value:"ACCOUNT_TOTAL"}});fireEvent.change(screen.getByLabelText("이용시간 시작 날짜"),{target:{value:result.from_date}});fireEvent.change(screen.getByLabelText("이용시간 종료 날짜"),{target:{value:result.to_date}});
 fireEvent.click(screen.getByText("이용시간 조회"));expect(await screen.findByText("0분 5초")).toBeInTheDocument();
 response={...result,scope:"ACCOUNT_TOTAL",browser_ms:9000,quality:"COMPLETE",as_of:undefined};fireEvent.click(screen.getByText("이용시간 조회"));expect(await screen.findByRole("alert")).toHaveTextContent("이용시간 조회 범위와 응답을 확인하지 못했습니다.");expect(screen.queryByLabelText("브라우저 이용시간 결과")).not.toBeInTheDocument();expect(screen.queryByText("0분 5초")).not.toBeInTheDocument();expect(screen.queryByText("0분 9초")).not.toBeInTheDocument();
 response={...result,scope:"ACCOUNT_TOTAL",browser_ms:7000,quality:"PARTIAL",as_of:"2026-10-29T00:00:00.123Z"};fireEvent.click(screen.getByText("이용시간 조회"));expect(await screen.findByText("0분 7초")).toBeInTheDocument();expect(screen.queryByRole("alert")).not.toBeInTheDocument();expect(screen.getByLabelText("브라우저 이용시간 결과")).toHaveTextContent("2026-10-29T00:00:00.123Z");expect(vi.mocked(request).mock.calls.filter(c=>c[0].startsWith("/amvp/statistics/")).every(c=>c[1]==="GET")).toBe(true);
});
