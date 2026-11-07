import {act,render,screen,fireEvent,cleanup,waitFor} from "@testing-library/react";
import {afterEach,it,expect,vi} from "vitest";
import GuestImports from "./GuestImports";
import {clearCsrf} from "./api";
const json=(v:unknown,status=200)=>new Response(JSON.stringify(v),{status,headers:{"Content-Type":"application/json"}});
function deferred(){let resolve!:(v:Response)=>void;const promise=new Promise<Response>(r=>{resolve=r;});return {promise,resolve};}
const listButton=()=>screen.getByRole("button",{name:"처리 결과 새로고침"});
afterEach(()=>{cleanup();clearCsrf();vi.unstubAllGlobals();vi.unstubAllEnvs();});
it("an obsolete history401 cannot expire a new owner's successful view",async()=>{
 const old=deferred(),expired=vi.fn();let owner="42";window.addEventListener("focurve:authentication-expired",expired);
 try{vi.stubGlobal("fetch",vi.fn(async()=>owner==="42"?old.promise:json({items:[],next_cursor:null})));const a=render(<GuestImports owner="42"/>);fireEvent.click(listButton());a.unmount();owner="43";render(<GuestImports owner="43"/>);fireEvent.click(listButton());await screen.findByText("아직 가져오기 요청이 없습니다.");await act(async()=>old.resolve(json({error:{code:"UNAUTHENTICATED"}},401)));expect(expired).not.toHaveBeenCalled();expect(listButton()).toBeEnabled();}
 finally{window.removeEventListener("focurve:authentication-expired",expired);}
});
it("switching owners does not inherit an old request lock or revive old A data after A-B-A",async()=>{
 const old=deferred();let first=true;const fetch=vi.fn(async()=>{if(first){first=false;return old.promise;}return json({items:[],next_cursor:null});});vi.stubGlobal("fetch",fetch);
 const view=render(<GuestImports owner="42"/>);fireEvent.click(listButton());view.rerender(<GuestImports owner="43"/>);expect(listButton()).toBeEnabled();view.rerender(<GuestImports owner="42"/>);fireEvent.click(listButton());await screen.findByText("아직 가져오기 요청이 없습니다.");
 await act(async()=>old.resolve(json({items:[{batch_id:crypto.randomUUID(),created_at:"2026-11-01T00:00:00.000Z",status:"FAILED",items:[]}],next_cursor:null})));expect(screen.queryByText(/실패 · 재시도 가능/)).not.toBeInTheDocument();expect(screen.getByText("아직 가져오기 요청이 없습니다.")).toBeInTheDocument();
});
it("a late owner-A batch GET401 cannot log out B or retry the import",async()=>{
 const old=deferred(),expired=vi.fn(),batch=crypto.randomUUID(),source=crypto.randomUUID(),m={format_version:"1.0",owner_user_id:"42",executor_id:crypto.randomUUID(),items:[{source_item_id:source,source_hash:"a".repeat(64),type:"SITE",label:"owner-a.example"}]};
 vi.stubEnv("VITE_EXTENSION_ID","a".repeat(32));const send=vi.fn((_id:string,b:{type:string},cb:(v:unknown)=>void)=>cb(b.type.endsWith("LIST")?m:{batch_id:batch}));vi.stubGlobal("chrome",{runtime:{sendMessage:send}});const fetch=vi.fn(async(url:string)=>url.endsWith(batch)?old.promise:json({items:[],next_cursor:null}));vi.stubGlobal("fetch",fetch);window.addEventListener("focurve:authentication-expired",expired);
 try{const a=render(<GuestImports owner="42"/>);fireEvent.click(screen.getByRole("button",{name:"가져올 자료 확인"}));fireEvent.click(await screen.findByRole("checkbox"));fireEvent.click(screen.getByRole("button",{name:"선택한 자료 가져오기"}));await waitFor(()=>expect(fetch.mock.calls.some(c=>c[0].endsWith(batch))).toBe(true));a.unmount();render(<GuestImports owner="43"/>);fireEvent.click(listButton());await screen.findByText("아직 가져오기 요청이 없습니다.");await act(async()=>old.resolve(json({error:{code:"UNAUTHENTICATED"}},401)));expect(expired).not.toHaveBeenCalled();expect(send).toHaveBeenCalledTimes(2);}
 finally{window.removeEventListener("focurve:authentication-expired",expired);}
});

it("a current history401 still expires authentication and cannot become an empty successful history",async()=>{
 const expired=vi.fn();window.addEventListener("focurve:authentication-expired",expired);
 try{vi.stubGlobal("fetch",vi.fn(async()=>json({error:{code:"UNAUTHENTICATED"}},401)));render(<GuestImports owner="42"/>);fireEvent.click(listButton());await screen.findByRole("alert");expect(expired).toHaveBeenCalledOnce();expect(screen.queryByText("아직 가져오기 요청이 없습니다.")).not.toBeInTheDocument();}
 finally{window.removeEventListener("focurve:authentication-expired",expired);}
});
it("cursor reads abort on owner change and discard a late401",async()=>{
 const old=deferred(),expired=vi.fn();let first=true;const fetch=vi.fn(async(url:string,init?:RequestInit)=>{if(url.includes("cursor="))return old.promise;const cursor=first?"older":null;first=false;return json({items:[],next_cursor:cursor});});vi.stubGlobal("fetch",fetch);window.addEventListener("focurve:authentication-expired",expired);
 try{const view=render(<GuestImports owner="42"/>);fireEvent.click(listButton());fireEvent.click(await screen.findByRole("button",{name:"이전 처리 결과 더 보기"}));await waitFor(()=>expect(fetch.mock.calls).toHaveLength(2));const signal=fetch.mock.calls[1][1]!.signal!;view.rerender(<GuestImports owner="43"/>);expect(signal.aborted).toBe(true);fireEvent.click(listButton());await screen.findByText("아직 가져오기 요청이 없습니다.");await act(async()=>old.resolve(json({error:{code:"UNAUTHENTICATED"}},401)));expect(expired).not.toHaveBeenCalled();}
 finally{window.removeEventListener("focurve:authentication-expired",expired);}
});
function bridge(){
 const source=crypto.randomUUID(),batch=crypto.randomUUID(),m={format_version:"1.0",owner_user_id:"42",executor_id:crypto.randomUUID(),items:[{source_item_id:source,source_hash:"a".repeat(64),type:"SITE",label:"owner-a.example"}]};vi.stubEnv("VITE_EXTENSION_ID","a".repeat(32));return {source,batch,m};
}
it("a late extension submit ACK after account change never triggers old-owner Server reads or success feedback",async()=>{
 const {batch,m}=bridge();let ack!:(v:unknown)=>void;const send=vi.fn((_id:string,b:{type:string},cb:(v:unknown)=>void)=>{if(b.type.endsWith("LIST"))cb(m);else ack=cb;});vi.stubGlobal("chrome",{runtime:{sendMessage:send}});const fetch=vi.fn(async()=>json({items:[],next_cursor:null}));vi.stubGlobal("fetch",fetch);
 const view=render(<GuestImports owner="42"/>);fireEvent.click(screen.getByRole("button",{name:"가져올 자료 확인"}));fireEvent.click(await screen.findByRole("checkbox"));fireEvent.click(screen.getByRole("button",{name:"선택한 자료 가져오기"}));await waitFor(()=>expect(send).toHaveBeenCalledTimes(2));expect(screen.getByText(/전송 결과 확인이 필요합니다/)).toBeInTheDocument();view.rerender(<GuestImports owner="43"/>);await act(async()=>ack({batch_id:batch}));expect(fetch).not.toHaveBeenCalled();expect(screen.queryByRole("alert")).not.toBeInTheDocument();expect(screen.queryByText(/선택한 자료의 처리 결과를 확인하세요/)).not.toBeInTheDocument();expect(listButton()).toBeEnabled();
});
it("same-owner parent rerenders retain selection without re-listing or submitting",async()=>{
 const {m}=bridge(),send=vi.fn((_id:string,_b:unknown,cb:(v:unknown)=>void)=>cb(m));vi.stubGlobal("chrome",{runtime:{sendMessage:send}});const view=render(<GuestImports owner="42"/>);fireEvent.click(screen.getByRole("button",{name:"가져올 자료 확인"}));fireEvent.click(await screen.findByRole("checkbox"));view.rerender(<GuestImports owner="42"/>);expect(screen.getByRole("checkbox")).toBeChecked();expect(send).toHaveBeenCalledOnce();
});
it("a valid current import confirms selected Server results and preserves the original payload",async()=>{
 const {m,batch,source}=bridge(),send=vi.fn((_id:string,b:{type:string},cb:(v:unknown)=>void)=>cb(b.type.endsWith("LIST")?m:{batch_id:batch}));vi.stubGlobal("chrome",{runtime:{sendMessage:send}});const result={batch_id:batch,status:"SUCCEEDED",created_at:"2026-11-01T00:00:00.000Z",items:[{source_item_id:source,status:"SUCCEEDED",error_code:null}]};const fetch=vi.fn(async(url:string)=>json(url.endsWith(batch)?result:{items:[result],next_cursor:null}));vi.stubGlobal("fetch",fetch);
 render(<GuestImports owner="42"/>);fireEvent.click(screen.getByRole("button",{name:"가져올 자료 확인"}));fireEvent.click(await screen.findByRole("checkbox"));fireEvent.click(screen.getByRole("button",{name:"선택한 자료 가져오기"}));await screen.findByText(/선택한 자료의 처리 결과를 확인하세요/);expect(fetch).toHaveBeenCalledTimes(2);expect(send).toHaveBeenCalledTimes(2);expect(screen.queryByRole("checkbox")).not.toBeInTheDocument(); // confirmed completed sources are no longer selectable
 const payload=send.mock.calls[1][1] as unknown;expect(payload).toEqual({type:"FOCURVE_GUEST_IMPORT_SUBMIT",version:"1.0",owner_user_id:"42",executor_id:m.executor_id,request_id:expect.stringMatching(/^[a-f0-9-]{36}$/),items:[{source_item_id:source,source_hash:"a".repeat(64),type:"SITE"}]});
});
