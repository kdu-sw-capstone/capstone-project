import {request, UiError} from "./api";

export type ConfigValue = Record<string, unknown> & {kind:"CONTENT"|"CADENCE"|"SITE_TIME"|"FOCUS_SCHEDULE"};
export type ConfigRecord = {
 config_id:string;executor_id:string;version:number;value:ConfigValue;deleted_at:string|null;
 saved_state:"SAVED";runtime_apply_state:"PENDING"|"APPLIED"|"UNKNOWN"|"UNSUPPORTED"|"NOT_APPLICABLE";
 saved_runtime_revision:number;applied_runtime_revision:number|null;next_focus_revision:number;updated_at:string;
};
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
function identity(value:string){if(!uuid.test(value))throw new UiError("설치 또는 설정 식별자를 확인하지 못했습니다.");}
function safe(value:unknown):boolean{return typeof value==="number"&&Number.isSafeInteger(value)&&value>=1;}
function parse(value:ConfigRecord,executor:string):ConfigRecord {
 if(!value||!uuid.test(value.config_id)||value.executor_id!==executor||!Number.isSafeInteger(value.version)||value.version<1||value.saved_state!=="SAVED"||!value.value||!["CONTENT","CADENCE","SITE_TIME","FOCUS_SCHEDULE"].includes(value.value.kind)||!["PENDING","APPLIED","UNKNOWN","UNSUPPORTED","NOT_APPLICABLE"].includes(value.runtime_apply_state)||!Number.isSafeInteger(value.saved_runtime_revision)||value.saved_runtime_revision<1||!safe(value.next_focus_revision)||(value.applied_runtime_revision!==null&&!safe(value.applied_runtime_revision))||(value.deleted_at!==null&&typeof value.deleted_at!=="string")||typeof value.updated_at!=="string"||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value.updated_at))throw new UiError("저장 결과의 설치·버전을 확인하지 못했습니다. 같은 작업을 새 요청으로 반복하지 마세요.");
 return value;
}
function canonical(value:unknown):string {
 if(Array.isArray(value))return "["+value.map(canonical).join(",")+"]";
 if(value!==null&&typeof value==="object")return "{"+Object.entries(value).sort(([a],[b])=>a<b?-1:a>b?1:0).map(([key,item])=>JSON.stringify(key)+":"+canonical(item)).join(",")+"}";
 return JSON.stringify(value);
}
export async function listConfigs(executor:string,signal?:AbortSignal):Promise<ConfigRecord[]> {
 identity(executor);const records:ConfigRecord[]=[],seen=new Set<string>();let cursor:string|null=null;
 do {
  const query=new URLSearchParams({executor_id:executor,limit:"100"});if(cursor)query.set("cursor",cursor);
  const page=await request<{items:ConfigRecord[];next_cursor:string|null;has_more:boolean}>("/amvp/configs?"+query,"GET",undefined,{signal});
  if(!Array.isArray(page?.items)||typeof page.has_more!=="boolean"||page.has_more!==(typeof page.next_cursor==="string"&&page.next_cursor.length>0))throw new UiError("설정 목록을 끝까지 확인하지 못했습니다.");
  for(const row of page.items){parse(row,executor);if(seen.has(row.config_id))throw new UiError("설정 목록이 변경됐습니다. 다시 조회하세요.");seen.add(row.config_id);records.push(row);}
  if(page.next_cursor===cursor&&cursor!==null)throw new UiError("설정 목록 조회가 반복됐습니다.");cursor=page.next_cursor;
 }while(cursor);
 return records;
}
/** Existing CFG02 reads an explicitly known tombstone; no new enumeration or guest storage access. */
export async function readConfig(executor:string,id:string,signal?:AbortSignal):Promise<ConfigRecord>{
 identity(executor);identity(id);const row=parse(await request<ConfigRecord>(`/amvp/configs/${id}`,"GET",undefined,{signal}),executor);
 if(row.config_id!==id)throw new UiError("다른 설정의 조회 응답을 받았습니다.");return row;
}
/** Server-backed Web read model, deliberately separate from RC2 CFG01's active-only list. */
export async function listSiteTimeDeletions(executor:string,signal?:AbortSignal):Promise<ConfigRecord[]>{
 identity(executor);const rows:ConfigRecord[]=[],ids=new Set<string>(),cursors=new Set<string>();let cursor:string|null=null;
 do{const query=new URLSearchParams({executor_id:executor,limit:"100"});if(cursor)query.set("cursor",cursor);
  const page=await request<{read_model:string;items:ConfigRecord[];has_more:boolean;next_cursor:string|null}>(`/amvp/web/site-time-deletions?${query}`,"GET",undefined,{signal});
  if(page?.read_model!=="AMVP_SITE_TIME_DELETIONS_1"||!Array.isArray(page.items)||typeof page.has_more!=="boolean"||page.has_more!==(typeof page.next_cursor==="string"&&page.next_cursor.length>0)||!page.has_more&&page.next_cursor!==null||page.has_more&&!page.items.length)throw new UiError("서버 삭제 요청 목록을 끝까지 확인하지 못했습니다.");
  for(const raw of page.items){const row=parse(raw,executor);if(row.value.kind!=="SITE_TIME"||row.deleted_at===null||!Number.isFinite(Date.parse(row.deleted_at))||row.version<2||row.value.policy_id!==row.config_id||row.value.version!==row.version||ids.has(row.config_id))throw new UiError("삭제 요청의 설치·정책·버전을 확인하지 못했습니다.");ids.add(row.config_id);rows.push(row);}
  cursor=page.next_cursor;if(cursor){if(cursors.has(cursor))throw new UiError("삭제 요청 목록 조회가 반복됐습니다.");cursors.add(cursor);}
 }while(cursor);return rows;
}
/** One immutable request/key pair survives an explicit retry after a lost response. */
export function configWrite(executor:string,id:string,value:ConfigValue,version?:number) {
 identity(executor);identity(id);const key=crypto.randomUUID(),body=structuredClone({executor_id:executor,value});
 return {key,async send():Promise<ConfigRecord>{
  const response=parse(await request<ConfigRecord>("/amvp/configs/"+id,"PUT",body,{key,version,create:version===undefined}),executor);
  if(response.config_id!==id)throw new UiError("다른 설정의 응답을 받았습니다.");
  const saved=parse(await request<ConfigRecord>("/amvp/configs/"+id),executor);
  if(saved.version!==response.version||canonical(saved.value)!==canonical(response.value))throw new UiError("다른 변경이 먼저 저장됐습니다. 현재 설정을 다시 조회하세요.");
  return saved;
 }};
}
export function configDelete(row:ConfigRecord) {
 const key=crypto.randomUUID();return {async send(){
  const result=await request<{operation_id:string;state:string;actual_effect_confirmed:boolean}>("/amvp/configs/"+row.config_id,"DELETE",undefined,{key,version:row.version});
  if(!result||!uuid.test(result.operation_id)||result.state!=="RELEASE_PENDING"||result.actual_effect_confirmed!==false)throw new UiError("삭제·해제 결과를 확인하지 못했습니다.");return result;
 }};
}
