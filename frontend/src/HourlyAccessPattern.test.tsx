import {act,fireEvent,render,screen,waitFor,within} from "@testing-library/react";
import {beforeEach,expect,it,vi} from "vitest";
import HourlyAccessPattern,{parseHours} from "./HourlyAccessPattern";
import {request} from "./api";
vi.mock("./api",()=>({request:vi.fn(),message:(e:Error)=>e.message,UiError:class extends Error{}}));
const hours=()=>Array.from({length:24},()=>({total_access:null as number|null,repeat_access:null as number|null,blocked_access:null as number|null,repeat_ratio:null as number|null,active_duration_ms:null,quality:"NOT_COLLECTED",as_of:"2026-11-11T00:00:00.123Z"}));
const observed=()=>{const rows=hours();rows[10]={...rows[10],total_access:2,repeat_access:1,blocked_access:1,repeat_ratio:.5,quality:"PARTIAL"};return rows;};
beforeEach(()=>{vi.mocked(request).mockReset();});
it("connects the existing hourly API and keeps empty hours uncollected",async()=>{
 vi.mocked(request).mockResolvedValue(observed());render(<HourlyAccessPattern from="2026-11-11" to="2026-11-11"/>);const row=await screen.findByRole("row",{name:/10시/});expect(row).toHaveTextContent("50.0%");expect(row).toHaveTextContent("일부 수집");expect(within(screen.getByRole("row",{name:/00시/})).getByText("미수집")).toBeInTheDocument();expect(screen.getAllByRole("row")).toHaveLength(25);expect(vi.mocked(request).mock.calls[0][0]).toBe("/statistics/hourly?from_date=2026-11-11&to_date=2026-11-11");expect(vi.mocked(request).mock.calls[0][1]).toBe("GET");
});
it("rejects incomplete hours, bad time and counts or ratio conflicts",()=>{
 expect(()=>parseHours(hours().slice(1))).toThrow();for(const patch of [{as_of:undefined},{repeat_ratio:2},{total_access:1,repeat_access:2},{quality:"NOT_COLLECTED"},{total_access:null,repeat_access:null,blocked_access:null,repeat_ratio:null,quality:"COMPLETE"}]){const rows=observed();Object.assign(rows[10],patch);expect(()=>parseHours(rows)).toThrow();}
});
it("drops an old period response and never replaces a new result with it",async()=>{
 let finish!:(v:unknown)=>void;vi.mocked(request).mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve;})).mockResolvedValueOnce(observed());const view=render(<HourlyAccessPattern from="2026-11-10" to="2026-11-10"/>);view.rerender(<HourlyAccessPattern from="2026-11-11" to="2026-11-11"/>);await screen.findByRole("table");await act(async()=>finish(hours()));expect(screen.getByRole("row",{name:/10시/})).toHaveTextContent("50.0%");
});
it("removes a prior success on read failure and supports explicit retry",async()=>{
 vi.mocked(request).mockResolvedValueOnce(observed()).mockRejectedValueOnce(new Error("READ_UNCONFIRMED")).mockResolvedValueOnce(hours());render(<HourlyAccessPattern/>);await screen.findByRole("table");fireEvent.click(screen.getByText("시간대별 기록 다시 조회"));expect(await screen.findByRole("alert")).toHaveTextContent("READ_UNCONFIRMED");expect(screen.queryByRole("table")).not.toBeInTheDocument();fireEvent.click(screen.getByText("시간대별 기록 다시 조회"));await screen.findByRole("table");expect(screen.queryByRole("alert")).not.toBeInTheDocument();expect(screen.getAllByText("미수집")).toHaveLength(24);
});
