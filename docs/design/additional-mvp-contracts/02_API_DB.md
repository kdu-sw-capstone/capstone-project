# API·DB 상세 계약

## HTTP 공통

`api.json`의 25개 operation이 경로·method·auth·요청/응답 Schema·query·HTTP status·precondition의 원본이다. 기존 `/api/v1/sites`, sessions, events 원문은 변경하지 않는다. 신규 `/api/v1/amvp/*`는 **현재 미구현**이다. 모든 필드는 명시적이며 JSON unknown field 거절. Schema default로 저장/권한을 임의 채우지 않는다. 생성 버전 1, 증가 최대 9007199254740991; overflow 422 VERSION_LIMIT. 정수에 문자열/float/boolean coercion 금지. UTC는 millisecond Z, IANA zone은 검증된 tzdb revision과 함께 저장한다.

W는 기존 focurve_session HttpOnly session·exact Origin·mutation CSRF, E는 검증된 installation bearer와 실제 executor 결속이다. `user_id`는 인증에서 도출하며 request body로 받지 않는다. guest는 로컬 저장이 기본이며 회원 API 자동 업로드 금지. 설치 토큰의 기존 회전·폐기·소유권 gate를 그대로 적용한다. W_OR_E도 서로 다른 검증을 생략하지 않는다. E의 account total 조회 금지; 다른 owner/executor resource는 일반적인 404로 존재 유출 방지.

조건부 mutation은 auth→capability→installation/owner lock→기존 idempotency 조회→새 요청 precondition→검증→단일 transaction 저장/outbox 순서다. 동일 요청의 기존 Receipt는 현재 version 검사보다 먼저 반환한다. capability negotiation 자체는 아직 capability가 없으므로 인증/검증된 artifact registry로 부트스트랩한다. GET은 consistent read만 수행한다. If-None-Match:* 생성, If-Match:"n" 수정/삭제, 없으면428, stale412, 같은 idempotency key+같은 canonical request면 기존 결과, 다른 본문409. 삭제는 tombstone+다음 runtime revision 발행, 실제 해제 전202 RELEASE_PENDING. 기존 focus frozen 설정은 다음 세션까지 남는다.

UUID idempotency key는 owner+operation route에 scope한다. 기존 상세 설계의 transport response cache 7일과 영속 원장 중복 키를 구분한다. 7일 후 응답 본문 cache는 정리 가능하지만 원장/operation identity의 충돌 검사는 데이터 수명 동안 보존한다. 중복 원장 키를 TTL로 삭제해 재집계하지 않는다. 네트워크 재요청은 transport request ID만 바꾸고 immutable item/operation ID·hash는 동일하다. batch 최대100건/1MiB, 초과413, malformed400, 의미검증422. status조회에서 unknown ID는 NOT_RECEIVED이고 재전송 허용, ACCEPTED/DUPLICATE만 outbox 완료, PENDING_DEPENDENCY는 보존, REJECTED는 격리. HTTP200 자체는 적용/전체 접수 증거가 아니다.

## resource별 저장·반환

- CFG-01~04: CONTENT/SITE_TIME/FOCUS_SCHEDULE/CADENCE tagged config, owner/executor에 귀속. GET cursor는 owner·filter·sort(id ASC)에 결속하고 limit 기본50/max100; opaque cursor 위조·filter변경400. null next_cursor이면 has_more=false. payload의 policy_id는 config_id와 일치, 저장 version은 서버가 발급하고 site는 동일 owner 기존 sites row만 참조한다.
- CAP-01/PKG-01/FOC-01: capability receipt는 서버 검증 artifact+지원 feature/stream/version의 교집합이다. 단순 client echo는 권한이 아니다. FocusAttachmentRequest에는 executor/focus_ref/config_revision만 전달; 서버가 기존 Snapshot raw hash·동일 owner/session·frozen revision을 확인해 attachment/hash/receipt를 발급한다. 활성 미지원 옵션 하나라도 있으면 발급/실행 거절, 비활성 옵션 때문에 기존 필수 MVP를 막지 않는다.
- USG/RPT/EVT: 인증된 installation과 item executor·binding 모두 일치해야 한다. 각 item 독립 transaction, 동일 ID+hash duplicate, ID동일 hash상이409 item REJECTED/SOURCE_CONFLICT. item의 epoch+seq도 unique. seq gap은 PENDING_DEPENDENCY, 누락 복구 후 같은 item 재전송; timestamp순으로 ID를 재발급하지 않는다. usage overlap은 executor 단일 collector 경계에서 차단한다.
- DAY/TZ: day는 applied timezone 경계의 `[start,end)`이며 URL date는 그 timezone의 localdate. desired zone 저장은 현재 day 끝까지 대기; 회원 설정 변경은 executor별 effective_at/receipt로 추적한다. 응답은 carry_debit와 actual confirmed를 분리한다. daily_limit null은 무제한이며 remaining null이지0이 아니다.
- STA: from/to inclusive localdates, 최대366일 제안; from>to422. INSTALLATION은 executor 필수, ACCOUNT_TOTAL은 W만 가능. per-day zone version 보존, 합계는 기기시간 합. 결측 UNKNOWN/null을0으로 바꾸지 않는다. browser와 focus는 중첩 가능하여 합산하지 않는다.
- IMP: explicit selection COMPLETED만, source manifest와 설치 증명 검증. unique(member,source installation,source record); 동일 hash DUPLICATE, 다른 hash SOURCE_CONFLICT. member analysis projection만 추가하고 quota ledger/guest 원본은 변경하지 않는다. server에 임의 source ID만 보내 다른 사용자 기록을 가져올 수 없다.
- OWN: 구/신 owner 양쪽 검증 proof가 필요한 전환 saga. transfer resource 202는 새 owner capture 허가가 아니다. FENCED→CLOSING_OLD→RELEASING_OLD→VERIFYING_NEW→COMMITTED, 하나라도 UNKNOWN이면 capture 닫힘. 서버 단절 시 로컬 보존, 임의 재귀속 업로드 금지.
- FOC: 기존 session 생성/소유 검증을 재사용하고 verified focus capability에서만 추가 commands를 수신. START와 RESUME은 실제 적용 후 RUNNING, PAUSE는 focus claim 해제 확인 후 PAUSED, END는 ENDED actual release 후. timeout은 UNKNOWN. 자동 성공/시작확인중 별도 취소 기능 없음. duration은 START에서만1..180분, 그 외 null; 재개는 같은 frozen Snapshot/남은 시간.
- ART: immutable manifest 검증/license review 승인 전 enabled 발행 금지. URL은 고정 허용 출처, artifact hash/size 확인, executable remote code 금지. AI는 explicit consent와 approved provider 없으면503, 제안만 반환하고 설정 자동 변경 금지.

## MySQL 후보 모델·마이그레이션

`mysql-candidate.sql`은 자동 Flyway에 포함하지 않는 opt-in 후보다. amvp_ prefix로 기존 테이블 이름을 보존하며 FK는 기존 users(id BIGINT), extension_installations(id CHAR36 ascii_bin)를 전제로 한다. 두 서버 모듈은 별도 DB이며 동시에 동일 DB에 migration runner를 붙이지 않는다. 실제 배포 모듈 선택·다음 Flyway 번호는 공동 승인 후 예약한다.

owner_binding은 물리 설치와 기간별 principal을 구분한다. guest binding은 local DB에만 있고 회원 Server에는 검증된 member binding만 저장한다. 원장 row의 owner는 갱신하지 않고 새 binding/epoch를 만든다. enforcement_day_chain_id는 설치 내 당일 우회 방지용 불투명 연속성 키 제안이며 guest 원본 자동 업로드 권한이 아니다.

config/version, issued package, outbox, transfer, import identity, timezone desired/applied, usage immutable ledger와 day projection, events/report는 별도 테이블이다. DB CHECK는 범위·시간순서만, JSON Schema·동일owner FK 관계·canonical hash·overlap·policy attribution은 Server transaction에서 추가 검증한다. `SELECT ... FOR UPDATE`로 owner/executor/day를 잠그고 segment insert+projection increment+ACK를 하나로 commit한다. 서버 재시도는 projection 두 번 증가 금지. native/DOM 효과는 SQL transaction에 포함할 수 없어 intent→effect→receipt saga로 다룬다.

게스트 로컬은 extension 전용 IndexedDB object store(candidate): owners/configs/packages/usage_segments/day_budgets/events/reports/operations/claims/transfers/outbox. Chrome storage/session flag는 DB 원장 대체가 아니다. 하나의 transaction에 seq·segment·outbox·day budget을 저장한 후에만 checkpoint durable로 표시한다. guest 완료 30일 유지 정책과 설정 별도 보관을 보존하고 미해제 claim/미ACK 원장은 자동 정리 금지. storage quota failure는 STORAGE_UNCONFIRMED로 표출하고 last durable boundary 이후를 확정 시간으로 꾸미지 않는다.

배포 순서: additive tables/reader→capability endpoint disabled→Core/Content verified artifact→contract suite→독립 Chrome→3인 승인→executor allowlist opt-in. rollback은 신규 발행 중단→신규 owner claim 해제 확인→신규 endpoint 비활성; 기존 테이블/원장 삭제나 자동 down migration 금지. 쌓인 신규 원본을 보존한다.


## 이중 서버 DDL 적용 조건

backend 후보는 기존 executor CHAR36 ascii_bin, runtime 후보는 테스트 DB utf8mb4_0900_bin 기반 executor column에 맞춘 별도 `mysql-runtime-candidate.sql`이다. 두 후보는 신규 executor FK column의 charset/collation만 다르다. 실제 배포 DB의 information_schema.columns를 먼저 대조하고 다르면 적용을 거절한다. 기존 column ALTER로 강제 일치시키지 않는다. 이번 실제 신규 격리 DB에서 backend V1~10 + 후보19테이블, runtime V1~9 + 후보19테이블의 생성과 제약을 시험했다. application auth·동시 transaction은 이 SQL 시험의 검증 범위가 아니다.

config는 current row 외 amvp_config_versions에 immutable revision을 저장하여 frozen attachment 발급/재현을 지원한다. package current pointer와 capability receipt·focus attachment·artifact manifest도 별도 보존한다. SiteTimePolicy body.version은 create1/update If-Match와 동일 expected값만 받고 서버가 저장 version을1증가시켜 응답/runtime payload에 반영한다. body의 policy_id/schedule_id는 path config_id와 같아야 하며 kind 변경은 tombstone+새 ID로 수행한다.


## 기존 상세 API와의 adapter 경계

API-SCHEDULE-01~06 및 API-USAGE-01은 설계 원문에 존재한다. usage endpoint는 focus RUN interval/session에 결속되어 신규 상시 segment를 보내면 안 된다. schedules API와 occurrence claim의 URL/method/소유/멱등은 보존하며 새 canonical FocusSchedule은 어댑터를 거친 내부 표현 제안이다. 같은 예약을 legacy와 amvp config가 각각 실행하는 dual writer 금지: 하나의 config source ID/version→하나의 occurrence claim/session으로 연결한다. 기존 claim API가 구현되지 않은 baseline에서는 구현완료로 표시하지 않는다. 미배포 typed schedule 수정/삭제의 실제 대응표와 fixedend·overlap·timezone rules를3인 승인 후 한 모듈에만 구현한다.

AI feedback은 기존 async POST/GET analysis-jobs와 PUT analysis-consent를 재사용한다. 새 동기 feedback API 후보는 이 revision에서 제외했다. consent_version/notice_version·INSUFFICIENT_DATA·PROVIDER_UNAVAILABLE·job상태와 제안전용 원칙을 보존한다. 비회원 원격 AI는 제공하지 않는다. 기존 content-policy defaults MEDIUM/usage_tracking=false 및 TITLE/BODY 허용과 최신 사용자 HIGH/상시측정/URL전용의 차이는 old raw rewrite가 아니라 승인된 신규 executor profile adapter로 분리한다.


예약 adapter의 필드별 mapping/status는 api.json.legacy_adapters가 원본이다. FocusSchedule.when은 시작 trigger이며 site 시간창의 end_local/end_at을 재사용하지 않는다. occurrence fixedend는 실제 UTC 시작+duration으로 계산하여 DST때도 duration을 보존한다. 만료는 기존 status=SKIPPED/reason=EXPIRED, DST gap은SKIPPED/NONEXISTENT_TIME이며 EXPIRED를 새 status로 보내지 않는다. WEEKLY만 기존 ScheduleWrite에 매핑되고 ONCE focus는 승인 전미지원으로거절한다. 새 SiteTimePolicy의 ONCE/WEEKLY block/allow windows와 집중예약trigger는별개다.

## RC2 이용시간 접수와 시간 신뢰 분리

USG-01의 URL/Method·인증·설치 소유권은 그대로 두고 요청 `UsageBatch`를 version2로 협상한다. 각 segment는 `ClockedUsageSegment`의 clock metadata 필수, 응답은 `UsageBatchAck`/조회 `UsageStatusResponse`의 `UsageItemAck`를 사용한다. `status=ACCEPTED|DUPLICATE`는 불변 raw 접수이며 `measurement_state=COUNTED|QUARANTINED|UNCONFIRMED|NOT_RECEIVED`와 별개다. QUARANTINED를 정상 통계·확정 일일 사용량으로 합산하지 않는다. 로컬 보수적 집행 floor와 통계 확정량도 구분한다.

| 후보 DB | RC2 변경/제약 |
|---|---|
| amvp_usage_segments | clock_epoch/clock_boot_id/mono_start_ms/mono_end_ms/measurement_state 추가. 같은 epoch·boot 내 물리 구간 중복은 transaction+참조 모델로 거절. UTC 겹침만으로 삭제하지 않음 |
| amvp_clock_anchors | 인증된 설치/owner/clock·boot와 UTC/monotonic 기준·증거 hash 결속. client의 TRUSTED 문자열은 권한 증명 아님 |
| amvp_clock_resolutions | raw segment FK+원본 hash+anchor FK+검증된 별도 투영. segment당 최종 resolution 하나, 같은 ID 다른 hash 거절 |

원본 payload와 chain hash는 수정하지 않는다. measurement_state는 집계 투영 상태이며 resolution은 별도 불변 행이다. corrected UTC/day가 필요한 경우 원래 capture timezone/version/enforcement chain과 검증된 새 day allocation을 함께 보존한다. DB CHECK/FK/UNIQUE만으로 anchor의 진실성·monotonic overlap·서버 경쟁을 보장하지 않으며, 동일 collector cursor/집계 row 잠금과 멱등 transaction 구현은 김다훈 검토 대상이다. nullable clock 기존 행의 기본 `LEGACY_UNCONFIRMED`는 이전 후보 보존용이며 v2 endpoint가 clock 없는 요청을 허용한다는 뜻이 아니다.

`ClockResolution`은 신뢰된 내부 검증 결과 형상이다. 미인증 클라이언트가 업로드하여 시간을 확정하는 API는 추가하지 않았다. proof 발급·재앵커링·권한 구현 전엔 격리를 유지한다. 예제 boolean/anchor registry는 합성 신뢰 입력이며 실제 Server 인증 성공이 아니다. 후보19테이블 SQL의 두 서버별 신규 격리 시험18건 PASS, 실제 HTTP·동시성·운영 migration은 NOT_RUN이다.

ClockResolution.evidence_sha256는 검증된 physical capture proof의 canonical hash다. 참조 모델 resolve_wire는 Schema 검증→권한 있는 anchor 조회→proof hash/필드·duration·UTC 투영 대조→단일 raw resolution 순서로 연결한다. raw proof와 resolution envelope가 다른 날짜/길이/anchor를 주장하면 거절한다.

## 김다훈 Web·Server·DB 독립 검토 (기준8f48c3b)

### API·대상 설치·인증 경계

25개 후보의 URL/Method는 기존 sites/session/event/guest-import API를 바꾸지 않는다. backend에는 명시적 amvp controller가 없고 runtime-server의 MemberApi는 `/api/v1/**` catch-all이다. 새 controller/adapter의 route 우선순위·배포 모듈을 정하기 전 신규 API 연결 완료로 표시하지 않는다. 기존 API와 경로가 다르다는 것만으로 auth/서비스 의미 호환을 입증하지 않는다.

TZ-01 PUT/TZ-02 GET은 설치별 timezone row를 대상으로 하므로 기존 Executor query Schema의 executor_id를 필수로 한다. 같은 계정의 첫 설치를 임의 선택하거나 전체 설치에 전파하지 않는다. STA-01은 INSTALLATION이면 executor_id 필수, ACCOUNT_TOTAL은 W만 허용한다. 조건부 요청·멱등 hash에 canonical query를 포함한다. TimezoneRecord 본문과 DEC06의 날짜 종료/잔여 승계 정책은 바꾸지 않는다.

W는 기존 cookie/session/auth_version을 검증하고 mutation에서 Origin/CSRF를 검증한다. E는 MemberLinks.access의 만료·폐기·current_user_id 결속을 재사용한다. 기존 Bearer에 owner_epoch claim이 있다고 가정하지 않는다. 서버가 현재 binding/capability/설치 행에서 얻은 epoch와 item을 비교한다. Principal의 user/executor/epoch는 body에서 채우지 않는다. I/guest 설치 증명만으로 member API 접근 불가, 다른 계정 resource는404, 같은 계정의 잘못된 설치/epoch는403/STALE_OWNER로 거절한다.

회원 전환 후 과거 행은 binding.user_id에 귀속하며 현재 installation.current_user_id로 과거 통계의 소유자를 바꾸지 않는다. W의 본인 역사 조회는 기존 binding이 CLOSED여도 허용할 수 있지만 현재 설치 변경 권한을 주지 않는다. E 및 mutation은 현재 사용자/설치/활성 epoch가 모두 맞아야 한다. old ACK·미전송 원본은 보존하고 새 회원에게 재귀속·재해시·자동 업로드하지 않는다. old member 버퍼 업로드는 기존 same-owner recovery의 실제 증명/승인된 adapter가 필요하다.

### 멱등·트랜잭션·잠금

같은 키의 결과 재생 전에도 매번 인증·capability·권한을 재검증한다. identity=(owner_binding_id,method+구체 canonical path,Idempotency-Key), fingerprint=(method,path,정규 query,If-Match/If-None-Match,canonical body)이며 token/transport request_id는 제외한다. 성공한 version1→2 요청을 같은 키/본문/If-Match:1로 재전송하면 이후 version3이어도 원래 version2 응답을 반환한다. 다른 fingerprint는409, 새 키의 stale version은412, precondition 누락428이다. 기존 계약 원문의 '멱등 재생 우선'과 정렬했다.

잠금은 관련 installation ID 정렬→binding ID 정렬→resource→operation/투영 행 순서로 고정한다. 회원 전환·수집·설정 변경 모두 같은 설치 guard를 공유한다. auth를 먼저 읽었더라도 lock 후 current owner/epoch를 재검증한다. idempotency unique 경합의 패자는 다시 현재 읽기로 row/hash/응답을 조회한다. `INSERT IGNORE`로 다른 hash를 DUPLICATE로 위장하지 않는다.

config/current version/history/package pointer/operation Receipt/outbox는 하나의 transaction으로 commit한다. 효과 적용은 이 transaction의 성공으로 확정하지 않는다. 1213/1205는 rollback 후 동일 key/hash로 제한 재시도, 소진503, commit 응답 유실은 status/같은 요청 재전송이다. CREATE/UPDATE/DELETE의 tombstone·safe-version 상한은 유지한다. batch는 각 item ID/hash·epoch/seq가 영속 identity이며 새 request header를 강제하지 않는다. OWN은 transfer_id의 불변 payload와 상태를 비교하고, CAP은 인증된 artifact bootstrap, status/GET은 읽기 전용이다.

### DB 보완과 집계

기존 19개 후보 테이블 안에서만 UNIQUE/FK/CHECK를 보완했다. binding의 (binding_id,executor_id)를 usage/event/anchor가 복합 참조한다. current package의 owner/package, focus attachment의 owner/Receipt도 복합 FK다. resolution은 서버가 도출한 owner_binding_id/executor_id를 보관하고 segment ID+owner+executor+source_hash와 anchor ID+owner+executor를 참조한다. 이 두 새 SQL column은 HTTP body에 추가하지 않으며 검증된 source/인증 context에서 채운다. source hash·시간 길이와 일일 예산 version의 safe 범위도 제약한다.

복합 FK가 실제 사용자 권한·Native proof·anchor 진실성·물리 overlap을 인증하지는 않는다. binding 생성은 잠근 legacy 설치의 실제 current_user_id를 대조해야 한다. owner transfer의 from_binding_id는 검증된 guest 로컬 binding일 수 있어 무조건 member FK를 강제하지 않고 source proof로 검증한다. to member binding/executor는 FK로 결속한다. SQL은 JSON shape·모델 결과·서명·payload hash 계산을 대신하지 않는다.

usage는 COUNTED raw를 기준으로 source당 resolution 또는 원래 confirmed_ms 중 하나만 합산한다. QUARANTINED/LEGACY_UNCONFIRMED는 정상 합계에서 제외하고 PARTIAL/UNKNOWN 표시를 유지한다. 설치의 계정이 바뀌어도 binding.user_id로 과거 합계를 보존한다. account total은 설치별 물리 시간 합이며 policy attribution join으로 증폭하지 않는다. 정수 합계 overflow는 정확 정수로 검출하고 JSON 안전 범위 초과를 오류 처리한다. 기존 Event1.2의 session/target index−1 반복 계산과 새 day 그룹을 혼합하거나 소급 재작성하지 않는다. 자정/DST/DEC06·clock resolution 규칙은04_정책_시간 및 기존 참조 모델을 유지한다.

### 기존 독립 구현과 미결정 adapter

기존 ConfigurationDraftStore는 `additional_configuration_drafts`, user lock·expected version·tombstone을 사용하지만 controller가 없는 opt-in 초안이다. RC2의 binding별 amvp_*·capability/package/Receipt/outbox·HTTP 멱등 경로가 구현됐다고 볼 수 없다. Schedule→FOCUS_SCHEDULE WEEKLY는 기존 adapter/고정 종료 조건을 따라야 하고 ONCE는 승인 전 미지원이다. SiteLimit.limitMinutes는 기존 초안에서1..Long범위이나 RC2 daily_limit_ms는1..1440분 후보이므로 범위를 검증하고 의미 손실 없이 변환해야 한다. 자동 잘라내기 금지다.

기존 Content 초안은 user GLOBAL/executor=null이며 RC2는 지정 executor/binding의 profile/artifact 포함 ContentConfig다. global 초안을 설치별로 자동 복제하지 않는다. lowercase(Locale.ROOT)와 URL_BOUNDARY_1 casefold의 차이, 수동 adultHosts와 검증 artifact의 차이도 기존 C08~10 gate에서 검토한다. CONTENT/CADENCE를 binding당 singleton으로 할지 여러 config를 명시 합성할지는 현 RC2에 고유성·우선순위가 부족하다. singleton 권장과 명시적 합성 대안을 C02/C06의 기존 검토 범위에서 선택하고, 확정 전 중복 활성화 금지다.

IMP-01은 선택 metadata/manifest hash만으로 로컬 guest 원본을 새로 가져오는 완성 HTTP가 아니다. 기존 verified guest-import 경로와 (member,source installation,source record,source hash)의 검증된 source를 결속하는 adapter가 필요하다. 증명/데이터가 없으면 SOURCE_NOT_VERIFIED로 거절하며 로그인만으로 guest 데이터를 수집하지 않는다. focus 완료 시간만 있는 source를 browser 이용시간으로 바꾸지 않는다. 분석 projection과 현재 quota를 분리하고 원본/미전송 데이터를 보존한다.

QUERY 권장안은 기존 OP-01 HTTP status와 Content 로컬 읽기 전용 target 조회를 분리하는 것이다. target_operation_id+target_semantic_hash와 독립 request_id,owner/scope/읽기 권한·응답 as_of/Receipt를 결속하고 조회가 NORMAL seq를 소비하지 않게 한다. 원래 효과의 과거 Receipt와 현재 재조회 결과를 구분한다. 기존 Control QUERY의 구체 Schema는3인 합의 전 변경하지 않으며 현재 명시 거절을 유지한다. 이 검토는 신규 endpoint·정책 영역을 추가하지 않는다.

최신 실제 리뷰 기록: [채지민 RC2 review5695506637](https://github.com/kdu-sw-capstone/capstone-project/pull/24#pullrequestreview-5695506637)는8f48c3b 기준 기존 T01~04 설계 수정 수락, 전체 CHANGES_REQUESTED/QUERY 보류다. [의견4410668821](https://github.com/kdu-sw-capstone/capstone-project/pull/24#discussion_r4410668821)의 독립 query ID/hash·target 최초 hash·seq 비소비·null cleanup 조회·current/old-scope 권한·최초 Receipt/진행/IN_DOUBT/미발견/최신 footprint 구분 권장안과 이 Server 검토 방향이 일치한다. 실제 공동 결정·엄격 Schema·양성/부정 fixture는 미완성이고 이번 범위에서 임의 구현하지 않았다. 기존4건 수락을 전체3인 승인으로 승격하지 않는다.
