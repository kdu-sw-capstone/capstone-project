import {act,cleanup,fireEvent,render,screen,waitFor} from "@testing-library/react";
import {afterEach,describe,expect,it,vi} from "vitest";
import DailyFocusGoal,{goalMinutes,type Goal} from "./DailyFocusGoal";
import AnalysisConsent from "./AnalysisConsent";
import {ApiError,request} from "./api";
vi.mock("./api",async()=>{const actual=await vi.importActual<typeof import("./api")>("./api");return {...actual,request:vi.fn()};});
const get=vi.mocked(request);
const row=(over:Partial<Goal>={}):Goal=>({goal_minutes:180,timezone:"Asia/Seoul",version:1,goal_effective_date:"2026-11-11",updated_at:null,confirmed_ms:7500000,last_confirmed_at:"2026-11-11T03:00:00Z",date:"2026-11-11",time_status:"CONFIRMED_LOWER_BOUND",...over});
afterEach(()=>{cleanup();get.mockReset();vi.useRealTimers();});
describe("daily goal actual confirmed projection",()=>{
 it("validates the approved minutes without borrowing the session duration cap",()=>{
  expect(goalMinutes("0","1")).toBe(1);expect(goalMinutes("24","0")).toBe(1440);
  for(const [h,m] of [["0","0"],["24","1"],["1","60"],["1.5","0"],["","1"]])expect(()=>goalMinutes(h,m)).toThrow();
 });
 it("shows confirmed progress and never extrapolates the timer",async()=>{
  get.mockResolvedValue(row());render(<DailyFocusGoal owner="A"/>);await screen.findByText("2시간 5분");
  const progress=screen.getByRole("progressbar");expect(progress).toHaveAttribute("value","7500000");
  fireEvent.click(screen.getByRole("button",{name:"목표 상태 재조회"}));await waitFor(()=>expect(get).toHaveBeenCalledTimes(2));
  expect(progress).toHaveAttribute("value","7500000");
 });
 it("refreshes only from a new confirmed result and preserves UNKNOWN prefix",async()=>{
  get.mockResolvedValueOnce(row()).mockResolvedValue(row({confirmed_ms:7560000,has_unconfirmed_session:true}));render(<DailyFocusGoal owner="A"/>);await screen.findByText("2시간 5분");
  fireEvent.click(screen.getByRole("button",{name:"목표 상태 재조회"}));await screen.findByText("2시간 6분");expect(screen.getByRole("progressbar")).toHaveAttribute("value","7560000");expect(screen.getByText(/미확인 세션 구간은 합계에서 제외/)).toBeInTheDocument();
 });
 it("keeps unset zone/time unknown rather than a fake zero or target",async()=>{
  get.mockResolvedValue(row({goal_minutes:null,timezone:null,confirmed_ms:null,last_confirmed_at:null,date:null,time_status:"TIMEZONE_NOT_SET"}));render(<DailyFocusGoal owner="A"/>);
  await screen.findByText("집중량 확인 필요");expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();expect(screen.getByText(/자동으로 KST를 적용하지/)).toBeInTheDocument();
 });
 it("saves minutes, selected zone and optimistic version without any session operation",async()=>{
  get.mockImplementation(async(_path,method,body)=>method==="PUT"?row({...body as Partial<Goal>,version:2}):row());render(<DailyFocusGoal owner="A" editor/>);fireEvent.click(await screen.findByRole("button",{name:"목표 수정"}));
  fireEvent.change(screen.getByLabelText("목표 시간"),{target:{value:"1"}});fireEvent.change(screen.getByLabelText("목표 분"),{target:{value:"5"}});
  fireEvent.change(screen.getByLabelText("계정 시간대"),{target:{value:"UTC"}});fireEvent.click(screen.getByRole("button",{name:"목표 저장"}));
  await waitFor(()=>expect(get).toHaveBeenCalledWith("/daily-focus-goal","PUT",{goal_minutes:65,timezone:"UTC"},expect.objectContaining({version:1,key:expect.any(String)})));
  expect(get.mock.calls.some(c=>c[0].includes("/sessions"))).toBe(false);
 });
 it("preserves the editor on 412 and on explicit reload",async()=>{
  get.mockImplementation(async(path,method)=>{if(method==="PUT")throw new ApiError("VERSION_CONFLICT",412);return row({version:2});});render(<DailyFocusGoal owner="A" editor/>);
  fireEvent.click(await screen.findByRole("button",{name:"목표 수정"}));fireEvent.change(screen.getByLabelText("목표 분"),{target:{value:"7"}});fireEvent.click(screen.getByRole("button",{name:"목표 저장"}));
  await screen.findByText(/다른 화면에서 목표를 변경/);fireEvent.click(screen.getByRole("button",{name:"목표 상태 재조회"}));await waitFor(()=>expect(get).toHaveBeenCalledTimes(4));expect(screen.getByLabelText("목표 분")).toHaveValue(7);
  get.mockImplementation(async(_path,method,body)=>method==="PUT"?row({...body as Partial<Goal>,version:3}):row({version:2}));fireEvent.click(screen.getByRole("button",{name:"목표 저장"}));await waitFor(()=>expect(get).toHaveBeenLastCalledWith("/daily-focus-goal/today","GET",undefined,expect.anything()));expect(get.mock.calls.filter(c=>c[1]==="PUT").at(-1)?.[3]?.version).toBe(2);
 });
 it("reuses the exact write key/version/payload when its response is lost",async()=>{
  let writes=0;get.mockImplementation(async(path,method)=>{if(method==="PUT"&&++writes===1)throw Error("lost");return row({version:method==="PUT"?2:1});});render(<DailyFocusGoal owner="A" editor/>);fireEvent.click(await screen.findByRole("button",{name:"목표 수정"}));
  fireEvent.click(screen.getByRole("button",{name:"목표 저장"}));await screen.findByRole("button",{name:"같은 저장 요청 재확인"});await waitFor(()=>expect(screen.getByRole("button",{name:"같은 저장 요청 재확인"})).toBeEnabled());
  fireEvent.click(screen.getByRole("button",{name:"같은 저장 요청 재확인"}));await waitFor(()=>expect(get.mock.calls.filter(c=>c[1]==="PUT")).toHaveLength(2));const calls=get.mock.calls.filter(c=>c[1]==="PUT");expect(calls[0]).toEqual(calls[1]);
 });
 it("discards a previous account's late 401",async()=>{
  let reject!:(e:unknown)=>void;get.mockReturnValueOnce(new Promise((_,r)=>{reject=r;})).mockResolvedValue(row());const expire=vi.fn();window.addEventListener("focurve:authentication-expired",expire);
  const view=render(<DailyFocusGoal owner="A"/>);view.rerender(<DailyFocusGoal owner="B"/>);await screen.findByText("2시간 5분");await act(async()=>reject(new ApiError("UNAUTHENTICATED",401)));expect(expire).not.toHaveBeenCalled();window.removeEventListener("focurve:authentication-expired",expire);
 });
 it("does not accept an unbound malformed API result",async()=>{
  get.mockResolvedValue({});render(<DailyFocusGoal owner="A"/>);await screen.findByRole("alert");expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
 });
 it("keeps a mismatched write ACK unconfirmed instead of closing the editor",async()=>{
  get.mockResolvedValue(row());render(<DailyFocusGoal owner="A" editor/>);fireEvent.click(await screen.findByRole("button",{name:"목표 수정"}));fireEvent.click(screen.getByRole("button",{name:"목표 저장"}));
  await screen.findByRole("button",{name:"같은 저장 요청 재확인"});expect(screen.getByLabelText("목표 시간")).toBeInTheDocument();expect(screen.getByRole("alert")).toHaveTextContent("저장 결과를 확인하지 못했습니다");
 });
 it("does not silently rebase an open draft when a background refresh sees another writer",async()=>{
  let reads=0;get.mockImplementation(async(_path,method,body,options)=>method==="PUT"?row({...body as Partial<Goal>,version:(options?.version??0)+1}):row({version:++reads===1?1:2}));
  vi.useFakeTimers({toFake:["setInterval","clearInterval"]});render(<DailyFocusGoal owner="A" editor/>);fireEvent.click(await screen.findByRole("button",{name:"목표 수정"}));
  fireEvent.change(screen.getByLabelText("목표 시간"),{target:{value:"1"}});await act(async()=>vi.advanceTimersByTimeAsync(5000));fireEvent.click(screen.getByRole("button",{name:"목표 저장"}));
  await waitFor(()=>expect(get).toHaveBeenCalledWith("/daily-focus-goal","PUT",expect.anything(),expect.objectContaining({version:1})));
 });
 it("a saved goal refreshes without waiting for a retired pre-write read",async()=>{
  let finish!:(value:Goal)=>void,reads=0;const old=new Promise<Goal>(resolve=>{finish=resolve;});
  get.mockImplementation(async(_path,method,body)=>method==="PUT"?row({...body as Partial<Goal>,version:2}):++reads===2?old:row({goal_minutes:reads===1?180:65,version:reads===1?1:2}));
  render(<DailyFocusGoal owner="A" editor/>);fireEvent.click(await screen.findByRole("button",{name:"목표 수정"}));
  fireEvent.change(screen.getByLabelText("목표 시간"),{target:{value:"1"}});fireEvent.change(screen.getByLabelText("목표 분"),{target:{value:"5"}});
  fireEvent.click(screen.getByRole("button",{name:"목표 상태 재조회"}));await waitFor(()=>expect(reads).toBe(2));
  const retiredSignal=get.mock.calls.filter(c=>c[1]==="GET")[1][3]?.signal;
  fireEvent.click(screen.getByRole("button",{name:"목표 저장"}));
  await screen.findByText(/현재 목표 1시간 5분/);expect(reads).toBe(3);expect(retiredSignal?.aborted).toBe(true);
  await act(async()=>finish(row()));expect(screen.getByText(/현재 목표 1시간 5분/)).toBeInTheDocument();
 });
 it("a retired read cannot unlock its successor or expire authentication after save",async()=>{
  let rejectOld!:(e:unknown)=>void,finishNew!:(value:Goal)=>void,reads=0;
  const old=new Promise<Goal>((_,reject)=>{rejectOld=reject;}),fresh=new Promise<Goal>(resolve=>{finishNew=resolve;});
  get.mockImplementation(async(_path,method,body)=>method==="PUT"?row({...body as Partial<Goal>,version:2}):++reads===1?row():reads===2?old:fresh);
  const expired=vi.fn();window.addEventListener("focurve:authentication-expired",expired);
  try{render(<DailyFocusGoal owner="A" editor/>);const edit=await screen.findByRole("button",{name:"목표 수정"});
   await waitFor(()=>expect(edit).toBeEnabled());fireEvent.click(edit);await screen.findByRole("button",{name:"목표 저장"});
   fireEvent.click(screen.getByRole("button",{name:"목표 상태 재조회"}));await waitFor(()=>expect(reads).toBe(2));fireEvent.click(screen.getByRole("button",{name:"목표 저장"}));
   await waitFor(()=>expect(reads).toBe(3));await act(async()=>rejectOld(new ApiError("UNAUTHENTICATED",401)));
   fireEvent.click(screen.getByRole("button",{name:"목표 상태 재조회"}));expect(reads).toBe(3);expect(expired).not.toHaveBeenCalled();
   await act(async()=>finishNew(row({version:2})));expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  }finally{window.removeEventListener("focurve:authentication-expired",expired);}
 });
 it("the fresh post-write read still expires authentication on a current 401",async()=>{
  let reads=0;get.mockImplementation(async(_path,method,body)=>{if(method==="PUT")return row({...body as Partial<Goal>,version:2});if(++reads===1)return row();throw new ApiError("UNAUTHENTICATED",401);});
  const expired=vi.fn();window.addEventListener("focurve:authentication-expired",expired);
  try{render(<DailyFocusGoal owner="A" editor/>);fireEvent.click(await screen.findByRole("button",{name:"목표 수정"}));fireEvent.click(screen.getByRole("button",{name:"목표 저장"}));
   await waitFor(()=>expect(expired).toHaveBeenCalledTimes(1));expect(screen.getByRole("alert")).toBeInTheDocument();
  }finally{window.removeEventListener("focurve:authentication-expired",expired);}
 });
 it("another goal view refreshes from the save event while its old read is pending",async()=>{
  let rejectOld!:(e:unknown)=>void,reads=0;const old=new Promise<Goal>((_,reject)=>{rejectOld=reject;});
  get.mockImplementation(async()=>++reads===1?row():reads===2?old:row({goal_minutes:65,version:2,confirmed_ms:7560000}));
  const expired=vi.fn();window.addEventListener("focurve:authentication-expired",expired);
  try{render(<DailyFocusGoal owner="A"/>);await screen.findByText("2시간 5분");
   fireEvent.click(screen.getByRole("button",{name:"목표 상태 재조회"}));await waitFor(()=>expect(reads).toBe(2));
   act(()=>window.dispatchEvent(new Event("focurve:goal-changed")));await screen.findByText("2시간 6분");expect(screen.getByText(/목표 1시간 5분/)).toBeInTheDocument();
   await act(async()=>rejectOld(new ApiError("UNAUTHENTICATED",401)));expect(expired).not.toHaveBeenCalled();
  }finally{window.removeEventListener("focurve:authentication-expired",expired);}
 });
});
describe("AI consent is safe without an approved notice/provider",()=>{
 it("reads the actual refusal and never sends accepted=true or an analysis job",async()=>{
  get.mockResolvedValue({accepted:false,notice_version:null,version:0,provider_configured:false});render(<AnalysisConsent owner="A"/>);await screen.findByText("동의 안 함");expect(screen.queryByRole("button")).not.toBeInTheDocument();expect(get.mock.calls).toHaveLength(1);
 });
 it("withdraws a stored consent using its resource revision and original notice",async()=>{
  get.mockResolvedValueOnce({accepted:true,notice_version:"old",version:3,provider_configured:false}).mockResolvedValue({accepted:false,notice_version:"old",version:4,provider_configured:false});render(<AnalysisConsent owner="A"/>);
  fireEvent.click(await screen.findByRole("button",{name:"AI 동의 철회"}));await screen.findByText("동의 안 함");expect(get).toHaveBeenLastCalledWith("/analysis-consent","PUT",{accepted:false,notice_version:"old"},expect.objectContaining({version:3}));
 });
 it("does not turn a malformed consent response into a confirmed refusal",async()=>{
  get.mockResolvedValue({});render(<AnalysisConsent owner="A"/>);await screen.findByRole("alert");expect(screen.queryByText("동의 안 함")).not.toBeInTheDocument();
 });
});
