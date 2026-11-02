# SiteController DNR guard·journal CAS

AMVP-CORE-04 / 윤종민 / `feature/additional-mvp-site-controller-dnr` / 시작 `10ab6026f1cf7d244a75ee529830afb8bcf6b8c8`. 승인 RC2 `03_Wire_D06_복원.md`의 모든 DNR writer guard·store+ID·owner/복원 의무를 재사용한다. PR59/68의 OPEN HEAD를 수정하지 않고 기존 병합55 gate에만 의존한다.

## 코드·연결

- `src/site-controller.js`: apply/remove/rollback을 `writeOwned`를 통해 공통 gate에 연결한다. 현재 classic Worker에 설치된 불변 `FocurveMemberDnrWriter.write`를 기본 주입받는다. 원래 entry/request/command/context를 복제하고 요청이 자기 footprint에만 속하는지 확인한다.
- `src/member-journal-store.js`: `save(entry,{expected})`의 내부 readwrite CAS와 `withFootprint(entry,dispatch,{applying})`의 readonly 원본 결속을 추가했다. owner/session/executor/원래 command/snapshot/rules 및 revision/action_seq를 비교한다. 신규 add는 저장 entry 전체가 같아야 하고, cleanup은 원래 immutable footprint와 오래된 seq 여부를 대조한다.
- `src/member-execution-loop.js`: 초기/복구 cleanup의 pending/final 저장에도 같은 CAS를 사용한다. 기존 private command와 로컬 auth를 확인하는 `dnrContext()`를 SiteController에 주입한다.
- `background/member-execution.js`: 기존 `scripts/build-member-worker.js`로 재생성했다. 현재 integration Member adapter도 이 namespace의 loop/store를 참조하므로 같은 구현을 사용한다. integration bundle 자체·A1/Member Core·Server/Content·공용 Schema/API/DB version/저장 필드는 변경하지 않는다. 기존 비활성 legacy runtime을 별도로 켜지 않는다.

## 권한·잠금 순서

기존 `context()/guard/recheck`의 Server 명령·세션·인증 검사는 잠금 전에 유지한다. 공통 DNR lock에서 fresh 조회에 기존 `context()`를 그대로 쓰면 Auth.serial/HTTP를 기다릴 수 있어, Auth.serial을 보유한 Guest START와 잠금 순환을 만들 수 있다.

따라서 lock 안에서는 **로컬 전용** `getDnrContext`를 사용한다. 실제 Member loop의 `dnrContext()`는 기존 auth.load만 호출해 LINKED·동일 Server/owner/executor를 확인하고 현재 private command의 ID/session/revision/desired를 반환한다. 새 Server 조회·token refresh·Auth.serial 획득을 추가하지 않는다. 이 tuple은 Worker 내부 callback이며 새 Wire/Receipt/권한 발급이 아니다. getContext를 대체하거나 Server 검증을 생략하지 않는다.

add는 잠금 획득 후 auth token을 잡고 이 로컬 문맥으로 명령·owner·기한을 다시 확인한다. native 규칙을 재조회한 뒤 **같은 journal readonly snapshot**에서 원래 entry를 확인하고, 마지막 token/기한을 동기로 검사한 직후 native dispatch한다. 그 뒤 별도 identity await가 없다. native 응답은 기존 boxed Promise로 transaction 밖에서 기다린다.

scope별 lock 순서는 기존 loop/controller serial → 공통 DNR lock → Root runtime 원장 → 로컬 auth/private command → native 규칙 → journal snapshot/dispatch다. 잠금 안에서 Auth.serial/Server HTTP 또는 loop.serial을 새로 기다리지 않는다. auth.load 자체가 기존 전환 복구 저장을 수행하면 token/phase 검사가 신규 add를 거절한다.

## cleanup·저장 실패

remove/rollback은 새 적용의 current auth/Server 명령 유효성을 요구하지 않고 원래 영속 footprint·native 규칙·최신 revision/action_seq를 대조한다. owner가 바뀌거나 APPLY가 만료돼도 이미 정당한 자기 cleanup은 유지하지만, 다른 owner/operation/외부 동일 ID 규칙을 제거하지 않는다. 잘못된 저장 Snapshot도 정상 RELEASE를 막지 않는다.

생성 시 expected:null로 기존 journal이 없음을 원자 확인한다. 후속 APPLIED/rollback·RELEASE pending/final은 읽었던 원본을 expected로 사용한다. 대기 중 새 operation/revision으로 교체되면 old rollback의 best-effort 저장도 CAS에서 거절해 새 journal과 의무를 보존한다. 저장 실패는 APPLIED/RELEASED로 위장하지 않는다. 기존 Member control namespace 저장·기존 옵션 없는 save의 의미는 그대로다.

source 전용 adapter에 gate가 없으면 이전 raw adapter를 유지한다. gate를 켠 standalone caller는 실제 withFootprint journal과 신뢰된 로컬 문맥 provider가 필수이며 누락 시 add를 거절한다. 시험의 임의 callback은 제품 권한 근거가 아니다.

## 검증

Linux Node24.19.0, 신규23/23·DNR 전체101/101·기존 SiteController/loop/runtime69/69·전체 Extension887/887·계약6/6 PASS(fail/skip0). 집합이 겹치므로 합산하지 않는다. PR59의19건/PR68의18건은 미병합 독립 구현으로 이 브랜치에 포함하지 않았다. 본 수는 기존 통합864+이번23 기준이며 다른 브랜치 수와 직접 증감 비교하지 않는다.

- 실제 SiteController/MemberJournalStore/생성 MemberExecutionLoop + fake-indexeddb·Node Web Lock: 정상 적용/해제, runtime claim 보존, queue owner/executor/revision/identity/기한 변경, auth token 변경, 이전 owner cleanup, 외부 rule ID 보존.
- 교체된 operation/revision을 old rollback/RELEASE가 덮어쓰지 않는지, CAS 생성/갱신, footprint 밖 요청·provider 누락 거절, native 실패, CAS post-effect put QUOTA/복원, invalid Snapshot RELEASE, native 대기 중 다른 DB 저장.
- 실제 MemberAuth.serial을 DNR lock 안에서 다른 작업이 보유한 상황에서 생성 Member loop의 APPLY가 auth 큐/HTTP를 중첩하지 않고 끝나는지 확인했다. Server/context/credentials 응답은 모의다.
- Linux Chromium151 실제 IndexedDB/Web Lock: 기본 불변 gate를 사용한 정상 APPLY/RELEASE 후 queue 중 새 journal operation 교체 → old rollback 거절·새 row 보존 **1/1 PASS**. DNR/identity/remote 문맥은 합성 fixture이며 MV3/실제 Server/YouTube 제품 수용이 아니다.
- 생성 Member bundle byte 일치, syntax/diff whitespace PASS. Auth VM fixture에서 URL 미주입 때문에 발생한 준비 실패는 URL만 제공해 해결했고 제품 주소/권한 검증은 완화하지 않았다(`/tmp/site-dnr-auth-fixture-failure.log`).

```sh
npm --prefix extension ci --ignore-scripts --no-audit --no-fund
node --test --test-timeout=10000 extension/tests/additional-dnr-site-controller.test.mjs
node --test extension/tests/additional-dnr-*.test.mjs
node --test extension/tests/site-controller.test.js extension/tests/member-execution-loop.test.mjs extension/tests/member-execution-runtime.test.mjs
npm --prefix extension test
node --test contracts/additional-mvp/rc1/tests/legacy-boundary.test.mjs
npm --prefix extension run check
```

선택 browser: PLAYWRIGHT_MODULE/CHROME_EXECUTABLE 지정 후 `node --test extension/tests/additional-dnr-site-controller-browser.mjs`. 로그 `/tmp/site-dnr-focused.log`, `site-dnr-regression.log`, `site-dnr-legacy-regression.log`, `site-dnr-all-extension.log`, `site-dnr-browser.log`.

## 리뷰·다음 경계

다훈: 기존 Server 검증/로컬 auth·명령 결속·잠금 순서·journal CAS/실패 복구/Receipt 경계. 지민: 원래 owner/문서/Content cleanup 의무를 SiteController/DNR 해제로 해소하지 않는지. 최신 HEAD 담당 리뷰 후 통합하며 자동 병합하지 않는다.

PR59/68의 Guest actor guard는 아직 리뷰/통합 대상이다. 현재 worker/runtime·source fallback·별도 harness 전체에 대한 coverage를 발급하지 않고 `assertWritersGuarded` 기본 거절을 유지한다. 실제 Runtime coordinator/issued binding/정책 allocator·SITE_TIME/RuntimeReport/outbox/ACK·collector/clock·Windows/MV3/장시간·전체 제품 수용은 후속이다. Node/합성 browser PASS를 전체 Core 또는 제품 성공으로 표시하지 않는다.
