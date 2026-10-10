# EXT-03 · 원문 오류 격리 및 정상 기록 전송 · 2026-10-10

이번 목표: 손상된 기록 하나가 정상 기록 전송을 막지 않도록 원문을 보존·격리하고, 로컬 확인 필요를 Server 거절·수신 확인과 구분한다.

시작 f5ef45e094ff3738af200d53dfe38224ee6edc57, 브랜치 feature/extension-core-ext-02, 담당 Core 종민, Extension 0.1.12, PR #17.

## 설계 및 처리 경계

- `docs/design/02_시스템_테크설계/12_정책계약_이벤트12_호환성게이트.md` D-07~D-10: 계약 오류 격리·진단 보존, 원문/ID 변경·신규 ID 재발행 금지, REJECTED 성공 ACK 금지.
- `docs/design/01_UX_기능설계/02_IA_화면명세.md` EXT-01: 연결·실행·전송 상태, 소유자 경계.
- `docs/design/02_시스템_테크설계/04_API_연동.md`: 원래 상태 조회/전송 API·429/503 대기 규칙 유지.

`MemberAccessStore.review`는 staging 원문/ID를 그대로 두고 review_required/review_error 메타데이터만 추가한다. 해당 body가 조회 이후 달라졌거나 저장할 수 없으면 트랜잭션을 중단한다. 불일치를 덮어쓰거나 성공처럼 처리하지 않는다.

`transferOriginals`는 각 staging 기록의 Event 1.1/1.2 계약, event_id/executor_id 결합, 크기를 확인한다. 손상 JSON·계약 위반·outbox 원문 충돌만 격리하고 다음 기록으로 진행한다. 인증/소유권/저장 오류는 실패를 그대로 반환한다. 격리된 staging은 자동 재전송하거나 ACK 정리 대상으로 삼지 않는다.

전송함의 비종료 행도 네트워크 요청 전에 동일 검사를 받는다. 손상 행은 내부 상태 LOCAL_REVIEW_REQUIRED와 고정 오류 코드 LOCAL_EVENT_INVALID로 보존한다. 이는 **Extension 내부 상태**이며 Server 이벤트 enum/요청/응답에는 추가하지 않는다. API body와 원래 ID, IndexedDB schema version을 변경하지 않는다. 기존 ACKED/REJECTED 역사 자료를 소급 재작성하지 않는다.

팝업에 ‘저장된 기록 확인 필요’ 건수와 원문 보존 안내를 추가했다. 확인 필요는 전송 대기·Server REJECTED·ACKED와 별도다. 같은 ID의 staging 충돌이 격리되면 해당 로컬 요약은 확인 필요로 표시하여 성공처럼 보이지 않게 한다. 원문·URL·계정 ID·토큰은 공개 응답/화면에 넣지 않는다.

기존 Retry-After 대기 및 owner/executor/Server 경계, 상태 조회 우선, 동일 원문 재시도는 유지한다. 디스크 실패 자체를 복구하거나 오류 원문을 자동 수정·삭제하는 기능은 추가하지 않았다.

## 검증

- `npm --prefix extension run build:member-worker`: src MemberAccessStore 변경을 classic Worker bundle에 반영.
- `npm --prefix extension test`: 204/204 PASS. 추가 6개는 손상 outbox와 정상 기록 동시 전송, 미확인 행 결합 오류의 네트워크 제외, 격리 staging/receipt 요약, durable staging 격리 및 store 재생성, outbox 원문 충돌 후 ACK 삭제 방지, 인증/저장 오류 분리 및 body 경합 거절을 검증한다.
- `npm --prefix extension run check`: JavaScript 구문 PASS.
- `python3 extension/tests/ui/popup_ui.py`: 28/28 PASS. 새 사례는 로컬 확인 필요와 Server 거절/성공 구분이다. 제품 HTML + Chromium + mocked Chrome API 검증이다.
- 자동 테스트는 fake-indexeddb/합성 HTTP/VM 등 모의 어댑터를 포함한다. 실제 Chrome Worker/Server의 손상 원문 처리 검증은 미실행이다.
- Server/Web 제품 코드 변경 없음, 이번 Backend 테스트 재실행 없음. 사용자 0.1.10 정상 회신을 새 0.1.12 검증 근거로 소급하지 않는다.

## 적용 및 후속

기존 extension 로드 폴더를 덮어쓴 뒤 Chrome 확장을 새로고침하여 0.1.12를 확인한다. 설치 삭제/새 경로 설치/자료 초기화는 필요하지 않다. ‘화면 설정·연결 확인 → 행동 기록 전송 상태’에 확인 필요 항목이 추가된다.

다음 남은 범위: 실제 Chrome+Server 저장/격리/동일 ID 전송 검증, 저장 장애 복구, 공동 lifecycle sequence 및 Shorts/Content 연결·전체 수집 watermark. 이전 시작 지연 검증은 보류, develop 병합·자동 병합 없음.
