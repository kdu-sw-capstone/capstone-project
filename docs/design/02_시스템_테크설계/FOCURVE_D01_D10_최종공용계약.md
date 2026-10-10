# FOCURVE D-01~D-10 최종 공용 계약

개정: 2026-10-09 KST. 승인: 김다훈의 명시 사용자 요청(원문 별도 보존). 정책 확정과 구현·자동 시험·실제 Chrome/회원 통합 완료를 구분한다. 이번 변경은 문서만 반영하며 Snapshot 1.2 신규 발급 OFF를 유지한다.

## 적용 기준·이력

- Server PR18 HEAD `b05d9a095b229efe310d5c791189eefb0d30300b`, Draft OPEN.
- Core PR17 HEAD `e79ef3034e3951a20c735de714debab830006284`, OPEN. develop base `76df34ea6be1c591be33c29606c24fc654f61932`.
- 기존 최종계약 검토안의 D-01~10 정책 권장안은 아래 사용자 확정 정책으로 대체한다. 이전 원문은 검토 폴더·문서 변경 전 보관본에 보존한다. 기술 세부 구현안까지 승인된 것은 아니다.
- 기존 D01/D05 문서의 시간 인정·동일 세션 복구 정책을 계승한다. RECOVERY_PENDING/time_basis/새 recovery API·필드·백오프 수치·프로토콜 버전은 제안 상태다.
- 현재 상세 API/데이터/호스트/연결 계약과 충돌하는 정책 문구에는 이 문서가 우선한다. 각 문서에 변경 주석을 연결하며 기존 JSON·자료를 소급 수정하지 않는다.
- 예약의 고정 종료와 사용자 PAUSE/RESUME는 자동복구와 별개다. 외부 OAuth 9개·사이트별 시간 배분 3개 검증을 이번 문서로 통과 처리하지 않는다.

## 확정 정책 원문

아래는 사용자 요청의 D-01~10 정책 원문이다. D-06 세부사항과 D-09 추가 API는 원문대로 미확정/후속이다.

## 2. D-01 — 집중 세션 기간·시간 계약

다음 정책을 확정한다.

- Chrome 종료 시 마지막으로 확인된 집중 시간까지만 인정한다.
- Chrome 종료 중 확인되지 않은 시간은 집중 시간에서 제외한다.
- 목표 집중 시간에서 확인된 누적 집중 시간을 제외하여 남은 시간을 계산한다.
- Chrome 재시작 시 기존 session_id와 frozen Snapshot을 유지한다.
- 검증 성공 시 남은 집중 시간부터 자동 재개한다.
- 임의의 기본 집중 시간을 적용하지 않는다.
- 기존 planned_end_at·active_duration·duration_minutes와의 충돌을 분석한다.
- 새로운 API·DB 필드·상태가 필요하면 실제 구현과 구분하여 후속 작업으로 기록한다.

## 3. D-02 — 회원·비회원 Snapshot 계약

다음 정책을 확정한다.

- 회원 Snapshot은 Server가 발급한다.
- 비회원 Snapshot은 Extension 로컬에서 생성한다.
- 회원·비회원의 소유 문맥과 식별자 형식을 구분한다.
- 기존 Snapshot 1.1 원본은 보존한다.
- 신규 Snapshot 1.2는 필수 필드 전체를 검증한다.
- 기존 비회원 자료를 임의 변환하거나 삭제하지 않는다.
- 비회원 자료의 회원 가져오기는 사용자 명시적 요청 후 검증한다.
- 지원하지 않는 활성 필수 정책은 부분 적용하지 않고 전체 적용을 거절한다.
- 비활성화된 미지원 추가 기능은 정상적인 필수 정책 적용을 불필요하게 차단하지 않는다.

기존 회원·비회원 Snapshot의 실제 필드 구조와 호환성 차이는 문서에 명시한다.

## 4. D-03 — 버전 숫자 정밀도

신규 교환 데이터의 버전 값은 JavaScript 안전 정수 범위로 통일한다.

허용 범위:

1 ≤ version ≤ 9007199254740991

- 양의 정수만 허용한다.
- 0·음수·소수·문자열·null·boolean은 거절한다.
- Java와 JavaScript에서 동일한 값을 정확하게 처리할 수 있어야 한다.
- 기존 DB에 범위를 초과하는 값이 있는지 확인한다.
- 기존 저장 자료는 임의 변경하지 않는다.
- 기존 데이터와 충돌하면 호환·이전 방안을 별도로 보고한다.

현재 Server의 signed 64-bit 계약과 달라지는 부분을 명시하고 실제 검증 로직 변경을 후속 작업으로 분리한다.

## 5. D-04 — Journal·revision 계약

- Journal 1.1 형식을 유지한다.
- Server desired_revision과 Extension 로컬 revision을 구분한다.
- 이벤트 local_seq와 로컬 행동 local_action_seq를 구분한다.
- 회원·비회원 실행 기록과 소유 문맥을 분리한다.
- 명령·실행 보고·Journal·미전송 이벤트를 ACK 전까지 보존한다.
- 동일 보고 재전송 시 중복 처리하지 않는다.
- 오래된 revision이 최신 실행 상태를 덮어쓰지 않도록 한다.
- Server 장애·재연결 시 reconcile 계약을 준수한다.
- 기존 Core action_seq를 Server local_action_seq로 무조건 전송하지 않는다.

## 6. D-05 — Chrome 자동 복구·종료 정책

다음 정책을 확정한다.

- Chrome 정상 종료·비정상 종료·Service Worker 중지·PC 절전·Server 장애를 구분한다.
- 종료 시각을 정확히 알 수 없으면 마지막 신뢰 가능한 관측 시점까지만 집중 시간으로 인정한다.
- Chrome 재시작 후 세션·Snapshot·Journal·차단 규칙을 검증한다.
- 검증 성공 시 기존 세션의 남은 시간부터 자동 재개한다.
- 복구 실패 시 정상 RUNNING으로 표시하지 않는다.
- 복구 대기·재시도 및 사용자 명시적 종료를 지원한다.
- 일시적 오류에는 제한된 재시도·백오프를 적용한다.
- 복구 불가능한 오류는 사용자 조치가 필요한 상태로 구분한다.
- Service Worker 중지만으로 Chrome 전체 종료로 판단하지 않는다.
- PC 절전 중 실행이 확인되지 않은 구간은 집중 시간에서 제외한다.
- 차단 규칙 적용·해제의 실제 확인 후 상태를 확정한다.
- 다른 기능이나 소유자의 차단 규칙을 임의 삭제하지 않는다.

자동 복구와 사용자가 직접 선택하는 PAUSE/RESUME는 서로 다른 기능으로 구분한다.

## 7. D-06 — Core·Content Control 계약

다음 책임 구조를 확정한다.

### Extension Core — 윤종민

- 세션·Snapshot 관리
- 차단 정책 적용 및 실제 상태 확인
- 차단 규칙 관리·복구
- 접근 이벤트 통합 및 Server 전송
- Journal·명령·실행 보고 관리

### Content Control — 채지민

- YouTube Shorts 등 내부 기능 감지·제한
- 성인·키워드 콘텐츠 감지
- 적용된 콘텐츠 제한과 감지 사유 전달
- Core와의 메시지 연동

### Server — 김다훈

- Event 1.2 검증·저장·조회
- 정책·설정·통계 API
- 회원·설치 인증
- 실행 명령·보고·reconcile

공용 원칙:

- 동일 접근은 공통 navigation_id로 식별한다.
- 확인된 복수 차단 사유는 하나의 Event 1.2에 통합한다.
- 이미 전송한 이벤트의 ID·원문을 변경하지 않는다.
- 유효한 차단 조건이 확인되면 다른 감지를 기다리느라 차단을 지연하지 않는다.
- 사이트 ALLOW가 전역 제한을 해제하지 않는다.
- 전역 성인·키워드 예외는 해당 제한에만 적용한다.
- 사이트 BLOCK은 전역 예외와 관계없이 유지한다.
- 지원하지 않는 활성 필수 정책을 정상 적용으로 보고하지 않는다.

단, 실제 Core↔Content 메시지 필드, 규칙 ID 범위, DNR priority, 이벤트 확정 시점은 현재 구현을 대조하여 세부 계약안을 작성한다.

**이 세부사항은 아직 구현 검증 전이므로 자동 확정하지 않는다.**

필수 MVP의 Shorts 제한과 추가 MVP의 성인·키워드·블러 기능을 구분한다.

## 8. D-07 — Snapshot 1.2 발급 활성화

- 신규 Snapshot 1.2 발급은 기본 OFF를 유지한다.
- Server·Core 호환성 검증이 완료된 설치만 허용한다.
- 설치 UUID별 정확한 허용목록을 사용한다.
- client_version 문자열만으로 호환성을 인정하지 않는다.
- 전체 설치 자동 활성화를 금지한다.
- 기존 세션 조회·보고·해제에는 신규 발급 제한을 적용하지 않는다.
- 호환성 실패 시 해당 설치의 신규 발급 허용을 철회한다.
- 자동 capability handshake는 후속 기술 계약으로 분리한다.

## 9. D-08 — 구형 Event 1.1 호환성

- 정상 Event 1.1 원본과 기존 집계 의미를 유지한다.
- 신규 Event 1.2는 실제 방문 호스트 기준으로 처리한다.
- 기존 event_id·schema_version·payload를 임의 변경하지 않는다.
- 잘못된 등록 상위 호스트 키는 정상 데이터로 자동 변환하지 않는다.
- 잘못된 이벤트는 오류로 격리하고 진단 정보를 보존한다.
- 임의의 새 이벤트 ID를 만들어 재전송하지 않는다.
- 과거 통계를 근거 없이 다시 계산하지 않는다.
- 역사 데이터 변환이 필요하면 별도 승인 계약을 작성한다.

## 10. D-09 — 설치 인증·토큰 관리

- 설치 증명·토큰·PKCE verifier는 Extension Background의 접근 통제된 저장소에서 관리한다.
- Content Script와 일반 Web UI에 인증 비밀정보를 전달하지 않는다.
- refresh token 갱신은 설치별로 직렬화한다.
- 응답 유실 시 refresh token을 무조건 재사용하지 않는다.
- 기존 인증·토큰 회전·재사용 탐지 정책을 우회하지 않는다.
- 인증 실패 시 임의로 다른 회원에게 연결하지 않는다.
- 기존 비회원 자료·미전송 이벤트를 보존한다.
- 로그아웃·설치 연결 해제와 자료 삭제를 구분한다.

토큰 발급·갱신 응답 유실 시 복구 절차를 실제 Server API와 대조하여 작성한다.

새로운 상태 조회·복구 API가 필요하면 후속 구현 대상으로 보고한다.

**존재하지 않는 API를 이미 구현된 것으로 작성하지 않는다.**

## 11. D-10 — 이벤트 ACK·재전송

- HTTP 성공과 개별 이벤트 저장 성공을 구분한다.
- ACCEPTED는 저장 확인 후 ACK 처리한다.
- DUPLICATE는 동일 원문이 이미 저장된 경우 ACK 처리한다.
- PENDING_DEPENDENCY는 Server 저장 상태를 추적하고 최종 처리 여부를 확인한다.
- NOT_RECEIVED는 동일 원문을 재전송한다.
- REJECTED는 성공 처리하지 않고 오류와 원문을 격리한다.
- HTTP 503·응답 유실은 백오프 및 상태 조회 후 동일 원문으로 재시도한다.
- 동일 event_id에 다른 내용을 넣어 재전송하지 않는다.
- 최종 처리되지 않은 자료를 임의 삭제하지 않는다.


## 실제 코드와 정책의 대응

| 결정 | 현재 구현·근거 | 구현 상태/후속 |
|---|---|---|
| D-01/D-05 | ExecutionService.java:343–367 최초 start+duration 고정 planned_end; :451–496 종료 합계; :611–718 END 전용 reconcile. Core session-core.js:29/43–52/78–107 고정 alarm·재시작 INTERRUPTED | 새 자동복구 미구현. 확인 누적·여러 RUN·비종료 중단/재개·진행 증거·Web 표시 변경 필요 |
| D-02 | SnapshotValidation은 Server 전체 필드 검사, ImportedSession은 guest UUID를 별도로 허용. Core begin Snapshot에는 owner_user_id/content_policy 누락, supported는 format/strategy 검사 | member/guest 스키마 문맥·1.2 전체 검사 및 disabled 추가 기능 처리 보완 필요. 과거 1.1은 생성 당시 구조 유지 |
| D-03 | Server SnapshotValidation/ImportedSession은 Integer/Long 양의 정수, Long.MAX_VALUE 수용; Core JS Number 정밀도 차이 | 로컬 Snapshot/가져오기 상한 검사 반영. 일반 세션 version 극단 경계는 종료 안전성을 위해 조율 필요. signed64는 현재 코드 사실이며 신규 정책 기준은 아님 |
| D-04 | Server report ID/hash 멱등·발급 revision 검사·END local_action_seq. Core action_seq는 시작 포함 | counter 직접 매핑 금지. 회원 journal 어댑터/ACK 보존 미구현. Journal 1.1에 새 recovery action을 몰래 넣지 않음 |
| D-06 | EventService/SnapshotAccess는 복수 사유·정책 검증. Core access-store는 1.1 등록 호스트 키, Content 회원 통합 없음 | navigation 식별·이벤트 통합 및 아래 메시지 기술안 조율 필요. Shorts 필수, 성인/키워드/블러 추가 MVP |
| D-07 | ExecutionService.start의 기본 OFF·exact executor gate, test만 '*' | 운영 안전장치 구현. 실제 호환 증거/허용 철회 운영 검증 필요. handshake 없음 |
| D-08 | Server 구형 키/조회 보존·오류 registered-host 키 거절 | Core 오류 격리·진단 원문 보존 필요. 역사자료 무변환 |
| D-09 | MemberLinks PKCE·claim·refresh 회전/재사용 탐지. Core 회원 어댑터 없음 | background 접근통제·refresh 직렬화·응답 유실 복구 미검증. 아래 실제 API 한계 유지 |
| D-10 | EventController batch/status item 결과, DUPLICATE/hash·PENDING 저장 | Core item별 ACK/최종 상태 추적 필요. HTTP200을 전체 성공으로 처리 금지 |

## D-02 생성 주체와 실제 필드 차이

회원은 Server의 UUID snapshot/executor, owner_user_id 양수 십진 문자열, source_version, sites 및 content_policy 전체 구조를 사용한다. sites의 site_id는 Server 양수 숫자 문자열이다. 비회원은 로컬 생성·GUEST:설치 문맥, guest site_id UUID를 사용할 수 있다. 신규 1.2의 owner_user_id는 비회원 null이며 회원과 혼동하지 않는다. 현재 Core guest 원문은 owner/content 구조가 빠져 있으므로 새 생성기에 보완이 필요하다. 기존 1.1 및 과거 guest payload를 보완한다는 이유로 다시 저장하지 않는다. 가져오기는 명시 선택·원문 검증·소유권 확인·item 원자성으로 수행한다.

비활성 추가 기능은 올바른 구조만 파싱하고 실행 지원이 없다는 이유만으로 필수 정책 적용을 막지 않는다. 활성 필수 정책은 하나라도 미지원이면 전체 거절한다. 활성 추가 기능을 무시하고 전체 APPLIED라고 보고할 수는 없다. 실제 지원행렬·부분 지원 오류 안내는 기술 조율 대상으로 남긴다.

## D-03 범위와 기존 데이터 읽기 점검

신규 교환 Snapshot의 source_version/sites[].version/content_policy.version 및 실제 교환되는 객체 version은 1..9007199254740991 정수다. 내부 BIGINT 저장 형식을 문자열로 임의 변경하지 않는다. version과 UUID/문자열 catalog_version/model_profile_version, 독립 seq/revision은 타입을 혼동하지 않는다. 기존 Note의 부재 sentinel version=0과 충돌하는 부분은 후속 설계에서 별도 표현으로 구분해야 하며 신규 양의 version 검사를 무조건 적용해 미작성 메모 조회를 깨뜨리지 않는다. revision/seq의 숫자 교환 안전성도 추가 점검 대상으로 기록한다.

3308 MySQL 4개 스키마(focurve_audit_app/test, focurve_repair_app/test)의 numeric version/revision 컬럼 40개와 Snapshot source/content·sites JSON 검사 8개에서 상한 초과 건수 모두 0. 확인은 SELECT/정보 스키마/읽기 PREPARE뿐이며 DB 변경 없음. 이는 모든 역사 백업/다른 개발 DB/JSON 전체 필드를 검사한 결과가 아니다. 로그: 검토 폴더 D03_기존DB_버전범위_확인.log. 향후 초과 자료 발견 시 원본 보존·신규 교환 격리·무손실 조회/명시적 이전 계획을 별도 승인한다. 자동 clamp/버전1 재설정 금지.

## D-06 기술 세부안 — 미확정, 미구현·미검증

기존 Core access-store.pending/commit/fail/list, service-worker navigation listener, host-policy.rules, Content 실제 핸들러와 대조 후 다음 의미를 확정해야 한다. 아래는 존재하는 제품 메시지/API가 아니다.

| 초안 항목 | 권장 의미/조율 사항 |
|---|---|
| 메시지 판별 | 명시 message 계약 버전·종류, 실제 sender 확장/프레임/탭 검증. Web 임의 메시지 수용 금지 |
| 실행 문맥 | owner/executor/session/snapshot/Server revision·tab/frame을 Core가 검증. Content 주장을 인증으로 신뢰하지 않음 |
| navigation | Core가 navigation_id를 발급/바인딩. Content 재렌더/서브프레임/실패 navigation을 새 접근으로 중복 계산하지 않음 |
| 감지 증거 | 실제 target_host·feature_code·확인된 reason·관측 시각·탐지ID. 원문 콘텐츠/전체 URL/비밀 제외 |
| 규칙 ID·DNR priority | Core 현 사이트 규칙 시작 ID 100000/priority 100+호스트 깊이는 현재 사실. Content 예약 범위·site ALLOW와 global BLOCK 우선순위는 미합의. 기존 다른 기능 규칙을 삭제/충돌시키지 않음 |
| 이벤트 확정 | 첫 유효 조건 즉시 차단. 전송 원문을 freeze하기 전에 이미 확인된 이유만 통합. 확정 시점/동시 감지 경계 조율. 전송 후 늦은 이유는 same ID 변경/새 접근 추가 금지; annotation API 없음 |

대표 reason USER_SITE→ADULT_DOMAIN→KEYWORD→FEATURE와 FEATURE 포함 시 BLOCKED_FEATURE_ACCESS/FEATURE/YOUTUBE_SHORTS는 현행 Event 1.2 계약을 유지한다. DNR 숫자 범위·message 필드명·타이밍을 이 초안으로 자동 승인하지 않는다.

## D-09 실제 API 기반 응답 유실 절차·한계

- POST /extension-installations 응답 유실: 동일 executor의 proof를 아직 확보하지 못했다면 임의 새 설치 ID로 원자료 덮어쓰기 금지. 현재 중복은 INSTALLATION_EXISTS이며 proof 재발급 API 없음. 설치 등록 복구는 후속 기술 계약 필요.
- POST /extension-link-requests/{id}/claim: 같은 state/설치 proof로 현재 claim 조회 재요청 가능. 최초 claim부터 code 기한을 늘리지 않는다. Web approval은 연결 완료가 아님.
- POST /extension-tokens code 교환 응답 유실: code 단회 소비를 우회하지 않는다. 받은 token이 없어 GET /auth/me 인증이 불가능하면 사용 가능한 계정 상태 조회가 있다고 가정하지 않는다. 원자료 보존 후 사용자 명시 재연결이 필요한 오류로 안내한다. 활성 잠금/연결 조건이 막으면 지원 절차·추가 상태 API 검토 필요.
- POST /extension-tokens/refresh 응답 유실: 이전 refresh를 무조건 재시도하면 재사용 탐지로 family 폐기될 수 있다. 새 token을 영속 확보했으면 그것만 사용; 미확보면 인증 복구 대기/명시 재연결. 임의 grace window·이중 token 유효화 금지.
- GET /auth/me는 유효 E token이 있을 때 owner 확인에 사용 가능. GET /extension-installations·DELETE /.../connection은 Web 쿠키의 명시 연결 관리이며 token 없는 background의 복구 API가 아니다.
- 모든 해제/재연결은 활성 규칙·잠금·미전송 자료를 대조한다. 로그아웃/연결 해제가 자료 삭제는 아니다. 새 recovery endpoint·완전한 응답 유실 복구는 아직 없음.

## 시간·복구 기술 계약의 한계

Journal 1.1 END-only wire를 유지한다. D-01/D-05의 비종료 중단·재개에는 별도 버전 협상/복구 절차가 필요하지만 기존 1.1 enum·의미를 바꾸지 않는다. 새 time_basis/RECOVERY_PENDING/progress/recovery API·DB·백오프 수치는 제안이며 이 문서가 승인하지 않는다. 세션·스냅샷은 동일하게 유지하고 닫힌 확인 RUN 합계, 중첩 거절, 최신 종료 revision 우선, 신뢰 관측 없는 공백 제외를 구현해야 한다.

## 구현·검증 관리

정책 D-01~D-10: 사용자 승인으로 확정(각 항목의 명시적 미확정 세부안 제외). 실제 구현/실제 Chrome·회원 통합: 완료 아님. 담당별 미완료와 merge 판단은 [구현 영향](../../implementation/FOCURVE_D01_D10_구현영향_담당자별작업.md), 검증 주체/기준은 [체크리스트](../../implementation/FOCURVE_D01_D10_검증체크리스트.md)를 따른다. 기존 테스트 PASS를 새 정책 구현 PASS로 바꾸지 않는다.

## 시간 계산 불변 조건

T=duration_minutes×60000, C=중첩 없는 CONFIRMED RUN의 합, active_duration_ms=min(T,C), overrun_ms=max(0,C−T), remaining_ms=max(0,T−C). 각 구간은 [start_at,end_at)로 인접은 허용·중첩은 거절한다. 신뢰 경계가 없는 Chrome/절전 공백은 제외하고 재개 검증 후 새 interval_id로 새 RUN을 연다. started_at은 최초 시작을 유지하고 실제 해제 시각은 별도로 저장한다. 구형 고정 planned_end_at을 바꾸는 time_basis/새 필드·프로토콜은 아직 기술안이며 역사 세션을 조용히 변환하지 않는다. SW 중지를 전체 종료로 판단하지 않되 미확인 시간은 추정하지 않는다.

## 2026-10-09 로컬 병합 차단 수정 — 현재 지원 경계

로컬 제품 코드만 수정했으며 원격 PR18 HEAD b05d9a0은 변경되지 않았다. 신규 Snapshot source_version/sites[].version/content_policy.version에 SafeVersion(1..9007199254740991)을 공통 적용했다. 가져오기 canonical JSON은 이전에도 safe 정수 초과를 INVALID_SCHEMA로 거절했으며, 새 Snapshot/ImportedSession 공통 guard로 직접 경로도 보완했다. 사이트 생성1·수정/복원/삭제와 메모 저장의 버전 증가는 VERSION_LIMIT으로 상한 초과를 원자 거절한다. 미작성 Note version0는 그대로다. 역사 Snapshot 원문을 무조건 재검증/재작성하지 않는다.

Session 조회는 automatic_recovery_supported=false, time_accounting_mode=LEGACY_WALL_CLOCK을 추가 반환한다. 현재 고정 planned_end_at·기존 END/RELEASED·Journal1.1은 유지하며, 비종료 RESUME action은 기존처럼 거절한다. Web은 자동복구·중단 중 잔여 보존이 미지원임을 명확히 안내한다. D01/D05의 승인 정책은 유지하고 전체 구현은 후속 Server/Core 공동 작업으로 분리한다. 이 필드가 새로운 recovery API나 capability handshake는 아니다.

남은 기술 경계: 일반 focus_sessions.version의 극단 상한에서는 신규 교환 숫자 상한과 필수 종료/해제 가능성이 충돌한다. 종료/보고에 무조건 VERSION_LIMIT을 적용하면 잠금을 유지하게 되므로 기존 종료 경로를 보존했다. 일반 세션 version의 legacy/교환 표현·상한 처리 정책은 후속 합의·독립 리뷰 필요이며 D03 전체 구현 완료로 표시하지 않는다. revision/seq 의미·범위도 자동 재정의하지 않는다.

D06 메시지·규칙 ID/priority/freeze 및 D09 응답유실 추가 API는 계속 미확정/미검증이다. 실제 Chrome·회원 Extension 통합 NOT RUN, 신규 Snapshot1.2 운영 발급 OFF 유지. 새 migration/기존 DB·환경 변경 없음.

## 2026-10-09 D-03 session.version 최종 호환 처리

사용자 확정 정책에 따른 로컬 구현. 기준 HEAD b05d9a095b229efe310d5c791189eefb0d30300b, 김다훈 담당 Server/API/DB·연결 Web, codex/server-event12-integration. 기존 이력의 session.version 조율 필요/B-01은 당시 판정이며 아래 결과로 갱신한다.

- 생성(start/guest import)은 version1. 새 APPLY→RUNNING 증가는 양의 안전 정수만 가능하고 MAX−1→MAX까지 허용한다. MAX/초과/잘못된 버전의 실제 APPLIED 보고는 사실 접수하되 RUNNING으로 확정하지 않고 UNKNOWN/VERSION_LIMIT 및 RELEASE_POLICY를 발행한다. 보고 HTTP ACCEPTED는 실행 성공이 아니다. 실제 해제 확인 전 잠금을 유지한다.
- 종료/RELEASED/FAILED/UNCONFIRMED/reconcile END 등 안전 처리에서 기존 version이 1..MAX−1이면 정상 증가, MAX 또는 역사 초과이면 값을 그대로 보존하고 증가하지 않는다. 새 초과 값을 생성하거나 기존 값을 clamp/초기화하지 않는다. MAX는 9007199254740991. Session version은 이 예외에서 상태 변경 감지용 단독 validator로 사용할 수 없다.
- Session 응답의 version은 정상 범위 number, 역사 초과는 정확한 십진 string(number|string). version_increment_blocked:boolean은 증가 불가 여부이며 종료 금지나 해제 완료를 뜻하지 않는다. get/current/list/start/end/멱등 재전송에 적용한다. 과거 응답 캐시의 DB 원문도 보존하고 응답 표현만 정규화한다. Web은 Number/parseInt로 변환하지 않는다.
- session resource version과 desired_revision/known_revision/local_action_seq는 별개다. 현재 Session 종료 API는 If-Match session.version에 의존하지 않으며 소유권/설치 인증/행 잠금/명령 revision/보고 hash·중복/행동 sequence 검사를 그대로 사용한다. Event1.1/1.2, Snapshot1.1/1.2, Journal1.1 및 frozen payload는 변경하지 않는다. 독립 revision/seq 극단값의 별도 확대 변경은 이번 범위가 아니다.
- 실제 HTTP/격리 MySQL에서 1/MAX−1/MAX/MAX+1/Long.MAX_VALUE의 명령 종료·UNCONFIRMED·RELEASED와 오프라인 Journal END/reconcile, 중복·잘못된 revision·다른 소유자 거절을 확인한다. 역사 version/Snapshot 불변, 잠금 해제 및 확인된 500ms 집계 유지. Backend 최종127/127·패키징(21:01:59 KST), Frontend114/114·빌드 PASS. mail/OAuth/실제 Chrome·회원 Core·Content는 NOT RUN. 상세 증거는 PR18_D03_session버전_최종호환_수정검증보고서.md.
- Snapshot1.2 신규 발급 기본 OFF, 테스트 profile만 합성 검증 gate 사용. 전체 자동복구는 후속이며 전체 AC/MVP 완료로 승격하지 않는다. 이번 로컬 수정은 독립 재리뷰가 필요하다. Commit/Push/PR 변경/병합 없음.

최종 추가 경합 검증: 미전달 APPLY는 상한 검사 후 해제 명령으로 전환한다. 이미 적용된 APPLY가 상한 감지/해제 명령과 경합하면 유효 실행 구간 증거만 보존하며 현재 revision·UNKNOWN을 되돌리지 않는다. 실제 RELEASED 뒤 구간을 닫고 잠금을 해제한다. 최신 보고서와 session-version-backend.log 참조.

## 2026-10-10 APPLY 기간 전달 사용자 확정·로컬 구현

이전 ‘APPLY 명령에 기간 없음’ 설명은 develop 기준의 과거 구현 이력이다. 새 회원 APPLY_POLICY는 root duration_minutes(JSON 정수1~180)를 저장된 focus_sessions 목표값에서 생성해 포함한다. 조회/멱등·기존Snapshot/보고/Journal은 유지한다. 구형 저장명령은 다시 쓰지 않으며 기간 없는 APPLY를 Core가 기본시간으로 실행하지 않는다. RELEASE는 기간 필수화하지 않는다. 실제 Core 회원 adapter·Chrome 검증 및 자동복구는 미완료; 기본Snapshot1.2OFF 유지. 상세 규칙은 [APPLY 기간 전달 확정 계약](FOCURVE_APPLY_POLICY_기간전달_확정계약.md)을 따른다.
