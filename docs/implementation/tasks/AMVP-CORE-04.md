# AMVP-CORE-04 — Core DNR 소유권·복원

## 2026-11-02 IG04 — 검증 대기 취소/만료 후속 단위

- 담당 윤종민, branch `feature/additional-mvp-ig04-verification-lifetime`, 시작/선행 PR86 `fc36d5ba3c41a7aa73e064322e6878775dfe23ef`. 기존 PR86 source/branch와 Content 계보를 보존한 별도 후속이다.
- issued/native/Registry 검증이 끝나지 않을 때 기존 expiresAt·요청 abort·명시적 invalidate로 대기를 종료한다. 늦은 성공/거절의 후속 실행·gate pin 차단, 개별취소/전체폐기 분리, monotonic 잔여 예산·잘못된 clock 거절, 최초 오류 보존을 구현했다. 새 ACK/TTL/Wire/DB·실제 정책 활성화 없음.
- 기존 3반례 base0/3→수정3/3. 최종 신규15+기존 admission32+Registry15=62/62·전체Extension1026/1026·계약6/6 PASS(fail/skip0), PR87 실제receiver 합성/IDB 호환1/1 PASS. 모의 issued/native/authority로 제품 수용 NOT_RUN. 집합 중복 합산 금지, 중간 구현/fixture 실패도 근거 문서에 보존.
- 상태: 구현·로컬검증 완료/새PR·리뷰 대기. 원래 PR86의 검증된 내용과 이번 후속 scope를 구분하고 새CI·다훈/지민 확인 후 통합한다. 실제 영속 예약·ACK/proof/cleanup·Worker 연결은 공동합의 대기이며 임의 구현하지 않는다. 상세 [검증 수명](../evidence/AMVP-CORE-04-ig04-verification-lifetime.md).

## 2026-11-02 IG04 — 발급 문맥/plan 사전 검증 단위

- 담당 윤종민, branch `feature/additional-mvp-ig04-admission`, 시작 integration `831069805eb0f86fc526b1f0f92e0b4a01656172`. Content `8f454c93`/gate3abe4504/#83 계보를 읽기 기준으로 보존한다.
- 내부 IG04PlanAdmission은 기존 A1 digest·DocumentControlRegistry 조회와 RC2 BindingScope/FocusRef를 재사용한다. context/plan 복사·동결·hash 검사, strict issued/native provider와 동기 current/deadline, await 이후 권한/문서 epoch·gate instance 검사를 구현했다. source 신규1/시험 신규1/선택 browser probe1/CI1/기록이다.
- 이번 범위는 영속 예약 전 admission이며 저장·Content용 ACK·CleanupGrant·DOM 효과·Report·scoped RELEASE/terminal 증거를 발급하지 않는다. 기존 stage를 per-target ACK로 대용하지 않고 실제 listener/START를 활성화하지 않는다. #76/78/80/84·기존 다른 worktree/제품 소스를 보존한다.
- 신규32+Registry15=47/47, 전체Extension1011/1011·계약6/6 PASS(fail/skip0). actual Content8f454c93 + Chromium151 실제IDB 호환1/1에서 예약ACK 없음→DOM효과0·의무보존 확인. 발급/native는 모의이며 제품 MV3/Server 수용 NOT_RUN. 겹치는 집합 합산 금지. 최초 fixture 실패1건과 수정도 근거 문서에 보존했다.
- 상태: 로컬 구현·검증 완료, PR/담당 리뷰 대기. 새 CI 결과는 별도 확인한다. 다음은 공동 ACK/증거 매핑 합의 후 실제 예약 원자 저장/조회 caller 연결. 상세 API·명령·미완료는 [IG04 사전 검증](../evidence/AMVP-CORE-04-ig04-admission.md).

## 2026-11-01 PR68 — PR59 병합 후 3공유파일 충돌 해결

- 새 결합 workflow 로컬 검증: DNR138/138·SiteController/loop69/69·인증33/33·계약6/6, syntax·수동3파일 whitespace PASS. 기존 #68 제품/시험4/4 및 최신 통합+원래 #68의 Extension 전체325/325 blob 동일성 확인. 각 시험 집합을 중복 합산하지 않으며 전체/실제 Chrome 시험을 새로 실행했다고 보고하지 않는다.

- 담당 윤종민. 기존 검토 HEAD `cd92cc11e81c53598ba7a80ee41ceeea2c3a2dad`와 최신 통합 `3569911dde9ec71d86c3b1e36f631c34e2411d53`를 부모로 보존하는 merge 동기화다. 선행 PR59의 merge `3f31f75e8be65996af3b1fb94a846b0df2d7c085`를 포함한다.
- 수동 해결은 CI·본 카드·통합현황 3파일만이다. #59/#68 trigger·시험과 #70 SiteController/CAS·인증·계약·syntax 명령을 모두 유지한다. 문서 양측 원문의 줄별 중복 횟수까지 보존했으며 아래 기록은 당시 이력이다.
- 제품·시험은 승인 통합 원본과 기존 #68 blob을 보존한다. 합성 후보 workflow를 검증하고 새 HEAD·checkout SHA·CI를 PR에 남긴 뒤 다훈·지민 재확인을 받는다. 이전 Approve를 새 HEAD로 소급하지 않으며 실제 MV3/Server 수용·자동 병합은 하지 않는다.

## 2026-11-01 PR68 최신 통합 최소 동기화

- 동기화 후 검증: owner/잠금/cleanup + #70 CAS 관련 188/188, 전체 Extension 905/905, 계약6/6, Chromium 실제 IndexedDB/Web Lock 2/2, bundle 원본 일치·syntax/diff PASS. DNR·권한/문맥은 모의이며 제품 MV3/Server 수용은 미검증 유지. 집합 중복 합산 금지.

- 기준 통합 `4e6ff6ced95b96f362f2fbf088aa192e17278529`(#70 승인·병합), 기존 검토 HEAD `38eae392bffbd966ef146dcf07017a40cc08de74`를 부모로 보존하는 merge 동기화다.
- 충돌한 CI·본 작업카드·통합현황 3파일을 양쪽 경로/시험/기록이 남도록 정리했다. 기존 제품·시험 blob과 #70 통합 제품·시험 blob 동일성을 검사하며 구현/검사 조건을 바꾸지 않는다.
- 원래 owner/잠금/cleanup 및 #70 journal CAS의 영향 회귀·최신 CI 후 새 HEAD로 재리뷰한다. 실제 MV3·Server 제품 수용/신규 공유 정책 활성화·PR 병합은 수행하지 않는다. 결과·blob 대조는 해당 PR에 기록한다. 아래 날짜별 기록은 원문을 보존한 이력이다.

## 2026-11-01 구형 GuestSession DNR 연결 착수

- 담당 윤종민, `feature/additional-mvp-legacy-guest-dnr`, 시작 `10ab6026f1cf7d244a75ee529830afb8bcf6b8c8`. PR59는 OPEN/리뷰 없음으로 보존하고, 기존 병합55 gate에만 의존하는 별도 worktree에서 진행한다.
- 기존 계획의 남은 legacy writer 중 GuestSession의 add/remove만 공통 gate에 연결한다. SiteController·PR59 소스/HEAD·공용 계약·Member/Content/Server는 변경하지 않는다. 신규 공유 정책/전체 coverage는 활성화하지 않는다.
- 현재 owner/executor/Guest auth·Root idle·AuthStore token, 실제 규칙 및 동일 DB snapshot을 검사한다. 잠금 대기 중 대상 변경 후 복구가 새 세션을 덮어쓰지 않도록 legacy SessionDB.save에 내부 scope precondition을 추가한다. 저장 schema/버전은 불변이다.
- 상태: 구현·검증 진행 중. 저장 실패 cleanup·권한 변경·기한·다른 owner/실행 규칙 보존과 기존 회귀를 자동 검증하고 별도 PR/담당 리뷰를 요청한다.

### 구형 GuestSession 단위 구현·검증 종료

- classic add/remove를 기존55 gate에 결속했다. 신규 add의 현재 인증/owner/기한/token·final DB route/snapshot/rules 검사, removal-only의 exact footprint 검증을 분리해 기존 정당한 cleanup을 유지했다. SessionDB.save의 내부 scope/create precondition으로 대기 중 current handoff 후 old recovery가 새 세션을 덮지 못한다. 저장 schema/DB version/공용 계약은 불변이다.
- 신규18/18·기존 session-core19/19·DNR96/96·전체 Extension882/882·계약6/6 PASS(fail/skip0). Chromium151 실제 IDB/Web Lock scope handoff1/1·syntax/diff PASS. 중복 합산 금지. PR59 미병합19시험 대신 본18시험을 포함한 별도 기반이므로883과 직접 증감 비교하지 않는다.
- 모의 DNR/owner/auth·fake-IDB 모델과 실제 Chromium 저장/잠금의 범위를 구분한다. 초기 fixture/저장 실패 주입 위치를 바로잡고 실패 로그를 보존했다. [구형 Guest writer 설명](../evidence/AMVP-CORE-04-legacy-guest-dnr.md).
- 구현·로컬 검증 완료, 별도 PR/최신 CI·담당 리뷰 대기. 원래59/다른 worktree·Member/A1/Content/Server 소스를 보존했다. SiteController 및 전체 writer coverage·SITE_TIME 실제 실행·Report/ACK·제품 수용은 후속이다.
## 2026-11-01 PR59 최신 통합 최소 동기화

- 동기화 후 검증: owner/잠금/cleanup + #70 CAS 관련 189/189, 전체 Extension 906/906, 계약6/6, Chromium 실제 IndexedDB/Web Lock 3/3, bundle 원본 일치·syntax/diff PASS. DNR·권한/문맥은 모의이며 제품 MV3/Server 수용은 미검증 유지. 집합 중복 합산 금지.

- 기준 통합 `4e6ff6ced95b96f362f2fbf088aa192e17278529`(#70 승인·병합), 기존 검토 HEAD `e64c140ebf8effedd9358f037a86cc8240ae96f4`를 부모로 보존하는 merge 동기화다.
- 충돌한 CI·본 작업카드·통합현황 3파일을 양쪽 경로/시험/기록이 남도록 정리했다. 기존 제품·시험 blob과 #70 통합 제품·시험 blob 동일성을 검사하며 구현/검사 조건을 바꾸지 않는다.
- 원래 owner/잠금/cleanup 및 #70 journal CAS의 영향 회귀·최신 CI 후 새 HEAD로 재리뷰한다. 실제 MV3·Server 제품 수용/신규 공유 정책 활성화·PR 병합은 수행하지 않는다. 결과·blob 대조는 해당 PR에 기록한다. 아래 날짜별 기록은 원문을 보존한 이력이다.

## 2026-10-31 Guest A1 DNR writer 연결 착수

- 담당 윤종민, 브랜치 `feature/additional-mvp-guest-dnr-fence`, 시작 기준 `24327d1bd8615a2274a6dead43f23b71cc06b64e`(#55 수정본 승인·병합). 별도 worktree에서 기존 다른 Core 작업/리뷰/미커밋 변경을 보존한다.
- 범위: Guest A1의 초기 add·UNKNOWN 복구 add·suspend remove·finish remove를 기존 공통 DNR gate/Root 원장에 연결한다. 현재 Guest owner/executor·인증 guest 허용 상태·AuthStore token·최종 DB fence/END/NR·DOM 기한을 대조하고 자기 cleanup은 보존한다.
- 회원 경로는 재작성하지 않는다. 구 GuestSession/SiteController·전체 writer coverage true·SITE_TIME 발급/Report/Server/Content/공용 계약 변경은 제외한다. Guest START가 이미 Auth.serial을 보유하므로 잠금 안에서 status/guardGuestStart를 중첩하지 않는 로컬 auth.load 경계를 검증한다.
- 상태: 구현·검증 진행 중. 끝나면 영향 자동 회귀·제품 미검증·새 HEAD/PR 및 담당 리뷰 요청을 기록한다. 실제 MV3 확장 로드는 현재 환경의 관리 정책으로 미검증이며 이를 우회하지 않는다.

### 이번 Guest actor 단위 구현·검증 종료

- 기존 Member gate와 정확히 같은 객체/Root 원장을 쓰는 `FocurveDnrWriter` 별칭을 추가하고 Guest보다 먼저 로드했다. 현재 Guest 네 쓰기 경로는 입력 동결·current owner/Guest auth·Root idle·AuthStore token·최종 DB fence/END/NR/DOM 검사 후 동기 dispatch한다. `auth.load()`만 사용해 이미 보유한 MemberAuth serial을 중첩하지 않는다.
- 신규19/19, DNR97/97, 전체 Extension883/883, 계약6/6 PASS(fail/skip0). Chromium151 실제 IDB/Web Lock의 Guest/Member END 비차단2/2, 생성 bundle 일치·syntax/diff PASS. 시험 집합은 겹치며 합산하지 않는다. DNR/identity/Content는 모의이고 실제 제품 수용은 미검증이다.
- fixture GENERAL+BLOCK/VM fetch 미주입의 준비 오류를 바로잡고 실패 기록을 보존했다. 제품 Snapshot·인증·복원 조건을 완화하지 않았다. 상세 [Guest writer 연결](../evidence/AMVP-CORE-04-guest-dnr-writer.md).
- 이번 단위 코드/검증 완료, PR 게시·다훈/지민 최신 HEAD 리뷰 필요. Core 전체는 부분 구현이다. 기존 다른 worktree·Member 소스/공용 계약/Server·Content는 보존했다. 구 GuestSession/SiteController 등 남은 writer, 실제 issued binding/SITE_TIME/Report/ACK·제품 수용은 후속이다.
## 2026-11-01 SiteController DNR guard 착수

- 담당 윤종민, `feature/additional-mvp-site-controller-dnr`, 시작 `10ab6026f1cf7d244a75ee529830afb8bcf6b8c8`. PR59/68은 OPEN/리뷰 대기로 보존하고 독립 worktree에서 병합55 gate에만 의존한다.
- 기존 계획의 SiteController add/remove/rollback·MemberExecutionLoop cleanup을 공통 gate/영속 footprint 검증에 연결한다. MemberJournalStore에 내부 CAS 저장·readonly footprint callback을 추가하며 DB version/schema/공용 계약은 바꾸지 않는다. auth 토큰·현재 명령/owner·기한을 마지막 dispatch에 결속한다.
- Scope는 기존 source와 생성 classic Member bundle·시험/CI/기록이다. A1/Member Core·Content/Server·미병합59/68 source·신규 공유 정책/전체 writer coverage 활성화는 제외한다. 상태: 구현·검증 진행 중.

### SiteController 단위 구현·검증 종료

- add/remove/rollback/loop cleanup에 기존55 gate와 readonly 영속 footprint 검증을 연결했다. 신규 add는 auth token·현재 로컬 owner/private command/기한을 final snapshot에 결속한다. 기존 Server 검사는 유지하며 잠금 안에서는 auth.load만 사용해 Auth.serial/HTTP 중첩을 피한다.
- MemberJournalStore 내부 CAS로 초기 생성·APPLIED·rollback·RELEASE pending/final의 원래 journal을 확인하고, 늦은 old actor가 새 operation을 덮지 못하게 한다. 저장 schema/DB version/공용 Wire·기존 control namespace 의미는 불변이다. 기존 생성기에서 classic Member bundle만 재생성했다.
- 신규23/23·DNR101/101·기존 SiteController/loop/runtime69/69·전체887/887·계약6/6 PASS(fail/skip0). Chromium151 실제 IDB/Web Lock CAS 보존1/1·bundle 일치·syntax/diff PASS. 집합 중복 합산 금지. 인증 큐 보유 중 생성 Member APPLY 완료, native/저장 실패 cleanup, invalid Snapshot RELEASE 등 포함. 실제 DNR/Server 권한/Content는 모의이며 제품 수용은 미검증이다.
- 구현·로컬 검증 완료, 별도 PR/최신 CI·담당 리뷰 필요. [SiteController 설명](../evidence/AMVP-CORE-04-site-controller-dnr.md). PR59/68/다른 worktree 보존. 통합 coverage·issued binding/SITE_TIME/Report·제품 수용은 후속이며 전체 guard/정책을 활성화하지 않았다.

## 2026-10-31 PR55 P2 수정·재리뷰 준비

- 시작 `b11dcc582de625152039ad42d3baabe5dc5f52dc`, 같은 `feature/additional-mvp-legacy-dnr-fence`/PR55에서 독립 리뷰 `5722433929`의 current owner 반례만 수정한다. 기존 로컬 변경 없음과 원격 HEAD 일치를 확인했다.
- 실제 잠금 queue + Member tick에서 owner/executor/identity 실패 3가지 모두 수정 전 무권한 dispatch가 발생함을 재현했다. 잠금 안에서 신규 add의 현재 owner/executor를 다시 검증하고, AuthStore 저장 시작/완료 token을 최종 동기 dispatch에 결속했다. removal-only는 기존 자기 journal·물리 rule·DB fence 검사를 유지해 정당한 이전 owner cleanup을 보존한다.
- 새 반례/보존 7/7, writer29/29, DNR78/78, DNR+인증/재인증111/111, Member/Core/인증 영향24파일287/287, 계약6/6 PASS(중복 포함, 합산 금지). Chromium 실제 IDB/Web Lock END 비차단1/1, 생성 bundle 일치·syntax/whitespace PASS. 전체 Extension857은 수정 전 결과로 이번 전수 회귀 결과가 아니다.
- 시험의 DNR/identity/Content는 모의다. 실제 MV3·Windows Chrome·전체 writer/제품 적용·Report/ACK는 미검증 유지. 재현·코드/영향/로그/내부 token의 한계는 [Member writer 설명의 P2 수정 절](../evidence/AMVP-CORE-04-member-dnr-writer.md)에 기록했다.
- 상태: 수정·영향 검증 완료, 같은 PR55에 게시 후 최신 HEAD 재리뷰 필요. 기존 Content Approve를 새 HEAD로 승격하지 않고 다훈·지민의 변경 범위 확인을 요청한다. 병합/후속 actor 개발은 이번 수정에 섞지 않는다.

## 2026-10-31 Member A1 실제 DNR writer 연결 단위

- PR53 f29532c는 다훈·지민 승인 후9e37b37로 통합됐음을 확인했다. 최신 통합 `9e37b37fefb2238f259c6a1bba400eee6955d085`에서 별도 `feature/additional-mvp-legacy-dnr-fence`를 시작했다. 기존 focurve-core 미커밋 변경·PR46/48·승인된 증거 조회 소스를 보존한다.
- 호출 지점을 조사해 Member A1/Guest A1/구 GuestSession/SiteController로 나뉨을 확인했다. 이번 첫 PR은 현재 제품 Member A1 네 쓰기 경로만 연결하며, 전부 한 번에 수정하거나 전체 guard를 true로 바꾸지 않는다.
- `additional-dnr-legacy-writer.js`와 생성 Worker bundle, service-worker/Member bootstrap 주입. Member Core의 초기 적용·UNKNOWN 복구·suspend·finish가 동일 DNR Web Lock에서 기존 runtime claim을 보호한다. 현재 실행 DB의 동일 snapshot에서 마지막 owner/END/fence/기한을 확인하고 Native dispatch한다. Chrome 응답이 DB transaction을 붙잡지 않는다.
- 기존 RootAuthority DB의 metadata 원장을 재사용하며 새 DB version/migration·공용 Wire/Report·Server/Content·관측 모듈은 변경하지 않는다. 다른 DB coordinator나 Guest/이전 writer의 보호/제품 활성화를 자동 승인하지 않는다.
- 신규22건에서 원장 보호/잠금 대기/실제 Member 네 경로/배포 flags/Native 대기 중 END intent/입력 동결/RootAuthority metadata 보존을 검증했다. 초기 6건은 DNR 없는 fixture 선택 오류였으며 DNR 생성 fixture로 바로잡았다. 자세한 API·잠금 순서·범위: [Member writer 연결](../evidence/AMVP-CORE-04-member-dnr-writer.md).
- 최종 로컬 검증: 신규22/22·DNR71/71·전체 Extension857/857(fail0/skip0), 계약6/6·syntax/whitespace PASS. 실제 Chromium151 IndexedDB/Web Lock 기반 Chrome 응답 대기 중 END commit 시험1/1 PASS. DNR/실행 신원은 모의다. 생성 Member/guard bundle 일치 검증을 포함한다.
- 상태: 이번 Member actor 연결 단위 구현·로컬 검증 완료, PR 제출/최신 원격 CI·다훈·지민 리뷰 후 다음 actor로 진행한다. 실제 MV3 DNR·전체 legacy writer 결속·issued binding/RuntimeReport 생산·전송은 미완료다. 원래 미커밋 변경과 다른 PR은 보존한다.

## 2026-10-31 SITE_TIME 증거 결속·조회 단위

- 담당 윤종민, `feature/additional-mvp-site-time-evidence`, 시작 기준 `467fe18b176ccd571813d04229e8ee69f19a00d2`. 원래 focurve-core의 미커밋 변경과 PR46/48을 보존하고 별도 작업 공간을 사용했다. 현재 열린 Core PR/통합 코드를 조회하여 정책/version/operation→DNR claim 원본 조회가 없음을 확인했다.
- 사용자 최신 요청: 기존 DNR·관측 코드를 재사용하고 SITE_TIME 한 정책의 원본 증거부터 구현. Server 수신·검증·Receipt·DB·Web은 다훈 담당, 전송/collector/clock을 이번 단위에 섞지 않는다.
- 구현 `extension/src/additional-dnr-site-time-evidence.js`: `SiteTimeDnrEvidence.register({context,policy,claims})`, `read(context)`. 기존 coordinator Lock/store/inventory를 사용하며 DNR 설치·삭제·자동 채택/새 Receipt·RuntimeReport 발행은 하지 않는다. 기존 DNR/관측 생산 파일 수정 없음.
- 원문 context와 정책/version/hash·claim store+id/owner/generation/epoch/hash를 영속 결속, 최초 등록 관측과 현재 관측/미해결 cleanup·관련 실제 RELEASE Receipt를 조회한다. 잘못된 semantic hash의 RELEASED 표시는 해제 증거로 사용하지 않는다. 다른 owner 공유 규칙과 자기 의무 해제를 구분한다.
- 주입할 실제 issued binding verifier 및 전체 writer guard가 없으면 기본 거절한다. true 시험 provider는 SYNTHETIC이고 현재 제품 provider 구현/연결 완료가 아니다. 단일 operation/정책 범위이며 새 공용 메시지 계약을 만들지 않는다.
- API·입출력·불변 조건·다훈 연결 시 주의사항: [원본 증거 설명](../evidence/AMVP-CORE-04-site-time-evidence.md). 등록 원문 정책 버전과 실제 RELEASE operation을 Server 삭제 버전/Receipt로 임의 바꾸지 않는다.
- 로컬 검증: 신규25/25, 기존 DNR 포함49/49, 전체 Extension835/835(fail0/skip0), 계약6/6 PASS. 통합 기반과 미병합 PR46/48 기반의 시험 수는 다르며 합산하지 않는다. Chromium151 실제 IndexedDB/Web Lock 재열기 시험1/1 PASS, DNR/발급 source는 모의다.
- 실제 MV3 DNR은 임의 확장 로드 관리 정책으로 worker timeout; 정책 변경 없이 미검증으로 남겼다. 실제 Windows/제품 Worker·네트워크 차단·강제 종료/원본 권한 전환·전체 정책 수용은 미검증이다.
- 상태: 이 내부 모듈 단위 구현/로컬 검증 완료, 제출 전 syntax/whitespace·최신 원격 CI와 담당 재리뷰 필요. Core 전체는 부분 구현이다. 다음은 실제 issued binding/writer 연결 검증이며 그 뒤 Report 생산/전달 계약을 맞춘다. Server 연동이나 제품 활성화·자동 병합은 하지 않는다.

- 담당: 윤종민 / 브랜치: feature/additional-mvp-core
- 시작 기준: da1c70b2b2052dece581353f81cd5eb6c604e4b1 (PR24 병합 및 Web/Server 통합 포함)
- 계약: AMVP-CONTRACT-20261029-RC2, PR24 승인 a10fcb02927eec49561c62417b6a0d7a63e64cde
- 기준 명세: docs/design/additional-mvp-contracts/03_Wire_D06_복원.md의 C-04 Session/Dynamic DNR, 06_인계_승인.md의 AMVP-CORE-04.
- 상태: 진행 중. inventory에 이어 durable sidecar·writer epoch·own-claim RELEASE/복구 모듈 구현. 제품 Worker 연결은 대기.
- 이유: 기존 Guest/Member는 SESSION만 직접 제어하고 계약 참조 모델은 Python fake banks다. 둘을 복제하지 않고 신규 coordinator의 양 저장소 관측 경계를 먼저 구현한다.
- 제품 코드: extension/src/additional-dnr-inventory.js. 기존 canonical digest 재사용, 승인 DnrClaim 필드와 결속.
- 이번 완료 조건: store+id 분리, 전체 rule hash 대조, 공유 owner/세대 의무 보존, 유실/조회실패/변조 구분, 미관리 규칙 자동 채택 금지, 읽기 중 입력 변조 방지.
- 안전 경계: 관측은 두 store의 원자 snapshot이 아니며 삭제 허가·RELEASED·SESSION_STORE_RESET 증거가 아니다. 기존 Worker에는 아직 연결하지 않으며 DNR 쓰기/서비스/설치를 변경하지 않는다.
- 다음 단위: 기존 Guest/Member 등 모든 DNR writer를 동일 guard에 결속하고 제품 Worker 연결. 이후 실제 확장 Chrome 수용 시험.
- 미검증: 실제 Chrome, writer 경쟁/원자 저장, quota·실제 해제, DOM/Content, 제품 전체 통합. 이 카드의 테스트 통과로 기능 완료를 선언하지 않는다.

## 2026-10-30 이번 단위 종료

- 읽기 전용 inventory 구현 및 API 모의 회귀 9/9 PASS (Node v24.19.0, `cd extension && node --test tests/additional-dnr-inventory.test.mjs`). 기존 Python fake coordinator 복제가 아닌 실제 JS 모듈의 두 Chrome getter 호출 경계 시험이다. 브라우저는 모의 객체다.
- 승인 계약의 legacy 경계·canonical hash 시험 6/6 PASS (`node --test contracts/additional-mvp/rc1/tests/legacy-boundary.test.mjs`). 신규 모듈이 재사용하는 digest 및 구 actor 거절 경계를 확인했다.
- 승인 manifest 52/52 불변, 새 모듈 syntax·git diff whitespace 검사 PASS. 계약 전체265/SQL54는 변경하지 않아 재실행하지 않았고 이번 실행 수로 보고하지 않는다.
- 원래 /workspace/capstone-project의 지침 미커밋 변경과 index 보존. 작업 경로 /workspace/focurve-core, 기존 원격 Core 브랜치에서 시작해 최신 통합 기준으로 ff-only 반영.
- Commit/Push 및 실제 Worker 활성화는 하지 않았다. 이번 단위 완료이며 AMVP-CORE-04 전체는 진행 중이다.

## 2026-10-30 저장·해제·복구 단위 종료

- `extension/src/additional-dnr-store.js`: 기존 실행 DB의 metadata transaction을 재사용해 `amvp_journal_v1:dnr` sidecar 저장. 기존 Journal1.1 변경 없음. 원장 구조/claim/operation 상태 불일치 시 거절.
- `extension/src/additional-dnr-coordinator.js`: Web Lock 직렬화와 영속 writer epoch, 검증된 기존 규칙의 claim 예약, 해제 intent 선저장, SESSION/DYNAMIC 별 자기 claim 해제, 사후 재조회와 receipt 저장, 동일 operation 재시도 구현. 다른 owner·generation 및 미관리 규칙을 보존한다.
- 저장 실패나 양 저장소 부분 실패 시 PREPARED/IN_DOUBT 의무를 남긴다. receipt 저장 실패 후 새 store/coordinator로 복구하며 이전 writer를 거절한다. 종료 generation의 재채택과 진행 중 규칙의 타 owner 채택도 거절한다.
- 활성화 조건: `assertWritersGuarded`와 `verifyAdoption`은 내부 신뢰 경계이며 기본 거절. 시험의 true callback은 제품 안전성 증거가 아니다. 기존 writer 전체 결속이 아직 없으므로 제품 Worker에 연결하거나 신규 정책을 활성화하지 않았다.
- 자동 시험: inventory 9 + coordinator/store 15 = **24/24 PASS**. `cd extension && node --test tests/additional-dnr-*.test.mjs`. fake-indexeddb + Chrome DNR 모의 객체, Node 실제 Web Lock으로 저장 장애·부분 실패·공유 소유권·중복/충돌·epoch 경쟁·손상 원장을 검사했다.
- 기존 계약 Node **6/6 PASS**: `node --test contracts/additional-mvp/rc1/tests/legacy-boundary.test.mjs`. `cd extension && npm run check` 및 `git diff --check` PASS.
- 추가 실제 기반 검사: 격리된 Linux Chromium 151 페이지에서 실제 IndexedDB 재열기 후 epoch 유지, reducer 오류 시 rollback, 실제 Web Lock을 통한 startWriter 성공 확인. 실제 확장 DNR/API·Windows·Worker 강제 종료 시험은 아니다.
- 환경: npm 기본 cache 쓰기 실패 후 `/tmp/focurve-core-npm-cache`로 `npm ci --ignore-scripts --no-audit --no-fund` 성공. package/lock 변경 없음.
- 남은 범위: 기존 writer guard 결속, 제품 Worker 연동, 신규 정책 APPLY/예약 연계, 실제 DNR quota·브라우저 재시작·Windows 통합 검증. DOM/Content 구현은 이번 범위 밖이다.
- 종료 현황: 이번 저장·해제·복구 모듈 단위 완료, **AMVP-CORE-04 전체는 부분 구현**. 전체 추가 MVP 완료율은 산정하지 않는다. Commit/Push 미실행.

## 첫 기능 PR 준비

- DNR 모듈3개·시험2개·본 작업카드·전용 CI만 첫 PR에 포함. TIME-05 및 통합현황 로컬 수정은 후속 변경으로 보존.
- 대상 브랜치: integration/additional-mvp-20261029. 자동 병합/제품 활성화 요청이 아니라 기반 모듈 리뷰 범위다.
- 제출 전 DNR24/24·기존 계약6/6·npm run check 재실행 PASS. GitHub CI는 Ubuntu/Windows Node24에서 동일 모의 시험 수행; Windows 실제 Chrome 수용 시험을 뜻하지 않는다.
- 미완료: legacy writer guard 전체 결속, Worker 진입점 연결, 실제 DNR·quota·브라우저 재시작 수용. 기존 API·DB·Content 구현은 이번 PR에 포함하지 않는다.
