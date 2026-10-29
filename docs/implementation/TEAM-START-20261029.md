# 추가 MVP 팀 개발 시작 — 2026-10-29

이 기준은 **팀 개발 기준 인계용이며 최종 릴리스 승인 아님**. `MVP_FINAL_COMPLETE=false`. 필수 후보의 실제 Chrome 수용, 정상 END/복원/재기동 및 Shorts P0는 미완료다. Shorts는 김다훈이 별도 트랙에서 계속 담당하며 추가 MVP 독립 개발은 병행한다. 개인 PC 첫 실행과 계정별 접근 권한은 당사자 확인 전 `NOT_VERIFIED`다.

## 공통 Git 기준과 첫 실행

저장소: https://github.com/kdu-sw-capstone/capstone-project.git

기준은 `integration/mandatory-mvp-baseline-20261029`의 **최종 게시·재현 검증 인계 Commit**이다. 최초 게시 시도의 CI 오류가 수정된 경우 인계 전 최종 SHA를 사용한다. 이 파일이 자신을 포함하는 Commit SHA를 하드코딩할 수는 없으므로 **게시 Draft PR 본문/최종 인계의 전체 40자리 SHA**를 기대값으로 사용한다. ZIP SHA나 출발 develop `90ad32b`를 대신 입력하지 않는다. 브랜치 조회값만 서로 비교하면 원격 브랜치 이동을 탐지하지 못한다.

새 폴더에서 Windows PowerShell로 실행한다. 기존 수정 폴더는 reset/clean/stash/rebase로 비우지 않는다.

```powershell
git clone https://github.com/kdu-sw-capstone/capstone-project.git focurve-team
Set-Location focurve-team
git fetch origin
$expectedBaselineSha = Read-Host '게시 Draft PR에 기록된 전체 기준 Git SHA 40자리'
if ($expectedBaselineSha -notmatch '^[0-9a-f]{40}$') { throw 'Git SHA 형식 오류' }
$remoteBaselineSha = (git rev-parse origin/integration/mandatory-mvp-baseline-20261029).Trim()
if ($remoteBaselineSha -ne $expectedBaselineSha) { throw '기준 SHA 불일치: 통합 담당에게 확인' }
git show --no-patch --format=fuller $expectedBaselineSha
# 아래 한 줄만 자신의 담당 브랜치로 선택. 이미 로컬 브랜치가 있으면 switch <브랜치>.
git switch --track origin/feature/additional-mvp-core
git status --short
git rev-parse HEAD
git merge-base --is-ancestor $expectedBaselineSha HEAD
if ($LASTEXITCODE -ne 0) { throw '담당 브랜치가 공통 기준에서 출발하지 않음' }
```

기존 clone에서 작업이 있으면 `git status --short`로 확인하고 먼저 별도 clone을 사용한다. 기존 작업자의 브랜치를 강제로 돌리지 않는다. 최초 팀 브랜치 여섯 개는 같은 Commit에서 출발하며, 이후 담당자의 정상 Push로 feature HEAD가 전진하는 것은 정상이다. 비교 기준은 움직이지 않는 최초 기준 Commit이다.

| 브랜치 | 담당·용도 | PR 대상 |
|---|---|---|
| integration/mandatory-mvp-baseline-20261029 | 필수 후보 고정, 최종 릴리스 아님 | develop, Draft 유지 |
| integration/additional-mvp-20261029 | 추가 MVP 통합 | 후속 통합 승인은 별도 |
| feature/additional-mvp-web-server | 김다훈 Web·Server·DB·UI | integration/additional-mvp-20261029 |
| fix/shorts-stability | 김다훈 Shorts·SPA P0 | integration/additional-mvp-20261029, 필수 후보 승격은 별도 리뷰 |
| feature/additional-mvp-core | 윤종민 Core | integration/additional-mvp-20261029 |
| feature/additional-mvp-content | 채지민 Content | integration/additional-mvp-20261029 |

기존 CONTRIBUTING/PR 템플릿은 유지한다. **이번 추가 MVP 기능 PR의 대상은 develop 대신 위 추가 통합 브랜치**다. main/develop 직접 Push, force, 승인 없는 Merge/Ready 전환은 하지 않는다. 기존 PR #17·#21을 추가 Merge하면 이전 실행 경로가 재유입될 수 있으므로 먼저 새 기준과 비교한다. #17·#21·#22는 그대로 보존한다.

## 최소 도구와 실제 명령

검증 OS는 Windows PowerShell 7이다. `.nvmrc`의 Node 24.19.0(24.19.x), npm 11.x, Git이 필요하다. Web/Core/Content는 JDK·MySQL·SMTP·Native 설치 없이 아래 자동 시험이 가능하다. Server는 JDK 21과 저장소 Maven Wrapper를 사용한다. Python 3.14는 distribution 합성 계약 시험에 사용했다. Linux는 기존 CI 결과와 분리하며 이번 로컬 재현 OS가 아니다.

```powershell
node --version
npm.cmd --version
# Core/Content: lockfile 설치, 전체 Core 회귀·Content 순수 회귀·bundle/harness 생성
./scripts/verify-team.ps1 -Area Extension -Install
# Web: lockfile 설치, Vitest 및 TypeScript/Vite
./scripts/verify-team.ps1 -Area Web -Install
# Server: JDK21, backend 비DB 24개+package, runtime-server 56개+package, 배포 합성 67개
java -version
./scripts/verify-team.ps1 -Area Server
# 전체 재현 + 이 checkout 전용 npm/Maven 다운로드 캐시
./scripts/verify-team.ps1 -Area All -Install -FreshCaches
```

이 스크립트는 실제 Chrome·START/END·HOLD 복구·DB·SMTP·Native 등록·인증서 설치를 실행하지 않는다. `build:harness`는 모의 확장을 생성할 뿐 Chrome을 열지 않는다. `.local/team-check/*.log`에서 실제 오류를 확인한다. npm 설치 실패는 Node/registry/lockfile/프록시부터 확인하며 임의 패키지 업그레이드로 회피하지 않는다. JDK 오류는 `JAVA_HOME`/PATH와 `java -version`을 대조한다. `backend/mvnw.cmd`가 다운로드한 Maven과 의존성도 필요하므로 최초 실행은 네트워크 접근이 필요하다. DB 전체 시험 실패를 비DB 시험 PASS로 덮지 않는다.

개별 명령은 다음과 같다. 상대 경로의 기준은 저장소 루트다.

```powershell
npm.cmd --prefix frontend ci
npm.cmd --prefix frontend test
npm.cmd --prefix frontend run build
npm.cmd --prefix frontend run dev
npm.cmd --prefix extension ci
Push-Location extension
node --test --test-concurrency=2 tests/*.test.js tests/*.test.mjs tests/*.test.cjs
node --test content-tests/changes.test.mjs content-tests/detection.test.mjs
node scripts/build-member-worker.js
node scripts/build-a1.mjs
node scripts/build-member-a1.mjs
npm.cmd run check
npm.cmd run build:harness
Pop-Location
./backend/mvnw.cmd -f backend/pom.xml -B -ntp '-Dtest=AuthRateTimingTest,ConsentBoundaryTest,HostEventValidationTest,PolicyContractTest,SmtpMailDeliveryTest,SocialProviderValidationTest' verify
./backend/mvnw.cmd -f runtime-server/pom.xml -B -ntp verify
python -B -m unittest discover -s distribution/tests -p 'test_*.py'
```

`frontend` Vite는 기본 127.0.0.1:5173, 기존 backend proxy는 127.0.0.1:8080이다. 서버가 없으면 실제 조회 실패가 정상이며 mock 성공과 구분한다. backend와 runtime-server는 API/클래스가 겹치는 **별도 실행 모듈**이므로 한 JVM에 합치지 않는다. 설치형 Web의 실제 binding은 일반 Vite 빌드와 다르다. `scripts/build_user_web.py`/배포 도구를 임의 실행하여 실제 설치로 간주하지 않는다.

## 비밀과 선택적 Server 통합

`.env.example`, `frontend/.env.example`, `distribution/config.example.json`은 값 없는 예시다. 개인 값은 ignored `.env`/`frontend/.env.local` 또는 현재 PowerShell 프로세스 환경에만 입력한다. PowerShell은 `.env`를 자동 로드하지 않는다. `VITE_*`는 브라우저 공개값이므로 DB/SMTP/OAuth 비밀을 넣지 않는다. `.env`·개인 Maven 설정·DB·로그·Chrome 프로필·설치 결과 ZIP을 Commit하지 않는다.

실제 backend 통합은 **새 폐기용 MySQL 8.4.x 데이터베이스**가 있을 때만 `DB_URL`, `TEST_DB_URL`, `DB_USERNAME`, `DB_PASSWORD`를 해당 DB로 지정하고 `./backend/mvnw.cmd -f backend/pom.xml -B -ntp verify`를 실행한다. 기존 운영/실패 설치 DB에 연결하지 않는다. `.env.example`의 포트는 예시이며 사용 중인 3306을 임의 정리하지 않는다. 실제 local API 실행은 동일한 폐기용 개발 DB 환경에서 `./backend/mvnw.cmd -f backend/pom.xml spring-boot:run`. 외부 가입/메일/OAuth는 별도 자격 정보·등록이 필요하며 자동 시험의 fake transport는 실제 SMTP 성공이 아니다. 설치형 runtime-server 실서비스는 별도 승인된 설치 절차와 binding이 필요하다. 이번 공통 기준 검증에서는 DB 통합·실제 설치를 기동하지 않는다.

## 역할·파일 경계·첫 작업

먼저 AGENTS.md, `docs/implementation/개발운영.md`, `통합현황.md`, 해당 작업카드와 상세 명세를 읽는다. 이 기준 게시 자체의 카드: [TEAM-BASELINE-20261029](tasks/TEAM-BASELINE-20261029.md). 현재 작업카드는 기능 전체 완료 판정과 영역별 진행 상태를 구분한다.

| 담당 | 수정 주 영역·작업카드 | 첫 독립 작업·연결 게이트 |
|---|---|---|
| 김다훈 | frontend/src, backend/src/main·test, runtime-server/src/main·test, 각 모듈 DB. OPTION-01~04/06/08~12, SESSION-05~06, LOG/STAT/SETTING. 별도 fix 브랜치에서 POLICY-03/SESSION-04/EXT-02 Shorts 안정화 | 기존 추가 UI·DB 변경을 재개발하지 않고 이관 대조표부터 검토. backend 신규 API를 runtime-server 지원으로 오인하지 않음. API/DB/정책 의미 변경은 공동 리뷰. 최종 통합·전체 회귀·릴리스 판정 책임 |
| 윤종민 | extension/a1의 Core·store·registry, member-a1의 Core, execution, background, src Core/DNR, tests. EXT-02/03, OPTION-06/08, SESSION-05/06, EVENT-01/02 | 동결 D06/schema와 기존 END 소유권 fixture부터 확인. 새 원장·runtime 메시지는 합의 전 제품 연결 금지. 상시 시간/일일 한도·예약·반복/휴식·DNR·ACK·중복·해제/복원 시험을 작은 카드로 수행 |
| 채지민 | extension/content, Content용 a0/shorts-effect.mjs·a1/content.mjs·member-a1/content.mjs, content-tests, Content용 tests/ui. OPTION-01~04/09~11, EVENT-03 | 16옵션 현행 구현 재사용 여부와 ON/OFF/SPA/복원 fixture를 먼저 대조. Shorts 안정화 책임은 김다훈. 공용 Shorts 감지/restore·Content entry 수정 전 김다훈과 경계 협의 |

공용 `extension/*/contract.mjs`, schema.json, manifest, entry, generated bundle, `contracts/`, API DTO, migration, owner/ledger·release 경계는 관련 담당자 동시 리뷰 대상이다. Content는 DNR ID·navigation ID·회원 소유권을 자체 발급하지 않는다. 번들은 담당 원본을 먼저 합친 뒤 위 빌더로 생성하고, 기존 추적 번들을 임의 삭제하지 않는다. Runtime 서버의 migration과 backend migration은 각각 별도 번호 공간이며 확정 기준에서 충돌 여부를 다시 검사한다.

확정 옵션: YT-01 홈페이지 숨기기, YT-02 Shorts 숨기기, YT-03 댓글 숨기기, YT-04 추천 동영상 숨기기, YT-05 구독 숨기기, YT-06 탐색 숨기기, YT-07 상단 바 숨기기, YT-08 종료 카드 비활성화, YT-09 흑백 모드, YT-10 자동 재생 비활성화. IG-01 스토리 숨기기, IG-02 Reels 숨기기, IG-03 탐색 숨기기, IG-04 댓글 숨기기, IG-05 제안된 항목 숨기기, IG-06 흑백 모드. 요구사항 확정과 구현/Chrome 검증 완료는 다르다. 키워드는 **URL 중심** 계약이며 본문/검색어/이미지 검사로 확대하지 않는다. 성인 도메인과 로컬 민감 이미지 블러를 구분한다.

## 계약·Figma·기존 변경 재사용

관측된 구현 계약은 비회원 `extension/a1/contract.mjs`/`schema.json`의 `d06-guest-a1-candidate-2`, 회원 `extension/member-a1/contract.mjs`/`schema.json`의 `d06-member-a1-1`이다. guest candidate를 최종 공동 revision으로 격상하지 않는다. Event 1.2·Snapshot·Journal·APPLY_POLICY의 원문/소유권/복원 조건을 보존한다. 신규 runtime Wire, 단일 D06 합의, 측정 기준은 **REVIEW_PENDING**. 세 사람의 실제 승인 receipt 전 APPROVED 금지. 구 focus END와 상시 runtime RELEASE를 합치지 않는다.

사용자 확정 DEC-01~07: 상시 측정, 설치별 일일 한도(계정 합계는 조회), 사용자 IANA 자정 원장 보존, 소진 사이트만 차단·세션 유지, 전역/시간/예약/한도 제한은 ALLOW로 우회 금지, 현재 사용자 날짜 종료 뒤 시간대 변경·잔여 한도 중복 부여 금지, 명시 선택 비회원 완료 기록만 분석으로 가져오기·자동 업로드/삭제/중복/현재 회원 한도 합산 금지. 소유권 전환 전후 상시 원장 연속성은 공동 계약으로 결정한다.

측정 PoC는 엄격 5초 체크포인트 **FAIL(6.012초)**, 차단 지연 1.454초, 보정 누적차 −0.328±0.235초였다. 합성/혼합 전경 측정이지 제품 성능 보장이 아니며 연속 전경 30분/2시간 NOT_RUN이다. 실패 원본은 기존 별도 증거 위치에 보존하고 배포하지 않는다.

Figma: [12 FOCURVE_UI](https://www.figma.com/design/BeixHumD7TSoo9xMVzJkhO/FOCURVE_UI?node-id=3053-8252), file `BeixHumD7TSoo9xMVzJkhO`, page/node `3053:8252`. 기존 공식 연결 20섹션/13화면 및 로컬 `03_UI_검수.md` UI_BINDINGS·충돌5개를 재사용한다. 전체 화면 pixel 일치/반응형/실제 연결 완료로 간주하지 않는다. 최신 로컬 매핑은 아직 PR22 원격 본문과 다를 수 있으므로 검토 이관 뒤 정확 revision을 기록한다. Figma 수정·재분석으로 작업을 다시 시작하지 않는다.

PR #22는 설계7개 원격 기준 `a29d02c97724f437d6c059c6d49eca40bd37e197`, Draft로 보존한다. 기존 추가 MVP 작업 공간의 UI 상태·차트 API·선택적 DB 초안·자동 시험은 **미커밋 그대로 보존**, 이번 필수 기준에 통째로 넣지 않는다. [게시 검토 기록](baseline-20261029/README.md)의 이관 분류를 따르고 새 브랜치에서 기능별 작은 후속 PR로 옮긴다. 자기 역할 프롬프트는 기존 04_Git_협업.md의 prompt-kdh/yjm/cjm를 유지하고 **기준 SHA·브랜치·계약 입력과 변경된 UI mapping만** 갱신한다.

## 카드별 검증과 PR

각 담당자는 카드 단위로 구현→단위/계약 시험→오류 수정→재시험→자기 영역 실제 검증→작은 PR 제출까지 책임진다. 일반 오류·시험 실패는 스스로 원인을 찾아 고치고, 정책 변경·공통 계약 충돌·보안 위험·담당 범위 초과·최종 통합 문제만 김다훈에게 요청한다. Codex의 완료 설명/파일 생성은 완료 증거가 아니다.

수용: 기존 필수 회귀, ON/OFF·중복·stale ACK·복원·구버전 거절, 소유권/데이터 보존, 오류 표시·실제 적용 상태를 관련 AC ID에 연결한다. 실제 Chrome은 **별도 승인된 독립 신규 프로필**에서 버전·소스 SHA·확장 hash·입력·관찰·결과/오차를 남긴다. 기존 Default/Profile 2/실패 설치/운영 DB 사용 금지. 현재 게시 작업은 실제 START/END/정리/Native 등록을 승인하지 않는다. 미실행은 NOT_RUN, fixture는 SYNTHETIC, 실패는 FAIL로 보존한다. 실제 적용 확인 없이 APPLIED/성공을 반환하지 않는다.

```powershell
git status --short
git diff --check
# 자기 기능에 필요한 파일만 경로를 열거하여 git add -- <경로1> <경로2>
git diff --cached --stat
git diff --cached --check
git diff --cached
# 비밀·개인정보 검사와 해당 카드 시험이 통과한 뒤:
git commit -m "feat: <기능 ID와 실제 변경>"
git push -u origin HEAD
# GitHub에서 현재 담당 브랜치 → integration/additional-mvp-20261029 Draft PR
```

PR 템플릿에 담당·카드/AC·설계·공유 계약 영향·코드/시험 명령·정확한 PASS/FAIL/NOT_RUN·기존 필수 회귀·미완료를 적는다. 모든 기능 완료까지 PR을 미루지 않는다. 팀장은 최종 통합·전체 회귀·릴리스 판정을 맡으며 동료의 미완성 기능을 대신 전부 디버깅하는 절차로 운영하지 않는다.

## 일정과 게이트

10/29~31: 공통 Git 게시·팀원 첫 빌드·첫 카드 PR. 11/1~5: 주요 기능. 11/6~8: 기능/UI 구현 마감. 11/9~12: 실제 기능 연동·통합 Chrome 시험. 11/13~15: P0/회귀/GitHub 최종 통합. 최종 마감 11/15, Shorts 병행. 날짜 경과를 수용 완료로 처리하지 않는다.

독립 UI/모델/기존 API 내부 기능·fixture는 착수 가능. 신규 공용 Wire/ledger·D06 의미 변경은 공동 계약 승인, 실제 Chrome/설치 시험은 별도 환경 승인, 최종 Merge/릴리스는 별도 승인이다. 공통 개발 기준 게시가 이 세 게이트를 해제하지 않는다.
