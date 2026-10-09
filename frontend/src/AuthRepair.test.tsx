import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

import { SocialEmailVerify, SocialSignup } from "./SocialSignup";
import GuestImports, { validateImportManifest } from "./GuestImports";
import { clearCsrf } from "./api";
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { "Content-Type": "application/json" } });
afterEach(() => { cleanup(); clearCsrf(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); window.history.replaceState(null,"","/"); });
it("일반 인증 안내는 개발·검토·외부 환경 모두 Mailpit 링크를 표시하지 않는다", async () => {
  const {MailHelp}=await import("./UiLayout");const view=render(<MailHelp environment={{DEV:true,VITE_MAIL_MODE:"mailpit"}}/>);
  expect(screen.queryByRole("link",{name:/개발용 Mailpit/})).not.toBeInTheDocument();
  view.rerender(<MailHelp environment={{DEV:true,VITE_MAIL_MODE:"mailpit",VITE_DEV_MAILBOX_URL:"http://127.0.0.1:8026"}}/>);
  expect(screen.queryByRole("link",{name:/개발용 Mailpit/})).not.toBeInTheDocument();
  view.rerender(<MailHelp environment={{DEV:true,VITE_MAIL_MODE:"external"}}/>);expect(screen.queryByRole("link",{name:/개발용 Mailpit/})).not.toBeInTheDocument();
  view.rerender(<MailHelp environment={{DEV:false,VITE_MAIL_MODE:"mailpit"}}/>);expect(screen.queryByRole("link",{name:/개발용 Mailpit/})).not.toBeInTheDocument();
});
it("소셜 이메일을 인증하기 전 가입을 막고 인증 후 원래 가입 창에서 완료한다", async () => {
  let verified=false;const calls: {path:string;body?:string}[]=[];
  vi.stubGlobal("fetch",vi.fn(async (path:string,init?:RequestInit) => {calls.push({path,body:init?.body as string});
    if(path.endsWith("/csrf"))return json({csrf_token:"synthetic"});
    if(path.endsWith("signup-info"))return json({provider:"kakao",email:verified?"contact@example.invalid":null,email_verified:verified});
    return json({}); }));
  const done=vi.fn(async()=>{});render(<SocialSignup ticket="synthetic-ticket" done={done} terms={<p>약관 테스트</p>}/>);
  await screen.findByText(/제공자에서 인증된 이메일을 받지 못했습니다/);expect(screen.getByRole("button",{name:"가입 확정"})).toBeDisabled();
  fireEvent.change(screen.getByLabelText("서비스 이메일"),{target:{value:"contact@example.invalid"}});fireEvent.click(screen.getByRole("button",{name:"이메일 인증 메일 받기"}));
  await screen.findByText(/원래 소셜 가입|메일의 링크에서 인증한 뒤/);verified=true;
  fireEvent.click(screen.getByRole("button",{name:"이메일 인증 상태 새로고침"}));await screen.findByText("contact@example.invalid");
  fireEvent.change(screen.getByLabelText("표시명"),{target:{value:"검증"}});fireEvent.click(screen.getByRole("button",{name:"가입 확정"}));await waitFor(()=>expect(done).toHaveBeenCalled());
  expect(calls.filter(c=>c.path.endsWith("/complete"))).toHaveLength(1);
});
it("인증 링크 오류를 표시하고 성공으로 넘기지 않는다",async()=>{
  vi.stubGlobal("fetch",vi.fn(async()=>json({error:{code:"TOKEN_EXPIRED"}},410)));
  render(<SocialEmailVerify token="synthetic"/>);fireEvent.click(screen.getByRole("button",{name:"이메일 인증 완료하기"}));
  expect(await screen.findByRole("alert")).toHaveTextContent(/만료/);expect(screen.queryByText(/이메일 인증을 완료했습니다/)).not.toBeInTheDocument();
});
it("로그인만으로 비회원 자료를 조회·전송하지 않고 미연결을 정확히 안내한다",async()=>{
  const fetch=vi.fn();vi.stubGlobal("fetch",fetch);vi.stubEnv("VITE_EXTENSION_ID","");
  render(<GuestImports owner="42"/>);expect(fetch).not.toHaveBeenCalled();fireEvent.click(screen.getByRole("button",{name:"가져올 자료 확인"}));
  expect(await screen.findByRole("alert")).toHaveTextContent(/연결 가능한 확장 프로그램이 없습니다/);expect(fetch).not.toHaveBeenCalled();
});
it("다른 계정의 Extension 목록을 선택 화면에 표시하지 않는다",()=>{
  expect(()=>validateImportManifest({format_version:"1.0",owner_user_id:"43",executor_id:crypto.randomUUID(),items:[]},"42")).toThrow(/계정 또는 자료 형식/);
});
it("선택한 원본 ID만 전달하고 저장 성공은 Server 결과로 확인한다",async()=>{
  vi.stubEnv("VITE_EXTENSION_ID","a".repeat(32));const first=crypto.randomUUID(),second=crypto.randomUUID(),batch=crypto.randomUUID();
  const items=[{source_item_id:first,source_hash:"a".repeat(64),type:"SITE",label:"첫 사이트"},{source_item_id:second,source_hash:"b".repeat(64),type:"SESSION",label:"두 번째 기록"}];
  const bridge=vi.fn((_id:string,body:{type:string},callback:(v:unknown)=>void)=>callback(body.type.endsWith("LIST")?{format_version:"1.0",owner_user_id:"42",executor_id:crypto.randomUUID(),items}:{batch_id:batch}));
  vi.stubGlobal("chrome",{runtime:{sendMessage:bridge}});vi.stubGlobal("fetch",vi.fn(async(path:string)=>json(path.endsWith("/guest-imports")?{items:[{batch_id:batch,status:"PARTIAL",created_at:new Date().toISOString(),items:[{source_item_id:first,item_type:"SITE",status:"SUCCEEDED",error_code:null}]}],next_cursor:null}:{batch_id:batch})));
  render(<GuestImports owner="42"/>);fireEvent.click(screen.getByRole("button",{name:"가져올 자료 확인"}));const choices=await screen.findAllByRole("checkbox");fireEvent.click(choices[0]);fireEvent.click(screen.getByRole("button",{name:"선택한 자료 가져오기"}));
  await screen.findByText(/선택한 자료의 처리 결과를 확인하세요/);expect(bridge.mock.calls[1][1]).toMatchObject({type:"FOCURVE_GUEST_IMPORT_SUBMIT",items:[{source_item_id:first}]});expect(bridge.mock.calls[1][1]).not.toHaveProperty("access_token");
});
