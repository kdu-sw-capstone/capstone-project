import {useLayoutEffect,useRef,useState,type ReactNode} from "react";
import {request,message} from "./api";
import {MailHelp} from "./UiLayout";
type Info={provider:string;email:string|null;email_verified:boolean};
export function SocialSignup({ticket,done,terms}:{ticket:string;done:()=>Promise<void>;terms:ReactNode}) {
  const [info,setInfo]=useState<Info|null>(null),[email,setEmail]=useState(""),[name,setName]=useState("");
  const [busy,setBusy]=useState(false),[error,setError]=useState(""),[notice,setNotice]=useState("");
  const [refreshing,setRefreshing]=useState(false),[sending,setSending]=useState(false);
  const completionView=useRef({ticket,live:false});
  useLayoutEffect(()=>{
    const view={ticket,live:true};completionView.current=view;
    setBusy(false);
    return()=>{view.live=false;};
  },[ticket]);
  async function complete(){
    const view=completionView.current,origin=new URL(window.location.href);
    let expectedHref=origin.href;
    const current=()=>view.live&&completionView.current===view&&view.ticket===ticket&&window.location.href===expectedHref;
    if(!current())return;
    try{
      await request("/auth/social/complete","POST",{ticket,terms_version:"dev-v1",display_name:name});
      if(!current())return;
      window.history.replaceState(null,"",origin.pathname);
      expectedHref=new URL(origin.pathname,origin.origin).href;
      if(!current())return;
      await done();
    }catch(e){if(current())throw e;}
  }
  const completionTask=useRef<{view:typeof completionView.current}|null>(null);
  async function run(work:()=>Promise<void>){
    const view=completionView.current;
    if(!view.live||view.ticket!==ticket||completionTask.current?.view===view)return;
    const task={view};completionTask.current=task;
    const current=()=>view.live&&completionView.current===view&&completionTask.current===task;
    setBusy(true);setError("");
    try{await work();}catch(e){if(current())setError(message(e));}
    finally{if(current()){setBusy(false);completionTask.current=null;}}
  }
  const mailTask=useRef<{view:typeof completionView.current;href:string}|null>(null);
  useLayoutEffect(()=>{setSending(false);setNotice("");},[ticket]);
  async function sendEmail(){
    const view=completionView.current,href=window.location.href;
    if(!view.live||view.ticket!==ticket||busy||refreshing||mailTask.current?.view===view)return;
    const task={view,href};mailTask.current=task;
    const current=()=>view.live&&completionView.current===view&&mailTask.current===task&&window.location.href===href;
    setSending(true);setError("");setNotice("");
    try{
      await request("/auth/social/email-requests","POST",{ticket,email});
      if(current())setNotice("인증 메일을 요청했습니다. 메일의 링크에서 인증한 뒤 이 가입 화면으로 돌아와 상태를 새로고침하세요.");
    }catch(e){if(current())setError(message(e));}
    finally{if(current()){setSending(false);mailTask.current=null;}}
  }
  const infoTask=useRef<{view:typeof completionView.current;href:string}|null>(null);
  async function refresh(){
    const view=completionView.current,href=window.location.href;
    if(!view.live||view.ticket!==ticket)return;
    const task={view,href};infoTask.current=task;
    const current=()=>view.live&&completionView.current===view&&infoTask.current===task&&window.location.href===href;
    setRefreshing(true);setError("");
    try{
      const result=await request<Info>("/auth/social/signup-info","POST",{ticket});
      if(current())setInfo(result);
    }catch(e){if(current())setError(message(e));}
    finally{if(current()){setRefreshing(false);infoTask.current=null;}}
  }
  useLayoutEffect(()=>{setInfo(null);setError("");void refresh();},[ticket]);
  return <section className="social-signup-card"><h3>소셜 계정으로 가입</h3>
    {info?.email_verified ? <p className="social-signup-email" role="status"><span>이메일</span><strong>{info.email}</strong></p> : info && <>
      <p>제공자에서 인증된 이메일을 받지 못했습니다. 서비스 안내를 받을 이메일을 인증해 주세요.</p>
      <form onSubmit={e=>{e.preventDefault();void sendEmail();}}>
        <label>서비스 이메일<input type="email" value={email} onChange={e=>setEmail(e.target.value)} maxLength={254} required autoComplete="email" placeholder="you@example.com"/></label>
        <button disabled={busy||sending||refreshing}>이메일 인증 메일 받기</button>
      </form>{notice&&<><p role="status">{notice}</p><MailHelp/></>}
      <button disabled={busy||sending||refreshing} onClick={()=>void refresh()}>이메일 인증 상태 새로고침</button>
    </>}
    <form onSubmit={e=>{e.preventDefault();void run(complete);}}>
      <label>표시명<input name="display_name" required maxLength={40} value={name} onChange={e=>setName(e.target.value)} autoComplete="nickname" placeholder="서비스에서 사용할 이름"/></label>
      {terms}<button disabled={busy||sending||refreshing||!info?.email_verified}>가입 확정</button>
    </form>{(busy||sending||refreshing)&&<p role="status">인증 상태를 확인하고 있습니다.</p>}{error&&<p role="alert">{error}</p>}
    <a className="social-signup-back" href="#login">로그인으로 돌아가기</a>
  </section>;
}
export function SocialEmailVerify({token}:{token:string}) {
  const [busy,setBusy]=useState(false),[complete,setComplete]=useState(false),[error,setError]=useState("");
  const verificationView=useRef({token,live:false});
  useLayoutEffect(()=>{
    const view={token,live:true};verificationView.current=view;
    setBusy(false);setComplete(false);setError("");
    return()=>{view.live=false;};
  },[token]);
  async function verify(){
    const view=verificationView.current,origin=new URL(window.location.href);
    let expectedHref=origin.href;
    const current=()=>view.live&&verificationView.current===view&&view.token===token&&window.location.href===expectedHref;
    if(!token||busy||!current())return;
    setBusy(true);setError("");
    try{
      await request("/auth/social/email/verify","POST",{token},{challenge:true});
      if(!current())return;
      setComplete(true);
      window.history.replaceState(null,"",origin.pathname+"#social-email-verify");
      expectedHref=new URL(origin.pathname+"#social-email-verify",origin.origin).href;
    }catch(e){if(current())setError(message(e));}
    finally{if(current())setBusy(false);}
  }
  return <section><h3>소셜 계정의 서비스 이메일 인증</h3>{complete?<p role="status">이메일 인증을 완료했습니다. 원래 소셜 가입 확인 창으로 돌아가 ‘이메일 인증 상태 새로고침’을 누른 뒤 가입을 확정하세요.</p>:<>
    <p>메일 링크를 확인한 후 서비스 이메일 인증을 완료하세요.</p><button disabled={!token||busy} onClick={()=>void verify()}>이메일 인증 완료하기</button>
    {busy&&<p role="status">이메일을 인증하고 있습니다.</p>}{error&&<p role="alert">{error} 원래 가입 창에서 새 메일을 요청하세요.</p>}</>}
    <a href="#login">로그인으로 돌아가기</a>
  </section>;
}
