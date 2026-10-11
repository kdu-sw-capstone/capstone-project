# EXT-02 / D-09 · 제품 회원 설치 인증 연결 — 2026-10-10

담당 윤종민 · Extension Core, 브랜치 feature/extension-core-ext-02, 시작 f6c2f7e1216c52d2470a5ca8ebb7ec143b5415f0. 상태: **코드 연결·모의/합성 HTTP 단위 통과, 실제 회원 Chrome 및 EXT-02 전체 미검증**. D09는 공용계약 참조이며 새기능ID/담당 재배정 아님.

## 기준 및 구현

AGENTS.md·개발운영/통합현황/EXT02카드, 인증·실행복구·가져오기 연결계약11, D01_D10최종공용계약 D09 및 응답유실 한계, 실제LinkController/MemberLinks/WebAuthentication/AuthController/RequestProtection 대조. Server 제품코드·API·DB스키마·Frontend는 변경하지 않았다.

- `background/member-auth.js`: 같은 비회원 installation UUID로 설치등록/proof, PKCE S256/state, LINK_PENDING 영속 전환, 실제 idle관측 evidence, Web승인 polling, 토큰교환 및 GET/auth/me owner확인. Web승인만으로 연결성공 처리하지 않음.
- 설치/proof/PKCE verifier/토큰은 `chrome.storage.local`의 background 저장 경로로만 처리하며, 매 read/write 전에 TRUSTED_CONTEXTS 접근제어 설정. Content/Web에게 비밀 응답 없음. popup 상태응답은 phase/설치·회원·요청ID/설정주소/오류만. 토큰·code는URL/콘솔/PR/outbox로 보내지 않는다.
- 설치별 직렬 queue와 GuestSTART guard. 링크대기/교환·미확인·회원연결 중 새guest집중 금지. 기존 비회원자료·session DB·규칙·events·전송outbox 삭제/소유권 변경 없음. 연결시 실제 세션종료·journal RELEASED·실제 owned DNR 규칙없음 확인. 이미 진행중이면 먼저 직접종료 요청; 자동종료/새ID생성 없음.
- 제품Worker 내부 `MemberAuthRuntime.credentials()`만 회원전송/명령 후속코드에 credential 제공. 외부message/Content/다른 확장/서브frame 거절. popup만 exact URL/sender/requestID 확인.
- access token 만료전1분에 refresh직렬화. REFRESHING/EXCHANGING/REGISTERING을 전송전에 영속저장. 토큰응답 저장·owner검증 이후만 LINKED. refresh/code교환 응답유실 또는 Worker재생성 중간phase는 복구필요/등록미확인으로 보존, 무조건재전송/가족폐기우회 없음. claim은 같은state/proof로 재조회 가능. 유효 link만료/거절은 설치proof를 보존한 REGISTERED로 복귀. 미지원 추가복구API 임의생성 없음.
- 기존계정버튼·화면설정/연결확인 details에 상태·Server/Web설정·공개callback주소를 연결. 신규 전체회원메인/다이얼로그 디자인을 추측해 구현하지 않음. 제공retry디자인명세22PNG 범위에 회원연결 상세프레임은 없고 일부속성미검증이므로 완전Figma일치/회원UI완료로 표시하지 않는다.
- LINKED여도 **회원집중/명령루프는 미연결**이라고 안내하고 guestSTART를 막는다. 기존guest자료 조회/설정은 비회원 경로 그대로다. 회원 START/적용/보고/이벤트업로드/로그아웃·disconnect는 이번인증단위 전체완료로 주장하지 않음.

이번 제품 파일 SHA256: `3ef8a9fdcbaefea59a8b9b8f11eb73422907e63cb025e8969523cbb59c501101`. extension manifest/background/popup/blocked 경로순 `상대경로+NUL+파일SHA256+LF` 산식. 실제Windows 로드hash 대조 미검증. 이번 source는 f6사용자Chrome1~25 코드와 다르다.

## 실행 결과 및 근거 구분

| 근거 | 주체·환경/방법 | 실제 결과 | 한계 |
|---|---|---|---|
| Extension 전체자동 | Codex Linux / Node24.19.0 / npm --prefix extension test | **114/114**, 실패0·skip0 | Chrome/storage/fetch/IndexedDB 모의. 설치·PKCE·원본보존·동시refresh·유실·만료/거절·sender·소유규칙·guest경합 포함 |
| 제품popup HTML | Chromium151.0.7922.173 / test:popup-ui | **19항목** 통과 | ChromeAPI·회원상태 모의. 실제설치/물리Chrome 아님 |
| Backend 전체verify | JDK21.0.12.1 / MySQL8.4.8 격리focurve_test | **140/140**, 실패0·skip0·package PASS | 마지막helper/status확인 보완 전전체실행; 보완후 좁은 인증HTTP 재실행 아래행 |
| 제품Auth모듈→실제HTTP/MySQL | ExtensionAuthHttpIntegrationTest + member-auth-http-probe.mjs 최종재실행 | **1/1** 통과 | Webcookie/테스트회원·Chrome idle·storage 합성. 설치/proof·evidence·approval·PKCE·access/refresh 발급·me API는 실제 |
| 문법·harness | npm check/build:harness, diff check | 통과 | ESLint/실제Chrome제어검증 아님 |
| 이번Auth코드 Windows Chrome | 미실행 | **미검증** | Server/Web/테스트회원·callbackallowlist 준비 후 사용자검증 필요 |

실제HTTP 인증회귀는 설치→증거→Webcookie+Origin+CSRF승인→claim→PKCE교환→auth/me를 실행, Server 설치 current_user_id·소비request를 확인한다. 만료직전 로컬clock fixture에서 동시2credentials 요청→HTTPrefresh **1번**, Serverrefresh family의 이전1개폐기/신규1개유효와 새Bearer me를확인했다. 실제Web로그인메일/Google/Kakao나 Chrome규칙증거는 이 합성시험으로 통과처리하지 않는다. 테스트프로세스 fixture 비밀은환경으로만 전달하고 실패시본문/토큰을 출력하지 않는다.

```bash
source .local/cloud-env.sh
npm --prefix extension test
npm --prefix extension run check
npm --prefix extension run test:popup-ui
npm --prefix extension run build:harness
# 격리 test profile만; 개발 .env Snapshot1.2 OFF 보존
bash scripts/with-env.sh env SNAPSHOT_1_2_ENABLED=true SNAPSHOT_1_2_VERIFIED_EXECUTORS='*' bash backend/mvnw -f backend/pom.xml -B -ntp verify
bash scripts/with-env.sh env SNAPSHOT_1_2_ENABLED=true SNAPSHOT_1_2_VERIFIED_EXECUTORS='*' bash backend/mvnw -f backend/pom.xml -B -ntp -Dtest=ExtensionAuthHttpIntegrationTest test
```

## 사용자 f6 비회원 Chrome 결과 보존

새ZIP 재로드 이후1~25 정상 사용자보고. 전체4회·반복2회 화면 및 chzzk.naver.com/www.naver.com 두원본의1.2/접두사없는key/정책host naver.com/blocked_reasons[]/동일session 확인. Chrome154.0.8037.98 공식64Stable / Windows11 25H2Build26200.9457 화면확인. 실제파일hash 미대조. 처음반복3은 구형1.1/SITE:naver.com 코드결과라 새코드성공으로 전용하지 않음. 이 사용자 결과를 이번Auth코드 Chrome통과로 확대하지 않는다. Worker복구/전체브라우저종료 사용자보고도 Serverreconcile·D01/D05자동재개·시간계산 원본검증 아님.

## 실제Chrome 수동검증 준비·절차

**Server를 실행하고 주소·callback설정을 확인하기 전에는 계정연결을 누르지 않는다.** 등록응답유실은 proof재발급API가 없어 등록미확인으로 남을 수 있다. localhost/127.0.0.1은 Chrome을 실행하는 사용자PC 자신이며 다훈PC를 가리키지 않는다. 실제token/proof/PKCE/code를 채팅/화면캡처에 넣지 않는다.

1. 최신 작업브랜치 제품extension을 로드. 기존다른FOCURVE는꺼두고 기존자료 삭제하지 않음. 팝업details의 공개확장주소 `chrome-extension://실제확장ID/popup/popup.html`을 확인.
2. 다훈/Server실행담당: 실제환경 `EXTENSION_CALLBACK_URIS`에 이주소를 기존허용값과함께등록, AUTH_PUBLIC_URL/AUTH_ALLOWED_ORIGINS는실제Weborigin설정. .env비밀값은공유하지 않음. 로컬Server/Web 실행은 기존 backend/frontend README/연동가이드의 명령사용. Snapshot1.2 운영발급OFF 유지.
3. Web에서 로그인가능한 검증된 테스트회원 준비. 팝업details에 Server/API주소와 동일Weborigin 입력. 현재guest세션은 종료·해제확인하고 규칙확인 실패이면 진행하지 않음.
4. 계정연결하기 클릭→Web승인창, popupLINK_PENDING 표시/새guestSTART금지. popup를 닫아도 backgroundalarm으로 fresh증거/claim조회(30초 주기)한다. Server승인전성공표시 없음.
5. Web로그인 후승인→popup계정연결상태확인→Server/me 확인후 LINKED. 실제Server설치회원 일치 확인. 회원집중은아직미연결안내/시작금지. **Web에서 회원집중START 테스트는 명령loop 후속구현 전까지 하지 않음.**
6. 별도의 연결요청에서 Web거절/5분만료/활성guest상태진입을확인. 오류는 UI상태로 남고 원래guest자료보존. 연결proof/토큰실패를 재현할경우 원본자료백업·테스트계정/설치에서만 담당과조율.
7. refresh·응답유실·실quota의 실제Chrome재현은아직미검증. 재연결은Web설치연결관리와Server잠금상태를확인한다. 인증미확인state를지워 강제새설치로 전환하는복구기능 없음. 지원API없는재발급/수신복구는다훈과후속조율.

## 최종 판정

- **실패:** 최종자동·합성HTTP검증 실패0. 등록/토큰응답유실·401·거절은 의도된오류회귀이며 실제사용자Chrome 장애검증으로 표시하지 않음.
- **미검증:** 이번코드제품Chrome설치/PKCE/토큰접근통제·갱신/유실·실quota, 실제Web로그인과승인, 회원명령적용/APPLIED보고/event전송·reconcile. AC-EXT-02-01~03·BOUND17 전체미통과, EXT02진행중.
- **조율 필요:** 다훈의실행Server/Web·테스트계정·실제callback허용값, 설치proof/토큰교환·회전유실 후 상태확인/재연결 한계 및회원명령후속adapter. 현API는token없는identity복구API가 없고 직접 disconnect는Web인증경로. 추가API는합의후Server담당작업, 자동변경없음. 회원Figma프레임상세는별도확보필요.
- **다음 행동:** 사용자코드·검증결과리뷰→Server/Web준비후 이번코드회원Chrome 수동검증→회원명령수신/Chrome적용/보고/Event전송연결. 확인한단위만전진하고회원통합/전체완료로표시하지 않음.
- **Git:** 사용자허용된작업브랜치Commit·Push·PR17갱신만. develop병합없음. CI판정은PRchecks 별도로확인.

추가검토: journal이 없는데 실제DNR규칙이 남아 있으면 빈실행증거라고 추정하지 않고 연결을보류한다. 규칙은임의삭제하지 않음. 추가회귀포함114/114 및문법검사통과; 인증HTTP흐름은변경없음.
