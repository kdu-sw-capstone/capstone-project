import {act,fireEvent,render,screen,waitFor} from "@testing-library/react";
import {beforeEach,expect,it,vi} from "vitest";
import RuntimeDeliveryPanel from "./RuntimeDeliveryPanel";
import {listConfigs,type ConfigRecord} from "./additionalConfigApi";
import {configDelivery,usageReceiptLabel} from "./runtimeDeliveryState";
vi.mock("./additionalConfigApi",()=>({listConfigs:vi.fn()}));
const executor="00000000-0000-4000-8000-000000000001";
const row:ConfigRecord={config_id:executor,executor_id:executor,version:1,value:{kind:"CONTENT"},deleted_at:null,saved_state:"SAVED",runtime_apply_state:"PENDING",saved_runtime_revision:2,applied_runtime_revision:null,next_focus_revision:2,updated_at:"2026-10-29T00:00:00.000Z"};
beforeEach(()=>vi.mocked(listConfigs).mockReset());
it("keeps storage pending, rejects older ACKs and accepts server-verified superseding packages",()=>{
 expect(configDelivery(row).state).toBe("PENDING");
 for(const revision of [null,1])expect(configDelivery({...row,runtime_apply_state:"APPLIED",applied_runtime_revision:revision}).state).toBe("UNKNOWN");
 expect(configDelivery({...row,runtime_apply_state:"APPLIED",applied_runtime_revision:3}).state).toBe("APPLIED");
 expect(configDelivery({...row,runtime_apply_state:"APPLIED",applied_runtime_revision:2}).state).toBe("APPLIED");
});
it("shows quarantine and dependency separately from measured usage",()=>{
 expect(usageReceiptLabel({status:"ACCEPTED",measurement_state:"QUARANTINED"})).toContain("시간 확인 대기");
 expect(usageReceiptLabel({status:"DUPLICATE",measurement_state:"COUNTED"})).toBe("수신됨 · 이용시간 측정 확인");
 expect(usageReceiptLabel({status:"PENDING_DEPENDENCY",measurement_state:"UNCONFIRMED"})).toBe("선행 기록 수신 대기");
 expect(usageReceiptLabel({status:"REJECTED",measurement_state:"UNCONFIRMED"})).toContain("원본 기록 보존");
});
it("reads actual config API state without synthesizing an ACK",async()=>{
 vi.mocked(listConfigs).mockResolvedValue([row]);render(<RuntimeDeliveryPanel executor={executor}/>);expect(await screen.findByText("저장됨 · 다음 집중 적용 대기")).toBeInTheDocument();expect(screen.queryByText("적용 확인됨")).not.toBeInTheDocument();expect(listConfigs).toHaveBeenCalledWith(executor,expect.any(AbortSignal));
});
it("discards a delayed previous installation response and allows an explicit read retry",async()=>{
 let previous!:(rows:ConfigRecord[])=>void;vi.mocked(listConfigs).mockImplementationOnce(()=>new Promise(resolve=>{previous=resolve;})).mockRejectedValueOnce(new Error("조회 실패")).mockResolvedValueOnce([]);
 const view=render(<RuntimeDeliveryPanel executor={executor}/>);view.rerender(<RuntimeDeliveryPanel executor="00000000-0000-4000-8000-000000000002"/>);expect(await screen.findByRole("alert")).toHaveTextContent("통신 실패");
 await act(async()=>previous([row]));expect(screen.queryByText("콘텐츠 설정")).not.toBeInTheDocument();fireEvent.click(screen.getByRole("button",{name:"다시 조회"}));await waitFor(()=>expect(screen.getByText("저장된 추가 설정이 없습니다.")).toBeInTheDocument());
});
it("uses parent API data without another fetch and refreshes the same selected installation",()=>{
 const refresh=vi.fn();const view=render(<RuntimeDeliveryPanel executor={executor} records={[{...row,runtime_apply_state:"UNKNOWN"}]} onRefresh={refresh}/>);expect(screen.getByText("적용 결과 미확인")).toBeInTheDocument();expect(listConfigs).not.toHaveBeenCalled();fireEvent.click(screen.getByRole("button",{name:"다시 조회"}));expect(refresh).toHaveBeenCalledOnce();
 view.rerender(<RuntimeDeliveryPanel executor="00000000-0000-4000-8000-000000000002" records={[row]} onRefresh={refresh}/>);expect(screen.getByRole("alert")).toHaveTextContent("다른 브라우저");expect(screen.queryByText("콘텐츠 설정")).not.toBeInTheDocument();
});
