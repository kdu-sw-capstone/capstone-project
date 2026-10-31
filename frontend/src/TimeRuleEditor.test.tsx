import {render,screen,fireEvent} from "@testing-library/react";
import {expect,it,vi} from "vitest";
import TimeRuleEditor,{WhenEditor,defaultWeekly,type TimeWindow} from "./TimeRuleEditor";
it("preserves a window identity while selecting a next-day end",()=>{
 const row:TimeWindow={window_id:"00000000-0000-4000-8000-000000000001",kind:"BLOCK_WINDOW",enabled:true,when:{...defaultWeekly(),start_local:"23:00",end_local:"01:00",end_day_offset:0}};
 const changed=vi.fn();render(<TimeRuleEditor windows={[row]} onChange={changed}/>);fireEvent.change(screen.getByLabelText("종료 날짜"),{target:{value:"1"}});
 expect(changed).toHaveBeenLastCalledWith([{...row,when:{...row.when,end_day_offset:1}}]);expect(row.when).toMatchObject({end_day_offset:0});fireEvent.click(screen.getByText("시간창 1 삭제"));expect(changed).toHaveBeenLastCalledWith([]);
});
it("one-time editor labels UTC explicitly and preserves millisecond Z wire shape",()=>{
 const changed=vi.fn();render(<WhenEditor value={{recurrence:"ONCE",start_at:"2026-10-29T09:00:00.000Z"}} onChange={changed}/>);fireEvent.change(screen.getByLabelText("시작 날짜·시각(UTC)"),{target:{value:"2026-10-30T10:30"}});
 expect(changed).toHaveBeenCalledWith({recurrence:"ONCE",start_at:"2026-10-30T10:30:00.000Z"});
});

it("shows both endpoints of a persisted ONCE window without losing seconds or milliseconds",()=>{
 const when={recurrence:"ONCE" as const,start_at:"2026-11-11T09:00:12.123Z",end_at:"2026-11-11T09:01:34.567Z"};render(<WhenEditor window value={when} onChange={vi.fn()}/>);
 expect(screen.getByLabelText("시작 날짜·시각(UTC)")).toHaveValue("2026-11-11T09:00:12.123");expect(screen.getByLabelText("종료 날짜·시각(UTC)")).toHaveValue("2026-11-11T09:01:34.567");
});
it("canonicalizes edited ONCE endpoints without appending a second seconds component",()=>{
 const when={recurrence:"ONCE" as const,start_at:"2026-11-11T09:00:12.123Z",end_at:"2026-11-11T09:01:34.567Z"},changed=vi.fn();render(<WhenEditor window value={when} onChange={changed}/>);
 fireEvent.change(screen.getByLabelText("시작 날짜·시각(UTC)"),{target:{value:"2026-11-12T10:00:12.123"}});expect(changed).toHaveBeenLastCalledWith({...when,start_at:"2026-11-12T10:00:12.123Z"});
 fireEvent.change(screen.getByLabelText("종료 날짜·시각(UTC)"),{target:{value:"2026-11-12T10:01:34.567"}});expect(changed).toHaveBeenLastCalledWith({...when,end_at:"2026-11-12T10:01:34.567Z"});
});
