import {act,fireEvent,render,screen,waitFor} from "@testing-library/react";
import {beforeEach,expect,it,vi} from "vitest";
import ScheduleExecutionPanel from "./ScheduleExecutionPanel";
import {scheduleOccurrences,scheduleHistoryIds,type Occurrence} from "./scheduleActorApi";
import type {ConfigRecord} from "./additionalConfigApi";
import {ApiError} from "./api";
vi.mock("./scheduleActorApi",async original=>({...await original<typeof import("./scheduleActorApi")>(),scheduleOccurrences:vi.fn(),scheduleHistoryIds:vi.fn()}));
const executor="00000000-0000-4000-8000-000000000001",id="00000000-0000-4000-8000-000000000002";
const config:ConfigRecord={config_id:id,executor_id:executor,version:1,value:{kind:"FOCUS_SCHEDULE",when:{recurrence:"WEEKLY"}},saved_state:"SAVED",runtime_apply_state:"PENDING",saved_runtime_revision:1,applied_runtime_revision:null,next_focus_revision:1,deleted_at:null,updated_at:"2026-10-29T00:00:00.000Z"};
const occurrence:Occurrence={occurrence_id:id,schedule_id:id,schedule_version:1,scheduled_start_at:"2026-10-29T09:00:00.000Z",scheduled_end_at:"2026-10-29T09:10:00.000Z",status:"RUNNING",reason:null,session_id:id};
beforeEach(()=>{vi.mocked(scheduleOccurrences).mockReset();vi.mocked(scheduleHistoryIds).mockReset().mockResolvedValue([id]);});
it("preserves confirmed current schedule history when discovery of older schedules fails",async()=>{
 vi.mocked(scheduleHistoryIds).mockRejectedValue(new Error("history offline"));vi.mocked(scheduleOccurrences).mockResolvedValue([occurrence]);
 render(<ScheduleExecutionPanel executor={executor} records={[config]}/>);await screen.findByText(/예약 실행 · 실제 적용 확인/);expect(screen.getByRole("alert")).toHaveTextContent("이전 예약 목록을 확인하지 못했습니다");
});
it("preserves confirmed occurrences when a different schedule query fails",async()=>{
 vi.mocked(scheduleHistoryIds).mockResolvedValue([id,executor]);vi.mocked(scheduleOccurrences).mockImplementation(async schedule=>{if(schedule===executor)throw Error("one schedule offline");return [occurrence];});
 render(<ScheduleExecutionPanel executor={executor} records={[config]}/>);await screen.findByText(/예약 실행 · 실제 적용 확인/);expect(screen.getByRole("alert")).toHaveTextContent("일부 예약 실행 기록을 확인하지 못했습니다");
});
it("expires a current occurrence 401 before a pending sibling and never publishes its late success",async()=>{
 let reject!:(error:unknown)=>void,finish!:(rows:Occurrence[])=>void;
 vi.mocked(scheduleHistoryIds).mockResolvedValue([id,executor]);vi.mocked(scheduleOccurrences).mockImplementation(schedule=>schedule===id?new Promise((_,r)=>{reject=r;}):new Promise(resolve=>{finish=resolve;}));
 const expired=vi.fn();window.addEventListener("focurve:authentication-expired",expired);
 try{render(<ScheduleExecutionPanel executor={executor} records={[config]}/>);await waitFor(()=>expect(scheduleOccurrences).toHaveBeenCalledTimes(2));
  await act(async()=>reject(new ApiError("UNAUTHENTICATED",401)));expect(expired).toHaveBeenCalledTimes(1);expect(screen.getByRole("button",{name:"예약 실행 기록 다시 조회"})).toBeEnabled();
  await act(async()=>finish([{...occurrence,schedule_id:executor}]));expect(screen.queryByText(/예약 실행 · 실제 적용 확인/)).not.toBeInTheDocument();expect(expired).toHaveBeenCalledTimes(1);
 }finally{window.removeEventListener("focurve:authentication-expired",expired);}
});
it("does not start occurrence reads after retired history discovery resolves",async()=>{
 let finish!:(ids:string[])=>void;vi.mocked(scheduleHistoryIds).mockImplementation(()=>new Promise(resolve=>{finish=resolve;}));vi.mocked(scheduleOccurrences).mockResolvedValue([]);
 const view=render(<ScheduleExecutionPanel executor={executor} records={[config]}/>);view.unmount();await act(async()=>finish([id]));expect(scheduleOccurrences).not.toHaveBeenCalled();
});
it.each([false,true])("propagates only a current discovery 401 (retired=%s)",async retired=>{
 let reject!:(error:unknown)=>void;vi.mocked(scheduleHistoryIds).mockImplementation(()=>new Promise((_,r)=>{reject=r;}));const expired=vi.fn();window.addEventListener("focurve:authentication-expired",expired);
 try{const view=render(<ScheduleExecutionPanel executor={executor} records={[config]}/>);if(retired)view.unmount();await act(async()=>reject(new ApiError("UNAUTHENTICATED",401)));expect(expired).toHaveBeenCalledTimes(retired?0:1);expect(scheduleOccurrences).not.toHaveBeenCalled();}finally{window.removeEventListener("focurve:authentication-expired",expired);}
});
it("does not query another installation's schedule from current config props",async()=>{vi.mocked(scheduleHistoryIds).mockResolvedValue([]);render(<ScheduleExecutionPanel executor={id} records={[config]}/>);await screen.findByText(/확인된 예약 실행 기록이 없습니다/);expect(scheduleHistoryIds).toHaveBeenCalledWith(id,expect.any(AbortSignal));expect(scheduleOccurrences).not.toHaveBeenCalled();});
it("storage alone stays waiting and explicit refresh is read-only",async()=>{vi.mocked(scheduleOccurrences).mockResolvedValueOnce([]).mockResolvedValueOnce([occurrence]);render(<ScheduleExecutionPanel executor={executor} records={[config]}/>);expect(await screen.findByText(/설정 저장됨 · 예약 actor/)).toBeInTheDocument();fireEvent.click(screen.getByText("예약 실행 기록 다시 조회"));expect(await screen.findByText(/실제 적용 확인/)).toBeInTheDocument();});
it("errors and unknown remain visible without an applied claim",async()=>{vi.mocked(scheduleOccurrences).mockResolvedValue([{...occurrence,reason:"EXECUTION_UNKNOWN"}]);render(<ScheduleExecutionPanel executor={executor} records={[config]}/>);expect(await screen.findByText(/UNKNOWN/)).toBeInTheDocument();expect(screen.queryByText(/실제 적용 확인/)).not.toBeInTheDocument();});
it("discards old version responses and identifies frozen historical versions",async()=>{let resolve!:(rows:Occurrence[])=>void;vi.mocked(scheduleOccurrences).mockImplementationOnce(()=>new Promise(r=>{resolve=r;})).mockResolvedValueOnce([occurrence]);const view=render(<ScheduleExecutionPanel executor={executor} records={[config]}/>);await waitFor(()=>expect(resolve).toBeTypeOf("function"));view.rerender(<ScheduleExecutionPanel executor={executor} records={[{...config,version:2}]}/>);expect(await screen.findByText("이전 설정 버전의 실행 기록입니다.")).toBeInTheDocument();await act(async()=>resolve([{...occurrence,reason:"EXECUTION_FAILED"}]));expect(screen.queryByText(/실행 실패/)).not.toBeInTheDocument();});
it("query failure can be retried without executing the actor",async()=>{vi.mocked(scheduleOccurrences).mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce([]);render(<ScheduleExecutionPanel executor={executor} records={[config]}/>);expect(await screen.findByRole("alert")).toHaveTextContent("실제 실행 성공을 뜻하지 않습니다");fireEvent.click(screen.getByText("예약 실행 기록 다시 조회"));expect(await screen.findByText(/설정 저장됨/)).toBeInTheDocument();});
it("rediscovers a deleted schedule and its still-running session on fresh reentry",async()=>{vi.mocked(scheduleOccurrences).mockResolvedValue([occurrence]);const first=render(<ScheduleExecutionPanel executor={executor} records={[]}/>);expect(await screen.findByText(/실제 적용 확인/)).toBeInTheDocument();expect(screen.getByText("이전 설정 버전의 실행 기록입니다.")).toBeInTheDocument();first.unmount();render(<ScheduleExecutionPanel executor={executor} records={[]}/>);await screen.findByText(/실제 적용 확인/);expect(scheduleHistoryIds).toHaveBeenCalledTimes(2);});
it("a failed history discovery cannot reuse old successful occurrences or report empty",async()=>{vi.mocked(scheduleHistoryIds).mockResolvedValueOnce([id]).mockRejectedValueOnce(new Error("offline"));vi.mocked(scheduleOccurrences).mockResolvedValue([occurrence]);render(<ScheduleExecutionPanel executor={executor} records={[]}/>);await screen.findByText(/실제 적용 확인/);fireEvent.click(screen.getByText("예약 실행 기록 다시 조회"));await screen.findByRole("alert");expect(screen.queryByText(/실제 적용 확인/)).not.toBeInTheDocument();expect(screen.queryByText(/확인된 예약 실행 기록이 없습니다/)).not.toBeInTheDocument();});
