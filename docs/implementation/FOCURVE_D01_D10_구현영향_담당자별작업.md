# FOCURVE D-01~D-10 구현 영향 및 담당별 작업

2026-10-09 / 정책 확정·제품 미변경. 기준 Server b05d9a0 / Core e79ef30. 원문 계약은 [최종 공용계약](../design/02_시스템_테크설계/FOCURVE_D01_D10_최종공용계약.md).

## 주요 충돌과 병합 전 조건

| 항목 | 현재 코드/문서 충돌 | 병합 전 판단 |
|---|---|---|
| D-03 | SnapshotValidation/ImportedSession signed64 허용, Long.MAX_VALUE 테스트 | 신규 교환 상한/조회·생성·가져오기 경로와 경계 테스트를 맞추기 전 최신 확정 계약 준수 판정 불가 |
| D-01/D-05 | 고정 예정 종료·재시작 INTERRUPTED·END-only reconcile | 자동복구 완료 주장 금지. 구현 또는 미지원 capability를 명시적으로 차단/격리하는 설계·제품 증거 필요. 문서만으로 merge 승인 불가 |
| D-06 | Core 1.1 registered-host 이벤트 키·member 어댑터 부재 | Event 1.2 실제 HTTP 연동 전 Core 수정 필요. 사이트/global priority·Shorts 필수 실제 적용은 미검증 |
| D-02 | Core guest1.2 owner/content 누락·전체 validator 없음 | 신규 Core1.2 호환 설치 허용 전 필수 보완. 발급 OFF 유지 |
| D-04/D-09/D-10 | Core journal/ACK/토큰 회원 연결 없음 | 회원 실행 완료·전체 MVP 완료/실제 통합 PASS 불가 |

기존 PR18 제품 검토 PASS는 당시 코드 기준이다. 새 확정 정책이 반영되지 않은 코드에 소급 최신 계약 PASS를 부여하지 않는다. develop 병합 여부는 담당자 검토 대상으로 남긴다. 문서와 구현의 불일치를 숨기고 merge 가능으로 판정하지 않는다.

## 김다훈 Server·API·DB·Frontend

- D-03: SnapshotValidation, ImportedSession 및 사이트/정책/session version 생성·증가·조회·ETag 경로의 신규 교환 범위 검사. Long.MAX_VALUE 기대를 새 범위로 갱신하고 safe max/max+1·타입·원자성 테스트. 역사 데이터 무변환. Note 부재 version0 및 문자 metadata는 별도 취급.
- D-01/05: ExecutionService의 start/report/closeIntervals/reconcile/view/command에 확인 누적 시간·다중 RUN·복구 상태/attempt/revision·중첩/시간 경계·종료 경쟁을 도입할 기술안 합의. UNKNOWN→해제 계약을 조용히 변경하지 않음. FocusSessions.tsx/FocusShared.tsx의 고정 타이머·상태 응답 연결.
- DB: 새 additive Flyway, 명시 컬럼 INSERT, 기존 자료·구형 모델 보존. 3308 읽기 점검 초과0은 전체 마이그레이션 검증이 아님. 일별/사이트별 시간 귀속 규칙 미확정 부분 별도 기록.
- D-04/07/08/10: wire Journal1.1·hash/seq/소유권·ACK 의미·기본OFF를 유지하고 실제 Core fixture와 대조. 새 recovery API/버전·automatic handshake는 별도 설계 승인.
- D-09: 기존 API 응답 유실의 실제 제한 문서화·지원 절차. token recovery 상태 API가 필요하면 별도 명세·보안 검토, 임의 재발급 금지.

## 윤종민 Extension Core

- access-store.js pending/commit/fail/list: actual target_key·matched_policy_host·복수 이유·navigation 1건·버전별1.1보존·1.2발행, 오류 outbox 격리와 item ACK.
- host-policy.js normalize/matches/select/supported/rules: full Snapshot 문맥 검사, guest/member ID·owner 차이, JS safe version, disabled 추가 기능, 미지원 활성 필수 전체 거절, global 규칙과 다른 owner 보호.
- session-core.js begin/completeStart/recover/schedule/finish/persist: 동일 session/Snapshot 자동복구, 마지막 신뢰 관측·절전 공백 제외·다중 interval·잔여 시간, 해제 확인·종료 의도 불변.
- session-db.js save/load/expire: Journal·구간·원보고·미전송 자료 원자 보존/업그레이드·owner 분리. guest30일 정리가 활성/회원/outbox를 지우지 않게 함.
- service-worker.js startup/alarm/navigation: SW 재생성과 전체 종료 구분, 실제 규칙 대조, 제한 재시도·backoff. 새 회원 통신 어댑터/PKCE·접근통제 저장·refresh 직렬화·report/reconcile 필요.
- popup/blocked: 복구 대기·조치 필요·실제 적용/해제 상태, 초기 시작 취소 추가 금지. DEV/harness 결과를 제품 Chrome로 보고하지 않음.

## 채지민 Content Control

- Shorts 필수 탐지/제한·실제 적용 사유를 Core navigation 문맥에 연결.
- 성인/키워드/블러는 추가 MVP로 별도 구현·실제 탐지 검증. site ALLOW와 독립 global 예외·site BLOCK 유지.
- 메시지 버전/필드·sender/프레임·규칙 ID/priority·이벤트 freeze 시점을 윤종민과 합의. 가상의 기존 파일명을 만들지 않으며 실제 Content 제출 코드 경로 확인 후 명시.
- 늦은 사유로 이미 발송한 이벤트 변형/재발행 금지. 감지를 기다리느라 첫 유효 차단을 지연하지 않음.

## 후속으로 분리 가능한 항목

자동 capability handshake, 늦은 사유 annotation, 추가 MVP 성인/키워드/블러·일별/사이트별 시간 배분, token 응답 유실용 새 상태 API는 별도 기술 계약/구현으로 분리 가능하다. 그러나 활성 필수 정책 미지원은 정상 실행으로 표시할 수 없다. 최소 연결 경로의 안전한 오류/조치 안내는 분리하더라도 유지해야 한다.

현재 실제 Chrome/회원 Core 통합 미검증과 외부 OAuth9·시간배분3은 별도다. 구현/AC 완료·PR 병합 승인은 이번 문서 작업으로 하지 않는다.

## 2026-10-09 로컬 병합 차단 수정 — 현재 지원 경계

로컬 제품 코드만 수정했으며 원격 PR18 HEAD b05d9a0은 변경되지 않았다. 신규 Snapshot source_version/sites[].version/content_policy.version에 SafeVersion(1..9007199254740991)을 공통 적용했다. 가져오기 canonical JSON은 이전에도 safe 정수 초과를 INVALID_SCHEMA로 거절했으며, 새 Snapshot/ImportedSession 공통 guard로 직접 경로도 보완했다. 사이트 생성1·수정/복원/삭제와 메모 저장의 버전 증가는 VERSION_LIMIT으로 상한 초과를 원자 거절한다. 미작성 Note version0는 그대로다. 역사 Snapshot 원문을 무조건 재검증/재작성하지 않는다.

Session 조회는 automatic_recovery_supported=false, time_accounting_mode=LEGACY_WALL_CLOCK을 추가 반환한다. 현재 고정 planned_end_at·기존 END/RELEASED·Journal1.1은 유지하며, 비종료 RESUME action은 기존처럼 거절한다. Web은 자동복구·중단 중 잔여 보존이 미지원임을 명확히 안내한다. D01/D05의 승인 정책은 유지하고 전체 구현은 후속 Server/Core 공동 작업으로 분리한다. 이 필드가 새로운 recovery API나 capability handshake는 아니다.

남은 기술 경계: 일반 focus_sessions.version의 극단 상한에서는 신규 교환 숫자 상한과 필수 종료/해제 가능성이 충돌한다. 종료/보고에 무조건 VERSION_LIMIT을 적용하면 잠금을 유지하게 되므로 기존 종료 경로를 보존했다. 일반 세션 version의 legacy/교환 표현·상한 처리 정책은 후속 합의·독립 리뷰 필요이며 D03 전체 구현 완료로 표시하지 않는다. revision/seq 의미·범위도 자동 재정의하지 않는다.

D06 메시지·규칙 ID/priority/freeze 및 D09 응답유실 추가 API는 계속 미확정/미검증이다. 실제 Chrome·회원 Extension 통합 NOT RUN, 신규 Snapshot1.2 운영 발급 OFF 유지. 새 migration/기존 DB·환경 변경 없음.
