# API·DB 상세 계약

## HTTP 공통

`api.json`의 25개 operation이 경로·method·auth·요청/응답 Schema·query·HTTP status·precondition의 원본이다. 기존 `/api/v1/sites`, sessions, events 원문은 변경하지 않는다. 신규 `/api/v1/amvp/*`는 **현재 미구현**이다. 모든 필드는 명시적이며 JSON unknown field 거절. Schema default로 저장/권한을 임의 채우지 않는다. 생성 버전 1, 증가 최대 9007199254740991; overflow 422 VERSION_LIMIT. 정수에 문자열/float/boolean coercion 금지. UTC는 millisecond Z, IANA zone은 검증된 tzdb revision과 함께 저장한다.

W는 기존 focurve_session HttpOnly session·exact Origin·mutation CSRF, E는 검증된 installation bearer와 실제 executor 결속이다. `user_id`는 인증에서 도출하며 request body로 받지 않는다. guest는 로컬 저장이 기본이며 회원 API 자동 업로드 금지. 설치 토큰의 기존 회전·폐기·소유권 gate를 그대로 적용한다. W_OR_E도 서로 다른 검증을 생략하지 않는다. E의 account total 조회 금지; 다른 owner/executor resource는 일반적인 404로 존재 유출 방지.

모든 mutation은 auth→capability→owner row lock→precondition→idempotency→검증→단일 transaction 저장/outbox 순서다. capability negotiation 자체는 아직 capability가 없으므로 인증/검증된 artifact registry로 부트스트랩한다. GET은 consistent read만 수행한다. If-None-Match:* 생성, If-Match:"n" 수정/삭제, 없으면428, stale412, 같은 idempotency key+같은 canonical request면 기존 결과, 다른 본문409. 삭제는 tombstone+다음 runtime revision 발행, 실제 해제 전202 RELEASE_PENDING. 기존 focus frozen 설정은 다음 세션까지 남는다.

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

backend 후보는 기존 executor CHAR36 ascii_bin, runtime 후보는 테스트 DB utf8mb4_0900_bin 기반 executor column에 맞춘 별도 `mysql-runtime-candidate.sql`이다. 두 후보는 신규 executor FK column의 charset/collation만 다르다. 실제 배포 DB의 information_schema.columns를 먼저 대조하고 다르면 적용을 거절한다. 기존 column ALTER로 강제 일치시키지 않는다. 이번 실제 신규 격리 DB에서 backend V1~10 + 후보17테이블, runtime V1~9 + 후보17테이블의 생성과 제약을 시험했다. application auth·동시 transaction은 이 SQL 시험의 검증 범위가 아니다.

config는 current row 외 amvp_config_versions에 immutable revision을 저장하여 frozen attachment 발급/재현을 지원한다. package current pointer와 capability receipt·focus attachment·artifact manifest도 별도 보존한다. SiteTimePolicy body.version은 create1/update If-Match와 동일 expected값만 받고 서버가 저장 version을1증가시켜 응답/runtime payload에 반영한다. body의 policy_id/schedule_id는 path config_id와 같아야 하며 kind 변경은 tombstone+새 ID로 수행한다.


## 기존 상세 API와의 adapter 경계

API-SCHEDULE-01~06 및 API-USAGE-01은 설계 원문에 존재한다. usage endpoint는 focus RUN interval/session에 결속되어 신규 상시 segment를 보내면 안 된다. schedules API와 occurrence claim의 URL/method/소유/멱등은 보존하며 새 canonical FocusSchedule은 어댑터를 거친 내부 표현 제안이다. 같은 예약을 legacy와 amvp config가 각각 실행하는 dual writer 금지: 하나의 config source ID/version→하나의 occurrence claim/session으로 연결한다. 기존 claim API가 구현되지 않은 baseline에서는 구현완료로 표시하지 않는다. 미배포 typed schedule 수정/삭제의 실제 대응표와 fixedend·overlap·timezone rules를3인 승인 후 한 모듈에만 구현한다.

AI feedback은 기존 async POST/GET analysis-jobs와 PUT analysis-consent를 재사용한다. 새 동기 feedback API 후보는 이 revision에서 제외했다. consent_version/notice_version·INSUFFICIENT_DATA·PROVIDER_UNAVAILABLE·job상태와 제안전용 원칙을 보존한다. 비회원 원격 AI는 제공하지 않는다. 기존 content-policy defaults MEDIUM/usage_tracking=false 및 TITLE/BODY 허용과 최신 사용자 HIGH/상시측정/URL전용의 차이는 old raw rewrite가 아니라 승인된 신규 executor profile adapter로 분리한다.


예약 adapter의 필드별 mapping/status는 api.json.legacy_adapters가 원본이다. FocusSchedule.when은 시작 trigger이며 site 시간창의 end_local/end_at을 재사용하지 않는다. occurrence fixedend는 실제 UTC 시작+duration으로 계산하여 DST때도 duration을 보존한다. 만료는 기존 status=SKIPPED/reason=EXPIRED, DST gap은SKIPPED/NONEXISTENT_TIME이며 EXPIRED를 새 status로 보내지 않는다. WEEKLY만 기존 ScheduleWrite에 매핑되고 ONCE focus는 승인 전미지원으로거절한다. 새 SiteTimePolicy의 ONCE/WEEKLY block/allow windows와 집중예약trigger는별개다.
