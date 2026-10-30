import {useEffect,useRef,useState} from "react";
import {message,UiError} from "./api";
import {readFocusControl,focusControlWrite,sameFocusRef,type FocusView,type FocusAction} from "./cadenceControlApi";

/** One writer UI; a verified coordinated session never falls back to legacy controls after a read failure. */
export function useCadenceControl(session:string|undefined,executor:string|undefined){
 const identity=`${session??""}:${executor??""}`;
 const [view,setView]=useState<{identity:string;frame:FocusView|null;managed:boolean;error:string;busy:boolean}>({identity,frame:null,managed:false,error:"",busy:false});
 const holder=useRef<{identity:string;last:FocusView|null;locked:boolean;pending?:string}>({identity,last:null,locked:false});
 useEffect(()=>{
  let disposed=false,reading=false;const abort=new AbortController();holder.current={identity,last:null,locked:false};setView({identity,frame:null,managed:false,error:"",busy:false});
  if(!session||!executor)return()=>{disposed=true;abort.abort();};
  async function read(){if(reading||disposed)return;reading=true;
   try{const next=await readFocusControl(session!,executor!,abort.signal);if(disposed)return;const last=holder.current.last;
    if(!next){if(last)throw new UiError("Core 연결을 확인하지 못했습니다. 기존 제어로 전환하지 않습니다.");return;}
    if(last&&(!sameFocusRef(last.state.focus_ref,next.state.focus_ref)||last.context.attachment_id!==next.context.attachment_id||last.context.owner_epoch!==next.context.owner_epoch||last.context.owner_binding_id!==next.context.owner_binding_id))throw new UiError("고정 정책 또는 소유권 결속이 변경됐습니다. 조작을 중단합니다.");
    if(last&&next.context.version<last.context.version)return;holder.current.last=next;
    if(holder.current.pending===next.state.operation_id){holder.current.pending=undefined;holder.current.locked=false;}
    setView(old=>old.identity===identity?{...old,frame:next,managed:true,busy:holder.current.pending?true:holder.current.locked?old.busy:false,error:holder.current.locked?old.error:""}:old);
   }catch(error){if(!disposed)setView(old=>old.identity===identity?{...old,error:message(error)}:old);}finally{reading=false;}
  }
  void read();const timer=setInterval(()=>{void read();},1000);return()=>{disposed=true;abort.abort();clearInterval(timer);};
 },[identity,session,executor]);
 const current=view.identity===identity?view:{identity,frame:null,managed:false,error:"",busy:false};
 async function send(action:FocusAction,duration:number|null=null){
  const handle=holder.current,frame=handle.last;if(handle.identity!==identity||!frame||current.busy||current.error||handle.locked)throw new UiError("최신 실행 상태를 확인한 뒤 조작하세요.");
  handle.locked=true;setView(old=>({...old,busy:true}));
  try{const accepted=await focusControlWrite(frame,action,duration).send(); // only a subsequent correlated GET updates actual state
   if(holder.current===handle)handle.pending=accepted.operation_id;
  }catch(error){if(holder.current===handle)setView(old=>({...old,busy:false,error:message(error)}));throw error;}
 }
 return {...current,send};
}
