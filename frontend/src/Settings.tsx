import { useEffect, useRef, useState, type ReactNode } from "react";
import { clearCsrf, request } from "./api";
import { dateTime, label, useWork, type Session } from "./FocusShared";
import GuestImports from "./GuestImports";
import ThemeSettings from "./ThemeSettings";
import "./settings.css";

type AccountUser = { user_id?: string; display_name: string; email: string | null; email_verified?: boolean; providers: string[] };
type Installation = { executor_id: string; last_seen_at: string | null; client_version: string; execution_status: string };

export default function Settings({ user, social, refreshUser, sites, sessions, loggedOut }: {
  user: AccountUser; social: ReactNode; refreshUser: () => Promise<void>;
  sites: () => void; sessions: () => void; loggedOut: () => void;
}) {
  const connection = useWork(), account = useWork(), logout = useWork();
  const reauthForm=useRef<HTMLFormElement>(null);
  useEffect(()=>{const form=reauthForm.current;return()=>form?.reset();},[]);
  const [installations, setInstallations] = useState<Installation[]>([]);
  const [active, setActive] = useState<Session | null>(null), [loaded, setLoaded] = useState(false);
  const [notice, setNotice] = useState(""), [connectionNotice, setConnectionNotice] = useState("");
  const [disconnecting, setDisconnecting] = useState<string | null>(null);
  const [ticket, setTicket] = useState(() => new URLSearchParams(window.location.hash.split("?")[1] ?? "").get("ticket"));
  async function load() {
    const [links, current] = await Promise.all([
      request<Installation[]>("/extension-installations"), request<Session | null>("/sessions/current"),
    ]);
    setInstallations(links); setActive(current); setLoaded(true);
  }
  useEffect(() => { void connection.run(load); const timer = setInterval(() => { void connection.run(load); }, 5000); return () => clearInterval(timer); }, []);
  function clearTicket() {
    setTicket(null); window.history.replaceState(null, "", window.location.pathname + window.location.search);
    window.dispatchEvent(new HashChangeEvent("hashchange"));
  }
  const canLogout = loaded && !connection.error && !active && installations.length === 0;
  return <section className="page settings-page">
    <header className="settings-heading"><h3>설정</h3><p>계정과 확장 프로그램 연결 상태를 확인하세요.</p></header>
    <ThemeSettings />
    <section className="settings-card" aria-labelledby="account-title">
      <h4 id="account-title">계정</h4>
      <div className="settings-row"><div><strong>{user.display_name}</strong><p>{user.email ?? "제공된 이메일 없음"}</p></div><span className="settings-badge">{user.providers.includes("EMAIL") ? "이메일 계정" : "소셜 계정"}</span></div>
      <p className="muted">{user.providers.includes("EMAIL") ? (user.email_verified ? "이메일 인증 완료" : "이메일 인증 상태 확인 필요") : "소셜 제공자의 인증으로 로그인한 계정입니다."}</p>
      <details className="settings-details" open={ticket ? true : undefined}>
        <summary>계정 재인증 · 소셜 연결 전 본인 확인</summary>
        <p>새 소셜 계정 연결은 현재 계정의 재인증 후 5분 이내에 완료하세요. 이메일이 같아도 자동으로 합쳐지지 않습니다.</p>
        {user.providers.includes("EMAIL") && <form ref={reauthForm} className="reauth-form" onSubmit={event => {
          event.preventDefault(); const form = event.currentTarget, data = new FormData(form); setNotice("");
          void account.run(async () => { await request("/auth/reauthenticate", "POST", { password: data.get("password") }); form.reset(); setNotice("현재 계정을 재인증했습니다. 5분 이내에 소셜 계정 연결을 완료하세요."); });
        }}><label>현재 계정 비밀번호<input name="password" type="password" maxLength={128} required autoComplete="current-password" /></label><button disabled={account.busy}>비밀번호로 재인증</button></form>}
        {!user.providers.includes("EMAIL") && <p>아래에서 이미 연결된 제공자로 인증한 뒤 ‘현재 계정 재인증’을 선택하세요.</p>}
        {ticket && <div className="settings-action-note"><h5>소셜 인증 결과 확인</h5><p>기존 연결 계정이면 재인증을, 새 제공자 계정이면 연결 확정을 선택하세요. 서버에서 현재 계정과의 일치를 확인합니다.</p><div className="settings-actions">
          <button disabled={account.busy} onClick={() => { setNotice(""); void account.run(async () => { await request("/auth/reauthenticate", "POST", { ticket }); clearTicket(); setNotice("기존 연결된 계정으로 재인증했습니다."); }); }}>현재 계정 재인증</button>
          <button disabled={account.busy} onClick={() => { setNotice(""); void account.run(async () => { await request("/auth/identities/link", "POST", { ticket, consent: true }); clearTicket(); await refreshUser(); setNotice("소셜 계정 연결을 저장했습니다."); }); }}>새 소셜 계정 연결 확정</button>
        </div></div>}
      </details>
      {account.busy && <p role="status">계정 인증 결과를 확인하고 있습니다.</p>}{notice && <p role="status">{notice}</p>}{account.error && <p role="alert">{account.error}</p>}
    </section>
    <section className="settings-card" aria-label="소셜 계정 연결">{social}<p className="muted">소셜 연결은 로그인 수단을 추가합니다. 확장 프로그램 연결과는 별개입니다.</p></section>
    <section className="settings-card" aria-labelledby="extension-title">
      <div className="settings-row"><h4 id="extension-title">확장 프로그램 연결</h4><span className="settings-badge">{connection.error ? "상태 확인 실패" : !loaded ? "확인 중" : installations.length ? `회원 연결 ${installations.length}개` : "미연결"}</span></div>
      <p>회원 연결과 실제 정책 적용은 별도로 확인합니다. 연결된 설치 목록만으로 이 브라우저의 확장 프로그램이라고 판단하지 않습니다.</p>
      {loaded && !connection.error && installations.length === 0 && <div className="settings-action-note"><strong>집중을 시작하려면 확장 프로그램을 연결하세요.</strong><ol><li>Chrome에 FOCURVE 확장 프로그램을 설치하고 팝업을 엽니다.</li><li>확장 프로그램에서 회원 연결을 요청한 뒤, 이 계정으로 승인합니다.</li><li>아래 ‘연결 상태 새로고침’으로 확인한 다음 집중 세션으로 이동합니다.</li></ol><p className="muted">회원 연결을 지원하는 실행 패키지가 필요합니다. 배포된 설치 패키지·연결 안내가 제공되면 진행할 수 있습니다.</p></div>}
      {installations.length > 0 && <ul className="settings-installations">{installations.map(i => <li key={i.executor_id}><div className="settings-row"><strong>{i.client_version}</strong><span className="settings-badge">{i.execution_status === "IDLE" ? "활성 세션 없음" : label(i.execution_status)}</span></div><p>설치 ID <code>{i.executor_id}</code></p><p>최근 응답: {i.last_seen_at ? dateTime(i.last_seen_at) : "아직 없음"} · {i.last_seen_at && Date.now() - Date.parse(i.last_seen_at) <= 60000 ? "최근 통신 확인" : "응답 지연 · Chrome과 확장 프로그램을 열어 주세요"}</p><button disabled={connection.busy || i.execution_status !== "IDLE"} onClick={() => { setConnectionNotice(""); setDisconnecting(i.executor_id); }}>이 설치의 회원 연결 종료</button></li>)}</ul>}
      {disconnecting && <div className="settings-action-note" role="group" aria-label="회원 연결 종료 확인"><strong>선택한 설치의 회원 연결을 종료할까요?</strong><p>설치 ID: <code>{disconnecting}</code></p><p>선택한 설치의 회원 토큰을 폐기합니다. 확장 프로그램 삭제나 계정 자료 삭제가 아닙니다. 실제 제한이 해제됐는지 먼저 확장 프로그램에서 확인하세요.</p><div className="settings-actions"><button disabled={connection.busy} onClick={() => { void connection.run(async () => { await request(`/extension-installations/${disconnecting}/connection`, "DELETE"); setDisconnecting(null); window.dispatchEvent(new Event("focurve:connection-changed")); setConnectionNotice("선택한 설치의 회원 연결을 종료했습니다. 로컬 자료 보존과 비회원 전환은 확장 프로그램에서 확인하세요."); await load(); }); }}>연결 종료 확인</button><button disabled={connection.busy} onClick={() => setDisconnecting(null)}>취소</button></div></div>}
      <div className="settings-actions"><button disabled={connection.busy} onClick={() => { void connection.run(load); }}>연결 상태 새로고침</button><button onClick={sessions}>집중 세션 상태 확인</button></div>
      {connectionNotice && <p role="status">{connectionNotice}</p>}{connection.error && <p role="alert">{connection.error}</p>}
    </section>
    <section className="settings-card"><h4>집중 정책 설정</h4><p>사이트 분류·전체 차단/기록·Shorts 제한은 사이트 관리에서 설정합니다. 변경한 설정은 다음 세션부터 적용됩니다.</p><div className="settings-actions"><button onClick={sites}>사이트 관리 열기</button></div></section>
    <GuestImports owner={user.user_id} />
    <section className="settings-card" aria-labelledby="logout-title"><h4 id="logout-title">로그아웃</h4><p>실행 정책 해제 확인 → 대상 설치의 회원 연결 종료 → 웹 로그인 종료 순서로 진행합니다. 계정 기록과 확장 프로그램의 미전송 자료는 보존합니다.</p><p className="muted">{!loaded ? "현재 실행·연결 상태를 확인하고 있습니다." : active ? `현재 ${label(active.execution_status)} 상태입니다. 집중 세션에서 해제 결과를 먼저 확인하세요.` : installations.length ? "위에서 대상 설치의 회원 연결을 종료해 주세요. 현재 브라우저 식별 연동 전에는 다른 설치를 자동으로 해제하지 않습니다." : connection.error ? "연결 상태를 다시 확인한 후 진행하세요." : "현재 활성 세션과 회원 연결이 없어 웹 로그아웃을 진행할 수 있습니다."}</p><button disabled={!canLogout || logout.busy} onClick={() => { void logout.run(async () => { await request("/auth/logout", "POST", {}); clearCsrf(); reauthForm.current?.reset(); loggedOut(); }); }}>{logout.busy ? "로그아웃 처리 중" : "로그아웃"}</button>{logout.error && <p role="alert">{logout.error}</p>}</section>
    <section className="settings-card" aria-labelledby="data-title"><h4 id="data-title">자료 보관·삭제 안내</h4><p>로그아웃·회원 연결 종료로 회원 자료를 삭제하지 않습니다. 비회원의 종료 기록은 종료 후 30일간, 설정은 별도로 보관됩니다.</p><p className="muted">회원 탈퇴·회원 기록 일괄 삭제는 현재 제공 범위에 없습니다. 사이트 삭제는 사이트 관리에서 개별 확인하며 과거 기록을 보존합니다.</p></section>
    <p className="settings-footer">기록 시각과 하루의 기준: 한국 시간 (Asia/Seoul)</p>
  </section>;
}
