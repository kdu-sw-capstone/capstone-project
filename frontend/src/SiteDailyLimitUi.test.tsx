import {cleanup,fireEvent,render,screen,waitFor} from "@testing-library/react";
import {afterEach,beforeEach,expect,it,vi} from "vitest";
import AdditionalSettings from "./AdditionalSettings";
import {request} from "./api";
import type {ConfigRecord,ConfigValue} from "./additionalConfigApi";
vi.mock("./api",async original=>({...await original<typeof import("./api")>(),request:vi.fn()}));
const executor="00000000-0000-4000-8000-000000000001",id="00000000-0000-4000-8000-000000000002";
const windows=[{window_id:"00000000-0000-4000-8000-000000000003",kind:"BLOCK_WINDOW",enabled:true,when:{recurrence:"WEEKLY",weekdays:[1],start_local:"09:00",end_local:"10:00",end_day_offset:0,timezone:"Asia/Seoul",dst_gap:"SKIP",dst_overlap:"EARLIER_ONCE"}}];
let row:ConfigRecord,fail:boolean;
beforeEach(()=>{
 fail=false;row={config_id:id,executor_id:executor,version:1,value:{kind:"SITE_TIME",policy_id:id,version:1,site_id:null,enabled:true,scope:{host:"example.org",include_subdomains:false},daily_limit_ms:1800000,tracking_scope:"BROWSER_ALWAYS",windows:structuredClone(windows)},saved_state:"SAVED",runtime_apply_state:"PENDING",saved_runtime_revision:1,applied_runtime_revision:null,next_focus_revision:1,deleted_at:null,updated_at:"2026-11-03T00:00:00.000Z"};
 vi.mocked(request).mockReset().mockImplementation(async(path,method,body)=>{
  if(path.startsWith("/amvp/configs?"))return {items:[row],has_more:false,next_cursor:null};
  if(path===`/amvp/configs/${id}`){if(method==="PUT"){if(fail)throw Error("offline");const value=structuredClone((body as {value:ConfigValue}).value);row={...row,version:row.version+1,value,saved_runtime_revision:row.version+1};}return structuredClone(row);}
  if(path.includes("site-time-deletions"))return {read_model:"AMVP_SITE_TIME_DELETIONS_1",items:[],has_more:false,next_cursor:null};
  throw Error("Unavailable isolated observation");
 });
});
afterEach(cleanup);
async function edit(){render(<AdditionalSettings installations={[{executor_id:executor,client_version:"isolated"}]}/>);fireEvent.change(screen.getByLabelText("설치 선택"),{target:{value:executor}});fireEvent.click(await screen.findByRole("button",{name:"수정"}));}
it("shows a daily limit without a time-window editor or activation toggle, preserving the old source",async()=>{
 await edit();expect(screen.queryByRole("switch",{name:"이 설정 사용"})).not.toBeInTheDocument();expect(screen.queryByRole("button",{name:"시간창 추가"})).not.toBeInTheDocument();expect(screen.getByText(/이전 시간창 1개는 원본대로 보존/)).toBeInTheDocument();expect(screen.getByText(/초기화 기준: 설치에 적용된 시간대의 하루 경계/)).toBeInTheDocument();expect(screen.getByLabelText("하루 한도(분) · 비우면 무제한")).toHaveValue(30);
 expect(vi.mocked(request).mock.calls.every(call=>call[1]!=="PUT"&&call[1]!=="DELETE")).toBe(true);
});
it.each([true,false])("saves unlimited and rereads it without changing enabled=%s or old windows",async enabled=>{
 row.value.enabled=enabled;await edit();fireEvent.change(screen.getByLabelText("하루 한도(분) · 비우면 무제한"),{target:{value:""}});fireEvent.click(screen.getByRole("button",{name:"설정 저장"}));await screen.findByText("설정을 저장하고 다시 조회했습니다. 브라우저 적용 상태는 별도 확인이 필요합니다.");
 const put=vi.mocked(request).mock.calls.find(call=>call[1]==="PUT")!;expect((put[2] as {value:ConfigValue}).value).toMatchObject({daily_limit_ms:null,enabled,windows});expect(screen.getByText(/제한 없음은 다른 제한의 해제 완료를 뜻하지 않습니다/)).toBeInTheDocument();
 cleanup();await edit();expect(screen.getByLabelText("하루 한도(분) · 비우면 무제한")).toHaveValue(null);expect(row.value.windows).toEqual(windows);expect(row.value.enabled).toBe(enabled);
});
it("keeps the edited limit after a failed save and sends no cleanup or actor command",async()=>{
 await edit();fail=true;fireEvent.change(screen.getByLabelText("하루 한도(분) · 비우면 무제한"),{target:{value:"45"}});fireEvent.click(screen.getByRole("button",{name:"설정 저장"}));await waitFor(()=>expect(screen.getByRole("button",{name:"같은 저장 요청 결과 다시 확인"})).toBeEnabled());expect(screen.getByLabelText("하루 한도(분) · 비우면 무제한")).toHaveValue(45);expect(screen.getAllByText("통신 실패 — 입력을 보존했습니다. 같은 요청으로 다시 확인하세요.").length).toBeGreaterThan(0);expect(row.value.daily_limit_ms).toBe(1800000);expect(row.value.windows).toEqual(windows);expect(vi.mocked(request).mock.calls.every(call=>call[1]!=="DELETE"&&!call[0].includes("/commands"))).toBe(true);
});
