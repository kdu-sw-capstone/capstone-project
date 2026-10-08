# EXT-02 · 접근 제한 적용

단계: 필수 MVP · 설계 담당 영역: Extension

## 작업 상태

- 상태: 진행 중 (사이트 실행 모듈 구현·자동 검증·Commit/Push 완료; 사용자 Chrome 재검증 필요)
- 실제 담당자: 윤종민 (사용자 제공 작업 지시·가이드 기준; 저장소의 기존 배정표와 EXT-02 카드에는 개인 배정이 미기입되어 있어 팀 기록 확인 필요)
- 브랜치 / 시작 기준 커밋: `feature/extension-core-ext-02` / `76df34e` (2026-10-07, origin/develop 최신 확인)
- PR:
- 선행 작업 / 차단 조건: 제품 연결은 EXT-01·API-EXT-01~07·API-EXEC-01~03, 제품 IndexedDB transaction·ExecutionReport/outbox·세션 상태 연결이 필요하다. 이번에는 기존 Command/Snapshot 명세로 사이트 차단 실행 모듈만 독립 구현했다. 기존 2026-10-07 차단 기록은 아래에 보존한다.

| 영역 | 담당 | 구현 상태 | 검증 상태 |
|---|---|---|---|
| Web | | 미확인 | 미실행 |
| Server | | 미확인 | 미실행 |
| Extension | 윤종민* | 사이트 실행 모듈 구현; 제품 세션·회원 연결 제외 | Codex Windows 자동 26/26 재실행 통과; 사용자 Chrome 1차 오류 보고, fixture 수정 후 재검증 대기 |

\* 담당 기록 근거는 이번 사용자 제공 지시·가이드이며, 저장소 `docs/TEAM_GUIDE.md`와 기존 작업카드에는 개인별 기능 배정이 기록되어 있지 않다. 배정 자체를 재지정한 것은 아니다.

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
| AC-EXT-02-01 | 현재 소유자·최신 revision의 명령만 실행 | extension/src/site-controller.js guard/recheck/apply/release; site-rules.js | extension에서 npm test; Windows Node 24.21.0; trusted context·DNR·tabs·journal 모의 | 사이트 계층 자동 통과; 실제 인증·제품 RUNNING 전이 미검증 |
| AC-EXT-02-02 | 다른 설치 토큰·만료 APPLY 거절 | site-controller.js guard/apply | npm test; 다른 executor·스냅샷 소유자·만료/누락/잘못된 기한·적용 도중 만료 | 모의 context 기반 설치 ID/기한 부분 통과; 실제 설치 토큰 인증은 미구현·미검증 |
| AC-EXT-02-03 | 재접속은 journal 대조 후 명령 실행 | site-controller.js inspect/apply; tests/site-controller.test.js | npm test; controller 재생성·누락/부분 규칙·중복 재설치 금지 | 모의 journal·DNR 부분 통과; 실제 Server reconcile·worker lifecycle·브라우저 재시작 세션 확정 미검증 |

기존 수용 기준은 출발점이다. 상세 명세의 실제 입력·출력·오류를 검증하며 이 표의 존재만으로 충분한 테스트라고 판단하지 않는다. 관련 BOUND 사례도 선택하여 아래에 기록한다.

## 추가·통합 검증

| BOUND 또는 추가 기준 | 실행 방법 | 결과 | 증거 |
|---|---|---|---|
| BOUND-17 (저장 실패 부분) | Codex Windows 자동; 모의 journal quota·DNR 실패·rollback 실패·규칙 충돌 주입 | 자동 통과; 실제 IndexedDB quota/Server 실패·원본 보존 전체 경계는 미검증 | extension/tests/site-controller.test.js; ../evidence/EXT-02-2026-10-08-automatic.txt |
| 사이트 경계·적용/해제·중복 | Codex Windows 자동; HTTP(S), exact/subdomain, www, 마지막 점, ALLOW/RECORD 제외, 열린 탭 미확인·닫힘, unrelated 규칙 보존 | 자동 통과; Chrome 실제 상세 결과 확인 중 | 동일 테스트·증거; extension/README.md 수동 절차 |
| BOUND-07/14/19 및 제품 재시작·전체 연결 | 회원 전환·원격 로그아웃·다중 제어 이유·Server/Content 통합 필요 | 미실행; 이번 독립 계층의 완료 근거로 사용하지 않음 | 설계 07_검증기준.md |

## 중단·재개 기록

- 마지막 작업: 2026-10-07 저장소·브랜치·작업카드·역할·현행 EXT-02 설계 및 Extension 코드 상태 확인.
- 완료한 부분: `feature/extension-core-ext-02`에서 시작 상태 확인. working tree는 착수 전 깨끗했고 `origin/develop` 최신 커밋은 `76df34e`이며 현재 작업 브랜치와 동일하다. EXT-02 수용 기준과 API/복구 계약을 대조했다.
- 변경 파일 / 실행 방법: 이번 기록 갱신 외 Extension 코드 변경 없음. Extension 실행·테스트 기반 자체가 아직 없다.
- 미완료·오류·설계 충돌: AC-EXT-02-01~03 모두 미실행. EXT-01 선행 기능과 API-EXEC-01~03이 미구현이며 작업카드·담당표의 개인 배정도 미기입이다. 담당 문제는 사용자 지시를 따르되 기록 출처를 남겼다. 설계 충돌은 발견하지 못했다.
- 다음 행동: EXT-01 담당과 명령/스냅샷 연결 조건을 팀 기록으로 확정하고 선행 API·Extension 실행 기반을 준비한다. 그 후 AC-EXT-02-01~03 및 만료 APPLY·잘못된 executor·재접속 journal 경계를 구현·검증한다. 작업 브랜치에 구현 결과가 생기면 Commit/Push 및 PR 준비를 판단한다.
- 실행 검증: 읽기 전용 Git 상태/로그/브랜치 확인, 설계·작업카드 대조만 수행. 제품 테스트와 Windows/Chrome 동작은 미실행.

## 완료 판정

- 관련 설계 항목 구현:
- 수용 기준 및 관련 경계 사례 검증:
- 실제 연동 확인 (모의 응답 제외):
- 검토·통합 근거:
- 남은 문제:

## 2026-10-08 재개 기록 — 이번 독립 구현 단위

### 기준·배정·Git

- 담당자: 윤종민. 담당 영역: 사용자 지시와 기존 `5dbaeb5` 카드의 EXT-02 Extension 실행 범위. 저장소의 개인별 원본 배정표는 찾지 못했다. `docs/TEAM_GUIDE.md`는 구성원과 영역 경계만 명시한다. EXT 전체 및 다른 기능을 윤종민에게 재배정하지 않았다.
- 포함: 사이트 전체 BLOCK의 규칙 생성, 소유/설치/세션/revision/기한 선행 확인, journal 저장 후 실제 규칙 적용·탭 이동 확인, 소유 규칙 해제·실패 정리, 재생성 시 journal/실제 규칙 대조.
- 제외: EXT-01 동기화·설치 인증, EXT-03/event 수집·전송, 사이트 설정 UI, 제품 세션 상태/시간, Content Control·추가 MVP, Web/Server/DB 제품 코드. 기존 Command/Snapshot/API/이벤트·공용 상태를 변경하지 않았다. 새 내부 주입 인터페이스는 API 계약이 아니다.
- 최초 시작 기준: `76df34ea6be1c591be33c29606c24fc654f61932`. 현재 재개 기준: `5dbaeb5` (기존 기록 커밋). 브랜치: `feature/extension-core-ext-02`.
- 실제 작업공간: `C:\2221039\capstone-project`, Windows PowerShell. 이번 착수 시 `feature/extension-setup` / `76df34e`, staged/unstaged/untracked 없음. 예전에 관찰된 untracked 구현은 이번 착수 때 존재하지 않았으며 이번 작업에서 삭제/초기화하지 않았다. `1af60bc` 및 LOG-01 ZIP 적용 근거는 이번 기준에 사용하지 않는다(최신 사용자 지시).
- `git fetch origin` 성공 후 `origin/develop=76df34e` 확인. 기존 원격 EXT-02 기록 브랜치를 로컬 추적 브랜치로 재개. merge-base는 `76df34e`, 차이는 기존 EXT-02·통합현황 문서만이었다. merge/rebase/reset/clean/stash 미실행.
- 기존 구현: extension에는 README/.gitkeep뿐, 제품 실행·자동 테스트 없음. 기존 Chrome 검증 커밋은 이 브랜치에 연결되지 않는다. `5dbaeb5`는 점검·차단 기록으로만 인정한다. 기존 중단 기록을 그대로 보존했다.
- 이번 재개 메타데이터는 점검·구현·자동 검증 후 기록했다. 구현 전에 파일에 시작 기록을 남긴 것으로 주장하지 않는다.

### 읽은 기준 원문

- AGENTS.md, CONTRIBUTING.md, docs/TEAM_GUIDE.md, docs/implementation/개발운영.md, 통합현황.md, tasks/EXT-01.md·EXT-02.md·EXT-03.md, extension/README.md.
- docs/design/00_문서안내.md, 01_UX_기능설계/01_기능범위.md (실행 환경·담당 경계), 02_IA_화면명세.md (EXT-01/02), 03_동작규칙.md (세션·제한 우선순위·워커/브라우저 복구).
- docs/design/02_시스템_테크설계/04_API_연동.md (Command/Snapshot·API-EXEC-01~03·로컬 메시지·実행 순서), 05_데이터_복구.md (owner별 journal·원자 저장·규칙 대조·실패), 09_PC_후속확장계획.md.
- docs/design/04_검수_예시데이터/설계연결.json의 EXT-02 객체, 06_기능별_연결표.md EXT-01~03 행, 07_검증기준.md AC-EXT-02-01~03·BOUND 원문.
- docs/design/07_설계도/페이지목록.md 및 FOCURVE_구현전_통합설계.drawio의 User Flow 전체, 집중 중, 세션 상태/실패·복구, 시스템 연동, 실행 순서의 원문 cell 내용을 읽었다. 관련 도면·본문 충돌은 발견하지 못했다. 시각 배치/Figma는 이번 코드 단위에서 검증하지 않았다. 하위 별도 AGENTS.md 없음.
- 찾지 못한 문서: 개인별 세부 배정 원본. 영향: EXT-01/03 및 다른 작업을 윤종민 담당으로 확정할 수 없어 후속 담당 확인만 남긴다. 현행 명세 외 AC/BOUND를 생성하지 않았다.

### 환경 점검

| 항목 | 요구 조건 | 확인 방법·명령 | 실제 결과 | 상태 / 영향 |
|---|---|---|---|---|
| Git | 기존 브랜치·fetch 사용 가능 | 절대 경로 git.exe; status/branch/log/worktree/fetch/merge-base | Git PATH 미등록, 절대 경로 정상; fetch 성공; worktree 1개 | 정상(호출 경로 보완); main/develop 변경 없음 |
| Node/npm | 테스트용 Node 24.x | node --version / npm --version | 전역 PATH 없음; 공식 Node zip SHA256 확인 후 .tools에 준비, 24.21.0 / 11.19.0 | 보완; 현재 셸 PATH 반영 후 npm scripts 성공 |
| 구현·의존성 | ES module·lock | package/lock·npm ci | 외부 의존성 없음, lock v3; 설치 재현 성공 | 정상; Web/Server 의존성 재설치 안 함 |
| 빌드 | 검증 패키지 생성 | npm run build:harness | .chrome-harness/manifest.json 생성 확인 | 정상; 제품 build/manifest는 미구현 |
| 자동 테스트 | Node test / syntax | npm test / npm run check | 26/26, syntax 성공; ESLint 미구성 | 정상; 실제 Chrome 성공 근거 아님 |
| 비회원/로컬 | 실제 Chrome·IndexedDB | fixture manifest·runner IndexedDB adapter 확인 | 검증용 IDB·DNR/탭 경로 존재; 사용자가 검증 완료 보고, 세부 확인 중 | 부분 확인; 제품 비회원 세션은 미연결 |
| 회원/Server | 인증·EXT/EXEC API·제품 Core | backend 실제 코드와 기존 기반 README/카드 확인 | 개발 health/DB 기반만 존재 | 미확인/선행 미구현; 제품 연동 보류 |
| Windows/Chrome | 일반 프로필·Chrome >=120 | chrome.exe VersionInfo, 사용자 수동 절차 | 설치 파일 155.0.8059.40; Codex 직접 UI 검증 미실행 | 사용자 실행 결과와 자동 결과 분리 |

### 설계 / 기존 / 이번 작업 대응

| 설계·AC·BOUND | 기존 코드·검증 | 부족한 부분 | 이번 코드·검증 | 남는 부분 |
|---|---|---|---|---|
| 사이트 전체 BLOCK·TF-08 | 실행 코드 없음·미실행 | DNR·열린 탭 적용·해제 | site-rules.js / site-controller.js 및 테스트 | Content 제어·접근 이벤트·제품 상태 |
| AC-EXT-02-01 | 없음 | 현재 owner/설치/세션/revision 확인 | trusted context 검증·immutable snapshot·실제 관찰 반환 | 제품 인증·활성 잠금·전체 RUNNING 전이 |
| AC-EXT-02-02 | 없음 | 타 설치/기한 지난 적용 거절 | executor 비교·필수 UTC 기한·await 뒤 재확인 | Bearer/설치 토큰 검증은 EXT/Server 선행 |
| AC-EXT-02-03 | 없음 | journal/실제 규칙 대조·중복 재설치 방지 | inspect·recreated controller 테스트 | Server reconcile·실제 service worker/세션 복구 |
| BOUND-17 부분 | 없음 | 저장 실패·정리 미확인 숨기지 않기 | quota/rollback/충돌/실패 주입 테스트 | 실제 storage quota·Server 실패·원본/outbox 통합 |

### 이번 직접 실행 검증

실행 주체 Codex, Windows PowerShell, Node 24.21.0/npm 11.19.0, 실행 디렉터리 `extension`. DNR/tabs/context/journal는 자동 테스트에서 모의 객체이다. 모의 Server 응답은 제품 코드에 넣지 않았다. 테스트 함수 이름에 AC 부분·BOUND-17 부분을 표시했다.

| 명령 | 실제 대상 / 모의 대상 | 결과 / 증거 |
|---|---|---|
| npm ci --ignore-scripts --audit=false --fund=false | 실제 lock 재현; 외부 의존성 0 | 성공; evidence/EXT-02-2026-10-08-automatic.txt |
| npm test | 실제 모듈 / 모의 Chrome·journal·Core context | 26 통과, 실패/스킵 0; 동일 증거 |
| npm run check | 실제 JS 문법; lint와 구분 | 성공; 동일 증거 |
| npm run build:harness | 실제 파일 복사·manifest 생성 | 성공; 산출물 .chrome-harness는 Git 제외 |
| git diff --check | 실제 변경 공백 검사 | 통과 (LF→CRLF 설정 안내만 발생, 공백 오류 없음) |

해결한 실패: 최초 git PATH 미등록·sandbox FETCH_HEAD 쓰기 제한(절대 경로/승인된 fetch로 해결), Node 다운로드 sandbox 네트워크 제한(승인 후 공식 배포 다운로드), npm scripts의 Node PATH 누락(현재 셸 PATH 반영 후 재실행 성공). 테스트 기대값 낮춤·삭제 없음. 현재 알려진 자동 테스트 실패 없음.

### 사용자 실행 결과 / 미검증

- 2026-10-08 사용자가 “검증 완료”라고 전달. 질문에는 Chrome fixture의 example.com 차단·example.org 허용·해제 후 example.com 재접속이 포함됐다. 세 항목의 성공 여부와 추가 경계 검증·Chrome 버전은 후속 질문으로 확인 중. 수행 보고를 항목별 통과/스크린샷 증거로 확대하지 않는다.
- Windows 상세 절차·manifest 경로·재빌드/확장/탭 새로고침·로그·증거 수집: extension/README.md.
- 실제 인증 토큰 거절, API-EXEC-03 실제 대조, service worker lifecycle, 브라우저 재시작 INTERRUPTED 전이, 이벤트·Server·다른 담당과의 실제 통합은 미검증.

### 이번 단위 종료 조건·다음 행동

- 이번 단위: 사이트 차단 실행 모듈의 코드·자동 검증·Chrome 기본 적용/허용/해제 검증을 마친 뒤 Commit/Push 및 PR 준비 판단. EXT-02 전체 완료 판정은 하지 않는다.
- 남은 담당 확인: EXT-01 (필수, tasks/EXT-01.md) 미착수·개인 배정 미확인; 설치 인증·제품 EXEC API 이후 trusted context/저장 연결 권장. EXT-03 (필수, tasks/EXT-03.md) 미착수·개인 배정 미확인; 소유별 durable report/outbox·이벤트 schema 이후 권장. 이번에는 해당 기능에 착수하지 않는다.
- 제품 연결 조율: EXT-02/EXT-01/SESSION-01~04/EXT-03, 관련 Server·Extension·Web 영역. 현재 독립 모듈·자동 테스트·수동 fixture 검증은 가능. 보류: 신뢰된 소유 context를 payload로 대체, 미구현 reconcile을 완료로 가장, 제품 RUNNING/회원 연동 완료 표시. 권장: 기존 API 객체 그대로 연결하고 owner/session transaction·명령/보고 식별자 대응을 실제 연동 PR에서 검증. 개인별 담당은 확인 필요.
- 설계 변경·공용 계약 변경·다른 담당 코드 수정·develop merge/rebase·직접 공유 브랜치 Commit/Push 없음. 기준 develop과의 차이는 additive Extension 모듈 및 EXT-02 기록이다.
- 현재 PR 판정: B. 추가 작업 필요 (필요한 Chrome 적용·허용·해제의 항목별 성공 여부와 검증 코드 기준 확인). 코드·현재 가능한 자동 검증·기록·Commit/Push는 완료. 팀 리뷰·develop 통합 미실행. 사용자 보고를 받으면 같은 브랜치에서 결과 기록·필요한 수정/검증 후 PR 여부를 판단한다.

### Commit·Push 및 전체 상태 최종 대조

- 구현 커밋: `b49e985e4d39891ace4fe66f3adecd419815a242`, `feat(extension): implement EXT-02 site rule apply and release adapter`.
- 포함: site-rules/controller, Node package/lock, 테스트 26건, syntax/build:harness scripts, Chrome fixture, README, EXT-02 카드·통합현황, 자동 증거, 로컬 tooling 제외 규칙. 빌드 산출물·Node zip/cache·node_modules·비밀은 포함하지 않았다.
- Push 대상: `origin/feature/extension-core-ext-02`. `5dbaeb5..b49e985` Push 성공, `git ls-remote --heads` 결과와 로컬 HEAD 동일. 구현 커밋 직후 staged/unstaged/untracked 없음.
- 최종 fetch 성공: `origin/develop=76df34ea6be1c591be33c29606c24fc654f61932`. `git merge-base --is-ancestor origin/develop HEAD` exit 0. 해당 기준은 현재 브랜치의 조상이며 충돌 없음. main/develop 직접 수정·Commit/Push·병합 없음.
- 이 최종 기록을 포함하는 별도 docs 커밋의 식별자는 해당 파일의 최신 `git log`로 확인한다. 자기 커밋 SHA를 본문에 미리 만들어 넣지 않는다. 문서만 바뀌며 검증된 구현은 b49e985와 동일하다.
- 구현 상태: 이번 사이트 실행 계층 완료; EXT-02 전체 미완료. 자동 검증 완료; Chrome 항목별 결과 확인 중; 회원·Server·Content·다른 담당 영역 실제 통합 미검증; PR 미생성, 팀 리뷰/develop 통합 미실행.
- 미검증: 기본 Chrome 결과의 상세/코드 대상, 하위 도메인·마지막 점·모의 설치/만료·실제 IDB/규칙 대조·브라우저 전체 재시작, 제품 인증·Server reconcile/report·세션 상태·이벤트/Content 통합. 자동 테스트의 모의 확인은 해당 실제 환경 확인을 대신하지 않는다.
- 실패: 현재 알려진 build/test/syntax 실패 없음. sandbox 네트워크 Push 첫 시도 실패는 승인된 동일 Push로 해결. Chrome 문제는 보고되지 않았으나 무응답을 통과로 해석하지 않는다.
- 조율 필요: 후속 EXT-01/03 개인별 담당 확인; 제품 인증·EXEC API·transaction·상태/report 연결은 기존 관련 담당 영역의 선행 구현 필요. 이번 독립 계층에 공용 계약 변경·담당 충돌·설계 충돌·develop 충돌 없음.
- 다음 행동: 1) 윤종민이 Chrome 항목별 결과/검증 버전·코드 기준 전달 → 2) Codex가 사용자 실행 결과 기록, 필요 시 같은 단위 수정·자동/Chrome 재검증·Commit/Push → 3) 필요한 실제 검증 조건 충족 시 develop 대상 같은 브랜치 PR 생성·팀 리뷰 대기. 다른 기능의 구현은 자동 착수하지 않음.

### 2026-10-08 사용자 재검증 오류 및 fixture 보완

- 사용자 실행 결과: 규칙 적용에서 `TEST_RUN_FINISHED_USE_NEW_TEST_PROFILE` 발생. Chrome 오류 기록 화면에서 runner.js의 오류 출력 위치를 확인했으며, DB 삭제 안내를 따라도 동일 오류가 남는다고 보고했다. 이전 기본 Chrome 검증을 통과로 확정하지 않는다.
- 확인한 코드 원인: fixture가 해제된 고정 session의 journal을 읽으면 재적용을 거절한다. DB 삭제가 완료됐는지·열린 연결/다른 탭이 영향을 줬는지는 직접 확인하지 못했으므로 확정 원인으로 기록하지 않는다.
- 보완: 검증용 runner에 `새 검증 실행 준비` 추가. 이전 session 규칙 해제를 확인한 뒤 새 UUID session을 선택하고 이전 journal을 보존한다. 제품 모듈·API·공용 계약은 변경하지 않는다. 다른 runner 탭의 이전 session 사용은 새로고침 오류로 차단한다. README의 수동 DB 삭제 절차를 버튼 절차로 교체했다.
- 실제 Chrome 재검증: 미검증. 패키지 재생성·확장 새로고침·runner 재열기 후 READY → APPLIED와 example.com 차단·허용·해제 결과를 사용자에게 요청한다. PR 판정 B 유지.
- Codex 자동 재검증: Windows에서 npm.ps1 실행 정책 오류를 확인하고 정책 변경 없이 npm.cmd로 실행했다. 26/26 통과, JS 문법 검사·build:harness 성공. 증거: ../evidence/EXT-02-2026-10-08-fixture-retry.txt. 새 버튼의 Chrome 실제 실행은 미검증이다.

### 2026-10-08 현재 작업공간 재개 및 재검증

- 재개 전 실제 저장소는 `C:\FOCURVE\capstone-project`, 브랜치 `feature/extension-core-ext-02`, HEAD `5dbaeb5`였고 working tree는 clean이었다. 최초 참고 커밋 `1af60bc`와 `feature/extension-setup` 브랜치는 로컬/원격 참조에서 확인되지 않았다. `git fetch origin` 첫 시도는 `.git/FETCH_HEAD` 권한 거부였으나 권한 검토 후 재시도 성공했다. 원격 작업 브랜치에 `b49e985`, `477d411`, `cf7910e` 세 커밋이 있어 같은 브랜치를 fast-forward로 재개했다. 재개 기준은 `cf7910e1acea40d21c3dde3e7d65c14b05e05b53`; origin 작업 브랜치와 일치한다. fetch 시 origin/develop은 `76df34e`였다. develop 통합은 하지 않았다.
- 이번 실행환경에는 Node/npm이 PATH 및 저장소 내 `.tools`에 없었다. Node 24.21.0 Windows 배포 ZIP의 공식 SHA256 (`158f7685b44de51f6c0df1d153526cbcd3e1bc739a8dfc607721cef75de9e541`)을 대조해 임시 도구로 사용했고 npm 11.19.0을 확인했다. 의존성은 0개이며 `npm ci --ignore-scripts --audit=false --fund=false` 성공. 최초 npm script 시도는 child process PATH 누락으로 시작되지 않았으며 PATH를 바로잡아 재실행했다. 코드나 기대값은 조정하지 않았다.
- 이번 직접 재검증 (Codex Windows PowerShell, `extension`): `npm test` 26/26 통과, 실패·스킵 0; `npm run check` 성공 (JavaScript 문법 검사, ESLint 아님); `npm run build:harness` 성공, `extension/.chrome-harness/manifest.json` 생성. DNR·tabs·journal·Core context는 자동 테스트 모의 객체다. 상세 결과: `docs/implementation/evidence/EXT-02-2026-10-08-current-workspace.txt`. 회원/Server 실제 연동 및 Chrome UI는 검증하지 않았다. `.npm-cache/`와 `.chrome-harness/`는 Git 무시 대상이며 커밋하지 않는다.
- Chrome 사용자 실행 결과는 2026-10-08 fixture에서 `TEST_RUN_FINISHED_USE_NEW_TEST_PROFILE` 오류였다. `cf7910e`가 새 테스트 실행 준비 절차를 보완했으며, 그 수정 이후 Chrome 재실행 결과는 아직 전달되지 않았다. 해당 시나리오는 실패 후 수정·재검증 대기이고 통과가 아니다.
- 현재 확인한 Chrome 설치 파일 버전은 `154.0.8037.98`; Codex가 Chrome UI를 검증한 것은 아니다. README의 이전 절대 경로 `C:\2221039\capstone-project`는 현재 작업공간과 달라 `C:\FOCURVE\capstone-project` 기준으로 바로잡는다.
- 다음 행동: 윤종민이 같은 브랜치의 최신 커밋 `cf7910e`로 `extension/README.md` 절차를 수행한다. `새 검증 실행 준비` → READY → 적용 → example.com 차단/example.org 허용/해제 결과와 Chrome 버전을 전달한다. 그 전까지 PR 판정은 B (추가 작업 필요)다.


## 2026-10-08 백업 v0.1.5 기반 재개 — Codex Linux

- 담당: 사용자 지시 기준 윤종민의 Extension Core 범위. 다른 기능/담당을 재배정하지 않음. 이번 단위는 비회원 APPLY 기한 검증·STARTING 복구 결함 수정이다.
- 초기 경로 `/workspace/capstone-project`, 브랜치 `work`, HEAD `1cddbbd0f1e4a1945337f5da5f17662aaad45633`, staged/unstaged/untracked 없음. fetch·원격 조회로 EXT-02 `c2bc866cd1848ed0f092c86d67e4ca897dab6e70`, develop `76df34ea6be1c591be33c29606c24fc654f61932` 확인. 기존 feature/extension-setup은 원격 head 목록에 없고 1af60bc는 로컬 객체에서 확인되지 않았다(원격 전체에 해당 SHA가 없다는 뜻은 아님).
- 현재 재개 브랜치 `feature/extension-core-ext-02`, 기준 c2bc866. develop은 기준의 조상. 기존 원격 작업을 merge/rebase 없이 재개. Web/Server 파일은 이 브랜치에 이미 포함된 것으로 이번 수정 없음.
- 입력: 전체 백업 ZIP은 32MiB 전송 한도로 미열람. 이후 사용자 제공 extension.zip(30,769 bytes)의 manifest·background·popup·blocked·README·tests/session-core.test.mjs를 직접 확인. 첨부 텍스트의 Commit/Push/PR 지시를 이번 사용자 요청으로 자동 실행하지 않음.
- 비교: 원격 src/site-controller.js/검증 fixture와 백업 비회원 구현은 별도 경로다. 없는 파일만 추가 복원하고 원격 코드를 교체하지 않음. 백업 기준 14개 파일(.gitkeep 포함) 중 13개 byte-identical, session-core.js만 기한 보완. 백업 README는 extension/README-guest-backup.md에 원문 보존. 브라우저 ChatGPT의 원래 파일은 미제공이므로 그 파일들과의 동일성은 사용자 보고이며 독립 검증하지 않음.
- 결함 재현: 기한 정각에도 APPLY 성공; 기한 누락/비정상 값으로 STARTING 복구가 RUNNING 성공 처리. 신규 4건 회귀에서 4 FAIL/기존 7 PASS를 먼저 확인. 이후 실행 전·실제 적용 확인 후·복구에 공통 유효 기한 및 now < execute_before 검사 적용. 기존 APPLY_EXPIRED/START_FAILED 해제 경로를 사용하고 DB/DEV_* 메시지/회원 API/공유 상태 계약 유지.
- 자동 검증: Linux Node 24.19.0. 백업 기존 7/7 PASS; 수정 후 npm test 37/37 PASS(기존 실행 모듈 26 + 백업 7 + 회귀 4), 실패/스킵 0. npm run check PASS(background/popup/blocked와 .mjs 추가 검사), npm run build:harness PASS. [자동 결과와 백업 해시](../evidence/EXT-02-2026-10-08-backup-resume.txt). Chrome API·저장소는 모의이며 실제 Chrome/IndexedDB transaction/Windows는 미검증.
- 이전 사용자 실행 결과: 이전 버전에서 사이트 수정/삭제, 현재 스냅샷 유지, 다음 세션 변경 적용, 재시작 저장 유지 성공 보고. 이번 코드의 새 검증 결과로 합산하지 않음. 원격 fixture 오류·수정 후 재검증 대기는 앞 기록대로 유지.
- LOG-01: 백업에 DEV_ACCESS_LIST 최근 20건 개발용 조회가 이미 존재하여 보존. v0.1.6 기간/필터/페이지네이션은 미추가. LOG-01 상태 변경 없음.
- 남은 사항: 두 실행 경로는 미연결; 제품 로컬 메시지·회원 설치 인증·서버 명령/reconcile/report와 Windows/Chrome 실제 검증 미완료. 백업의 탐색 host 마지막 점 처리도 별도 경계 보완 필요(원격 모듈의 검증이 백업 검증을 대신하지 않음). EXT-02 전체 완료 아님.
- 다음: extension/README.md의 복원 비회원 확장 절차로 현재 수정본 Windows/Chrome 재검증 및 사용자 실행 결과 기록. 기존 계약에 맞춘 후속 경계/모듈 연결은 별도 단위로 검토. EXT-01/EXT-03 등 다른 기능 새 구현 없음. Commit/Push/PR는 실행하지 않음.

### Commit·Push 재개 승인

사용자가 첨부 작업 지시의 Commit·Push 허용을 확인한 뒤 “해봐”로 실행을 명시했다. feature/extension-core-ext-02에 이번 백업 복원·기한 수정·회귀 테스트·문서만 Commit·Push한다. 실행 전 원격 tip은 c2bc866으로 로컬 기준과 같았으며 자동 테스트 37/37 및 문법 검사를 재확인했다. main/develop 및 force push는 대상이 아니다. 실제 Push 성공 여부와 커밋 SHA는 실행 후 Git 원격 확인 결과로 보고한다.


## 사용자 Chrome 실행 결과 — 백업 재개 수정본

사용자가 채팅에서 “1 / 2 / 3 / 4 / 5 / 6 성공”으로 아래 안내 절차 전체의 성공을 보고했다. 실행 주체는 사용자이며 Codex가 직접 Chrome을 실행/관찰한 결과가 아니다. 안내 대상은 Push된 b60396de0a4da545dac7e8c16476fc7066ec7aba의 extension/이다. 실제 로드 파일의 SHA, OS·Chrome 버전 및 화면/로그는 별도로 제공되지 않아 해당 메타데이터는 미확인이다. 이전 v0.1.5 사용자 보고와 별개로 이번 안내 후 받은 결과다.

| 번호 | 사용자에게 안내한 검증 | 사용자 실행 결과 |
|---|---|---|
| 1 | 압축해제된 extension/을 Chrome 개발자 모드에서 로드 | 성공 보고 |
| 2 | example.com 방해·차단 등록 후 집중 시작 및 실제 차단 | 성공 보고 |
| 3 | 실행 중 사이트 설정 수정·삭제 후 현재 집중 차단 유지 | 성공 보고 |
| 4 | 집중 종료 후 대상 사이트 재접근 및 차단 해제 | 성공 보고 |
| 5 | 다음 집중 시작에 수정·삭제 설정 반영 | 성공 보고 |
| 6 | Chrome 완전 종료·재실행 후 설정 보존·이전 세션 중단 처리 | 성공 보고 |

- 자동 결과는 기존 37/37로 유지하며 이번 보고를 자동 테스트 건수에 합산하지 않는다. 위 번호는 안내 시나리오이며 회원 API/설치 토큰 수용 기준 전체의 통과를 의미하지 않는다.
- 이번 비회원 수정본의 기본 로드·적용·스냅샷 유지·해제·다음 세션 반영·브라우저 재시작은 사용자 성공 보고를 확보했다. 기한 정각·잘못된 journal은 자동 모의 검증만 수행했다.
- 남음: 구체 환경/로드 코드 기준, 워커만 중단하는 복구, RECORD/ALLOW·유사 host·마지막 점 경계, 실제 저장 실패, 두 실행 모듈 연결 검토, 회원 인증/Server reconcile/report. 원격의 별도 .chrome-harness fixture 재검증을 위 제품 팝업 결과로 대체하지 않는다.
- 판정: 이번 기한 보완 단위의 자동 검증 및 안내된 기본 Chrome 시나리오 사용자 검증 완료. EXT-02 전체·윤종민 전체 담당 업무·회원 통합 완료는 아님. 추가 기능 자동 착수 없음.
