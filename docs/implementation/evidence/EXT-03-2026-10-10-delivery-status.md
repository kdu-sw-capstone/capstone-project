# EXT-03 · 회원 접근 기록 전송 상태 · 2026-10-10

이번 목표: 팝업에서 현재 계정의 저장된 접근 기록에 대해 전송 대기·미확인·거절·수신 확인을 구분하고, 기존 전송기로 재확인한다. 시작 기준 b52681bd4088be3f64722c30d5072632b8e9515e, 브랜치 feature/extension-core-ext-02, Extension 0.1.10, PR #17.

## 설계 대응

- `docs/design/01_UX_기능설계/02_IA_화면명세.md`: EXT-01 연결·실행·전송 표시와 계정 전환 자료 경계.
- `docs/design/02_시스템_테크설계/12_정책계약_이벤트12_호환성게이트.md`: Event 1.2 불변 원문·항목별 ACK·REJECTED 분리·응답 미확인 시 상태 조회와 동일 ID 재시도.
- `docs/design/04_검수_예시데이터/07_검증기준.md`, `tasks/EXT-03.md`: 소유권과 복구 기준. UI 부분 구현이 전체 수용 기준 통과를 뜻하지 않는다.

## 구현

- `extension/background/member-events.js`: 순수 요약 함수. 현재 owner/executor만 집계하고 원문 staging은 Server까지 필터링한다. 전송함은 기존 Server별 IndexedDB를 사용한다. event_id 중복 제거, 서로 다른 원문 충돌은 오류, 알 수 없는 상태는 응답 미확인이다.
- `extension/background/member-execution-runtime.js`: 자체 팝업·최상위 프레임·빈 payload의 내부 메시지만 허용한다. 로컬 조회는 bearer 취득이나 네트워크 전송을 하지 않는다. staging 다음 전송함을 읽어 enqueue/ACK 사이 기록 소실 집계를 피하고, 비동기 조회 전후 계정·설치·Server를 확인한다.
- `MEMBER_DELIVERY_RECHECK`는 기존 deliverAccess/flush 경로만 사용한다. 원문과 ID, 상태 조회 우선, backoff/Retry-After, REJECTED 보존 규칙을 변경하지 않았다.
- `extension/popup/member-delivery-ui.js`: 건수만 표시한다. 계정 상태 갱신마다 기존 값을 지우고 늦은 응답을 무시한다. 조회 오류는 미확인으로 표시하며 이전 값의 최신성을 보장하지 않는다. 응답 대기는 30초로 제한한다.
- 수신 확인 건수는 로컬 전송함의 ACKED 수다. 전체 탐색 수집 완료·Server COMPLETE·집중 시간 확정을 의미하지 않는다. 현재 실제 생성 대상은 앞서 구현한 회원 SITE-only 접근 이벤트다.

## 검증

- `npm --prefix extension test`: 195/195 PASS. 새 6개는 중복/경계/원문 충돌/알 수 없는 상태/읽기 전용 응답/계정 전환/비허용 발신자 조건을 검증한다. Chrome/API/IndexedDB 어댑터 및 VM 등 모의 검증을 포함한다.
- `npm --prefix extension run check`: JavaScript 구문 검사 PASS.
- `python3 extension/tests/ui/popup_ui.py`: 27/27 PASS. 제품 HTML + Chromium + mocked Chrome API. 새 4개는 상태 구분, 재확인 메시지, 실패 시 미확인 표시, 연결 종료 시 건수 제거다. 실제 확장 설치·DNR·Server 연동 검증이 아니다.
- Server/Web 제품 코드는 바꾸지 않았으며 이번 작업에서 Backend HTTP/MySQL 테스트를 재실행하지 않았다. 과거 3/3 결과를 이번 검증으로 합산하지 않는다.

## 적용 및 남은 검증

기존 Chrome 로드 경로에 extension 파일을 덮어쓴 뒤 확장 새로고침하여 0.1.10을 확인한다. 새 경로 설치나 저장소 초기화는 필요하지 않다. 팝업의 ‘화면 설정·연결 확인’ 안에 ‘행동 기록 전송 상태’가 있다.

사용자 환경에서 기록 생성 → 전송 대기 → ACKED, 네트워크 끊김 → 미확인 → 같은 ID 재확인, 거절 유지, 계정 전환 시 이전 건수 숨김을 실제 Server와 대조해야 한다. 재시도 버튼은 대기 시간을 무시하는 강제 전송 버튼이 아니다.

Shorts/D-06 연결, 공용 lifecycle local_seq, 전체 수집 완료 watermark는 별도 협업 작업이다. 집중 시작 지연 검증은 사용자 요청대로 보류했다. develop 병합·자동 병합은 하지 않는다.

## 사용자 검증 회신 · 2026-10-10

사용자가 “검증 다 정상으로 했다고 기록”이라고 회신했다. 직전 0.1.10 전송 상태 화면 작업의 사용자 검증 결과를 정상으로 기록한다. 세부 실행 로그·건별 결과·환경 정보는 추가 제공되지 않았으며, 위 자동/모의 테스트 결과와 구분한다. 후속 변경 및 전체 EXT-03/Shorts 통합 검증을 이 회신으로 대신하지 않는다.
