## 2026-11-02 PR #97 안내 overlay 수명 P2 수정
- 담당 채지민 / codex/content-keyword-url / 시작 HEAD 69660e8983f6ac16ace5911a1f3b22c9865f878e, 선행 #87 2704148b 유지. 리뷰 5732713954의 aside 생성 중 권한 회수/release 재진입 두 반례를 기존 시험에 추가해 수정 전 11 PASS/2 FAIL을 직접 확인했다. ignored 로그 extension/build/keyword-overlay-before.log.
- keyword-session.mjs만 수명 revision과 생성 직후/연결 전후/본문 및 각 media 효과 직전 검사를 보완. append 중 release가 재진입해 뒤늦게 연결되는 자기 안내도 회수하며, 제거 실패/foreign document 안내는 별도 cleanup 의무로 보존한다. cleanup 재진입을 차단하고 재시도 가능하게 유지한다. ClaimLedger/Core/Server/Wire/다른 기능 소스는 변경하지 않았다.
- 수정 후 Session 14/14 PASS(기존 11+리뷰 반례2+append 재진입/제거 실패·재시도1). URL/합성 화면/Session/ClaimLedger 단위/legacy 계약 관련 조합 61/61 PASS, 실패/skip0. 계약6건은 61에 포함한다. 설치 Windows Chrome headless·모의 권한/미디어/DOM hook이며 실제 MV3 경합·제품 수용 아님. 로그 keyword-overlay-after.log/keyword-overlay-regression.log. build 및 git diff --check PASS.
- 명령: 기존 PLAYWRIGHT_MODULE/CHROME_EXECUTABLE 환경에서 node --test extension/content-tests/keyword-url.test.mjs extension/content-tests/keyword-url-page.test.mjs extension/content-tests/keyword-session-browser.test.mjs extension/content-tests/claim-ledger.test.mjs contracts/additional-mvp/rc1/tests/legacy-boundary.test.mjs; node extension/content-tools/build-chrome-harness.mjs. 원격 CI는 Push 후 별도 확인하며 기존 HEAD의 459/459를 수정본 결과로 승격하지 않는다.
- 사용자 재확인: 기존 키워드 적용 안내/본문 가림·미디어 정지, 해제 시 안내 제거·본문 복원·자동재생 없음, 다른 owner 유지. 리뷰 재진입 반례는 자동 시험으로 확인. 실제 issued/native·영속 예약 ACK·cleanup lease·Core/Server 연결 NOT_RUN. 다음은 같은 PR Push→새 HEAD CI→다훈 변경분 재리뷰. Draft/선행 관계 유지, 병합 없음. MVP_FINAL_COMPLETE=false.

## 2026-11-02 게시 준비 · 사용자 실제 시험 결과
- 게시 직전 직접 관련69/69 PASS(fail/skip0): URL판별24·화면1·session11·ClaimLedger27·계약6. 이전68은 최종 검증으로 대체하지 않으며 이번69는 최종 소스에서 실행했다. 로그 extension/build/keyword-publish-check.log(ignored). build·구문·diff 검사 PASS. 전체Content/제품Core·MV3/Server 수용은 여전히 NOT_RUN.
- 사용자 보고: URL 판별 화면6항목 정상 확인에 이어, 시험 확장0.1.17의 안내한 실제 제한·해제5항목에 대해 '다 정상작동한다'고 확인했다. 범위는 YouTube 검색 gaming 제한·해제, gamings 불일치, 일반영상에서 youtube 호스트 키워드 적용시 화면/영상/소리 정지, 해제 후 직접재생이다. 사용자 실행 보고이며 독립 로그나 실제 Core 제품 수용을 대신하지 않는다.
- 사용자가 결과 기록/Commit·Push·Draft PR 공유에 동의했다. branch codex/content-keyword-url, 선행 #87 codex/ig04-content-receiver HEAD2704148b9d6036a16d1ba2083ffe43ae14580744. 원격 동일 확인. 선행 base로 자체 변경만 제출하며 integration/develop의 병합·Draft해제·제품 활성화는 하지 않는다. 실제 통합 순서·최종 후보는 다훈 관리.
- Instagram 실제 제한/복원·다른 사이트·전체 국제도메인/Unicode profile 동등성·native URL/발급권한·효과 전 영속의무/ACK·cleanup lease·새문서/BFCache 자동재적용·Core/Server 결과저장은 미검증/미연결. canApply·이동승인의 TEST 모의 true는 제품 권한이나 영속증거가 아니다. 페이지 제목/본문/입력값은 신규 판별 대상이 아니다.
- 과거 TITLE/BODY legacy 구현과 정상 시험은 보존한다. 코드 부품·harness·시험·본 기록만 게시하며 Core/Server/공용 계약·기존16옵션 기능 코드는 변경하지 않는다. MVP_FINAL_COMPLETE=false.
## 2026-11-02 URL 키워드 제한 · 후속 구현
- 담당 채지민 / codex/content-keyword-url / 기준2704148b. 사용자가 URL 판별6항목 정상을 보고하고 실제 제한·해제도 계속 구현하도록 요청하여 같은 작업을 이어갔다. 기존 코드·타worktree 보존, Commit·Push 없음.
- 신규 keyword-session.mjs: 기존 ClaimLedger 주입, owner/binding/nonce별 body display/inert 제한, HTML video/audio pause readback·play guard, body 바깥 FOCURVE 안내. 해제는 자기 claim만 복원하고 강제 autoplay하지 않는다. body교체·다른owner·부분 setter 실패 retry·foreign document 의무를 보존한다. Shared Ledger/기존 keyword/controller는 수정하지 않았다.
- frozen policy 복사, canApply 기본false/strict 동기true·실제문서/URL 재검사, 이동 authorizeNavigation 기본false. 권한소실/pagehide는 신규효과만 중단하고 원래 cleanup을 남긴다. invalid URL은 기존제한을 자동해제하지 않는다. URL 250ms 감시는 권한이 아니며 DOM/play는 observer/capture로 검사한다.
- TEST 확장0.1.17 keyword-block-1, 기존 YouTube/Instagram match·activeTab 유지. 키워드입력/적용/해제/상태만 추가, 기존버튼·handler/sender id+popup URL검증 보존. TEST canApply/이동승인 true는 모의이며 Core권한/영속ACK가 아니다. 새로고침 뒤 수동적용, 키워드변경은 해제→적용.
- 최신 Chrome session11/11 PASS: body/media 제한·복원·수동재생, 제목/본문/input 제외, SPA match/unmatch·다른owner, late media/playguard, body교체, invalid인코딩, 권한/pagehide/미승인이동, pause실패/reentrant해제 후 추가pause0, 부분복원retry, foreign notice 보존. 설치WindowsChrome headless 합성DOM 및 모의media/setter이며 제품수용이 아니다.
- 앞선 URL24+화면1+ClaimLedger27+계약6+session10 조합68/68 PASS는 최종 session 경계 보완/foreign시험 추가 전 근거로 구분. 최종 session11 재실행, 다른 소스 불변. 기존 browser29도 직전 session10과 함께39/39 PASS. 전체Content/제품연동 재실행 아님. build/구문/문서공백 확인, build session 원본해시 일치.
- 사용자 시험예정: gaming 검색 제한/해제, gamings 불일치, 일반영상에서 host키워드youtube로 화면/소리 정지·해제 후 직접재생, 비일치영상→gaming검색 SPA 적용. 실제 사용자 제한시험 NOT_RUN. node extension/content-tools/build-chrome-harness.mjs → extension/build/content-harness 로드.
- 미완료: 실제 Core native/current/frozen 검증·효과 전 영속의무/ACK·lease·새문서/BFCache 재적용·결과저장, Unicode/IDNA profile 전체동등성/공동벡터·활성화. local RESTRICTED_LOCAL/restored는 제품 APPLIED/RELEASED·영속cleanup 완료가 아니다. WebAudio/cross-origin iframe 제어를 이번 HTMLmedia 범위로 완료처리하지 않는다. MVP_FINAL_COMPLETE=false.
## 2026-11-02 URL_BOUNDARY_1 · 첫 독립 판별 단위
- 담당 채지민 / 브랜치 codex/content-keyword-url / 시작 인계 #87 HEAD 2704148b9d6036a16d1ba2083ffe43ae14580744. 기존 root 미커밋 OPTION-11/통합현황·다른 worktree 및 선행 PR 보존. 별도 worktree에서 구현하며 Commit/Push/PR 미수행.
- 기준: docs/design/00_문서안내.md, 개발운영.md·통합현황.md, 본 카드, additional-mvp-contracts/05_Content_Event_UI.md URL_BOUNDARY_1, contracts/additional-mvp/rc1/schema.json KeywordConfig, traceability F05, tests/reference_model.py keyword_matches/boundary_match 및 test_contract.py 10개 URL vector. 기존 TITLE/BODY/substring 함수는 과거 구현이며 신규 profile로 승격하지 않는다.
- 코드: extension/content/keyword-url.mjs·keyword-casefold.mjs. URL host/path/query값/fragment만 1회 엄격 UTF-8 decode, query+공백·key 제외, NFKC/full casefold·Unicode L/N 경계, scoped host exception. invalid percent/UTF8/host/policy는 UNCONFIRMED·matched:null, 정상 false도 ALLOW/해제증거가 아니다. URL·키워드를 결과에 싣지 않는다. 예외는 Core가 고른 frozen 정책 내부에만 적용하며 부모 정책을 합성/선택하지 않는다.
- 기존 keyword.mjs/controller/PageGate·16옵션·Core/Server/Wire/Manifest는 변경하지 않았다. 신규 판별기의 CHECKED/EXEMPT/DISABLED/UNCONFIRMED는 local_only/native_verified:false 내부 값이며 ContentResult/EffectEvidence/Server성공 enum이 아니다. 실제 차단/observer·권한/native URL·영속 의무·cleanup/프로필 활성화는 연결하지 않았다.
- Unicode overrides는 설치 Python3.14.7 unicodedata16.0.0에서 전 codepoint의 casefold()!=lower() 297개를 생성했다. JS NFKC/URL runtime과의 Unicode/IDNA profile 동등성·artifact hash 및 전체 공동 vector/실제 native authority 승인은 제품 활성화 전 조건이다. WHATWG domain-to-ASCII 후 STD3 label/policy host 제약을 확인하며 IDNA 전체 동등성 입증으로 표시하지 않는다. 로컬 입력 자원 상한65536자 초과도 검사불가다.
- 시험: keyword-url.test.mjs 24/24(계약10vector 포함, double encoding은 재decode 안 함, query key/본문 미검사·ß/ς·전각·한글/astral 경계·예외·오류·입력불변/비노출), Chrome 합성 페이지1/1, 기존 detection3/browser29 = 관련57/57 + legacy계약6/6 총63/63 PASS, fail/skip0. Node24/설치WindowsChrome headless/Playwright, 네트워크는 합성 fulfill만 사용. 기존 시험은 legacy 보존 근거이고 최신 계약 제품 지원으로 승격하지 않는다. 전체Content423/제품MV3/Core/Server는 재실행/수용하지 않았다.
- 시험화면: 기존 serve.mjs 허용경로에 keyword-url.html/mjs만 추가. node extension/content-tools/serve.mjs 실행 → http://127.0.0.1:4178/content-tools/keyword-url.html . 기존 claims/harness 경로 유지. URL 문자열을 입력해서 판별할 뿐 해당 사이트 접속/실제 페이지 차단/Server전송/저장 없음.
- 사용자 체크 예정: gaming + ?q=GAMING 일치, /gamings 불일치, ?gaming=no 불일치, /%67aming 일치, ?q=%FF 검사불가, 게임 + ?q=게임 일치·?q=한글게임 불일치, 입력 지우기. 사용자 결과 NOT_RUN. 다음은 사용자 확인·작은 PR 리뷰와 Core profile/native URL/권한 seam 합의 후 제품 연결. 실제 차단 성공/cleanup 완료를 이번 단위로 판정하지 않는다. MVP_FINAL_COMPLETE=false.
# OPTION-09 · 키워드 제한

단계: 추가 MVP · 설계 담당 영역: Web·Server·Extension

## 작업 상태

- 상태: 진행 중 (Content 독립 구현 검토 대기; 실제 연결·검증 미완료)
- 실제 담당자: 채지민 — Content Control 부분 (Web/Server/Core 기존 담당·이력 유지)
- 브랜치 / 시작 기준 커밋: feature/content-control / 90ad32be5d282f3b44c917a29e156dffc5e29187
- PR: 이번 중간 공유 요청은 기능 브랜치 Commit·Push까지; PR 생성·develop 병합 미수행
- 선행 작업 / 차단 조건:

| 영역 | 담당 | 구현 상태 | 검증 상태 |
|---|---|---|---|
| Web | | 미확인 | 미실행 |
| Server | | 미확인 | 미실행 |
| Extension | 채지민(Content Control 부분) / Core 별도 | 독립 부분 구현, 제품 연결 미완료 | 합성 부분 검증, 실제 미검증 |

해당하지 않는 영역은 관련 명세 근거와 함께 해당없음으로 표시한다.

## 설계 참조

- 화면: KEYWORD-01
- 흐름: TF-A04
- API: API-POLICY-01, API-POLICY-02, API-CAP-01, API-EVENT-01
- 데이터: content_policies, policy_snapshots, access_events
- 회원: 회원 Web·Extension
- 비회원: Extension 로컬
- 로컬: EXT 로컬 동일 검증/owner별 저장

원문: [화면](../../design/01_UX_기능설계/02_IA_화면명세.md) · [동작](../../design/01_UX_기능설계/03_동작규칙.md) · [API](../../design/02_시스템_테크설계/04_API_연동.md) · [데이터](../../design/02_시스템_테크설계/05_데이터_복구.md) · [검증 기준](../../design/04_검수_예시데이터/07_검증기준.md)

## 설계와 구현 대응

| 기준 ID | 기대 결과(기존 설계) | 코드 위치 | 검증 명령·환경 | 결과 |
|---|---|---|---|---|
| AC-OPTION-09-01 | 선택한 범위 NFKC 부분 일치, 예외 host 허용 | | | 미실행 |
| AC-OPTION-09-02 | 입력 필드·미지원 프레임은 검사 대상 제외/미지원 표시 | | | 미실행 |
| AC-OPTION-09-03 | SPA 변경 시 검사, 같은 탐색 중복 접근 없음 | | | 미실행 |

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

## 2026-10-10 Content Control 시작 기록

- 담당: 채지민 / Content Control. 사용자 기존 역할 확인 + 원본보관_개정전.zip의 FOCURVE_개발계획_v1.3.md §5 + 현행 D-06 근거. 다른 영역 담당 기록 유지.
- 브랜치: feature/content-control / 시작: 90ad32be5d282f3b44c917a29e156dffc5e29187 (fetch로 확인한 origin/develop).
- 포함: 페이지 내부 감지·제어·해제·실패 관찰의 독립 모듈. 제외: Core 세션/저장/전송/DNR, Web/Server/DB.
- 상태: 진행 중(독립 구현). 실제 Core 연결: 차단(D-06 세부 메시지·navigation 식별/이벤트 확정 시점 미합의).
- 기존 구현: develop extension은 README만 존재. Core는 별도 PR17/9b063be에 있으며 임의 merge/대체하지 않음. Server 검증 기록은 Content 검증으로 전용하지 않음.
- 적용: 이 카드의 AC 원문 및 관련 BOUND. 자동 DOM fixture 검증과 실제 Windows/서비스 연동을 구분.
- 다음: 독립 구현·검증 후 결과/파일/미완료 갱신. D-06 연결안은 제안 문서로 작성(사용자 응답).

## 2026-10-10 Content Control 검증·재개 기록

- 코드: extension/content/keyword.mjs / controller.mjs. 테스트: extension/content-tests/*.test.mjs.
- 실행 주체·환경: Codex / Windows / Node24.19.0 / 설치 Chrome154.0.8037.98(headless), Playwright 합성 DOM/정책. 이미지 분류는 모의. 사용자 실행은 OPTION-09 합성 도구에 한정(아래 최신 기록 참조).
- 최종 자동 검증: 29/29 PASS, 실패/skip0. 독립 감지·제어·복원 부분만 검증. EVENT 집계·전송, 실제 서비스/Extension/Core/Server/학습 모델·브라우저 재시작은 미검증.
- AC·BOUND 대응/명령/초기 실패 및 수정: [상세 기록](../Content_Control_2026-10-10.md)의 기능별 표·코드 대응·실행 결과 참조. 이 카드의 기존 AC 표는 전체 기준이므로 미실행 상태를 전체 PASS로 올리지 않음.
- 남은 기능·의존: D-06 메시지/공통 탐색/이벤트 확정 시점, Core manifest·고정 정책 주입·소유검증·결과/전송 연결. OPTION-10 목록·OPTION-11 실제 고정 모델 자원 필요. Instagram 추천/모달 DOM 실증 필요.
- 다음 행동: [연결 제안](../Content_Core_D06_연결제안.md) 팀 검토, [Windows 절차](../Content_Control_Windows_검증.md) 실행 결과 반영. 실제 통합·팀 리뷰·develop 병합은 미완료.
- 완료 판정: Content 독립 부분 구현만 검토 가능. 기능 전체 검증완료 아님. Git/PR 최종 상태는 상세 기록의 게시 기록 참조.

- 이전 게시 시도의 Git 상태: Commit/Push 실행이 권한 요청에서 거부돼 프로세스 미시작. HEAD90ad32b·staged0, 변경은 로컬 보존. PR 생성/리뷰/통합 미수행. 상세 게시 보류·재개 기록 참조.

## 2026-10-10 사용자 실행 결과 및 중간 공유 재개

- 사용자(채지민)가 localhost Content 검증 도구를 Chrome에서 실행했다. 제공한 화면에서 입력창에 검증대상이 있어도 blocked:false / SUPPORTED / limited:false이며 일반 페이지가 유지됨을 확인했다. 이어 본문 변경 시 FOCURVE 제한 안내만 표시된 화면을 확인했다.
- 자동 복원·수동 해제 후 본문 변경·재적용 절차를 안내한 뒤 사용자는 “다 된거 같은데”라고 보고했고 서버 종료도 보고했다. 이 세 항목은 **사용자 정상 추정 보고**로 기록한다. 세부 단계별 로그/추가 화면·버전·파일hash는 제공되지 않아 독립 확인 PASS로 확대하지 않는다.
- 실행 대상: feature/content-control의 미커밋 작업본(시작 HEAD90ad32b). 검증 당시 최종 Commit SHA/실제 로드 파일hash·Windows/Chrome 정확한 버전은 미확보. 이후 코드 변경 없이 중간 공유를 준비했다.
- 적용 범위: OPTION-09 키워드 합성 도구, AC-OPTION-09-01/02/03 및 BOUND-18의 일부(입력 제외·본문 감지·가림/해제). 실제 Extension/서비스 페이지/Core/Server·모델·재시작 검증으로 전용하지 않는다.
- 최신 사용자 지시: 확인한 결과와 미검증·Core 연결 대기를 기록하고 feature/content-control에 Commit·Push하여 중간 결과 공유. develop 병합 금지, 오늘 추가 구현은 진행하지 않음. 이전 게시 거부·보류는 당시 이력이며 이번 명시 허용으로 Git 게시를 재개한다.
- 다음: 윤종민이 D-06 연결 제안의 정책 주입/적용·해제 결과/공통 navigation_id/이벤트 확정·중복 방지를 검토. 세부 계약 합의 후 Core 연결 및 실제 회원·비회원 Chrome 검증. 현재 전체 기능 미완료.

- 중간 공유 실행: stage·diff검사 통과, commit은 Author identity unknown으로 실패. user.name/email 미설정 확인, 사용자 정보 답변 대기. Push 미실행·HEAD90ad32b·stage 보존, 최신 실패 기록은 작업본. 이름/이메일 설정 후 재stage·Commit·Push·원격SHA 대조 재개. develop 병합 금지 유지.

### 2026-10-10 중간 게시 완료

구현3d7bff718e756cedb0950858885edbb6f472ea68를 feature/content-control로 Push하고 원격SHA 일치를 확인했다. 이전 게시/작성자 차단 해소(사용자 지정 local Git 작성자 적용). PR/리뷰/develop병합 미수행. 자동29/29 PASS·사용자 OPTION-09 부분 확인은 상세 기록과 동일하며 실제 서비스/Core/Server·목록/모델·복구 미검증 유지. 오늘은 중간 공유로 종료, 다음은 D-06 연결 제안 팀 검토→세부계약 합의→Core 연결/실제 Chrome 검증. 최신 게시/재개 원본은 Content_Control_2026-10-10.md 참조.


## 2026-11-03 다훈 전담 — keyword 로컬 종료 관측 격리 수정
- 담당 김다훈. 별도 managed Worktree C:/Users/dahun/.codex/worktrees/content-keyword-termination/04 · 추가 MVP 구현, detached 기준 33b88f810f4e56bb42f4956c95860dab70a55cbb. 기존 #97/#99 원격·타worktree/index·scan0 미커밋·공유staged삭제1,036파일 보존. Commit/Push/PR/병합은 별도 승인으로 미수행. #26/#87/IG04 producer·Core/Server/Schema 변경 없음.
- KeywordSession.stop이 observer disconnect 예외 이후 play/navigation listener·polling 정리를 건너뛰는 실제 반례를 수정했다. scan/queued microtask/play callback·observer/listener/polling 상태를 inspect()/release().local_termination에 복사해 노출한다. stop은 각 자원 정리를 독립 시도하고 실제 미종료 flag/실패를 보존한다. 원래 ClaimLedger·notice cleanup/다른 owner·display!important·미디어 재생 금지 의미는 유지한다.
- 동일한 최종 fixture와 정확한 기준 소스를 격리 추출하여 최소2반례 수정전0PASS/2FAIL(exit1) → 최종 같은2PASS. keyword-exact-before.log는 정확 baseline이며 최초 로그와 구분한다. 신규 12시험은 최종 Node회귀 59/59 PASS에 포함, FAIL/SKIP0(exit0). 계약6/6도 각 집합에 포함되어 키워드59와 블러67을 합산하지 않는다. Node24.19 DOM/Events/observer·media/model/runtime 대역이며 실제 Chrome/모델/Native/START/END 미실행이다.
- 기본거절/기존URL·frozen옵션·정책 판별/두모델·임계값·기존스타일/복원알고리즘을 재개발하지 않는다. 로컬 진단은 외부 watch_ref/closure/CleanupGrant/Server RELEASED/Worker physical model 종료 증거가 아니다. pending_model_tasks는 Content가 기다린 decode/반환Promise이며 provider가 early-reject한 뒤 Worker에서 계속 도는 실제 계산까지 확인하지 않는다.
- Node 영향범위·명령은 C:/Users/dahun/.codex/visualizations/2026/10/31/01a191b6-1724-73b2-b0e1-0149c53fba64/content-termination-20261103/handoff.json에 정확히 저장한다. node --check 변경파일·git diff --check·기존 build-chrome-harness PASS. 블러 전용 site/model rebuild는 새worktree에 검증 model artifact/dependency가 없어 NOT_RUN, 다운로드/설치/실행하지 않음. generic harness build가 새 blur code/site bundle 검증을 대신하지 않는다.
- Browser 전체 회귀·실제 두모델/사이트·원격CI는 이번 변경에서 NOT_RUN. 기존 원격 PASS는 기존HEAD에만 귀속한다. 최초 넓은회귀 선택에 포함된 blur-diagnostics/popup-state가 Playwright 모듈 미해결로 실패했으며 Chrome launch 전 종료, 선택실패로그를 보존하고 실제 브라우저 파일을 제외한 Node-only 집합을 실행했다.
- 자료: C:/Users/dahun/.codex/visualizations/2026/10/31/01a191b6-1724-73b2-b0e1-0149c53fba64/content-termination-20261103/keyword-verification.json·keyword.patch·keyword-exact-before.log 및 상위디렉터리 keyword-termination-regression.log. 파일 SHA256/기준HEAD/tree/patch 적용확인/명령·종료코드/의미 한계 기록. Session 자원 scope만 관측하며 TEST bootstrap의 상시 메시지/페이지 listener 전체 종료 proof로 확대하지 않는다.
- 통합 채팅에 독립 검토 인계만 요청한다. 검토범위: 자원실패시 나머지정리/미확정참조보존·late continuation·다른owner/원래목표·콜백재진입·관측사본/정보노출·사용하는 caller의 pending 소비. 실제 provider·watch_ref·closure·CleanupGrant/Worker/RuntimeReport/Server 연결은 HOLD.
- 남은 Content: 실제 제품 callback/provider 소비 위치와 불변 context 결속·watch/old-scope cleanup consumer는 공동 형식/실제 API 필요. 11/5 지민 재분담 후보는 승인된 Chrome에서 각 기능의 실제DOM·SPA/BFCache·미디어/모델·복원 수용과 확정된 Content consumer 연결. 실제수용/Git/독립검토는 별도다. M1 BLOCKED / Shorts PARTIAL / 제품E2E NOT_RUN / MVP_FINAL_COMPLETE=false.
