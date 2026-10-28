# EXT-03 · 이벤트 Worker 재생성 복구 검증

담당 Core 종민, feature/extension-core-ext-02, 시작 ede3f97, 제품 버전0.1.17, PR #17. 목표: 미확인 이벤트가 Worker 재생성 후 상태 조회부터 복구되고 같은 ID/원문을 유지하는지 확인한다. 개인 Core 약90% 추정 유지(전체 MVP/정식 AC 완료율 아님).

## 기준과 구현

AGENTS.md, 개발운영.md, 통합현황.md, tasks/EXT-03.md 및 설계 `11_인증_실행복구_가져오기_연결계약.md`의 실행·복구·기록을 확인했다. owner 고정 및 원문 보존, 응답 유실 후 중복 처리 경계를 검증한다. AC-EXT-03-03은 명령 journal도 포함하므로 이번 전송 검사만으로 전체 AC 완료 판정하지 않는다.

새 검사 `extension/tests/ui/member_event_recovery_worker.py`는 제품 host-policy/member-events 스크립트를 실제 Chromium classic Worker에서 실행한다. 실제 IndexedDB는 유지하고 첫 Worker를 종료한 뒤 새로운 Worker에서 제품 전송기를 재생성한다. HTTP 서버는 로컬 합성 서버이며 인증 정보도 synthetic-only fixture다. 제품 코드·API·저장 형식은 변경하지 않았다. 관리자 정책을 변경하거나 우회하지 않았다.

## 실행 결과

- `python3 extension/tests/ui/member_event_recovery_worker.py`: 2개 시나리오 PASS. 최초 batch 응답 연결 유실 후 RESPONSE_UNCONFIRMED 영속화를 확인했다. 새 Worker는 status를 먼저 호출한다. ACCEPTED면 ACKED로 전환하고 batch를 반복하지 않는다. NOT_RECEIVED면 기존 이벤트 그대로 batch 재전송한다. 두 경우 event_id/저장 body 동일, 재전송 batch payload 동일, 저장 인증 토큰 없음 확인.
- `cd extension && node --test tests/member-delivery-worker-restart.test.mjs`: 5/5 PASS. VM/fake-indexeddb 기반 제품 런타임 검사다. 중첩 재확인 단일 전송, 명령 조회 실패와 독립적인 전송 복구, 계정 변경 시 원문 보존/이전 receipt 숨김을 확인했다.
- `git diff --check`: PASS.

합성 응답 검증을 실제 Server receipt/DB 집계 성공으로 표시하지 않는다. Worker는 페이지에서 생성한 classic Worker이며 설치형 MV3 service worker가 아니다. Chrome 전체 재시작/집중 시간 복구/저장 장애 주입/실제 전송 기록 중복 집계는 이번에 미검증이다. 과거 전체220/220·모의UI42/42는 이번 재실행 결과가 아니다.

## Windows에서 이어서 확인

1. 최신0.1.17과 실제 회원 연결을 유지한다. 기존 폴더를 새로고침하며 확장을 삭제하거나 저장소를 초기화하지 않는다.
2. 테스트 세션에서 이벤트를 만든다. 팝업 전송 상태에서 대기/응답 미확인 건수가 실제로 남아 있을 때 복구 검사를 한다. 모두 접수됨 상태에서 재시작한 것은 미전송 복구 검증이 아니다.
3. 확장 서비스 워커 검사 창을 닫고 `chrome://serviceworker-internals`에서 해당 확장 URL의 Worker를 Stop한다. 이 메뉴가 없으면 브라우저를 정상 종료·재실행하고 전체 브라우저 재시작 시나리오임을 따로 기록한다. 다른 확장의 Worker는 중지하지 않는다.
4. 다시 팝업을 열고 회원 연결/전송 상태를 확인한다. 표시된 재시도 대기시간이 지난 뒤 전송 재확인을 한다. 재시도 대기 중 조회만 가능한 동작은 오류가 아니다.
5. 대기 기록이 접수됨으로 바뀌고 Server 행동 기록에 동일 이벤트가 중복 생성되지 않는지 확인한다. 가능하면 재시작 전후 event_id 동일 여부를 로컬에서 비교한다. 원문·토큰·쿠키·개인 기록을 채팅에 붙이지 않는다.

사용자가 확인해 줄 최소 결과: 재시작 전 대기 건수, 재시작 후 대기/접수 상태, 중복 행동 기록 여부. 실패 시 오류 코드만 공유한다. 새 ID를 생성하거나 기록을 삭제하는 콘솔 명령은 사용하지 않는다.

정상 Windows 작동 사용자 회신은 이전 정상 경로 근거로 유지한다. 이번 재시작/저장 장애 성공 회신으로 확대하지 않는다. 개인 잔여는 실제 MV3 전송 복구 및 저장 장애 확인, 발견 결함 보완이다. Shorts/Core D06·저장 오류 자동 END 사유·lifecycle local_seq/watermark/완전 수집 경계는 팀 협업이다. 시작 지연 측정은 보류, develop 미병합.
