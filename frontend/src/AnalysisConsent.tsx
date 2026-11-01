import {useEffect,useRef,useState} from "react";
import {ApiError,request} from "./api";
type Consent={accepted:boolean;notice_version:string|null;version:number;provider_configured:false};
function valid(row:Consent){
 if(!row||typeof row.accepted!=="boolean"||!Number.isSafeInteger(row.version)||row.version<0||row.provider_configured!==false||!(row.notice_version===null||typeof row.notice_version==="string"&&row.notice_version.length>0&&row.notice_version.length<=40)||row.accepted&&(row.notice_version===null||row.version===0))throw Error("동의 결과 확인 필요");return row;
}
export default function AnalysisConsent({owner}:{owner:string}){return <ConsentView key={owner}/>;}
function ConsentView(){
 const [state,setState]=useState<Consent|null>(null),[error,setError]=useState(""),[busy,setBusy]=useState(false);
 const life=useRef({current:false}),intent=useRef<{version:number;notice:string;key:string}|null>(null),reload=useRef<()=>void>(()=>{});
 useEffect(()=>{const active={current:true};life.current=active;const abort=new AbortController();
  const load=()=>{void request<Consent>("/analysis-consent","GET",undefined,{signal:abort.signal}).then(row=>{if(active.current){setState(valid(row));setError("");}}).catch(e=>{if(!active.current)return;setError("동의 상태를 확인하지 못했습니다.");if(e instanceof ApiError&&e.status===401)window.dispatchEvent(new Event("focurve:authentication-expired"));});};reload.current=load;load();
  return()=>{active.current=false;abort.abort();};
 },[]);
 async function withdraw(){
  if(!state?.notice_version||busy)return;const active=life.current;setBusy(true);setError("");
  const saved=intent.current??={version:state.version,notice:state.notice_version,key:crypto.randomUUID()};
  try{const result=valid(await request<Consent>("/analysis-consent","PUT",{accepted:false,notice_version:saved.notice},{version:saved.version,key:saved.key}));if(!active.current)return;if(result.accepted||result.notice_version!==saved.notice||result.version!==saved.version+1)throw Error("동의 철회 응답 불일치");setState(result);intent.current=null;}
  catch(e){if(!active.current)return;setError(e instanceof ApiError&&e.status===412?"동의 상태가 변경됐습니다. 화면을 다시 열어 현재 상태를 확인해 주세요.":"철회 결과를 확인하지 못했습니다. 같은 요청으로 다시 확인해 주세요.");if(e instanceof ApiError&&[412,422,428].includes(e.status))intent.current=null;if(e instanceof ApiError&&e.status===401)window.dispatchEvent(new Event("focurve:authentication-expired"));}
  finally{if(active.current)setBusy(false);}
 }
 return <section className="settings-card" aria-label="AI 분석 동의"><h4>AI 분석 동의</h4><p>{state?state.accepted?"저장된 동의 있음":"동의 안 함":error?"동의 상태 미확인":"동의 상태 확인 중"}</p><p>제공자와 고지가 확정되지 않아 AI 분석과 외부 전송을 사용할 수 없습니다.</p><p>회원 집계만 사용하며 원문·메모·이메일·전체 URL은 전송하지 않습니다. AI는 제안만 제공합니다.</p>{state?.accepted&&<button disabled={busy} onClick={()=>void withdraw()}>{busy?"철회 확인 중":"AI 동의 철회"}</button>}{error&&<><p role="alert">{error}</p><button disabled={busy} onClick={()=>reload.current()}>동의 상태 재조회</button></>}</section>;
}
