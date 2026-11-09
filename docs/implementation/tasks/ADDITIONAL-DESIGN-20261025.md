# 추가 MVP 설계·Git 준비 작업카드

## Draft PR 게시 승인·실행 체크포인트

2026-10-25 사용자 명시 승인: 이 설계 Worktree의 지정 Markdown7개만 staging·검토·문서commit·설계branch일반push·develop대상Draft PR생성까지. Merge/Ready전환/제품구현/타Worktree·index변경은제외한다. 게시직전확인: branch codex/additional-mvp-design·HEAD/develop90ad32b·원격설계branch없음·staged없음·문서/계산검사258 PASS. FIN-03 측정정밀도실측·FIN-04 D06·FIN-05 Wire는공동기술검토상태유지. 아래이전‘게시미승인/PR없음’기록은당시이력이며이승인이그다음단계의권한이다.

실행원칙: 명시7경로만선택stage→stageddiff/민감정보/상대링크/계산재검증→docs commit→remote설계branch push→Draft PR. 예상밖remote develop/경로변화시게시전중단. 성공URL/최종commit은게시도구결과와최종보고로확인하고,본기록때문에후속추가commit을만들지않는다. 로컬검사기파일은이번PR제외로보존한다.

## 3차 현행 작업·검증 계약

### DEC-06·07 확정 반영 인계

최신실행검증: Windows/Python3.14의로컬 `python -B docs/design/additional-mvp/validate_design.py` 258개검사·오류0. 7개현행문서의DEC-06/07서명·확정DEC7개·timezone6/import7 시나리오·carry통계중복0/회원현재한도불변합성fixture·기존link/field/DAG/calendar검사를포함한다. 이는문서/정책계산검사이며실제Chrome5초checkpoint·5초오차·6초차단/DB/API/모델제품시험은NOT_RUN이다. 같은설치owner전환의receipt/seq·원장연속성은D06/Wire공동검토로남긴다.

원격재확인: develop90ad32b=설계HEAD,원격설계branch없음. PR17 open/non-draft/merged=false(head92691c55),PR21 open/draft/merged=false(head86b0e9e),둘의base90ad32b. 171/39 changed경로와7개Markdown허용목록교집합0. 이와별도로R3는별도source/overlay검증선이라미병합PR의D06제안과동일시하지않는다. native binding·owner/runtime해제분리·seq/cachecleanup·freeze사유의미를공동검토해야한다.

준비판정: 문서검토용CP-01 PR자료준비완료,미확정사용자정책2개는해소. 남은3개는FIN-03정밀도실측/FIN-04 D06/FIN-05Wire 공동기술검토다. 실제게시를위한최소후속승인은 **설계Worktree의7개Markdown만선택staging·문서commit·codex/additional-mvp-design push·develop대상Draft PR생성**이다. merge/제품구현/R3적용/프로필조작/검사기포함은그범위가아니다. 이번단계의Commit/Push/PR생성/Merge는0,staged/제품추적파일변경0·기존index7개hash동일이다. 게시승인뒤에도원격base/허용목록/index를직전재확인한다.

FIN-01 timezone·FIN-02 guestimport의사용자승인대기를해소했다. DEC-06은현재사용자day종료뒤새timezone·과거/현재원장불변·잔여한도중복방지승계, DEC-07은명시선택guest완료기록분석용·자동로그인upload0·원본보존·중복0·회원현재한도자동합산0이다. 같은설치전환직전구간close/owner fence/epoch/기존member원장복원은D06/Wire공동기술검토에남긴다.

카드갱신: MVP-UI-01은확정7개/남은FIN03~05대조,02 timezone desired/applied·import결과/ACK,03~05 기존서비스·URL·모델계약소비(변경없음),06 timezone경계예약충돌,07 carry/day/import원장분리,08 imported분석projection과currentquota분리,09 완료기록선택·원본보존/owner전환,10 AC-TZ6개/IMPORT7개와CON15실제회귀를추가한다. 김다훈API/DB/분석·통합,윤종민상시collector/ownerfence/DNR·복구,채지민Content결속·복원분담유지. PR6단계DAG/7개Markdown허용목록은변경없음,검사기는이번최소PR제외로컬도구다.

### 최종 기술 검토·PR 준비 기록

기능범위/branch/base·확정DEC5개유지. 기존문서내FIN-01~05권장/대안/승인·R3/API/DB/Extension영향을정리했다. timezone bridge는DEC-06의잔여budget승계로확정,guest완료기록의분석전용/회원당일quota미반영은DEC-07로확정,정밀도는SLA아닌실측목표,D06/Wire는3인공동기술검토다. FIN/TECH를새제품정책미확정으로일괄되돌리지않는다.

실제원격develop90ad32b=로컬설계HEAD,커밋차이0/0·문서untracked·원격설계branch없음. openPR17/21 filenames와최소PR7문서교집합0,계약의미충돌/D06조건은04에기록. 이번최소PR은Markdown7개만,로컬validate_design.py는보존하지만제외. 제목/본문초안·정확한허용목록·조건부제출순서를04에작성했다. Commit/Push/PR생성/Merge는0이며현재상태는GitHub비교commit이없어실제PR생성불가다.

카드선행재검토: 01 FIN5합의,02 saved/applied·ACK,03~05 공용schema소비,06~07 CP-02수용→CP-03runtime집행,08확인원장집계후,09owner/설정수명후,10 CP-06실제증거. 김다훈은API/DB/집계·통합,윤종민은native/collector/룰/cleanup,채지민은Content/모델/복원소유를유지한다. 두제품정책결정은해소되었으며잔여3개기술합의와동일설치owner전환의구현검증을선행한다. 미합의runtime발급은진행하지않는다.

최종준비검증: Windows/Python3.14에서 로컬 `python -B docs/design/additional-mvp/validate_design.py` 실행,228개검사·오류0. 신규FIN5개·문서전용PR7개허용목록/상대링크폐쇄·기존정책/fixture/달력검사를포함한다. 제품테스트NOT_RUN. openPR17의171경로·PR21의39경로와허용목록교집합0. root+기존5개+설계1개 index7개기준hash전부동일, staged/추적제품파일변경0. 원격develop 재확인90ad32b·원격설계branch없음. 결과는조회시점스냅샷이며향후원격이동/내용충돌없는자동병합을보장하지않는다.

정책 서명: `tracking_scope=BROWSER_ALWAYS; budget_scope=INSTALLATION; day_boundary=USER_TIMEZONE; limit_effect=SITE_ONLY; allow_bypass=false`.

추가 확정: `timezone_change=AFTER_CURRENT_DAY_CARRY; guest_import=COMPLETED_ANALYTICS_ONLY`. DEC-06·DEC-07은 사용자 확정이며 FIN-01·02의 정책승인 대기를 해소한다. 회원전환 전후 같은설치의 원장 연속성은 별도 기술합의이고 자동가져오기·회원 현재한도 자동합산은 금지한다.

브랜치 codex/additional-mvp-design·기준90ad32be5d282f3b44c917a29e156dffc5e29187·담당은이번Codex설계만. DEC-01~05 사용자확정반영완료·기술계약검토대기·제품구현미착수·Commit/Push/Merge없음. 현재근거는01/02/03/04/05의3차절이며뒤의기존기록은이력이다.

| 카드 | 현행 작업·소유자 | 선행·수용/연동 |
|---|---|---|
| MVP-UI-01 | 김다훈 공통policy/API/ERD, 윤종민·채지민D06검토 | 5개확정→TECH/새runtime공동합의 CP-01, 정책을재선택하지않음 |
| MVP-UI-02 | 김다훈 UI/API·윤종민runtime상태 | CP-02/03, focus/runtimestate·saved/applied분리·UNKNOWN성공0 |
| MVP-UI-03 | 채지민YT10/IG6, 김다훈registry, 윤종민dispatch | CP-01/02/03/04·기존16개AC유지·상시원장과접근숨김횟수비혼합 |
| MVP-UI-04 | 채지민URL경계, 윤종민native/freeze, 김다훈content-policy | CP-01/02/03/04, URL전용/legacy보존·세션밖keyword확대는TECH-04 |
| MVP-UI-05 | 채지민모델/블러, 윤종민DNR, 김다훈catalog/profile | 2모델/HIGH·DNRnamespace·외부전송0, 상시시간규칙과독립복원 |
| MVP-UI-06 | 김다훈예약policy/API·윤종민runtime scheduler | 집중예약과사이트예약BLOCK분리·no-session예약집행·CON01/05/07/09/10 |
| MVP-UI-07 | 김다훈browser원장/DB/timezone/계정조회, 윤종민collector/DNR/sync | CP-02→03, AC-TIME/LIMIT·CON02/03/06/08/11~15·설치별remaining·계정조회전용 |
| MVP-UI-08 | 김다훈추이/집계/UI·윤종민품질원장 | 기존통계재사용·focus/browser분리·source별dedup·actualday·합계query_only |
| MVP-UI-09 | 김다훈예약관리/대시보드/계정owner전환·기존UI담당협의 | runtime저장후별도적용/focus다음세션유지·guest선택import·session END의상시룰비삭제 |
| MVP-UI-10 | 김다훈전체통합·윤종민Core·채지민Content검증서명 | CP-06·CON01~15·UI재검수·R3구세션END/인증/ACK/UNKNOWN보존 |

새기술필드 원본은 [02 계약](../../design/additional-mvp/02_공통계약_차이표.md), 잔여결정/15사례는 [05 결정표](../../design/additional-mvp/05_미확정_검증계획.md). 신규기능상태는구현완료가아니라설계검토대기다. TECH-01~08·D06·신규schema/capability·모델실측·최종R3대응은다음행동. 이번변경은기존7개문서와설계검사기만, 타Worktree/제품/Figma/DB/프로필/실패환경변경없음.

### 3차 실행 검증·완료 범위

Windows PowerShell/Python3.14에서 `python -B docs/design/additional-mvp/validate_design.py` 실행: 문서/fixture/달력검사206개·오류0. 현행7문서의5정책서명·확정DEC5개/이전PROP11개해소표/잔여TECH8개/갱신CON15개/10카드·runtime필드/API·request예시필수/unknown필드·session독립성·조건부proof형식·PR문서DAG·자정분할5000ms보존·서울24시간/뉴욕DST23·25시간·링크/JSON·branch/base/변경범위/staged없음을검사했다. 이는문서검증과표준시간대계산fixture이며Chrome collector/DNR/API/DB/모델제품시험은NOT_RUN, 물리정밀도/성능목표는미검증이다. 형식상proof검사가실제적용증거를대체하지않는다.

수정파일은README/01~05/본작업카드·기존validate_design.py다. 02/05/본카드의직전안은 HISTORICAL_START 보관구역으로분리, 정책5개를다시미확정으로표시하지않는다. 공통계약은정책정렬검토준비완료, 새wire/API/DDL/proof/DNR세부는상대담당검토대기이며제품개발착수/릴리스완료판정아님. 다음행동은CP-01 공동기술합의→CP-02 신규stream수용→CP-03 상시실행연결, CP-04/05 독립fixture병렬→CP-06 실제증거확보다.

<!-- HISTORICAL_START -->
<details><summary>이전 작업·하위16개 추적·2차 검증 이력 보관</summary>

- 기능 ID: OPTION-01~12 / SESSION-05~06, POLICY-03 재사용, YT-01~10·IG-01~06 하위추적. 일일한도 신규 하위요구 포함. 기존47개 ID/배정 유지.
- 담당: 이번 Codex는 설계·Git 준비만, 기존 구현담당 재배정 없음.
- 브랜치: codex/additional-mvp-design
- 시작 기준/현재 HEAD: 90ad32be5d282f3b44c917a29e156dffc5e29187
- 상태: 설계 검토 대기 / 제품 구현 미착수 / 실제 검증 NOT_VERIFIED
- PR/Commit/Push/Merge: 없음

## 기준·산출물

[설계 작업본 안내](../../design/additional-mvp/README.md)와 연결된 01~05 문서가 이번 산출물이다. 최신 Event1.2/Snapshot·D01~D10/APPLY_POLICY와 실제 기준 Web·Server 소스, 기존 Content 후보의 읽기 관측을 반영했다. 기존 작업카드의 구현상태를 일괄 변경하지 않았다.

## 검수와 중단·재개

### 하위 요구사항 작업 추적

전체 상태는 사용자 요구사항 확정·설계 초안 작성·구현/실행 NOT_VERIFIED다. 적용 페이지·ON/OFF·예외·SPA·실패·수용 기준과 UI/Extension 재사용 상태는 01 문서의 해당 ID 행이 원본이다. 이 표는 개인 배정 변경 없이 각 담당 영역 착수/검토를 추적할 시작점이다.

| 하위 ID | 확정 기능 | 검증 연결 | 다음 작업 |
|---|---|---|---|
| YT-01 | 홈페이지 숨기기 | AC-YT-01-01~03 | 홈/추천 legacy 분리 계약 |
| YT-02 | Shorts 숨기기 | AC-YT-02-01~03, POLICY-03 | R3 검증소스 재사용 대조 |
| YT-03 | 댓글 숨기기 | AC-YT-03-01~03 | watch/Shorts 범위 보완 |
| YT-04 | 추천 동영상 숨기기 | AC-YT-04-01~03 | 홈과 watch 독립 설정 |
| YT-05 | 구독 숨기기 | AC-YT-05-01~03 | route·UI·adapter 계약 |
| YT-06 | 탐색 숨기기 | AC-YT-06-01~03 | 검색 예외·route 고정 |
| YT-07 | 상단 바 숨기기 | AC-YT-07-01~03 | 검색/복구 접근성 검토 |
| YT-08 | 종료 카드 비활성화 | AC-YT-08-01~03 | 플레이어 예외·복원 설계 |
| YT-09 | 흑백 모드 | AC-YT-09-01~03 | 스타일 소유·합성/복원 |
| YT-10 | 자동 재생 비활성화 | AC-YT-10-01~03 | 기존 후보/fixture 재사용 |
| IG-01 | 스토리 숨기기 | AC-IG-01-01~03 | 직접route·미디어 복원 |
| IG-02 | Reels 숨기기 | AC-IG-02-01~03 | 기존후보/서버미지원 차이 |
| IG-03 | 탐색 숨기기 | AC-IG-03-01~03 | 탐색/검색 구분 합의 |
| IG-04 | 댓글 숨기기 | AC-IG-04-01~03 | modal/게시물 adapter 설계 |
| IG-05 | 제안된 항목 숨기기 | AC-IG-05-01~03 | 일반피드/광고 범위 합의 |
| IG-06 | 흑백 모드 | AC-IG-06-01~03 | 스타일 소유·복원 설계 |

### 실행 결과

- 실행: git fetch origin develop → SHA 일치, managed Worktree 생성 → 새 공간에서 git switch -c codex/additional-mvp-design.
- 확인: root develop 유지, 새 Worktree HEAD90ad32b·브랜치명, 제품 변경0·staged0; 문서 구조/내부링크·16개 ID·계약/누락/협업/미확정 포함 검수.
- 산출물 검수: Markdown 7개, 상대링크 오류0·16개 ID 누락0. git diff --quiet=0, git diff --cached --quiet=0으로 기존 추적파일 변경/staged 없음 확인. 설계 작성 전후 root+기존5개+신규1개 총7개 index SHA256 전부 동일. 생성 전 index 대조를 수행했다는 주장은 아님.
- Figma 실제 file TmEt1UQV5jIhrArfijGwQe/page1148:8725 metadata 읽기, YouTube4/Instagram2 및 집중·사이트·대시보드 구조 확인. 렌더/실클릭/최신승인·Web런타임 NOT_VERIFIED.
- 보존: 기존 Worktree/index/R3/실패환경/Default·Profile2 편집·접근 없음. index hash 비교는 설계작성 전후 시점 기준이며 다른 Codex의 동시 작업까지 정지시켰다는 뜻은 아니다.
- 미완료: 05 문서의 정책·wire 합의, 최종 R3 Manifest/source 대응, 기존 추가기능 remote branch 상세 비교, 제품/실제통합 시험.
- 다음: 사용자/3인 담당이 계약 차이와 미확정 항목 검토 → 기존 원격 추가기능 소스 재사용 비교 → 승인된 계약별 작은 구현 PR 계획. 현재 권한으로 구현·Git 게시 진행하지 않음.

## 완료 판정

## 2차 개발 인계 작업카드 (계획, 구현 착수 아님)

공통 상태: 설계 검토 대기·브랜치 codex/additional-mvp-design·기준90ad32b·제품 실행 NOT_VERIFIED. 표의 담당은 사용자 확정 역할이고 검토자는 상대 계약소비자다. UI 참조키는 잠정검수 이력이며 최신 Figma 결함 판정이 아니다. API/필드 원본은 02, 정책/AC-CON은05, UI상태는03, 소유/PR gate는04 문서를 따른다.

| 카드 | 기능/요구·UI 참조 | 담당·변경파일(후속 구현 계획) | 선행·완료 검증 |
|---|---|---|---|
| MVP-UI-01 | OPTION전체·PROP01~11·CON01~15 | 김다훈 계약, 윤종민/채지민 공동검토; 기존 설계6개 | CP-01; 승인/미승인과 schema fixture 일치 |
| MVP-UI-02 | POLICY-01/EXT-01/SESSION-01·저장vs실행 | 김다훈 FocusSessions/FeatureSettings/API, 윤종민 실행응답 | CP-01/02/03; 503·적용미확인·원문보존·RUNNING오표시0 |
| MVP-UI-03 | OPTION-01/02/03/05·YT01~10/IG01~06 | 채지민 content adapter, 김다훈 FeatureSettings·registry, 윤종민 dispatch | CP-01→02/03/04; 16개 AC 각01~03·actual Chrome·복원·다른기능불변 |
| MVP-UI-04 | OPTION-09·KW01~07 | 채지민 URL 경계탐지, 윤종민 navigation/freeze, 김다훈 content-policy/Snapshot | CP-01 URL_BOUNDARY→02/03/04; AC-URL01~05·제목본문읽기0·legacy보존 |
| MVP-UI-05 | OPTION-10/11·AD01~08 | 김다훈 catalog/model metadata·정책, 윤종민 DNR, 채지민 image-blur/model | CP-01/02/03/04; AC-CAT/BLUR·실제2모델·queue·외부전송0·SHA/license |
| MVP-UI-06 | OPTION-04·SC01/06/07 | 김다훈 schedules API/UI, 윤종민 occurrence/clock/lock | CP-01 정책유형분리·02/03; AC-OPTION-04·CON01/10/11·구예약중복0 |
| MVP-UI-07 | OPTION-06+한도·SC02~05/08 | 김다훈 site-time-policy/usage/DB·UI, 윤종민 collector/ledger/DNR | PROP01~08·CP-02/03; AC-TIME/LIMIT·자정/idle/재시작/초과지연·다중설치 |
| MVP-UI-08 | OPTION-07/08/12·AN01~05 | 김다훈 RecordQueries/통계·HourlyAccessPattern, 윤종민 원장품질 | CP-02 usage확정→05; AC-AN/AI·분모/누락/지연/합계·중복차트0 |
| MVP-UI-09 | 예약/분석/계정 라우팅·SESSION-05/06 | 김다훈 MemberApp/FocusSessions/Settings, 기존Figma담당 협의 | CP-01/02/05·기존계정R3보존; 미저장이탈/복귀·PAUSE/NOTE412·scope표시 |
| MVP-UI-10 | 전체 교차검수 | 김다훈 통합·윤종민Core·채지민Content 각증거 | CP-06·최신승인Figma; Light/Dark/반응형/키보드/실제E2E·회귀·릴리스와분리 |

### 2차 변경·검증·미해결 기록

기존6개 문서+본카드 내에서 요구 확정/정책대기·CON15사례·API/DB/새 schema 후보·DNR/모델·UI제작중·PR의존성을 보완했다. 사용자 후속첨부의 URL경계/제목본문제외/HIGH/InceptionV3→MobileNetV2는 요구로 반영하되 수치/시간scope는 승인대기다. 기존44개는 잠정이력이며 최종누락 수치로 재보고하지 않는다. 제품코드/Figma/기존Worktree/R3·Git index 변경0, Commit/Push/Merge0. 문서검사 결과는 후속 실행기록으로 추가한다. 미해결은 PROP01~08/모델수치/새wire·D06/최종R3대응. 다음은 결정표·CP-01 공동검토와 정확한모델실험artifact 확보, 구현 승인 전 설계검증만 계속한다.

2차 실제문서검증: Windows PowerShell/Python3.14, `python -B docs/design/additional-mvp/validate_design.py` 실행, 구조검사135개·오류0. 상대링크/JSON예시·16개기능4문서연결·11결정·15충돌·10카드·6PR참조/의존DAG·공통필드·D03예외·새발급gate·branch/base·변경경로·staged없음 확인. 최초실행의Windows CP949 Git출력 decode 오류는 validator의UTF8명시로고친뒤재실행했다. 이는제품시험이아니며 정책결정/논리정합성/실제성능을자동증명하지않는다. 모델/DB/API/Chrome수용은NOT_RUN, Figma최종검수NOT_VERIFIED. 검사도구1개만설계폴더에추가, 산출문서수7개유지.

개발준비판정: DESIGN_REVIEW_READY / IMPLEMENTATION_CONDITIONAL. 16개adapter의문서/fixture명세·기존소스재사용계획은준비됨. 시간/한도정책은PROP01~08, 모델판정수치는PROP10, legacy전환/신규wire는PROP09/11·D06, 최종R3실제schema·source차이는CP-02/06에서해결필요. 모든제품개발을일괄중단한다는뜻은아니며현재지시는설계만허용하므로구현작업은시작안함.

설계 초안 작성·독립 Git 작업공간 준비 완료. 설계 최종 확정·기능 구현·수용 기준 통과·R3 릴리스 완료를 뜻하지 않는다. 수용 기준은 기존 AC-OPTION/SESSION과 신규 AC-YT/IG/URL/CAT/BLUR/TIME/LIMIT/AN/AI를 연결했으며 실행 결과는 모두 미실행이다.

2차 최종 보존 확인: 기존 기록의 index baseline과 현재 root+기존5개+설계1개 총7개 SHA256이 모두 같았다. root develop=76df34e·설계 HEAD=90ad32b 유지. 문서/설계검사기 외 변경 없음. R3 README/manifest hash만 읽었고 실행기·프로필·DB 조작은 하지 않았다.

</details>
<!-- HISTORICAL_END -->
