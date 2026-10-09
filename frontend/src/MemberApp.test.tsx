import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
import {
  act,
  render,
  screen,
  fireEvent,
  cleanup,
  waitFor,
} from "@testing-library/react";
import MemberApp from "./MemberApp";
import { refreshCsrf, clearCsrf } from "./api";

function json(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
beforeEach(() => {
  window.history.replaceState(null, "", "/");
  sessionStorage.clear();
});
afterEach(async () => {
  cleanup();
  clearCsrf();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  await new Promise(resolve => setTimeout(resolve, 0));
});
describe("회원 Web 입력 및 실패 처리 (HTTP 모의 검증)", () => {
  it("추가 시간대 분석을 활성 기능이나 예시 차트로 표시하지 않는다", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      if (url.endsWith("/me")) return json({user_id:"1",display_name:"검증",providers:["EMAIL"]});
      if (url.endsWith("/extension-installations")) return json([]);
      if (url.startsWith("/api/v1/sites")) return json({items:[],next_cursor:null,has_more:false});
      if (url.startsWith("/api/v1/statistics/summary")) return json({quality:"NO_DATA"});
      if (url.endsWith("/dashboard")) return json({current_session:null,recent_sessions:[],recent_access:[],summary:{quality:"NO_DATA"}});
      throw new Error("unexpected request");
    }));
    render(<MemberApp />);
    await screen.findByText("시간대별 분석은 아직 제공하지 않습니다.");
    expect(screen.queryByRole("img", {name:/0시/})).not.toBeInTheDocument();
  });
  it("미설정 소셜 제공자를 비활성화하고 이메일 인증과 분리한다", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      if (url.endsWith("/csrf")) return json({ csrf_token: "test-csrf" });
      if (url.includes("/social/")) return json({ error: { code: "PROVIDER_UNAVAILABLE" } }, 503);
      return json({ error: { code: "UNAUTHENTICATED" } }, 401);
    }));
    render(<MemberApp />);
    await screen.findByText("Google 로그인은 아직 사용할 수 없습니다. 이메일로 로그인해 주세요.");
    await screen.findByText("카카오 로그인은 아직 사용할 수 없습니다. 이메일로 로그인해 주세요.");
    expect(screen.getByRole("button", { name: "Google로 로그인" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "카카오로 로그인" })).toBeDisabled();
  });
  it("이메일 인증 성공 후 재사용 거절 시 이전 성공 문구를 제거한다", async () => {
    window.history.replaceState(null, "", "/#verify?token=test-only");
    let consumed = false;
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      if (url.endsWith("/me"))
        return json({ error: { code: "UNAUTHENTICATED" } }, 401);
      if (url.endsWith("/email/verify")) {
        if (consumed) return json({ error: { code: "USED_TOKEN" } }, 409);
        consumed = true;
        return json({ verified: true });
      }
      throw new Error("unexpected request");
    }));
    render(<MemberApp />);
    fireEvent.click(screen.getByRole("button", { name: /이메일 인증 완료하기|새 비밀번호 저장하기/ }));
    await screen.findByText("이메일 인증을 완료했습니다. 로그인하세요.");
    window.history.replaceState(null, "", "/#verify?token=test-only");
    fireEvent(window, new HashChangeEvent("hashchange"));
    fireEvent.click(await screen.findByRole("button", { name: "이메일 인증 완료하기" }));
    await screen.findByText("이미 사용된 인증 링크입니다.");
    expect(screen.queryByText("이메일 인증을 완료했습니다. 로그인하세요.")).not.toBeInTheDocument();
  });
  it("확장 연결 승인 보류를 연결 성공으로 표시하거나 자동 재시도하지 않는다", async () => {
    window.history.replaceState(
      null,
      "",
      "/#link?id=11111111-1111-4111-8111-111111111111",
    );
    const fetch = vi.fn(async (url: string) => {
      if (url.endsWith("/me"))
        return json({
          user_id: "1",
          display_name: "검증",
          providers: ["EMAIL"],
        });
      if (url.endsWith("/csrf")) return json({ csrf_token: "test-only" });
      if (url.endsWith("/approval"))
        return json(
          {
            error: {
              code: "LINK_APPROVAL_CONTRACT_UNRESOLVED",
              retryable: true,
            },
          },
          503,
        );
      throw new Error("unexpected request");
    });
    vi.stubGlobal("fetch", fetch);
    render(<MemberApp />);
    fireEvent.click(
      await screen.findByRole("button", { name: "연결 승인 요청" }),
    );
    await screen.findByText(
      "확장 프로그램 연결 확인 절차가 준비되지 않아 연결할 수 없습니다. 연결 완료로 처리하지 않았습니다.",
    );
    expect(
      fetch.mock.calls.filter(([url]) => url.endsWith("/approval")),
    ).toHaveLength(1);
    expect(
      screen.queryByText("연결 요청 응답을 받았습니다.", { exact: false }),
    ).not.toBeInTheDocument();
  });
  it("로그인된 브라우저도 재설정 링크를 처리하고 성공 후 회원 화면을 제거한다", async () => {
    window.history.replaceState(null, "", "/#reset?token=test-only");
    const fetch = vi.fn(async (url: string) => {
      if (url.endsWith("/me"))
        return json({
          user_id: "1",
          display_name: "검증",
          providers: ["EMAIL"],
        });
      if (url.endsWith("/password/reset"))
        return new Response(null, { status: 204 });
      throw new Error("unexpected request");
    });
    vi.stubGlobal("fetch", fetch);
    render(<MemberApp />);
    await waitFor(() => expect(fetch).toHaveBeenCalled());
    fireEvent.change(screen.getByLabelText("새 비밀번호"), { target: { value: "changed-test-password-1234" } });
    fireEvent.change(screen.getByLabelText("새 비밀번호 확인"), { target: { value: "changed-test-password-1234" } });
    fireEvent.click(screen.getByRole("button", { name: /이메일 인증 완료하기|새 비밀번호 저장하기/ }));
    await screen.findByText("비밀번호를 변경했습니다. 다시 로그인하세요.");
    fireEvent.click(screen.getByRole("link", { name: /로그인으로 이동|로그인으로 돌아가기/ }));
    fireEvent(window, new HashChangeEvent("hashchange"));
    expect(
      await screen.findByRole("button", { name: "이메일 로그인" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("이메일")).toHaveValue("");
    expect(screen.getByLabelText("비밀번호")).toHaveValue("");
    expect(
      screen.queryByRole("navigation", { name: "회원 메뉴" }),
    ).not.toBeInTheDocument();
    expect(
      fetch.mock.calls.some(([url]) => url.endsWith("/password/reset")),
    ).toBe(true);
  });
  it("가입 통신 실패 후 입력과 동일 멱등 키를 유지한다", async () => {
    const calls: RequestInit[] = [];
    const fetch = vi.fn(async (url: string, init?: RequestInit) => {
      if (url.endsWith("/csrf")) return json({ csrf_token: "test-csrf" });
      if (url.endsWith("/me"))
        return json({ error: { code: "UNAUTHENTICATED" } }, 401);
      if (url.includes("/social/")) return json({ error: { code: "PROVIDER_UNAVAILABLE" } }, 503);
      if (url.endsWith('/signup-code-requests')) return json({request_id:'test-code-request',expires_at:new Date(Date.now()+600000).toISOString(),resend_after_seconds:60},202);
      if (url.endsWith('/signup-code-verifications')) return json({verification_proof:'synthetic-proof',proof_expires_at:new Date(Date.now()+600000).toISOString()});
      calls.push(init!);
      if (calls.length <= 7) throw new TypeError("offline");
      return json({ user_id: "1", status: "ACTIVE",email_verified:true }, 201);
    });
    vi.stubGlobal("fetch", fetch);
    await refreshCsrf();
    render(<MemberApp />);
    fireEvent.click(screen.getByRole("button", { name: "회원가입" }));
    expect(screen.getByRole('link',{name:'FOCURVE 로그인'})).toHaveAttribute('href','#login');
    expect(screen.getByText('개발·테스트용 임시 약관입니다.')).toBeInTheDocument();
    expect(screen.getByText('내용 보기').closest('details')).not.toHaveAttribute('open');
    expect(screen.getByRole('checkbox',{name:/개발·테스트용 임시 약관 dev-v1/})).toBeRequired();
    fireEvent.change(screen.getByLabelText("이메일"), {
      target: { value: "test@example.invalid" },
    });
    fireEvent.click(screen.getByRole('button',{name:'인증번호 받기'}));
    await screen.findByLabelText('인증번호');
    fireEvent.change(screen.getByLabelText('인증번호'),{target:{value:'123456'}});
    fireEvent.click(screen.getByRole('button',{name:'확인'}));
    await screen.findByText('✓ 이메일 인증 완료');
    fireEvent.change(screen.getByLabelText("표시명"), {
      target: { value: "검증" },
    });
    fireEvent.change(screen.getByLabelText("비밀번호", { exact: true }), {
      target: { value: "test-password-1234" },
    });
    fireEvent.change(screen.getByLabelText("비밀번호 확인"), {
      target: { value: "test-password-1234" },
    });
    fireEvent.click(screen.getByRole("checkbox"));
    await act(async () => {});
    vi.useFakeTimers();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "회원가입" }));
      await vi.advanceTimersByTimeAsync(80000);
    });
    vi.useRealTimers();
    expect(await screen.findByRole("alert")).toHaveTextContent("입력을 보존");
    expect(screen.getByLabelText("이메일")).toHaveValue("test@example.invalid");
    fireEvent.click(screen.getByRole("button", { name: "회원가입" }));
    await screen.findByText(
      "가입 완료",
    );
    expect(calls).toHaveLength(8);
    expect(calls[0].headers).toEqual(calls[7].headers);
    expect(calls[0].body).toBe(calls[7].body);
  });
  it("비밀번호 확인 불일치는 가입 API를 호출하지 않는다", async () => {
    const fetch = vi.fn(async (_url: string) =>
      json({ error: { code: "UNAUTHENTICATED" } }, 401),
    );
    vi.stubGlobal("fetch", fetch);
    render(<MemberApp />);
    fireEvent.click(screen.getByRole("button", { name: "회원가입" }));
    fireEvent.change(screen.getByLabelText("비밀번호", { exact: true }), {
      target: { value: "test-password-1234" },
    });
    fireEvent.submit(
      screen.getByRole("button", { name: "회원가입" }).closest("form")!,
    );
    await screen.findByText("비밀번호 확인이 일치하지 않습니다.");
    expect(fetch.mock.calls.some((c) => String(c[0]).endsWith("/signup"))).toBe(
      false,
    );
  });
  it("같은 문서에서 인증 링크의 hash가 변경되어도 확인 화면으로 이동한다", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => json({ error: { code: "UNAUTHENTICATED" } }, 401)),
    );
    render(<MemberApp />);
    window.history.replaceState(null, "", "/#verify?token=test-only");
    fireEvent(window, new HashChangeEvent("hashchange"));
    expect(
      await screen.findByRole("button", { name: /이메일 인증 완료하기|새 비밀번호 저장하기/ }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("link", { name: /로그인으로 이동|로그인으로 돌아가기/ }));
    fireEvent(window, new HashChangeEvent("hashchange"));
    expect(
      await screen.findByRole("button", { name: "이메일 로그인" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("이메일")).toHaveValue("");
    expect(screen.getByLabelText("비밀번호")).toHaveValue("");
  });
  it("Extension의 실제 확인 전 STARTING을 진행 성공으로 바꾸지 않는다", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url.endsWith("/me"))
          return json({
            user_id: "1",
            display_name: "검증",
            providers: ["EMAIL"],
          });
        if (url.endsWith("/sessions/current"))
          return json({
            session_id: "test",
            execution_status: "STARTING",
            record_status: "PENDING",
            active_duration_ms: 0,
          });
        if (url.endsWith("/extension-installations")) return json([]);
        if (url.startsWith("/api/v1/sessions?")) return json({items:[],next_cursor:null});
        if (url.startsWith("/api/v1/sites")) return json({items:[],next_cursor:null});
        if (url.endsWith("/note")) return json({text:"",version:0});
        return json({
          current_session: null,
          recent_sessions: [],
          recent_access: [],
          summary: { quality: "NO_DATA" },
        });
      }),
    );
    render(<MemberApp />);
    await screen.findByText("검증 · EMAIL");
    fireEvent.click(screen.getByRole("button", { name: "집중 세션" }));
    await waitFor(() =>
      expect(screen.getByText(/실행 상태: 시작 확인 중/)).toBeInTheDocument(),
    );
    expect(screen.getByRole("button", { name: "세션 종료" })).toBeDisabled();
    expect(screen.queryByText("RUNNING")).not.toBeInTheDocument();
  });
});

it("로그인은 두 입력만 제공하고 재설정 요청을 별도 화면으로 이동한다",async()=>{
  vi.stubGlobal("fetch",vi.fn(async(url:string)=>url.endsWith("/csrf")?json({csrf_token:"test"}):json({error:{code:"UNAUTHENTICATED"}},401)));
  render(<MemberApp/>);
  expect(screen.getAllByRole("textbox")).toHaveLength(1);
  expect(screen.queryByText("인증 메일 재발송")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("link",{name:"비밀번호를 잊으셨나요?"}));
  await screen.findByRole("heading",{name:"비밀번호 재설정 요청"});
  expect(screen.queryByLabelText("비밀번호")).not.toBeInTheDocument();
});
it("미인증 로그인은 대상 이메일을 가진 대기 화면으로 이동하고 재발송한다",async()=>{
  const fetch=vi.fn(async(url:string)=>{
    if(url.endsWith("/csrf"))return json({csrf_token:"test"});
    if(url.endsWith("/login"))return json({error:{code:"EMAIL_UNVERIFIED"}},403);
    if(url.endsWith("/verification-requests"))return new Response(null,{status:202});
    return json({error:{code:"UNAUTHENTICATED"}},401);
  });vi.stubGlobal("fetch",fetch);render(<MemberApp/>);
  fireEvent.change(screen.getByLabelText("이메일"),{target:{value:"pending@example.invalid"}});
  fireEvent.change(screen.getByLabelText("비밀번호"),{target:{value:"test-only-password"}});
  fireEvent.click(screen.getByRole("button",{name:"이메일 로그인"}));
  await screen.findByRole("heading",{name:"이메일 인증 대기"});
  expect(screen.getByText("pending@example.invalid")).toBeInTheDocument();
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button",{name:"인증 메일 다시 받기"}));
  await screen.findByText(/인증 메일 요청을 접수했습니다/);
  cleanup();render(<MemberApp/>);
  expect(screen.getByRole("heading",{name:"이메일 인증 대기"})).toBeInTheDocument();
  expect(screen.queryByText(/인증 메일 요청을 접수했습니다/)).not.toBeInTheDocument();
});
it("재설정 요청 결과는 계정 유무를 공개하지 않고 이동하면 남지 않는다",async()=>{
  window.history.replaceState(null,"","/#password-request");
  vi.stubGlobal("fetch",vi.fn(async(url:string)=>url.endsWith("/csrf")?json({csrf_token:"test"}):url.endsWith("/reset-requests")?new Response(null,{status:202}):json({error:{code:"UNAUTHENTICATED"}},401)));
  render(<MemberApp/>);fireEvent.change(screen.getByLabelText("이메일"),{target:{value:"missing@example.invalid"}});
  fireEvent.click(screen.getByRole("button",{name:"재설정 메일 요청"}));
  await screen.findByText("요청을 접수했습니다. 해당 이메일로 등록된 계정이 있다면 재설정 안내 메일을 확인해 주세요.");
  window.history.replaceState(null,"","/#login");fireEvent(window,new PopStateEvent("popstate"));
  expect(screen.queryByText(/요청을 접수했습니다/)).not.toBeInTheDocument();
});
it("직접 접속한 재설정 링크는 확인 불일치를 거절하고 재입력값을 보존한다",async()=>{
  window.history.replaceState(null,"","/#reset?token=test-only");
  const fetch=vi.fn(async(_url: string)=>json({error:{code:"UNAUTHENTICATED"}},401));vi.stubGlobal("fetch",fetch);render(<MemberApp/>);
  fireEvent.change(screen.getByLabelText("새 비밀번호"),{target:{value:"test-password-one"}});
  fireEvent.change(screen.getByLabelText("새 비밀번호 확인"),{target:{value:"test-password-two"}});
  fireEvent.submit(screen.getByRole("button",{name:"새 비밀번호 저장하기"}).closest("form")!);
  expect(screen.getByRole("alert")).toHaveTextContent("새 비밀번호 확인이 일치하지 않습니다.");
  expect(screen.getByLabelText("새 비밀번호")).toHaveValue("test-password-one");
  expect(fetch.mock.calls.some(([url])=>String(url).endsWith("/password/reset"))).toBe(false);
});
it("토큰 없는 직접 링크는 제출을 막고 메일 요청 경로를 제공한다",()=>{
  window.history.replaceState(null,"","/#verify");vi.stubGlobal("fetch",vi.fn(async()=>json({error:{code:"UNAUTHENTICATED"}},401)));render(<MemberApp/>);
  expect(screen.getByRole("button",{name:"이메일 인증 완료하기"})).toBeDisabled();
  expect(screen.getByRole("link",{name:"인증 메일 다시 받기"})).toHaveAttribute("href","#verification-request");
});
it("새 계정 확인이 끝나기 전 이전 회원 화면을 노출하지 않는다",async()=>{
  window.history.replaceState(null,"","/#login");
  let reads=0;let resolveIdentity!:(value:Response)=>void;
  vi.stubGlobal("fetch",vi.fn(async(url:string)=>{
    if(url.endsWith("/csrf"))return json({csrf_token:"test"});
    if(url.endsWith("/me")){if(++reads===1)return json({user_id:"1",display_name:"이전 계정",providers:["EMAIL"]});return new Promise<Response>(resolve=>{resolveIdentity=resolve;});}
    if(url.endsWith("/login"))return json({user_id:"2"});
    return json({error:{code:"PROVIDER_UNAVAILABLE"}},503);
  }));
  render(<MemberApp/>);await act(async()=>{});
  fireEvent.change(screen.getByLabelText("이메일"),{target:{value:"new@example.invalid"}});
  fireEvent.change(screen.getByLabelText("비밀번호"),{target:{value:"test-password"}});
  fireEvent.click(screen.getByRole("button",{name:"이메일 로그인"}));
  await waitFor(()=>expect(reads).toBe(2));
  expect(screen.queryByRole("navigation",{name:"회원 메뉴"})).not.toBeInTheDocument();
  expect(screen.queryByText("이전 계정")).not.toBeInTheDocument();
  await act(async()=>{resolveIdentity(json({user_id:"2",display_name:"새 계정",providers:["EMAIL"]}));});
  await screen.findByRole("navigation",{name:"회원 메뉴"});
  expect(screen.queryByText("이전 계정")).not.toBeInTheDocument();
});


describe("필수 MVP 조회 연결 회귀 (HTTP 모의)", () => {
  function fixture(extra: (url:string)=>Response|Promise<Response>|undefined) {
    const fetch = vi.fn(async (url:string) => {
      const response = await extra(url); if(response) return response;
      if(url.endsWith("/me"))return json({user_id:"1",display_name:"검증",providers:["EMAIL"]});
      if(url.endsWith("/extension-installations"))return json([]);
      if(url.startsWith("/api/v1/sites"))return json({items:[],next_cursor:null});
      if(url.startsWith("/api/v1/sessions?"))return json({items:[],next_cursor:null});
      if(url.endsWith("/dashboard"))return json({current_session:null,recent_sessions:[],recent_access:[],summary:{quality:"NO_DATA"}});
      if(url.startsWith("/api/v1/statistics/summary"))return json({quality:"PARTIAL",total_access:3});
      throw new Error("Unexpected mock URL: "+url);
    });vi.stubGlobal("fetch",fetch);return fetch;
  }
  it("도메인·유형 변경으로 이전 커서를 무효화하고 새 조회가 상세를 닫는다", async()=>{
    const fetch=fixture(url=>{
      if(url==="/api/v1/access-events/e1")return json({event_id:"e1",target_host:"before.example.org",policy:{sites:[]}});
      if(url.startsWith("/api/v1/access-events?"))return json({items:[{event_id:"e1",target_host:new URL(url,"https://test.invalid").searchParams.get("host")||"before.example.org",occurred_at:"2026-10-08T00:00:00Z",event_type:"RECORDED_ACCESS"}],next_cursor:url.includes("host=")?null:"old-cursor"});
    });
    render(<MemberApp/>);fireEvent.click(await screen.findByRole("button",{name:"행동 기록"}));
    fireEvent.click(await screen.findByRole("button",{name:/before.example.org.*상세/}));await screen.findByText("행동 기록 상세");fireEvent.click(screen.getByRole("button",{name:"기록 목록으로"}));
    fireEvent.change(screen.getByLabelText("대상 도메인"),{target:{value:"after.example.org"}});
    expect(screen.queryByRole("button",{name:"이전 기록 더 보기"})).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("접근 유형"),{target:{value:"RECORDED_ACCESS"}});
    fireEvent.click(screen.getByRole("button",{name:"조회"}));
    await screen.findByRole("cell",{name:/after.example.org/});
    expect(screen.queryByText("기록 상세·당시 정책")).not.toBeInTheDocument();
    const urls=fetch.mock.calls.map(c=>c[0]);expect(urls.some(u=>u.includes("host=after.example.org")&&u.includes("event_type=RECORDED_ACCESS")&&!u.includes("cursor="))).toBe(true);
    expect(screen.getByText(/미수집·전송 대기 구간/)).toBeInTheDocument();
  });
  it("통계에서 대상 기록으로 조회 기간을 전달한다",async()=>{
    const fetch=fixture(url=>{
      if(url.startsWith("/api/v1/statistics/targets"))return json({items:[{host:"record.example.org",total_access:3,repeat_access:2}],next_cursor:null});
      if(url.startsWith("/api/v1/access-events?"))return json({items:[],next_cursor:null});
    });
    render(<MemberApp/>);fireEvent.click(await screen.findByRole("button",{name:"통계"}));await screen.findByRole("button",{name:"이 대상의 기록"});
    fireEvent.change(screen.getByLabelText("시작 날짜"),{target:{value:"2026-10-01"}});fireEvent.change(screen.getByLabelText("종료 날짜"),{target:{value:"2026-10-02"}});
    fireEvent.click(screen.getByRole("button",{name:"통계 조회"}));
    await waitFor(()=>expect(screen.getByRole("button",{name:"이 대상의 기록"})).toBeEnabled());
    fireEvent.click(screen.getByRole("button",{name:"이 대상의 기록"}));
    await screen.findByText(/조회된 접근 기록이 없습니다/);
    fireEvent.click(screen.getByRole("button",{name:/2026-10-01 – 2026-10-02/}));
    expect(screen.getByLabelText("시작 날짜")).toHaveValue("2026-10-01");expect(screen.getByLabelText("종료 날짜")).toHaveValue("2026-10-02");
    expect(fetch.mock.calls.some(c=>c[0].includes("/access-events?from_date=2026-10-01&to_date=2026-10-02&host=record.example.org"))).toBe(true);
  });
  it("통계 대상 조회 실패 때 요약도 이전 성공 결과와 같은 기간을 유지한다",async()=>{
    let fail=false;
    fixture(url=>{
      if(url.startsWith("/api/v1/statistics/summary"))return json({total_access:fail?999:3,quality:"PARTIAL"});
      if(url.startsWith("/api/v1/statistics/targets"))return fail?json({error:{code:"VALIDATION_FAILED"}},422):json({items:[{host:"record.example.org",total_access:3}],next_cursor:null});
    });
    render(<MemberApp/>);fireEvent.click(await screen.findByRole("button",{name:"통계"}));await screen.findByRole("button",{name:"이 대상의 기록"});fail=true;
    fireEvent.click(screen.getByRole("button",{name:"통계 조회"}));await screen.findByRole("alert");
    expect(screen.queryByText("999")).not.toBeInTheDocument();expect(screen.getByText("조회에 실패해 마지막 성공 결과를 유지합니다.")).toBeInTheDocument();
  });
});

it.each(['logo','hash'])('가입 이탈(%s) 후 새 가입은 요청 전 상태로 시작한다',async(mode)=>{
 window.history.replaceState(null,'','/#signup');sessionStorage.setItem('focurve:email-signup-code',JSON.stringify({schema:2,email:'test@example.invalid',request_id:'fixture',expires_at:new Date(Date.now()+600000).toISOString(),resend_at:Date.now()+60000}));
 const fetch=vi.fn(async(url:string)=>url.endsWith('/csrf')?json({csrf_token:'test-csrf'}):url.endsWith('/me')?json({error:{code:'UNAUTHENTICATED'}},401):json({error:{code:'PROVIDER_UNAVAILABLE'}},503));vi.stubGlobal('fetch',fetch);render(<MemberApp/>);expect(screen.getByLabelText('인증번호')).toBeInTheDocument();
 if(mode==='logo')fireEvent.click(screen.getByRole('link',{name:'FOCURVE 로그인'}));else await act(async()=>{window.history.pushState(null,'','#login');window.dispatchEvent(new HashChangeEvent('hashchange'));});
 await screen.findByRole('button',{name:'이메일 로그인'});fireEvent.click(screen.getByRole('button',{name:'회원가입'}));expect(screen.getByLabelText('이메일')).toHaveValue('');expect(screen.queryByLabelText('인증번호')).not.toBeInTheDocument();expect(fetch.mock.calls.some(([url])=>url.endsWith('/signup-code-requests'))).toBe(false);
});

it('이메일 로그인→로그아웃→재로그인에서 앱의 인증 입력과 진행 상태를 정리한다',async()=>{
 let loggedIn=false;const user={user_id:'1',display_name:'검증',email:'test@example.invalid',email_verified:true,providers:['EMAIL']};
 vi.stubGlobal('fetch',vi.fn(async(url:string)=>{
 if(url.endsWith('/csrf'))return json({csrf_token:'test-csrf'});
 if(url.endsWith('/auth/me'))return loggedIn?json(user):json({error:{code:'UNAUTHENTICATED'}},401);
 if(url.endsWith('/auth/login')){loggedIn=true;return json(user);}
 if(url.endsWith('/auth/logout')){loggedIn=false;return new Response(null,{status:204});}
 if(url.endsWith('/dashboard'))return json({current_session:null,recent_sessions:[],recent_access:[],summary:{}});
 if(url.endsWith('/extension-installations'))return json([]);
 if(url.endsWith('/sessions/current'))return json(null);
 if(url.includes('/social/'))return json({error:{code:'PROVIDER_UNAVAILABLE'}},503);
 return json({items:[],totals:{},preferences:{theme:'light'}});
 }));render(<MemberApp/>);
 const login=async()=>{fireEvent.change(screen.getByLabelText('이메일'),{target:{value:'test@example.invalid'}});fireEvent.change(screen.getByLabelText('비밀번호'),{target:{value:'synthetic-login-password'}});fireEvent.click(screen.getByRole('button',{name:'이메일 로그인'}));await screen.findByRole('navigation',{name:'회원 메뉴'});};
 await login();fireEvent.click(screen.getByRole('button',{name:'계정·연결'}));await waitFor(()=>expect(screen.getByRole('button',{name:'로그아웃'})).toBeEnabled());sessionStorage.setItem('focurve:verification-email','test@example.invalid');sessionStorage.setItem('focurve:password-complete','1');sessionStorage.setItem('unrelated-preserved','yes');
 fireEvent.click(screen.getByRole('button',{name:'로그아웃'}));await screen.findByRole('button',{name:'이메일 로그인'});expect(screen.getByLabelText('이메일')).toHaveValue('');expect(screen.getByLabelText('비밀번호')).toHaveValue('');expect(sessionStorage.getItem('focurve:verification-email')).toBeNull();expect(sessionStorage.getItem('focurve:password-complete')).toBeNull();expect(sessionStorage.getItem('unrelated-preserved')).toBe('yes');await login();
});
