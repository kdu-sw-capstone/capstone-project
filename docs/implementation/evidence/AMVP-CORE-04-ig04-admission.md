# IG04 Core 사전 검증 경계

## 단위/기준

AMVP-CORE-04 하위 첫 IG04 연결 단위, 담당 윤종민. 시작 integration `831069805eb0f86fc526b1f0f92e0b4a01656172`, Content 기준 `8f454c937c905ed7ad4e0650274e27b2830812ea` 및 선행 gate3abe4504/#83 1291aeb. Content 선행 소스를 이 PR에 복사/병합하지 않는다.

설계: `docs/design/additional-mvp-contracts/03_Wire_D06_복원.md`의 issued/sender/full scope·효과 전 영속 예약/cleanup, `05_Content_Event_UI.md`의 IG04·관측/복원, `contracts/additional-mvp/rc1/schema.json`의 BindingScope/FocusRef. 기존 DocumentControlRegistry 수명/조회, A1 canonical digest를 재사용한다.

## 구현과 한계

`IG04PlanAdmission.open(options)`은 문맥을 복사·동결하고 문서 Registry의 native ref/ACTIVE epoch를 대조한다. trusted `verifyIssued(context)`/`verifyNative(context)`와 동기 `isCurrent(context)`는 strict true가 필요하며 기본값은 거절이다. callback은 실제 provider 구현이 아니며 시험의 true 반환은 모의다. provider는 전체 원래 Control/Projection/BindingScope·frozen IG04 활성화·native 문서/등록 채널·owner/generation·유효기한을 검증해야 한다.

constructor 직접 호출은 거절한다. `verifyContext(candidate)`/`getGeneration()`은 검증했던 로컬 문맥과 현재 authority/deadline만 동기 비교한다. native 비동기 API를 동기 callback에 넣지 않는다. 생산 lifecycle/owner invalidation caller는 미연결이다.

`verifyPlan(plan,{signal})`은 Content8f454c93의 bound plan 구조, display/inert 효과/복원 계획, reservation_identity/context hash·plan hash를 검사한다. issued/native 검증·Registry 조회 전후 권한/만료·문서 epoch를 재검사하고 gate/local document UUID를 이 instance에 고정한다. authority 상실은 영구 폐기한다.

반환은 **동결 plan 객체**이며 Content용 plan_id ACK가 아니다. 영속 commit/CleanupGrant/DOM/receipt/Report/전체 종료를 발급하지 않는다. 향후 저장 caller는 별도로 예약을 commit하고 같은 잠금/transaction의 쓰기 직전에 `assertCurrent()` 및 실제 저장 전제조건을 다시 확인해야 한다. 이 함수만으로 authority와 저장이 원자적으로 결속된 것은 아니다.

로컬 자원 상한은 plan JSON32768문자/원 CSS4096문자다. Wire/cleanup 예산·TTL을 변경하지 않으며 생산 연결 전 profile/계약 확인이 필요하다. Schema 해석은 기존 BindingScope/FocusRef의 vocabulary에 한정하고 Control/Projection/전체 계약 validator라고 주장하지 않는다.

Registry는 조회만 한다. 문서 intent인 stage를 대상별 영속 복원 예약 ACK로 오용하지 않았다. 기존 의무·원장·A1/Content/Wire/Server schema는 불변이다. 제품 bundle/entry에 import하지 않았다.

## 검증

```
cd extension
npm ci --no-audit --no-fund
node --test tests/additional-ig04-admission.test.mjs tests/document-control-registry.test.mjs
npm test
node --test ../contracts/additional-mvp/rc1/tests/legacy-boundary.test.mjs
```

신규32 + 기존Registry15 =47/47, 전체Extension1011/1011, 계약6/6 PASS(fail/skip0). 중복 집합 합산 금지. 문맥/plan 변조, owner epoch/tab/frame/focus/schema, operation/hash/generation/target, verifier await 중 owner 변경, 만료, 문서교체/BFCache 재활성 epoch, native/저장 조회 실패, abort, gate 교체, 마지막 동기 guard를 검증했다. Node24.19.0/fake-indexeddb이며 발급/native는 모의다.

최초 관련45건은44PASS/1FAIL. fixture 준비 전에 rejected Promise를 생성해 unhandledRejection이 발생했다. provider 호출 시 생성하도록 fixture만 수정했고 반례를 skip/제거하지 않았다. 이후 abort/조회실패2건을 추가한 최종47/47이다.

별도 Content 호환 probe:

```
IG04_CONTENT_ROOT=/path/to/clean-8f454c93-worktree \
PLAYWRIGHT_MODULE=/path/to/playwright \
CHROME_EXECUTABLE=/path/to/chromium \
node extension/tests/additional-ig04-content-compat-browser.mjs
```

exact Content HEAD와 content source clean을 검사한다. Linux Chromium151 headless 실제 IndexedDB + 실제 Content 소스의 bound plan 구조/canonical/hash 호환1/1 PASS. 발급/native/provider는 모의다. callback은 plan 검증 후 ACK를 반환하지 않으며 DOM 효과0·Registry operation 추가0·Content cleanup 의무 보존을 확인했다. 설치 확장/실제 Instagram/MV3/START 수용은 NOT_RUN. 외부 exact Content checkout과 브라우저가 필요하여 기본 CI에는 포함하지 않는다. 전용 CI는 Ubuntu/Windows47건+계약6건이다.

## 남은 연결/리뷰

영속 예약·조회/atomic owner fence와 cleanup grant/슬롯·실제 ACK 형식, 실제 issued/native/sender/channel provider 및 invalidation, snapshot→EffectEvidence/RestoreEvidence/footprint/profile/scan mapping, scoped RELEASE·영속 terminal proof→completeReservation, 재시작 복구, Worker listener/START는 미완료다.

PR76/78/80 outbox/producer/replay 및 PR84 SITE_TIME은 변경/병합하지 않는다. 검증된 IG04 증거가 준비된 뒤 기존 Report 경로를 재사용한다. 공동 합의 전 ACK/proof 성공 형식을 임의 확정하지 않는다.

리뷰 필요: 다훈은 issued/native provider·향후 atomic 예약/scope 경계, 지민은 Content8f454c93 구조/hash/context callback·ACK 없음의 의미를 확인한다. 이 단위 통과가 Core 전체/IG04 제품 연결 완료가 아니다.
