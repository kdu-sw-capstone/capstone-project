import {cleanup,fireEvent,render,screen,within} from "@testing-library/react";
import {afterEach,expect,it} from "vitest";
import PurposeUsageByDay,{PurposeUsageDonut,type PurposeUsageDay,type PurposeUsageState} from "./PurposeUsageCharts";
afterEach(cleanup);
// SYNTHETIC component fixtures only; no server purpose-time contract is asserted.
const days=():PurposeUsageDay[]=>Array.from({length:7},(_,i)=>({date:i===6?"2026-11-01":`2026-10-${26+i}`,milliseconds:{FOCUS:(i+1)*60000,DISTRACTION:30000,GENERAL:0}}));
it("keeps the product default unavailable instead of filling missing time with zero",()=>{
 render(<PurposeUsageByDay/>);expect(screen.getByRole("status")).toHaveTextContent(/아직 연결되지/);expect(screen.queryByRole("img")).not.toBeInTheDocument();expect(screen.queryByRole("table")).not.toBeInTheDocument();expect(screen.queryByText("0분")).not.toBeInTheDocument();expect(screen.getByText(/집중 세션 시간과는 다릅니다/)).toBeInTheDocument();
});
it.each([
 [{status:"loading"},/확인하고 있어요/], [{status:"empty"},/확인된 이용 기록이 없습니다/],
 [{status:"unknown"},/미확인은 0분/], [{status:"error",message:"수집 기준 확인 실패"},/수집 기준 확인 실패/],
] as const)("distinguishes daily %j without fabricated bars",(state,text)=>{
 render(<PurposeUsageByDay state={state}/>);expect(screen.getByRole(state.status==="error"?"alert":"status")).toHaveTextContent(text);expect(screen.queryByRole("img")).not.toBeInTheDocument();
});
it("renders seven chronological groups with all three purpose values accessible",()=>{
 const view=render(<PurposeUsageByDay state={{status:"ready",days:days()}}/>);expect(screen.getByRole("img")).toHaveAccessibleName(/2026-10-26부터 2026-11-01까지/);expect(view.container.querySelectorAll(".purpose-day")).toHaveLength(7);expect(view.container.querySelectorAll(".purpose-bar")).toHaveLength(21);fireEvent.click(screen.getByText("날짜별 이용시간 값 보기"));const rows=within(screen.getByRole("table")).getAllByRole("row");expect(rows).toHaveLength(8);for(const text of ["1분","30초","0분"])expect(within(rows[1]).getByText(text)).toBeInTheDocument();
});
it("leaves missing time unknown instead of drawing a zero bar",()=>{
 const partial=days();partial[2].milliseconds.DISTRACTION=null;const view=render(<PurposeUsageByDay state={{status:"ready",days:partial}}/>);expect(view.container.querySelectorAll(".purpose-bar")).toHaveLength(20);expect(view.container.querySelectorAll(".purpose-bar-unknown")).toHaveLength(1);expect(screen.getByRole("status")).toHaveTextContent(/0분을 뜻하지/);fireEvent.click(screen.getByText("날짜별 이용시간 값 보기"));expect(screen.getByRole("table")).toHaveTextContent("미확인");
});
it.each(["missing day","duplicate date","negative time","invalid date"])("rejects %s without a complete graph",kind=>{
 const invalid=days();if(kind==="missing day")invalid.pop();if(kind==="duplicate date")invalid[1].date=invalid[0].date;if(kind==="negative time")invalid[0].milliseconds.FOCUS=-1;if(kind==="invalid date")invalid[0].date="2026-02-30";render(<PurposeUsageByDay state={{status:"ready",days:invalid}}/>);expect(screen.getByRole("alert")).toHaveTextContent(/날짜·수치를 확인하지/);expect(screen.queryByRole("img")).not.toBeInTheDocument();
});
it("time donut has one neutral ring and no made-up zero total",()=>{
 const view=render(<PurposeUsageDonut state={{status:"unknown"}}/>);expect(view.container.querySelectorAll(".donut")).toHaveLength(1);expect(screen.getByRole("img")).toHaveAccessibleName("사이트 이용시간 비율 미확인");expect(screen.queryByText("0분")).not.toBeInTheDocument();expect(screen.getByRole("status")).toHaveTextContent(/미확인은 0분/);
});
it("donut distinguishes verified empty, known zero and partial unknown",()=>{
 const view=render(<PurposeUsageDonut state={{status:"empty"}}/>);expect(screen.getByRole("img")).toHaveAccessibleName(/기록 없음/);expect(screen.queryByText("0분")).not.toBeInTheDocument();view.rerender(<PurposeUsageDonut state={{status:"ready",totals:{FOCUS:0,DISTRACTION:0,GENERAL:0}}}/>);expect(screen.getByRole("img")).toHaveAccessibleName(/이용시간 0분/);expect(screen.getByText(/계산할 비율이 없습니다/)).toBeInTheDocument();view.rerender(<PurposeUsageDonut state={{status:"ready",totals:{FOCUS:60000,DISTRACTION:null,GENERAL:0}}}/>);expect(screen.getByRole("img")).toHaveAccessibleName(/비율 미확인/);expect(screen.getByRole("status")).toHaveTextContent(/전체 비율을 계산하지/);expect(screen.queryByText("100.0%")).not.toBeInTheDocument();
});
it("ready donut percentages use confirmed time without count joins",()=>{
 render(<PurposeUsageDonut state={{status:"ready",totals:{FOCUS:120000,DISTRACTION:60000,GENERAL:60000}}}/>);expect(screen.getByRole("img")).toHaveAccessibleName(/사이트 이용시간 4분: 집중 2분, 방해 1분, 일반 1분/);expect(screen.getByText("50.0%")).toBeInTheDocument();expect(screen.getAllByText("25.0%")).toHaveLength(2);
});
it("invalid and overflowing totals cannot produce numeric ratios",()=>{
 const states:PurposeUsageState[]=[{status:"ready",totals:{FOCUS:-1,DISTRACTION:0,GENERAL:0}},{status:"ready",totals:{FOCUS:Number.MAX_SAFE_INTEGER,DISTRACTION:Number.MAX_SAFE_INTEGER,GENERAL:1}}];for(const state of states){const view=render(<PurposeUsageDonut state={state}/>);expect(screen.getByRole("img")).toHaveAccessibleName(/비율 미확인/);expect(view.container.textContent).not.toMatch(/NaN|Infinity|100\.0%/);view.unmount();}
});
