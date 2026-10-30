import type {ConfigRecord} from "./additionalConfigApi";

export type DeliveryState={state:"PENDING"|"APPLIED"|"UNKNOWN"|"UNSUPPORTED"|"NOT_APPLICABLE";label:string};
/** Server validates the exact config version; a later package may carry that unchanged version. */
export function configDelivery(row:ConfigRecord):DeliveryState {
 if(row.deleted_at!==null){
  if(row.value.kind==="SITE_TIME"&&row.runtime_apply_state==="NOT_APPLICABLE")return {state:"NOT_APPLICABLE",label:"삭제된 설정의 실제 해제 확인됨"};
  if(row.runtime_apply_state==="UNKNOWN"||row.runtime_apply_state==="APPLIED")return {state:"UNKNOWN",label:"삭제 요청 보존 · 해제 결과 미확인"};
  return {state:"PENDING",label:row.value.kind==="SITE_TIME"?"설정 삭제됨 · 실제 해제 확인 대기":"설정 삭제됨 · 기존 집중의 고정 설정·복원 의무는 별도 확인"};
 }
 if(row.runtime_apply_state==="APPLIED")return row.applied_runtime_revision!==null&&row.applied_runtime_revision>=row.saved_runtime_revision
  ?{state:"APPLIED",label:"적용 확인됨"}:{state:"UNKNOWN",label:"현재 저장된 설정의 적용 여부를 확인하지 못했습니다"};
 if(row.runtime_apply_state==="UNKNOWN")return {state:"UNKNOWN",label:"적용 결과 미확인"};
 if(row.runtime_apply_state==="UNSUPPORTED")return {state:"UNSUPPORTED",label:"현재 브라우저에서 지원되지 않습니다"};
 if(row.runtime_apply_state==="NOT_APPLICABLE")return {state:"NOT_APPLICABLE",label:"현재 적용 대상이 없습니다"};
 return {state:"PENDING",label:row.value.kind==="CONTENT"?"저장됨 · 다음 집중 적용 대기":"저장됨 · 적용 대기"};
}
export type UsageReceipt={status:"ACCEPTED"|"DUPLICATE"|"PENDING_DEPENDENCY"|"REJECTED"|"NOT_RECEIVED";measurement_state:"COUNTED"|"QUARANTINED"|"UNCONFIRMED"|"NOT_RECEIVED"};
/** Usage acknowledgement cannot establish policy application, focus duration or a live remaining quota. */
export function usageReceiptLabel(receipt:UsageReceipt):string {
 if(receipt.status==="PENDING_DEPENDENCY")return "선행 기록 수신 대기";
 if(receipt.status==="REJECTED")return "수신 거절 · 원본 기록 보존";
 if(receipt.status==="NOT_RECEIVED")return "수신 미확인";
 if(receipt.measurement_state==="QUARANTINED")return "수신됨 · 시간 확인 대기";
 if(receipt.measurement_state==="COUNTED")return "수신됨 · 이용시간 측정 확인";
 return "수신됨 · 측정 결과 미확인";
}
