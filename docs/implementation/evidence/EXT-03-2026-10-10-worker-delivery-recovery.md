# EXT-03 · Worker 전송 복구 및 계정 경계 · 2026-10-10

이번 목표: Worker 실행 환경을 다시 만들거나 재확인 요청이 겹쳐도 동일 ID/원문으로 복구하고, 전송 도중 계정이 바뀌면 이전 pass를 중단한다.

시작 3dda383583592f23a03dc48cd57eb68e39728485, 담당 Core 종민, feature/extension-core-ext-02, Extension 0.1.15, PR #17.

## 설계 대응

- `docs/design/02_시스템_테크설계/05_데이터_복구.md`: owner 고정 outbox, ACK 전 원문 보존, 회원 A 자료를 회원 B/비회원으로 보내지 않음.
- `docs/design/02_시스템_테크설계/12_정책계약_이벤트12_호환성게이트.md`: 응답 유실/503은 동일 ID·원문 상태 조회로 재시도, REJECTED 성공 ACK 금지.
- `docs/design/01_UX_기능설계/02_IA_화면명세.md` EXT-01: 소유자 전환 중 이전 계정 자료 숨김.

## 변경

기존에는 current.tick 명령/실행 상태 조회가 성공한 뒤에만 전달 경로를 시작했다. 이제 런타임 초기 tick에서 회원 전송 복구를 먼저 시작하고 명령 조회는 독립적으로 진행한다. 명령 API 실패가 보존된 Event 전송을 함께 막지 않는다. 전송 성공을 세션 RUNNING/APPLIED로 해석하지 않는다.

`member-execution-runtime.js`에 현재 owner_user_id/executor_id/server_url 확인을 추가했다. staging 읽기 전후, 복사 이후 flush 전, 응답 이후 집계·정리 전, 각 원문 정리 직전에 경계를 확인한다. 계정 변경 시 원문을 남기고 pass를 중단하며 이전 건수를 현재 계정 응답으로 반환하지 않는다.

이미 Server에 접수된 이전 계정의 receipt는 이전 owner의 로컬 outbox에 보존될 수 있다. 계정이 바뀐 뒤 그 결과로 staging을 정리하지 않으며, 원래 계정으로 돌아온 후 동일 ID로 상태를 확인·정리한다. 새 계정 토큰으로 이전 원문을 보내지 않는다.

기존 하나의 delivering Promise와 보류된 follow-up 구조를 유지한다. 겹친 요청은 같은 pump를 기다리고, 추가 pass는 다시 저장소를 읽는다. 재시작 후 IN_FLIGHT/RESPONSE_UNCONFIRMED는 기존 제품 전송기의 상태 조회 우선 규칙을 따른다. 원문/ID/Server API enum/DB schema는 변경하지 않았다.

## 검증

- `npm --prefix extension test`: 216/216 PASS. 새 5개는 다음을 검사한다.
  - 서로 다른 Worker VM + 동일 fake-indexeddb에서 응답 유실 복구: 같은 ID 조회, accepted batch 재전송 없음, 원문 동일.
  - 겹친 팝업 요청의 단일 batch 전송.
  - staging 읽기 중 계정 변경: 네트워크/정리 없음, 이전 원문 보존.
  - 명령 조회 실패 중 startup 전송 복구.
  - 서버 수신 후 계정 변경: 이전 원문 보존, 새 계정 요약에서 이전 receipt 숨김.
- `npm --prefix extension run check`: JavaScript 구문 PASS.
- 새 테스트는 제품 runtime/MemberEventDelivery/MemberEventStore/MemberAccessStore와 별도 VM, 공유 fake-indexeddb, 합성 HTTP를 사용한다. 실행 coordinator와 Chrome API는 모의다. 실제 MV3 Worker 강제 종료나 실제 Server 검증이 아니다.
- 팝업 UI/Web/Server 코드 변경 없음. 이번 UI/Backend 테스트는 재실행하지 않았다. 과거 모의 UI 32/32를 이번 실제 검증으로 합산하지 않는다.

## 적용·남은 범위

기존 Chrome 로드 경로의 extension 파일을 덮어쓰고 새로고침하여 0.1.15를 확인한다. 자료 초기화/새 설치 경로/ID 변경은 필요하지 않다.

실제 Chrome Worker 종료·재시작 후 Event status/batch와 DB event_id를 대조해야 한다. 이번 전송 복구는 브라우저 전체 세션 자동 재개·잔여 집중 시간 보존·새 recovery API 지원을 의미하지 않는다. 실제 저장 장애 전체 절차, Content Shorts/lifecycle/watermark는 후속 검증/협업 대상이다. 최신 0.1.13~0.1.15 사용자 정상 회신은 아직 제공되지 않았다. 시작 지연 보류, develop 병합/자동 병합 없음.
