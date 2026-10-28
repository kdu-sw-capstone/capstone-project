# EXT-02 문서별 제어 registry 기반

2026-10-10 / 윤종민 / feature/extension-core-ext-02 / 시작63193ef33da4a32610626e16b6eb30f0895e841a. 사용자 승인 범위: 지민 D06 재검토를 기다리는 동안 독립 Core 내부 문서 상태·복구 기반 구현. develop 병합 금지.

## 적용 기준과 범위

AGENTS.md·개발운영.md·통합현황.md·EXT-02 작업카드, 공용 D01D10 §7 D06, 데이터/복구의 Journal·owner 원칙, AC-EXT-02-01/03 및 AC-POLICY-03-02/03을 확인했다. 현재 소유자/문서/최신 제어 문맥, frozen snapshot, 실제 해제·복구 검증을 위한 내부 기반이다. 전체 AC 통과 판정이 아니다. 미합의 D06 type/enum/ready/QUERY/freeze/집계를 공용 계약으로 확정하지 않는다.

- `extension/src/document-control-registry.js`: 독립 ES module. 별도 IndexedDB `focurve-core-documents` v1, documents/slots store. 기존 Guest/Member Journal·보고·Event DB와 구분하며 기존 DB migration 없음.
- `extension/tests/document-control-registry.test.mjs`: fake-indexeddb 상태/중복/동시성/복구/저장 실패 시험15개.
- `extension/tests/ui/document_registry_worker.py`: 실제 Chromium Dedicated Worker 종료→새 Worker + native IndexedDB 영속/정리 재시도 시험. document/tab lifecycle 및 효과 결과는 합성이며 제품 MV3/YouTube 시험은 아니다.
- manifest/번들/제품 Worker/Content 코드 변경 없음. 이 모듈은 현재 제품에서 import하지 않는다. listener·메시지·정책 주입·기능 거절 해제·Server 보고·접근 이벤트도 추가하지 않는다.

## 구현 의미와 호출 순서

내부 필드명 executorKey/tab/frame/documentKey, scope(ownerKey/sessionKey/snapshotKey/revision/bindingKey)는 공용 wire가 아니다. 토큰/설치 증명/정책/URL/본문은 받거나 저장하지 않는다. reference/scope는 엄격한 필드 허용목록으로 검증한다. 실제 인증·권한·현재 owner/revision·Chrome 문서 조회는 향후 신뢰한 Core adapter가 수행해야 하며 문자열 검증이 인증을 대신하지 않는다.

1. 신뢰한 Chrome 현재 문서 확인 후 `observe(ref)` 호출. 슬롯 문서 교체는 이전 문서를 INACTIVE로만 표시한다. BFCache/비활성 문서를 소멸로 추정하지 않는다.
2. `stage(ref,{operationKey,action,controlScope})`가 sequence와 원래 binding 의무를 transaction으로 저장한다. **Promise가 commit 뒤 resolve한 다음에만 향후 dispatch 가능**하다. API가 dispatch를 실행하지 않는다.
3. 같은 operation/같은 의미 입력은 기존 ticket/result 반환(duplicate=true), 다른 내용 충돌 거절. 과거 결과 재조회는 새 실행이나 현재 상태 확정이 아니다. sequence는 문서 수명 동안 owner/session 변경과 무관하게 증가한다.
4. `complete(ticket,outcome)`는 미래의 실제 효과 validator가 검증한 CONFIRMED/FAILED/UNCONFIRMED를 받는다. 이 값 자체는 DOM 증거/전체 APPLIED/Server enum이 아니다. 현재 sequence·원래 ticket·문서 epoch가 맞아야 새 상태에 반영한다. 동일 결과 중복은 accepted=false, 다른 결과 충돌 거절.
5. 문서 비활성/재활성 epoch가 바뀌므로 같은 Chrome document ID가 돌아와도 이전 미완료 결과는 거절한다. 기존 binding 복원 의무는 남는다. 다른 owner/session의 새 APPLY는 이전 복원 확인 전 거절한다. 같은 세션의 snapshot 교체/revision 역행도 거절한다.
6. RELEASE는 원래 scope/binding과 일치해야 한다. INACTIVE 문서 cleanup은 허용하지만 소멸하지 않았다는 이유만으로 성공시키지 않는다. 복원 실패/미확인은 CLEANUP_UNCONFIRMED로 보존하고 새 operation으로 재시도한다.
7. `confirmGone(ref)`는 실제 tab close/document destruction 확인 후만 호출하도록 요구한다. 메시지 예외나 document 교체로 호출하면 안 된다. 의무는 DOCUMENT_GONE으로 종결하되 과거 operation 결과를 RELEASED/CONFIRMED로 위조하지 않는다. 이전 문서 소멸 처리로 새 문서 active slot을 삭제하지 않는다.
8. `pending(executorKey)`는 미해결 의무를 재조회한다. 새 registry 인스턴스는 문서 재확인 전 새 APPLY/미완료 APPLY 결과 수용을 막는다. 영속 ACTIVE/APPLY_CONFIRMED를 제품 RUNNING으로 추정하지 않는다. 종료 정리를 막지 않도록 원래 의무의 RELEASE는 계속 가능하다.

기술 제한: APPLY intent 누적 상한은 constructor의 operationLimit(기본256), 과거 캐시 eviction/seq 재사용 없음. 상한 후 새 APPLY는 거절하고 cleanup은 허용한다. 이 숫자는 제안서 Content 응답 캐시64개와 별개 내부 개발 제한이다. 반복 RELEASE의 저장량·tombstone 보관/GC·전체 DB 용량/조회 최적화는 제품 연결 전 후속 설계 필요. 미해결 binding/단조 sequence/원래 operation을 지우는 GC는 금지. 전체 실행 registry generation/R0 집계·navigation_id/round·deadline은 미구현이다.

## 실제 검증 결과

| 검사 | 명령 | 결과 / 경계 |
|---|---|---|
| 상태/복구 단위+기존 회귀 | `npm --prefix extension test` | **174/174 PASS**, 실패/스킵0. 신규15개 포함. Chrome lifecycle/effect는 모의 |
| 문법 | `npm --prefix extension run check` | PASS; ESLint 아님 |
| native 영속 | `python3 extension/tests/ui/document_registry_worker.py` | PASS. Worker terminate/recreate, native IDB ticket 유지·재확인 guard·stale 결과 거절·복원 실패 보존/재시도 |
| 변경 검사 | `git diff --check` 및 staged 검사 | PASS |

최초 파일 생성 명령에서 cwd가 extension인데 경로에도 extension을 붙여 파일 생성/시험 경로를 찾지 못했다. 저장소 루트에서 바로잡았으며 그 실패에서 파일은 생성되지 않았다. 기능 assertion 실패는 없었다. 초기11개 통과 후 문서 재활성 epoch와 Worker 재확인 guard를 추가했고, 저장 후 abort 롤백·frozen snapshot/revision 경계까지15개로 확장해 전체를 재실행했다.

Backend/Web/팝업 UI는 이번 변경 영향이 없어 재실행하지 않았다. 과거165/23개를 이번 검증으로 표시하지 않는다. 실제 Windows MV3/Chrome navigation/BFCache/YouTube DOM·회원/비회원 제품 통합·Server/전체 AC는 **미검증**.

## 협업과 다음 작업

독립 준비 완료: 내부 영속·제어 순서·문서 epoch·복원 의무·동시성 및 Worker 재생성 검사. 제품 Shorts 연결 완료가 아니다.

지민: D06 Core 재응답의 QUERY/캐시/결과·복원/대상 없음 기준 재확인. 다훈: R0/무대상/부분 실패 및 freeze/실행 보고 매핑. 공동 확정 뒤 한 문서 비회원 제품 주입→QUERY→APPLY 실제 증거→RELEASE 복원 adapter로 이 모듈을 연결한다. 그때 Chrome 실제 lifecycle 조회·sender/owner/revision 검증, BFCache cleanup 재활성, 정책 재바인딩 및 관찰 round를 추가 검증한다. 문서의 내부 저장 형식을 wire에 그대로 노출하지 않는다.
