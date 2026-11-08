import {act,cleanup,fireEvent,render,screen,waitFor,within} from "@testing-library/react";
import {afterEach,expect,it,vi} from "vitest";
import SiteClassification from "./SiteClassification";
import {ApiError,request} from "./api";
vi.mock("./api",async original=>({...await original<typeof import("./api")>(),request:vi.fn()}));
const get=vi.mocked(request);
const site=(id:string,purpose="FOCUS")=>({site_id:id,purpose});
const page=(items:unknown[],next_cursor:string|null=null,has_more=false)=>({items,next_cursor,has_more});
afterEach(()=>{cleanup();get.mockReset();});
it.each([
 ["unknown purpose",page([site("1","UNKNOWN")])],
 ["duplicate site",page([site("1"),site("1")])],
 ["incomplete pagination",page([site("1")],null,true)],
 ["contradictory cursor",page([site("1")],"next",false)],
 ["missing pagination state",{items:[site("1")],next_cursor:null}],
])("refuses %s instead of showing a complete distribution",async(_name,response)=>{
 get.mockResolvedValue(response);render(<SiteClassification open={()=>{}}/>);await screen.findByRole("alert");expect(screen.queryByRole("img")).not.toBeInTheDocument();expect(screen.queryByText("등록된 사이트가 없습니다.")).not.toBeInTheDocument();
});
it("rejects duplicate identities across pages rather than counting a retransmission twice",async()=>{
 get.mockResolvedValueOnce(page([site("1")],"next",true)).mockResolvedValue(page([site("1")]));render(<SiteClassification open={()=>{}}/>);await screen.findByRole("alert");expect(screen.queryByRole("img")).not.toBeInTheDocument();
});
it("retains all three purpose counts across a normal multi-page response",async()=>{
 get.mockResolvedValueOnce(page([site("1"),site("2","DISTRACTION")],"next",true)).mockResolvedValue(page([site("3","GENERAL"),site("4")]));const open=vi.fn();render(<SiteClassification open={open}/>);
 const chart=await screen.findByRole("img");expect(chart).toHaveAccessibleName(/집중 2개.*방해 1개.*일반 1개/);expect(screen.getByText(/이용시간 비율이 아닙니다/)).toBeInTheDocument();
 const items=screen.getAllByRole("listitem");expect(within(items[0]).getByText("2개")).toBeInTheDocument();expect(within(items[0]).getByText("50.0%")).toBeInTheDocument();expect(within(items[1]).getByText("25.0%")).toBeInTheDocument();fireEvent.click(screen.getByRole("button",{name:"관리 →"}));expect(open).toHaveBeenCalledOnce();
});
it("shows a valid empty account without a zero-time chart",async()=>{
 get.mockResolvedValue(page([]));render(<SiteClassification open={()=>{}}/>);await screen.findByText("등록된 사이트가 없습니다.");expect(screen.queryByRole("img")).not.toBeInTheDocument();expect(screen.queryByText(/0분/)).not.toBeInTheDocument();
});
it("retries a failed response without retaining a partial chart",async()=>{
 get.mockRejectedValueOnce(new ApiError("UNAUTHENTICATED",401)).mockResolvedValue(page([site("1","GENERAL")]));render(<SiteClassification open={()=>{}}/>);await screen.findByRole("alert");fireEvent.click(screen.getByRole("button",{name:"분류 다시 조회"}));await screen.findByRole("img");expect(screen.queryByRole("alert")).not.toBeInTheDocument();
});
it("discards a previous account's pending success on unmount",async()=>{
 let resolve!:(value:unknown)=>void;get.mockReturnValueOnce(new Promise(r=>{resolve=r;})).mockResolvedValue(page([site("B","GENERAL")]));const view=render(<SiteClassification open={()=>{}}/>);view.unmount();render(<SiteClassification open={()=>{}}/>);await screen.findByRole("img");await act(async()=>resolve(page([site("A")])));expect(screen.getByRole("img")).toHaveAccessibleName(/집중 0개.*일반 1개/);
});
it("rejects a cursor cycle without rendering the accumulated subset",async()=>{
 get.mockResolvedValueOnce(page([site("1")],"a",true)).mockResolvedValueOnce(page([site("2")],"b",true)).mockResolvedValue(page([site("3")],"a",true));render(<SiteClassification open={()=>{}}/>);await screen.findByRole("alert");expect(get).toHaveBeenCalledTimes(3);expect(screen.queryByRole("img")).not.toBeInTheDocument();
});
it("switches the same donut slot to unconnected time without another API",async()=>{
 get.mockResolvedValue(page([site("1"),site("2","GENERAL")]));const view=render(<SiteClassification open={()=>{}}/>);await screen.findByRole("img",{name:/등록 사이트 2개/});const beforeCalls=get.mock.calls.length;fireEvent.click(screen.getByRole("button",{name:"시간 · 사이트 이용시간 기준"}));expect(screen.getByRole("button",{name:"시간 · 사이트 이용시간 기준"})).toHaveAttribute("aria-pressed","true");expect(screen.getByRole("img")).toHaveAccessibleName("사이트 이용시간 비율 미확인");expect(view.container.querySelectorAll(".donut")).toHaveLength(1);expect(screen.getByRole("status")).toHaveTextContent(/아직 연결되지/);expect(get).toHaveBeenCalledTimes(beforeCalls);fireEvent.click(screen.getByRole("button",{name:"개수 · 사이트 수 기준"}));expect(screen.getByRole("img")).toHaveAccessibleName(/등록 사이트 2개/);expect(get).toHaveBeenCalledTimes(beforeCalls);
});
it("uses a typed ready-time fixture independently of registered site counts",async()=>{
 get.mockResolvedValue(page([site("1","FOCUS")]));render(<SiteClassification open={()=>{}} usageTime={{status:"ready",totals:{FOCUS:0,DISTRACTION:60000,GENERAL:0}}}/>);await screen.findByRole("img");fireEvent.click(screen.getByRole("button",{name:"시간 · 사이트 이용시간 기준"}));expect(screen.getByRole("img")).toHaveAccessibleName(/집중 0분, 방해 1분, 일반 0분/);expect(screen.getByText("100.0%")).toBeInTheDocument();
});
