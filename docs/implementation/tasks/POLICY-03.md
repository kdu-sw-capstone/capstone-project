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

### PR #26 실제 수용 준비 — 2026-10-29 (실행 승인 전)

- 원격 PR #26은 Draft/open, 제품 HEAD `98458e8628ca91fd9bb41d7162919d7cc1fed56e` 그대로 확인. 두 결함·756 PASS·원격 CI 결과를 재사용하며 제품 수정/전체 회귀를 반복하지 않음. 이 추가 기록은 로컬 문서 변경뿐이며 Commit/Push하지 않음.
- 후보 ZIP SHA `152cbe78785a9dd98d3796aff67fc703e8aca495091c5a3ddeae3549c6ede633` 재확인. 기존 verifier로 Manifest4404/ZIP4405/source952/build input146 전 항목 재검증 PASS 및 설치 취소 CLI PASS_NO_INSTALL_CALLED. 수정 소스2/생성 번들4를 현재 HEAD와 직접 대조 PASS. 제품 코드/패키지 변경 없음.
- 환경 사전 확인: 정식 Google Chrome `156.0.8078.49`, Native C# compiler 존재, 제안 전용 포트30207/30208 현재 비점유 및 배타 bind 확인 PASS. 디스크 여유120.8GiB, 가용 물리 메모리7.57GiB(기존3GiB 기동 게이트 이상). Java21/MySQL8.4.8/Node24 번들 버전 검사 PASS; mysqld는 --version만 호출하고 서비스는 기동하지 않음. 실행 직전에 포트·RAM·신원을 다시 확인하며 이 수치는 예약/실행 권한이 아님.
- `.local/shorts-night/acceptance-preparation/config.draft.json`: 기존 공개 SMTP 설정만 재사용하고 ports30207/30208, regular_manual로 준비. 이전 Credential·DPAPI·인증서·사용자 DB/프로필은 복사/열람하지 않음. 새 Gmail 앱 비밀번호는 설치 시 사용자 보호 입력창에서 직접 입력해야 하며 채팅/로그로 받지 않음. 근거 `.local/shorts-night/acceptance-preparation/PREFLIGHT.json`, `acceptance-preparation-verification.log`.
- 기존 실행 경로 재사용: 새 설치→정식 `connect --user-session`→수동 확장 로드→native-link 제품 화면의 서비스 준비/종료. 해당 제품 경로는 BrowserBridge를 사용하지 않음. `install_core start/stop`의 일반 CLI는 OFFICIAL_BROWSER_PROVIDER_NOT_CONFIGURED이므로 선택하지 않고 provider 주입/검사 우회도 하지 않음. `distribution/docs/USER-RUNBOOK-CURRENT.md`의 신규 독립 설치 수용·서비스 제어 탭 분리 절차를 따름.

요청할 새 승인 범위(아직 승인되지 않음):

1. 위 고정 ZIP으로 신규 설치1개. 실제 설치 ID는 기존 installer가 새32hex UUID로 발급; `%LOCALAPPDATA%/FOCURVE/R4/installations/<new-id>` 아래 전용 profile·database·새 schema 사용. 설치 때 ID/Extension ID/API/callback/profile/DB/Native/인증서 결속을 기록하고 첫 START 전에 확인.
2. 정식 Chrome 전용 프로필1개, HTTPS30207·MySQL30208만 사용. CurrentUser My/Root에 해당 신규 설치 인증서1개 생성·신뢰, 신규 설치 전용 HKCU Native host 등록1회, 새 DPAPI 비밀 생성 및 SMTP 보호 입력1회. 충돌이면 다른 설치/키/포트를 변경하지 않고 중단. 회원가입이 필요하면 사용자 동의한 인증메일1회부터 수행하고 자동 재전송하지 않음.
3. 첫 실제 설치 변경 시각T0부터 최대60분. T0와 절대종료시각을 새 실행 원장에 고정하고 모든 setup/서비스 기한은 그 이하로 제한, 과거 grant 재사용/자동 연장 없음. 마지막10분 신규 집중 START 금지. 재기동은 남은 시간이20분 이상이고 정상 종료·의무0을 확인한 경우만 수행; 부족하면 NOT_RUN으로 남김.
4. 회원 정책 START/정상 END 각1회. 회원 PASS 후에만 비회원 START/END 각1회. 건강한 비회원 RUNNING을 먼저 확인한 뒤 Worker Stop/재생성 최대1회로 기존 정책/재검증·ACK·기한·복원 경로를 관측(실패 Worker 재실행 아님). 서비스 최초 기동/정상 종료1회와 의무0 후 정식 connect 갱신/동일 설치 재기동/정상 종료 최대1회에서 Native 재연결·내용 보존 확인. Native 프로세스 강제 종료나 제어 탭 강제 단절은 범위에 넣지 않음.
5. UNKNOWN/HOLD/소유권 불일치/결과 미확정 시 새 START·재요청·END·Cleanup 없이 최초 증거 보존. 해당 설치의 소유 Server/MySQL만 기존 보존 종료 계약으로 정상 종료할 권한을 함께 요청. 기존 실패 설치/소유자의 DNR·잠금·Journal·Binding·Credential·인증서는 변경하지 않음. 성공 종료 후에도 새 시험 DB/프로필/기록은 보존.

실제 판정 및 증거 수집 순서(현재 전 항목 NOT_RUN):

| 단계 | PASS에 필요한 실제 근거 | 현재 |
|---|---|---|
| 회원 준비 | 신규 설치/전용 Chrome/Native/API/callback/회원·executor 결속, 현재 로컬/독립 DB의 의무·잠금·Receipt와 적용 권한 확인 | NOT_RUN |
| 직접 Shorts | 실제 DNR rule/action 및 직접 URL 제한 화면. 이 결과만으로 SPA DOM 차단을 PASS 처리하지 않음 | NOT_RUN |
| 검색·추천·일반 영상 | Shorts 후보만 제한되고 일반 watch 링크·수동 영상 재생은 정상. 검색/추천 각각 관측 | NOT_RUN |
| href/is-shorts 동적 변화 | 실제 페이지에서 자식 추가 없이 해당 속성이 바뀐 것을 관측하고 원장 선행 저장→대상 제한·ACK를 결속. 자연 발생/관측 증거가 없으면 NOT_RUN; 합성 페이지나 속성 강제 변경을 실제 서비스 성공으로 바꾸지 않음 | NOT_RUN |
| SPA·새로고침·뒤/앞 | Root documentId/URL/현재 lifecycle·적용·재검증을 결속. A→B→A 재활성화와 과거 READY 미재사용 확인 | NOT_RUN |
| BFCache | pageshow.persisted 또는 검증된 동등 브라우저 근거와 실제 문서 재활성화·정책 효과. 단순 뒤로/앞으로 성공을 BFCache PASS로 처리하지 않음 | NOT_RUN |
| 정상 END·복원 | 동일 세션 END 요청/응답·RELEASE ACK, 소유 DOM 복원·일반 재생, Binding 미해소0·Journal RELEASED·해당 owner DNR 대조, Receipt/report ACK 결속·DB 잠금 해제. DNR0 단독 판정 금지 | NOT_RUN |
| 기록·재기동 | 정상 종료 전 기록·설정·회원/비회원 소유 내용 비교값을 저장하고 같은 설치 재기동 뒤 내용 일치 확인. 행 수만 같다는 이유로 PASS 처리하지 않음 | NOT_RUN |
| 비회원·Worker/Native | 회원 PASS 후 정식 비회원 전환·독립 START/END, 건강한 RUNNING 중 Worker 재생성1회, 정상 서비스 종료/갱신/재기동에서 Native 새 신원·정책/내용 보존 | NOT_RUN |

실제 실패가 생기면 최초 code/stage/START request_id/session/operation/owner/generation 및 UTC 순서·원본 파일 SHA를 기존 first-failure/read-only 경로로 확보한다. 행이 없으면 ABSENT로 남기며 후속 ROOT_UNCONFIRMED/PRODUCT_CHANNEL_CLOSED를 최초 원인으로 덮어쓰지 않는다. 최초 실패 수집 실패도 별도 표기한다. 현재 새 실제 실패·END·복원 증거는 없고, 과거 STORE_UNCONFIRMED 최초 원인은 계속 미확정이다. 신규 결함 수정 필요 여부는 실제 증거 확보 뒤 판단한다. `MVP_FINAL_COMPLETE=false`.

### 2026-10-30 실제 수용 재개 전 확인

- PR #26 Draft/open·미병합, HEAD98458e8 유지. 기존 수용 준비 범위와 실패 증거를 재사용하며 실제 실행 승인은 아직 없음.
- ZIP SHA152cbe78…e633 유지. 현재 Chrome은 **156.0.8078.74**로 전일 .49에서 변경됨; 과거 실제 Chrome 증거를 이 버전 PASS로 재사용하지 않음. 30207/30208 listener0, 가용 RAM4.82GiB·디스크118.6GiB 관측. 실행 직전에 다시 검사.
- 재확인 증거: `.local/shorts-night/acceptance-preparation/RECHECK-20261030.json`. 기존 코드 수정·전체 자동 회귀 반복 없음. 설치·Native 등록·정책 START/END·실제 효과·END 복원·재기동 내용 보존 모두 NOT_RUN 유지. 기존 60분/설치1/회원1→PASS 후 비회원1/조건부 Worker1·정상 재기동1 승인안을 사용자에게 다시 제시하며 새 승인을 기다림.

### 2026-10-30 승인된 신규 설치 1회 — 보호 입력 단계 중단

- 사용자 명시 승인에 따라 PR26 HEAD98458e8/ZIP152cbe78…e633/정식Chrome156.0.8078.74/30207·30208 재확인 후 실행. 실행 시작12:38:29.770 KST, 고정 종료13:38:29.770 KST, 신규START 마감13:28:29.770 KST. 과거 기한을 재사용하지 않음.
- 신규 설치ID `c4cf32bcd6f945a6ba542c523381f116`. 현재 프로세스 LOCALAPPDATA가 Codex Windows 패키지 LocalCache 아래이므로 실제 경로는 `C:/Users/dahun/AppData/Local/Packages/OpenAI.Codex_2p2nqsd0c76g0/LocalCache/Local/FOCURVE/R4/installations/c4cf32bcd6f945a6ba542c523381f116`. 기존 설치·프로필·DB·Credential는 변경하지 않음.
- 최초 실패12:39:50.349 KST, `GMAIL_APP_PASSWORD_FORMAT_INVALID` / `SMTP_PROTECTED_INPUT_FORMAT_VALIDATION`. 기존 getpass 보호 입력/검증 경로의 거절이며 입력값을 관측·저장하지 않았음. 실제 입력 원문이나 오류 이유(빈 값·다른 종류의 비밀번호 등)는 추정하지 않음. Chrome/정책/STORE_UNCONFIRMED 실패와 구분.
- 신규 상태 INSTALL_FAILED_PRESERVED로 보존, 자동 재시도0. 읽기 전용 후검사에서 extensionId/nativeLink/launchId 미발급, secrets.dpapi·인증서·database·profile·Native binding·소유 프로세스 기록 모두 없음. 해당 설치의 java/mysqld/chrome/Native 프로세스0, 포트listener0, 설치기 종료 확인. 강제 종료·END·Cleanup·삭제·상태 되돌리기 없음.
- 자동 검증756/원격CI/ZIP 정합성은 그대로 재사용. 실제 Extension 로드/회원 로그인·START·효과·정상END/복원·비회원·Worker/Native 재연결·재기동/내용 보존 **모두 NOT_RUN**. 회원·비회원 START/END 각각0. 과거 UNKNOWN·복원 의무 및 최초 STORE_UNCONFIRMED 원인은 여전히 미해결.
- 증거 폴더 `.local/shorts-night/actual-acceptance-20261030/`: EXECUTION-GRANT.json, INSTALL-TARGET.json, PROGRESS.json, OPERATION-FIRST-FAILURE.json, POST-FAILURE-READONLY.json. 최초 실패 파일 SHA256 `45e1628000a42f6a8c151f25f6603308c63b734ad14a53525c802c06a86b9aed`. 제품 수정·Commit·Push 없음.
- 다음 최소 행동: 보존 설치를 재실행/수동 완료하지 않음. 이번 설치 실패를 보존한 채 동일 검토 후보로 신규 설치 1회 추가가 필요한지 사용자에게 확인. 별도 승인 없이는 새 대상·기한 연장·원장/상태 수정 없음. `MVP_FINAL_COMPLETE=false`.

### 2026-10-30 새 실행 승인 후 R2 보호 입력 사전 단계

- 새 명시 승인으로 후보SHA152cbe78…e633/HEAD98458e8/Chrome156.0.8078.74 확인. 30207/30208 listener0, java/mysqld/Native 실행0, 별도 「실제 Chrome·Native 통합 수용」 작업 idle·승인 대기 확인 후 준비. 과거 설치 c4cf32…f116은 변경하지 않음.
- 원본 ZIP/Install-FOCURVE.cmd는 변경하지 않음. 원본 launcher는 config.example.json의18447/18448을 고정 사용하고 포트를 대화식으로 묻지 않으므로, 로컬 시험용 동명 launcher에서 승인된 외부 config.draft.json을 동일 패키지 install_core.py의 기존 main install CLI에 전달하도록 구성. 기존 보호 getpass를 설치 폴더 생성 전에 호출하며 입력값은 메모리에서 한 번 전달하고 로그/파일/채팅에 노출하지 않음. 제품 소스 수정·Push·Merge·기존 Worktree 정리 없음.
- 13:25:09.430 KST 보호 입력에서 GMAIL_APP_PASSWORD_FORMAT_INVALID. 값이나 구체적 원인은 관측/추정하지 않음. 설치 main 호출·대상 생성 전 거절되어 EXECUTION-GRANT/INSTALL-TARGET도 없음. 신규 설치·프로필·DB·인증서·Native 등록·서비스·START/END 모두0, 60분 실행 시계 미시작. 허용된 신규 설치1회는 아직 미사용이며 다음 설치를 추가 승인 요청할 상황과 구분.
- 증거: `.local/shorts-night/actual-acceptance-20261030-r2/OPERATION-FIRST-FAILURE.json`, PROGRESS.json, SCOPE-STATE.json. 원본 실패는 보존하고 같은 launcher 자동 재실행 없음. 다음 최소 행동은 사용자의 Gmail 앱 비밀번호 보호 입력 준비 확인 후 새 보호 입력 단계로 이어가는 것. 비밀번호를 채팅으로 받거나 기존 Credential를 가져오지 않음. 실제 Chrome·회원/비회원·정상END/복원·재기동 내용 보존은 전부 NOT_RUN, MVP_FINAL_COMPLETE=false.

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


## 2026-10-30 PR #26 실제 회원 수용 — UNKNOWN 보존 종료

- 후보 HEAD `98458e8628ca91fd9bb41d7162919d7cc1fed56e`, ZIP SHA-256 `152cbe78785a9dd98d3796aff67fc703e8aca495091c5a3ddeae3549c6ede633`, Chrome 156.0.8078.74, 전용 설치 `281867a81d0a426395dbfbface82fab8`, 포트 30207/30208. 기존 756/756·CI·후보 무결성 결과를 재사용했으며 제품 코드 재수정·재회귀·Merge를 하지 않았다.
- 승인 설치 시작 2026-10-30 13:36:23.902 KST. 회원가입·인증·로그인·Extension 회원 연결을 DB 및 사용자 UI로 확인. 사전 CLEAR_LOCAL_ONLY는 로컬 한정이며 전체 복원 PASS가 아니다. Extension 회원 팝업 START 1회, 실제 RUNNING 시작 14:07:39.648 KST. END 0회.
- 사용자 관측 정정: 검색 경유는 제한·Shorts 숨김이 관측됐으나 홈 버튼 경유 뒤 Shorts 노출·진입 실패를 보고했다. 직전 두 화면의 ‘Shorts 제한을 확인하지 못했습니다’는 제한 성공 증거가 아니다. 홈 경유 증상과 UNKNOWN의 선후·인과는 로컬 최초 진단 대기이며 단정하지 않는다. SPA·BFCache·동적 속성·일반 영상의 전체 경로 PASS로 확대하지 않는다.
- 서버 최초 UNCONFIRMED 보고 14:13:37.964 KST, `INVALID_EFFECT_EVIDENCE`; 서버 ROOT_UNCONFIRMED 기록 14:13:37.985. NR generation 4, 기한 14:13:38.857 이전 실패이므로 SERVER_DEADLINE으로 분류하지 않는다. UNKNOWN/PARTIAL, 잠금 1개 보존. 과거 STORE_UNCONFIRMED 최초 원인은 이번 오류 코드로 해소하지 않는다.
- 중단 조건에 따라 시험 이동·재시도·강제 END·Cleanup을 중단. 해당 설치 owner를 확인한 정식 quiesce→Server 종료→DB 안정 digest 2회 비교→MySQL 정상 종료를 14:19:16.613 KST에 완료했다. 두 포트 해제, UNKNOWN 세션 1개·잠금 1개 보존, installation/secrets/config/runtime-lock 해시 불변. 기존 설치·Chrome·확장·원장은 변경하지 않았다. 서비스 정상 정지는 정상 집중 END·복원 성공이 아니다.
- 회원 최종 수용 FAIL; 정상 END·복원 BLOCKED; 비회원·Worker 재생성·Native 재연결·동일 설치 재기동·재기동 후 내용 보존 NOT_RUN. 기록·통계 최종 수용도 미확인이다. 로컬 firstFailure 및 Binding/Journal/DNR 의무는 기존 안전 조회 UI의 읽기 전용 결과 수집 대기.
- 비공개 로컬 증거: `.local/shorts-night/actual-acceptance-20261030-r3/`의 `PRESERVED-DB-TIMELINE.json`, `SHORTS-UNCONFIRMED-DB.json`, 사용자 화면, `ACTUAL-CASE-LEDGER.json`, `approved-service-stop-member-invalid-effect-unknown/RESULT.json` 및 DB 보존 digest. 인증 정보·프로필·DB는 게시하지 않는다.
- 다음 최소 작업: 로컬 최초 진단으로 잘못된 효과 증거의 검증 경계를 식별하고 독립 재현으로 원인을 좁힌다. 실패 설치 재실행·새 START 없이 소스 분석/Fixture를 진행한다. `MVP_FINAL_COMPLETE=false`.

### 14:20:23 KST 사용자 제공 로컬 사후 감사

`POSTSTOP-LOCAL-AUDIT-USER.json`을 보존했다. 최초 로컬 진단 시각은 14:13:34.830 KST, INVALID_EFFECT_EVIDENCE, generation 5, 동일 NR transition이며 서버 최초 보고보다 3.134초 빠르다. stage UNCLASSIFIED_STAGE/rejectedFields []이므로 거절한 검증식을 특정하지 못했다. 서버 NR generation 4와 로컬 오류 generation 5는 관측값 차이로 남기며 즉시 소유권 오류로 단정하지 않는다.

UNKNOWN·active session 1·unreleased Journal 1·pending Outbox 2·transition/root claim 각 1이 남는다. GONE_NATIVE binding 원장 17개와 RELEASE_VERIFIED binding 1개가 공존하며 unresolvedBindings 0은 전체 복원 완료가 아니다. DNR 실제 0건이지만 Journal 기대 규칙 100000–100002가 누락돼 JOURNAL_RULES_MISSING이며 정상 END/복원 PASS로 취급하지 않는다. 이 조회는 서비스 종료 뒤 audit-only STATE 요청이고 신규 START/END가 아니다. authenticationVerified/nativeIdentityVerified false는 종료 후 관측이므로 최초 실패 원인으로 소급하지 않는다.


## 2026-10-30 INVALID_EFFECT_EVIDENCE 독립 재현·제품 수정

담당 김다훈, 기존 `fix/shorts-stability`/Draft PR #26, 시작 `98458e8`. PR open/Draft/리뷰 제출 0건을 확인하고 해당 필수 MVP의 Content 확인 시점만 수정했다. 별도 추가 MVP Core·Content 브랜치, 계약/schema, 실패 설치·프로필·DB·서비스는 이번 분석 단계에서 접근/변경하지 않았다.

### 실제 사건에서 확인한 경계와 한계

- 동일 사건의 session `6fa61787-d21b-47f7-ba59-ec0cc35c62e9`, owner MEMBER:1, executor `62c08f47-7ea6-4085-9726-ad899396bb76`, APPLY command `4696d800-a863-4ffc-bb18-8543b9f727e5`, NR transition `ad285a6a-4a94-4fb1-b6bf-96dd83066bd4`는 보존 보고/조회로 결속된다. 로컬 진단 requestId는 START command 결속이며 실패한 Content operation_id나 documentId의 증거가 아니다.
- 실제 최초 반환 지점/거절 필드/원본 effect·coverage는 **미확정(BLOCKED: 당시 관측 부족)**. 후보 소스의 반환 경계는 member-a1/registry.mjs COMPLETE_OPERATION의 선언 결과 검증, member-a1/dom.mjs DOM_CONFIRM 검증, member-a1/core.mjs reconcile의 비성공 적용/QUERY 결과 검증이다. 동일 코드만으로 어느 분기였는지 선택하지 않는다.
- 14:13:34.830 로컬 진단 → 14:13:37.964 UNCONFIRMED 보고 → 14:13:37.985 서버 ROOT_UNCONFIRMED → UNKNOWN/PARTIAL·미해소 의무 순서로 관측된다. 서버 NR generation 4/로컬 진단 generation 5는 각 관측값으로 보존한다. Receipt/ACK 및 실제 적용 효과를 소급 생성하지 않는다. 과거 STORE_UNCONFIRMED와 동일 원인이라고 판정하지 않는다.

### 독립적으로 확정한 제품 결함과 최소 수정

기존 member-fixture + JSDOM + 실제 A0ShortsEffect/A1Content/Core/IndexedDB 원장을 조합했다. 정상 RUNNING에서 기존 ytd-shorts를 새 빈 뷰어로 교체하면 LEDGER_PLAN은 먼저 저장되지만 video는 아직 없다. effect의 media_count/paused_media_count=0, error_count=0인 미확정 상태에서 기존 Content가 DOM_CONFIRM을 즉시 제출했다. Core는 계약대로 INVALID_EFFECT_EVIDENCE를 거절하고 관찰자는 중단된다. 이후 video가 추가돼도 재평가할 수 없는 결함이다. 이는 재현된 소스 결함이며 실제 사건에 같은 DOM/필드가 있었다는 증거는 아니다. 특히 실제 NR 전환과 이 DP 반례를 동일 실행으로 취급하지 않는다.

- 수정: `extension/a1/content.mjs`, `extension/member-a1/content.mjs` 및 해당 Content 생성 번들 2개. 유효한 원래 DOM grant 기한 안에서, 스키마가 유효하고 hidden/inert가 확인됐으며 미디어 0·오류 0·관찰/스캔 정상인 경우에만 DOM_CONFIRM을 유보한다. 새 media DOM 관측 뒤 실제 증거가 확정돼야 원래 capability로 확인한다.
- 3초/5초 기한, sender/owner/generation/document, Core effectConfirmed/coverageConfirmed, Receipt/ACK/Binding/Journal/DNR 검사는 변경하지 않았다. 새 기한·성공 결과·복원 권한을 만들지 않는다. scan/hide/inert 실패·malformed 증거는 이 대기로 숨기지 않는다. media가 끝내 없으면 원래 기한에서 UNKNOWN과 복원 의무가 유지된다.
- 반례: `extension/tests/shorts-dom-readiness.test.mjs`. 최초 4개 회원/비회원 반례 수정 전 **0/4 PASS, 4 FAIL** → 동일 반례 수정 후 **4/4 PASS**. 후속 음성/중복/기한/복원 사례 포함 14개. 명시적으로 제출한 media-less DOM_CONFIRM은 여전히 INVALID_EFFECT_EVIDENCE로 거절된다. malformed schema는 확인되지 않고 원래 Root 기한이 끝나면 UNKNOWN이다.

### 검증·보존·재수용

- Node 24.19.0, Extension 전체 **770/770 PASS** (기존 756 + 신규 14), syntax/check·harness build PASS. 기존 attribute-only href/is-shorts, 문서 A→B→A·BFCache, owner/document/generation/receipt 음성·순서 역전·Worker·정상 END/복원 합성 회귀를 포함한다. 실제 Chrome 수용으로 승격하지 않는다.
- 생성기 출력 5개와 현재 파일 byte parity PASS. 실제 변경 번들은 Content 2개이며 Core/adapter 번들·Manifest 해시 불변. 계약/DB/schema/lockfile 변경 없음. Backend/Web/Native 제품 소스도 불변이므로 기존 해당 검증 근거를 재사용한다.
- 원본 실제 의무는 이번 사건의 관측치 그대로 Journal 1·미확인 보고 2·GONE_NATIVE 원장 17·실제 DNR 0/기대 3. 실패 환경 END/Cleanup/재시작/재수용은 전부 미실행이며 과거 다른 설치 수치와 합산하지 않는다. MVP_FINAL_COMPLETE=false.
- 로컬 증거는 `.local/shorts-night/`의 `dom-readiness-before.log`, `dom-readiness-fixed.log`, `effect-readiness-full-regression.log`, `effect-readiness-syntax.log`, `effect-readiness-bundle-parity.json` 및 기존 실제 사건 디렉터리. 인증 정보·DB·프로필·원시 증거는 게시하지 않는다.
- 실제 원인 확인을 위한 담당 경계: 채지민 Content에는 뷰어/미디어 렌더 순서·원본 측정/기존 FOCURVE_SHORTS_APPLY_REJECTED 또는 CHECKPOINT_FAILED 로그, 윤종민 Core에는 해당 operation/문서·NR/DP·Receipt 결속을 확인할 과제가 남는다. 아직 팀원에게 메시지/검토 승인 기록을 대신 생성하지 않았다. 별도 추가 MVP 구현 변경이나 공유 계약 결정은 요구되지 않았다.
- 재수용은 새 검토 ZIP과 소스 hash를 고정한 별도 승인 후 수행한다. 보존된 실패 설치는 재사용하지 않는다. 최소 경로는 회원 Extension START 1회 → 검색/홈·빈 뷰어 후 media 추가·Shorts 왕복·새로고침/뒤앞/BFCache·일반 영상 → 정상 END/DOM·원장·ACK·잠금 복원이다. 기존 console 오류와 실제 효과 측정·operation/document 결속을 실패 시점에 보존해야 한다. UNKNOWN이면 즉시 중단·보존, 회원 복원 PASS 전 guest/재기동 금지. 이번 단계 실제 Chrome/END/재기동은 NOT_RUN이다.
