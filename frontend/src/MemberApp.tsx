import {SocialSignup, SocialEmailVerify} from "./SocialSignup";
import SocialButtons from "./SocialButtons";
import EmailSignup, {clearSignupProgress} from "./EmailSignup";
import Sessions from "./FocusSessions";
import Records from "./BehaviorRecords";
import QueryTimestamp from "./QueryTimestamp";
import AccessPattern from "./HourlyAccessPattern";
import "./focus-screens.css";
import { useEffect, useState, useRef, type FormEvent } from "react";
import Settings from "./Settings";
import { Login, MailRequest, VerifyPending, TokenForm, AuthComplete } from "./AuthFlow";
import { Brand, ForestPanel, Sidebar, WorkspaceHeader } from "./UiLayout";
import {
  ApiError,
  message,
  refreshCsrf,
  clearCsrf,
  request,
} from "./api";

function statusLabel(value: unknown): string {
  const labels: Record<string,string> = {STARTING:"시작 확인 중",RUNNING:"집중 진행 중",ENDING:"해제 확인 중",UNKNOWN:"결과 확인 필요",ENDED:"종료",FAILED:"시작 실패",START_FAILED:"시작 실패",UNCONFIRMED:"미확인",NOT_COLLECTED:"미수집",BLOCKED_SITE_ACCESS:"사이트 차단",RECORDED_ACCESS:"허용하고 기록",BLOCKED_FEATURE_ACCESS:"기능 차단",SITE:"사이트",FEATURE:"사이트 내부 기능",YOUTUBE_SHORTS:"YouTube Shorts",COMPLETE:"수집 완료",PARTIAL:"일부 수집",PENDING:"반영 대기",REVIEW_REQUIRED:"추가 확인 필요",NO_DATA:"자료 없음",CONFIRMED:"확인됨",FOCUS:"집중",DISTRACTION:"방해",GENERAL:"일반",ALLOW:"허용",BLOCK:"전체 차단",RECORD:"허용하고 기록"};
  return value == null ? "미확인 / 자료 없음" : labels[String(value)] ?? String(value);
}
type User = {
  user_id: string;
  display_name: string;
  email: string | null;
  providers: string[];
};
type Site = {
  site_id: string;
  canonical_host: string;
  display_name: string;
  include_subdomains: boolean;
  purpose: string;
  access_policy: string;
  version: number;
  feature_policies: { feature_code: string; enabled: boolean }[];
};
type Page<T> = { items: T[]; next_cursor: string | null; has_more: boolean };
type Session = {
  session_id: string;
  execution_status: string;
  record_status: string;
  duration_minutes: number;
  active_duration_ms: number;
  started_at?: string;
  ended_at?: string;
  overrun_ms?: number;
};
function useAction() {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function run(work: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await work();
    } catch (e) {
      setError(message(e));
      if (e instanceof ApiError && e.status === 401 && e.code === "UNAUTHENTICATED") window.dispatchEvent(new Event("focurve:authentication-expired"));
    } finally {
      setBusy(false);
    }
  }
  return { busy, error, run };
}
export default function MemberApp() {
  const [user, setUser] = useState<User | null>(null),
    [tab, setTab] = useState("login");
  const [authError, setAuthError] = useState("");
  const authGeneration = useRef(0);
  const [authFormEpoch,setAuthFormEpoch]=useState(0);
  const authFields=useRef<HTMLDivElement>(null);
  function clearAuthInputs(){clearSignupProgress(); setPendingEmail(""); for(const key of ["focurve:verification-email","focurve:verified","focurve:password-complete"])sessionStorage.removeItem(key); setAuthFormEpoch(value=>value+1);}
  const [hash, setHash] = useState(window.location.hash);
  useEffect(() => { window.scrollTo(0, 0); }, [tab, hash]);
  useEffect(() => {
    const changed = () => { if(window.location.hash.split('?')[0]!=='#signup')clearSignupProgress(); setHash(window.location.hash); setAuthError(""); };
    window.addEventListener("hashchange", changed);
    window.addEventListener("popstate", changed);
    return () => { window.removeEventListener("hashchange", changed); window.removeEventListener("popstate", changed); };
  }, []);
  const [recordHost, setRecordHost] = useState("");
  const [recordSession,setRecordSession]=useState("");
  const [recordRange, setRecordRange] = useState({from:"",to:""});
  useEffect(() => {
    const controller = new AbortController();
    let disposed = false;
    const generation = authGeneration.current;
    void request<User>("/auth/me", "GET", undefined, {
      signal: controller.signal,
    })
      .then((result) => {
        if (disposed || generation !== authGeneration.current) return;
        setUser(result);
        if (window.location.hash.startsWith("#social-link")) setTab("account");
        else setTab(current => current === "login" || current === "signup" ? "dashboard" : current);
      })
      .catch((e) => {
        if (disposed || generation !== authGeneration.current) return;
        if (!(e instanceof ApiError) || e.status !== 401)
          setAuthError(message(e));
      });
    return () => {
      disposed = true;
      controller.abort();
    };
  }, []);
  useEffect(() => {
    const expired = () => {
      if (!user) return;
      authGeneration.current++;
      clearCsrf();
      clearAuthInputs();
      setUser(null);
      setTab("login");
      setAuthError("로그인 세션이 만료되었습니다. 다시 로그인해 주세요.");
    };
    window.addEventListener("focurve:authentication-expired", expired);
    return () => window.removeEventListener("focurve:authentication-expired", expired);
  }, [user]);
  const incoming = new URLSearchParams(hash.split("?")[1] ?? "");
  const action = hash.split("?")[0];
  const authRoutes = ["#login", "#signup", "#verify-pending", "#verification-request", "#password-request", "#verify", "#reset", "#verified", "#password-complete", "#social-email-verify", "#social-error", "#social-canceled"];
  const authView = action === "#social-error" || action === "#social-canceled" ? "login" : authRoutes.includes(action) ? action.slice(1) : tab === "signup" ? "signup" : "login";
  const showAuth = !user || authRoutes.includes(action) || action === "#social-complete";
  useEffect(()=>{const root=authFields.current;return()=>{root?.querySelectorAll<HTMLInputElement>('input[type=email],input[name=password],input[type=password],input[name=confirmation],input[name=verification_code]').forEach(input=>{input.value='';});};},[hash,authFormEpoch,showAuth]);
  const [pendingEmail, setPendingEmail] = useState(() => sessionStorage.getItem("focurve:verification-email") ?? "");
  useEffect(()=>{if(authView!=='signup')clearSignupProgress();},[authView]);
  function navigate(view: string) {
    if(view!=='signup')clearSignupProgress();
    setAuthError("");
    setAuthFormEpoch(value=>value+1);
    window.history.pushState(null, "", "#" + view);
    setHash("#" + view);
  }
  function pending(email: string) {
    setPendingEmail(email);
    sessionStorage.setItem("focurve:verification-email", email);
    navigate("verify-pending");
  }
  async function signedIn() {
    authGeneration.current++;
    setAuthError("");
    await refreshCsrf();
    const currentUser = await request<User>("/auth/me");
    // Resolve the new identity before revealing member data from any previous session.
    setUser(currentUser);
    setTab("dashboard");
    if (!window.location.hash.startsWith("#link?")) window.history.replaceState(null, "", window.location.pathname + window.location.search);
    setHash(window.location.hash);
  }
  return (
    <section className={showAuth ? "auth-page" : "workspace"} aria-labelledby="member-heading">
      <h2 id="member-heading" className="sr-only">FOCURVE</h2>
      {authError && <p role="alert">{authError}</p>}
      {showAuth ? (
        <>
          <a className="auth-brand-link" href="#login" aria-label="FOCURVE 로그인" onClick={event=>{event.preventDefault();navigate('login');}}><Brand /></a>
          <div className="auth-columns"><div className="auth-card" data-auth-view={authView}>
          <div ref={authFields} key={`${hash || authView}:${authFormEpoch}`} className="auth-screen">
          {action === "#social-complete" ? <SocialSignup ticket={incoming.get("ticket") ?? ""} done={signedIn} terms={<DevTerms/>} />
            : action === "#social-email-verify" ? <SocialEmailVerify token={incoming.get("token") ?? ""}/>
            : authView === "signup" ? <EmailSignup terms={<DevTerms compact/>} social={<SocialButtons signup key={`social-${hash || authView}`}/>} />
            : authView === "verify-pending" ? <VerifyPending email={pendingEmail} />
            : authView === "verification-request" ? <MailRequest verification initialEmail={pendingEmail} done={pending} />
            : authView === "password-request" ? <MailRequest />
            : authView === "verify" || authView === "reset" ? <TokenForm reset={authView === "reset"} token={incoming.get("token") ?? ""} done={() => {
                if (authView === "reset") { authGeneration.current++; clearCsrf(); setUser(null); }
                sessionStorage.setItem(authView === "reset" ? "focurve:password-complete" : "focurve:verified", "1");
                if (authView === "verify") { sessionStorage.removeItem("focurve:verification-email"); setPendingEmail(""); }
                window.history.replaceState(null, "", window.location.pathname + window.location.search + (authView === "reset" ? "#password-complete" : "#verified"));
                setHash(authView === "reset" ? "#password-complete" : "#verified");
              }} />
            : authView === "verified" || authView === "password-complete" ? <AuthComplete reset={authView === "password-complete"} />
            : <Login done={signedIn} unverified={pending} starting={() => { authGeneration.current++; setUser(null); }} />}
          {action === "#social-error" && <p role="alert">{message(new ApiError(incoming.get("code") ?? "INVALID_IDENTITY",400))} 다시 시도하거나 다른 로그인 방법을 선택해 주세요.</p>}
          {action === "#social-canceled" && <p role="alert">소셜 로그인이 취소되었습니다. 로그인 방법을 다시 선택해 주세요.</p>}
          </div>
          {authView === "login" && action !== "#social-complete" && <SocialButtons key={`social-${hash || authView}`} />}
          {authView === "signup" ? <nav aria-label="인증">이미 계정이 있나요? <a href="#login" onClick={event=>{event.preventDefault();navigate("login");}}>로그인</a></nav> : authView === "login" && <nav aria-label="인증"><button aria-label="회원가입" onClick={() => navigate("signup")}>계정이 없나요? 회원가입</button></nav>}
          </div><ForestPanel auth /></div>
        </>
      ) : (
        <>
          <Sidebar tab={tab} onSelect={value => { if(value === "logs") { setRecordHost("");setRecordSession(""); setRecordRange({from:"",to:""}); } setTab(value); }} />
          <div className="workspace-body">
          <WorkspaceHeader name={user.display_name} tab={tab} />
          <p className="sr-only">{user.display_name} · {user.providers.join(", ")}</p>
          {action === "#link" ? (
            <ExtensionLinkConfirmation
              id={incoming.get("id") ?? ""}
              close={() => {
                window.history.replaceState(null, "", window.location.pathname);
                setHash("");
              }}
            />
          ) : tab === "sites" ? (
            <Sites />
          ) : tab === "sessions" ? (
            <Sessions settings={()=>setTab("sites")} records={(id,from,to)=>{setRecordSession(id);setRecordHost("");setRecordRange({from,to});setTab("logs");}} />
          ) : tab === "logs" ? (
            <Records
              key={recordHost + recordSession + JSON.stringify(recordRange)}
              initialSession={recordSession}
              initialHost={recordHost}
              initialRange={recordRange}
              settings={() => setTab("sites")}
            />
          ) : tab === "statistics" ? (
            <Statistics
              records={(host, range) => {
                setRecordRange(range);
                setRecordHost(host);setRecordSession("");
                setTab("logs");
              }}
              settings={() => setTab("sites")}
            />
          ) : tab === "account" ? (
            <Settings user={user} social={<SocialButtons link providers={user.providers} />} refreshUser={async()=>setUser(await request<User>("/auth/me"))} sites={()=>setTab("sites")} sessions={()=>setTab("sessions")}
              loggedOut={() => {
                authGeneration.current++;
                setAuthError("");
                clearAuthInputs();
                window.history.replaceState(null,"",window.location.pathname+window.location.search+"#login");
                setHash("#login");
                setUser(null);
                setTab("login");
              }}
            />
          ) : (
            <Dashboard
              sites={() => setTab("sites")}
              sessions={() => setTab("sessions")}
              records={() => {
                setRecordHost("");setRecordSession("");
                setRecordRange({from:"",to:""});
                setTab("logs");
              }}
            />
          )}
          </div>
        </>
      )}
    </section>
  );
}
function ExtensionLinkConfirmation({
  id,
  close,
}: {
  id: string;
  close: () => void;
}) {
  const state = useAction();
  const [notice, setNotice] = useState("");
  const valid =
    /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(id);
  async function choose(approve: boolean) {
    await state.run(async () => {
      await request(
        `/extension-link-requests/${encodeURIComponent(id)}/approval`,
        "POST",
        { approve },
      );
      setNotice(
        "연결 요청 응답을 받았습니다. 실제 연결 완료는 확장 프로그램에서 확인하세요.",
      );
    });
  }
  return (
    <section>
      <h3>확장 프로그램 연결 확인</h3>
      <p>
        현재 계정과 이 확장 프로그램을 연결할지 확인합니다. 승인 요청만으로 연결
        완료가 되지는 않습니다.
      </p>
      {!valid && <p role="alert">유효한 연결 요청을 다시 열어주세요.</p>}
      <button
        disabled={!valid || state.busy}
        onClick={() => {
          void choose(true);
        }}
      >
        연결 승인 요청
      </button>
      <button
        disabled={!valid || state.busy}
        onClick={() => {
          void choose(false);
        }}
      >
        연결 거절 요청
      </button>
      <button onClick={close}>회원 화면으로 돌아가기</button>
      {state.busy && <p role="status">연결 요청 확인 중</p>}
      {state.error && <p role="alert">{state.error}</p>}
      {notice && <p aria-live="polite">{notice}</p>}
    </section>
  );
}

function DevTerms({compact=false}:{compact?:boolean}) {
  return (
    <>
      {compact&&<p className="signup-terms-note">개발·테스트용 임시 약관입니다.</p>}
      <details className={compact?"signup-terms-details":"dev-terms-details"} open={compact?undefined:true}><summary>내용 보기</summary><p>
        개발·테스트용 임시 약관 dev-v1: 테스트 계정·설정·집중 기록을 개발 검증
        목적으로 저장합니다. 실제 개인정보나 실제 서비스 이용을 위한 약관이
        아니며, 서비스용 약관은 미확정입니다.
      </p></details>
      <label>
        <input type="checkbox" required /> 개발·테스트용 임시 약관 dev-v1에
        동의합니다.
      </label>
    </>
  );
}
function Sites() {
  const state = useAction();
  const [items, setItems] = useState<Site[]>([]),
    [cursor, setCursor] = useState<string | null>(null),
    [loaded, setLoaded] = useState(false),
    [deleteKeys] = useState(() => new Map<string, string>()),
    [selected, setSelected] = useState<Site | null>(null),
    [latest, setLatest] = useState<Site | null>(null),
    [deleting, setDeleting] = useState<Site | null>(null),
    [notice, setNotice] = useState("");
  const [url, setUrl] = useState(""),
    [name, setName] = useState(""),
    [purpose, setPurpose] = useState("DISTRACTION"),
    [policy, setPolicy] = useState("BLOCK"),
    [sub, setSub] = useState(true),
    [shorts, setShorts] = useState(false),
    [key, setKey] = useState(() => crypto.randomUUID());
  async function load(next: string | null = null) {
    const page = await request<Page<Site>>(
      "/sites" + (next ? "?cursor=" + encodeURIComponent(next) : ""),
    );
    setItems((old) => (next ? [...old, ...page.items] : page.items));
    setCursor(page.next_cursor);
    setLoaded(true);
  }
  useEffect(() => {
    void state.run(() => load());
  }, []);
  function edit(site: Site | null) {
    setSelected(site);
    setLatest(null);
    setUrl(site?.canonical_host ?? "");
    setName(site?.display_name ?? "");
    setPurpose(site?.purpose ?? "DISTRACTION");
    setPolicy(site?.access_policy ?? "BLOCK");
    setSub(site?.include_subdomains ?? true);
    setShorts(
      site?.feature_policies.some(
        (f) => f.feature_code === "YOUTUBE_SHORTS" && f.enabled,
      ) ?? false,
    );
    setKey(crypto.randomUUID());
    setNotice("");
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    setNotice("");
    await state.run(async () => {
      const body = {
        url,
        display_name: name,
        purpose,
        access_policy: policy,
        include_subdomains: sub,
        feature_policies: shorts
          ? [{ feature_code: "YOUTUBE_SHORTS", enabled: true }]
          : [],
      };
      try {
        await request(
          selected ? "/sites/" + selected.site_id : "/sites",
          selected ? "PATCH" : "POST",
          body,
          { key, version: selected?.version },
        );
      } catch (e) {
        if (e instanceof ApiError && e.status === 412 && selected)
          setLatest(await request<Site>("/sites/" + selected.site_id));
        throw e;
      }
      await load();
      edit(null);
      setNotice(
        "설정을 저장했습니다. 현재 세션은 유지하고 다음 세션에 적용합니다.",
      );
    });
  }
  return (
    <section className="page sites">
      <header className="focus-heading"><h3>사이트 관리</h3><p>사이트를 목적에 맞게 분류하고, 집중 중 적용할 방식을 정하세요.</p></header>
      {loaded && <dl className="metrics site-summary">{[["조회한 사이트", items.length], ["집중 대상", items.filter(s => s.purpose === "FOCUS").length], ["방해 대상", items.filter(s => s.purpose === "DISTRACTION").length], ["일반 이용", items.filter(s => s.purpose === "GENERAL").length]].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}개</dd></div>)}</dl>}
      <ul className="site-list">
        {!loaded && <li className="empty-state" role="status">사이트를 확인하고 있습니다.</li>}
        {loaded && items.length === 0 && <li className="empty-state"><h4>등록된 사이트가 없습니다.</h4><p>사이트 등록에서 주소와 적용할 정책을 저장하세요.</p></li>}
        {items.map((site) => (
          <li key={site.site_id}>
            <div className="site-identity"><strong>{site.display_name}</strong><small>{site.canonical_host}</small></div><span className={"badge " + site.purpose}>{({FOCUS:"집중",DISTRACTION:"방해",GENERAL:"일반"} as Record<string,string>)[site.purpose]}</span><span className={"badge " + site.access_policy}>{({ALLOW:"허용",BLOCK:"전체 차단",RECORD:"허용하고 기록"} as Record<string,string>)[site.access_policy]}</span>
            <button disabled={state.busy} onClick={() => edit(site)}>
              수정
            </button>
            <button
              disabled={state.busy}
              onClick={() => setDeleting(site)}
            >
              삭제
            </button>
          </li>
        ))}
      </ul>
      {deleting && <section className="connection-help" role="region" aria-label="사이트 삭제 확인"><h4>사이트를 삭제할까요?</h4><p>{deleting.display_name} · {deleting.canonical_host}</p><p>목록에서 삭제하며 과거 기록과 현재 세션 정책은 유지됩니다.</p><button disabled={state.busy} onClick={() => {
                void state.run(async () => {
                  if (!deleteKeys.has(deleting.site_id))
                    deleteKeys.set(deleting.site_id, crypto.randomUUID());
                  await request("/sites/" + deleting.site_id, "DELETE", undefined, {
                    key: deleteKeys.get(deleting.site_id),
                    version: deleting.version,
                  });
                  deleteKeys.delete(deleting.site_id);
                  setDeleting(null);
                  if (selected?.site_id === deleting.site_id) edit(null);
                  await load();
                  setNotice("사이트를 삭제했습니다. 과거 기록과 현재 세션 정책은 유지됩니다.");
                });
      }}>삭제 확인</button><button disabled={state.busy} onClick={() => setDeleting(null)}>삭제 취소</button></section>}
      {cursor && (
        <button
          disabled={state.busy}
          onClick={() => {
            void state.run(() => load(cursor));
          }}
        >
          더 보기
        </button>
      )}
      <form
        onSubmit={submit}
        onChange={() => {
          setKey(crypto.randomUUID());
          setNotice("");
        }}
      >
        <h4>{selected ? "사이트 수정" : "사이트 등록"}</h4>
        <p className="muted">주소의 호스트를 그대로 등록합니다. 상위·하위 도메인은 따로 설정할 수 있으며, 같은 호스트만 중복으로 제한합니다.</p>
        <label>
          URL 또는 도메인{" "}
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            required
            maxLength={2048}
          />
        </label>
        <label>
          사이트 이름{" "}
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            maxLength={100}
          />
        </label>
        <label>
          <input
            type="checkbox"
            checked={sub}
            onChange={(e) => setSub(e.target.checked)}
          />
          하위 도메인 포함
        </label>
        <p className="muted">체크하면 이 호스트의 하위 도메인에도 적용합니다. 별도로 등록한 더 구체적인 호스트의 설정이 우선하며, 변경은 다음 세션부터 적용됩니다.</p>
        <label>
          목적{" "}
          <select
            aria-label="목적"
            value={purpose}
            onChange={(e) => {
              setPurpose(e.target.value);
              setPolicy(e.target.value === "DISTRACTION" ? "BLOCK" : "ALLOW");
            }}
          >
            <option value="FOCUS">집중</option>
            <option value="DISTRACTION">방해</option>
            <option value="GENERAL">일반</option>
          </select>
        </label>
        <label>
          접근 정책{" "}
          <select
            aria-label="접근 정책"
            value={policy}
            onChange={(e) => setPolicy(e.target.value)}
          >
            {purpose === "DISTRACTION" ? (
              <>
                <option value="BLOCK">차단</option>
                <option value="RECORD">기록</option>
              </>
            ) : (
              <option value="ALLOW">허용</option>
            )}
          </select>
        </label>
        <label>
          <input
            type="checkbox"
            checked={shorts}
            onChange={(e) => setShorts(e.target.checked)}
          />
          YouTube Shorts 제한
        </label>
        <p className="muted">YouTube 도메인에서만 설정할 수 있습니다. 전체 차단 정책이 있으면 전체 차단을 우선하며, 저장한 정책은 다음 세션에 적용합니다.</p>
        <button disabled={state.busy}>저장</button>
        {selected && (
          <button type="button" onClick={() => edit(null)}>
            새 사이트 등록
          </button>
        )}
      </form>
      {latest && (
        <section className="site-conflict">
          <h4>서버 최신 값</h4>
          <p>
            {latest.display_name} · {latest.canonical_host} · {latest.purpose} ·{" "}
            {latest.access_policy}
          </p>
          <p>편집 입력은 위에 보존했습니다.</p>
          <button
            onClick={() => {
              setSelected(latest);
              setLatest(null);
              setKey(crypto.randomUUID());
            }}
          >
            최신 버전 기준으로 편집값 다시 저장 준비
          </button>
        </section>
      )}
      {state.busy && <p role="status">결과 확인 중 — 입력을 유지합니다.</p>}
      {state.error && <p role="alert">{state.error}</p>}
      {notice && <p aria-live="polite">{notice}</p>}
    </section>
  );
}
function ExtensionHelp() {
  return <section className="connection-help card"><h4>확장 프로그램 연결이 필요합니다</h4><p>Chrome에 FOCURVE 확장 프로그램을 설치하고, 확장 프로그램에서 회원 연결을 요청한 뒤 이 계정으로 승인하세요. 연결 후 아래 상태를 다시 확인하세요.</p><p className="muted">현재 검증 환경에는 실행 가능한 확장 프로그램 패키지가 없고 연결 승인 절차도 통합 대기 중입니다. 담당자가 제공하는 설치 패키지와 연결 안내가 필요합니다. 사이트 설정·기록 조회는 웹에서 사용할 수 있습니다.</p></section>;
}
function DateRange({
  from,
  to,
  onFrom,
  onTo,
}: {
  from: string;
  to: string;
  onFrom: (v: string) => void;
  onTo: (v: string) => void;
}) {
  return (
    <>
      <label>
        시작 날짜{" "}
        <input
          type="date"
          value={from}
          onChange={(e) => onFrom(e.target.value)}
          onInput={(e) => onFrom(e.currentTarget.value)}
        />
      </label>
      <label>
        종료 날짜{" "}
        <input type="date" value={to} onChange={(e) => onTo(e.target.value)} onInput={(e) => onTo(e.currentTarget.value)} />
      </label>
    </>
  );
}
function Metrics({ data }: { data: Record<string, unknown> }) {
  return (
    <dl className="metrics">
      {[
        ["active_duration_ms", "확인된 집중 시간"],
        ["total_access", "전체 접근"],
        ["blocked_access", "차단 접근"],
        ["repeat_access", "반복 접근"],
        ["repeat_ratio", "반복 비율(%)"],
        ["quality", "기록 상태"],
        ["as_of", "조회 기준 시각"],
      ].map(([key, label]) => (
        <div key={key} className={key === "as_of" ? "metric-as-of" : undefined}>
          <dt>{label}</dt>
          <dd>
            {data[key] === null || data[key] === undefined
              ? "미확인 / 자료 없음"
              : key === "active_duration_ms" && typeof data[key] === "number"
                ? Math.floor(Number(data[key]) / 3600000) + "시간 " + Math.floor(Number(data[key]) % 3600000 / 60000) + "분"
              : key === "repeat_ratio" && typeof data[key] === "number"
                ? data[key].toFixed(1)
                : key === "quality" ? statusLabel(data[key]) : key === "as_of" ? <QueryTimestamp value={data[key]} /> : String(data[key])}
          </dd>
        </div>
      ))}
    </dl>
  );
}
function Statistics({
  records,
  settings,
}: {
  records: (host: string, range:{from:string;to:string}) => void;
  settings: () => void;
}) {
  const state = useAction();
  const [range, setRange] = useState({from:"",to:""});
  const [hourlyRefresh,setHourlyRefresh]=useState(0);
  const [from, setFrom] = useState(""),
    [to, setTo] = useState(""),
    [summary, setSummary] = useState<Record<string, unknown> | null>(null),
    [targets, setTargets] = useState<Record<string, unknown>[]>([]),
    [cursor, setCursor] = useState<string | null>(null);
  async function load(next: string | null = null) {
    const nextSummary = await request<Record<string,unknown>>(
        "/statistics/summary?" +
          new URLSearchParams({
            ...(from ? { from_date: from } : {}),
            ...(to ? { to_date: to } : {}),
          }),
      );
    const page = await request<Page<Record<string, unknown>>>(
      "/statistics/targets?" +
        new URLSearchParams({
          ...(from ? { from_date: from } : {}),
          ...(to ? { to_date: to } : {}),
          ...(next ? { cursor: next } : {}),
        }),
    );
    setSummary(nextSummary);
    setTargets((old) => (next ? [...old, ...page.items] : page.items));
    setCursor(page.next_cursor);
    setRange({from,to});
    setHourlyRefresh(n=>n+1);
  }
  useEffect(() => {
    void state.run(load);
  }, []);
  return (
    <section className="page statistics">
      <header className="focus-heading"><h3>기본·사이트별 통계</h3><p>한국 시간 기준 · 기간 미입력 시 최근 7일 · 최대 366일. 사이트별 집중 시간은 배분 근거가 없어 제공하지 않습니다.</p></header>
      <form className="statistics-filters"
        onSubmit={(e) => {
          e.preventDefault();
          void state.run(load);
        }}
      >
        <DateRange
          from={from}
          to={to}
          onFrom={(v) => {
            setFrom(v);
            setCursor(null);
          }}
          onTo={(v) => {
            setTo(v);
            setCursor(null);
          }}
        />
        <button disabled={state.busy}>통계 조회</button>
      </form>
      {state.busy && <p role="status">결과 확인 중 — 입력을 유지합니다.</p>}
      {state.error && <p role="alert">{state.error}</p>}
      {summary && (from !== range.from || to !== range.to) && <p role="status">기간이 변경되었습니다. 통계 조회를 눌러 적용하세요. 아래는 이전 조회 결과입니다.</p>}
      {state.error && summary && <p>조회에 실패해 마지막 성공 결과를 유지합니다.</p>}
      {summary && <Metrics data={summary} />}
      <AccessPattern from={range.from} to={range.to} refreshKey={hourlyRefresh}/>
      <div className="table-card"><table className="statistics-table"><caption>대상별 접근과 반복</caption><colgroup><col style={{width:"28%"}}/><col style={{width:"8%"}}/><col style={{width:"8%"}}/><col style={{width:"8%"}}/><col style={{width:"10%"}}/><col style={{width:"12%"}}/><col style={{width:"26%"}}/></colgroup><thead><tr><th>대상</th><th>전체 접근</th><th>반복 접근</th><th>차단 접근</th><th>반복 비율</th><th>수집 상태</th><th>기록·설정</th></tr></thead><tbody>
        {targets.map((t) => (
          <tr key={String(t.host)}><td>
            {String(t.host)}
            </td><td>{t.total_access == null ? "미확인 / 자료 없음" : String(t.total_access)}</td><td>{t.repeat_access == null ? "미확인 / 자료 없음" : String(t.repeat_access)}</td><td>{t.blocked_access == null ? "미확인" : String(t.blocked_access)}</td><td>{typeof t.repeat_ratio === "number" ? t.repeat_ratio.toFixed(1) + "%" : "자료 없음"}</td><td>{statusLabel(t.quality)}</td><td>
            <button disabled={state.busy} onClick={() => records(String(t.host), range)}>
              이 대상의 기록
            </button>
            <button onClick={settings}>현재 사이트 설정</button>
          </td></tr>
        ))}
      </tbody></table>{summary && targets.length === 0 && <p className="muted">조회된 대상별 통계가 없습니다.</p>}</div>
      {cursor && from === range.from && to === range.to && (
        <button
          disabled={state.busy}
          onClick={() => {
            void state.run(() => load(cursor));
          }}
        >
          다음 사이트 통계
        </button>
      )}
    </section>
  );
}
function SiteClassification({open}:{open:()=>void}) {
  const [counts,setCounts]=useState<number[]|null>(null);
  const [error,setError]=useState("");
  useEffect(()=>{const controller=new AbortController();async function load(){
    const all:Site[]=[];let cursor:string|null=null;const seen=new Set<string>();
    do {const page:Page<Site>=await request("/sites?"+new URLSearchParams({limit:"100",...(cursor?{cursor}:{})}),"GET",undefined,{signal:controller.signal});
      if(!Array.isArray(page.items))throw new ApiError("SERVER_RESPONSE_INVALID",502);
      all.push(...page.items);cursor=page.next_cursor;if(cursor&&seen.has(cursor))throw new ApiError("INVALID_CURSOR",400);if(cursor)seen.add(cursor);
    }while(cursor&&!controller.signal.aborted);
    if(!controller.signal.aborted)setCounts(["FOCUS","DISTRACTION","GENERAL"].map(p=>all.filter(s=>s.purpose===p).length));
  }void load().catch(e=>{if(!controller.signal.aborted)setError(message(e));});return()=>controller.abort();},[]);
  const total=counts?.reduce((a,b)=>a+b,0)??0;
  const first=counts&&total?counts[0]/total*100:0,second=counts&&total?(counts[0]+counts[1])/total*100:0;
  return <section className="card site-classification"><div className="panel-heading"><h4>사이트 분류 현황</h4><button onClick={open}>관리 →</button></div><p className="muted">현재 등록한 사이트 · 이용 목적 기준</p>
    {error?<p role="alert">{error}</p>:counts===null?<p role="status">사이트 분류를 확인하고 있습니다.</p>:total===0?<p>등록된 사이트가 없습니다.</p>:<div className="distribution"><div className="donut" role="img" aria-label={"등록 사이트 "+total+"개"} style={{background:"conic-gradient(#579fff 0% "+first+"%, #7dd3e8 "+first+"% "+second+"%, #bdd6ef "+second+"% 100%)"}}><div><strong>{total}</strong><small>등록 사이트</small></div></div><ul>{counts.map((count,i)=><li key={i}><span>{["집중 대상","방해 대상","일반 이용"][i]}</span><strong>{count}개</strong><small>{(count/total*100).toFixed(1)}%</small></li>)}</ul></div>}
  </section>;
}
function Dashboard({ sessions, records, sites }: { sessions: () => void; records: () => void; sites: () => void }) {
  const state = useAction();
  const [data, setData] = useState<{ current_session: Session | null; recent_sessions: Session[]; recent_access: Record<string, unknown>[]; summary: Record<string, unknown> } | null>(null);
  const [today, setToday] = useState<Record<string, unknown> | null>(null);
  const [period, setPeriod] = useState("week");
  const day = new Intl.DateTimeFormat("sv-SE", {timeZone:"Asia/Seoul",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
  useEffect(() => { void state.run(async () => {
    setData(await request("/dashboard"));
    setToday(await request("/statistics/summary?" + new URLSearchParams({from_date:day,to_date:day})));
  }); }, []);
  return <section className="page dashboard"><div className="page-heading focus-heading"><div><h3>집중 현황</h3><p className="muted">한 주의 집중을 돌아보세요. 실제 확인된 기록을 기준으로 표시합니다.</p></div><button className="primary" onClick={sessions}>현재 세션 확인</button></div>
    <div className="period-controls"><button aria-pressed={period==="week"} onClick={()=>setPeriod("week")}>최근 7일 집계(한국 시간)</button><button aria-pressed={period==="today"} onClick={()=>setPeriod("today")}>오늘 집계(한국 시간)</button></div>
    {data && <><p className="muted">{data.current_session ? "현재 실행 상태: "+statusLabel(data.current_session.execution_status) : "현재 세션 없음"}</p><Metrics data={(period==="today" ? today : data.summary) ?? {}}/>
    <div className="dashboard-mid"><AccessPattern from={period==="today" ? day : undefined} to={period==="today" ? day : undefined}/><SiteClassification open={sites}/></div>
    <div className="dashboard-panels"><section className="card"><h4>최근 세션</h4>{data.recent_sessions.length===0 ? <p className="muted">완료된 세션 기록이 없습니다.</p> : <ul>{data.recent_sessions.map(s=><li key={s.session_id}><strong>{statusLabel(s.execution_status)}</strong> · {statusLabel(s.record_status)}</li>)}</ul>}<button onClick={sessions}>집중 세션으로 이동</button></section>
    <section className="card"><h4>최근 활동</h4>{data.recent_access.length===0 ? <p className="muted">최근 접근 기록이 없습니다.</p> : <ul>{data.recent_access.map(e=><li key={String(e.event_id)}><strong>{String(e.target_host)}</strong><small>{new Date(String(e.occurred_at)).toLocaleString("ko-KR",{timeZone:"Asia/Seoul"})}</small></li>)}</ul>}<button onClick={records}>최근 기록 목록</button></section></div></>}
    {state.busy && <p role="status">결과 확인 중 — 입력을 유지합니다.</p>}{state.error && <p role="alert">{state.error}</p>}
  </section>;
}
