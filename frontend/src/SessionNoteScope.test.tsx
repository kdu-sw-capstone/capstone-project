import {act,fireEvent,render,screen,waitFor} from "@testing-library/react";
import {beforeEach,expect,it,vi} from "vitest";
import SessionNote from "./SessionNote";
import {StrictMode} from "react";
import {request,ApiError} from "./api";
vi.mock("./api",async original=>({...await original<typeof import("./api")>(),request:vi.fn()}));
const a="00000000-0000-4000-8000-000000000001",b="00000000-0000-4000-8000-000000000002";
const input=()=>screen.getByLabelText("세션 메모 · 선택");
beforeEach(()=>{vi.mocked(request).mockReset();});
it("starts the new session read immediately and rejects an old session's delayed note",async()=>{
 let resolve!:(v:unknown)=>void;vi.mocked(request).mockImplementation(async path=>path.includes(a)?new Promise(r=>{resolve=r;}):{text:"B note",version:1});
 const view=render(<SessionNote sessionId={a}/>);await waitFor(()=>expect(resolve).toBeTypeOf("function"));view.rerender(<SessionNote sessionId={b}/>);await waitFor(()=>expect(input()).toHaveValue("B note"));await act(async()=>resolve({text:"A note",version:1}));expect(input()).toHaveValue("B note");
});
it("does not overwrite text typed while the initial note GET is pending",async()=>{
 let resolve!:(v:unknown)=>void;vi.mocked(request).mockImplementation(()=>new Promise(r=>{resolve=r;}));render(<SessionNote sessionId={a}/>);await waitFor(()=>expect(resolve).toBeTypeOf("function"));fireEvent.change(input(),{target:{value:"my in-flight draft"}});await act(async()=>resolve({text:"stored",version:1}));expect(input()).toHaveValue("my in-flight draft");expect(screen.getByRole("button",{name:"메모 저장"})).toBeEnabled();
});
it("does not let a late save clear a different session's parent draft or display its acknowledgement",async()=>{
 let resolve!:(v:unknown)=>void;const onDraft=vi.fn();vi.mocked(request).mockImplementation(async(path,method)=>method==="PUT"?new Promise(r=>{resolve=r;}):{text:path.includes(a)?"A note":"B note",version:1});const view=render(<SessionNote sessionId={a} onDraft={onDraft}/>);await waitFor(()=>expect(input()).toHaveValue("A note"));fireEvent.click(screen.getByText("메모 저장"));await waitFor(()=>expect(resolve).toBeTypeOf("function"));view.rerender(<SessionNote sessionId={b} onDraft={onDraft}/>);await waitFor(()=>expect(input()).toHaveValue("B note"));await act(async()=>resolve({text:"A note",version:2}));expect(onDraft).not.toHaveBeenCalled();expect(screen.queryByText("메모를 저장했습니다.")).not.toBeInTheDocument();
});
it("distinguishes an acknowledged snapshot from edits made during the save and uses the new version next",async()=>{
 let resolve!:(v:unknown)=>void;const onDraft=vi.fn();vi.mocked(request).mockImplementation(async(_path,method)=>method==="PUT"?new Promise(r=>{resolve=r;}):{text:"stored",version:1});render(<SessionNote sessionId={a} onDraft={onDraft}/>);await waitFor(()=>expect(input()).toHaveValue("stored"));fireEvent.change(input(),{target:{value:"sent"}});fireEvent.click(screen.getByText("메모 저장"));await waitFor(()=>expect(resolve).toBeTypeOf("function"));fireEvent.change(input(),{target:{value:"new unsaved draft"}});await act(async()=>resolve({text:"sent",version:2}));expect(input()).toHaveValue("new unsaved draft");expect(screen.getByText(/현재 입력은 아직 저장되지 않았습니다/)).toBeInTheDocument();expect(onDraft).not.toHaveBeenCalled();fireEvent.click(screen.getByText("메모 저장"));expect(vi.mocked(request).mock.calls.filter(c=>c[1]==="PUT").at(-1)).toMatchObject([`/sessions/${a}/note`,"PUT",{text:"new unsaved draft"},{version:2}]);await act(async()=>resolve({text:"new unsaved draft",version:3}));expect(onDraft).toHaveBeenCalledWith("");
});
it("does not follow an old session's late 412 with a new conflict read",async()=>{
 let reject!:(e:Error)=>void;vi.mocked(request).mockImplementation(async(path,method)=>method==="PUT"?new Promise((_r,j)=>{reject=j;}):{text:path.includes(a)?"A note":"B note",version:1});const view=render(<SessionNote sessionId={a}/>);await waitFor(()=>expect(input()).toHaveValue("A note"));fireEvent.click(screen.getByText("메모 저장"));view.rerender(<SessionNote sessionId={b}/>);await waitFor(()=>expect(input()).toHaveValue("B note"));await act(async()=>reject(new ApiError("VERSION_CONFLICT",412)));expect(vi.mocked(request).mock.calls.filter(c=>c[0].includes(a)&&c[1]==="GET")).toHaveLength(1);expect(screen.queryByText(/최신 메모:/)).not.toBeInTheDocument();
});
it("still loads in React's repeated effect setup without leaving the save lock stuck",async()=>{
 vi.mocked(request).mockResolvedValue({text:"strict note",version:1});render(<StrictMode><SessionNote sessionId={a}/></StrictMode>);await waitFor(()=>expect(input()).toHaveValue("strict note"));expect(screen.getByText("메모 저장")).toBeEnabled();
});
it("preserves editing through an initial read failure and explicit retry",async()=>{
 vi.mocked(request).mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce({text:"server note",version:0});render(<SessionNote sessionId={a}/>);await screen.findByRole("alert");fireEvent.change(input(),{target:{value:"unsaved note"}});fireEvent.click(screen.getByText("메모 다시 확인"));await waitFor(()=>expect(screen.getByText("메모 저장")).toBeEnabled());expect(input()).toHaveValue("unsaved note");expect(vi.mocked(request).mock.calls.every(c=>c[1]==="GET")).toBe(true);
});
