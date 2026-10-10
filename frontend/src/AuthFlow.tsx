import { useEffect, useRef, useState, type FormEvent } from "react";
import { ApiError, message, request } from "./api";
import { MailHelp } from "./UiLayout";

function useAuthAction() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function run(work: () => Promise<void>) {
    if (busy) return;
    setBusy(true); setError("");
    try { await work(); } catch (e) { setError(message(e)); } finally { setBusy(false); }
  }
  return { busy, error, run, setError };
}
function Feedback({ state }: { state: ReturnType<typeof useAuthAction> }) {
  return <>{state.busy && <p role="status">처리 중입니다. 잠시 기다려 주세요.</p>}{state.error && <p role="alert">{state.error}</p>}</>;
}
export function Login({ done, unverified, starting }: { done: () => Promise<void>; unverified: (email: string) => void; starting: () => void }) {
  const state = useAuthAction();
  const formRef=useRef<HTMLFormElement>(null);
  const mounted=useRef(true);
  useEffect(()=>{mounted.current=true;const form=formRef.current; form?.reset(); return ()=>{mounted.current=false;form?.reset();};},[]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form=event.currentTarget, data = new FormData(form);
    starting();
    await state.run(async () => {
      try {
        await request("/auth/login", "POST", { email: data.get("email"), password: data.get("password") });
        form.reset();
        if(mounted.current)await done();
      } catch (e) {
        if (e instanceof ApiError && e.code === "EMAIL_UNVERIFIED") { const email=String(data.get("email")); form.reset(); if(mounted.current)unverified(email); return; }
        throw e;
      } finally { data.delete("password"); data.delete("email"); }
    });
  }
  return <form ref={formRef} onSubmit={submit}><h3>로그인</h3>
    <label>이메일 <input name="email" type="email" maxLength={254} required autoComplete="username" placeholder="you@example.com" /></label>
    <label>비밀번호 <input name="password" type="password" required maxLength={128} autoComplete="current-password" placeholder="비밀번호를 입력하세요" /></label>
    <a className="auth-forgot" href="#password-request">비밀번호를 잊으셨나요?</a>
    <button disabled={state.busy}>이메일 로그인</button><Feedback state={state} />
  </form>;
}
export function VerifyPending({ email }: { email: string }) {
  const state = useAuthAction();
  const [notice, setNotice] = useState("");
  return <section aria-labelledby="verification-pending-heading"><h3 id="verification-pending-heading">이메일 인증 대기</h3>
    {email ? <p>발송 대상 이메일 <strong className="auth-email">{email}</strong></p> : <p>발송 대상 이메일을 다시 입력해 주세요.</p>}
    <p>메일의 인증 링크를 열고 ‘이메일 인증 완료하기’를 눌러 주세요. 인증을 완료한 뒤 로그인할 수 있습니다.</p>
    {email ? <button className="primary" disabled={state.busy} onClick={() => { setNotice(""); void state.run(async () => {
      await request("/auth/email/verification-requests", "POST", { email });
      setNotice("인증 메일 요청을 접수했습니다. 메일함에서 새 인증 링크를 확인해 주세요.");
    }); }}>인증 메일 다시 받기</button> : <a className="auth-link-button" href="#verification-request">인증 메일 다시 받기</a>}
    <Feedback state={state} />{notice && <p role="status">{notice}</p>}
    <MailHelp /><div className="auth-links"><a href="#verification-request">다른 이메일로 인증 메일 요청</a><a href="#login">로그인으로 돌아가기</a></div>
  </section>;
}
export function MailRequest({ verification = false, initialEmail = "", done }: { verification?: boolean; initialEmail?: string; done?: (email: string) => void }) {
  const state = useAuthAction();
  const [notice, setNotice] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setNotice("");
    const data = new FormData(event.currentTarget);
    await state.run(async () => {
      await request(verification ? "/auth/email/verification-requests" : "/auth/password/reset-requests", "POST", { email: data.get("email") });
      if (verification && done) done(String(data.get("email")));
      else setNotice("요청을 접수했습니다. 해당 이메일로 등록된 계정이 있다면 재설정 안내 메일을 확인해 주세요.");
    });
  }
  return <form onSubmit={submit} onChange={() => { setNotice(""); state.setError(""); }}>
    <h3>{verification ? "인증 메일 다시 받기" : "비밀번호 재설정 요청"}</h3>
    <p>{verification ? "가입할 때 사용한 이메일로 인증 메일을 요청해 주세요." : "가입한 이메일을 입력해 주세요. 계정 존재 여부는 안내하지 않습니다."}</p>
    <label>이메일 <input name="email" type="email" maxLength={254} required defaultValue={initialEmail} autoComplete="email" placeholder="you@example.com" /></label>
    <button disabled={state.busy}>{verification ? "인증 메일 요청" : "재설정 메일 요청"}</button>
    <Feedback state={state} />{notice && <p role="status">{notice}</p>}{notice && <MailHelp reset />}
    <div className="auth-links"><a href="#login">로그인으로 돌아가기</a></div>
  </form>;
}
export function TokenForm({ reset, token, done }: { reset: boolean; token: string; done: () => void }) {
  const state = useAuthAction();
  const formRef=useRef<HTMLFormElement>(null),mounted=useRef(true);
  useEffect(()=>{mounted.current=true;const form=formRef.current;form?.reset();return()=>{mounted.current=false;form?.reset();};},[reset,token]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form=event.currentTarget,data = new FormData(form);
    if (reset && data.get("password") !== data.get("confirmation")) { data.delete('password');data.delete('confirmation');state.setError("새 비밀번호 확인이 일치하지 않습니다."); return; }
    await state.run(async () => {
      try {
        await request(reset ? "/auth/password/reset" : "/auth/email/verify", "POST", reset ? { token, new_password: data.get("password") } : { token }, { challenge: true });
        form.reset();
        data.delete('password');data.delete('confirmation');
        if(mounted.current)done();
      } finally {data.delete('password');data.delete('confirmation');}
    });
  }
  return <form ref={formRef} onSubmit={submit} onChange={() => state.setError("")}>
    <h3>{reset ? "새 비밀번호 설정" : "이메일 인증"}</h3>
    <p>{reset ? "새 비밀번호를 두 번 입력해 주세요. 변경하면 기존 로그인 세션은 종료됩니다." : "메일에서 연 인증 링크를 확인한 후 아래 버튼을 눌러 주세요."}</p>
    {!token && <p role="alert">{reset ? "비밀번호 재설정" : "이메일 인증"} 링크가 없습니다. 메일의 전체 링크를 열거나 새 메일을 요청해 주세요.</p>}
    {reset && <><label>새 비밀번호 <input name="password" type="password" minLength={12} maxLength={128} required autoComplete="new-password" placeholder="12~128자로 입력하세요" /></label>
      <label>새 비밀번호 확인 <input name="confirmation" type="password" minLength={12} maxLength={128} required autoComplete="new-password" placeholder="새 비밀번호를 다시 입력하세요" /></label><p className="muted">12~128자로 입력해 주세요.</p></>}
    <button disabled={state.busy || !token}>{reset ? "새 비밀번호 저장하기" : "이메일 인증 완료하기"}</button>
    <Feedback state={state} />
    {(state.error || !token) && <div className="auth-links"><a href={reset ? "#password-request" : "#verification-request"}>{reset ? "재설정 메일 다시 요청" : "인증 메일 다시 받기"}</a></div>}
    <div className="auth-links"><a href="#login">로그인으로 돌아가기</a></div>
  </form>;
}
export function AuthComplete({ reset }: { reset: boolean }) {
  const confirmed = sessionStorage.getItem(reset ? "focurve:password-complete" : "focurve:verified") === "1";
  return <section><h3>{confirmed ? reset ? "비밀번호 변경 완료" : "이메일 인증 완료" : "처리 결과 확인"}</h3>
    <p role="status">{confirmed ? reset ? "비밀번호를 변경했습니다. 다시 로그인하세요." : "이메일 인증을 완료했습니다. 로그인하세요." : "이 창에서 완료한 처리 결과가 없습니다. 메일 링크를 확인해 주세요."}</p>
    <a className="auth-link-button" href="#login">로그인으로 이동</a>
  </section>;
}
