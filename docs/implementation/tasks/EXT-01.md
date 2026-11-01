# EXT-01 · 정책 동기화

## 2026-11-01 · PR75 P2: 다중 팝업 영속 sites UNKNOWN → START 차단

- 시작 기준: PR75 `f9bf2fd8860276316bf98d5b538600d6ea24c8c4`, 기존 `codex/extension-popup-figma` Worktree/브랜치. [P2 원문](https://github.com/kdu-sw-capstone/capstone-project/pull/75#discussion_r4434671350), [독립 리뷰](https://github.com/kdu-sw-capstone/capstone-project/pull/75#pullrequestreview-5726860332)를 재사용했다. 아래는 신규 소스 검증이며 이전918/11을 승격한 결과가 아니다.
- 원인: A가 남긴 영속 sites hold를 B의 reserve가 발견해 거절해도 `reserved=false`여서 B의 `held=false`가 유지됐다. B가 저장을 시도하지 않으면 관찰 자체가 없었다. 기존 Web Lock은 동시 실행만 직렬화하며 완료 뒤 남은 UNKNOWN을 해소하지 않는다. user controller의 별도 `focurve_user_ui_hold`도 sites hold를 대신하지 않는다.
- 수정 전: 실제 HTML + popup/sites controller 전체를 두 JSDOM 창에서 공유 모의 Chrome storage/runtime/Web Lock으로 실행했다. 고정 Git 소스 `f9bf2fd`의 최초12 반례는 **4 PASS / 8 FAIL**. A의 CREATE 미확정 후 B 무저장·B reserve 거절·저장소 읽기 오류·잠금 직전 hold·START reserve 중 hold·owner 전환·reserve 읽기 실패에서 START가 각각1회(기대0)였다. 잠금 예외는 START0이지만 미처리 예외로 FAIL. 정상 START/END·sites UNKNOWN 중 정당한 END·해결 후 새 팝업·동시 START 대조군은 PASS였다.
- `sites-model.js`: reserve 실패도 로컬 held를 고정한다. 아직 자기 요청을 예약하지 못한 경우 onHold/confirm을 호출하지 않아 기존 marker를 덮어쓰거나 지우지 않는다. storage 알림은 캐시 표시를 갱신할 뿐 START 권한의 근거로 사용하지 않는다.
- `popup-model.js`의 공용 `checkStart`: sites/user marker 최신 조회 → 기존 STATE 조회 및 owner/executor/server/web origin/session/알려진 generation·시작 가능 상태 대조 → marker 최종 재조회 → 현재 팝업 scope/설치 준비 대조. 조회 실패·잘못된 marker·다른 요청의 user hold는 거절한다. 동일 START의 아직 미확정 표시가 없는 자기 reservation만 허용한다. STATE는 기존 인증/복구 동작을 포함할 수 있으며 새로운 무부작용 진단 권한으로 취급하지 않는다.
- `user.js`: START는 `focurve-user-ui-operation`을 획득한 안에서 사전 검사, 기존 controller reserve, **sendOperation의 실제 START sendMessage 직전 최종 checkStart**, 응답 확인·STATE 갱신까지 수행한다. 잠금 없음/오류도 전송0으로 처리한다. 기존 user marker의 request ID가 다르면 보존한다. 중복 호출의 finally는 자기 expected 객체일 때만 정리하여 정상 승자의 scope를 지우지 않는다.
- `shell.js`: CREATE/UPDATE/DELETE와 START가 같은 lock 규약을 사용한다. reserve에서 sites/user marker 둘 다 확인한다. storage onChanged는 새 hold를 로컬에 전파하고, 정상 외부 해소 뒤에는 controller를 새로 만들고 목록을 재조회한다. 해소 알림 자체로 START하거나 영속 marker를 삭제하지 않는다. 본인 성공 confirm 알림이 아직 busy인 controller를 중간 종료하지 않게 보존한다. 제출/삭제 당시 actor·계정·선택 버전을 capture하여 잠금 획득 전 계정 변경 시 새 계정 controller에 이전 입력을 전달하지 않는다.
- `developer.js/.html`: 실제 로드되는 diagnostics START도 공용 helper와 같은 lock을 사용한다. 계정 변경 명령도 같은 lock에 참여한다. END에는 sites START gate를 적용하지 않았다. 미사용 `member-ui/popup.js`는 어떤 HTML에도 연결되지 않아 수정하지 않았다.
- END controller·Core auth/owner/generation fence·타이머/실제 END 구분·DNR/Content 해제·cleanup/복원 책임은 변경하지 않았다. sites UNKNOWN인 RUNNING에서 정당한 END는1회, START는0회이며 marker 원문을 보존했다. Core·Content·Server·DB·manifest·공유 계약·UI 스타일 변경0, 다른 PR/Worktree/index와 공유 staged 삭제1,036개 보존.

### 새 후보 검증과 정확한 전송 수

| 조건 | START | END | 결과 |
|---|---:|---:|---|
| A UNKNOWN → B START, B 저장 없음 | 0 | 0 | PASS; A CREATE1·marker 보존 |
| B reserve 거절 후 START | 0 | 0 | PASS; 추가 CREATE0·held 유지 |
| 저장소 오류·잠금 throw/null·직전/예약 중 새 hold | 0 | 0 | PASS |
| owner/executor/알려진 generation 전환·이전 STATE 응답 | 0 | 0 | PASS |
| 정상 START 후 END | 1 | 1 | PASS |
| sites UNKNOWN 중 정당한 기존 END | 0 | 1 | PASS; marker 보존 |
| 정상 외부 해소 후 새/기존 팝업의 명시 START | 각1 | 0 | PASS; 자동 START0·최신 조회 수행 |
| 두 팝업 또는 diagnostics/main 동시 START | 합계1 | 0 | PASS |
| 본인 CREATE 알림·readback·confirm 후 START | 1 | 0 | PASS; CREATE1 |
| START 검사 중 경쟁 사이트 저장 | 1 | 0 | PASS; 경쟁 CREATE0 |
| null/false marker 또는 다른 user hold | 0 | 0 | PASS; 원문 보존 |
| 잠금 대기 중 A→B 계정 전환의 이전 사이트 제출 | 0 | 0 | PASS; CREATE0 (기준 f9bf2fd CREATE1 FAIL) |
| 같은 팝업의 늦은 중복 lock 실패 | 합계1 | 0 | PASS; 불필요한 user/sites HOLD 없음 |

- 신규 결합 반례 **24/24 PASS** (N/S의 두 입력을 포함한 원본 fixture26개와 혼동하지 않는다). 직접 popup/sites/기존 guest/member 회귀 **83/83 PASS**, 인증·admission·세션 경계 **72/72 PASS**, Extension 전체 **942/942 PASS**, fail/skip0. 집합이 겹치므로 합산하지 않는다.
- `npm --prefix extension run check`, 변경 member-ui JS5개 별도 `node --check`, 기존 `build:a1`, `build:member-a1`, `build:member-worker`, `build:harness` PASS. 생성된 Core/Content bundle은 기존 blob과 동일하다. 의존성/lockfile 변경0.
- 기존 Chrome renderer를 새 소스로 실행: Windows Chrome156.0.8078.76 / Node24.19.0, **11/11 PASS**, 모의 Chrome/runtime/storage/HTTP. Figma480×600·Light/Dark·3탭·CRUD·스크롤·시간 설정·오류/복귀 영향 확인. 이전 renderer 결과/스크린샷도 별도 보존했다.
- 로컬 ignored 원본 `.local/pr75-p2/`: `before.log`, `before-counts.json`, `scope-before*`/`scope-after*`, `same-popup-race-*`, `after-final-24.log`/`after-final-24-counts.json`, `affected-final.log`, `auth-session-boundary.log`, `extension-full-final.log`, `member-syntax.log`, `syntax.log`, `build-*.log`, `renderer-before/`, `renderer-after/`. 중간 후보의 same-popup race는 finally 조건1줄을 메모리에서만 역전한 source/hash 근거를 별도 기록하며 이를 f9bf2fd 반례로 소급하지 않는다.

### 재현·재검토 범위

- 새 반례: `node --test extension/tests/popup-sites-hold-start.test.cjs`. 케이스별 marker/전송 근거를 저장하려면 `FOCURVE_POPUP_TEST_EVIDENCE_FILE`에 로컬 결과 JSON 경로를 지정한다.
- 수정 전12 재현: `FOCURVE_POPUP_TEST_SOURCE_REF=f9bf2fd8860276316bf98d5b538600d6ea24c8c4` 환경에서 `node --test --test-name-pattern='^[A-L]:' extension/tests/popup-sites-hold-start.test.cjs`. 다른 추가 시험은 이 기준으로 실행했다고 주장하지 않는다.
- 전체: `npm --prefix extension test`. 직접 영향83은 `node --test extension/tests/popup-sites-hold-start.test.cjs extension/tests/user-popup.test.cjs extension/tests/member-sites-ui.test.cjs extension/tests/member-popup-shell.test.cjs extension/tests/guest-popup-design.test.cjs extension/tests/guest-failure-retention.test.cjs`이며 결과는 `affected-final.log`이다.
- 인증/세션72는 `node --test extension/tests/member-auth.test.mjs extension/tests/member-auth-runtime.test.mjs extension/tests/member-reauthentication.test.cjs extension/tests/user-admission.test.cjs extension/tests/web-transition-admission.test.mjs extension/tests/session-core.test.mjs`. Chrome은 기존 PLAYWRIGHT_MODULE/CHROME_EXECUTABLE 설정 후 `node extension/tests/ui/popup_design.mjs`.
- Core 담당의 좁은 독립 리뷰: 공용 lock의 범위와 START 최종 검사, 다른 owner/기존 user hold 보존, 기존 auth/generation 최종 방어 및 정당한 END/cleanup 보존. 실제 Core 승인·P2 thread Resolve·Approve·Draft 해제·Merge를 대신하지 않는다.
- 원격 CI는 Push된 정확한 HEAD의 Actions/check-runs/status와 기존 FOCURVE CI workflow_dispatch 실행 가능 여부를 별도 확인한다. 그 원격 결과는 PR에 기록하며 로컬 PASS로 대체하지 않는다.
- 실제 제품 MV3·가입/설치/서비스·기존 HOLD 환경·Native·Server/DB 저장·Core/Content 효과·정상 END/전체 복원·재기동은 **NOT_RUN**. 구현 결함 수정/모의 회귀 완료와 제품 수용을 구분하고 `MVP_FINAL_COMPLETE=false`를 유지한다.

## 2026-11-01 · 승인 Figma 팝업 제품 표시 계층 연결

- 상태: **PARTIAL / 독립 리뷰·실제품 수용 대기**, `MVP_FINAL_COMPLETE=false`. 담당: 김다훈 Web·UI·통합 범위. 브랜치 `codex/extension-popup-figma`, 별도 Worktree `C:/Users/dahun/.codex/worktrees/extension-popup-figma/04 · 추가 MVP 구현`.
- 실제 원격 통합 기준: `32eb975952d24159af0d070cc9e0f1a10733aa4f` (`git fetch`와 게시 전 `ls-remote` 확인). 과거 분석 `24327d1b…`와 popup/member-ui/manifest 소스 동일. MemberApp 차이는 기존 시간대 통계 연결이며 Sites 계약은 동일. 기존 `implementation-gap-20261101.txt/.csv`를 재사용했다.
- Figma 파일 `TmEt1UQV5jIhrArfijGwQe`의 `3441:37447` 현재 사이트, `3441:37495` 집중 시작, `3441:87723` 직접 추가, `3441:88089` 목록, `3441:42432` Dark 정책, `3441:89000` Dark 회원 직접 추가의 상세 context/render를 기준으로 구현했다. Figma 원본/Code Connect 수정 없음. 전체332상태 전수 대응 완료로 판정하지 않는다.
- 화면: 480×600 / 24px 여백 / 40px 브랜드 / 56px 제목 / 396px viewport / 64px 하단3탭. 공통 Light/Dark 토큰·로컬 SVG·현재 사이트 중앙 카드·실제 활성 도메인/파비콘·most-specific 등록정책·빠른 편집·목록252px 스크롤·고정 CTA·분류/접근 라디오·방향키·25/50/직접 시간·설정/기록/연결/Native 복귀를 연결했다.
- 비회원은 기존 `popup/popup.html`의 CRUD·START/END를 그대로 호출한다. 새 화면을 iframe에 넣거나 sender 검증을 변경하지 않았다. 자동 이름은 정규 host의 앞100 code point이며 전체 도메인은 보존하고 수정 시 기존 이름을 보존한다. 기존 정책/기능 값·버전·동일 저장 의도 request ID를 유지하고, 저장 intent/목록 재조회 또는 삭제 부재 확인 전 성공 표시와 입력 초기화를 하지 않는다.
- 회원은 `sites-runtime.js` UI 전용 Worker adapter에서 기존 bearer `/sites` GET/POST/PATCH/DELETE를 사용한다. SETTINGS_LIST/SETTINGS_SELECTED는 기존 비회원 가져오기 전용으로 남는다. 토큰은 Worker 밖으로 전달하지 않는다. 정확한 sender·request ID·서비스 fence·owner/executor/server·AuthStore write token·Idempotency-Key·If-Match·전후 scope와 readback 검증을 적용한다. 새 내부 UI 메시지는 Core 담당의 좁은 독립 리뷰 대상이며 기존 공개 Wire/API/DB 의미를 바꾸지 않는다.
- 회원 저장 성공은 응답 intent→GET→목록 일치, 삭제는204→GET404→목록 부재 확인이 필요하다. 미확정 결과는 durable hold·동일 요청 결속으로 보존하며 새 사이트 mutation과 새 START를 제한한다. 기존 RUNNING의 정당한 END는 유지한다. 계정 tuple 변경 시 이전 목록·editor·비동기 결과를 폐기한다. 401/412는 안전한 오류 안내와 입력/버전을 보존한다.
- 집중은 기존 회원 controller·비회원 controller를 재사용한다. START 클릭으로 RUNNING을 만들지 않는다. 회원 타이머는 확인된 RUNNING 및 현재 owner/session/generation/종료시각 결속이 있을 때만 표시하며 불명확하면 `--:--`이다. 시간0도 복원 완료 판정으로 사용하지 않는다. 일시정지/재개는 연결하거나 제공하지 않았다.
- 보존: Core/Content 생산 소스·Server/API·DB schema·frontend/api.ts·manifest·공통 계약 변경0. 공유 cwd staged 삭제1,036개 및 다른 Worktree/index를 변경하지 않았다. 열린 PR 파일 조사에서 이번 popup/member-ui 직접 경쟁 변경은 발견하지 못했고 기존 #17의 manifest·legacy member UI 파일은 수정하지 않았다.

### 검증 및 근거

- Node24.19.0 / lockfile `npm ci --ignore-scripts` 성공. 기존 회원 모델19, 새 회원 transport/model19, 새 member shell5, guest 표시/CRUD7 및 기존 END/UNKNOWN 회귀를 포함한 Extension 전체 **918/918 PASS**, fail/skip0. 겹치는 개별 수를 전체에 더하지 않는다.
- `npm run check` 및 별도 member-ui JS 구문 PASS. 기존 `build:a1`, `build:member-a1`, `build:member-worker` PASS; 생성 bundle은 기준 blob과 동일하며 생산 Core 변경이 아니다. 이번 작업은 빌드된 전체 설치 패키지나 Server/Web 재빌드가 아니다.
- Windows Chrome156.0.8078.76 headless renderer + 모의 Chrome runtime/storage/HTTP: **11/11 PASS**. 회원·비회원 Light/Dark 480×600, 실제 HTML/JS의 CRUD/재조회/삭제 확인, 키보드 선택, 목록 스크롤, 고정 CTA, 프리셋, 로딩/오류/빈 목록/긴 도메인/HOLD/확인된 RUNNING, 보이는 이미지 로딩·geometry를 검사했다. 테스트 명령: `PLAYWRIGHT_MODULE`과 `CHROME_EXECUTABLE` 설정 후 `node extension/tests/ui/popup_design.mjs`.
- 최초 전체 회귀는915/917 + fixture2FAIL: `guest-failure-retention`의 부분 함수 추출에 새 표시 helper를 포함하도록 시험 준비만 보완했고 기존 END/UNKNOWN assertions를 유지했다. 최초 member custom duration CTA 잘림도 보존하고 CSS 수정 후 같은 Chrome 반례가 PASS했다.
- 로컬 ignored 원본: `.local/popup-design/`의 `extension-regression.log`, `extension-regression-final.log`, `syntax.log`, `build-*.log`, `result.json`, `before-custom-layout-result.json`, `screenshots/`. 비회원 개별 렌더는 `.local/popup-guest-20261101/`. 민감한 실제 로그/사용자 데이터는 게시하지 않는다.
- 실제 설치된 제품 MV3 팝업·OAuth/Native·Server/DB 저장·Core/Content 효과·정상 END/복원/재기동 수용은 **NOT_RUN**. 기존 보존 실환경을 재사용하거나 설치/서비스/실세션을 시작하지 않았다. renderer/mock PASS를 제품 수용으로 승격하지 않는다.

### 독립 리뷰와 11월11일 시연 범위

- 김다훈/통합: 승인 화면·상태·사이트 CRUD adapter·자동 이름·회원/비회원 분리·401/412/UNKNOWN·계정 전환·레이아웃/키보드/스크롤.
- 윤종민/Core: 새 내부 UI listener의 sender/서비스/AuthStore fence·owner/version/idempotency·읽기 전용 timing projection·START 차단과 정당한 END 보존. 실행 Core/Content 전면 재검토를 요청하는 변경은 아니다.
- 회귀 담당: 최신 통합 후보에서 누적 Extension 회귀/빌드와 승인된 격리 실제품 popup→저장→적용→END→복원→재진입 검증. 실제 효과/저장 증거 없이는 시연에서 성공으로 설명하지 않는다.
- 현재 시연 가능 근거는 렌더러 fixture의 현재 사이트→추가/수정/삭제→목록, Light/Dark, 집중 시간/대기/확인된 상태 UI이다. 실제품 시연 확정은 위 수용을 통과해야 한다. Draft PR 유지, Approve/Merge 미수행.

단계: 필수 MVP · 설계 담당 영역: Server·Extension

## 작업 상태

- 상태: 진행 중 · 회원 팝업 안내 부분 구현
- 실제 담당자: Core 종민 · 기존 Server 담당 배정 유지
- 브랜치 / 시작 기준 커밋: feature/extension-core-ext-02 / 4e4c44e81947021fe10063ab511904ecc4d84558
- PR: https://github.com/kdu-sw-capstone/capstone-project/pull/17
- 선행 작업 / 차단 조건:

| 영역 | 담당 | 구현 상태 | 검증 상태 |
|---|---|---|---|
| Web | | 미확인 | 미실행 |
| Server | | 미확인 | 미실행 |
| Extension | Core 종민 | 회원/비회원 팝업 안내 부분 구현 | 모의 UI 39/39 · 실제 새 Chrome 검증 대기 |

해당하지 않는 영역은 관련 명세 근거와 함께 해당없음으로 표시한다.

## 설계 참조

- 화면: EXT-01
- 흐름: TF-05, TF-08, TF-13
- API: API-EXT-01, API-EXT-02, API-EXT-03, API-EXT-04, API-EXT-05, API-EXT-06, API-EXT-07, API-EXEC-01, API-EXEC-02, API-EXEC-03, API-EVENT-01, API-EVENT-02
- 데이터: extension_installations, execution_commands, execution_reports
- 회원: 회원 Web·Extension
- 비회원: Extension 로컬
- 로컬: EXT 로컬 동일 검증/owner별 저장

원문: [화면](../../design/01_UX_기능설계/02_IA_화면명세.md) · [동작](../../design/01_UX_기능설계/03_동작규칙.md) · [API](../../design/02_시스템_테크설계/04_API_연동.md) · [데이터](../../design/02_시스템_테크설계/05_데이터_복구.md) · [검증 기준](../../design/04_검수_예시데이터/07_검증기준.md)

## 설계와 구현 대응

| 기준 ID | 기대 결과(기존 설계) | 코드 위치 | 검증 명령·환경 | 결과 |
|---|---|---|---|---|
| AC-EXT-01-01 | 현재 소유자·최신 revision의 명령만 실행 | | | 미실행 |
| AC-EXT-01-02 | 다른 설치 토큰·만료 APPLY 거절 | | | 미실행 |
| AC-EXT-01-03 | 재접속은 journal 대조 후 명령 실행 | | | 미실행 |

기존 수용 기준은 출발점이다. 상세 명세의 실제 입력·출력·오류를 검증하며 이 표의 존재만으로 충분한 테스트라고 판단하지 않는다. 관련 BOUND 사례도 선택하여 아래에 기록한다.

## 추가·통합 검증

| BOUND 또는 추가 기준 | 실행 방법 | 결과 | 증거 |
|---|---|---|---|
| | | 미실행 | |

## 중단·재개 기록

- 마지막 작업:
- 완료한 부분:
- 변경 파일 / 실행 방법:
- 미완료·오류·설계 충돌:
- 다음 행동:

## 완료 판정

- 관련 설계 항목 구현:
- 수용 기준 및 관련 경계 사례 검증:
- 실제 연동 확인 (모의 응답 제외):
- 검토·통합 근거:
- 남은 문제:

## 2026-10-09 최신 Server 전달·통합 준비

담당 김다훈(Server/API/DB·연결Frontend), 브랜치 codex/server-event12-integration, 시작develop76df34ea6be1c591be33c29606c24fc654f61932. 기존 담당 배정 유지. 상태: 담당 구현 검토 대기 / 실제Extension통합 미검증. 최신 사용자 지시로 담당 코드 전달용Commit·Push·develop PR을 진행하며 전체MVP완료나 병합으로 처리하지 않는다.

[게시 검증·실행환경·주체·남은 조건](../Server_최신수정본_게시검증_2026-10-09.md) · [실제 API·Event1.2·구형 호환·Core 절차](../Extension_Server_연동가이드.md). Backend 최종107/107(기존106+실제HTTP합성1), Frontend104/104·build PASS. 설치/APPLIED는합성, 실제Chrome/회원Core통합/Content감지는미검증. Snapshot1.2 신규발급OFF. 전체AC를 통과로 승격하지 않는다.

## 2026-10-10 · 이번 작업: EXT-01 화면의 회원/비회원 안내

목표: 회원 연결 시 Web 시작·설정 안내를 표시하고, 보존 비회원 자료 및 실제 실행 확인을 명확히 구분한다. 기능 카드 EXT-01 정책 동기화 전체 완료가 아닌 EXT-01 화면 개선이다. 담당 Core 종민. 기준은 IA EXT-01의 회원 관리→Web 및 소유 구분이다. API/정책/Server 계약은 바꾸지 않는다.

작업 시작 개인 Core 진행률 추정 75~80%. 정식 수용 기준 완료율이나 전체 프로젝트 비율이 아니다. 남은 개인 큰 단위: 화면 정리(이번), 저장 장애 수집 중단·해제 경계, 최신 실제 검증. 팀원 Shorts/lifecycle/watermark 연결은 별도다.

### 이번 작업 결과

Extension 0.1.16: 회원 연결 시 Web 시작/설정 안내와 실제 실행 확인을 제공하며 비회원 시작 양식을 숨긴다. 보존 비회원 자료는 명시적으로 접근 가능하고 실제 비회원 실행 해제 UI는 유지한다. 안전한 Web origin만 링크한다. 모의 팝업 39/39·JS 구문 PASS. 실제 새 Chrome 검증은 미실행이다. [검증 기록](../evidence/EXT-01-2026-10-10-member-popup.md).

개인 Core 진행률 추정: 시작75~80% → 이번 완료 후80~85%. 현재 합의된 개인 구현/안정화 범위의 판단치이며 정식 AC 완료율·전체MVP·팀원 연결율이 아니다. 남은 큰 개인 단위는 저장 장애 수집 중단·해제 경계와 최신 실제 검증 2개이며, 결함 발견 시 늘어날 수 있다. Shorts/lifecycle/watermark 공동 작업은 별도다. 이후 작업 시작 시 이 기준·남은 일을 함께 알린다.
