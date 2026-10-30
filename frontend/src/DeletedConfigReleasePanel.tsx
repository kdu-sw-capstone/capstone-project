import {useEffect,useState} from "react";
import {Panel} from "./AdditionalUi";
import {message,UiError} from "./api";
import {readConfig,type ConfigRecord} from "./additionalConfigApi";
import {configDelivery} from "./runtimeDeliveryState";
export type DeletedConfigRef={executor:string;id:string;previousVersion:number};
/** Only IDs acknowledged in this screen are retained in memory. Never invent a tombstone-list API. */
export default function DeletedConfigReleasePanel({executor,targets}:{executor:string;targets:DeletedConfigRef[]}){
 const own=targets.filter(t=>t.executor===executor),identity=JSON.stringify([executor,...own.map(t=>[t.id,t.previousVersion])]);const [retry,setRetry]=useState(0);
 const [view,setView]=useState<{identity:string;rows:ConfigRecord[];error:string;loading:boolean}>({identity:"",rows:[],error:"",loading:true});
 useEffect(()=>{let disposed=false;const abort=new AbortController();setView({identity,rows:[],error:"",loading:true});
  void Promise.all(own.map(async target=>{const row=await readConfig(executor,target.id,abort.signal);if(row.deleted_at===null||row.version!==target.previousVersion+1)throw new UiError("삭제한 설정의 버전·원문을 확인하지 못했습니다.");return row;})).then(rows=>{if(!disposed)setView({identity,rows,error:"",loading:false});}).catch(error=>{if(!disposed)setView({identity,rows:[],error:message(error),loading:false});});return()=>{disposed=true;abort.abort();};
 // Identity includes installation/config/version; an older response cannot clear a new obligation.
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[identity,retry]);
 if(!own.length)return null;const current=view.identity===identity?view:{identity,rows:[],error:"",loading:true};
 return <Panel title="삭제 요청·해제 확인"><p>이 화면에서 접수한 삭제 요청입니다. 설정 목록에서 사라져도 실제 해제·복원이 끝난 것은 아닙니다.</p>
  {current.loading?<p role="status">삭제된 설정의 해제 결과 확인 중</p>:current.error?<p role="alert">{current.error} · 해제 성공으로 표시하지 않습니다.</p>:<ul>{current.rows.map(row=><li key={row.config_id}>삭제 버전 {row.version} · {configDelivery(row).label}</li>)}</ul>}
  <button disabled={current.loading} onClick={()=>setRetry(n=>n+1)}>삭제 요청 해제 상태 다시 조회</button><small>요청 참조는 이 화면에만 보관합니다. 새로고침 후 참조 목록 자동 복원은 지원하지 않으며 서버 원장·해제 의무는 그대로 보존합니다.</small>
 </Panel>;
}
