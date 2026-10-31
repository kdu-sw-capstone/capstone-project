# Member A1 DNR writer 잠금 연결 — 첫 actor 범위

기능 `AMVP-CORE-04`, 담당 윤종민. 시작 기준 `9e37b37fefb2238f259c6a1bba400eee6955d085`(#53 승인·병합 포함), 브랜치 `feature/additional-mvp-legacy-dnr-fence`. RC2의 single DNR writer·store+ID·복원 의무 보존과 기존 Member A1 권한/END/기한 조건을 재사용한다. Server/Content 계약이나 Report producer를 추가하지 않는다.

## 이번 연결과 남은 범위

Member A1의 초기 APPLY, UNKNOWN 누락 규칙 복구, suspend의 DNR 해제, finish의 최종 DNR 해제 **네 경로**를 실제 Worker bootstrap의 공통 쓰기 gate에 연결했다. 격리 source consumer는 기존 adapter 동작을 유지하지만, 배포 Worker는 생성 bundle을 Member bootstrap 전에 로드하고 `dnrWriter`를 전달한다. 새 bundle 로드 실패 시 뒤의 bootstrap까지 진행하지 않는다.

Guest A1, 기존 GuestSession, 이전 SiteController 실행 경로는 이번에 바꾸지 않았다. 그러므로 **전체 writer가 보호됐다는 assertWritersGuarded를 발급하지 않으며** AdditionalDnrCoordinator/실제 SITE_TIME 활성화의 기본 거절도 유지한다. 다음 actor 연결이 필요하다. 이번 PR을 전체 단일 writer/원장 통합 완료로 간주하지 않는다.

## 코드와 API

- `extension/src/additional-dnr-legacy-writer.js`: `LegacyDnrWriter.write(storeName, request, dispatchAtCurrentState)`.
- `extension/member-a1/core.mjs`: `A1Core.guardedDnrUpdate(state, request, applying)` 및 기존 네 호출 지점.
- `extension/scripts/build-dnr-writer.mjs`: 생성기. 결과 `background/additional-dnr-writer.bundle.js`.
- `background/service-worker.js`, `integration/member-a1-bootstrap.js`: 생성 bundle 로드와 Member A1 주입.

`storeName`은 SESSION/DYNAMIC, `request`는 Chrome의 기존 `{addRules?,removeRuleIds?}` 형식이다. 현재 제품 주입은 Member SESSION만 제공한다. 함수 진입 시 입력을 복제하여 대기 중 외부 변조로 검사와 실제 요청이 달라지지 않게 한다.

gate는 기존 coordinator와 **동일 이름** `focurve:amvp:dnr-writer` Web Lock을 잡고 원장을 새로 읽는다. 같은 store+ID의 미해제 claim(RESERVED/APPLIED/RELEASE_PENDING/UNCONFIRMED·이전 epoch 포함)이 있으면 추가·삭제·같은 hash 덮어쓰기도 거절한다. 같은 ID라도 다른 물리 store는 별개다. 잠금/저장소 실패를 빈 원장으로 처리하지 않는다. allocator를 새로 만들거나 충돌을 피하려고 ID를 재발급하지 않는다.

`dispatchAtCurrentState(send)`는 해당 actor의 최종 검사를 수행하고 `send()`를 그 검사와 같은 일관성 경계에서 동기 호출해야 한다. send의 반환은 `{outcome: Promise}`로 감싸므로 actor IndexedDB transaction은 Chrome 응답을 기다리지 않는다. 원래 Chrome Promise는 바로 rejection handler를 연결하며 실패를 성공으로 바꾸지 않는다. DNR Web Lock은 Chrome 쓰기 결과까지 유지한다. callback을 skip하거나 Native raw API로 fallback하지 않는다.

## Member 상태 검증과 잠금 순서

`Member Core.serial → 공통 DNR Web Lock → runtime 원장 읽기 → 현재 Native 규칙 조회 → Member 실행 DB readonly snapshot에서 dispatch` 순서다. 검사 중 네트워크 요청/새 인증 갱신은 없다.

1. 원래 session/owner/executor/Snapshot/규칙 집합을 현재 bundle과 대조한다.
2. 잠금 획득 후 대상 규칙이 자기 journal에 있으며 현재 물리 규칙을 덮어쓰지 않는지 재조회한다.
3. current pointer/실행 계약/aggregate 전체 값/session/journal/owner fence를 **하나의 readonly transaction**에서 대조한다. 대기 중 END·generation·owner fence 변화는 거절한다.
4. APPLY는 기존 END/terminal/desired 조건과 시작 execute_before를 재확인한다. NR01/DP01 기한 검사도 기존 함수를 동기로 재사용한다. 이후 별도 인증 await 없이 같은 snapshot callback에서 Chrome 쓰기를 시작한다.
5. 응답 후 기존 Core의 적용/해제 검증·실패 복구를 그대로 수행한다. 이 gate의 성공은 APPLIED/RELEASED Receipt가 아니다.

다른 코드가 DNR Lock을 잡은 상태에서 Core.serial을 기다리는 **역순 호출을 만들면 안 된다.** 기존/후속 evidence verifier는 잠금 안에서 readonly 원본 조회만 사용해야 한다. Guest 등 미연결 writer와 다른 프로세스의 native 상태 변화를 이 Lock만으로 막았다는 주장은 없다.

## 원장 위치와 보존

Worker gate는 **기존** `focurve-member-a1-root-authority` DB의 metadata에서 `AdditionalDnrStore`를 사용한다. 현재 owner별 실행 DB를 runtime registry로 오인하지 않도록 설치 전체 RootAuthority DB를 재사용했다. DB version/store 구조/RootAuthority key·기존 데이터는 변경하지 않는다. gate 자체는 DNR 원장을 읽을 뿐 claim/epoch/Receipt를 쓰거나 이동하지 않는다.

`FocurveMemberDnrWriter.store`는 이 canonical Root 원장 접근이다. 후속 실제 runtime coordinator도 같은 원장을 쓰도록 연결·검증해야 한다. 다른 DB에서 만든 coordinator까지 자동 보호됐다는 증명이 아니다. 과거 시험 DB/임의 per-owner sidecar를 자동 복사·채택하지 않는다. 여러 actor 연결과 원장 위치는 이 Core 구현 리뷰에서 확인할 부분이며 공용 Wire/API를 추가하지 않는다.

보호된 ID 때문에 Member APPLY/복구/해제를 수행할 수 없으면 기존 UNKNOWN/ENDING·cleanup 의무를 유지한다. 미등록 legacy 규칙과 runtime claim의 완전한 합집합/공유 해제 adapter나 예약 ID를 고려한 allocator까지 구현한 것은 아니다. 무해한 충돌이라 추정해서 보호를 우회하거나 전체 END를 확정하지 않는다.

## 검증 및 한계

신규 시험은 실제 Member A1 상태 머신·기존 fixture·fake-indexeddb·Node Web Lock을 사용한다. Chrome DNR 및 issued authority는 모의이며 실제 Chrome/MV3/네트워크 차단 결과가 아니다. NR01/ND01/DP01 배포 flags의 정상 시작·종료, 대기 중 END/owner fence/APPLY·NR 기한, shared ID 보호·부분 상태 보존, 네 경로 및 DB transaction이 Chrome 응답을 기다리지 않음을 검증한다.

초기 6개 실패는 DNR 규칙을 만들지 않는 기본 fixture를 사용한 시험 조건 오류였다. 실제 DNR을 사용하는 shortsDocumentGate fixture로 바로잡았으며 제품 조건을 완화하지 않았다. 그 뒤 검사/실제 요청의 입력 동결을 보강했다. 실패·수정 로그는 로컬에 보존한다.

```sh
npm --prefix extension ci --ignore-scripts --no-audit --no-fund
node --test extension/tests/additional-dnr-inventory.test.mjs extension/tests/additional-dnr-coordinator.test.mjs extension/tests/additional-dnr-site-time-evidence.test.mjs extension/tests/additional-dnr-legacy-writer.test.mjs
node --test contracts/additional-mvp/rc1/tests/legacy-boundary.test.mjs
npm --prefix extension test
npm --prefix extension run check
```

최종 로컬 실행: 신규22/22·기존 포함 DNR71/71·전체 Extension857/857·계약6/6·syntax/whitespace PASS. 이 수를 과거 다른 기반/미병합 PR 시험과 합산하지 않는다.

설치된 `PLAYWRIGHT_MODULE`/`CHROME_EXECUTABLE`을 지정해 `node --test extension/tests/additional-dnr-legacy-writer-browser.mjs`를 실행하면 실제 Chromium151 IndexedDB/Web Lock 및 별도 Core/root DB 경계 시험을 재현한다. 이 시험1/1 PASS는 최소 Member 상태 fixture와 모의 DNR에서 Chrome 응답 대기 중 readonly transaction이 종료되어 END write가 commit될 수 있음을 확인했다. 실제 MV3 DNR 또는 전체 Member/Server 통합 시험이 아니다. Node 전용 CI/npm test에는 포함되지 않는다.

실제 확장 DNR/Windows Chrome·Worker 강제 종료·배포 성능/전체 writer 경쟁·실제 발급 binding/정책 APPLY·Report/ACK·collector/clock은 후속이다. native 확장 로드가 차단된 현재 환경의 별도 제품 수용 성공을 주장하지 않는다. PR53 원본 조회·Server RPT-01 완료나 전체 MVP 완료로 승격하지 않는다.
