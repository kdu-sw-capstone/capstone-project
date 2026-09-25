# FOCURVE API 명세 v1.0

비회원 보관·가져오기 정책: 보관 기간·기산점과 성공 원본 처리 방식은 설계 결정사항 DEC-01·DEC-02에서 확정한다. 본문의 30일·90일 및 원본 처리 규칙은 해당 항목의 정책 후보이며, 회원 서버 기록의 보관 정책과 구분한다.

적용 범위: 기본 기능의 상세 설계. 이번 학기 추가 기능의 API·데이터·상태 계약은 [추가 기능 설계](../01_UX_기능설계/FOCURVE_추가_기능_설계.md)와 [설계 결정사항](FOCURVE_설계_결정사항.md)을 따른다. 미정 항목은 구현 전 확정한다.

작성일: 2026-09-20  
상태: 구현 전 검토안 — 기존 정책을 연결하고 API 계약·전송 방식은 새 제안으로 구분  
범위: Web ↔ Server / Extension ↔ Server. 실제 구현·서버 호출 테스트 완료를 뜻하지 않는다.

## 1. 팀원이 읽는 순서

1. 공통 규칙과 데이터 사전을 읽는다.
2. 담당 화면에 연결된 API의 요청·응답·오류를 확인한다.
3. 세션·이벤트·가져오기 흐름을 연결해서 검토한다.
4. 마지막의 미확정 사항과 ERD 보완점을 합의한 뒤 구현한다.

API ID는 문서 식별자다. 기능 ID·화면 ID·DB 키와 다르다. API 한 개를 여러 화면에서 사용할 수 있다. DB 컬럼을 그대로 노출하는 것이 아니라 화면과 실행에 필요한 데이터만 반환한다.

기준 문서: FOCURVE_역할_데이터흐름_v1.0.md, FOCURVE_핵심정책_v1.0.md, FOCURVE_Event_Schema_v1.0.md, FOCURVE_ERD_IE_v1.0.drawio.

### 기존 원칙과 설계안

| 구분 | 내용 |
|---|---|
| 유지 | 비회원 로컬 실행, 회원 설정 Server 기준, 실제 차단 Extension 실행 |
| 유지 | 설정 변경은 다음 세션부터, 당시 정책 스냅샷 보존 |
| 유지 | 로그인과 비회원 자료 가져오기는 별도 행동 |
| 유지 | 5개 이벤트 유형, 접근 재전송 중복 제거, 반복은 계산 값 |
| 설계안 | /api/v1 경로, JSON 필드, HTTP 상태·오류 코드, 페이지 처리 |
| 설계안 | Web 세션 쿠키, Extension 별도 인증, 일회용 연결 코드와 PKCE |
| 설계안 | Extension 명령 주기 조회, 실행 결과 보고, 명령 저장·재전달 |
| 정책 검토안 계승 | 계정당 활성 세션 1개, 1~180분, 설정 충돌 시 회원 설정 유지 |
| 미확정 유지 | 비회원 보관 90일 구안과 30일 제안, 가져오기 후 원본 정리, 회원 보관·탈퇴 정책 |

## 2. 공통 계약

- 기본 경로: `/api/v1`. 실제 호스트는 배포 후 결정한다.
- JSON 필드: snake_case. 요청·응답: `application/json`. 파일 업로드를 제외한 모든 본문은 UTF-8 JSON이다.
- 성공 응답: 데이터 객체를 바로 반환한다. 목록은 `{items, next_cursor, has_more}`. 204는 본문 없음.
- 시간: UTC RFC 3339 문자열, 예 `2026-09-20T05:28:00.000Z`. 일별·시간대별 집계는 `Asia/Seoul`.
- bigint ID는 JSON에서 십진 문자열로 반환한다. UUID는 하이픈 포함 문자열이다.
- 외부 `session_id`는 ERD의 `source_session_id` UUID다. DB 내부 bigint는 `server_session_id`이며 일반 요청에는 사용하지 않는다. 세션 단건 조회는 `(인증 계정, executor_id, session_id)`로 식별한다.
- client가 보낸 user_id로 소유자를 정하지 않는다. 인증 계정과 자원 소유 계정, 실행 인증의 executor_id를 확인한다.
- 삭제됐거나 타 계정의 자원은 동일한 404 RESOURCE_NOT_FOUND를 반환한다. 역할이 맞지 않는 API 호출은 403 FORBIDDEN.
- 목록 limit 기본 20, 최대 100. 커서는 불투명 문자열이며 필터가 바뀌면 폐기한다. 각 목록은 정렬 키와 ID로 안정 정렬하되 동시 추가에 대한 스냅샷 일관성은 보장하지 않는다.
- 날짜 필터: from_date/to_date는 YYYY-MM-DD, 양 끝 날짜 포함, 최대 366일 제안. 내부에서는 시작일 00:00 이상 ~ 종료일 다음 날 00:00 미만 KST로 변환한다.
- 수정 요청은 `If-Match: "<version>"`. 미제공 428 PRECONDITION_REQUIRED, 불일치 412 VERSION_CONFLICT. 조회·수정 응답에는 ETag도 반환한다.
- 멱등 요청은 `Idempotency-Key` UUID가 필수다. 범위는 인증 계정+API+키, 본문 해시를 함께 보관한다. 같은 키·같은 본문은 같은 자원과 처리 결과를 반환한다. 다른 본문은 409 IDEMPOTENCY_CONFLICT. 기본 7일 보관 제안이며, 세션 원본·event_id·가져오기 원본의 영속 중복 방지는 별도로 유지한다.
- 네트워크 오류·429·503은 같은 식별자로 재시도한다. 429/503의 Retry-After를 따른다. 기본 지수 백오프 1/2/4/8/16/30초 상한+지터 제안. 검증 오류는 내용을 고치기 전 자동 재전송하지 않는다.
- 인증 만료는 한 번 갱신 후 재요청한다. 갱신 실패 시 재로그인 안내. 이전 계정의 전송 대기를 새 계정에 전송하지 않는다.
- 알 수 없는 입력 필드는 422 UNKNOWN_FIELD로 거절한다. 이벤트 원본에 임의의 URL·제목·검색어를 덧붙이지 않는다.

### 공통 오류

```json
{"error":{"code":"VALIDATION_FAILED","message":"입력값을 확인해 주세요.","field_errors":[{"field":"duration_minutes","reason":"1~180 사이의 정수를 입력해 주세요."}],"request_id":"req-example-001","retryable":false}}
```

| HTTP | 대표 코드 | 클라이언트 처리 |
|---|---|---|
| 400 | MALFORMED_JSON / INVALID_CURSOR | 형식·커서 수정 |
| 401 | AUTH_REQUIRED / TOKEN_EXPIRED | 갱신 또는 로그인 |
| 403 | FORBIDDEN / CSRF_FAILED / EXECUTOR_MISMATCH | 요청 주체 확인 |
| 404 | RESOURCE_NOT_FOUND | 목록 새로고침 |
| 409 | ACTIVE_SESSION_EXISTS / SITE_SCOPE_CONFLICT / IDEMPOTENCY_CONFLICT | 상태 확인 후 재조작 |
| 412 | VERSION_CONFLICT | 최신 설정을 다시 읽고 사용자에게 재확인 |
| 413 | PAYLOAD_TOO_LARGE | 이벤트 묶음 크기 축소 |
| 422 | VALIDATION_FAILED / POLICY_MISMATCH | 필드 오류 표시 |
| 428 | PRECONDITION_REQUIRED | 최신 버전을 포함 |
| 429 | RATE_LIMITED | Retry-After 이후 재시도 |
| 503 | TEMPORARILY_UNAVAILABLE | 오류 표시·같은 요청 재시도 |

field_errors는 없으면 빈 배열. message는 표시용이며 분기는 code로 처리한다. 내부 예외·SQL·인증 비밀은 응답에 포함하지 않는다.

## 3. 인증·Extension 연결 제안

Web은 HttpOnly·Secure·SameSite=Lax 세션 쿠키를 사용한다. 배포는 Web과 API의 동일 사이트 구성을 우선하며 cross-site 구성은 별도 검토한다. 로그인 포함 모든 쿠키 기반 변경 요청에 CSRF 토큰과 허용 Origin 검증을 적용한다. Extension은 쿠키를 복사하지 않고 Bearer access_token을 사용한다. 인증 방식은 기존 기획의 확정 내용이 아닌 구현 설계안이다.

Extension은 code_verifier와 state를 로컬에서 생성한다. 일회용 연결 요청을 만들고 Web 로그인·계정 확인·연결 승인 화면을 연다. Server는 승인 계정과 executor_id, S256 challenge, 등록된 callback URI에 결박한 코드만 발급한다. Extension은 callback의 state 확인 후 verifier로 코드를 교환한다. 취소 시 연결하지 않는다. 접속 URL의 executor_id만 믿고 연결하지 않는다.

- 연결 요청 만료 5분, 코드 만료 60초, access_token 15분, refresh_token 30일 제안.
- refresh_token은 회전·재사용 탐지·폐기를 적용하며 서버에는 해시를 저장한다. 클라이언트 비밀키를 Extension 코드에 넣지 않는다.
- callback_uri는 사전 등록된 Extension callback만 정확히 일치시킨다. 임의 외부 URL로 리다이렉트하지 않는다.
- executor_id는 설치 식별자일 뿐 비밀이 아니다. 기존 설치를 탈취해 재등록할 수 없도록 신규 등록에서 설치 증명 자격을 발급하고 보관한다. 재연결 시 해당 증명을 검증한다.
- PKCE는 [RFC 7636](https://www.rfc-editor.org/info/rfc7636/)의 S256 verifier/challenge 검증 원리를 사용한다. 여기의 연결 API 자체를 완전한 OAuth 표준 구현이라고 주장하지 않는다.
- Web 로그아웃은 Web 세션만 종료한다. Extension 연결 해제는 별도다. 활성 세션 중 연결 해제는 해제 확인 후 수행하며 미전송 자료는 원래 계정별로 유지한다.

## 4. 공통 데이터 사전

`?`는 응답 null 허용 또는 요청 선택 필드다. 별도 언급 없는 요청 필드는 필수. 예시에 없는 필드라도 아래 계약에 있으면 사용할 수 있다.

| 객체 | 필드·형식·의미 |
|---|---|
| User | user_id:십진문자열, display_name:문자열 또는 null |
| SiteInput | url:문자열(최대 2048), display_name:1~100자, include_subdomains:boolean, purpose:FOCUS/DISTRACTION/GENERAL, access_policy:ALLOW/BLOCK/RECORD, feature_policies:FeaturePolicy[] |
| FeaturePolicy | feature_code:YOUTUBE_SHORTS, enabled:boolean. 같은 코드 중복 금지 |
| Site | site_id:십진문자열, canonical_host:1~253자, SiteInput 중 url 제외 전체 필드, version:정수≥1, created_at/updated_at:UTC |
| Snapshot | policy_snapshot_id:UUID, format_version:"1.0", created_at:UTC, sites:SnapshotSite[] |
| SnapshotSite | canonical_host, display_name, include_subdomains, purpose, access_policy, feature_policies. 당시 설정 값이며 site_id가 없어도 해석 가능 |
| Session | session_id:UUID, executor_id:UUID, policy_snapshot_id:UUID, origin:MEMBER/GUEST_IMPORT, execution_status, record_status, duration_minutes:정수, started_at/planned_end_at/ended_at/policy_released_at:UTC 또는 null, end_reason/end_time_basis:null 또는 아래 열거값, last_access_seq:정수≥0 또는 null, version:정수, last_error_code:null 또는 오류코드 |
| Command | command_id:UUID, executor_id:UUID, session_id:UUID, type:APPLY_POLICY/RELEASE_POLICY, created_at:UTC, payload:ApplyPayload 또는 ReleasePayload |
| ApplyPayload | duration_minutes, snapshot:Snapshot. 같은 command_id는 내용 불변 |
| ReleasePayload | reason:USER_ENDED. 시간 만료는 로컬 처리이며 Server 명령을 기다리지 않음 |
| ExecutionReport | report_id:UUID, command_id:UUID 또는 null, session_id:UUID, executor_id:UUID, observed_at:UTC, status:APPLY_FAILED/RELEASE_FAILED/STATE_UNKNOWN/RECONCILED_RELEASED, error_code:null 또는 APPLICATION_FAILED/RELEASE_FAILED/LOCAL_STORAGE_FAILED/EXECUTION_UNCERTAIN, rollback_confirmed:boolean 또는 null |
| AccessView | event_id, session_id, executor_id, occurred_at, event_type, target_kind, target_host, feature_code, target_key, access_seq, target_access_index, is_repeat, origin, policy_snapshot_id |
| ImportBatch | batch_id:UUID, status:PENDING/PROCESSING/SUCCEEDED/PARTIAL/FAILED, items:ImportResult[], requested_at:UTC, completed_at:UTC 또는 null |
| ImportResult | source_item_id:UUID, item_type:SITE/SESSION, status:PENDING/PROCESSING/SUCCEEDED/SKIPPED/FAILED, result_site_id:십진문자열 또는 null, result_session_id:UUID 또는 null, error_code:null 또는 코드 |

### 사이트 검증 제안

url은 http/https 주소 또는 호스트를 받는다. 호스트만 소문자·IDNA 정규화하여 저장하고 경로·쿼리·fragment는 관리 범위가 아님을 입력 화면에 알린다. 자격정보 포함 URL, 포트 지정, localhost·IP 주소는 v1에서 거절한다. www는 무조건 제거하지 않는다. 상위 도메인이 하위 도메인을 포함하는 범위와 다른 등록 범위가 겹치면 409 SITE_SCOPE_CONFLICT. 삭제 행의 동일 호스트를 등록할 때에는 기존 행을 복구하고 version을 증가한다.

목적과 정책 조합은 설계안으로 FOCUS/GENERAL → ALLOW, DISTRACTION → BLOCK 또는 RECORD. YOUTUBE_SHORTS는 youtube.com에만 허용한다. 사이트 전체 BLOCK과 Shorts enabled가 함께 저장될 수 있지만 실행 시 전체 BLOCK 우선으로 접근 하나만 기록한다. 저장·삭제·가져오기는 현재 세션 Snapshot을 수정하지 않는다.

### 상태·집계

execution_status: STARTING / RUNNING / ENDING / ENDED / START_FAILED / INTERRUPTED / UNKNOWN.  
record_status: PENDING / PARTIAL / COMPLETE / REVIEW_REQUIRED.

정상 흐름: STARTING → SESSION_STARTED 검증 → RUNNING → 종료 요청 시 ENDING → SESSION_ENDED 검증 → ENDED. 중단 종료는 INTERRUPTED. 적용 실패이면서 복구 확인됨은 START_FAILED, 복구 불명확은 UNKNOWN. 해제 실패는 ENDING과 last_error_code=RELEASE_FAILED. 명령 수신·HTTP 성공만으로 RUNNING/ENDED를 만들지 않는다.

활성 차단 상태: STARTING/RUNNING/ENDING/UNKNOWN. 계정별 신규 시작과 원래 executor의 다른 계정 시작도 실제 해제 확인 전 차단한다. 종료 이벤트가 먼저 오면 유효한 해제 사실을 보존하고 record_status를 PARTIAL로 두며, 뒤늦은 시작 이벤트가 상태를 RUNNING으로 되돌리지 않게 한다.

조회 aggregation_status: CURRENT_RECEIVED / COMPLETE / REVIEW_REQUIRED. COMPLETE는 해당 수신 범위가 해소됐다는 의미이며 관찰 자체의 완전성을 보장하지 않는다. 기본 통계의 집중 시간은 ENDED + EXACT 세션의 ended_at-started_at, 날짜 경계는 구간을 나눠 합산한다. 중단 추정 시간은 interrupted_duration_seconds로 별도 반환한다. 반복은 세션 전체 대상별로 먼저 계산한 뒤 날짜 필터를 적용한다.

## 5. API 목록과 상세

인증 표기: W=Web 쿠키+변경 요청 CSRF, E=연결된 Extension Bearer, P=로그인 전 제한된 요청. E는 token의 executor_id와 요청 executor_id가 같아야 한다. 읽기 전용 계정 데이터는 W/E 둘 다 가능하다.

| API ID | 작업 | 방식·경로 | 호출 주체 |
|---|---|---|---|
| AUTH-01 | CSRF 준비 | `GET /api/v1/auth/csrf` | P/W |
| AUTH-02 | 회원가입 | `POST /api/v1/auth/signup` | P+CSRF |
| AUTH-03 | 로그인 | `POST /api/v1/auth/login` | P+CSRF |
| AUTH-04 | 내 계정 | `GET /api/v1/auth/me` | W/E |
| AUTH-05 | Web 로그아웃 | `POST /api/v1/auth/logout` | W |
| EXT-01 | 설치 등록 | `POST /api/v1/extension-installations` | P |
| EXT-02 | Web 연결 요청 준비 | `POST /api/v1/extension-link-requests` | 설치 증명 |
| EXT-03 | 계정 연결 승인 | `POST /api/v1/extension-link-requests/{link_request_id}/approval` | W |
| EXT-04 | 연결 코드 교환 | `POST /api/v1/extension-tokens` | 설치 증명 |
| EXT-05 | Extension 토큰 갱신 | `POST /api/v1/extension-tokens/refresh` | refresh 자격 |
| EXT-06 | Extension 연결 해제 | `DELETE /api/v1/extension-installations/{executor_id}/connection` | W/E |
| EXT-07 | 연결 설치 목록 | `GET /api/v1/extension-installations` | W/E |
| SITE-01 | 사이트 목록 | `GET /api/v1/sites` | W/E |
| SITE-02 | 사이트 단건 | `GET /api/v1/sites/{site_id}` | W/E |
| SITE-03 | 사이트 등록 | `POST /api/v1/sites` | W/E |
| SITE-04 | 사이트 수정 | `PATCH /api/v1/sites/{site_id}` | W/E |
| SITE-05 | 사이트 삭제 | `DELETE /api/v1/sites/{site_id}` | W/E |
| SESSION-01 | 집중 시작 요청 | `POST /api/v1/sessions` | W/E |
| SESSION-02 | 현재 세션 | `GET /api/v1/sessions/current` | W/E |
| SESSION-03 | 세션 목록 | `GET /api/v1/sessions` | W/E |
| SESSION-04 | 세션 단건 | `GET /api/v1/sessions/{session_id}` | W/E |
| SESSION-05 | 세션 정책 조회 | `GET /api/v1/sessions/{session_id}/policy` | W/E |
| SESSION-06 | 직접 종료 요청 | `POST /api/v1/sessions/{session_id}/end` | W/E |
| EXEC-01 | 실행 명령 조회 | `GET /api/v1/executors/{executor_id}/commands` | E |
| EXEC-02 | 실패·복구 상태 보고 | `POST /api/v1/executors/{executor_id}/reports` | E |
| EVENT-01 | 이벤트 묶음 전송 | `POST /api/v1/events/batch` | E |
| EVENT-02 | 이벤트 처리 결과 조회 | `POST /api/v1/events/status` | E |
| LOG-01 | 행동 기록 목록 | `GET /api/v1/access-events` | W/E |
| LOG-02 | 행동 기록 상세 | `GET /api/v1/access-events/{event_id}` | W/E |
| STAT-01 | 기본 통계 | `GET /api/v1/statistics/summary` | W/E |
| STAT-02 | 대상별 통계 | `GET /api/v1/statistics/targets` | W/E |
| DASH-01 | 대시보드 | `GET /api/v1/dashboard` | W/E |
| STAT-03 | 시간대 접근 패턴 [선택] | `GET /api/v1/statistics/hourly` | W/E |
| IMPORT-01 | 가져오기 요청 생성 | `POST /api/v1/guest-imports` | E |
| IMPORT-02 | 가져오기 항목 내용 전송 | `PUT /api/v1/guest-imports/{batch_id}/items/{source_item_id}` | E |
| IMPORT-03 | 가져오기 결과 | `GET /api/v1/guest-imports/{batch_id}` | W/E |
| IMPORT-04 | 내 가져오기 요청 조회 | `GET /api/v1/guest-imports` | E |

### AUTH-01 · CSRF 준비

`GET /api/v1/auth/csrf`

| 항목 | 명세 |
|---|---|
| 호출·인증 | P/W |
| 요청 | 본문 없음 |
| 성공 응답 | 200 {csrf_token:string}; 익명 세션 쿠키 발급 가능 |
| 주요 오류 | 503 |
| 처리·화면 규칙 | Web 로그인 전 호출. 이후 변경 요청의 X-CSRF-Token 헤더에 넣는다. |

공통 인증·소유권·서버 오류는 2절을 함께 적용한다.

### AUTH-02 · 회원가입

`POST /api/v1/auth/signup`

| 항목 | 명세 |
|---|---|
| 호출·인증 | P+CSRF |
| 요청 | {email:string, password:string, display_name?:string} |
| 성공 응답 | 201 User |
| 주요 오류 | 422 VALIDATION_FAILED; 409 EMAIL_ALREADY_REGISTERED; 429 |
| 처리·화면 규칙 | email 최대254자·형식 검증·정규화, password 12~128자 제안(공백 임의 제거 금지), display_name 1~50자. 가입 후 로그인 화면으로 이동. 자동 로그인 없음. |

공통 인증·소유권·서버 오류는 2절을 함께 적용한다.

### AUTH-03 · 로그인

`POST /api/v1/auth/login`

| 항목 | 명세 |
|---|---|
| 호출·인증 | P+CSRF |
| 요청 | {email:string, password:string} |
| 성공 응답 | 200 User + 세션 쿠키 |
| 주요 오류 | 401 INVALID_CREDENTIALS; 429 |
| 처리·화면 규칙 | 실패 메시지는 이메일 존재 여부를 구분하지 않는다. 성공 시 세션 ID 회전. Extension 연결은 별도 승인·교환한다. |

공통 인증·소유권·서버 오류는 2절을 함께 적용한다.

### AUTH-04 · 내 계정

`GET /api/v1/auth/me`

| 항목 | 명세 |
|---|---|
| 호출·인증 | W/E |
| 요청 | 본문 없음 |
| 성공 응답 | 200 User |
| 주요 오류 | 401 |
| 처리·화면 규칙 | 화면의 현재 연결 계정 표시 기준. |

공통 인증·소유권·서버 오류는 2절을 함께 적용한다.

### AUTH-05 · Web 로그아웃

`POST /api/v1/auth/logout`

| 항목 | 명세 |
|---|---|
| 호출·인증 | W |
| 요청 | 본문 없음 |
| 성공 응답 | 204 |
| 주요 오류 | 403 CSRF_FAILED |
| 처리·화면 규칙 | Web 세션 폐기와 쿠키 제거. 이미 종료된 세션의 재요청은 204. 활성 Extension 세션의 제한은 유지된다. |

공통 인증·소유권·서버 오류는 2절을 함께 적용한다.

### EXT-01 · 설치 등록

`POST /api/v1/extension-installations`

| 항목 | 명세 |
|---|---|
| 호출·인증 | P |
| 요청 | {executor_id:UUID, extension_version:string} |
| 성공 응답 | 201 {executor_id, installation_token:string} |
| 주요 오류 | 409 INSTALLATION_EXISTS; 429 |
| 처리·화면 규칙 | 처음 설치 시 한 번. installation_token은 연결 요청에만 사용하고 계정 데이터 접근은 불가. 기존 executor_id 재등록 시 증명을 새로 발급하지 않는다. 재설치·증명 유실은 새 UUID. |

공통 인증·소유권·서버 오류는 2절을 함께 적용한다.

### EXT-02 · Web 연결 요청 준비

`POST /api/v1/extension-link-requests`

| 항목 | 명세 |
|---|---|
| 호출·인증 | 설치 증명 |
| 요청 | Authorization: Installation <installation_token>; {executor_id, code_challenge:string, code_challenge_method:"S256", state:string, callback_uri:string} |
| 성공 응답 | 201 {link_request_id:UUID, authorization_url:string, expires_at:UTC} |
| 주요 오류 | 403 INSTALLATION_MISMATCH; 422 INVALID_CALLBACK |
| 처리·화면 규칙 | state는 128비트 이상 무작위 값 제안. 요청 제한 적용. authorization_url의 호스트는 사전 설정한 FOCURVE Web. verifier는 보내지 않는다. |

공통 인증·소유권·서버 오류는 2절을 함께 적용한다.

### EXT-03 · 계정 연결 승인

`POST /api/v1/extension-link-requests/{link_request_id}/approval`

| 항목 | 명세 |
|---|---|
| 호출·인증 | W |
| 요청 | {approve:boolean} |
| 성공 응답 | 200 {approved:boolean, redirect_url:string 또는 null} |
| 주요 오류 | 409 ACTIVE_SESSION_EXISTS; 410 LINK_EXPIRED |
| 처리·화면 규칙 | 로그인 화면 이후 연결할 계정·확장 설치를 확인하고 명시 승인. 승인 시 코드와 state를 callback으로 전달, 거절 시 요청 종료. 기존 연결 계정의 활성 세션·결과 미확정 가져오기는 먼저 해소한다. |

공통 인증·소유권·서버 오류는 2절을 함께 적용한다.

### EXT-04 · 연결 코드 교환

`POST /api/v1/extension-tokens`

| 항목 | 명세 |
|---|---|
| 호출·인증 | 설치 증명 |
| 요청 | {link_request_id:UUID, code:string, code_verifier:string, callback_uri:string} |
| 성공 응답 | 200 {access_token, refresh_token, token_type:"Bearer", expires_in:900, executor_id, user:User} |
| 주요 오류 | 400 INVALID_GRANT; 410 LINK_EXPIRED |
| 처리·화면 규칙 | 설치 증명 헤더도 필수. challenge·코드·callback·설치·계정을 검증하고 코드 1회 소비. 인증 응답 Cache-Control:no-store. 응답 유실 후 코드 재사용은 실패하므로 연결 절차 재시작. |

공통 인증·소유권·서버 오류는 2절을 함께 적용한다.

### EXT-05 · Extension 토큰 갱신

`POST /api/v1/extension-tokens/refresh`

| 항목 | 명세 |
|---|---|
| 호출·인증 | refresh 자격 |
| 요청 | {refresh_token:string} |
| 성공 응답 | 200 {access_token, refresh_token, token_type:"Bearer", expires_in:900} |
| 주요 오류 | 401 INVALID_REFRESH_TOKEN |
| 처리·화면 규칙 | 토큰 회전. 동시에 여러 갱신을 보내지 않는다. 이미 사용한 refresh 토큰 재사용 탐지 시 토큰 계열 폐기·재연결. |

공통 인증·소유권·서버 오류는 2절을 함께 적용한다.

### EXT-06 · Extension 연결 해제

`DELETE /api/v1/extension-installations/{executor_id}/connection`

| 항목 | 명세 |
|---|---|
| 호출·인증 | W/E |
| 요청 | 본문 없음 |
| 성공 응답 | 204 |
| 주요 오류 | 409 ACTIVE_SESSION_EXISTS; 409 IMPORT_IN_PROGRESS |
| 처리·화면 규칙 | 활성 제한 해제 확인 후 토큰 폐기, current_user_id 해제. 로컬 비회원 원본과 이전 계정 미전송 자료를 임의 삭제하거나 새 계정으로 보내지 않는다. |

공통 인증·소유권·서버 오류는 2절을 함께 적용한다.

### EXT-07 · 연결 설치 목록

`GET /api/v1/extension-installations`

| 항목 | 명세 |
|---|---|
| 호출·인증 | W/E |
| 요청 | 본문 없음 |
| 성공 응답 | 200 {items:[{executor_id,extension_version,last_seen_at,connection_status:ONLINE/STALE}]} |
| 주요 오류 | 401 |
| 처리·화면 규칙 | 현재 계정 연결 설치만. last_seen_at이 30초 이내면 ONLINE 제안. ONLINE은 실제 차단 성공을 뜻하지 않는다. |

공통 인증·소유권·서버 오류는 2절을 함께 적용한다.

### SITE-01 · 사이트 목록

`GET /api/v1/sites`

| 항목 | 명세 |
|---|---|
| 호출·인증 | W/E |
| 요청 | query: purpose?, access_policy?, q?:1~100자, cursor?, limit? |
| 성공 응답 | 200 {items:Site[],next_cursor:string 또는 null,has_more:boolean} |
| 주요 오류 | 400; 422 |
| 처리·화면 규칙 | deleted_at이 없는 본인 사이트. created_at DESC,site_id DESC. 검색은 이름·호스트. |

공통 인증·소유권·서버 오류는 2절을 함께 적용한다.

### SITE-02 · 사이트 단건

`GET /api/v1/sites/{site_id}`

| 항목 | 명세 |
|---|---|
| 호출·인증 | W/E |
| 요청 | path site_id:십진문자열 |
| 성공 응답 | 200 Site + ETag |
| 주요 오류 | 404 |
| 처리·화면 규칙 | 편집창이 최신 version을 받는 경로. |

공통 인증·소유권·서버 오류는 2절을 함께 적용한다.

### SITE-03 · 사이트 등록

`POST /api/v1/sites`

| 항목 | 명세 |
|---|---|
| 호출·인증 | W/E |
| 요청 | SiteInput; Idempotency-Key 필수 |
| 성공 응답 | 201 Site + ETag |
| 주요 오류 | 409 SITE_SCOPE_CONFLICT; 422 |
| 처리·화면 규칙 | 사이트 검증을 원자적으로 수행. 저장 후 다음 세션부터 적용. |

공통 인증·소유권·서버 오류는 2절을 함께 적용한다.

### SITE-04 · 사이트 수정

`PATCH /api/v1/sites/{site_id}`

| 항목 | 명세 |
|---|---|
| 호출·인증 | W/E |
| 요청 | SiteInput 필드 중 변경분, 1개 이상; If-Match 필수 |
| 성공 응답 | 200 Site + ETag |
| 주요 오류 | 404; 412; 428; 409 SITE_SCOPE_CONFLICT; 422 |
| 처리·화면 규칙 | feature_policies를 보내면 배열 전체 교체. null로 지우기 불가. 누락 필드는 유지. 정책 변경과 version 증가는 한 트랜잭션. |

공통 인증·소유권·서버 오류는 2절을 함께 적용한다.

### SITE-05 · 사이트 삭제

`DELETE /api/v1/sites/{site_id}`

| 항목 | 명세 |
|---|---|
| 호출·인증 | W/E |
| 요청 | If-Match 필수 |
| 성공 응답 | 204 |
| 주요 오류 | 404; 412; 428 |
| 처리·화면 규칙 | 논리 삭제. 과거 기록·스냅샷은 유지. 응답 유실 뒤 재요청의 404는 목록 확인 후 이미 삭제됨으로 처리 가능. |

공통 인증·소유권·서버 오류는 2절을 함께 적용한다.

### SESSION-01 · 집중 시작 요청

`POST /api/v1/sessions`

| 항목 | 명세 |
|---|---|
| 호출·인증 | W/E |
| 요청 | {executor_id:UUID,duration_minutes:integer}; Idempotency-Key 필수 |
| 성공 응답 | 202 {session:Session,snapshot:Snapshot} |
| 주요 오류 | 409 ACTIVE_SESSION_EXISTS; 409 EXECUTOR_UNAVAILABLE; 422 |
| 처리·화면 규칙 | 시간 1~180분. 연결·최근 실행 주체 확인 후 세션 UUID와 스냅샷, APPLY_POLICY 명령을 한 트랜잭션 생성. 응답 execution_status=STARTING. 관리 대상 0개 허용. 현재 설정 읽기와 스냅샷 생성은 일관된 트랜잭션으로 수행. |

공통 인증·소유권·서버 오류는 2절을 함께 적용한다.

### SESSION-02 · 현재 세션

`GET /api/v1/sessions/current`

| 항목 | 명세 |
|---|---|
| 호출·인증 | W/E |
| 요청 | 본문 없음 |
| 성공 응답 | 200 {session:Session 또는 null} |
| 주요 오류 | 401 |
| 처리·화면 규칙 | 현재 계정의 활성 세션 1개. 없음은 정상 null. 서버 연결 실패를 null로 바꾸지 않는다. |

공통 인증·소유권·서버 오류는 2절을 함께 적용한다.

### SESSION-03 · 세션 목록

`GET /api/v1/sessions`

| 항목 | 명세 |
|---|---|
| 호출·인증 | W/E |
| 요청 | query: from_date?,to_date?,cursor?,limit? |
| 성공 응답 | 200 {items:Session[],next_cursor,has_more} |
| 주요 오류 | 422 |
| 처리·화면 규칙 | 기본 최근30일, started_at DESC(미시작은 created_at),session_id DESC. 가져오기 STAGING은 제외. |

공통 인증·소유권·서버 오류는 2절을 함께 적용한다.

### SESSION-04 · 세션 단건

`GET /api/v1/sessions/{session_id}`

| 항목 | 명세 |
|---|---|
| 호출·인증 | W/E |
| 요청 | query executor_id:UUID 필수 |
| 성공 응답 | 200 Session |
| 주요 오류 | 404 |
| 처리·화면 규칙 | 원본 UUID와 executor_id, 인증 계정으로 소유권 확인. 시작·종료 요청 이후 상태 확인에 사용. |

공통 인증·소유권·서버 오류는 2절을 함께 적용한다.

### SESSION-05 · 세션 정책 조회

`GET /api/v1/sessions/{session_id}/policy`

| 항목 | 명세 |
|---|---|
| 호출·인증 | W/E |
| 요청 | query executor_id:UUID 필수 |
| 성공 응답 | 200 Snapshot |
| 주요 오류 | 404 |
| 처리·화면 규칙 | 현재 사이트 목록과 별개인 불변 스냅샷. E 호출은 실행 설치 일치 필수. |

공통 인증·소유권·서버 오류는 2절을 함께 적용한다.

### SESSION-06 · 직접 종료 요청

`POST /api/v1/sessions/{session_id}/end`

| 항목 | 명세 |
|---|---|
| 호출·인증 | W/E |
| 요청 | {executor_id:UUID}; Idempotency-Key 필수 |
| 성공 응답 | 202 {session:Session}; 이미 해제 확인된 종결 세션이면 200 {session:Session} |
| 주요 오류 | 409 SESSION_NOT_STARTED; 404 |
| 처리·화면 규칙 | RUNNING/ENDING에서 RELEASE_POLICY 명령 생성 또는 재사용. UNKNOWN은 해제 명령을 보내고 확인 대기. STARTING 취소는 v1 미지원으로 화면 시작 확인 중 종료 버튼 비활성. 서버가 성공 응답해도 실제 해제는 Extension 확인 필요. |

공통 인증·소유권·서버 오류는 2절을 함께 적용한다.

### EXEC-01 · 실행 명령 조회

`GET /api/v1/executors/{executor_id}/commands`

| 항목 | 명세 |
|---|---|
| 호출·인증 | E |
| 요청 | query limit?:1~20 기본10 |
| 성공 응답 | 200 {items:Command[],server_time:UTC,next_poll_after_seconds:integer} |
| 주요 오류 | 403 EXECUTOR_MISMATCH |
| 처리·화면 규칙 | 활성/화면 열림 5초, 유휴30초 제안. 실행 가능한 미완료 명령을 created_at 순으로 재전달. 조회가 곧 실행 완료는 아님. 접속 시 last_seen_at 갱신. 장시간 미접속도 시작 명령을 자동 성공·실패 처리하지 않는다. |

공통 인증·소유권·서버 오류는 2절을 함께 적용한다.

### EXEC-02 · 실패·복구 상태 보고

`POST /api/v1/executors/{executor_id}/reports`

| 항목 | 명세 |
|---|---|
| 호출·인증 | E |
| 요청 | ExecutionReport; Idempotency-Key=report_id |
| 성공 응답 | 200 {report_id,session:Session} |
| 주요 오류 | 409 REPORT_CONFLICT; 422; 404 |
| 처리·화면 규칙 | APPLY_FAILED는 rollback_confirmed=true일 때만 START_FAILED. RELEASE_FAILED는 ENDING. STATE_UNKNOWN은 UNKNOWN. RECONCILED_RELEASED는 미시작 상태의 잔여 제한 해제 확인용이며 START_FAILED로 종결; 실제 시작된 세션의 종료는 SESSION_ENDED로 보고한다. report_id 중복 저장 방지. |

공통 인증·소유권·서버 오류는 2절을 함께 적용한다.

### EVENT-01 · 이벤트 묶음 전송

`POST /api/v1/events/batch`

| 항목 | 명세 |
|---|---|
| 호출·인증 | E |
| 요청 | {events:Event[]}; 1~100개, 본문 최대256KiB 제안 |
| 성공 응답 | 200 {results:EventResult[],server_time:UTC} |
| 주요 오류 | 401/403 전체 거절; 400 전체 JSON 오류; 413 크기초과 |
| 처리·화면 규칙 | 각 이벤트 결과가 영속 저장된 뒤 응답. 같은 묶음의 일부가 거절돼도 나머지 처리. 이벤트마다 동결한 event_id·원본 본문 사용. event_id 충돌은 기존 소유자의 내용을 노출하지 않고 해당 항목 REJECTED. |

공통 인증·소유권·서버 오류는 2절을 함께 적용한다.

### EVENT-02 · 이벤트 처리 결과 조회

`POST /api/v1/events/status`

| 항목 | 명세 |
|---|---|
| 호출·인증 | E |
| 요청 | {event_ids:UUID[]}; 1~100개 |
| 성공 응답 | 200 {results:EventResult[]} |
| 주요 오류 | 422 |
| 처리·화면 규칙 | 본인 설치·계정의 수신 결과만. 미수신 또는 조회 권한 없는 ID는 NOT_FOUND. 응답 유실·PENDING_VERIFICATION 해소 확인에 사용. |

공통 인증·소유권·서버 오류는 2절을 함께 적용한다.

### LOG-01 · 행동 기록 목록

`GET /api/v1/access-events`

| 항목 | 명세 |
|---|---|
| 호출·인증 | W/E |
| 요청 | query: from_date?,to_date?,executor_id?,session_id?,target_key?,event_type?,repeat_only?:boolean,cursor?,limit? |
| 성공 응답 | 200 {items:AccessView[],next_cursor,has_more,aggregation_status} |
| 주요 오류 | 422 |
| 처리·화면 규칙 | 기본 최근30일. session_id 지정 시 executor_id도 필수. occurred_at DESC,event_id DESC. 유효 접근만 조회, 각 이벤트 유형은 접근3종만. 미수신·보류를 0회로 단정하지 않는다. |

공통 인증·소유권·서버 오류는 2절을 함께 적용한다.

### LOG-02 · 행동 기록 상세

`GET /api/v1/access-events/{event_id}`

| 항목 | 명세 |
|---|---|
| 호출·인증 | W/E |
| 요청 | path event_id:UUID |
| 성공 응답 | 200 {event:AccessView,policy:SnapshotSite,session:Session,aggregation_status} |
| 주요 오류 | 404 |
| 처리·화면 규칙 | 당시 정책을 반환. 원본 URL·제목은 저장·응답하지 않는다. 반복 대상 순번은 늦은 이벤트 반영 후 달라질 수 있다. |

공통 인증·소유권·서버 오류는 2절을 함께 적용한다.

### STAT-01 · 기본 통계

`GET /api/v1/statistics/summary`

| 항목 | 명세 |
|---|---|
| 호출·인증 | W/E |
| 요청 | query from_date?,to_date?; 기본 오늘 |
| 성공 응답 | 200 Summary |
| 주요 오류 | 422 |
| 처리·화면 규칙 | 수신 자료 기준. 전체접근=사이트차단+기록+기능차단. 반복은 부분집합으로 더하지 않는다. |

공통 인증·소유권·서버 오류는 2절을 함께 적용한다.

### STAT-02 · 대상별 통계

`GET /api/v1/statistics/targets`

| 항목 | 명세 |
|---|---|
| 호출·인증 | W/E |
| 요청 | query from_date?,to_date?,cursor?,limit?; 기본 오늘 |
| 성공 응답 | 200 {items:[{target_key,target_host,feature_code,total_access,repeat_access}],next_cursor,has_more,aggregation_status} |
| 주요 오류 | 422 |
| 처리·화면 규칙 | repeat_access DESC,total_access DESC,target_key ASC. 과거 스냅샷 대상으로 묶고 현재 사이트 삭제로 통계가 사라지지 않게 한다. |

공통 인증·소유권·서버 오류는 2절을 함께 적용한다.

### DASH-01 · 대시보드

`GET /api/v1/dashboard`

| 항목 | 명세 |
|---|---|
| 호출·인증 | W/E |
| 요청 | query date?:YYYY-MM-DD; 기본 KST 오늘 |
| 성공 응답 | 200 {date,timezone,summary:Summary,site_classification:{focus,distraction,general},top_repeated_targets:TargetSummary[],recent_activity:AccessView[],current_session:Session 또는 null,extensions:{hourly_pattern:UNAVAILABLE/AVAILABLE,ai_feedback:UNAVAILABLE}} |
| 주요 오류 | 422 |
| 처리·화면 규칙 | 반복대상 상위5개·최근접근5개, 분류현황은 현재 삭제되지 않은 설정 수. AI 문구를 임의 생성하지 않는다. 시간대 패턴은 선택 API가 활성화됐을 때 따로 호출. |

공통 인증·소유권·서버 오류는 2절을 함께 적용한다.

### STAT-03 · 시간대 접근 패턴 [선택]

`GET /api/v1/statistics/hourly`

| 항목 | 명세 |
|---|---|
| 호출·인증 | W/E |
| 요청 | query date?:YYYY-MM-DD; 기본 오늘 |
| 성공 응답 | 200 {date,timezone:"Asia/Seoul",hours:[{hour:0~23,total_access,blocked_site_access,recorded_access,blocked_feature_access,repeat_access}],aggregation_status} |
| 주요 오류 | 404 FEATURE_NOT_ENABLED; 422 |
| 처리·화면 규칙 | 24개 시간 버킷. 자료 조회 성공 후 비어 있는 버킷만0. 학기 내 추가 기능 OPTION-08이며 기본 통계와 분리한다. |

공통 인증·소유권·서버 오류는 2절을 함께 적용한다.

### IMPORT-01 · 가져오기 요청 생성

`POST /api/v1/guest-imports`

| 항목 | 명세 |
|---|---|
| 호출·인증 | E |
| 요청 | {request_id:UUID,executor_id:UUID,items:[{item_type:SITE/SESSION,source_item_id:UUID}]}; 1~100개; Idempotency-Key=request_id |
| 성공 응답 | 202 ImportBatch |
| 주요 오류 | 409 ORIGINAL_ALREADY_CLAIMED; 422 |
| 처리·화면 규칙 | 항목 선택 및 계정 확인 후 호출. Server가 요청 대상 계정을 고정하며 원본 소유권 claim을 원자적으로 등록. 여기서는 원본 내용 없이 목록만 등록하고 PENDING 상태. 같은 계정·동일 원본은 기존 결과 재사용. |

공통 인증·소유권·서버 오류는 2절을 함께 적용한다.

### IMPORT-02 · 가져오기 항목 내용 전송

`PUT /api/v1/guest-imports/{batch_id}/items/{source_item_id}`

| 항목 | 명세 |
|---|---|
| 호출·인증 | E |
| 요청 | SiteImport 또는 SessionImport; 최대5MiB/항목 제안 |
| 성공 응답 | 202 ImportResult |
| 주요 오류 | 409 IMPORT_PAYLOAD_CONFLICT; 413; 422 |
| 처리·화면 규칙 | batch에 선언한 항목·설치·계정 일치. 같은 항목 같은 내용은 재처리하지 않음. 다른 내용으로 덮어쓰기 금지. 세션은 스냅샷·생명주기·모든 이벤트 검증 완료 후 한번에 공개. 큰 항목은 로컬 원본을 유지하고 용량 안내; 자동 분할 프로토콜은 후속 확장. |

공통 인증·소유권·서버 오류는 2절을 함께 적용한다.

### IMPORT-03 · 가져오기 결과

`GET /api/v1/guest-imports/{batch_id}`

| 항목 | 명세 |
|---|---|
| 호출·인증 | W/E |
| 요청 | 본문 없음 |
| 성공 응답 | 200 ImportBatch |
| 주요 오류 | 404 |
| 처리·화면 규칙 | 항목별 상태·이유와 대상 계정을 반환하는 user_id:십진문자열 필드를 함께 포함. 성공 확인 이후만 로컬 가져옴 표시. 화면 닫기는 취소 아님. 미전송 항목이 24시간 경과하면 FAILED/UPLOAD_TIMEOUT 제안. |

공통 인증·소유권·서버 오류는 2절을 함께 적용한다.

### IMPORT-04 · 내 가져오기 요청 조회

`GET /api/v1/guest-imports`

| 항목 | 명세 |
|---|---|
| 호출·인증 | E |
| 요청 | query cursor?,limit? |
| 성공 응답 | 200 {items:ImportBatch[],next_cursor,has_more} |
| 주요 오류 | 401 |
| 처리·화면 규칙 | 동일 계정·설치의 요청만 requested_at DESC,batch_id DESC. 생성 응답 유실은 같은 request_id 재요청으로 복구할 수 있다. |

공통 인증·소유권·서버 오류는 2절을 함께 적용한다.

## 6. 이벤트 계약과 수신 처리

Event는 Event Schema v1.0을 그대로 사용한다. DB 컬럼 trigger_type과 달리 요청 JSON 필드는 `data.trigger`다.

| 범위 | 필수 필드 |
|---|---|
| Event 공통 | schema_version:"1.0", event_id:UUID, event_type, session_id:UUID, executor_id:UUID, policy_snapshot_id:UUID, occurred_at:UTC, data:object |
| 접근 3종 data | attempt_id:UUID, access_seq:정수≥1, target_kind:SITE/FEATURE, target_host:정규화호스트≤253자, feature_code:null/YOUTUBE_SHORTS, trigger:NAVIGATION/RELOAD/IN_PAGE_NAVIGATION/BLOCKED_ACTION |
| SESSION_STARTED data | started_at:UTC(occurred_at과 동일), planned_end_at:UTC(started_at+집중시간) |
| SESSION_ENDED data | ended_at:UTC, end_reason:TIME_EXPIRED/USER_ENDED/INTERRUPTED, policy_released_at:UTC(occurred_at과 동일), end_time_basis:EXACT/LAST_CONFIRMED, last_access_seq:정수≥0 |

접근 유형은 BLOCKED_SITE_ACCESS / RECORDED_ACCESS / BLOCKED_FEATURE_ACCESS. FEATURE는 youtube.com+YOUTUBE_SHORTS 조합이다. target_host는 실제 URL 호스트가 아니라 매칭된 정책 대상 호스트다. user_id·is_repeat·target_access_index·target_key는 클라이언트 입력 불가.

EventResult = {event_id:UUID, status:ACCEPTED/DUPLICATE/PENDING_VERIFICATION/REJECTED/NOT_FOUND, canonical_event_id:UUID 또는 null, error_code:string 또는 null, received_at:UTC 또는 null, aggregation_status:CURRENT_RECEIVED/COMPLETE/REVIEW_REQUIRED, retryable:boolean}.

- ACCEPTED: 검증·확정 저장. DUPLICATE: 동일 내용 재전송 또는 의미가 같은 관찰 중복. 대표 이벤트가 확정된 경우만 전송 대기 해제 가능.
- PENDING_VERIFICATION: 수신 저장만 됨. 시작·정책 확인 후 자동 재검증. 클라이언트는 원본 유지하고 status 조회한다.
- REJECTED: 기존 데이터를 변경하지 않고 원본·오류를 보존한다. 자동 성공 처리하지 않는다.
- NOT_FOUND: status 조회에서만 사용. 동일 원본으로 다시 전송한다.
- 같은 event_id라도 본문이 다르면 EVENT_ID_CONFLICT. 다른 계정의 같은 ID 여부나 내용을 응답하지 않는다.
- 같은 세션·access_seq가 서로 다른 접근이면 ACCESS_SEQUENCE_CONFLICT. 같은 세션·attempt_id·target_key가 같고 의미가 같으면 대표로 연결한다. 의미가 다르면 ATTEMPT_CONFLICT.
- 중복 관찰이 다른 access_seq를 발급한 경우, 해당 순번도 대표 이벤트 연결로 해소한 수신 이력을 유지한다. 마지막 순번까지 ACCEPTED/확정 DUPLICATE로 해소됐는지 검사하며 단순 확정 행 개수로 완료를 판단하지 않는다.
- 순번 빈칸이나 거절이 있으면 PARTIAL 또는 REVIEW_REQUIRED. last_access_seq=0이면 접근 없음, null이면 미확인이다.
- 시간 검증: 미래 시각이 server_time보다 120초 초과하면 PENDING_VERIFICATION/CLOCK_SKEW 제안. 시작 이전·논리 종료 이후 접근은 TIME_OUTSIDE_SESSION으로 보류·검토한다. 정상 범위는 [started_at,ended_at). 수신 지연만으로 거절하지 않는다.
- TIME_EXPIRED의 ended_at은 예정 시각과 같아야 한다. 시작·종료 이벤트와 접근의 시각을 함께 검증하고 원본 시각을 수신 시각으로 덮어쓰지 않는다.
- 검증 오류 EVENT_SCHEMA_UNSUPPORTED / INVALID_EVENT_COMBINATION / POLICY_MISMATCH는 해당 이벤트 REJECTED로 반환한다.
- Server 처리 순서와 무관하게 종료 상태가 시작 이벤트 때문에 회귀하지 않는다. 시작 자료 없이 접근만 도착하면 보류하며 종료·시작이 모이면 재검증한다.

## 7. 실행 명령 전달·중복·복구

1. Web/Extension이 SESSION-01을 호출한다. Server는 세션·스냅샷·명령을 저장한 뒤 202를 반환한다.
2. Extension의 백그라운드 실행부가 EXEC-01을 호출한다. 팝업이 닫혀도 실행 상태는 로컬에서 관리한다.
3. command_id와 실행 상태를 로컬에 영속 저장한다. 재전달된 명령이 이미 실행됐으면 정책을 다시 적용하거나 타이머를 초기화하지 않는다.
4. 실제 적용·시작 보관 성공 후 SESSION_STARTED를 EVENT-01로 보낸다. 같은 이벤트를 재사용한다.
5. Server는 검증된 SESSION_STARTED로 해당 APPLY_POLICY 명령을 완료 처리한다. 실패는 EXEC-02로 보고한다.
6. 직접 종료 요청은 RELEASE_POLICY를 전달한다. 시간 만료는 명령·네트워크 응답을 기다리지 않고 로컬에서 해제한다.
7. 해제 확인 후 SESSION_ENDED를 전송한다. Server는 RELEASE_POLICY 명령이 있으면 완료 처리한다. 명령보다 먼저 로컬 종료가 됐으면 해당 명령은 실행 불필요로 종결한다.

명령 조회 후 HTTP 응답 유실, 결과 보고 유실은 같은 명령·세션·이벤트 ID로 회복한다. 명령의 시간이 오래됐다는 이유만으로 다른 실행자에게 새 세션을 시작시키지 않는다. 30초 이상 실행 확인이 없으면 Web에 '적용 상태 확인 중'을 표시하고 조회는 백오프한다. 타임아웃은 차단 실패의 증거가 아니다.

5초/30초 조회는 설계 제안이며 MV3에서 백그라운드 타이머가 항상 이 주기를 보장한다고 가정하지 않는다. 실행부 재기동·알람·브라우저 수명주기 PoC에서 실제 지연을 검증한 뒤 주기 조회나 다른 전달 방식을 확정한다. Server 전송방식과 무관하게 시간 만료 해제는 Extension 책임이다.

## 8. 비회원 자료 가져오기 데이터

비회원 사이트·세션 실행 자체는 Server API가 아니다. 서버에 보내는 것은 로그인·명시 선택 후 가져오기뿐이다.

SiteImport = {item_type:"SITE", source_item_id:UUID, site:SiteInput}.

SessionImport = {item_type:"SESSION", source_item_id:UUID, session:{session_id:UUID,executor_id:UUID,duration_minutes:integer}, snapshot:Snapshot, events:Event[]}.

SESSION 항목의 source_item_id는 원본 session_id와 동일하다. 요청의 executor_id, 세션, 이벤트, 스냅샷 관계가 모두 맞아야 한다. SESSION_STARTED와 SESSION_ENDED를 각 1개 포함하고 access_seq 1~last_access_seq가 유효 이벤트 또는 대표 중복 연결로 모두 해소되어야 한다. 진행 중 세션은 IMPORT_SESSION_ACTIVE로 거절한다. JSON에 원본 보관 만료일을 넣어 Server 정책을 우회하지 않는다. 보관 대상 선정은 Extension이 확정 보관 정책에 따라 수행한다.

- 원본 사이트 충돌: SKIPPED/SITE_SCOPE_CONFLICT. 회원 설정 유지.
- 자료 누락: FAILED/IMPORT_INCOMPLETE_SESSION. 해당 세션은 회원 조회·통계에서 보이지 않는다.
- 가져오기 전용 이벤트는 EVENT-01 DIRECT로 먼저 보내지 않는다. IMPORT-02의 staging 경로에서 처리한다.
- 원본 세션을 현재 설정이나 가져온 날짜로 다시 작성하지 않는다.
- 같은 원본·같은 계정·같은 내용은 기존 성공 결과를 반환한다. 같은 원본을 다른 계정에 가져오면 ORIGINAL_ALREADY_CLAIMED. 실패한 원본의 계정 claim을 해제하는 정책은 별도 검토 대상으로 유지한다.
- FAILED 항목의 일시 처리 오류 재시도는 같은 내용의 PUT으로 가능하다. 검증 실패를 수정하려면 별도 수정본 수용 정책이 필요하므로 기존 원본을 임의 변경해 자동 재시도하지 않는다.
- SUCCEEDED: 모두 성공(이미 반영된 동일 자료 포함). PARTIAL: 성공·실패·건너뜀 혼재 또는 건너뜀만 존재. FAILED: 모든 항목 실패. PENDING/PROCESSING이 하나라도 남으면 아직 종결 상태가 아니다.
- 성공 원본 즉시 삭제 여부·보관 일수는 미확정. 이번 API 성공 응답은 로컬 삭제 명령이 아니다.

## 9. 조회 응답과 예시

Summary = {from_date,to_date,timezone,focus_duration_seconds,completed_session_count,interrupted_duration_seconds,total_access,blocked_site_access,recorded_access,blocked_feature_access,repeat_access,aggregation_status,as_of}.

숫자는 모두 0 이상 정수, timezone은 Asia/Seoul, as_of는 UTC. TargetSummary는 {target_key,target_host,feature_code,total_access,repeat_access}. ACCESS 횟수는 조회에 포함된 확정 유효 접근 기준이며 집계 상태를 같이 표시한다. 부분 수신에서도 유효 수치는 반환하지만 '최종 전체 횟수'로 표시하지 않는다.

### 사이트 등록 요청

POST /api/v1/sites, Idempotency-Key: 81111111-1111-4111-8111-111111111111

```json
{"url":"https://instagram.com","display_name":"Instagram","include_subdomains":true,"purpose":"DISTRACTION","access_policy":"BLOCK","feature_policies":[]}
```

### 사이트 등록 성공 · 201

```json
{"site_id":"101","canonical_host":"instagram.com","display_name":"Instagram","include_subdomains":true,"purpose":"DISTRACTION","access_policy":"BLOCK","feature_policies":[],"version":1,"created_at":"2026-09-20T04:00:00.000Z","updated_at":"2026-09-20T04:00:00.000Z"}
```

### 세션 시작 요청

POST /api/v1/sessions, Idempotency-Key: 82222222-2222-4222-8222-222222222222

```json
{"executor_id":"10000000-0000-4000-8000-000000000001","duration_minutes":30}
```

### 시작 요청 접수 · 202

```json
{"session":{"session_id":"20000000-0000-4000-8000-000000000002","executor_id":"10000000-0000-4000-8000-000000000001","policy_snapshot_id":"30000000-0000-4000-8000-000000000003","origin":"MEMBER","execution_status":"STARTING","record_status":"PENDING","duration_minutes":30,"started_at":null,"planned_end_at":null,"ended_at":null,"policy_released_at":null,"end_reason":null,"end_time_basis":null,"last_access_seq":null,"version":1,"last_error_code":null},"snapshot":{"policy_snapshot_id":"30000000-0000-4000-8000-000000000003","format_version":"1.0","created_at":"2026-09-20T04:59:58.000Z","sites":[{"canonical_host":"instagram.com","display_name":"Instagram","include_subdomains":true,"purpose":"DISTRACTION","access_policy":"BLOCK","feature_policies":[]}]}}
```

### 실제 적용 성공 후 전송

```json
{"events":[{"schema_version":"1.0","event_id":"40000000-0000-4000-8000-000000000004","event_type":"SESSION_STARTED","session_id":"20000000-0000-4000-8000-000000000002","executor_id":"10000000-0000-4000-8000-000000000001","policy_snapshot_id":"30000000-0000-4000-8000-000000000003","occurred_at":"2026-09-20T05:00:00.000Z","data":{"started_at":"2026-09-20T05:00:00.000Z","planned_end_at":"2026-09-20T05:30:00.000Z"}}]}
```

### 접근 전송

```json
{"events":[{"schema_version":"1.0","event_id":"50000000-0000-4000-8000-000000000005","event_type":"BLOCKED_SITE_ACCESS","session_id":"20000000-0000-4000-8000-000000000002","executor_id":"10000000-0000-4000-8000-000000000001","policy_snapshot_id":"30000000-0000-4000-8000-000000000003","occurred_at":"2026-09-20T05:03:00.000Z","data":{"attempt_id":"60000000-0000-4000-8000-000000000006","access_seq":1,"target_kind":"SITE","target_host":"instagram.com","feature_code":null,"trigger":"NAVIGATION"}}]}
```

### 이벤트 수신 결과 · 200

```json
{"results":[{"event_id":"50000000-0000-4000-8000-000000000005","status":"ACCEPTED","canonical_event_id":null,"error_code":null,"received_at":"2026-09-20T05:03:01.000Z","aggregation_status":"CURRENT_RECEIVED","retryable":false}],"server_time":"2026-09-20T05:03:01.000Z"}
```

### 기본 통계 성공 · 기존 화면용 하루 전체 예시

앞의 단일 사이트 API 예시와 별개로, 기존 Low-Fi의 두 세션·여러 사이트를 포함한 하루 전체 fixture다.

```json
{"from_date":"2026-09-20","to_date":"2026-09-20","timezone":"Asia/Seoul","focus_duration_seconds":5400,"completed_session_count":2,"interrupted_duration_seconds":0,"total_access":12,"blocked_site_access":6,"recorded_access":4,"blocked_feature_access":2,"repeat_access":4,"aggregation_status":"COMPLETE","as_of":"2026-09-20T06:00:00.000Z"}
```

## 10. 화면·기능 연결표

| 화면/기능 | 사용 API |
|---|---|
| LOGIN-01 / SIGNUP-01 | AUTH-01~04, Extension 진입이면 EXT-02~04 |
| DASH-01 | DASH-01, 필요 시 SESSION-02, 선택 STAT-03 |
| SITE-01 / SITE-02 | SITE-01~05 |
| SESSION-01 | EXT-07, SESSION-01~06 |
| LOG-01 / LOG-02 | LOG-01~02, SESSION-03 |
| STAT-01 | STAT-01~02, 선택 STAT-03 |
| SETTING-01 | AUTH-04~05, EXT-06~07; 사이트 정책 조정은 SITE API 재사용 |
| EXT-01 회원 팝업 | EXT 연결 API, SITE API, SESSION API, EXEC API, EVENT API, IMPORT API |
| EXT-01 비회원 팝업 | Extension 로컬 계약. 가져오기 동의 후만 IMPORT API |
| EXT-02 차단 안내 | 로컬 표시. 사용자 접근 Event는 Extension 실행부가 전송 |
| AI 피드백 영역 | 학기 내 추가 기능 OPTION-12. 입력·처리·결과·오류·동의 계약은 DEC-11·DEC-14에서 확정 |

## 11. ERD에 보완해야 할 저장 구조

ERD의 12개 테이블은 기본 업무 데이터 설계안이다. 인증·명령·멱등 지원 구조와 추가 기능 데이터 계약은 구현 전 확정해야 한다.

| 보완 항목 | 최소 저장·제약 |
|---|---|
| Web 인증 세션 | 세션 ID, 계정, 만료, 폐기. Spring 세션 저장 방식 결정 |
| 설치 증명 | 설치 ID, 증명 토큰 해시, 만료/폐기. installation_token 원문 저장 금지 |
| 연결 요청·인증 코드 | 요청 ID, 설치 ID, 승인 계정, challenge, state, callback, 코드 해시, 만료, 소비 여부 |
| Extension 토큰 | 토큰 계열 ID, 계정·설치 결박, refresh 해시, 만료·회전·폐기 |
| 실행 명령 | command_id PK, 세션·설치 FK, 종류, 불변 payload, 생성·완료·오류 상태. 조회 후에도 완료 전까지 유지 |
| 실행 보고 | report_id 유일, 본문 해시, 세션·명령·설치, 관찰 시각, 상태·복구 여부 |
| 멱등 요청 | 계정+API+키 유일, 본문 해시, 생성 자원/응답, 상태·만료. DB 변경과 같은 트랜잭션 또는 복구 가능한 방식 |
| 가져오기 원본 claim | executor_id+item_type+source_item_id 유일, 대상 계정, 상태. 사이트 자료의 배치 간·계정 간 중복을 막는 데 기존 items 유일키만으로 부족 |
| 가져오기 내용 | 항목 본문 해시·staging 내용 또는 별도 저장 참조. 실패·재시도와 세션 단위 공개 보장 |
| 스냅샷·이벤트 원본 소유권 | 원본 ID 충돌을 검사하고 타 계정 재매핑 금지. guest snapshot ID도 소유권 결박 |

한 계정 활성 세션 제한과 한 설치 실행 제한은 트랜잭션 잠금으로 직렬화한다. 단순 UNIQUE(user_id,execution_status)는 여러 활성 상태 사이의 중복을 막지 못한다. 소프트 삭제 사이트 등록/범위 중복 판단도 동시에 두 요청이 통과하지 않도록 잠금·제약을 함께 설계한다.

## 12. 개발 전 검토 항목

| 확인할 사항 | 본 문서의 기준 |
|---|---|
| 인증 방식 | 쿠키/Extension 토큰/PKCE 연결 제안. 실제 callback과 배포 Origin 확정 필요 |
| 소셜 로그인 | 지원 제공자 미확정. 이메일 로그인 계약 먼저 작성했으며 소셜 API 완료로 표시하지 않음 |
| 비회원 보관·원본 처리 | 90일/30일 문서 불일치와 성공 원본 삭제 방식 합의 필요 |
| 시간·용량·주기 | 1~180분, 100개/256KiB 이벤트, 5MiB 가져오기, 5/30초 조회 등 초기 제안 검증 |
| 원본 claim 실패 해제 | 실패 후 다른 계정 가져오기 허용 정책 결정 필요 |
| STARTING 취소 | 현재 초안은 시작 확인 전 종료 비활성. 필요 시 취소 명령·경합 규칙 추가 |
| 회원 계정 변경 | 활성 실행·미확정 이전 해소, 이전 계정 미전송 대기 유지 정책과 UI 일치 확인 |
| 통계 범위 | 시간대 패턴은 선택, AI 자동 피드백 계약은 미포함 |
| 구현 산출물 | 승인된 계약을 OpenAPI YAML과 Spring DTO로 옮기고 Postman으로 실제 응답 검증 |

## 13. API 통합 검증 시나리오

1. 비회원 시작은 로그인·Server 호출 없이 가능하다. 로그인만으로 로컬 자료가 업로드되지 않는다.
2. 코드 탈취·틀린 verifier·다른 callback·다른 설치는 연결 실패한다. 사용한 코드는 재사용 불가.
3. 타 회원 site/session/event/import ID로 조회·수정이 불가능하다.
4. 시작 중복 클릭·응답 유실은 같은 세션·명령을 가리킨다. 이미 실행된 명령 재전달로 타이머가 초기화되지 않는다.
5. 적용 실패 복구 확인 전 새 세션이 시작되지 않는다. 세션 상태 조회 실패가 시작 가능 상태로 바뀌지 않는다.
6. 사이트 수정의 오래된 version은 412. 다음 세션 설정만 바뀌고 현재 정책 스냅샷은 동일하다.
7. 동일 이벤트 재전송, 중복 관찰, 순번 충돌이 전체 접근을 부풀리지 않는다.
8. seq=8이 먼저 도착하고 seq=1/4가 늦게 오면 대상 순번·반복을 다시 계산한다. 자정 경계도 세션 기준 반복을 유지한다.
9. 종료 이벤트 선도착·시작 이벤트 후도착에서도 종료 상태가 RUNNING으로 회귀하지 않는다.
10. 해제는 Server 업로드 실패에도 진행된다. Web 종료 접수만으로 해제 완료를 표시하지 않는다.
11. 가져오기 일부 실패·응답 유실·재요청에도 세션이 반쪽 공개되거나 두 번 집계되지 않는다.
12. 예시 하루 전체는 12=6+4+2, 반복4는 부분집합, 완료 집중90분. 조회 실패와 진짜0건은 다른 화면이다.

작성 검증: 문서의 JSON 예시 구문과 API ID·method/path 중복을 검사했다. 실제 Server 구현, 인증 연동, HTTP 요청 테스트는 아직 수행하지 않았다.
