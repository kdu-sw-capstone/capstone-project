# 추가 MVP · 정책 발행·이용시간 수신 경계

## CADENCE 실행 연결 후속 — Web·Server 경계 PASS / 실제 actor·휴식 단계 PARTIAL (2026-10-30)

- 김다훈 Web·Server·DB·UI 담당 범위다. clean PR31 `d307c8aafbb7508f94615fe4e8467ce1a7fba42d` Worktree를 재사용해 `feature/additional-mvp-cadence-bridge`로 분리했다. 이미 병합된 PR30/integration `da1c70b2b2052dece581353f81cd5eb6c604e4b1`을 이 후보에만 로컬 반영한 비교 기준은 `1a4611d48c44d09e3970998822eda19ac5611f0a`다. 기존 PR27~31 HEAD/index와 다른 Worktree는 변경하지 않았다. GitHub Merge는 수행하지 않는다.
- **의존성:** PR27 → PR28 → PR29 → PR31 → 이 후속. PR27/28/29/31은 현재 Draft·미병합이며, PR30은 병합 완료다. integration 대상 전체 diff에는 선행 기능이 포함된다. 이번 후속 자체의 변경은 위 비교 기준 이후다.
- **재사용:** PR25 AdditionalConfigStore CRUD·원자 version/revision/멱등/삭제 tombstone, PR27의 검증 capability/owner·불변 config versions·outbox·FocusAttachment, PR28 상태 표시 경계, PR31 admission 위임, 기존 FocusSessions/MemberApp·디자인·api.ts 인증/CSRF/쓰기 경로를 재사용한다. Core/Content actor 및 공유 계약은 수정하지 않았다.
- **설정:** AmvpCadenceAdmission이 동일 저장 트랜잭션에서 검증된 CADENCE 원본을 sidecar 정의로 전달한다. SITE_TIME/CONTENT/예약은 기존 경로로 위임한다. 부분 capability map의 FOCUS_CONTROL만 검증돼도 CADENCE 준비 저장이 가능하며, RUNTIME_POLICY 미지원 발행은 계속 거절한다. CADENCE를 RuntimePackage에 추가하지 않는다. 기존 실행은 원래 config ID/version/revision·Snapshot 원문/hash·명시적인 null 또는 실제 Attachment를 고정하며 편집/삭제로 갱신하지 않는다.
- **명령/조회:** RC2 FOC-02 POST `/api/v1/amvp/focus/{session_id}/commands`, FOC-03 GET `.../state`와 엄격한 FocusControl/FocusState를 사용한다. Web 내부 ETag와 `X-Focurve-Control-Context`는 기존 binding/executor/epoch/capability/Attachment/5초 execute_before·제어 version 메타데이터이며 권한 증거가 아니다. FocusState/공유 Wire JSON 필드는 추가하지 않았다. POST마다 실제 인증·현재 소유권/receipt·frozen 원본·generation·version·멱등성·기한을 재검증한다. 조회는 actor 실행/세션 생성/저장을 하지 않는다.
- **단일 writer/생산 gate:** 실제 CapabilitySource와 `AmvpCadenceControl.Authority`가 모두 없으면 503이며 가짜 production provider는 없다. inspect는 단일 prepared focus 권한·기존 D06 writer fencing·현재 capability receipt에 결속된 actor generation을 읽기 전용으로 증명해야 한다. 최초 scope 조회로 RUNNING을 만들어낼 수 없다. 이미 실행한 legacy START를 coordinated START로 다시 실행하지 않는다. 실제 prepared FocusRef와 actor/전송/기존 세션 투영 연결은 Core 담당과 결속 대기다.
- **원자 발행/수신:** FOCUS_CONTROL 원문/hash·command·run·기존 outbox를 한 트랜잭션으로 저장한다. transport request_id만 semantic fingerprint에서 제외하고 operation/소유자/정책/If-Match는 보존한다. 내부 `receive`는 인증 supplier, 실제 ACK/효과/집중 claim 해제/runtime 정책 유지 verifier, generation/operation/순번/시각/full frozen 결속을 요구한다. 공개 미합의 Receipt API를 만들지 않았다. Core transport가 커밋된 outbox를 전달하고 검증된 결과를 이 receiver에 넣어야 한다. receipt/hash 또는 HTTP 202만으로 적용/해제를 인정하지 않는다.
- **순서/실패:** gap 원문은 보존하고 같은 receipt 재수신 때 선행 순번 해소 후 투영한다. 최초 UNKNOWN/START_FAILED는 불변 보존하며 후속 성공으로 지우지 않는다. 5초는 초기 전환 확인에 적용하고, 이미 확인된 실행의 이후 UNKNOWN/진행 보고와 구분한다. 기한 후 첫 성공 ACK로 UNKNOWN을 해제하지 않는다. ENDED 증거가 있어도 원래 Server 잠금이 남으면 투영을 대기한다. adapter는 legacy 세션/DNR/DOM/잠금을 직접 수정·삭제하지 않는다. JSON 정수의 JDBC/HTTP 표현 차이는 canonical bytes로 정규화하며 Snapshot 원문은 재직렬화하지 않는다.
- **UI:** 기존 주 타이머 위치와 START/PAUSE/RESUME/END를 재사용하고, 반복 설정은 보조 details로 표시한다. 저장 버전/집중·휴식/횟수/자동 시작 설정과 실제 제어 결과를 구분한다. 확인된 coordinated 실행의 조회 실패 시 legacy END로 fallback하지 않는다. 쓰기 응답만으로 실제 단계를 바꾸지 않고 같은 operation의 후속 조회를 기다린다. UNKNOWN에는 일반 END/RESUME 조작을 노출하지 않는다. 설정 버튼은 기존 Settings/AdditionalSettings로 연결한다.
- **공유 계약 경계 BLOCKED:** RC2 `FocusState`에는 REST/현재 주기/phase 필드가 없다. PAUSED를 휴식으로 해석하거나 새 Wire 필드·주기 계산을 발명하지 않는다. 실제 집중↔휴식 단계·주기 표시 및 자동 주기 결과 결속은 Core actor 자료와 해당 필드/조회 방식의 좁은 공동 합의가 필요하다. RC2 계약 전체를 다시 여는 작업은 하지 않았다. rest_clock=ELAPSED_WALL_CLOCK, missed_focus=WAIT_USER, deadline/auto_start_next 값은 그대로 전달하며 서버가 주기를 계산하지 않는다.
- **검증 PASS:** Web 전체282(HTTP/DOM 합성), 마지막 fixture 타입 보완 후 해당2건 재검증·TypeScript/Vite 빌드 PASS. Server 기존 단위81 PASS를 재사용하고 변경된 sidecar는 새 격리 MySQL8.4.8 및 Bearer HTTP18건(실패/오류/스킵0)으로 검증했다. RC2 전체266 PASS, JAR 빌드·schema/DDL 포함·변경분 비밀패턴/금지 경로 검사 PASS. 원본 api.ts·legacy-lock·공유 Schema/D06/Wire·Core/Content·Shorts는 보존했다. 전용 additional-cadence-bridge.yml로 원격 재현한다.
- 격리 시험은 원자 rollback, 동시 START version 충돌, 중복/gap/지연/역전·객체 재생성, 실제 verifier 미확인 거절, frozen Snapshot/실제/null Attachment, 수정/삭제 후 기존 실행, 최초 실패 보존, Server 잠금 잔존 END 거절을 확인했다. Core scope/effect/잠금 해제 producer는 **SYNTHETIC**이며 실제 Core 실행 성공이 아니다. 실패한 초기 시험 로그는 `.local/amvp-mysql-69411e70d679`, `f127f863b55e`, `c7de834e3033`에 보존했다. 최종 MySQL 근거는 `.local/amvp-mysql-ef3fb7c36780`; 소유권 확인 후 정상 종료했다. 로컬 변경 SHA/로그 색인은 `.local/cadence-verification-20261030/result.json`이며 민감한 시험 DB/설정은 게시하지 않는다.
- **NOT_RUN:** 실제 Core/Content/Chrome/Native, 실제 DOM/DNR/Binding 복원·재기동, Figma 시각 수용, 운영 DB migration/제품 활성화. opt-in `amvp/cadence-bridge.sql`은 기존 RC2 runtime schema 뒤의 검토 자료이며 자동/운영 적용하지 않았다. 기존 UNKNOWN/HOLD·Credential·실패 설치는 그대로 보존한다.
- **다음 최소 작업:** 윤종민 Core의 prepared focus·writer fence/동일 Snapshot/Attachment·세대/실제 효과/복원 verifier와 outbox/result transport/기존 세션 투영을 결속하고, REST/주기 정보 표현만 공동 확인한다. 이후 승인된 실제 연결 시험을 진행한다. `MVP_FINAL_COMPLETE=false`.


## 예약 actor 연결 후속 — Web·Server 구현 PASS / 실제 Core·ONCE BLOCKED (2026-10-30)

- 담당 김다훈 Web·Server·DB. clean PR29 HEAD `974175c5832a63ab018aa0f07f3203909fde4a37`를 재사용해 같은 Worktree의 `feature/additional-mvp-schedule-bridge`에서 구현했다. PR27~30 브랜치 HEAD는 변경하지 않으며 PR30 검사는 별도 리뷰/병합 상태를 유지한다. Draft 대상은 `integration/additional-mvp-20261029`; 선행 병합 순서는 PR27 → PR28 → PR29 → 이 후속이다. 이번 변경만의 diff는 `974175c..후속HEAD`다.
- **범위 PARTIAL:** RC2 `legacy_adapters.focus_schedule`는 WEEKLY만 기존 actor 경로에 매핑하고 ONCE는 `REVIEW_PENDING`이다. ONCE를 주간 예약으로 변환하지 않고 `UNSUPPORTED_CONTRACT`로 원자 거절한다. 공유 계약 변경·담당 합의 없이 일회성 실행을 활성화하지 않는다. 일회성 전체 연결은 미완료다.
- PR25 AdditionalConfigStore의 CRUD/버전/멱등/트랜잭션을 그대로 사용한다. 새 AmvpScheduleBridge admission이 FOCUS_SCHEDULE 저장 시 같은 트랜잭션의 단일 legacy `schedules` 행에 전달한다. SITE_TIME/CONTENT는 기존 publisher로 위임하고 CADENCE carrier를 추가하지 않는다. RuntimePackage/outbox에 예약을 넣거나 canonical CFG 사본을 별도 실행하지 않는다.
- 기존 actor 경로 `GET /api/v1/schedules?executor_id=…`, `POST /api/v1/schedule-occurrences/claim`(기존 3필드), `GET /api/v1/schedules/{id}/occurrences`를 구현했다. 조회는 명시한 설치/현재 binding 소유권을 검사하며 현재 구현의 상한은 100행이다(초과 시 불완전 성공 대신 거절). 삭제된 예약도 동일 소유자의 명시적 재조회에서 확인할 수 있다. 기존 CRUD를 다시 만들지 않는다.
- claim은 occurrence ID를 내부 request ID로 사용한다. UNIQUE(schedule_id,scheduled_start_at), 동시 설치/소유자 잠금, 동일 version, DST gap 미이동/earlier fold, 고정 UTC end, 잔여 60초 경계를 검사한다. 활성 집중은 WAITING_CONFLICT, 만료는 SKIPPED/EXPIRED. 편집·삭제는 미시작 건만 취소하고 발행된 세션·원래 version/end를 보존한다. 편집 후 같은 발생의 옛 세션을 새 version 요청에 재결속하지 않는다.
- `AmvpScheduleBridge.Actor.enqueue/verifyReport`는 **서버 내부 adapter 경계**이며 새 Wire 계약이 아니다. enqueue는 같은 DB 트랜잭션 안에서 기존 예약 actor용 세션·명령을 영속화해야 한다(외부 효과/네트워크 호출 금지). 실제 서버 세션/소유자/고정 종료/APPLY 명령/잠금을 확인한다. 생산 Actor/verifier bean은 제공하지 않으므로 미연결 claim은 503이며 가짜 실행을 생성하지 않는다. 원격 Core 브랜치 HEAD `9868a0f5914d7a173c102fc198a9a908b043381f`를 확인했으며, 미공개 Core 작업까지 없다고 단정하지 않는다.
- 결과 수신은 기존 D06 실행 보고 HTTP/불변 execution_reports를 재사용한다. 조회 projection에서 원래 occurrence·version·binding·session/command/revision·payload hash와 주입된 실제 효과 검증을 확인한다. 클라이언트 APPLIED/HTTP200만으로 RUNNING을 만들지 않는다. RELEASED는 별도 RELEASE 명령·rollback proof·ENDED·해제 시각·잠금 0 확인이 필요하다. 실패/UNKNOWN 보고는 보존하고, 이후 해제 확인과 과거 실행 미확정을 별도로 표시한다. Core 최종 상태·기한·기존 원장을 변경하지 않는다.
- 기존 AdditionalSettings/Panel/Light·Dark 스타일을 재사용한 ScheduleExecutionPanel과 엄격한 조회 client를 추가했다. 저장/요청 대기/실제 적용/실패/UNKNOWN/해제 확인, 이전 version, 삭제된 예약을 구분한다. 설치/version 전환 시 늦은 응답을 폐기한다. UI는 claim/START/END를 호출하지 않는다.
- 새 검증: Web 전체 **266 PASS**, 마지막 변경 영향 **11 PASS**, TypeScript·Vite build PASS. Server 단위 **81 PASS**, 예약 격리 MySQL·Bearer HTTP **16 PASS** + 시간 규칙 단위 **3 PASS**(3건은 Server81에 포함). 동시 claim·소유권·토큰 폐기·버전/ACK 불일치·정확한 60초·DST fold/gap·실패 뒤 지연 성공·별도 해제·잠금 잔존·삭제 후 실행 보존·서버 객체 재생성 조회를 검증했다. actor/effect/clock 입력은 **SYNTHETIC**이며 실제 Core 연동 성공이 아니다.
- 최초 새 SQL 열 이름 오참조 실패는 `.local/amvp-mysql-11ca63e4c23a/tests.log`에 보존했다. 기존 execution_commands의 실제 PK `id`로 최소 수정했고 이후 독립 DB에서 재검증했다. 최종 DB/정상 종료 증거와 source SHA는 `.local/schedule-verification-20261030/result.json`, unit/Web 로그는 같은 폴더다. 전용 CI `additional-schedule-bridge.yml`이 분리된 빈 MySQL에서 재현한다.
- 재현: 기존 `scripts/test-additional-config-mysql.ps1` + `FOCURVE_AMVP_SCHEDULE_TESTS=1`, `-Tests 'AmvpScheduleMysqlTest,AmvpScheduleBridgeTest'`. 단위 verify에서는 모든 MysqlTest를 제외한다. opt-in DDL은 `runtime-server/src/main/resources/amvp/schedule-bridge.sql`이며 자동 초기화·numbered migration·운영 적용은 없다. 기존 RC2 runtime schema가 선행해야 하고 실제 운영 반영은 별도다.
- 보존/대기: `frontend/src/api.ts`·legacy-lock·RC2·Core/Content·Shorts·실패 설치·Credential·운영 DB 변경 없음. PR30 결과를 수정/병합하지 않는다. 기존 contract 전체 PASS는 그 후보의 결과이며 현재 제품 후보의 실제 수용으로 승격하지 않는다. 실제 Core actor/검증 provider·ONCE 공동 계약·Chrome/Native·실제 END/DOM/DNR/재기동·Figma 시각 수용은 **BLOCKED/NOT_RUN**, `MVP_FINAL_COMPLETE=false`.


## DAY-01 독립 후속 — 구현·격리 검증 완료, 실제 Core 연결 대기 (2026-10-30)

- 담당 김다훈 Web·Server·DB, 계약 RC2 DAY-01/DailyUsage/UsageDay. PR28 head642b87704f8eaaf01d4b9d0b483b33390d9b9b2d를 재사용하고 같은 clean Worktree에서 codex/additional-mvp-daily-usage로 분리했다. PR27/28 브랜치·리뷰 범위는 변경하지 않는다.
- 코드: AmvpDailyUsage/Api, dailyUsageApi/DailyUsagePanel·기존 AdditionalSettings 배치. 기존 원장/예산/설정/Admission·디자인 Panel 재사용. Schema·공용 api.ts·legacy-lock·Core/Content·생산 bean/기능 플래그·migration 변경 없음.
- 수용: 실제 인증·소유권·날짜·자연일/DST·검증된 raw/예산 정합성·조회 무변경·지연 응답/설치 전환. 확인된 서버 prefix/carry만 표시하며 최신 live 잔여/차단/다음 허용 시각은 추정하지 않는다. 근거 없는0·timezone/day 추정·계정 재귀속 금지.
- 실제 경로: `GET /api/v1/amvp/site-time-policies/{policy_id}/usage?executor_id=…&date=YYYY-MM-DD` → 기존 인증/Admission → 동일 소유자의 불변 raw·해소 anchor·day budget 일관 조회 → 기존 `DailyUsage` Schema → AdditionalSettings의 일일 기록 패널. 기존 config API opt-in을 따르며 새 authority/collector bean이나 활성화 플래그는 만들지 않는다.
- 데이터: 서버 COUNTED prefix와 검증된 예산 carry를 읽는다. 불확실 raw는 보존·제외한다. `quality=PARTIAL`, `enforcement_state=UNKNOWN`, live `remaining_ms=null`이며 현재 차단/다음 허용 시각을 만들지 않는다. 원장·예산·Receipt를 수정하거나 날짜/한도를 초기화하지 않는다. 회원 전환 후 과거 기록은 기존 소유자만 조회할 수 있다.
- 보수적 한계: 자료 없음은 404, day/시간대 근거 부재·집계 불일치·동일 현지 날짜에 복수 전환 bucket은 503/STORE_UNCONFIRMED다. UTC 광역 탐색은 최대16 budget·50,000 raw로 제한한다. 전환 bucket을 임의 선택·합산하거나0/이용 가능으로 표시하지 않는다. 현재 UI와 API는 이 부분 자료 조회를 제공하며 완전한 live quota 증명은 아니다.
- 새 검증: Node24.19.0 Web **255 PASS**, TypeScript·Vite build PASS; Java21 Server unit **78 PASS**; 독립 MySQL8.4.8 **9 PASS**(실제 Bearer HTTP/JDBC·토큰 폐기 시험 포함). DB 실행의 추가 API unit2건은 Server78에 포함하므로 중복 합산하지 않는다. 자연일/DST/전환·capability·anchor는 합성 fixture이며 실제 Core clock producer 증거가 아니다.
- 실패·수정 보존: 최초 HTTP200 기대가503으로 실패한 원인은 기존 인증 `FOR UPDATE`와 새 HTTP read-only transaction의 충돌이었다. 인증 잠금은 유지하고 HTTP transaction만 조정했다. `.local/amvp-mysql-62a768971183/tests.log` 최초 실패, `.local/amvp-mysql-8309fe37e031/` 최종9 DB+2 API PASS·datadir 소유권·정상 종료 증거, `.local/receipt-verification/daily-usage-20261030/` Web·Server unit 로그. 이후 불확실 구간이 들어와도 확정 prefix/예산을 늘리지 않고 raw2건을 보존하는 반례를 실행했다.
- 재현: `npm --prefix frontend test -- --maxWorkers=2`; `npm --prefix frontend run build`; Java21에서 Maven `-f runtime-server/pom.xml '-Dtest=*,!AdditionalConfigMysqlTest,!AmvpRuntimeBridgeMysqlTest,!AmvpRuntimeReceiptMysqlTest,!AmvpDailyUsageMysqlTest' verify`. DB는 기존 `scripts/test-additional-config-mysql.ps1`에 전용 vendor/Maven 경로·빈 시험 포트·`-Tests 'AmvpDailyUsageMysqlTest,AmvpDailyUsageApiTest'`, 환경 `FOCURVE_AMVP_DAILY_TESTS=1`을 사용한다. 운영 DB URL을 지정하지 않는다. 새 `additional-daily-usage.yml`이 동일 분리 검증을 수행한다.
- PR 범위: PR28을 base로 하는 별도 Draft 후속. PR27·28의 발행/부착/수신/RPT 검증·화면 연결은 재사용하고 재구현하지 않았다. 공유 계약·`frontend/src/api.ts`·legacy-lock·생산 설정·DB migration은 변경하지 않는다.
- 실제 Core/Content/Chrome/Native·운영 DB·Figma 시각 수용 **NOT_RUN**. 다음 최소 통합은 윤종민의 실제 capability/collector/clock·day-carry와 report verifier를 기존 경계에 연결한 뒤 수신→조회→표시를 검증하는 것이다. 예약/반복 집중·휴식 actor와 Content 효과는 각각 담당 구현 증거를 기다리며 저장만으로 적용 완료를 선언하지 않는다. legacy-lock 및 미수신 hash는 계약 담당의 별도 결정 대기다.

## PR #27 기준 및 구현 — 기존 기록 보존

- 담당: 김다훈 Web·Server·DB. Core·Content producer와 Shorts 안정화는 변경하지 않는다.
- 브랜치: `feature/additional-mvp-runtime-adapters`.
- 시작 기준: PR #25 head `6073442df501c4e381142ea6ed1108808d249814`.
- 현재 통합 기준: PR #25 병합 `202d6317ff7d88b6d5e916ec549e7ffff02f2d91`. 시작 기준과 병합 tree가 같음을 확인하고 이 독립 브랜치만 fast-forward했다.
- 계약: `AMVP-CONTRACT-20261029-RC2`, 계약 기준 `e2b3fc318fe52acc45145a30def07b874b2255f6`. 공유 계약·PR #25 파일 변경 없음.
- 상태: **PARTIAL — 독립 어댑터·HTTP·DB·UI 상태 검증 PASS, 실제 producer 연결 및 제품 수용 NOT_RUN**.

## 재사용한 구현·명세

PR #25의 `AdditionalConfigContract`, `AdditionalConfigStore.Admission`, `MemberAuth`, `AdditionalUsageStatistics`, `additionalConfigApi`, `AdditionalUi.Panel`과 빈 격리 DB fixture/실행 스크립트를 재사용한다. CRUD·인증·통계·기존 화면을 다시 구현하지 않았다.

원문: `contracts/additional-mvp/rc1/schema.json`, `api.json`, `mysql-runtime-candidate.sql`, `tests/review_reference.py`; `docs/design/additional-mvp-contracts/02_API_DB.md`, `03_Wire_D06_복원.md`, `04_정책_시간.md`. 디렉터리명 rc1과 달리 Schema/계약 revision은 RC2다.

## 실제 구현

1. **정책 발행**: 기존 config writer의 동일 트랜잭션에서 canonical RuntimePackage·RUNTIME_POLICY outbox·current pointer를 저장한다. binding/owner epoch, 서버 검증 capability receipt/유효기간, 적용된 timezone, 콘텐츠 feature/profile 권한을 확인한다. 실패 시 config/version/발행 전체가 rollback된다. 저장·발행을 Core APPLIED로 표시하지 않는다.
2. **고정 정책 부착**: 발행된 immutable package의 지정 `next_focus_revision`에서 콘텐츠를 가져온다. 원본 FocusRef는 trusted `FrozenFocusProof`가 검증해야 한다. 동일 요청은 영속 receipt로 재생하고, 다른 revision/Snapshot으로 기존 집중에 재부착하는 것은 거절한다. D06 Snapshot 변경·DOM 적용·실행 ACK 생성은 없다.
3. **이용시간 수신**: USG-01 item별 독립 transaction과 실제 bearer 재검증. 원본 canonical hash, active owner, 발행 package/revision/발행 시각, ALL_MATCHING attribution, 순번/hash chain, 단일 collector의 물리 구간 중복을 확인한다. 순번·package 누락은 기존 operation ledger에 ID/hash/위치를 예약하고 PENDING_DEPENDENCY로 남긴다. 재전송·수신기 재생성·동시 중복은 이중 집계를 만들지 않는다.
4. **측정·집계**: client TRUSTED만으로 COUNTED가 되지 않는다. 소유권이 일치하는 서버 VERIFIED anchor와 별도 ClockProof가 모두 있어야 한다. 나머지는 원본을 보존하며 QUARANTINED. 확인된 구간은 일일 정책마다 집계하되 새 day carry가 검증되지 않았으면 quota cache를 만들지 않는다. 기존 carry·day chain·limit를 임의 변경하지 않고 충돌 시 raw/receipt/projection을 함께 rollback한다. 통계는 구간 하나를 한 번만 합산한다. 이는 live Core 잔여 한도 증명이 아니다.
5. **HTTP**: PKG-01 GET current, FOC-01 POST attachment, USG-01 POST batch. `focurve.additional.runtime-bridge.enabled=true`와 서버 authority/proof bean이 필요하다. 기본 비활성·생산 verifier 없음. 켜기만 하면 CAPABILITY_NOT_VERIFIED. 재인증/보존 END 전용 서비스는 거절한다. request body duplicate key·추가 query·크기 제한을 검증하고 secret/raw SQL 오류를 반환하지 않는다.
6. **Web**: 독립 `RuntimeDeliveryPanel`은 기존 config API를 읽고 저장/적용 대기/미확인/미지원/정확한 revision 적용 상태를 구분한다. 설치 전환·늦은 응답·재조회 오류를 처리한다. `runtimeDeliveryState`는 usage ACK와 COUNTED/QUARANTINED를 구분한다. 기존 화면 entry 파일을 수정하지 않았으므로 **라우트 배치·Figma 시각 수용은 NOT_RUN**이다.

## 실제 연결과 대기 경계

| 경계 | 결과 |
|---|---|
| ConfigStore → canonical package/outbox/current pointer | 격리 MySQL PASS, 생산 capability source 대기 |
| Frozen issued content → immutable attachment/receipt | 격리 MySQL PASS, 원본 focus verifier는 SYNTHETIC |
| 실제 bearer/MemberAuth → PKG/USG HTTP → JDBC | MockMvc+실제 격리 MySQL PASS |
| Raw usage → quarantine/count → 기존 statistics | 격리 MySQL PASS, clock/carry producer는 SYNTHETIC |
| 기존 회원의 closed binding 기록 조회 | owner 이전 후 기존 회원 read-only 보존 PASS |
| Web 상태 패널 → 기존 API | 렌더링/API Mock 시험 PASS, 화면 배치 미완료 |
| Core/Content 실행·실제 effect ACK·RPT report 연결 | BLOCKED: 검증된 producer 및 근거 조회 연결 대기 |
| 비회원 로컬 collector/guest 원장 | 변경 없음, 실제 수용 NOT_RUN; 회원 서버 업로드로 대체하지 않음 |
| Chrome·Native·정상 END·복원·재기동 | NOT_RUN, 이번 승인 범위에서 제외 |

### 공유 계약을 임의로 바꾸지 않은 경계

- RuntimePackage에는 SITE_TIME과 focus_defaults만 있다. CADENCE/FOCUS_SCHEDULE은 별도 actor 경로가 필요하다. 이 publisher로 해당 변경의 실행을 발행하려 하면 UNSUPPORTED_CONTRACT로 rollback하며, 저장했다고 실행 가능으로 표시하지 않는다. 기존 PR #25의 CRUD 자체는 보존했다.
- USG-02: StatusRequest에는 item_ids만 있지만 UsageItemAck에는 NOT_RECEIVED일 때도 payload_sha256이 필수다. 미수신 ID의 실제 hash를 알 수 없다. 내부 `knownStatus`는 영속 receipt가 있는 경우만 반환하고, 미수신은 Optional.empty로 구분한다. **없는 hash를 0/임의 값으로 채우거나 계약을 수정하지 않았다. 외부 status endpoint 활성화는 공동 결정 대기.** immutable batch 재전송은 이미 지원한다.
- 생산 `CapabilitySource`는 approved artifact/feature/license와 현재 owner/capability를 확인하고, 그 결과를 DB receipt의 selection·hash·verification_ref·expiry와 결속해야 한다. 시험 issuer는 test source에만 존재한다.
- 생산 `ClockProof`는 registered anchor 외에도 restart/predecessor, wall/mono 정합성, immutable day/timezone allocation과 carry provenance를 증명해야 한다. `initialCarry`가 없으면 quota cache 초기값을 추정하지 않는다. 불확실 구간 보정/owner handoff/carry 갱신은 이 수신기가 대신 결정하지 않는다.
- 생산 `FrozenFocusProof`는 원래 Snapshot bytes/hash/format·같은 session/owner/revision·live focus authority를 확인해야 한다. 이번 synthetic proof 시험을 실제 D06/Chrome 연결 완료로 보고하지 않는다.

## 검증 — 2026-10-29 KST

- PR #25 CI run `40881211102`의 Web242·Server82 및 기존 MySQL16 결과는 동일 소스·계약에 한해 재사용한다.
- Windows, Node24, Java21, MySQL8.4.8, 승인된 19-table candidate를 **새 빈 disposable DB**에만 적용했다. 운영 migration·설치 서비스·사용자 DB 기동 없음. 시험 DB는 소유권 대조 후 mysqladmin으로 정상 종료했다.
- 새 MySQL14: 원자 발행, rollback, capability 만료, 동일/상이 hash, 동시 중복, seq gap/위치 재사용, receiver 재생성, quarantine, attribution/owner/geometry/hash 거절, overlap, item별 결과, day 충돌 rollback, package dependency, carry 미확정, immutable attachment, 실제 bearer HTTP/폐기, ALL_MATCHING 및 statistics 중복 방지, closed-owner history, registered anchor 부재.
- 새 HTTP/bean6: 생산 source 없는 API·Web principal·restricted service·malformed/duplicate body·활성화 조건·기존 Admission 연결. 자동 적용/초기화 없음.
- 별도 Server 단위72(위 HTTP/bean6 포함), JAR verify PASS. 두 DB 초기화 클래스는 이 단위 실행에서 명시적으로 제외했다. MySQL14는 별도 실행으로 검증했다.
- Web246/246 PASS, 타입 검사·Vite build PASS. 새 4개 시험 포함. 오류 문구 시험의 첫 실패는 기존 안전한 오류 masking 기대값을 수정해 해결했으며 제품 판정을 완화하지 않았다.
- 새 `.github/workflows/additional-runtime-bridges.yml`: Web 전체, 새 DB suite만 독립 초기화, DB 초기화 제외 단위 suite. 기존 PR #25 CI 파일은 변경하지 않는다.
- 로컬 상세 증거: `.local/bridge-verification/` 및 `.local/amvp-mysql-d0d3ac8e4d3a/`. 과거 실패 fixture 로그도 유지한다. 실제 비밀번호·로컬 DB·시험 credential 파일은 Git 제외다.

재현: Java21과 기존 Maven/MySQL8.4.8 경로를 사용한다. 새 DB suite는 `$env:FOCURVE_AMVP_BRIDGE_TESTS='1'`로 설정한 뒤 기존 `scripts/test-additional-config-mysql.ps1`의 `-BinaryDirectory`, `-MavenCommand`, 미사용 `-Port` 및 `-Tests 'AmvpRuntimeBridgeMysqlTest,AmvpRuntimeBridgeApiTest,AmvpRuntimeBridgeConfigurationTest'`를 사용한다. Server 단위는 `mvn -f runtime-server/pom.xml '-Dtest=*,!AdditionalConfigMysqlTest,!AmvpRuntimeBridgeMysqlTest' verify`, Web은 `npm --prefix frontend test -- --maxWorkers=2`, `npm --prefix frontend run build`. 두 DB 초기화 suite를 한 DB에서 동시에 실행하지 않는다.

## 다음 최소 연결

1. 윤종민 Core: verified capability/collector/clock/day carry producer와 runtime report proof 제공. 기존 인터페이스·테스트 fixture를 기준으로 연결하며 공유 계약을 임의 확정하지 않는다.
2. 채지민 Content: agreed feature/profile/effect proof 연결. 기존 Shorts 안정화를 일괄 이관하지 않는다.
3. 김다훈 Web·Server: 합의된 status unknown-hash 처리와 report read projection 연결 후 상태 패널을 기존 화면에 배치하고 관련 UI/API 시험. 생산 authority가 없으면 현재 비활성 유지.
4. 실제 Chrome/Native 검증은 별도 유효 승인 후 수행한다. 기존 UNKNOWN/HOLD·실패 증거·Credential·다른 worktree는 변경하지 않았다.

`MVP_FINAL_COMPLETE=false`. 이 PR은 독립 연동 경계 준비이며 제품 최종 수용 완료가 아니다.

## PR #27 이후 · 검증 보고·현재 상태·UI 연결

- 기준 `9a7b1d798ae9d4f6542f07310ddd09145670bfcc`, 후속 브랜치 `feature/additional-mvp-runtime-receipts`. PR #27은 Draft·미병합이며 해당 브랜치/리뷰 내용은 수정하지 않았다. 같은 작업공간을 재사용한다. 계약 기준 RC2 `e2b3fc3`, 제품 통합 기준 `202d6317`은 구분한다.
- RPT-01을 기본 비활성 HTTP로 연결했다. 실제 bearer/현재 owner/capability, package/hash/발행 시각, report epoch/seq/ID 중복·gap을 확인하고 원본 report·receipt·read projection을 item별 transaction으로 저장한다. gap은 PENDING_DEPENDENCY로 원래 ID/hash를 예약한다. SQL 실패·commit 응답 유실 시 같은 immutable 요청으로 재확인하며 성공을 추정하지 않는다.
- `EvidenceVerifier`는 **Core 담당 경계**다. operation/execution/current epoch·합법 전이·fresh observation·evidence hash 뒤의 실제 문서/효과 근거와 전체 policy coverage를 검증해야 한다. 운영 bean·가짜 producer를 만들지 않았다. 없으면503. 검증된 affected policy가 없으면 수신 ACK가 ACCEPTED여도 적용 상태는 PENDING이다.
- 원본 `amvp_reports`와 개별 receipt는 수정하지 않는다. 기존 `amvp_operations`에 private receipt profile `AMVP_REPORT_RECEIPT_1`과 mutable read cursor `RPT_STATE`를 사용한다. 이 cursor는 immutable report/receipt를 참조하며 외부 Wire 확장이 아니다. 현재 SITE_TIME의 ID·전체 내용·config version이 같을 때만 반영한다. 이전 package 보고가 더 최신 cursor를 덮지 않는다. 새 epoch/늦은 actor의 유효성은 Core verifier가 판정해야 한다.
- 기존 Admission에 기본 PENDING read hook을 추가했다. 기존 시험/다른 Admission은 그대로 동작한다. APPLIED는 검증된 현재 설정에만, FAILED/UNKNOWN은 기존 ConfigRecord enum의 UNKNOWN으로 투영한다. 상세 FAILED 원본은 report에 보존한다. enum/DTO에 임의 필드를 추가하지 않았으므로 UI에서 상세 실패 원인을 새 필드로 노출하지 않는다. CONTENT/frozen actor 및 삭제 후 release 완료는 이 runtime coverage만으로 확정하지 않고 기존 대기를 유지한다.
- 한 설정이 바뀌지 않아도 다른 설정 발행으로 package revision이 증가할 수 있다. 서버가 정확한 config version/내용을 검증한 APPLIED에 한해 UI는 `applied_runtime_revision >= saved_runtime_revision`을 허용한다. 오래된 설정 ACK로 최신 편집을 확인 처리하지 않는다. 실제 ACK revision을 저장하며 이전 revision 값으로 위조하지 않는다.
- `AmvpRegisteredClockProof`는 DB의 VERIFIED anchor, 동일 boot/clock, 서버가 선택한 wall skew, 자연일/timezone 정합성을 실제로 읽는 보수적 생산 코드다. receiver/collector 객체 재생성 후에도 기존 원장·통계를 읽는다. collector_epoch를 바꿔 restart 증명을 우회할 수 없다. 새로운 boot/clock·legacy clock 부재·전환일은 전문 clock/restart proof가 없으면 QUARANTINED. 초기 carry를 추정하거나 격리 원본을 자동 승격하지 않는다. bean 자동 등록·제품 활성화는 하지 않았다.
- 기존 AdditionalSettings에 RuntimeDeliveryPanel을 연결했다. 같은 설정 조회 결과를 재사용하여 중복 fetch 없이 예약·한도·반복·콘텐츠의 저장/적용 상태를 표시하고 재조회한다. 수정/삭제 UI·디자인 컴포넌트를 재사용하며 다른 설치의 늦은 결과를 표시하지 않는다. 실제 적용 ACK는 SITE_TIME runtime 경계에서만 준비됐고 예약/반복 actor의 실행은 여전히 별도 연결 대기다.
- legacy-lock/API 공유 파일은 수정하지 않았다. RC2 전체 재승인을 시작하지 않는다. 알려진 api.ts 전체 해시 충돌은 설계/회귀 담당의 좁은 보존 범위 결론 대기이며 독립 후속 개발의 차단 사유로 사용하지 않는다.

### 후속 검증·재개점

- 새 독립 MySQL suite `AmvpRuntimeReceiptMysqlTest`: 13건. verified/partial coverage, 영속 수신·중복·gap·UNKNOWN/FAILED, 현재 버전/후속 package, owner/hash/proof 거절, 동시성, projection SQL 실패 rollback, 실제 bearer HTTP/폐기, 구체 clock verifier·통계·receiver 재생성·drift/restart/collector reset을 시험했다. Core 효과 verifier와 anchor 등록 근거는 명시적 SYNTHETIC fixture다. 실패 주입은 빈 시험 DB의 제한된 CHECK로 수행하며 SUPER 권한을 요청하지 않는다.
- `AmvpReportApiTest`: 4건. 생산 source 부재·Web principal·restricted service·malformed JSON/query 거절. 새 suite17/17 PASS. 변경 영향의 PR #27 suite20/20, Server 단위76/76 및 JAR verify PASS. Web247/247 및 타입/Vite build PASS. 설치 전환은 조회 effect 전에 기존 행을 동기적으로 비우고 이전 응답 세대를 무효화한다. 원격 최종 결과는 후속 PR에 기록한다.
- 새 suite는 `$env:FOCURVE_AMVP_RECEIPT_TESTS='1'`와 기존 격리 스크립트의 `-Tests 'AmvpRuntimeReceiptMysqlTest,AmvpReportApiTest'`로 실행한다. suite별 DB를 따로 만들며 기존 두 초기화 suite와 섞지 않는다. 단위 실행에서는 세 `*MysqlTest` 초기화 클래스를 제외한다. 원격 후속 workflow도 별도 서비스 DB를 사용한다.
- 증거 `.local/receipt-verification/`, `.local/amvp-mysql-3f0fcff8c63b/`; 실패 시험 로그도 유지한다. 실제 설치·Chrome·Native·Core producer·운영 DB·END/복원/재기동 수용은 NOT_RUN. 사용자 데이터·이전 UNKNOWN/HOLD·Credential 변경 없음.
- 다음: Core 담당의 실제 EvidenceVerifier/clock restart/day carry 등록 연결 → 동일 RC2 계약 HTTP 수용 → Content 효과/복원 proof 연결. 미수신 hash status 합의·예약/반복/frozen 실행 보고·삭제 release 증명은 분리해서 처리한다. 이번 후속 PR은 #27 위에만 쌓고 #27 병합 후 integration으로 기준을 갱신한다. `MVP_FINAL_COMPLETE=false` 유지.
