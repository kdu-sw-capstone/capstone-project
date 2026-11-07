import {afterEach,it,expect,vi} from "vitest";
import {act,cleanup,fireEvent,render,screen,waitFor} from "@testing-library/react";
import GuestImports from "./GuestImports";
import {clearCsrf} from "./api";
const json=(value:unknown)=>new Response(JSON.stringify(value),{headers:{"Content-Type":"application/json"}});
afterEach(()=>{cleanup();clearCsrf();vi.unstubAllGlobals();vi.unstubAllEnvs();});
function fixture(status="FAILED"){
 const first=crypto.randomUUID(),second=crypto.randomUUID(),batch=crypto.randomUUID(),executor=crypto.randomUUID();
 const items=[{source_item_id:first,source_hash:"a".repeat(64),type:"SITE",label:"completed.invalid"},{source_item_id:second,source_hash:"b".repeat(64),type:"SESSION",label:"remaining-history"}];
 let state=status,activeBatch=batch;let selected:string[]=[first,second],submits=0;
 const send=vi.fn((_id:string,body:{type:string;items?:{source_item_id:string}[]},cb:(v:unknown)=>void)=>{
  if(body.type.endsWith("LIST")){cb({format_version:"1.0",owner_user_id:"42",executor_id:executor,items});return;}
  selected=body.items!.map(item=>item.source_item_id);if(submits++)activeBatch=crypto.randomUUID();cb({batch_id:activeBatch});
 });
 const result=()=>({batch_id:activeBatch,status:state==="SUCCEEDED"?"SUCCEEDED":"PARTIAL",created_at:"2026-11-07T00:00:00.000Z",items:[{source_item_id:first,status:"SUCCEEDED",error_code:null},{source_item_id:second,status:state,error_code:state==="FAILED"?"SOURCE_INVALID":null}].filter(item=>selected.includes(item.source_item_id))});
 const fetch=vi.fn(async(url:string)=>json(url.includes("/guest-imports/")?result():{items:[result()],next_cursor:null}));
 vi.stubEnv("VITE_EXTENSION_ID","a".repeat(32));vi.stubGlobal("chrome",{runtime:{sendMessage:send}});vi.stubGlobal("fetch",fetch);
 return {first,second,batch,items,send,fetch,result,state:(value:string)=>{state=value;}};
}
async function submit(){fireEvent.click(screen.getByRole("button",{name:"가져올 자료 확인"}));for(const box of await screen.findAllByRole("checkbox"))fireEvent.click(box);fireEvent.click(screen.getByRole("button",{name:"선택한 자료 가져오기"}));await waitFor(()=>expect(screen.getByRole("button",{name:"처리 결과 새로고침"})).toBeEnabled());}
it("partial confirmed result removes completed source and keeps only failed selection for explicit retry",async()=>{
 const f=fixture();render(<GuestImports owner="42"/>);await submit();
 expect(screen.queryByRole("checkbox",{name:/completed.invalid/})).not.toBeInTheDocument();
 expect(screen.getByRole("checkbox",{name:/remaining-history/})).toBeChecked();expect(f.send).toHaveBeenCalledTimes(2);
 f.state("SUCCEEDED");fireEvent.click(screen.getByRole("button",{name:"선택한 자료 가져오기"}));await waitFor(()=>expect(f.send).toHaveBeenCalledTimes(3));
 const body=f.send.mock.calls[2][1] as unknown;expect(body).toMatchObject({items:[{source_item_id:f.second}]});await waitFor(()=>expect(screen.queryAllByRole("checkbox")).toHaveLength(0));
});
it("pending result stays blocked through explicit pending reread then completed reread removes remaining choices",async()=>{
 const f=fixture("PENDING");render(<GuestImports owner="42"/>);await submit();
 expect(screen.getByRole("button",{name:"선택한 자료 가져오기"})).toBeDisabled();
 fireEvent.click(screen.getByRole("button",{name:"처리 결과 새로고침"}));await waitFor(()=>expect(f.fetch.mock.calls.filter(c=>c[0].endsWith(f.batch))).toHaveLength(2));
 expect(screen.getByRole("button",{name:"선택한 자료 가져오기"})).toBeDisabled();f.state("SUCCEEDED");
 await waitFor(()=>expect(screen.getByRole("button",{name:"처리 결과 새로고침"})).toBeEnabled());fireEvent.click(screen.getByRole("button",{name:"처리 결과 새로고침"}));
 await waitFor(()=>expect(screen.queryAllByRole("checkbox")).toHaveLength(0));expect(f.send).toHaveBeenCalledTimes(2);
});
it("malformed exact pending reread preserves unconfirmed selection and blocks resubmission",async()=>{
 const f=fixture("PENDING");render(<GuestImports owner="42"/>);await submit();
 f.fetch.mockImplementation(async(url:string)=>json(url.endsWith(f.batch)?{...f.result(),items:[]}:{items:[],next_cursor:null}));
 fireEvent.click(screen.getByRole("button",{name:"처리 결과 새로고침"}));expect(await screen.findByRole("alert")).toHaveTextContent(/일치/);
 expect(screen.getByRole("button",{name:"선택한 자료 가져오기"})).toBeDisabled();expect(screen.getByRole("checkbox",{name:/remaining-history/})).toBeChecked();
});

it("late pending-batch response after owner replacement cannot change new-owner choices or read its history",async()=>{
 const f=fixture("PENDING");const view=render(<GuestImports owner="42"/>);await submit();
 let finish!:(value:Response)=>void;f.fetch.mockImplementation(()=>new Promise<Response>(resolve=>{finish=resolve;}));
 fireEvent.click(screen.getByRole("button",{name:"처리 결과 새로고침"}));await waitFor(()=>expect(finish).toBeTypeOf("function"));
 view.rerender(<GuestImports owner="43"/>);const count=f.fetch.mock.calls.length;
 await act(async()=>finish(json(f.result())));expect(f.fetch).toHaveBeenCalledTimes(count);
 expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();expect(screen.queryByText(/처리 중인 자료가 남아/)).not.toBeInTheDocument();
});
it("conflict-preserved member settings are completed without being offered for upload again",async()=>{
 const f=fixture("SKIPPED_CONFLICT");render(<GuestImports owner="42"/>);await submit();
 expect(screen.queryAllByRole("checkbox")).toHaveLength(0);expect(f.send).toHaveBeenCalledTimes(2);
});
