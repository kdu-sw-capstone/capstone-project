# 구형 GuestSession DNR 쓰기 보호

AMVP-CORE-04 / 윤종민 / `feature/additional-mvp-legacy-guest-dnr` / 시작 `10ab6026f1cf7d244a75ee529830afb8bcf6b8c8`. PR55의 승인·병합 gate를 재사용한다. PR59 Guest A1은 OPEN 상태로 보존하며 그 미병합 source/별칭에 의존하지 않는다. 기준은 RC2 `03_Wire_D06_복원.md`의 모든 writer guard·store+ID·자기 claim/복원 의무다.

## 변경

- `background/session-core.js`의 구형 GuestSession add/remove가 기존 `FocurveMemberDnrWriter.write()`를 사용한다. #55 Worker가 설치하는 동일 불변 gate·RootAuthority DB·DNR Web Lock이다. 새 writer/원장/규칙 ID 범위/외부 endpoint를 만들지 않는다.
- 내부 `guardedDnrUpdate`는 요청/원래 state를 복제하고 lock 안에서 실제 규칙을 재조회한다. 다른 내용의 동일 ID를 덮어쓰거나 지우지 않으며, 기존 gate가 runtime 미해제 claim을 보호한다.
- 신규 add는 기존 auth의 **로컬 load**로 UNREGISTERED/REGISTERED, Root idle, 현재 Guest owner/executor를 확인한다. auth serial을 중첩하지 않는다. auth 저장 token을 final DB snapshot에서 다시 대조하고 기존 execute_before·frozen Snapshot·STARTING/desired/terminal intent를 확인한 직후 동기 native dispatch한다.
- removal-only는 새 적용의 auth 허용/정상 Snapshot 조건을 요구하지 않는다. 원래 owner/session/executor·같은 snapshot bytes/자기 journal rules·current legacy route·실제 물리 규칙은 대조한다. 잘못된 저장 Snapshot도 정당한 자기 규칙의 해제를 막지 않으며 다른 실행/Content 의무를 해소하지 않는다.
- Native 응답은 기존 boxed Promise로 transaction 밖에서 기다린다. 단순 gate 통과는 RUNNING/전체 RELEASED 증거가 아니며 기존 사후 규칙 재조회·종료 저장을 유지한다.

## 실패 복구가 새 실행을 덮어쓰지 않도록 하는 저장 조건

`SessionDB.save(state,event,{scope,create})`의 마지막 인자는 Worker 내부 write precondition이다. 저장 schema/DB version·기존 필드·공용 Wire/API는 불변이며 옵션 없는 기존 호출 의미도 그대로다.

구형 `persist`는 항상 원래 owner/session scope를 전달한다. 같은 readwrite transaction의 current pointer가 그 scope여야 갱신할 수 있다. 새 START의 최초 저장만 create=true이며, 이전 current가 없거나 이전 legacy session이 terminal이고 journal desired/observed 모두 RELEASED인 경우만 교체한다. A1 execution_contract·다른 실행의 current·미해결 journal을 이전 legacy snapshot으로 덮어쓰지 않는다.

잠금 대기 중 current가 A1으로 넘어가면 새 add를 거절한다. 뒤따르는 legacy 실패 저장과 cleanup도 새 current를 변경하지 않고 기존 행을 보존한다. 기존 owner-only 접근을 우회하는 새 cleanup API는 추가하지 않았다. END intent 저장 자체가 실패했지만 같은 원래 scope/footprint가 확인되면 원래 규칙 해제는 계속 시도하고, 오류를 유지하며 ENDED로 위장하지 않는다.

isolated source consumer에 gate가 없으면 기존 raw adapter를 유지한다. 실제 Worker는 동기 importScripts를 끝내며 #55 gate를 로드한 뒤 실행 event를 처리한다. 이 fallback이나 gate가 모든 legacy writer를 보호한다는 주장은 하지 않는다. SiteController raw writer 및 전체 coverage는 후속이며 `assertWritersGuarded` 기본 거절을 유지한다. Guest A1/Member Core·Content·Server·관측·공용 계약은 수정하지 않았다.

## 검증

- 신규18/18, 기존 session-core19/19, 관련 DNR96/96, 전체 Extension882/882, 계약6/6 PASS(fail/skip0). 시험 집합은 겹치므로 합산하지 않는다. PR59의883과는 기반이 다르다: 본 브랜치는 PR59 신규19건을 포함하지 않고 구형 Guest 신규18건을 포함한다. 테스트 삭제나 실패 생략으로 수를 줄인 것이 아니다.
- 실제 classic GuestSession/SessionDB/공통 writer source, fake-indexeddb·Node Web Lock·모의 Chrome DNR/owner/auth를 사용한다. 정상 시작/종료, runtime claim 보호, owner/executor/identity/auth/기한 변경, 다른 owner cleanup, 동 ID 외부 규칙 보존, A1 handoff/다른 legacy current 보존, 저장 실패 cleanup, 잘못된 Snapshot RELEASE, auth token 변경, native 대기 중 DB 쓰기, terminal이지만 미해결 journal의 새 START 거절을 확인했다.
- Linux Chromium151 실제 IndexedDB/Web Lock의 정상 legacy START/END 후 queued START→A1 current handoff 보존 **1/1 PASS**. DNR/owner/auth/A1 admission은 합성 fixture이며 실제 MV3/Windows/네트워크 차단 또는 제품 handoff 수용이 아니다.
- npm syntax·diff whitespace PASS. 생성 bundle 변경은 없다. 이 브랜치는 원래 classic scripts를 직접 사용한다.

```sh
npm --prefix extension ci --ignore-scripts --no-audit --no-fund
node --test --test-timeout=10000 extension/tests/additional-dnr-legacy-guest.test.mjs
node --test extension/tests/session-core.test.mjs
node --test extension/tests/additional-dnr-*.test.mjs
npm --prefix extension test
node --test contracts/additional-mvp/rc1/tests/legacy-boundary.test.mjs
npm --prefix extension run check
```

선택 browser: PLAYWRIGHT_MODULE/CHROME_EXECUTABLE 설정 후 `node --test extension/tests/additional-dnr-legacy-guest-browser.mjs`. 로그 `/tmp/legacy-guest-focused.log`, `legacy-guest-dnr-regression.log`, `legacy-guest-all-extension.log`, `legacy-guest-browser.log`. 첫 준비에서 fixture의 include_subdomains boolean 누락으로 Snapshot 거절/queue 대기가 발생해 중단 후 필수 값을 채웠다. END 저장 실패 주입은 첫 readwrite인 recover 저장이 아니라 실제 RELEASED journal 저장에 주입하도록 수정했다. 제품 안전 조건을 완화하지 않았으며 이전 로그를 `legacy-guest-fixture-failure.log`, `legacy-guest-end-injection-failure.log`에 보존했다.

## 리뷰·남은 범위

다훈: 원래 scope/저장 precondition·현재 인증/Root·잠금·실패 복구 및 API/Receipt 경계. 지민: A1/Content 문서·owner/cleanup 의무를 legacy 종료로 덮거나 해소하지 않는지. 최신 HEAD에 대한 재현/리뷰 후 통합하며 자동 병합하지 않는다.

PR59는 별도 미병합/리뷰 대상이다. SiteController raw writer, 실제 issued binding·SITE_TIME 정책 집행·RuntimeReport/outbox/ACK·collector/clock·전체 제품 수용은 미완료다. 새 공유 정책을 활성화하거나 실제 MV3 성공/전체 Core 완료로 표시하지 않는다.
