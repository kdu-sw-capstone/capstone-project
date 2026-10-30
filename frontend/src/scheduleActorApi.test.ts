import {beforeEach,expect,it,vi} from "vitest";
import {request} from "./api";
import {scheduleOccurrences,scheduleHistoryIds,occurrenceLabel,type Occurrence} from "./scheduleActorApi";
vi.mock("./api",async original=>({...await original<typeof import("./api")>(),request:vi.fn()}));
const id="00000000-0000-4000-8000-000000000001";
export const row:Occurrence={occurrence_id:id,schedule_id:id,schedule_version:1,scheduled_start_at:"2026-10-29T09:00:00.000Z",scheduled_end_at:"2026-10-29T09:10:00.000Z",status:"STARTING",reason:null,session_id:id};
beforeEach(()=>vi.mocked(request).mockReset());
it("uses only the existing occurrence GET and validates schedule identity",async()=>{vi.mocked(request).mockResolvedValue({items:[row],has_more:false,next_cursor:null});expect(await scheduleOccurrences(id)).toEqual([row]);expect(request).toHaveBeenCalledWith(`/schedules/${id}/occurrences`,"GET",undefined,{signal:undefined});});
it("allows read-only history lookup including tombstones but rejects a foreign executor",async()=>{vi.mocked(request).mockResolvedValueOnce({items:[{schedule_id:id,executor_id:id,deleted_at:"2026-10-29T09:00:00Z"}],has_more:false,next_cursor:null}).mockResolvedValueOnce({items:[{schedule_id:id,executor_id:"foreign"}],has_more:false,next_cursor:null});expect(await scheduleHistoryIds(id)).toEqual([id]);await expect(scheduleHistoryIds(id)).rejects.toThrow();});
it("rejects foreign schedule, unknown status, duplicate and incomplete pages",async()=>{
 for(const page of [{items:[{...row,schedule_id:"other"}],has_more:false,next_cursor:null},{items:[{...row,status:"APPLIED"}],has_more:false,next_cursor:null},{items:[row,row],has_more:false,next_cursor:null},{items:[row],has_more:true,next_cursor:"next"}]){vi.mocked(request).mockResolvedValue(page);await expect(scheduleOccurrences(id)).rejects.toThrow();}
});
it("request, transport, failure and unknown cannot establish actual apply",()=>{expect(occurrenceLabel(row)).toContain("미확인");expect(occurrenceLabel({...row,status:"RUNNING",reason:"EXECUTION_UNKNOWN"})).toContain("UNKNOWN");expect(occurrenceLabel({...row,status:"RUNNING",reason:"EXECUTION_FAILED"})).toContain("실패");expect(occurrenceLabel({...row,status:"FINISHED",reason:"EVIDENCE_UNCONFIRMED"})).toContain("미확인");});
it("distinguishes verified running, release and conflict from definition storage",()=>{expect(occurrenceLabel({...row,status:"RUNNING"})).toContain("실제 적용 확인");expect(occurrenceLabel({...row,status:"FINISHED"})).toContain("해제·복원 확인");expect(occurrenceLabel({...row,status:"WAITING_CONFLICT"})).toContain("고정 종료");expect(occurrenceLabel({...row,status:"SKIPPED",reason:"EXPIRED"})).toContain("60초");});
