# 추가 MVP · 정책 발행·이용시간 수신 경계

## 집중 상태 탐색의 화면 수명 결속 — 2026-11-01

- 담당 김다훈, 기존 managed Worktree 재사용. `fix/additional-mvp-focus-read-lifetime`, 기준 원격 통합 **3569911dde9ec71d86c3b1e36f631c34e2411d53**. #72/#74/#59/#75는 병합된 원문 그대로, #73 HEADbad35335 및 #77 HEAD0892895는 Draft/리뷰 대기로 보존했다. 이번 단위는 두 PR에 의존하지 않는다.
- 실제 독립 결함: FocusSessions의 현재 상태/정책 GET을 기다리다 화면을 떠나면 구401이 useWork를 통해 새 화면의 전역 인증 만료로 전파됐다. 구 성공 응답/CONNECT 응답 뒤에도 설치·사이트·당일 종료 세션 조회를 계속했다. 최초 반례7 중 **5 FAIL/2 PASS**를 원본으로 보존했다. 기존 #72의 선택 세션 접근 요약 및 #74 행동 기록 조회와 다른 **최상위 상태 탐색/주기 조회** 경계다.
- mounted scope와 각 읽기의 AbortController를 결속하고 각 await 뒤 현재 scope를 확인한다. GET/페이지 조회에 signal을 전달하고 폐기 후 성공·catch를 소비한다. 이미 호출한 CONNECT 자체를 취소했다고 주장하지 않으며 그 늦은 응답의 후속 HTTP만 막는다. StrictMode의 폐기 setup이 공통 작업 lock을 선점하지 않도록 최초 조회를 microtask에서 살아있는 setup만 시작한다. 공통 useWork/api.ts/인증/HTTP/Server/schema/RC2/legacy-lock·생산 actor는 바꾸지 않는다.
- 새8 + 기존 FocusScreens/FocusSummaryScope/CadenceFocusSession/countdown/SessionNoteScope/executionWake/useCadenceControl/MemberApp 포함 **84 PASS(9파일)**, TypeScript/Vite build·diff 검사 PASS. 신규 시험은 실제 SDK+jsdom/모의 fetch·CONNECT의 응답 유실/지연 및 StrictMode이며 실제 Server/DB/Core/Chrome 수용이 아니다. 기존 미변경 Server/DB 계약·격리 근거는 재사용, 서비스·DB·메일·정책 START/END 미실행. 원본/최종 로그 `.local/focus-read-20261101/`.
- START/END 쓰기, 상태 판단, 5초 backup/전이1초 poll, 타이머, 선택 세션 요약·메모·history 기능 원문은 보존한다. 이 수정은 상태 탐색 수명에 한정되며 기록 상세/별도 변경 요청 전체의 수명 문제가 모두 해결됐다는 뜻이 아니다. #77의 시험 정리 코드도 복사하지 않는다.
- 새 공개 Core **PR78 HEAD4a2065a7f65c403307d9b17e6fd8a4ceae260f5d**의 설명에서 생산 원장/epoch/seq 영속화가 추가됐음을 확인했다. 실제 scope/effect callback은 false 기본이며 issued verifier·현재 epoch 등록·원장→발신함 replay·HTTP/Worker 연결은 후속으로 명시돼 있다. 설명 확인은 독립 Core 리뷰/승인/실제 제공물 수용이 아니며 기존 CapabilitySource/EvidenceVerifier/ClockProof를 중복 구현하거나 모의 성공으로 활성화하지 않는다. #76/#78/#71 팀원 소스는 수정하지 않는다.
- 미확정 ONCE actor·CADENCE 단계·USG-02 hash, 실제 collector/clock/day·효과/해제 producer·Figma fresh 시각 대조/승인은 유지한다. 기존 Figma sparse/스크린샷 timeout의 동일 재시도는 하지 않았다. 다음은 이 독립 읽기 수명 단위의 담당 리뷰·통합, 실제 발급/검증/전송 제공물의 기존 Server 수신기 결속 및 별도 승인된 실제 적용→정상 END/복원/재기동 수용이다. **제품 수용 NOT_RUN, MVP_FINAL_COMPLETE=false**.



## PR74 독립 리뷰 P2 대응 — 2026-11-01

- 구172012c의 보조 수명 검증만으로는 언마운트된 주 목록 GET401 전파를 막지 못했다. 리뷰 원본5를 **4 PASS/1 FAIL**로 재현 후, 초기/재조회/커서의 주 요청 generation·AbortSignal·성공/catch 폐기 검사를 보완했다. 현재401·목록/필터/페이지·실패 후 마지막 성공 보존은 유지한다. 원본5 + 추가4 **9 PASS**, 기존 관련 포함 **49 PASS**, 타입/Vite PASS. 상세 [LOG-01](LOG-01.md) 최신 절 및 `.local/pr74-primary-fix-20261101/`.
- 선행#72 병합 **79409240e65ec6b92fa12f3422c3e67bea0308f0** 반영은 별도 merge Commit으로 추적했고 공유 카드 양측 전체 원문을 순서 보존했다. 새 HEAD·원격 CI·후보 tree 및 승인 범위는 PR74 본문을 따른다. 기존 리뷰 요청 유지/새 HEAD 재리뷰 대기이며 과거 승인을 소급하지 않는다. 실제 producer/공동 계약 대기는 그대로다. 실제 제품 수용 NOT_RUN, MVP_FINAL_COMPLETE=false.

> PR74 후속 리뷰 동기화: PR72 병합 후 통합 **79409240e65ec6b92fa12f3422c3e67bea0308f0**를 기존172012c에 이력 보존 merge로 반영한다. 수동 충돌은 이 카드1파일이며 양측 전체 원문/완료/검증/실패/HOLD/후속 기록을 순서 보존한다. 아래 기존 PASS는 당시 후보 근거다. 독립 리뷰5726831315의 폐기 주 GET401 P2는 초기/재조회/커서 수명·성공/catch·취소 경계의 별도 수정/시험으로 추적한다. 기존 승인을 새 HEAD로 소급하지 않는다. 실제 제품 수용 NOT_RUN, MVP_FINAL_COMPLETE=false.



## 후속 LOG-01 부분 실패 독립 구현 — 2026-11-01

- 현재 A~J에서 저장·수신·일일/기간/시간대·상태 조회 구현은 재사용한다. #54/#62/#63/#66/#67/#69/#70은 병합 완료, #72/#73은 별도 Draft이며 원격 HEAD/다른 Worktree/index를 보존한다. 실제 actor/clock/day/Content 효과·ONCE/CADENCE/USG-02 결정 대기는 유지한다. 통합 **32eb975952d24159af0d070cc9e0f1a10733aa4f**에서 `fix/additional-mvp-record-partial-reads`로 새 독립 반례를 처리했다.
- **실제 수정:** 성공한 접근 기록까지 보조 통계·세션 필터 GET의 503/무응답으로 표시하지 못하던 경계를 분리했다. 신규3 반례 FAIL→PASS, 확장 신규9·기존9 = **18 PASS**, 기록 상세 왕복 영향1·타입/Vite·자체 diff PASS. 기존 조회/필터/커서/오류 UI를 재사용하고 확인된 목록과 보조 UNKNOWN/실패를 구분한다. 이전 보조 응답/401 폐기, 현재 인증 실패 전파, 조회 실패와 빈 목록·수집 완료의 구분을 검증했다. Server/DB/계약/producer를 추가하지 않았다.
- 상세 소유권·설계/검증·지연/인증/재조회/페이지 경계·미완료는 [LOG-01](LOG-01.md) 최신 절 및 `.local/record-partial-read-20261101/`, 새 Draft PR의 HEAD/CI를 따른다. 합성 UI PASS를 실제 제품 수용으로 올리지 않는다. 실제 Core·Content·Chrome·Native·Server 제품 수용 NOT_RUN, `MVP_FINAL_COMPLETE=false`. 다음 독립 검토 범위는 주/보조 읽기의 실패 격리와 기존 인증/필터/페이지 보존이다.

> 2026-11-01 PR72 통합 동기화: PR63/66 병합 후 실제 최신 통합 **32eb975952d24159af0d070cc9e0f1a10733aa4f**를 기존 **263af275e575f20ca5b68e92c3adef765e1d1c3d**에 이력 보존 merge로 반영한다. 수동 충돌 해결은 이 작업카드1파일이다. 양측 전체 원문을 순서 보존하고 FocusSessions/FocusScreens 시험/FocusSummaryScope 시험3파일은 기존 blob 그대로 유지한다. 아래 과거 Draft/미병합/검증/실패/HOLD/후속/승인 기록은 당시 이력이며 새 HEAD 승인으로 소급하지 않는다. 기존 독립4/4·FocusScreens19/19·Web362/362·CI14/14는 해당 후보 근거로 재사용하고, 새 후보의 CI/시험 merge tree는 PR72 본문 및 `.local/pr72-sync-20261101/`에 기록한다. 기존 Core 리뷰 요청 유지, #63/#66·Core/Content·#73·다른 Worktree/공유 index staged 삭제1,036개는 변경하지 않는다. Approve/Draft 해제/Merge 없음. 실제 제품 수용 NOT_RUN, `MVP_FINAL_COMPLETE=false`.



## 후속 집중 화면 fixture·종료 기록 조회 수명 — 2026-11-01

- 담당 김다훈 Web, 브랜치 `fix/additional-mvp-focus-state-fixtures`, 기존 managed Worktree `C:/Users/dahun/.codex/worktrees/site-usage-period-20261101/04 · 추가 MVP 구현` 재사용. 시작 기준 **b2dc6ffed6593197ef4de6cb0ee8915cc98453bf**에서 진행 중 통합 **4e6ff6ced95b96f362f2fbf088aa192e17278529**를 fast-forward 반영했다. 유입 PR70은 Core 소유의 기존 통합 변경이며 자체 수정이 아니다. 두 기준의 Web/Server/계약/의존성이 같아 기존 검증을 재사용한다. #54/#62/#67/#69 완료를 다시 개발하지 않는다. 아래 과거 Draft·SHA·검증 숫자는 당시 이력이다.
- **독립 재현:** FocusScreens의 정상 집중 상태 fixture가 CFG-01 필수 `has_more`를 누락했다. 정상 요약을 기다리는 결정적 반례 **1 FAIL → PASS**. 기존 복수 alert CI 변동을 단순 재실행/단일 alert 무시로 숨기지 않고 정확한 `/amvp/configs?` 정상 응답을 제공했다. 의도적으로 불완전한 CFG-01과 세션 조회422가 함께 오면 **두 alert 표시·START 차단**을 별도 검증한다. `contracts/additional-mvp/rc1/schema.json` ConfigList의 required와 SDK `listConfigs` 검증은 변경하지 않았다.
- **실제 제품 코드 결함:** 종료 기록 A→B에서 `EndedAccess`가 컴포넌트/상태/조회 lock을 공유해 A 요약 잔존, 대기 A로 B 조회 누락, 늦은 A 응답 혼입 가능. 완료 기록 소유권을 session_id에 결속해 remount하고 읽기 AbortSignal/수명 세대로 폐기 응답·401을 소비한다. **변경 전3 FAIL → 변경 후5 PASS**(늦은 성공/401, 기존 요약 제거·현재 실패/성공 재조회, 현재401 전파, StrictMode). 현재 유효한 오류·전역 인증 만료/세션 실행·Core 상태/0건의 의미는 유지한다. PR69의 Note 코드/API는 재수정하지 않았다.
- **검증:** FocusSummaryScope5 + FocusScreens19 + 기존 NoteScope11/CadenceSummary2 = **37 PASS**, TypeScript/Vite build PASS. 해당 시험은 jsdom/모의 HTTP이며 제품 Server·DB나 실제 producer 수용이 아니다. 정상 Server/DB/계약/의존성은 변경 없어 기존 검증을 재사용하며 불필요한 MySQL/서비스·전체 로컬 회귀는 반복하지 않는다. 추가 CADENCE 영향 시험·게시 HEAD/CI는 PR 본문 및 `.local/focus-fixture-20261101/` 원본/result에 기록한다. 최초 실패 로그와 fixture 보완 중 시험 준비 오류도 그대로 남긴다.
- **범위/재개:** 자체 diff는 FocusSessions 제품1·FocusScreens/FocusSummaryScope 시험2·이 카드1뿐이다. #63/#66 원격 HEAD, 다른 Worktree/index·공유 루트 staged 삭제1,036개·인증/api.ts·DB schema·RC2/legacy-lock·Core/Content/Shorts를 변경하지 않는다. ONCE actor 매핑/CADENCE 단계/USG-02 hash 공동 결정과 capability/effect/release/collector/clock producer는 기존 차단으로 유지한다. 새 공유 계약/모의 producer/추가 조회 화면은 만들지 않는다. 추가 독립 결함 근거 없이 새 PR을 늘리지 않는다.
- Approve·Draft 해제·Merge 없음. 실제 Core·Content·Chrome·Native·Server 제품 수용 **NOT_RUN**, `MVP_FINAL_COMPLETE=false`. 검토 범위는 정상/불완전 CFG fixture 분리, 종료 기록 A→B의 요청·오류 수명과 기존 상태/메모/CADENCE 회귀다.


> 2026-11-01 PR66 통합 동기화: 최신 통합 **4e6ff6ced95b96f362f2fbf088aa192e17278529**를 기존 **650eddd5a38a5406775ce614b1ae2474879fa0b4**에 이력 보존 merge로 반영한다. 수동 충돌 해결은 이 작업카드1파일뿐이며 양측 전체 원문을 순서 보존한다. 기간 이용시간 제품·시험6파일은 기존 blob과 동일하다. DAY-01/KST/confirmed_ms/UNKNOWN·RC2/legacy-lock·Server 생산·DB schema·Core/Content·#63/#72·다른 Worktree/공유 index는 변경하지 않는다. 아래 과거 미병합/수정 금지/검증/실패/승인 기록은 해당 시점 이력이다. 원본 검증은 내용 동일한 근거로만 재사용하며 새 HEAD의 승인으로 소급하지 않는다. 새 HEAD/시험 merge tree/CI는 PR66 본문과 `.local/pr66-sync-20261101/`에 기록한다. Approve/Draft 해제/Merge·실제 제품 수용은 수행하지 않는다. `MVP_FINAL_COMPLETE=false`.


## 선택한 사이트 정책의 기간 기록 — 기존 DAY-01 재사용, 제품 수용 NOT_RUN (2026-11-01)

- 김다훈 Web·Server·DB·UI 후속. 시작 통합 **10ab6026f1cf7d244a75ee529830afb8bcf6b8c8**에서 관리형 Worktree `site-usage-period-20261101`, 브랜치 `feature/additional-mvp-site-usage-period`로 분리했다. 원래 수동 Worktree를 앱이 관리형 원본으로 인식하지 못해 비어 있던 현재 프로젝트 폴더에 소스 전용 shared clone을 만든 후 정식 Worktree 생성 경로를 사용했다. #62 **b3a8d13415827442d468a7109786cac3914481c2**, #63 **3f069ed43bf54c95e9ecc2e3ad850638209759c5**와 기존 Worktree/index·Content/Shorts를 보존한다. 두 PR에 의존하거나 미병합 코드를 복사하지 않는다. #29/#49~#52 병합 사실은 실행 전 원격에서 확인했다.
- 기존 `DailyUsagePanel`의 선택 정책/삭제 목록과 `dailyUsageApi.dailyUsage` → DAY-01 → `AmvpDailyUsage`/원본 segment·budget·소유권·admission 경계를 재사용한다. 같은 패널 안에서 오늘/7일/30일/사용자 지정 기간, 날짜별 표, 확인된 날짜의 확정량 부분 합계를 연결했다. 새 페이지·메뉴·Server endpoint/DTO·schema/migration·producer는 없다. 기존 브라우저 전체 STA-01 기간 조회는 그대로 유지한다.
- 빠른 선택의 오늘은 기기 시간대가 아닌 KST 기준이다. 기존 DAY-01 요청 날짜는 **원장에 저장된 시간대의 날짜**라는 계약을 변경하지 않는다. 양 끝 날짜 포함, 한 정책 최대31일의 순차 GET으로 부하를 제한하고 변경/취소 후 추가 요청을 멈춘다. KST `Asia/Seoul` 정상일의 정확한 UTC 경계 및 비중첩 구간만 부분 합계로 계산한다. 다른 시간대·전환일은 날짜별 원본만 보이고 KST 기간 합계를 만들지 않는다. confirmed_ms만 더하고 carry·불확실 시간·remaining은 더하지 않는다. 자료 있는 0과 null/404/503/UNKNOWN을 구분하며 모든 날짜가 조회돼도 수집 완료라고 하지 않는다.
- 조회 중 날짜 입력은 유지한다. 날짜·정책 ID·설치·version·saved_runtime_revision·삭제/정책 값 변경은 이전 요청을 취소하고 결과를 숨긴다. 이전 선택으로 돌아와도 낡은 성공 결과를 되살리지 않으며 명시 재조회가 필요하다. 인증/소유권/응답 식별 불일치/provider 부재는 전체 결과를 거절한다. 일별 RESOURCE_NOT_FOUND/저장 미확정은 날짜별 미확인으로 남긴다. 현재 등록 버전과 과거 측정 버전을 동일시하지 않는다.
- **새 검증:** 기간/달력/합계/취소14 + UI10 = 신규24, 기존 일일 Panel8/SDK3 포함 집중 **35 PASS**, 누적 Web **346 PASS**. TypeScript/Vite build PASS. 기존 Server 날짜 API2+설정 계약6 **8 PASS**. 기존 DAY MySQL10에 KST 연말 TCP/읽기 불변·새 JDBC 연결 시험1을 추가하여 DB11+API2 **13 PASS**, 실패/오류/스킵0. 실제 loopback TCP는 실제 controller/auth/JDBC를 사용하지만 admission·capability·seeded clock/day 증거는 **SYNTHETIC**이다. 중복/역순·격리·소유권·삭제/재등록·DST/전환일 거절은 기존 원장/조회 시험과 그대로 연결한다.
- 로컬 원본 `.local/site-usage-period-20261101/`. 첫 MySQL은 Windows 실행기의 한글/공백 datadir 인수 해석 실패로 시험 시작 전에 종료됐다. 실패 `.local/amvp-mysql-5a6ef5a2682e`를 보존하고 관리형 Worktree 부모의 영문 `verify` 경로에서 동일 소스를 가리키는 junction으로 재실행했다. 시험 DB **529faa3912af**, port33419, datadir/PID 확인 후 정상 종료. 기존 설치 DB/SMTP/Native는 사용하지 않았다. 계약 Python 시험은 현 Python의 jsonschema 부재로 수집 전 중단되어 PASS로 집계하지 않는다. 계약·legacy-lock/API·Server 생산·의존성 blob 동일성과 위 Server 계약 검증을 재사용하며 기준 Core4파일 legacy-lock FAIL을 유지한다. 초기 신규 시험의 mock hook 반환/Windows 대소문자 모듈 경로 문제도 수정 후 재검증했으며 최초 로그를 보존한다.
- **명시적 PARTIAL/BLOCKED:** 실제 방문 호스트(actual_host/target_key)별 범위·사이트 등록 ID·과거 policy_version·matched_policy_host를 반환하는 기간 DTO는 DAY-01에 없다. 정책 호스트를 실제 방문 호스트로 바꾸거나 서로 겹치는 정책·설치 합계를 전체 이용시간으로 만들지 않는다. 해당 분리 조회와 비KST 날짜의 KST 구간 재배분/시간대 변경은 승인된 조회 계약이 필요하다. DAY-01의 budget/day 증거가 없는 무제한 정책의 방문시간·collector/anchor/day allocation·USG-02는 기존 BLOCKED/공동 결정 대기를 유지한다. 실제 Core/Content/Chrome/Native·제품 서비스 수용, Light/Dark 실물·반응형/키보드 시각 수용은 NOT_RUN. 독립 시연 범위는 검증된 격리 자료의 정책 선택·기간 조회·부분/미확인 표시이며 실제 측정 시연이 아니다. `MVP_FINAL_COMPLETE=false`.
- 검증 후 Commit/Push/Draft PR로 게시하고 새 HEAD/원격 CI는 PR 본문 및 로컬 result에 기록한다. Approve·Draft 해제·Merge는 수행하지 않는다. 다음 최소 공동 결정은 기존 raw에 있는 actual_host와 원본 policy attribution/version을 노출할 승인된 read DTO/기간·시간대 의미이며, 실제 producer의 발행/원본 증거/clock 제공물 없이 성공 활성화하지 않는다.


> 2026-11-01 PR69 후속 동기화: PR67 병합 **005b90134a436fd651cd07baff1be1fc934173e4**를 기존 #69에 이력 보존 merge로 반영한다. 수동 충돌은 이 작업카드1파일이며 아래 양측 전체 기록을 보존한다. `SessionNote.tsx`, `SessionNoteScope.test.tsx`, `SESSION-06.md`는 기존 **b043737102422c4618f655e99c882c56e8cadc50**의 blob과 동일하다. 그 외 변경은 통합 기준에서 가져온 #67의 기존 구현이며 재구현하지 않는다. 기존 검증/승인은 내용 동일한 근거로만 재사용하고 새 HEAD 승인으로 소급하지 않는다. 새 HEAD·CI·후보 tree 근거는 PR69 본문 및 `.local/pr69-pr67-sync-20261101/`. #63/#66·Core/Content·다른 Worktree·공유 루트 index는 변경하지 않으며 Approve/Draft 해제/Merge·실제 제품 수용은 수행하지 않는다. `MVP_FINAL_COMPLETE=false`.

> 2026-11-01 PR69 리뷰 보완·통합 동기화: 독립 리뷰의 폐기 GET401 전역 인증 만료 P2를 초기 load/PUT412 후속 GET 양쪽에서 재현·수정했다. 폐기2 FAIL·현재401 대조군2 PASS → 관련33 PASS. 원래 오류 수명 경계만 보완했으며 api.ts/인증/useWork 계약은 유지한다. PR62 병합 **624c99c7846f514b683ecaaa2eac8deb48ec72f4**를 반영하면서 아래 양측 기록 전체와 Note 제품/시험 및 SESSION-06 카드 blob을 보존한다. 과거 리뷰/승인을 새 HEAD로 소급하지 않는다. #66은 기존 수정 금지 범위로 남겨 HEAD를 변경하지 않는다. 새 HEAD/CI는 PR69 본문과 `.local/pr69-review-fix-20261101/`에 기록한다.

## 후속 SESSION-06 화면 이동·입력 보존 — 2026-11-01

- 통합 **10ab6026f1cf7d244a75ee529830afb8bcf6b8c8**에서 `fix/additional-mvp-note-session-scope`로 독립 개발했다. 앞선 설정 충돌 PR67 **8f0ccf752d322a11f23cd9e6f084a0c1608bf2b4**는 원격 CI8/8 workflow·16/16 job SUCCESS, Web336/336과 bridge MySQL15/기존 config 계약6 PASS를 확보했고 HEAD/파일/리뷰를 변경하지 않는다. #62/#63/#66도 보존한다. 이 후속은 PR67을 포함하거나 의존하지 않는다.
- A~J 기능별 구현/미통합/실제 producer/공동 결정 분류는 PR67 작업카드 변경에 정리했다. 그 기록을 다시 쓰지 않고 다음 독립 결함인 SESSION-06을 기존 UI·Note API로 수정했다. 이전 세션의 대기 GET과 `useWork` lock이 새 세션 조회를 막고 늦은 이전 응답을 표시하는 반례 및 조회 중 입력을 덮는 반례2 FAIL → 최종 PASS. 세션별 수명/응답 세대를 결속하고 이전 PUT·412·부모 draft callback을 폐기한다. 현재 편집의 저장 여부와 서버 ACK 스냅샷도 구분한다. 중간 StrictMode 초안 실패는 게시 전 차단·수정했다.
- 신규7 + 기존 FocusScreens18/CADENCE4 = **29 PASS**, 타입/Vite·추가 시험 타입 검사 PASS. 모의 HTTP/JS DOM이며 실제 제품 수용이 아니다. Server/DB/Note API·RC2/legacy-lock·owner/Receipt/Core/Content/Shorts/의존성 변경 없음. 상세 원문/경계는 기존 [SESSION-06](SESSION-06.md) 카드, 로컬 `.local/note-scope-20261101/`, 새 HEAD/원격 CI는 PR 본문/result를 따른다. 불필요한 DB/설치/전체 로컬 회귀는 반복하지 않는다.
- 다음 경계: 실제 host/과거 version 기간 DTO, ONCE actor 매핑·CADENCE 단계·USG-02 hash는 공동 결정/제공물 대기다. 공개 Core e903aff/Content a6468b6·통합10ab602에서 새로운 승인된 RuntimeReport/capability/effect/release/collector/clock 제공물은 확인되지 않았다. TimeRule UTC 정밀도는 기존 PR60을 재구현하지 않는다. AI 저장 schema/동의/provider는 승인 없이 도입하지 않는다. 새 독립 결함이 확인되기 전 의미 없는 조회 화면·PR을 추가하지 않는다. 실제 Core/Content/Chrome/Native·정상 END/복원/재기동 NOT_RUN, `MVP_FINAL_COMPLETE=false`.

> 2026-11-01 PR67 통합 동기화: PR62 병합 **624c99c7846f514b683ecaaa2eac8deb48ec72f4**를 기존 PR67에 이력 보존 merge로 반영했다. 수동 충돌은 이 작업카드 한 파일뿐이며 양측 전체 원문과 기존 PR67 제품/시험5파일 blob을 보존한다. 독립 리뷰의 기존35 PASS 및 Web336/격리21/CI8개 근거는 같은 내용에 한해 재사용하고 새 HEAD 승인으로 소급하지 않는다. 새 HEAD/CI는 PR67 본문 및 `.local/pr67-sync-20261101/`에 기록한다. #66 HEAD는 기존 수정 금지 조건에 따라 보존하고 #69 리뷰 수정은 별도 PR에서 처리한다. RC2/legacy-lock·생산 효과/UNKNOWN/복원 조건은 그대로다.

## 설정 편집·저장 충돌의 사용자 복구 연결 — 2026-11-01

- 담당 김다훈. 통합 **10ab6026f1cf7d244a75ee529830afb8bcf6b8c8**에서 `feature/additional-mvp-settings-conflict`로 분리하고 clean 관리형 Worktree를 재사용했다. #62 **b3a8d13415827442d468a7109786cac3914481c2**, #63 **3f069ed43bf54c95e9ecc2e3ad850638209759c5**, #66 **650eddd5a38a5406775ce614b1ae2474879fa0b4**는 실제 Draft·미병합으로 확인했고 해당 브랜치·HEAD를 보존한다. 새 Worktree/설치/계약/producer는 만들지 않는다.
- 재현한 결함: 같은 설치의 전체 재조회가 편집값과 미확인 저장 요청을 버렸고, 412 후 기존 버전 편집을 해소할 제품 조작이 없었다. 최초 반례2건 수정 전 FAIL → 수정 후 PASS. 같은 설치 재조회는 편집/불변 요청을 보존하고 실패 중 저장을 막는다. CFG02로 최신 종류·소유권·ID·버전을 확인한 뒤 사용자가 서버 값으로 바꾸거나 내 편집 전체를 최신 expected version으로 이어갈 수 있다. 자동 저장/병합은 없고 최종 저장도 기존 If-Match가 다시 경합을 검사한다. SITE_TIME body.version도 같은 expected version으로 결속한다. 삭제된 설정은 재생성하지 않으며 실제 해제로 표시하지 않는다.
- 추가 확인: PUT 성공 후 확인 GET의 401/404/412를 저장 거절·변경 충돌로 오분류해 원래 요청을 버리는 신규3 반례가 수정 전 FAIL이었다. 확인 GET 실패를 UiError/cause로 분리하고 원래 오류를 보존한다. 같은 저장 요청/key/본문/If-Match로만 명시 재확인하며 GET 오류를 PUT412처럼 처리하지 않는다. PUT 자체의 412 및 인증 거절은 기존 의미를 유지한다.
- 직접 영향 Settings/SDK/삭제/상태6파일 **54 PASS**, 별도 최초 cause 보존 SDK **1 PASS**, 누적 전체 Web **336 PASS**(신규14 포함, 중복 합산하지 않음). TypeScript/Vite PASS. 기존 fixture 기반 fresh MySQL8.4.8 **21 PASS = runtime bridge15 + config contract6**, 실패/오류/skip0. 실제 loopback TCP에서 stale PUT412 → CFG02 version2 → 명시 If-Match2/body.version2 PUT → version3와 동일 key Receipt replay, 과거 config version·사용량/예산 불변을 확인했다. capability/clock은 SYNTHETIC이며 Core 실행이 아니다. 시험 DB **c6bd7eb865c0**/port33421, 소유권 확인 후 정상 종료. `.local/settings-conflict-20261101/`, `../verify/.local/amvp-mysql-c6bd7eb865c0/`에 원본 보존.
- RC2·legacy-lock·Server 생산·DB schema·인증/API/RuntimeReport·Receipt의 의미·Core/Content/Shorts·의존성은 기준과 같다. 변경 없는 원장의 기존 검증을 재사용한다. 기준 Core4파일 legacy-lock FAIL, 기존 FocusScreens 복수 alert CI 변동 이슈는 별개로 보존한다. Approve·Draft 해제·Merge·실제 Chrome/Native/제품 서비스 수용 NOT_RUN. `MVP_FINAL_COMPLETE=false`.

### 확정 추가 MVP A~J의 실제 경계 (현재 실행에서 바뀐 경계 중심)

| 영역 | 구현/검증 상태 | 남은 연결·결정 |
|---|---|---|
| A 사이트·기간 이용시간 | DAY-01 IMPLEMENTED_AND_TESTED; #66 IMPLEMENTED_NOT_INTEGRATED | actual_host/target_key와 정책 host/version 기간 DTO는 CONTRACT_DECISION_REQUIRED, collector/day proof는 CORE_CONTENT_DEPENDENT |
| B 한도 설정·조회 | 기존 CRUD 및 이번 충돌/편집 복구 IMPLEMENTED_AND_TESTED | 실제 한도 도달/집행·잔여는 CORE_CONTENT_DEPENDENT; 저장/부분량을 집행 성공으로 바꾸지 않음 |
| C 예약 ONCE·WEEKLY | 저장·occurrence/Receipt 조회 IMPLEMENTED_AND_TESTED | ONCE actor 매핑 CONTRACT_DECISION_REQUIRED; 실제 예약/복원 CORE_CONTENT_DEPENDENT |
| D CADENCE | 저장·frozen 설정/기한·수신 조회 IMPLEMENTED_AND_TESTED | 휴식/주기 표현 CONTRACT_DECISION_REQUIRED; 실제 actor 전환 CORE_CONTENT_DEPENDENT |
| E YouTube·Instagram16 | 설정 CRUD IMPLEMENTED_AND_TESTED | 기능별 효과/해제/ClaimLedger·발행 provenance는 CORE_CONTENT_DEPENDENT |
| F 시간대 통계 | #63 IMPLEMENTED_NOT_INTEGRATED | 접근·반복·차단 분포이며 이용시간으로 대체하지 않음. 새 원본 event issuer는 CORE_CONTENT_DEPENDENT |
| G 기록·필터·메모 | 기존 조회 구현 재사용; 세션 이동·지연 응답은 INDEPENDENTLY_IMPLEMENTABLE 검증 후보 | 동일 기록/필터를 새로 만들지 않으며 SESSION-06의 이전 세션 응답 혼입 반례부터 확인 |
| H 삭제·해제·복원 | 접수/OP/CFG/Receipt 조회 IMPLEMENTED_AND_TESTED | 실제 해제·복원은 CORE_CONTENT_DEPENDENT, UNKNOWN 의무 유지 |
| I 오류·UNKNOWN·재진입 | 기존 표시 및 이번 저장/확인 단계 구분 IMPLEMENTED_AND_TESTED | 실제 제품 수용은 별도이며 모의 성공을 실제 적용으로 승격하지 않음 |
| J Web·Server·DB 시나리오 | 기존 API·격리 TCP/DB 경계 IMPLEMENTED_AND_TESTED | 실제 Admission/capability/effect/clock adapter 부재는 CORE_CONTENT_DEPENDENT |

- 공개 feature Core **e903aff5df3b44895a101efc39af868e543e574f**, Content **a6468b67d97ca32a1ab1ad1af66344f0a45e148e**, 통합10ab602는 이전 제공 기준과 같다. 같은 미제공 producer를 다시 구현/전면 조사하지 않는다. snapshot hash/MATCH/local_only를 Server 효과로 승격하지 않는다. 실제 새 발행·원본 effect/release/collector·clock 제공물이 올 때 adapter를 재개한다. 시간창 UTC 정밀도는 기존 PR60 구현을 재작성하지 않는다. AI/동의는 확정 추가 범위에 남지만 승인되지 않은 저장 schema/provider·동의/보존 경계를 임의 도입하지 않는다. 범위를 새로 축소하거나 기능을 추가하지 않는다.

> 2026-11-01 PR62 통합 동기화: PR52가 병합된 **10ab6026f1cf7d244a75ee529830afb8bcf6b8c8**을 기존 PR62에 이력 보존 merge로 반영한다. 아래 #49~#52 및 #62의 기준 SHA·Draft/미병합·시험 수치는 각 개발 당시 기록이며 현재 상태나 실제 제품 수용 완료를 뜻하지 않는다. 수동 충돌 해결은 이 작업카드 1파일이다. #62 제품1·시험2파일은 원래 **8ceaf5c2f37a6e9823f5e587d0b2d129fb8f26fd**의 blob을 유지하고 #63·Content·다른 Worktree는 변경하지 않는다.

- 통합 영향 검증: Statistics/AdditionalSettings/DailyUsagePanel/RuntimeDeliveryPanel/Settings/SiteTimeStatus/SDK 7파일 **48 PASS**、TypeScript/Vite build PASS。Web은 jsdom/모의 HTTP이며 제품 수용이 아니다. 기존 #62 제품1·시험2 blob 동일성과 나머지 경로의 incoming 통합본 동일성을 확인했다. 변경 없는 Server 생산·계약·DB schema/의존성에 근거해 기존 격리 MySQL24 결과를 재사용하고 서비스/DB·전체 회귀를 불필요하게 재기동하지 않는다. 로컬 근거 `.local/pr62-sync-20261101/`, 새 HEAD의 원격 CI는 PR62 본문/로컬 result에 기록한다.
- 과거 독립 리뷰3/3·승인은 내용이 동일한 영역의 근거로만 재사용하며 새 SHA 승인으로 소급하지 않는다. 기존 Core4파일 legacy-lock FAIL과 실제 producer BLOCKED 조건을 보존한다. 실제 Core/Content/Chrome/Native 수용 NOT_RUN, `MVP_FINAL_COMPLETE=false`. Approve·Draft 해제·PR Merge는 하지 않는다.

## 야간 후속 실질 재점검 · Statistics 조회 근거 거절 — 2026-11-01

- 담당 김다훈 Web·Server·DB·UI, 기존 Worktree 재사용. 브랜치 `fix/additional-mvp-statistics-provenance`, 기준 integration **24327d1bd8615a2274a6dead43f23b71cc06b64e**. PR51 HEAD11f50b7984f045bae2c95dee4d3c1609c3053467·PR52 HEADc2aa82f7319286db643550230abb5bcf6a08c9d2는 실제 Draft·미병합이므로 #52의 선행 반영을 하지 않았다. 기존 UTC 수정 PR60 HEAD59395aaf571a10106d6b7cb77b9c0fbcb569d0ea도 보존했고 이 후속은 #51/#52/#60에 의존하지 않는다. 새 Worktree/설치/producer/예약은 만들지 않았다.
- 확인된 독립 결함: 기존 `BrowserUsageStatistics.parseUsage`는 RC2 Statistics의 필수 `as_of`를 확인하지 않았다. 시각 누락/숫자/null/잘못된 날짜/UTC 밀리초 형식 불일치 응답도 확정량과 함께 표시됐다. **신규9 반례 수정 전 FAIL(기존3 PASS) → 수정 후 PASS**. 기존 응답 소비자에서 유효한 UTC 밀리초 형식과 실제 날짜의 round-trip을 확인한다. 이전 결과를 지우고 오류를 표시하며, 유효한 명시적 GET 재조회에서만 결과를 다시 표시한다. 새 API·조회 화면·시계/효과 authority·가짜 producer는 없다.
- 기준 문서: RC2 `contracts/additional-mvp/rc1/schema.json#/$defs/Statistics`(as_of 필수·UTC), `docs/design/additional-mvp-contracts/05_Content_Event_UI.md`(quality/as_of·미확인0 금지), 기존 STA-01과 `BrowserUsageStatistics`/`AdditionalUsageStatistics`/`AdditionalStatisticsApi`를 재사용한다. 이 UI 검사는 응답 형식 확인일 뿐 실제 clock 신뢰·수집 완료 증거를 부여하지 않는다.
- 새 검증: BrowserUsageStatistics12 + AdditionalSettings5 + DailyUsagePanel8 + RuntimeDeliveryPanel5 = **30 PASS**, TypeScript/Vite build PASS. Web은 jsdom/모의 SDK이다. 기존 Server `AdditionalConfigMysqlTest`16 + ConfigContract6 + 신규 StatisticsContract2 = **24 PASS**, 실패/오류/스킵0. fresh MySQL8.4.8 port33417 / `.local/amvp-mysql-1a46563ec09b` 정상 종료. 기존 인증/소유권/통계·격리/중복·재시작/HTTP 시험을 재사용 실행했으며 이번 UI와 결합된 실제 Chrome/TCP 전체 시연은 아니다. admission/usage fixture는 합성이며 생산 capability를 발급하지 않는다. 로그 `.local/statistics-provenance-20261101/` 및 해당 fresh DB tests.log. Server 생산·RC2/api.ts/legacy-lock·DB schema·Core/Content/Shorts·의존성은 기준과 동일하게 보존한다.

### 확정 기능별 실제 남은 범위 — 파일 존재/초기 작업카드의 미착수 문구만으로 판정하지 않음

| 기능 | 실제 코드/현재 상태 | 재개 경계 |
|---|---|---|
| SITE_TIME 저장·조회·version·삭제/해제 상태 | `AdditionalConfigStore`, `AmvpPolicyPublisher`, `AmvpDeletedPolicyRelease`, `AmvpOperationApi`, `AdditionalSettings`/삭제 패널: 구현·자동/격리 검증. #51 단일 정책 상태 화면은 미병합 | 제품 config-api flag와 실제 CapabilitySource/issued binding·effect/release verifier 없이 제품 CRUD·효과 시연 BLOCKED. 접수/PENDING을 해제로 바꾸지 않음 |
| 이용시간·일일 한도·과거 삭제 정책 | `AmvpUsageReceiver`, `AmvpRegisteredClockProof`, `AmvpDailyUsage`, `AdditionalUsageStatistics`, DailyUsagePanel: 수신/격리/집계/조회 구현·검증 | Core collector·신뢰 anchor·ClockedUsageSegment/day allocation/day-carry·한도 집행 필요. 확인된 양/미확인·quota·실제 집행을 분리 |
| 예약 WEEKLY/occurrence·과거 버전 | `AmvpScheduleBridge/Api`, ScheduleExecutionPanel: 설정과 기존 actor/Receipt 수신·고정 종료 조회 경계 구현·검증 | 실제 Core actor/claim·효과/복원 proof 공급 필요. ONCE actor 매핑은 공동 결정 대기이며 SITE_TIME의 ONCE 시간창 저장과 다름 |
| CADENCE·PAUSE/RESUME | `AmvpCadenceControl/Admission/Api`, useCadenceControl/CadenceSettingsSummary: 설정·frozen Snapshot/Attachment·상태 경계 구현·검증 | 실제 Authority/CADENCE producer·정당한 END/복원 필요. 휴식 단계/주기 표현 공동 결정 대기. PAUSED를 휴식으로 추정하지 않음 |
| YouTube10/Instagram6·keyword/adult/blur 설정 | AdditionalSettings/HostScopeEditor·기존 ContentConfig 계약에 저장/조회 구현·검증 | Core·Content 기능별 실제 producer/issued scope·artifact/model·효과/복원 공급 대기. 16 설정 저장이 16 효과 완료는 아님 |
| 과거 접근·반복·기본 통계·메모 | 기존 MemberReadModel/MemberMetrics/MemberSessionNotes·MemberApp/SessionNote 구현 재사용. 추가 브라우저 총량 STA-01도 구현됨 | 새 AMVP event issuer·실제 collector 자료가 필요. 기존 회원 기본 통계 성공을 추가 측정/기능 전체 수용으로 확대하지 않음 |
| 시간대별 패턴·확장 분석(OPTION-08) | **Web·Server 실제 미구현**: MemberApp의 AccessPattern은 안내 문구, `/statistics/hourly`/`statistics/usage` 생산 controller 없음 | API-STAT-03의 '24개 Metrics'와 기존 잠금 MemberMetrics/MemberReadApi 경계, KST/원장 시간대·구간 coverage·미수집 시간대 null의 구체 형상을 통합/설계 담당과 확인 후 별도 구현. 기존 STA-01 총량/DAY-01로 대체 완료 처리 금지 |
| AI 피드백/동의(OPTION-12) | **Web·Server 실제 미구현**: `/analysis-jobs`, `/analysis-consent` 생산 경로·analysis_jobs/results/consents migration/화면 없음 | 기존 API-AI-01~04·AnalysisJob 상세 설계는 있으나 현재 DB schema 보존 범위 밖의 저장 도입과 동의/provider·입력집계/보존 경계 확정 필요. 원문 URL 내보내기·provider·가짜 성공/결과를 임의 추가하지 않음 |
| RuntimeReport/Receipt·실제 효과·삭제/복원 | AmvpReportReceiver/Api·RuntimeDeliveryPanel·DeletedConfigReleasePanel 구현·검증, 저장 접수/실제 효과 분리 | Core53 국소 snapshot 및 Content58/61 local_only 관찰을 APPLIED/RELEASED로 승격하지 않음. Core issued provenance/원본 증거 조회·전송 필요 |
| 로딩·실패·UNKNOWN·재진입 | 기존 #35/#37/#41/#49/#50 구현·검증, #52 Settings 구분은 미병합. 이번 수정은 별도 Statistics 응답 근거 결함 | 실제 Chrome 시각/키보드·Core/Native END/복원·재기동 수용은 NOT_RUN. #51 병합 확인 때만 #52 동기화 |

- **다음 우선순위:** 검증된 독립 결함 수정의 리뷰/통합, #51 이후 #52 동기화. 별도 기능 작업은 시간대별 분석의 기존 Metrics/날짜/coverage 경계와 AI의 schema/동의/provider 경계를 확인한 뒤 착수한다. 실제 SITE_TIME adapter는 Core의 발행 capability/원본 effect·release 증거/clock/day 제공물을 받아 기존 Server 인터페이스에 결속한다. 미제공 정보를 만들거나 기능을 다시 구현하지 않는다.
- **11월11일 시연 판정:** 설정·조회·오류/UNKNOWN·과거 데이터 표시 흐름은 자동/격리 검증 범위에서 준비됐다. 실제 제품은 admission/capability 및 producer·별도 실제 수용 없이는 설정 저장부터 BLOCKED일 수 있다. 한도 집행/예약/CADENCE/Content 효과·정상 END/복원·재기동·확장 분석·AI 시연 완료는 선언할 수 없다. Core 잠금4파일의 기준 legacy-lock FAIL은 이번 수정과 독립적으로 보존하며 hash 갱신으로 통과시키지 않는다. 실제 Core/Content/Chrome/Native 수용 NOT_RUN, `MVP_FINAL_COMPLETE=false`.


> 2026-11-01 PR52 통합 동기화: PR51 병합 Commit **c44c87215fddee49114151aaf22caa8b3a679b21**을 기존 PR52에 이력 보존 merge로 반영한다. 아래 PR49~52의 Draft/미병합/검증 수치는 각 개발 당시 기록이며 현재 병합 상태·제품 수용 완료를 뜻하지 않는다. 수동 충돌 해결은 이 작업카드 1파일이고 Settings 제품·시험은 원래 PR52 blob을 유지한다. #62/#63·Content PR·다른 Worktree는 변경하지 않는다.

- 동기화 검증: 원래 PR52 **c2aa82f7319286db643550230abb5bcf6a08c9d2**의 `Settings.tsx` blob **b256087913f116e4587d40efedf5d1bad00e9928**, `Settings.test.tsx` blob **87175ce472dd5b67376d199ecf0e78587bfc64a9**와 정확히 일치한다. 양측 작업카드의 전체 원문이 병합 결과에서 순서대로 보존됨을 확인했고, 이 카드와 Settings2파일 외의 모든 파일은 incoming c44c872의 blob과 같다. 최신 base 대비 자체 diff는 기존3파일뿐이다.
- Settings/AdditionalSettings/SiteTimeStatus/SDK/RuntimeDelivery 직접 영향5파일 **28 PASS**, TypeScript/Vite build PASS. 최초 로딩·실패·실제 빈 목록 구분, 편집 입력/DOM 보존, 실패 뒤 재조회 대기·성공, SITE_TIME 정책/설치·version·날짜·지연 응답을 확인했다. Web은 jsdom/모의 HTTP이며 실제 제품 수용은 아니다. 로컬 전체 Web/Server·MySQL을 불필요하게 재실행하지 않고, incoming과 동일한 관련 소스/계약/의존성의 유효 검증을 재사용한다. 새 HEAD CI는 PR52 본문과 `.local/pr52-sync-20261101/` 원본 기록으로 확인한다.
- 원래 검토의 Settings2파일 내용과 기존 시험 근거는 재사용할 수 있으나 과거 승인을 새 merge SHA 승인으로 소급하지 않는다. 기존 통합의 Core4파일 legacy-lock FAIL은 해결된 것으로 표시하지 않으며 이번 동기화에서 잠금 해시/검사를 변경하지 않는다. 실제 Core/Content/Chrome/Native 제품 수용 NOT_RUN, `MVP_FINAL_COMPLETE=false`. Draft 해제·Approve·PR Merge는 하지 않는다.

## 11월11일 시연 경계 점검·설치 조회 상태 수정 — Web 독립 수정 (2026-10-31)

- 시작 기준 integration **467fe18b176ccd571813d04229e8ee69f19a00d2**. 기존 clean Web Worktree를 재사용하고 `fix/additional-mvp-connection-status`로 분리했다. 리뷰 중 PR49 **037e0498ff648409a677c8d2900951bc33ca1e8d**, PR50 **075e9b12ff30c0610a280dac47149cc651765275**, PR51 **74c151a45817c061c237ac8adb965e0b620fc1dc**의 HEAD/파일/리뷰를 보존한다. 이 후속은 세 PR에 의존하지 않는다. 새 Worktree·설치·자동화·producer는 없다.
- 확인된 독립 결함: Settings는 설치 목록/현재 세션 조회가 끝나기 전에도 빈 배열로 AdditionalSettings를 렌더링하여 **조회 중/실패를 "연결된 회원 설치가 없습니다"로 오인**시켰다. 이전 조회가 성공한 뒤 재조회에 실패해도 과거 추가 설정 편집 화면이 계속 노출됐다. 네트워크/서버 실패를 실제 빈 목록으로 처리하지 않는다.
- 최소 수정은 Settings의 표시 경계뿐이다. 최초 조회 완료 전 로딩/실패를 표시하고, 이후 실패 시 기존 편집 화면을 hidden/inert 상태로 유지한다. 재조회 시작 때 오류 문자열이 지워져도 성공 응답 전까지 다시 노출하지 않는다. 첫 성공 이후 자식을 unmount하지 않으므로 입력·기존 멱등 요청 참조를 버리지 않는다. 동일 설치 재확인 후 입력이 유지되는 반례로 검증한다. 새 화면/디자인/인증/API/DB/기능 활성화 조건 변경은 없다.
- 신규 반례 **수정 전3 FAIL → 수정 후3 PASS**, 기존 Settings4를 포함한 **7 PASS**. 실제 SDK/fetch 모의 HTTP로 초기 응답 대기→실제 빈 목록, non-retryable503, 기존 편집값→조회 실패→재조회 대기→성공/입력 유지(GET-only)를 확인했다. 초안 시험의 단순 network throw는 기존 SDK의 정상 backoff 때문에 1초 assertion timeout이 났으므로, API 의미에 맞는 non-retryable503으로 조건을 고정한 최종 수정 전 로그를 사용한다. SDK retry/보안 계약을 바꾸지 않았다.
- 추가 읽기 전용 동작 점검 **3 PASS**: PUT 성공 후 확인 GET 유실 시 같은 key/본문/ID 재사용, 412 version 충돌에서 자동 재저장 없이 현재 revision 재조회, 페이지 재진입 UNKNOWN 보존·조회 실패 시 과거 APPLIED 표시 제거. 기존 AdditionalSettings/SDK를 실제로 통과하는 jsdom 시험이며 제품 코드를 수정할 결함은 없었다. 이 점검 파일/로그는 ignored `.local`에만 보존하며 새 모의 Core producer가 아니다.
- 전체 Web **301 PASS = 통합 기준298 + 신규3**, TypeScript/Vite build PASS. 결과는 `.local/demo-flow-20261031/web-all.log`, `build.log`; 반례 `settings-before-final.log`, `settings-after.log`; 보조 점검 `write-reentry-audit.log`. 물리 브라우저 렌더·키보드/시각 수용·새로고침은 NOT_RUN. Server/RC2/api.ts/legacy-lock/의존성과 Core·Content·Shorts가 동일하므로 기존 유효한 Server/MySQL/계약 증거를 재사용하고 서비스/DB를 불필요하게 다시 기동하지 않는다.

### 시연 범위와 실제 연결 조건

| 흐름 | 확인된 범위 / 11월11일 전 남은 조건 |
|---|---|
| Light/Dark·설정 진입·설치 로딩/빈 상태·오류/재조회 | UI 구현·자동 시험. 실제 시연 브라우저에서 화면/탐색/키보드 확인은 별도 필요 |
| CONTENT 16옵션/키워드·성인·블러, SITE_TIME 한도/시간창, WEEKLY/CADENCE 설정 저장·조회 | 기존 Web/격리 HTTP·DB 증거 재사용. 제품 CFG API는 config-api.enabled와 유효 Admission/capability를 요구한다. 공개 통합본에는 실제 CapabilitySource가 없어 **실제 제품 CRUD 시연 BLOCKED**. 플래그만 켜거나 성공 fixture를 주입해 실제 저장/적용 시연으로 표시하지 않음 |
| 저장/적용 대기·UNKNOWN·삭제/해제·재진입 | 기존 원장/Receipt/조회 UI·자동/격리 시험. 실제 APPLIED/RELEASED는 실제 EvidenceVerifier와 원본 보고가 필요. PR49/50/51의 조회 개선은 리뷰 중이며 병합/제품 수용 완료로 처리하지 않음 |
| 일일 이용시간·한도·과거 기록 | API/집계/표시 구현. 실제 collector/ClockedUsageSegment·trusted anchor/day allocation/carry가 없으면 404/503/QUARANTINED/UNKNOWN 유지. 가짜0/잔여량/실제 차단 성공을 만들지 않음 |
| 예약 실행·CADENCE 단계·정상 END/복원/재기동 | 실제 Actor/Authority·ACK/해제/복원 증거와 별도 승인된 Chrome/Native 수용 필요. 저장된 예약/반복 설정을 실제 실행으로 표시하지 않음 |

- 인터페이스 수신 후 첫 연결은 기존 `CapabilitySource.verifiedSelection/verifyContentProfiles` → SITE_TIME PKG-01 → `EvidenceVerifier.verify`/RPT-01 → CFG02 → `ClockProof.verify`/USG-01/DAY-01 → 실제 release/CFG02 순서다. 원본 증거의 owner/executor/epoch·issued operation/package/revision·현재 generation/footprint·clock/boot/day-chain 등록/검증 경로를 받아 기존 adapter에만 결속한다. DOM 기능은 Content가 문서/탐색 세대별 적용·복원/영속 Receipt를 Core에 제공해야 하며 SITE_TIME DNR만을 위해 Content 작업을 추가하지 않는다.
- ONCE actor 매핑, CADENCE 휴식/주기 표현, USG-02 NOT_RECEIVED hash는 공동 결정 대기를 유지한다. 기존 UNKNOWN·HOLD·실패 증거/운영 DB/프로필·Credential을 변경하지 않는다. 실제 제품 기능 시연·Core/Content/Chrome/Native 수용은 **NOT_RUN/BLOCKED**이며 `MVP_FINAL_COMPLETE=false`.
> 2026-10-31 PR51 통합 동기화: **c56ccf7039b0e23f132650d9e51347ed1d607cc2**의 PR49·PR50 기록과 아래 PR51 원래 개발 기록을 모두 보존했다. 아래 Draft/미병합/기준 SHA는 각 개발 당시의 이력이다. 수동 충돌 해결은 이 작업카드 한 파일이며, 기존 PR51 기능 코드와 통합된 Core53 코드는 수정하지 않았다.

- 동기화 영향 검증: #51 집중3파일 **16 PASS**, 누적 전체 Web **319 PASS**(#49·#50·#51 포함), TypeScript/Vite build PASS. 원래 #51 소스/시험6파일의 Git blob과 통합에서 가져온 나머지 파일의 blob 동일성을 확인했다. 최신 통합 대비 Server·DB schema·RC2·legacy-lock/api.ts·Core/Content/Shorts·의존성 변경은 없으므로 기존 유효한 관련 검증을 재사용한다. 별도 Server/MySQL/제품 서비스를 기동하지 않았다. 로컬 근거 `.local/pr51-sync-20261031/`. 실제 Core/Content/Chrome/Native 수용은 NOT_RUN이며 Draft 해제/Approve/Merge는 하지 않는다.

## SITE_TIME 단일 정책 조회 연결 — Web 구현·합성 검증, 실제 producer BLOCKED (2026-10-31)

- 김다훈 후속 개발. 시작 통합 `467fe18b176ccd571813d04229e8ee69f19a00d2`, 브랜치 `feature/additional-mvp-site-time-status`. clean 기존 Web Worktree를 재사용해 새 기능 브랜치로 분리했다. PR49 `037e0498ff648409a677c8d2900951bc33ca1e8d`와 PR50 `075e9b12ff30c0610a280dac47149cc651765275` 및 PR50 작업 공간은 그대로 보존한다. 두 PR의 미병합 코드를 가져오지 않는다.
- 기존 설정 적용 상태 목록에서 SITE_TIME 한 정책을 명시적으로 선택하면 CFG02 GET → DAY-01 GET → CFG02 GET을 연결한다. 현재 서버 적용/해제 projection, 해당 policy_id의 과거 사용량/당시 한도를 함께 보되 서로의 성공 증거로 사용하지 않는다. 현재 실행·최신 잔여 한도·원본 effect를 Web에서 만들지 않는다. 기존 Panel/버튼/날짜 입력과 UI 계층을 재사용하며 새 화면·계약·API·DB schema는 없다.
- 조회 중 version/saved_runtime_revision/deleted_at이 바뀌면 결과를 버리고 명시 재조회를 요구한다. config ID/executor/정규 SITE_TIME value의 policy_id/version 및 DAY-01의 기존 날짜/owner 식별 검증을 재사용한다. 이후 package가 동일 config version을 운반한 경우의 실제 적용 projection은 최신 CFG02 결과를 쓰며 과거 usage의 revision으로 전용하지 않는다. 조회 시점이 서로 다르므로 원자 Server snapshot 또는 최신 실제 효과라고 주장하지 않는다.
- 이미 알고 있는 정책이 첫 CFG02부터 tombstone이면 기존 서버 해제 projection을 표시할 수 있다. DAY-01 404/503은 검증 자료 없음으로 보존하며 0·이용 가능·해제 성공으로 바꾸지 않는다. 인증/다른 신원/불일치/통신 실패는 전체 결과를 숨기고 오류·재시도를 제공한다. 설치/정책/설정 version/날짜/재조회 key와 abort/disposed로 지연 응답과 이전 성공을 제거한다.
- PR49의 삭제 목록 재발견/예약 재진입과 PR50의 OP-01 Receipt/CADENCE 기한 UI는 수정·중복 구현하지 않는다. 이번 연결은 알려진 SITE_TIME ID의 현재 CFG02/DAY-01 재조회에 한정한다. 정책 저장/삭제, START/END/APPLY/RELEASE, collector/clock 발급 호출은 하지 않는다.

### 실행 검증과 보존

- Windows Node24.19.0/Vitest5.0.3/jsdom: 직접 영향 3파일16/16 PASS(신규11+기존 상태 패널5), 전체 Web309/309 PASS(기준298+신규11), TypeScript/Vite build PASS. getter 실제 SDK를 통과하는 모의 HTTP에서 GET3회/본문 없음, 중간 version/revision/삭제 변경 거절, 다른 policy/설치/잘못된 value version 거절, 인증 만료, 404/503, 사용량→적용 오판정 방지, 명시 선택·설치 전환/지연 응답·재조회 실패·재시도를 확인했다. 테스트 건수를 제품 완료율로 환산하지 않는다.
- 로컬 근거 `.local/site-time-status-20261031/`의 focused-final.log/web-all.log/build.log. 첫 focused.log는 `--root frontend`와 중복 config 경로를 함께 준 실행기 오류(frontend/frontend)이며 수정 후 같은 소스에서 위 검증을 실행했다. 최초 로그도 보존했다. Server 생산·계약·api.ts/legacy-lock·package/lock·Core/Content/Shorts 변경 없음. 따라서 기존 Server/RC2 PASS를 재사용하고 새 MySQL/HTTP 서비스나 전체 Server 회귀는 시작하지 않았다. 원격 CI/PR은 게시 결과를 기준으로 기록한다.
- 실제 Chrome/Native·Core 효과/collector·정상 END/복원/재기동·Light/Dark 브라우저 시각 수용은 NOT_RUN. Figma 새 레이아웃을 만들지 않았다. 운영 DB/기존 실패 환경/자동화와 타 Worktree/index를 변경하지 않는다. `MVP_FINAL_COMPLETE=false`.

### 실제 SITE_TIME 하나를 연결하기 위해 필요한 외부 제공물 — 기존 인터페이스 요청 규격

이 표는 기존 Java/RC2 경계에 결속할 제공물을 요청하는 것이며 새 Wire/공용 API를 확정하지 않는다. 담당자의 원본 근거 없이 성공 bean·등록 자료·동등성을 생성하지 않는다. 전달은 별도 팀 공유 시 수행하며 이번 작업에서 메시지를 대신 발송하지 않는다.

| 담당/경계 | 받아야 할 정확한 제공물 | 소비 경로·거절 조건 |
|---|---|---|
| 윤종민 / capability | 실제 producer 기준 SHA, 구현 파일·symbol·조회/검증 signature, `CapabilitySource.verifiedSelection(Identity, Binding, stream)` 및 `verifyContentProfiles(Binding, JsonNode, selection)`에 결속 가능한 검증 경로. 현재 executor/owner_binding/owner_epoch와 capability_receipt_id·artifact hash/verification_ref·selected·expires_at의 원본 등록 근거 | 기존 PKG-01/publisher/receipt. stored LINKED나 UUID·최신 소스 존재만으로 유효 capability로 간주하지 않음. 실제 provider/등록 writer 미제공으로 BLOCKED |
| 윤종민 (+DOM 효과 필요 시 채지민) / 적용·해제 | `EvidenceVerifier.verify(Identity, Binding, report, issuedPackage, predecessor)`의 실제 구현 또는 결속 가능한 원본 조회/검증 경로. RuntimeReport의 report_id/report_epoch/report_seq, runtime_execution_id, operation_id, package_id/runtime_revision, state/reason, evidence_sha256/observed_at/payload_sha256를 정확한 owner·issued operation·generation/현재 document와 결속해야 함. 제거 정책은 이전 policy/version/footprint·다른 owner claim 유지·실제 마지막 해제/미해소 의무 근거를 함께 제공 | 기존 RPT-01 `/api/v1/amvp/reports/batch` → immutable report/Receipt → CFG02 projection. ACK/국소 OBSERVED·해제 요청/패키지에서 사라짐만으로 APPLIED/RELEASED를 만들지 않음. runtimeReport 및 proof lookup/검증 미제공으로 BLOCKED |
| 윤종민 / collector·clock | 실제 collector/outbox 기준 SHA·호출 위치, RC2 ClockedUsageSegment 및 ClockMetadata의 원본 생성/재시도 자료. owner/executor·collector_epoch/local_usage_seq/previous_segment_sha256, package/revision·policy_attributions, start/end/confirmed/uncertain, timezone/version·day boundaries/chain, focus_ref·payload hash. clock_epoch/boot_id/anchor_id/anchor_utc/anchor_mono_ms/mono start·end/quality/observed wall 시작·끝, 그리고 trusted anchor 등록 writer·재시작·day carry 검증 경로와 승인 skew profile 제공 필요 | 기존 USG-01 `/api/v1/amvp/usage/batch`, `ClockProof.verify(Identity, Binding, segment, predecessorHash)` 및 AmvpRegisteredClockProof. anchor 원본 등록·부팅/시계 변경/day allocation/carry 미확인은 QUARANTINED/UNKNOWN 유지. HTTP 수신으로 COUNTED를 만들지 않음. 실제 producer 미제공으로 BLOCKED |

- 최소 연결 순서: 승인된 capability/owner 기준 확정 → 같은 SITE_TIME package의 실제 적용 보고/CFG02 확인 → 같은 policy/clock에 결속된 segment 수신·DAY-01 확인 → 동일 이전 footprint의 해제 보고/CFG02 확인 → 기존 원장/Receipt/사용량 보존 확인. 설치·세션·서비스 활성화/실제 Chrome 재시도는 별도 승인 범위에서만 진행한다.
- ONCE legacy actor 매핑, CADENCE 휴식/현재 단계·주기 표현, USG-02 NOT_RECEIVED hash는 공동 결정 필요를 유지한다. 이번 Web 조회를 위한 임의 fallback·새 필드·hash sentinel·REST 상태나 시간 계산을 추가하지 않았다. 나머지 독립 Web 개발 전체를 이 BLOCKED에 묶지 않는다.

> 2026-10-31 PR50 통합 동기화: PR49가 병합된 **df2e3927eced366ddb8a9bf007acff4f40acb32e**를 반영하고 양쪽 개발·검증 기록을 보존했다. 아래 Draft/기준 SHA 표기는 각 원래 개발 시점의 이력이다. 이번 수동 충돌 해결은 시험 API 두 등록 유지와 이 기록 병합에 한정한다.

- 동기화 검증: 실제 loopback HTTP/격리 MySQL8.4.8 삭제·해제/OP **38 PASS**(삭제37+API1), 일일 기록 **12 PASS**(DB10+API2), 실패/오류/스킵0. 두 고유 시험 DB는 소유권 확인 후 정상 종료했다. Web **308 PASS**(#49·#50 기능 합산 기준), 타입/Vite·Server package 빌드 PASS. Server package 단계는 테스트를 생략했으며 위 50건은 앞선 별도 실행 결과다. 소스 동일한 CADENCE19·Server 단위82·RC2/legacy-lock266·독립 리뷰5/5를 재사용한다. 로컬 근거 `.local/pr50-sync-20261031/`, DB `bed47ee9d539`/`54b4ee2a356a`. 실제 Chrome/Native/Core/Content 수용은 NOT_RUN이며 Draft 해제/PR Merge는 하지 않는다.

## 삭제 OP-01 조회·CADENCE 종료 기한 연결 — 자동/격리 PASS, 실제 producer BLOCKED (2026-10-31)

- 실제 통합 HEAD **dfa787f07d02b54366a69f107c1edfa058cb8b2a**(PR41/43 포함)를 확인했다. 기존 clean Worktree에서 `feature/additional-mvp-operation-status`로 분리했다. PR49는 Draft·HEAD **037e0498ff648409a677c8d2900951bc33ca1e8d** 그대로이며 삭제 정책 이용시간/예약 재진입 구현을 가져오거나 수정하지 않았다. 이번 후속은 PR49에 의존하지 않는다.
- 기존 코드의 두 미연결 경계만 구현했다. 새 계약·DB migration·producer·진단기·설치/Worktree를 만들지 않았다. Core/Content/Shorts·제품 api.ts/legacy-lock·기존 실패 환경·Credential·다른 작업 index는 보존한다. Merge/Approve·실제 Chrome/Native·제품 활성화는 하지 않는다.

### SITE_TIME 해제 작업과 기존 원장 연결

- RC2 `api.json`의 **OP-01 GET /api/v1/amvp/operations/{operation_id}**를 기존 config DELETE 의무에 한정해 구현했다. 본문/query 없음, W/E 인증·정상 채널·현재 설치/ACTIVE owner binding·기존 admission 확인, no-store. 다른 소유자/폐기 binding은404, 다른 stream/미지원 작업은 `UNSUPPORTED_CONTRACT`, proof provider 부재는503을 유지한다. PUT/USG-02의 OP 조회 지원을 주장하지 않는다.
- `amvp_operations`·기존 `deletionReceipt`·불변 tombstone/hash·`AmvpReportReceiver.projection`을 재사용한다. DB의 저장 접수 `CONFIRMED`와 응답의 실제 효과 확인을 구분한다. SITE_TIME 현재 해제 투영이 검증된 경우에만 OP `CONFIRMED`/true, 미확정은 `IN_DOUBT`/false, 나머지는 `RELEASE_PENDING`/false. RC2 reference model의 `actual_effect_confirmed == (state == CONFIRMED)`를 유지한다.
- 조회는 기존 DELETE ACK/response cache/설정/outbox를 쓰지 않는다. 원본 ACK는 이후에도 RELEASE_PENDING으로 보존하고 만료 cache를 소급 생성하지 않는다. Web은 삭제 응답의 operation_id를 보존하고 OP와 기존 CFG02를 모두 읽는다. 불일치/조회 실패는 성공·빈 의무로 바꾸지 않고, 기존 서버 삭제 목록 기반 새로고침 복원도 유지한다. Content/CADENCE 의무를 SITE_TIME 해제로 해소하지 않는다.

### CADENCE 기존 deadline_at UI 연결

- 확정된 nullable UTC `deadline_at`이 Server/Schema에 있지만 편집·요약 UI에는 없었다. 기존 설정 편집기에 선택적 종료 기한 입력/지우기와 요약 표시만 추가했다. 밀리초와 명시적 null을 보존하며 예약 actor/휴식 단계/주기 계산을 만들지 않는다.
- 기존 Server 저장/조회·frozen 정의 경계를 그대로 사용한다. 설정의 종료 기한을 변경해도 현재 실행의 Snapshot/Attachment/반복 정의는 바뀌지 않으며 PAUSE/RESUME도 최초 값을 유지한다. RuntimePackage에 CADENCE를 추가하지 않았다.

### 검증과 한계

- Web **304 PASS = 통합 기준298 + OP SDK3/해제 패널2/기한 설정1**, TypeScript/Vite build PASS. OP의 잘못된 ID·상태/효과 불일치·조회 실패, 기존 해제 기록·설치 변경/지연 응답 회귀, 기한 UTC 저장/지우기를 확인했다. jsdom/모의 API이며 물리 브라우저 수용은 아니다.
- Server 단위 **82 PASS = 기존81 + OP API1**, JAR verify/build PASS. RC2/legacy-lock **266 PASS**를 이번에 새로 실행했다. 기존 공유 계약·api.ts·원본 잠금 해시는 변경하지 않았다.
- 격리 MySQL8.4.8 삭제/해제 **37 PASS = 기존34 + OP3**. 기존 실제 loopback TCP 시험에도 OP 대기→UNKNOWN→검증된 해제 조회/no-store를 연결했다. owner/다른 stream/잘못된 hash·원본 ACK·읽기 무변경·cache 만료도 확인했다. 최초 시험에서 폐기 owner가 후속 admission까지 도달해 거절 분류가 달랐으므로 조회의 ACTIVE/nonclosed binding 필터를 보강했고 동일 시험을 통과했다.
- 격리 CADENCE **19 PASS = 기존18 + 기한 변경/frozen 보존1**. 저장된 기한 변경 후 PAUSE/RESUME에서 원본 frozen 정의가 동일함을 확인했다. capability/effect/clock/actor 제공자는 **SYNTHETIC**이며 실제 Core 실행 성공으로 승격하지 않는다.
- 로컬 증거 `.local/operation-status-20261031/` 및 `.local/amvp-mysql-5c3829bbd317`(삭제/OP), `.local/amvp-mysql-1a92174d7a24`(CADENCE). 초기 실패 `.local/amvp-mysql-7f2d33fc78cc`도 보존했다. loopback33405/33407·정확한 datadir/PID 확인 후 두 시험 DB 정상 종료. 비밀을 포함할 수 있는 원본 시험 DB/로그는 게시하지 않는다.
- 현재 Core43은 순수 시각 helper이며 생산 capability/effect/release 검증·collector/clock anchor/day allocation·actor/Receipt 전송은 여전히 **BLOCKED**. Content의 session/document/generation별 실제 효과·복원 producer도 대기다. 원시 관측을 COUNTED/APPLIED/RELEASED로 바꾸지 않는다.
- 남은 독립 경계 점검: 무제한 SITE_TIME의 예산 없는 사용량 조회는 현재 DAY-01의 확정 budget/day-carry 모델만으로 보장되지 않는다. 0 한도·가짜 carry를 만들지 않는다. ONCE actor 매핑, CADENCE 휴식/주기 표현, USG-02 NOT_RECEIVED hash, 추가 설정 guest→member 매핑은 공동 결정 대기다. 반복 CRUD/진단 개발 대신, 실제 producer 기준 SHA와 원본 효과·해제/clock 증거 조회·검증·전송 인터페이스가 전달되면 기존 adapter에 결속하는 것이 다음 최소 작업이다.
- 11월11일 시연용 **저장/삭제 접수·대기/미확정/검증된 해제 조회와 반복 기한 설정 흐름**은 확장됐다. 실제 측정·차단·예약/CADENCE 실행·END/복원/재기동은 별도 생산 연결과 승인된 실제 수용 전까지 **NOT_RUN**. `MVP_FINAL_COMPLETE=false`.

## 사이트 시간·예약 기록의 실제 조회 연결 — UI/API PASS, 생산 효과 대기 (2026-10-31)

- 시작: clean 기존 Worktree, PR41 HEAD 보존. 최신 원격 integration **dfa787f07d02b54366a69f107c1edfa058cb8b2a**(PR41 및 Core43 병합 포함)에서 `feature/additional-mvp-usage-history` 분리. Core43은 순수 주간 예약 시각 helper이며 실제 actor/명령 전송 완료가 아니다. 승인 범위의 Web·Server 시험만 변경, 다른 담당 코드·실패 환경·운영 DB·Chrome/Native는 보존했다.
- **미구현 연결부1:** Server DAY-01은 삭제된 SITE_TIME의 과거 사용량을 읽지만 DailyUsagePanel은 활성 설정만 선택해 삭제 후 경로가 끊겼다. 기존 `listSiteTimeDeletions`와 `dailyUsage` API를 연결해 사용자가 삭제 정책 포함을 선택하면 서버에서 재발견·선택·일일 조회한다. 신규 API·schema·브라우저 영속 저장은 없다. 삭제 표식/버전과 과거 기록 안내, 당시 기록에 결속된 한도·부분 측정·현재 집행 미확인을 구분한다. 현재 설정이나 새 정책의 사용량으로 옮기지 않는다.
- 삭제 목록/이용시간 조회의 실패·재시도·설치 변경 지연 응답 폐기를 연결하고 실패를 0/빈 목록/이용 가능으로 바꾸지 않는다. 다른 정책을 선택할 수 있으며 목록을 새로 읽을 때 해당 정책을 찾지 못하면 과거 수치가 남지 않는다. 기존 Panel/Light/Dark·명시적 설치 선택·조회 날짜 UI를 재사용한다.
- **미구현 연결부2:** ScheduleExecutionPanel은 최초 진입에 활성 config만 조회하고 삭제된 예약은 버튼을 눌러야 발견했다. 이제 기존 owner-bound `scheduleHistoryIds`를 마운트/재진입에 읽고 현재 설정의 ID와 합쳐 중복 없이 occurrences를 조회한다. 설정 변경/삭제 후에도 최초 예약 버전·고정 종료·원래 세션 결과를 보존해 보여준다. 실패 시 이전 성공/빈 이력을 남기지 않는다. 예약 claim/START/END를 발행하지 않으며 ONCE나 CADENCE 상태를 발명하지 않는다.
- **Web 검증:** 변경된 DailyUsagePanel8+SDK3, ScheduleExecutionPanel7+SDK5 PASS; 전체 **302 PASS**, TypeScript/Vite build PASS. 삭제 정책 참조 없는 재마운트·선택·조회 실패/재시도·설치별 지연 응답, 예약 재마운트/삭제·이전 버전·UNKNOWN을 확인했다. jsdom/모의 API이며 실제 Chrome 제품 수용이 아니다.
- **격리 검증:** 기존 fresh MySQL runner와 PR41 loopback fixture 재사용, `AmvpDailyUsageMysqlTest10 + AmvpDailyUsageApiTest2 = 12 PASS`, 실패/오류/스킵0. 추가 TCP 시험은 실제 controller/auth/service/SQL로 삭제 목록 재발견→과거 일일 사용량을 읽고, 같은 host에 새 config ID를 등록해도 새 정책은404/원래5초·당시60초 한도 유지, 삭제 ID 재사용 거절, 다른 executor 거절, 조회 후 budget/Receipt 무변경을 검증한다. capability·clock 제공자는 SYNTHETIC이고 효과를 실제로 발생시키지 않았다.
- 최종 DB `.local/amvp-mysql-cf6158ca3d16`, loopback33401·소유 datadir 대조 후 정상 종료. 처음 runner 실행의 comma 인자 오류는 shell 호출 오류이며 DB 생성 전 거절되어 수정 후 실행했다. 로컬 근거 `.local/usage-history-20261031/`에 보존한다. 생산 DB/설치 Credential 복사는 없다.
- Server 단위81/JAR verify PASS. RC2 266 및 기존 주간 예약·CADENCE·Receipt 회귀의 유효 결과는 **변경 없는 Server 생산 소스/공통 계약/의존성**과 대조해 재사용한다. 이번에 모두 재실행한 것으로 집계하지 않는다. PR/CI/최종 SHA는 로컬 result와 후속 PR이 원본이다.
- **남은 범위:** 실제 collector→ClockedUsageSegment/anchor/day-carry 및 runtime 적용·해제 provider, 예약/CADENCE 실제 actor·명령/Receipt 전달, Content frozen/native/문서별 효과·복원이 미연결이다. 일일 조회는 검증된 자료/예산이 없으면404/503이며 0이나 최신 차단 상태를 만들지 않는다. ONCE 매핑·CADENCE 휴식/주기·USG-02 hash는 공동 결정 대기다. UI에서 설정 저장·과거 기록을 실제 정책 효과로 표시하지 않는다.
- **11월11일 영향/다음 최소 작업:** 삭제·재등록·재진입을 포함한 자료 조회 시연의 UI/API 흐름이 연결됐다. 실제 측정·한도 차단·예약/CADENCE·END/복원 시연은 producer 연결과 별도 실제 수용 전까지 완료가 아니다. 다음은 검증된 producer의 원본 증거 조회/전송 인터페이스로 SITE_TIME 한 정책을 연결하고 실제 효과·해제·재기동을 별도 승인 환경에서 검증하는 것. `MVP_FINAL_COMPLETE=false`.

## 야간 담당 경계 보완 — Web 수정·격리 TCP/DB PASS, 생산 producer BLOCKED (2026-10-30)

- T0 **2026-10-30 22:43:22 KST**, 상한 **2026-10-31 04:43:22 KST**. 상한까지 시간을 채우지 않는다. 종료 시각/최종 SHA/PR/CI는 `.local/night-boundary-20261030/session.json`과 후속 PR에 기록한다.
- 실제 원격 integration **8ba2502a9858c786066f0f2987dcfc604d8dccab** 확인 후 clean 기존 Worktree에서 `feature/additional-mvp-boundary-hardening`으로 분리. PR37/38 병합 포함이며 PR37 재구현/기존 리뷰 HEAD 변경 없음. PR34/38은 기반 모듈 통합이지 제품 실행 성공이 아니다.
- 확인 당시 Content33 a6468b6, 36 4dd1a73, 39 c70b837, 40 ba4a7e2는 모두 미병합. 공개 설명과 경계만 참고하고 가져오거나 활성화하지 않았다. Core/Content/Shorts 파일·실제 설치·Credential·다른 작업의 index/프로세스는 보존했다.

### 재현된 Web 결함과 최소 수정

- `configWrite`의 후속 GET은 설치·version·value만 검사해서 **같은 원문/버전인 다른 config ID**를 저장 확인으로 반환했다. 이미 있는 `readConfig(executor,id)`를 재사용해 ID까지 결속한다. 기존 PUT/DELETE 요청·멱등 키·인증/CSRF·제품 api.ts는 유지한다.
- active-only `listConfigs`가 tombstone을 받아들였고, terminal `next_cursor` 누락을 정상 종료로 처리했다. 빈 continuation도 한 번 더 요청했다. 명시적 terminal null·비어 있지 않은 continuation·active row·전체 cursor 중복 검사를 기존 삭제 목록과 같은 수준으로 유지한다. 실패를 빈 목록으로 바꾸지 않는다.
- 변경 전 신규 반례 **4 FAIL / 기존10 PASS**, 변경 후 해당14 PASS. 전체 Web **298 PASS**, TypeScript/Vite build PASS. 이 반례는 응답 처리 단위시험이며 과거 Chrome 실패의 원인으로 소급 확정하지 않는다.

### 격리 통합 경계 — 실제 TCP와 합성 제공자를 구분

- 기존 `AmvpDeletionHistoryMysqlTest`와 빈 격리 MySQL runner를 재사용. **34 PASS = 기존30 + 추가4**, 실패/오류/스킵0. 추가 범위는 ①실제 loopback HTTP+DB 재연결 ②삭제 발행 실패 rollback ③해제 projection 저장 실패 rollback ④미지원 focus_ref 수신 거절이다.
- test-source `AmvpLoopbackHttp`만 최소 Tomcat/MVC를 구성한다. 고정 의존성을 재사용하고 loopback·OS 동적 포트에만 bind, 요청 timeout, context/client 정상 종료. 생산 MemberAuth/controllers/services/SQL을 실제 `HttpClient` TCP로 호출한다. 제품 application bootstrap/메일/OAuth/Native는 실행하지 않는다. MockMvc 및 전체 배포 구성 시험과 구분한다.
- 실제 TCP: 무인증401·잘못된 query400 → PUT version2·패키지 revision2 → report 수신 → usage COUNTED/잘못된 anchor QUARANTINED → DELETE202 → 응답을 버린 뒤 **같은 키 재전송의 동일 JSON 의미/operation** → PENDING→UNKNOWN→검증된 해제 상태 조회. MySQL JSON key order는 원문 바이트 동일 조건이 아니며 canonical/내용을 대조한다.
- 시험 HTTP context 종료 후 새로운 DataSource/물리 연결·MemberAuth/transaction manager·HTTP context로 재조회하여 삭제 version3/해제 상태·원장·Receipt·usage2/report3 내용 보존을 확인했다. DB 프로세스 재시작/Chrome·Native 제품 재기동 시험은 아니다.
- capability/effect/clock provider는 **SYNTHETIC**이다. 실제 생산 증거 생성·수집이 아니며 원래 `CAPABILITY_NOT_VERIFIED` 및 focus_ref 미지원 거절을 제거하지 않았다. 저장 실패 주입은 소유 fresh 시험 DB에만 제한했고 rollback 후 원장/명령을 임의 삭제하지 않았다.
- 최종 DB `.local/amvp-mysql-4e59ab954740`, port33393·datadir/PID 확인 후 mysqladmin 정상 종료. 이전 실패 기록 `.local/amvp-mysql-d785504f7373`(시험 servlet 등록 누락), `8d161036f35e`(시험 JSON 필드 순서 가정)도 보존. 각 시험 서버 정상 종료. 종료된 포트33389의 PID0 관측은 프로세스 강제 종료 없이 새 비점유 시험 포트로 분리했다.
- Server 단위 **81 PASS**·JAR verify/build PASS. RC2 **266 PASS의 기존 결과 재사용**: 이번 변경은 Web 전용 API 소비자·test-source·작업카드뿐이며 contracts/api.ts/Extension 및 Server 생산 코드는 기준과 동일함을 diff로 확인한다. 공통 계약 시험을 다시 실행한 것으로 보고하지 않는다.

### 생산 연결 차단과 다음 정확한 작업

- 최신 Core38 `AdditionalTimeRuntime`은 `measurementQuality:'UNKNOWN'`, `requiresLimitedSiteHold:true`를 유지하고 원시 관측을 journal에 저장한다. `ClockedUsageSegment`/anchor/day allocation/Server outbox 및 제품 Worker 진입점은 미연결이다. 관측을 COUNTED로 변환하거나 Core 역할을 대신 구현하지 않는다.
- 생산 CapabilitySource·EvidenceVerifier·등록된 clock/재시작/day-carry·예약 Actor·CADENCE Authority/Receipt 전송이 공개된 이 기준에는 없다. 따라서 A의 실제 producer 연결은 BLOCKED이며 기본 성공 provider/중복 registry를 만들지 않는다.
- Content는 trusted caller·frozen/native scope·issued operation·영속 Receipt/문서별 복원과 연결 대기다. 국소 OBSERVED를 RuntimeReport/APPLIED/RELEASED로 승격하지 않는다. Core/Content 소유 수정은 각 담당에게 남긴다.
- ONCE actor 매핑, CADENCE 휴식/주기 표현, USG-02 NOT_RECEIVED hash는 공동 결정 대기. 확정 RC2 전체 승인을 다시 열지 않는다. 필요한 선택지는 아래 기존 카드 절을 재사용한다.
- 다음 최소 개발: 실제 producer의 기준 SHA와 **원본 증거 조회/검증 인터페이스**를 받은 뒤 SITE_TIME 한 정책의 package→실제 effect→report→삭제/release→UI를 기존 adapter에 결속한다. 해당 구현 전에는 물리 Chrome 수용·제품 기능 완료를 선언하지 않는다. `MVP_FINAL_COMPLETE=false`.

## SITE_TIME 삭제·해제 UI 재진입 복원 — Web/Server PASS · 실제 효과 NOT_RUN (2026-10-30)

- 김다훈 담당 후속. clean PR35 HEAD `bb865010d1eb7f972c16894022bbb823955cbf9f`를 보존하고 같은 Worktree의 별도 `feature/additional-mvp-deletion-history`에서 구현한다. PR35의 HEAD·리뷰·검증을 수정하지 않았다. 작업 중 통합 담당의 PR35 병합을 확인했으며 이 후속은 PR35에 의존한다. 직접 Merge/운영 DB·Core/Content·PR26·실패 설치/Chrome/Native는 변경하지 않는다.
- 기존 경계 확인: RC2 CFG01은 non-deleted 목록, CFG02와 OP01은 이미 알려진 ID가 필요하다. 새로고침으로 메모리 ID를 잃으면 기존 API만으로 삭제 요청을 발견할 수 없다. RC2 CFG01에 미정 query를 추가하거나 localStorage/guest 저장소에 회원 참조를 남기지 않는다.

### 최소 Web 읽기 계약 — RC2 원문 변경 없음

- **추가 경로** `GET /api/v1/amvp/web/site-time-deletions?executor_id=<uuid>&limit=1..100&cursor=<opaque>`; 기본 limit50. 본문/알 수 없는 query/중복 query를 거절한다. 현재 회원·설치·ACTIVE owner binding·기존 admission을 검증하며 W/E 기존 인증을 재사용한다. 배포 조건은 기존 config-api.enabled/profile이며 실제 활성화는 이 작업에서 하지 않는다.
- 응답200: `{read_model:"AMVP_SITE_TIME_DELETIONS_1",items:ConfigRecord[],next_cursor:string|null,has_more:boolean}`, `Cache-Control:no-store`. ConfigRecord와 실제 적용 상태는 기존 원장을 그대로 사용하며 새 Wire/공통 API schema/carrier/DB migration은 없다. 이것은 Web 전용 추가 읽기 모델이며 RC2 CFG01/02/OP01의 의미/형식을 바꾸지 않는다.
- 페이징은 기존 consistent-read/암호화 cursor를 재사용한다. cursor는 binding·SITE_TIME·limit·read-model view에 결속되어 일반 CFG01/다른 owner/다른 limit으로 전용할 수 없다. 정상 CFG01 cursor 형식/활성 설정 필터는 보존한다.
- 각 tombstone의 동일 owner+DELETE route·영속 operation ID·CONFIRMED 접수 상태·요청 hash·불변 config version/hash를 확인한다. 원래 ACK body cache가 있으면 ID/RELEASE_PENDING/actual_effect_confirmed=false도 대조한다. RC2 허용 response-cache 만료(SQL NULL)는 영속 ID 검증으로 읽으며 ACK를 소급 생성하지 않는다. Receipt/원장이 불일치하면 실패로 반환하고 빈 목록이나 완료로 바꾸지 않는다.
- 접수 Receipt는 실제 해제 증거가 아니다. PENDING/UNKNOWN/NOT_APPLICABLE은 PR35의 현재 version/revision과 검증된 RPT_STATE/원본 report/실제 Core verifier를 통해서만 읽는다. 오래된 report나 목록에서 빠짐으로 완료 처리하지 않는다. 조회는 설정/outbox/Receipt/의무를 수정하지 않는다.

### Web 복원 및 범위

- 기존 DeletedConfigReleasePanel이 설치 선택·마운트·새로고침·재진입마다 서버 SITE_TIME 삭제 기록 전체 페이지를 재조회한다. 브라우저 메모리 참조 없이도 대기/UNKNOWN/검증된 해제를 복원한다. 현재 화면에서 방금 접수된 참조는 후속 CFG02 GET으로 다시 읽어 페이징 중 발생한 새 삭제도 놓치지 않는다. 참조 없는 최초 마운트와 원래 DELETE 응답을 잃은 경우에도 Server 기록이 기준이다.
- 설치 변경·재조회의 오래된 응답을 버리고 조회 실패 시 직전 성공/빈 목록으로 대체하지 않는다. 새 read-model/version·설치·config ID/policy ID·삭제 버전·페이징 완료를 검증한다. 서버 데이터가 기준이며 localStorage/IndexedDB/Worker 호출은 없다.
- 기존 설정 CRUD·이용시간·디자인/Panel/인증/CSRF 경로를 보존한다. Content/CADENCE/예약의 frozen 실행 의무는 SITE_TIME 기록으로 해소하지 않는다. 다른 kind의 이 화면 삭제 참조는 PR35 범위처럼 메모리에만 남는 한계를 표시한다.

### 검증/인계

- Web **294 PASS**(PR35 289 재사용 경로+추가5), TypeScript/Vite build PASS. 마운트 해제→참조 없는 재마운트, pending/UNKNOWN, 조회 실패 후 성공 표식 제거, 이전 설치 지연 응답, 전체 페이지/잘못된 owner·활성 row·불완전 cursor를 검증했다.
- 격리 MySQL8.4.8·인증 HTTP(MockMvc) **30 PASS = PR35 회귀22 + 신규8**, 실패/오류/스킵0. 새 reader 객체의 상태 연속성, 조회 무변경, 기존 CFG01 보존, cursor domain/owner/limit, 불일치 Receipt, response cache 만료, CLOSED owner 거절, Content/활성 설정 제외, 실제 인증 경계를 확인했다. Core 효과 producer는 SYNTHETIC이다.
- Server 단위81/JAR verify·RC2 266 PASS. 신설 additional-deletion-history.yml이 같은 fresh DB/HTTP 경계를 재현한다. 공통 계약·api.ts/legacy-lock·Core/Content·DNR/DOM·기존 실패 기록은 보존한다. 최종 DB 근거 `.local/amvp-mysql-db95be42681d`는 소유권 확인 후 정상 종료했고 `.local/deletion-history-verification-20261030/result.json`에 source SHA/로그를 기록한다.
- 실제 Core/Content/Chrome/Native·물리 브라우저 새로고침·정책 효과/복원·재기동 수용은 **NOT_RUN**. 자동 UI/HTTP 시험을 실제 제품 수용으로 승격하지 않는다. `MVP_FINAL_COMPLETE=false`.

### 다음 독립 기능 확인 — 기존 재작성 없음

- PR35의 잔여 영역 표를 재사용한다. URL 키워드/성인/블러/16옵션 설정·예약/CADENCE·사용량 수신/집계/조회는 구현됨; 실제 capability/effect·collector/clock/day-carry·예약/CADENCE/Content producer와 세션/Attachment/document/generation별 효과·복원 연결이 남았다. 이 코드에서 실제 provider 결속/브라우저 수용은 아직 완료가 아니다.
- ONCE actor 매핑, CADENCE 휴식/주기 표시, USG-02 missing hash는 기존 선택지/영향을 유지하며 독자 확정하지 않는다. 추가 설정 guest→member 변환은 기존 legacy import type/완료 기록 schema만으로 확정되지 않아 provenance·소유권·충돌 매핑 확인이 필요하다.
- 확인된 독립 Web 결함이었던 새로고침 복원은 이번에 해소했다. 다음으로 임의 구현할 확정된 독립 기능은 발견하지 못했다. 프로필/아티팩트 선택이나 추가 설정 import를 미확정 catalog/API 없이 만들지 않는다. 다음 최소 작업은 실제 Core provider/전송과 연결된 첫 기능 시험, 또는 위 좁은 공동 결정 확정 후 해당 Web adapter/UI 구현이다. 통합 담당의 리뷰/Merge와 실제 설치/활성화를 대신하지 않는다.


## 삭제·해제 상태 후속 및 잔여 연결부 — 독립 구현 PASS / 실제 producer NOT_RUN (2026-10-30)

- 담당 김다훈 Web·Server·DB·UI. clean PR32 `dd490c211cf3ac186bd6e3a2e56465746b9bcd3d`를 재사용하고 같은 Worktree에서 `feature/additional-mvp-release-status`로 분리했다. 기존 PR27~32 HEAD·미커밋/index·실패 설치는 변경하지 않았다. 신규 설치/진단기/Worktree, 운영 DB·Chrome·Native·Core/Content 코드 변경과 Merge는 수행하지 않았다.
- 작업 중 통합 담당이 PR27/28/29/31을 병합했다. 확인 기준 `e6479fb4c2da4410a0163c983e0f727af28fb32e`의 tree가 기존 비교 기준 `1a4611d48c44d09e3970998822eda19ac5611f0a`와 같아 해당 코드 검증을 재사용한다. PR32는 확인 당시 Draft·미병합이며 실제 선행 의존성으로 남긴다. 이번 diff는 dd490c2 이후다. 통합 담당의 리뷰·Merge를 반복하지 않는다.

### 남은 영역의 분류

| 범위 | 확인 결과 / 다음 경계 |
|---|---|
| CRUD·패키지/outbox·report/Receipt·일일 사용량·예약/CADENCE Server/UI | 기존 구현·자동 검증 PASS 재사용. 실제 Core 실행 완료와 구분 |
| SITE_TIME 삭제 결과 | **이번 미구현 연결부 해결:** 새 패키지에서 빠진 삭제 대상을 기존 보고/원장/CFG 조회로 검증·상태 투영 |
| Content 16옵션·URL 키워드·성인·블러 설정 | AdditionalSettings/ContentConfig·publisher·검증된 profile gate 기존 구현. 재작성하지 않음. 실제 Content 효과/복원과 profile/artifact producer 결속 대기 |
| Content/focus 적용·복원 | 기존 FocusAttachment/frozen Snapshot·Core Authority 검증 경계 재사용. RuntimeReport의 SITE_TIME 해제 증거로 Content/기존 집중 의무를 해소하지 않음. session/Attachment/document/generation별 실제 producer 및 조회 투영 연동 대기 |
| Core capability/effect·예약/CADENCE actor | 기존 CapabilitySource/EvidenceVerifier/Actor/Authority 경계 존재. 생산 provider/transport·실제 효과 증거 결속 및 수용 NOT_RUN. 가짜 bean이나 Core actor를 만들지 않음 |
| collector·clock/day-carry | UsageReceiver/RegisteredClockProof·격리/집계 경계 존재. 실제 collector/anchor·day-carry producer/실제 브라우저 측정 연결 대기 |
| 회원·비회원 연속성 | Web은 회원 설치를 명시 선택하고 guest 로컬 자료를 조회/자동 업로드하지 않음. MemberImports의 SITE/CONTENT_POLICY/SCHEDULE/SESSION과 RC2 CompletedImportItem(완료 기록)만으로 새 CADENCE/SITE_TIME/CONTENT 설정 변환이 확정됐다고 볼 수 없음. 추가 설정 import 매핑·소유권/충돌 정책은 미구현/공동 확인 대기이며 임의 변환하지 않음 |
| 실제 통합 수용 | Core/Content/Chrome/Native·DOM/DNR 복원·재기동/데이터 보존 모두 이 후속에서 NOT_RUN |

### 이번 구현과 안전 경계

- 확인된 반례: 삭제는 정상적으로 tombstone+새 패키지를 발행하지만 해당 정책은 runtime_policies에서 빠진다. 기존 receiver의 published.containsAll 검사 때문에 삭제 대상 RELEASED를 받지 못하고 현재 tombstone은 영구 PENDING이 됐다.
- AmvpDeletedPolicyRelease가 기존 EvidenceVerifier의 실제 이전 claim/version/operation/generation/footprint 증명을 전제로 제거 대상만 검증한다. 동일 owner binding의 SITE_TIME tombstone·현재 불변 버전/hash·직전 버전과 그 원문을 포함한 실제 발행 패키지/hash·새 runtime_revision을 결속한다. 삭제된 ID를 무조건 허용하지 않는다. RELEASED/FAILED/UNKNOWN만 허용하고 APPLIED·다른 owner·Content·이전 revision은 현재 삭제의 해제 확인으로 쓰지 않는다.
- 기존 RuntimeReport/BatchAck·amvp_reports/amvp_operations·RPT_STATE/CFG02를 그대로 재사용한다. 새 Wire/API/DB Schema·RuntimePackage carrier는 없다. accepted Receipt와 projection은 같은 트랜잭션이며 gap·중복·지연·원본 UNKNOWN/실패를 보존한다. 실제 RELEASED 증거가 검증된 tombstone만 NOT_APPLICABLE로 조회한다. 패키지에서 빠짐, HTTP200, DELETE202, 빈 affected set은 해제 증거가 아니다.
- Web은 DELETE 접수 후 편집 목록에서 제거해도 이 화면의 요청 참조를 메모리에 보관한다. 기존 CFG02를 명시적 GET으로 재조회하여 삭제 버전/설치/ID와 해제 대기·UNKNOWN·확인을 구분한다. 오래된 설치 응답을 버린다. 기존 RuntimeDelivery 상태 함수·Panel/디자인·api.ts 인증/CSRF 쓰기를 재사용한다.
- **UI 한계 PARTIAL:** 참조 목록은 이 화면 메모리 범위다. 화면 새로고침 후 삭제 목록 자동 복원은 지원하지 않으며 이를 명시한다. 서버 tombstone/Receipt/해제 의무는 지속된다. 기존 CFG01은 삭제 목록 enumeration을 정의하지 않으므로 새 query flag나 브라우저 영속 자료 저장을 임의 추가하지 않는다.

### 필요한 공동 결정 — 원문 유지

- ONCE: 기존 actor에 명시적 ONCE 매핑을 합의하거나 별도 typed actor 경계를 합의. occurrence/source version·고정 종료·잔여60초·DST 규칙 및 예약 UI에 영향. 현재는 REVIEW_PENDING, 자동 주간 변환 금지.
- CADENCE: strict FocusState에 phase/cycle을 추가할지, 별도 합의된 읽기 모델로 제공할지 선택. Wire/Server DTO·타이머/휴식 표시·회귀에 영향. PAUSED를 REST로 추정하지 않음.
- USG-02: 미수신 status의 payload hash를 nullable로 할지, 조회자가 알고 있는 기대 hash를 명시해 돌려줄지 결정. schema/query/error·재전송과 source identity에 영향. unknown query 실패를 NOT_RECEIVED로 바꾸지 않음.
- 추가 설정 가져오기: 기존 legacy type으로 손실 변환하지 말고 명시 선택·원본 provenance/hash·kind/version·회원 owner 재결속·충돌 정책의 매핑을 확인해야 함. 이번 후속에서 계약을 확정하거나 import endpoint를 추가하지 않음.

### 검증 및 인계

- Web 전체289 PASS, TypeScript/Vite build PASS. 기존 삭제 멱등/현재 화면 구조를 재사용하고 tombstone GET·버전/설치 불일치·UNKNOWN/허위 APPLIED·Content 해제 오판·실제 삭제 버튼→대기 패널을 추가 검증했다.
- 격리 MySQL8.4.8/인증 HTTP(MockMvc) **22 PASS = 기존 Receipt/clock 회귀13 + 신규9**, 실패/오류/스킵0. 새 별도 DB에서 부모 suite를 상속해 같은 schema를 중복 초기화하지 않는다. 삭제/비활성화·구버전/타인/Content 거절·gap/중복·UNKNOWN 원문·이전 발행 hash 오염 거절·인증 CFG 조회를 확인했다. Core 효과 verifier는 SYNTHETIC이며 실제 효과 성공이 아니다.
- Server 단위81/JAR verify·RC2 266 PASS. 신설 additional-release-status.yml이 같은 분리 CI를 수행한다. 공유 계약·legacy-lock/api.ts·Core/Content/Shorts는 보존했다. 새로운 DB migration은 없다. 최종 DB 근거 `.local/amvp-mysql-ad4388057e00`는 소유권 확인 후 정상 종료, 로컬 검증/SHA 색인은 `.local/release-verification-20261030/result.json`이다.
- 다음 최소 연결은 실제 Core verifier가 삭제 이전 claim의 해제 증거를 기존 RuntimeReport와 affected policy ID에 결속하는 것이다. Content 효과/복원은 별도의 frozen scope producer를 연결한다. 통합 담당은 PR32 후 이 후속만 검토하며 실제 활성화/제품 수용을 별도로 수행한다. `MVP_FINAL_COMPLETE=false`.


## CADENCE 실행 연결 후속 — Web·Server 경계 PASS / 실제 actor·휴식 단계 PARTIAL (2026-10-30)

- 김다훈 Web·Server·DB·UI 담당 범위다. clean PR31 `d307c8aafbb7508f94615fe4e8467ce1a7fba42d` Worktree를 재사용해 `feature/additional-mvp-cadence-bridge`로 분리했다. 이미 병합된 PR30/integration `da1c70b2b2052dece581353f81cd5eb6c604e4b1`을 이 후보에만 로컬 반영한 비교 기준은 `1a4611d48c44d09e3970998822eda19ac5611f0a`다. 기존 PR27~31 HEAD/index와 다른 Worktree는 변경하지 않았다. GitHub Merge는 수행하지 않는다.
- **의존성:** PR27 → PR28 → PR29 → PR31 → 이 후속. PR27/28/29/31은 현재 Draft·미병합이며, PR30은 병합 완료다. integration 대상 전체 diff에는 선행 기능이 포함된다. 이번 후속 자체의 변경은 위 비교 기준 이후다.
- **재사용:** PR25 AdditionalConfigStore CRUD·원자 version/revision/멱등/삭제 tombstone, PR27의 검증 capability/owner·불변 config versions·outbox·FocusAttachment, PR28 상태 표시 경계, PR31 admission 위임, 기존 FocusSessions/MemberApp·디자인·api.ts 인증/CSRF/쓰기 경로를 재사용한다. Core/Content actor 및 공유 계약은 수정하지 않았다.
- **설정:** AmvpCadenceAdmission이 동일 저장 트랜잭션에서 검증된 CADENCE 원본을 sidecar 정의로 전달한다. SITE_TIME/CONTENT/예약은 기존 경로로 위임한다. 부분 capability map의 FOCUS_CONTROL만 검증돼도 CADENCE 준비 저장이 가능하며, RUNTIME_POLICY 미지원 발행은 계속 거절한다. CADENCE를 RuntimePackage에 추가하지 않는다. 기존 실행은 원래 config ID/version/revision·Snapshot 원문/hash·명시적인 null 또는 실제 Attachment를 고정하며 편집/삭제로 갱신하지 않는다.
- **명령/조회:** RC2 FOC-02 POST `/api/v1/amvp/focus/{session_id}/commands`, FOC-03 GET `.../state`와 엄격한 FocusControl/FocusState를 사용한다. Web 내부 ETag와 `X-Focurve-Control-Context`는 기존 binding/executor/epoch/capability/Attachment/5초 execute_before·제어 version 메타데이터이며 권한 증거가 아니다. FocusState/공유 Wire JSON 필드는 추가하지 않았다. POST마다 실제 인증·현재 소유권/receipt·frozen 원본·generation·version·멱등성·기한을 재검증한다. 조회는 actor 실행/세션 생성/저장을 하지 않는다.
- **단일 writer/생산 gate:** 실제 CapabilitySource와 `AmvpCadenceControl.Authority`가 모두 없으면 503이며 가짜 production provider는 없다. inspect는 단일 prepared focus 권한·기존 D06 writer fencing·현재 capability receipt에 결속된 actor generation을 읽기 전용으로 증명해야 한다. 최초 scope 조회로 RUNNING을 만들어낼 수 없다. 이미 실행한 legacy START를 coordinated START로 다시 실행하지 않는다. 실제 prepared FocusRef와 actor/전송/기존 세션 투영 연결은 Core 담당과 결속 대기다.
- **원자 발행/수신:** FOCUS_CONTROL 원문/hash·command·run·기존 outbox를 한 트랜잭션으로 저장한다. transport request_id만 semantic fingerprint에서 제외하고 operation/소유자/정책/If-Match는 보존한다. 내부 `receive`는 인증 supplier, 실제 ACK/효과/집중 claim 해제/runtime 정책 유지 verifier, generation/operation/순번/시각/full frozen 결속을 요구한다. 공개 미합의 Receipt API를 만들지 않았다. Core transport가 커밋된 outbox를 전달하고 검증된 결과를 이 receiver에 넣어야 한다. receipt/hash 또는 HTTP 202만으로 적용/해제를 인정하지 않는다.
- **순서/실패:** gap 원문은 보존하고 같은 receipt 재수신 때 선행 순번 해소 후 투영한다. 최초 UNKNOWN/START_FAILED는 불변 보존하며 후속 성공으로 지우지 않는다. 5초는 초기 전환 확인에 적용하고, 이미 확인된 실행의 이후 UNKNOWN/진행 보고와 구분한다. 기한 후 첫 성공 ACK로 UNKNOWN을 해제하지 않는다. ENDED 증거가 있어도 원래 Server 잠금이 남으면 투영을 대기한다. adapter는 legacy 세션/DNR/DOM/잠금을 직접 수정·삭제하지 않는다. JSON 정수의 JDBC/HTTP 표현 차이는 canonical bytes로 정규화하며 Snapshot 원문은 재직렬화하지 않는다.
- **UI:** 기존 주 타이머 위치와 START/PAUSE/RESUME/END를 재사용하고, 반복 설정은 보조 details로 표시한다. 저장 버전/집중·휴식/횟수/자동 시작 설정과 실제 제어 결과를 구분한다. 확인된 coordinated 실행의 조회 실패 시 legacy END로 fallback하지 않는다. 쓰기 응답만으로 실제 단계를 바꾸지 않고 같은 operation의 후속 조회를 기다린다. UNKNOWN에는 일반 END/RESUME 조작을 노출하지 않는다. 설정 버튼은 기존 Settings/AdditionalSettings로 연결한다.
- **공유 계약 경계 BLOCKED:** RC2 `FocusState`에는 REST/현재 주기/phase 필드가 없다. PAUSED를 휴식으로 해석하거나 새 Wire 필드·주기 계산을 발명하지 않는다. 실제 집중↔휴식 단계·주기 표시 및 자동 주기 결과 결속은 Core actor 자료와 해당 필드/조회 방식의 좁은 공동 합의가 필요하다. RC2 계약 전체를 다시 여는 작업은 하지 않았다. rest_clock=ELAPSED_WALL_CLOCK, missed_focus=WAIT_USER, deadline/auto_start_next 값은 그대로 전달하며 서버가 주기를 계산하지 않는다.
- **검증 PASS:** Web 전체282(HTTP/DOM 합성), 마지막 fixture 타입 보완 후 해당2건 재검증·TypeScript/Vite 빌드 PASS. Server 기존 단위81 PASS를 재사용하고 변경된 sidecar는 새 격리 MySQL8.4.8 및 Bearer HTTP18건(실패/오류/스킵0)으로 검증했다. RC2 전체266 PASS, JAR 빌드·schema/DDL 포함·변경분 비밀패턴/금지 경로 검사 PASS. 원본 api.ts·legacy-lock·공유 Schema/D06/Wire·Core/Content·Shorts는 보존했다. 전용 additional-cadence-bridge.yml로 원격 재현한다.
- 격리 시험은 원자 rollback, 동시 START version 충돌, 중복/gap/지연/역전·객체 재생성, 실제 verifier 미확인 거절, frozen Snapshot/실제/null Attachment, 수정/삭제 후 기존 실행, 최초 실패 보존, Server 잠금 잔존 END 거절을 확인했다. Core scope/effect/잠금 해제 producer는 **SYNTHETIC**이며 실제 Core 실행 성공이 아니다. 실패한 초기 시험 로그는 `.local/amvp-mysql-69411e70d679`, `f127f863b55e`, `c7de834e3033`에 보존했다. 최종 MySQL 근거는 `.local/amvp-mysql-ef3fb7c36780`; 소유권 확인 후 정상 종료했다. 로컬 변경 SHA/로그 색인은 `.local/cadence-verification-20261030/result.json`이며 민감한 시험 DB/설정은 게시하지 않는다.
- **NOT_RUN:** 실제 Core/Content/Chrome/Native, 실제 DOM/DNR/Binding 복원·재기동, Figma 시각 수용, 운영 DB migration/제품 활성화. opt-in `amvp/cadence-bridge.sql`은 기존 RC2 runtime schema 뒤의 검토 자료이며 자동/운영 적용하지 않았다. 기존 UNKNOWN/HOLD·Credential·실패 설치는 그대로 보존한다.
- **다음 최소 작업:** 윤종민 Core의 prepared focus·writer fence/동일 Snapshot/Attachment·세대/실제 효과/복원 verifier와 outbox/result transport/기존 세션 투영을 결속하고, REST/주기 정보 표현만 공동 확인한다. 이후 승인된 실제 연결 시험을 진행한다. `MVP_FINAL_COMPLETE=false`.


## 예약 actor 연결 후속 — Web·Server 구현 PASS / 실제 Core·ONCE BLOCKED (2026-10-30)

- 담당 김다훈 Web·Server·DB. clean PR29 HEAD `974175c5832a63ab018aa0f07f3203909fde4a37`를 재사용해 같은 Worktree의 `feature/additional-mvp-schedule-bridge`에서 구현했다. PR27~30 브랜치 HEAD는 변경하지 않으며 PR30 검사는 별도 리뷰/병합 상태를 유지한다. Draft 대상은 `integration/additional-mvp-20261029`; 선행 병합 순서는 PR27 → PR28 → PR29 → 이 후속이다. 이번 변경만의 diff는 `974175c..후속HEAD`다.
- **범위 PARTIAL:** RC2 `legacy_adapters.focus_schedule`는 WEEKLY만 기존 actor 경로에 매핑하고 ONCE는 `REVIEW_PENDING`이다. ONCE를 주간 예약으로 변환하지 않고 `UNSUPPORTED_CONTRACT`로 원자 거절한다. 공유 계약 변경·담당 합의 없이 일회성 실행을 활성화하지 않는다. 일회성 전체 연결은 미완료다.
- PR25 AdditionalConfigStore의 CRUD/버전/멱등/트랜잭션을 그대로 사용한다. 새 AmvpScheduleBridge admission이 FOCUS_SCHEDULE 저장 시 같은 트랜잭션의 단일 legacy `schedules` 행에 전달한다. SITE_TIME/CONTENT는 기존 publisher로 위임하고 CADENCE carrier를 추가하지 않는다. RuntimePackage/outbox에 예약을 넣거나 canonical CFG 사본을 별도 실행하지 않는다.
- 기존 actor 경로 `GET /api/v1/schedules?executor_id=…`, `POST /api/v1/schedule-occurrences/claim`(기존 3필드), `GET /api/v1/schedules/{id}/occurrences`를 구현했다. 조회는 명시한 설치/현재 binding 소유권을 검사하며 현재 구현의 상한은 100행이다(초과 시 불완전 성공 대신 거절). 삭제된 예약도 동일 소유자의 명시적 재조회에서 확인할 수 있다. 기존 CRUD를 다시 만들지 않는다.
- claim은 occurrence ID를 내부 request ID로 사용한다. UNIQUE(schedule_id,scheduled_start_at), 동시 설치/소유자 잠금, 동일 version, DST gap 미이동/earlier fold, 고정 UTC end, 잔여 60초 경계를 검사한다. 활성 집중은 WAITING_CONFLICT, 만료는 SKIPPED/EXPIRED. 편집·삭제는 미시작 건만 취소하고 발행된 세션·원래 version/end를 보존한다. 편집 후 같은 발생의 옛 세션을 새 version 요청에 재결속하지 않는다.
- `AmvpScheduleBridge.Actor.enqueue/verifyReport`는 **서버 내부 adapter 경계**이며 새 Wire 계약이 아니다. enqueue는 같은 DB 트랜잭션 안에서 기존 예약 actor용 세션·명령을 영속화해야 한다(외부 효과/네트워크 호출 금지). 실제 서버 세션/소유자/고정 종료/APPLY 명령/잠금을 확인한다. 생산 Actor/verifier bean은 제공하지 않으므로 미연결 claim은 503이며 가짜 실행을 생성하지 않는다. 원격 Core 브랜치 HEAD `9868a0f5914d7a173c102fc198a9a908b043381f`를 확인했으며, 미공개 Core 작업까지 없다고 단정하지 않는다.
- 결과 수신은 기존 D06 실행 보고 HTTP/불변 execution_reports를 재사용한다. 조회 projection에서 원래 occurrence·version·binding·session/command/revision·payload hash와 주입된 실제 효과 검증을 확인한다. 클라이언트 APPLIED/HTTP200만으로 RUNNING을 만들지 않는다. RELEASED는 별도 RELEASE 명령·rollback proof·ENDED·해제 시각·잠금 0 확인이 필요하다. 실패/UNKNOWN 보고는 보존하고, 이후 해제 확인과 과거 실행 미확정을 별도로 표시한다. Core 최종 상태·기한·기존 원장을 변경하지 않는다.
- 기존 AdditionalSettings/Panel/Light·Dark 스타일을 재사용한 ScheduleExecutionPanel과 엄격한 조회 client를 추가했다. 저장/요청 대기/실제 적용/실패/UNKNOWN/해제 확인, 이전 version, 삭제된 예약을 구분한다. 설치/version 전환 시 늦은 응답을 폐기한다. UI는 claim/START/END를 호출하지 않는다.
- 새 검증: Web 전체 **266 PASS**, 마지막 변경 영향 **11 PASS**, TypeScript·Vite build PASS. Server 단위 **81 PASS**, 예약 격리 MySQL·Bearer HTTP **16 PASS** + 시간 규칙 단위 **3 PASS**(3건은 Server81에 포함). 동시 claim·소유권·토큰 폐기·버전/ACK 불일치·정확한 60초·DST fold/gap·실패 뒤 지연 성공·별도 해제·잠금 잔존·삭제 후 실행 보존·서버 객체 재생성 조회를 검증했다. actor/effect/clock 입력은 **SYNTHETIC**이며 실제 Core 연동 성공이 아니다.
- 최초 새 SQL 열 이름 오참조 실패는 `.local/amvp-mysql-11ca63e4c23a/tests.log`에 보존했다. 기존 execution_commands의 실제 PK `id`로 최소 수정했고 이후 독립 DB에서 재검증했다. 최종 DB/정상 종료 증거와 source SHA는 `.local/schedule-verification-20261030/result.json`, unit/Web 로그는 같은 폴더다. 전용 CI `additional-schedule-bridge.yml`이 분리된 빈 MySQL에서 재현한다.
- 재현: 기존 `scripts/test-additional-config-mysql.ps1` + `FOCURVE_AMVP_SCHEDULE_TESTS=1`, `-Tests 'AmvpScheduleMysqlTest,AmvpScheduleBridgeTest'`. 단위 verify에서는 모든 MysqlTest를 제외한다. opt-in DDL은 `runtime-server/src/main/resources/amvp/schedule-bridge.sql`이며 자동 초기화·numbered migration·운영 적용은 없다. 기존 RC2 runtime schema가 선행해야 하고 실제 운영 반영은 별도다.
- 보존/대기: `frontend/src/api.ts`·legacy-lock·RC2·Core/Content·Shorts·실패 설치·Credential·운영 DB 변경 없음. PR30 결과를 수정/병합하지 않는다. 기존 contract 전체 PASS는 그 후보의 결과이며 현재 제품 후보의 실제 수용으로 승격하지 않는다. 실제 Core actor/검증 provider·ONCE 공동 계약·Chrome/Native·실제 END/DOM/DNR/재기동·Figma 시각 수용은 **BLOCKED/NOT_RUN**, `MVP_FINAL_COMPLETE=false`.


## DAY-01 독립 후속 — 구현·격리 검증 완료, 실제 Core 연결 대기 (2026-10-30)

- 담당 김다훈 Web·Server·DB, 계약 RC2 DAY-01/DailyUsage/UsageDay. PR28 head642b87704f8eaaf01d4b9d0b483b33390d9b9b2d를 재사용하고 같은 clean Worktree에서 codex/additional-mvp-daily-usage로 분리했다. PR27/28 브랜치·리뷰 범위는 변경하지 않는다.
- 코드: AmvpDailyUsage/Api, dailyUsageApi/DailyUsagePanel·기존 AdditionalSettings 배치. 기존 원장/예산/설정/Admission·디자인 Panel 재사용. Schema·공용 api.ts·legacy-lock·Core/Content·생산 bean/기능 플래그·migration 변경 없음.
- 수용: 실제 인증·소유권·날짜·자연일/DST·검증된 raw/예산 정합성·조회 무변경·지연 응답/설치 전환. 확인된 서버 prefix/carry만 표시하며 최신 live 잔여/차단/다음 허용 시각은 추정하지 않는다. 근거 없는0·timezone/day 추정·계정 재귀속 금지.
- 실제 경로: `GET /api/v1/amvp/site-time-policies/{policy_id}/usage?executor_id=…&date=YYYY-MM-DD` → 기존 인증/Admission → 동일 소유자의 불변 raw·해소 anchor·day budget 일관 조회 → 기존 `DailyUsage` Schema → AdditionalSettings의 일일 기록 패널. 기존 config API opt-in을 따르며 새 authority/collector bean이나 활성화 플래그는 만들지 않는다.
- 데이터: 서버 COUNTED prefix와 검증된 예산 carry를 읽는다. 불확실 raw는 보존·제외한다. `quality=PARTIAL`, `enforcement_state=UNKNOWN`, live `remaining_ms=null`이며 현재 차단/다음 허용 시각을 만들지 않는다. 원장·예산·Receipt를 수정하거나 날짜/한도를 초기화하지 않는다. 회원 전환 후 과거 기록은 기존 소유자만 조회할 수 있다.
- 보수적 한계: 자료 없음은 404, day/시간대 근거 부재·집계 불일치·동일 현지 날짜에 복수 전환 bucket은 503/STORE_UNCONFIRMED다. UTC 광역 탐색은 최대16 budget·50,000 raw로 제한한다. 전환 bucket을 임의 선택·합산하거나0/이용 가능으로 표시하지 않는다. 현재 UI와 API는 이 부분 자료 조회를 제공하며 완전한 live quota 증명은 아니다.
- 새 검증: Node24.19.0 Web **255 PASS**, TypeScript·Vite build PASS; Java21 Server unit **78 PASS**; 독립 MySQL8.4.8 **9 PASS**(실제 Bearer HTTP/JDBC·토큰 폐기 시험 포함). DB 실행의 추가 API unit2건은 Server78에 포함하므로 중복 합산하지 않는다. 자연일/DST/전환·capability·anchor는 합성 fixture이며 실제 Core clock producer 증거가 아니다.
- 실패·수정 보존: 최초 HTTP200 기대가503으로 실패한 원인은 기존 인증 `FOR UPDATE`와 새 HTTP read-only transaction의 충돌이었다. 인증 잠금은 유지하고 HTTP transaction만 조정했다. `.local/amvp-mysql-62a768971183/tests.log` 최초 실패, `.local/amvp-mysql-8309fe37e031/` 최종9 DB+2 API PASS·datadir 소유권·정상 종료 증거, `.local/receipt-verification/daily-usage-20261030/` Web·Server unit 로그. 이후 불확실 구간이 들어와도 확정 prefix/예산을 늘리지 않고 raw2건을 보존하는 반례를 실행했다.
- 재현: `npm --prefix frontend test -- --maxWorkers=2`; `npm --prefix frontend run build`; Java21에서 Maven `-f runtime-server/pom.xml '-Dtest=*,!AdditionalConfigMysqlTest,!AmvpRuntimeBridgeMysqlTest,!AmvpRuntimeReceiptMysqlTest,!AmvpDailyUsageMysqlTest' verify`. DB는 기존 `scripts/test-additional-config-mysql.ps1`에 전용 vendor/Maven 경로·빈 시험 포트·`-Tests 'AmvpDailyUsageMysqlTest,AmvpDailyUsageApiTest'`, 환경 `FOCURVE_AMVP_DAILY_TESTS=1`을 사용한다. 운영 DB URL을 지정하지 않는다. 새 `additional-daily-usage.yml`이 동일 분리 검증을 수행한다.
- PR 범위: PR28을 base로 하는 별도 Draft 후속. PR27·28의 발행/부착/수신/RPT 검증·화면 연결은 재사용하고 재구현하지 않았다. 공유 계약·`frontend/src/api.ts`·legacy-lock·생산 설정·DB migration은 변경하지 않는다.
- 실제 Core/Content/Chrome/Native·운영 DB·Figma 시각 수용 **NOT_RUN**. 다음 최소 통합은 윤종민의 실제 capability/collector/clock·day-carry와 report verifier를 기존 경계에 연결한 뒤 수신→조회→표시를 검증하는 것이다. 예약/반복 집중·휴식 actor와 Content 효과는 각각 담당 구현 증거를 기다리며 저장만으로 적용 완료를 선언하지 않는다. legacy-lock 및 미수신 hash는 계약 담당의 별도 결정 대기다.

## PR #27 기준 및 구현 — 기존 기록 보존

- 담당: 김다훈 Web·Server·DB. Core·Content producer와 Shorts 안정화는 변경하지 않는다.
- 브랜치: `feature/additional-mvp-runtime-adapters`.
- 시작 기준: PR #25 head `6073442df501c4e381142ea6ed1108808d249814`.
- 현재 통합 기준: PR #25 병합 `202d6317ff7d88b6d5e916ec549e7ffff02f2d91`. 시작 기준과 병합 tree가 같음을 확인하고 이 독립 브랜치만 fast-forward했다.
- 계약: `AMVP-CONTRACT-20261029-RC2`, 계약 기준 `e2b3fc318fe52acc45145a30def07b874b2255f6`. 공유 계약·PR #25 파일 변경 없음.
- 상태: **PARTIAL — 독립 어댑터·HTTP·DB·UI 상태 검증 PASS, 실제 producer 연결 및 제품 수용 NOT_RUN**.

## 재사용한 구현·명세

PR #25의 `AdditionalConfigContract`, `AdditionalConfigStore.Admission`, `MemberAuth`, `AdditionalUsageStatistics`, `additionalConfigApi`, `AdditionalUi.Panel`과 빈 격리 DB fixture/실행 스크립트를 재사용한다. CRUD·인증·통계·기존 화면을 다시 구현하지 않았다.

원문: `contracts/additional-mvp/rc1/schema.json`, `api.json`, `mysql-runtime-candidate.sql`, `tests/review_reference.py`; `docs/design/additional-mvp-contracts/02_API_DB.md`, `03_Wire_D06_복원.md`, `04_정책_시간.md`. 디렉터리명 rc1과 달리 Schema/계약 revision은 RC2다.

## 실제 구현

1. **정책 발행**: 기존 config writer의 동일 트랜잭션에서 canonical RuntimePackage·RUNTIME_POLICY outbox·current pointer를 저장한다. binding/owner epoch, 서버 검증 capability receipt/유효기간, 적용된 timezone, 콘텐츠 feature/profile 권한을 확인한다. 실패 시 config/version/발행 전체가 rollback된다. 저장·발행을 Core APPLIED로 표시하지 않는다.
2. **고정 정책 부착**: 발행된 immutable package의 지정 `next_focus_revision`에서 콘텐츠를 가져온다. 원본 FocusRef는 trusted `FrozenFocusProof`가 검증해야 한다. 동일 요청은 영속 receipt로 재생하고, 다른 revision/Snapshot으로 기존 집중에 재부착하는 것은 거절한다. D06 Snapshot 변경·DOM 적용·실행 ACK 생성은 없다.
3. **이용시간 수신**: USG-01 item별 독립 transaction과 실제 bearer 재검증. 원본 canonical hash, active owner, 발행 package/revision/발행 시각, ALL_MATCHING attribution, 순번/hash chain, 단일 collector의 물리 구간 중복을 확인한다. 순번·package 누락은 기존 operation ledger에 ID/hash/위치를 예약하고 PENDING_DEPENDENCY로 남긴다. 재전송·수신기 재생성·동시 중복은 이중 집계를 만들지 않는다.
4. **측정·집계**: client TRUSTED만으로 COUNTED가 되지 않는다. 소유권이 일치하는 서버 VERIFIED anchor와 별도 ClockProof가 모두 있어야 한다. 나머지는 원본을 보존하며 QUARANTINED. 확인된 구간은 일일 정책마다 집계하되 새 day carry가 검증되지 않았으면 quota cache를 만들지 않는다. 기존 carry·day chain·limit를 임의 변경하지 않고 충돌 시 raw/receipt/projection을 함께 rollback한다. 통계는 구간 하나를 한 번만 합산한다. 이는 live Core 잔여 한도 증명이 아니다.
5. **HTTP**: PKG-01 GET current, FOC-01 POST attachment, USG-01 POST batch. `focurve.additional.runtime-bridge.enabled=true`와 서버 authority/proof bean이 필요하다. 기본 비활성·생산 verifier 없음. 켜기만 하면 CAPABILITY_NOT_VERIFIED. 재인증/보존 END 전용 서비스는 거절한다. request body duplicate key·추가 query·크기 제한을 검증하고 secret/raw SQL 오류를 반환하지 않는다.
6. **Web**: 독립 `RuntimeDeliveryPanel`은 기존 config API를 읽고 저장/적용 대기/미확인/미지원/정확한 revision 적용 상태를 구분한다. 설치 전환·늦은 응답·재조회 오류를 처리한다. `runtimeDeliveryState`는 usage ACK와 COUNTED/QUARANTINED를 구분한다. 기존 화면 entry 파일을 수정하지 않았으므로 **라우트 배치·Figma 시각 수용은 NOT_RUN**이다.

## 실제 연결과 대기 경계

| 경계 | 결과 |
|---|---|
| ConfigStore → canonical package/outbox/current pointer | 격리 MySQL PASS, 생산 capability source 대기 |
| Frozen issued content → immutable attachment/receipt | 격리 MySQL PASS, 원본 focus verifier는 SYNTHETIC |
| 실제 bearer/MemberAuth → PKG/USG HTTP → JDBC | MockMvc+실제 격리 MySQL PASS |
| Raw usage → quarantine/count → 기존 statistics | 격리 MySQL PASS, clock/carry producer는 SYNTHETIC |
| 기존 회원의 closed binding 기록 조회 | owner 이전 후 기존 회원 read-only 보존 PASS |
| Web 상태 패널 → 기존 API | 렌더링/API Mock 시험 PASS, 화면 배치 미완료 |
| Core/Content 실행·실제 effect ACK·RPT report 연결 | BLOCKED: 검증된 producer 및 근거 조회 연결 대기 |
| 비회원 로컬 collector/guest 원장 | 변경 없음, 실제 수용 NOT_RUN; 회원 서버 업로드로 대체하지 않음 |
| Chrome·Native·정상 END·복원·재기동 | NOT_RUN, 이번 승인 범위에서 제외 |

### 공유 계약을 임의로 바꾸지 않은 경계

- RuntimePackage에는 SITE_TIME과 focus_defaults만 있다. CADENCE/FOCUS_SCHEDULE은 별도 actor 경로가 필요하다. 이 publisher로 해당 변경의 실행을 발행하려 하면 UNSUPPORTED_CONTRACT로 rollback하며, 저장했다고 실행 가능으로 표시하지 않는다. 기존 PR #25의 CRUD 자체는 보존했다.
- USG-02: StatusRequest에는 item_ids만 있지만 UsageItemAck에는 NOT_RECEIVED일 때도 payload_sha256이 필수다. 미수신 ID의 실제 hash를 알 수 없다. 내부 `knownStatus`는 영속 receipt가 있는 경우만 반환하고, 미수신은 Optional.empty로 구분한다. **없는 hash를 0/임의 값으로 채우거나 계약을 수정하지 않았다. 외부 status endpoint 활성화는 공동 결정 대기.** immutable batch 재전송은 이미 지원한다.
- 생산 `CapabilitySource`는 approved artifact/feature/license와 현재 owner/capability를 확인하고, 그 결과를 DB receipt의 selection·hash·verification_ref·expiry와 결속해야 한다. 시험 issuer는 test source에만 존재한다.
- 생산 `ClockProof`는 registered anchor 외에도 restart/predecessor, wall/mono 정합성, immutable day/timezone allocation과 carry provenance를 증명해야 한다. `initialCarry`가 없으면 quota cache 초기값을 추정하지 않는다. 불확실 구간 보정/owner handoff/carry 갱신은 이 수신기가 대신 결정하지 않는다.
- 생산 `FrozenFocusProof`는 원래 Snapshot bytes/hash/format·같은 session/owner/revision·live focus authority를 확인해야 한다. 이번 synthetic proof 시험을 실제 D06/Chrome 연결 완료로 보고하지 않는다.

## 검증 — 2026-10-29 KST

- PR #25 CI run `40881211102`의 Web242·Server82 및 기존 MySQL16 결과는 동일 소스·계약에 한해 재사용한다.
- Windows, Node24, Java21, MySQL8.4.8, 승인된 19-table candidate를 **새 빈 disposable DB**에만 적용했다. 운영 migration·설치 서비스·사용자 DB 기동 없음. 시험 DB는 소유권 대조 후 mysqladmin으로 정상 종료했다.
- 새 MySQL14: 원자 발행, rollback, capability 만료, 동일/상이 hash, 동시 중복, seq gap/위치 재사용, receiver 재생성, quarantine, attribution/owner/geometry/hash 거절, overlap, item별 결과, day 충돌 rollback, package dependency, carry 미확정, immutable attachment, 실제 bearer HTTP/폐기, ALL_MATCHING 및 statistics 중복 방지, closed-owner history, registered anchor 부재.
- 새 HTTP/bean6: 생산 source 없는 API·Web principal·restricted service·malformed/duplicate body·활성화 조건·기존 Admission 연결. 자동 적용/초기화 없음.
- 별도 Server 단위72(위 HTTP/bean6 포함), JAR verify PASS. 두 DB 초기화 클래스는 이 단위 실행에서 명시적으로 제외했다. MySQL14는 별도 실행으로 검증했다.
- Web246/246 PASS, 타입 검사·Vite build PASS. 새 4개 시험 포함. 오류 문구 시험의 첫 실패는 기존 안전한 오류 masking 기대값을 수정해 해결했으며 제품 판정을 완화하지 않았다.
- 새 `.github/workflows/additional-runtime-bridges.yml`: Web 전체, 새 DB suite만 독립 초기화, DB 초기화 제외 단위 suite. 기존 PR #25 CI 파일은 변경하지 않는다.
- 로컬 상세 증거: `.local/bridge-verification/` 및 `.local/amvp-mysql-d0d3ac8e4d3a/`. 과거 실패 fixture 로그도 유지한다. 실제 비밀번호·로컬 DB·시험 credential 파일은 Git 제외다.

재현: Java21과 기존 Maven/MySQL8.4.8 경로를 사용한다. 새 DB suite는 `$env:FOCURVE_AMVP_BRIDGE_TESTS='1'`로 설정한 뒤 기존 `scripts/test-additional-config-mysql.ps1`의 `-BinaryDirectory`, `-MavenCommand`, 미사용 `-Port` 및 `-Tests 'AmvpRuntimeBridgeMysqlTest,AmvpRuntimeBridgeApiTest,AmvpRuntimeBridgeConfigurationTest'`를 사용한다. Server 단위는 `mvn -f runtime-server/pom.xml '-Dtest=*,!AdditionalConfigMysqlTest,!AmvpRuntimeBridgeMysqlTest' verify`, Web은 `npm --prefix frontend test -- --maxWorkers=2`, `npm --prefix frontend run build`. 두 DB 초기화 suite를 한 DB에서 동시에 실행하지 않는다.

## 다음 최소 연결

1. 윤종민 Core: verified capability/collector/clock/day carry producer와 runtime report proof 제공. 기존 인터페이스·테스트 fixture를 기준으로 연결하며 공유 계약을 임의 확정하지 않는다.
2. 채지민 Content: agreed feature/profile/effect proof 연결. 기존 Shorts 안정화를 일괄 이관하지 않는다.
3. 김다훈 Web·Server: 합의된 status unknown-hash 처리와 report read projection 연결 후 상태 패널을 기존 화면에 배치하고 관련 UI/API 시험. 생산 authority가 없으면 현재 비활성 유지.
4. 실제 Chrome/Native 검증은 별도 유효 승인 후 수행한다. 기존 UNKNOWN/HOLD·실패 증거·Credential·다른 worktree는 변경하지 않았다.

`MVP_FINAL_COMPLETE=false`. 이 PR은 독립 연동 경계 준비이며 제품 최종 수용 완료가 아니다.

## PR #27 이후 · 검증 보고·현재 상태·UI 연결

- 기준 `9a7b1d798ae9d4f6542f07310ddd09145670bfcc`, 후속 브랜치 `feature/additional-mvp-runtime-receipts`. PR #27은 Draft·미병합이며 해당 브랜치/리뷰 내용은 수정하지 않았다. 같은 작업공간을 재사용한다. 계약 기준 RC2 `e2b3fc3`, 제품 통합 기준 `202d6317`은 구분한다.
- RPT-01을 기본 비활성 HTTP로 연결했다. 실제 bearer/현재 owner/capability, package/hash/발행 시각, report epoch/seq/ID 중복·gap을 확인하고 원본 report·receipt·read projection을 item별 transaction으로 저장한다. gap은 PENDING_DEPENDENCY로 원래 ID/hash를 예약한다. SQL 실패·commit 응답 유실 시 같은 immutable 요청으로 재확인하며 성공을 추정하지 않는다.
- `EvidenceVerifier`는 **Core 담당 경계**다. operation/execution/current epoch·합법 전이·fresh observation·evidence hash 뒤의 실제 문서/효과 근거와 전체 policy coverage를 검증해야 한다. 운영 bean·가짜 producer를 만들지 않았다. 없으면503. 검증된 affected policy가 없으면 수신 ACK가 ACCEPTED여도 적용 상태는 PENDING이다.
- 원본 `amvp_reports`와 개별 receipt는 수정하지 않는다. 기존 `amvp_operations`에 private receipt profile `AMVP_REPORT_RECEIPT_1`과 mutable read cursor `RPT_STATE`를 사용한다. 이 cursor는 immutable report/receipt를 참조하며 외부 Wire 확장이 아니다. 현재 SITE_TIME의 ID·전체 내용·config version이 같을 때만 반영한다. 이전 package 보고가 더 최신 cursor를 덮지 않는다. 새 epoch/늦은 actor의 유효성은 Core verifier가 판정해야 한다.
- 기존 Admission에 기본 PENDING read hook을 추가했다. 기존 시험/다른 Admission은 그대로 동작한다. APPLIED는 검증된 현재 설정에만, FAILED/UNKNOWN은 기존 ConfigRecord enum의 UNKNOWN으로 투영한다. 상세 FAILED 원본은 report에 보존한다. enum/DTO에 임의 필드를 추가하지 않았으므로 UI에서 상세 실패 원인을 새 필드로 노출하지 않는다. CONTENT/frozen actor 및 삭제 후 release 완료는 이 runtime coverage만으로 확정하지 않고 기존 대기를 유지한다.
- 한 설정이 바뀌지 않아도 다른 설정 발행으로 package revision이 증가할 수 있다. 서버가 정확한 config version/내용을 검증한 APPLIED에 한해 UI는 `applied_runtime_revision >= saved_runtime_revision`을 허용한다. 오래된 설정 ACK로 최신 편집을 확인 처리하지 않는다. 실제 ACK revision을 저장하며 이전 revision 값으로 위조하지 않는다.
- `AmvpRegisteredClockProof`는 DB의 VERIFIED anchor, 동일 boot/clock, 서버가 선택한 wall skew, 자연일/timezone 정합성을 실제로 읽는 보수적 생산 코드다. receiver/collector 객체 재생성 후에도 기존 원장·통계를 읽는다. collector_epoch를 바꿔 restart 증명을 우회할 수 없다. 새로운 boot/clock·legacy clock 부재·전환일은 전문 clock/restart proof가 없으면 QUARANTINED. 초기 carry를 추정하거나 격리 원본을 자동 승격하지 않는다. bean 자동 등록·제품 활성화는 하지 않았다.
- 기존 AdditionalSettings에 RuntimeDeliveryPanel을 연결했다. 같은 설정 조회 결과를 재사용하여 중복 fetch 없이 예약·한도·반복·콘텐츠의 저장/적용 상태를 표시하고 재조회한다. 수정/삭제 UI·디자인 컴포넌트를 재사용하며 다른 설치의 늦은 결과를 표시하지 않는다. 실제 적용 ACK는 SITE_TIME runtime 경계에서만 준비됐고 예약/반복 actor의 실행은 여전히 별도 연결 대기다.
- legacy-lock/API 공유 파일은 수정하지 않았다. RC2 전체 재승인을 시작하지 않는다. 알려진 api.ts 전체 해시 충돌은 설계/회귀 담당의 좁은 보존 범위 결론 대기이며 독립 후속 개발의 차단 사유로 사용하지 않는다.

### 후속 검증·재개점

- 새 독립 MySQL suite `AmvpRuntimeReceiptMysqlTest`: 13건. verified/partial coverage, 영속 수신·중복·gap·UNKNOWN/FAILED, 현재 버전/후속 package, owner/hash/proof 거절, 동시성, projection SQL 실패 rollback, 실제 bearer HTTP/폐기, 구체 clock verifier·통계·receiver 재생성·drift/restart/collector reset을 시험했다. Core 효과 verifier와 anchor 등록 근거는 명시적 SYNTHETIC fixture다. 실패 주입은 빈 시험 DB의 제한된 CHECK로 수행하며 SUPER 권한을 요청하지 않는다.
- `AmvpReportApiTest`: 4건. 생산 source 부재·Web principal·restricted service·malformed JSON/query 거절. 새 suite17/17 PASS. 변경 영향의 PR #27 suite20/20, Server 단위76/76 및 JAR verify PASS. Web247/247 및 타입/Vite build PASS. 설치 전환은 조회 effect 전에 기존 행을 동기적으로 비우고 이전 응답 세대를 무효화한다. 원격 최종 결과는 후속 PR에 기록한다.
- 새 suite는 `$env:FOCURVE_AMVP_RECEIPT_TESTS='1'`와 기존 격리 스크립트의 `-Tests 'AmvpRuntimeReceiptMysqlTest,AmvpReportApiTest'`로 실행한다. suite별 DB를 따로 만들며 기존 두 초기화 suite와 섞지 않는다. 단위 실행에서는 세 `*MysqlTest` 초기화 클래스를 제외한다. 원격 후속 workflow도 별도 서비스 DB를 사용한다.
- 증거 `.local/receipt-verification/`, `.local/amvp-mysql-3f0fcff8c63b/`; 실패 시험 로그도 유지한다. 실제 설치·Chrome·Native·Core producer·운영 DB·END/복원/재기동 수용은 NOT_RUN. 사용자 데이터·이전 UNKNOWN/HOLD·Credential 변경 없음.
- 다음: Core 담당의 실제 EvidenceVerifier/clock restart/day carry 등록 연결 → 동일 RC2 계약 HTTP 수용 → Content 효과/복원 proof 연결. 미수신 hash status 합의·예약/반복/frozen 실행 보고·삭제 release 증명은 분리해서 처리한다. 이번 후속 PR은 #27 위에만 쌓고 #27 병합 후 integration으로 기준을 갱신한다. `MVP_FINAL_COMPLETE=false` 유지.

## OPTION-08 / API-STAT-03 시간대별 접근 경로 구현 — 2026-11-01

- 담당 김다훈. 기존 clean Worktree에서 `feature/additional-mvp-hourly-access`, 기준 integration **24327d1bd8615a2274a6dead43f23b71cc06b64e**. #51/#52는 실제 미병합 HEAD11f50b7/c2aa82f 그대로 보존했다. #60 UTC 정밀도 수정과 별도 #62 Statistics as_of 거절 HEAD8ceaf5c2f37a6e9823f5e587d0b2d129fb8f26fd도 보존했으며 이 기능의 선행 의존성은 아니다. #62의 기능별 현황 표는 그 개발 시점의 이력이고, 아래 시간대별 분석은 후속으로 실제 구현한 범위다.
- 구현 전 확인: `MemberApp.AccessPattern`은 추가 MVP 예정 안내만 있었고 `/api/v1/statistics/hourly` controller가 없었다. 기존 `docs/design/02_시스템_테크설계/04_API_연동.md` **API-STAT-03**의 24개 시간대 Metrics와 기존 통계의 **Asia/Seoul 날짜 기준**, OPTION-08의 접근·반복 분포를 사용하면 Core producer 없이 **이미 ACCEPTED된 회원 접근 기록**을 조회할 수 있다. 새 API·DB 의미를 만드는 대신 기존 선언 API를 구현했다. 시간대별 이용시간/활성 시간의 측정·완전 수집 증거를 생성하는 작업은 아니다.
- Server `MemberHourlyStatisticsApi`: 기존 MemberAuth/MemberReadModel.range/accesses를 호출해 Web 회원과 Extension executor 소유권·기존 반복 플래그를 그대로 재사용한다. 기본 최근7일/명시적 최대366일, KST 00~23시 순서의 Metrics **배열24개**, 시작 포함/종료 제외, 실제 accepted 행만 집계한다. 기간 밖 선행 이벤트 때문에 이미 반복인 항목을 첫 접근으로 재분류하지 않는다. 현재 회차에서는 수집 watermark가 없어 positive 값도 PARTIAL(의심 FEATURE는 REVIEW_REQUIRED), 빈 구간은 null/NOT_COLLECTED이다. active_duration_ms는 null로 유지하고 COUNTED 시간·한도·APPLIED·해제 증거를 발명하지 않는다. 50000행 상한 초과/잘못된 원문/중복 원장은 정상 부분 결과가 아니라 거절한다.
- 새 controller만 추가하며 잠금 대상 `MemberReadApi`/`MemberMetrics`는 변경하지 않았다. 인증의 FOR UPDATE fence를 그대로 실행하므로 일반 REPEATABLE_READ transaction을 사용한다. controller/집계는 DB 쓰기를 하지 않고 no-store 응답을 제공한다. auth 실패401·지원하지 않는 query/date422, 관측 불가409를 성공으로 바꾸지 않는다.
- Web `HourlyAccessPattern`: 기존 MemberApp의 대시보드/통계 카드 위치와 기간 필터에 연결했다. 새 메뉴·조회 화면·Figma 재설계가 아니라 원래 시간대별 카드의 예정 안내를 실제 GET 결과 표로 바꾼 것이다. 24구간/시간/비율·카운트 결속 검증, 로딩·오류·명시적 재조회, 기간 변경 시 이전 결과 제거와 늦은 응답 거절을 구현했다. 기존 metricPercentage를 재사용한다. 수치가 없는 시간대는 미확인/미수집, 실제 효과·이용시간과 별개임을 표시한다.
- 새/영향 Web **26 PASS**(Hourly4 + MemberApp22), TypeScript/Vite build PASS. 최초 전체 실행은 기존 '미구현 안내 유지' 시험1 FAIL/나머지311 PASS였고 해당 시험을 삭제하지 않고 실제 API의 미수집24구간·가짜0/차트 금지 검증으로 갱신했다. 이후 관련26건을 재실행했다. 원격 누적 전체 결과는 해당 PR 원본 로그로 확인한다. 단위26과 전체 수를 합산하지 않는다.
- fresh 격리 MySQL8.4.8 **27 PASS** = 기존 ConfigMysql16 + 새 SQL/HTTP1 + 새 집계4 + 기존 ConfigContract6, fail/error/skip0. 실제 controller/auth/read model/SQL을 MockMvc와 기존 AmvpLoopbackHttp의 **실제 loopback TCP**로 확인했다. 회원/다른 회원·동일 회원의 다른 executor 분리, E token 범위, 401/잘못된 query/date422, KST 자정/종료 경계·과거 반복 플래그, PENDING receipt 제외, no-store, 조회 전후 Receipt/command 개수 보존을 확인했다. Core/Content/effect/clock provider는 호출하지 않는다. accepted 이벤트는 격리 시험에서 넣은 SYNTHETIC 원문이며 실제 Chrome 수집 시험은 아니다.
- 최종 DB `.local/amvp-mysql-063f799a4df2`, port33425/datadir 소유권 확인·정상 종료. 앞선 컴파일 import 누락(501e79a71f3d), fixture source/origin 누락(e02fb86b05b1), MySQL READ ONLY와 기존 인증 FOR UPDATE 충돌(030289c93f37)의 로그도 보존했으며 각 DB는 정상 종료했다. 인증 잠금 검사를 제거하지 않고 route transaction 설정을 기존 인증 계약과 맞췄다. 근거 `.local/hourly-access-20261101/` 및 위 DB tests.log. 운영 DB·기존 설치·Credential은 사용하지 않았다.
- 남은 범위: RC2 owner/day 새 event producer와 collector/clock·시간대별 실제 **이용시간**·한도·정상 END/복원은 별도다. ONCE actor·CADENCE 단계·USG-02 hash 공동 결정, AI 동의/provider/저장 도입도 대기한다. 이미 구현된 RuntimeReport/Receipt·사용량 수신·삭제 상태를 재구현하지 않았다. 기존 legacy-lock Core4파일 FAIL/원본 해시 보존, Core/Content/Shorts·기존 다른 PR/index 보존. 실제 Core/Content/Chrome/Native 제품 수용 NOT_RUN, `MVP_FINAL_COMPLETE=false`.

> LOG-01 원격 영향 확인: 후보 **23721d9181b2198456ba545cc9ac19aaad91806a**의 CI에서 `MemberApp.test.tsx:418`이 기록 행 표시 직후 보조 PARTIAL 문구까지 동기적으로 있다고 가정해 **392 PASS/1 FAIL**했다. 주/보조 읽기 분리의 직접 영향이다. assertion을 삭제/완화하지 않고 `findByText`로 실제 보조 응답 후 동일 문구를 검증하도록 최소 수정한다. 최초 [실패 원본](https://github.com/kdu-sw-capstone/capstone-project/actions/runs/41280253536/job/124770557986)을 보존하고 조건 변화 없는 재실행은 하지 않는다. 수정 후 담당 전체 MemberApp22와 기록18을 다시 확인하며 최종 HEAD/CI/숫자는 PR74 본문과 ignored result를 따른다.
