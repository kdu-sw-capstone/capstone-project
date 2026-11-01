import {beforeEach,expect,it,vi} from "vitest";
import {ApiError} from "./api";
import {dailyUsage,type DailyUsage} from "./dailyUsageApi";
import {kstToday,periodDates,periodEnding,siteUsagePeriod,summarizePeriod} from "./siteUsagePeriodApi";
vi.mock("./dailyUsageApi",()=>({dailyUsage:vi.fn()}));
const executor="00000000-0000-4000-8000-000000000001",policy="00000000-0000-4000-8000-000000000002";
const day=(date:string,patch:Partial<DailyUsage>={}):DailyUsage=>({policy_id:policy,executor_id:executor,day_start_at:new Date(Date.parse(date+"T00:00:00Z")-9*3600000).toISOString(),day_end_at:new Date(Date.parse(date+"T00:00:00Z")+15*3600000).toISOString(),timezone:"Asia/Seoul",timezone_version:1,day_kind:"NORMAL",confirmed_ms:5000,budget_carry_debit_ms:9000,remaining_ms:null,daily_limit_ms:60000,active_reasons:[],enforcement_state:"UNKNOWN",next_usable_at:null,next_usable_status:"UNKNOWN",quality:"PARTIAL",as_of:"2026-11-01T00:00:00.000Z",...patch});
beforeEach(()=>{vi.mocked(dailyUsage).mockReset();});
it("uses KST today regardless of the client timezone and crosses year/month/leap boundaries",()=>{
 expect(kstToday(new Date("2026-12-31T14:59:59.999Z"))).toBe("2026-12-31");expect(kstToday(new Date("2026-12-31T15:00:00.000Z"))).toBe("2027-01-01");
 expect(periodEnding("2027-01-01",7)).toEqual({from:"2026-12-26",to:"2027-01-01"});expect(periodDates("2024-02-28","2024-03-01")).toEqual(["2024-02-28","2024-02-29","2024-03-01"]);
 expect(periodDates("2026-12-31","2027-01-01")).toHaveLength(2);expect(periodEnding("2026-11-01",30).from).toBe("2026-10-03");
});
it.each([["2026-02-29","2026-03-01"],["2026-10-32","2026-11-01"],["2026-11-02","2026-11-01"],["2026-10-01","2026-11-01"],["","2026-11-01"]])("rejects invalid or excessive periods before HTTP: %s",async(from,to)=>{
 await expect(siteUsagePeriod(executor,policy,from,to,new AbortController().signal)).rejects.toThrow();expect(dailyUsage).not.toHaveBeenCalled();
});
it("reads inclusive days sequentially with the same policy/executor and sums confirmed time without carry",async()=>{
 let active=0;vi.mocked(dailyUsage).mockImplementation(async(e,p,d)=>{expect(e).toBe(executor);expect(p).toBe(policy);expect(active++).toBe(0);await Promise.resolve();active--;return day(d);});
 const result=await siteUsagePeriod(executor,policy,"2026-10-31","2026-11-01",new AbortController().signal);
 expect(result.confirmedMs).toBe(10000);expect(result.confirmedDays).toBe(2);expect(result.days.map(x=>x.date)).toEqual(["2026-10-31","2026-11-01"]);expect(dailyUsage).toHaveBeenCalledTimes(2);
});
it("keeps unavailable and unknown days out of the confirmed prefix; proven zero remains zero",async()=>{
 vi.mocked(dailyUsage).mockRejectedValueOnce(new ApiError("RESOURCE_NOT_FOUND",404)).mockResolvedValueOnce(day("2026-10-30",{confirmed_ms:0})).mockRejectedValueOnce(new ApiError("STORE_UNCONFIRMED",503)).mockResolvedValueOnce(day("2026-11-01",{quality:"UNKNOWN",confirmed_ms:9000}));
 const result=await siteUsagePeriod(executor,policy,"2026-10-29","2026-11-01",new AbortController().signal);expect(result.confirmedMs).toBe(0);expect(result.confirmedDays).toBe(1);expect(result.days[0].data).toBeNull();expect(result.days[2].unavailable).toBe("UNCONFIRMED");
 expect(summarizePeriod([{date:"2026-11-01",data:null,unavailable:"NOT_VERIFIED"}]).confirmedMs).toBeNull();
});
it.each([new ApiError("UNAUTHENTICATED",401),new ApiError("FORBIDDEN_EXECUTOR",403),new ApiError("CAPABILITY_NOT_VERIFIED",503),new Error("identity mismatch")])("fails closed on authorization, provider or response errors",async error=>{
 vi.mocked(dailyUsage).mockRejectedValue(error);await expect(siteUsagePeriod(executor,policy,"2026-10-31","2026-11-01",new AbortController().signal)).rejects.toBe(error);expect(dailyUsage).toHaveBeenCalledOnce();
});
it("does not relabel capture timezones or transition days as KST or sum overlapping days",()=>{
 for(const patch of [{timezone:"UTC"},{day_kind:"TRANSITION" as const},{day_end_at:"2026-11-02T00:00:00.000Z"}])expect(summarizePeriod([{date:"2026-11-01",data:day("2026-11-01",patch),unavailable:null}]).confirmedMs).toBeNull();
 expect(summarizePeriod(["2026-11-01","2026-11-01"].map(date=>({date,data:day(date),unavailable:null}))).calendarCompatible).toBe(false);
});
it("does not issue more reads after an aborted pending response",async()=>{
 const abort=new AbortController();vi.mocked(dailyUsage).mockImplementation(async()=>{abort.abort();return day("2026-10-31");});await expect(siteUsagePeriod(executor,policy,"2026-10-31","2026-11-01",abort.signal)).rejects.toThrow();expect(dailyUsage).toHaveBeenCalledOnce();
});
