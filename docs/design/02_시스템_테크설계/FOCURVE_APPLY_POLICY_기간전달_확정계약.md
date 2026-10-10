# FOCURVE APPLY_POLICY 기간 전달 확정 계약

확정일: 2026-10-10. 승인 주체: 김다훈(사용자 명시 지시). 적용 구현 기준: develop b45a680a9f2262bd9725619e9643df3bb9b91164 기반 로컬 fix/apply-policy-duration. 로컬 구현/Server 시험과 실제 Core·Chrome 검증은 구분한다.

## 필수 wire 계약

새 회원 APPLY_POLICY 명령 root의 duration_minutes는 필수 JSON 정수이며 범위1~180분이다. Server는 연결된 focus_sessions.duration_minutes의 저장된 목표값을 명령 생성 transaction에서 읽어 넣는다. 클라이언트 기본값/명령 적용기한/과거 타이머를 대체값으로 쓰지 않는다. 기존 session_id·executor_id·command_id·desired_revision·snapshot·reason·created_at·execute_before 및 조회 응답은 유지한다.

```json
{
  "command_id":"88888888-8888-4888-8888-888888888888",
  "session_id":"33333333-3333-4333-8333-333333333333",
  "executor_id":"22222222-2222-4222-8222-222222222222",
  "type":"APPLY_POLICY",
  "desired_revision":1,
  "created_at":"2026-10-10T02:00:00Z",
  "execute_before":"2026-10-10T02:01:00Z",
  "duration_minutes":25,
  "snapshot":{"policy_snapshot_id":"44444444-4444-4444-8444-444444444444"},
  "reason":"MANUAL"
}
```

위 예시는 필드 위치 설명용으로 snapshot을 축약했으므로 그대로 실행할 수 없다. 실제 시험 명령의 전체 Snapshot JSON은 검증보고서가 연결한 actual-apply-command.json/actual-normal-max-commands.json에 있다. 실제 토큰·비밀번호는 예시에 넣지 않는다.

입력 POST /api/v1/sessions는 {executor_id,duration_minutes}+Idempotency-Key. 누락/null은 DTO0으로 평가되어1~180 검증에서422, 문자열/소수/boolean/객체/배열은 기존 strict JSON에서422 VALIDATION_FAILED. 정상1/180 및25는 저장값과 명령값·세션조회값 일치. 명령은 생성 시 저장되며 반복 조회 때 값을 다시 만들지 않는다. 같은 멱등키·같은 입력은 같은session/operation/command, 다른기간은409 IDEMPOTENCY_CONFLICT. API 경로·보고 payload 및 Event/Journal/Snapshot 의미는 바꾸지 않는다.

## Core 수신 규칙 — 윤종민 후속 구현

1. type/소유자/설치·session_id·snapshot·command_id·desired_revision·실행기한을 검증하고 기간이 JSON number이며 Number.isInteger(value) 및1<=value<=180인지 검증한다. 문자열/누락/null/소수/0/초과를 허용하지 않는다.
2. 검증 실패/미지원이면 정책 적용·RUNNING·APPLIED 성공 보고 금지. 기본25분/팝업 초기값/execute_before 차이로 기간을 만들지 않는다. 구체 error_code 확장은 기존 허용 code/보고계약과 조율하며 임의 신규 enum을 확정하지 않는다.
3. 기간은 기존 Server session_id와 frozen Snapshot·revision에 결속해 durable journal/세션 상태에 저장한 후 실행한다. 회원 명령을 guest begin으로 보내 새 guest ID/Snapshot을 만드는 것은 금지한다.
4. 적용·탭·자기규칙 확인 후 실제 started_at/타이머/APPLIED; Server 접수만으로 진행 표시 금지. 동일 command/revision의 다른기간은 충돌로 취급하고 값을 덮어쓰지 않는다.
5. 세션 조회의 duration_minutes는 유지하며 보조 대조값이다. 값/설치/정책/revision이 다르거나 조회응답이 오래되면 재조정하고 정상으로 적용하지 않는다.

## 역사 명령·해제 호환 경계

기존 DB command payload는 backfill/변조/삭제하지 않는다. 구형 저장 APPLY에 기간이 없으면 조회는 원문 그대로 반환할 수 있다. **새 Core는 이런 APPLY를 미지원/유효하지 않은 명령으로 판정하고 신규 적용하지 않는다.** 역사 명령 원문 조회가 새 필수계약의 유효 APPLY라는 뜻은 아니다. 이를 기본값으로 실행하거나 예전 APPLIED 상태를 다시 만드는 것은 금지한다. 필요한 안전 종료/실패·reconcile은 기존 권한/revision/상태 검증 아래 처리한다.

RELEASE_POLICY에는 기간을 필수로 추가하지 않는다. 기간 부재/오류만으로 기존 세션의 해제·유효 RELEASED·잠금 정리를 막지 않는다. 검증된 실제 자기규칙 해제증거·설치·명령·revision·원문 멱등성을 그대로 요구한다. Server 기존 APPLIED/RELEASED wire에 새 필드를 요구하지 않으므로 구형 보고/cleanup 회귀를 유지한다. 구형 Core가 새 root 필드를 무시하더라도 실제 회원 실행 지원으로 간주하지 않는다.

## 시간 의미와 구현 경계

duration_minutes는 목표 T의 분 단위이며 snapshot 정책 field가 아니다. active_duration_ms/remaining_ms/overrun_ms 및 D01/D05 누적 확인시간 정의를 변경하지 않는다. planned_end_at 현행 고정 start+duration, execute_before 적용기한은 별개다. Server는 automatic_recovery_supported=false/time_accounting_mode=LEGACY_WALL_CLOCK을 유지한다. 진행 체크포인트·미확인 Chrome/절전시간 제외·잔여 보존 자동재개는 Server/Core 후속 구현이다. 같은session/frozenSnapshot을 보존해야 한다.

Snapshot1.2 신규 발급 기본 OFF 유지. 테스트 profile 또는 새 격리 서버의 exact executor만 한시적으로 ON인 시험은 실제 Core 호환성 PASS가 아니다. Event1.1/1.2·Snapshot1.1/1.2·Journal1.1 및 명령/보고 기존 의미를 조용히 바꾸지 않는다.

## 완료 기준

Server local 검증:1/25/180·잘못된입력·저장값/명령/조회 일치·반복/멱등·오래된revision·소유권·legacy원문·해제·보고/full regressions. 실제 회원 통합: Core 새 SHA의 기간검증/영속·실제Chrome 적용·timer·만료해제·HTTP/DB/Web 대조. 첫 기준이 통과해도 후자 전에는 전체 기간전달 BLOCKED를 해제하거나 자동복구/전체MVP완료로 처리하지 않는다.
