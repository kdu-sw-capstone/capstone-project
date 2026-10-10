import { useEffect, useId, useRef, useState } from "react";
import { ApiError, message, socialAuthorizationPath } from "./api";
import "./social-login.css";

type Availability = "checking" | "available" | "unconfigured" | "error";
const providerNames = { google: "Google", kakao: "카카오" } as const;
const providerIds = Object.keys(providerNames) as (keyof typeof providerNames)[];
const navigateToProvider = (path: string) => window.location.assign(path);

export default function SocialButtons({ link = false, signup = false, providers = [], navigate = navigateToProvider }: {
  link?: boolean;
  signup?: boolean;
  providers?: string[];
  navigate?: (path: string) => void;
}) {
  const [availability, setAvailability] = useState<Record<string, Availability>>({ google: "checking", kakao: "checking" });
  const [attempt, setAttempt] = useState(0);
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const locked = useRef(false);
  const generation = useRef(0);
  const hintId = useId();

  useEffect(() => {
    let disposed = false;
    setAvailability({ google: "checking", kakao: "checking" });
    async function check() {
      for (const provider of providerIds) {
        let result: Availability = "available";
        try { await socialAuthorizationPath(provider, "login"); }
        catch (failure) { result = failure instanceof ApiError && failure.code === "PROVIDER_UNAVAILABLE" ? "unconfigured" : "error"; }
        if (!disposed) setAvailability(old => ({ ...old, [provider]: result }));
      }
    }
    void check();
    return () => { disposed = true; };
  }, [attempt]);

  useEffect(() => {
    function returned(event: PageTransitionEvent) {
      if (!event.persisted || !locked.current) return;
      generation.current++;
      locked.current = false;
      setPending(null);
      setNotice("로그인을 완료하지 않고 돌아왔습니다. 로그인 방법을 다시 선택해 주세요.");
    }
    window.addEventListener("pageshow", returned);
    return () => { generation.current++; window.removeEventListener("pageshow", returned); };
  }, []);

  async function start(provider: keyof typeof providerNames) {
    if (locked.current || availability[provider] !== "available") return;
    locked.current = true;
    const current = generation.current;
    setPending(provider);
    setError("");
    setNotice("");
    try {
      const path = await socialAuthorizationPath(provider, link ? "link" : "login");
      if (current !== generation.current) return;
      // Keep both buttons locked until navigation, failure, or a bfcache return.
      navigate(path);
    } catch (failure) {
      if (current !== generation.current) return;
      locked.current = false;
      setPending(null);
      setError(message(failure) + " 다시 시도하거나 이메일로 로그인해 주세요.");
    }
  }

  return <section className={`social-auth ${link ? "social-link" : signup ? "social-signup" : "social-login"}`} aria-busy={pending !== null}>
    <h4>{link ? "소셜 계정 연결" : signup ? "소셜 계정으로 가입" : "소셜 계정으로 로그인"}</h4>
    <p className="social-intro">{link ? "이 계정에 사용할 로그인 수단을 추가하거나 다시 인증하세요." : "처음 이용한다면 계정 선택 후 가입을 완료해 주세요."}</p>
    <div className="social-buttons">
      {providerIds.map(provider => {
        const name = providerNames[provider];
        const connected = providers.includes(provider.toUpperCase());
        const state = availability[provider];
        return <div className="social-option" key={provider}>
          <button type="button" className={link ? "social-link-button" : `social-login-button social-${provider}`} disabled={pending !== null || state !== "available"} aria-describedby={`${hintId}-${provider}`} onClick={() => void start(provider)}>
            {!link && <span className={`social-symbol social-symbol-${provider}`} aria-hidden="true"><img src={provider === "google" ? "/social/google-official-icon-button.png" : "/social/kakao-symbol.svg"} alt="" /></span>}
            <span>{link ? `${name} · ${connected ? "연결됨 · 재인증 시작" : "미연결 · 연결 인증 시작"}` : `${name}로 ${signup ? "가입" : "로그인"}`}</span>
          </button>
          <span id={`${hintId}-${provider}`} className={`social-provider-status ${state === "available" ? "sr-only" : ""}`}>
            {state === "checking" ? `${name} 로그인 확인 중` : state === "unconfigured" ? `${name} 로그인은 아직 사용할 수 없습니다. 이메일로 로그인해 주세요.` : state === "error" ? `${name} 연결을 확인하지 못했습니다.` : `${name} ${link ? "계정 인증" : "로그인"} 가능`}
          </span>
        </div>;
      })}
    </div>
    {Object.values(availability).includes("error") && <button type="button" className="social-retry" disabled={pending !== null} onClick={() => setAttempt(value => value + 1)}>소셜 연결 다시 확인</button>}
    {pending && <p role="status">{providerNames[pending as keyof typeof providerNames]} 로그인으로 이동 중입니다. 계정 선택과 동의를 완료해 주세요.</p>}
    {notice && <p role="status">{notice}</p>}
    {error && <p role="alert">{error}</p>}
  </section>;
}
