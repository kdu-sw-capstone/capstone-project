import {act,fireEvent,render,screen,waitFor,within} from "@testing-library/react";
import {beforeEach,expect,it,vi} from "vitest";
import AdditionalSettings from "./AdditionalSettings";
import {request,ApiError} from "./api";
import type {ConfigRecord} from "./additionalConfigApi";
vi.mock("./api",async original=>({...await original<typeof import("./api")>(),request:vi.fn()}));
const executor="00000000-0000-4000-8000-000000000001",id="00000000-0000-4000-8000-000000000002",other="00000000-0000-4000-8000-000000000003";
const record:ConfigRecord={config_id:id,executor_id:executor,version:1,value:{kind:"SITE_TIME",policy_id:id,site_id:null,version:1,enabled:true,scope:{host:"example.org",include_subdomains:false},required:true,daily_limit_ms:60000,tracking_scope:"BROWSER_ALWAYS",windows:[]},deleted_at:null,saved_state:"SAVED",runtime_apply_state:"PENDING",saved_runtime_revision:1,applied_runtime_revision:null,next_focus_revision:1,updated_at:"2026-11-01T00:00:00.000Z"};
let current:ConfigRecord,listingError:Error|null,readError:Error|null;
beforeEach(()=>{
 current=structuredClone(record);listingError=null;readError=null;vi.mocked(request).mockReset().mockImplementation(async(path,method)=>{
  if(path.startsWith('/amvp/configs?')){if(listingError)throw listingError;return {items:[current],next_cursor:null,has_more:false};}
  if(path===`/amvp/configs/${id}`){if(method==="PUT")throw new ApiError("VERSION_CONFLICT",412);if(readError)throw readError;return current;}
  if(path.includes('/site-time-deletions?'))return {read_model:"AMVP_SITE_TIME_DELETIONS_1",items:[],next_cursor:null,has_more:false};
  throw new ApiError("RESOURCE_NOT_FOUND",404);
 });
});
async function edit(){render(<AdditionalSettings installations={[{executor_id:executor,client_version:"test"}]}/>);fireEvent.change(screen.getByLabelText("설치 선택"),{target:{value:executor}});fireEvent.click(await screen.findByRole("button",{name:"수정"}));fireEvent.change(screen.getByLabelText("하루 한도(분) · 비우면 무제한"),{target:{value:"3"}});}
const save=()=>fireEvent.click(screen.getByRole("button",{name:"설정 저장"}));
const conflict=()=>screen.getByRole("group",{name:"설정 버전 충돌"});
async function collide(){await edit();current={...record,version:2,saved_runtime_revision:2,value:{...record.value,version:2,daily_limit_ms:120000}};save();await screen.findByRole("group",{name:"설정 버전 충돌"});}
it("keeps the daily-limit draft through list loading, failure and successful reread without a PUT",async()=>{
 await edit();listingError=new Error("offline");fireEvent.click(screen.getByText("현재 저장 설정 다시 조회"));await waitFor(()=>expect(screen.getByLabelText("하루 한도(분) · 비우면 무제한")).toHaveValue(3));await waitFor(()=>expect(screen.getByRole("button",{name:"설정 저장"})).toBeDisabled());
 listingError=null;fireEvent.click(screen.getByText("현재 저장 설정 다시 조회"));await waitFor(()=>expect(screen.getByRole("button",{name:"설정 저장"})).toBeEnabled());expect(screen.getByLabelText("하루 한도(분) · 비우면 무제한")).toHaveValue(3);expect(vi.mocked(request).mock.calls.filter(c=>c[1]==="PUT")).toHaveLength(0);
});
it("requires a fresh read and explicit choice before saving a preserved draft against the latest version",async()=>{
 await edit();current={...record,version:2,saved_runtime_revision:2,value:{...record.value,version:2,daily_limit_ms:120000}};save();await screen.findByRole("group",{name:"설정 버전 충돌"});expect(screen.getByLabelText("하루 한도(분) · 비우면 무제한")).toHaveValue(3);
 fireEvent.click(within(conflict()).getByText("최신 저장 버전 확인"));await within(conflict()).findByText(/확인한 서버 버전 2/);expect(vi.mocked(request).mock.calls.filter(c=>c[1]==="PUT")).toHaveLength(1);
 fireEvent.click(within(conflict()).getByText("최신 버전 기준으로 내 편집 계속"));expect(screen.getByLabelText("하루 한도(분) · 비우면 무제한")).toHaveValue(3);
 const old=vi.mocked(request).getMockImplementation()!;let stored:ConfigRecord|undefined;vi.mocked(request).mockImplementation(async(path,method,body,options)=>{
  if(path===`/amvp/configs/${id}`&&method==="PUT"){expect(options).toMatchObject({version:2});expect((body as {value:unknown}).value).toMatchObject({version:2,daily_limit_ms:180000});stored={...current,version:3,value:{...current.value,version:3,daily_limit_ms:180000}};return stored;}
  if(path===`/amvp/configs/${id}`&&stored)return stored;return old(path,method,body,options);
 });save();await screen.findByText(/설정을 저장하고 다시 조회했습니다/);expect(vi.mocked(request).mock.calls.filter(c=>c[1]==="PUT")).toHaveLength(2);
});
it("can replace the local draft only after an explicit latest-server-value choice without writing",async()=>{
 await collide();fireEvent.click(within(conflict()).getByText("최신 저장 버전 확인"));await within(conflict()).findByText(/확인한 서버 버전 2/);fireEvent.click(within(conflict()).getByText("서버의 최신 설정으로 바꾸기"));expect(screen.getByLabelText("하루 한도(분) · 비우면 무제한")).toHaveValue(2);expect(vi.mocked(request).mock.calls.filter(c=>c[1]==="PUT")).toHaveLength(1);
});
it.each(["identity","kind","stale","failed"])("refuses an unverified latest record (%s) and preserves the draft",async kind=>{
 await collide();if(kind==="identity")current={...current,executor_id:other};if(kind==="kind")current={...current,value:{kind:"CADENCE"}};if(kind==="stale")current=record;if(kind==="failed")readError=new Error("offline");
 fireEvent.click(within(conflict()).getByText("최신 저장 버전 확인"));await waitFor(()=>expect(within(conflict()).getByText("최신 저장 버전 확인")).toBeEnabled());expect(within(conflict()).queryByText("최신 버전 기준으로 내 편집 계속")).not.toBeInTheDocument();expect(screen.getByRole("button",{name:"설정 저장"})).toBeDisabled();expect(screen.getByLabelText("하루 한도(분) · 비우면 무제한")).toHaveValue(3);expect(vi.mocked(request).mock.calls.filter(c=>c[1]==="PUT")).toHaveLength(1);
});
it("does not recreate a deleted setting or equate deletion with actual release",async()=>{
 await collide();current={...current,deleted_at:"2026-11-01T00:00:01.000Z"};fireEvent.click(within(conflict()).getByText("최신 저장 버전 확인"));await within(conflict()).findByText(/설정 삭제됨 · 실제 해제 완료를 뜻하지 않습니다/);expect(within(conflict()).queryByText("최신 버전 기준으로 내 편집 계속")).not.toBeInTheDocument();expect(screen.getByRole("button",{name:"설정 저장"})).toBeDisabled();
});
it.each([new Error("confirmation response lost"),new ApiError("UNAUTHENTICATED",401),new ApiError("RESOURCE_NOT_FOUND",404),new ApiError("VERSION_CONFLICT",412)])("preserves the same immutable save request across a lost GET response and same-installation reread (%s)",async readFailure=>{
 await edit();const old=vi.mocked(request).getMockImplementation()!;let accepted=false,loseRead=true;
 vi.mocked(request).mockImplementation(async(path,method,body,options)=>{
  if(path===`/amvp/configs/${id}`&&method==="PUT"){accepted=true;current={...record,version:2,value:{...record.value,version:2,daily_limit_ms:180000}};return current;}
  if(path===`/amvp/configs/${id}`&&accepted&&loseRead)throw readFailure;return old(path,method,body,options);
 });save();await screen.findByRole("button",{name:"같은 저장 요청 결과 다시 확인"});loseRead=false;fireEvent.click(screen.getByText("현재 저장 설정 다시 조회"));await waitFor(()=>expect(screen.getByRole("button",{name:"같은 저장 요청 결과 다시 확인"})).toBeEnabled());fireEvent.click(screen.getByRole("button",{name:"같은 저장 요청 결과 다시 확인"}));await screen.findByText(/설정을 저장하고 다시 조회했습니다/);
 const puts=vi.mocked(request).mock.calls.filter(c=>c[1]==="PUT");expect(puts).toHaveLength(2);expect(puts[1][2]).toEqual(puts[0][2]);expect(puts[1][3]).toEqual(puts[0][3]);
});
it("ignores a late conflict read when the connected installation is removed",async()=>{
 const view=render(<AdditionalSettings installations={[{executor_id:executor,client_version:"test"}]}/>);fireEvent.change(screen.getByLabelText("설치 선택"),{target:{value:executor}});fireEvent.click(await screen.findByRole("button",{name:"수정"}));current={...current,version:2,value:{...current.value,version:2}};save();await screen.findByRole("group",{name:"설정 버전 충돌"});
 let resolve!:(r:ConfigRecord)=>void;const old=vi.mocked(request).getMockImplementation()!;vi.mocked(request).mockImplementation((path,method,body,options)=>path===`/amvp/configs/${id}`&&method==="GET"?new Promise(r=>{resolve=r;}):old(path,method,body,options));fireEvent.click(within(conflict()).getByText("최신 저장 버전 확인"));await waitFor(()=>expect(resolve).toBeTypeOf("function"));view.rerender(<AdditionalSettings installations={[]}/>);await act(async()=>resolve(current));expect(screen.queryByRole("group",{name:"설정 버전 충돌"})).not.toBeInTheDocument();expect(screen.getByLabelText("설치 선택")).toHaveValue("");
});
