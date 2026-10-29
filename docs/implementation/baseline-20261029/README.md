# 공통 개발 기준 게시 검토 기록

2026-10-29. 신규 게시·재현 확인을 위한 기록이며 최종 필수 MVP 수용/릴리스 승인이 아니다. 시작 develop Git SHA `90ad32be5d282f3b44c917a29e156dffc5e29187`. 실제 게시 Commit 전체 SHA·Draft PR URL·원격 재현 결과는 게시 후 PR 본문/최종 인계에 기록한다. 자기 Commit SHA를 문서 안에 가공해 만들지 않는다.

## 선택한 소스와 보존

- 기존 `codex/mandatory-mvp-freeze-20261029`의 [822파일 원문 Manifest](frozen-source-manifest.json)를 읽고 개별 파일 hash 822/822 일치를 확인한 뒤 **별도 게시 Worktree에만** 복사했다. 삭제0. 내용 집합 SHA256 `b773a5b336a33781e956cb771c185d75f8de31d2d9e4c7d94fc87d60d9bbe0e8`은 Git SHA가 아니다.
- 동결 소스 검토 ZIP SHA256 `699bae762dda03536fc3a2913d658d40a82cec6ee39f6e1e9afdce2ad1fb6af7`, 설치 후보 ZIP SHA256 `5bcdced239ead3fa458106c2683054cbd4a6e0d248aa04f538c8229112a6b662`. ZIP/개인 설치 자료는 새로 게시하지 않는다. 기존 추적 설계 보관 ZIP3개는 역사 원본과 링크 유지를 위해 보존하고 내부 경로/텍스트도 검사한다.
- 기존 root·추가 MVP·동결·통합·재구축 공간의 index/status/source hash를 비교한다. 개인 프로필/설치/DB는 검증 대상으로 사용하지 않는다. 추가 MVP dirty 구현은 해당 공간에 그대로 두고 이 필수 후보로 덮지 않는다. Git fetch는 refs 조회/객체 다운로드이며 기존 작업 브랜치·index를 전환하지 않는다.
- 게시 과정에서 준비 JSON2개의 출력 경로를 한 번 잘못 지정했으나 방금 생성한 파일만 게시 공간으로 옮기고 동결 공간의 원래 상태를 재대조했다. 기존 제품 파일/index 변경은 없다.

## PR 출처·의미 검토

| PR | 이번 실제 조회 head | 상태·처리 |
|---|---|---|
| #17 | 92691c55a7c39e810db567bda80445d3bd1a3806 | open, 미병합. 개별 develop mergeable이지만 보호/검토 gate로 BLOCKED. Core 출처 보존 |
| #21 | 86b0e9ed66e3ae89cb180920b121fbd96f581317 | open/Draft, 미병합. 개별 mergeable이나 BLOCKED. Content 출처 보존 |
| #22 | a29d02c97724f437d6c059c6d49eca40bd37e197 | open/Draft, 설계7개. 이번 필수 소스에 통째로 합치지 않음 |

기존 동결 작업에서 원격 전용115경로·동일61·clean 합성1·충돌33 PR/파일 항목(32개 고유경로)을 대조했다. [파일별 판단](pr-semantic-resolutions.json)을 재사용하며 이번에도 원격 head가 일치하는지 확인했다. CONNECT/WAKE와 NR01 응답 문서는 함께 보존했다. Core native-only SITE/소유권/만료/복원 및 최신 Shorts/문서 결속/남은 기한을 선택한 안전 후속 소스를 유지했다. 생성물은 원본 선택 후 재생성했으며 통합 직후 Manifest822개와 여전히 일치했다. 선택적 Content 기존 추가 기능도 팀원 코드 보존을 위해 원격 출처대로 남아 있지만 전체 추가 기능 수용 완료를 의미하지 않는다.

실제 ancestry merge/ours-theirs 일괄 선택은 하지 않았다. 기존 PR17/21을 그대로 추가 Merge하지 말고 담당자가 이 frozen successor와 차이를 검토한 뒤 남은 작업만 새 기준으로 이관한다. 기존 PR의 수정·종료·병합은 이번에 하지 않는다.

## 재현성 보완과 자동 검증

제품 구현 의미/공통 계약을 유지한다. 이번 추가 변경은 README 시작 링크, TEAM-START/작업카드/출처·이관 문서, 재현·보안 검사 스크립트 및 **distribution 테스트 fixture의 저장소 내 고정**이다. 이 과거 fixture의 정확한 byte hash가 clone의 자동 줄바꿈 변환에 따라 달라지지 않도록 해당 경로만 `.gitattributes -text`로 고정한다.

최종 Stage 대조에서 발견한 보완: PR 원본 PNG7개는 기존 동결 복사 과정에서 CRLF 바이트가 제거돼 손상돼 있었다. Git 객체의 원래 바이트로 게시 복사본만 복구했고 원본 동결본/실패 증거는 그대로다. 원격 SHA 대조210항목 중 이7개를 제외한203개가 기존 기록과 일치했으며7개는 올바른 원격 바이트 hash로 별도 기록한다. 추가로 Stage에서 드러난23파일의 EOF 빈 줄/행 끝 공백만 정리하고 파생 bundle을 다시 생성했다. **제품 의미/계약은 유지하되 바이트 단위로는 이 형식 정리·번들이 동결본과 다르다.** [정확한 복구·정리 목록](publication-repairs.json)을 원래 Manifest와 함께 읽는다. 관련 자동 회귀/빌드는 보완 후 재실행한다. 기존 Figma 브랜드 `.png`3개는 원래부터 JPEG 바이트였고 원격 기준과 동일해 수정하지 않았다.

공백 정리 직후 bundle 재생성 전에 회귀를 실행한 중간 시도에서 bundle 동일성3개가 실패(744 PASS/3 FAIL)했다. 기대값을 완화하지 않고 원본에서 bundle을 재생성했다. 팀 스크립트도 build→동일성 포함 회귀 순서로 맞추며, 원격 clean clone에서는 생성 후 Git diff0으로 추적 bundle 정합성을 별도 확인한다. Extension의 JS/MJS/CJS/JSON/HTML/CSS만 LF로 checkout하게 `.gitattributes`에 지정해 Windows `autocrlf`에 따라 동일성 시험이 달라지는 문제를 방지한다. 모델/이미지 같은 바이너리에는 text 규칙을 적용하지 않는다. 중간 실패 로그는 로컬에 보존한다.

보안 검토에서 과거 문서18개에 있던 개인 로컬 경로33곳을 게시 복사본에서만 `<LOCAL_PATH_REDACTED>`로 바꿨다. 역사 문서의 명령은 현행 실행 안내가 아니며 TEAM-START의 재현 절차를 사용한다. 제품 경로/계약/시험 기대값은 이 정리로 바꾸지 않았다. 비밀 패턴44건은 테스트의 합성 토큰/거절 URL·비밀 비노출 assertion 및 환경값 생성 코드로 문맥 검토했다. [검토 위치·내용 hash](security-review.json)를 고정해 내용이 바뀌면 재검토하게 한다. 실제 credential/개인키 탐지0, 위험 파일 경로0이며 실제 비밀값은 출력·게시하지 않는다. 이는 패턴+문맥 검사 결과이며 임의 바이너리의 안전을 수학적으로 보증하는 표현은 아니다.

첫 독립 실행에서 `test_original_contract_rejects_identical_unused_fixture`가 작업 폴더 밖 과거 출력의 session_update.py를 참조해 67개 중1 ERROR가 났다. 기존 외부 과거 소스 그대로 SHA256 `67e92d5dcbbd9c7018eee7c433206c8df1f0b5cd80909fc0c073f0ed2887c74f`로 `distribution/tests/fixtures/session_update_before_unused_renewal.py`에 고정하고 시험이 hash를 검사하도록 바꿨다. 현재 제품 updater로 fixture를 대체하거나 기대 거절을 삭제하지 않았다. 재시험67/67 PASS. 최초 실패/후속 성공 로그는 로컬에 각각 보존한다. 이 fixture는 합성 설치의 이전 계약 비교용이며 실제 설치에 실행하지 않는다.

게시 공간 실행: `scripts/verify-team.ps1 -Area All -Install`. Web226/226, TypeScript/Vite build; Extension747/747, Content순수4/4, 문법/기존 member worker·guestA1/memberA1 bundle·harness build; backend 비DB24/24+verify/JAR; runtime-server56/56+verify/JAR; distribution 수정 후67/67. 위 수는 서로 다른 시험 범위이며 같은 시험 재실행을 합산하지 않는다. 실제 Chrome/전체 DB/Native 설치 수용은 NOT_RUN. C#Native 합성40·pipe2경로의 기존 동결 검증은 Native 소스 hash 동일 근거의 **과거 재사용**이며 이번 신규 실행과 구분한다.

원격 게시 뒤 새 디렉터리에서 원격 clone→전체 SHA 검증→`verify-team.ps1 -Area All -Install -FreshCaches`로 npm/Maven cache까지 분리해 재현한다. 원격 재현의 실행 완료 여부·실제 counts·CI는 신규 Draft PR/최종 보고에 남기며 게시 전에 미리 PASS라 쓰지 않는다. 팀원 PC·개인 GitHub Push 권한은 직접 증거 전 NOT_VERIFIED. 현재 CLI 연결의 repo push=true를 확인했고 연결 도구가 보여 주는 다른 권한을 팀원 권한으로 추정하지 않는다. 권한/보호 규칙 변경 없음.

최초 게시 시도 Git `e713dc9c5b8149c27521ff09cc7aa9ce7bf0601f` / PR23 CI run40790820881에서 Linux의 Web 타입 검사와 Native fixture 시험이 실패했다. Windows Web226/빌드·Native67 PASS를 Linux PASS로 확대하지 않는다. Web은 `ByRoleOptions`에 존재하지 않는 `exact` 옵션3개만 제거하고 `name` 문자열의 기본 정확 일치 조건과 assertion을 유지한다. Native의 실제 C# 컴파일/부모 거절 음성 시험은 Windows 전용이므로 같은 파일의 기존 Windows 시험처럼 OS 조건을 명시했다. Windows에서는 계속 실행하며, Linux에서는 해당 컴파일2건이 skip이다(67개 전체에서65실행/2skip). 제품 구현이나 CI 설정/권한을 바꾸거나 실패 assertion을 삭제하지 않는다. 최종 후속 Commit·동일 SHA 여섯 브랜치·원격 재현·CI 결과는 PR23 최종 본문을 사용한다. 최초 Commit과 실패 로그는 보존한다.

## 기존 추가 MVP 이관 준비

[파일별 비교 목록](additional-migration-inventory.json)은 기존 a29d02c 작업본을 **읽기만** 한 결과다. 50개 실제 변경 파일: 새 파일21, PR22 선행 설계7, 새 필수 후보와 양쪽 변경을 대조해야 할22개(제품9 + 카드/현황13). 디렉터리 rollup의 status 행 수와 실제 파일 수를 혼동하지 않는다. 이 분류는 내용 hash 비교이며 22개 모두 Git 텍스트 충돌이 난다는 뜻은 아니다. 이관/PR 생성은 아직 미실행이다.

제품9개: frontend의 MemberApp.tsx/테스트·UiLayout·BehaviorRecords·FocusSessions·FocusShared·Settings, backend RecordController/RecordQueries. 기존 상태/오류 UI·시간대 차트를 새 필수 후보의 인증/복원/상태확인/응답 계약 위에 **기능별로** 합성해야 한다. 파일 전체 복사는 금지한다. 추가 독립 클래스/선택 SQL/새 컴포넌트/fixture는 출처와 의존성을 유지하고 작은 카드로 이관한다. backend 변경을 runtime-server API에도 적용됐다고 간주하지 않는다. PR22 원격 설계7개를 먼저 별도 검토하고 최신 로컬 설계/UI mapping/세 프롬프트의 바뀐 입력만 추가 후속 PR로 낸다. 로컬 검사기·Chrome 계측 helper는 검토 전 자동 게시하지 않는다.

기존 추가 구현 근거는 해당 옛 checkout에서 Web141·backend 독립MySQL178·Chrome156 합성HTTP57·문서469 PASS. **이 새 필수 후보의 통합 PASS가 아니다.** 재사용 후 다시 해당 시험/기존 필수 회귀와 실제 독립 Chrome 수용이 필요하다. 개인 .local DB/credential/원문 로그·실패 증거는 이관 대상에서 제외한다. 기존 내용과 실패 증거는 원본에 남는다.

## 미해결 P0와 실행 경계

STORE_UNCONFIRMED 최초 경로 미확정, 최신 Shorts 검색·직접·추천·SPA·새로고침·뒤/앞·BFCache·다중탭, 실제 회원/비회원 정상 END·DOM/Binding/DNR 복원·Native 재연결·재기동은 미완료다. 과거 FAIL/UNKNOWN/HOLD를 CLEAR/PASS로 바꾸지 않는다. 김다훈 별도 Shorts 트랙에서 다룬다.

회원 D06 member-a1-1/비회원 guest-a1-candidate-2는 관측 버전이다. 상시 runtime owner/원장전환·새 Wire·측정 기준은 실제 3인 REVIEW_PENDING. 공통 기준 게시로 임의 승인하지 않는다. `TEAM_BASELINE_READY`는 **원격 source 게시+독립 checkout 재현**의 판정이며 최종 기능 수용이나 팀원 PC 첫 실행을 대신하지 않는다. `MVP_FINAL_COMPLETE=false` 유지.

## PR23 위험 중심 코드 리뷰 — 2026-10-29 후속

사용자 최신 범위는 자동 분류·결함 검수·검증된 최소 수정이다. **Approve/Merge를 수행하지 않는다.** 검토 기준은90ad32be→6c5000f9의536파일/583 diff hunk/6,117,771 diff bytes. [파일별 분류·위험 태그·심층 검토 범위](review-file-classification.json)에 모든 경로와 해당 기준의 파일 SHA를 기록했다. 후속 정렬 수정/회귀 시험·이 분류표는 그 원래536파일 집계와 별도다.

| 배타적 주 분류 | 파일 |
|---|---:|
| 인증·권한 |32|
| Core·Content |132|
| Web·Server |60|
| 배포·개발 실행 |31|
| 제품 공통 설정 |2|
| 테스트·시험 도구 |146|
| 생성물·이미지 자산 |19|
| 문서 |114|

전체536개는 diff/내용 기반 자동 분류·위험 태그 대상이다. **제품 경계32파일의 선택 함수/구간을 심층 검토**했으며, 모든536파일/모든제품 함수의 의미를 전수 검증했다는 뜻이 아니다. 나머지 자동 검사 영역과 수동 심층 영역은 JSON의reviewScope로 구분한다. 대형 생성 bundle은 원본 모듈 및 기존 생성물 동일성 회귀를 기준으로 검토하며88,000여줄을 독립 구현처럼 중복 심층 검토했다고 세지 않는다.

### 확인한 경계와 남은 검증 한계

- Manifest는 DNR/탭/탐색/scripting/Native Messaging 및 전체http(s) host 권한을 요청한다. 사이트 정책 실행에 필요한 광범위 권한이며 그 자체를 무권한 접근 결함으로 판정하지 않는다. 외부 연결은loopback matches지만 **메시지별 sender id/frame/tab/origin + 저장된 HTTPS authority/owner 검증**이 실제 경계다. deployment-binding, member-web-bridge, auth-bridge 조합을 검토했다. 외부 CONNECT/WAKE는APPLY/END 권한이나 credential을 반환하지 않는다.
- NativeLinkHost의4KiB frame·메시지 필드 whitelist, Chrome 조상 PID/생성시각/SID/executable/profile·extension origin, binding hash, runtime 파일 hash 및 명령별 사전 grant를 검토했다. Python 진입점의 설치 경로/payload/부모 검사와 비식별 진단, install_core의 서비스 환경 정리도 선택 구간 대조했다. 실제 설치·Native 등록·Chrome 실행으로 검증하지 않았다.
- Core의 owner fence/CAS/current route·세대 검사, P1 sender tab/frame/document/lifecycle/credential/native proof, DOM ledger·실제 복원 증거와 terminal cleanup gate, DNR 해제 시 rule 내용/소유권 대조를 검토했다. Worker 복원과 stale ACK/END 우선은 기존747회귀의 동일 소스 근거를 함께 사용한다. 검증되지 않은 정상 END/Shorts 수용을 PASS로 바꾸지 않는다.
- Web CSRF/session 직렬화와 서버의 cookie/Origin/CSRF·PKCE·access/refresh generation·설치 proof/owner 쿼리를 대조했다. Named read route가 catch-all 경로보다 우선하며 읽기에도 계정/설치 필터를 유지한다. parameter binding/트랜잭션 경계와Event1.1/1.2의 frozen snapshot 가장 구체적인 호스트 선택을 검토했다.
- backend와 runtime-server는별도 애플리케이션/DB·migration 기준이며 하나의기존DB에무조건적용가능하다는보증이아니다. Snapshot/D06/Wire 원문과각모듈기존migration은이번수정으로바꾸지않았다. 신규상시runtime/소유권/원장계약은REVIEW_PENDING 유지.
- PR17/21/22 head는직전게시기준과일치한다. 기존210원격파일대조/33의미해소·원격전용115경로 및수정기록을재사용한다. PR17/21을다시통째로Merge하면옛실행경로가재유입될수있다. PR22 설계7개·현재추가MVPdirty구현은분리보존한다.
- 보안검사는게시대상·설계ZIP내부·PNG원본CRC/서명·정확내용hash결속synthetic예외를사용한다. credential/인증서/DB/개인프로필/실패진단원문을새로넣지않는다. README의최소환경/명령/팀브랜치절차는6c5000f 원격fresh clone 증거를재사용한다. 이번수정은의존성/실행설정을추가하지않는다.

### 검증된 발견 — REV23-P2-01 (수정)

- 위치: `runtime-server/src/main/java/kr/ac/kdu/focurve/MemberReadModel.java:15`, `dashboard`의recent_access 정렬. 수정 전occurred_at 문자열 비교 후역순5개를선택했다.
- 재현: 같은초의`2026-10-29T10:00:00Z`와`2026-10-29T10:00:00.1Z`를함께저장하면문자열상`Z`가`.`뒤로가서더오래된정각기록이앞에표시된다. `.000Z`/`.000000000Z`처럼같은Instant도표기길이에따라정렬돼sequence/id tie-break를어긴다. 최근5개에잘못된기록이남고더최신기록이누락될수있다.
- 영향·등급: 대시보드표시순서/최근5개선택오류 **P2**. 인증·정책차단·원장내용을변경하거나교차회원자료를노출하는결함은아니다.
- 최소수정: 기존accessList에서쓰는`latestFirst`(Instant→access_seq→event_id 내림차순)를재사용한다. API/DB/이벤트필드·D06메시지변경없음.
- 실행근거: 실제dashboard메서드를호출하는새합성회귀`DashboardEventOrderingTest` 2개를먼저추가해 **2 FAIL**을확인했다. 최소수정뒤runtime-server전체 **58 PASS/0 FAIL/0 ERROR/0 SKIP**, verify/JAR성공. HTTP/실DB/Chrome수용으로확대하지않는다.
- 명령: `./backend/mvnw.cmd -f runtime-server/pom.xml -B -ntp -Dtest=DashboardEventOrderingTest test`(수정전FAIL), 동일모듈`verify`(수정후PASS). 초기실패/수정후로그는로컬에구분보존한다.

이번선택검토에서새로재현된P0/P1은0, P2는위1개다. **기존Shorts STORE_UNCONFIRMED/실제END·복원·재기동P0와미검증은계속남아있다.** 새P0/P1미발견이무결함·제품수용완료를뜻하지않는다.

### CI와 리뷰 집중점

e713dc9의run40790820881은과거실패(WINDIR/잘못된ByRoleOptions.exact),6c5000f의run40791445065는수정후5/5SUCCESS이다. 이번정렬수정후에는새head의CI를별도로확인해PR본문/최종보고에기록한다. 과거5/5를새head의CI결과로사용하지않는다.

담당리뷰집중: 윤종민은Core owner/CAS/DNR/복원과단일actor, 채지민은P1 sender/DOM ledger/SPA·실제복원증거, 김다훈은두서버의프로필/DB분리·권한/기록정렬·이관경계를확인한다. 실제3인D06/Wire/측정합의와필수리뷰승인은이자동리뷰로대체하지않는다. 승인/병합은이번작업에서하지않는다.
