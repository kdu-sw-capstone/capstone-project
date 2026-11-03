# AMVP-CONTENT-06 · 추가 Content 연결
## 2026-11-03 다훈 잔여 연결 단위 — plan0·null identity 로컬 의무
- 기존 미커밋 startup/revision 및 게시된 #87/#99 수명 수정을 보존했다. 실제 공백3건: 동기 inspect에서 identity hash 생성 전 의무를 조회할 안정적 local_plan_id가 없음, hash 생성 후 원래 record 귀속을 확인할 수 없음, plan0와 receiver/adapter 공통 자원을 함께 구분할 local_records 관측이 없음. 동일3건 0PASS/3FAIL→3PASS. hash 실패 시 권한 context 무효화와 함께 원래 document 진단까지 사라지는 추가 공백1건도 FAIL→PASS로 보완했다.
- gate의 #issued 기존 원장을 재사용한다. record 생성 시 Content 내부 UUID local_plan_id를 한 번만 부여하고 identity=null부터 유지하며 기존 plan_id/identity와 연결한다. 기존 reservation identity는 Content hash 구조이지 Core 영속 receipt가 아니다. local_records에는 원래 generation·state·호출 여부·응답 관측·미확인 commit·로컬 완료/잔여 의무를 복사해 제공하고, local_tracking에는 기존 gate instance·gate-local document instance·구조적으로 결속한 원래 context scope와 미종료 reserve callback 수를 기록한다. hash 실패는 APPLY context를 계속 무효화하며 보존한 scope 사본을 권한 검사에 재사용하지 않는다.
- reserve_called=false는 이 gate가 callback을 호출하지 않았다는 로컬 관측일 뿐 전역 미접수 증거가 아니다. MATCHING_PLAN_ID도 전송 값 관측이며 durable_commit_status는 계속 UNCONFIRMED다. timeout·throw·응답 유실·close 이후 늦은 응답은 원래 record/첫 상태/의무를 지우지 않는다. 부분 record의 로컬 완료와 receiver listener/adapter observer 등 공통 자원은 분리하며 identities=[]/plan0/all completed만으로 watch 전체 종료를 만들지 않는다. watch_ref/cutoff_ref·Grant·fake Core identity·terminal은 생성하지 않는다.
- Node24.19.0/빈 DOM·EventTarget·style 대역에서 신규8사례 포함46/46 PASS(기존startup/gate/receiver/evidenceSnapshot·ClaimLedger17·계약6), FAIL/SKIP0. snapshot 전후 귀속, null hash 실패, timeout+late reply, sync throw, hash 전 release, 두 plan의 부분 완료+다른 owner 보존+receiver 공통 listener, 복사본 변조 거절을 확인했다. 실제 신뢰 원본이나 Core commit을 구현·검증한 시험은 아니다. 구문·git diff --check PASS. 기존38/125/101과 중복 합산하지 않는다. 실제 Chrome/브라우저 회귀/원격CI는 이번 제한으로 NOT_RUN이다.
- 재현 명령은 기존 Node startup/claim-ledger/legacy-boundary 3파일 실행과 같다. 기존 pr99-review/local-record-before.log / local-record-after-focused.log / local-record-scope-before.log / local-record-final-callbacks.log 보존. 추가 제품 변경은 hide-reservation-gate.mjs의 로컬 기록뿐이며 receiver/adapter local_startup·ClaimLedger 복원 경로·reserve payload/proof 형식은 변경하지 않았다.
- 외부 local_record/watch_ref/cutoff/scan0 closure/cleanup-only takeover 공유 형식과 실제 provider의 ABA 비재사용·영속 원본 조회는 공동 합의/구현 대기다. 다음 독립 후보는 snapshot 대기 중 로컬 revision 변화의 일관성 재검사이며 Core proof 생산은 포함하지 않는다. Git 반영은 별도 사용자 승인·신규 원격 HEAD 대조·독립 검토·정확HEAD CI 후 #87 우선/#99 상속 순서로 진행한다. Commit/Push/PR/병합 없음. M1 BLOCKED, 제품 E2E NOT_RUN, MVP_FINAL_COMPLETE=false.
## 2026-11-03 다훈 잔여 연결 단위 — 미시작·부분 시작 로컬 관측
- 기존 #87/#99 및 완료 proof revision 미커밋 수정은 보존했다. Content 내부 `local_startup` 진단만 추가하며 공용 Wire/Schema·watch/closure/proof 타입이나 provider를 정의하지 않는다. receiver의 기존 transport(instance/Worker), adapter의 기존 scope, 원래 boundContext/generation/document 검증을 그대로 사용한다. 기록 자체는 native/영속 증거가 아니다.
- adapter는 start 진입/반환·최초 실패·scope 등록·pagehide 등록 상태·Session 구성/시작 시도와 반환 횟수·자원 불확실성을 기록한다. start_called와 성공한 started를 혼동하지 않는다. Session 시작 중 예외가 있으면 자원 생성 불확실성을 보존하며 일반 release 결과만으로 이를 소급 제거하지 않는다. 기존 started/cleanup_pending/실제 restore 동작은 변경하지 않고 local_startup.resources_may_remain으로 감시·불확실 자원을 별도 구분한다.
- receiver는 adapter 생성·start 호출 여부와 자체 pagehide/navigation listener 상태를 별도로 반환한다. adapter 미진입·plan0·claims cleanup_pending=false라도 receiver pagehide가 남으면 receiver_resources_may_remain=true다. 이 값으로 watch 종료·RESTORED·가짜 identity/Grant를 생성하지 않으며 실제 Core 검증 closure 전 영속 watch 완료는 미구현/HOLD다. constructor 자체가 반환되기 전 실패하여 객체를 얻지 못한 외부 미확정 의무는 이 내부 기록만으로 복구 완료할 수 없다.
- 기록 공백3반례: adapter 미진입인데 receiver listener 잔존, pagehide가 실제 등록된 후 예외, plan0 observer 감시 중 상태. 수정 전 0PASS/3FAIL(진단 필드 부재)→수정 후3PASS. 최초 fixture에서 Worker provider 누락으로 UNBOUND를 잘못 기대한 로그와 이후 수정된 fixture 실패 원본을 모두 보존. 추가 시험의 listener 제거 실패는 기존 adapter가 예외를 전달하지 않고 cleanup_pending=true로 보존하는 계약에 맞춰 fixture 기대를 바로잡았으며 제품 실패를 skip/성공으로 바꾸지 않았다.
- Node24.19.0/EventTarget/MutationObserver·빈 DOM 대역 기반 새15사례를 포함하여 37/37(새14+기존ClaimLedger17+계약6), 추가 adapter 구성거절1/1 PASS. 고유38사례·FAIL/SKIP0, 두 실행이며125/101 등과 중복 합산하지 않는다. input verify strict true·동기 isCurrent·늦은 verifyInput 이후 scoped release·gate 완료 revision·다른 owner 복원·진단 복사본 변조·release 재시도 보존을 확인했다. 테스트 파일 ig04-startup-local.test.mjs는 브라우저/외부 패키지 없이 실행 가능하다. 명령: node --test extension/content-tests/ig04-startup-local.test.mjs extension/content-tests/claim-ledger.test.mjs contracts/additional-mvp/rc1/tests/legacy-boundary.test.mjs. 추가1건은 --test-name-pattern='adapter construction rejection'. 구문/공백 PASS.
- 기존 pr99-review의 startup-local-before.log / startup-local-before-corrected-fixture.log / startup-local-after.log / startup-local-final.log / startup-construction-boundary.log 보존. 이번 실제 Chrome 실행 금지에 따라 기존 receiver/gate/evidence 브라우저101 및 실제 BFCache/설치/E2E/원격CI는 NOT_RUN이며 기존 로그를 현재 변경본 PASS로 승격하지 않는다. Node에서 실제 모듈의 receiver/query·gate·evidenceSnapshot 경계를 별도 모사했다.
- 다음 독립 후보: plan0·identity=null을 포함한 원래 local 의무의 안정적 추적. 외부 local_record/watch_ref/scan0 종료 형식과 cleanup-only takeover는 공동 확정/실제 provider 대기이며 새 권한 API를 만들지 않는다. Commit/Push/PR/병합 없음. M1 BLOCKED, 제품 E2E NOT_RUN, MVP_FINAL_COMPLETE=false.
## 2026-11-03 다훈 잔여 연결 단위 — 완료 proof 소비의 로컬 revision
- 원격 #87은523612f8, #99는ccb4468f이며 선행/base·Draft 불변을 확인했다. 기존 Worktree의 게시된 수명 수정과 미커밋 상태를 보존하고 새 변경만 추가했다. LOCAL-ORIGIN-P2-CURRENTNESS 후보 manifest87b07a2d746b8ccccd2d4e95a0265c1f5e37c0091b0410d172ae4f2b09b3d84a 및 SPEC의 UNAPPROVED/실제 provider 미구현/ABA token비재사용 전제를 대조했다. 합성 seam이나 token 모양을 공용 API·권한으로 채택하지 않았다.
- 선택한 구현1개: 기존 HideReservationGate.completeReservation의 비동기 verifier 대기 전후 및 최종 동기 cleanup callback 이후 로컬 revision을 재검사한다. gate instance-private counter만 close/cancel에서 전진시키고, 마지막 검사와 completed 쓰기 사이 await는 없다. 공개 입력/출력·identity·proof·Schema·reserve ACK 형식과 verifyInput strict true/동기 isCurrent는 불변이다. 이 counter는 Core/provider fence가 아니며 외부 ABA 보장을 증명하지 않는다.
- 기존 실패2건: scoped release가 proof 대기 중 재실행됐는데 이전 proof가 소비됨; 마지막 locallyRestored callback이 close에 재진입하고 true를 반환해도 완료로 소비됨. 동일 반례0PASS/2FAIL→2PASS. 실패 시 기존 LOCAL_CLEANUP_UNCONFIRMED를 사용하고 원래 identity/미해결 의무를 남긴다. 새 검증 시도는 정상 proof를 다시 검증해야 한다.
- receiver41/evidence25/reservation29/계약6=영향101/101 PASS, FAIL/SKIP0. 추가 old-scope 정상1/1 PASS: APPLY 권한 회수 후에도 기존 scoped release와 검증된 완료는 허용하고 신규 APPLY는 거절, 예약 추가 없음. 총102개 고유 사례를 두 실행으로 검증했고 기존125/독립2와 합산하지 않는다. Node24.19.0/Playwright1.62.1/headless Chromium 합성 권한·proof·라우팅 fixture; 실제 Chrome 제품·Core provider·Server 성공 증거가 아니다. 구문·git diff --check PASS. 로그는 기존 pr99-review/completion-revision-before.log / completion-revision-after.log / completion-revision-old-scope.log.
- 실제 watch_ref 별도 소비, adapter 미시작/부분시작의 외부 증거, plan0/identity=null local 원장, scan0 종료 proof, cleanup-only takeover 및 provider 조회/영속 소비 결속은 신뢰 형식·공동 승인·실제 provider가 없는 부분을 HOLD한다. 이번 구현은 기존 reservation completion의 Content 로컬 소비 경계이며 새 watch closure receiver나 영속 cleanup 성공을 구현한 것이 아니다. 다음 독립 작업 후보는 기존 inspect/started/startup_error와 모순되지 않는 adapter 미시작·부분시작 로컬 추적이며 새 Wire/증거 형식은 확정 전 도입하지 않는다. Commit/Push/PR/병합 없음. M1 BLOCKED, 제품 E2E NOT_RUN, MVP_FINAL_COMPLETE=false.
## 2026-11-03 다훈 격리 후속 — receiver SPA 왕복 퇴역
- #87 2704148b를 상속한 #99 f6d99efd 기반 content-lifecycle-dahun 미커밋 수정. receiver의 기존 document/Worker/lifetime 거절을 재사용해 Navigation.currententrychange에서 URL 이탈을 관측한다. 지연 예약 ACK 전에 push/replace로 이탈 후 원래 URL 복귀하는 기존 2 FAIL을 수정했고 동일 URL state 갱신은 보존한다. cleanup proof·영속 예약·watch_ref·takeover 계약을 추가하거나 완화하지 않는다.
- blur/receiver 수명·복원 영향89/89 및 추가 문서/BFCache2/2 PASS, 세부 명령/실패 원본/시험 범위는 OPTION-11의 같은 날짜 후속 기록에 연결한다. 실제 BFCache 적중·issued/native·영속 ACK·CleanupGrant·Worker·Server 제품 수용 NOT_RUN. 별도 Core/Content 선행 통합/검토 전 로컬 구현 상태이며 Commit/Push/PR/병합 없음. M1 BLOCKED, MVP_FINAL_COMPLETE=false.
## 2026-11-01 PR83 로그인 보호 동적 관찰 P2 수정
- 담당 채지민 / codex/content-instagram-grayscale / 시작7f5439afe057543f93f2589886ad3b7aadfdf4c2. review5727916908/인라인4435476825 대응. 기존 공개화면 전체흑백·프로필/알림/portal·DM/login/FOCURVE 제외·재생/복원 범위유지. IG-06에만 type/action observer추가, 다른옵션 관찰목록/selector/Wire/권한변경없음.
- type text→password→text, form action search→accounts/login→search의 자동보호/재적용·원래sepia!important복원2반례를수정전0/2FAIL→수정후2/2PASS 확인. 다른owner claim 보존 및 보호branch복원setter실패 시 신규branch효과를얻지않고 기존의무/FAILED를보존·수리후재시도하는 반례도실패→PASS. 이를위해 IG-06 scan에서 복원오류가있으면새효과획득중단을추가, 타옵션은그대로유지.
- 직접Windows 설치Chrome headless/Playwright 합성 IG-06 16/16·기존YouTube흑백12/12=관련28/28 PASS, 계약6/6·build/구문/diff별도PASS. 전체317은수정전근거이며 수정후전체320을실행했다고기록하지않음. 특수로그인전환은자동반례로검증했고 사용자추가로그인조작요구없음. 새사용자/원격CI/Core·MV3·Native·Server수용NOT_RUN. 미커밋/미게시, #71/#82 별도잔여요청보존, MVP_FINAL_COMPLETE=false.

## 2026-11-01 IG-06 Instagram 흑백 독립 구현
- 최종후보0.1.16 사용자 'ㅇㅋ 아무문제없다': 안내한 탐색에서열린영상·알림·프로필포함흑백, DM/FOCURVE 제외·재생/소리·해제복원 정상보고. 사용자 실행 결과이며 에이전트제품수용과구분. 게시준비 동의 후최종전체회귀 재실행중. #82 P2수정20d5c26/기록154c769는별도브랜치에 보존했으며 본브랜치시작은70ff3e6이다. 이PR은 #82최신수정 선행통합 후최종diff·CI 재확인이 필요하며 통합충돌/순서는다훈관리. #82효과파일을구버전으로되돌리는 통합을허용하지 않는다.
- 사용자0.1.15 잔여실패: 탐색목록은흑백이나 클릭해열린 portal영상 및본문밖알림패널은색유지. 기존main/article/dialog 수집은 본문존재시 의미표식없는추가panel을누락한다. 익명Chrome 반례2건수정전0/2 PASS→공개페이지body직계branch수집+보호branch분리로수정후2/2 PASS. 기존IG-06총13/13 PASS(프로필11+추가2), DM/login/FOCURVE 제외·미디어상태/owner/부분복원회귀 유지. TEST0.1.16/ig-grayscale-panels-3 빌드·구문·공백PASS. 새사용자재확인과원격CI/제품Core연결은미검증, 이전정상보고를전체완료로승격하지않는다. Commit/Push없음.
- 최신 범위: 사용자가 팀 회신으로 프로필까지 포함해 흑백 적용하라고 전달. 위05_Content_Event_UI.md에 범위확인을 추가하고 route를 DM/accounts/auth/challenge 제외 공개Instagram으로 확장했다. 프로필/프로필reels/tagged·탐색·스토리와 main없는공개화면 fallback을 추가, DM/login/FOCURVE 제외 및 기존복원 규칙유지. 이전 프로필제외 기록/312시험은 과거 후보이며 현재수용으로 재사용하지 않는다. TEST0.1.15/ig-grayscale-profile-2. #82 P2수정은 별도worktree/브랜치 유지하고 여기에 섞지 않았다.
- 담당 채지민 / codex/content-instagram-grayscale / 시작70ff3e652da642cba81c5ce140131b90409c7f72(#82). AGENTS·개발운영·통합현황의 기존범위 유지. 기준feature-registry IG-06/AC-IG-06-01~03 및05_Content_Event_UI.md: feed/post/reels 흑백, DM/login/FOCURVE UI 제외. 프로필/스토리 활성화는 추가하지 않는다. #71/#56/#82 기존작업 보존, 별도브랜치.
- InstagramGrayscaleSession은 NavigationSurfaceSession/ClaimLedger의 기존 grayscale 합성·복원/owner원장 재사용. main/article 및 canonical post의 portal dialog를 수집하고 보호UI·Messages/메시지/Direct·로그인form branch는 분리하여 ancestor grayscale로 오염되지 않게 한다. 영상 pause/mute/time 변경 없음. 새factory·IG-06 profile/SPA등록·grayscale dispatch만 공통부품에 추가, YouTube profile 의미변경 없음.
- TEST0.1.13/ig-grayscale-1 적용/해제/상태와 기존popup복사 재사용, 기존버튼/handler보존. 제품 listener/실제권한/영속cleanup·Core/Server/공용계약 변경없음.
- 직접Windows 설치Chrome headless/Playwright 합성8/8 PASS: feed/filter변수·미디어상태, post/reelsportal·DM/login보존, 동적FOCURVE 분리, 다중owner/hide, 페이지filter변경·부분복원실패재시도, SPA/DM종료, 범위거절, TESTsender거절. 실제사이트 및 Core/MV3/Native/Server 제품수용 NOT_RUN. 전체회귀 실행중, Commit/Push/PR/Merge 없음, MVP_FINAL_COMPLETE=false. 다음 최종시험판 사용자확인→게시승인.

- 최종 전체Content312/312 PASS(IG-06 8포함), fail/skip0. 실행 기존환경 node --test --test-concurrency=2 extension/content-tests/*.test.mjs, 로그ig-grayscale-full.log. 계약6/6·빌드·변경JS 구문·공백검사 별도PASS. 기존YouTube흑백/추천/댓글/Instagram 회귀 포함. 사용자0.1.13 재시험/새HEAD 원격CI/제품권한 연결은 미검증, 미커밋 상태로 사용자확인 대기.

- 프로필포함 후보 직접검증: IG-06 11/11·기존YouTube흑백12/12·계약6/6 PASS, 빌드/공백검사PASS. 범위수정후전체315시험은 재실행하지 않았고 기존312는수정전근거로구분. 사용자0.1.13 홈/게시물/릴스 정상·프로필미적용 보고는과거결과이며 새0.1.15 실제프로필/스토리/탐색·복원 및제품Core/MV3수용은미검증. Commit/Push없음.

- 게시직전최종전체Content317/317 PASS(IG-06 13포함), fail/skip0. Node24/설치Windows Chrome headless/Playwright 합성DOM, 기존환경 node --test --test-concurrency=2 extension/content-tests/*.test.mjs, 로그ig-grayscale-final-full.log. 별도계약6/6·build·변경JS구문·공백PASS. #82별도P2시험3건은이기반에포함되지않으므로 최종통합시험과구분한다. 사용자0.1.16실제화면정상은별도근거이며 에이전트Core/MV3/Native/Server수용은NOT_RUN. 제출10파일(기능/시험/공통등록/시험판/범위확인·기록), 새HEAD원격CI는Push후확인. Draft/미병합유지, MVP_FINAL_COMPLETE=false.


## 2026-11-01 PR82 추천 소유 경계 수정
- 담당 채지민 / codex/content-instagram-suggestions / 시작70ff3e652da642cba81c5ce140131b90409c7f72. review5727802096의 두P2(추천그룹 조상확장·중첩헤더 오승격) 3반례를 설치Chrome 합성DOM에서 수정전0/3 PASS로 재현, 수정후3/3 PASS. 미커밋IG-06은 원래content-resume-20261101 worktree/브랜치 그대로 보존하고 별도content-suggestions-review에서 기존#82만 수정한다.
- 계정: 검증된 semantic section/list/aside에서 확장을 중단하고 비추천 heading을 가진 별도그룹은 포함하지 않는다. 기존 deep wrapper·무표시 sibling·mutual-follow badge 지원 유지. 게시물: 해당article 소유경계의 header만 인정하고 section/aside/article/listitem/dialog 중첩 근거를 바깥article로 승격하지 않는다. 별도own header가 있는 경우 pseudoDIV도 그 소유범위에 결속. semanticHEADER없는 정상DIV 지원 유지.
- 직접 IG-05 Chrome 합성15/15 PASS(기존12+신규3). 계약6/6·빌드·공백검사 PASS. 전체회귀 실행중. #71/댓글·릴스·복원원장·공통Core/계약 변경없음, 통합충돌/병합은다훈관리. TEST0.1.14/ig-suggestions-boundary-4. 새사용자시험/원격CI/실제Core·MV3·Native·Server수용 NOT_RUN, Commit/Push 없음, MVP_FINAL_COMPLETE=false.

- 최종 전체Content307/307 PASS(IG-05 15포함), fail/skip0. Windows Node24/설치Chrome headless/Playwright 합성DOM, 기존환경 node --test --test-concurrency=2 extension/content-tests/*.test.mjs, 로그ig-suggestions-p2-full.log. 계약6/6·build/구문/diff 별도PASS. 제공원문 로컬재현도 계정5/5 및게시물1/1 숨김/복원PASS(실제서비스수용과구분). 새사용자화면 확인은 아직없으며 과거0.1.12 정상보고를 새후보로 승격하지 않는다. 새HEAD 원격CI는Push후확인, 독립재리뷰필요.

- 수정코드20d5c26a33f859e8c68c6a9d432a64b43260a726 기존#82 Push완료. 사용자0.1.14 추천시험판만 켠 상태에서 재시험 후 'ㅇㅇ 문제 없네' 정상보고. 추천계정/추천게시물·일반게시물보존·해제복원 사용자확인으로 기록하며 별도Following목록의 실제존재/개별확인 여부는 미확인이다(해당특수경계는 합성반례PASS). 에이전트제품수용으로 승격하지 않음. 이번추가기록은 문서만 변경하며 제품코드/시험동일성을 근거로307/307 재사용, 기능시험재실행없음. IG-06미커밋작업과 #71 선행 보존, 독립재리뷰/새HEAD CI 확인필요.
## 2026-11-01 IG-05 추천 계정·게시물 독립 구현 시작
- 담당 채지민 / codex/content-instagram-suggestions / 시작 c9393d5901150e77b96999eefbef14f071436c7a(#71 보존). 선행 #65/#71 누적 코드를 재구현하지 않는다. 기준 contracts/additional-mvp/rc1/feature-registry.json IG-05, AC-IG-05-01~03 및 docs/design/additional-mvp-contracts/05_Content_Event_UI.md. 계약 대상은 추천 게시물·계정, 팔로잉 피드 보존·광고 자동 포함 금지다.
- instagram-suggestions.mjs: HOME/SUGGESTED(/explore/people)에서 명시 추천 계정 label+profile/follow로 확인한 좁은 그룹, 게시물 own header의 명시 추천 표시만 제한. 전환 버튼/일반 이미지/미디어/본문·feed root·DM/프로필/다른 route·보호 UI를 추천 계정 근거로 쓰지 않는다. 광고 표시는 추천 게시물 대상에서 제외. shared ClaimLedger·NavigationSurfaceSession 재사용; IG-05에만 profile등록/SPA 재승인/문자변경 감시 추가, adapter factory 등록. 제품 Core listener/issued/native/영속증거를 만들지 않는다.
- TEST harness 추천 적용/해제/상태·기존 복사 UI 재사용, 0.1.10/ig-suggestions-1. 기존 버튼/handler 보존. 새로고침 시 재적용 필요, Core미연결 모의권한이며 OBSERVED를 제품 APPLIED/Server 성공으로 변환하지 않는다.
- 직접 Chrome 합성DOM 7/7 PASS: 추천 계정/게시물·광고/팔로잉 보존·동적 label변경·오판 방지·다른 owner/page변경·SPA/pagehide·adapter 해제. 최초6/7의 일반 이미지 반례 실패는 null href가 /null로 파싱되던 원인으로 수정했고 재시험7/7. 실제 Instagram DOM·Core/MV3/Native/Server NOT_RUN. 전체 회귀 실행 중. 사용자 시험 후 게시 승인 대기, Commit/Push/PR/Merge 없음, MVP_FINAL_COMPLETE=false.

- 최종 전체 Content299/299 PASS(IG-05 최초7 포함), fail/skip0. Node24/설치Windows Chrome headless/Playwright 합성DOM, 로그 ig-suggestions-full.log. 이후 제품 코드 변경 없이 TEST sender 거절 및 IG-05 해제 후 IG-03 유지 반례2개를 추가하고 IG-05 9/9 재실행 PASS. 전체301건을 재실행했다고 기록하지 않는다. 계약6/6·빌드·JS 구문·diff 검사 PASS. 실제 사용자 Instagram/새HEAD 원격CI 미실행이며 다음은 시험판0.1.10 사용자 확인→게시승인이다.
### IG-05 실제 제공 DOM 누락 보완 / 0.1.12
- 사용자0.1.10에서 일부 추천계정/추천영상 잔류 보고. 제공 HTML의 깊은 nested label, 개별 추천사유 없는 mutual-follow 행의14px role=link 프로필 badge, semantic HEADER 없는 author/time DIV를 반영했다. 이름/본문/CDN/class 원문은 커밋하지 않고 익명반례만 추가.
- 계정: 고정6조상 탐색/첫부분행 선택을 제거하고, 명시추천 label 아래 안전한 account-only 그룹 범위까지 탐색. 프로필 링크 외 작은(양변32px이하)role=link badge만 추가허용, 일반이미지/전환버튼/다른link/미디어/게시물/root 경계거절은 유지. 게시물: exact 추천label+프로필+정확 post time을 포함하고 미디어/본문을 포함하지 않는 최소DIV heading도 인식한다. 캡션의 추천문구만으로 article을 숨기지 않는다.
- 새 익명3반례 수정전0/3→수정후3/3. 최종 IG-05 Chrome 합성12/12 PASS(기존9포함); 제공 원문을 로컬 ignored 진단에서 직접 구성해 계정5개 전부숨김/복원 및 게시물1개 숨김/복원 확인. 이는 실제 Instagram 실행이 아닌 제공DOM 재현이며 개인자료는 출력/커밋하지 않았다. build/구문/diff PASS.
- 현재공통 코드 추가변경 없음; 전체299/299는 앞선후보 근거이고 이번새모듈 수정후 전체 재실행하지 않음. 실제사용자0.1.12 확인/원격CI/Core·MV3제품수용 NOT_RUN. TEST0.1.12/ig-suggestions-dom-3, Commit/Push 없음. 다음 사용자 적용·계정전부/추천게시물·일반피드/광고보존·해제복원 재확인.

- 사용자0.1.12에서 'ㅇㅋ 문제 없다' 보고: 안내한 추천계정 전부/추천게시물 제한·일반게시물/광고 보존·해제 복원을 사용자 실행 결과로 기록. 실제 Core연동/에이전트 제품수용으로 승격하지 않는다. 게시 동의 후9파일만 별도 브랜치 Commit/Push·Draft PR 준비; 선행#71(c9393d5)/#65 의존 명시, 제품코드나 기록의 통합충돌 해결·병합은 다훈 담당. 게시 직전 현재최종 소스 전체회귀 재실행 중.

- 게시 직전 최종 소스 전체Content304/304 PASS(IG-05 12 포함), fail/skip0. 기존 Node24/Playwright/설치Windows Chrome headless 합성DOM, 실행 node --test --test-concurrency=2 extension/content-tests/*.test.mjs, 로그 ig-suggestions-final-full.log. 계약6/6·빌드·변경JS 구문·공백 검사 별도PASS. 앞선299/301 미재실행 메모는 그 시점 이력으로 보존하며 현재최종 검증은304다. 원격CI는 게시 후 확인, 실제Core/MV3/Native/Server 제품수용 NOT_RUN.

## 2026-11-01 PR71 최종 게시 후보 · 정상 baseline0.1.9.2
- 시작2a22fcb / codex/content-instagram-comments, 선행 #65(4daf3d3) 유지. 아래 중간0.1.10~0.1.14 실패 후보는 이력이며 최종 제출 소스가 아니다. 최종은 사용자 정상0.1.9.1(empty 릴스 보완 포함)에 semantic listitem 경계만 수정한0.1.9.2다.
- 사용자0.1.9.2에서 '됐다 아무문제 없다' 정상 보고: 안내한 홈/릴스/빈댓글 제한·게시물 사진/영상/본문/좋아요 보존 및 해제 복원 결과로 기록. 에이전트 직접 실제Instagram/MV3수용으로 표시하지 않는다.
- 최종 Content287/287(댓글32 포함), 계약6/6·build/구문/diff PASS. 이번 게시6파일: 댓글효과/시험·TEST bootstrap/manifest/popup·본기록. 공통 nav/ClaimLedger/adapter/Core/Server/계약 변경 없음. 실제Core/MV3/Native/Server 제품수용 NOT_RUN, MVP_FINAL_COMPLETE=false.
- 게시승인 후 동일PR71 새HEAD CI/checkout·원본로그 확인 및 다훈 독립재검토 요청. 기존리뷰를 새HEAD 승인으로 승격하지 않으며 Draft/미병합 유지.


## 2026-11-01 IG-04 댓글 첫 독립 구현 · 사용자 제공 DOM 반영 / 시험 대기

### 릴스 그림 댓글·답글 프로필 잔여 보완

- 사용자0.1.7 실제: 대상13/13·errors0이지만 GIF 이미지 댓글/답글/아바타가 남음. 국소 counts는 전체 댓글 수용 근거가 아님. 홈 일반 게시물은 본문/작성자 보존·다른 댓글 숨김 정상으로 별도 유지한다. 추가 제공 DOM의 GIF 부모 댓글에는 time/댓글 permalink가 없고, 자식 답글에는 exact comment time과 @mention 링크가 섞인 본문이 있다. 개인 계정/본문/CDN/class 원문은 보관하지 않는다.
- 익명5반례 수정 전1PASS/4FAIL: GIF/답글 묶음, mention reply 행 전체, collapsed/late replies, reply Text.data 전환 실패; 일반 GIF post 보존 반례는 원래PASS. ig-comments-gif-before.log.
- 댓글 고유 링크가 있는 행은 mention/body text도 허용한다. 고유 링크 없는 GIF/그림 행은 canonical post/Reels의 body image+profile avatar/profile link+명시 Reply 동작을 가진 안전한 최소DIV 조합을 요구한다. avatar만으로 판별하지 않고 일반 Like/Comment 버튼만 있는 이미지 게시물은 제외한다.
- 검증된 부모 댓글과 연결된 다음 sibling의 명시 View/Hide Replies 영역을 별도 claim으로 포함해 프로필·아바타도 함께 숨긴다. reply list 밖 이미지/다른 postID/미디어·본문·보호 UI는 attachment 근거로 쓰지 않는다. 전역main/dialog를 숨기지 않는다. 기존 owner/복원 원장 경로 재사용.
- reply action/toggle 및 mention body가 텍스트를 판별하므로 IG04에만 characterData 감시를 추가하고 기존 IG03도 유지한다. 다른 profile에 텍스트 감시를 확장하지 않으며 본문을 외부 수집/반환하지 않는다. 시험판0.1.8/build ig-comments-rich-3.
- 마지막 guard 및 이웃 다른post/이미지 negative를 포함한 전체 Content 회귀277/277 PASS(댓글22건 포함), 실패/skip0. 실행: 기존 PLAYWRIGHT_MODULE/CHROME_EXECUTABLE 설정 후 node --test --test-concurrency=2 extension/content-tests/*.test.mjs, 로그 ig-comments-rich-regression.log. 별도 계약6/6·시험판 build·구문 검사 PASS. 이전269 및 관련56은 각각 그 소스 시점의 이력으로 보존한다. 실제 GIF/답글/프로필 수용은 사용자 재시험 전 미확정이며 제품Core/MV3/Native/Server NOT_RUN. Commit/Push/PR/Merge 없음.


### 실제 릴스 행 추가 반영

- 사용자 일반 게시물은 대상16/제한16/errors0·댓글 숨김 정상 보고, 댓글 진입 버튼은 남기는 기존 범위 유지. 릴스는 NO_TARGET0 실패다. 추가 제공 파일 baa3a054...는 댓글 행들이며 H3 없이 avatar/profile link·exact comment permalink+time·별도 dir=auto body·reply/like role-button 구조다. class/계정/CDN/본문을 저장하거나 selector로 쓰지 않는다.
- 익명 Reels2반례를 이전 코드에서 실행해 0PASS/2FAIL(eligible0) 재현했다. H3 필수조건을 profile/body/control과 단일 댓글 permalink 구조로 대체하고, 다중 댓글 list/영상/캡션/닫기/보호 UI를 parent로 삼지 않는다. canonical post/Reels 문서에서 semantic MAIN 밖 댓글 portal도 허용하되 exact 댓글 row 검증·같은postID·보호영역/DM 제외는 유지한다. neutral HOME/profile로 확장하지 않는다. 실제 fragment의 외부 semantic ancestor는 미확보다.
- 수정 후 댓글 전용16/16 PASS(기존14+Reels2), 실제 사용자 릴스 재시험 대기. 이전 전체269는 이 추가 수정 전 이력이며 새271 전수로 소급하지 않는다. adapter/미디어 release 관련 **40/40 PASS**, 댓글16과 서로 다른3파일 총56건(합산중복 없음), ig-comments-reels-shared.log. 계약6/6·build/구문/diff PASS. module/build FF20DEF28A7A59CBB65F91192D868E82F6411F1573300F66BEED9C8F5B60C955 일치. 전체271 로컬 재실행으로 부르지 않으며 제품/실제릴스 해결은 사용자 재시험 전 미확정이다. 시험판0.1.7/build ig-comments-reels-2로 구분하고 기존 버튼/메시지 권한은 유지한다.


- 최신 사용자 실제 릴스 시험 실패: 0.1.6 TEST_IG_COMMENTS_APPLY, page_kind POST_OR_REELS, result NO_TARGET/eligible0/restricted0/errors0, invalidated=null이며 댓글 패널은 화면에 남았다. 이를 성공으로 기록하지 않는다. 원본/빌드 module9C98AE58... 일치를 재확인했으나 현재 릴스 패널의 DOM/실제 제외 조건은 미확정이다. 일반 게시물 DIV row 반영 및 합성269PASS가 이 실제 릴스 구조 지원을 증명하지 않는다. 닫기/목록/입력창을 포함한 현재 릴스 패널 outerHTML을 요청했다. 근거 없이 모든 DIV/aside를 숨기거나 caption/media 보존 조건을 해제하지 않는다. 게시/Commit/Push는 계속 보류한다.

- 담당 채지민, codex/content-instagram-comments, 시작4daf3d3a0bc3ac3a51db98dcf6963dd61eca04db(#65 최신 수정). 기존 clean Worktree에서 별도 브랜치로 진행, 선행 PR/미디어 P2/탐색 identity 수정 보존. 기준 RC2 05_Content_Event_UI 및 feature-registry IG04/AC-IG-04-01~03: 댓글·modal 제한, 캡션/게시물/좋아요 보존.
- 새 instagram-comments.mjs는 기존 NavigationSurfaceSession/ClaimLedger hide·복원을 재사용한다. 게시물/reel/reels 또는 명시 Comments dialog 안에서 의미상 Comments/댓글 목록, 정확한 per-comment permalink를 가진 li/listitem, 댓글로 명명된 textarea/textbox만 대상으로 한다. 캡션/post 링크·다른 postID/외부주소·media/보호 UI·DM/Stories는 제외한다. 전체 modal/UL/H2를 일괄 숨기거나 계정명/휘발CSS class를 selector로 사용하지 않는다.
- Session adapter factory/공유 navigation whitelist에 IG04 등록, IG04에만 placeholder 관찰 추가. 기존 IG03 identity 감시와 미디어 release는 변경하지 않는다. 새 TEST_IG_COMMENTS popup3버튼을 맨위에 추가, 시험판0.1.6 FOCURVE 댓글 시험판. 기존 버튼 아래 상태/복사 기능 유지, Core/Server/Wire/제품Manifest/권한 발급·영속 저장은 변경하지 않는다.
- 초기 전용 시험10/10 PASS(설치 Chrome headless/Playwright 합성 DOM·모의 권한), 계약6/6·build/변경JS5파일 구문/diff PASS. 내용/미디어/좋아요 보존·modal·중립경로·동적href/placeholder·다른owner·SPA/거절·pending retry·타문서·실제 TEST sender gate/adapter 포함. 전체 Content 회귀 실행 중. 최초 합성 성공을 실제 Instagram 지원으로 승격하지 않는다.
- 최초 H2/계정링크/인증SVG 조각만으로는 댓글과 게시물 작성자/캡션을 구분할 수 없어 H2 전체숨김을 구현하지 않았다. 이후 사용자가 바깥 DIV 댓글 행을 추가 제공했다. 실제 row는 H3 author, 별도 dir=auto 본문, exact per-comment href 안 time[datetime], 답글 button, 외부 아바타를 가진 DIV형태였다. 계정/본문/CDN/class 원문은 저장하지 않고 익명 구조만 fixture에 반영한다.
- 기존 li/listitem 전제에서 새 DIV2반례 **0PASS/2FAIL(eligible0)** → 보완 후PASS. 정확한 댓글 permalink/time와 H3·본문·버튼 조합의 최소 DIV를 찾고, 단일 댓글 구조가 유지되는 avatar parent만 포함한다. 전체 article/dialog·H2 caption·protected UI·다중 댓글/미디어 컨테이너로 넓히지 않는다. IG04 판별 의존 dir/datetime 감시도 추가, 재사용 DOM의 양방향 적격 전환 반례2건 포함.
- 최종 전용14/14 PASS(기본10+제공DIV2+동적속성2), 계약6/6·build/구문/diff PASS. 최초 전체265/265는 이전10개 후보 selector 시점의 이력이며 최종269 전수로 합산하지 않는다. 최종 전체 Content **269/269 PASS**, fail/skip0(129.2초), ig-comments-final-regression.log. 전용14와 중복이므로 합산하지 않는다. 계약6/6·build/구문/diff PASS. 원본/빌드 module hash9C98AE58CDA41CA3F60C1F53F8A512BCBADAFC30FF64E29E210466D283BF10E2 일치. 실제 Instagram 사용자 동작/오디오·모든 DOM 변형/제품 Core 검증은 아직NOT_RUN.

- 사용자 확인 예정: 일반 게시물/릴스 댓글·입력창 숨김, 사진/영상/본문/좋아요/닫기 보존, 늦은댓글 자동제한, 해제 후 복원·댓글작성 가능. NO_TARGET/FAILED/남은댓글은 성공 아님. 전체새로고침은 재적용 필요. 실제 Core/native/frozen/fullscope·효과전영속ACK·cleanup lease/결과저장·새문서/BFCache 제품 재결속·제품START/END 수용 NOT_RUN. Instagram 제안항목/흑백·키워드/블러는 이번 범위 밖. Commit/Push/PR/Merge 없음, MVP_FINAL_COMPLETE=false.


## 2026-11-01 PR #65 동적 탐색 identity P2

- 담당 채지민, codex/content-instagram-explore. 시작6d4a5e2b057d0f7e22f6aefe97b52232331368ad, 원격 #65 HEAD/base 일치·clean 확인. review discussion4434086347 범위만 수정한다. 기존 #58/#64 미디어 P2 수정은 그대로 보존하고 재개발/타 브랜치 변경하지 않는다.
- 원인: confirmedExploreEntry가 읽는 title/aria-labelledby/textContent/svg title·외부 참조 label text를 기존 observer가 모두 감시하지 않았다. 분류 함수는 수동 scan 시 맞지만 자동 claim 회수가 누락됐다.
- 정확한 시작 소스에서 신규 설치 Chrome 합성5건(title/aria-labelledby pointer/기존 Text.data/svg title Text.data/외부 label Text.data) **0PASS/5FAIL** 재현. 모두 Explore→Search 뒤 자동 opacity/inert 복원 timeout(2초), pr65-identity-before.log. 사용자 실제 DOM 전체 재현이나 제품 수용으로 확대하지 않는다.
- 최소 수정: navigation-surface observer의 IG-03에만 title/aria-labelledby 추가 및 characterData=true. 새 observer/강제 표시/claim 직접 삭제 없음. 기존 microtask 배치·동적 재분류·자기 claim 회수 경로 재사용, 다른 기능은 characterData=false로 기존 동작 유지. characterDataOldValue/본문 수집·전송·추가 로그 없음.
- 신규5건은 각 입력의 Explore→Search 자동 복원, Search→Explore 자동 재적용, 다른 owner와 겹친 후 Search 전환 시 자기 claim만 회수, 마지막 owner 해제 시 원래 opacity0.65!important/inert=false 복원을 수동 scan 없이 검증한다. 수정 후 전체 Content **255/255 PASS**, fail/skip0(125.5초), 신규5 포함. 동일5반례 **0PASS/5FAIL→5PASS**, pr65-identity-after.log. 계약6/6·build/변경JS구문/diff PASS, source/build navigation hash BA1F283286AE62041C637DA0191B6BAEC75685825119479557DEFB1D1A27F6D8 일치. 미디어/Stories/adapter/ledger/Reels/Explore source blob이 시작HEAD와 동일함을 대조했다. 새 원격CI는 게시 후 별도 확인하며 이전250을 새 소스 근거로 소급하지 않는다.
- 변경3파일 예정: navigation-surface.mjs, instagram-explore-browser.test.mjs, 작업카드. RC2 05_Content_Event_UI/feature-registry IG03 AC-IG-03-01~03의 검색 보존·동적 OFF·다른 owner 보존 기준. Core/Server/Wire/제품Manifest 및 #58/#64 소스 수정 없음. 실제 Core/MV3/Native/Server 제품 수용 NOT_RUN, MVP_FINAL_COMPLETE=false.


## 2026-11-01 #65 후속 브랜치 P2 상속

- 시작bb88f7e878a466491fd6f5293e9775e0866a3f6b, codex/content-instagram-explore. 수정된 #64 HEAD98bca66a0a5ceb92c13fe334586fea314577ce45를 이력 보존 로컬 merge로 반영했다. 생산 코드 자동 결합, 작업카드 prepend 충돌은 양쪽 기록 모두 보존. #65 고유 selector/search 보존·conceal/로딩/버튼은 변경하지 않는다. 전체 Content **250/250 PASS**(127.6초, fail/skip0)·계약6/6·build/구문/diff PASS, pr65-inherit-regression.log. #64 CI41263964006/job124722761125 원본239/239+계약6 SUCCESS 확인. #61 고유 Stories 시험/#64 Stories wrapper와 #65 탐색/ledger/bootstrap/popup의 기존 blob을 대조해 보존 확인했다. #65 새 원격 CI는 게시 후 별도 확인한다. 이를 확인 후 게시하며 PR Merge/Approve/Resolve/force push 없음.


## 2026-11-01 PR #64 공유 media P2 2건 수정

- 시작7e271c87ed89f62c9bb4f65796b439524a8d5954, codex/content-instagram-reels. #58 수정21654f0을 상속한 #61의1386e1865f50ce17a1acab8c572c3d919fdbf71d를 로컬 merge했다. 예상 충돌은 작업카드 prepend와 Stories→shared media 추출 경계였다. Stories wrapper/selector는 원래 #64 그대로 보존하고 #58의 release 수정만 instagram-media.mjs로 옮겼다. NavigationSurface.close는 선행 수정 그대로 상속한다. 별도 중복 구현이나 기존 scan/invalidate P2 재개발 없음.
- 정확한 수정 전 #64 archive에 새 반례9건: **3PASS/6FAIL**. IG01/IG02 해제 후 두 번째 pause1회, play guard release의 adapter 전체닫힘, 양쪽 feature 독립 유지 실패를 재현했다. 부분 복원/후속 retry 및 실제 권한 회수의 전체닫힘은 원래 PASS. 로그 pr64-feature-release-before.log, 합성 Chrome/모의 pause·권한이다.
- shared media release 즉시 #stop(local)으로 media open/play listener를 닫는다. surface 또는 media busy일 때 restored:false/pending을 유지하되 전역 invalidation을 부르지 않는다. 후속 release는 원래 claim/목표/다른 owner를 보존해 실제로 정리한다. 전체 authority/pagehide의 stop/invalidate는 유지.
- 신규 공통 반례파일은 #58의3건을 상속해 IG02 같은3건과 양방향 다른 feature 보존2건·실제 권한 회수/외부 owner 보존1건을 추가했다. #64 동일 새 반례 **9/9 PASS**, 전체 Content **239/239 PASS**(113.6초), 계약6/6·build/구문/diff PASS. 로그 pr64-feature-release-focused.log/pr64-feature-release-regression.log. #58 CI41263596433/job124721658844 원본218/218+계약6, #61 CI41263744789/job124722101375 원본220/220+계약6 성공 확인. #64 수정 후 원격 CI는 별도 확인한다. 독립 재리뷰/원격CI는 별도이며 제품Core/MV3/Native/Server 수용 NOT_RUN, MVP_FINAL_COMPLETE=false.


## 2026-11-01 #61 선행 P2 반영

- #58 수정21654f086b081067b01b9d2982620f0a56f71000을 #61의 기존2e7fe758 위에 이력 보존 로컬 merge로 반영. 제품 소스는 자동 결합됐고 작업카드 충돌만 양측 기록을 모두 보존해 정리했다. #61 고유 contenteditable 감시와 양방향 반례2건은 변경하지 않았다. PR 병합/force push/별도 기능 구현 없음. IG·adapter·새 release 반례 **59/59 PASS**, fail/skip0, pr61-inherit-focused.log. build/diff PASS. #58 CI run41263596433 SUCCESS 확인(직접 전체218과 별도). #61 전체 전수는 원격 CI에서 별도로 확인하며 로컬59를220으로 합산하지 않는다.


## 2026-11-01 PR #58 IG 기능별 release P2 수정

- 담당 채지민, feature/content-session-adapter, 시작62a4233aab9a45ade36b4ec308dbe5b1f8290306. 원격 #58/#61/#64/#65 HEAD/base와 일치, 기존 clean 브랜치에서 진행. 기존 scan/invalidate·claim 누락 P2는 해결된 상태로 재사용하며 새 releaseFeature 경계만 수정한다.
- 수정 전 새 Chrome 합성 반례3건 중1PASS/2FAIL: IG01 첫 pause 콜백의 releaseFeature 이후 다음 pause1회, play guard 재진입 release가 adapter.closed=true로 전파. 부분 cleanup/후속 retry 반례는 원래 PASS. 로그 pr58-feature-release-before.log. media.pause/paused와 권한은 모의이며 실제 오디오/MV3 수용 아님.
- InstagramStoriesSession.release는 surface 복원 결과를 기다리기 전 로컬 media open을 닫고 replay listener를 제거한다. 바깥 pause 이후 #canApply/open 확인에서 다음 pause와 성공 관찰을 차단한다. busy release는 권한 회수 stop 대신 NavigationSurfaceSession.close(새 효과·observer/event만 닫음, invalidation 콜백 없음)를 호출해 feature-local pending을 반환한다. claim/복원 목표/LIVE 의무는 explicit release retry까지 유지한다. adapter 전체 invalidate·다른 owner ledger를 닫지 않는다.
- 기능 해제 중 replay guard 유지라는 과거 주석/의도보다 새 효과0이라는 이번 수정 기준을 우선한다. 이미 남은 DOM/inert claim과 실패 복원 의무는 삭제하지 않으며 cleanup 미완료를 RELEASED로 승격하지 않는다. 실제 전체 revoke/pagehide의 stop/invalidate는 그대로 유지한다.
- 변경: instagram-stories.mjs, navigation-surface.mjs, 신규 instagram-feature-release-browser.test.mjs, 이 작업카드. #58 공통 수정을 #61에 반영한 뒤 #64의 추출된 instagram-media.mjs로 동일하게 이관한다. #65는 새 #64를 상속하도록 순차 반영하며 force push/PR 병합하지 않는다.
- 수정 후 전체 Content **218/218 PASS**, fail/skip0(107.6초), 신규3 포함. 계약6/6·build/diff PASS. 변경JS구문 확인 후 게시한다. 로그 pr58-feature-release-after.log. 수정 전1PASS/2FAIL→수정 후 신규3PASS이며 기존215/230 CI를 수정 후 PASS로 재사용하지 않는다. 원격 CI는 게시 후 별도로 확인한다. 제품 Core/MV3/Native/Server 수용 NOT_RUN, MVP_FINAL_COMPLETE=false.


## 2026-11-01 IG-03 탐색 · 사용자 재시험 정상 / 게시 준비

### 목록 로딩 잔여 보완

- 최신 사용자 실행 근거: 0.1.5에서 게시물/로딩 표시 숨김·검색 유지·해제 후 복원을 사용자가 “ㅇㅋ 문제없네”로 정상 보고했다. 최초 검색 소실/로딩 잔여 실패 이력과 구분한다. 실제 네트워크 요청 반복 여부·전체 성능/모든 계정 DOM·제품 Core 수용은 미검증이다. 이번 게시 준비는 기록만 갱신하며 자동시험을 다시 실행한 것으로 표시하지 않는다.

- 사용자 0.1.4 실제 결과: EXPLORE eligible/restricted18/18·errors0, 목록은 숨겨졌으나 로딩 표시가 계속 보임. 해제 후 정상 복원은 사용자가 확인했다. 실제 network request 반복/로딩 DOM 원문은 미확보이므로 무한 요청 발생을 확정하지 않는다.
- 원인 후보의 최소 대응: 카드 display:none으로 인한 목록 높이 축소를 피하도록 IG03 profile만 preserveLayout으로 적용한다. ClaimLedger.conceal은 opacity:0!important+inert를 기존 property별 ownership/pending 복원 경로로 관리하고 computed opacity를 확인한다. 자손 visibility override로 노출되지 않도록 opacity를 쓴다. 기존 hide/grayscale 호출 의미는 유지한다. 이는 화면 숨김이며 네트워크/API 차단 구현이 아니다.
- 정확한 /explore/에서 카드가 확인되는 main의 role=progressbar만 같은 claim 방식으로 숨긴다. 검색/dialog/form/FOCURVE 영역·카드 없는 최초 loading은 보존한다. 표시 역할이 다른 실제 Instagram spinner의 지원은 사용자 재확인 전 미검증이다.
- 신규 합성 반례: 숨김 전후 main 높이 동일, 목록 로딩만 숨김/검색 로딩 보존, 원래 opacity priority/inert 복원, 다른 owner·페이지 opacity 변경 보존, 최초 로딩 유지. 공유 ledger 확장 후 전체 Content 회귀 **241/241 PASS**, fail/skip0, 124.2초, ig-explore-loading-regression.log 보존. 계약6/6·변경JS구문 PASS. 마지막 0.1.5/build ig-explore-layout-3 표기와 설명만 변경 후 build/diff 검사하며 기능 시험을 새로 실행한 것으로 주장하지 않는다. 검색 전회 실패와 이번 로딩 이력을 지우거나 기존77/9PASS를 최종 전수로 바꾸지 않는다.
- 재시험 범위: 0.1.5에서 목록 적용 후 로딩 표시/목록 미노출, 검색 가능, 해제 후 카드/원래 화면 복원. 실제 요청 반복·CPU/장시간 성능은 미검증. Core·Server·Wire·제품 Manifest 변경/Commit/Push/Merge 없음.


- 사용자 실제 실패: 홈 적용 후 검색 메뉴가 사라짐. 기존 설명의 검색/탐색 메뉴가 항상 별도라는 전제는 잘못이며 원본 DOM은 아직 미확보다. exact /explore/만으로 모든 링크를 숨기는 소스의 과대 판별을 확인했다. 같은 href+Search/검색 label 및 불명 링크를 추가한 합성 반례는 수정 전 FAIL(true!==false) → 수정 후 PASS. 실제 DOM이 해당 shape인지는 단정하지 않고 사용자 재시험으로 확인한다.
- 수정: route와 명시적 탐색 identity(aria-label/title/svg title·label/aria-labelledby/text)를 함께 요구, Search/검색 표시가 하나라도 있으면 보존, 불명 메뉴도 보존한다. 직접 /explore/ 카드 제한은 유지한다. 시험판0.1.4/build ig-explore-search-fix-2로 구분하고 EXPLORE page_kind 수정. 최종 탐색9/9 PASS, 변경JS구문/build/diff PASS. 이전77은 당시 범위 기록이며 최신78 전수 실행으로 합산하지 않는다. 사용자 검색 복원·실제 검색/목록 확인 대기.

- 담당 채지민, 브랜치 `codex/content-instagram-explore`, 시작 `7e271c87ed89f62c9bb4f65796b439524a8d5954`(#64). 같은 clean Worktree에서 별도 브랜치를 생성했다. 릴스/기존 스토리/adapter·P2 수정 Commit 보존. #64를 선행으로 하며 현재 통합/병합 상태를 완료로 추정하지 않는다.
- 기준 `docs/design/additional-mvp-contracts/05_Content_Event_UI.md`의 IG03 explore-only/search 제외, `contracts/additional-mvp/rc1/feature-registry.json` IG-03 / AC-IG-03-01~03. 탐색 메뉴의 exact local /explore/ 링크와 직접 /explore/ main 내부 p/reel 카드 링크를 제한한다. 검색 경로·q/query 조회·dialog/search/form/편집기·DM/FOCURVE 보호, 일반 profile/post/home 목록은 변경하지 않는다. 전체 main/nav를 숨기거나 텍스트/휘발 class로 판별하지 않는다.
- 재사용: NavigationSurfaceSession의 same-document 명시 재승인/claim 정리/중단/부분 실패 보존. IG-03 profile 등록과 Session adapter factory 추가, 기존 API/Wire/Core/Server/제품 Manifest 변경 없음. DOM 목록 숨김이며 일반 영상 재생 설정/미디어 pause는 변경하지 않는다. 실제 selector 변형은 사용자 확인 전 미검증이다.
- 시험 확장 0.1.3 `FOCURVE 탐색 시험판 — Core 미연결`, 팝업 최상단 탐색 적용/해제/상태 추가. 기존 모든 버튼·버튼 아래 결과/복사 유지. build 경로는 content-resume-20261101의 기존 unpacked 폴더 그대로다. TEST 전용 authority 재승인/새로고침 초기화, 제품 권한/영속 증거 아님.
- 검증 진행: exact 메뉴/grid·검색/일반 화면 보존, 동적 href/카드·다중 owner·SPA 승인/거절·pagehide·부분 복원/재시도·adapter/TEST sender gate 브라우저 반례8건 및 기존 adapter 회귀. 실제 실행 결과는 아래 최종 절에 기록한다.
- 최종 직접 실행: 탐색8+기존 adapter31 = **39/39 PASS**, 기존 Stories25+Reels13 = **38/38 PASS**, 서로 다른4파일 총77건 fail/skip0. 로그 ig-explore-focused.log/ig-explore-regression.log. 계약 legacy-boundary **6/6 PASS**, 변경JS5파일 --check/build/git diff --check 성공. Node24/설치Chrome/Playwright route.fulfill 합성 DOM·모의 권한/미디어이며 실제 서비스/MV3 제품 수용이 아니다. module/build SHA256 87E926A1567538C9D79AD521A00D8D9C1E2E4A3E84E997858D4FFA06767DEDFD 일치. 이전230/217을 최신 전체 전수시험으로 소급하지 않는다.
- 최초 사용자 시험 계획(현재 최신 보고는 위 절): 홈 적용 시 탐색 메뉴만 숨김/검색 유지, 직접 /explore/ 적용 시 카드 숨김/현재 페이지 유지, 지원 SPA 이동 재등장 제한, 해제 후 메뉴/목록 복원, 일반 게시물/프로필/DM 유지. 목록이 남거나 FAILED는 성공으로 체크하지 않는다. 새로고침 후 다시 적용한다.
- 제품 Core issued/native/full scope·효과 전 영속 ACK·cleanup lease·제품 결과 저장/새 문서/BFCache 재결속은 미연결. 실제 Chrome 사용자 결과는 위 국소 범위만 정상 보고이며 Server/Core 제품 통합은 NOT_RUN. IG04/05/06·키워드·블러는 이번 범위 밖. Commit/Push/PR/Merge 없음, `MVP_FINAL_COMPLETE=false`.

## 2026-11-01 IG-02 Reels 첫 독립 구현 · 사용자 시험 정상 / 게시 준비

- 사용자 상태 확인 개선: 시험 확장 이름/버전을 FOCURVE 릴스 시험판 0.1.2로 구분하고 릴스 버튼을 최상단으로 옮겼다. popup.js는 누른 명령 버튼 바로 아래 결과 패널/상태 복사를 표시하고 action·checked_at·원본 response 또는 연결 error/hint를 JSON으로 제공한다. 최신 요청만 표시하며 URL/본문을 추가 수집하지 않는다. clipboard 실패 시 선택+Ctrl+C 안내, 별도 권한 추가 없음. 설치 Chrome 합성 popup에서 위치/실패 응답 JSON 복사/연결 오류 표시 검증 PASS, 구문/build PASS. 이전230은 DOM 기능 소스 근거이며 이 UI 변경 후 전체 재실행으로 주장하지 않는다.

- 담당 채지민, 브랜치 `codex/content-instagram-reels`, Worktree는 위 인수 공간 `content-resume-20261101` 재사용. 시작 HEAD `2e7fe7582d343c98e12f4a1f8f0fba33a087e251`(#61). #54→#56→#57→#58→#61 선행 코드 보존, 기존 브랜치 Commit을 중복 적용하지 않는다. 현재 작업카드의 인수 기록도 함께 보존한다.
- 기준: `docs/design/additional-mvp-contracts/05_Content_Event_UI.md`의 16옵션/미디어·복원 증거, `contracts/additional-mvp/rc1/feature-registry.json` IG-02와 AC-IG-02-01~03. 정확한 릴스 링크(/reel/id, /reels 및 /reels/id)·미리보기와 직접 main/dialog 영상·오디오만 제한한다. 일반 피드 수동 영상·스토리·DM·제어 버튼·FOCURVE UI를 유지한다. 사용자가 아래 5항목을 정상으로 보고했으며 모든 계정/DOM 변형 검증은 아니다.
- 재사용: 스토리의 pause/play guard·중단 fence·재진입 release·retryable cleanup을 `instagram-media.mjs`로 추출, 기존 Stories wrapper/profile 유지. Reels는 별도 collect/media profile이며 IG-02를 navigation 및 Session adapter에 연결했다. Core 생산 코드/권한 발급/저장/Server/계약/제품 Manifest는 변경하지 않는다. 실제 Core 공급 없는 상태에서 OBSERVED를 제품 APPLIED로 전환하지 않는다.
- 직접 viewer의 media 0은 OBSERVING/route block false, pause 실패 또는 DOM 제한 실패는 성공 증거 금지. entry 링크 안의 preview media도 pause하며 일반 게시물 영상은 건드리지 않는다. 해제 후 자동 play/unmute/seek를 하지 않는다. 같은 문서 이동은 명시적 재승인을 요구하고 pagehide/권한 회수 시 닫힌 scope를 자동 재개하지 않는다.
- 시험판: 기존 popup에 릴스 적용/해제/상태 3버튼만 추가(총35), TEST popup sender gate 유지, build `ig-reels-1`. 새 unpacked 경로 `C:/Users/user/Documents/capstone-project/.worktrees/content-resume-20261101/extension/build/content-harness`. 이전 additional-mvp-content 폴더의 확장 reload만으로 이 변경이 들어오지 않는다. 기존 시험 확장을 끄고 새 경로를 로드한 뒤 Instagram 새로고침이 필요하다. 제품 sender/native 검증이 아닌 모의 콜백이다.
- 개발 중 추출 치환의 private field 구문 오류로 최초 실행이 실패해 수정했다. 이후 고정 소스의 Reels10+Stories25+adapter31 **66/66 PASS**. 추가로 DOM 실패 허위 성공 방지·pause 중 release pending·실제 TEST bootstrap sender/릴스 적용·해제 반례3건을 추가했다. 최초 실패를 원래 기능의 회귀 완료나 수정 전 취약성 재현으로 부르지 않는다.
- 최종 전체 Content 회귀 `node --test --test-concurrency=2 extension/content-tests/*.test.mjs`는 **230/230 PASS**, fail/skip0(109.9초), `reels-regression.log`에 보존했다. Reels13/Stories25/adapter31을 포함하므로 이전66 및 계약6과 합산하지 않는다. `reels-focused.log`는 이전66 실행으로 별도 보존한다. 계약6/6, 관련7JS syntax, harness build·git diff --check 성공. 원본/빌드 Reels SHA256 `F5AB205C17DC6207105D1E7EACFF4879D07211A64E7167E40BB42D2A3390C701` 일치 확인. Windows Node24/설치 Chrome/Playwright, route.fulfill 합성 DOM·모의 authority 및 pause/paused이며 실제 서비스/오디오/MV3 수용으로 확대하지 않는다.
- 사용자 실제 Chrome 실행 결과: 아래 5항목 모두 정상을 보고했다(“ㅇㅋ 다 정상이야”). 자동시험과 구분하며 독립 수용 로그는 아니다. 체크 항목: (1) 릴스 메뉴/미리보기 숨김과 해제 (2) 직접 릴스 영상 표시·재생·소리 제한 (3) 같은 문서의 다음 릴스 이동/재등장에도 유지 (4) 일반 게시물 영상·스토리·DM 보존 (5) 해제 후 표시·직접 재생 가능. 실제 viewer가 남거나 OBSERVING/NO_TARGET/FAILED이면 성공으로 체크하지 않는다. 전체 새로고침은 시험판 적용이 초기화되므로 다시 적용한다.
- 실제 Core issued/native/frozen/full scope, 효과 전 영속 의무 ACK, cleanup lease/prior footprint, 결과 영속 조회, 새 문서·BFCache 재결속/재적용 및 제품 START/END/복원/오디오 수용은 미완료. 다른 IG4옵션/키워드/블러는 이번 범위 밖. 사용자 시험 정상 보고 후 게시 준비 승인. Commit/Push는 별도 승인창으로 진행하며 Merge는 하지 않는다. `MVP_FINAL_COMPLETE=false`.

## 2026-11-01 채지민 개발 인수 확인

- 담당 채지민. 인수 브랜치 `codex/content-resume-20261101`, Worktree `C:/Users/user/Documents/capstone-project/.worktrees/content-resume-20261101`, 시작 HEAD `2e7fe7582d343c98e12f4a1f8f0fba33a087e251`(#61). 다훈 PC의 Worktree는 이 PC에 없으므로 새 공간이 필요했다. 기존 로컬 Content 브랜치와 root의 OPTION-11/통합현황/image-filter-demo 변경을 보존했다. 원격 fetch 후 실제 PR HEAD/base를 대조했다.
- 원격 #54 `670647f41f4e9b9c2380faede496815aa2f3d6a8` → #56 `08730c86d91d0b1d3790bc5fafc7a7ca9195ece8` → #57 `02a653fb60e671dcf997951b220708ea146b4a7a` → #58 `62a4233aab9a45ade36b4ec308dbe5b1f8290306` → #61의 의존성 유지. 다섯 PR 모두 OPEN/Draft/미병합, 조회 시 GitHub mergeable=true였다. 이는 미래 통합 충돌 없음이나 승인 완료를 뜻하지 않는다. #57/#58/#61 자체 diff는 각각 3/11/3파일이고 각 base가 직전 PR HEAD와 일치한다. 중복 patch 적용/기존 브랜치 수정 없음.
- 인계 완료 범위: IG alt/draggable 및 contenteditable 동적 적격 감시, YouTube 비Shorts 9옵션·IG stories 조합 adapter, frozen 옵션 복사/기능별 해제/다중 owner/중단 중 scan fence/재시도 가능한 cleanup. #58은 수정 전 리뷰가 최신 HEAD의 독립 재승인이 아니므로 통합 담당 재리뷰 대기 상태를 유지한다.
- 실제 최신 통합 `24327d1bd8615a2274a6dead43f23b71cc06b64e`에서 `extension/member-a1/content.mjs`의 handle/scope/perform과 schema의 Shorts 한정을 재확인했다. extension 생산 코드에서 AMVP_CONTENT_2 발급/수신 경로는 확인되지 않았고 관련 registry는 contracts의 시험 참조 모델이다. 추가 adapter에 기존 Shorts 권한을 전용하지 않는다.
- 필요한 Core 공급: issued Control/Projection/full BindingScope, 실제 native document·generation의 current 확인, 효과 이전 영속 cleanup 예약 ACK, prior footprint·cleanup lease, 관찰/복원 결과 저장·조회. Content는 검증된 입력과 ACK 이후 기존 Session 조합/결과 반환을 연결한다. 해당 공급 없는 제품 listener/성공 Receipt를 만들지 않는다.
- 직접 실행: 기존 Node runtime·설치 Chrome·Playwright, PLAYWRIGHT_MODULE/CHROME_EXECUTABLE 지정 후 `node --test --test-concurrency=2 extension/content-tests/instagram-stories-browser.test.mjs extension/content-tests/session-adapter-browser.test.mjs` **56/56 PASS**, fail/skip0, exit0. `node --test contracts/additional-mvp/rc1/tests/legacy-boundary.test.mjs` **6/6 PASS**, exit0. 실제 Chrome 엔진의 route.fulfill 합성 DOM/모의 권한·일부 media 상태이며 실제 서비스/MV3 제품 수용이 아니다. 다훈의 과거183/215/217 및 CI 보고를 이번 독립 전수 실행으로 바꾸지 않는다.
- 다음 독립 개발 우선순위: IG-02 Reels 제한·복원을 작은 기능 단위로 진행하고 기존 ledger/중단 fence/adapter를 재사용한다. 나머지 Instagram 4옵션·URL 키워드/블러는 후속이며 이번 인수에서 새로 구현하지 않았다. 실제 Core 연결은 위 공급 확인이 선행한다.
- 제품 미검증: issued/native/영속 cleanup·lease 연결, 새 문서/SPA/BFCache 재결속·재적용, 정상 START/END·실제 오디오/복원/재기동. 인수 기록 외 제품 수정·Commit/Push/Approve/Merge 없음. `MVP_FINAL_COMPLETE=false`.

## 2026-10-31 야간 지속 · IG editable 전환 관찰

- #58 P2는 실제 최신 `62a4233aab9a45ade36b4ec308dbe5b1f8290306`/원격 CI215+계약6 SUCCESS 상태를 다시 확인했다. 소스/의존성 불변인 P2 시험은 재실행하지 않고 그대로 재사용한다. 기존 #54/#56/#57/#58 브랜치를 변경하지 않는다.
- 이번 독립 단위는 `fix/ig-story-editability-observer`, Worktree `ig-story-editability`, base `feature/content-session-adapter`의 위 full SHA. #58 미병합에 의존하므로 해당 브랜치를 base로 별도 Draft PR을 제출하며, integration에 독립 병합하면 선행 변경까지 포함됨을 명시한다. 새 full HEAD/PR/CI/절대 Worktree/실행 소유권은 이 채팅 artifact 루트 `content-nightly-checkpoint.json`과 PR 최종 기록에 보존한다.
- 확인된 실제 소스 결함: `instagram-stories.mjs`의 portrait-frame fallback은 내부 `[contenteditable="true"]`가 있으면 대상을 제외하지만 공유 navigation observer는 이 속성을 감시하지 않았다. 같은 DOM에서 caption 편집 종료 후 적격 전환과 편집 시작 후 대상 해제가 모두 자동 반영되지 않는다. 기존 alt/draggable 수정의 재구현이 아니다.
- 최소 수정: navigation-surface.mjs의 **IG-01 전용** attributeFilter에 contenteditable만 추가했다. 기존 selector·다른 owner/ClaimLedger·Session·Core/Server/계약·YouTube observer 목록은 변경하지 않는다. 신규 시험은 수동scan 없이 caption true→false에서 제한, false→true에서 자기 claim 회수·다른 owner 유지·최종 display:flex!important 복원을 확인한다.
- 같은 설치 Chrome 합성 DOM 반례 **수정 전0 PASS/2 FAIL(exit1 timeout) → 수정 후 PASS**. IG25+adapter31 직접 영향 **56/56 PASS(exit0)**, 계약 legacy-boundary **6/6 PASS(exit0)**, 구문/build/diff check PASS(exit0). 이전 #58의215는 동일 Content 기반의 참고/재사용 근거이며 신규2와 합산한 로컬217 실행을 주장하지 않는다. 새 PR CI에서 전체217을 별도 확인한다.
- 환경 Windows Node24.19.0/설치 Chrome156.0.8078.76 headless/Playwright1.62.1, 전 요청 route.fulfill fixture. 실제 Instagram 로그인/개인정보·HOLD Chrome/프로필/설치/Native/DB는 사용하지 않았다. 증거: 채팅 artifact 루트 `ig-editability-before.log`, `ig-editability-regression.log`, `ig-editability-contract.log`; 명령은 `--test-name-pattern='IG portrait frame'`의 IG 단독, IG+session-adapter browser2파일, legacy-boundary, build-chrome-harness, 변경JS `--check`, `git diff --check`이다.
- 예약: 동일 Content 채팅 예약은 없었으며 기존 통합 예약 focurve-2는 변경하지 않았다. 도구 등록으로 **focurve-content ACTIVE**, target thread `01a191b6-1724-73b2-b0e1-0149c53fba64`, 이번 밤 **2026-10-31 22:00~2026-11-01 07:59 KST 매시 정각**만 실행한다. 기존 장기 예약의 종료일/범위를 가져오지 않는다. 체크포인트 active=true인 기존 실행에는 중복 진입하지 않으며, stale 소유권도 근거 없이 삭제하지 않는다. 현재 검증용 장기 서비스는 없고 각 시험 프로세스는 종료됐다. 종료 시 체크포인트를 idle로 갱신해야 한다.

### 실제 Core 연결 확인과 남은 BLOCKED

- 최신 통합 기준을 실제 재조회한 SHA는 `24327d1bd8615a2274a6dead43f23b71cc06b64e`. 그 SHA의 `extension/member-a1/content.mjs` A1Content.handle/scope/perform과 현 Source의 `A1Client.read/commit`은 기존 d06-member-a1-1 / Shorts effect 경로다. `extension/member-a1/schema.json` projection.feature_code는 YOUTUBE_SHORTS로 한정되어 추가 옵션의 AMVP_CONTENT_2 수신기로 그대로 연결할 수 없다. 이 기존 경로를 임의 확장하거나 새 발급/저장 성공을 만들어내지 않았다.
- 승인된 RC2 원문은 `contracts/additional-mvp/rc1/schema.json`의 BindingScope/Projection/ContentResult/EffectEvidence이다. BindingScope에 owner_epoch/executor/runtime_execution/package/runtime_revision/scope_epoch/generation/tab/frame/document/document_instance/url_sha256/focus_ref가 필요하다. ContentResult에는 issued request_id/operation_id/semantic_sha256/control_seq와 full scope/effects/remaining_claim_count/footprint_sha256/observed_at/error_code가 필요하다. adapter의 두 claim ID와 국소 counts만으로 이 필드를 채우지 않는다.
- 실제 제공 대기: scan/DOM 효과 **전** 검증된 issued Control+Projection과 current native/document/generation 확인 closure, 영속 복원 예약 ACK 및 정당한 prior footprint/cleanup lease, 결과 저장·재조회/검증 호출. `contracts/additional-mvp/rc1/tests/review_reference.py:306`의 ContentOperationRegistry.issue(control, prior_claims, prior_footprint_sha256)/validate(result)는 **시험 참조 모델**이며 생산 Core 발급기/저장기가 아니다. 그 함수를 생산 성공처럼 호출하거나 복제하지 않는다.
- 다음 실행은 우선 새 PR CI/실제 HEAD·원격 변경·추가 독립 리뷰를 확인한다. 이 결함과 #58 검증을 조건 변화 없이 반복하지 않는다. 새로 확인된 Content 결함 또는 실제 Core 공급 함수가 있으면 해당 독립 단위로 이어간다. 현재 확인된 다른 안전한 미완료 구현이 없으면 별도 기능/시험/PR로 시간을 채우지 않고 이 BLOCKED와 체크포인트를 보존해 종료한다. 독립 리뷰/병합은 「추가 MVP 기능별 통합 및 회귀」 담당이며 이 채팅은 Approve/Draft해제/Resolve/Merge하지 않는다.
- 인계: 채지민은 portrait-frame editability에 따른 동적 적격 변화와 기존 다중 owner/취소·복원 경계를 함께 보존한다. local_only/native_verified:false 및 UNKNOWN/미해소 cleanup 의미 유지. 실제 Chrome 제품/Core/Native/Server/오디오/BFCache/정상 END·복원·재기동 수용 NOT_RUN, `MVP_FINAL_COMPLETE=false`.

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

### 2026-11-01 IG-04 사용자 재시험: 답글 토글·릴스 행 외곽 보완
- 사용자 화면에서 답글 보기(N개), 릴스 댓글 avatar/heart 잔류 확인. reply toggle의 괄호 개수 형식을 추가하고 독립 control도 claim한다. 정확한 comment permalink를 가진 행은 동일 identity wrapper 안에서 avatar/heart까지 확장하되 다른 행·본문·닫기·영상 좋아요는 제외한다. Core/공용 계약 변경 없음.
- 중간 검사에서 protected UI 및 recycled 행 경계 회귀를 발견해 확장 guard를 보완했다. 최종 댓글 시험24/24 PASS, 계약6/6 PASS, build/diff 검사 PASS. 설치 Chrome headless 합성 DOM/모의 권한이다. 이전 전체277은 이전 소스 근거이며 이번 전체 회귀 재실행으로 표시하지 않는다.
- 시험판0.1.9, test_build ig-comments-controls-4. 실제 Instagram 사용자 재시험 대기; 제품 Core/MV3/Native/Server NOT_RUN. Commit/Push 없음. MVP_FINAL_COMPLETE=false.

### 2026-11-01 IG-04 사용자 최종 확인
- 사용자가 시험판0.1.9 보완 후 '문제 없네'로 정상 보고. 직전 안내한 댓글/GIF/답글/프로필/댓글 하트/답글보기 숨김, 영상·게시자·영상 좋아요·닫기 보존 및 해제 복원의 사용자 실행 결과로 기록한다. 에이전트 직접 실제 Instagram 시험이나 Core 통합 성공으로 승격하지 않는다.
- 게시 준비: IG04 module/24개 시험, 기존 observer·adapter 등록, TEST harness 및 본 기록의9파일만 포함한다. 선행 #65(4daf3d3)와 #64→#61→#58 의존성을 유지한다. 실제 issued/native·영속 cleanup·제품Core/MV3/Server 수용 NOT_RUN, MVP_FINAL_COMPLETE=false.
- 게시 직전 최종 전체 Content 회귀279/279 PASS(댓글24 포함), 실패/skip0. Node24·설치 Chrome headless/Playwright 합성 DOM·모의 권한. 명령 node --test --test-concurrency=2 extension/content-tests/*.test.mjs, 로그 ig-comments-publish-regression.log. 계약6/6·빌드·diff 검사 PASS. 원격 CI는 Push 후 별도 확인 대상이다.

### 2026-11-01 PR71 P2 mixed listitem 경계 수정·사용자 시험 준비
- 담당 채지민, codex/content-instagram-comments, 시작2a22fcb82af5249e2dc23c92bea547fc0eeef0d4 / PR71 discussion4434481327. 선행 #65(4daf3d3) 그대로, 다른 branch/worktree 보존. 기준 IG04/AC-IG-04-01~03 및 RC2 05_Content_Event_UI: 댓글만 제한하고 게시물 사진/본문/게시자/영상 좋아요·미디어 보존, 자기 claim 해제/복원.
- 원인: comment permalink의 closest li/role=listitem을 무조건 댓글 행으로 반환해 mixed post까지 hide/inert. 리뷰는 jsdom 합성 반례였으며 실제 사용자 Instagram 버그 관측으로 바꿔 기록하지 않는다. 설치 Chrome 합성 DOM에서 LI/role=listitem × 좁은 댓글 증거 없음/검증된 DIV 댓글 혼합4건을 수정 전0PASS/4FAIL로 독립 재현(ig-comments-post-before.log).
- 변경: semantic shortcut은 고유 comment identity와 direct inline 구조·안전 경계를 갖춘 좁은 행에만 허용. 이미지/p/button/중첩 container 등을 가진 listitem은 자동 채택하지 않고 기존 DIV 증거 경로로 검증된 좁은 댓글만 찾는다. 명확하지 않으면 NO_TARGET이며 게시물 전체를 감추지 않는다. 기존 단순LI·GIF/답글·프로필/댓글 하트·토글·owner/cleanup 의미 보존.
- 수정 후 기존24+mixed4=댓글28/28 PASS. 이어서 inline행→mixed post 재활용 시 자기 claim 회수/다른 owner 보존/원래 display 복원1건을 추가하고 전체 Content 회귀 실행 중. 계약6/6·build·효과 모듈 구문·diff PASS. 최신 시험판0.1.10/test_build ig-comments-post-boundary-5. 실제 사용자 재시험/새 HEAD CI는 아직 미실행. Commit/Push/Approve/Merge 없음. 제품Core/MV3/Native/Server NOT_RUN, MVP_FINAL_COMPLETE=false.
- 최종 Node24·설치 Windows Chrome headless/Playwright 합성 DOM 전체 Content284/284 PASS(댓글29 포함), fail/skip0. 명령 기존 PLAYWRIGHT_MODULE/CHROME_EXECUTABLE 설정 후 node --test --test-concurrency=2 extension/content-tests/*.test.mjs, 로그 ig-comments-post-full.log. 혼합4반례0/4→4/4, 동적 재활용1/1 및 기존24댓글·다른 Content 기능 보존. 계약6/6/build/구문/diff 별도PASS. 문서 추가 후 기능 소스 변경 없음. 다음 사용자0.1.10 실제 게시물/릴스 제한·복원 확인→게시 승인→같은PR71 Push/새HEAD CI/다훈 재검토.
- 사용자0.1.10 첫 화면은 댓글이 남았고 OBSERVED1/1(errors0) 보고. 이후 제공 HTML과 화면 postID가 달라 같은 대상을 확정하지 못했으며 추가 상태9/9도 시각 정상으로 승격하지 않는다. 제공 HTML의 구조(aria-disabled avatar button/linked avatar/H3/body BR/time permalink/Like+Reply)를 익명 fixture로 추가해 mixed post 보존·행 제한·복원 PASS. 실제 계정/본문/CDN 원문은 저장하지 않는다.
- 이번 단계에서 추가 제품 selector 수정은 하지 않았다. 제공 행 구조는 기존 P2 수정 소스에서 이미 제한되므로 실제 누락 원인을 추정해 넓은 listitem 선택을 되돌리지 않는다. TEST harness에 현재 post와 일치하는 댓글 permalink 수/실제 표시된 permalink 수만 추가해 실제 DOM과 URL 불일치/후보 누락을 구분한다. URL/계정/본문 반환 없음. sender gate 유지.
- 댓글 최종30/30 PASS(기존29+제공 구조1, TEST diagnostics 적용/해제 개수 검사 포함), build/diff PASS. 앞선 전체284는 제품 소스 동일성으로 과거 근거 유지; 현재 전체285 실행으로 표시하지 않는다. 시험판0.1.11/ig-comments-post-check-6. 다음 동일 화면에서 적용·시각 확인·상태 diagnostics 확인 필요. 미커밋/미게시 유지.

### 2026-11-01 IG04 P2 수정 후 semantic 댓글 행 누락 보완
- 사용자0.1.11: Reels 댓글 일부/profile 잔류와 일반 게시물 댓글 목록 미제한. 상태OBSERVED92/92/errors0이나 현재 post permalink48개 중 표시1개. 전체수용FAIL로 유지하며 eligible 수만으로 성공 판정하지 않는다.
- P2 수정의 inline-only semantic shortcut이 정상적인 중첩 LI/role=listitem 댓글도 제외할 수 있음을 별도 익명2반례로 확인(수정 전0PASS/2FAIL). 실제 사용자 전체 DOM이 이 구조와 동일하다고 단정하지 않는다. 사진/본문을 가진 mixed post를 무조건 선택하던 구형 동작은 복구하지 않는다.
- rich semantic 행에 exact 단일 comment/time+profile+본문+명시Reply 근거를 요구하고, p/picture/중첩listitem/입력창/미디어/본문 이미지·복수댓글 조상을 제외해 검증된 댓글만 제한한다. 프로필·댓글 하트는 같은 행에서 처리. 기존DIV/GIF 경로·원장/권한/cleanup·다훈 mixed post 반례 보존. 시험판0.1.12/ig-comments-rich-list-7, diagnostic counts 유지.
- 전체 회귀 실행 중. 사용자 실제 재시험·제품 Core/MV3/Native/Server NOT_RUN, 미커밋/미게시 유지. MVP_FINAL_COMPLETE=false.
- 최종 전체 Content287/287 PASS(댓글32 포함), 실패/skip0. 기존환경 Node24/Windows 설치Chrome headless/Playwright 합성 DOM, node --test --test-concurrency=2 extension/content-tests/*.test.mjs, ig-comments-rich-list-full.log. 새 semantic2반례0/2→2/2, mixed post4건·기존GIF/프로필/하트/다른owner·복원/YouTube 회귀 포함. 계약6/6/build/구문/diff 별도PASS. 실제 사용자0.1.12 재시험 전 성공 확정 금지.

### 2026-11-01 IG04 홈 게시물 hashtag-only 본문 누락
- 사용자0.1.12: 릴스 목록 댓글 정상, 홈에서 연 일반 게시물은 답글만 숨고 부모 댓글 잔류. 실제 화면은 hashtag-only 댓글 다수와 일반문장 댓글이 혼합됨. 정상 릴스 보고는 사용자 실행으로 한정, 홈 전체 수용 실패 유지.
- 확인된 원인: bodyContent가 @mention 링크는 본문으로 인정하나 #hashtag 링크만 있는 span은 일반 text walker에서 anchor text를 제외해 누락. 익명 hashtag-only classic 행 반례를 수정 전0/1FAIL로 확인한 뒤 @/# 링크 본문 근거를 허용. 이것은 본문 근거만 보완하며 exact comment/time/profile/행 경계 검증·mixed post 거절은 그대로다. 사용자 화면의 모든 잔류 원인이 이 한 가지라고 단정하지 않는다.
- 수정 후 댓글33/33 PASS(신규hash1+기존32), 계약6/6/build/diff PASS. 기존 릴스/GIF/답글·mixed post 보존·해제 복원 포함. 이번 전체 Content 재실행 안 함; 직전287은 이전 source 이력으로 구분. 시험판0.1.13/ig-comments-hashtag-8. 다음 사용자 동일 홈 게시물 부모댓글·프로필·하트 제한/해제와 게시물 보존 확인. 미커밋/미게시, 제품Core/MV3/Native/Server NOT_RUN, MVP_FINAL_COMPLETE=false.

### 2026-11-01 IG04 게시물 조상 경계에서 정상 댓글 행을 버리는 문제 수정
- 사용자0.1.13: 현재post permalink15/15가 전부 표시되고 댓글 잔류. OBSERVED14/14는 부모댓글 수용 성공이 아니며 사용자실패 기록 유지.
- 확정 반례: linked avatar를 포함한 정상 댓글 행을 찾은 후 H2 caption/다른 avatar가 있는 큰 post parent로 올라갈 때 unsafe parent의 외부 avatar 때문에 return null하여 정상 행까지 폐기. 기존 단일행 fixture에는 enclosing post author/profile 경계가 없어 놓쳤다. 신규 익명 shared-caption/복수avatar 반례 수정 전FAIL→후PASS.
- 수정: 안전한 avatar 포함 댓글 행이 이미 확인됐으면 unsafe post에서는 확장을 중단하고 좁은 행을 유지한다. 자기 avatar wrapper 안에 보호UI가 있는 불완전 행은 기존 거절 유지. mixed listitem/본문사진/게시자/게시물 좋아요 보존과 릴스/GIF/다른owner/cleanup 의미를 바꾸지 않는다.
- 추가 직접 재현: 사용자 최신 outerHTML을 메모리로 읽고 URL 경로만 익명 sample로 치환, post avatar+H2+photo+Like enclosing DOM에서 설치 Chrome으로 구 guard/new guard를 비교. before restricted0/commentHidden false → after restricted1/commentHidden true, postHidden false 및 release restored true 모두 확인. 실제 원문/계정/댓글/CDN은 Git에 추가하지 않았고 ignored build의 진단 스크립트만 사용, 외부 리소스 요청은 차단. 실제 Instagram 전체문서 수용과 구분한다.
- 댓글34/34·계약6/6/build/diff PASS, 전체 Content 재실행하지 않음(직전287은 이전 소스 이력). 시험판0.1.14/ig-comments-ancestor-9. 다음 사용자 같은게시물 실제 댓글·프로필·하트 제한과 해제 재시험. 미커밋/미게시, 제품Core/MV3/Native/Server NOT_RUN, MVP_FINAL_COMPLETE=false.

### 2026-11-01 사용자 요청 0.1.9 기준 릴스 잔여 행 보완 시험판
- 사용자가 0.1.9 복귀 후 홈 정상·릴스 일부 본문은 없고 프로필/시간/좋아요/답글 잔류 보고. 신규 제공 outerHTML의 본문 DIV는 비어 있고 exact comment/time·linked avatar/동일 author·Reply/Like만 남아 있다. 원래0.1.9 bodyContent 필수조건이 이 행을 누락한다.
- 기존2a22fcb source를 ignored extension/build/comments-baseline-2a22fcb에 보존·재생성하고 그 사본에만 emptyCommentRow를 추가했다. exact comment/time/oneComment 기존 검증 유지, 동일 profile avatar/author+명시Reply·본문이 실제 공백인 경우만 허용하고 post p/h1/h2/media/input·다른 body image는 거절. 사용자 요청대로 누적 P2 후보 소스를 이 시험판에 섞지 않았다.
- baseline 신규 empty 반례 수정 전FAIL→후PASS. 기존24+empty1=25/25 PASS, 설치Chrome 합성DOM. 실제 제공HTML도 격리 wrapper에서 구판 댓글행 미숨김→신판 숨김·복원, 게시물 유지 확인. 최초 실제HTML 진단은 fixture charset 누락으로 한국어Reply가 깨져 실패했으므로 meta UTF-8을 추가해 동일 원문으로 비교했으며 제품 검사를 완화하지 않았다.
- Chrome의 기존 extension/build/content-harness만 baseline 보완판으로 갱신. 버전0.1.9.1 / ig-comments-baseline-empty-1. 현재 tracked working tree에는 이전 P2 후보0.1.14가 보존되어 있으며 시험판의 empty 보완은 아직 그 후보에 통합하지 않았다. 사용자 시험 성공만으로 이 둘이 동일하거나 PR71 P2가 해결됐다고 기록하면 안 된다. 다음은 baseline 보완 실제 사용자 시험→정상본과P2 안전수정을 반례 기반으로 별도 정리한 뒤 게시승인. Commit/Push 없음, 기존 #71 그대로, MVP_FINAL_COMPLETE=false.

### 2026-11-01 정상 확인 baseline0.1.9.1 보존 / PR71 P2만 재정리
- 사용자 baseline0.1.9.1에서 기능 정상 보고 후 P2도 정상기능 보존하며 수정 지시. 누적 실패 후보 source/test/harness는 ignored build/ig-comments-previous-candidate-preserved에 보존하고, 정상 baseline 사본의 효과코드/시험판을 tracked 경로로 다시 가져와 최소 변경했다. root/타 worktree/선행65는 보존.
- 기준 효과코드는 사용자 확인0.1.9.1과 byte 비교했으며 차이는 commentRow semantic 선택과 rejected semantic ancestor에서의 검색/확장 중단뿐이다. 기존 DIV/emptyCommentRow/본문/GIF/릴스/ClaimLedger/해제/권한/observer 로직은 baseline 그대로다. 과거실패후보의 hashtag/ancestor/diagnostics 등 일괄 반영하지 않았다.
- P2 수정: LI/role=listitem도 단일 comment identity·안전 row·post 사진/본문/중첩 list·입력창 제외를 확인하고 simple inline 또는 exact time+profile+Reply 구조만 허용. 본문이 hashtag/비어 있어도 올바른 semantic 댓글 행은 보존한다. mixed post 조상은 선택하지 않고 그 아래 좁은 검증된 DIV만 찾으며 거절된 row 경계를 넘지 않는다.
- baseline P2 반례 실행0PASS/5FAIL(초기 후보의 hashtag 관련1 포함)을 보존. 최종 제출시험은 baseline기존24+empty1+P2 mixed4+structured LI text/hashtag/empty3으로 재정리했다. 과거 탐색성 fixture/진단기의 결과를 최종 후보수에 합산하지 않는다. 강화된mixed반례는 post author avatar/H2/photo/본문/Like 보존·댓글 행만 제한/복원까지 확인한다.
- 최신시험판0.1.9.2 / ig-comments-baseline-p2-2. 전체 회귀 실행 중, 계약6/6·빌드 PASS. 사용자 새 후보 재시험·원격CI 미실행, Commit/Push/Merge 없음. 제품Core/MV3/Native/Server NOT_RUN, MVP_FINAL_COMPLETE=false.
- 최종 전체 Content287/287 PASS(댓글32 포함), fail/skip0. Node24/설치Windows Chrome headless/Playwright 합성DOM·모의권한. 명령 기존환경 node --test --test-concurrency=2 extension/content-tests/*.test.mjs, 로그 ig-comments-baseline-p2-full.log. 별도계약6/6/build/구문/diff검사 PASS. 실제 unpacked module/source hash동일 확인. 이전0.1.14의287과 다른 후보이며 혼합하지 않는다. 다음 사용자0.1.9.2 홈·릴스·빈댓글 정상과 게시물보존/복원 확인→게시승인→같은PR71 새HEAD/CI/다훈 독립재검토.

## 2026-11-01 PR71 중첩 댓글 근거와 게시물 경계 재수정
- 담당 채지민 / codex/content-instagram-comments / 시작 9a6ce8542efe054f40f087baff8059b803d406a1. review5727088612의 span 본문+중첩 exact time/Reply 구조를 LI/role=listitem 각각 설치 Windows Chrome 합성 DOM에서 재현: 수정 전 0/2 PASS, 게시물 전체 숨김 FAIL.
- rich semantic 행의 중첩 permalink column 바깥에 독립 본문/비프로필 이미지가 있으면 전체 행을 선택하지 않는다. avatar/author/행 control은 허용하고 기존 좁은 DIV 탐색은 유지한다. flat GIF 댓글의 이미지 허용을 되돌리지 않는다. 기존 GIF LI/hashtag DIV/외부 ancestor 누락 수정과 빈 댓글, owner·cleanup·복원 구현은 유지한다. 공용 계약·ClaimLedger·NavigationSurface·Core는 수정하지 않는다.
- AC-IG-04-01~03 기준: 댓글 제한과 게시물/좋아요 보존을 동시에 검사. 댓글 Chrome 합성 시험37/37(기존35+새2), 계약6/6 PASS. 전체 Content 회귀는 실행 중이며 최종 결과를 아래에 기록한다. 시험판0.1.9.4 / ig-comments-nested-boundary-4 빌드·구문·공백 검사 PASS. 이번 사용자 재시험/원격CI/실제Core·MV3·Native·Server 수용 NOT_RUN. Commit/Push 전 사용자 시험 대기, #56과 통합 충돌은 이번 수정에 포함하지 않음. MVP_FINAL_COMPLETE=false.

- 최종 전체 Content292/292 PASS(댓글37 포함), fail/skip0. 기존 Node24/Playwright/설치Chrome headless 환경에서 node --test --test-concurrency=2 extension/content-tests/*.test.mjs 실행, ig-comments-nested-boundary-full.log 보존. 계약6/6은 별도 실행. 사용자 실제 Instagram 정상 보고와 원격CI는 이 새 후보에서 아직 없으며 과거 결과를 승격하지 않는다.

- 사용자 시험판0.1.9.4에서 안내한 홈/릴스 댓글 제한·게시물 사진/영상/본문/게시자/게시물 좋아요 보존·해제 복원을 확인 후 'ㅇㅇ 문제없어' 보고. 사용자 실행 결과이며 에이전트 독립 실제 제품 검증으로 승격하지 않는다. 사용자 게시 동의 후 이번6파일만 Commit/Push 진행. 새HEAD 원격CI는 게시 후 별도 확인하며 #56 수정·통합 충돌 해결·병합은 포함하지 않는다.

## 2026-11-01 PR71 정상 댓글 누락 3건 재수정
- 담당 채지민, codex/content-instagram-comments, 시작4ebc72fb0da5a9fbbc8ab46bac3825808a6550fd. review5726885645의 GIF LI/hashtag-only DIV/외부 post ancestor3반례를 별도 익명Chrome 시험으로 추가하여 수정 전0PASS/3FAIL 확인. 기존 사용자정상0.1.9.1/0.1.9.2 및 P2 mixed-post 안전수정은 유지한다. #65선행 및 통합충돌은 다훈관리, 임의 merge/다른PR 수정 없음.
- GIF LI: 기존 단일comment identity/row안전/post신호 거절·exacttime/profile/명시Reply 근거를 유지하면서 rich semantic 행의 body image를 허용. simple inline shortcut은 기존 avatar-only 기준 유지. 본문이 비어 있는 정상 semantic행도 기존 지원 그대로다.
- hashtag DIV: 기존 @mention과 별도로 #로 시작하는 같은Instagram local /explore/tags/<tag>/ 링크만 본문 근거로 허용. URL/본문/계정 데이터를 반환하거나 저장하지 않는다. LI hashtag PASS를 DIV지원 증거로 대체하지 않는다.
- ancestor: 외부 post의 unsafe/다른avatar로 인해 완성된 좁은 댓글을 버리지 않고 다음 기존break로 확장만 중단한다. 자기avatar wrapper에 보호UI가 들어 있는 불완전 column은 기존거절 유지. rejected semantic row 경계와 mixedpost보호는 유지.
- 첫 수정 검사에서 semantic 빈 본문에 추가 body조건을 요구한 후보가 기존회귀1건에 실패해 해당 추가조건을 제거했다. 최초실패로그 ig-comments-three-review-after.log 보존. 최종전체회귀 실행 중; 계약6/6/build/구문/diff 별도PASS. 시험판0.1.9.3/ig-comments-review-three-3. 실제 사용자재시험/원격CI 미실행, 미커밋/미게시. 제품Core/MV3/Native/Server NOT_RUN, MVP_FINAL_COMPLETE=false.
- 최종 Node24/설치Windows Chrome headless/Playwright 합성DOM 전체 Content290/290 PASS(댓글35 포함), 실패/skip0. 명령 기존환경 node --test --test-concurrency=2 extension/content-tests/*.test.mjs, 로그 ig-comments-three-review-full.log. 리뷰3반례0/3→3/3, 기존32댓글·mixedpost·empty릴스·owner·복원/YouTube 회귀 포함. 계약6/6/build/구문/diff 별도PASS. 기존다훈 독립15건을 직접 재실행했다고 기록하지 않는다. 다음 사용자0.1.9.3 정상경로 확인→Commit/Push승인→동일PR71 새HEAD/CI상태 보고; 충돌순서는다훈관리 유지.
- 사용자0.1.9.3에서 'ㅇㅋ 문제 없어' 정상 보고: 안내한 홈/hashtag 댓글·릴스/GIF/빈댓글 제한·게시물 보존·해제 복원 사용자 실행 결과로 기록한다. 에이전트 실제 제품수용으로 승격하지 않는다. 게시범위6파일(효과/시험/TEST bootstrap·manifest·popup/본기록), 통합충돌·선행순서는다훈관리. 새HEAD 원격CI는Push후 확인.


## 2026-11-01 김다훈 인계: PR71 잔존 P2 직접 수정
- 사용자/채지민 협의로 IG-04 기존 결함만 인계. 독립 worktree ig-comments-suggestions-p2 / codex/ig-comments-p2-repair, 시작 c9393d5901150e77b96999eefbef14f071436c7a. 원격 codex/content-instagram-comments 동일 확인. 원본 Content worktree·공유 staged 삭제1,036파일·#83 및 다른 PR 변경 없음.
- 기준: feature-registry.json AC-IG-04-01~03 및 docs/design/additional-mvp-contracts/05_Content_Event_UI.md. 게시물/좋아요 보존, 옵션별 own claim/복원, 문서/세대/권한 경계 유지. Core/Server/계약/공통 원장은 수정하지 않음.
- discussion4435270652/656 반례를 설치 Windows Chrome headless/Playwright 합성 DOM에서 재현. 링크로 감싼 사진/본문 mixed LI·role=listitem2건, span·DIV timestamp wrapper 정상 GIF2건: 수정 전0PASS/4FAIL → 수정 후4PASS. 과거 flat GIF/hashtag DIV/빈댓글/중첩답글/동적DOM/SPA/원래mixed-post 반례 유지.
- nestedIdentityBoundary: post permalink는 role과 무관하게 댓글 row 근거에서 제외. timestamp만 있는 투명 wrapper는 flat timestamp와 동등하게 취급. 중첩 identity 외부에서 검증된 프로필/avatar·댓글 조작만 제외하고 임의 role=link/button의 사진·본문을 지우지 않음. 첫 후보의 무링크 avatar 회귀는 pr71-focused.log에 보존하고 검증된 무링크 avatar만 허용해 해결.
- 신규4 포함 댓글41/41, 전체 Content296/296(실패/skip0), 계약6/6, build·변경JS node --check·git diff --check PASS. Node24.19.0 / Playwright1.62.1 / 설치Chrome headless. 명령: PLAYWRIGHT_MODULE/CHROME_EXECUTABLE 지정 후 node --test --test-concurrency=2 extension/content-tests/*.test.mjs; node --test contracts/additional-mvp/rc1/tests/legacy-boundary.test.mjs; node extension/content-tools/build-chrome-harness.mjs. 로그는 수정worktree의 ignored pr71-{before,focused,focused-final,full,contract,build}.log. 전체회귀는 owner/부분복원재시도/foreign document/generation/SPA/pagehide/늦은callback 및 기존 YouTube·IG 기능 포함. 합성DOM이며 실제 로그인/제품 수용은 미실행.
- Commit/Push 후 동일HEAD workflow_dispatch 원격CI와 checkout SHA/tree를 별도 확인한다. 독립 재리뷰 필요: 링크된 게시물 보존 + wrapped GIF 정상 제한 및 기존 경계. Approve/Draft해제/Resolve/Merge 없음. 실제 Chrome/MV3/Core/Native/Server 제품 수용 NOT_RUN, MVP_FINAL_COMPLETE=false.


## 2026-11-01 김다훈 인계: PR82 잔존 P2 직접 수정
- 사용자/채지민 협의 인계. 독립 worktree ig-suggestions-p2-repair / codex/ig-suggestions-p2-repair, 시작154c7696d7cad13ed65d256fb9cd40a5693be2ff. #71 c9393d59의 자손임을 merge-base로 확인. 원격 게시브랜치 codex/content-instagram-suggestions 유지; #71 수정adc9d14ff3841ff3bae4a2599308cc6c0135266a를 일반 merge로 상속(이력 재작성/force push/PR 병합 아님). #83·원본worktree·공유 staged 삭제1,036파일 보존.
- 기준 feature-registry.json AC-IG-05-01~03 / docs/design/additional-mvp-contracts/05_Content_Event_UI.md: 추천 계정·게시물 제한, 일반피드·광고·다른owner·복원 보존. IG05 생산코드/시험/본작업카드만 추가수정; Core/Server/계약/공통원장/adapter는 변경하지 않음.
- review5727802096의 기존 section+h3 Following 및 nested semantic section/header 반례3건은 시작HEAD에서 이미 PASS. 잔존 DIV+h3 추천 + DIV+span Following 형제, 일반 DIV author + nested DIV widget/header는 같은 시작HEAD에서2FAIL 재현(pr82-before.log: 추가 header-author 대조1PASS/2FAIL). 수정 후 전부PASS. 원격/과거 PASS를 잔존결함 해소로 전용하지 않음.
- accountRegion은 추천표식+계정행을 처음 함께 입증한 공통container에서 멈추며 태그에 따라 상위aside/형제로 확장하지 않음. postHeadings는 실제 게시물 내용·author·조작보다 뒤에 있는 header/identity를 게시물 근거로 사용하지 않음. DIV/header 없는 정상 author+정확posttime+추천표식 경로와 deep wrapper/무표시 sibling/mutual badge 지원 보존.
- 신규추천6건(잔존/대조3 + 실제display복원실패재시도/foreign document/세대권한취소3), 추천21건 포함 최종 전체Content317/317(실패/skip0), 계약6/6·build·모든 content/content-tests MJS 구문·diff 검사PASS. #71 신규4도 누적회귀에 포함하며296+317을 합산하지 않음. 설치Windows Chrome headless/Playwright1.62.1/Node24.19.0 합성DOM·모의권한; 실제Chrome제품수용 아님.
- 명령 기존환경 node --test --test-concurrency=2 extension/content-tests/*.test.mjs; node --test contracts/additional-mvp/rc1/tests/legacy-boundary.test.mjs; node extension/content-tools/build-chrome-harness.mjs; node --check; git diff --check. ignored 로그 pr82-{before,focused,full,contract,build}.log. display!important/inert,다른owner,부분복원원장/재시도,foreign doc 무변경/원문서복귀cleanup,SPA/pagehide/늦은callback/세대경계 및 기존댓글·릴스·스토리·탐색·YouTube 보존.
- #71 CI run41304354211은 정확adc9d14 checkout에서Content296/296+계약6/6·build·구문·diff 성공. #82 게시후 최신HEAD workflow_dispatch와 checkout SHA/tree를 별도확인한다. 독립재리뷰는 추천DIV 소유범위·DIV widget header·정상추천보존 및 #71상속diff에 한정. Draft해제/Approve/Resolve/PR Merge 없음. 실제Chrome/MV3/Core/Native/Server 수용 NOT_RUN, MVP_FINAL_COMPLETE=false.


## 2026-11-01 PR83 검증된 PR71·82 선행 P2 수정 상속
- 담당 김다훈 / 독립 worktree ig-grayscale-predecessor-fixes / codex/ig-grayscale-predecessor-fixes. 시작 #83 d1fd8357d42560929c53d39a5f869413c1a94a2e, 게시 대상 codex/content-instagram-grayscale. 원격 #71 adc9d14ff3841ff3bae4a2599308cc6c0135266a / #82 84f7b0f157c5959b9f1112941de665fb793ca3d4와 일치 확인. #83과 #82의 merge-base는 최초 추천70ff3e652da642cba81c5ce140131b90409c7f72로 최신댓글·추천P2가 누락된 상태였다.
- #82 최신84f7b0f를 일반 merge ancestry로 상속해 #71 adc9d14·#82 자체20d5c26/154c769 및 최신수정 이력을 보존한다. 기존 두 PR 재개발/변경/새PR/force push 없음. 최소 실제변경은 댓글·추천 모듈과 기존 관련시험, 추천 TEST build 식별문구, 작업카드다.
- 충돌은 본후보 내부의 작업카드·TEST manifest/popup 버전3파일. 작업카드는 양측 개발/실패/사용자시험/미완료 기록을 모두 보존하여 결합. manifest/popup은 #83 0.1.16 흑백 시험판·버튼·제외설명을 그대로 유지. #83 흑백모듈/navigation/adapter/흑백시험은 시작d1fd와 바이트정규화 비교·staged diff동일 확인, 로그인type/action 감시·복원실패시 신규효과중단 보존.
- 기준 docs/design/additional-mvp-contracts/05_Content_Event_UI.md 공개화면전체·프로필/알림/portal/탐색/스토리 포함, DM/login/FOCURVE제외·영상재생/소리불변·원장복원; feature-registry AC-IG-04/05/06-01~03. 계약·Core·Server·Native·DNR 변경 없음.
- review5728060673의 기존fixture를 동일조건으로 개발자가 재실행: 정확d1fd snapshot source대조 후 댓글18PASS/2FAIL→누적후보20/20 PASS, 추천6PASS/5FAIL→11/11 PASS. 새 독립재리뷰 승인으로 표시하지 않는다. 흑백은 기존제출16+독립브라우저3=19/19 PASS: 동적password/action, 다른owner/hide·filter!important, 부분복원실패·신규branch0·재시도,공개전체/보호UI/미디어/SPA 포함. 별도중복집합은 전체Content수에 합산하지 않는다.
- 로그(모두 수정worktree ignored): pr83-comments-{before,after}.log, pr83-suggestions-{before,after}.log, pr83-grayscale.log. 시험용 재사용fixture는 extension/build/*-{before,after}.test.mjs 및 independent-ig-grayscale.test.mjs. 원본리뷰 fixture/실패증거는 수정하지 않음.
- 환경 Node24.19.0/Playwright1.62.1/설치Windows Chrome headless 합성DOM·모의권한. 실제로그인·HOLD환경 접근없음. 명령: node --test extension/build/comments-{before,after}.test.mjs; node --test extension/build/suggestions-{before,after}.test.mjs extension/build/boundary-{before,after}.test.mjs; node --test extension/build/independent-ig-grayscale.test.mjs extension/content-tests/instagram-grayscale-browser.test.mjs. PLAYWRIGHT_MODULE/CHROME_EXECUTABLE은 기존 독립환경을 재사용.
- 누적전체는 node --test --test-concurrency=2 extension/content-tests/*.test.mjs(pr83-full.log). 계약 node --test contracts/additional-mvp/rc1/tests/legacy-boundary.test.mjs 6/6, node extension/content-tools/build-chrome-harness.mjs 및 모든content/test MJS·변경bootstrap node --check·diff검사PASS(pr83-contract/build.log). 전체회귀 최종결과는 아래에 기록한다.
- 최신integration9ebec52dc533dd497e454815b53b654ab42ef4fa와 문서 AMVP-CONTENT-06.md 충돌은 통합담당의 후속조건. 양측 실패/검증/미완료 기록 보존 후 최종diff·후보CI·담당승인이 필요하다. 이번에 integration브랜치를 변경/병합하지 않는다. #71/#82원격·타worktree/index·공유 staged삭제1,036파일 보존. Approve/Resolve/Draft해제/PR Merge 없음.
- 실제 Chrome/MV3/Core issued/frozen/native·효과전영속cleanup/lease·제품새문서/BFCache·Native/Server제품수용 NOT_RUN. MVP_FINAL_COMPLETE=false. 새HEAD exact checkout CI 및 최신독립재리뷰·기존CHANGES_REQUESTED 해소·Core승인은 별도조건이다.

- 최종 로컬 Content333/333 PASS(실패/skip0), 계약6/6·build·구문·diff PASS. IG06 16은 원본동일·독립3과별도집합이며 댓글20/추천11도전체333과합산하지 않는다. Git source/test동일성을 확인한 후보를 Commit/Push하고 새HEAD원격CI checkout SHA/tree는 외부검증기록과 PR설명에 남긴다. 로컬/CI 합성을 실제제품수용으로 승격하지 않는다.


## 2026-11-01 IG04 비동기 예약 gate 독립 구현 (Core 미연결)
- 담당 김다훈 / 독립 worktree ig04-reservation-gate / branch codex/ig04-reservation-gate. base #83 1291aeb18a83a69aff7a0866953b4133c23857bb. #56 문서충돌·#71/#82/#83 원격·기존승인·타worktree/index·공유staged삭제1,036파일은 보존한다. 기존DocumentControlRegistry/A1 saveLedger·ContentSessionAdapter/ClaimLedger/NavigationSurface 경계를 재사용검토했고 Core authority/storage/lease/Server API는 변경하지 않는다.
- 새 hide-reservation-gate.mjs는 내부 스케줄링 seam이며 Core message/schema를 정의하지 않는다. IG04에 ig04Reservation 옵션을 명시한 경우만 사용; 기존 로컬 TEST caller의 동기 경로는 유지한다. 새 gated 모드는 reserve/getGeneration이 없거나 유효하지 않으면 효과0으로 기본거절한다. 아직 생산 receiver는 없으며 미래 생산경로가 반드시 이 gated 모드를 사용하도록 Core 연결·검토가 필요하다.
- 내부 사용: 기존 InstagramCommentsSession 또는 ContentSessionAdapter의 옵션에 ig04Reservation:{reserve,getGeneration,timeoutMs,maxPlans}. getGeneration은 동기 양의 safe integer이며 최초세대에 고정; isCurrent에 Promise를 넣지 않는다. reserve(plan,{signal})의 Promise는 검증된 외부commit 이후에만 해당 plan.plan_id를 반환해야 한다. 이 callback 형태는 내부 seam이고 AMVP/Core API 확정이 아니다. TEST mock ACK는 새 격리시험에만 있다; TEST popup/bootstrap에 자동승인 callback을 설치하지 않는다.
- plan은 read-only display/priority/inert current·restore·target, claim/plan_id와 로컬document_instance_id/generation을 포함한다. Element/계정/본문/URL은 전달하지 않음. ClaimLedger가 실제 다른owner의 원래baseline을 포함해 계획하고 자기 WeakMap에 token을 결속한다. ACK후 새scan에서 selector·연결상태·문서·현재권한·최초generation 및 DOM/원장snapshot을 재검증한다. baseline/claim이 바뀌면 재계획; clone/중복plan 적용은 거절한다. 각 setter도 기존 동기guard를 재사용한다.
- MutationObserver를 ACK대기 동안 끄지 않으며 초기/동적댓글 모두 별도plan을 예약한다. Promise대기를 동기scan/isCurrent에 끼워넣지 않고 ACK는 새scan만 예약한다. 개별timeout(기본5초,1~60초)·abort와 plan상한(기본256,최대4096)으로 무한대기를 제한하되 기존의무는 버리지 않는다. 실패/잘못된ACK/늦은ACK/중복ACK·pagehide/SPA/세대변경·foreign/detach/selector이탈은 신규효과를 차단한다.
- release는 DOM cleanup을 먼저 시도한다. 외부에 전달된 plan은 reject/abort/timeout이어도 실제commit 여부가 불명확하므로 reservation_obligations에 보존하며 cleanup_pending:true를 유지한다. dom_restored와 local restored는 DOM결과일 뿐 durable completion이 아니다. 미해소예약이 있으면 scope replacement도 차단한다. Core 완료API가 없으므로 지금은 이 외부의무를 clear하는 경로를 의도적으로 만들지 않았다. 복원 setter실패는 기존 ClaimLedger 의무/원래priority를 보존하고 후속release에서 DOM복원재시도 가능하다.
- 새 gate 집중 browser시험29/29 PASS: 기본거절·initial/dynamic gate·실패/timeout/late/duplicate ACK·실제reserve 재진입release·setter중권한회수·generation/SPA/pagehide/foreign/detach/selector 경계·다른owner/페이지baseline 재계획·실제부분복원실패/재시도·clone/한번소비·용량·동기검사예외/Promise거절·retired target의무/scope교체차단. Node24.19.0/설치Windows Chrome156 headless/Playwright1.62.1 합성DOM·모의ACK다. 실제확장설치/정책START/서비스 실행 없음.
- 첫 전체359/359는26개 gate시험 당시 소스이며 최종29시험/추가guard 이후 결과로 승격하지 않는다. 최종 전체는 아래 기록한다. 계약6/6·harness build·content/test MJS구문·diff PASS; builder에 새 gate모듈 포함. 기존 IG04/IG05/IG06/Stories selector·미디어·Core/Server/Wire/Schema를 재개발하지 않는다.
- 실행명령: 기존 PLAYWRIGHT_MODULE/CHROME_EXECUTABLE 지정 후 node --test extension/content-tests/ig04-reservation-browser.test.mjs; node --test --test-concurrency=2 extension/content-tests/*.test.mjs; node --test contracts/additional-mvp/rc1/tests/legacy-boundary.test.mjs; node extension/content-tools/build-chrome-harness.mjs; node --check; git diff --check. ignored 로그 gate-focused*.log/gate-full*.log/gate-contract.log/gate-build.log. CI는 새게시HEAD에서 별도확인하며 소스동일성 없이 이전CI를 재사용하지 않는다.
- IG04 실제연결 시나리오: issued frozen정책수신→native owner/document/generation 검증→이 내부계획의 안정적인target/원래값을 Core영속예약에 결속→실제ACK후 동일세대 재검증→DOM/국소관찰→검증된scoped RELEASE/CleanupGrant→DOM복원재시도→별도Core의무완료ACK/증거조회. 현재 implemented는 Content계획/대기/재검증/DOM/국소cleanup뿐; issued권한·native문서·영속저장·lease·안정적target/복구식별·ContentResult/RuntimeReport producer/Server검증 및 외부의무terminal처리는 BLOCKED다.
- 신규PR은 기존PR과 중복되지 않는독립gate diff지만 사용자지시에 따라 생성 전에 보고만 한다. 검증후 별도branch Commit/Push까지 수행하며 PR생성/Approve/Draft해제/Resolve/Merge 없음. Core(윤종민)의 실제 API/증거/완료 연결 후 별도 리뷰가 필요하다. 실제Chrome/MV3/Core/Native/Server제품수용NOT_RUN, MVP_FINAL_COMPLETE=false.

- 최종 로컬 Content362/362 PASS(기존333+신규29,실패/skip0),계약6/6·build·구문·diff PASS. source1291aeb의정확사본에서동일기본거절/초기gate3시험은0PASS/3FAIL(gate-before.log),최종동일3은집중29에포함하여PASS. 이반례는새예약요구의미구현을입증하며기존TEST기능자체의결함으로소급하지않는다. 새로운독립검토/제품Core권한성공이아니다. 게시branch의정확HEAD workflow_dispatch CI는외부검증기록에연결한다. PR은생성전보고조건으로미생성유지.


## 2026-11-01 IG04 읽기 전용 증거 snapshot·예약 의무 완료 hook
- 담당 김다훈 / worktree ig04-evidence-completion / branch codex/ig04-evidence-completion. base3abe45048075404433b19d4a667683002004ff71(gate)와 선행#83 1291aeb의 상속 보존. integration831069805eb0f86fc526b1f0f92e0b4a01656172는 변경하지 않는다. #56 문서충돌·#71/#82/#83 원격·기존승인·타worktree/index·공유staged삭제1,036파일 보존. 새 PR 생성 없음.
- API: InstagramCommentsSession.evidenceSnapshot(), ContentSessionAdapter.evidenceSnapshot('IG-04')는 Promise로 읽기 전용 local snapshot을 반환. observer_active/scan_in_progress/scan_scheduled/scan_sequence/scan_complete, 마지막 국소관찰·cleanup,실제자기claim Ledger의 속성별 pending/matches_owned·foreign/connected 상태,gate별identity/state/completed/completion_pending를 포함한다. Element·DOM원문·원래CSS·다른owner식별/원장을 노출하지 않는다. snapshot은 복사본이며 caller변경으로내부상태를 바꿀 수 없다. scan_sequence는 로컬counter이고 Control seq가 아니다. 실제동시성과수명은Core query/검증으로결속해야하며 Wire ContentResult/EffectEvidence가아니다(local_only/native_verified:false 유지).
- binding은 기존 ig04Reservation 내부옵션에 context:{scope,operation_id,semantic_sha256},verifyContext(context),verifyCompletion(opaqueProof,expected)을 선택추가한다. context는constructor에서복사·동결하며 BindingScope required16필드/기본타입·own owner/binding·현재generation·operation/hash형식을확인한다. verifyContext의동기true도필수이며 실제issued/native/완전한schema/정책hash 검증은Core책임이다. 실제검증함수가없으면 bound mode는효과0. legacy context미지정 gate는기존동작을유지하되 완료hook은기본거절한다. 모의verifier는격리시험에만있고bootstrap에는설치하지않는다.
- 각계획에로컬 gate_id/plan_id/context_sha256/plan_sha256/operation_id/generation identity를결속한다. context hash는정렬canonical JSON의SHA256,plan hash는실제원래값/current/target·claim·로컬document UUID/generation/gate_id/context hash에결속된다. local-evidence.mjs는내부canonical/hash/구조검사일뿐서명·capability 검증기가아니다. context_bound는구조결속표시이며native검증성공이아니다. native document는verifyContext가실제신뢰경로에서확인해야한다.
- 완료 API: Session/Adapter.completeReservation(identity,opaqueProof). ACK의실제Core형식은정하지않고proof를외부verifyCompletion에그대로전달한다. expected={identity,context}는frozen원본으로검증함수가발급/영속완료기록·scope/operation/hash·cleanup권한을대조해야한다. hook은정확한identity매치,닫힌gate,명시적release의로컬성공·observer정지·scan비진행·자기target/원장0을먼저확인하고외부검증await후다시확인한다. false/reject/응답유실은의무를유지;검증이진행중이면completion_pending=true. 검증true와로컬확인이모두성립한정확1예약만종료한다. 다른예약/owner는보존한다.
- 반환은 local_only/accepted/reason 또는 accepted:true/duplicate 및현재cleanup/adapter state다. 대표거절:COMPLETION_VERIFIER_REQUIRED/RESERVATION_IDENTITY_MISMATCH/LOCAL_CLEANUP_UNCONFIRMED/DURABLE_COMPLETION_UNCONFIRMED. stricttrue만허용;단순ACK수신/identity일치/local restored만으로완료되지않는다. 중복도동일identity·검증을요구하며늦은ACK가새Session을닫거나새claim을회수하지않는다. gatedclaim에Session별nonce를추가해같은scope의교체후구snapshot이새원장을읽는충돌을막았다.
- Core가검증한원래scope의cleanup완료는현재APPLY권한과다르다. 권한취소/문서세대전환후에도원래identity에대한정당한cleanup완료를검증함수가판정할수있다. identity에다른generation/operation/scopehash를넣는것은거절한다. CompletionGrant/lease·기한/terminal저장/재시작복구를이번에임의정의하지않음. actualCore verifier가없으면완료API는비활성이다.
- session완료후로컬release를재조회해reservation_obligations/cleanup_pending/LIVE를갱신하고adapter의feature.released/pending_features도동기화한다. 다른활성feature를일괄닫지않는다. 원래복원실패/foreign문서미해소상태는완료거절하며기존release재시도로복원가능하다. 자기원장이verifyawait중다시생기면종료하지않는다.
- 신규집중25+기존gate29=54/54 PASS. 처음54시험중context생성후start전caller변경1FAIL(evidence-focused-final.log)을확인했고constructor복사·동결후54/54(evidence-focused-fixed.log)로해결. snapshot의문자/foreignowner/원CSS미노출·변이격리,잘못된6identity필드,누락된scope/검증함수,Corefalse/reject/lost,복원실패재시도,verify중의무발생,동일scope교체후늦은중복ACK,다른owner/다른예약보존·adapter완료상태를검증했다.
- 최종전체Content387/387(기존362+신규25)·계약6/6·build·구문·diff PASS. Node24.19/Playwright1.62.1/설치Windows Chrome156 headless합성DOM·mock검증기이며실제제품/MV3권한수용이아니다. 명령 기존환경 node --test extension/content-tests/ig04-evidence-browser.test.mjs extension/content-tests/ig04-reservation-browser.test.mjs; node --test --test-concurrency=2 extension/content-tests/*.test.mjs; node --test contracts/additional-mvp/rc1/tests/legacy-boundary.test.mjs; node extension/content-tools/build-chrome-harness.mjs; node --check; git diff --check. ignored로그 evidence-focused*.log/evidence-full.log/evidence-contract.log/evidence-build.log. 신규module은builder에포함했다.
- Core최소인계:기존reserve에binding context검증과reservation_identity를결속;효과전실제영속ACK를확인한뒤plan_id 반환;읽기전용snapshot을issuedoperation/scan/profile과조회결속;scoped RELEASE·DOM복원확인후실제영속completion을검증하는callback을제공하고identity/opaqueProof로hook호출. 자체scope/native authority/영속store/cleanup lease/ContentResult/RuntimeReport producer/Server verifier는여전히미연결이다. proof형식·local hash를실제계약hash로매핑하는방식·stable target복구·cleanup terminal/lease와재시작의미는공동합의필요다.
- 새branch Commit/Push·정확HEAD CI후외부검증기록에fullSHA/tree/run을남긴다. 선행gatebranch/#83branch변경·forcePush·PR생성·Approve/Draft해제/Resolve/Merge없음. 실제Chrome설치/START/서비스/Native/DB실행없음. 제품수용NOT_RUN,MVP_FINAL_COMPLETE=false.


## 2026-11-02 IG04 Content receiver 독립 연결 준비
- 담당 김다훈 / worktree ig04-content-receiver / branch codex/ig04-content-receiver. base8f454c937c905ed7ad4e0650274e27b2830812ea와gate3abe450/#83 1291aeb 선행관계보존. 원격Content/Core/integration기준은각8f454c9/e903aff/8310698과동일하며실제IG04Core API는미제공이다. #56 문서충돌·#71/#82/#83·CorePR·타worktree/index·공유staged삭제1,036파일불변.
- 새 IG04ContentReceiver(document,options)는 신뢰Core caller용 내부receiver이며 Chrome runtime listener/새Wire/권한발급·영속저장·Server성공변환기를 만들지 않는다. 생산격리world에 실제검증된Core호출자를연결하는bootstrap/channel은BLOCKED. callback은테스트fixture에만모의구현하며TESTpopup/생산bootstrap에자동승인코드를설치하지않는다.
- 필수내부연결점은 verifyInput(opaqueAuthorization,{context,features,transport}),isCurrent(context,transport),reserve(plan,{signal,transport}),getGeneration(),getWorkerInstance(),verifyRelease(opaqueAuthorization,{context,transport}),verifyCompletion(opaqueProof,{identity,context,transport}). 하나라도없으면apply기본거절. 동기current/generation/Worker getter는Promise·예외·잘못된값을거절하고검증결과는stricttrue만받는다. 실제ACK/proof/message Schema는이번에정하지않으며Core가각callback의실제검증/저장/lease API를제공해야한다.
- apply({context,features},authorization): context={scope,operation_id,semantic_sha256}는기존boundContext 구조검사후복사·동결하며features는정확IG04 enabled/required=true 하나만허용한다. multi-feature입력을임의축소하거나disabled를RELEASE로해석하지않는다. async권한검증후Worker/문서/세대/현재권한을재검증해기존ContentSessionAdapter gated모드로연결. 해당receiver는한operation/frozen입력에만결속되며변경입력을거절,같은요청도재검증후중복으로조회만한다. 동시opening은BUSY. 시작실패·닫힌instance는다시apply하지않는다.
- query(): 실제adapter snapshot/국소state를읽어receiver_instance_id·Worker생명주기·revalidation_required·UNBOUND/BOUND_LOCAL/CLOSED_LOCAL/REVALIDATION_REQUIRED를반환한다. local_only:true/native_verified:false이며ContentResult/EffectEvidence를생성하지않는다. apply의accepted는검증된국소dispatch접수일뿐실제DOM효과성공/ServerAPPLIED가아니다. 초기/동적댓글의원래값·plan/claim/gate instance결속·예약대기·setter직전재검사는기존gate/snapshot을그대로재사용한다.
- release(originalBindingContext,opaqueReleaseAuthorization)는현재APPLY권한과별개로실제Core의scoped RELEASE/lease검증을요구한다. original context가정확히일치해야하고검증대기후같은binding인지도재검사한다. 검증된RELEASE는진행중input검증도취소한다. 권한회수/generation변경/같은문서SPA/pagehide후에도원래scope의검증된cleanup은가능하나새apply는금지한다. local복원실패/foreign문서/예약의무는기존cleanup_pending으로보존하고release재시도가능하다.
- completeReservation(originalBindingContext,identity,opaqueProof)는receiver의scoped RELEASE확인후기존완료hook을호출한다. Core검증전후Worker/실제문서생명주기를확인하며wrongscope/hash/미확정/응답유실은의무를유지한다. 다른owner·다른예약·이전/새Session을해제하지않는다. local완료를RuntimeReport/ServerRELEASED로변환하지않는다.
- Worker토큰은constructor시신뢰provider에서캡처한다. 새Worker는반드시새boot instance ID를제공해야하며extension ID/owner ID를재사용하면안된다. 변경을관측한oldreceiver는영구REVALIDATION_REQUIRED로닫히며token이되돌아와도재개/완료하지않는다. 새Worker가oldpending의무를인수·재검증/복구하는실제Core API는미제공이므로BLOCKED;같은scope를새Session으로덮어쓰지않고기존LIVE/의무를보존한다. 메서드/효과guard/ACK후Worker를검사하나실제Worker재기동통지·native attestation은이번에실행/구현하지않았다.
- receiver집중36/36 PASS. 기본7API누락·초기/동적gate·scope/native/generation/기능불일치·예약reject/lost/timeout·late/duplicateACK·권한취소·SPA/pagehide·async입력검증중세대/Worker전환·RELEASE취소·부분복원/foreign·다중receiver/owner·oldSession·truthy/Promise거절·frozen입력보존을확인. startup실패후중복accepted반례1FAIL(receiver-startup-before.log)을수정해최종36에포함PASS. 초기receiver-focused.log는숫자포함모듈을fixture의문자전용route regex가읽지못한시험환경실패이며regex에숫자를허용한후정상실행;제품실패와구분한다.
- 로컬전체422/422는35시험당시후보이며최종startup guard추가후전체423을실행했다고소급하지않는다. 변경영향은독립receiver에한정되어최종receiver36·변경없는기존387의유효회귀를재사용하고정확새HEAD원격전체CI에서최종누적423을확인한다. 계약6/6·build·모든content/test MJS구문·diff PASS. builder에receiver모듈포함. Node24.19/Playwright1.62.1/설치WindowsChrome156 headless합성DOM·모의Core입력이며실제MV3/계정/디코더/Native/Server수용아님.
- 실행명령:기존PLAYWRIGHT_MODULE/CHROME_EXECUTABLE지정후 node --test extension/content-tests/ig04-receiver-browser.test.mjs; node --test --test-concurrency=2 extension/content-tests/*.test.mjs; node --test contracts/additional-mvp/rc1/tests/legacy-boundary.test.mjs; node extension/content-tools/build-chrome-harness.mjs; node --check; git diff --check. ignored로그receiver-focused*.log/receiver-startup-before.log/receiver-full.log/receiver-contract.log/receiver-build.log. 최종CI exact checkout/tree는외부검증기록에남긴다.
- Draft PR은 codex/ig04-evidence-completion(base8f454c9)위독립4파일diff로제출한다. gate3abe450/snapshot8f454c9은선행미병합commit이며새receiver PR승인으로기존PR/생산연결완료를대신하지않는다. Core다음최소작업:실제native sender/issued frozen입력→verifyInput/isCurrent provider,영속plan commit ACK→reserve,cleanup lease/영속terminal→verifyRelease/verifyCompletion,새Worker재검증/의무복구,조회결과의ContentResult/EffectEvidence·RuntimeReport producer/Server verifier결속. 모두미확정함수/schema는공동합의필요다.
- source기존gate/snapshot/IG01~06·Core·Server·Wire/Schema는수정하지않음. 실제설치/정책START/서비스/Native/DB실행없음. Approve/Draft해제/Resolve/Merge·forcePush없음. 제품수용NOT_RUN,MVP_FINAL_COMPLETE=false.


## 2026-11-03 다훈 격리 수정 — Snapshot 대기 현재성 경합
- 기준 #87 51c0b6398babc36200cb86f1c3793a3c30742bba / #99 28437bad10717b194f3dd089590f7e8b95d0a097. 기존 미커밋 수명·로컬 의무 수정은 보존. 신규 수정은 receiver query/apply의 비동기 결과 소비 경계와 Node 전용 시험에 한정한다.
- query가 Snapshot 대기 전후 기존 receiver revision·adapter instance를 비교하며, 열린 scope의 generation·동기 strict-true 현재 권한을 재검사한다. 전환 중 읽은 Snapshot은 null로 버리고 현재 로컬 상태/의무를 반환한다. fresh old-scope cleanup 조회는 유지한다. apply/duplicate apply는 query 대기 이후에도 기존 revision·권한을 재확인하며 release/퇴역 뒤 accepted:true를 반환하지 않는다. 기존 gate proof 완료 검증은 변경하지 않았다.
- 신규 ig04-snapshot-currentness.test.mjs: 실제 adapter Snapshot의 전달만 지연하는 Node 대역과 실제 gate hash 대기로 검증. release, document/generation, Worker 교체, 관측된 권한 회수 후 재허용, 정상 Snapshot, 신규/중복 apply 경합, identity 생성 귀속·미확인 의무, old-scope/다른 owner 보존 10건. 동일 입력 기존 published receiver 3 PASS/7 FAIL → 수정 10/10 PASS.
- node --test extension/content-tests/ig04-snapshot-currentness.test.mjs extension/content-tests/ig04-startup-local.test.mjs extension/content-tests/claim-ledger.test.mjs contracts/additional-mvp/rc1/tests/legacy-boundary.test.mjs: 총56/56 PASS, FAIL/SKIP0. 격리 artifact의 harness build·receiver/신규시험 syntax 및 git diff --check PASS. 기존 전체 CI는 원래 SHA에만 귀속하며 새 수정본 전체/원격 CI/실제 Chrome 수용으로 소급하지 않는다.
- 한계: 조회·callback 등에서 관측되지 않은 provider 권한 A→B→A는 Content의 동기 boolean만으로 검출 불가. 실제 비재사용 provider revision 계약은 여전히 HOLD. 신규 authority/watch_ref/cutoff_ref/Grant/terminal 및 영속 완료를 생성하지 않음. M1 BLOCKED, 제품 E2E NOT_RUN, MVP_FINAL_COMPLETE=false. Commit/Push/PR/병합 미수행.


## 2026-11-03 다훈 전담 Content 현황 확정·scan0 내부 producer 격리 개발

### 범위·기준·협업
- 사용자 실제 합의: 11/3~4 다훈 Content 잔여 개발·Core/Server 연결 전담. 지민에게 정식 결과물을 인계받았다는 뜻이 아니며, 지민은 중복 개발 방지·기존 구현/계약 검토·기술 지원. 11/5 실제 결과로 잔여 재배분. 최신 사용자 일정 11/11 시연·11/12 발표·11/15 전체 목표가 저장소 예전 2027/2 일정 문구보다 우선한다. 이번에 공용 일정 문서는 수정하지 않는다.
- 이 채팅은 로컬 개발/검증, 「추가 MVP 기능별 통합 및 회귀」는 독립 검토/Git/PR/CI/병합. 「Shorts·SPA 및 세션 안정화」는 #26 이식·composer 경계, 「IG04 Core·Content 연결 계약 정리」는 watch/권한/provider 형식, 「FOCURVE — Web·Server·DB·UI 통합 및 회귀」는 공식 패키지·설치/Native/제품 실행을 유지. 메시지는 발송하지 않고 최근 완료 기록과 원격을 읽었다.
- 현재 integration 원격 e3a3760d43ef0f410beda5b296eb4cd85241638f. #87 a9ba54b18f42814d14475c8d19cff99d3c92165d를 정확히 추출해 시작했다. 기존 열린 receiver checkout2704148은 최신이 아니므로 수정하지 않았다. 기존 lifecycle worktree의 미커밋10파일과 공유 staged삭제1,036파일은 보존한다.
- 새 managed Worktree: C:/Users/dahun/.codex/worktrees/content-scan0-producer/04 · 추가 MVP 구현, detached HEAD a9ba54b18f42814d14475c8d19cff99d3c92165d. 기존 #87/#99/#26 branch/ref/index를 변경하지 않는다. 최초 격리 사본과 실패로그도 남긴다. Commit/Push/새PR/승인/병합 미수행.

### PR 실제 최신 상태 (이 실행 중 #99가 갱신되어 재확인)
| PR | full HEAD | base | 상태·검증 한계 |
|---|---|---|---|
| #82 | 917ab3c8383f80bc4b4f52985e81e3152c115eea | integration/additional-mvp-20261029 | OPEN/APPROVED, check SUCCESS. 독립 추천11/11 기존 근거 재사용; 제품 완료 아님 |
| #83 | 1291aeb18a83a69aff7a0866953b4133c23857bb | integration/additional-mvp-20261029 | OPEN/CHANGES_REQUESTED, 현재 rollup 비어 있음. 댓글20/추천11/흑백19 기존 수정/검토를 재개발하지 않음. 과거 Core 승인과 현재 보호조건 구분 |
| #87 | a9ba54b18f42814d14475c8d19cff99d3c92165d | codex/ig04-evidence-completion @8f454c937c905ed7ad4e0650274e27b2830812ea | OPEN/Draft, Snapshot3파일 게시 완료. CI41605776604 Content462/462·계약6/6. GitHub APPROVED 집계의 기존 리뷰는2704148 귀속이며 최신 수정3파일 독립4/4와 전체 최신 담당승인은 구분 |
| #97 | 33b88f810f4e56bb42f4956c95860dab70a55cbb | codex/ig04-content-receiver | OPEN/Draft/APPROVED, check SUCCESS. URL/Session 직접69/69(계약6 포함) 기존 근거. #99와 별도 자손이며 서로 상속했다고 가정하지 않음 |
| #99 | e701b33e123ac4f9b4622b5c076ceeb452b1aba9 | codex/ig04-content-receiver @a9ba54b | 점검 초기28437bad였으나 통합 채팅에서 정상 상속 갱신. a9ba54b ancestry 직접 확인. CI41606827603 Content527/527·계약6/6, 시험 tree24a532ba9447dd8d2fae168d47428059b13653fa 일치 근거. 새HEAD 변경분 지민/종민 재검토 필요 |
| #26 | 47f3cb409d1b499fb1736eacd9c682121b88f647 | develop | OPEN/Draft/REVIEW_REQUIRED·CI5개SUCCESS. 공유 ClaimLedger 이식91/91·누락fixture 보완·Git 반영은 Shorts/통합 채팅 결과. 본채팅 재구현 금지, 실제 제품 Shorts PARTIAL |
| #78 | 6bddd0c1231cf6050cb4fa286a1040ea00a3824c | integration/additional-mvp-20261029 | OPEN/APPROVED, RuntimeReport producer 독립 구현·CI PASS. 실제 source/effect/epoch verifier·Worker 호출은 별도 |
| #80 | 62c02aac9c69d842f91e7954baa82562c9932c21 | integration/additional-mvp-20261029 | OPEN/APPROVED, replay/checkpoint 독립 구현·CI PASS. 제품 scheduler/authority 연결 아님 |
| #98 | 505e9738f78c509fabe84abdccf54ae086c1537d | feature/additional-mvp-runtime-report-outbox | OPEN/APPROVED, delivery 독립 구현·CI PASS. Content 효과/cleanup 완료를 ACK로 대신하지 않음 |

### 기능별 현재 상태표
구현/합성PASS/독립검토/게시/통합/제품은 서로 다른 축이다. 아래의 실제 Core↔Content/Chrome 제품 수용은 전부 미완료 또는 NOT_RUN이며, 과거 실패 제품 실행은 별도 보존한다.
| 범위 | 실제 코드·이미 구현된 부분 | 자동/독립 검토·Git | 실제 남은 부분 |
|---|---|---|---|
| 사이트 차단·페이지 숨김 | ClaimLedger.hide/conceal·NavigationSurfaceSession 및 Core DNR 별개 | Content 공통 owner/restore 회귀 재사용; DNR을 Content에 중복 구현 안 함 | 제품 frozen/issued/native 권한과 feature executor 연결 |
| 키워드 URL·미디어 정지 | #97 inspectKeywordUrl/KeywordSession.start/scan/release, URL 전용·미디어 pause·동적 body·scope cleanup | 독립 구현/시험/담당검토/Commit·Push 완료, 미병합 | trusted frozen/native URL·영속 의무·lease·전체 Unicode/IDNA profile 동등성·제품 연결 |
| 이미지 블러 | #99 BlurSession·두 모델·HIGH·이미지 교체·reveal·지연 결과·SPA 퇴역 | 구현/자동/독립 검토/게시, 최신 Snapshot 상속/CI 완료, 미병합 | 실제 정책·Core 권한/효과전 ACK·보고·제품 성능/정답셋·제품 복원 |
| YouTube 옵션·Shorts | 각 Navigation/WatchPanel/Autoplay·기존 Shorts 실행 코드 | 공통옵션 회귀PASS; #26 독립이식91/91과 Git/CI는 별도 source | A0 content-entry/A1 content/member-a1 content 실제 composer의 공유 원장 주입·제품 Shorts 수용. 전용 채팅 소유 |
| IG01~06 | Stories/Reels/Explore/Comments/Suggestions/Grayscale Session·scoped 원장/복원 | #56/#58/#61/#64/#65/#71 병합 확인, #82/#83 미병합. 기존20/11/19와 현재477 합성회귀는 겹치므로 합산하지 않음 | 각 기능 정책 전달/효과전 예약/실제 수용. IG04 외 gate가 제품에 연결됐다고 가정 금지 |
| 동적 DOM·target교체·원래스타일/속성/미디어 복원 | Session scan/MutationObserver·ClaimLedger·Instagram media·Autoplay/Keyword media | partial setter/foreign/다른owner/late callback 회귀PASS | 실제 사이트 drift·인증화면/제품 workload·영속 복원과 새 문서 재결속 |
| START·END | 내부 start/apply·stop/invalidate·releaseFeature/release 분리 | 자동PASS/게시. receiver 접수≠효과, release≠외부cleanup완료 | Worker 실제 명령·권한·ACK·결과·Server·정상제품END |
| document/generation/instance·Worker권한회수 | receiver #current/#cleanupLifetime·gate epoch/context·Session scope | default deny·퇴역·늦은응답 회귀PASS | 인증된 provider token 비재사용·Worker재시작 인수/재검증 |
| pushState/replaceState·뒤/앞 | Navigation currententrychange·popstate/hashchange·refresh/receiver URL 퇴역 | SPA 왕복·sameURL·페이지이동 합성PASS | 실제제품 sender/channel·History 수명·새문서 권한 발급 |
| BFCache/새문서·세션 재진입 | pagehide 단방향 retire·LIVE cleanup fence·새Session 요구 | 모의persisted return 재활성 차단PASS | 실제 Chrome BFCache 수용, 자동 reauthorization/reapply 소비자 미연결 |
| cleanup 실패·재시도 | 원래 ClaimLedger 목표/타owner보존·original scoped release·pending 유지 | 자동/독립근거 재사용·현재477회귀PASS | 영속 lease/closure·terminal·재시작 recovery는 Core provider 필요 |

### 다훈 구현 재사용·Git 상태
- gate3abe450, snapshot/hook8f454c9, receiver2704148을 재구현하지 않았다.
- 완료 proof 대기 revision 재검사, SPA왕복 퇴역, local_startup/부분시작, plan0/identity=null/미확인reserve tracking은 #87의523612f/51c0b639에 반영된 실제 코드다. snapshot 경합 수정은 a9ba54b로 게시 완료. 수정전3PASS/7FAIL→10/10·영향56/56·독립4/4를 기존 동일소스 근거로 재사용하며 다시 실행했다는 뜻이 아니다.
- #99 신규 블러 수명/퇴역/해제·cleanup 보완은28437bad, 최신 a9상속은e701b33e로 게시 완료. 최신527 CI 근거를 과거469와 구분한다. #87의 a9와 #99 e701에서 이번 수정대상 receiver/adapter/navigation3파일이 동일 blob임을 직접 diff확인했지만, 이번477은 #99 모델/전체527 누적 후보 검증을 대신하지 않는다.
- verifyInput은 await 결과 ===true, isCurrent/getGeneration/Worker는 동기 strict guard 유지. Snapshot await 전후 receiver revision·adapter identity·현재성 재검사 및 proof await 이후 gate #cleanupRevision 재검사 유지. 이번에 이 기존 수정들을 다시 변경하지 않았다.

### 잔여 개발 A/B/C/D 분류·우선순위
| 후보 | 이미 구현됨 / 실제 공백 | 파일·함수와 선행 조건 | 분류·담당 충돌·영향검증 |
|---|---|---|---|
| P1 scan0 producer | 개별 snapshot/stop/scan flags는 존재; 자원종료/실제queue drain을 묶는 호출점 부재 → 이번 구현 | NavigationSurfaceSession / Adapter / Receiver.quiescenceSnapshot | A, 내부 only. Core형식 변경 없음; 공유클래스 영향 전체477 필요. 독립리뷰/Git는 통합담당 |
| P0 실제 시연 policy/effect 흐름 | local executor만 있고 production receiver channel/provider/composer 부재 | 실제 Worker→검증 input→watch영속준비→reserve commit→DOM→evidence producer→RuntimeReport78→replay80/delivery98→Server verifier | C+D, Core 윤종민·Server 총괄 다훈·실행 별도 승인. fake ACK 금지 |
| P1 watch_ref async consumer | verifyInput strictboolean·adapter.start 경계 존재, 별도 async 참조소비 없음 | IG04ContentReceiver.apply에서 adapter 생성/시작 전, cancellation·원래context/transport·local revision 전후검사. 실제 watch_ref/read 계약 확정 후만 연결 | B/C. verifyInput 반환을 DTO로 바꾸거나 isCurrent에Promise 삽입 금지. 실패/lost/stale/권한회수 회귀 필요 |
| P1 미시작/부분시작/plan0 closure | local_startup·receiver/adapter자원·local_plan_id/identity=null·called/unobserved는 이미 있음 | local producer 결과+원본 record 식별을 Core closure 소비와 연결할 부분만 남음 | A 국소 관측 준비는 이번까지, B/C 외부closure는HOLD. 미시작watch없음으로 대체 금지 |
| P1 cleanup-only takeover | original scope release/다른owner원장 보존은 존재; 새Worker의 검증된 인수consumer 없음 | receiver release/completeReservation의 별도 facade, 원래identity/transport 유지 및 검증된Grant/lease·조회/cutoff 필요 | B/C. APPLY재승인과 분리; Core 기존원본/인수 API없음. 예전instance 권한을 boolean으로 되살리지 않음 |
| P0 trusted Worker channel | getWorkerInstance·native document/current callback은 있음; 실제 runtime listener/인증sender/bootstrap 없음 | Worker registry/admission 실제issuer·현재channel·nonreuse revision provider | C. Content가 emitter/issuer/secret을 대체 발급하지 않음 |
| P1 SPA/BFCache/새문서 자동재적용 | 퇴역/효과차단/cleanup은 구현; production 재승인 요청→새frozen권한→새receiver는 미연결 | navigation document registry/Worker 요청·새capability·prior-footprint/cleanup lease가 먼저 | B/C/D. #26 전용개발을 가져오지 않음 |
| P2 기능 조합·local 자원종료 | 개별 owner/effect/cleanup 시험은 존재, 최신#97/#99/producer 누적 연결 근거는 아직 없음 | KeywordSession/BlurSession 독립 종료관측 확장 여부는 IG04리뷰후 실제 공백 기준. 구현된수명수정재개발금지 | A 로컬만 가능. 통합채팅의Git/CI 누적작업과 중복하지 않음 |

### 공유 계약/provider 경계
- 최신 검토 후보 LOCAL-ORIGIN-P2-CURRENTNESS(manifest87b07a2d746b8ccccd2d4e95a0265c1f5e37c0091b0410d172ae4f2b09b3d84a). W3-TYPE-R1/P1을 대체로 뒤집지 않고 identity6필드·binding/cutoff·타입/canonical 유지, 원본 async lookup 뒤 소비전현재성 보완. 계약채팅 독립23/23+추가15/15, 기존104/R243/RC25/canonical268 bytes동일 재사용.
- 이는 공동최종승인/생산 API 제공이 아니다. 실제 provider가 revision/fence A→B→A로 값을 재사용하면 두endpoint비교만으로검출못함(별도 관측2). 인증source·원본immutable lookup·nonreuse revision/fence·최종소비/영속commit 결속은 윤종민Core provider 책임과 실제Serverauthority 입력 필요. M1 BLOCKED 유지.
- 이번 local_quiescence 구조는 Content 내부 진단이며 위 DTO의 result/CLOSED_LOCAL/evidence_sha256/watch_ref/cutoff_ref/Grant/terminal을 생성하지 않는다. 원래 input context는 frozen 사본이며 실제 권한 성공 proof가 아니다. scope가 없던 미시작receiver에 임의watch/plan을 만들지 않는다.

### 이번 실제 구현·실패→통과
- 내부 quiescenceSnapshot()를 Session→Adapter→Receiver로 연결. Session은 동기 close로 신규예약·효과 차단, 실제 queued microtask와 sync scan stack가끝난후 snapshot. busy/scheduled를강제false로쓰지않음. own observer/listener를 개별 추적하고 각remove/disconnect 실패에도 나머지정리를시도, 미확인은보존/재시도. LIVE/claim/복원목표/외부예약의무는보존.
- receiver는 자기pagehide/navigation listener도정리, 비동기input검증미종료·Worker/document변경·revision경합은locally_quiescent=false/구snapshot폐기. APPY재활성금지, 원래scopedRELEASE는기존경로로별도검증후가능. 단순정지는복원·cleanup완료가아님.
- scan0과reserve callback완료분리: reserve_callbacks_unsettled>0이면scan_drained=true일수있어도locally_quiescent=false. 늦은callback은새효과를만들지않으며실제응답관측후재조회가능. callback이응답해도record.obligation_pending과cleanup_pending은Core완료검증전유지한다.
- 최소3반례(queued scan/수신기전체자원/미시작/제거실패재시도 중3명시시험): 이전API부재로0PASS/3FAIL → 같은3을최종신규15에포함PASS. 이것은새연결요구미구현확인이며기존승인기능결함으로소급하지않는다.
- 중간공통disconnect후기존제거실패회귀1FAIL 발견→자원미해소를release restored=false에포함해기존회귀36/36확인. 시험작성중frozen context변경을허용한다고잘못가정한assertion은TypeError거절을확인하도록정정. 기존gate가없는plan0로잘못가정한시험도빈gate.local_records기준으로정정. 초기로그는그대로보존.
- 변경제품3파일: extension/content/{navigation-surface,session-adapter,ig04-receiver}.mjs. 신규시험2파일 ig04-quiescence.test.mjs(Node9) / ig04-quiescence-browser.test.mjs(Chrome합성6), 본카드1 =6파일. #99블러/#97키워드/#26/Core/Server/schema는수정하지않음.
- 최종정확소스전체Content477/477 = 기존#87 462 +신규15, FAIL/SKIP0. 계약6/6·기존harness빌드·모든Content/test MJS node--check·gitdiff--check PASS(각종료0). 초기483전체는기존6시험을복사prefix에중복포함한중간후보이며최종수에합산하지않음. 이후callback미확인조건보완/중복제거후정확477새전체검증. #99최신527과도합산하지않음.
- 환경: Node24.19.0 / 기존Playwright1.62.1 / 설치Chrome headless 임시합성context·network route.fulfill. 실제확장설치/사용자Chrome/Native/DB/START/END/서비스미실행. remoteCI는이번미게시diff에대해NOT_RUN, 독립리뷰도대기.
- 명령: PLAYWRIGHT_MODULE=기존runtime dependencies/node/node_modules/playwright, CHROME_EXECUTABLE=설치Chrome경로를지정해 node --test --test-concurrency=2 extension/content-tests/*.test.mjs; node --test contracts/additional-mvp/rc1/tests/legacy-boundary.test.mjs; node extension/content-tools/build-chrome-harness.mjs; node --check; git diff --check.
- 증거디렉터리 C:/Users/dahun/.codex/visualizations/2026/10/31/01a191b6-1724-73b2-b0e1-0149c53fba64/content-scan0-20261103/: final-content-full.log/final-contract.log/final-build.log/verification.json/content-scan0.patch/pr-state.json. 새코드와문서SHA256·基準tree·명령/종료코드/실패경과기록. 실행시험프로세스종료·임시브라우저정상정리완료, 새상시서비스/자동예약/잠금생성없음. 기존타작업프로세스/잠금은변경하지않음.

### 다음 작업·11/4 범위·11/5 재분담
1. 즉시: 이번15시험/3생산파일독립리뷰 → 통합담당이승인된Git범위에서#99누적후보의정확tree에반영/검증. 본채팅은Commit/Push를대신하지않음. 같은3생산파일의#87/#99기준동일성확인완료.
2. 다음독립후보: Keyword/Blur의실제정책조합에필요한로컬자원종료·callback관측공백만확인/준비. 이미완료된#99수명·#97media/ClaimLedger알고리즘은재구현하지않음. 별도소유자/미커밋과안겹치는격리후속으로만진행.
3. 다음연결후보: watch_ref별도async참조consumer→미시작/plan0 closure→cleanup-only takeover. 이셋은공유형식/실제provider선행이며지금독립완료가능이라고보고하지않음. 동기strict guard/원본identity/응답후currentrevision검사재사용.
- 11/4까지다훈범위: producer독립리뷰후보/정확누적영향검증·로컬실패재현/수정, 공동형식확정즉시Content asyncconsumer최소연결. provider가없으면실제연결완료기한은확약불가. 단순시험수확대/임의권한발급으로시간채우지않음.
- 11/5지민재분담후보: 실제Instagram DOM드리프트/IG01~06 제품수용·미디어/복원수동사례,정해진형식의Contentwatch/cleanup consumer,새문서/BFCache자동재승인client 및keyword/blur실제사이트검증. 본결과를정식인수인계받았다고가정하지않고당시HEAD/진척에따라배정.
- 실제제품전필수: 공동동일후보수락·신뢰issued/frozen/nativeauthority·영속watch/planprovider·검증된ACK·lease/oldscopeclosure·Workerchannel/restartadoption·RuntimeReport/ServerEvidenceVerifier결속·승인된공식설치환경과실제정책ON/OFF/복원/재기동수용. 이번로컬결과가이를대체하지않음.
- NO_FURTHER_CHECK 아님: 안전한로컬producer는실제개발완료했으나독립리뷰/제품연결잔여존재. M1 BLOCKED / Shorts PARTIAL / 제품E2E NOT_RUN / MVP_FINAL_COMPLETE=false.
