import {ApiError,UiError} from "./api";
import {readConfig,type ConfigRecord} from "./additionalConfigApi";
import {dailyUsage,type DailyUsage} from "./dailyUsageApi";

export type SiteTimeStatus={config:ConfigRecord;usage:DailyUsage|null;usageUnavailable:boolean};
function siteTime(row:ConfigRecord){
 if(row.value.kind!=="SITE_TIME"||row.value.policy_id!==row.config_id||row.value.version!==row.version)throw new UiError("사이트 시간 정책의 신원·버전을 확인하지 못했습니다.");
}
/** Read one existing policy; this neither applies a policy nor creates a clock/effect proof.
 * DAY-01 is historical data, not proof for CFG02's current runtime revision.
 */
export async function siteTimeStatus(executor:string,id:string,date:string,signal?:AbortSignal,minimumVersion=1):Promise<SiteTimeStatus>{
 if(!Number.isSafeInteger(minimumVersion)||minimumVersion<1)throw new UiError("선택한 정책의 버전을 확인하지 못했습니다.");
 const before=await readConfig(executor,id,signal);siteTime(before);
 // A fresh request can still return an older projection; do not use it for a known newer selection.
 if(before.version<minimumVersion)throw new UiError("선택한 정책보다 이전 버전의 응답입니다. 설정을 다시 조회해 주세요.");
 let usage:DailyUsage|null=null,usageUnavailable=false;
 try{usage=await dailyUsage(executor,id,date,signal);}catch(error){
  if(!(error instanceof ApiError)||![404,503].includes(error.status))throw error;
  usageUnavailable=true;
 }
 const after=await readConfig(executor,id,signal);siteTime(after);
 if(after.version!==before.version||after.saved_runtime_revision!==before.saved_runtime_revision||after.deleted_at!==before.deleted_at)
  throw new UiError("조회 중 정책이 변경됐습니다. 다시 조회해 주세요. 이전 사용량을 새 정책의 결과로 표시하지 않습니다.");
 return {config:after,usage,usageUnavailable};
}
