# AMVP-CONTENT-06 · 추가 Content 연결

## 2026-10-31 PR #58 P2 · scan 중 취소와 재진입 cleanup

- 수정 기준 `a257ce15118c29e8226a53273a5a7eaae29546cc`, 기존 `feature/content-session-adapter` Worktree clean/원격 HEAD 일치 확인 후 같은 브랜치에서 작업. 리뷰4431697837의 P2 범위만 수정한다. #54/#56/#57 원본 SHA 및 다른 Worktree를 보존하고 Draft 해제/Approve/Resolve/Merge하지 않는다.
- 원인: canObserve는 scan 입구에서만 검사했다. 첫 target setter/click이 invalidate를 동기 호출해도 기존 반복이 다음 target을 처리했다. invalidate가 scan을 재귀 호출했고, 그 안에서 즉시 release하면 기존 scan이 끝나기 전에 restored=true/adapter released=true를 확정했다. 바깥 scan이 뒤에 만든 claim을 재시도에서 건너뛰었다. 정확한 독립8반례를 재사용해 **수정 전6 PASS/2 FAIL** 재현(추가 쓰기1회; 즉시release 후 ledger1/adapter pending=false/재시도후 ledger1).
- adapter.invalidate는 guarded scan 재호출 대신 Session.stop을 동기로 호출한다. stop은 open/observer만 닫고 원래 claim/cleanup을 삭제하지 않는다. releaseFeature 요청은 즉시 closing으로 표시해 active=false가 되며 restored=true이고 cleanup_pending이 아닌 실제 결과에만 released를 확정한다.
- NavigationSurfaceSession/WatchPanelSession/AutoplaySession은 scan과 release를 #busy로 서로 재진입하지 못하게 한다. scan/복원 setter/click이 진행 중이면 release는 **restored:false, cleanup_pending:true, scan_pending:true**를 반환한다. Watch는 해당 feature의 closing fence를 즉시 세우고, 다른 feature가 열려 있으면 계속 관찰한다. 마지막 feature도 closing이면 즉시 observer를 끊는다. adapter 전체 취소가 다른 owner의 ledger를 suspend하지는 않는다.
- 이 synchronous API는 진행 중인 stack 안에서 복원을 완료했다고 가장하지 않는다. caller는 stack 종료 후 release/releaseFeature를 다시 호출하여 실제 잔여 claim을 회수해야 한다. 자동 백그라운드 복원·Server ACK는 추가하지 않는다. busy 응답의 remaining_targets=0도 완료가 아니며 cleanup_pending/scan_pending을 함께 봐야 한다. 실제 setter/cleanup 실패는 원래 immutable 복원 목표와 singleton 의무를 유지한다. Core의 UNKNOWN/미해소 상태를 이 국소 결과로 해소하지 않는다.
- 각 target 직전 canObserve/open/document/URL/feature-active fence를 재검사한다. ClaimLedger.hide/grayscale의 선택적 내부 canApply 콜백은 실제 각 display/inert/filter 쓰기 직전·setter 반환 후에도 검사한다. 계획된 claim/pending APPLY는 쓰기 전에 보존하고 취소 후 다음 property/target을 적용하지 않는다. ledger 자체도 acquire/release 중 재진입을 pending/false로 거절하여 진행 중 entry를 먼저 지우지 못한다. 기존 기본 호출 형태·다른 owner claim/restore 목표는 유지한다.
- autoplay는 click 직전·직후 current fence를 검사하여 첫 click의 pagehide/SPA/권한 회수 뒤 두 번째 OFF click을 막는다. IG는 실제 pause 직전·직후 current fence와 stop을 재확인해 pause callback 이후 다음 media를 멈추지 않는다. IG replay guard의 pause 중 release도 busy pending으로 남긴다. pagehide/새 문서/SPA를 새 권한으로 보지 않고 Server APPLIED/RELEASED를 생성하지 않는다.
- 기존 exact 독립8건 **수정 후8/8 PASS**. 두 실패 반례 모두 추가 쓰기0, 닫힌 adapter pending=true/ledger1을 유지하며 후속release 후 ledger0/pending=false. 최종 focused는 ClaimLedger17 + adapter31 = **48/48 PASS**. 신규 반례는 setter 중 revoke·즉시 release(Watch/Navigation/IG/Grayscale), 첫 display 후 inert 차단, 부분 복원실패와 실제 retry/다른 owner 보존, feature만 종료, DOM override 없는 autoplay click/pagehide·SPA·authority, IG pause/pagehide 및 ledger 직접 재진입 해제다.
- 수정 중 Content 전체 **213/213 PASS**(기존200+신규13). 이후 feature-closing 관찰 표시/마지막 Watch observer 종료와 grayscale2시험을 보강한 최종 소스는 focused48/48로 확인했다. 최종 전체215건은 새 CI 결과로 별도 기록하며 수정 전200 CI를 새 HEAD 검증으로 사용하지 않는다. 계약6/6, Content/test 전체 JS구문, build-chrome-harness, diff check PASS. 최종 CI 상태·새 SHA는 #58 설명을 확인한다.
- 환경은 Windows Node24.19.0 + 설치 Chrome156.0.8078.76/Playwright1.62.1 합성 route.fulfill DOM 및 독립 Node/jsdom27.4.0이다. 신규 Chrome 반례12개를 구HEAD archive에 실행하면1PASS/11FAIL이고 수정 focused에서 통과했다(뒤에 추가한 grayscale2건은 이 수정 전 실행에 포함하지 않음). 원본 실패 로그는 보존: 채팅 artifact 루트 pr58-p2-before.log, pr58-p2-after-final.log, pr58-p2-browser-before.log, pr58-p2-focused-final.log, pr58-p2-content-regression.log, pr58-p2-contract.log.
- 재리뷰 범위: ClaimLedger property 쓰기/재진입 보호, Navigation/Watch/Autoplay scan·release·closing, IG media/replay callback, adapter stop/released 확정과 관련 시험. Core issued/frozen/native·generation 검증/효과 전 영속 예약·cleanup lease/prior footprint 결속은 이전과 동일하게 미연결이다. 실제 Chrome 제품·Core·Native·Server·오디오·정상 END/복원/재기동 수용 **NOT_RUN**, `MVP_FINAL_COMPLETE=false`.

## 2026-10-31 Content 대체 개발 2단계 · Session adapter 준비

- 대체 개발 김다훈, 기존 담당 채지민 유지. 브랜치 `feature/content-session-adapter`, 시작 `02a653fb60e671dcf997951b220708ea146b4a7a`(#57). #54→#56→#57 위에 별도 Worktree/PR로 쌓으며 해당 원본 브랜치·미커밋 변경을 수정/병합하지 않는다. 앱 create_worktree가 workspace 하위 저장소를 sourceRoot로 허용하지 않아 기존 Git 저장소의 `git worktree add`를 사용했다. #55의 DNR 통합을 이 Content 브랜치에 다시 merge하지 않는다.
- 기준 재사용: RC2 `05_Content_Event_UI.md` 공통 ON/OFF, AMVP_CONTENT_2 Projection.features·issued scope/generation/profile/scan·prior footprint 검증, feature-registry의 해당 AC. 이 adapter는 기존 Session의 `{feature_id, enabled, required:true}` 입력 형태만 소비하는 내부 구현이며 새 Wire/Server 계약이 아니다.
- 실제 확인: InstagramStoriesSession은 HOME/STORIES의 대상 판별·중립 경로 관찰·동기 SPA 재승인·pagehide 종료·원래 CSS/다중 owner 복원을 이미 구현했다. #57의 alt/draggable 수정을 다시 구현하지 않았다. 미검증은 실제 Instagram DOM/소리·BFCache 재결속·Core 권한/영속 증거 연결이다. 기존 제품 `member-a1/content.mjs`의 A1Content/control scope/commit 경로는 Shorts 전용이며 추가16옵션 receiver로 일반화돼 있지 않다. 기존 controller/test bootstrap도 제품 권한 발급자가 아니다.
- 구현 `extension/content/session-adapter.mjs`: 기존 ClaimLedger, Home/Subscriptions/Explore/Masthead/EndCards/Grayscale/Autoplay/WatchPanel/InstagramStoriesSession 재사용. YT-01,03~10 및 IG-01만 지원한다. YT-02는 기존 Shorts 경로를 보존하고 IG-02~06·KEYWORD/BLUR/ADULT_DOMAIN을 구현했다고 광고하지 않는다. 미지원·중복·잘못된 옵션과 타 host는 DOM 변경 전에 거절한다.
- features는 생성 시 복사·동결한다. 같은 document의 adapter들은 단일 ledger를 사용하고 owner_binding_id+binding_id의 live scope를 중복 생성하지 못한다. 첫 adapter 생성 시 기존 canonical ledger를 주입할 수 있지만, 같은 document에서 나중에 다른 ledger로 갈아끼울 수 없다. Session 밖의 기존 기능과 함께 쓸 때 caller도 그 canonical ledger를 일관되게 재사용해야 한다.
- 기존 NavigationSurfaceSession/WatchPanelSession/AutoplaySession에 선택적 내부 `canObserve` 동기 hook을 추가했다. 기존 호출자는 기본 동작을 유지하며 adapter는 필수 `isCurrent` 검사를 매 scan 전에 호출한다. Instagram play guard도 실제 pause 전 이 검사를 사용한다. false/throw/Promise는 새 효과를 허용하지 않는다. hook은 native 권한 검증의 구현이 아니라 이미 검증된 Core 문맥을 확인하기 위한 접점이다.
- 한 Session의 invalidation은 같은 adapter의 모든 새 효과를 닫고, 기존 claim은 cleanup을 위해 남긴다. pagehide 후 pageshow/콜백 true만으로 자동 재개하지 않는다. 새 document는 새 adapter와 새 검증 문맥이 필요하다. 시작 중 후속 Session 실패 시 이미 시작한 기능을 복원하며 startup_error와 미해결 pending_features를 반환한다. 복원 실패는 기존 원장의 재시도 목표를 유지하고 동일 scope 교체를 차단한다.
- `releaseFeature(id)`는 자기 기능만 해제하고 다른 기능/owner를 보존한다. `release()`는 모든 자기 Session의 cleanup을 시도한다. 반환은 항상 local_only/native_verified:false이며 성공 Wire/Receipt/Server 기록을 만들지 않는다. inspect의 scope는 기존 두 claim ID만 담고, feature별 observation/cleanup/active, closed/invalidation_reason/startup_error/callback_error_count를 복사해 반환한다. closed=true의 과거 OBSERVED는 현재 적용 성공 증거가 아니다. 외부 callback 실패는 별도 count로 남기며 복원을 방해하지 않는다.
- cleanup_pending/pending_features는 아직 release가 검증되지 않은 Session의 **보수적인 의무 집합**이다. 실제 remaining claim 수·영속 cleanup 원장·전체 RELEASED를 대체하지 않는다. no-target인 live Session도 release 전에는 여기에 포함된다. release 결과의 remaining_targets=null은 예외로 관찰 부족이며 0으로 바꾸지 않는다. prior footprint/영속 결과 검증은 Core가 별도 수행해야 한다.

### Core 연결의 정확한 입력·출력·책임 경계

| 접점 | 내부 adapter 동작 | Core/제품 caller의 미완료 책임 |
|---|---|---|
| constructor(document, options) | owner_binding_id/binding_id와 features를 복사하고 지원 기능 검사 | AMVP_CONTENT_2의 실제 Projection.features 원본·mirror·semantic hash/profile·발급 operation 검증, 두 claim ID의 정당한 매핑 |
| isCurrent(): boolean | start/매 scan/IG play 전 동기 true만 수락 | 검증된 owner/session/full document scope·generation·권한 회수·issued operation·effect 전 영속 의무와 연결된 현재 상태를 closure로 제공. 여기서 비동기 인증/DB를 기다리지 않음 |
| authorizeNavigation({previous_url,next_url}) | 기존 Session이 요구하는 승인에 더해 전후 isCurrent 검사 | Core가 native URL/document/generation을 재검증한 뒤만 동기 true 제공. 미완료면 false/미제공. 이벤트/URL 자체로 승인하지 않음 |
| onObservation(local snapshot) | 기능별 국소 결과와 binding ID 전달 | 실제 profile/scan/issued operation/요청/epoch/hash 결속, 영속화 및 조회·전송. OBSERVED를 APPLIED로 직접 변환 금지 |
| invalidate(reason) / releaseFeature(id) / release() | 기존 document 신규 효과 종료·원래 자기 cleanup 결과/미해결 기능 반환 | 신원/세대 회수 시 즉시 invalidate 호출, 정당한 cleanup lease와 prior footprint 검증·remaining claim/observer/resource/media 증거 저장. callback false 감지는 다음 scan 또는 IG play 때이므로 조용한 문서는 caller가 명시적으로 invalidate해야 함 |
| 새 문서/SPA/BFCache | 이전 adapter 자동 재개 금지, 잔여 의무 보존 | 이전 document 의무 정리 또는 정식 분리 보존, 새 native 검증·새 binding/issued operation·frozen 전달. 이 PR에서 sender/credential receiver나 권한 발급/영속 저장을 새로 구현하지 않음 |

- 신규 Chrome 합성 DOM 시험17/17 PASS(Windows Node24.19.0 / 설치 Chrome156.0.8078.76 / Playwright1.62.1). frozen copy·전체9개 YT dispatch/disabled·독립 해제/다중 owner·stale adapter·caller session/generation/document 변경·SPA 승인/거절·pagehide/pageshow·신규 문서·부분 복원/재시도·foreign document·시작 실패 rollback/실패 의무·callback 오류·다른 ledger 거절 포함. 권한/세대 provider와 media.pause/paused는 모의이며 실제 native generation/오디오 수용이 아니다.
- 기존 Content 포함 직전 전체199/199 PASS(기존183+신규16, fail/skip0). 이후 adapter 출력 metadata/동일 document ledger 검사와 시험1건을 보강해 최종 신규17/17 PASS; 기존183 Session 경로는 그 후 변경하지 않아 검증 재사용. 최종 전체200건은 새 CI에서 확인하며 로컬200 재실행으로 주장하지 않는다. 계약 legacy-boundary6/6, 전체 Content/test JS 문법, build-chrome-harness 및 diff check PASS. harness에 모듈을 복사하지만 popup/제품 Manifest/receiver에 연결하지 않는다. source/build adapter SHA256 일치.
- 최초 신규12건 실패는 신규 adapter UUID 정규식에서 한 그룹을 누락한 코드 오류로 바로잡았다. 다음11/12의 나머지1건은 지원되는 /results+YT05를 실패 조건으로 쓴 fixture 오류이며 실제 미지원 /results+YT10으로 변경하고 실패 rollback 반례를 보강했다. 로그를 지우지 않는다. 증거는 채팅 artifact 루트의 adapter-focused.log, adapter-focused-v2.log, adapter-focused-v3.log, adapter-focused-final.log, adapter-content-regression.log, adapter-contract.log.
- 기존 CI에는 Content 브라우저 시험이 없어 `.github/workflows/content-sessions.yml`을 추가했다. 고정 Node/Playwright·독립 Ubuntu Chromium에서 Content 전체/계약/빌드/구문을 검사한다. 최초 Push/PR 전 원격 CI는 NOT_RUN이며 결과는 PR에서 별도 확인한다. 기존 계약·package/lockfile·Core/Server·제품 activation은 변경하지 않는다.
- 다음 최소 독립 개발: 제품 receiver를 임의 확장하기 전에 Core의 실제 issued/frozen/native·generation callback 제공과 effect 전 영속 예약/cleanup lease 연결을 담당 윤종민과 확정한다. Content는 이 API를 실제 명령에 매핑하고 결과를 기존 검증기에 제출할 준비가 됐지만, 현재 이 독립 adapter가 native/Core/Server에 연결됐다고 판단하지 않는다. 채지민 복귀 시 기존 Session·모의 경계 시험·미해결 실제 Instagram/YouTube/오디오·BFCache/END 복원 의무를 이 절과 PR에서 인계한다.
- 상태: 독립 adapter 구현/자동 모의 검증 PASS, 제품 Core 연결 BLOCKED(실제 입력 제공/영속 결속 필요), 실제 Chrome/MV3/Instagram·YouTube 제품 수용/강제 종료/정상 END·복원·재기동 NOT_RUN. `MVP_FINAL_COMPLETE=false`.

## 2026-10-31 IG-01 · PR #56 P2 속성 관찰 수정

- 대체 개발 김다훈, 기존 담당 채지민 유지. 브랜치 `fix/ig-story-attribute-observer-p2`, 시작 기준 #56 `08730c86d91d0b1d3790bc5fafc7a7ca9195ece8`. 로컬 주 저장소 Worktree/브랜치 및 사용자 홈의 navigation-surface 소스 검색에서 인계된 미커밋 수정본은 찾지 못했다. 기존 독립 리뷰 fixture/실패 로그는 회수했고, 사용자 허용 범위대로 정확한 #56 HEAD에서 별도 Worktree로 최소 수정 복구. 앱 Worktree 생성기는 sourceRoot가 채팅 workspace 밖이라는 이유로 거절하여 Git worktree를 사용했다. 기존 작업자의 소스/index/실패 환경은 보존했다.
- 근거: #56 리뷰 `5722451404` / inline `4431482803`, RC2 `docs/design/additional-mvp-contracts/05_Content_Event_UI.md` 공통 ON/OFF 및 feature-registry AC-IG-01-01~03. 관찰 누락만 수정하며 계약의 제품 수용 상태는 변경하지 않는다.
- 코드: `navigation-surface.mjs` IG-01 전용 attributeFilter에 `alt`, `draggable` 추가. YouTube 관찰 목록/ClaimLedger/제품 receiver/Manifest/Core/Server는 변경하지 않는다.
- 신규 브라우저 회귀 2건은 각 속성의 늦은 적격 전환→제한→이탈→복원→재진입→다른 owner 공존 중 이탈을 수동 scan 없이 확인한다. 자기 remaining_targets=0, 다른 owner의 숨김 유지, 마지막 owner 해제 후 원래 `display:flex!important` 복원을 검사한다.
- 환경: Windows Node24.19.0 / Playwright1.62.1 / 설치 Google Chrome156.0.8078.76 headless. 기존 harness의 임시 브라우저 context와 전 요청 route.fulfill 합성 DOM만 사용했다. Instagram 네트워크/로그인·HOLD Chrome PID/프로필·Native·서비스·DB를 사용하지 않았다. 브라우저 설치/다운로드 불필요.
- 변경 전 정확한 #56 소스에서 신규 브라우저 2건 **0 PASS / 2 FAIL**(속성만 바꾼 후 숨김 미발생 timeout). 수정 후 같은 2건 **2/2 PASS**. 기존 독립 jsdom6 반례도 원본 **4 PASS / 2 FAIL**(늦은 적격 전환, selector 이탈 미복원)→수정 **6/6 PASS**. 기존 실패 로그는 보존했다.
- 새로 실행: `node --test --test-concurrency=2 extension/content-tests/*.test.mjs` **183/183 PASS**, fail/skip0. IG23(기존21+신규2), YouTube·ClaimLedger/다중 owner·동적 DOM/SPA·pagehide/foreign document·복원 실패/cleanup 포함. 신규2 단독 결과와 합산하지 않는다. `node --test contracts/additional-mvp/rc1/tests/legacy-boundary.test.mjs` **6/6 PASS**. 변경 JS2파일 `node --check`, `git diff --check`, `node extension/content-tools/build-chrome-harness.mjs` PASS. 빌드된 navigation-surface와 소스 SHA256 일치 `cb027db9b5d587aa62199e944efb780cf8a7a5b04272dea5e2885f64d5c662d1`.
- 로컬 실행 증거는 이번 채팅 artifact 루트의 `p2-before-browser.log`, `p2-after-browser.log`, `independent-before.log`, `independent-after.log`, `content-regression.log`, `contract-regression.log`에 보존. 합성 브라우저 DOM/CSS 및 모의 media 시험이며 실제 Instagram 제품 수용으로 승격하지 않는다.
- Git 반영: 검증된 이3파일만 한 수정 Commit/별도 브랜치 Push 후 #56 브랜치 `codex/content-instagram-stories`를 base로 한 별도 수정 PR을 제출한다. #56 원본 브랜치에 직접 Commit/Push하지 않는다. #54(`670647f`)→#56(`08730c8`)→P2 수정의 순차 의존성 유지. 이 수정 PR을 integration에 독립 병합하면 선행 기능까지 섞이므로 금지. #54 승인/병합, #56 담당 반영/새 HEAD 재검토 및 통합은 별도 절차이며 이번에 Merge/리뷰 대리 승인하지 않는다.
- 상태: P2 구현·합성 자동 검증 PASS / 제품 통합·최종 수용 NOT_RUN. 실제 Instagram·Core/Native·BFCache 재결속·정상 END/재기동·영속 effect/cleanup 증거는 미검증. `MVP_FINAL_COMPLETE=false`.
- 복귀 인계/다음 최소 작업: 채지민은 이 수정 Commit을 #56에 반영하고 변경된 관찰 경계만 재검토받는다. 이후 별도 요청에서 승인된 Core frozen/document-generation 계약에 맞춘 Content adapter와 실제 관찰/release/남은 cleanup 반환을 진행한다. Instagram 추가 옵션·YouTube 추가 개발은 이 수정 PR에 포함하지 않는다.

## 2026-10-31 IG-01 스토리 · 첫 Instagram 독립 단위

### 최신 제출 상태 · 실제 사용자 재시험 확인

- 최종 nav-3 수정본에서 사용자가 이동 후 정상 동작을 보고했고, 이어 해제 후 화면 복원·직접 재생도 "ㅇㅇ 잘되는데"라고 확인했다. 홈 트레이 숨김/복원·일반 게시물/추천/메시지 보존과 직접 viewer 정지/재생 guard/해제/X 닫기는 앞선 사용자 보고와 구분해 근거로 보존한다. 계정·모든 DOM/지역/브라우저 변형 검증이나 실제 Core/Server 통합 완료로 확대하지 않는다. 아래 대기/실패/미커밋 표기는 각 개발 시점 이력이며 이 절이 최신 사용자 확인 상태다.
- 사용자 요청: 여러 실제 실패가 있었으므로 리뷰에서 꼼꼼히 확인할 코멘트를 명시해 게시한다. 필수 재검토: href 없는 홈 트레이, 깊게 중첩된 사진/영상 viewer·일반 게시물/DM 제외, HOME→프로필/중간경로→STORIES→다른사람STORIES의 연속성, 재생/소리 및 해제 후 수동 재생, 다른 owner·실패/부분 복원·adoptNode, 무승인/로그인/BFCache의 fail-closed 유지. 합성 PASS만으로 승인하지 말고 실제 구조/사용자 반례와 수용 한계를 함께 검토한다.
- 게시 후보 자체8파일(IG adapter/시험, 공유 navigation, 시험 build/bootstrap/manifest/popup, 작업카드). 새 Manifest match는 독립 시험 확장에만 Instagram host를 추가한다. 제품 Manifest/Core/Server/공유 Wire는 바꾸지 않는다. 새로고침 자동 재적용/영속 결과·cleanup/제품 Core adapter는 미구현으로 유지한다.
- 기준 HEAD670647f의 #54는 확인 시 미병합이므로 선행 의존성을 명시한다. 자체 비교는670647f→이번HEAD의8파일이고, 통합 대상 PR 전체 diff에는 아직 #54 변경도 포함될 수 있다. #54 먼저 승인/통합 후 이 PR의 최종 diff·충돌·HEAD를 재확인해야 한다. 원래 #54 브랜치와 다른 담당자 코드는 변경하지 않는다. 자동병합/제품 활성화는 하지 않는다.
- 최종 소스 근거는 공유 회귀97/97(IG21 포함)·계약6/6·빌드/구문/공백 PASS 및 사용자 재시험 보고. 초기171/89/16/19/20은 각 당시 소스의 이력이고 최신 전수시험으로 합산하지 않는다. 이번 게시 준비는 기록만 갱신하므로 동일 기능 시험을 다시 실행한 것으로 표시하지 않는다. 원격 CI는 게시 후 별도 결과로 확인한다.

### 사용자 실제 NO_TARGET 보완

### 프로필 경유 SPA 제한 연속성 수정

- 사용자 nav-2 캡처: STORIES의 유효한 최종 주소이지만 invalidated.reason=ROUTE_CHANGED/cleanup_pending=false이고 마지막 result는 홈 관찰(media0/null)로 남았다. PAGEHIDE/복원 실패와 구분됐지만 실제 거절된 중간 pathname은 아직 미확보다. 따라서 특정 중간 주소를 실제 원인이라고 확정하지 않는다.
- 좁은 중간 route whitelist가 /stories/ index·프로필 alias·탐색 등 승인된 무효과 관찰을 종료하는 구조적 문제는 별도 반례1FAIL로 재현했다. supportedRoute를 관찰 수명과 효과 대상 판정으로 분리: 같은 Instagram 문서의 중간 경로는 collect0으로 관찰만 유지하고, 실제 효과는 기존 HOME/STORIES 조건에만 허용한다. accounts/challenge/oauth/login/auth/two_factor 및 host/native reauthorization/pagehide/cleanup failure는 계속 거절한다. 새로운 효과나 Core 권한을 추가하지 않는다.
- TEST build ig-stories-nav-3, 결과 adapter_revision=ig-stories-observe-3을 표시한다. route 무효화에는 계정명/URL 없이 origin_allowed/route_allowed/reauthorization·path_segment_count/route_family를 남긴다. 일반 YT의 무효화 응답은 바꾸지 않으며 authority 승인 요구 자체는 동일하다. 지원 route가 실패한 실제 원인이 이 변경으로 해결됐는지는 사용자 재시험 전까지 미확정이다.
- IG21/21 PASS(기존20+중간경로 반례1), 이후 adapter revision 표시를 포함한 공유 영향 회귀/빌드 확인을 진행했다. 이전19/20과 합산하거나 실제 사용자 성공으로 승격하지 않는다. 기존 재생/홈/보호/무승인/BFCache/복원 실패 조건을 재사용한다. 미커밋/미게시 유지.
- nav-3 최종 공유 영향 회귀7파일97/97 PASS(IG21 포함), fail/skip0, 계약6/6·구문/공백·build PASS. 원본/빌드 IG 모듈 SHA-256 일치 확인. 이는 합성 Chrome이며 사용자 실제 같은 이동 경로 해결은 재시험 대기다. 이번 단계에서 시험 범위를 더 확장하거나 진단기를 새로 만들지 않는다.

- 사용자 실제 재시험에서도 홈→프로필/다른 스토리에서 제한이 끊기고 OLD_SCOPE_CLEANUP_REQUIRED가 지속됐다. 앞선19/19는 합성 경로만의 근거이며 실제 해결 판정을 보류한다. 공통 surface가 scope를 닫는 원인은 PAGEHIDE/ROUTE_CHANGED/ROUTE_CLEANUP_FAILED로 제한되지만 TEST APPLY의 throw/catch가 invalidated를 숨겨 실제 사유를 알 수 없었다.
- 이번 추가 변경은 TEST handler 진단뿐이다. IG 오류에도 invalidated 원문 사유/result와 test_build=ig-stories-nav-2, 시험 문서 UUID, 익명 page_kind(HOME/STORIES/DM/OTHER)를 유지한다. URL/계정/본문/credential은 새로 반환하지 않는다. 실제 문서 교체/현재 build 불일치와 내부 lifecycle을 구분하기 위한 최소 자료이며 자동 재시작·가짜 재승인·오류 무시는 추가하지 않는다. 기존 pagehide/복원 실패 차단을 유지한다.
- 진단 반례1건에서 pagehide 후 오류가 reason/build/document ID를 보존하고 cleanup을 계속할 수 있음을 확인했다. IG 전체20/20(기존19+진단1) 실행은 합성이며 실제 사용자 invalidated.reason을 받아야 원인 확정·제품 로직 보완이 가능하다. 원인 미확정/실제 실패 상태를 유지하고 수정 완료로 보고하지 않는다. 시험 확장 재빌드 후 같은 사용자 경로/오류 JSON 확인 요청, Commit/Push 없음.

- 사용자 실제 홈→다른 사람 프로필→스토리 진입에서 영상이 보이고 재적용 때 OLD_SCOPE_CLEANUP_REQUIRED가 발생했다. 원인은 IG-01 routeAllowed가 HOME/STORIES만 허용하여 중간 프로필에서 controller를 닫은 것. 명시적 모의 재승인 callback이 있어도 프로필 route에서 닫히는 반례를 재현했다(수정 전1FAIL; 최초 기본 거절 callback으로 실행한 초안과 명시적 true/3초 timeout으로 고정한 반례를 구분).
- supportedRoute에 프로필/프로필 탭·게시물·Reel 단일 페이지·DM의 중간 경로를 추가하되 그 페이지의 collect는0이므로 어떤 미디어/프로필도 제한하지 않는다. 동일 문서 내 매 이동은 기존 authorizeNavigation의 동기 true 및 host/문서 경계를 여전히 요구한다. 로그인/외부 host/새 문서/pagehide·복원 실패는 계속 닫는다. 기능을 계속 켠 상태의 중간 페이지 NO_TARGET은 적용 성공이 아니라 대상 관찰 대기이며, STORIES에서 대상0은 계속 미검증/실패다.
- 직접 IG17/17에 이어 실제 시험 popup 경로 및 이동 중 복원 실패2건을 추가했다. 최종 IG19/19 PASS(fail/skip0): 홈1회적용→프로필→스토리→다른사람스토리 자동 재제한, 실제 TEST handler의 profile STATE/재APPLY 무오류, 이전 복원 실패 시 새효과 차단/의무 재시도, 기존 영상·홈·보호·타owner·BFCache/무승인 거절 포함. DOM/영상정지 근거는 합성이며 실제 사용자 동일경로 재시험이 남는다.
- 이번 최종 수정은 IG adapter/해당 시험/popup 설명/작업 기록이며 공유 navigation/Core/Wire/제품 Manifest는 추가 변경하지 않는다. 이전89/89 및 전체171은 당시 소스 근거로만 보존하고 이번 재실행으로 합산하지 않는다. 새로고침 자동 재적용/영속 Core 연결은 계속 미구현이다. Commit/Push/PR/병합 없음, 최종 시험 확장 build 후 사용자 확인 대기.

- 홈 숨김/해제 및 일반 게시물·추천·메시지 보존은 사용자가 "오 됐다", "둘다 됐어"라고 확인했다. 직접 viewer는 이후 계정/형태별 NO_TARGET/재생 지속으로 실패가 남았다. 시간바 진행만으로 media pause 성공/실패를 확정하지 않는다.
- 사용자 세 번째 전체 section에서 실제 video를 확인했다. video는 portrait px frame보다11겹 이상 아래이고 프로필 img는 별도32px 링크 안에 있었다. 최초 fallback의 부모4단계 제한 때문에 video를 찾지 못하는 코드 결함을 익명 구조로 재현(신규1FAIL)했다. 4단계 상한을 제거하되 STORIES route/세로형 frame/게시물·보호 UI·interactive ancestor 제외는 유지했다. 원본 계정/얼굴/URL/휘발 class를 시험에 넣지 않았다. 기존 직접사진·media pause 실패·타문서/owner/보호 범위를 포함한 IG16/16을 최종 실행했고, 영상 replay guard/가리기/해제와 avatar/닫기 보존을 합성으로 확인했다. 실제 Instagram 같은 영상/소리 재시험은 아직 대기이며 Commit/Push는 하지 않는다.

- 직접 viewer도 실제 사용자 화면에서 NO_TARGET/미디어0·재생 지속을 확인했다. 제공된 두 번째 HTML은 video가 아닌 img이며 일반 div(명시적 세로형 px height/width) 안에 있고 main/dialog 역할이 없었다. 이를 익명 구조로 재현해 사진·동형 합성 영상 반례2 FAIL을 확인했다. STORIES route에서만 보호/게시물/링크/버튼 밖 미디어의 가까운 세로형 div frame을 검사하는 fallback을 추가했다. img는 빈 alt/draggable=false를 요구한다. 댓글/편집 UI를 포함하는 frame은 제외한다. 원본 CDN URL/이미지/계정명은 fixture에 넣지 않았다.
- 보완 후 IG 전용15/15 PASS, fail/skip0. 사진 표시/복원과 동형 합성 video의 pause·재생 guard·일반 게시물 보존을 확인했다. 실제 사용자가 준 것은 사진 HTML이므로 실제 video 구조/재생·소리 제한 성공으로 승격하지 않는다. 이전89/89는 fallback 전 회귀 근거이고 이번 변경은 IG 모듈/해당 시험뿐이므로 전체 회귀를 재실행했다고 주장하지 않는다. 최종 build/공백 검사 확인 후 사용자 사진/영상 재시험 대기, 미커밋/미게시 유지.

- 실제 Instagram 사용자 캡처에서 홈 스토리가 남고 IG-01 NO_TARGET/eligible0/restricted0/error0을 확인했다. 초기 독립 링크 fixture11/11·전체171 PASS가 실제 DOM 성공을 보장하지 않음을 기록한다. 사용자 제공 outerHTML은 href 없는 div[role=button][aria-label] + ul/li + canvas + role=link/img 형태였다. 계정명·CDN URL·휘발성 class는 코드/fixture에 저장하지 않고 익명 구조만 사용한다.
- 홈 탐지에 한국어/영어 스토리 접근성 라벨과 목록·ring/profile 구조를 함께 검증하는 경로를 추가하고 기존 URL 링크 경로를 보존했다. 일반 프로필/게시물/nav/aside/FOCURVE 영역을 제외한다. IG-01 observer에만 aria-label/role 변화를 추가하여 재사용된 일반 버튼으로 바뀌면 자기 claim을 회수한다.
- 새 구조 반례2건에서 기존 탐지의 실패를 확인한 후 보완했다. 보완 중 한국어 HTML fixture에 charset이 없어 라벨이 깨지는 별도 시험 환경 문제를 확인하고 UTF-8 meta를 추가했다. 최종 IG13/13 PASS(fail/skip0): 제공 구조의 익명 버튼2개 제한/복원 및 label 재사용·중첩 FOCURVE 보호·일반 profile/article/aside 보존. 합성 Chrome 결과이며 실제 Instagram 사용자 재시험은 대기다.
- Computer Use는 현재 브라우저 URL을 확신할 수 없어 도구가 중단됐으며 이후 앱 입력/추가 접근을 하지 않았다. 사용자 제공 DOM으로만 진행했다. 제품 Core/영속화·공용 계약 변경·Commit/Push는 하지 않는다. 기존 직접 viewer/미디어 시험은 합성이며 실제 viewer 구조는 추가 사용자 확인이 필요하다.
- 보완 후 영향 회귀: IG/흑백/홈/상단바/구독/탐색/종료카드 7파일 **89/89 PASS**, fail/skip0. IG13건은 포함돼 있어 합산하지 않는다. 기존 전체171은 보완 전 근거이며 보완 후 전체173 재실행으로 기록하지 않는다. build/JS구문/공백 검사 PASS, 실제 사용자 재시험과 게시는 대기다.

- 담당 채지민, `codex/content-instagram-stories`, clean 시작 HEAD `670647f41f4e9b9c2380faede496815aa2f3d6a8`(#54 흑백). 사용자 확인에 따라 Instagram 필요성 협의는 종료됐고 확정6옵션을 유지한다. 이번에는 IG-01 하나만 구현하며 Reels/탐색/댓글/제안/흑백의 추가 구현은 하지 않는다. #54 브랜치/HEAD/리뷰는 보존한다. 향후 PR은 #54 선행 관계와 실제 통합 diff를 확인해야 한다.
- 기준 RC2 `05_Content_Event_UI.md`·feature-registry AC-IG-01-01~03: HOME/STORIES의 스토리 트레이/직접 viewer 미디어 제한, DM/일반 게시물 보존, 자기 claim 복원·SPA/native 재검증. `instagram-stories.mjs`의 InstagramStoriesSession은 기존 NavigationSurfaceSession/ClaimLedger를 재사용한다. profile IG-01에만 Instagram host를 허용하고 기존 YT host/옵션 경계는 그대로 유지한다.
- 홈은 정규 Instagram /stories/<user>[/item] 링크만 숨긴다. article/nav/header/footer/aside/FOCURVE UI 및 그 보호 영역을 포함하는 링크는 제외한다. 직접 route는 main/role=main/dialog/presentation의 img/video/audio만 숨기며 프로필/닫기 버튼·일반 게시물·navigation을 보존한다. Instagram 실제 DOM의 모든 변형을 확인한 selector가 아니며 href 없는 스토리 버튼·다른 viewer 구조는 NO_TARGET/미지원으로 남길 수 있다. 실제 사용자 재현 후 최소 selector 보완이 필요하다.
- 직접 스토리의 video/audio는 pause/readback과 play guard로 정지한다. paused 실패는 FAILED로 반환하며 국소 성공을 위조하지 않는다. 해제는 자기 display/inert claim을 복원하고 마지막 자기 복원 확인 후 guard를 제거한다. 해제 시 자동 재생을 강제하지 않고 사용자가 직접 재생한다. 다른 owner의 제한/guard는 보존한다. 페이지 이동·adoptNode·복원 실패 의무는 기존 공통 원장에 따른다.
- 같은 문서 이동도 authorizeNavigation의 명시적 동기 true 없이는 재적용하지 않는다. DM/login/posts 진입으로 새 제한을 부여하지 않으며 old scope는 닫는다. pagehide는 새 적용을 닫고 pageshow만으로 재개하지 않는다. 첫 제품 연결의 native sender/frozen/issued operation/DOM 전 영속 의무·Core 결과 저장은 여전히 미구현이다. 결과는 local_only/native_verified:false/OBSERVED·NO_TARGET·FAILED이며 Server 성공/접근 Event를 만들지 않는다.
- 기존 시험 build/bootstrap/popup을 재사용하고 Instagram TEST 명령3개를 추가했다. 시험 Manifest에 instagram.com/www.instagram.com의 content_scripts/WAR match만 추가한다. 제품 Manifest/Core/Wire/API/DB는 수정하지 않는다. activeTab 권한 유지. 시험 bootstrap의 임의 ID/모의 SPA 승인은 제품 인증이 아니다. 실제 새로고침은 초기화되고 수동 재적용이다.
- 최초 전용 시험10PASS/1FAIL은 avatar 이미지의 크기가0인 fixture 때문에 isVisible 기대가 틀린 것이었다. fixture 크기를 명시한 뒤11/11 PASS. 별도로 보호 UI가 anchor 내부에 삽입될 때 ancestor를 숨기지 않도록 collect를 보완했다. 실제 Instagram 성공으로 보고하지 않는다. 영상 pause/play 반례는 합성 property/method를 쓰고 DOM/CSS는 설치 Chrome에서 검사한다.
- 자동 명령: PLAYWRIGHT_MODULE/CHROME_EXECUTABLE 지정 후 bundled Node24 `--test extension/content-tests/instagram-stories-browser.test.mjs`. 전체 관련 회귀/계약/빌드 최종 결과는 후속 기록한다. 실제 로그인 Instagram·실제 영상/소리·내부 이동·DM·해제 복원은 사용자 시험 대기. 지역/계정별 DOM/브라우저·BFCache·Core/Server/영속 cleanup는 미검증이다.
- 미커밋/미게시, Instagram trial 대상 추가로 사용자 extension reload·사이트 접근 확인이 필요할 수 있다. 다음: 자동 영향 회귀 → 사용자 Chrome 체크 → 필요한 DOM 보완 → 게시 범위 설명/사용자 승인. 추가 옵션을 한꺼번에 확장하지 않는다.
- 최종 자동: Windows Node24 + 설치 Chrome headless/Playwright, `--test --test-concurrency=2 extension/content-tests/*.test.mjs` **171/171 PASS**(기존160+IG11), fail/skip0. IG11/11 단독 결과와 겹치므로 합산하지 않는다. legacy-boundary **6/6 PASS**, build·변경JS구문·공백 검사 PASS. build는32버튼/스토리 모듈/Instagram match를 확인했다. 실제 Chrome 확장 sender/권한과 Instagram 실제 페이지는 아직 사용자 시험 대기이며 합성 결과를 제품 수용으로 바꾸지 않는다. 변경은8파일/미커밋, #54는670647f 그대로다.

## 2026-10-31 YT-09 흑백 · 로컬 구현/사용자 확인 대기

- 담당 채지민, `codex/content-grayscale`, 시작 HEAD `113fb697a64eb803317499c9e5a61aee9c5a5a85`의 clean Content 작업을 보존해 분리. 기준 RC2 `05_Content_Event_UI.md` 및 feature-registry의 AC-YT-09-01~03. 이번 범위는 흑백 한 기능이며 Instagram/제품 Core 수신·영속화·Wire/Manifest/Server 변경은 없다. 기존 통합/선행 PR을 병합하지 않는다.
- `extension/content/grayscale.mjs`의 GrayscaleSession은 기존 NavigationSurfaceSession의 소유 claim·관찰·SPA 재승인·cleanup를 재사용한다. YT-09만 ClaimLedger.grayscale을 사용하고 다른 옵션의 hide 경로는 보존한다. desktop https YouTube의 지원 route/ytd-app을 대상으로 원래 filter와 자기 grayscale(1)을 합성한다. FOCURVE UI/안내가 내부에 있으면 해당 ancestor를 필터링하지 않고 보호 UI 밖의 자식 branch로 나눠 적용한다. 보호 UI에 filter:none만 주어 ancestor 효과를 무효화했다고 오인하지 않는다.
- 동적 app 교체·페이지 filter 변경은 observer로 관찰한다. 같은 문서 SPA도 trusted authorizeNavigation의 동기 true 없이는 새 적용하지 않는다. pagehide는 새 적용을 닫고 pageshow만으로 재개하지 않는다. 복원 실패·다른 문서 adoptNode는 의무를 유지하며 기존 원장의 재시도·다른 owner/속성 보존을 사용한다.
- 결과는 local_only:true/native_verified:false 및 OBSERVED/NO_TARGET/FAILED이며 Wire APPLIED/전체 RELEASED/Server 성공 증거가 아니다. 영상 재생/소리/자동재생/댓글·추천 설정은 변경하지 않는다. 시험 bootstrap은 TEST 전용 모의 SPA 승인/임의 시험 ID를 사용하며 coreConnected:false를 유지한다. 승인된 Core adapter의 effect 전 영속 의무·frozen/native/sender·issued operation/result 결속은 아직 미구현이다.
- 시험 확장 build/bootstrap/popup만 추가 연결하고 기존 모든 버튼/handler를 보존한다. permissions는 activeTab 그대로이며 서버 실행/새 확장 설치는 필요하지 않다. `node extension/content-tools/build-chrome-harness.mjs` 후 기존 시험 확장 reload 및 YouTube 탭 새로고침으로 사용한다.
- 최초 흑백 전용 설치 Chrome headless/Playwright 합성 DOM 9/9 PASS. 기존 공통 원장·navigation 관련 전체 회귀 및 최종 추가 시험 결과는 아래 후속 기록으로 구분한다. AC의 실제 Core/native·frozen 제품 수용은 이 합성 시험으로 PASS 처리하지 않는다.
- 사용자 실제 YouTube는 미검증: 적용 시 화면 흑백/팝업 컬러 유지, 재생·소리/수동 조작 유지, 해제 후 컬러 복원, 재적용/지원 SPA 이동, 댓글·추천 제한과 흑백의 독립 해제를 확인할 예정이다. 실제 전체화면·지역/언어/반응형·새 탭 자동 주입·BFCache 재결속·Core/Server 통합은 별도 미검증이다.
- Commit/Push/PR 없음. 다음: 관련 회귀 확인 → 사용자 체크리스트 실행 → 결과 기록/게시 범위 설명 → 사용자 게시 수락 후 작은 PR. 흑백 개발 결과를 영속 제품 연결 완료나 YouTube 전체 수용 완료로 집계하지 않는다.

### 이번 단위 최종 자동 검증

- 사용자 실제 YouTube 실행 결과: "흑백적용됐거든 올리고"라고 적용 동작 확인 및 게시 요청. 이는 사용자 보고이며 직접 수집한 Chrome 효과 로그가 아니다. 앞서 제공한 해제/미디어/SPA/다른 제한 공존 체크 전체가 완료됐다고 확대하지 않는다. 해당 실제 항목은 개별 확인 미기록이다. 실제 F5 후에는 현재 독립 시험의 모든 추가 옵션이 수동 재적용 구조이며 사용자도 현재 모두 초기화됨을 확인했다. 과거 유지 관찰의 원인은 미확정이다.
- 제품 연결 후속: Core는 새 문서/새로고침·SPA/BFCache의 권한/owner/document/generation을 재검증해 활성 세션의 frozen Snapshot/Attachment를 전달하고 effect 전 의무/결과·cleanup을 영속 결속해야 한다. Content는 승인된 명령을 기능별 Session에 연결하는 adapter와 적용/복원 증거 반환을 구현해야 한다. Core만의 작업으로 완료 처리하지 않는다. local OBSERVED/restored를 Server 성공으로 직접 전용하지 않는다. 본 PR에는 해당 제품 연결·영속화가 없다.

- 사용자 후속: 흑백은 새로고침 후 컬러 복귀하지만 기존 목록/검색창 숨김은 유지됐다고 보고. 사용자 관찰을 부정하거나 이를 곧바로 Core 결함으로 확정하지 않는다. 실제 유지된 옵션과 F5/탭 reload/확장 reload 구분을 확인 요청했다. 현재 bootstrap/popup/manifest에는 어느 추가 옵션도 저장·자동 재적용 경로가 없음을 확인했다.
- 새 비교 반례: 동일 시험 bootstrap으로 상단바/댓글/흑백을 적용 → Chrome 합성 페이지 `page.reload()` → bootstrap 새 주입 → STATE 조회. 1/1 PASS, 세 효과 모두 원래 DOM/필터로 초기화되고 상태 null/[]임을 직접 확인. 실제 YouTube 사용자 현상은 미재현·조건 확인 대기이며 제품 원인 수정이나 실제 사이트 PASS로 기록하지 않는다. 이 단계에서는 시험/기록만 추가, 제품 동작 변경·새 영속 저장·Commit/Push 없음.
- 이전 버전 직접 비교: `git show <ref>:extension/...`로 당시 bootstrap과 모든 import 모듈을 읽어 설치 Chrome 합성 문서에 실행. 댓글·추천0972ea2, 자동재생c70b837, 홈ba4a7e2, 구독12096d0, 탐색f18eba1, 상단바1a48bec, 종료카드70e40d3의 7경로(8옵션) 모두 적용 효과를 먼저 확인하고 `page.reload()` 후 새 bootstrap/STATE를 확인했다. 7/7 PASS: 숨김은 원래 visible, autoplay는 원래 ON, 세션 결과는 null/[]로 초기화. 흑백 추가 전 코드도 새 문서에 자동 재적용하지 않음을 직접 확인했다. Shorts/과거 모든 배포본/사용자 실제 YouTube F5·설치 파일 원본은 이 시험 범위가 아니다. 실행기는 ignored `extension/build/historical-reload-check.mjs`이며 제품/기존 시험 확장 빌드를 덮어쓰지 않았다. 사용자 과거 유지 관찰의 실제 원인은 미확정으로 남긴다.

- Windows Node24 + 설치 Chrome headless/Playwright, `--test --test-concurrency=2 extension/content-tests/*.test.mjs`: **157/157 PASS**, fail/skip0(기존148 + 최초 흑백9). 이후 시험 코드만 2건 추가해 흑백 파일 별도 실행 **11/11 PASS**. 9건은 겹치므로 157+11로 합산하지 않는다. 제품 소스는 두 실행 사이 동일하다. 추가2는 subframe 거절 및 실제 시험 bootstrap의 sender/공유 ledger/댓글 제한 보존이다.
- `node --test contracts/additional-mvp/rc1/tests/legacy-boundary.test.mjs`: **6/6 PASS**, fail/skip0. `node extension/content-tools/build-chrome-harness.mjs` 및 변경 JS 구문/공백 검사 성공. 정확한 Node/Playwright 경로는 기존 본 카드 시험 명령의 runtime을 사용한다.
- 사용자 실제 YouTube 결과는 아직 없으며 실제 Core/Server·영속 증거·BFCache 재결속 수용으로 승격하지 않는다. 새 파일2 + 기존 공유 navigation/시험 도구3/기존 작업카드1 = 게시 검토 후보7파일이며 아직 미커밋이다.

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

### 2026-10-31 · YT-08 종료 카드 숨기기 착수

- 담당 채지민, codex/content-endcards, 시작 기준 1a48bec1d239e15a77a76dfe01242be085d68101(PR45). clean 상태에서 별도 기능 브랜치로 분리. 기존 PR33/36/39/40/42/44/45·다른 담당 코드는 변경하지 않는다.
- 기준: AGENTS.md, 개발운영.md, 통합현황.md, 본 작업카드, feature-registry.json YT-08/AC-YT-08-01~03, RC2 03_Wire_D06_복원.md/05_Content_Event_UI.md. 종료 추천 카드와 우측 추천(YT04), 다음 영상 자동 전환(YT10)은 별개다.
- 범위: 일반 /watch의 현재 video-id에 결속된 player 안 종료 추천 카드 숨김/자기 claim 해제 복원. 자막·일반 재생조작·본문·우측 추천 보존. 기존 공통 원장/재승인 hook을 재사용한다. 실제 Core/native/frozen 정책 연결은 이번 독립 시험에서 구현하지 않는다. 흑백·Instagram 확장/Commit·Push/PR·병합은 별도다.

### 2026-10-31 · YT-08 로컬 구현·사용자 시험 준비

- 코드: endcards.mjs의 EndCardsSession. /watch에 단일 v가 있고 현재 ytd-watch-flexy의 video-id가 일치할 때, hidden tree가 아닌 #movie_player 내부의 .ytp-ce-element/.ytp-videowall-still/.ytp-suggestion-link만 대상으로 한다. 겹친 ancestor/descendant target은 합쳐 중복 claim을 줄인다. 전체 player/endscreen 컨테이너나 우측 related·페이지 본문을 가리지 않는다. 현재 실제 서비스/전체 레이아웃 selector 수용은 사용자 확인 대기다.
- 영상·일반 재생 버튼·caption·FOCURVE 종료/오류 UI가 든 대상과 해당 보호 영역의 자손은 제외한다. autoplay toggle을 클릭하거나 media paused/muted/volume/currentTime을 변경하지 않는다. 자동 다음 영상 방지는 YT10이며 이 옵션으로 완료 처리하지 않는다.
- NavigationSurfaceSession에 YT08 등록 및 기존 명시적 동기 재승인 경로를 재사용하고 video-id 변경을 관찰한다. 같은 watch 영상 SPA 시 기존 claim 복원 후 검증된 caller 재승인 및 현재 player ID 일치에 따라 적용, stale player는 미적용 대기. watch 이탈·권한 누락/거절은 scope 닫음, cleanup 실패는 목표/의무 보존 후 새 적용 중지. pagehide/BFCache는 새 권한 없이 재개하지 않는다. UUID·URL·모의 callback을 제품 native 권한 증거로 바꾸지 않는다.
- 도구: build 복사 endcards 추가, TEST_ENDCARDS_APPLY/RELEASE/STATE와 popup 버튼/설명·시험 이름 변경만. 같은 shared ledger를 사용하며 실제 제품 Core listener/API/Wire/Schema/권한·Server·Journal·frozen 정책을 변경하지 않는다. 상태는 local_only/native_verified:false의 국소 관측이다. 카드 생성 전 NO_TARGET은 관찰 대기이며 실제 카드 제한 성공 증거가 아니다.
- 신규 endcards-browser.test.mjs는 종료 overlay/최종 grid와 보호 UI·자막/조작·미디어 속성·독립 owner·퇴역 scope·동적 생성/교체/이탈·원래 page style·부분 복원 실패·영상 ID 전환·문서 이탈/미지원·adoption·시험 sender/상단바 독립 해제를 합성 Chrome DOM으로 검사한다. 첫 전용 실행13/13 PASS 후 iframe 거절 반례를 같은 시험에 추가하여 전체 영향 회귀를 실행 중이다. 실제 재생·소리·제품 Chrome/Worker 수용과는 구분한다.
- 사용자 체크: 시험 확장 갱신→YouTube 새로고침→다른 시험 제한 해제→일반 영상에서 원래 종료 카드가 나오는지 먼저 확인. 끝나기 직전/종료 후 카드가 보이는 상태에서 종료 카드 적용 시 카드만 숨김, 자막·재생/되감기·소리·본문·우측 추천 유지, 해제 복원. 처음부터 적용해도 끝에 늦게 생성된 카드를 숨기는지, 일반 추천 영상을 눌러 다음 watch로 이동한 뒤에도 제한되는지 확인한다. 홈/다른 문서에 나갔다 오거나 새로고침하면 해제→재적용이 필요하다. 원래 카드가 없는 영상은 정상 제한 증거가 아니며 카드가 실제 남는/복원 안 되는 경우 보고한다.
- 미검증: 실제 사용자 YouTube·지역/언어·플레이어 변형·제품 Core sender/owner/document/navigation/frozen/receipt·영속 cleanup·BFCache/새 문서 자동 재결속. 전체 AC-YT08 제품 수용 완료가 아니다. 변경은 종료 카드 코드/시험/공통 feature 허용·observer/시험 도구·기록8파일, Commit/Push/PR/병합 없음. 다음은 실제 사용자 결과 및 필요한 selector 보완→사용자 게시 수락→별도 PR 리뷰. 흑백은 아직 미착수다.

### 2026-10-31 · YT-08 자동 회귀 최종 결과

- iframe 거절 반례를 포함한 최종 관련 회귀119/119 PASS, 실패/skip0. 기존33+원장26+홈9+구독12+탐색14+상단바12+종료카드13 구성이다. Windows bundled Node24·Playwright·설치 Chrome headless 합성 DOM/모의 권한·재승인·pagehide/장애 주입, 약129.6초 실행 결과이며 실제 Chrome 제품 성능/실제 YouTube 효과 검증 수치가 아니다.
- 재현: 기존 PLAYWRIGHT_MODULE/CHROME_EXECUTABLE 경로를 설정 후 node --test extension/content-tests/changes.test.mjs extension/content-tests/detection.test.mjs extension/content-tests/browser.test.mjs extension/content-tests/claim-ledger.test.mjs extension/content-tests/claim-ledger-browser.test.mjs extension/content-tests/home-browser.test.mjs extension/content-tests/subscriptions-browser.test.mjs extension/content-tests/explore-browser.test.mjs extension/content-tests/masthead-browser.test.mjs extension/content-tests/endcards-browser.test.mjs . 종료 카드 단독13/13은 iframe 추가 전 실행이며 최종119에 iframe 검사가 포함돼 있다.
- Node --check endcards.mjs/bootstrap.js, build-chrome-harness.mjs 생성 및 git diff --check PASS. 시험 확장 이름은 FOCURVE 종료 카드 숨기기 독립 검증 — Core 미연결, 기존 extension/build/content-harness 경로를 갱신했다. 제품/실제 사용자 수용·Core 연결/전체 BFCache는 여전히 미검증. 사용자 시험 체크리스트 대기, Commit/Push/PR/병합 미실행이다.

### 2026-10-31 · YT-08 사용자 실패 보고·종료 후 추천 grid 보완

- 사용자 실제 보고: 종료 직전 creator 카드는 숨겨지지만 영상 종료 후 플레이어 안 추천3개가 남는다고 화면과 함께 보고했다. 종료 후 제한 항목은 FAIL이며 이전119/119 합성 PASS를 실제 수용 근거로 대체하지 않는다. 실제 사용자 영상 URL/제목/계정 자료는 이 기록에 복사하지 않는다.
- 조사: 기존 CARDS는 .ytp-ce-element/.ytp-videowall-still/.ytp-suggestion-link만 포함했다. 공개 원본 필터 https://github.com/DandelionSprout/adfilt/blob/master/YouTubeEvenMorePureVideoExperience.txt 에서 종료 후 추천용 .ytp-fullscreen-grid-stills-container를 확인하고 해당 구조를 합성 반례로 추가했다. 사용자 브라우저의 실제 DOM을 수집한 것은 아니므로 그 화면의 정확한 class 원인까지 확정했다고 기록하지 않는다. 외부 필터 전체/광고·추천 차단 정책은 가져오지 않았다.
- 수정 전: modern post-play grid 반례1/1 FAIL, timed 카드는 숨겨졌지만 새 grid는 visible=true로 남음. 수정 후: 현재 영상ID에 결속된 ended-mode player 안 새 stills 컨테이너만 추가 처리한다. 전체 player/fullscreen-grid 전체를 숨기지 않으며 replay 버튼·자막·오른쪽 추천을 보존한다. 재생 중 해당 grid는 대상이 아니고, 다시 재생해 ended-mode가 해제되면 자기 claim을 회수한다. 끝난 뒤 늦게 삽입되는 grid도 기존 observer가 처리한다.
- 신규회귀3건 포함 endcards-browser.test.mjs 16/16 PASS, 실패/skip0. 새 grid 적용/해제 및 replay/자막/sidebar 보존, 재생중→종료→재생/늦은 생성, 다중owner·부분 복원 실패/재시도와 기존13회귀를 검사했다. Node24·설치 Chrome headless·Playwright 합성 DOM/상태 모사이며 실제 사용자 YouTube 보완 후 수용은 아직 대기다.
- 명령: 기존 PLAYWRIGHT_MODULE/CHROME_EXECUTABLE 설정 후 node --test extension/content-tests/endcards-browser.test.mjs . build-chrome-harness.mjs 재생성, node --check endcards.mjs, git diff --check PASS. 이 보완에서는 selector/해당 시험/기록만 바뀌어 관련16건을 실행했고, 과거119 전체를 보완 후 재실행한 것으로 표시하지 않는다. 공유 원장/navigation primitive·제품 Core·계약은 이 수정에서 변경하지 않았다.
- 다음 사용자 재시험: 기존 시험 확장 갱신→같은 YouTube 탭 새로고침→종료 카드 적용→끝나기 전과 종료 후 추천 모두 숨김→종료 후 해제 시 추천 복원→재생 버튼/오른쪽 추천 보존 확인. 실패 화면이 계속되면 실제 구조 증거를 최소한으로 수집한 뒤 추가 수정한다. 미커밋 유지, Commit/Push/병합 없음. #36 충돌 해결 게시와 별도 worktree의 #39 대기는 그대로 보존한다.

### 2026-10-31 · YT-08 보완 후 사용자 정상 보고

- 종료 전 카드·종료 후 추천 grid·오른쪽 추천/재생 버튼 보존·종료 후 해제 복원의 재시험 안내 뒤 사용자가 “ㅇㅋ 정상적으로 됐다”라고 회신했다. 보완된 시험판에서 정상 동작했다는 포괄 사용자 결과로 기록한다. 항목별 원본 로그/영상·Chrome 버전/실행 hash나 AI 직접 관측은 없으므로 개별 항목의 독립 PASS 증거로 확대하지 않는다.
- 최초 종료 후 추천 잔존 FAIL과 합성 반례 FAIL은 보존하고, 보완 후 사용자 확인 대기는 위 정상 보고로 갱신한다. 자동16/16은 별도 합성 시험 결과이며 이번 사용자 결과 기록에서 기능 시험을 다시 실행하지 않았다. 실제 Core/native/frozen 정책 연결·영속 cleanup·실제 BFCache/새 문서 자동 재결속·전체 레이아웃 수용은 미검증으로 유지한다.
- 상태: codex/content-endcards의 종료 카드 코드/시험/시험 도구/기록8파일 로컬 미커밋. 다음은 게시 전 최신 통합·선행 PR 상태 및 충돌 영향 확인→게시 범위 설명/사용자 수락→별도 PR. Commit/Push/PR/병합 없음. 새 YouTube 옵션으로 남은 것은 YT09 흑백 연결이다.

### 2026-10-31 · YT-08 최종 사용자 결과·게시 준비

- 사용자가 자동재생 countdown 화면을 제시하며 종료 카드만 켰을 때 다음 영상 안내가 남는 것이 맞는지 확인했고, YT08은 추천 카드만 숨기고 YT10의 자동 전환 제어는 별개임을 안내했다. 이어 “ㅇㅋ 테스트 결과 다 정상이야 올리자”라고 최종 정상 보고 및 게시를 승인했다. 최초 종료 후 추천 잔존 실패→합성반례/보완→보완 후 정상 보고 흐름은 보존한다. 새 로그/hash·AI 직접 관측이 없는 포괄 사용자 결과이며 개별 독립 PASS로 확대하지 않는다.
- 게시 전 원격 통합을 확인해 최신2bf04f0325a9aaebfde888d60e385d9ce1c4ad14를 가져왔다. 시작1a48bec에서 해당 통합까지 Content 코드/시험/시험 도구의 기준 파일 차이가 없고 현재브랜치가 그 ancestor임을 확인해 codex/content-endcards만 ff-only 갱신했다. 종료 카드 미커밋8파일은 그대로 보존, 기존 PR/다른작업공간/통합/develop 브랜치 변경 없음. 같은head의 기존PR이 없음을 확인했다.
- 검증 재사용: 관련119 전체는 새 post-play grid 보완 전, 보완 후 종료카드16/16은 최종 selector 및 모든 종료카드 회귀다. 통합 기준 갱신으로 해당 Content 파일/의존성 변경이 없어 기능 시험을 다시 반복하지 않았고, 이를 보완 후 전체122건 단일 실행이라고 표시하지 않는다. build 재생성·Node구문·diff검사 근거는 위 기록이며 게시 직전 git diff --check도 PASS다. 기능/실제 제품 Core·전체레이아웃 미검증 경계 유지.
- 게시 단위8파일: endcards.mjs, endcards-browser.test.mjs, navigation-surface.mjs의 YT08 허용/video-id 관찰, 시험 build/bootstrap/popup/manifest, 본 기록. 기존 Source에 있는 selector 주소와 최소CSS 식별자만 참고했고 외부 filter 정책/파일을 복사하지 않았다. Core/Server/API/Wire/Schema·제품 권한 변경 없음. #36/#39는 이번 PR에 포함하지 않는다.
- 별도 Draft PR을 integration/additional-mvp-20261029 대상으로 생성하며 비교기준은 위2bf04f03이다. 실제 게시 SHA/PR 번호는 GitHub 결과를 따른다. 담당 리뷰는 다훈(끝 전/후 범위·자막/조작/본문 보존·사용자 실패/보완 근거), 종민(재승인/native/frozen/cleanup 경계). 병합/자동병합하지 않는다. 이후 새 YouTube 옵션으로 남은 것은 YT09 흑백 연결이다.
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

### 2026-10-31 · PR47 충돌 정리 / PR39 선행 의존성

- 담당 채지민, codex/content-endcards, 시작70e40d3bfee7fe66b63ef06c0b2ccaa3f87c90ac. 사용자 요청대로39를 먼저25e7d115 기준으로 정리·검사·게시한 새HEAD24b8a163afd0e57dd06db6d4c237f4edfe6cde24를 no-commit merge했다. 통합/develop에 병합하지 않고 #39→#47 순서 통합을 준비하는 개발 브랜치 의존성이다.
- 실제 충돌은 작업기록/build/bootstrap/manifest/popup5파일. 기존기능·모든handler와 양측 기록을 보존해 합쳤다. 공용 시험 이름/버전은 최신39의 Content 독립 검증0.1.1을 유지해 downgrade하지 않았다. 시험도구에 종료카드만 추가하고 제품manifest 권한·Core/Server/계약은 바꾸지 않는다.
- 종료카드 adapter는70e40d3와 byte동일, 자동재생 adapter는39새HEAD와 동일하며 공통원장/watch/nav 기존 구현 및 복원 의무를 보존한다. nav에는 원래47의 YT08/video-id 관찰만 남긴다. 기존 사용자 정상·다훈 독립8/8은 과거근거이며 새 충돌해결 HEAD의 제품수용으로 확대하지 않는다.
- 추가회귀1건은 공용harness에서 모든 옵션과 자동재생OFF를 적용한 뒤 종료카드만 해제해도 다른6 DOM제한/자동재생OFF가 남고, 각 마지막 해제에서 원래 상태/원장0이 되는지 확인한다. full Content와 빌드/계약 검증 후 실제 결과를 기록한다.
- PR47 자체 비교는39새HEAD 기준으로 제공한다. #39 미병합 동안 통합대상 전체diff에 선행39가 포함될 수 있으므로39 먼저 병합→47 최종diff/새HEAD담당승인 순서다. #39의 GitHub승인/병합을 대행하거나 새HEAD를 승인됐다고 간주하지 않는다. 기존 흑백/추가옵션 개발은 이번 범위 밖이다.

### 2026-10-31 · PR47 충돌 정리 최종 검사·게시 준비

- 최종 Content148/148 PASS, 실패/skip0 = 기존33+원장26+홈9+구독12+탐색14+상단바12+watch15+autoplay10+endcards17. 별도 계약6/6 PASS. Node24/Playwright/설치 Chrome headless 합성 DOM·모의sender/재승인·pagehide·장애 setter 시험이며 실제 제품Chrome/Native/Core/Server수용은 NOT_RUN.
- 명령: 기존 PLAYWRIGHT_MODULE/CHROME_EXECUTABLE 설정 후 node --test --test-concurrency=2 extension/content-tests/changes.test.mjs extension/content-tests/detection.test.mjs extension/content-tests/browser.test.mjs extension/content-tests/claim-ledger.test.mjs extension/content-tests/claim-ledger-browser.test.mjs extension/content-tests/home-browser.test.mjs extension/content-tests/subscriptions-browser.test.mjs extension/content-tests/explore-browser.test.mjs extension/content-tests/masthead-browser.test.mjs extension/content-tests/watch-panels-browser.test.mjs extension/content-tests/autoplay-browser.test.mjs extension/content-tests/endcards-browser.test.mjs . node --test contracts/additional-mvp/rc1/tests/legacy-boundary.test.mjs .
- build16모듈 byte동일·26고유버튼·권한/WAR 보존 smoke PASS. 최종diff점검에서양측HTML document/title을모두남긴중복header를발견해공용Content헤더하나만유지했다. 이후build재생성과DOCTYPE/title각1개·26버튼·16모듈검사PASS. 이마지막수정은popupHTML헤더뿐이며148기능시험이읽는module/bootstrap/fixture는변경하지않아회귀근거를재사용한다. Node구문/diff검사PASS.
- 종료카드효과코드/nav는70e40d3와동일, 자동재생/공통원장/watch는39새HEAD와동일. manifest는최신공용Content0.1.1을그대로선택해39대비차이가없다. 따라서47자체diff는이전8파일에서manifest가빠진7파일이다(효과/시험/nav/build/bootstrap/popup/기록). #39가미병합인동안대상통합전체diff에는선행39도보인다.
- 설명한검증/범위로사용자승인후같은PR47에새커밋·Push하고새HEAD를게시한다. 새HEAD의공유연결부는담당재확인을받고39먼저병합→47최종diff순서를유지한다. 통합/develop병합·자동병합·기존리뷰의새HEAD승격은하지않는다. 사용자/다훈의과거정상및8/8은출처구분하여보존하고현재실제제품연동PASS로바꾸지않는다.
