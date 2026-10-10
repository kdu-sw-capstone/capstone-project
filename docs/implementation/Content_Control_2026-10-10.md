# 채지민 Content Control 구현·검증 기록

기준일 2026-10-10. 브랜치 `feature/content-control`, 시작 `90ad32be5d282f3b44c917a29e156dffc5e29187`. 담당은 사용자 요청의 **기존 Content Control 역할 확인**에 근거한다. 새 배정이 아니다. 기능 전체 완료 또는 실제 통합 완료를 뜻하지 않는다.

## 저장소·기존 구현

- Windows 작업환경 `C:\Users\user\Documents\capstone-project`. 시작 main `1cddbbd`, staged/unstaged/untracked 변경 없음, worktree 1개. 다른 작업자 변경을 삭제·초기화하지 않았다.
- origin `https://github.com/kdu-sw-capstone/capstone-project`. fetch 성공: develop `3d105b0 → 90ad32b`, Core `f6c2f7e → 9b063be`. 최신 develop에서 기능 브랜치를 생성했다. main/develop 직접 커밋·Push 없음.
- develop의 `extension/`에는 README만 있었다. 별도 Core 브랜치 `origin/feature/extension-core-ext-02` / PR17 `9b063be33635592cf48659ce07c0367930295e78`에 manifest·background·popup·테스트가 있다. 임의 merge/rebase/제품 파일 복사 없이 읽고 대조했다.
- GitHub open PR 조회: PR17은 윤종민 Core 작업이며 Content PR이 아니다. 중복 Content PR은 발견하지 못했다. 기존 Server 검증/개발 기반 기록의 오래된 “모두 미착수” 표시는 현재 코드 완료 근거가 아니며, 다른 담당의 상세 상태를 이번 작업으로 변경하지 않는다.
- Core `service-worker.js`: DEV 팝업 요청과 webNavigation 관찰만 존재. `OBSERVE_ACCESS`/`FEATURE_RESULT` 실제 수신 경로 없음. `access-store.js`: pending/commit/fail, RUNNING/owner/revision 검사, Event1.2 SITE 전송 원문 생성. Content 기능 이벤트·SPA 공통 탐색 연결은 미구현이다.

## 읽은 기준

- `AGENTS.md`, `CONTRIBUTING.md`, `docs/TEAM_GUIDE.md`, `docs/implementation/개발운영.md`, `통합현황.md`.
- `docs/design/00_문서안내.md`, `01_UX_기능설계/01_기능범위.md`, `02_IA_화면명세.md`, `03_동작규칙.md`.
- `02_시스템_테크설계/담당분담_원문.md`, `04_API_연동.md`의 객체/내부 메시지, `05_데이터_복구.md`의 이벤트/복구, `09_PC_후속확장계획.md`, `10_호스트_정책우선순위.md`, `11_인증_실행복구_가져오기_연결계약.md`, `12_정책계약_이벤트12_호환성게이트.md`, `FOCURVE_D01_D10_최종공용계약.md` D-06 및 세부안.
- `04_검수_예시데이터/06_기능별_연결표.md`, `07_검증기준.md`, `설계연결.json` 연결, 해당 기능 작업카드. 하위 AGENTS는 없었다.
- `07_설계도/FOCURVE_구현전_통합설계.drawio` XML의 관련 User Flow·TF-A04·시스템 Content Control·추가 기능 연결 텍스트를 확인했다. 도면 시각 배치 검수는 하지 않았다.
- 역할 원본: `docs/design/이전자료/원본보관_개정전.zip` 안 `02_시스템_테크설계/FOCURVE_개발계획_v1.3.md` §5 및 `FOCURVE_역할_데이터흐름_v1.0.md`. 채지민 Content Script/Shorts/내부 기능/행동 감지/Reels·추천·댓글·자동재생, 윤종민 Core, 김다훈 Web/Server/DB/Integration. 보관본의 예전 일정·계약은 현행 기준으로 사용하지 않는다.

현재 D-06/12 문서의 최신 Event1.2 규칙(확인된 복수 사유를 한 이벤트로 통합, 대표 사유 우선순위)을 적용한다. 예전 동작 문서의 “우선 이유 한 건”을 근거로 복수 사유를 버리지 않는다. 이번 코드는 이벤트를 발행하지 않아 저장 계약을 변경하지 않는다. PC 확장은 기존 순서대로 후속이며 모바일은 미정이다.

## 개발환경

| 항목 | 요구 조건 | 확인 방법 | 실제 결과 | 판정·영향 |
|---|---|---|---|---|
| Git | fetch/기능 브랜치 | 설치 경로·fetch·status | PATH에는 없고 `C:\Program Files\Git\cmd\git.exe` 사용 | 정상, .git 쓰기는 sandbox 승인 필요 |
| Node | ES modules/node:test | bundled node `--version` | 24.19.0 | 정상, 패키지 설치/업그레이드 없음 |
| Chrome | 설계 최소120, 최신판 검증 | Playwright launch/version | 설치 Chrome 154.0.8037.98 headless | 합성 DOM 자동 검증 가능, 실제 프로필 미검증 |
| Playwright | 브라우저 테스트 실행 | bundled runtime 모듈 로드 | 설치된 번들 사용 | 정상, 환경변수로 위치 지정, lock/의존성 변경 없음 |
| Extension manifest | 실제 설치·Core 주입 | develop/Core 트리 대조 | develop에는 없음, PR17에만 존재 | 실제 Extension 로드/시작 불가. Core 파일 임의 대체 금지 |
| 환경변수 | 독립 테스트 경로만 | 실행 시 변수 설정 | PLAYWRIGHT_MODULE/CHROME_EXECUTABLE 사용 | 비밀 불필요, 실제 .env 값 읽기/출력 없음 |
| Server/DB | 독립 DOM 시험에는 불필요 | import/네트워크 경계 확인 | 실행·설치하지 않음 | 실제 회원 연동은 선행 필요 |
| 목록/모델 | 검증된 고정 버전 자원 | 저장소 코드·아티팩트 확인 | Content용 검증 목록/학습 모델 없음 | 실제 성인 목록/이미지 분류 미검증 |

## 기능별 담당·상태

각 작업카드는 `docs/implementation/tasks/<ID>.md`. 배정 근거는 위 역할 원본+현행 D-06+사용자 확인. 기존 카드 개인 담당은 미지정이며, Server 추가 이력은 보존했다. 전체 기능 배정을 채지민으로 바꾸지 않았다.

| ID/단계 | Content 포함 / 제외 | 구현·설계 대응 | 현재 상태·선행/다른 담당 |
|---|---|---|---|
| POLICY-03 필수 | Shorts 내부 감지/제한/복원 / 설정·세션·DNR 제외 | features/entry/changes/controller; SITE-02·TF-08/TF-A01; AC-01~03 부분 | 독립 구현, 실제 Core·서비스 검증 대기 |
| EVENT-03 필수 | 기능 진입 후보 탐지 / 저장·순번·반복·전송 제외 | entry; LOG-01·TF-08/09; AC-02 부분만 | 실제 이벤트 생성·전달은 D-06 조율 대기; AC-01/03 Server/Core |
| OPTION-01 추가 | YouTube 홈/관련 추천 영역 / 설정 제외 | features/controller; FEATURE-01·TF-A01; AC-01~03 부분 | 독립 구현. Instagram 추천 피드의 안전한 영역 식별은 실제 DOM 확인 대기 |
| OPTION-02 추가 | YouTube watch 댓글 / 설정 제외 | features/controller; FEATURE-01·TF-A01; AC-01~03 부분 | 독립 구현, 서비스 DOM·Core 대기 |
| OPTION-03 추가 | 다음 영상 autoplay 토글·복원 / 수동재생 차단 제외 | features/controller; FEATURE-01·TF-A01; AC-01~03 부분 | 독립 구현. 실제 다음 영상 자동전환 방지 효과는 미검증 |
| OPTION-05 추가 | Instagram Reels 경로 뷰어 / 일반 피드 제외 | features/entry; FEATURE-01·TF-A01; AC-01~03 부분 | 직접/SPA Reels 제한 독립 구현. 피드 내 모달 진입·추천 피드 selector 검증 대기 |
| OPTION-09 추가 | 선택 범위 키워드 감지·페이지 가림/해제 / 설정·이벤트 제외 | keyword/controller; KEYWORD-01·TF-A04; AC-01~03/BOUND-18 부분 | 독립 구현. Core 고정 정책·사이트 선택·공통 탐색 필요 |
| OPTION-10 추가 | 전용 예외/도메인 감지 함수 / 목록 확보·검증·보관·DNR 제외 | adult-domain; SAFETY-01·TF-A05; AC-01/02 부분 | 독립 판정만 구현. 신뢰 목록 adapter·Core 연결 대기, AC-03 Core |
| OPTION-11 추가 | 가림·보기·교체·큐·해제 / 모델 배포·정책 저장 제외 | image-blur; BLUR-01·TF-A06; AC-01~03/BOUND-10 부분 | 표시 파이프라인 구현. 실제 로컬 학습 모델/정확도/성능·패키징 대기 |
| EXT-02 필수 | Content 실제 적용/해제 결과 경계 / 전체 접근 제한·소유권 검증 제외 | D-06/EXT-02 카드 | Core 윤종민. 합의 후 최소 연결만 수행 |
| SESSION-01~05 필수/추가 | Content 적용/해제 callable / 전체 세션·복구·시간계산 제외 | 동작 상태도/TF-A08 | Core/Web/Server 담당. 모듈 release를 PAUSED/ENDED 확정으로 사용하지 않음 |

독립 구현 가능한 담당 작업은 위 범위까지 진행했다. 남은 실제 이벤트·Core 연결·서비스 selector 검증·검증 목록/모델 자원은 외부 선행 또는 명시적 공용 계약 조율이 필요하다. 임의 기능이나 다른 담당 구현으로 확대하지 않는다.

## 코드·검증 대응

| 설계·AC/BOUND | 기존 코드/검증 | 이번 변경·증거 | 남은 기준 |
|---|---|---|---|
| POLICY-03/OPTION-01/02/03/05 AC-01~03 | develop Content 없음; Server 저장 검증만 존재 | `features.mjs`, `changes.mjs`, `controller.mjs`, browser.test: Shorts/뷰어/수동재생 보존/추천·댓글/토글/새DOM/SPA/해제/실패 | 실제 서비스 DOM·접근 통계·회원/비회원 적용 보고 |
| EVENT-03 AC-02 | Core SITE 관찰만, Content receiver 없음 | `entry.mjs`, detection.test: 지원 경로만 진입 후보, 차단 페이지/가짜 host 제외. 결과 콜백은 접근 이벤트가 아님 | 명시 탐색/RUNNING/owner 검증·공통ID·전송·AC-01/03 집계 |
| OPTION-09 AC-01~03/BOUND-18 | Content 없음 | `keyword.mjs`: NFKC/부분일치/선택범위/URL1회디코딩/예외/입력제외/200k/프레임 한계/500ms 변경 검사/가림 복원 | 실제 페이지·닫힌 shadow DOM 검사 불가. 일부 미검사인 문서를 안전으로 판정하지 않음 |
| OPTION-10 AC-01/02 | 목록 제품 경로 미확인 | `adult-domain.mjs`: host 레이블 경계/독립 예외/목록 부재 실패 | 목록 원본·버전·checksum 및 마지막 검증본 보존(AC-03)은 Core |
| OPTION-11 AC-01~03/BOUND-10 | 고정 모델 없음 | `image-blur.mjs`: 8/16/24px·임시 가림·1개 실행/100대기·보기/재가림·src교체·늦은결과 취소·실패 가림 | 분류값은 테스트만 모의. 학습 모델/실서비스/CORS·GIF·정확도/성능 미검증 |
| BOUND-19 | Core 전체 차단 별도 | siteBlocked 입력 시 Content 제한·접근 생성하지 않음 | 실제 DNR+성인+Shorts 다중 사유 통합은 미검증 |
| 복원 실패 | 기존 Content 없음 | changes.test: 실패 주입 시 false·원본 유지·재시도 | 실제 DOM 권한/Worker·재시작 복구는 미검증 |

## 실행 결과

실행 주체 **Codex**, Windows 작업환경. 이전 자동 실행 당시 사용자 결과는 없었으며, 이후 사용자 결과는 아래 최신 기록 참조. Chrome 제품 엔진은 실제 설치본을 사용했지만 URL 응답·페이지·정책 입력은 Playwright route 합성이다. 모델 출력도 모의이며 외부 사이트로 요청하지 않는다. Extension/Server API 연동 시험이 아니다.

저장소 루트 PowerShell에서 실행:

```powershell
$env:PLAYWRIGHT_MODULE='C:\Users\user\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\node_modules\playwright'
$env:CHROME_EXECUTABLE='C:\Program Files\Google\Chrome\Application\chrome.exe'
& 'C:\Users\user\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' --test extension/content-tests/*.test.mjs
```

Node/Playwright가 다른 위치에 설치된 PC는 같은 모듈·실행파일의 실제 경로를 사용한다. `.env`나 Server/DB 설치는 필요 없다. 브라우저 모듈 테스트는 source ES module을 직접 실행하므로 제품 dist 빌드 명령은 없다.

- 최초 17건: 16 PASS/1 FAIL. 합성 HTML 응답 charset 누락으로 전각 텍스트가 오인코딩됨. fixture를 UTF-8로 수정하고 17/17 재실행 성공. 테스트 기대값·기능 기준을 낮추지 않았다.
- 복원 실패·최신 페이지 스타일 보존·선택 범위 검증 추가 후 20/20 PASS.
- 이미지 표시/교체/모델부재 추가 후 24/24 PASS.
- 최종 결과는 아래 최종 검증/게시 기록에 남긴다. 이전 PASS를 최신 변경의 근거로 재사용하지 않는다.

## 한계·구현 경계

- 모듈은 내부 JavaScript 호출 API다. `.mjs`의 `start(options)`/콜백/classify/matchCatalog 이름은 **공용 메시지·Snapshot 계약이 아니다**. production 자동실행/가짜 정책/성공 응답이 없다.
- manifest/Service Worker를 만들거나 PR17을 섞지 않았다. 현재 브랜치 폴더를 unpacked Extension으로 로드할 수 없다. D-06 합의 후 Core manifest/content script 구성에 연결해야 한다.
- `SUPPORTED`는 현재 fixture에서 관찰한 제한 또는 검사 가능한 범위의 결과다. 전체 서비스 지원·세션 적용 성공·안전 판정을 뜻하지 않는다. DOM 미검출/토글 실패는 FAILED, 미지원 host/프레임은 UNSUPPORTED.
- 이미지 지원은 URL의 raster 확장자 또는 data MIME으로 구분하는 초기 adapter다. 확장자 없는 이미지/SVG 등은 UNSUPPORTED로 가리고 보기 선택 가능. 이미 읽을 수 있는 정적 img 픽셀만 canvas에서 로컬 처리하며 샘플은 최대512px로 줄인다. cross-origin 픽셀 접근 실패는 FAILED 가림. 비디오/canvas/CSS배경/닫힌 shadow DOM은 검사하지 못한다. GIF는 캡처 시점 프레임이며 실제 GIF 정지 프레임 정책·모델 정확도 확인이 남았다.
- 이미지 failure/retry UI는 아직 Core/설정 표시와 연결되지 않았다. 콜백은 상태/보기 여부만 반환한다. 이미지 URL·픽셀·분류점수는 로그/서버에 전달하지 않는다.
- 가림 시 플레이어를 pause하며 해제 때 강제로 다시 재생하지 않는다. DOM 스타일/속성을 복원하고 사용자가 수동 재생할 수 있다. 페이지 숨김만으로 네트워크/사이트 차단 성공을 보고하지 않는다.
- DOM observer는 feature를 즉시 재적용하고 BODY 키워드는 500ms debounce한다. 동일 URL 안 렌더는 접근으로 발행하지 않는다. 실제 명시 탐색 여부·navigation_id는 Core가 제공해야 한다.

## Git·PR 및 다음 행동

독립 모듈은 코드 검토 가능한 묶음이며 실제 Core/서비스/모델 검증이 남아 **Draft PR** 대상이다. 팀 리뷰·필수 CI·D-06 합의·실제 Chrome 적용/해제·회원/비회원/복구 검증 후 전체 상태를 재판정한다. 사용자 명시 병합 요청 전에는 develop 병합/자동병합하지 않는다.

Windows 절차: [Content_Control_Windows_검증.md](Content_Control_Windows_검증.md). 사용자 요청에 따른 연결 제안: [Content_Core_D06_연결제안.md](Content_Core_D06_연결제안.md). 전송/모델 검증이 없는 상태로 EVENT/OPTION 전체 완료를 표시하지 않는다.

## 최종 검증·게시 준비

- 최종 자동 실행: 위 명령으로 **29/29 PASS**, 실패/cancel/skip/todo0, duration13346.9799ms. source 문법검사 전체 PASS. 제품모델 없음·분류 모의·합성URL 조건은 그대로다.
- 합성 수동도구 점검(Codex 자동 수행): serve.mjs의 실제 localhost HTTP+Chrome으로 입력 제외→본문 키워드 가림→검증도구 복원 PASS, 서버 파일 허용경로 외 요청404 PASS. 최초 sandbox ERR_NETWORK_ACCESS_DENIED는 로컬 접속 권한 승인 후 같은 시험 재실행으로 해소했다. 사용자 실행 결과로 표시하지 않는다.
- git diff --check PASS. 이번 변경은 extension/content*, extension/README, 해당9개 작업카드·통합현황 및 Content 문서만이다. Web/Server/DB/Core 제품코드·공용 설계/API/Event 계약 변경 없음. 자격증명·사용자 자료·생성 dist·모델 모의값을 제품에 포함하지 않았다.
- PR 판정: 독립 구현 공유/검토 가능한 **Draft**. 실제 Extension manifest/메시지 연결·서비스 selector·실제 모델/목록·사용자 Windows·회원연동·팀리뷰는 선행 대기. 병합은 사용자 명시 요청 전 수행하지 않는다.

## 이전 게시 보류·재개 기록 (당시 이력)

- 커밋 전 재fetch 성공: origin/develop은 `90ad32be5d282f3b44c917a29e156dffc5e29187` 그대로이며 차이/충돌 없음. 원격 `feature/content-control` 브랜치는 없었다.
- 명시 파일 stage→diff검사→commit→push 실행을 요청했으나 sandbox 권한 요청에서 **Rejected("rejected by user")**로 프로세스 시작이 거부됐다. Git 명령 자체의 충돌·인증 오류가 아니다. 다른 수단으로 우회하거나 다시 요청하지 않았다.
- 새 Commit SHA 없음. HEAD는 시작 기준 `90ad32b` 그대로, staged 파일0, 이번 변경은 unstaged/untracked로 보존됐다. main/develop 직접 변경·force push·merge/rebase 없음.
- Push 미실행·원격 반영 없음. 따라서 **현재 PR 생성 보류**다. 코드 자체의 판정은 Draft 공유 가능이지만 원격 게시 조건이 충족되지 않았다. 팀 리뷰/develop 통합도 미수행.
- 다음: Git 쓰기 실행이 다시 허용되면 이 문서/작업카드·실제 파일 상태와 origin/develop을 재확인하고, 위 명시 범위만 stage한 뒤 `feat(content): implement independent page controls and recovery`로 commit, `git push -u origin feature/content-control`, 기존 Content PR 중복 확인 후 develop 대상 Draft 생성. upstream이 현재 origin/develop이므로 첫 Push에서 반드시 `-u origin feature/content-control`을 지정한다.
- 남은 Content 작업은 실제 Core 연결/이벤트 생성·전달, Instagram 추천/피드모달 실증, 검증 목록·고정 학습 모델, 실제 서비스/사용자 Chrome·복구 시험이다. 관련 공용계약·다른 담당 선행/사용자 실행 증거 대기이며 추가 독립 작업을 만들거나 완료로 추정하지 않는다.

## 2026-10-10 사용자 실행 결과 및 중간 공유 재개

- 사용자(채지민)가 localhost Content 검증 도구를 Chrome에서 실행했다. 제공한 화면에서 입력창에 검증대상이 있어도 blocked:false / SUPPORTED / limited:false이며 일반 페이지가 유지됨을 확인했다. 이어 본문 변경 시 FOCURVE 제한 안내만 표시된 화면을 확인했다.
- 자동 복원·수동 해제 후 본문 변경·재적용 절차를 안내한 뒤 사용자는 “다 된거 같은데”라고 보고했고 서버 종료도 보고했다. 이 세 항목은 **사용자 정상 추정 보고**로 기록한다. 세부 단계별 로그/추가 화면·버전·파일hash는 제공되지 않아 독립 확인 PASS로 확대하지 않는다.
- 실행 대상: feature/content-control의 미커밋 작업본(시작 HEAD90ad32b). 검증 당시 최종 Commit SHA/실제 로드 파일hash·Windows/Chrome 정확한 버전은 미확보. 이후 코드 변경 없이 중간 공유를 준비했다.
- 적용 범위: OPTION-09 키워드 합성 도구, AC-OPTION-09-01/02/03 및 BOUND-18의 일부(입력 제외·본문 감지·가림/해제). 실제 Extension/서비스 페이지/Core/Server·모델·재시작 검증으로 전용하지 않는다.
- 최신 사용자 지시: 확인한 결과와 미검증·Core 연결 대기를 기록하고 feature/content-control에 Commit·Push하여 중간 결과 공유. develop 병합 금지, 오늘 추가 구현은 진행하지 않음. 이전 게시 거부·보류는 당시 이력이며 이번 명시 허용으로 Git 게시를 재개한다.
- 다음: 윤종민이 D-06 연결 제안의 정책 주입/적용·해제 결과/공통 navigation_id/이벤트 확정·중복 방지를 검토. 세부 계약 합의 후 Core 연결 및 실제 회원·비회원 Chrome 검증. 현재 전체 기능 미완료.

### 중간 게시 전 재점검

- Codex 재실행: 기존과 동일한 루트 PowerShell 명령/Node24.19.0·설치Chrome154.0.8037.98/Playwright 합성 DOM·모의 분류, 29/29 PASS(실패·cancel·skip·todo0,17587.4503ms). 모든 mjs 문법검사 PASS. 제품 기능 변경 없이 기록 갱신만 수행.
- 재fetch 성공, origin/develop90ad32b로 변경 없음. 원격feature/content-control 없음 확인. sandbox내 ls-remote DNS 오류는 권한 승인 후 동일 명령 재실행으로 해소. 강제Push/merge/rebase 없음.
- 변경 범위 재검토: Content 모듈·테스트·합성 도구·README, 관련9개 작업카드/통합현황/Content 기록·Windows 절차·D-06 제안만. 타 담당 제품코드·공용 계약·환경비밀 변경 없음. git diff --check PASS.
- 오늘 공유 범위는 기능 브랜치 Commit·Push까지다. PR 생성/팀리뷰/develop 병합 미수행. 이후 작업은 Core 세부 계약 검토와 실제 통합 검증으로 재개한다.

### 중간 공유 실행 중 작성자 정보 차단

- 명시한27개 파일 stage 및 staged diff --check 통과 후 commit을 시도했으나 `Author identity unknown` / `unable to auto-detect email address`로 실패했다. repository user.name/user.email 모두 미설정이다. commit/push는 아직 없음, HEAD90ad32b 유지.
- 다른 팀원의 author를 복사하거나 임의 이메일을 만들지 않았다. 사용자에게 작성자 이름(채지민 사용 여부)과 Git 이메일을 요청했다. 답변 후 이 저장소에만 설정하고 commit/push/원격SHA 대조를 재개한다. develop 병합은 하지 않는다.
- staged27개 파일은 보존하며 이 실패 기록은 작업본에 추가했다. 재개 시 최신기록을 다시stage하고 변경 범위를 재확인해야 한다. 테스트29/29 PASS·사용자 부분확인·Core 연결 대기 상태는 변함없다.

## 2026-10-10 중간 결과 게시 완료·오늘 작업 마무리

- 사용자 지정 이름/비공개 GitHub noreply 이메일을 이 저장소의 local Git config에만 설정하여 작성자 오류를 해소했다.
- 구현 Commit: 3d7bff718e756cedb0950858885edbb6f472ea68 / feat(content): share independent controls and partial validation. feature/content-control로 Push 성공, ls-remote SHA 일치 확인. 시작 기준90ad32b, 최신 fetch에서도 develop 변경 없음.
- 공유 브랜치: https://github.com/kdu-sw-capstone/capstone-project/tree/feature/content-control . 이전 미게시/작성자 차단 문구는 당시 이력이며 위 게시 결과로 해소됐다. PR 생성·리뷰·develop 병합/자동병합은 수행하지 않았다.
- 검증: Codex 자동29/29 PASS·문법/diff검사 PASS. 사용자 OPTION-09 합성도구 입력 제외/본문감지는 제공 화면 확인, 복원/수동해제/재적용은 정상 추정 보고(세부증거 미확보). 실제 서비스/Extension/Core/Server·목록/모델·복구는 미검증 유지.
- 윤종민 전달 문서: docs/implementation/Content_Core_D06_연결제안.md (미확정 제안). 확인할 사항은 정책/고정 Snapshot 전달, 적용·해제 결과 보고와 실패 기준, 공통 navigation_id·명시 접근/중복 방지, 복수 사유 이벤트 확정 시점, manifest 주입/회원·비회원 실제 Chrome 검증이다. 임의 공용계약 변경·직접 메시지 발송 없음.
- 오늘 종료 상태: 독립 구현 중간 공유 완료, 기능 전체 미완료·Core 세부계약/연결 대기. 다음에는 브랜치 최신 코드/작업카드와 팀 합의 내용을 다시 대조하고 연결 단위로 재개한다. 본 게시 기록은 별도 문서 커밋으로 같은 브랜치에 보관한다.
