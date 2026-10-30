import {beforeEach,expect,it,vi} from "vitest";
import {request} from "./api";
import {dailyUsage,type DailyUsage} from "./dailyUsageApi";
vi.mock("./api",()=>({request:vi.fn(),UiError:class extends Error{}}));
const executor="00000000-0000-4000-8000-000000000001",policy="00000000-0000-4000-8000-000000000002";
const value:DailyUsage={policy_id:policy,executor_id:executor,day_start_at:"2026-10-29T00:00:00.000Z",day_end_at:"2026-10-30T00:00:00.000Z",timezone:"UTC",timezone_version:1,day_kind:"NORMAL",confirmed_ms:5000,budget_carry_debit_ms:0,remaining_ms:null,daily_limit_ms:60000,active_reasons:[],enforcement_state:"UNKNOWN",next_usable_at:null,next_usable_status:"UNKNOWN",quality:"PARTIAL",as_of:"2026-10-29T00:00:05.000Z"};
beforeEach(()=>vi.mocked(request).mockReset());
it("reads the approved DAY-01 path and preserves null measurement fields",async()=>{
 vi.mocked(request).mockResolvedValue(value);const signal=new AbortController().signal;expect((await dailyUsage(executor,policy,"2026-10-29",signal)).remaining_ms).toBeNull();expect(request).toHaveBeenCalledWith(`/amvp/site-time-policies/${policy}/usage?executor_id=${executor}&date=2026-10-29`,"GET",undefined,{signal});
});
it("rejects malformed input without sending a request",async()=>{
 for(const date of ["2026-02-30","2026-10-29&other=1",""])await expect(dailyUsage(executor,policy,date)).rejects.toThrow();expect(request).not.toHaveBeenCalled();
});
it("rejects mismatched identity, calendar, invalid quality and numeric coercion",async()=>{
 for(const patch of [{executor_id:policy},{policy_id:executor},{confirmed_ms:"5000"},{confirmed_ms:-1},{quality:"COMPLETE!"},{timezone:"bad/zone"},{day_start_at:"2026-10-28T00:00:00.000Z"},{remaining_ms:Number.MAX_SAFE_INTEGER+1}]){
  vi.mocked(request).mockResolvedValue({...value,...patch});await expect(dailyUsage(executor,policy,"2026-10-29")).rejects.toThrow();
 }
});
