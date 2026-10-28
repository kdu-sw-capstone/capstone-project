import {UiError} from './api';
// Build-time opt-in for a release whose Worker hashes support the approved contracts.
// This only requests Server admission; it grants no authority and never rewrites old sessions.
export function memberTransitionContracts(value=import.meta.env.VITE_MEMBER_TRANSITION_CONTRACTS??'') {
 if(value==='')return {};
 if(value!=='NR01_1,DP01_1,ND01_1')throw new UiError('지원하는 실행 계약 설정을 확인하지 못했습니다. 시작 요청을 보내지 않았습니다.');
 return {native_transition_contract:'NR01_1',dom_transition_contract:'DP01_1',document_transition_contract:'ND01_1'};
}