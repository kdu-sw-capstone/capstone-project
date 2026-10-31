import {useEffect,useState} from "react";
import {Panel} from "./AdditionalUi";
import {message,UiError} from "./api";
import {readConfig,listSiteTimeDeletions,type ConfigRecord} from "./additionalConfigApi";
import {configDelivery} from "./runtimeDeliveryState";
import {readConfigOperation} from "./configOperationApi";
export type DeletedConfigRef={executor:string;id:string;previousVersion:number;operationId?:string};
/** Rebuild SITE_TIME requests from the Server ledger on every mount; memory is not release authority. */
export default function DeletedConfigReleasePanel({executor,targets}:{executor:string;targets:DeletedConfigRef[]}){
 const own=targets.filter(t=>t.executor===executor),identity=JSON.stringify([executor,...own.map(t=>[t.id,t.previousVersion,t.operationId])]);const [retry,setRetry]=useState(0);
 const [view,setView]=useState<{identity:string;rows:ConfigRecord[];error:string;loading:boolean}>({identity:"",rows:[],error:"",loading:true});
 useEffect(()=>{let disposed=false;const abort=new AbortController();setView({identity,rows:[],error:"",loading:true});
  void listSiteTimeDeletions(executor,abort.signal).then(async history=>{
   const rows=new Map(history.map(row=>[row.config_id,row]));
   // A just-acknowledged request can arrive during history pagination. Re-read it, never overwrite
   // a later explicit GET with an earlier history response. Other frozen config kinds retain PR35 behavior.
   for(const target of own){
    const operation=target.operationId?await readConfigOperation(target.operationId,abort.signal):null;
    let row=await readConfig(executor,target.id,abort.signal);if(row.deleted_at===null||row.version!==target.previousVersion+1)throw new UiError("삭제한 설정의 버전·원문을 확인하지 못했습니다.");
    // Both reads must confirm the known request. An uncertain receipt is not release proof.
    if(operation&&(operation.state==="IN_DOUBT"||operation.state==="FAILED"||row.runtime_apply_state==="NOT_APPLICABLE"&&!operation.actual_effect_confirmed))row={...row,runtime_apply_state:"UNKNOWN",applied_runtime_revision:null};
    rows.set(row.config_id,row);
   }
   return [...rows.values()];
  }).then(rows=>{if(!disposed)setView({identity,rows,error:"",loading:false});}).catch(error=>{if(!disposed)setView({identity,rows:[],error:message(error),loading:false});});return()=>{disposed=true;abort.abort();};
 // Identity includes installation/config/version; an older response cannot clear a new obligation.
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[identity,retry]);
 const current=view.identity===identity?view:{identity,rows:[],error:"",loading:true};
 return <Panel title="삭제 요청·해제 확인"><p>현재 회원·설치의 서버 SITE_TIME 삭제 기록을 복원합니다. 설정 목록에서 사라져도 실제 해제·복원이 끝난 것은 아닙니다.</p>
  {current.loading?<p role="status">삭제된 설정의 해제 결과 확인 중</p>:current.error?<p role="alert">{current.error} · 해제 성공으로 표시하지 않습니다.</p>:<ul>{current.rows.map(row=><li key={row.config_id}>삭제 버전 {row.version} · {configDelivery(row).label}</li>)}</ul>}
  {!current.loading&&!current.error&&!current.rows.length&&<p>이 조회에서 확인된 SITE_TIME 삭제 요청이 없습니다. 서버 조회 실패를 요청 없음으로 표시하지 않습니다.</p>}
  <button disabled={current.loading} onClick={()=>setRetry(n=>n+1)}>삭제 요청 해제 상태 다시 조회</button><small>SITE_TIME은 새로고침·재진입 때 서버에서 다시 조회합니다. 다른 종류의 이 화면 삭제 참조는 기존처럼 메모리에만 남으며 고정 집중·복원 의무는 별도입니다.</small>
 </Panel>;
}
