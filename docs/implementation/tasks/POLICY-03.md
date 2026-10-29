# POLICY-03 · 유튜브 쇼츠 차단

## 2026-10-29 야간 Shorts·문서 안정화

- 담당: 김다훈 영역의 Codex 안정화 작업. `fix/shorts-stability`, 시작 `9868a0f5914d7a173c102fc198a9a908b043381f`(원격 develop과 동일). 독립 Worktree `C:/Users/dahun/.codex/worktrees/shorts-stability-20261029/capstone-project`; 추가 MVP와 기존 실패 설치는 수정하지 않음.
- 기준: AC-POLICY-03-01~03, 기존 동작규칙의 초기/SPA/새 DOM 재적용 및 소유 변경분 복원. D06·Wire·ACK·Binding·Journal·기한·소유권 계약은 유지.
- 재사용 증거: 기존 Shorts·SPA continuation 보고와 실제 UNKNOWN 수용 중단 보고. 실제 최초 STORE_UNCONFIRMED 경로는 미확정, firstFailure=ABSENT와 미해소 의무는 보존. 기존 747 PASS를 이번 Chrome PASS로 확대하지 않음.
- 결함 1 / `711a54f`: 기존 anchor의 href 또는 rich shelf의 is-shorts 속성만 변경되면 observer가 새 대상을 발견하지 못함. 기존 observer attributeFilter에 href/is-shorts 추가. 상대·절대·protocol-relative 링크, rich shelf 및 일반 영상 query 오탐 방지, 회원/비회원 실제 Content·Core·원장 모듈의 정상 END 복원 시험 추가. 확정된 시험 설정으로 변경 전 7건 중 6 FAIL/1 PASS, 수정 후 7/7 PASS. 최초 단독 재현 4 FAIL/1 PASS와 통합 시험 작성 중 설정/기대값 오류도 로컬 로그에 보존.
- 결함 2 / `dc3fb6a`: A→B→A Root COMMITTED에서 BEFORE를 관측하지 못하면 과거 A의 REPLACED_ROOT_OBSERVED를 유지하여 새 COMMITTED의 재검사까지 억제. 동일 현재 문서의 중복 COMMITTED만 기존 준비 상태를 유지하도록 수정. 재활성화는 COMMITTED_NOT_READY로 시작하며 과거 READY를 재사용하거나 새 READY/적용 성공을 생성하지 않음. 신규 2건 수정 전 FAIL→수정 후 PASS, 관련 coordinator/READY 36/36 PASS. 실제 Chrome BFCache의 이벤트 순서·정책 수용 결과는 아님.
- 제품 범위: 소스 2파일과 회원/비회원 Content/Core 생성 번들 4개. 기존 durable plan→DOM 적용 순서·END 복원·sender/owner/generation·기한·ACK 유지. 공유 메시지·Schema·복원 계약 변경 없음. Web/Server/Native/추가 MVP 소스 변경 없음.
- Windows Node v24.19.0, lockfile npm ci: 최종 Extension **756/756 PASS**, 실패/취소/스킵0. `cd extension; node --test --test-concurrency=2 --test-reporter=tap tests/*.test.js tests/*.test.mjs tests/*.test.cjs`. JSDOM·fake-indexeddb·모의 Chrome/fixture clock을 사용하는 합성 검증이며 실제 Chrome이 아님. 결함 1 직후 754 PASS도 보존.
- `node extension/scripts/build-a1.mjs`, `build-member-a1.mjs` 재생성 후 양쪽 content/core 4번들과 generator 출력 byte parity·VM 구문 PASS. `node scripts/check.js` PASS. extension/manifest.json 변경 없음, 명시된 파일 참조 존재 확인 PASS.
- 검토 패키지 준비용 unbound Web TypeScript/Vite build PASS, Java21 runtime-server verify **58/58 PASS**(실패/오류/스킵0, 합성 SMTP/JDBC·제품 DB 미사용) 및 JAR 빌드 PASS. backend/운영 DB·실제 Native 시험은 새로 실행하지 않음.
- 로컬 증거: `.local/shorts-night/attribute-integrated-before.tap`, `attribute-integrated-final.tap`, `recommit-before.tap`, `recommit-after.tap`, `full-regression-final.tap`, `syntax-final.log`, `bundle-manifest-parity-final.json`, `verification-summary.json`, `runtime-verify.log`, `web-build.log`. 원본 과거 Chrome 실패 보고는 기존 위치 그대로 보존.
- 새 검토 후보: `.local/shorts-night/package/FOCURVE-0.1.25-shorts-night-20261029.zip`, SHA-256 `152cbe78785a9dd98d3796aff67fc703e8aca495091c5a3ddeae3549c6ede633`. Manifest4404/ZIP4405/source952/build input146 전 항목 일치 및 Java helper 재컴파일·설치 취소 CLI `PASS_NO_INSTALL_CALLED`. 실제 설치/서비스 기동0. 기존 ZIP/설치는 그대로 보존하며 새 수정 수용에 구 ZIP을 사용하지 않음. 기존 패키지의 vendor만 Manifest hash 검증 후 재사용.
- 패키지 제품 소스 Git `dc3fb6a127e8f7a39b99f9cffc8b00b77b73d0b7`, 그 뒤 변경은 이 기록뿐. 기존 생성기의 BUILD-PROVENANCE.baseGitSHA는 최초 baseline `90ad32b`를 유지하므로 현재 HEAD로 해석하지 않음; 현재 제품 SHA와 파일별 일치는 `.local/shorts-night/package-git-source-receipt.json` 및 SOURCE-BUILD-MANIFEST.json에 결속. 새 패키지는 검토용이며 실제 수용 완료 상태가 아님.
- 다음 날 최소 실제 수용: 새 패키지/명시된 실행 승인·기한으로 독립 환경 1개에서 회원 정책 1회. 직접 Shorts, 검색·추천과 동적 href/is-shorts 재사용, SPA·새로고침·뒤/앞·BFCache 경로를 확인하고 정상 END 후 DOM·Binding·Journal·DNR·Receipt/ACK·서버 잠금을 함께 확인. PASS 때만 비회원 1회, Worker/Native 재연결·동일 설치 재기동과 데이터 내용 비교. UNKNOWN/HOLD/소유권 불일치 시 재시도·강제 END/Cleanup 없이 보존·승인된 소유 서비스 종료 절차 적용. 이 기록은 실제 실행 승인이 아님.
- 남은 위험: 과거 실제 STORE_UNCONFIRMED의 최초 원인 미확정, 기존 실패 설치의 UNKNOWN·Binding·Journal·DNR·잠금 의무 미해소. 이번 두 독립 반례 수정을 역사 사건 원인 확정이나 복원 완료로 확대하지 않음. 문서 재활성화 시험은 Root bookkeeping 경계만 검증; 실제 BFCache·기존 Content 복원·정식 P1 재결속·장시간 Native 경로는 수용 대기.
- 실제 Chrome·Native 설치/등록/정책 START·운영 DB·기존 UNKNOWN/HOLD 복구: NOT_RUN(야간 제외). `MVP_FINAL_COMPLETE=false`.

단계: 필수 MVP · 설계 담당 영역: Web·Server·Extension

## 작업 상태

- 상태: 미착수
- 실제 담당자: 미지정 (기존 배정 기준)
- 브랜치 / 시작 기준 커밋:
- PR:
- 선행 작업 / 차단 조건:

| 영역 | 담당 | 구현 상태 | 검증 상태 |
|---|---|---|---|
| Web | | 미확인 | 미실행 |
| Server | | 미확인 | 미실행 |
| Extension | | 미확인 | 미실행 |

해당하지 않는 영역은 관련 명세 근거와 함께 해당없음으로 표시한다.

## 설계 참조

- 화면: SITE-02
- 흐름: TF-04, TF-08, TF-A01
- API: API-SITE-04, API-SESSION-05, API-EXEC-01, API-EXEC-02
- 데이터: site_feature_policies, policy_snapshots, access_events
- 회원: 회원 Web·Extension
- 비회원: Extension 로컬
- 로컬: EXT 로컬 동일 검증/owner별 저장

원문: [화면](../../design/01_UX_기능설계/02_IA_화면명세.md) · [동작](../../design/01_UX_기능설계/03_동작규칙.md) · [API](../../design/02_시스템_테크설계/04_API_연동.md) · [데이터](../../design/02_시스템_테크설계/05_데이터_복구.md) · [검증 기준](../../design/04_검수_예시데이터/07_검증기준.md)

## 설계와 구현 대응

| 기준 ID | 기대 결과(기존 설계) | 코드 위치 | 검증 명령·환경 | 결과 |
|---|---|---|---|---|
| AC-POLICY-03-01 | 대상 기능만 제한하고 전체 차단 우선 | | | 미실행 |
| AC-POLICY-03-02 | 실제 제한 실패는 성공 접근 통계 제외 | | | 미실행 |
| AC-POLICY-03-03 | 정지·종료 시 변경분 복원, 중복 관찰은 한 접근 | | | 미실행 |

기존 수용 기준은 출발점이다. 상세 명세의 실제 입력·출력·오류를 검증하며 이 표의 존재만으로 충분한 테스트라고 판단하지 않는다. 관련 BOUND 사례도 선택하여 아래에 기록한다.

## 추가·통합 검증

| BOUND 또는 추가 기준 | 실행 방법 | 결과 | 증거 |
|---|---|---|---|
| | | 미실행 | |

## 중단·재개 기록

- 마지막 작업:
- 완료한 부분:
- 변경 파일 / 실행 방법:
- 미완료·오류·설계 충돌:
- 다음 행동:

## 완료 판정

- 관련 설계 항목 구현:
- 수용 기준 및 관련 경계 사례 검증:
- 실제 연동 확인 (모의 응답 제외):
- 검토·통합 근거:
- 남은 문제:

## 2026-10-09 최신 Server 전달·통합 준비

담당 김다훈(Server/API/DB·연결Frontend), 브랜치 codex/server-event12-integration, 시작develop76df34ea6be1c591be33c29606c24fc654f61932. 기존 담당 배정 유지. 상태: 담당 구현 검토 대기 / 실제Extension통합 미검증. 최신 사용자 지시로 담당 코드 전달용Commit·Push·develop PR을 진행하며 전체MVP완료나 병합으로 처리하지 않는다.

[게시 검증·실행환경·주체·남은 조건](../Server_최신수정본_게시검증_2026-10-09.md) · [실제 API·Event1.2·구형 호환·Core 절차](../Extension_Server_연동가이드.md). Backend 최종107/107(기존106+실제HTTP합성1), Frontend104/104·build PASS. 설치/APPLIED는합성, 실제Chrome/회원Core통합/Content감지는미검증. Snapshot1.2 신규발급OFF. 전체AC를 통과로 승격하지 않는다.


## 2026-10-10 결함 4건 로컬 수정·회귀 기록

- 담당: 김다훈 Web·Server·API·DB. 브랜치: fix/email-code-retry-after. 시작 기준: b45a680a9f2262bd9725619e9643df3bb9b91164.
- 상태: 관련 입력 경계 로컬 수정 검증, 작업카드 전체 완료 아님.
- 이번 근거: F3 JSON boolean true/false를 구분 저장하고 enabled 누락/null/잘못된 타입 거절. 실제 Content 감지·Shorts 차단/복원은 NOT RUN; 정책 저장 검증만으로 수용 기준 전체 통과 처리하지 않음.
- 실행: Backend mvnw.cmd -B -ntp verify(154/154), Frontend npm test(121/121) 및 npm run build, 새 tmpfs MySQL8.4.8·Mailpit1.27의 HTTP(131 PASS/1 BLOCKED).
- 검증 주체: Codex 자동/HTTP/격리DB·Mailpit 및 합성 실행 보고. 실제 Chrome·Edge·외부 OAuth·Extension은 NOT RUN.
- 보고서: .reviews/stage1-fixes-20261010/FOCURVE_1단계_결함4건_수정검증보고서.md 및 검증매트릭스_갱신본. 과거 이력·사용자 직접 확인은 유지하며 이번 자동 검증과 구분.
- 다음 행동: 독립 재리뷰, 실제 UI·Core/Content 통합 검증. Commit·Push·PR·병합 수행 안 함.


## 2026-10-10 F1~F4 게시용 최신 develop 재검증

- 담당 김다훈 Web·Server·API·DB. 브랜치 `fix/stage1-boundary-regressions`, 기준 develop `3d105b05753844ceff28a235751ede4e959b3ef6`(PR #19 병합). 기존 로컬 수정/사용자 확인 이력은 당시 근거로 보존한다.
- 독립 재리뷰 통과 F1~F4만 선별했다. 제품 코드·테스트 12파일은 리뷰 해시와 일치하며 원본 20파일을 보존했다. PR #19의 APPLY_POLICY.duration_minutes 및 공통 Command 표·기간 계약을 유지한다.
- 게시용 작업본 재실행: Backend160/160(실패·오류·스킵0) 및 패키징, Frontend121/121 및 빌드, 실제 HTTP·격리 MySQL8.4.8·Mailpit1.27 156개 검사 PASS. Backend verify 확인까지 합한 harness 검사 157개 PASS.
- 검증 주체는 Codex 자동·HTTP·실제 임시 DB/메일 수신·합성 설치/실행 보고다. 시간 제한 경계는 격리 DB 시각을 조절한 재현이며 실제 한 시간 대기가 아니다. 실제 Chrome·Edge·외부 OAuth·외부 SMTP·회원 Core/Content 통합은 이번 검증 NOT RUN이다.
- 과거 기간 미전달 BLOCKED는 당시 Server 상태이며 PR #19로 Server 전달은 해결됐다. Core의 소수점9자리 시각 파싱·기간 검증/영속 결속 및 실제 회원 실행은 후속 통합 대기다. D-01·D-05 자동복구 전체는 미구현, Snapshot1.2 신규 발급 기본 OFF를 유지한다.
- 상태: 검증된 결함 수정본 Draft PR 게시 준비/팀 리뷰·통합 대기. 전체 작업카드·93개 수용 기준·필수 MVP를 완료로 변경하지 않는다. 실행 로그와 게시 결과는 `FOCURVE_1단계_F1_F4_게시검증보고서.md`에 남긴다. develop 병합은 수행하지 않는다.


## 2026-10-28 Shorts 8영역 동등 P0 통합

사용자 최신 기준으로 진입·DOM/재생·Core/Worker·SPA URL·문서 생명주기·권한/Binding·반복/복원·END/재기동을 모두 P0로 관리한다. 브랜치 `codex/execution-engine-review-20261028`, 기준 HEAD `90ad32be5d282f3b44c917a29e156dffc5e29187`와 독립 후보 소스를 사용한다. 기존 설치·통합 작업 공간은 변경하지 않았다.

전체 Extension 회귀 690/690 PASS. 신뢰된 실험 모드의 제한적 문서 인계, 비회원 D1 문서 retirement 연결, 같은 시각의 이전 COMMITTED 오인과 pending/ready 조정 결함을 수정했다. 원본 proof·복원 원장·5초 기한·소유권 검사는 유지한다. 실제 Chrome 8영역은 모두 NOT_RUN이며 BFCache 정상 복원·실제 Native 재연결·Server/DB 수용은 미확인이다. 전체 완료로 판정하지 않는다.

검토 ZIP SHA-256: `3335acea5823435e04e1da9dcd2591406a1412001fbce8d49db923338d6c865d`. 실제 설치/서비스/START·END 승인은 별도로 요청했으며 승인 전 실행하지 않는다. 상세: [8영역 P0 통합 기록](../Shorts_8영역_P0_통합_20261028.md). `SHORTS_STABILIZATION_COMPLETE=false`, `MVP_FINAL_COMPLETE=false`.
