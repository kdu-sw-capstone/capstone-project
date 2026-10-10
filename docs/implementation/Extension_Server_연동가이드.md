# Extension ↔ Server 연동 가이드

## A. 연동 기준

- 저장소: https://github.com/kdu-sw-capstone/capstone-project
- 브랜치: `codex/server-event12-integration`, 대상 `develop`.
- 현재 기준 Server 코드 커밋: `b05d9a095b229efe310d5c791189eefb0d30300b` (이전 c2a8ad0은 과거 검증 이력)
- PR: https://github.com/kdu-sw-capstone/capstone-project/pull/18
- 최신 문서 커밋은 위 코드 커밋 이후일 수 있다. 아래 SHA는 실제 테스트한 제품 코드를 고정한다.

```bash
git fetch origin codex/server-event12-integration
git switch --detach b05d9a095b229efe310d5c791189eefb0d30300b
# 문서 최신본까지 필요하면 별도 작업 복사본에서 원격 브랜치로 전환한다.
```

PR17(e79ef3034e3951a20c735de714debab830006284)은 별도의 Extension Core 변경이다. 이번 PR은 그 제품 코드를 복사·병합하지 않는다. PR17의74개 mock 시험은 본 Server와의 실제 Chrome 연동 증거가 아니다.

## B. 실제 API와 인증

일반 개발 Base URL `http://127.0.0.1:8080/api/v1`; 기존 수정본 `http://127.0.0.1:8082/api/v1`(Web localhost5175/DB3308). localhost는 호출하는 PC 자신이다. 팀원 PC에서 다훈 PC의 localhost를 호출할 수 없다. 우선 각자 로컬 Server를 실행한다. 외부 공개/CORS 완화는 이번에 설정하지 않았다.

W=HttpOnly Web 쿠키. W 변경 요청은 허용 Origin + X-CSRF-Token 필요. E=해당 설치/회원의 `Authorization: Bearer <access_token>`. P=설치 증명 `X-Installation-Proof`. 토큰은 파일·콘솔·PR·일반 Web storage에 노출하지 않는다.

|메서드 / 경로|인증·목적|상태|
|---|---|---|
|GET /auth/csrf, POST /auth/login, GET /auth/me, POST /auth/logout|W 초기화/이메일 로그인/조회/로그아웃|구현·Server 자동 검증. 로그인은 이메일 인증된 계정 필요|
|POST /auth/email/signup-code-requests, /auth/email/signup-code-verifications, /auth/signup|W, 6자리 번호→proof→가입|구현. 실제메일은 발신 환경 필요. 비회원 업로드와 무관|
|POST /extension-installations|executor_id/client_version→installation_proof|구현·합성 설치 자동 검증|
|POST /extension-link-requests, /{id}/evidence, /{id}/claim|P, PKCE/state/정지 상태 증거/승인 코드 조회|구현·합성 검증. 실제 Core의 관찰·통합 미검증|
|POST /extension-link-requests/{id}/approval|W 사용자 명시 승인, Bearer 단독 승인 거절|구현. evidence 이후 Web /#link 화면|
|POST /extension-tokens, /extension-tokens/refresh|P+단일사용code+PKCE 교환 / refresh rotation|구현·자동 검증. 실제 설치 연결 미검증|
|GET /extension-installations; DELETE /extension-installations/{executor}/connection|W 설치목록 / 명시해제|구현. 활성실행 해제증거 조건 유지|
|POST /sessions|W/E, Idempotency-Key, executor_id/duration_minutes|구현. **현재1.2 신규발급 OFF→503**|
|GET /sessions, /sessions/current, /sessions/{uuid}, /sessions/{uuid}/policy, /operations/{id}|W/E 소유권 검사; policy는 저장된 frozen JSON|구현·자동/DB 검증. 독립 snapshot-create API 없음|
|POST /sessions/{uuid}/end|W/E+Idempotency-Key|구현. 요청 접수는 해제완료가 아님|
|GET /executors/{executor}/commands|E. heartbeat, 현재 revision PENDING 명령|구현·모의 적용 검증. 실제 Chrome 실행 미검증|
|POST /executors/{executor}/reports, /reconcile|E. 실행 관찰·interval·journal 대조|구현·합성/DB 검증. Core journal 연동 필요|
|POST /events/batch, /events/status|E.1.1/1.2 저장/재전송조회|구현·**실제HTTP+MySQL 시험**. 설치/APPLIED evidence는 합성|
|GET /access-events, /access-events/{event_id}, /statistics/summary, /statistics/targets, /dashboard|W/E 자기회원 기록·집계|구현. 실제 Extension 수집 아님. 사이트별 집중시간 null 유지|

컨트롤러 경로 원문: backend/src/main/java/kr/ac/kdu/focurve/{auth,execution,events,records}/*Controller.java. GET /executors/.../snapshot 등 별도 API를 만들지 않는다. 명령의 snapshot 및 GET /sessions/{uuid}/policy 사용.

## C. 실제 계약 JSON 예시

예시는 합성 구조이며 실제 값/토큰이 아니다. UUID·회원ID·시각·revision은 서버가 발급한 세션/설치/명령에 맞춰 교체한다. 임의 UUID만 바꿔 전송하면404/403/422로 거절되는 것이 정상이다.

Event1.2: 부모 RECORD 정책을 적용받는 CHZZK 접근. payload target_key는 접두사 없는 actual hostname이다.

```json
{"events":[{"schema_version":"1.2","event_id":"11111111-1111-4111-8111-111111111111","executor_id":"22222222-2222-4222-8222-222222222222","session_id":"33333333-3333-4333-8333-333333333333","policy_snapshot_id":"44444444-4444-4444-8444-444444444444","event_type":"RECORDED_ACCESS","occurred_at":"2026-10-09T08:00:01Z","local_seq":1,"payload":{"access_seq":1,"navigation_id":"55555555-5555-4555-8555-555555555555","target_kind":"SITE","target_host":"chzzk.naver.com","target_key":"chzzk.naver.com","matched_policy_host":"naver.com","reason":"RECORD","blocked_reasons":[]}}]}
```

응답: `{"items":[{"event_id":"...","status":"ACCEPTED"}]}`. 동일 ID/동일 envelope 재전송은 `DUPLICATE`; 내용이 다르면 item `REJECTED/error=EVENT_CONFLICT`. item별 transaction. HTTP200이어도 모든 items 상태를 확인한다. 한 batch 최대100개/1MiB. status 요청 `{"event_ids":["..."]}`→items event_id/status (ACCEPTED/PENDING_DEPENDENCY/NOT_RECEIVED). 다른 owner/설치 자료 접근 금지.

사이트 BLOCK은 event_type BLOCKED_SITE_ACCESS/reason USER_SITE/blocked_reasons [USER_SITE]. 사이트 ALLOW라도 전역 제한이 적용되면 같은 type에 reason ADULT_DOMAIN 또는 KEYWORD. 복수 이유는 [ADULT_DOMAIN,KEYWORD]처럼 저장하며 대표reason은 USER_SITE→ADULT_DOMAIN→KEYWORD→FEATURE 순서 첫 항목. 실제 감지된 이유만 전송. 미등록 사이트에 global만 매칭되면 matched_policy_host:null. enabled/각 exceptions는 frozen content_policy와 일치해야 한다. 여러 detector를 별도 접근으로 중복 발행하지 않는다. 확정 차단을 더 많은 감지 대기 때문에 지연하지 않는다.

Snapshot1.2 (저장/명령에서 반환되는 구조):

```json
{"policy_snapshot_id":"44444444-4444-4444-8444-444444444444","format_version":"1.2","site_match_strategy":"MOST_SPECIFIC_HOST","owner_user_id":"1","executor_id":"22222222-2222-4222-8222-222222222222","created_at":"2026-10-09T08:00:00Z","source_version":1,"sites":[{"site_id":"1","canonical_host":"naver.com","display_name":"NAVER","include_subdomains":true,"purpose":"DISTRACTION","access_policy":"RECORD","feature_policies":[],"version":1,"created_at":"2026-10-09T08:00:00Z","updated_at":"2026-10-09T08:00:00Z"}],"content_policy":{"version":1,"keywords":{"enabled":false,"rules":[],"exceptions":[]},"adult_domains":{"enabled":false,"custom_hosts":[],"exceptions":[]},"image_blur":{"enabled":false,"sensitivity":"MEDIUM","strength":"MEDIUM"},"usage_tracking":{"enabled":false}}}
```

Snapshot1.1은 기존 저장 JSON을 그대로 해석하며 새 발급·재저장용이 아니다. 빈 정책 예시:

```json
{"policy_snapshot_id":"44444444-4444-4444-8444-444444444444","format_version":"1.1","owner_user_id":"1","executor_id":"22222222-2222-4222-8222-222222222222","created_at":"2026-10-09T08:00:00Z","source_version":1,"sites":[],"content_policy":{"version":1,"keywords":{"enabled":false,"rules":[],"exceptions":[]},"adult_domains":{"enabled":false,"custom_hosts":[],"exceptions":[]},"image_blur":{"enabled":false,"sensitivity":"MEDIUM","strength":"MEDIUM"},"usage_tracking":{"enabled":false}}}
```

1.2 whole-validator는 필수 자료형·UUID·호스트·열거값을 검사한다. Core는 전체 필수 규칙 적용 후에만 APPLIED를 보고하며 미지원·불량·부분 적용 실패를 정상 처리하지 않는다. 기존1.1을1.2로 다시 쓰지 않는다.

Web 인증 예시: 먼저 GET /auth/csrf로 쿠키와 csrf_token을 얻고, 허용 Origin/X-CSRF-Token을 포함해 POST /auth/login `{"email":"<verified-test-email>","password":"<private>"}`. 응답은 AuthService.user의 회원 객체이며 인증은 Set-Cookie로 발급된다. 사용자 비밀번호·로그인 세션을 E token으로 취급하지 않는다. 가입번호 proof 및 소셜 동의는 별도 기존 흐름을 사용한다.

아래는 MemberLinks/ExecutionController의 구현된 요청이다. 비밀값은 placeholder다.

```json
{"executor_id":"22222222-2222-4222-8222-222222222222","client_version":"ext-development"}
```

install 응답 executor_id/installation_proof. proof는 새 설치 secret이며 client_version만으로 호환성을 증명하지 않는다.

```json
{"executor_id":"22222222-2222-4222-8222-222222222222","code_challenge":"<S256-base64url-43chars>","state":"<random-state>","callback_uri":"<exact-allowlisted-uri>"}
```

link 응답 link_request_id/verification_uri/expires_at(5분). Core가 자신의 실제 상태를 읽고 P로 evidence 전송:

```json
{"observation_id":"66666666-6666-4666-8666-666666666666","link_request_id":"77777777-7777-4777-8777-777777777777","owner_context":"GUEST:22222222-2222-4222-8222-222222222222","transition":"LINK_PENDING","active_session_id":null,"owned_rule_ids":[],"pending_action_count":0,"observed_at":"2026-10-09T08:00:00Z"}
```

관찰시각30초 이내/미래5초 이내, 실제 비회원실행 해제된 idle만 승인 가능. Web W POST approval `{"approve":true}`. 승인 결과는 EXTENSION_POLL. P claim `{"state":"<same-state>"}`→status PENDING 또는 APPROVED/code/state. P POST /extension-tokens `{"link_request_id":"...","code":"<one-time-code>","code_verifier":"<original-PKCE-verifier>"}`→access_token/refresh_token/expires_in900. refresh `{"refresh_token":"<private>"}`. 회원이메일 일치 자동연결과 무관한 명시 설치 승인이다.

GET commands 응답은 commands 배열, next_cursor 빈 문자열, server_time UTC 필드를 포함한다; command 구조:

```json
{"command_id":"88888888-8888-4888-8888-888888888888","session_id":"33333333-3333-4333-8333-333333333333","executor_id":"22222222-2222-4222-8222-222222222222","type":"APPLY_POLICY","desired_revision":1,"created_at":"2026-10-09T08:00:00Z","execute_before":"2026-10-09T08:01:00Z","snapshot":"<위 Snapshot 객체; 실제로는 문자열이 아닌 객체>","reason":"MANUAL"}
```

RELEASE_POLICY 명령은 snapshot 없음/execute_before:null. 위 snapshot placeholder는 설명용이며 그대로 호출하지 않는다.

실제적용 후 report (서버접수만으로 만들어 보내면 안 됨):

```json
{"report_id":"99999999-9999-4999-8999-999999999999","command_id":"88888888-8888-4888-8888-888888888888","session_id":"33333333-3333-4333-8333-333333333333","executor_id":"22222222-2222-4222-8222-222222222222","desired_revision":1,"result":"APPLIED","observed_at":"2026-10-09T08:00:00Z","intervals":[{"interval_id":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","kind":"RUN","start_at":"2026-10-09T08:00:00Z","quality":"CONFIRMED"}]}
```

종료 report는 서버 RELEASE_POLICY의 command_id/revision, result RELEASED, 동일 interval_id/start_at+end_at+일치하는duration_ms/quality. 선택필드 error_code/rollback_confirmed/local_action_seq는 아래11번 계약 참조. 동일 report ID/내용은 DUPLICATE; 다른 내용409 REPORT_CONFLICT. 오래된 revision 보고는 감사자료와 현재상태를 구분하며 현재의도를 덮어쓰지 않는다.

reconcile 요청: snapshot/event와 별개 journal format1.1 유지.

```json
{"journal_summary":{"format_version":"1.1","session_id":"33333333-3333-4333-8333-333333333333","known_revision":1,"last_report_id":null,"last_access_seq":0,"last_local_seq":0,"observed_at":"2026-10-09T08:00:00Z","observed_state":"UNCONFIRMED","final":false},"local_actions":[]}
```

local END/EXPIRED 보고와 response 판단은 기존 [11번 계약](../design/02_시스템_테크설계/11_인증_실행복구_가져오기_연결계약.md)과 ExecutionService.reconcile을 기준으로 구현한다. journal1.2 API를 임의로 만들지 않는다.

오류 envelope `{"error":{"code":"SNAPSHOT_COMPATIBILITY_REQUIRED","message":"SNAPSHOT_COMPATIBILITY_REQUIRED","field_errors":[],"retryable":true},"request_id":"<UUID>"}`. 실제 retryable은 ApiErrors/호출처 기준이며 모든409/422를 자동재시도하지 않는다. HTTP401 INVALID_TOKEN,403 EXECUTOR_MISMATCH,409 EVENT_CONFLICT/REPORT_CONFLICT/RECONCILE_REQUIRED,422 INVALID_SCHEMA/INVALID_TARGET_KEY/POLICY_MISMATCH/INVALID_SNAPSHOT,503 EVENT_RETRY_REQUIRED 또는 SNAPSHOT_COMPATIBILITY_REQUIRED를 구분한다.

## D. 로컬 실행·환경

Java21 JDK, Node24.19.x, MySQL8.4, Docker Desktop. 새 개발환경은 `.env.example`를 개인 .env에 복사하고 비밀값을 직접 설정한다. 기존 .env는 덮어쓰지 않는다. Compose 신규기동은 새 개인 환경에서만, 기존 환경은 올바른 프로젝트의 기존컨테이너를 사용한다. docker compose down -v/Flyway clean 사용 금지.

```bash
docker compose up -d --wait mysql
bash scripts/prepare-test-db.sh
bash scripts/with-env.sh bash backend/mvnw -f backend/pom.xml -B -ntp verify
bash scripts/with-env.sh java -jar backend/target/focurve-server-0.0.1-SNAPSHOT.jar
```

prepare-test-db는 기본 Compose의 focurve_test 생성/그 DB 권한용이며 이미 관리된 다른 DB에 임의 적용하지 않는다. PowerShell에서 환경을 이미 안전하게 로드했다면 `backend\mvnw.cmd -f backend/pom.xml -B -ntp verify`와 `java -jar backend/target/focurve-server-0.0.1-SNAPSHOT.jar`를 사용한다. 개발 DB와 TEST_DB_URL은 반드시 분리한다. `npm ci; npm test; npm run build; npm run dev`는 frontend에서 순서대로 실행. 기본 Web5173→Server8080 proxy.

필수 이름: DB_URL/TEST_DB_URL/DB_USERNAME/DB_PASSWORD; MYSQL_ROOT_PASSWORD/MYSQL_PORT(Compose); SERVER_ADDRESS/SERVER_PORT; AUTH_COOKIE_SECURE/ALLOWED_ORIGINS/PUBLIC_URL/SESSION_HOURS; EXTENSION_CALLBACK_URIS. 메일 MAIL_MODE/HOST/PORT/FROM/USERNAME/PASSWORD/TLS/SSL, OAuth GOOGLE_CLIENT_ID/SECRET,KAKAO_CLIENT_ID/SECRET,OAUTH_CALLBACK_BASE는 필요기능에만 설정한다. Mailpit1025/8025, 검토환경1026/8026은 구분. Web VITE_DEV_MAILBOX_URL/VITE_MAIL_MODE/VITE_EXTENSION_ID는 공개설정뿐이다.

**SNAPSHOT_1_2_ENABLED=false**, SNAPSHOT_1_2_VERIFIED_EXECUTORS 빈 값 유지. 실제Server/Core 호환성 시험 완료 후 검증된 executor UUID만 허용목록에 지정. 런타임 wildcard는 허용되지 않는다(test profile만허용). 별도 합의된 테스트환경에서만 gate-on 시험을 하며 기존 실행차단을 성공으로 우회하지 않는다.

Extension manifest host_permissions는 로컬 Server URL, 외부 Web origin 연결은 정확한 개발Origin/Extension ID로 제한해야 한다. 일반 Web 쿠키/CSRF 흐름과 E Bearer를 혼용하지 않는다. callback URI는 MemberLinks의 정확한 allowlist에 등록한다. 실제 external message approval/import가 PR17에 없으므로 링크·명령 단계만 Server 존재로 제품 완료를 선언하지 않는다.

테스트 회원은 Web의 정상 이메일 가입/인증 또는 별도 자동 test profile fixture로 준비. 개인 계정/DB 자료를 fixtures로 복사하지 않는다. 설치 증명·실제 APPLIED 관찰 없이는 운영회원 세션/이벤트를 임의 생성하지 않는다.

## E. 구형 이벤트·조회

1.1 target_key=SITE:actual-host 또는 FEATURE:actual-host:feature_code. 1.1에는 새 matched_policy_host/blocked_reasons를 보내면 거절. 등록된 부모호스트를 actual-host 대신 보내는 Core 구형 구현은 계약 불일치이며 기존1.1 호환성 허용과 다르다.

1.2 target_key=actual normalized hostname. matched_policy_host는 필수 key/값 null허용, blocked_reasons는 필수 배열. snapshot과 type/reason 일치 필수. www 및 subdomain 유지, port/path/query 집계 제외. repeat_count0/1/2, 기존 target_access_index1/2/3와 is_repeat 유지. 동일ID envelope 변경으로 추가 사유 보강 금지.

기존JSON/DB행 재작성 없음. 구형 receipt payload가 없으면 matched_policy_host:null/blocked_reasons는 기존primary reason에서 조회용으로 보완. legacy {} receipt 조회500 회귀 수정. 1.1 반복 partition은 기존target_key,1.2는actual-host. 새 조회필드는 additive이며 오래된 정확한 match를 추정해 채우지 않는다.

## F. 연동 검증 순서

1. 지정 SHA checkout→환경 로드→106개 기존 Backend+새 실제HTTP1개, Frontend104개·build 실행. 새 Event12HttpIntegrationTest는 임의포트 실제Tomcat HTTP+실제MySQL이며 설치/APPLIED는 합성이다. Chrome 결과 아님.
2. 정상회원 로그인→Core 설치등록/PKCE/evidence→Web명시승인→claim/token→commands조회 heartbeat. 실제설치 proof는 로그에 남기지 않음.
3. 별도 통합환경에서 해당 executor의1.2호환성 먼저확인→게이트허용→POST sessions(Idempotency-Key)→APPLY_POLICY→전체검증/실제적용→journal→APPLIED report→RUNNING 조회.
4. 실제 CHZZK 접근→Event1.2 batch→items ACCEPTED 확인→동일 envelope재전송 DUPLICATE→DB receipt/access_events1행 확인→Web기록/통계 actual-host·matched-host·repeat_count 대조.
5. SQL은 테스트DB에서 `SELECT schema_version,status,JSON_EXTRACT(payload,'$.payload.target_key'),JSON_EXTRACT(payload,'$.payload.matched_policy_host'),JSON_EXTRACT(payload,'$.payload.blocked_reasons') FROM event_receipts WHERE event_id=?` 및 access_events의동일ID행수 확인. owner/executor/session/snapshot을 함께 대조, 전체사용자자료출력 금지.
6. naver/www.naver/chzzk/www.youtube/example.org 경계·most-specific·global독립예외·복수사유1건; 잘못된host/seq/version/owner·중복변조·동시요청·오래된명령·적용실패·release·reconcile·재시작/절전. 최신SHA/Chrome버전/OS·DB/API증거를 남긴다.

즉시 시작 가능: Server 실행·정상회원인증·설치/링크/토큰 API 구현·Event1.2 HTTP fixture시험. 차단: PR17 회원 실행루프/새이벤트형식/Core↔Content message/실제Chrome증거. Core↔Content 접근식별자·늦은사유annotation·capability handshake 세부 구현은 별도 조율. global 설정 저장/감지 실제경로, OAuth외부 실패9개/STAT02시간배분3개는 미완료 유지. 사이트별 집중시간을 임의배분하지 않는다.

## 2026-10-09 PR18 로컬 리뷰 수정본 주의

PR head 7dd7abce2bdb7f2d3dfda99c9874c4efb9cd041d 이후 미커밋 로컬 수정이며 아직 GitHub에는 반영하지 않았다. FEATURE를 포함한1.2 복수사유의 타입은 BLOCKED_FEATURE_ACCESS/FEATURE이고 대표 reason은 우선순위에 따라 KEYWORD/ADULT_DOMAIN/USER_SITE일 수 있다. FEATURE 없는 차단에는 SITE 타입을 사용한다. Core·Content는 최종 한 접근의 이미 확인된 이유와 feature 문맥을 함께 전달해야 한다. 1.1 변경 없음. [변경된 계약](../design/02_시스템_테크설계/12_정책계약_이벤트12_호환성게이트.md) 및 [로컬 재검증](PR18_리뷰수정_재검증_2026-10-09.md) 참조. 실제Chrome/제품Extension 연결 성공이 아니며 신규Snapshot1.2 OFF를 유지한다.

## D-01~D-10 확정 정책·아직 없는 실행 경로

[최종공용계약](../design/02_시스템_테크설계/FOCURVE_D01_D10_최종공용계약.md)이 신규 정책 원본이다. 이 문서의 API/JSON은 b05d9a0 현행 코드 기준이며 새로운 자동복구/안전정수 상한 구현 완료를 의미하지 않는다. Journal1.1 END-only를 새 재개 요청으로 사용하지 않는다.

- 신규1.2 Snapshot은 member/guest 문맥별 전체 필드, 숫자 version1..9007199254740991. Server 현재 signed64 범위 및 Core guest 필드/파서는 보완 필요. 정상1.1원문·자료보존.
- APPLY 명령에 duration은 현재 없다. GET session의 duration/executor/snapshot/revision 확인은 가능하지만 누적시간 자동복구 API는 없다. 현재 start+duration planned_end를 새 복구 마감으로 사용하지 않는다.
- 실제 Core 회원 네트워크 어댑터 미구현, Content message/priority/freeze 미합의. 실제 Chrome·회원 통합 NOT RUN.
- D09 code/refresh 응답유실은 자동 token 재발급 API 없음. 현행 claim 재조회·유효 token의 E /auth/me만 구분, 오류시 인증복구/사용자 조치. 비밀은background접근통제,refresh직렬화.
- batch item별 상태를 확인하고 PENDING은저장 추적/최종 확인, REJECTED격리, NOT_RECEIVED같은원문 재송신. HTTP200을성공일괄ACK하지 않음.
- 신규 Snapshot1.2 기본OFF/exact검증설치만허용. 자동handshake 없음. 기존세션조회/보고/해제는gate와별개.

최신 정책 문서는 로컬 미커밋 상태이며 원격 b05d9a0의 정책 구현이 바뀐 것은 아니다. 제품 구현·테스트·문서 갱신 PR은 별도 요청 후 진행한다.

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


## 2026-10-09 RELEASED 보고 순서 의존성 로컬 수정·검증

독립 재리뷰의 High R-D03-01(당시 RELEASED 선행 409/잠금 유지)을 후속 로컬 수정했다. 과거 판정·이력은 보존한다. 기준 HEAD b05d9a095b229efe310d5c791189eefb0d30300b, codex/server-event12-integration, 김다훈 Server/API/DB 담당. 제품 변경은 ExecutionService의 RELEASED 구간 복구 및 실제 HTTP 회귀 테스트이며 새 상태/API/마이그레이션은 없다.

- 인증된 설치·소유자·세션·현재 명령/revision 검증을 통과한 RELEASED의 닫힌 RUN 증거를, 선행 APPLY 보고가 없고 DB 구간도 없을 때 원래 APPLY 명령·frozen Snapshot에 결속해 복구한다. APPLY 발급 시각(기존 60초 허용)·실행 기한·시작/종료/관측 시각·duration·interval ID를 검증한다. 기존 구간은 덮어쓰지 않고 알려진 RUN의 누락/열린 증거·잘못된 원문은 거절한다. 해제 확인은 인증된 Core의 RELEASED/observed_at 보고 계약이며 Server가 Chrome DNR을 직접 관측한 의미가 아니다.
- 동일 트랜잭션에서 구간 종료·확인된 시간 집계·ENDED 또는 START_FAILED·명령 ACK·잠금 해제를 수행한다. 늦은 구 revision APPLY는 감사 기록만 남기며 종료 상태/시간/버전을 되돌리지 않는다. 동일 report_id/동일 원문은 DUPLICATE, 다른 원문은 REPORT_CONFLICT이다.
- Codex 실행: Backend138/138·패키징, Frontend114/114·빌드 PASS. 추가 HTTP/MySQL 테스트10개(복수 하위 사례 포함), 별도 독립 HTTP 재현 probe PASS. 격리 MySQL8.4.8 127.0.0.1:60046/focurve_contract_test, 합성 회원/설치/보고 사용. 실제 Chrome·회원 Core/Content 통합 NOT RUN. 응답 유실은 클라이언트가 첫 결과를 무시하고 재전송한 모의 사례이며 Server 프로세스 강제 중단은 NOT RUN.
- MAX/MAX+1/Long.MAX_VALUE 버전 원본·frozen Snapshot 보존 및 잠금 해제 확인. 운영 Snapshot1.2 기본 OFF 유지(테스트 프로필만 ON). D01/D05 자동복구 전체 미구현 경계 유지. AC-SESSION-02/03/04의 -01/-03 중 Server 합성 보고 부분만 검증했으며 실제 적용/해제·전체 AC·MVP 완료로 승격하지 않는다.
- 증거: C:\Users\dahun\capstone-project\.reviews\pr18-20261009\PR18_RELEASED_보고순서_수정검증보고서.md 및 released-order 로그. 후속: 독립 재리뷰, 실제 Core 해제 증거·역순/재전송 통합. 이번 Commit/Push/PR 업데이트/병합 없음.


## 2026-10-10 Core 작업 브랜치 연동 현황

최신 공유 develop b45a680a9f2262bd9725619e9643df3bb9b91164를 feature/extension-core-ext-02에 merge. 위 Server 과거 SHA/실행 수는 당시 이력이다. Core 신규Event1.2 key는 접두사 없는 실제host, matched_policy_host/blocked_reasons 포함. 제품 member 전송adapter를 Node에서 실제HTTP·MySQL에 연결한 합성 회귀1건 및 기존Server Event1.2 HTTP2건 통과. Backend 이번전체139/139, Extension모의96/96, UI17항목. 인증/APPLIED는 합성, 실제Chrome회원연결/context/명령loop는 미연결. 일반Snapshot1.2 신규발급OFF, test process에만 합성executor 허용. 구형원본무변환·개별ACK 및 status/동일원본 재시도·미검증/다음행동/재실행명령은 [Core단위검증](evidence/EXT-02-2026-10-10-event12.md) 참조.


## 2026-10-10 D09 Core 인증 연결 준비

제품background 설치등록/proof·PKCE evidence/claim·tokens/me·직렬refresh 및기존popup연결을구현했다. 실제HTTP/MySQL에서합성Web회원·storage·Chromeidle관측으로제품JS경로1/1통과. Extension모의114/114·UI19·Backend140/140. 회원Chrome은Server/Web/테스트회원/실제callback허용설정준비후별도검증한다. 회원명령/report/event 실제제품연결은후속, Snapshot1.2운영OFF/담당변경없음. 응답유실의추가상태/재발급API는임의생성하지 않았다. [실행명령/최신식별값/Chrome준비/미검증](evidence/EXT-02-2026-10-10-member-auth.md).
