import {useEffect,useState} from "react";
import {listConfigs,type ConfigRecord} from "./additionalConfigApi";
import {message} from "./api";
export default function CadenceSettingsSummary({executor,settings,managed}:{executor:string;settings:()=>void;managed:boolean}){
 const [retry,setRetry]=useState(0),[view,setView]=useState<{executor:string;row:ConfigRecord|null;error:string;loaded:boolean}>({executor:"",row:null,error:"",loaded:false});
 useEffect(()=>{let disposed=false;const abort=new AbortController();if(!executor)return;setView({executor,row:null,error:"",loaded:false});void listConfigs(executor,abort.signal).then(rows=>{const cadence=rows.filter(r=>r.value.kind==="CADENCE"&&!r.deleted_at);if(cadence.length>1)throw new Error("반복 설정 소유권이 중복됐습니다.");if(!disposed)setView({executor,row:cadence[0]??null,error:"",loaded:true});}).catch(error=>{if(!disposed)setView({executor,row:null,error:message(error),loaded:true});});return()=>{disposed=true;abort.abort();};},[executor,retry]);
 const current=view.executor===executor?view:null,row=current?.row;
 return <details className="historical-policy"><summary>반복 집중·휴식 설정</summary>
  {!executor?<p>실행 설치를 선택하면 저장된 설정을 확인합니다.</p>:!current?.loaded?<p role="status">반복 설정 확인 중</p>:current.error?<p role="alert">{current.error}</p>:row?<p>저장 버전 {row.version} · {row.value.enabled===true?"활성 설정 저장됨":"설정 비활성"} · 실행 성공과 별도로 확인합니다.</p>:<p>저장된 반복 설정이 없습니다.</p>}
  {row&&<p>{summary(row)}</p>}<p>{managed?"현재 실행의 Snapshot·Attachment·반복 설정은 최초 값으로 고정됩니다. 변경·삭제는 현재 실행을 바꾸지 않습니다.":"Core CADENCE 연결 대기 · 일반 집중 세션에 반복 설정을 적용한 것으로 표시하지 않습니다."}</p>
  <p>휴식 단계·주기 번호는 현재 RC2 FocusState에 없습니다. PAUSED를 휴식으로 추정하지 않습니다.</p><button onClick={settings}>반복 설정 확인·수정</button><button disabled={!executor||!current?.loaded} onClick={()=>setRetry(n=>n+1)}>반복 설정 다시 조회</button>
 </details>;
}
function summary(row:ConfigRecord){const v=row.value;const valid=(n:unknown,max:number)=>typeof n==="number"&&Number.isInteger(n)&&n>=1&&n<=max;if(!valid(v.focus_minutes,180)||!valid(v.rest_minutes,180)||!valid(v.cycles,12)||typeof v.auto_start_next!=="boolean")return "반복 설정 값 확인 필요 · 실행 성공으로 판단하지 않습니다.";return `집중 ${v.focus_minutes}분 · 휴식 ${v.rest_minutes}분 · ${v.cycles}주기 · 다음 집중 ${v.auto_start_next?"자동 시작 설정":"사용자 확인 대기"}`;}
