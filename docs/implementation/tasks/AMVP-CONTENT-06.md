# AMVP-CONTENT-06 · 추가 Content 연결

담당: 채지민. 브랜치: feature/additional-mvp-content.
시작 기준: e2b3fc318fe52acc45145a30def07b874b2255f6 (PR24 병합).
상태: 진행 중. 전체 16옵션/제품 연결 완료 아님.

## 기준과 경계

- 확정 AMVP-CONTRACT-20261029-RC2의 03_Wire_D06_복원.md, 05_Content_Event_UI.md, 06_인계_승인.md, feature-registry.json·Schema의 FEATURE/CONTENT_POLICY 증거 원문을 재사용한다.
- 기존 Shorts 안정화는 김다훈 담당을 유지한다. legacy Changes/Shorts/controller와 Core의 registry·DNR·sender 구현을 수정하지 않는다.
- 원래 작업 폴더 feature/content-control의 OPTION-11/통합현황 및 image-filter-demo 미커밋 작업을 유지하려고 별도 worktree에서 개발한다. 기존 시험판은 제품 모델/profile로 자동 채택하지 않는다.

## 2026-10-30 · 첫 단위: 공유 DOM claim 원장

- 코드: extension/content/claim-ledger.mjs. 같은 document에서 옵션/owner별 claim으로 display/inert 및 grayscale filter를 공유한다. 마지막 owner 해제 때만 복원하며 페이지의 후속 style/inert 변경과 다른 claim을 보존한다.
- 실패한 복원은 원장에서 지우지 않는다. detached node는 소멸 성공으로 간주하지 않는다. 문서 효과를 닫은 뒤 새 적용은 거절하고 원래 문서 cleanup은 허용한다.
- 문서 로컬 primitive이며 아직 제품 receiver/실제 owner 인증/영속 Journal/receipt/미디어 제어/observer/SPA·BFCache 연결은 없다. 함수의 verified/restored는 국소 DOM 결과이고 AMVP APPLIED/RUNNING 또는 RELEASED wire 성공 응답이 아니다.
- 도구: 기존 content-tools/serve.mjs에 claims.html/claims.mjs 및 기존 controller의 의존 UI 모듈 ui/restriction.mjs 제공 경로를 추가. 합성 DOM 검사이며 원래 키워드 harness도 유지한다. 별도 모델 다운로드/제품 권한 추가 없이 확인한다.
- 실행: bundled Node24 `--test extension/content-tests/claim-ledger.test.mjs extension/content-tests/changes.test.mjs extension/content-tests/detection.test.mjs`.
- 결과: 신규9 + 관련 기존4 = 13/13 PASS (Node 단위/합성 요소). 실제 CSS 엔진·제품 Chrome·16옵션·Core·Server·미디어/오디오·모델 검증과 구분한다.
- 전체 관련 회귀: 설치 Chrome headless + Playwright 합성 DOM으로 기존33 + 신규 단위9 + 신규 브라우저4 = 46/46 PASS, 실패/skip0. 명령은 아래 게시 범위 재현 절차 참조. 기존 테스트가 UI 의존 모듈을 HTML로 응답해 29개 import 실패했던 원인을 시험 라우팅의 정확한 UI 경로 추가로 수정한 뒤 통과했다. 제품 Shorts 코드는 변경하지 않았다.
- 사용자 실행 결과: 2026-10-30 claims.html의 체크 1~5 모두 문제없다고 보고. 다른 제한 유지, 마지막 제한 해제/일반 버튼 복원, 가리기·흑백 분리, 흑백 해제/밝기 복원, 페이지 flex 변경 보존을 정상 확인했다고 기록한다. 사용자 보고이며 영상/Chrome 버전/실행 hash를 별도 수집한 증거는 아니다. 실제 YouTube·Instagram·Core 제품 통합 PASS로 확대하지 않는다.

## 첫 PR 게시 범위

- 포함: claim-ledger.mjs, claim-ledger 단위/브라우저 시험, claims.html/mjs, 기존 시험의 UI 의존 경로 보완, serve 경로, 이 카드. 기존 16옵션/전체 Core 연결 완료가 아니라 내부 공통 부품의 조기 리뷰다.
- 제외: watch-panels.mjs, watch-panels-browser.test.mjs, 댓글·추천용 build-chrome-harness/bootstrap/popup/manifest 변경. 이들은 로컬 후속 작업이며 이번 Commit/Push/PR에 포함하지 않는다.
- 게시 대상: feature/additional-mvp-content → integration/additional-mvp-20261029. develop 병합·자동병합 없음. 공유 계약/API/Schema·기존 정책·제품 listener를 바꾸지 않는다.
- 상태: 사용자 시험 완료 후 공통 제한·복원 부품만 먼저 게시하라는 지시로 Commit/Push/PR 준비. 실제 게시 SHA·PR 링크는 GitHub 결과가 원본이다.

### 게시 부품만 재현

1. Node24와 Playwright 모듈·설치 Chrome 경로를 준비하고 PLAYWRIGHT_MODULE/CHROME_EXECUTABLE 환경변수를 설정한다. 별도 제품 설치/실제 계정·네트워크가 아닌 합성 DOM 시험이다.
2. `node --test extension/content-tests/changes.test.mjs extension/content-tests/detection.test.mjs extension/content-tests/browser.test.mjs extension/content-tests/claim-ledger.test.mjs extension/content-tests/claim-ledger-browser.test.mjs` → 46건. 아직 로컬인 watch-panels 시험은 이 명령에 포함하지 않는다.
3. `node extension/content-tools/serve.mjs` → http://127.0.0.1:4178/content-tools/claims.html. A/B는 시험용 claim 이름이며 제품 기능명이 아니다. 가리기/흑백/페이지 변경을 확인하고 5개 체크박스로 사용자 결과를 남긴다. 복원 실패 재시도는 자동 단위시험에서 검사한다.

### 미검증·통합 경계

실제 native sender/owner 인증, Core 영속 intent·receipt/QUERY·실제 세션 종료와 이 원장의 결속, 모든 16개 옵션, 실제 서비스 selector, 실제 BFCache/재시작·미디어/오디오/모델·Server 연동은 이 부품 PR에서 미검증이다. 이 클래스는 자체로 정책을 선택하거나 frozen Snapshot을 발급하지 않고, trusted caller의 document-local DOM 제어/복원만 제공한다. `suspend()`는 새 효과를 막는 내부 primitive이며 실제 lifecycle 승인이나 GONE 증거가 아니다.

## 다음 작은 연결

### 2026-10-30 · YT-10 다음 영상 자동재생 (사용자 확인 완료 / 별도 PR 제출)

- 담당 채지민, codex/content-watch-panels의 clean 4dd1a739cce1fa2928533e70db55444f179317b1에서 독립 후속. 게시 시 PR33/36 모두 미병합 확인. 기존 HEAD를 보존하고 별도 codex/content-autoplay 브랜치에 YT-10 변경6파일만 제출한다. 통합 대상 전체 diff에는 선행 변경이 포함될 수 있어 4dd1a73 이후 비교로 이번 범위만 리뷰하고 선행 통합 후 최종 diff를 확인한다.
- 기준: feature-registry.json의 YT-10/AC-YT-10-01~03, 03_동작규칙.md 내부 기능 제한, RC2 03/05의 claim/실제 효과/복원. 일반 /watch top-frame의 다음 영상 자동재생 제어만 대상으로 하고 수동 video play/pause/mute/next를 가로채지 않는다.
- extension/content/autoplay.mjs는 기존 autoplay toggle click/readback 패턴을 재사용한 내부 adapter. shared ClaimLedger 객체별 별도 미디어 설정 자원 registry에 owner/binding과 원래 toggle 상태·변경 의무를 기록한 뒤 클릭한다. 같은 scope 중복 세션은 거절하며 다른 owner가 남으면 OFF를 유지하고 마지막 해제에서만 자신이 변경한 ON→OFF를 복원한다. 원래 OFF였으면 ON으로 바꾸지 않는다.
- selector 이탈은 자기 자원 회수, foreign document/복원 실패는 의무 보존·재시도. 실패한 OFF 클릭은 반복 스캔으로 무한 클릭하지 않는다. DOM 재생성은 관찰하고 URL 이동/pagehide 후 신규 적용은 닫는다. 실제 Core 재결속·generation 발급이나 영속 Journal이 아니다. OBSERVED는 스위치 readback의 국소 관측이며 실제 다음 영상 차단/Wire APPLIED 증거가 아니다.
- 기존 독립 Chrome 시험 popup에 자동재생 적용/해제/상태 TEST 명령만 추가. 댓글·추천과 같은 ledger를 재사용하되 해당 모듈과 PR33 원장 코드는 수정하지 않는다. 제품 manifest/권한·Wire/API/Schema 변경 없음. build 도구에 autoplay 모듈 복사만 추가한다.
- 직접 자동 시험: Node24 + 설치 Chrome headless/Playwright, autoplay-browser.test.mjs 9/9 PASS. ON→OFF/최종 복원, 원래 OFF, 다중 owner·같은 scope·퇴역 객체, 지연 DOM/클릭 거절, 페이지 변경/selector 이탈, foreign document, SPA/pagehide 모사, 미지원 경로, 시험 sender 및 댓글과 독립 해제를 확인했다. 합성 DOM이므로 실제 YouTube 다음 영상 전환/오디오/실제 BFCache를 검증한 결과가 아니다.
- 관련 전체 회귀: 기존33+공통 원장19+watch13+autoplay9 = 74/74 PASS, 실패/skip0. 명령은 `node --test extension/content-tests/changes.test.mjs extension/content-tests/detection.test.mjs extension/content-tests/browser.test.mjs extension/content-tests/claim-ledger.test.mjs extension/content-tests/claim-ledger-browser.test.mjs extension/content-tests/watch-panels-browser.test.mjs extension/content-tests/autoplay-browser.test.mjs`. build-chrome-harness.mjs 및 git diff --check PASS. 실제 서비스 시험이 아니다.
- 사용자 실행 보고: 안내6항목(원래 ON→적용 OFF, 영상 끝 자동 전환 없음, 수동 재생·다음 클릭, 해제 시 원래 ON 복원, 원래 OFF 보존, 댓글/추천과 독립 해제)에 “다 일단 테스트 하기로 한거 문제 없고”로 정상 회신. 영상 간 이동·YouTube 이탈/재진입 후에도 OFF 유지 관찰을 추가 보고했다. AI 직접 관측/영상·브라우저 버전·실행 hash/종료 로그 수집은 아니다. OFF 설정 유지와 새 문서의 제어/권한 자동 재결속은 구분한다.
- 시험 중 제시된 콘솔 자료에 영상403·광고CORS·페이지 경고가 있었으나 autoplay/bootstrap 소스나 Uncaught 표시는 없었다. 원인 확정/무관 보장으로 사용하지 않는다. 원본 영상 URL·query·IP·서명 값은 이 카드/PR에 보관하지 않는다.
- 미검증: 실제 서비스 selector/profile 전체 수용, 제품 frozen/native/issued registry·영속 자원/receipt·Core/Server, BFCache/재시작·자동 SPA 재결속. 사용자 정상 경로 보고는 제품 통합 완료가 아니다. 사용자 승인으로 이번6파일을 Commit/Push·별도 Draft PR 제출하며 실제 SHA/PR은 GitHub 결과가 원본이다. develop/통합 브랜치 병합 없음.

### 2026-10-30 · PR36 두 P2 수정 (검증 완료 / 사용자 승인 후 제출)

- 기준 0972ea2cfc6a8be273a719086e77b5ea8d6dd4b7, codex/content-watch-panels, 채지민. 리뷰 discussion_r4421899792 / discussion_r4421899797. 기존 PR33 코드와 브랜치는 변경하지 않는다.
- 동일 ledger·owner·binding의 두 번째 live session은 효과 전에 WATCH_SCOPE_ALREADY_ACTIVE로 거절한다. 무작위 실행 ID나 신규 Wire 필드를 만들지 않고 trusted caller가 live session을 재사용하도록 제한한다. 종료 객체의 개별 해제는 no-op이며, 미해결 cleanup이 있는 동안 후속 세션 진입을 막는다. 실제 execution/generation의 제품 매핑은 Core 연결 시 확인할 후속 경계다.
- 옵션별 element→내부 claim 집합을 유지하고 현재 selector와 차집합을 비교하여 이탈한 요소의 자기 claim만 회수한다. 페이지 변경/다른 owner는 보존한다. 복원 실패·foreign document는 FAILED 및 원장 의무를 유지하며 NO_TARGET 성공으로 숨기지 않는다. target claim은 내부 메모리 자원 식별이며 영속 Journal identity를 대체하지 않는다.
- 수정 전 새 반례2/2 FAIL 확인: 동일 scope 중복 시작 거절 누락, selector 이탈 후 가림 잔존. 수정 후 기존 watch9+반례2=11/11 PASS. 이후 복원 실패/재시도 및 adoption 의무 보존2건을 추가했다.
- 최종 관련 회귀: Node24·설치 Chrome headless/Playwright 합성 DOM에서 `node --test extension/content-tests/watch-panels-browser.test.mjs extension/content-tests/claim-ledger.test.mjs extension/content-tests/claim-ledger-browser.test.mjs` → 32/32 PASS (watch13+원장19), 실패/skip0. git diff --check PASS. 이전 전체61 PASS는 과거 근거이며 이번 전체65 실행 결과로 바꾸지 않는다.
- 변경 범위는 watch-panels.mjs·관련 시험·이 카드3개. 실제 YouTube에서 리뷰 반례가 발생했다는 증거/새 사용자 실행 결과는 없으며, 제품 Core/Wire/native/영속 복구/실제 BFCache·세대 재결속은 미검증. 사용자 승인으로 PR36 수정분만 같은 브랜치에 Commit·Push 제출하며 실제 원격 HEAD는 GitHub 결과가 원본이다. 병합 없음.

### 2026-10-30 · 일반 영상 댓글·추천 단위 (사용자 확인 완료 / 별도 PR 제출)

- 시작 기준 040ac5bde2a2f7297da13d8db9d9c540cd0e1ca0, 담당 채지민. 기존 로컬 watch-panels.mjs와 시험 harness를 이어 작업. AMVP YT-03/04 중 일반 /watch top-frame만 지원하며 Shorts 댓글·전체16옵션 완료를 주장하지 않는다.
- WatchPanelSession은 전달된 옵션을 복제·고정하고 공유 ClaimLedger로 댓글/추천을 독립 제한·복원한다. 늦게 생성된 DOM 관찰, 페이지 스타일 변경 보존, 다른 claim 유지, URL 이동/pagehide 시 신규 적용 중지 및 기존 복원 의무 보존. OBSERVED/NO_TARGET은 국소 관측이며 제품 APPLIED/NOT_APPLICABLE 증거가 아니다. Core/Wire/native 검증·영속 원장 연결 없음.
- 사용자 실행 결과: 기존 안내 1~6 항목에 대해 “지금 다 되거든” 보고. 실제 YouTube에서 숨김·영상 수동 조작·댓글만 해제·전체 복원·재적용·이동 후 수동 해제/재적용을 정상 확인했다는 사용자 보고이며 AI 직접 관측/버전·영상·로그 수집은 아니다. 실제 BFCache 또는 자동 Core 재결속 PASS로 확대하지 않는다.
- 요청에 따라 시험 popup에 추천만 해제를 추가. 추천 claim만 해제하고 댓글 제한 유지, 반복 해제, 결과 목록에서 해제된 옵션 제거를 합성 시험으로 확인했다. 개별 해제 후 재적용은 전체 해제 후 가능하도록 명시한다. 제품 메시지 추가가 아니라 TEST 전용 명령이다.
- 최종 관련 자동: 설치 Chrome headless + Playwright의 watch-panels-browser.test.mjs 9/9 PASS, 실패/skip0. 모의 owner/sender, 합성 HTML, pagehide 이벤트 모사이며 실제 서비스/제품 MV3/Core 시험과 구분. 기존 Shorts 제품 코드 수정 없음. build-chrome-harness.mjs 실행 PASS, git diff --check PASS.
- 게시 전 관련 회귀 재실행: `node --test extension/content-tests/changes.test.mjs extension/content-tests/detection.test.mjs extension/content-tests/browser.test.mjs extension/content-tests/claim-ledger.test.mjs extension/content-tests/claim-ledger-browser.test.mjs extension/content-tests/watch-panels-browser.test.mjs` → 61/61 PASS, 실패/skip0 (기존33・공통 원장19・댓글/추천9). 환경은 위 Node24·설치 Chrome headless·Playwright이며 실제 서비스와 구분한다.
- 실행: 기존 bundled Node로 extension/content-tools/build-chrome-harness.mjs 실행 → extension/build/content-harness를 Chrome에 로드/갱신 → 일반 영상 새로고침 → 댓글·추천 적용 → 추천만 해제. 기대: 추천은 복원, 댓글은 계속 숨김; 전체 해제하면 댓글도 복원. 사용자 추가 결과: “문제 없는거 같아 다 되네”로 이 3단계 정상 보고. AI 직접 관측 결과가 아니며 개별 영상·브라우저 버전·실행 hash는 미수집.
- 게시: 사용자 지시로 댓글·추천 코드/시험/harness/이 기록 7개 파일만 별도 codex/content-watch-panels 브랜치로 제출. PR33은 미병합으로 확인되어 HEAD 040ac5b를 선행 의존성으로 보존하고 해당 브랜치에는 새 커밋을 Push하지 않는다. 통합 브랜치 대상 Draft PR의 전체 diff에는 미병합 PR33이 포함될 수 있으므로 040ac5b 이후의 비교 링크로 이번 변경만 리뷰한다. 실제 SHA/PR 번호는 GitHub 게시 결과가 원본이다.
- 실제 제품 연결·selector/profile 전체 수용·BFCache·재기동·Core/Server는 미검증. YT-10 다음 영상 자동재생, 홈 추천·종료 카드는 이번 변경에 포함하지 않는다. 정상 영상 재생/수동 조작은 유지한다. develop/통합 브랜치 병합 없음.

### 2026-10-30 · PR #33 리뷰 두 결함 수정

- 시작 HEAD: 96745bbe9c3559767bf08ac6e992dd4dd31fb50a. 담당 채지민, 기존 feature/additional-mvp-content 유지. 리뷰 스레드: https://github.com/kdu-sw-capstone/capstone-project/pull/33#discussion_r4421401391 및 https://github.com/kdu-sw-capstone/capstone-project/pull/33#discussion_r4421401400 .
- 흑백: 원래 inline filter 선언과 priority는 복원용으로 보존하고, 최초 적용/페이지 선언 변경 시 computed filter를 합성 기준으로 사용한다. CSS 변수의 none을 잘못 결합하지 않으며 실제 computed grayscale(1)을 확인하지 못하면 false와 cleanup 의무를 유지한다. 다른 claim 추가 때 자기 효과를 누적하지 않는다.
- 문서 경계: release 및 재적용 직전에 ownerDocument를 확인한다. adoptNode로 다른 문서에 이동한 요소는 수정하거나 복원 완료로 처리하지 않고 기존 claim과 오류를 유지한다. 단순 detached 요소의 기존 복원 동작은 보존한다. 문서 간 자동 승계/정리 완료를 구현한 것은 아니다.
- 수정 전: 설치 Chrome headless + Playwright 합성 DOM 신규 4건 중 CSS 변수 none 1건 및 adoption 2건 실패, 변수 brightness 대조군 1건 통과. 기존 브라우저 4건 포함 5/8 PASS, 3 FAIL로 두 결함 재현.
- 수정 후: 아래 기존 게시 범위 명령의 5개 파일 50/50 PASS, 실패/skip0. 이후 computed 확인 실패 및 복수 claim의 foreign-document 재조정 거절 단위 2건을 추가하고 claim-ledger.test.mjs 11/11 PASS, 실패/skip0 확인. 중복을 제외한 최종 관련 시험은 52건이며 52건을 한 명령으로 재실행했다고 기록하지 않는다. git diff --check PASS.
- 재현 명령: PLAYWRIGHT_MODULE과 CHROME_EXECUTABLE은 위 환경을 사용. `node --test extension/content-tests/changes.test.mjs extension/content-tests/detection.test.mjs extension/content-tests/browser.test.mjs extension/content-tests/claim-ledger.test.mjs extension/content-tests/claim-ledger-browser.test.mjs`, 추가 단위 확인 `node --test extension/content-tests/claim-ledger.test.mjs`.
- 게시 범위: claim-ledger.mjs, 해당 단위/브라우저 시험 2개와 이 작업 기록만. 기존 댓글·추천 adapter와 harness 미커밋 작업은 수정/게시하지 않는다. 실제 YouTube/Instagram·제품 MV3/Core/Server·실제 BFCache는 이번 검증 범위 밖이다. 추가 리뷰 대기, develop 및 통합 브랜치 병합 없음.

1. 같은 shared ledger에 별도 YT/IG option adapter와 per-option 관찰/해제 자원 연결.
2. issued registry·frozen attachment·native scope를 제공하는 Core simulator 경계에서 exact 결과 집합/실패/cleanup 연결. 공유 Wire를 임의 수정하지 않는다.
3. 실제 페이지별 selector/profile·동적 재등장·SPA/BFCache/미디어·실패 복원 검증. 운영 listener/주입·claim 영속화는 Core 담당과 승인 계약 기준으로 연결한다.
4. 검증 가능한 단위별 사용자 시험 후 feature/additional-mvp-content를 Push하고 integration/additional-mvp-20261029 대상 PR. develop 병합 없음.
