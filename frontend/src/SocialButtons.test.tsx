import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import SocialButtons from "./SocialButtons";
import MemberApp from "./MemberApp";
import { ApiError, clearCsrf, socialAuthorizationPath } from "./api";

vi.mock("./api", async importOriginal => ({ ...await importOriginal<typeof import("./api")>(), socialAuthorizationPath: vi.fn() }));
const authorize = vi.mocked(socialAuthorizationPath);
const json=(value:unknown,status=200)=>new Response(JSON.stringify(value),{status,headers:{"Content-Type":"application/json"}});
beforeEach(() => { window.history.replaceState(null,"","/"); authorize.mockReset(); authorize.mockImplementation(async(provider,mode)=>`/api/v1/auth/social/${provider}/authorize?mode=${mode}&return_path=%2F`); });
afterEach(() => { cleanup(); clearCsrf(); vi.unstubAllGlobals(); window.history.replaceState(null,"","/"); });
async function ready(){await waitFor(()=>expect(screen.getByRole("button",{name:"카카오로 로그인"})).toBeEnabled());}

it("로그인 레이블·공식 자산을 표시하고 이동 요청 중 양쪽 버튼을 잠근다",async()=>{
 const navigate=vi.fn();render(<SocialButtons navigate={navigate}/>);await ready();
 let finish!:(path:string)=>void;authorize.mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve}));
 fireEvent.click(screen.getByRole("button",{name:"Google로 로그인"}));
 fireEvent.click(screen.getByRole("button",{name:"Google로 로그인"}));fireEvent.click(screen.getByRole("button",{name:"카카오로 로그인"}));
 expect(authorize).toHaveBeenCalledTimes(3);expect(screen.getByRole("button",{name:"카카오로 로그인"})).toBeDisabled();
 expect(screen.getByRole("status")).toHaveTextContent("Google 로그인으로 이동 중");
 await act(async()=>finish("/api/v1/auth/social/google/authorize?mode=login"));
 expect(navigate).toHaveBeenCalledOnce();expect(screen.getByRole("button",{name:"Google로 로그인"})).toBeDisabled();
 expect(document.querySelector('.social-symbol-google img')).toHaveAttribute('src','/social/google-official-icon-button.png');
 expect(document.querySelector('.social-symbol-kakao img')).toHaveAttribute('src','/social/kakao-symbol.svg');
});
it("요청 실패를 알리고 버튼 잠금을 해제해 재시도할 수 있다",async()=>{
 const navigate=vi.fn();render(<SocialButtons navigate={navigate}/>);await ready();authorize.mockRejectedValueOnce(new ApiError("CSRF_UNAVAILABLE",503));
 fireEvent.click(screen.getByRole("button",{name:"카카오로 로그인"}));expect(await screen.findByRole("alert")).toHaveTextContent("요청 인증 정보를 준비하지 못했습니다");
 expect(navigate).not.toHaveBeenCalled();expect(screen.getByRole("button",{name:"Google로 로그인"})).toBeEnabled();
 fireEvent.click(screen.getByRole("button",{name:"카카오로 로그인"}));await waitFor(()=>expect(navigate).toHaveBeenCalledOnce());expect(screen.queryByRole("alert")).not.toBeInTheDocument();
});
it("브라우저 뒤로 가기로 돌아오면 다시 로그인할 수 있다",async()=>{
 const navigate=vi.fn();render(<SocialButtons navigate={navigate}/>);await ready();fireEvent.click(screen.getByRole("button",{name:"Google로 로그인"}));await waitFor(()=>expect(navigate).toHaveBeenCalled());
 act(()=>{const event=new Event("pageshow");Object.defineProperty(event,"persisted",{value:true});window.dispatchEvent(event)});
 expect(screen.getByRole("button",{name:"Google로 로그인"})).toBeEnabled();expect(screen.getByRole("status")).toHaveTextContent("로그인을 완료하지 않고 돌아왔습니다");
});
it("화면을 떠난 뒤 늦게 끝난 요청은 외부 인증 화면을 열지 않는다",async()=>{
 const navigate=vi.fn();const view=render(<SocialButtons navigate={navigate}/>);await ready();let finish!:(path:string)=>void;
 authorize.mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve}));fireEvent.click(screen.getByRole("button",{name:"Google로 로그인"}));view.unmount();await act(async()=>finish("/late"));expect(navigate).not.toHaveBeenCalled();
});
it("소셜 연결 버튼은 기존 link 모드·연결 상태를 유지한다",async()=>{
 const navigate=vi.fn();render(<SocialButtons link providers={["GOOGLE"]} navigate={navigate}/>);
 const button=screen.getByRole("button",{name:"Google · 연결됨 · 재인증 시작"});await waitFor(()=>expect(button).toBeEnabled());fireEvent.click(button);await waitFor(()=>expect(navigate).toHaveBeenCalled());expect(authorize).toHaveBeenLastCalledWith("google","link");
});
it.each([['#social-canceled','소셜 로그인이 취소되었습니다.'],['#social-error?code=INVALID_STATE','소셜 인증 요청을 확인할 수 없습니다.']])("%s에서도 로그인·재시도 경로를 제공하고 다른 화면에 안내를 남기지 않는다",async(hash,notice)=>{
 window.history.replaceState(null,"","/"+hash);vi.stubGlobal("fetch",vi.fn(async()=>json({error:{code:"UNAUTHENTICATED"}},401)));
 render(<MemberApp/>);await ready();expect(screen.getByRole("alert")).toHaveTextContent(notice);expect(screen.getByRole("button",{name:"이메일 로그인"})).toBeEnabled();
 fireEvent.click(screen.getByRole("button",{name:"회원가입"}));await screen.findByRole("button",{name:"회원가입"});expect(screen.queryByText(notice,{exact:false})).not.toBeInTheDocument();
});
it("최초 소셜 가입은 인증 이메일·필수 동의 후 확정하고 대시보드로 이동한다",async()=>{
 window.history.replaceState(null,"","/#social-complete?ticket=synthetic-ui-ticket");let complete=false;
 const fetch=vi.fn(async(path:string)=>{
  if(path.endsWith('/csrf'))return json({csrf_token:'synthetic'});
  if(path.endsWith('/signup-info'))return json({provider:'google',email:'social-ui@example.invalid',email_verified:true});
  if(path.endsWith('/complete')){complete=true;return json({});}
  if(path.endsWith('/me'))return complete?json({user_id:'synthetic',display_name:'소셜 UI 검증',email:'social-ui@example.invalid',providers:['GOOGLE']}):json({error:{code:'UNAUTHENTICATED'}},401);
  if(path.endsWith('/dashboard'))return json({current_session:null,recent_sessions:[],recent_access:[],summary:{quality:'NO_DATA'}});
  return json({items:[],next_cursor:null});
 });vi.stubGlobal('fetch',fetch);render(<MemberApp/>);await screen.findByText('social-ui@example.invalid');
 fireEvent.change(screen.getByLabelText('표시명'),{target:{value:'소셜 UI 검증'}});fireEvent.click(screen.getByRole('button',{name:'가입 확정'}));expect(complete).toBe(false);
 fireEvent.click(screen.getByRole('checkbox'));fireEvent.click(screen.getByRole('button',{name:'가입 확정'}));await screen.findByRole('heading',{name:'집중 현황'});expect(complete).toBe(true);expect(window.location.hash).toBe('');
});

it("가입 버튼 문구에서도 기존 login 인증 경로를 유지한다",async()=>{const navigate=vi.fn();render(<SocialButtons signup navigate={navigate}/>);const button=screen.getByRole("button",{name:"Google로 가입"});await waitFor(()=>expect(button).toBeEnabled());fireEvent.click(button);await waitFor(()=>expect(navigate).toHaveBeenCalled());expect(authorize).toHaveBeenLastCalledWith("google","login");});
