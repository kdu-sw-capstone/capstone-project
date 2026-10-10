import {render,screen,fireEvent,cleanup,waitFor,act} from "@testing-library/react";
import {afterEach,it,expect,vi} from "vitest";
import HourlyAccessPattern from "./HourlyAccessPattern";
const json=(value:unknown)=>new Response(JSON.stringify(value),{headers:{"Content-Type":"application/json"}});
const buckets=(count=3,quality="COMPLETE")=>Array.from({length:24},(_,hour)=>({hour,timezone:"Asia/Seoul",total_access:hour===9?count:0,repeat_access:0,blocked_access:0,quality,as_of:"2026-10-10T00:00:00Z"}));
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
it("loads API values with dates and renders accessible counts and KST timestamp",async()=>{
  const fetch=vi.fn(async(_url:string)=>json(buckets()));vi.stubGlobal("fetch",fetch);
  render(<HourlyAccessPattern from="2026-10-10" to="2026-10-10"/>);
  expect(screen.getByRole("status")).toHaveTextContent("확인");
  await screen.findByText("9시–10시");
  expect(fetch.mock.calls[0][0]).toContain("from_date=2026-10-10&to_date=2026-10-10");
  expect(screen.getByText("9시–10시").parentElement).toHaveTextContent("3");
  expect(screen.getByText(/2026.*10.*10.*09:00:00/)).toBeInTheDocument();
});
it("no data and partial unknowns are not presented as measured focus time",async()=>{
  vi.stubGlobal("fetch",vi.fn(async()=>json(buckets(0,"NO_DATA"))));
  const view=render(<HourlyAccessPattern/>);await screen.findByText("조회 기간에 접근 기록이 없습니다.");
  const rows=buckets(1,"PARTIAL");rows[0].total_access=null as unknown as number;
  vi.stubGlobal("fetch",vi.fn(async()=>json(rows)));view.rerender(<HourlyAccessPattern from="2026-10-10"/>);
  await screen.findByText(/일부 기록이 미확인/);
  expect(screen.getByText("0시–1시").parentElement).toHaveTextContent("미확인");
});
it("errors can be retried and invalid responses never become a fake chart",async()=>{
  const fetch=vi.fn().mockResolvedValueOnce(json([])).mockResolvedValueOnce(json(buckets()));vi.stubGlobal("fetch",fetch);
  render(<HourlyAccessPattern/>);await screen.findByRole("alert");expect(screen.queryByRole("img")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button",{name:"시간대 분석 다시 조회"}));await screen.findByRole("img");
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
});
it("period change cancels the request and ignores late responses even when transport ignores abort",async()=>{
  let resolve:(v:Response)=>void=()=>{};
  const fetch=vi.fn().mockImplementationOnce(()=>new Promise<Response>(r=>{resolve=r;})).mockResolvedValueOnce(json(buckets(7)));
  vi.stubGlobal("fetch",fetch);const view=render(<HourlyAccessPattern from="2026-10-09"/>);
  const signal=fetch.mock.calls[0][1].signal as AbortSignal;
  view.rerender(<HourlyAccessPattern from="2026-10-10"/>);expect(signal.aborted).toBe(true);
  await screen.findByText("9시–10시");
  await act(async()=>resolve(json(buckets(99))));
  expect(screen.getByText("9시–10시").parentElement).toHaveTextContent("7");expect(screen.queryByText("99")).not.toBeInTheDocument();
  view.unmount();expect(fetch.mock.calls[1][1].signal.aborted).toBe(true);
});
it("HTTP failures display an error without inventing empty successful data",async()=>{
  vi.stubGlobal("fetch",vi.fn(async()=>new Response(JSON.stringify({error:{code:"UNAUTHORIZED"}}),{status:401})));
  render(<HourlyAccessPattern/>);await screen.findByRole("alert");
  await waitFor(()=>expect(screen.queryByText("조회 기간에 접근 기록이 없습니다.")).not.toBeInTheDocument());
});
it("same-period explicit refresh and re-entry request new data",async()=>{
  const fetch=vi.fn().mockResolvedValueOnce(json(buckets(1))).mockResolvedValueOnce(json(buckets(2))).mockResolvedValueOnce(json(buckets(4)));
  vi.stubGlobal("fetch",fetch);const view=render(<HourlyAccessPattern refreshKey={0}/>);
  await screen.findByText("9시–10시");view.rerender(<HourlyAccessPattern refreshKey={1}/>);
  await waitFor(()=>expect(screen.getByText("9시–10시").parentElement).toHaveTextContent("2"));
  view.unmount();render(<HourlyAccessPattern/>);
  await waitFor(()=>expect(screen.getByText("9시–10시").parentElement).toHaveTextContent("4"));
  expect(fetch).toHaveBeenCalledTimes(3);
});
