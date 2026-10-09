import {useEffect,useState,type ReactNode} from "react";
import {request,message} from "./api";
import {MailHelp} from "./UiLayout";
type Info={provider:string;email:string|null;email_verified:boolean};
export function SocialSignup({ticket,done,terms}:{ticket:string;done:()=>Promise<void>;terms:ReactNode}) {
  const [info,setInfo]=useState<Info|null>(null),[email,setEmail]=useState(""),[name,setName]=useState("");
  const [busy,setBusy]=useState(false),[error,setError]=useState(""),[notice,setNotice]=useState("");
  async function run(work:()=>Promise<void>){if(busy)return;setBusy(true);setError("");try{await work();}catch(e){setError(message(e));}finally{setBusy(false);}}
  async function refresh(){setInfo(await request<Info>("/auth/social/signup-info","POST",{ticket}));}
  useEffect(()=>{void run(refresh);},[ticket]);
  return <section><h3>소셜 가입 확인</h3><p>제공자 계정으로 로그인합니다. 이메일이 같아도 기존 계정과 자동 연결하지 않습니다.</p>
    {info?.email_verified ? <p role="status">인증된 서비스 이메일: <strong>{info.email}</strong></p> : info && <>
      <p>제공자에서 인증된 이메일을 받지 못했습니다. 서비스 안내를 받을 이메일을 인증해 주세요.</p>
      <form onSubmit={e=>{e.preventDefault();setNotice("");void run(async()=>{await request("/auth/social/email-requests","POST",{ticket,email});setNotice("인증 메일을 요청했습니다. 메일의 링크에서 인증한 뒤 이 가입 화면으로 돌아와 상태를 새로고침하세요.");});}}>
        <label>서비스 이메일<input type="email" value={email} onChange={e=>setEmail(e.target.value)} maxLength={254} required autoComplete="email" placeholder="you@example.com"/></label>
        <button disabled={busy}>이메일 인증 메일 받기</button>
      </form>{notice&&<><p role="status">{notice}</p><MailHelp/></>}
      <button disabled={busy} onClick={()=>void run(refresh)}>이메일 인증 상태 새로고침</button>
    </>}
    <form onSubmit={e=>{e.preventDefault();void run(async()=>{await request("/auth/social/complete","POST",{ticket,terms_version:"dev-v1",display_name:name});window.history.replaceState(null,"",window.location.pathname);await done();});}}>
      <label>표시명<input name="display_name" required maxLength={40} value={name} onChange={e=>setName(e.target.value)} autoComplete="nickname" placeholder="서비스에서 사용할 이름"/></label>
      {terms}<button disabled={busy||!info?.email_verified}>가입 확정</button>
    </form>{busy&&<p role="status">인증 상태를 확인하고 있습니다.</p>}{error&&<p role="alert">{error}</p>}
    <a href="#login">기존 계정으로 로그인</a>
  </section>;
}
export function SocialEmailVerify({token}:{token:string}) {
  const [busy,setBusy]=useState(false),[complete,setComplete]=useState(false),[error,setError]=useState("");
  return <section><h3>소셜 계정의 서비스 이메일 인증</h3>{complete?<p role="status">이메일 인증을 완료했습니다. 원래 소셜 가입 확인 창으로 돌아가 ‘이메일 인증 상태 새로고침’을 누른 뒤 가입을 확정하세요.</p>:<>
    <p>메일 링크를 확인한 후 서비스 이메일 인증을 완료하세요.</p><button disabled={!token||busy} onClick={()=>{setBusy(true);setError("");void request("/auth/social/email/verify","POST",{token},{challenge:true}).then(()=>{setComplete(true);window.history.replaceState(null,"",window.location.pathname+"#social-email-verify");}).catch(e=>setError(message(e))).finally(()=>setBusy(false));}}>이메일 인증 완료하기</button>
    {busy&&<p role="status">이메일을 인증하고 있습니다.</p>}{error&&<p role="alert">{error} 원래 가입 창에서 새 메일을 요청하세요.</p>}</>}
    <a href="#login">로그인으로 돌아가기</a>
  </section>;
}
