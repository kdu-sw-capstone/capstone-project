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
