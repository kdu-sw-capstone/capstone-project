# AMVP-TIME-05 — 예약·한도·시간 측정

- 담당: 윤종민. 브랜치 feature/additional-mvp-core, 시작 기준 da1c70b2b2052dece581353f81cd5eb6c604e4b1.
- 기준: AMVP-CONTRACT-20261029-RC2; docs/design/additional-mvp-contracts/04_정책_시간.md C05/C07/C11, 06_인계_승인.md AMVP-TIME-05.
- 일정: 사용자가 전달한 최신 일정의 11/2 예약·한도·시간 측정 우선. 개발운영.md 초기 일정보다 최신 사용자 일정이 우선한다.
- 시작 상태: Core-04 부분 구현. 기존 세션 시계/monotonic 사용은 있으나 추가 MVP 독립 collector·idle 관측 구현은 확인되지 않았다. 계약 Python 참조 모델은 제품 구현 완료 증거가 아니다.

## 2026-10-30 첫 구현 단위

- 추가: extension/src/additional-idle-observer.js. Chrome idle/permissions API를 주입받는 Worker 관측 모듈. threshold 60, 최초 미관측 UNKNOWN, active/idle/locked 경계 관측, 권한 거절/회수/API 오류에서 제한 필요 상태를 제공한다.
- 최초 query 지연 응답은 후속 이벤트를 덮어쓰지 않는다. stop/restart/권한 회수는 이전 조회를 무효화하며 listener 중복 등록을 막는다. 권한 회수 후 active 이벤트도 수집을 재개하지 못한다.
- 관측 timestamp는 수신 시점의 monotonic 값이다. 정확한 마지막 입력 시각이나 지연 없는 idle 전환 증거가 아니며 첫60초를 소급 차감하지 않는다. collectionEligible은 다른 전경/탭/anchor 조건이 필요한 후보일 뿐 확정 계수 허가가 아니다.
- 실행: `node --test extension/tests/additional-idle-observer.test.mjs` **6/6 PASS**. API/권한/시계 모의 시험. syntax와 git diff --check PASS. 실제 Chrome idle/권한 회수/지연 시험 미실행.
- 제품 manifest/Worker 활성화, DNR 제한 적용, shared Wire·Schema 변경 없음. UNKNOWN 출력은 실제 차단 완료 증거가 아니다.

## 남은 작업과 재개 지점

1. 실제 Worker adapter의 전경 창·활성 탭·URL·idle 경계 결속. C05 미확인 tail 격리와 권한 복구 조건 확인 후 재개.
2. privileged anchor/cursor와 raw/reservation/outbox 원자 저장·재시작 복구. 한도 집행은 Core-04 guard 연결 필요.
3. 설치별 한도·자정/DST/시간대 전환·동일 설치 회원전환 잔여 예산 보존.
4. 예약 occurrence 멱등성·활성 세션 우선·고정 종료·60초 미만 미시작·DST gap/fold 처리.
5. 실제 Chrome·Worker 재생성·장시간 측정·저장 장애·차단 지연 검증. 승인된 수치 목표를 모의 PASS로 대체하지 않는다.

종료 상태: AMVP-TIME-05 부분 구현(첫 관측 모듈). 예약/한도/시간 측정 전체 완료 아님. Commit/Push 미실행. 기존 Core-04 미커밋 변경 보존.

## 전경·탭·idle 관측 연결 단위

- `extension/src/additional-foreground-observer.js`가 idle adapter와 Chrome windows/tabs 조회·이벤트를 결합한다. 전경 일반/팝업 창의 유일한 활성 http(s) 탭만 수집 후보로 제공한다. 전체 URL/검색어는 경계 출력에 포함하지 않는다.
- 탭/창/URL/교체/이동/idle 이벤트마다 UNKNOWN 경계를 먼저 발행하고 기존 조회 revision을 무효화한다. 같은 host의 다른 탭 전환도 경계다. 탭 조회 후 포커스를 재확인하며 조회 실패·URL 비공개·pending navigation·모호한 활성 탭은 UNKNOWN이다.
- stop/start lifecycle을 분리해 이전 시작·조회가 중단된 관측을 되살리지 못하게 했다. stop도 수집 종료 경계를 제공한다.
- 각 관측은 callback 수신 시점일 뿐 원자 snapshot이나 확정 이용시간이 아니다. `priorTailRequiresValidation`을 유지하여 OS/이벤트 지연 tail은 이후 C05 검증·격리 대상이다. 저장/anchor adapter가 없으므로 확정 duration을 생성하지 않는다.
- 최초 시험 12/13: 시작 시 재조회로 포커스 소실이 이미 확인된 INELIGIBLE 결과를 UNKNOWN으로 기대한 시험 1건 실패. 시작 완료 후 조회 중 포커스 변경을 주입하도록 시험을 분리했다. 제품의 수집 허가 조건은 완화하지 않았다.
- 최종 실행: `node --test extension/tests/additional-foreground-observer.test.mjs extension/tests/additional-idle-observer.test.mjs` **14/14 PASS** (전경8+idle6). Chrome APIs 모의 검증. syntax·diff whitespace PASS.
- 종료 상태: 관측 adapter 연결 구현까지 완료. 실제 제품 Worker entrypoint/manifest에는 미연결이며 실제 Chrome 이벤트 시험 미실행. 다음은 이 관측 경계를 받는 raw/cursor·검증 anchor·불확실 구간 저장 경로다. 예약/한도 집행과 제품 통합은 계속 미완료. Commit/Push 없음.

## 로컬 관측 원본·cursor 영속 저장 단위

- `extension/src/additional-observation-journal.js`: 기존 실행 DB metadata transaction에 `amvp_journal_v1:time-observations` 저장. 원본 capture·순번·이전 hash·cursor를 한 transaction에 기록한다. 기존 DNR sidecar와 Journal1.1은 보존한다.
- 내부 staging 형식이며 승인 Wire `ClockedUsageSegment`나 Server outbox가 아니다. trusted anchor/day allocation 없이 confirmed_ms·reservation을 만들지 않는다. 따라서 C05 raw/cursor/reservation/outbox 전체 원자 경로는 아직 완료되지 않았다.
- owner/executor/boot 문맥을 각 원본에 보존한다. start마다 epoch를 올리고 RESTART_UNCONFIRMED 의무를 저장한다. 이전 epoch 쓰기 거절, 동일 ID/원본 멱등, 다른 원본 충돌, CAS cursor 충돌, 같은 epoch monotonic/revision 역행 거절.
- 복구 시 hash chain·cursor·payload hash 검증. 저장 실패 시 원본과 cursor 모두 rollback. capacity 초과는 보류 데이터를 삭제하지 않고 거절한다. caller는 거절을 수집 성공으로 처리하면 안 된다. capacity는 내부 보호 한계이며 제품 성능/보존 기간 승인이 아니다.
- 검증: `node --test extension/tests/additional-observation-journal.test.mjs extension/tests/additional-foreground-observer.test.mjs extension/tests/additional-idle-observer.test.mjs` **21/21 PASS** (신규 저장7+관측14). fake-indexeddb 기반, Chrome API 모의. syntax/diff whitespace PASS.
- 미완료: observer callback의 순차 저장 실행 연결, privileged anchor·day 검증, immutable segment/reservation/outbox 생성, hold의 실제 DNR 집행과 복구 해소, 실제 Chrome 저장/강제 종료·장시간 시험. 현 구현은 전체 원본을 재검증하는 bounded staging으로 장시간 성능 미검증.
- 다음 최소 작업: 관측 callback→순차 durable append 연결 및 저장 오류 시 수집 중단/미확인 유지. 그 뒤 anchor adapter 승인 조건 안에서 segment 생성·원장 연결. 제품 Worker entrypoint/manifest 활성화와 Commit/Push 없음.

## 관측→순차 저장 실행 연결

- `extension/src/additional-time-runtime.js`에서 실제 foreground observer와 observation journal을 연결. journal epoch/start 의무 저장 후 관측 시작, callback 입력 복제·UUID 발급·직렬 append, 정상 stop 경계까지 drain한다.
- append 실패/queue capacity 초과 시 FAILED로 전환하고 observer를 중단한다. 실패한 원본과 대기 항목은 현재 객체에 남기며 자동 재시작/성공 응답하지 않는다. 메모리 대기는 브라우저 종료 후 보존된다고 주장하지 않는다. 저장된 restart 의무는 미확인 상태를 유지한다.
- 중단 도중 이전 start가 늦게 완료되는 경우 관측을 다시 열지 않고, 이전 start 미종료 중 새 start를 거절한다. queue 종료 직전 추가 이벤트도 drain하며 cursor 경쟁을 만들지 않는다.
- OBSERVING은 관측 원본 저장 상태일 뿐 확정 측정/APPLIED가 아니다. 모든 runtime 상태에서 measurementQuality UNKNOWN·한도 사이트 제한 필요를 유지하며 실제 DNR 제한 완료는 주장하지 않는다.
- 관련 자동 검증 **27/27 PASS**: `node --test extension/tests/additional-time-runtime.test.mjs extension/tests/additional-observation-journal.test.mjs extension/tests/additional-foreground-observer.test.mjs extension/tests/additional-idle-observer.test.mjs`. 신규 runtime6, 기존21. fake-indexeddb 및 Chrome API 모의.
- 실제 Linux Chromium151: 모듈 import→native IndexedDB start→관측→stop→새 DB wrapper recover 성공, 5 captures와 마지막 STOP 경계 확인. Chrome tabs/windows/idle는 모의이므로 실제 확장 API 검증과 구분. syntax·diff whitespace PASS.
- 종료: 관측에서 durable staging까지 연결 단위 완료. 제품 Worker entrypoint는 여전히 미연결. 다음은 승인 anchor/날짜 배정 adapter와 staging→ClockedUsageSegment·provisional reservation 변환 경계 구현이며, 기존 원장/전송 계약을 재사용한다. 실제 한도/예약/제품 통합 미완료. Commit/Push 없음.

## 첫 TIME-05 리뷰 제출 단위

- PR34 양 담당자 승인·병합 확인 후 최신 integration 기준을 ff-only 반영. 전경/idle 관측4모듈·시험4파일·본 카드·전용 Ubuntu/Windows CI만 제출한다. 통합현황 로컬 편집은 보존한다.
- 제출 점검에서 epoch0의 미시작 collector가 append 가능함을 회귀시험으로 재현(7PASS/1FAIL)하고, 양의 safe integer epoch 필수 검증으로 차단했다. 이 추가 시험을 포함해 TIME 관련28/28 PASS.
- 제출 범위는 bounded local staging 기반이다. 신규 시간 raw Wire·Server outbox·confirmed_ms·quota debit은 아직 생성하지 않는다. 모든 상태는 measurement UNKNOWN·실제 한도 사이트 hold 필요를 유지한다. 실제 DNR 적용 성공을 주장하지 않는다.
- observer callback→순차 durable append까지 완료한 모듈 리뷰 요청. 제품 Worker 진입점/manifest·anchor 발급·day allocation·한도·예약·실제 Chrome 확장 수용은 미완료다. 실제 tabs/windows/idle는 모의 시험이며 기존 Chromium151 native IndexedDB 시험과 구분한다.
- 검증 명령: node --test extension/tests/additional-idle-observer.test.mjs extension/tests/additional-foreground-observer.test.mjs extension/tests/additional-observation-journal.test.mjs extension/tests/additional-time-runtime.test.mjs. 기존 계약 Node6/6와 npm run check도 제출 전 실행한다.

## PR38 리뷰 대기 중 독립 예약 판정 단위

- `extension/src/additional-schedule-plan.js`: Core가 재사용할 순수 주간 예약 시각 계산과 실행 후보 판정. 기존 AmvpScheduleBridge의 회원 occurrence 발급/DB/session actor를 재작성하지 않는다. 새로운 Wire/API/occurrence ID를 만들지 않으며 ONCE actor 연결 미합의는 보존한다.
- WEEKLY local date/weekday/IANA 시각을 UTC 후보로 변환해 gap SKIP/fold EARLIER_ONCE를 적용. 단순 +/-1h 보정을 쓰지 않고 인근 offset을 열거하여 Lord Howe 30분 전환과 Apia 누락 날짜도 확인했다. 26h 양방향 탐색의 CPU 비용은 제품 규모에서 미검증이며 실제 scheduler event loop에 아직 연결하지 않았다.
- 실제 경과 duration으로 fixed end를 유지. 잔여 정확60초 READY/60초 미만 SKIPPED(EXPIRED), active session WAITING_CONFLICT, 이미 발급된 발생 ALREADY_ISSUED, restart catch-up WAIT_USER. 순수 helper의 decision은 기존 actor status/명령으로 전송하지 않는다.
- 중복 판정의 alreadyIssued와 activeSession/recovered는 내부 검증 adapter 입력이다. 이 helper만으로 영속 멱등/owner·version·clock 신뢰/실제 APPLY를 보장하지 않는다. 후속 adapter가 기존 발생 원장과 고정 버전/종료를 검증해야 한다.
- 자동: `node --test extension/tests/additional-schedule-plan.test.mjs` 8/8 PASS. 독립 Python zoneinfo와 US/EU/한국/Nepal/Lord Howe/Apia 9개 벡터 대조 9/9 PASS. syntax 및 diff whitespace PASS. 실제 Chrome alarm/백그라운드/Worker 재시작·회원 actor 연결은 미검증.
- 범위: 예약 판정 모듈 단위 구현 완료, 예약 제품 기능은 부분 구현. PR38 HEAD/리뷰/원격 브랜치 변경 없이 로컬로 보존하며, 현재 리뷰 단위와 섞어 Push하지 않았다. PR38 리뷰 반영 뒤 다음 제출 단위로 정리한다.

## PR38 P2 권한 회수 수정·재리뷰

- 리뷰 지적: tabs/origin 관측 권한 회수 중 pending tabs.query 응답이 revision을 통과해 CANDIDATE를 발행할 수 있음.
- 수정 14b96fb2a1def7c80193eecfcaa464d26e34d1e7: permissions.onRemoved를 foreground lifecycle에 결속. tabs 또는 origin 회수 시 revision 증가·UNKNOWN/hold 고정. 명시적 start 뒤 현재 tabs 또는 해당 URL origin 권한 확인 후 새 관측만 허용. 지연 권한 조회도 revision 검사.
- 추가 회귀3건: tabs/origin 회수 중 pending 조회, 권한 확인 중 회수, origin-only 권한. TIME31/31·npm check PASS. 최신 HEAD Ubuntu/Windows CI 모두 SUCCESS(41050538755; 계약6건 포함). 실제 권한 회수는 모의이며 Chrome 제품 시험 미실행.
- 수정2파일만 Commit/Push. 예약 모듈/시험 및 작업카드의 독립 작업 기록은 이번 commit에서 제외·로컬 보존. PR38 수정결과 댓글 https://github.com/kdu-sw-capstone/capstone-project/pull/38#issuecomment-6521904638 로 재리뷰 요청. 자동 승인/병합 미실행.

## 2026-10-31 예약 판정 단위 제출

- PR38은 14b96fb 기준 양 담당자 승인 후8ba2502로 병합된 것을 GitHub에서 확인. 로컬 변경 보존 후 최신 통합1f18613e64eb6294bbef14f76af683ee62a68f1b를 ff-only 반영했다.
- 이번 제출은 순수 예약 helper·시험·본 작업카드·전용 CI 총4파일. 기존 PR38 모듈을 재제출하지 않고 예약 actor/DB/API/Worker/manifest/공유계약을 변경하지 않는다.
- 순수 helper 입력의 activeSession/alreadyIssued/recovered와 시각은 신뢰 adapter가 검증해야 한다. READY는 실제 세션 시작 허가나 RUNNING 증거가 아니다. 중복 판정은 영속 발생 원장·owner/version 검증과 함께 사용해야 하며 본 모듈은 영속 멱등을 구현하지 않는다.
- 실행기 연결 전 실제 시간대/이벤트 loop 성능·alarm 지연·재시작·실제 적용/복원을 검증해야 한다. Server weekly 구현을 변경하거나 ONCE legacy actor 매핑을 임의 확정하지 않는다. 제품 기능 전체는 부분 구현이며 작은 모듈 리뷰 단위다.
- 최신 기준 예약8/8·계약6/6·syntax/whitespace 검증 후 Commit/Push 및 PR 제출. 원격 CI는 Ubuntu/Windows Node24에서 같은 예약·계약 검증을 수행하며 Chrome 수용은 아니다.

## 2026-10-31 회원 예약 claim 연결 준비 리뷰 단위

- 담당 윤종민. PR43이 OPEN이므로 그 HEAD를 변경하지 않도록 별도 feature/additional-mvp-schedule-claim 브랜치와 /workspace/focurve-schedule-claim 작업 공간 사용. 시작 기준2bf04f0(PR45 병합 포함), PR43 pure helper에 의존하지 않는다. 원래 작업 공간의 로컬 초안은 보존.
- MemberA1Adapter.claimSchedule은 trusted background 전용의 준비 경로다. 기존 인증 request/serial 및 schedule 목록·claim·occurrence·session 조회와 tickInner 검증 경로 재사용. 수동 START fallback·새 Wire/API/DB/발생 원장·공개 listener/자동 alarm 호출 없음.
- 입력은 queue 전 복제. owner/executor/config version/enabled/고정 종료를 대조하고, 반환 session을 정확한 Server occurrence(schedule/start/version/end/session_id)에 재결속한다. session GET 재확인 후 기존 명령 경로를 호출하며 반환 execution의 session ID도 대조한다. ACK만으로 RUNNING 처리하지 않는다. waiting/skipped와 오류/응답 유실은 보존하며 재시도는 같은 Server unique occurrence identity를 사용한다.
- 기본 차단: 현재 Core에는 verifyScheduledDeadline 구현이 없다. 함수가 없거나 true가 아니면 claim POST 전에 SCHEDULE_FIXED_END_UNSUPPORTED로 거절한다. 이 내부 verifier는 미래 trusted Core 고정 종료 집행 구현을 위한 경계이며 공개 Wire/capability 계약이 아니다. 시험의 true stub은 합성 가정이다. 실제 Server Actor도 미연결이며 두 조건을 제품 증거 없이 충족 처리하지 않는다.
- 새 시험14/14 PASS: owner/version/source/fixed-end, immutable input, 응답 유실, guest/END-only, actor 오류, 실제 Core 기본 거절, occurrence→session 불일치, local execution ID 불일치, 불완전 occurrence 조회 및 배포 bundle 검증.
- 최신 통합 기반 전체 Extension npm test816/816 PASS(fail0/skip0), 계약 Node6/6, syntax·whitespace·source/bundle exact match PASS. 과거 초안820은 PR43 미병합 pure helper8건을 포함한 다른 기반이므로 현재 수와 직접 비교하지 않는다(이번 신규는10→14). API/고정 종료 지원/명령 진행은 모의이며 실제 Server/Chrome/Native 수용 아님.
- 배포 adapter bundle만 재생성했다. Core/Content bundle, manifest, shared schema/Server 생산 코드는 변경하지 않았다.
- 리뷰 필요: 기존 회원 adapter·예약/소유권·실행 전달에 영향을 줄 수 있으므로 다훈(Server actor/occurrence/응답 결속)·지민(Content scope/복원 경계)의 담당 리뷰가 필요. 제품 실행/고정 종료 완료 PR이 아닌 기본 거절을 유지한 연결 준비 단위다. 자동 병합/활성화는 하지 않는다.
- 남은 작업: Core 고정 종료 집행·검증(종민), Server Actor(다훈), 이미발급 old-version occurrence 조회/종료·재시작/응답 유실·실제 적용/해제 수용. 현재 설정을 바꿔 이전 실행의 duration/end를 다시 계산하지 않아야 한다. 이 변경은 기존/종료 occurrence 전체 복구 기능을 제공하지 않는다.

## 2026-10-31 PR46 P2 — Server claim 이전 로컬 복원 의무 검사

- 기준 HEAD573a5c9439e2b7f51cffae078ed9dd8014601b4f, 기존 feature/additional-mvp-schedule-claim에서 수정. 다훈 리뷰4430202605의 UNKNOWN/cleanup 반례를 먼저 실패로 재현한 뒤 수정했다. PR43/48 및 다른 작업 공간은 변경하지 않았다.
- claim POST 전에 Member Core aggregate(owner/executor/status/journal), unresolved binding·미완료 operation, RootAuthority, Guest 의무와 미완료 member:start-intent를 읽는다. UNKNOWN/HOLD/활성 상태·복원 미확인·외부 owner·저장 실패를 idle로 승격하지 않는다. 현재 root ACTIVE 또는 복원 의무가 있으면 새로운 occurrence mutation을 금지한다.
- 같은 occurrence 재시도는 schedule_id/start/version과 Server occurrence/session/owner/executor/fixed end를 결속한 GET-only 조회로 구분한다. read_only=true/recovery_required=true와 기존 local 상태를 반환하며 POST·tickInner·APPLY 재실행·cleanup 삭제·RUNNING 승격을 하지 않는다. 다른 occurrence, 복수 실행 의무, 불완전 조회 또는 식별 불일치는 거절한다. old-version 조회에서 현재 schedule duration으로 end를 재계산하지 않는다. 이 읽기 경로는 기존 복원 작업을 실행해 주는 기능이 아니다.
- 새 claim의 fixed-end verifier 뒤에 로컬 상태를 재확인하고, 실제 request가 인증 정보를 획득한 뒤 fetch 직전에도 같은 guard를 실행한다. adapter serial을 재사용하며 Core serial/DB transaction을 네트워크 동안 붙잡거나 새 영속 원장/공용 계약을 추가하지 않는다.
- claim 시험26/26 PASS(기존14+신규12): P2에서 POST0, 같은 발생 GET-only 회복·UNKNOWN/debt 보존, 다른 start/version/schedule, owner/fixed end 불일치, terminal 뒤 binding/operation 의무, 정상 released 신규 claim, start-intent 충돌, root/다른 owner, 저장 오류, 비동기 verifier/credentials 중 상태 변경, 실제 request guard 정상 전송, 갱신된 배포 bundle 포함.
- 검증: focused5파일78/78, 전체 Extension828/828(fail0/skip0), 계약6/6, npm --prefix extension run check, git diff --check, adapter source/bundle exact match PASS. Node24.19.0에서 실행. API·Core 상태는 모의이며 실제 request 시험도 fetch 대체를 사용했다. 실제 Server/Chrome/Native·고정 종료 제품 수용 미실행.
- 재현 명령(저장소 루트): node --test extension/tests/member-schedule-claim.test.mjs; 기존 PR 본문의 focused/전체/계약/check 명령도 동일하다.
- 종료 상태: P2 수정·로컬 회귀 완료, PR46 최신 HEAD로 Push 후 다훈·지민 재리뷰 및 원격 CI 확인 필요. 이전 Approve를 수정본 승인으로 간주하지 않는다. 실제 Core verifyScheduledDeadline/Server Actor 연결과 예약 제품 실행은 계속 미완료이며 기본 거절을 보존한다. 병합/활성화하지 않는다.

### 최신 통합 기준 반영 — 2026-10-31

- P2 수정 Push 뒤 GitHub mergeable_state=dirty를 확인하여 최신 integration dfa787f07d02b54366a69f107c1edfa058cb8b2a(PR36/43 병합 포함)를 작업 브랜치에 반영했다. 충돌은 본 작업카드의 추가 기록뿐이며 양쪽 기록을 모두 보존했다. 제품 source 충돌은 없었다.
- 통합 후 전체 Extension836/836 PASS(기존 P2 수정 기반828+PR43 예약 판정8), focused78/78·계약6/6·syntax·bundle 일치·whitespace PASS. 제품 활성화/통합 브랜치로의 PR 병합은 수행하지 않았다. 최종 HEAD 재리뷰와 해당 원격 CI가 필요하다.

## 2026-10-31 PR46 추가 P2 — 최종 identity 대기와 dispatch 경계

- 기준0046a1d65ddfbff0a2ac5042f93847b235f9ae3c, 리뷰4430445010. 실제 prototype request에서 마지막 identity 대기를 보류한 사이 UNKNOWN/cleanup을 생성한 반례를 수정 전26 PASS/1 FAIL로 재현했다.
- request의 최종 identity 재확인을 최종 admission보다 먼저 끝낸다. claim의 마지막 guard와 동기 fetch 시작은 dispatchScheduleClaim에서 같은 Core.serial 안에 둔다. guard 이후 identity/credentials 조회나 별도 await를 삽입하지 않는다. 지원 serial이 없으면 SCHEDULE_ADMISSION_UNSUPPORTED로 전송하지 않는다.
- fetch response Promise를 객체로 감싸 반환하여 실제 네트워크 완료는 Core.serial 밖에서 기다린다. 기존 aggregate/registry/authority/start-intent/Guest 검사와 같은 occurrence의 GET-only 회복, 기본 fixed-end 거절은 보존한다. 공용 Wire/Schema·Server API·RootAuthority 저장 형식은 변경하지 않았다.
- 경계 책임: 이 직렬 경계는 Core.serial을 통한 실제 Core 상태 전이와 fetch 시작을 순서화한다. 다른 코드가 Core 저장소/RootAuthority를 직접 수정해 경계를 우회해도 안전하다는 의미가 아니다. 제품 연결 때 Guest/인증/RootAuthority 전이의 기존 소유권 경계를 함께 검증해야 하며 provider 부재의 기본 차단을 유지한다.
- 신규4건: 정확한 최종 identity 지연 POST0, 먼저 대기하던 Core UNKNOWN 이후 POST0, guard/fetch 시작 순서와 응답 대기 중 Core 작업 진행, serial 부재 거절. claim30/30, 관련82/82, 전체 Extension840/840(fail0/skip0), 계약6/6·syntax·source/bundle exact match·whitespace PASS. Node24.19.0의 모의 auth/Core/fetch 시험이며 실제 Server/Windows Chrome 수용은 아니다.
- 수정 파일은 adapter source·배포 bundle·claim 시험·본 카드 4개. 최신 HEAD Push 뒤 담당자 변경분 재리뷰와 원격 CI 확인 필요. 제품 예약 실행 완료·PR 병합으로 표시하지 않는다.
