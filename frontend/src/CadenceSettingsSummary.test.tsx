import {render,screen,fireEvent,cleanup} from "@testing-library/react";
import {afterEach,it,expect,vi} from "vitest";
import CadenceSettingsSummary from "./CadenceSettingsSummary";
import {listConfigs,type ConfigRecord} from "./additionalConfigApi";
vi.mock("./additionalConfigApi",()=>({listConfigs:vi.fn()}));
afterEach(()=>{cleanup();vi.mocked(listConfigs).mockReset();});
it("shows saved cycles separately from actual execution and opens existing settings",async()=>{
 const settings=vi.fn(),executor=crypto.randomUUID();const row:ConfigRecord={executor_id:executor,config_id:crypto.randomUUID(),version:2,deleted_at:null,saved_state:"SAVED",runtime_apply_state:"PENDING",saved_runtime_revision:2,applied_runtime_revision:null,next_focus_revision:2,updated_at:"2026-10-30T00:00:00.000Z",value:{kind:"CADENCE",enabled:true,focus_minutes:25,rest_minutes:5,cycles:3,auto_start_next:false,rest_clock:"ELAPSED_WALL_CLOCK",missed_focus:"WAIT_USER",deadline_at:null}};vi.mocked(listConfigs).mockResolvedValue([row]);
 render(<CadenceSettingsSummary executor={executor} settings={settings} managed={false}/>);await screen.findByText(/집중 25분 · 휴식 5분 · 3주기/);expect(screen.getByText(/저장된 반복 종료 기한\(UTC\): 없음/)).toBeInTheDocument();expect(screen.getByText(/Core CADENCE 연결 대기/)).toBeInTheDocument();fireEvent.click(screen.getByRole("button",{name:"반복 설정 확인·수정"}));expect(settings).toHaveBeenCalledOnce();expect(screen.queryByText(/실제 적용 확인/)).not.toBeInTheDocument();
});
it("keeps frozen execution distinct when its current setting was deleted",async()=>{vi.mocked(listConfigs).mockResolvedValue([]);render(<CadenceSettingsSummary executor={crypto.randomUUID()} settings={()=>{}} managed/>);await screen.findByText("저장된 반복 설정이 없습니다.");expect(screen.getByText(/최초 값으로 고정/)).toBeInTheDocument();});
