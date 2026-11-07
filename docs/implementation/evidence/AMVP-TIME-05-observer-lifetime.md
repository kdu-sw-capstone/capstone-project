# AMVP-TIME-05 — 관측 callback 수명 격리

- 담당: 윤종민. 날짜: 2026-11-02 (Asia/Seoul).
- 브랜치: `fix/additional-mvp-observer-lifetime`.
- 시작 기준: integration `2201654e4ba3adbc1a4738bc14723b708d522c69`.
- 상태: 구현·로컬 자동 검증 완료, 담당 리뷰·통합 대기. Core 전체 또는 이용시간 측정 완료가 아니다.
- 기준: `docs/design/additional-mvp-contracts/04_정책_시간.md` C05 재시작/불확실 구간, C11 idle60·권한/API 불가 상태, `06_인계_승인.md` AMVP-TIME-05, 기존 P2의 명시적 재시작·권한 재확인 조건.

## 문제와 변경

기존 idle listener는 인스턴스 전체에서 같은 callback을 재사용했다. event listener 제거 전에 전달 대기한 callback이 중단/재시작 이후 호출되면 새 `running=true`만 보고 새 회차 상태를 바꿨다. 권한 회수/조회 실패 뒤 이미 전달된 active callback도 UNAVAILABLE을 되돌릴 수 있었다. Foreground의 이전 탭/권한 listener 역시 새 running 상태에서 refresh 또는 권한 회수를 일으킬 수 있었다.

- `extension/src/additional-idle-observer.js`: start별 generation에 결속된 state/permission callback을 생성한다. stop·권한 회수·현재 조회 실패는 그 generation을 무효화한다. 이전 callback은 새 start를 거쳐도 관측을 발행하거나 새 listener를 제거할 수 없다.
- `extension/src/additional-foreground-observer.js`: browser event·URL 권한 제거 callback에 기존 lifecycle 검사를 적용한다. 이전 회차의 이벤트는 새 조회·UNKNOWN·권한 회수를 만들지 않는다.
- 현재 회차의 정상 active/idle/locked·탭 전환·권한 회수와 명시적 재시작의 새 권한 확인은 유지한다. threshold/queryState는 기존60초이며 첫60초 소급 차감·확정 사용량은 만들지 않는다.
- callback이 새 collector epoch에 capture를 생성하지 않는지 실제 runtime→journal 경로로 확인한다. 원본·owner 문맥·재시작 미확인 의무는 유지된다.

callback 전달 대기를 시험 코드로 주입한 반례다. 실제 Chrome에서 이 경합이 발생했다고 주장하지 않는다. 현재 등록된 callback에 새 lifecycle 중 실제로 전달된 사건을 이전 사건인지 판별하는 API를 추가하지 않았으며 Chrome 이벤트의 실제 발생 시각/지연은 여전히 미확인 tail이다.

## 검증과 실패 기록

환경: Linux, Node24.19.0/npm11.9.0, fake-indexeddb6.2.5. 선택 브라우저 probe는 Chromium151 native IndexedDB이고 tabs/windows/idle/permissions는 모의다.

| 실행 | 결과 | 범위 |
|---|---|---|
| 기존 두 source + 최초 신규 반례6건 | 0/6 PASS | 이전 idle/권한/browser callback·새 epoch 오염 모두 재현 |
| 신규 lifetime 시험 | 14/14 PASS | 반례6 포함, 현행 callback/조회실패/권한/정상재시작/의무 보존 |
| 아래 관련 시험 | 45/45 PASS | 기존31+신규14 |
| `npm --prefix extension test` | 993/993 PASS | integration 기존979+신규14, 관련45 포함 |
| 계약 legacy-boundary | 6/6 PASS | 기존 계약 경계 |
| `npm --prefix extension run check`·`git diff --check` | PASS | syntax·whitespace |
| 선택 Chromium native IndexedDB probe | 1/1 PASS | 이전 callback 미저장·새 callback 저장·다른 owner/STOP 보존 |
| #89 복구 source/신규24와 별도 복사본 호환 | 69/69 PASS | 기존31+lifetime14+복구24; 원격 브랜치 수정/실제 병합 아님 |

최초 npm ci는 기본 `/home/agent/.npm` 캐시 디렉터리 생성 실패로 중단했고 의존성 없는 첫 시험은 import 단계에서 실패했다. workspace 캐시로 정상 설치한 뒤 기존 source를 사용해 반례6/6 실패를 재확인했다. 환경 실패와 제품 반례를 분리한다. 제품 조건·assertion을 완화하지 않았다.

```bash
npm --prefix extension ci --ignore-scripts --no-audit --no-fund
node --test extension/tests/additional-idle-observer.test.mjs extension/tests/additional-foreground-observer.test.mjs extension/tests/additional-observation-journal.test.mjs extension/tests/additional-observer-lifetime.test.mjs extension/tests/additional-time-runtime.test.mjs
npm --prefix extension test
node --test contracts/additional-mvp/rc1/tests/legacy-boundary.test.mjs
npm --prefix extension run check
```

선택 probe는 기존 설치를 지정해 실행한다. 제품 확장/START 없이 격리된 HTTPS route의 실제 IndexedDB를 사용한다.

```bash
PLAYWRIGHT_MODULE=/path/to/playwright CHROME_EXECUTABLE=/path/to/chromium node --test extension/tests/additional-observer-lifetime-browser.mjs
```

CI는 기존 Ubuntu/Windows job에 신규14 시험을 별도 step으로 추가한다. #89의 기존 시험 목록 변경과 겹치지 않도록 기존 명령은 유지한다. 선택 브라우저 probe는 기본 npm test/CI에 포함되지 않는다.

## 선행 관계·리뷰·미완료

#89를 포함하지 않은 같은 integration base의 독립 PR이다. 따라서 본 PR 전체993과 #89 전체1003의 차이는 신규 시험 수 차이이며 시험 삭제가 아니다. #89 source/신규 시험을 임시 복사본에 결합한69건도 통과했지만 제품 통합·병합 검증을 대신하지 않는다. 공유 TIME-05/통합현황 기록을 통합할 때 양쪽 이력을 보존해야 한다.

다훈은 lifecycle fencing과 실패 이후 명시적 재시작/권한 재확인, 지민은 이전 owner/회차 이벤트가 새 관측에 영향을 주지 않는 경계와 기존 복원 의무 보존을 검토한다. 제품 Worker·확정/격리 시간 계수·privileged anchor·한도/Report·실제 Windows MV3/장시간 수용은 여전히 별도 미완료다. #86/#88·IG04 실제 영속 ACK/완료 proof·RPT-02 계약은 변경하지 않는다. 병합은 통합 담당이 진행한다.
