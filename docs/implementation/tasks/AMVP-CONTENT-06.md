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
### 2026-10-31 · YT-05 구독 숨기기 (사용자 시험 완료 / 승인 후 별도 PR 제출)

- 담당 채지민. clean ba4a7e2c2fe11e885431597b32ec738d313bbb87(PR40)에서 codex/content-subscriptions 로컬 브랜치로 시작. PR33/36/39/40 원격 HEAD·리뷰는 변경하지 않는다. 최신 통합 원격 코드를 반영했다고 주장하지 않는다.
- 기준: feature-registry.json YT-05/AC-YT-05-01~03, RC2 05의 구독취소 금지와 독립 claim/해제·03의 native/문서/영속 증거 경계. 구독 진입 entry와 /feed/subscriptions의 현재 browse 목록만 제한. 홈·검색·일반 watch는 구독 진입 링크만 대상으로 하고 stale subscriptions DOM은 가리지 않는다. 실제 계정/구독 관계·구독 버튼·Server API를 변경하지 않는다.
- 재사용: PR40 HomeSession의 문서/observer/target별 claim·동일 scope fencing·복원 흐름을 navigation-surface.mjs 내부 부품으로 분리. HomeSession 호출 API/기존 selector와 오류는 유지하고 홈9회귀로 확인했다. 새 subscriptions.mjs는 고정 YT-05 selector/route만 공급한다. 이 내부 selector profile은 승인된 Wire/capability/profile 계약이 아니다.
- 구독은 shared ClaimLedger와 feature별 scope를 사용해 홈 옵션/다른 owner와 독립 적용·해제. selector 이탈·페이지 style 보존·복원 실패/foreign document 의무 유지, URL/pagehide 시 신규 적용 중지 및 기존 cleanup 보존. OBSERVED/NO_TARGET/FAILED는 국소 DOM 관측, Core APPLIED/세션 성공이 아니다.
- 새 subscriptions-browser.test.mjs 9/9 PASS 및 추출 후 home-browser.test.mjs 9/9 PASS. Node24·설치 Chrome headless·Playwright 합성 DOM/모의 sender·pagehide 모사다. 실제 YouTube/제품 MV3·BFCache 수용 시험이 아니다. 계정 버튼 미클릭·검색/영상 보존·홈과 독립 해제·다중owner/퇴역객체·selector 재사용·부분 복원 목표 재시도·adoption 보호를 포함한다.
- 관련 전체 회귀: 기존33+최신 원장26+홈9+구독9 = 77/77 PASS, 실패/skip0. `node --test extension/content-tests/changes.test.mjs extension/content-tests/detection.test.mjs extension/content-tests/browser.test.mjs extension/content-tests/claim-ledger.test.mjs extension/content-tests/claim-ledger-browser.test.mjs extension/content-tests/home-browser.test.mjs extension/content-tests/subscriptions-browser.test.mjs` 실행. build-chrome-harness.mjs 및 git diff --check PASS. 다른 branch의 댓글/자동재생 후속 시험을 이번 실행에 포함하지 않는다.
- 기존 시험 build에 navigation-surface/subscriptions 복사 및 TEST_SUBSCRIPTIONS_APPLY/RELEASE/STATE 버튼만 추가. 홈+구독 시험판으로 갱신하며 다른 branch의 댓글/자동재생 제품 코드를 삭제한 변경이 아니다. 제품 권한/manifest·API/Wire/Schema 변경 없음.
- 사용자 시험 대기: 기존 시험 확장 갱신→홈 새로고침→구독 숨기기 적용 시 구독 메뉴 숨김/홈·검색 유지→해제하면 메뉴 복원. 주소창에 https://www.youtube.com/feed/subscriptions 입력→해제 후 다시 적용 시 구독 영상 목록 숨김→검색/직접 영상 정상→해제 후 구독 목록·계정의 구독 상태 유지. 홈과 구독을 함께 적용했다가 구독만 해제해도 홈 제한 유지 확인. 로그인/실제 구독 영상이 없는 경우 목록0은 정상 제한 증거가 아니다.
- 사용자 최초 실패: 화면에서 구독 제목/진입만 사라지고 왼쪽 구독한 채널 목록은 남는다고 보고. 해당 항목은 PASS가 아니다. 기존 selector가 /feed/subscriptions entry만 잡고 sibling channel 목록을 포함하지 않은 누락이다. 실제 DOM 구조를 직접 수집한 것은 아니며 첨부 화면과 같은 불변식의 합성 section 반례1건을 수정 전 FAIL로 확인했다.
- 보완: root 구독 URL로 식별한 guide section에서 구독/channel/feed-channels 링크만 있으면 해당 section 전체(채널·더보기 포함)를 제한한다. 다른 메뉴가 섞이면 section 전체를 숨기지 않고 구독/채널 entry만 제한한다. 화면 제목 문자열이나 페이지의 모든 channel 링크로 범위를 넓히지 않으며 account/검색/영상·외부 링크는 보존한다. URL/역할 변경 시 기존 차집합 cleanup을 재사용한다.
- 보완 후 홈9+구독10=19/19 PASS, 이후 혼합 메뉴·역할 재사용 보호 반례1/1 PASS. 두 실행은 합성 DOM이며 종전77 전체 PASS를 보완 후79 전체 실행으로 바꾸지 않는다. 새 구독 시험 구성은11건. build 재생성·diff 검사 PASS. 실제 사용자 재확인은 확장 갱신/YouTube 새로고침 후 구독 적용→제목·채널·더보기 숨김/홈·Shorts·내페이지 보존→해제 복원이며 대기 중이다.
- 최종 사용자 재확인: 보완된 시험판에서 안내6항목에 “테스트 다 정상이야” 회신. 홈의 구독 제목·채널·더보기 숨김, 다른 메뉴/검색 보존, 해제 복원, 직접 구독 페이지의 영상 목록 제한·복원 및 구독 상태 유지, 홈/구독 독립 해제를 정상 확인한 사용자 보고다. 위 대기 상태는 이 결과로 갱신하며 최초 누락 실패 근거는 보존한다. AI 직접 관측·실행 hash/Chrome 버전/원본 로그 수집은 아니며 실제 Core/자동 SPA·BFCache 재결속 완료로 확대하지 않는다. 이번 기록 변경에서 기능 시험을 다시 실행하지 않았다. Commit/Push/PR/병합은 아직 미실행이다.
- 게시 전 최종 실행: 위와 같은7개 시험 파일로 기존33+원장26+홈9+구독11 = 79/79 PASS, 실패/skip0을 한 명령에서 확인했다. 종전77 및19+1 실행과 구분하며, 위 사용자 결과 기록만 하던 단계 이후 새로 실행한 결과다. git diff --check PASS.
- 사용자 게시 승인으로 codex/content-subscriptions의9파일(구독 모듈/시험·navigation-surface·HomeSession 위임·harness4·이 카드)을 Commit/Push하고 통합 브랜치 대상 Draft PR 제출. 게시 시 PR33 a6468b6와 PR40 ba4a7e2는 미병합 확인. 선행 브랜치 HEAD는 변경하지 않고 ba4a7e2 이후 비교로 구독 단위만 리뷰하며 선행 통합 후 최종 diff를 확인한다. 실제 SHA/PR 번호는 GitHub 게시 결과가 원본이다. 병합 없음.
- 미검증: 실제 서비스 selector/profile 전체·로그인/언어/창너비, 제품 frozen/native/issued operation·영속 intent/receipt·Core/Server, 자동 SPA/BFCache 재결속·재시작. 인스타 요구 범위 답변 대기는 유지하고 다른 옵션은 확장하지 않는다. 로컬 검증·사용자 시험·승인 후 위 제출 단계만 진행하며 develop/통합 병합 없음.

### 2026-10-30 · YT-01 홈 숨기기 (사용자 시험 완료 / 별도 PR 제출)

- 담당 채지민. clean a6468b67d97ca32a1ab1ad1af66344f0a45e148e에서 별도 codex/content-home 브랜치로 시작. PR33 최신 부분 실패 복원 목표/pending 수정을 재사용한다. PR36/39 브랜치·코드와 기존 Shorts 제품 코드는 보존하고 홈 묶음7파일만 별도 제출한다. 선행 PR33과의 의존성 및 해당 SHA 이후 비교를 PR에 명시한다.
- 기준: feature-registry.json YT-01/AC-YT-01-01~03, 03_동작규칙.md 내부 제한, RC2 03/05의 owner·scope·실제 증거·복원. 일반 YouTube root HOME에서 홈 feed/진입 링크를 제한하고 검색·직접 watch 보존. 검색/watch에서도 홈 진입 링크만 숨길 수 있으나 현재 아닌 HOME DOM은 제어하지 않는다. 이번 지원 route는 /, /results, /watch top-frame이다.
- home.mjs는 실제 프로젝트 ClaimLedger를 사용하는 내부 모듈이다. HOME browse와 검증한 https YouTube root 링크를 가진 guide/mini-guide entry 및 masthead logo anchor만 제한한다. 검색 bar·검색 결과·구독·watch/video 전체는 숨기지 않는다. 페이지 문자열은 전송하지 않는다.
- 옵션별 target 집합·내부 claim 유지, selector 이탈 시 자기 claim 회수, 다중 owner/동일 scope fencing·퇴역 객체 차단, 부분 복원 실패·foreign-document 의무 보존, 동적 재등장/페이지 style 변경 관찰. URL 변경/pagehide 시 신규 적용을 닫고 기존 cleanup은 유지한다. 실제 Core 재결속/영속 원장이나 제품 Wire 수신기가 아니며 OBSERVED/NO_TARGET는 국소 관측이다.
- 기존 Chrome 시험 도구에 home 모듈/의존 UI 복사와 TEST_HOME_APPLY/RELEASE/STATE 버튼을 추가. 시험 manifest 이름/WAR만 보완, 제품 권한·manifest·Wire/API/Schema 변경 없음. 현재 빌드는 홈+기존 Shorts 시험 버튼이며 다른 후속 branch의 댓글/자동재생 버튼을 삭제한 제품 변경이 아니다.
- 새 home-browser.test.mjs 9/9 PASS, 실패/skip0: 홈 feed/entry/logo 제한·검색 보존, /results·/watch 보존, 다중 owner/동일 scope·퇴역 객체, 지연 target/자기 관찰 loop, href/subtype 이탈, 페이지 style, 부분 복원 실패/정확한 목표 재시도, adoption 의무 보존, SPA/pagehide 모사·미지원 host, TEST sender. Node24·설치 Chrome headless·Playwright의 합성 DOM 시험이며 실제 YouTube 수용이 아니다.
- 관련 회귀: 기존33+최신 원장26+홈9 = 68/68 PASS, 실패/skip0. `node --test extension/content-tests/changes.test.mjs extension/content-tests/detection.test.mjs extension/content-tests/browser.test.mjs extension/content-tests/claim-ledger.test.mjs extension/content-tests/claim-ledger-browser.test.mjs extension/content-tests/home-browser.test.mjs` 실행. build-chrome-harness.mjs 및 git diff --check PASS. 댓글/자동재생의 다른 브랜치 시험을 이번 결과에 포함하지 않는다.
- 사용자 실제 YouTube 보고: 안내6항목(홈 feed 숨김, 홈 메뉴·로고 링크 숨김, 검색 보존, 영상 재생·소리·수동 조작, 해제 후 HOME UI 복원, 재적용·해제)에 “니가 말한거 다돼” 및 “다 잘됐어”로 정상 확인. 실행은 기존 Node build 도구→시험 확장 갱신→홈 새로고침→적용/해제이며 이동 후 필요 시 해제/재적용. AI 직접 관측/영상·Chrome 버전·실행 hash 로그 수집은 아니며 서비스 전체 지원의 증거로 확대하지 않는다. NO_TARGET/FAILED는 성공이 아니다.
- 미검증: 실제 서비스 selector/profile 전체·로그인/언어/창 너비별 UI, Core frozen/native/issued operation·영속 intent/receipt, 자동 SPA/BFCache 재결속·재시작·Server. 사용자 승인으로 이번 변경만 Commit/Push 및 Draft PR 제출하며 실제 SHA/PR은 GitHub 게시 결과가 원본이다. develop/통합 브랜치 병합 없음. 다음 옵션은 시작하지 않는다.

### 2026-10-30 · PR33 부분 변경 후 복원 재시도 P2 (검증 완료 / 사용자 승인 후 제출)

- 담당 채지민, feature/additional-mvp-content, 시작 040ac5bde2a2f7297da13d8db9d9c540cd0e1ca0. 리뷰 discussion_r4423267282(종민) 및 discussion_r4423360787(다훈) 대조. 기존 codex/content-watch-panels와 codex/content-autoplay는 clean 상태에서 보존하고 PR33 브랜치로 전환했다. PR36/39에 수정 커밋을 전파하거나 병합하지 않는다.
- 원인: release setter가 일부 변경하고 실패한 뒤 원장에는 목표/pending 정보가 없어 중간 값을 페이지 편집으로 오인해 restored:true로 처리했다. 수정 전 신규 throw/readback 반례2/2 FAIL로 직접 재현했다.
- 수정: APPLY/RESTORE 쓰기 전에 목표 value+priority와 pending 종류를 보존한다. 예외·readback 불일치 시 목표와 claim을 유지하고, 다음 복원은 그 목표를 재시도/재확인한다. 실패 중간 값의 출처를 별도로 증명할 수 없으므로 자동으로 새 페이지 baseline으로 채택하지 않는다. 정상 완료된 적용 뒤의 페이지 변경 보존 경로는 유지한다.
- RESTORE pending이 있는 요소는 새 acquire/reapply를 false로 거절해 실패 원본/목표를 덮어쓰거나 owner를 추가하지 않는다. shared-owner 재적용 실패도 APPLY pending 목표를 유지해 원래 페이지 baseline을 잃지 않는다. foreign-document 검사와 suspend 후 cleanup 경계는 유지한다. 영속 Journal/Wire 상태나 새 공용 계약을 추가한 것은 아니다.
- 관련 시험: 단위16 + Chrome 합성 DOM10 + 기존33 = 59/59 PASS, 실패/skip0. 수정 전 두 반례 FAIL, 수정 후 동일 반례 PASS; 반복 실패/새 owner 거절/재시도, shared-owner 재조정의 throw·readback, filter 제거·inert 실패, 실제 CSS 엔진의 장애 setter 두 경로 및 기존 flex·다중owner·adoption 회귀 포함.
- 명령: Node24에서 `node --test extension/content-tests/claim-ledger.test.mjs extension/content-tests/claim-ledger-browser.test.mjs extension/content-tests/changes.test.mjs extension/content-tests/detection.test.mjs extension/content-tests/browser.test.mjs`. PLAYWRIGHT_MODULE은 bundled playwright, CHROME_EXECUTABLE은 설치 Windows Chrome, headless+합성 DOM/장애 주입이다. git diff --check PASS. 실제 YouTube/Instagram setter 장애나 제품 MV3/Core/Server/BFCache 수용 시험은 아니다.
- 변경: claim-ledger.mjs, 해당 단위·브라우저 시험, 이 기록4개 파일만. 사용자 승인으로 같은 PR33 브랜치에 Commit/Push 제출하며 새 HEAD는 GitHub 게시 결과가 원본. PR33 재리뷰와 Core 경계 재확인 전 PR36/39 통합 보류 유지. 사용자 반복 수동 정상 시험으로 이 setter 장애 주입 시험을 대체하지 않는다.

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

### 2026-10-31 · PR #42 P2 혼합 구독 영역 /feed/channels 누락 수정

- 담당 채지민. codex/content-subscriptions, 시작 HEAD 12096d0ca4b5dec087a08032568127085443689c. GitHub 리뷰 https://github.com/kdu-sw-capstone/capstone-project/pull/42#discussion_r4429928694 확인. 별도 content-subscriptions-review worktree에서 수정하여 codex/content-explore의 미커밋 탐색/SPA 작업과 원래 feature/content-control 작업을 보존했다.
- 원인: 순수 구독 section에서는 isSubscription이 /feed/channels를 포함했으나, 혼합 section fallback은 channelPath만 선택해 해당 entry가 제한되지 않았다. OBSERVED는 국소 관측이어도 지원 대상 누락은 결함이다.
- 수정 전: 기존 혼합 fixture에 /feed/channels entry를 추가한 회귀1건 FAIL(실제 visible=true, 기대=false). 설치 Chrome headless 합성 DOM이며 실제 YouTube 현행 화면 직접 관측이 아니다.
- 수정: 혼합 분기에서도 동일 isSubscription 분류를 재사용해 /feed/subscriptions·/feed/channels·채널 entry를 제한. guide/mini-guide entry 또는 해당 anchor만 선택하며 history/home/외부 링크가 섞인 section 전체는 숨기지 않는다. API/Wire/Core/frozen/native·공통 원장·탐색 구현 변경 없음.
- 추가 회귀: 순수 section→history/외부 링크가 섞인 혼합 section 전환, 구독 entry/채널/전체목록의 hidden+inert 유지, history/외부/본문 링크 보존, 다른 owner claim 보존과 마지막 해제 복원, 원래 display:flex 복원 확인.
- 수정 후 Node24·설치 Windows Chrome headless·Playwright 합성 DOM에서 구독12+홈9=21/21 PASS, 실패/skip0. 명령: PLAYWRIGHT_MODULE/CHROME_EXECUTABLE을 기존 경로로 설정 후 node --test extension/content-tests/subscriptions-browser.test.mjs extension/content-tests/home-browser.test.mjs . git diff --check PASS(줄바꿈 정규화 경고만). 기존79 전체·원격CI·실제 서비스/제품 Core·BFCache 수용을 재실행했다고 표시하지 않는다.
- 게시 범위: subscriptions.mjs, subscriptions-browser.test.mjs, 이 작업 기록3개만. 사용자 게시 수락 후 동일 PR42에 Commit/Push하고 새 HEAD로 재리뷰 요청. 탐색 미커밋 코드·다른 PR·develop/통합 브랜치 병합 제외. 다음은 다훈 독립 재리뷰이며 그동안 탐색 사용자 시험은 대기 상태로 보존한다.
### 2026-10-31 · YT-06 탐색 숨기기 — 로컬 구현 / 실제 사용자 확인 대기

- 담당 채지민, codex/content-explore, 시작 기준 12096d0ca4b5dec087a08032568127085443689c. 기존 PR33/36/39/40/42 및 다른 담당 코드·공유 계약은 변경하지 않는다. Commit/Push/병합 미실행.
- 기준: contracts/additional-mvp/rc1/feature-registry.json YT-06 및 AC-YT-06-01~03, docs/design/additional-mvp-contracts/05_Content_Event_UI.md. 기존 탐색/인기 진입·목록 제한과 검색 보존 목적을 유지한다. 사용자가 현재 메뉴 대응 구현을 허용했다. 팀 검토/최종 제품 수용 완료로 간주하지 않는다.
- 공개 비로그인 KR YouTube에서 확장 메뉴의 음악·영화·라이브 주소를 읽기 전용으로 관찰했다. 음악/라이브는 특정 channel ID, 영화는 storefront의 bp=ogUCKAU=이다. 이 관찰은 DOM 제한/복원 효과 검증이 아니다. 실제 목록의 page-subtype 일치 여부와 로그인/지역별 차이는 사용자 시험에서 확인해야 한다.
- explore-profile.mjs에 해당 exact 주소와 기존 /feed/explore·/feed/trending을 분리한다. 일반 channel·다른 storefront payload·외부 music.youtube.com은 대상이 아니다. 탐색 heading만 남는 경우 제목을 근거로 다른 메뉴까지 숨기지 않는다. 목록은 현재 대상 route에서 대응 page-subtype만 제한한다.
- explore.mjs가 기존 NavigationSurfaceSession과 ClaimLedger를 재사용한다. 옵션별 claim, 다중 owner, selector 이탈 회수, 실패 복원 의무, URL/pagehide 이후 신규 적용 중지·기존 cleanup을 유지한다. 주소 변경 후 재승인/제품 Core 결속은 구현하지 않는다. 시험판은 해제→재적용이 필요하다.
- 검증: Node24·설치 Chrome headless·Playwright 합성 DOM에서 탐색10/10 PASS. 관련 전체 89/89 PASS(기존33+원장26+홈9+구독11+탐색10), 실패/skip0. 실제 서비스·제품 MV3 sender/Core·SPA/BFCache 재결속 수용은 미검증. OBSERVED는 국소 DOM 관찰이며 제품 APPLIED가 아니다.
- 실행: PLAYWRIGHT_MODULE/CHROME_EXECUTABLE은 기존 위 경로 사용. node --test extension/content-tests/changes.test.mjs extension/content-tests/detection.test.mjs extension/content-tests/browser.test.mjs extension/content-tests/claim-ledger.test.mjs extension/content-tests/claim-ledger-browser.test.mjs extension/content-tests/home-browser.test.mjs extension/content-tests/subscriptions-browser.test.mjs extension/content-tests/explore-browser.test.mjs . build-chrome-harness.mjs 생성 성공.
- 사용자 확인: 시험 확장 갱신·홈 새로고침→탐색 적용→음악/영화/라이브 메뉴 숨김, 홈/구독/검색 유지→해제 복원. 각 대상 목록은 먼저 방문하고 해제→적용해 목록 숨김/해제 복원 확인. 일반 검색/영상/다른 채널·외부 YouTube Music 보존, 홈/구독과 독립 해제 확인. NO_TARGET/FAILED 또는 메뉴만 숨고 목록이 남으면 미통과로 보고한다.
- 다음 행동: 실제 YouTube 사용자 결과를 항목별로 기록하고 필요한 selector만 보완. 게시 범위 설명과 사용자 수락 후 별도 PR 제출. 다른 옵션 추가 개발은 이번 범위에 포함하지 않는다.

### 2026-10-31 · YT-06 다훈 의견 반영 보완 (로컬 / 사용자 재시험 대기)

- 기존 목적 유지·검색/일반영상/구독 보존 및 실제 탐색 영역 구분·SPA/복원 검증 요청을 수용했다. 위 최초 시험판의 '항상 이동 후 수동 재적용' 설명은 이번 탐색 시험판에서는 아래 방식으로 갱신한다. 홈/구독 옵션의 기존 이동 처리와 제품 Core 정책 계약은 그대로다.
- NavigationSurfaceSession의 YT-06에만 trusted caller의 동기 authorizeNavigation 명시적 승인을 받는 이동 경로를 추가했다. 기본값은 승인 없음이다. URL/event만으로 권한을 만들지 않는다. URL 변경 시 기존 claim 전부를 먼저 해제하고, 복원 실패면 ROUTE_CLEANUP_FAILED로 새 적용 중지·cleanup 의무 유지. 재승인 거절이면 기존 효과를 해제한 뒤 invalidation. pagehide/BFCache는 여전히 재승인 없이 복귀하지 않는다.
- 시험 bootstrap에만 모의 재승인을 제공했다. 제품 Worker의 실제 sender/document/navigation/frozen binding 검증 구현·연결은 아니며, 모의 시험의 성공을 제품 연결 완료로 기록하지 않는다. 같은 지원 문서의 SPA를 시험하며 새로고침/새 문서는 수동 적용이 필요하다.
- 탐색 목록은 hidden subtree 제외, 음악/라이브는 현재 route의 channel ID와 ytd-browse browse-id가 일치해야 제한한다. 같은 page-subtype의 오래된 다른 채널 DOM은 보존한다. browse-id 변경도 관찰해 target 이탈 시 기존 claim을 회수한다. 영화 storefront subtype의 실제 서비스 대응과 지역별 구조는 사용자 확인 대기다.
- 실행 검증: 기존 명령의 관련 회귀 92/92 PASS(탐색13 포함), 이후 DOM browse-id 역할 재사용 반례를 추가해 탐색 전용14/14 PASS. 실패/skip0. 합성 Chrome DOM·모의 재승인/실패 주입 결과이며 두 실행을 전체93건 단일 실행으로 표현하지 않는다. build-chrome-harness.mjs 재생성 성공, git diff --check PASS(줄바꿈 정규화 경고만). 기능 코드 최종 변경 이후 관련 회귀를 수행했고 마지막 추가는 시험1건뿐이다.
- 다음: 시험 확장 갱신 및 YouTube 새로고침. 탐색 적용/해제, 각 대상 목록 제한/복원, YouTube 로고/검색/영상/구독으로 SPA 이동 시 보존, 뒤로/앞으로 대상 재진입 시 제한 재적용을 사용자 확인한다. 메뉴만 제한되고 목록이 남는 경우 미통과이며 selector를 보완한다. 제품 Core/실제 BFCache·새 탭/새로고침 자동 재결속은 미검증이다. Commit/Push/PR/병합 미실행.

### 2026-10-31 · YT-06 사용자 실제 YouTube 시험 정상 보고

- 사용자가 안내한 탐색 시험 체크리스트에 대해 “테스트 다 정상이다”라고 회신했다. 탐색 메뉴 적용/해제, 음악·영화·라이브 목록 숨김/복원, 홈·검색·일반 영상·구독 보존, 지원 SPA 이동 및 뒤로/앞으로 재진입 제한, 마지막 해제 복원의 7항목을 정상 확인했다는 사용자 보고로 기록한다. 항목별 독립 로그·영상·Chrome 버전·실행 hash를 수집하거나 AI가 직접 관측한 결과는 아니다.
- 사용자가 기존 페이지에서 목록만 사라지고 주소/페이지 틀은 유지되는 동작을 확인·질문했고, 강제 이동이 아닌 DOM 숨김/복원이라는 시험 범위를 안내했다. 재생 정지나 전체 사이트 접근 차단을 검증한 결과로 확대하지 않는다.
- 시험 확장의 모의 SPA 재승인을 포함한 수동 결과이며 실제 제품 Core sender/document/navigation·frozen 정책 연결, 실제 BFCache 재결속, 새 문서/새로고침 자동 적용, 전체 언어·지역·레이아웃 수용은 미검증이다. 종전 자동92/92 및 탐색14/14와 구분한다. 이번 사용자 보고 기록에서 기능 시험을 새로 실행하지 않았다.
- 상태: 사용자 시험 대기 항목은 위 정상 보고로 갱신. 탐색 코드/도구/시험/기록은 여전히 codex/content-explore 로컬이며 Commit·Push·PR 생성·병합하지 않았다. 별도 PR42 구독 수정 4cf38ec1ae32db48dd0dc4a68b7adb18dce015f5는 별도 worktree에 보존되어 있고 이 브랜치에 아직 반영하지 않았다. 게시 전 선행 구독 수정 반영과 해당 영향 회귀, 최종 변경 범위 확인 후 사용자 수락을 받는다.

### 2026-10-31 · YT-06 게시 전 구독 수정 반영·최종 회귀

- 기존 탐색 미커밋 작업을 stash에 보관한 뒤 codex/content-explore 기준을 PR42 수정 HEAD 4cf38ec1ae32db48dd0dc4a68b7adb18dce015f5로 fast-forward하고 탐색 작업을 복원했다. 작업카드 append 충돌은 PR42 수정 기록과 YT06 기록을 모두 유지해 해결했다. 구독 코드/시험은 해당 커밋과 동일하며 구독 누락을 되돌리지 않는다. stash 원본은 안전 보관 중이다. 다른 작업공간 변경·develop/통합 브랜치 병합은 없다.
- 최종 관련 회귀: 기존33+원장26+홈9+구독12+탐색14 = 94/94 PASS, 실패/skip0. Node24/Playwright/설치 Windows Chrome headless 합성 DOM·모의 재승인/실패 주입. 위 전체 시험 명령8개 파일 재실행 결과다. 구독 수정 반영 후 build-chrome-harness.mjs 성공 및 git diff HEAD --check PASS, 충돌 마커 없음. 사용자7항목 정상 보고와 자동 시험·제품 미검증 경계는 위 기록 그대로다.
- 게시 단위: explore-profile.mjs/explore.mjs, 탐색 브라우저 시험, navigation-surface의 YT06 경로 및 browse-id 관찰, 시험 build/bootstrap/popup/manifest, 이 기록 총9파일. 제품 manifest 권한·Core/Server/API/Wire/Schema 변경 없음. testOnly/coreConnected:false·모의 재승인은 제품 권한 부여/연동 완료가 아니다. 새 함수는 trusted caller 전제의 내부 부품이며 실제 native/문서/owner·frozen 재검증 책임은 연결 단계에 남는다.
- 사용자 게시 준비 동의 후 codex/content-explore의 별도 Draft PR을 integration/additional-mvp-20261029 대상으로 제출한다. PR33→40→42 선행 의존성과 PR42 재리뷰 대기는 유지한다. 선행 PR의 기존 HEAD·리뷰는 수정하지 않는다. 변경 비교 기준은 위4cf38ec이다. 최종 Git SHA/PR 번호는 게시 결과를 따른다. 다음은 다훈의 탐색 영역/보존/복원 리뷰 및 종민의 재승인·cleanup 경계 리뷰, 실제 Core 연결은 후속이다. 전체 YT06 제품 수용 완료로 표시하지 않는다.

### 2026-10-31 · YT-07 상단바 숨기기 착수

- 담당 채지민, codex/content-masthead, 시작 기준 f18eba15abb232c6d3025d460b5bed2cb5a54d2a(PR44). 상태: 로컬 구현/시험 준비. 현재 clean 상태에서 기능별 브랜치로 분리했으며 다른 담당 작업/원격 PR HEAD는 변경하지 않는다.
- 기준: AGENTS.md, 개발운영.md, 통합현황.md, docs/design/00_문서안내.md 및 설계연결.json, AMVP-CONTRACT-20261029-RC2 feature-registry.json YT-07/AC-YT-07-01~03, 03_Wire_D06_복원.md/05_Content_Event_UI.md. PC 후속 확장 계획은 현재 Chrome 범위와 구분한다.
- 범위: desktop YouTube masthead와 내부 검색 포함 숨김/소유 claim 해제 복원. 브라우저 주소창·FOCURVE 종료/오류 UI·영상과 재생 조작 보존. 기존 NavigationSurfaceSession/ClaimLedger를 재사용하고 Core/Wire/frozen 정책 선택·제품 권한은 변경하지 않는다. 같은 문서 SPA의 내부 재승인 hook은 모의 시험에만 제공하고 제품 Core 재검증은 후속 연결이다.
- 이번 단위는 상단바만이며 종료카드/흑백/Instagram 추가 개발·Commit/Push/PR/병합은 아직 하지 않는다. 구현 후 합성 회귀와 사용자 실제 체크리스트로 확인한다.

### 2026-10-31 · YT-07 로컬 구현·자동 회귀 완료 / 사용자 시험 대기

- 코드: extension/content/masthead.mjs의 MastheadSession. desktop ytd-masthead 전체를 제한해 내부 검색·로고·계정 메뉴를 포함한다. 본문/검색 결과/구독 목록/영상·재생 조작은 수정하지 않고 검색 값·계정·미디어 상태를 변경하지 않는다. 주소창은 DOM 대상이 아니며 종료/오류 UI는 data-focurve-restriction/data-focurve-ui의 자기/상위/하위 보호 영역으로 구분한다. 보호 UI가 masthead 안에 들어오면 자기 claim을 회수하여 UI를 보존하고 국소 NO_TARGET을 반환한다. 이를 적용 성공으로 확정하지 않는다.
- 지원 route: 홈, watch, results, feed/subscriptions·explore·trending·storefront, playlist, shorts·channel·c·user·@handle 경로. HTTPS youtube.com/www·top-frame만 허용한다. /account 등 미지원 route와 iframe/외부 호스트는 효과 전 거절한다. 전체 YouTube 경로/모바일 레이아웃 지원 선언은 아니다.
- 기존 ClaimLedger/NavigationSurfaceSession 재사용. YT07 feature 등록, 기존 YT06의 명시적 동기 authorizeNavigation 재승인 경로를 YT07에도 허용하고 보호 marker 변경을 관찰한다. 다른 옵션의 default 이동 처리와 권한 의미는 유지한다. SPA 시 기존 claim 복원→승인된 새 route만 적용, cleanup 실패 시 새 적용 중지·목표/의무 유지. 기본 재승인 없음, pagehide/BFCache 복귀는 자동 재개 금지. 모의 시험에서만 callback을 제공한다.
- 시험 도구: 기존 TEST bootstrap에 TEST_MASTHEAD_APPLY/RELEASE/STATE, 같은 공유 ledger 사용, popup 버튼/안내·시험 표시 이름과 build 복사 목록만 추가. 제품 Core listener/native sender·issued registry·정책·Wire/API/Schema·제품 Manifest 권한을 변경하지 않았다. 실제 Core 검증/영속 cleanup·결과 envelope 연결은 미구현/미검증이다.
- 자동 결과: masthead-browser.test.mjs 12/12 PASS 후 관련 전체106/106 PASS(기존33+원장26+홈9+구독12+탐색14+상단바12), 실패/skip0. Node24·설치 Windows Chrome headless·Playwright 합성 DOM/모의 재승인·pagehide·setter 장애 주입이다. 영상 상태 미변경은 합성 video 속성 검사이며 실제 재생/소리 시험이 아니다. 다중owner·퇴역 scope·홈과 독립 해제·동적 재생성·FOCURVE UI 보호·부분 복원 실패/재시도·foreign document·권한 거절·iframe 보호를 포함한다.
- 명령: 기존 PLAYWRIGHT_MODULE/CHROME_EXECUTABLE 환경에서 node --test extension/content-tests/changes.test.mjs extension/content-tests/detection.test.mjs extension/content-tests/browser.test.mjs extension/content-tests/claim-ledger.test.mjs extension/content-tests/claim-ledger-browser.test.mjs extension/content-tests/home-browser.test.mjs extension/content-tests/subscriptions-browser.test.mjs extension/content-tests/explore-browser.test.mjs extension/content-tests/masthead-browser.test.mjs . Node --check masthead.mjs/bootstrap.js, build-chrome-harness.mjs, git diff --check PASS. 줄바꿈 정규화 경고만 있고 검사 실패는 없다.
- 변경8파일: masthead.mjs, masthead-browser.test.mjs, navigation-surface.mjs, build-chrome-harness.mjs, chrome-harness/bootstrap.js·popup.html·manifest.json 및 이 기록. 시작 SHA f18eba15abb232c6d3025d460b5bed2cb5a54d2a 유지. Commit/Push/PR/병합 없음. 기존 PR33/36/39/40/42/44는 변경하지 않았다.
- 사용자 실제 Chrome 대기: 기존 시험 확장 갱신→YouTube 새로고침→다른 시험 제한은 끈 상태로 popup 하단 상단바 적용. 홈 상단 로고/검색/계정 영역 숨김과 본문 보존, 해제 시 검색 입력 가능, 일반 watch 적용 시 영상/소리/재생조작 유지, 추천 영상 클릭 및 뒤로/앞으로 SPA 이동 후 상단바 제한 유지, 마지막 해제 복원을 확인한다. 브라우저 퍼즐/주소창/확장 popup의 해제 버튼은 계속 사용 가능해야 한다. NO_TARGET/FAILED·일부 검색만 남음·다른 영역 가림은 미통과로 보고한다. 새로고침/새 문서는 수동 재적용이다.
- 남은 경계: 사용자 실제 YouTube·전체 지역/언어·반응형 레이아웃·제품 Core/Server·영속화·실제 BFCache 재결속·새 탭/문서 자동 주입 미검증. local OBSERVED/native_verified:false를 Wire APPLIED·제품 완료로 표시하지 않는다. 다음은 사용자 결과와 필요한 selector 보완→게시 내용 설명/사용자 수락→별도 PR 리뷰이며, 이후 YT08 종료카드 및 YT09 흑백 연결은 별도 단위로 진행한다.

### 2026-10-31 · YT-07 사용자 시험 문제없음 보고

- 상단바 수동 체크리스트 안내 후 사용자가 “이건 뭐 딱히 테스트 할거도 없네 문제 없어”라고 회신했다. 사용자 실행에서 문제가 없었다는 포괄 정상 보고로 기록한다. 6개 항목별 결과를 별도 수집하거나 AI가 직접 관측한 것은 아니며 각 항목의 독립 PASS 증거로 바꾸지 않는다.
- 자동106/106은 위 합성 시험 결과이며 이번 기록에서 기능 시험을 재실행하지 않았다. 실제 Core/frozen/native 권한 연결·실제 BFCache 재결속·전체 레이아웃 검증 대기는 유지한다. 사용자 시험 대기는 위 보고로 갱신하고 제품 전체 검증완료로 표시하지 않는다.
- 상단바 코드·시험·시험 도구·기록 8파일은 로컬 미커밋 유지. 다음은 게시 범위 설명/사용자 수락 후 별도 PR 제출이며, 종료카드/흑백 추가 구현은 아직 시작하지 않는다.

### 2026-10-31 · YT-07 게시 승인·준비

- 사용자가 상단바 구현·시험·도구·기록 8파일을 별도 PR로 올리는 단계에 동의했다. codex/content-masthead에서 시작 기준 f18eba15abb232c6d3025d460b5bed2cb5a54d2a 유지. 게시 직전 PR44가 같은 HEAD의 open/미병합 상태이고 같은 상단바 head의 기존 PR이 없음을 확인했다.
- 별도 Draft PR 대상은 integration/additional-mvp-20261029. 선행 PR33→40→42→44 의존성과 기존 구독 수정 4cf38ec을 보존하며 기존 원격 PR의 HEAD·리뷰는 변경하지 않는다. 상단바만 비교할 기준은 시작 SHA이며 게시 결과의 SHA/PR 링크가 원본이다.
- 코드/의존성/시험 fixture 변경 없이 사용자 결과와 게시 기록만 추가했으므로 자동106/106을 재실행하지 않는다. git diff --check PASS. 이번 단계에서 제품 Core/실제 BFCache·전체 레이아웃 검증 완료로 표시하지 않는다. develop·통합 브랜치 병합/자동병합은 하지 않는다. 다음은 다훈의 상단바 범위/본문·UI 보존/복원 리뷰, 종민의 재승인·cleanup 경계 리뷰다.

### 2026-10-31 · PR36 최신 통합 2bf04f03 기준 충돌 해결

- 담당 채지민, codex/content-watch-panels, 시작 HEAD 4dd1a739cce1fa2928533e70db55444f179317b1. 별도 content-watch-integration worktree에서 작업해 codex/content-endcards의 미커밋 종료 카드 8파일과 원래 feature/content-control 변경을 보존했다. AGENTS/개발운영/통합현황/본 카드 및 RC2 Content 소유권·복원 기준에 따라 이번에는 기존 PR36 연결부만 조정한다.
- #43 Content 리뷰는 e903aff5df3b44895a101efc39af868e543e574f의 기존 Approve5720654982가 등록돼 있음을 다시 확인했다. HEAD가 동일해 검토/예약8건 실행을 중복하지 않았다. 기존 직접8/8과 미검증 경계는 기존 리뷰 그대로다.
- 최초 원격27e5754(PR42/44 병합)를 가져와 no-commit merge를 시작했으나 사용자 추가 지시로 최신2bf04f0325a9aaebfde888d60e385d9ce1c4ad14(PR45 병합)로 기준을 갱신했다. 최초 해결5파일은 ignored build 폴더에 별도 보존한 뒤 자기 worktree의 미완료 merge만 abort하고 새 기준으로 다시 조정했다. 제품/다른 작업자 미커밋 자료를 삭제하지 않았다.
- 충돌은 AMVP-CONTENT-06.md, build-chrome-harness.mjs, 시험 bootstrap.js/manifest.json/popup.html의5파일. 양측 기능/기록을 보존하고 최신 통합의 홈·구독·탐색·상단바 handlers/build 목록/권한/WAR에 댓글·추천 adapter와 버튼을 합쳤다. watchReady는 homeReady의 같은 ClaimLedger를 사용하도록 연결했다. 시험 이름은 Content 독립 검증, 기존0.1.1을 유지해 downgrade하지 않았다. 홈 안내가 탐색 모의 재승인 설명을 표시하던 복사 문구는 실제 홈 동작인 해제→재적용으로 바로잡았다.
- watch-panels.mjs는 기존4dd1a739와 동일, ClaimLedger와 그 시험 및 navigation-surface.mjs는 최신2bf04f03과 동일임을 git diff로 확인했다. 이전 복원 pending 수정·홈/구독/탐색/상단바 구현을 되돌리지 않았다. Core/Server/Web/계약에 최신 통합과 다른 변경은 없다.
- 추가 시험2건: 시험 handler들이 공유 원장6targets를 같이 사용하고 댓글·추천만 해제하면 나머지4targets 보존→최종0, 최신 pending 원장에서 댓글 setter 부분 변경+throw 시 최초 grid 목표로 재시도하고 중복 scope를 차단하는 경로. watch15/15 PASS. 모듈14개 build 사본과 원본 byte 동일, popup 고유 버튼20개, activeTab/WAR 보존 smoke PASS. Node --check bootstrap PASS. 기존 계약 legacy-boundary6/6 PASS.
- PR39 autoplay adapter/버튼은 양측 기준에 아직 없고 #36 통합 후 정리하라는 지시대로 가져오지 않았다. 기존 controller의 autoplay 코드는 그대로이며 #39 HEAD·리뷰는 변경하지 않는다. 종료 카드도 이번 PR에 섞지 않는다.
- 모든 시험은 Node24/설치 Windows Chrome headless/Playwright 합성 DOM·모의 sender·pagehide·장애 setter다. 실제 YouTube/제품 Core·frozen/native·실제 SPA/BFCache/소리·사용자 수용·영속 cleanup은 NOT_RUN. 시험 handler 공유 원장은 제품 권한 발급이 아니다. 전체 Content 회귀 실행 중이며 최종 결과를 아래에 추가한다. Commit/Push/PR 변경·develop/통합 브랜치 병합은 아직 하지 않았다. 다음은 검사 후 사용자 게시 수락→같은PR36 새 HEAD 제출→다훈·종민 재확인이다.

### 2026-10-31 · PR36 충돌 해결 최종 로컬 검사

- 최종 Content 회귀121/121 PASS, 실패/skip0 = 기존33+최신원장26+홈9+구독12+탐색14+상단바12+watch15. 별도 기존 계약6/6 PASS와 build smoke 결과를 합쳐 하나의 실행 건수로 표시하지 않는다. 실제 서비스/제품 MV3/Core/Server·실제 BFCache·실제 소리/재생 수용은 NOT_RUN.
- 명령: 기존 PLAYWRIGHT_MODULE/CHROME_EXECUTABLE Windows 경로를 설정 후 node --test --test-concurrency=2 extension/content-tests/changes.test.mjs extension/content-tests/detection.test.mjs extension/content-tests/browser.test.mjs extension/content-tests/claim-ledger.test.mjs extension/content-tests/claim-ledger-browser.test.mjs extension/content-tests/home-browser.test.mjs extension/content-tests/subscriptions-browser.test.mjs extension/content-tests/explore-browser.test.mjs extension/content-tests/masthead-browser.test.mjs extension/content-tests/watch-panels-browser.test.mjs . node --test contracts/additional-mvp/rc1/tests/legacy-boundary.test.mjs . build-chrome-harness.mjs 및 git diff --check PASS. 시험 동시성2는 로컬 리소스 부담을 줄이는 실행 옵션이며 검증 범위 축소가 아니다.
- 최신 통합2bf04f0325a9aaebfde888d60e385d9ce1c4ad14 대비 자체 diff는 원래 PR36의7파일로 한정됐다(기존 watch adapter/시험+공유시험도구4개+기록). watch adapter 제품 로직은4dd1a739 그대로, 공통 원장/홈/구독/탐색/상단바/Server/Core/계약은 최신통합 그대로다. 충돌5파일은 양측 기능/기록을 보존해 해결했고 기존 watch 시험에는 연결부 회귀2건만 추가했다.
- Commit/Push 전 상태: 로컬 merge 결과 검증완료이며 결과를 설명한 뒤 사용자 게시 수락을 받는다. 새 HEAD/원격 PR36 반영·최신SHA 담당승인은 아직 없고 이전리뷰를 새HEAD 승인으로 자동 승격하지 않는다. merge 부모는 기존PR36과 지정 최신2bf04f03이며 통합/develop 브랜치를 변경하지 않는다. #39는#36 실제 병합 이후 정리, 종료카드 사용자 시험은 원래 worktree에서 보존/대기다.

### 2026-10-31 · PR39 충돌 해결 착수 / 지정 통합25e7d115

- 담당 채지민, codex/content-autoplay, 시작 HEAD c70b837318612e8e26cbcc55a8f899c124f9f895. clean 작업 폴더에서 순차 전환해 기존 종료카드70e40d3와 다른 worktree 미커밋을 보존한다. 사용자 지시에 따라 PR39를 먼저 정리하고 PR47은 이 결과 뒤에 조정한다. 통합/develop에 직접 병합하지 않는다.
- 기준 AGENTS/개발운영/통합현황/본 카드 및 RC2 YT10·소유권/복원. 지정통합25e7d1157cf0ded1bd38ab24a040b1169c1afa8b을 개발 브랜치에 no-commit merge했다. 원격에는 후속 PR43 병합 dfa787f도 있지만 두 통합 사이 Content/시험/도구/package 차이가 없으므로 사용자 지정25e 기준을 유지한다.
- 실제충돌3파일은 build-chrome-harness.mjs/bootstrap.js/popup.html. 최신홈·구독·탐색·상단바·댓글/추천 모듈복사/버튼/handlers에 자동재생만 합친다. autoplayReady는 homeReady가 제공하는 기존 공용 ledger를 사용한다. 기존 WatchPanelSession/AutoplaySession·ClaimLedger와 이전복원 수정·권한/WAR·Server/Core/계약은 변경하지 않는다.
- 다음은 자동재생/공유harness 집중회귀·Content 전체 회귀/빌드→게시 범위 설명/사용자 승인→같은 PR39 새HEAD 제출. PR47은 정리된39를 선행 의존성으로 반영하고 종료카드만의 비교를 제공해 #39→#47 순서 통합이 가능하게 한다. 두 PR이 동시에 같은 공유 파일을 수정하도록 병렬 작업하지 않는다. #47 실제 제품 logic/기존 정상 보고는 보존한다.

### 2026-10-31 · PR39 충돌 해결 검증·게시 준비

- 지정25e7d115 대비 자체6파일만 남았다: autoplay.mjs/시험, build/bootstrap/popup, 본 기록. adapter는 기존c70b837과 byte 동일이고 최신 ClaimLedger/watch/nav 및 Core/Server/계약은25e와 동일함을 git diff로 확인했다. manifest/권한/WAR를 변경하지 않았다. 공유파일3충돌을 해결해 기존 기능·고유23버튼·handlers를 모두 보존했다.
- Node24·설치 Chrome headless·Playwright 합성 DOM 전체131/131 PASS, 실패/skip0 = 기존33+원장26+홈9+구독12+탐색14+상단바12+watch15+autoplay10. 시험 handler의 자동재생만 해제해도 나머지6 DOM 제한을 보존하는 회귀1건을 추가했다. 별도 legacy-boundary6/6 PASS. build smoke15모듈 byte동일·23고유버튼·activeTab 보존, 구문/diff 검사 PASS.
- 명령: 기존 PLAYWRIGHT_MODULE/CHROME_EXECUTABLE 설정 후 node --test --test-concurrency=2 extension/content-tests/changes.test.mjs extension/content-tests/detection.test.mjs extension/content-tests/browser.test.mjs extension/content-tests/claim-ledger.test.mjs extension/content-tests/claim-ledger-browser.test.mjs extension/content-tests/home-browser.test.mjs extension/content-tests/subscriptions-browser.test.mjs extension/content-tests/explore-browser.test.mjs extension/content-tests/masthead-browser.test.mjs extension/content-tests/watch-panels-browser.test.mjs extension/content-tests/autoplay-browser.test.mjs . node --test contracts/additional-mvp/rc1/tests/legacy-boundary.test.mjs . node extension/content-tools/build-chrome-harness.mjs .
- 실제 YouTube/제품 Core·native/frozen·실제 SPA/BFCache/재시작/소리 수용은 이번 충돌 조정에서 NOT_RUN. 기존 사용자 정상 보고는 과거 근거다. 새 API/효과/권한을 구현한 것이 아니며 local OBSERVED/readback을 전체 실행 성공으로 승격하지 않는다.
- 사용자 요청대로 검사 결과·게시6파일을 설명하고 승인 후 같은 PR39에 Commit/Push, 새 HEAD의 연결부/소유권 검토를 받는다. 통합/develop 직접 병합·자동병합은 하지 않는다. 이후 PR47에는 해당39 HEAD를 선행 기준으로 반영해 상대 비교8파일을 제공하고39 이후 통합하도록 유지한다. 게시 SHA/PR 메타데이터는 실제 GitHub 결과가 원본이다.
