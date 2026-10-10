import {render,screen,fireEvent,cleanup,waitFor} from "@testing-library/react";
import {afterEach,describe,it,expect,vi} from "vitest";
import Sessions from "./FocusSessions";
import Records from "./BehaviorRecords";
import Note from "./SessionNote";
import {clearCsrf} from "./api";
const json=(v:unknown,status=200)=>new Response(JSON.stringify(v),{status,headers:{"Content-Type":"application/json"}});
const sid="11111111-1111-4111-8111-111111111111";
afterEach(()=>{cleanup();clearCsrf();vi.unstubAllGlobals();});
function sessionFixture(status:string|null,connected=true){const data={session_id:sid,execution_status:status,record_status:"PARTIAL",duration_minutes:30,active_duration_ms:120000,started_at:"2026-10-08T00:00:00Z",planned_end_at:new Date(Date.now()+1800000).toISOString(),ended_at:status==="ENDED"?"2026-10-08T00:02:00Z":undefined};const fetch=vi.fn(async(url:string,init?:RequestInit)=>{if(url.endsWith("/csrf"))return json({csrf_token:"test"});if(url.endsWith("/sessions/current"))return json(status?data:null);if(url.endsWith("/extension-installations"))return json(connected?[{executor_id:sid}]:[]);if(url.includes("/sites")||url.includes("/sessions?")||url.includes("/access-events?"))return json({items:[],next_cursor:null});if(url.endsWith("/policy"))return json({sites:[]});if(url.endsWith("/note"))return json({text:"",version:0});if(url.endsWith("/end"))return json({...data,execution_status:"ENDING"},202);if(url.endsWith("/sessions")&&init?.method==="POST")return json({...data,execution_status:"STARTING"},202);throw Error(url);});vi.stubGlobal("fetch",fetch);return fetch;}
describe("Figma 집중 화면 상태 (HTTP 모의; 실제 Extension 검증 아님)",()=>{
  it.each([null,"STARTING","RUNNING","ENDING","ENDED","UNKNOWN"])("%s에서도 타이머·정책·메모·기록 구조를 유지한다",async(status)=>{sessionFixture(status);render(<Sessions settings={()=>{}} records={()=>{}}/>);await waitFor(()=>expect(screen.queryByText("세션과 연결 상태를 확인하고 있습니다.")).not.toBeInTheDocument());expect(screen.getByRole("region",{name:"집중 타이머"})).toBeInTheDocument();expect(screen.getByLabelText("세션 메모 · 선택")).toBeInTheDocument();expect(screen.getByText("최근 종료 세션")).toBeInTheDocument();if(status==="STARTING"||status==="ENDING")expect(screen.getByRole("button",{name:"세션 종료"})).toBeDisabled();if(status==="STARTING")expect(screen.queryByText("집중 세션 진행")).not.toBeInTheDocument();if(status==="ENDED")expect(screen.getByRole("button",{name:"다음 집중 준비"})).toBeEnabled();});
  it("미연결은 구조를 유지하며 시작을 막고 다음 행동을 안내한다",async()=>{sessionFixture(null,false);render(<Sessions settings={()=>{}} records={()=>{}}/>);await screen.findByText(/회원 연결된 Extension이 없습니다/);expect(screen.getByRole("button",{name:"▶ 집중 시작"})).toBeDisabled();expect(screen.getByText("확장 프로그램 연결 방법")).toBeInTheDocument();fireEvent.click(screen.getByRole("button",{name:"50분"}));expect(screen.getByLabelText("집중 시간 (분)")).toHaveValue(50);});
  it("종료 확인 취소는 API를 호출하지 않고 확인 후에도 ENDING을 완료로 바꾸지 않는다",async()=>{const fetch=sessionFixture("RUNNING");render(<Sessions settings={()=>{}} records={()=>{}}/>);fireEvent.click(await screen.findByRole("button",{name:"세션 종료"}));fireEvent.click(screen.getByRole("button",{name:"계속 집중하기"}));expect(fetch.mock.calls.some(c=>c[0].endsWith("/end"))).toBe(false);fireEvent.click(screen.getByRole("button",{name:"세션 종료"}));fireEvent.click(screen.getByRole("button",{name:"종료 요청 확인"}));await screen.findByText(/정책 해제 결과를 기다리고 있습니다/);expect(screen.queryByRole("button",{name:"다음 집중 준비"})).not.toBeInTheDocument();});
});
it("메모 412는 최신값과 편집값을 보존하고 재시도에 최신 If-Match를 사용한다",async()=>{let reads=0;const fetch=vi.fn(async(url:string,init?:RequestInit)=>{if(url.endsWith("/csrf"))return json({csrf_token:"test"});if(init?.method==="PUT")return (init.headers as Record<string,string>)["If-Match"]==='"2"'?json({text:"편집값",version:3}):json({error:{code:"VERSION_CONFLICT"}},412);return json({text:++reads===1?"이전값":"다른 탭 최신값",version:reads});});vi.stubGlobal("fetch",fetch);render(<Note sessionId={sid}/>);await waitFor(()=>expect(screen.getByLabelText("세션 메모 · 선택")).toHaveValue("이전값"));fireEvent.change(screen.getByLabelText("세션 메모 · 선택"),{target:{value:"편집값"}});fireEvent.click(screen.getByRole("button",{name:"메모 저장"}));await screen.findByText(/최신 메모: 다른 탭 최신값/);expect(screen.getByLabelText("세션 메모 · 선택")).toHaveValue("편집값");fireEvent.click(screen.getByRole("button",{name:"최신 버전 기준으로 내 편집 계속"}));fireEvent.click(screen.getByRole("button",{name:"메모 저장"}));await screen.findByText("메모를 저장했습니다.");});
it("4열 목록에서 반복·처리 결과를 구분하고 상세 왕복 후 필터와 목록을 유지한다",async()=>{const items=[{event_id:"e1",session_id:sid,occurred_at:"2026-10-08T00:00:00Z",target_host:"audit.invalid",target_key:"SITE:audit.invalid",event_type:"BLOCKED_SITE_ACCESS",target_access_index:2,is_repeat:true,quality:"CONFIRMED"},{event_id:"e2",session_id:sid,occurred_at:"2026-10-08T00:00:01Z",target_host:"youtube.com",target_key:"FEATURE:youtube.com:YOUTUBE_SHORTS",feature_code:"YOUTUBE_SHORTS",event_type:"BLOCKED_FEATURE_ACCESS",target_access_index:1,is_repeat:false,quality:"CONFIRMED"}];vi.stubGlobal("fetch",vi.fn(async(url:string)=>{if(url.includes("/sessions?"))return json({items:[],next_cursor:null});if(url.includes("/statistics"))return json({quality:"PARTIAL"});if(url.includes("/access-events?"))return json({items,next_cursor:null});if(url.endsWith("/e1"))return json({...items[0],policy:{sites:[{canonical_host:"audit.invalid",purpose:"DISTRACTION",access_policy:"BLOCK"}]}});if(url.endsWith(sid))return json({session_id:sid,started_at:"2026-10-08T00:00:00Z",ended_at:"2026-10-08T00:02:00Z"});throw Error(url);}));render(<Records initialHost="" initialRange={{from:"",to:""}} settings={()=>{}}/>);await screen.findByText("반복 접근 · 2번째");expect(screen.getAllByRole("columnheader")).toHaveLength(4);fireEvent.click(screen.getByRole("checkbox",{name:"반복 접근만"}));expect(screen.queryByRole("button",{name:/YouTube Shorts.*상세/})).not.toBeInTheDocument();fireEvent.click(screen.getByRole("button",{name:/audit.invalid.*상세/}));await screen.findByText("발생 당시 적용 정책");expect(screen.queryByRole("table",{name:"접근 목록"})).not.toBeInTheDocument();await screen.findByText("2번째 · 반복");fireEvent.click(screen.getByRole("button",{name:"기록 목록으로"}));expect(screen.getByRole("checkbox",{name:"반복 접근만"})).toBeChecked();});

it("시작 실패 해제 확인 후 화면 구조를 유지하고 다음 시작을 준비할 수 있다",async()=>{
 let active=true;const failed={session_id:sid,execution_status:"START_FAILED",record_status:"PARTIAL",duration_minutes:30,active_duration_ms:0};
 vi.stubGlobal("fetch",vi.fn(async(url:string)=>{
  if(url.endsWith("/sessions/current"))return json(active?{...failed,execution_status:"STARTING"}:null);
  if(url.endsWith("/extension-installations"))return json([{executor_id:sid}]);
  if(url.endsWith("/policy"))return json({sites:[]});
  if(url.endsWith("/note"))return json({text:"",version:0});
  if(url.endsWith(sid))return json(failed);
  return json({items:[],next_cursor:null});
 }));render(<Sessions settings={()=>{}} records={()=>{}}/>);
 await screen.findByText(/실제 적용 결과를 기다리고/);active=false;
 fireEvent.click(screen.getByRole("button",{name:"연결·실행 상태 다시 확인"}));
 await screen.findByText("집중을 시작하지 못했어요");expect(screen.getByRole("region",{name:"집중 타이머"})).toBeInTheDocument();
 expect(screen.queryByRole("button",{name:"세션 종료"})).not.toBeInTheDocument();
 fireEvent.click(screen.getByRole("button",{name:"다시 집중 준비"}));
 await waitFor(()=>expect(screen.getByRole("button",{name:"▶ 집중 시작"})).toBeEnabled());
});
it("상태 조회 실패 뒤에는 마지막 화면을 유지해도 시작 요청을 허용하지 않는다",async()=>{
 let fail=false;vi.stubGlobal("fetch",vi.fn(async(url:string)=>{
  if(url.endsWith("/sessions/current"))return fail?json({error:{code:"VALIDATION_FAILED"}},422):json(null);
  if(url.endsWith("/extension-installations"))return json([{executor_id:sid}]);
  return json({items:[],next_cursor:null});
 }));render(<Sessions settings={()=>{}} records={()=>{}}/>);
 await waitFor(()=>expect(screen.getByRole("button",{name:"▶ 집중 시작"})).toBeEnabled());fail=true;
 fireEvent.click(screen.getByRole("button",{name:"연결·실행 상태 다시 확인"}));
 await screen.findByRole("alert");expect(screen.getByRole("button",{name:"▶ 집중 시작"})).toBeDisabled();
 expect(screen.getByRole("region",{name:"집중 타이머"})).toBeInTheDocument();
});

it("자동 복구 미지원 경계를 진행 화면에서도 명시한다",async()=>{
 sessionFixture("RUNNING");render(<Sessions settings={()=>{}} records={()=>{}}/>);
 await screen.findByText("집중 세션 진행");
 expect(screen.getByRole("note")).toHaveTextContent("자동 복구를 지원하지 않습니다");
});

it('start wake follows accepted Server request and never promotes STARTING to RUNNING',async()=>{
  vi.stubEnv('VITE_EXTENSION_ID','a'.repeat(32));
  const fetch=sessionFixture(null), base=fetch.getMockImplementation()!, events:string[]=[];
  let accepted=false;
  fetch.mockImplementation(async(url:string,init?:RequestInit)=>{
    if(url.endsWith('/sessions')&&init?.method==='POST'){events.push('accepted');accepted=true;}
    if(url.endsWith('/sessions/current')&&accepted)return json({session_id:sid,executor_id:sid,execution_status:'STARTING',record_status:'PARTIAL',duration_minutes:1,active_duration_ms:0});
    return base(url,init);
  });
  const sendMessage=vi.fn((_id,message,callback)=>{events.push('wake');callback({request_id:message.request_id,status:'OK',data:{received:true}});});
  vi.stubGlobal('chrome',{runtime:{sendMessage}});
  render(<Sessions settings={()=>{}} records={()=>{}}/>);
  const button=screen.getByRole('button',{name:'▶ 집중 시작'});await waitFor(()=>expect(button).toBeEnabled());fireEvent.click(button);
  await screen.findByText(/확장 프로그램의 실제 적용 결과를 기다리고 있습니다/);
  expect(events).toEqual(['accepted','wake']);expect(screen.queryByText('집중 세션 진행')).not.toBeInTheDocument();
  vi.unstubAllEnvs();
});
