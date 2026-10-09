import {describe,it,expect,vi,afterEach} from "vitest";
import {render,screen,fireEvent,cleanup} from "@testing-library/react";
import {selectSitePolicy} from "./sitePolicy";
import Records from "./BehaviorRecords";
import {clearCsrf} from "./api";
const parent={canonical_host:"naver.com",include_subdomains:true,access_policy:"ALLOW",purpose:"GENERAL",site_id:"1"};
const child={canonical_host:"chzzk.naver.com",include_subdomains:true,access_policy:"BLOCK",purpose:"DISTRACTION",site_id:"2"};
const exception={canonical_host:"clips.chzzk.naver.com",include_subdomains:false,access_policy:"ALLOW",purpose:"GENERAL",site_id:"3"};
describe("호스트 경계와 가장 구체적인 정책",()=>{
  it.each([
    ["naver.com","naver.com"],["chzzk.naver.com","chzzk.naver.com"],
    ["live.chzzk.naver.com","chzzk.naver.com"],["clips.chzzk.naver.com","clips.chzzk.naver.com"],
    ["x.clips.chzzk.naver.com","chzzk.naver.com"],["notnaver.com",undefined],
    ["naver.com.evil.example",undefined],["notchzzk.naver.com","naver.com"],
  ])("%s → %s; 등록 순서와 무관",(host,winner)=>{
    for(const rules of [[parent,child,exception],[exception,child,parent]])expect(selectSitePolicy(rules,host)?.canonical_host).toBe(winner);
  });
  it("하위 도메인 포함은 적용 범위만 결정하고 더 구체적인 ALLOW도 부모 BLOCK보다 우선한다",()=>{
    const block={...parent,access_policy:"BLOCK"},allow={...child,include_subdomains:false,access_policy:"ALLOW"};
    expect(selectSitePolicy([block,allow],"chzzk.naver.com")).toBe(allow);
    expect(selectSitePolicy([allow,block],"live.chzzk.naver.com")).toBe(block);
    expect(selectSitePolicy([{...block,include_subdomains:false}],"chzzk.naver.com")).toBeUndefined();
  });
});
afterEach(()=>{cleanup();clearCsrf();vi.unstubAllGlobals();});
it("기록 상세는 부모가 먼저 있어도 발생 당시의 자식 정책을 보여준다 (HTTP 모의)",async()=>{
  const event={event_id:"e",session_id:"s",target_host:"chzzk.naver.com",target_key:"SITE:chzzk.naver.com",event_type:"BLOCKED_SITE_ACCESS",occurred_at:"2026-10-08T01:00:00Z",is_repeat:false,target_access_index:1,quality:"CONFIRMED",policy:{sites:[parent,child]}};
  const reply=(v:unknown)=>new Response(JSON.stringify(v),{status:200,headers:{"Content-Type":"application/json"}});
  vi.stubGlobal("fetch",vi.fn(async(url:string)=>{
    if(url.endsWith("/access-events/e"))return reply(event);
    if(url.includes("/access-events?"))return reply({items:[event],next_cursor:null});
    if(url.endsWith("/sessions/s"))return reply({session_id:"s",started_at:event.occurred_at,ended_at:event.occurred_at});
    if(url.includes("/sessions?"))return reply({items:[],next_cursor:null});
    if(url.includes("/statistics/summary"))return reply({quality:"PARTIAL"});
    throw Error(url);
  }));
  render(<Records initialHost="" initialRange={{from:"2026-10-08",to:"2026-10-08"}} settings={()=>{}}/>);
  fireEvent.click(await screen.findByRole("button",{name:/chzzk.naver.com.*상세/}));
  expect(await screen.findByText(/적용 호스트: chzzk.naver.com/)).toHaveTextContent("분류: 방해");
  expect(screen.getByText(/적용 호스트: chzzk.naver.com/)).toHaveTextContent("관리 방식: 전체 차단");
});
