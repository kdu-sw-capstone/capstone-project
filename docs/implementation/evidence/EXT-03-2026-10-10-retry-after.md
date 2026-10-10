# EXT-03 · 서버 장애 전송 복구 · 2026-10-10

이번 목표: 서버 429/503 Retry-After 대기 시간을 저장하고, 전송기 재생성 및 수동 재확인 후에도 같은 계정·설치의 이벤트 요청을 조기에 보내지 않는다. 대기 종료 후 동일 ID·원문으로 상태 조회부터 재개한다.

시작 기준: 93c46438cc268244f59d5c70fd32bb2c0b27f8ae. 브랜치 feature/extension-core-ext-02, 담당 Core 종민, Extension 0.1.11, PR #17.

## 기준과 변경

- `docs/design/02_시스템_테크설계/04_API_연동.md` 공통 계약: 429/503 Retry-After, 1/2/4/8/16/30초+지터.
- `docs/design/02_시스템_테크설계/12_정책계약_이벤트12_호환성게이트.md`: 응답 유실/503의 동일 원문·상태 조회 재시도, REJECTED 성공 ACK 금지.
- `extension/background/member-events.js`에서 초 단위 및 HTTP-date 헤더를 읽는다. 유효한 미래 시각은 로컬 backoff의 하한으로 사용한다. 무효·과거·정수 범위 초과 헤더는 기존 backoff로 처리한다.
- 기존 Event outbox 행에 선택적 내부 `retry_after_at`만 추가한다. IndexedDB schema version, 기존 body/ID/status/API 필드는 변경하지 않는다. 기존 행에 필드가 없으면 기존 경로로 동작한다.
- Server별 DB의 현재 owner/executor 행에 미래 대기 시각이 있으면 events/status 및 events/batch 모두 대기한다. 새로 QUEUED 된 기록도 이 범위에 포함한다. 다른 계정은 차단하지 않는다.
- 실패 상태 저장은 기존 원자 트랜잭션을 사용한다. 헤더 대기 시간 저장 실패 시 성공 ACK로 처리하지 않는다. 이번 작업은 디스크 실패 자체 복구나 브라우저 재시작 전체 지원을 완료하지 않는다.

## 이전 기록 정정과 사용자 확인

0.1.10 전송 상태 UI 안내에는 기존 전송기가 서버 대기 시간을 따른다고 적었으나, 실제 코드는 자체 지터 backoff만 적용하고 Retry-After 헤더를 읽지 않았다. 이번 변경으로 그 차이를 보완했다. 기존 자동 테스트를 해당 헤더 지원 근거로 소급 사용하지 않는다.

사용자는 직전 0.1.10 작업에 대해 “검증 다 정상으로 했다고 기록”이라고 회신했다. 사용자 확인 결과 정상으로 기록한다. 세부 로그/환경/건별 결과는 추가 제공되지 않았다. 이 확인을 새 0.1.11 복구 코드의 실제 실행 결과로 사용하지 않는다.

## 검증 결과

- `npm --prefix extension test`: 198/198 PASS. 추가 3개는 503 초 단위 대기·새 기록 범위·전송기 재생성·동일 원문 상태 조회, 429 HTTP-date/잘못된 헤더, status 조회 실패 대기·다른 계정 독립성을 검사한다. 기존 회귀 테스트 포함.
- `npm --prefix extension run check`: JavaScript 구문 검사 PASS.
- 새 복구 테스트는 fake-indexeddb·합성 HTTP Response·주입 시계·전송기 재생성 기반 모의 검증이다. 실제 Chrome Worker 종료·Server 429/503 검증이 아니다.
- 팝업 HTML/JS 및 Server/Web 제품 코드 변경 없음. 이번 작업에서 UI/Backend 테스트는 재실행하지 않았다. 과거 UI 27/27과 HTTP/MySQL 3/3은 과거 근거다.

## 적용·후속

기존 Chrome 로드 경로의 extension 파일을 덮어쓰고 확장 새로고침하여 0.1.11을 확인한다. 자료/설치 ID 초기화는 필요하지 않다. 기존 재확인 버튼이 저장된 서버 대기 시간을 따른다.

실제 서버 장애 중 대기 → Worker 재시작 → 조기 요청 없음 → 만료 후 상태 조회 → 동일 원문 전송을 별도 검증한다. 저장 실패 후 복구, 공동 lifecycle sequence, Shorts 연결·watermark는 후속이다. 시작 지연 검증 보류 및 develop 미병합을 유지한다.
