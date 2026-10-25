# Git·3인 병렬 개발 준비안

## 3차 확정 정책 정렬

정책 서명: `tracking_scope=BROWSER_ALWAYS; budget_scope=INSTALLATION; day_boundary=USER_TIMEZONE; limit_effect=SITE_ONLY; allow_bypass=false`.

추가 확정: `timezone_change=AFTER_CURRENT_DAY_CARRY; guest_import=COMPLETED_ANALYTICS_ONLY`. DEC-06·DEC-07은 사용자 확정이며 FIN-01·02의 정책승인 대기를 해소한다. 회원전환 전후 같은설치의 원장 연속성은 별도 기술합의이고 자동가져오기·회원 현재한도 자동합산은 금지한다.

DEC-01 상시측정/집행·DEC-02 설치별한도/계정합계조회전용·DEC-03 사용자timezone자정·DEC-04 해당사이트차단/집중유지·DEC-05 예약/시간대/한도/전역>site ALLOW는 확정이다. 직전 PROP-01~11은 제안이력으로만 참조한다. 현행기술계약은02의3차절·15사례/잔여TECH는05가 원본이다. 제품구현/새schema wire 승인과 정책확정은 구분한다.

## 2차 인계 계약·PR 의존성

### CP-01 문서 PR 준비 — 아직 생성하지 않음

최신검증·게시범위: DEC-06/07 반영후 로컬검사258개PASS(제품시험아님),최소PR은기존Markdown7개그대로다. 남은3개기술검토를명시한Draft본문으로검토요청준비가능하다. 실제제출에필요한최소후속권한은설계Worktree의이7개만staging/commit→설계branch push→develop대상Draft PR생성이다. 이번에는승인된게시권한이없으므로index/commit/remote/PR을변경하지않았다. merge·제품구현·R3/실제프로필시험은별도범위다.

최신재확인: remote develop=`90ad32be5d282f3b44c917a29e156dffc5e29187`·원격설계branch없음. PR17은open/non-draft/merged=false·head=`92691c55a7c39e810db567bda80445d3bd1a3806`, PR21은open/draft/merged=false·head=`86b0e9ed66e3ae89cb180920b121fbd96f581317`, 둘의base도develop90ad32b다. 반환mergeable=true는Git내용병합가능성일뿐D06의미합의/병합승인이아니다. API의merge_commit_sha가있어도merged=false/merged_at=null이므로이미통합된계약으로취급하지않는다.

R3는별도릴리스/overlay의실제검증선이며, 위미병합PR과동일제품코드/최종D06이라고단정하지않는다. 기준선은(1)공유develop90ad32b,(2)미병합Core/Content제안,(3)별도R3 source/provenance를구분한다. D06재검토는native sender/instance·owner·멱등·cleanup공간/seq상한·late result·focus/runtime해제namespace·완료기록owner전환경계를포함한다. 새정책2개확정으로PR17/21의기존R3기능/문서를임의수정하거나runtimeWire합의를대신하지않는다.

DEC-06·07 승인으로FIN-01/02정책대기게이트는해소되었다. CP-01은7개확정정책과FIN-03~05기술검토만남김을명시한다. CP-02는timezone전환/선택완료guest분석import를이기준으로설계,CP-03은같은설치owner전환fence·원장/규칙복구를공동검토한다. CP-04/05독립fixture준비/CP-06실제증거의선행DAG는그대로유지한다. 새권한정책을자의확정하지않고측정5/5/6초는실제Chrome검증목표로만관리한다.

확인일2026-10-25 KST. `git ls-remote --heads origin develop codex/additional-mvp-design` 성공결과 develop=`90ad32be5d282f3b44c917a29e156dffc5e29187`, 원격설계브랜치행없음. 로컬설계HEAD도같은SHA, `rev-list --left-right --count base...HEAD`=0/0·committed diff0. 설계문서는전부untracked라서현재GitHub가비교할PR commit차이는없다. 로컬origin캐시만으로판정하지않았고fetch/branch이동/index편집없이실제원격을읽었다.

최소PR은다음 **Markdown 7개만** 새파일로제안한다. 내용은기존공용계약과추가MVP요구/인계/결정이연결된단일검토단위다. README의상대링크폐쇄성을유지하려면연결된01/03/작업카드도함께필요하다. 코드·SQL·model·이미지·빌드·R3증거복사·루트설계원본/통합현황·팀원카드는제외한다. `validate_design.py`는로컬설계검사도구로계속보존하되이번문서전용최소PR에는넣지않는다. PR독자는이검사명령을이번PR checkout만으로실행가능하다고오해하지않도록로컬검증근거임을명시한다.

<!-- PR_FILE_ALLOWLIST -->
```json
["docs/design/additional-mvp/README.md","docs/design/additional-mvp/01_기능설계.md","docs/design/additional-mvp/02_공통계약_차이표.md","docs/design/additional-mvp/03_UI_검수.md","docs/design/additional-mvp/04_Git_협업.md","docs/design/additional-mvp/05_미확정_검증계획.md","docs/implementation/tasks/ADDITIONAL-DESIGN-20261025.md"]
```

PR 제목 초안: `docs(additional-mvp): align always-on policies and runtime contracts`

PR 본문 초안:

> 집중세션에묶였던사이트시간관리초안을사용자확정7개정책에맞춰상시runtime/설치별원장으로분리한다. Event1.2·기존focus Snapshot/Journal/APPLY_POLICY 원문과종료계약은유지하며,새Wire/API/DB/Content연결은구현이아닌검토안으로기록한다.
>
> 범위: OPTION-01~12/SESSION-05~06·YT10/IG6,15개충돌사례,계약별필드/오류/소유권,제작중UI요구,10개인계카드·CP6단계. Figma/제품/R3/DB 변경없음.
>
> 정책확정: FIN-01/02는DEC-06/07로해소. 시간대변경후원장불변·완료guest기록분석import·현dayquota자동합산0을반영. FIN-03 측정목표실측·FIN-04 D06·FIN-05 Wire는담당공동기술검토대기. 이PR검토가그정책/제품착수/새발급gate활성화를자동승인하지않는다.
>
> 검증: 로컬설계Worktree의문서/fixture/시간대검사,코드/staged변경없음·직접경로충돌없음확인. 제품Chrome/API/DB/모델시험NOT_RUN. 검사기는이번최소PR제외로컬도구이며실제검사건수/내용hash는제출직전기록한다.
>
> 검토: 김다훈API/DB/전체통합,윤종민Core/native/cleanup,채지민Content/모델·복원. 기존R3 source/provenance대응과기존openPR의의미대조는구현PR의추가gate다.

### 충돌 가능성·제출 gate

develop은base와같고7개경로가base tree에없어현재제안은add-only다. 열린PR [#17 Core](https://github.com/kdu-sw-capstone/capstone-project/pull/17)와[#21 Content](https://github.com/kdu-sw-capstone/capstone-project/pull/21)의실제changed filenames를조회했으며위7개와교집합0. 그러나#17은기존API/IA/D06·통합현황/worker, #21은D06·OPTION카드/Content를변경하므로**직접파일충돌낮음/계약의미충돌중요**다. 적용순서·native sender·seq/cache포화cleanup·A0/A1/제품runtime범위를같이검토해야한다. 두PR의모의/사용자보고검증을새runtime의실제완료로승계하지않는다.

조회한D06근거: Content `86b0e9e`의A0잔여검토와Core branch의A0착수준비문서(읽은blob c0b5f0c59a8b808a7deddbd840e7d42f4d988100). 모두기존A0제안·공동미승인/제품미연결범위를명시한다. 실제R3최종코드전체를이문서만으로대체하지않는다. 새runtime의scope/revision/해제권한을A0버전문자열에덮어쓰지않는다.

준비판정: **로컬문서검토자료/본문/허용목록준비가능**, **현재GitHubPR생성은불가(원격branch/비교commit없음)**. 이번지시는Commit/Push/PR생성/Merge금지이므로거기서멈춘다. 추후명시승인때원격develop/SHA·7경로·다른열린PR변경·index를재확인하고허용목록만선택적추가→문서commit→설계branch push→Draft PR 순서로진행할수있다. `git add .`/다른Worktree정리/팀원branch재설정은계획에포함하지않는다. 실제merge/merge-tree시험을실행한것도아니다.

10개카드재검토: MVP-UI-01은FIN5개검토,02는상태/ACK,03/04/05는registry·keyword·모델의CP-01계약소비,06/07은runtime/시간원장의CP-02→03,08은확인원장집계후,09는저장/적용·owner전환합의후,10은CP-06실제회귀다. FIN-01/02정책은확정되었다. 동일설치owner전환의연속성기술검토와FIN-03~05합의를거쳐해당제품경로를구현한다. 공동기술합의전runtime발행/실제제한실험을임의로개시하지않는다.

### 3차 PR 선행 관계 변경

<!-- PR_DEPENDENCIES -->
```json
{"CP-01":[],"CP-02":["CP-01"],"CP-03":["CP-01","CP-02"],"CP-04":["CP-01"],"CP-05":["CP-01","CP-02","CP-03","CP-04"],"CP-06":["CP-02","CP-03","CP-04","CP-05"]}
```

위 JSON은 실제연동/병합의 선행관계다. CP-04/05의 합성fixture·문서준비는 CP-01 뒤 병렬 가능하지만 실제API/실행통합은 표의 의존성을 충족해야 한다. PR을 실제 생성하거나 병합한 결과가 아니다.

CP-01은 DEC-01~05 재승인이 아니라 TECH-01~08·D06·runtime wire의 공동검토다. CP-02 김다훈은 browser_usage_segments/runtime_policy_snapshots/reports·timezone/day API·계정조회전용을 먼저 수용한다. 기존focus테이블을상시용으로nullable화하거나새session을만들지않는다. CP-03 윤종민은 focus와독립된runtime engine·설치원장/collector·조건별DNR·자정/재시작·sync를 구현할후속범위다. CP-04 채지민은서비스기능/블러 재사용을유지하고, runtime의이미열린페이지제한/복원메시지를 Core와함께검토한다. 채지민이usage원장/토큰/규칙registry를중복소유하지않는다.

CP-05는예약관리내상시설정/설치별조회·대시보드추이를결속, focus next-session/runtime immediate-reconcile 문구분리. CP-06은 no-session 집행·focus END뒤runtime유지·서버/Worker/Chrome재시작·다중창·timezone/DST·설치X/Y·CON15 전부의실제증거를요구한다. 병합DAG CP-01→CP-02→CP-03연동, CP-01→CP-04/05 fixture준비, CP-02/03/04/05→CP-06 유지. 서버수용전runtime신규발행/발급gateON 금지.

파일소유 추가: 김다훈 backend의 browserusage/runtimepolicy 모듈·신규migration·records 집계·Web API/UI, 윤종민 extension/background runtime-policy/usage-ledger/collector/rules·manifest/worker/bundles, 채지민 extension/content adapter·runtime차단표시/복원·model assets. 신규경로명은 D06에서 actual R3 source구조에맞춰고정한다. 공유 runtime payload/owner/revision/상태enum은김다훈작성·윤종민/채지민동시검토. 기존팀원branch/index/R3파일변경없음.

준비상태: 김다훈 상시원장/정책/API/ERD/조회 문서갱신완료·실제DDL미구현, 윤종민 상시집행·collector/정밀도·DNR계약갱신완료·native검증대기, 채지민 16개/블러기준유지·runtime표시wire공동검토대기. 5개제품정책결정은해결되었고남은것은공동기술계약/성능·실험artifact/R3대응이다. 문서검토가능이며제품개발승인으로해석하지않는다.

상시기능 rollback은신규runtime package발급중지와기존runtime의명시적정책해제/안전복원을별도로설계한다. focus END를runtime해제shortcut으로쓰지않는다. 구설치로다운그레이드전에owned runtime룰/미확정의무/원장outbox를대조·보존해야하고UNKNOWN이면무조건삭제/초기화하지않는다. 이절은계획이며실제발급중지·rollback·Git revert·DB작업을수행한것이아니다.

최신 사용자 명시 배정: 김다훈 Web/Server/DB/API/전체통합, 윤종민 Core/DNR/정책/세션, 채지민 Content/YouTube/Instagram/블러. 기존 배정과 일치한다. 구현 착수 승인과 별개이며 아래 PR은 아직 생성하지 않았다.

| PR 계획 ID | 작성·필수 검토 | 소유 파일/범위 | 선행·병합 gate |
|---|---|---|---|
| CP-01 정책결정/registry/fixture 계약 | 김다훈 작성, 윤종민·채지민 의미검토 | 기존 additional-mvp 문서·공용 fixture 명세, 16개 wire 코드·URL 경계·HIGH/2모델·상시runtime/TECH-01~08 | 확정DEC-01~05 반영, TECH/D06·CON-01~15 기대값 공동합의. 제품코드 없음 |
| CP-02 서버 수용/저장/버전 | 김다훈, Core·Content payload 검토 | sites/SiteInput.java·FeaturePolicies.java(원격 기존경로 재사용), execution/SnapshotValidation.java·ExecutionService.java, events/EventService.java·SnapshotAccess.java, api DTO, 신규migration | CP-01. legacy1.1/1.2 unchanged·구 END 가능·새지원 기본OFF. migration 번호 최신 develop 직전 예약 |
| CP-03 실행 프로토콜·컴파일러 | 윤종민, 김다훈 auth/원장·채지민 message 검토 | extension/background/*, a1/core.mjs 등 실제 R3 소유경로 대조 후 고정, manifest.json·worker entry·registry·bundle build | CP-01, CP-02 fixture 수용. owner/rule namespace·실제apply/release·원장복구. D06 미합의 구간 구현잠금 |
| CP-04 Content adapter/model | 채지민, 윤종민 sender/cleanup·김다훈 privacy 검토 | extension/content/{features,shorts,changes,image-blur,entry}.mjs 및 모델 adapter·source manifest 후보 | CP-01 병렬 준비 가능, 실제연동은 CP-02/03. 기존 Shorts hash/증거 재사용 |
| CP-05 Web 설정/예약/분석 | 김다훈, 해당 Core/Content 계약 검토 | frontend/src/{MemberApp,FocusSessions,FocusShared,Settings,api}.tsx/ts, FeatureSettings.tsx·HourlyAccessPattern.tsx 기존remote 재사용 | CP-01 fixture UI 준비, 실제 API 연결 CP-02, 실행완료표시는 CP-03/04. 기존 Figma 작업자 승인 없이 디자인 수정 금지 |
| CP-06 실제통합/회귀 | 김다훈 통합, 윤종민·채지민 영역 서명 | 검증증거·작업카드·통합현황, 별도 합의된 테스트만 | CP-02/03/04/05, exact executor·독립테스트환경·최종 R3 source 대응. 이후에만 신규발급 opt-in |

선행 DAG: CP-01→CP-02→CP-03연동; CP-01→CP-04준비/CP-05준비 병렬; CP-02+CP-03+CP-04→CP-05실제연동→CP-06. 모든 feature가 끝날 때까지 기다리지 않고 Shorts재사용+새feature1개→URL→catalog/model→time/quota→분석의 작은 세로흐름으로 반복한다.

공통 수정 요청은 파일경로·기준SHA·필드/enum diff·하위기능ID·구소비자 영향·수용fixture·rollback을 계약PR에 남기고 소유자+상대소비자 검토 후 반영한다. 이 절차는 합의 workflow이며 GitHub branch protection/CODEOWNERS가 실제 설치되었다는 뜻이 아니다. manifest/worker/lock/bundle은 Core 단일작성, feature registry/API-schema는 김다훈 단일작성·2인 검토, 모델 assets는 채지민 작성·Core CSP검토. 공통파일 동시편집은 허용목록 단위 조율한다.

### PR 템플릿 (문서용)

`기능ID/하위ID → trigger와 before/after → 기준SHA·계약revision·의존PR → 변경경로·소유자 → API/DB/Event/Snapshot 호환영향 → 실제/모의/미실행 검증명령·환경·결과·증거 → 실패/중복/복구 → 미완료·rollback·검토자`. 새 schema/권한·migration·model/catalog hash가 있으면 필수 명시. secrets/실사용자료 제외. 이번에는 .github template/CI 파일을 바꾸지 않았다.

### CI·리뷰·DoD

문서 gate는 ID/필드/API/표참조·의존DAG·모든결정의 미승인표시 검사. 제품 구현 후 frontend type/build+관련 컴포넌트/요청모의, backend 실제 독립MySQL migration+권한/버전/멱등/집계, extension syntax/source-bundle+native sender/owner/revision/negative fixture가 필요하다. 실제 Chrome apply/release·재시작·SPA·모델/목록·quota는 CI 모의로 대체 불가다. 기존 전체테스트 무조건 반복 대신 변경영향과 공통게이트를 선택하고 필요한 필수회귀는 통과시킨다.

기능 DoD=요구ID→공용계약→코드/fixture→오류/중복/복원→실제통합→증거SHA→상대소비자검토가 연결됨. 문서존재·Figma완성·자동시험만으로 검증완료 금지. DEC 미확정 기능은 contract-blocked, 독립fixture/adapter 준비는 ready-for-design 수준으로 구분한다.

### Git 충돌·rollback

각 구현자는 별도Worktree/index, 단일기능branch·최신합의base로 시작한다. 충돌 시 공용파일 소유자가 상대 diff/contract revision을 대조하며 강제 덮어쓰기/reset/clean 금지. merged 제품 변경 rollback은 기존세션 END/원문 보존을 우선하고 발급 feature gate를 OFF/exact허용 철회하는 설계를 먼저 검토한다. immutable migration은 forward 보정, 과거 event/snapshot/model 참조 삭제 금지. Git revert/배포/DB 조작은 이번 권한 밖이다. rollback fixture는 신규발급 중지→기존조회/정상해제→outbox원문보존→다음세션구정책가능을 확인한다.

### 준비 상태

김다훈: 계약/schema·원격4+2저장/hourly 재사용 지점 식별, CP-01 검토 가능. TECH-01~08·신규wire 공동합의 전 quota 제품구현 보류. 윤종민: collector/ruleplan/Journal경계와 검증항목 정의, D06 namespace·R3소스결속 전 실행구현 보류. 채지민:16개 adapter/모델결합 입력·출력 정의, 실제모델artifact/threshold·sender 계약 확인 전 배포구현 보류. 세 담당 모두 독립 설계/fixture 준비 가능, 제품개발/릴리스 READY 판정 아님.

원격 읽기 시점 develop90ad32b·settings c3e91ca·content86b0e9e·hourly d592d17 유지 확인. settings 두파일/hourly 한파일을 exact SHA로 읽기 검토했고 content 전체·미병합PR 현황/최종R3 Manifest 대응은 아직 미확인이다. 팀원별 아래10개 작업 단위는 새파일 대신 기존 설계 작업카드 안에 정의했다.

현재 실행 권한: 이 설계 브랜치의 문서 작성까지. 아래 제품 브랜치·PR·테스트 환경은 계획이며 생성/실행하지 않았다. 기존 개인 배정을 유지한다.

## 소유 경계와 제안 브랜치

| 기존 담당 | 담당 경계 | 향후 브랜치 예시 | 파일 소유·검토 |
|---|---|---|---|
| 윤종민 | Extension Core | codex/additional-core | 세션/owner/Snapshot·Journal·DNR namespace·예약·usage collector/ledger·한도 실행·전송. background/manifest/bundle 빌드는 Core 담당 단일 작성 |
| 채지민 | Content Control | codex/additional-content | 16개 adapter·URL 판정·성인/블러 감지·모델 라이프사이클·DOM 소유 변경/복원·관측. Core wire는 공용계약 검토 후 연결 |
| 김다훈 | Server/API/DB 및 기존 Web 범위 | codex/additional-server-web | 설정/API/인증·권한·migration·usage집계/분석·Web 화면. 16개 registry/DTO/SQL과 Web 저장 통합 |

브랜치명은 제안이며 기존 팀원 브랜치를 rename/reset/rebase하지 않는다. Web의 실제 개인 소유 범위는 기존 배정표 전체와 착수 시 재확인하며 여기서 인력을 재배정하지 않는다.

## 시작 조건

1. 최신 R3 릴리스 Manifest·검증된 source/overlay·기준 Git 차이를 목록화한다. R3를 이 기준 커밋과 같다고 가정하지 않는다. 최종 R3 통합은 별도 담당 승인·절차이며 설계 브랜치에 제품 소스를 복사하지 않는다.
2. 기존 원격 `feature/additional-feature-settings`, `feature/content-control`, `codex/hourly-access-statistics`의 HEAD/PR/담당·실제 기능·수용 증거를 읽기 검토한다. 이름만으로 폐기/교체/완료 판정 금지. 이번에는 원격 HEAD 존재만 확인했고 세부 비교는 미완이다.
3. 승인된 설계 계약 revision을 공통 기준으로 고정한다. 16개 ID·registry·message·한도 정책·Event/Snapshot 호환안을 3인 검토한다.
4. 구현 시작 시 최신 develop/R3 포함 여부를 다시 확인하고 각자 별도 Worktree·branch·base SHA·파일 소유·작업카드를 등록한다. 현재 추가설계 HEAD를 영구 구현 기준으로 강제하지 않는다. 상시정책5개는이미확정이므로다시제품scope승인을묻지않는다.

## 병렬화와 순서

| 단계 | Core | Content | Server/Web | 통과 조건 |
|---|---|---|---|---|
| C0 계약 | capability·rule ownership·usage 경계 | 16개 적용범위·결과·복원 | registry·DTO·저장·오류·버전 | 한도/URL 범위와 D06 미정 합의, 합성 fixture 문서 |
| C1 최소 세로연결 | 기존 Shorts 경로 재사용·한 신규feature | 한 adapter·OFF/복원·SPA | 해당 저장·조회·Web 토글 | 실제 적용/해제 및 owner/revision, 구 세션 회귀 |
| C2 독립 기능 | 예약·usage 기반 | 나머지16·URL·목록·블러는 각 독립 PR | 예약/usage endpoint·UI | feature별 AC, 모델/목록 provenance·오류 |
| C3 일일한도 | 영속 ledger·초과규칙 | 표시·탐색 관측 | 한도정책·원자 집계·조회 | approved offline/multi-install 정책·자정/중복·실제차단 |
| C4 분석 | quality/전송 정합 | 기능진단 분리 | 지표·시간대·AI 동의/근거 | 확정usage 입력, 지표 합계·실제통합·필수회귀 |

모의 fixture 화면/adapter 준비는 가능하지만 실제 API·모델·Chrome 검증과 구분한다. 전체 기능 완성 뒤 첫 통합하지 않는다. 매일 작업/회의를 전제하지 않는다.

## 충돌 방지

- docs 공용계약·feature registry는 계약 PR 한 곳에서 작성, 두 영역 검토를 받는다. 나머지 PR은 승인 revision을 참조한다.
- manifest/host permissions/CSP·worker entry·생성 bundle·package lock은 파일 소유자 한 명이 통합한다. Content PR은 source·adapter fixture 중심, 생성물은 통합 시 검증된 build로 갱신한다.
- migration 번호는 직전 develop에서 예약하고 적용된 SQL을 수정하지 않는다. 변경은 새 migration, 기존 DB/볼륨/자료 유지.
- feature 단위 PR에 기능ID/하위YT·IG ID/기준SHA·계약 revision·변경파일·실제/모의/미검증·오류·복원·회귀를 적는다. PR 대상 develop, 검토·실제연동 전 검증완료 표시 금지.
- 팀원 Worktree/index/stash/untracked에 손대지 않는다. 충돌 발견 시 경로·계약·영향과 제안을 남기고 파일 소유자가 반영한다. 다른 채팅에 메시지는 사용자 명시 지시가 있을 때만 보낸다.

## 현재 수행 결과

fetch 후 원격 develop은 승인 SHA와 같았고 새 managed Worktree 생성·attachment와 로컬 브랜치 생성 완료. 기존 로컬 develop은 이동시키지 않았다. 새 브랜치 remote upstream은 아직 없음; push하지 않는다. 문서 외 제품 파일·기존 작업카드 수정 없음. 신규 설계 작업카드로 담당/기준/상태/다음 행동을 기록한다.
