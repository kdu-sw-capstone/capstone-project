# FOCURVE D-01~D-10 검증 체크리스트

2026-10-09. 정책 확정 ≠ 실행 검증 완료. 기준 Server PR18 b05d9a0, Core PR17 e79ef30. 작업카드 AC-EXT-02-01~03 및 AC-SESSION-01~04의 실제 실행/해제/늦은 보고 조건에 연결한다. 상세 AC 원문을 대체하지 않는다.

각 시험에 정확한 SHA·OS/Chrome·계정/설치(비식별)·DB/포트·실행자/시각·코드/로그/API/DB 증거를 남긴다. 자동/모의 Chrome·fake-indexeddb/실제 Chrome/사용자 확인/Server 통합을 분리한다. secret/번호/토큰 캡처 금지.

| 기준 | 확인 조건 | 현재 근거·판정 | 필요한 실행 |
|---|---|---|---|
| D01/05-R | R-T01~12: 종료/강제종료/SW/절전/공백/잔여/중복/END 경쟁 | 새 자동복구 미구현·미검증. 이전 Core36 모의 회귀는 구형 동작 | 격리 DB·새 제품 API/코드·정확 SHA의 실제 Chrome/절전 |
| D02-S | member/guest owner·ID·1.1보존·1.2 fullvalidate·import선택·disabled추가 | Server 검사 코드 확인/구형 자동 시험; Core 누락. 전체 부분 | guest/member fixture·잘못된필드·전체rollback·실제 적용 |
| D03-V | 1/safe max,0/음수/소수/string/null/bool/max+1·버전증가/조회/원자성 | 현재 signed64 코드 불일치. DB 상한초과0 읽기 점검만 통과 | 변경 후 양쪽 파서·HTTP/MySQL·기존 자료/Note0 호환 |
| D04-J | owner·Server/local revision·event/action seq·멱등·ACK 보존·stale | Server 코드 보호 일부 있음; Core회원 adapter 미구현, 부분 | 동일/변형보고·역순·재연결·독립 counter 실제 통합 |
| D06-C | 공통navigation·동시이유·freeze·지연차단없음·Shorts·global예외 | Server 합성검증 근거 있음, 실제 Content/Core 미검증 | D06 기술안 합의 후 실제 탐지/차단/API/DB1건 대조 |
| D07-G | OFF/exact install/*test한정/허용철회/기존조회보고해제 | gate 코드 확인, 실제 Core capability 미검증 | 비검증설치 발급0·후보 설치 실제 호환·허용철회 |
| D08-L | 정상1.1 원문/집계·오류상위키격리·ID무변환 | Server 경로 코드 확인; 실제 기존 Core outbox 부분 | 구형자료조회·오류통계·격리 보존·실제재전송 |
| D09-A | PKCE/state·소유권·background접근통제·refresh직렬·응답유실 | Server 코드/합성 시험 근거; Core회원·응답유실 미검증 | 실제 install/approval/claim/exchange/refresh 실패·재연결 |
| D10-E | itemACCEPTED/DUPLICATE/PENDING/NOT_RECEIVED/REJECTED/503 | Server 코드/기존HTTP 합성, Core outbox통합 미검증 | 응답유실·status조회·원문재송신·최종전ACK삭제없음 |

## 이번 실제 수행 결과

- 원격 PR18/17 HEAD·OPEN·Draft 상태 확인. 제품 코드 수정/실제 Chrome 실행 없음.
- 3308 MySQL의 4개 focurve 스키마 version/revision40컬럼·Snapshot JSON8검사 상한 초과 모두0. 읽기 SELECT만, 신규 상한 validator의 PASS가 아님. 다른 DB·백업·전체JSON은 미검증.
- 직전 D01/D05 작업의 Core36/36 모의 회귀는 당시 정확 SHA·로그가 있음. 이번에는 재실행하지 않았으며 새로운 정책 PASS로 사용하지 않음.
- 과거 Backend114/Frontend112·합성HTTP·PR17mock74는 과거 정확 HEAD 근거로만 남긴다. 이번 문서 작업에서 다시 실행한 테스트로 표시하지 않음.
- 변경 문서 링크/요구D01~10/제품 파일 무변경 정적 검수는 문서 검수다. 코드 구현·통합 PASS가 아님.

## R-T01~R-T12 연결

| ID | 시나리오 | 필수 기대 결과·증거 |
|---|---|---|
| R-T01 | 최초 시작·기간 전달·기간 누락/충돌 | duration 1~180/동일 session·snapshot·revision 확인. 누락/불일치 시 적용 없음. APPLIED 후 RUNNING, 첫 구간 1개 |
| R-T02 | 정상 Chrome 종료→재시작 | 마지막 저장 신뢰 경계까지만 인정. 동일 session/Snapshot, 확인 후 새 RUN. 종료 중 잔여 시간 불변 |
| R-T03 | 강제 종료·종료 훅 없음·저장 직후 crash | 마지막 영속 경계 사용, 메모리 시간 미인정. Journal 손상은 대기/조치 필요. 가짜 RUNNING 금지 |
| R-T04 | SW 단독 중지→재생성 | Chrome 종료/ENDED로 자동 분류하지 않음. 규칙 검증·시간 연속성 증거에 따라 공백 제외, 동일 세션 유지 |
| R-T05 | Windows 절전·복귀·시계 변경 | 절전/미확인/역행 공백 제외. 잔여 시간 보존, 복귀 확인 뒤 새 구간. alarm 지연을 집중 시간으로 합산하지 않음 |
| R-T06 | 여러 번 재시작/구간 경계·목표 만료 | CONFIRMED 비중첩 합만 계산. 인접 구간 허용, T 달성 시 EXPIRED·실제 RELEASED, 목표 초과 overrun 별도 |
| R-T07 | 동일 checkpoint/report 재송신·ID 내용 변경·겹친 새 ID | 중복 증가 0, 충돌 거절·원자 롤백, 구간 중첩 거절. API/DB/Web 누적 동일 |
| R-T08 | 재개 APPLY와 Web END 경쟁·오래된 revision | 최신 종료 의도 우선, 늦은 APPLIED가 RUNNING으로 회귀하지 않음. 종료 후 옛 명령 재적용 금지 |
| R-T09 | Server 장애/재접속·토큰 만료/refresh 실패 | 단절과 Chrome 중단 구분. 실제 연속 로컬 실행 증거만 인정. 원문 재송신·reconcile 후 명령, 인증 불가 신규 재적용 대기 |
| R-T10 | Snapshot 불량·DNR 설치/조회 실패·타기능 규칙 충돌 | 전체 검증 실패 상태, 제한 재시도/영구 오류 조치 필요. 타규칙/owner·Journal·미전송 자료 보존 |
| R-T11 | 복구 대기에서 명시 종료·해제 실패·재시도 | 종료 의도 멱등 영속, 추가 시간 0, 실제 자기 규칙 해제 확인 전 ENDED/잠금 해제 금지 |
| R-T12 | Event/Snapshot 1.1·1.2/Journal 1.1·역사 DB/UI 회귀 | 기존 원문·집계·가져오기 보존. 구형 파서에 새 action 주입 없음, 시간 모델 협상 확인. Snapshot 1.2 신규 발급 OFF |

새 정책 기준은 모두 미검증이다. 이 표는 직전 자동복구 계약 문서의 원문을 계승하여 공용 체크리스트에서 직접 사용할 수 있게 반영했다.

## 기술 조율 후 승인할 부분

D06 메시지·규칙영역·priority·freeze, D09 token/proof 응답유실 복구, 새 recovery 상태/API/DB/버전·재시도 수치·legacy 전환, Note 미작성 sentinel, 활성 추가 기능 지원행렬은 세부 조율 필요. 독립 검증 전 PASS/전체 MVP 완료 금지.

## 2026-10-09 로컬 병합 차단 수정 — 현재 지원 경계

로컬 제품 코드만 수정했으며 원격 PR18 HEAD b05d9a0은 변경되지 않았다. 신규 Snapshot source_version/sites[].version/content_policy.version에 SafeVersion(1..9007199254740991)을 공통 적용했다. 가져오기 canonical JSON은 이전에도 safe 정수 초과를 INVALID_SCHEMA로 거절했으며, 새 Snapshot/ImportedSession 공통 guard로 직접 경로도 보완했다. 사이트 생성1·수정/복원/삭제와 메모 저장의 버전 증가는 VERSION_LIMIT으로 상한 초과를 원자 거절한다. 미작성 Note version0는 그대로다. 역사 Snapshot 원문을 무조건 재검증/재작성하지 않는다.

Session 조회는 automatic_recovery_supported=false, time_accounting_mode=LEGACY_WALL_CLOCK을 추가 반환한다. 현재 고정 planned_end_at·기존 END/RELEASED·Journal1.1은 유지하며, 비종료 RESUME action은 기존처럼 거절한다. Web은 자동복구·중단 중 잔여 보존이 미지원임을 명확히 안내한다. D01/D05의 승인 정책은 유지하고 전체 구현은 후속 Server/Core 공동 작업으로 분리한다. 이 필드가 새로운 recovery API나 capability handshake는 아니다.

남은 기술 경계: 일반 focus_sessions.version의 극단 상한에서는 신규 교환 숫자 상한과 필수 종료/해제 가능성이 충돌한다. 종료/보고에 무조건 VERSION_LIMIT을 적용하면 잠금을 유지하게 되므로 기존 종료 경로를 보존했다. 일반 세션 version의 legacy/교환 표현·상한 처리 정책은 후속 합의·독립 리뷰 필요이며 D03 전체 구현 완료로 표시하지 않는다. revision/seq 의미·범위도 자동 재정의하지 않는다.

D06 메시지·규칙 ID/priority/freeze 및 D09 응답유실 추가 API는 계속 미확정/미검증이다. 실제 Chrome·회원 Extension 통합 NOT RUN, 신규 Snapshot1.2 운영 발급 OFF 유지. 새 migration/기존 DB·환경 변경 없음.

### 최종 로컬 실행 결과 — 2026-10-09

Backend 전체120/120·패키징 PASS, Frontend113/113·빌드 PASS. 격리 MySQL57490의 실제 HTTP/DB import8·execution7·note4·policy6 및 기존 Event1.2 HTTP2 시험 통과. 실제 Chrome/회원 Extension NOT RUN. 일반 session.version 극단 경계 계약은 조율 필요하므로 전체 D03/MVP/병합 완료로 바꾸지 않는다. 증거: C:\Users\dahun\capstone-project\.reviews\pr18-20261009\PR18_병합차단_로컬수정_검증보고서.md 및 merge-boundary 로그.

## 2026-10-09 D-03 session.version 최종 호환 처리

사용자 확정 정책에 따른 로컬 구현. 기준 HEAD b05d9a095b229efe310d5c791189eefb0d30300b, 김다훈 담당 Server/API/DB·연결 Web, codex/server-event12-integration. 기존 이력의 session.version 조율 필요/B-01은 당시 판정이며 아래 결과로 갱신한다.

- 생성(start/guest import)은 version1. 새 APPLY→RUNNING 증가는 양의 안전 정수만 가능하고 MAX−1→MAX까지 허용한다. MAX/초과/잘못된 버전의 실제 APPLIED 보고는 사실 접수하되 RUNNING으로 확정하지 않고 UNKNOWN/VERSION_LIMIT 및 RELEASE_POLICY를 발행한다. 보고 HTTP ACCEPTED는 실행 성공이 아니다. 실제 해제 확인 전 잠금을 유지한다.
- 종료/RELEASED/FAILED/UNCONFIRMED/reconcile END 등 안전 처리에서 기존 version이 1..MAX−1이면 정상 증가, MAX 또는 역사 초과이면 값을 그대로 보존하고 증가하지 않는다. 새 초과 값을 생성하거나 기존 값을 clamp/초기화하지 않는다. MAX는 9007199254740991. Session version은 이 예외에서 상태 변경 감지용 단독 validator로 사용할 수 없다.
- Session 응답의 version은 정상 범위 number, 역사 초과는 정확한 십진 string(number|string). version_increment_blocked:boolean은 증가 불가 여부이며 종료 금지나 해제 완료를 뜻하지 않는다. get/current/list/start/end/멱등 재전송에 적용한다. 과거 응답 캐시의 DB 원문도 보존하고 응답 표현만 정규화한다. Web은 Number/parseInt로 변환하지 않는다.
- session resource version과 desired_revision/known_revision/local_action_seq는 별개다. 현재 Session 종료 API는 If-Match session.version에 의존하지 않으며 소유권/설치 인증/행 잠금/명령 revision/보고 hash·중복/행동 sequence 검사를 그대로 사용한다. Event1.1/1.2, Snapshot1.1/1.2, Journal1.1 및 frozen payload는 변경하지 않는다. 독립 revision/seq 극단값의 별도 확대 변경은 이번 범위가 아니다.
- 실제 HTTP/격리 MySQL에서 1/MAX−1/MAX/MAX+1/Long.MAX_VALUE의 명령 종료·UNCONFIRMED·RELEASED와 오프라인 Journal END/reconcile, 중복·잘못된 revision·다른 소유자 거절을 확인한다. 역사 version/Snapshot 불변, 잠금 해제 및 확인된 500ms 집계 유지. Backend 최종127/127·패키징(21:01:59 KST), Frontend114/114·빌드 PASS. mail/OAuth/실제 Chrome·회원 Core·Content는 NOT RUN. 상세 증거는 PR18_D03_session버전_최종호환_수정검증보고서.md.
- Snapshot1.2 신규 발급 기본 OFF, 테스트 profile만 합성 검증 gate 사용. 전체 자동복구는 후속이며 전체 AC/MVP 완료로 승격하지 않는다. 이번 로컬 수정은 독립 재리뷰가 필요하다. Commit/Push/PR 변경/병합 없음.

최종 추가 경합 검증: 미전달 APPLY는 상한 검사 후 해제 명령으로 전환한다. 이미 적용된 APPLY가 상한 감지/해제 명령과 경합하면 유효 실행 구간 증거만 보존하며 현재 revision·UNKNOWN을 되돌리지 않는다. 실제 RELEASED 뒤 구간을 닫고 잠금을 해제한다. 최신 보고서와 session-version-backend.log 참조.
