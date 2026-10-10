import {useEffect,useId,useRef,useState,type FormEvent,type ReactNode} from 'react';
import {ApiError,message,request} from './api';
type Progress={email:string;request_id?:string;expires_at?:string;resend_at?:number;verification_proof?:string;proof_expires_at?:string;completed?:boolean};
const storage='focurve:email-signup-code';
export function clearSignupProgress(){sessionStorage.removeItem(storage);}
function read():Progress {try{const value=JSON.parse(sessionStorage.getItem(storage)??'{}');return value?.schema===2&&typeof value.email==='string'&&(!value.request_id||(typeof value.request_id==='string'&&Number.isFinite(Date.parse(value.expires_at))))?value:{email:''};}catch{return {email:''};}}
export default function EmailSignup({terms,social}:{terms:ReactNode;social?:ReactNode}) {
  const [progress,setProgress]=useState<Progress>(read),[code,setCode]=useState(''),[busy,setBusy]=useState(false),[emailError,setEmailError]=useState(''),[formError,setFormError]=useState(''),[notice,setNotice]=useState(''),[phase,setPhase]=useState('');
  const [showPassword,setShowPassword]=useState(false),[showConfirmation,setShowConfirmation]=useState(false);
  const [key,setKey]=useState(()=>crypto.randomUUID()),[now,setNow]=useState(Date.now());
  const lock=useRef(false),emailField=useRef<HTMLInputElement>(null),id=useId();
  useEffect(()=>{sessionStorage.setItem(storage,JSON.stringify({...progress,schema:2}));},[progress]);
  useEffect(()=>{const timer=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(timer);},[]);
  const verified=!!progress.verification_proof&&Date.parse(progress.proof_expires_at??'')>now;
  const expired=!!progress.request_id&&Date.parse(progress.expires_at??'')<=now;
  const wait=Math.max(0,Math.ceil(((progress.resend_at??0)-now)/1000));
  const remaining=Math.max(0,Math.ceil((Date.parse(progress.expires_at??'')-now)/1000));
  async function run(work:()=>Promise<void>,action:string,emailAction=true){
    if(lock.current)return;lock.current=true;setBusy(true);setPhase(action);setEmailError('');setFormError('');setNotice('');
    try{await work();}catch(e){
      if(emailAction)setEmailError(message(e));else setFormError(message(e));
      if(e instanceof ApiError&&['CODE_EXPIRED','CODE_SUPERSEDED','CODE_USED','EMAIL_CODE_REQUIRED'].includes(e.code))setProgress(p=>({...p,verification_proof:undefined,proof_expires_at:undefined}));
      if(emailAction&&e instanceof ApiError&&e.status===429&&e.code==='RATE_LIMITED') {
        const retry=Math.max(1,e.retryAfter||60);
        if(action==='인증번호 발송 중') {
          const receivedAt=Date.now();setNow(receivedAt);
          setProgress(p=>({...p,resend_at:receivedAt+retry*1000}));
        }
        else setEmailError(`${message(e)} ${Math.floor(retry/60)}분 ${retry%60}초 후 인증번호를 다시 확인하세요.`);
      }
    }finally{lock.current=false;setBusy(false);}
  }
  async function sendCode(){
    if(!emailField.current?.reportValidity())return;
    const email=emailField.current.value.trim();
    await run(async()=>{
      const result=await request<{request_id:string;expires_at:string;resend_after_seconds:number}>('/auth/email/signup-code-requests','POST',{email});
      const receivedAt=Date.now();setNow(receivedAt);setProgress({email,...result,resend_at:receivedAt+result.resend_after_seconds*1000});setCode('');setKey(crypto.randomUUID());setNotice('인증번호를 보냈습니다. 스팸함도 확인해주세요.');
    },'인증번호 발송 중');
  }
  async function verify(){
    if(!/^[0-9]{6}$/.test(code)){setEmailError('인증번호는 숫자 6자리로 입력하세요.');return;}
    await run(async()=>{
      const result=await request<{verification_proof:string;proof_expires_at:string}>('/auth/email/signup-code-verifications','POST',{request_id:progress.request_id,email:progress.email,code});
      setProgress(p=>({...p,...result}));setCode('');setKey(crypto.randomUUID());setNotice('');
    },'이메일 인증 중');
  }
  function changeEmail(email:string){setProgress({email});setCode('');setNotice('');setEmailError('');setFormError('');setKey(crypto.randomUUID());}
  async function signup(event:FormEvent<HTMLFormElement>){
    event.preventDefault();const form=new FormData(event.currentTarget);
    if(form.get('password')!==form.get('confirmation')){setFormError('비밀번호 확인이 일치하지 않습니다.');return;}
    if(!verified){setEmailError('먼저 이메일 인증번호를 확인해 주세요.');return;}
    await run(async()=>{
      await request('/auth/signup','POST',{email:progress.email,password:form.get('password'),display_name:form.get('display_name'),terms_version:'dev-v1',verification_proof:progress.verification_proof},{key});
      setProgress({email:progress.email,completed:true});setCode('');
    },'회원가입 처리 중',false);
  }
  if(progress.completed)return <section className="signup-complete"><h3>가입 완료</h3><p role="status">이메일 인증과 회원가입을 완료했습니다. 가입한 이메일과 비밀번호로 로그인하세요.</p><a className="auth-link-button" href="#login" onClick={()=>sessionStorage.removeItem(storage)}>로그인으로 이동</a></section>;
  return <section className="signup-form"><h3>회원가입</h3><p className="signup-intro">나에게 맞는 집중을 시작해보세요.</p>
    {social}<div className="signup-divider"><span>또는 이메일로 가입</span></div>
    {import.meta.env.DEV&&import.meta.env.VITE_MAIL_MODE!=='external'&&<p className="signup-helper">이 환경은 외부 이메일 발송 설정이 아직 완료되지 않았습니다.</p>}
    <form onSubmit={signup} onChange={()=>{setKey(crypto.randomUUID());setFormError('');}}>
      <div className="signup-field signup-email" aria-busy={busy&&phase!=='회원가입 처리 중'}>
        <label htmlFor={`${id}-email`}>이메일</label>
        <div className={`signup-input-row ${progress.request_id&&!verified?'signup-email-sent':''}`}><input id={`${id}-email`} ref={emailField} name="email" type="email" title={progress.email} spellCheck={false} autoCapitalize="none" value={progress.email??''} required maxLength={254} autoComplete="email" placeholder="you@example.com" disabled={busy} readOnly={verified} aria-describedby={`${id}-email-status`} onChange={e=>changeEmail(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!verified){e.preventDefault();}}}/>
          {verified?<button className="signup-secondary" type="button" disabled={busy} onClick={()=>{changeEmail(progress.email);emailField.current?.focus();}}>이메일 변경</button>:!progress.request_id&&<button className="signup-secondary" type="button" disabled={busy||wait>0} onClick={()=>void sendCode()}>{busy?'발송 중…':'인증번호 받기'}</button>}
        </div>
        <div id={`${id}-email-status`} className="signup-email-feedback" aria-live="polite">
          {verified?<p className="signup-verified" role="status">✓ 이메일 인증 완료</p>:<>
            {progress.request_id&&<><label className="signup-code-label" htmlFor={`${id}-code`}>인증번호</label><div className="signup-input-row signup-code-row"><input id={`${id}-code`} className="signup-code-input" name="verification_code" value={code} onChange={e=>{setCode(e.target.value.replace(/[\s-]/g,''));setEmailError('');}} inputMode="numeric" autoComplete="one-time-code" maxLength={12} pattern="[0-9]{6}" placeholder="6자리 인증번호" disabled={busy} aria-invalid={!!emailError} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();if(!busy&&!expired)void verify();}}}/><button className="signup-secondary" type="button" disabled={busy||expired} onClick={()=>void verify()}>{busy&&phase==='이메일 인증 중'?'확인 중…':'확인'}</button></div>
              <div className="signup-code-meta"><span>{expired?'인증번호가 만료되었습니다.':`남은 시간 ${Math.floor(remaining/60)}:${String(remaining%60).padStart(2,'0')}`}</span><button type="button" className="signup-text-button" disabled={busy||wait>0} onClick={()=>void sendCode()}>{wait>0?`재발송 ${Math.floor(wait/60)}분 ${wait%60}초 후`:'인증번호 다시 받기'}</button></div>
              </>}
            {!progress.request_id&&wait>0&&<p className="signup-helper" role="status">인증번호 요청은 {Math.floor(wait/60)}분 {wait%60}초 후 다시 할 수 있습니다.</p>}
            {emailError&&<p className="signup-field-error" role="alert">{emailError}</p>}{notice&&!emailError&&!expired&&!busy&&<p className="signup-helper" role="status">{notice}</p>}
          </>}
        </div>
      </div>
      <div className="signup-field"><label htmlFor={`${id}-name`}>표시명</label><input id={`${id}-name`} name="display_name" required maxLength={40} autoComplete="nickname" placeholder="서비스에서 사용할 이름"/></div>
      <div className="signup-field"><label htmlFor={`${id}-password`}>비밀번호</label><div className="signup-password-row"><input id={`${id}-password`} name="password" type={showPassword?'text':'password'} required minLength={12} maxLength={128} autoComplete="new-password" placeholder="비밀번호 입력" aria-describedby={`${id}-password-help`}/><button type="button" className="signup-password-toggle" aria-label={showPassword?'비밀번호 숨기기':'비밀번호 보기'} aria-pressed={showPassword} onClick={()=>setShowPassword(v=>!v)}>{showPassword?'숨기기':'보기'}</button></div><p id={`${id}-password-help`} className="signup-helper">12~128자로 입력해주세요.</p></div>
      <div className="signup-field"><label htmlFor={`${id}-confirmation`}>비밀번호 확인</label><div className="signup-password-row"><input id={`${id}-confirmation`} name="confirmation" type={showConfirmation?'text':'password'} required minLength={12} maxLength={128} autoComplete="new-password" placeholder="비밀번호 다시 입력"/><button type="button" className="signup-password-toggle" aria-label={showConfirmation?'비밀번호 확인 숨기기':'비밀번호 확인 보기'} aria-pressed={showConfirmation} onClick={()=>setShowConfirmation(v=>!v)}>{showConfirmation?'숨기기':'보기'}</button></div></div>
      <div className="signup-terms">{terms}</div>
      {formError&&<p className="signup-field-error" role="alert">{formError}</p>}
      <button className="signup-submit" disabled={busy||!verified}>{busy&&phase==='회원가입 처리 중'?'가입 중…':'회원가입'}</button>
    </form>
  </section>;
}
