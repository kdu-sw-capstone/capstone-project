# Guest A1 DNR writer 연결

기능 AMVP-CORE-04 / 담당 윤종민 / 브랜치 `feature/additional-mvp-guest-dnr-fence` / 시작 `24327d1bd8615a2274a6dead43f23b71cc06b64e`(#55 승인·병합). 기존 RC2 `03_Wire_D06_복원.md`의 store+ID/claim 소유권·복원 의무와 기존 Guest A1 실행 계약을 재사용한다. API/Wire/Snapshot/Schema·Content·Server·관측 규칙은 바꾸지 않는다.

## 변경 범위

- `extension/a1/core.mjs`: 초기 add, UNKNOWN missing-rule add, suspend remove, finish remove를 `guardedDnrUpdate(state, request, applying)`로 연결했다. 입력을 복제하고 원래 session/owner/executor/snapshot/규칙 집합을 대조한다.
- `extension/src/additional-dnr-legacy-writer.js`: 기존 immutable `FocurveMemberDnrWriter`를 유지하고 동일 객체의 `FocurveDnrWriter` 별칭을 추가했다. 두 actor가 서로 다른 runtime DB를 만들거나 잠금/원장을 복제하지 않는다. 기존 `focurve-member-a1-root-authority` metadata·`focurve:amvp:dnr-writer`를 사용한다. 저장 형식/DB version/migration/claim/Receipt를 변경하지 않는다.
- `background/service-worker.js`, `scripts/build-a1.mjs`: 공통 guard bundle을 Guest bundle보다 먼저 한 번 로드한다. Guest Worker에 필수 `.write`를 전달하며, guard가 없는데 제품 source fallback으로 부팅하지 않는다. Member의 기존 이름·bootstrap·Core source는 그대로다.
- 같은 source consumer의 `env.dnrWriter` 미제공 시 기존 adapter fallback은 유지한다. 이것은 실제 배포 Worker나 전체 writer coverage의 증거가 아니다.

## 최종 신규 적용 검사

공통 lock에서 runtime journal을 새로 읽어 store+ID의 미해제 claim을 보호한다. 실제 Chrome 규칙 재조회로 다른 내용의 동일 ID 덮어쓰기/삭제를 거절한다. 신규 add는 현재 Guest owner/executor와 Guest 허용 auth 상태, 기존 RootAuthority idle을 확인한다.

Guest START는 이미 `MemberAuth.guardGuestStart`의 serial 안에서 실행된다. 잠금 안에서 `auth.status()`/`guardGuestStart()`를 다시 기다리면 교착하므로 **기존 `auth.load()`의 로컬 상태 읽기**만 사용한다. UNREGISTERED/REGISTERED만 허용하며, Member auth/Root 의무/미준비 상태는 거절한다. 새 인증 HTTP 호출·토큰 갱신이나 guest raw 업로드를 추가하지 않는다. `auth.load()` 자체의 기존 복구성 저장이 발생하면 기존 AuthStore/Guest fence 검사를 따른다.

auth 조회 이전의 `AuthStore.writeState()` token을 최종 Guest DB readonly transaction에서 다시 비교한다. 검사 사이 auth 저장이 시작/완료되거나 pending이면 add를 전송하지 않는다. current/aggregate/session/journal/owner fence를 같은 transaction에서 대조하고 기존 END/terminal/desired·NR01/DP01 기한을 재확인한 뒤 **await 없이** native 쓰기를 시작한다. 마지막 token 검사는 권한 발급이나 영속 fence를 대신하지 않는다.

잠금 순서는 Guest Core serial → 공통 DNR lock → Root runtime journal → native 규칙 → 로컬 auth/Root 확인 → Guest DB snapshot/동기 dispatch다. auth serial을 중첩하거나 DNR lock 안에서 Core.serial을 새로 기다리지 않는다. Native 응답은 기존 boxed Promise로 DB transaction 밖에서 기다리고 DNR lock은 응답 완료까지 유지한다. END intent 저장은 Chrome 응답을 기다리지 않는다.

## cleanup 보존

removal-only는 신규 add의 auth 허용 검사를 요구하지 않는다. 잠금 전에 확인된 원래 owner/session의 exact journal·물리 규칙·최종 DB fence는 계속 검사한다. 대기 중 현재 owner가 바뀌어도 그 정당한 자기 footprint cleanup은 가능하다. 다른 owner 규칙/미해제 claim을 지우거나 Content obligation·전체 ENDED/RELEASED를 임의 확정하지 않는다. 호출 전 이미 owner가 바뀌어 bundle을 읽을 수 없는 기존 복구 경계를 새 우회 경로로 풀지 않는다.

## 실행 검증

Node v24.19.0 / Linux. 신규19/19, DNR 전체97/97, Extension 전체883/883, 계약6/6 PASS(fail/skip0). 중복 집합이므로 합산하지 않는다. 처음 시험 준비에서 GENERAL+BLOCK의 잘못된 fixture가 Snapshot 검증에 거절됐고 DISTRACTION+BLOCK으로 바로잡았다. VM의 기본 fetch 미주입 때문에 생긴 준비 오류는 네트워크 호출 금지용 명시 fetch로 수정했다(`/tmp/guest-dnr-initial-failure.log`). 제품 검사를 약화하지 않았다.

신규 검증은 실제 Guest A1 상태 머신/Registry/MemberAuth serial과 fake-indexeddb/Node Web Lock을 사용한다. DNR/권한 provider/Content 효과는 모의다. 실제 BEGIN/Content apply·release 모델을 사용하지만 실제 YouTube DOM이나 native sender를 확인한 것이 아니다.

- 정상 START/END·Content cleanup, 네 쓰기 경로, 배포 NR01/ND01/DP01 flags.
- 예약/미확정 runtime claim 보호, END 시 미해제 규칙·cleanup 보존.
- 실제 lock queue에서 owner/executor/identity 실패, END 승리, NR 기한 만료 차단.
- 잠금 대기 중 auth Member 전환/Root obligation/미준비 상태 차단, 로컬 auth 확인 후 token 변경 차단.
- 이전 owner의 exact cleanup 유지, Chrome 응답 중 END 저장 비차단.
- 실제 MemberAuth serial을 보유한 Guest START가 nested serial 없이 완료됨.
- 불변 공통 gate 별칭, guard 선행 로드·Guest bundle byte 일치.

```sh
npm --prefix extension ci --ignore-scripts --no-audit --no-fund
node --test extension/tests/additional-dnr-guest-writer.test.mjs
node --test extension/tests/additional-dnr-*.test.mjs
npm --prefix extension test
node --test contracts/additional-mvp/rc1/tests/legacy-boundary.test.mjs
npm --prefix extension run check
```

`PLAYWRIGHT_MODULE`과 `CHROME_EXECUTABLE` 설정 후 `node --test extension/tests/additional-dnr-legacy-writer-browser.mjs`: Linux Chromium151 실제 IndexedDB/Web Lock에서 두 Core helper의 Native 응답 대기 중 END commit **2/2 PASS**. 최소 상태 fixture/모의 DNR·identity이며 실제 MV3/Windows Chrome 시험이 아니다. Guest/Core·Content, Member/Core 및 공통 guard 생성 bundle 일치·syntax/diff check PASS. 로그는 `/tmp/guest-dnr-focused.log`, `/tmp/guest-dnr-regression.log`, `/tmp/guest-dnr-all-extension.log`, `/tmp/guest-dnr-browser.log`에 보존한다.

## 남은 작업과 리뷰

이번 연결은 **현재 Member A1 + Guest A1** 두 actor만이다. 구 GuestSession/이전 SiteController 등 raw writer는 미연결이며 `assertWritersGuarded` 기본 거절을 유지한다. 현재 Chrome 확장 로드는 관리 정책으로 차단돼 있어 실제 MV3/DNR/Windows·Worker 강제 종료·제품 계정 전환·전체 quota/cleanup 수용을 완료로 표시하지 않는다. 정책 allocator/issued binding provider·실제 SITE_TIME 활성화·RuntimeReport/outbox/ACK·collector/clock은 후속이다.

리뷰 필요: 다훈은 같은 Root 원장/잠금·auth serial/상태·END/정책 소유권을, 지민은 Guest 적용·권한 회수·문서/Content cleanup 의무 보존을 확인한다. 새 HEAD에 대한 리뷰·최종 통합은 별도이며 기능 전체 완료나 병합 허가를 자동 기록하지 않는다.
