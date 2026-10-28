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

## 기존 추가 MVP 이관 준비

[파일별 비교 목록](additional-migration-inventory.json)은 기존 a29d02c 작업본을 **읽기만** 한 결과다. 50개 실제 변경 파일: 새 파일21, PR22 선행 설계7, 새 필수 후보와 양쪽 변경을 대조해야 할22개(제품9 + 카드/현황13). 디렉터리 rollup의 status 행 수와 실제 파일 수를 혼동하지 않는다. 이 분류는 내용 hash 비교이며 22개 모두 Git 텍스트 충돌이 난다는 뜻은 아니다. 이관/PR 생성은 아직 미실행이다.

제품9개: frontend의 MemberApp.tsx/테스트·UiLayout·BehaviorRecords·FocusSessions·FocusShared·Settings, backend RecordController/RecordQueries. 기존 상태/오류 UI·시간대 차트를 새 필수 후보의 인증/복원/상태확인/응답 계약 위에 **기능별로** 합성해야 한다. 파일 전체 복사는 금지한다. 추가 독립 클래스/선택 SQL/새 컴포넌트/fixture는 출처와 의존성을 유지하고 작은 카드로 이관한다. backend 변경을 runtime-server API에도 적용됐다고 간주하지 않는다. PR22 원격 설계7개를 먼저 별도 검토하고 최신 로컬 설계/UI mapping/세 프롬프트의 바뀐 입력만 추가 후속 PR로 낸다. 로컬 검사기·Chrome 계측 helper는 검토 전 자동 게시하지 않는다.

기존 추가 구현 근거는 해당 옛 checkout에서 Web141·backend 독립MySQL178·Chrome156 합성HTTP57·문서469 PASS. **이 새 필수 후보의 통합 PASS가 아니다.** 재사용 후 다시 해당 시험/기존 필수 회귀와 실제 독립 Chrome 수용이 필요하다. 개인 .local DB/credential/원문 로그·실패 증거는 이관 대상에서 제외한다. 기존 내용과 실패 증거는 원본에 남는다.

## 미해결 P0와 실행 경계

STORE_UNCONFIRMED 최초 경로 미확정, 최신 Shorts 검색·직접·추천·SPA·새로고침·뒤/앞·BFCache·다중탭, 실제 회원/비회원 정상 END·DOM/Binding/DNR 복원·Native 재연결·재기동은 미완료다. 과거 FAIL/UNKNOWN/HOLD를 CLEAR/PASS로 바꾸지 않는다. 김다훈 별도 Shorts 트랙에서 다룬다.

회원 D06 member-a1-1/비회원 guest-a1-candidate-2는 관측 버전이다. 상시 runtime owner/원장전환·새 Wire·측정 기준은 실제 3인 REVIEW_PENDING. 공통 기준 게시로 임의 승인하지 않는다. `TEAM_BASELINE_READY`는 **원격 source 게시+독립 checkout 재현**의 판정이며 최종 기능 수용이나 팀원 PC 첫 실행을 대신하지 않는다. `MVP_FINAL_COMPLETE=false` 유지.
