import {render,screen,fireEvent,cleanup,waitFor} from "@testing-library/react";
import {afterEach,it,expect,vi} from "vitest";
import Settings from "./Settings";
import {clearCsrf} from "./api";
const json=(v:unknown,status=200)=>new Response(status===204?null:JSON.stringify(v),{status,headers:{"Content-Type":"application/json"}});
const user={display_name:"합성 테스트",email:"test@example.invalid",email_verified:true,providers:["EMAIL"]};
afterEach(()=>{cleanup();clearCsrf();vi.unstubAllGlobals();});
function setup(links:unknown[]=[],current:unknown=null) {
 let rows=links; const logout=vi.fn(),sites=vi.fn(),sessions=vi.fn();
 const fetch=vi.fn(async(url:string,init?:RequestInit)=>{
  if(url.endsWith("/csrf"))return json({csrf_token:"test"});
  if(url.endsWith("/extension-installations"))return json(rows);
  if(url.endsWith("/sessions/current"))return json(current);
  if(url.endsWith("/connection")&&init?.method==="DELETE"){rows=[];return json(null,204);}
  if(url.endsWith("/auth/logout")||url.endsWith("/reauthenticate"))return json(null,204);
  throw Error(url);
 });vi.stubGlobal("fetch",fetch);
 render(<Settings user={user} social={<p>소셜 연결 테스트</p>} refreshUser={async()=>{}} sites={sites} sessions={sessions} loggedOut={logout}/>);
 return {fetch,logout,sites,sessions};
}
it("설정에서 실제 계정·미연결·삭제 범위와 가능한 이동을 구분한다",async()=>{
 const t=setup();await screen.findByText("미연결");expect(screen.getByText(user.email)).toBeInTheDocument();
 expect(screen.getByText(/회원 탈퇴·회원 기록 일괄 삭제는 현재 제공 범위에 없습니다/)).toBeInTheDocument();
 expect(screen.queryByRole("button",{name:/자료 삭제/})).not.toBeInTheDocument();
 fireEvent.click(screen.getByRole("button",{name:"사이트 관리 열기"}));expect(t.sites).toHaveBeenCalled();
 fireEvent.click(screen.getByRole("button",{name:"집중 세션 상태 확인"}));expect(t.sessions).toHaveBeenCalled();
 fireEvent.click(screen.getByRole("button",{name:"로그아웃"}));await waitFor(()=>expect(t.logout).toHaveBeenCalled());
});
it("해제 미확인 실행에서는 연결 종료·로그아웃을 잠그고 해제 경로를 안내한다",async()=>{
 setup([{executor_id:"e",client_version:"synthetic",last_seen_at:null,execution_status:"UNKNOWN"}],{execution_status:"UNKNOWN"});
 await screen.findByText("회원 연결 1개");expect(screen.getByRole("button",{name:"이 설치의 회원 연결 종료"})).toBeDisabled();
 expect(screen.getByRole("button",{name:"로그아웃"})).toBeDisabled();expect(screen.getByText(/집중 세션에서 해제 결과를 먼저/)).toBeInTheDocument();
});
it("대상 설치 확인 후 연결 종료하며 다른 설치를 자동 삭제하지 않는다",async()=>{
 const t=setup([{executor_id:"e",client_version:"synthetic",last_seen_at:null,execution_status:"IDLE"}]);
 await screen.findByText("회원 연결 1개");fireEvent.click(screen.getByRole("button",{name:"이 설치의 회원 연결 종료"}));
 expect(t.fetch.mock.calls.some(c=>c[1]?.method==="DELETE")).toBe(false);
 fireEvent.click(screen.getByRole("button",{name:"연결 종료 확인"}));
 await waitFor(()=>expect(screen.getByRole("button",{name:"로그아웃"})).toBeEnabled());
 expect(t.fetch.mock.calls.filter(c=>c[1]?.method==="DELETE").map(c=>c[0])).toEqual(["/api/v1/extension-installations/e/connection"]);
});
it("재인증 성공 후 비밀번호 입력을 지우며 로그아웃과 별도로 안내한다",async()=>{
 setup();await screen.findByText("미연결");fireEvent.click(screen.getByText("계정 재인증 · 소셜 연결 전 본인 확인"));
 fireEvent.change(screen.getByLabelText("현재 계정 비밀번호"),{target:{value:"synthetic-test-only"}});
 fireEvent.click(screen.getByRole("button",{name:"비밀번호로 재인증"}));await screen.findByText(/현재 계정을 재인증했습니다/);
 expect(screen.getByLabelText("현재 계정 비밀번호")).toHaveValue("");
});
