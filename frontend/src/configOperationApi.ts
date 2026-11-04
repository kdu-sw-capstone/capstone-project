import {request,UiError} from "./api";
export type ConfigOperation={operation_id:string;state:"PENDING"|"IN_FLIGHT"|"IN_DOUBT"|"CONFIRMED"|"FAILED"|"RELEASE_PENDING";actual_effect_confirmed:boolean;error_code:string|null};
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
/** OP-01 is an authorized read, never a retry of DELETE or a replacement for CFG02. */
export async function readConfigOperation(id:string,signal?:AbortSignal):Promise<ConfigOperation>{
 if(!uuid.test(id))throw new UiError("삭제 작업 식별자를 확인하지 못했습니다.");
 const value=await request<ConfigOperation>(`/amvp/operations/${id}`,"GET",undefined,{signal});
 if(!value||value.operation_id!==id||!["PENDING","IN_FLIGHT","IN_DOUBT","CONFIRMED","FAILED","RELEASE_PENDING"].includes(value.state)||typeof value.actual_effect_confirmed!=="boolean"||value.actual_effect_confirmed!==(value.state==="CONFIRMED")||(value.error_code!==null&&(typeof value.error_code!=="string"||value.error_code.length<1||value.error_code.length>80)))throw new UiError("삭제 작업의 신원·해제 증거를 확인하지 못했습니다.");
 return value;
}
