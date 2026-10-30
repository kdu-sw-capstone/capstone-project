import {act,fireEvent,render,screen,waitFor} from "@testing-library/react";
import {beforeEach,expect,it,vi} from "vitest";
import DailyUsagePanel from "./DailyUsagePanel";
import {dailyUsage,type DailyUsage} from "./dailyUsageApi";
import type {ConfigRecord} from "./additionalConfigApi";
import {ApiError} from "./api";
vi.mock("./dailyUsageApi",()=>({dailyUsage:vi.fn()}));
const executor="00000000-0000-4000-8000-000000000001",policy="00000000-0000-4000-8000-000000000002";
const row:ConfigRecord={config_id:policy,executor_id:executor,version:1,value:{kind:"SITE_TIME",scope:{host:"example.org"}},deleted_at:null,saved_state:"SAVED",runtime_apply_state:"PENDING",saved_runtime_revision:1,applied_runtime_revision:null,next_focus_revision:1,updated_at:"2026-10-29T00:00:00.000Z"};
const value:DailyUsage={policy_id:policy,executor_id:executor,day_start_at:"2026-10-29T00:00:00.000Z",day_end_at:"2026-10-30T00:00:00.000Z",timezone:"UTC",timezone_version:1,day_kind:"NORMAL",confirmed_ms:5000,budget_carry_debit_ms:7000,daily_limit_ms:60000,remaining_ms:null,active_reasons:[],enforcement_state:"UNKNOWN",next_usable_at:null,next_usable_status:"UNKNOWN",quality:"PARTIAL",as_of:"2026-10-29T00:00:05.000Z"};
beforeEach(()=>vi.mocked(dailyUsage).mockReset());
it("does not query guest, foreign-installation or absent policies",()=>{
 const view=render(<DailyUsagePanel executor={executor} records={[]}/>);expect(screen.getByText("저장된 사이트 시간 정책이 없습니다.")).toBeInTheDocument();
 view.rerender(<DailyUsagePanel executor={executor} records={[{...row,executor_id:policy}]}/>);expect(dailyUsage).not.toHaveBeenCalled();
});
it("displays actual confirmed prefix and carry without computing a live remaining quota",async()=>{
 vi.mocked(dailyUsage).mockResolvedValue(value);render(<DailyUsagePanel executor={executor} records={[row]}/>);
 expect(await screen.findByText("0분 5초")).toBeInTheDocument();expect(screen.getByText("0분 7초")).toBeInTheDocument();expect(screen.queryByText("0분 48초")).not.toBeInTheDocument();expect(screen.getByText(/실제 제한: 미확인/)).toBeInTheDocument();
});
it("missing or unconfirmed data stays unknown and explicit retry is read-only",async()=>{
 vi.mocked(dailyUsage).mockRejectedValueOnce(new ApiError("RESOURCE_NOT_FOUND",404)).mockResolvedValueOnce(value);render(<DailyUsagePanel executor={executor} records={[row]}/>);
 expect(await screen.findByRole("alert")).toHaveTextContent("사용량 0 또는 이용 가능 상태를 뜻하지 않습니다");fireEvent.click(screen.getByRole("button",{name:"일일 기록 다시 조회"}));expect(await screen.findByText("0분 5초")).toBeInTheDocument();
});
it("discards delayed data from the previous installation",async()=>{
 let resolve!:(v:DailyUsage)=>void;vi.mocked(dailyUsage).mockImplementationOnce(()=>new Promise(r=>{resolve=r;})).mockRejectedValueOnce(new ApiError("CAPABILITY_NOT_VERIFIED",503));
 const view=render(<DailyUsagePanel executor={executor} records={[row]}/>);view.rerender(<DailyUsagePanel executor={policy} records={[{...row,executor_id:policy}]}/>);expect(await screen.findByRole("alert")).toBeInTheDocument();await act(async()=>resolve(value));expect(screen.queryByText("0분 5초")).not.toBeInTheDocument();
});
it("invalidates the displayed snapshot when the policy version changes",async()=>{
 vi.mocked(dailyUsage).mockResolvedValueOnce(value).mockImplementationOnce(()=>new Promise(()=>{}));const view=render(<DailyUsagePanel executor={executor} records={[row]}/>);await screen.findByText("0분 5초");view.rerender(<DailyUsagePanel executor={executor} records={[{...row,version:2,saved_runtime_revision:2}]}/>);expect(screen.queryByText("0분 5초")).not.toBeInTheDocument();await waitFor(()=>expect(dailyUsage).toHaveBeenCalledTimes(2));
});
