import {StrictMode} from "react";
import {act,cleanup,fireEvent,render,screen,waitFor} from "@testing-library/react";
import {afterEach,expect,it,vi} from "vitest";
import AnalysisConsent from "./AnalysisConsent";
import {ApiError,request} from "./api";
vi.mock("./api",async original=>({...await original<typeof import("./api")>(),request:vi.fn()}));
const get=vi.mocked(request);
const yes={accepted:true,notice_version:"notice",version:1,provider_configured:false};
const no={...yes,accepted:false,version:2};
function deferred(){let resolve!:(value:unknown)=>void,reject!:(error:unknown)=>void;const promise=new Promise<unknown>((r,j)=>{resolve=r;reject=j;});return {resolve,reject,promise};}
afterEach(()=>{cleanup();get.mockReset();});

// Returned independent cases: review 5727735230, comment 4435343830.
it("returned late consent GET cannot resurrect consent after the same withdrawal ACK",async()=>{
 const old=deferred();let reads=0,writes=0;
 get.mockImplementation(async(_path,method)=>{if(method==="PUT"){if(++writes===1)throw Error("lost");return no;}return ++reads===1?yes:old.promise;});
 render(<AnalysisConsent owner="A"/>);fireEvent.click(await screen.findByRole("button",{name:"AI 동의 철회"}));await screen.findByRole("alert");
 fireEvent.click(screen.getByRole("button",{name:"동의 상태 재조회"}));await waitFor(()=>expect(reads).toBe(2));
 const signal=get.mock.calls.filter(c=>c[1]==="GET")[1][3]?.signal;
 fireEvent.click(screen.getByRole("button",{name:"AI 동의 철회"}));await screen.findByText("동의 안 함");
 await act(async()=>old.resolve(yes));expect(screen.getByText("동의 안 함")).toBeInTheDocument();expect(screen.queryByRole("button",{name:"AI 동의 철회"})).not.toBeInTheDocument();expect(signal?.aborted).toBe(true);
});
it("returned superseded GET401 cannot expire a newer successful same-owner read",async()=>{
 const old=deferred();let reads=0;get.mockImplementation(async()=>{if(++reads===1)throw Error("offline");return reads===2?old.promise:no;});
 const expired=vi.fn();window.addEventListener("focurve:authentication-expired",expired);
 try{render(<AnalysisConsent owner="A"/>);fireEvent.click(await screen.findByRole("button",{name:"동의 상태 재조회"}));await waitFor(()=>expect(reads).toBe(2));
  const signal=get.mock.calls[1][3]?.signal;fireEvent.click(screen.getByRole("button",{name:"동의 상태 재조회"}));await screen.findByText("동의 안 함");
  await act(async()=>old.reject(new ApiError("UNAUTHENTICATED",401)));expect(expired).not.toHaveBeenCalled();expect(signal?.aborted).toBe(true);
 }finally{window.removeEventListener("focurve:authentication-expired",expired);}
});
it("rejects a sequential GET below the already confirmed resource revision",async()=>{
 let reads=0;get.mockImplementation(async(_path,method)=>{if(method==="PUT")throw Error("lost");return ++reads===1?{...yes,version:2}:{...no,version:1};});
 render(<AnalysisConsent owner="A"/>);fireEvent.click(await screen.findByRole("button",{name:"AI 동의 철회"}));await screen.findByRole("alert");
 fireEvent.click(screen.getByRole("button",{name:"동의 상태 재조회"}));await waitFor(()=>expect(reads).toBe(2));
 await waitFor(()=>expect(screen.getByRole("alert")).toHaveTextContent("동의 상태를 확인하지 못했습니다"));expect(screen.getByText("저장된 동의 있음")).toBeInTheDocument();expect(screen.queryByText("동의 안 함")).not.toBeInTheDocument();
});
it("preserves the latest live GET401 authentication handling",async()=>{
 let reads=0;get.mockImplementation(async()=>{if(++reads===1)throw Error("offline");throw new ApiError("UNAUTHENTICATED",401);});
 const expired=vi.fn();window.addEventListener("focurve:authentication-expired",expired);
 try{render(<AnalysisConsent owner="A"/>);fireEvent.click(await screen.findByRole("button",{name:"동의 상태 재조회"}));await waitFor(()=>expect(expired).toHaveBeenCalledTimes(1));}
 finally{window.removeEventListener("focurve:authentication-expired",expired);}
});
it("discards an old owner's consent response and 401",async()=>{
 const old=deferred();get.mockReturnValueOnce(old.promise).mockResolvedValue(no);const expired=vi.fn();window.addEventListener("focurve:authentication-expired",expired);
 try{const view=render(<AnalysisConsent owner="A"/>);view.rerender(<AnalysisConsent owner="B"/>);await screen.findByText("동의 안 함");await act(async()=>old.reject(new ApiError("UNAUTHENTICATED",401)));expect(expired).not.toHaveBeenCalled();}
 finally{window.removeEventListener("focurve:authentication-expired",expired);}
});
it("keeps the immutable withdrawal key, notice and If-Match after a failed response",async()=>{
 let reads=0,writes=0;get.mockImplementation(async(_path,method)=>{if(method==="PUT"){if(++writes===1)throw Error("lost");return no;}return ++reads===1?yes:{...yes,version:2,notice_version:"new-notice"};});
 render(<AnalysisConsent owner="A"/>);fireEvent.click(await screen.findByRole("button",{name:"AI 동의 철회"}));await screen.findByRole("alert");
 fireEvent.click(screen.getByRole("button",{name:"동의 상태 재조회"}));await waitFor(()=>expect(reads).toBe(2));await waitFor(()=>expect(screen.queryByRole("alert")).not.toBeInTheDocument());
 fireEvent.click(screen.getByRole("button",{name:"AI 동의 철회"}));await waitFor(()=>expect(writes).toBe(2));
 const calls=get.mock.calls.filter(c=>c[1]==="PUT");expect(calls[0]).toEqual(calls[1]);await screen.findByRole("alert");expect(screen.getByText("저장된 동의 있음")).toBeInTheDocument();
});
it("fences StrictMode's retired read even when transport ignores abort",async()=>{
 const old=deferred();get.mockReturnValueOnce(old.promise).mockResolvedValue(no);const expired=vi.fn();window.addEventListener("focurve:authentication-expired",expired);
 try{render(<StrictMode><AnalysisConsent owner="A"/></StrictMode>);await screen.findByText("동의 안 함");await act(async()=>old.reject(new ApiError("UNAUTHENTICATED",401)));expect(expired).not.toHaveBeenCalled();}
 finally{window.removeEventListener("focurve:authentication-expired",expired);}
});
it("preserves the live withdrawal401 and original pending write",async()=>{
 get.mockImplementation(async(_path,method)=>{if(method==="PUT")throw new ApiError("UNAUTHENTICATED",401);return yes;});const expired=vi.fn();window.addEventListener("focurve:authentication-expired",expired);
 try{render(<AnalysisConsent owner="A"/>);fireEvent.click(await screen.findByRole("button",{name:"AI 동의 철회"}));await screen.findByRole("alert");expect(expired).toHaveBeenCalledTimes(1);expect(screen.getByRole("button",{name:"AI 동의 철회"})).toBeEnabled();}
 finally{window.removeEventListener("focurve:authentication-expired",expired);}
});
it("a new GET during a pending PUT cannot cancel the valid withdrawal ACK",async()=>{
 const read=deferred(),write=deferred();let reads=0;
 get.mockImplementation(async(_path,method)=>method==="PUT"?write.promise:++reads===1?yes:read.promise);
 render(<AnalysisConsent owner="A"/>);fireEvent.click(await screen.findByRole("button",{name:"AI 동의 철회"}));
 fireEvent.click(await screen.findByRole("button",{name:"동의 상태 재조회"}));await waitFor(()=>expect(reads).toBe(2));
 await act(async()=>write.resolve(no));await screen.findByText("동의 안 함");
 await act(async()=>read.resolve(yes));expect(screen.getByText("동의 안 함")).toBeInTheDocument();expect(screen.queryByRole("alert")).not.toBeInTheDocument();
});
it("a historical replay ACK does not replace a newer Server-confirmed row",async()=>{
 const write=deferred();let reads=0,writes=0;
 get.mockImplementation(async(_path,method)=>{if(method==="PUT")return ++writes===1?write.promise:{...no,notice_version:"new",version:4};return ++reads===1?yes:{...yes,notice_version:"new",version:3};});
 render(<AnalysisConsent owner="A"/>);fireEvent.click(await screen.findByRole("button",{name:"AI 동의 철회"}));
 fireEvent.click(await screen.findByRole("button",{name:"동의 상태 재조회"}));await waitFor(()=>expect(reads).toBe(2));await act(async()=>write.resolve(no));
 expect(screen.getByText("저장된 동의 있음")).toBeInTheDocument();fireEvent.click(await screen.findByRole("button",{name:"AI 동의 철회"}));await screen.findByText("동의 안 함");
 const calls=get.mock.calls.filter(c=>c[1]==="PUT");expect(calls[1][2]).toEqual({accepted:false,notice_version:"new"});expect(calls[1][3]?.version).toBe(3);expect(calls[0][3]?.key).not.toBe(calls[1][3]?.key);
});
