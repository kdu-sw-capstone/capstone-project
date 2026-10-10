import {render,screen,fireEvent,cleanup,waitFor} from "@testing-library/react";
import {afterEach,it,expect,vi} from "vitest";
import Records from "./BehaviorRecords";
import {type Access} from "./FocusShared";
const json=(value:unknown)=>new Response(JSON.stringify(value),{headers:{"Content-Type":"application/json"}});
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
it.each([
 {name:"single global",reason:"KEYWORD",blocked_reasons:["KEYWORD"],expected:"키워드 제한"},
 {name:"mixed feature",reason:"KEYWORD",blocked_reasons:["KEYWORD","FEATURE"],expected:"키워드 제한 · 내부 기능 제한",event_type:"BLOCKED_FEATURE_ACCESS",feature_code:"YOUTUBE_SHORTS"},
 {name:"legacy single",reason:"USER_SITE",expected:"사이트 정책 차단"},
 {name:"legacy missing",expected:"차단 사유 미확인"},
 {name:"explicit empty",blocked_reasons:[],expected:"차단 사유 미확인"},
 {name:"legacy recorded",blocked_reasons:["RECORD"],event_type:"RECORDED_ACCESS",expected:"차단 없음"},
 {name:"unknown reason",blocked_reasons:["UNKNOWN"],expected:"알 수 없는 차단 사유"},
 {name:"recorded",reason:"RECORD",blocked_reasons:[],event_type:"RECORDED_ACCESS",expected:"차단 없음"}
])("$name reason is visible in the real detail component (HTTP mock)",async fixture=>{
 const item={event_id:"e1",session_id:"s1",occurred_at:"2026-10-09T00:00:00Z",target_host:"youtube.com",target_key:"youtube.com",event_type:"BLOCKED_SITE_ACCESS",target_access_index:1,is_repeat:false,quality:"CONFIRMED",matched_policy_host:null,...fixture} as Access;
 vi.stubGlobal("fetch",vi.fn(async(url:string)=>{
  if(url.includes("/statistics"))return json({quality:"CONFIRMED"});
  if(url.includes("/sessions?"))return json({items:[],next_cursor:null});
  if(url.includes("/access-events?"))return json({items:[item],next_cursor:null});
  if(url.endsWith("/e1"))return json(item);
  if(url.endsWith("/s1"))return json({session_id:"s1",started_at:item.occurred_at,ended_at:item.occurred_at});
  throw Error(url);
 }));
 render(<Records initialHost="" initialRange={{from:"",to:""}} settings={()=>{}}/>);
 fireEvent.click(await screen.findByRole("button",{name:/詳細|상세/}));
 await screen.findByText("발생 당시 적용 정책");
 const term=screen.getByText("차단 사유");expect(term.nextElementSibling).toHaveTextContent(fixture.expected);
 await waitFor(()=>expect(screen.queryByRole("alert")).not.toBeInTheDocument());
 expect(screen.getByText(/당시 일치하는 사이트 정책 정보가 없습니다/)).toBeInTheDocument();
});
