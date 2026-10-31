import {render,screen,fireEvent,waitFor,within} from "@testing-library/react";
import {beforeEach,expect,it,vi} from "vitest";
import AdditionalSettings from "./AdditionalSettings";
import {request} from "./api";
vi.mock("./api",()=>({request:vi.fn(),message:(e:Error)=>e.message,UiError:class extends Error{},ApiError:class extends Error{status=503}}));
const executor="00000000-0000-4000-8000-000000000001",installations=[{executor_id:executor,client_version:"test"}];
beforeEach(()=>{vi.mocked(request).mockReset();});
it("stores and clears the existing CADENCE deadline as UTC without issuing actor commands",async()=>{
 vi.mocked(request).mockResolvedValue({items:[],next_cursor:null,has_more:false});render(<AdditionalSettings installations={installations}/>);fireEvent.change(screen.getByLabelText("설치 선택"),{target:{value:executor}});fireEvent.click(await screen.findByText("반복 집중·휴식 추가"));
 let saved:unknown;vi.mocked(request).mockImplementation(async(path,method,body)=>{
  if(method==="PUT"){saved=(body as {value:unknown}).value;}
  return {config_id:path.split("/").at(-1),executor_id:executor,version:1,value:saved,saved_state:"SAVED",runtime_apply_state:"PENDING",saved_runtime_revision:1,applied_runtime_revision:null,next_focus_revision:1,deleted_at:null,updated_at:"2026-10-31T00:00:00.000Z"};
 });
 fireEvent.change(screen.getByLabelText("반복 종료 기한(UTC) · 비우면 없음"),{target:{value:"2026-11-11T09:00:00.123"}});fireEvent.click(screen.getByText("설정 저장"));await screen.findByText("설정을 저장하고 다시 조회했습니다. 브라우저 적용 상태는 별도 확인이 필요합니다.");
 expect(saved).toMatchObject({deadline_at:"2026-11-11T09:00:00.123Z"});fireEvent.change(screen.getByLabelText("반복 종료 기한(UTC) · 비우면 없음"),{target:{value:""}});fireEvent.click(screen.getByText("설정 저장"));await waitFor(()=>expect(saved).toMatchObject({deadline_at:null}));expect(vi.mocked(request).mock.calls.every(c=>!c[0].includes('/focus/'))).toBe(true);
});
it("keeps deletion visible as pending after removing the editable config",async()=>{
 const operationId=crypto.randomUUID(),id="00000000-0000-4000-8000-000000000009",record={config_id:id,executor_id:executor,version:1,value:{kind:"SITE_TIME",enabled:true},saved_state:"SAVED",runtime_apply_state:"PENDING",saved_runtime_revision:1,applied_runtime_revision:null,next_focus_revision:1,deleted_at:null,updated_at:"2026-10-30T00:00:00.000Z"};
 vi.mocked(request).mockImplementation(async(path,method)=>{if(path.startsWith('/amvp/web/site-time-deletions?'))return {read_model:'AMVP_SITE_TIME_DELETIONS_1',items:[],next_cursor:null,has_more:false};if(path===`/amvp/operations/${operationId}`)return {operation_id:operationId,state:"RELEASE_PENDING",actual_effect_confirmed:false,error_code:null};if(method==="DELETE")return {operation_id:operationId,state:"RELEASE_PENDING",actual_effect_confirmed:false,error_code:null};if(path===`/amvp/configs/${id}`)return {...record,version:2,deleted_at:"2026-10-30T00:00:01.000Z",saved_runtime_revision:2,next_focus_revision:2};return {items:[record],next_cursor:null,has_more:false};});
 render(<AdditionalSettings installations={installations}/>);fireEvent.change(screen.getByLabelText("설치 선택"),{target:{value:executor}});fireEvent.click(await screen.findByRole("button",{name:"삭제"}));fireEvent.click(within(screen.getByRole("group",{name:"설정 삭제 확인"})).getByRole("button",{name:"삭제 요청 확인"}));await screen.findByText(/삭제 버전 2 · 설정 삭제됨 · 실제 해제 확인 대기/);expect(screen.queryByRole("button",{name:"삭제"})).not.toBeInTheDocument();expect(vi.mocked(request).mock.calls.filter(c=>c[1]==="DELETE")).toHaveLength(1);
});
it("does not auto-select an installation or query guest data",()=>{
 render(<AdditionalSettings installations={installations}/>);expect(request).not.toHaveBeenCalled();expect(screen.getByLabelText("설치 선택")).toHaveValue("");
});
it("blocks editing after capability failure and allows explicit read retry",async()=>{
 vi.mocked(request).mockRejectedValueOnce(new Error("CAPABILITY_NOT_VERIFIED")).mockResolvedValueOnce({items:[],next_cursor:null,has_more:false});render(<AdditionalSettings installations={installations}/>);
 fireEvent.change(screen.getByLabelText("설치 선택"),{target:{value:executor}});expect(await screen.findByRole("alert")).toHaveTextContent("CAPABILITY_NOT_VERIFIED");expect(screen.queryByText("반복 집중·휴식 추가")).not.toBeInTheDocument();
 fireEvent.click(screen.getByText("현재 저장 설정 다시 조회"));expect(await screen.findByText("반복 집중·휴식 추가")).toBeEnabled();
});
it("shows all sixteen existing content options and saves via a version-bound API",async()=>{
 vi.mocked(request).mockResolvedValue({items:[],next_cursor:null,has_more:false});render(<AdditionalSettings installations={installations}/>);fireEvent.change(screen.getByLabelText("설치 선택"),{target:{value:executor}});fireEvent.click(await screen.findByText("콘텐츠 제한 추가"));
 expect(screen.getAllByRole("switch")).toHaveLength(19);expect(screen.getByRole("switch",{name:"Shorts 숨기기"})).toHaveAttribute("aria-checked","false");fireEvent.click(screen.getByRole("switch",{name:"Shorts 숨기기"}));
 vi.mocked(request).mockImplementation(async(path,method,body)=>{
  if(method==="PUT")return {config_id:path.split("/").at(-1),executor_id:executor,version:1,value:(body as {value:unknown}).value,saved_state:"SAVED",runtime_apply_state:"PENDING",saved_runtime_revision:1,applied_runtime_revision:null,next_focus_revision:1,deleted_at:null,updated_at:"2026-10-29T00:00:00.000Z"};
  const put=vi.mocked(request).mock.calls.find(c=>c[1]==="PUT")!;return {config_id:path.split("/").at(-1),executor_id:executor,version:1,value:(put[2] as {value:unknown}).value,saved_state:"SAVED",runtime_apply_state:"PENDING",saved_runtime_revision:1,applied_runtime_revision:null,next_focus_revision:1,deleted_at:null,updated_at:"2026-10-29T00:00:00.000Z"};
 });fireEvent.click(screen.getByText("설정 저장"));await waitFor(()=>expect(screen.getByRole("status")).toHaveTextContent("설정을 저장하고 다시 조회했습니다"));
 expect(screen.getAllByText(/저장됨 · 다음 집중 적용 대기/).length).toBeGreaterThan(0);
});
