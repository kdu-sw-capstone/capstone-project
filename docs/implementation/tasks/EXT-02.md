# EXT-02 · 접근 제한 적용

단계: 필수 MVP · 설계 담당 영역: Extension

## 최신 작업 — Core 문서별 제어 registry 독립 기반

윤종민 / feature/extension-core-ext-02 / 시작63193ef. 제품 wire를 연결하지 않고 별도 native IndexedDB 문서/제어 의무·단조 sequence·중복/충돌·epoch·원래 binding cleanup·Worker 재확인 guard 구현. **Extension174/174·문법 PASS, 실제 Chromium Dedicated Worker/IndexedDB 종료·재생성/실패 복원 재시도 PASS**(문서/lifecycle/효과는 합성). [구현·검증·한계](../evidence/EXT-02-2026-10-10-document-registry.md). 제품 Worker/Content 미연결·실제 MV3/YouTube/Server 및 전체 AC 미검증. 다음: 공동 D06 확정→한 문서 비회원 Shorts adapter 연결. 제품 wire 임의 구현/기능 거절 해제/develop 병합 없음.

## 최신 작업 — Content 검토 응답에 대한 Core 재응답

윤종민 / feature/extension-core-ext-02 / 시작5c6064a. Content bcca674·Draft PR21·Shorts 기록 및 최신 Core/공용 D06/Event1.2 대조. [Core 재응답](../Content_Core_D06_Core재응답_2026-10-10.md)에 제안마다 수락/수정/보류·미결속 QUERY·seq/캐시·필수 문서 집합·media0/탐색·freeze와 다훈 확인 S1~S5·수정 JSON9개·최소 A단위를 작성했다. **공동 계약 미확정, 제품 메시지 구현 없음**. 문서 JSON/참조/diff 검사만 실행, 기능 테스트 NOT RUN. 다음: 지민 재확인/다훈 보고·이벤트 매핑 확인→공동 계약 기록→한 문서 비회원 Shorts 적용/해제 단위. develop 병합 금지.

## 최신 작업 — 제품 회원 Worker loop (0.1.6)

윤종민 / feature/extension-core-ext-02 / 시작3f77cad. 제품 Worker에서 verified auth·실제 Server session/context·SiteController·별도 control/report IDB·commands/APPLIED/RELEASED·수동/만료 local END/reconcile 연결. Worker 복구는 실제 규칙/Server 대조, 사라진 규칙은 자동재적용하지 않고 복구 확인 상태, 미확인 gap 제외. Extension159/159·UI23·Backend전체165/165/package 및 최종 실제 HTTP3/3 통과(Chrome DNR/인증은 모의). **실제 Windows 회원 Chrome·alarm/절전·Event1.2 수집·신규 자동재개 및 전체 AC 미검증**. [구현·검증·실패·수동절차](../evidence/EXT-02-2026-10-10-member-worker-loop.md). Content D06 회신 대기, develop 병합 금지 유지.

## 최신 작업 — 회원 명령 조회·실행 보고 통신 단위

윤종민 / feature/extension-core-ext-02 / 시작 b674693. 기존 commands/reports API의 설치·회원 결속 조회, 별도 IndexedDB 보고 원문 저장·같은 ID 재전송·확정 거절 격리 구현. Extension139/139·Backend163/163/package·실제 Chromium Worker/IndexedDB 시험 통과. 실제 HTTP/MySQL에서 SiteController와 보고 adapter를 연결해 적용/보고 유실 재전송/종료/해제를 확인했으나 DNR·인증·trusted context는 합성이다. **제품 Worker 회원 loop·타이머·reconcile는 미연결, 실제 회원 Chrome 및 전체 AC 미검증**. [코드·검증·초기 SQL 실패·다음 단계](../evidence/EXT-02-2026-10-10-member-execution-client.md). Content D06 미합의·develop 병합 금지 유지.

## 최신 작업 — Server 명령 시각·기간 기반

최신 develop90ad32b를1de73ee로작업브랜치에merge하고연동가이드양쪽기록보존. 내부SiteController의9자리UTC시각/기간1~180검증·명령/세션결박·회원별도IDBjournal·중복timer보존구현. Extension124/124·Backend162/162·Web121/121·buildPASS. **제품Worker회원명령loop/타이머/보고는아직미연결**. [근거·실패이력·다음단위](../evidence/EXT-02-2026-10-10-command-duration.md). 실제Chrome이번기간검증미실행,EXT02전체미완료.

## 최신 재개 — D06 필수 Shorts 연결 계약 구체화

- 담당 윤종민 / feature/extension-core-ext-02 / 시작 b8bc7a17269a9c46981f6891f9fc92e9d98c38c9.
- 사용자 확인: 지민 검토 회신 아직 없음. D06 메시지/적용집계/탐색/freeze는 합의 대기. [필수 Shorts 메시지 초안](../Content_Core_D06_필수Shorts_메시지초안.md)에 필드·JSON·실패·중복·검증 순서를 작성했으며 제품 wire 구현 없음.
- 최신 develop90ad32b의 SnapshotValidation/SnapshotAccess/공용 D06을 읽기 전용 대조. 현재 Core에 merge했다고 표시하지 않음. API·제품 코드·다른 담당 브랜치는 변경하지 않음.
- 사용자 수정본 회원 연결 성공: 팝업 연결 확인 완료 원본 화면·Web 새로고침 후 연결됨 보고 확보. [실제 회원 연결 기록](../evidence/EXT-02-2026-10-10-member-chrome-link.md). 회원 명령/보고 및 EXT02 전체는 여전히 미검증.
- 이번 테스트: 제품 코드 변경 없어 실행 테스트 재실행 없음. 문서 JSON 구문·링크·diff만 확인. 다음: 지민·다훈의 계약 결정 → 합의한 주입/적용/해제 A단위부터 구현.

## 최신 오류 수정 — Worker fetch (2026-10-10)

Windows 제품 회원 설치 등록에서 Illegal invocation 실패를 확인. auth/event 기본 fetch를 Worker 전역에 바인딩하고 모의116/116·실제 Chromium Dedicated Worker 수정전실패/수정후합성HTTP2건 회귀통과. 수정본 Windows 회원연결은 미검증, 기존 미확인 상태 자동해제 없음. 최신 develop90ad32b 및 시각9자리/duration/회원명령은 후속. [근거와 수동 절차](../evidence/EXT-02-2026-10-10-fetch-worker.md).

## 작업 상태

- 상태: 진행 중 — 2026-10-10 D09 제품 설치·PKCE·토큰/guest전환guard 구현. Extension모의114/114·UI19항목·Backend140/140·최종Auth실HTTP/MySQL합성1/1 통과. f6 비회원Chrome1~25 사용자성공/원본캡처/환경 확보(로드hash미대조), 이번Auth코드제품Chrome·회원명령/보고·필수전체AC미검증. Commit/Push/PR17갱신 허용, develop병합 금지. 과거Git동결은당시이력.
- 실제 담당자: 윤종민 — 기존 배정 원문(원본보관 ZIP의 개발계획 v1.3: Extension Core·세션·URL/Domain·사이트 정책·차단 페이지·시작/종료 연동)과 사용자 지시 기준. EXT 전체·Content Control을 재배정하지 않음
- 브랜치 / 시작 기준 커밋: `feature/extension-core-ext-02` / `76df34e` (2026-10-07, origin/develop 최신 확인)
- PR: [#17](https://github.com/kdu-sw-capstone/capstone-project/pull/17), develop ← feature/extension-core-ext-02, 현재 Open(non-draft)·수정 후 재검토 중. 사용자가 직접 생성했으며 병합하지 않음
- 선행 작업 / 차단 조건: 제품 연결은 EXT-01·API-EXT-01~07·API-EXEC-01~03, 제품 IndexedDB transaction·ExecutionReport/outbox·세션 상태 연결이 필요하다. 이번에는 기존 Command/Snapshot 명세로 사이트 차단 실행 모듈만 독립 구현했다. 기존 2026-10-07 차단 기록은 아래에 보존한다.

| 영역 | 담당 | 구현 상태 | 검증 상태 |
|---|---|---|---|
| Web | | 미확인 | 미실행 |
| Server | | 미확인 | 미실행 |
| Extension | 윤종민* | 비회원 Core·Snapshot1.2·팝업·신규Event1.2 및 별도 회원 전송adapter. 제품 회원 인증/context/명령loop 연결 미완료 | 모의96/96·UI17·Backend139/139. 실제HTTP/MySQL 합성3/3. 이번 제품 회원Chrome 전체 미검증, 과거 사용자 Chrome 이력과 분리 |

\* 현행 TEAM_GUIDE/기존 카드의 개인 배정란은 상세하지 않지만, 이후 보관 ZIP에서 기존 3인 배정 원문을 확인했다. 기술 기준은 현행 설계이며 보관 원문은 배정 확인에만 사용한다. 과거 탐색·검증 결과는 아래 이력에 보존한다.

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
| AC-EXT-02-01 | 현재 소유자·최신 revision 실행 + 실제 회원 설치 적용/Server 보고 | site-controller.js guard는 내부 adapter. product service-worker.js에는 Guest 경로만 있음 | 현재 Node 모의 + 제품 경로 코드 확인 | **차단/미검증** — 회원 Core context·명령/보고 API 연결 선행. 최신 Server endpoint는 존재하지만 제품 Core 연결 미완료. 모의 guard를 실제 회원 통과로 보지 않음 |
| AC-EXT-02-02 | 다른 설치 인증·유효하지 않은 인증/만료 APPLY 거절 및 규칙 보존 | site-controller.js executor/owner/revision/기한 비교 | 내부 getContext/Chrome 모의 검사 | **차단/미검증** — 실제 설치 토큰 발급/검증/회수 및 인증 HTTP/규칙 원본 증거 필요 |
| AC-EXT-02-03 | 실제 Worker 재생성 journal 대조 + Server reconcile 후 실행 | GuestSession recovery, adapter inspect; Server reconcile 경로 없음 | fresh VM 모의; 현재 Chromium 제품 로드 시도는 관리자 제한 | **차단/미검증** — 최신 실제 Chrome Worker/journal·API-EXEC-03 연동 근거 없음. 과거 사용자 stop 성공은 이번 코드 통과 근거 아님 |

기존 수용 기준은 출발점이다. 상세 명세의 실제 입력·출력·오류를 검증하며 이 표의 존재만으로 충분한 테스트라고 판단하지 않는다. 관련 BOUND 사례도 선택하여 아래에 기록한다.

## 2026-10-10 현재 단위 판정

[이번 코드·실행 환경·기준별 결과·남은 작업](../evidence/EXT-02-2026-10-10-event12.md). Event1.2 실제HTTP adapter/DB 단위 통과는 실제 회원Chrome 필수 AC 통과가 아니다. AC01/02/03·BOUND17 전체 미검증 유지. 최신 기준 develop b45a680을 작업 브랜치에 merge했고 Server endpoint 선행 구현은 이제 존재한다. 다음은 제품 회원 설치 인증/context 및 명령/보고 연결이며, Server 자동복구 미지원 계약은 별도 차단이다.

## 2026-10-09 필수 경계·당시 코드 판정 (과거 이력)

| 기준 | 현재 결과 | 남은 작업·담당·필요 증거 |
|---|---|---|
| BOUND-17 | **미검증/통합 차단**. adapter journal/rollback 실패 주입은 모의 부분 검증 | 윤종민: 제품 IndexedDB 실제 quota·실패 표시/자료·규칙 보존 검증. Server 담당: 실제 장애 endpoint/인증·재시도/보고 계약. 실제 실행 전후 DB/DNR/outbox와 실패 UI 필요 |
| 최신 제품 Chrome 팝업·차단·해제·복구 | **미검증**. Chromium151.0.7922.173/Linux에서 실제 제품 로드 관리자 정책 오류 | 윤종민 구현·사용자 로컬 실행: 최신 미커밋 제품 SHA256 식별 + OS/Chrome 버전 + 수동 절차 + 화면/DB/DNR/journal 필요 |
| SITE 방문-host 이벤트 계약 | 로컬 수정, 신규 회귀5건 포함79/79 **모의** 통과. 실제 HTTP 미검증 | 팀장(Server): matched_policy_host 필드/API/검증기·legacy 처리/테스트; 양쪽 HTTP 수신 이벤트/반복 계산 확인 |

이번 작업 식별은 HEAD e79ef30 + 미커밋 product-identity.json SHA256이다. 최종 커밋 SHA는 생성하지 않는다. 최신 결과/담당/실행 절차는 [팀 리뷰 대응 기록](../evidence/EXT-02-2026-10-09-review.md) 참조.

## 과거 추가·통합 검증 이력 (현재 통과 판정 아님)

| BOUND 또는 추가 기준 | 실행 방법 | 결과 | 증거 |
|---|---|---|---|
| BOUND-17 (저장 실패 부분) | Codex Windows 자동; 모의 journal quota·DNR 실패·rollback 실패·규칙 충돌 주입 | 자동 통과; 실제 IndexedDB quota/Server 실패·원본 보존 전체 경계는 미검증 | extension/tests/site-controller.test.js; ../evidence/EXT-02-2026-10-08-automatic.txt |
| 사이트 경계·적용/해제·중복 | Codex Windows 자동; HTTP(S), exact/subdomain, www, 마지막 점, ALLOW/RECORD 제외, 열린 탭 미확인·닫힘, unrelated 규칙 보존 | 자동 통과; Chrome 실제 상세 결과 확인 중 | 동일 테스트·증거; extension/README.md 수동 절차 |
| BOUND-07/14/19 및 제품 재시작·전체 연결 | 회원 전환·원격 로그아웃·다중 제어 이유·Server/Content 통합 필요 | 미실행; 이번 독립 계층의 완료 근거로 사용하지 않음 | 설계 07_검증기준.md |

## 과거 중단·재개 기록 (이하 당시 환경·개수/결과를 보존)

- 마지막 작업: 2026-10-07 저장소·브랜치·작업카드·역할·현행 EXT-02 설계 및 Extension 코드 상태 확인.
- 완료한 부분: `feature/extension-core-ext-02`에서 시작 상태 확인. working tree는 착수 전 깨끗했고 `origin/develop` 최신 커밋은 `76df34e`이며 현재 작업 브랜치와 동일하다. EXT-02 수용 기준과 API/복구 계약을 대조했다.
- 변경 파일 / 실행 방법: 이번 기록 갱신 외 Extension 코드 변경 없음. Extension 실행·테스트 기반 자체가 아직 없다.
- 미완료·오류·설계 충돌: AC-EXT-02-01~03 모두 미실행. EXT-01 선행 기능과 API-EXEC-01~03이 미구현이며 작업카드·담당표의 개인 배정도 미기입이다. 담당 문제는 사용자 지시를 따르되 기록 출처를 남겼다. 설계 충돌은 발견하지 못했다.
- 다음 행동: EXT-01 담당과 명령/스냅샷 연결 조건을 팀 기록으로 확정하고 선행 API·Extension 실행 기반을 준비한다. 그 후 AC-EXT-02-01~03 및 만료 APPLY·잘못된 executor·재접속 journal 경계를 구현·검증한다. 작업 브랜치에 구현 결과가 생기면 Commit/Push 및 PR 준비를 판단한다.
- 실행 검증: 읽기 전용 Git 상태/로그/브랜치 확인, 설계·작업카드 대조만 수행. 제품 테스트와 Windows/Chrome 동작은 미실행.

## 완료 판정

- 관련 설계 항목 구현: 비회원/adapter 일부, 회원 경로 미구현
- 수용 기준 및 관련 경계 사례 검증: 필수 전체 통과 아님
- 실제 연동 확인 (모의 응답 제외): 최신 Chrome/회원/HTTP 미검증
- 검토·통합 근거: 팀 PR17 수정 요청, 기존 PR는 갱신하지 않음
- 남은 문제: 위 최신 판정표의 차단/미검증 및 Server 선행 자료 부재

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


## 비회원 도메인 경계 보완 — 착수

- 이번 기능 ID: EXT-02. 담당: 윤종민, 기존 Extension Core 배정 원문(보관 ZIP의 개발계획 v1.3) 및 현행 역할 경계 기준.
- 브랜치 feature/extension-core-ext-02, 시작 기준 2931b385c99e10ee22c7b278877874275a6d87aa; 시작 전 working tree clean.
- 이번 목표: 기존 비회원 matches/buildRules의 도메인 판별 일치, 마지막 점·정확 host·하위 도메인·유사 host·ALLOW/RECORD 경계와 스냅샷/해제 회귀 검증.
- 기준: docs/design/01_UX_기능설계/01_기능범위.md·03_동작규칙.md, 02_시스템_테크설계/04_API_연동.md·05_데이터_복구.md, 04_검수_예시데이터/07_검증기준.md. AC-EXT-02-01/03의 사이트 적용·복구 부분 및 SESSION-04 연관 경계.
- 범위: 비회원 Core 도메인 판별/차단 규칙 및 관련 테스트·기록. 회원 API·Content Control·LOG-01·공유 계약·두 모듈 전면 통합은 제외. 현재 상태 진행 중, 결과는 아래 후속 기록으로 확정.

### 도메인 경계 보완 결과

- 배정 재확인: 보관 ZIP의 `02_시스템_테크설계/FOCURVE_개발계획_v1.3.md`에서 윤종민의 Core·URL/Domain·사이트 정책 배정을 찾았다. 앞 기록의 “배정표를 찾지 못함”은 당시 탐색 결과이며 이번에는 원문을 확인했다. 보관 문서는 배정 근거에만 사용하고 기술 계약은 현행 설계를 적용했다.
- 수정: matches는 탐색 hostname의 마지막 DNS 루트 점 하나를 제거, buildRules는 동일한 선택 루트 점과 탐색 userinfo 부분을 허용. 정확 host/하위도메인 경계·www·IDNA ASCII·main_frame·BLOCK만 적용하는 원칙을 유지했다. 등록 URL 자격정보/포트 거절·DB·이벤트 형식·회원 계약 변경 없음.
- 재현: 변경 전 소스에 신규 테스트를 실행하여 기존 11 PASS/신규 5 FAIL을 확인. 마지막 점 주소의 판별·규칙·열린 탭·다음 세션 차단에서 누락을 검출했다.
- 수정 후: Node 24.19.0 `npm test` 42/42 PASS, 실패·스킵 0; `npm run check` PASS, `npm run build:harness` PASS. 신규 5건에서 exact/subdomain URL 행렬(각 15개), www/IDNA, BLOCK만 열린 탭 이동, pending URL, 소유 해제 및 unrelated 규칙 보존, 현재 스냅샷 고정/다음 세션 반영 검증. Chrome API/storage는 모의이며 regex는 JS RegExp 검사다.
- 실제 브라우저 시도: Linux Chromium 151.0.7922.173과 환경 제공 Python Playwright 사용. 기본 확장 로드에서는 worker가 없었고 런처 기본 disable-extensions 옵션을 제외해도 동일했다. 지원 CDP Extensions.loadUnpacked는 `Loading of unpacked extensions is disabled by the administrator.`를 반환했다. 정책 우회·manifest 권한 수정 없이 중단. 실제 Chromium DNR·IndexedDB 기능 검증은 차단/미실행이며 자동 테스트 성공으로 대체하지 않는다.
- 증거: [변경 전 실패·변경 후 검증·브라우저 제한](../evidence/EXT-02-domain-boundaries.txt).
- 사용자 검증: README의 D1~D6 Windows Chrome 절차를 등록했고 현재 수정본 결과는 아직 미제공. 앞 1~6 성공 보고는 b60396d 기준 기본 흐름이며 신규 경계 통과로 합산하지 않음.
- 남음/판정: 도메인 보완 코드·자동 검증 완료, 실제 Chrome 재검증 대기. 회원 설치 인증·Server command/reconcile/report, 저장 실패·제품 연결은 미완료. EXT-02 전체 완료/담당 전체 완료로 표시하지 않음. 이 단위 이후 다른 기능 자동 착수 없음.


### 도메인 경계 보완 — 사용자 Chrome 재검증 결과

- 사용자 응답: “1 2 3 4 5 6 번 성공”. 이번 최신 ZIP 안내 뒤 받은 결과이며, 이전 기본 흐름 6개 성공 보고와 별개다.
- 안내 코드 기준: 9a6cc7da4c0e1072ec058639fa03a0b9c55133ff의 extension/. 실행 주체: 사용자. 실제 로드 SHA 및 Windows/Chrome 버전·화면/로그는 별도 제공되지 않아 미확인. Codex가 브라우저 화면을 직접 관찰한 결과로 표현하지 않음.

| 안내 번호 | 검증 내용 | 사용자 실행 결과 |
|---|---|---|
| 1 / D1 | exact BLOCK 설정으로 마지막 점 주소를 먼저 열고 시작, 열린 탭 차단 | 성공 보고 |
| 2 / D2 | example.com 및 example.com. 집중 중 신규 탐색 차단 | 성공 보고 |
| 3 / D3 | 하위 도메인 OFF에서 www.example.com. 및 유사 host는 첫 탐색 차단 제외 | 성공 보고 |
| 4 / D4 | 실행 중 하위 도메인 ON 수정, 현재 exact 스냅샷 유지·다음 세션 하위 도메인 차단 | 성공 보고 |
| 5 / D5 | RECORD example.org 및 ALLOW example.net 방문 허용 | 성공 보고 |
| 6 / D6 | 종료 후 example.com 및 example.com. 재탐색 해제 | 성공 보고 |

- 이번 단위 판정: 비회원 도메인 경계 코드·자동 회귀 42/42 및 안내된 Chrome 6개 시나리오 사용자 성공 보고 확보. 자동 테스트 건수와 사용자 시나리오 수는 별개로 유지. Linux Chromium 관리자 정책 차단 기록은 그대로 유지.
- 기능 전체 판정: EXT-02 전체·회원 연동·담당 전체 완료 아님. 회원 설치 인증·Server 명령/reconcile/report, 저장 실패·연결 계층 검증은 남음. IDNA·userinfo·다중 규칙 보존 등 자동 경계 사례 전부를 실제 Chrome 통과로 확대하지 않음. RECORD 항목의 성공은 방문 허용이며 이벤트 수집·전송·집계 전체의 성공을 의미하지 않음.
- 다음: 이 단위는 검토 가능한 상태로 인계. 다른 기능 자동 착수·공유 브랜치 병합 없음.


### 사용자 작업 지시 재확인 및 준수 점검

- 재첨부 작업 지시 전체(16단계·최종 보고·항상 유지할 제한)를 재확인했다. 구현/검증/기록/Commit/Push의 반복 승인 불필요, 담당·공유 계약 충돌은 해당 부분만 보류, 한 EXT-02 단위 뒤 다른 기능 자동 착수 금지, PR 조건 충족 후 생성·팀 리뷰 대기, develop 병합은 별도 명시 요청이 필요함을 이후 작업 기준으로 적용한다. 문서를 영구 학습했다는 의미가 아니며 새 작업에서도 저장소 지침과 최신 기록을 다시 읽는다.
- 준수 근거: 기존 브랜치/백업 재사용, 최소 Core 수정, 회귀 실패 재현 후 수정, 사용자 실행 결과와 모의 자동 결과 분리, 작업 브랜치만 Commit/Push, force/reset/clean/stash·공용 계약 변경·타 담당 재배정·다른 기능 자동 착수 없음.
- 부족했던 처리: 초기에 Commit/Push 재승인을 요청; 역할 원문 탐색이 늦음; 후속 기록은 추가했지만 상단 요약이 과거 26건·재검증 대기로 남음; A/B/C PR 판정·PR 생성/최종 상세 보고 미완료. 이번 문서 수정으로 EXT-02 상단과 통합현황 요약을 최신 42건·사용자 보고 상태로 일치시키며 과거 이력은 보존한다.
- 읽기 범위 한계: 기능/화면/동작/API/데이터/검증 본문과 카드 연결을 읽었으나 상세 drawio 도면 전체의 의미 대조를 수행한 것으로 주장하지 않는다. 전체 기능·계약 적합성의 완전 검증 근거로 확대하지 않음.
- Git 재점검: fetch 성공, origin/develop=76df34ea6be1c591be33c29606c24fc654f61932는 현재 브랜치 조상; 기준 로컬/원격 작업 SHA=52a49eec9e2f2987d978b034d70a5338b519873c, 작업 전 working tree clean, 단일 checkout. 임의 merge/rebase 없이 확인. 이번 변경은 문서만이며 코드/테스트 실행을 새로 했다고 기록하지 않음(최근 직접 결과 42/42 유지).
- PR 확인: gh pr list --repo kdu-sw-capstone/capstone-project --head feature/extension-core-ext-02 --state all 조회가 Post https://api.github.com/graphql: Forbidden으로 실패. Git fetch/push 성공과 API 권한은 구분한다. 원인은 아직 확정하지 않았고 새 토큰 요구·자격정보 출력·임의 네트워크 설정 변경 없음.
- 현재 후속 판정 B(추가 작업 필요): 구현 단위의 기록 요약은 정정했으나 PR 전 최종 범위/AC·BOUND 대응·필수 설계 대조/보고 확인을 마무리해야 한다. PR 조회·생성에는 별도로 API 접근 문제 진단이 필요하다. 미검증 회원/전체 기능을 이번 단위의 통과로 처리하지 않는다. 새 기능 착수·팀 메시지 전송·PR/공유 브랜치 병합 없음.


### PR 준비 최종 점검

- 이번 사용자 요청에 따라 비회원 기한/도메인 보완 단위를 재점검했다. fetch 성공, 최신 develop 76df34e는 작업 브랜치 조상이며 이 기준 충돌 없음. 점검 시작 로컬/원격 SHA=1d4681ec6781feafcdfd0c9c3909e338ef7793a8, working tree clean. diff --check 통과.
- 자동 최종 재실행: extension/ npm test 42/42, 실패/스킵 0; check/build:harness 성공. 사용자 기본/경계 6개씩 성공 보고와 미확인 OS/Chrome/실제 로드 SHA 메타데이터를 분리해 유지.
- A. PR 준비 가능 — 이번 비회원 기한·도메인 단위에 한정. EXT-02 전체·회원 연동·두 모듈 통합·별도 fixture 전체 완료 또는 병합 승인 아님. PR에는 develop 대비 이전 adapter/fixture와 백업 복원도 포함됨을 명시하고 기존 구현 출처를 보존한다.
- AC-EXT-02-01/02/03은 적용·기한·journal의 부분 대응, BOUND-17은 별도 모듈 모의 저장 실패 부분이며 전체 기준 통과로 확대하지 않는다. 자동 도메인 추가 사례는 새 AC ID를 임의 생성하지 않는다.
- PR 생성 외부 차단: GraphQL 및 REST API 조회 Forbidden. curl HEAD의 CONNECT tunnel 403/Envoy 응답으로 api.github.com 목적지 프록시 차단을 확인. GH_TOKEN 존재 여부만 확인했으며 값을 출력하지 않았다. Git fetch/push 성공과 API 접근 가능성은 별개다. API 허용 후 기존 PR 조회부터 재개하고 중복 PR을 만들지 않는다.
- PR 본문은 필요한 변경 범위·AC/BOUND·모의/사용자 결과·실제 회원 연동 미검증·선행 조건을 담아 준비했다. 코드 변경·새 기능 구현·병합은 이번 점검에서 하지 않음. PR 생성 완료로 기록하지 않음.


### PR #17 Draft 및 사용자 최종 점검 인계

- 최신 사용자 기준: Codex 작업 마지막에 미검증/실패/조율 필요/다음 행동을 확인해 보고 → 사용자 변경/검증 결과 점검 → 사용자가 PR 진행 여부 결정. 과거 PR 자동 생성 지시보다 이 최신 절차를 우선 적용한다. 별도 사용자 요청 없이 Ready for review·리뷰 요청·새 PR·병합을 수행하지 않는다.
- 실제 확인: PR #17은 이미 Draft=true, open, base=develop, head=feature/extension-core-ext-02. Codex가 이번에 Draft 전환 명령을 실행한 것은 아니다. 사용자 생성 후 main 대상은 앞서 develop으로 수정했다. 이번 점검에서 mergeable=true 확인, Draft/승인 요건으로 blocked이며 코드 충돌 판정과 구분한다.
- 점검 시작 로컬/원격/PR SHA=8300026e5e955dd1b9a2130610b66aa5208180cd, working tree clean. fetch로 origin/develop=76df34ea6be1c591be33c29606c24fc654f61932가 HEAD의 조상임을 확인; 전체 diff --check 통과.
- extension/에서 npm test 42/42, 실패·스킵 0; check/build:harness를 이번 점검에서 직접 재실행해 통과. 제품 코드는 변경하지 않고 문서만 최신 PR 상태로 갱신한다. 원격 전체 PR에는 기한/도메인 수정 외 기존 adapter/fixture 및 사용자 백업 복원도 포함된다.
- 미검증: 실제 회원 인증·EXEC/reconcile/report·Content 통합, 실제 IDB quota/저장 실패·해제 실패 복구, 자동 경계 전체의 Chrome 검증 및 별도 fixture 재검증. 사용자 기본/도메인 각 6건은 성공 보고가 있으나 실제 로드 SHA·Windows/Chrome 버전·화면/로그는 별도 미제공.
- 실패: 현재 실행한 자동 검사 실패 없음; Linux Chromium의 관리자 정책 로드 거절은 미해결 환경 제한. GitHub API 접근은 이번 조회 성공으로 과거 403 차단과 구분.
- 조율 필요: 회원 설치/Server API 선행 및 Core↔Content 공유 인터페이스/이벤트 전송 세부 담당. 현재 비회원 수정 단위에서 공용 계약 변경·담당 재배정·develop 충돌은 확인되지 않음.
- 다음 행동: 사용자 PR Files changed/검증 기록 점검 → 문제 있으면 같은 단위 수정 및 필요한 재검증 → 사용자가 리뷰 진행 판단. 리뷰 보류 후 다음 구현을 진행하겠다는 사용자 의도는 유지하되 PR 범위에 새 구현을 섞지 않도록 후속 비회원 저장/해제 실패 검증은 별도 브랜치 권장. 이번 최종 점검에서는 새 구현 착수 없음.

## PR #17 수정 후 재검토 착수

- 이번 기능 ID: EXT-02. 담당: 윤종민, Extension Core.
- 이번 목표: 사용자 전달 리뷰 오류 4건 회귀 수정, 별도 MOST_SPECIFIC_HOST 정책 및 Figma Extension 디자인 대응.
- 브랜치: feature/extension-core-ext-02, 시작 기준 b7349717d05c8e660f5c22f98de720d7dd756f42, 착수 전 working tree clean.
- 보고서/재현 스크립트 원본 및 스냅샷 1.2 문서는 미전달. PR 댓글/리뷰에도 없음. 현재 사용자 증상을 기준으로 독립 재현. 실제 Chrome 결과로 처리하지 않음.
- 정책 1.2 계약/디자인은 자료 확인 후 반영; 회원 통합 별도, 병합 금지.

### 이번 오류 수정 및 검증 결과

| 사용자 리뷰 사례 | 제품 수정 | 회귀 검증 |
|---|---|---|
| 해제 실패 복구 | session-core.js journal.terminal_intent에 목표 종료 상태·이유·확인된 종료 경계를 저장. 재시도/브라우저 재시작에서도 유지. 이전 journal은 마지막 확인 시각으로 보수적 복구 | 중단/정상 종료 해제 실패, 연속 재시도, legacy journal 3건 |
| 실패 탐색 잔존 | service-worker.js onErrorOccurred → 직렬화된 AccessStore.fail. URL 원문 대신 SHA-256 fingerprint와 Chrome 이벤트 시각을 비교해 해당 임시 기록만 삭제 | 실패 후 안내 reload 0건, 같은 host 다른 경로의 늦은 오류·이전 same-URL timestamp·subframe 보호 3건 |
| 호스트 불일치 | GuestSession.normalizeHost를 정책 판별/AccessStore 이벤트 저장에서 공용 사용. HTTP(S)·소문자·IDNA·마지막 DNS root 점 하나 제거 | BLOCK/RECORD 이벤트 target_host·target_key 확인 2건. 서버 전송·서버 검증은 미연동 |
| 삭제 후 재등록 | site-store.js 기존 tombstone ID/created_at 유지, 삭제 필드 제거·version 증가·settings_version 증가·receipt 재시도 보존 | 실제 제품 CRUD 코드를 fake-indexeddb로 실행하는 모의 테스트 1건 |

- 자동: Node 24.19.0/npm 11.9.0, `npm ci --cache /workspace/.npm`, `npm test` 51/51(기존 42+추가 9), fail/skip 0. `npm run check`, `npm run build:harness`, `git diff --check` 성공.
- 개발 의존성: fake-indexeddb 6.2.5 exact lock. 제품 IndexedDB 코드를 모의 IndexedDB 구현에서 실행하며 실제 Chrome 결과와 구분한다.
- 수정 전 b734971 제품 scripts에 신규 9건을 적용한 독립 재현: pass 2/fail 7. 원본 팀 재현 스크립트는 아직 제공되지 않아 읽거나 실행했다고 주장하지 않는다.
- 실제 브라우저: Chromium 151.0.7922.173, Playwright CDP Extensions.loadUnpacked 제품 경로 실행 시 `Loading of unpacked extensions is disabled by the administrator.` 확장 로드 실패, 제품 기능 실행/화면 검증 미실행. 관리 정책을 우회하지 않았다.
- harness: 생성만 성공; 브라우저 시나리오 미실행. `.chrome-harness/`는 제품 UI가 아니다.
- 미검증: 최신 제품 Chrome 전 시나리오, 서버 호스트 검증·전송, 회원 연결/ExecutionReport/승인/복구 계약, 실제 저장 quota·강제 종료.
- 실패: 현재 자동 실패 0. Chrome 제품 로드 실패. Figma HTTPS CONNECT 403, 설치 승인 후에도 도구 미노출.
- 조율 필요: 검토 보고서·원본 재현 스크립트 위치, 웹·서버 스냅샷 1.2/MOST_SPECIFIC_HOST 정확한 계약, 실제 Extension Figma 프레임 접근. 원격 develop 76df34e에도 정책 1.2 원본을 찾지 못함.
- 정책 변경/UI: 자료 대기로 아직 구현하지 않음. 기존 1.1 문자열/정책/화면을 변경 완료로 표시하지 않음. 구현 화면 추가/디자인 이미지 없음.
- 다음 행동: 자료 제공 후 most-specific 선택/등록/DNR 규칙/열린 탭/이벤트 처리 동시 수정, Figma 프레임 적용, 최신 제품 Chrome 수동 검증 및 재검토. 이번 수정은 EXT-02 전체 완료가 아니다.
- 상세 수동 절차: [PR #17 재검토 기록](../evidence/EXT-02-PR17-revision.md). 사용자 코드·결과 점검 전 병합 금지.

### 수정 후 사용자 Chrome 검증 및 후속 재개

- 사용자 확인: 수정 후 다운로드한 제품 Extension으로 1~6 및 7~9 모두 정상 작동했다고 보고. 이전 버전의 Chrome 결과와 구분한다. Codex 직접 실행 결과가 아니다.
- 1~6: 사이트 등록·정확히 같은 호스트 중복 거절·수정·삭제·재등록, example.com 및 마지막 점 탐색 차단, 세션 중 설정 변경 시 현재 차단 유지/다음 세션 허용, 종료 후 해제 성공 보고.
- 7~9: 차단 안내 새로고침 시 접근 수 증가 없음, RECORD 대상 정상 접속·반복 구분, 전체 Chrome 종료·재시작 후 중단/해제 및 미확인 시간 제외 성공 보고.
- 증거 한계: 실제 로드 commit SHA, OS/Chrome 버전, 화면/DB/로그는 미제공. 사용자는 수정 후 코드임을 명시했으므로 과거 결과로 분류하지 않지만 33119ee 로드 SHA를 기술적으로 확인했다고 주장하지 않는다.
- 별도 미검증: tombstone ID/created_at/version 실제 DB 값, 강제 해제 실패·반복 재시도, Worker만 중단 후 복구, 실제 quota 실패, 새 상·하위 도메인 정책/UI, 회원 통합.
- 후속 시작 기준: feature/extension-core-ext-02 HEAD 33119ee9278f2fec8afa6aea6af6c0c3e441dc8e, 시작 전 clean. 재-fetch한 develop 76df34e. PR 댓글/공유 첨부에서 신규 자료 없음.
- 이번 기능 ID: EXT-02. 이번 목표: 실제 스냅샷 1.2 계약에 따른 MOST_SPECIFIC_HOST 정책 및 실제 Figma Extension 프레임 반영.
- 변경 지점 확인: background/site-store.js 중복 검사, session-core.js snapshot/정책 선택/DNR 규칙/열린 탭, access-store.js 기록 정책 선택; 별도 src/site-rules.js 및 site-controller.js의 1.1 검증·규칙·열린 탭 선택도 함께 대조해야 한다. 부모 BLOCK 아래 자식 ALLOW/RECORD는 부모 규칙의 적용을 실제로 제외해야 하며 단순 문자열 교체로 처리하지 않는다.
- 차단 조건: 정확한 1.2 JSON 필드/문서 및 Figma 프레임 접근 미확보. 사용자 지시대로 실제 형식을 확인하기 전 공유 계약을 추정 변경하거나 임의 화면을 만들지 않는다. 담당 재배정/회원 통합/병합 없음.
- 이번 기록 갱신은 문서만 변경. 기존 자동 51/51 결과를 유지하며 새로운 코드 검증을 수행했다고 표시하지 않는다.
- 다음 행동: 정책 문서·재현 스크립트 저장소 경로/링크 및 Figma Extension 프레임 자료 확보 → 정책/규칙/기록 회귀 수정 → 디자인 반영 → 최신 Chrome 추가 검증 → 사용자 재검토.

### Snapshot 1.2 구현 착수

- 시작 HEAD 2812def, working tree clean. 사용자 전달 ZIP의 10_호스트_정책우선순위.md 및 04_API_연동.md 기준. 기능 EXT-02 / 윤종민 Core.
- 목표: 정확한 host만 중복 거절, most-specific 전체 행 선택, 자식 ALLOW/RECORD의 부모 BLOCK 예외 규칙, 새 세션 1.2/기존 1.1 보존. 공유 승인/전송/Content/전역 정책 통합은 별도.

### Snapshot 1.2 구현 결과

- 문서 기준: 사용자 Windows 전달 ZIP의 정책 우선순위/API 연동. 두 문서를 PR에 반영; develop에 반영됐다고 주장하지 않음. 기존 상세 도면 중 중첩 거절 문구는 새 10_호스트_정책우선순위.md에서 대체 대상 지정.
- 제품: background/host-policy.js 공용 정규화·정렬·선택·규칙 생성, site-store.js exact host 중복/삭제 host PATCH 충돌/마지막 점 등록 정규화, session-core.js 신규 1.2 스냅샷/열린 탭 최종 정책 선택/미지원 전략 해제·오류, access-store.js 최종 선택 RECORD/BLOCK 기록, service-worker.js 공유 script 로드.
- 별도 adapter: src/site-rules.js 동일 공용 규칙 사용, site-controller.js 1.2 전략 검증/열린 탭 최종 선택 및 기존 1.1 지원. 제품과 adapter 연결·회원 API 미완료 상태 유지.
- DNR: 사이트별 host 레이블 수에 따른 priority(100+레이블 수), 부모 BLOCK 아래 자식 ALLOW/RECORD에 main_frame allow만 생성. include=false 예외는 exact regex만 적용하여 더 깊은 호스트에는 부모 정책이 남는다. 더 구체적인 BLOCK은 allow 예외보다 높은 priority. allowAllRequests 사용 안 함. 소유 규칙 해제/검증에 예외 규칙도 포함.
- legacy: 기존 1.1 snapshot/실제 journal 규칙은 재작성/재설치하지 않음. 별도 adapter 1.1 적용은 기존 중첩 금지 검증 유지. 1.2는 전략 누락/미지원 시 적용 성공으로 표시하지 않음. 이벤트 schema_version=1.1 유지.
- 다음 세션 규칙: 실행 중 설정 수정/삭제/재등록은 active snapshot과 rules에 반영하지 않음. 다음 세션에서 새 settings_version/sorted sites 사용.
- 미검증: 새 코드의 실제 Chrome(이전 사용자 1~9 성공은 33119ee 수정 단위), 실제 Server JSON/API/회원 연결, 실제 DNR 우선순위·worker/브라우저 재시작, Content 기능 정책.
- 조율 필요: 실제 Server 전체 필드 포함 JSON 및 지원 버전 협상/미지원 응답, 전역 성인·키워드 제한/Content 규칙의 DNR priority 통합. 사이트 allow는 전역 예외가 아니므로 전역 제한은 사이트 priority보다 높아야 함. 테스트의 priority1000 global BLOCK은 모의 검증이며 실제 전역 기능 구현 아님.
- Figma UI는 원본 접근 대기. 팀 보고서/원본 스크립트 미제공, 기존 사용자 증상 회귀 테스트는 유지. 회원 연결·실행보고·승인·공유 복구 계약을 완료로 처리하지 않음.
- 병합 담당은 팀 담당자이며 사용자 점검/팀 재검토 뒤 병합. Codex 병합 없음.

- 최종 모의 자동 검증: npm test 69/69, 실패·스킵 0. 기존 오류 회귀 9건 포함 유지. npm run check / build:harness / git diff --check 성공. 상세 사례·Chrome 절차: ../evidence/EXT-02-Snapshot12.md.

### Snapshot 1.2 수정 후 사용자 Chrome 검증 보고

- 사용자: 이번 정책 수정에 대해 안내한 1~6 성공, 7~10 정상 작동, 이어 전체 Chrome 종료/재시작 검증도 모두 정상이라고 보고.
- 성공 보고 범위: 부모/자식 동시 등록, 양방향 BLOCK/ALLOW 우선순위, 현재 세션 정책 유지/다음 세션 변경, child RECORD, root dot/case 중복, exact child ALLOW와 하위 host 부모 BLOCK, 이미 열린 child ALLOW 탭 유지, 종료 후 해제. 브라우저 재시작 후 INTERRUPTED·해제 및 종료 중 미확인 시간 미포함도 보고.
- 기준 코드: 안내한 정책 수정 커밋 9b6bace. 사용자 실행 성공 보고이며 실제 로드 SHA/OS/Chrome 버전/로그는 미제공. Codex가 직접 Chrome 실행했거나 DB/DNR 값을 확인한 결과로 확대하지 않는다.
- 자동 결과: 기존 직접 실행 69/69 모의 테스트 유지. 이번 변경은 검증 기록만이며 제품 코드/테스트 변경 및 새 실행 없음.
- 미검증: Worker 단독 중단 복구, 실제 Server JSON/API/회원·보고·승인·공유복구·Content 및 전역 제한 연동, 강제 quota/해제 오류, 실제 ID/version DB 값, Figma UI.
- 실패: 사용자 보고 실패 없음. Codex 환경의 unpacked 확장 로드 제한은 별도로 유지.
- 조율 필요: 실제 Server 전체 Snapshot/지원 버전·오류, global/Content priority, Figma 프레임 접근·팀 원본 재현자료.
- 다음 행동: Worker 단독 복구 확인, Figma 자료 확보 및 UI 반영, 서버와 실제 연동 대조 후 사용자 점검·팀 재검토. 팀 담당 병합, Codex 병합 금지. 전체 EXT-02 완료 아님.

### Worker 단독 복구 검증 착수

- EXT-02 / 윤종민 Core. 시작 HEAD c5dae41, 브랜치 feature/extension-core-ext-02, clean.
- 기준: AC-EXT-02-03, API 실행/복구 순서, 데이터 복구 명세. 이번 목표: 실제 제품 classic script의 새 VM 컨텍스트 생성 시 저장/journal/DNR 대조·종료 의도·접근 pending 보존을 모의 검증. 실제 Chrome Worker 중단은 사용자 검증으로 분리.

### Worker 재생성 모의 검증 결과

- 신규 5건: 새 VM 컨텍스트마다 제품 classic scripts를 다시 로드하되 모의 IndexedDB/Chrome storage.session/DNR을 유지. 같은 GuestSession 객체에서 tick만 재호출하는 검증과 구분한다.
- 정상1.2 RUNNING·snapshot/rules/ID 유지 및 중복 add 없음, 설정 변경은 다음 세션부터 적용; child allow 실제 모의 규칙 누락 시 INTERRUPTED·잔여 owned 규칙 해제 및 재적용 없음; 해제 실패 후 fresh Worker에서 INTERRUPTED/확인된 시간 유지; pending RECORD 한 번만 commit; 계획 종료 시각 이후 fresh Worker에서 종료·해제.
- 실행: Node 24.19.0 Linux, npm --prefix extension test 74/74(기존69+신규5), 실패·스킵0. check/diff 확인 성공. Chrome/IndexedDB는 모의 구현, 실제 Worker stop 결과 아님.
- 제품 코드 변경 없음. 실제 Chrome에서는 현재 제품 설치로 worker stop 후 상태 재확인 가능. 절차는 evidence/EXT-02-Worker-recovery.md 참조.
- 미검증: 실제 Chrome Worker 단독 중단, 실제 서버·회원/전송/승인/Content/전역 정책·강제 quota, Figma UI. 실패: 최종 자동0. 조율 필요: 기존 계약 통합/Figma 원본 접근. 다음 행동: 사용자 Worker stop 검증, Figma 프레임 확보·UI 적용, 실제 Server 대조 후 팀 재검토. 전체EXT-02 완료/병합 없음.

### 비회원 제품 팝업 UI 착수

- EXT-02 / 윤종민 Core, 시작 HEAD df646f3, feature/extension-core-ext-02, working tree clean.
- 기준: 사용자 디자인 retry ZIP의 원본 PNG22/13프레임 속성. 비회원 메인/목록/수정/진행/종료·기록 라이트/다크. 기존 등록폼 유지(독립 디자인 없음), 미구현 Shorts/계정 연결 성공 표시 금지. 차단 안내 목적지 충돌은 별도이며 이번 팝업 단위에서 변경하지 않음.

### 비회원 제품 팝업 UI 구현·모의 검증

- 기존 요청/저장/세션 Core를 유지한 제품 popup 표시 계층과 라이트/다크 전환, 사이트 화면/종료 확인/결과 연결. 디자인 예시 숫자/미구현 기능 성공 표시 없이 실제 응답과 고정 snapshot을 사용. 상세 범위·원본 프레임·차이·수동 절차: [팝업 UI 검증 기록](../evidence/EXT-02-popup-ui.md).
- Node 제품/adapter 모의74/74, 제품 HTML+모의Chrome API Chromium UI16항목 통과. JS check/검증용 harness 빌드 성공. UI PNG는 모의 API 화면으로 실제 설치 결과와 구분.
- 이전 사용자 Worker stop 모두 정상 보고 반영. 이전 코드의 사용자 수동 보고이며 이번 UI 검증으로 승계하지 않음.
- 미검증: 최신 UI 실제 제품 Chrome, Server/회원/Content·보고/승인/통합복구, 차단 안내 및 나머지 디자인. 실패: 최종 자동0. 조율 필요: 차단 안내 비회원 목적지/디자인 누락 자산·폰트/공유 계약. 다음 행동: 사용자 UI 점검 후 별도 차단 안내 반영 및 팀 PR17 재검토. 병합 없음, 전체 EXT-02 완료 아님.

### 2026-10-09 팀 재검토 수정 착수 — Commit/Push/PR 갱신 금지

- 기능 EXT-02, 윤종민 Extension Core. 시작 HEAD e79ef3034e3951a20c735de714debab830006284, feature/extension-core-ext-02, 시작 시 working tree clean.
- 최신 사용자 지시: target_key는 정규화한 실제 방문 host, www 유지; matched_policy_host에 적용 정책 host 별도 기록. Snapshot1.2 MOST_SPECIFIC_HOST 차단 결정은 그대로 유지한다. Server API/검증기 변경 담당은 사용자 전달의 팀장(Server 담당), 개인 이름은 미확정.
- Server 검증기422는 전달받은 모의 검증 결과이며 실제 HTTP 결과가 아니다. Server 수정본/실행 endpoint·샘플/인증이 현재 저장소에 없어 HTTP 연동은 차단.
- 모든 필수 기준이 최신 코드로 통과하기 전 Commit/Push/PR 갱신/병합 금지. 이번 수정은 로컬 미커밋으로 보존한다. 과거 Push 허가는 이번 제한을 대체하지 않는다.

### 2026-10-09 로컬 수정 결과 — 전체 필수 기준 미통과

- AccessStore 신규 SITE key=실제 정규화 host, matched_policy_host=선택 정책 host. 현재 Snapshot1.2 차단 결정 유지. 반복은 실제 host별, 과거 DB 원본/대기자료 보존. 추가 회귀5건 포함 Node79/79, UI모의16항목 재실행 통과; 문법 검사 성공.
- 기준 코드: HEAD e79ef30 + 미커밋 제품 SHA256 `2ae196a83b5177dfd496a65d18da9da7c28c6786c4964f46aa28bf08da66aa2a`. 최신 [기준별 결과/실행 출력/담당·선행/수동 절차](../evidence/EXT-02-2026-10-09-review.md).
- 실제 제품 로드 시도: Linux/Chromium151.0.7922.173, 관리자 unpacked 제한으로 실패. 이번 실제 팝업·차단·Worker/journal 확인 없음. 사용자 현재 Server 자료 없음 확인; 회원/HTTP/인증/reconcile/실quota 차단·미검증.
- 완료 아님. Commit/Push/PR 갱신/병합 없음. 미검증/실패/조율 필요/다음 행동을 위 최신 기준 표와 상세 보고서에 기록. 모든 필수 기준 통과 전 제한 유지.

### 2026-10-09 최신 검증용 ZIP 사용자 Chrome 결과 — 1~14

- 개인 전달 저장소 testest의 test/focurve-ext02-local-20261009 브랜치 ZIP을 다운로드/확장 로드했다고 사용자 확인. 제품 식별은 e79ef30 + 미커밋 product SHA256 2ae196a83b5177dfd496a65d18da9da7c28c6786c4964f46aa28bf08da66aa2a. 개인 전달 커밋은 팀 제품 최종 커밋이 아니다. 실제 로드 파일 hash 및 Chrome/OS 버전은 아직 미제공.
- 사용자 실행 보고: 1~6 팝업/화면모드 유지/등록/시작/차단/종료 취소 정상, 7~10 직접 종료·해제/자동 종료·해제 정상, 11~14 naver.com 부모 RECORD·하위 포함의 두 실제 호스트 방문 및 반복 정상.
- 첨부 화면에서 전체4회/반복2회, access_seq 1 chzzk.naver.com / 2 www.naver.com / 3 chzzk.naver.com 반복 / 4 www.naver.com 반복을 확인. 표시 시각 2026-10-09 14:10:07~14:10:15 (사용자 화면). Codex가 Chrome을 직접 실행한 결과나 DB 원본 확인은 아니다.
- 다음 검증: IndexedDB 신규 이벤트 target_key/target_host/matched_policy_host 원본, 다음 세션 반복 초기화·BLOCK/안내 새로고침·최신 Worker 복구. Chrome/OS 버전 및 로드 hash 식별 확보 필요.
- 필수 회원 인증/명령/보고·Server reconcile·실quota·HTTP는 여전히 미검증/차단. 전체 완료 및 팀 Commit/Push/PR 갱신/병합 없음. 이전 Chromium 직접 로드 실패 및 모의79/79·UI16과 분리해 기록한다.

### 사용자 IndexedDB 원본 캡처 확인 — 실제 방문 host 계약

- 사용자 DevTools Application → focurve-execution/events 캡처 2장 확인. 동일 session의 RECORDED_ACCESS access_seq3: target_host chzzk.naver.com, target_key SITE:chzzk.naver.com, matched_policy_host naver.com. access_seq4: target_host www.naver.com, target_key SITE:www.naver.com, matched_policy_host naver.com. reason RECORD, schema_version1.1. www 레이블 유지 및 실제 host/정책 host 분리 저장 확인.
- 앞선 팝업 전체4/반복2·각 host 두 번째 방문 반복 표시와 함께 최신 ZIP의 사용자 실제 로컬 Chrome 근거로 기록. Codex 직접 DB 접근 또는 실제 HTTP/Server 수신 검증으로 확대하지 않음. Chrome/OS 버전·로드 hash 미제공, 다음 세션 초기화/BLOCK 경로/최신 Worker 복구 및 필수 회원·Server·실quota 여전히 미검증. 팀 Commit/Push/PR 갱신/병합 없음.

### 최신 ZIP 사용자 Chrome 검증 — 15~17 성공 보고

- 사용자 15~17 정상 보고: 새 RECORD 세션의 첫 치지직 접근 전체1/반복0, 다음 BLOCK 세션의 치지직/네이버 각각 차단 및 전체2/반복0, 차단 안내 새로고침 후 전체2/반복0 유지.
- 최신 전달 ZIP의 사용자 실제 실행 보고이며 새 캡처/원본 BLOCK 이벤트/Chrome·OS 버전/로드 hash는 미제공. 앞서 받은 RECORD 원본 캡처와 구분한다. 실제 Server 수신/회원 인증/reconcile/실quota 기준 통과 아님.
- 다음 행동: 최신 코드 Worker 단독 중지/재생성·세션/journal 유지 및 종료 해제, 전체 재시작 별도 점검. 팀 Commit/Push/PR 갱신/병합 보류 유지.

### 최신 ZIP 사용자 Chrome 검증 — 18~21 성공 보고

- 사용자 18~21 정상 보고: naver.com BLOCK 하위 포함10분 세션 시작/차단, FOCURVE 팝업·DevTools 닫고 Worker Stop, 팝업 재접속 시 기존 세션/남은 시간/차단 유지, 직접 종료 후 해제·네이버 정상 접속.
- 최신 전달 ZIP의 실제 사용자 Chrome Worker 단독 복구 결과. journal/규칙 원본 캡처·세션ID 전후 비교·Chrome/OS 버전·로드 파일 hash는 미제공. Server reconcile 미실행, AC-EXT-02-03 전체 통과로 처리하지 않는다.
- 다음 행동: 실행환경 정보 확보, 최신 전체 브라우저 재시작/INTERRUPTED·해제 검증. 회원 인증/명령/보고·실HTTP/reconcile·실quota는 차단/미검증 유지. 팀 Commit/Push/PR 갱신/병합 없음.

### 최신 ZIP 사용자 Chrome 환경·전체 재시작 — 22~25 성공

- 사용자 chrome://version 원문 제공: Google Chrome154.0.8037.98 공식64비트 Stable, Windows11 Version25H2 Build26200.9457. 실제 OS/Chrome 버전 정보 확보. 개인 경로/프로필 및 variations 전체는 기록하지 않음.
- 사용자 22~25 모두 정상 보고: 최신 ZIP BLOCK10분 세션 차단, Chrome 완전 종료/약1분 뒤 재실행, 팝업 중단·차단 해제 확인 완료(이전 세션 RUNNING 아님), 네이버 정상 접속. 종료시간/미확인 구간 미포함의 DB 값은 별도 캡처가 없어 실제 시간 계산 전체 통과로 확대하지 않음.
- 누적 최신 사용자 실행1~25 성공 보고 + RECORD host/key/matched_policy_host 원본2장 확인. 위 환경은 이번 검증에 대해 사용자가 제공한 환경이다. 실행 코드 식별은 개인 testest 전달 ZIP(e79ef30 기반 미커밋 제품SHA2562ae196a83b5177dfd496a65d18da9da7c28c6786c4964f46aa28bf08da66aa2a), 실제 로드 파일 hash 대조는 미제공.
- 필수 회원/실제 설치 인증·명령/보고·Server reconcile·실HTTP·실quota 및 최신journal 원본은 미검증/차단. 로컬 사용자 Chrome 검증 성공을 AC01/02/03·BOUND17 전체 통과로 처리하지 않음. 팀 저장소 Commit/Push/PR 갱신/병합 없음. 개인 저장소 전달은 별도 최신 사용자 허용에 따라 수행했으며 팀 Git 동결과 구분.

### 2026-10-10 EXT-02 / Event1.2 연동 착수

- 최신 사용자 지시로 단계별 구현/검증/Commit/Push/PR17 갱신 허용. develop 병합은 리뷰/CI 후 별도이며 Codex가 수행하지 않음. 기존 Git 동결 이력은 당시 지시이며 이번부터 대체.
- 시작 feature/extension-core-ext-02 HEAD e79ef30 + 보존된 방문host/Chrome 검증·가이드 미커밋 파일. 최신 Server develop b45a680a9f2262bd9725619e9643df3bb9b91164 / Server branch5a018fb 확인 및 fetch. 로컬origin/develop ref는 stale76df34e라 GitHub 조회의 실제SHA로 읽음.
- 기준 FOCURVE_D01_D10_최종공용계약/12_정책계약_이벤트12_호환성게이트/Server EventController·EventService·연동가이드. 첫 단위: 신규SITE Event1.2/기존원본보존 및 member 전송adapter의 개별ACK·status/동일본문 재시도·격리. 회원 인증/명령loop·D01/D05 자동복구·Content 복수사유는 분리하며 미완료 유지.

## 2026-10-09 최신 Server 전달·통합 준비

담당 김다훈(Server/API/DB·연결Frontend), 브랜치 codex/server-event12-integration, 시작develop76df34ea6be1c591be33c29606c24fc654f61932. 기존 담당 배정 유지. 상태: 담당 구현 검토 대기 / 실제Extension통합 미검증. 최신 사용자 지시로 담당 코드 전달용Commit·Push·develop PR을 진행하며 전체MVP완료나 병합으로 처리하지 않는다.

[게시 검증·실행환경·주체·남은 조건](../Server_최신수정본_게시검증_2026-10-09.md) · [실제 API·Event1.2·구형 호환·Core 절차](../Extension_Server_연동가이드.md). Backend 최종107/107(기존106+실제HTTP합성1), Frontend104/104·build PASS. 설치/APPLIED는합성, 실제Chrome/회원Core통합/Content감지는미검증. Snapshot1.2 신규발급OFF. 전체AC를 통과로 승격하지 않는다.

## 2026-10-09 D-01~D-10 정책 확정·문서 반영 기록

담당 배정/기존 상태/과거 검증 이력 유지. 기준 Server b05d9a095b229efe310d5c791189eefb0d30300b / Core e79ef3034e3951a20c735de714debab830006284. [최종공용계약](../../design/02_시스템_테크설계/FOCURVE_D01_D10_최종공용계약.md) 및 [검증 체크리스트](../FOCURVE_D01_D10_검증체크리스트.md) 참조. 정책은 확정됐으나 신규 자동복구/기간·Journal adapter/실제 회원 통합은 미구현 또는 미검증. 기존 AC 통과 상태를 올리지 않는다. 후속: 담당별 구현 영향 문서에 따라 계약 세부 합의·코드 변경·R-T01~12/기능 AC 실제 검증. 이번 제품 코드/DB 변경 없음. 문서 working tree 변경만 있으며 Commit·Push·PR 변경·병합 없음.

## 2026-10-09 로컬 경계 수정 검증

Snapshot/가져오기 safe 상한과 사이트·메모 증가 방어, API 자동복구 미지원/legacy시간 metadata·Web 안내를 반영했다. 기존 시작/종료/구간 집계·Event1.1/1.2·역사 Snapshot 무변환·미지원 RESUME 무변경 회귀를 격리 MySQL로 검증한다. 전체 자동복구/회원 Core실제통합은 후속·미검증이며 기존 AC를 전체 통과/완료로 올리지 않는다. 일반 session.version 극단 경계의 교환 정책은 조율 필요. 최종 실제 실행 결과는 PR18_병합차단_로컬수정_검증보고서.md 참조. Commit/Push/PR변경/병합 없음.

### 최종 로컬 실행 결과 — 2026-10-09

Backend 전체120/120·패키징 PASS, Frontend114/114·빌드 PASS. 격리 MySQL57490의 실제 HTTP/DB import8·execution7·note4·policy6 및 기존 Event1.2 HTTP2 시험 통과. 실제 Chrome/회원 Extension NOT RUN. 일반 session.version 극단 경계 계약은 조율 필요하므로 전체 D03/MVP/병합 완료로 바꾸지 않는다. 증거: C:\Users\dahun\capstone-project\.reviews\pr18-20261009\PR18_병합차단_로컬수정_검증보고서.md 및 merge-boundary 로그.


## 2026-10-10 Event1.2 전송 단위 검증 결과

이번 제품 SITE event는1.2/실제host key(접두사 없음)/matched_policy_host/blocked_reasons. 기존 원본은 보존·잘못된 계약은 격리. background 전송 adapter·개별ACK/수신조회/동일원본 재시도 구현, 회원 인증/context/명령loop는 후속. 모의96/96·UI17항목·Backend139/139·실HTTP 합성3/3 통과. 과거 사용자Chrome1~25는 이전 코드 근거이며 이번 제품Chrome 미검증. 모든 필수AC·BOUND17 전체 미검증 유지. 자세한 실패/조율/다음 행동은 [검증 기록](../evidence/EXT-02-2026-10-10-event12.md). 최신 사용자 허용에 따라 작업 브랜치 게시·PR17 갱신만 진행하며 develop 병합 없음.


## 2026-10-10 사용자 최신 비회원 Chrome 검증 및 D-09 착수

- 사용자 새 작업브랜치 ZIP 재로드 후1~10 정상 보고,11~14 전체4/반복2 화면,15~17 두 RECORDED_ACCESS 원본 캡처에서 schema1.2/실제host key(접두사 없음)/matched_policy_host naver.com/blocked_reasons[]/동일session 확인. 최초 반복3 보고는 구형1.1/SITE:naver.com 실행 원본에서 확인했으며 새코드 결과에서 제외한다.
- 18~21 Worker단독Stop 후 세션/차단유지·종료/해제,22~25 전체Chrome종료 후 INTERRUPTED/해제 정상 사용자보고. Chrome154.0.8037.98 공식64Stable / Windows11 25H2Build26200.9457 캡처 확인. 사용자실행/화면확인이며 Codex직접Chrome 또는 journal/interval/규칙원본 검증 아님. 다운로드 소스기준 f6c2f7e, 실제 로드파일hash 대조는 미검증. D01/D05 자동재개·Serverreconcile·시간계산·실quota 통과로 확대하지 않는다.
- 이번 기능ID EXT-02, 참조 D09(새기능ID아님), 담당 윤종민/Extension Core, 브랜치 feature/extension-core-ext-02, 시작f6c2f7e1216c52d2470a5ca8ebb7ec143b5415f0. 이번 목표: 설치등록/proof·PKCE polling·토큰저장/단일refresh·popup상태·guest실행전환guard를 기존API에 연결. guest원본/설정/미전송자료 보존, 회원명령/보고/완전자동복구는 후속이며 전체완료아님.
- 기준: AGENTS.md·개발운영/통합현황/작업카드, 인증연결계약11, D01_D10최종공용계약 D09/응답유실한계, ServerLinkController/MemberLinks/AuthController/WebAuthentication 실제코드. 기존Callbackallowlist·Webapproval확인 필요. Server제품코드/API를 임의변경하지 않는다. Commit/Push/PR17갱신 허용, develop병합 없음.


### D09 이번 구현·검증 및 인계

background member-auth/runtime·popup기존계정버튼 연결. 안전storage/단일refresh/응답유실대기·guest경합/sender/ownedrules검사, 제품JS의 실제HTTP PKCE/me/refresh 회귀추가. 모의114/114·UI19·Backend140/140 및 최신AuthHTTP1/1 통과, 회원명령/보고/자동복구는미연결. 이번Auth코드 실제Chrome·전체AC/BOUND17미검증. [코드식별·명령·미검증/실패/조율/다음행동 및 Chrome준비절차](../evidence/EXT-02-2026-10-10-member-auth.md). 이전f6 사용자Chrome1~25는보존하고이번Auth검증으로전용하지 않음.
