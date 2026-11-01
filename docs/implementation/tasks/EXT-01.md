# EXT-01 · 정책 동기화

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
