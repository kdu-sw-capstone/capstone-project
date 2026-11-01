# SESSION-06 · 세션 메모

단계: 추가 MVP · 설계 담당 영역: Web·Server·Extension

## 작업 상태

- 상태: 회원 Web 비동기 경계 수정·검토 대기 (전체 기능/실제 제품 수용 완료 아님)
- 실제 담당자: 김다훈 (이번 Web 변경만; 기존 Extension 배정 유지)
- 브랜치 / 시작 기준 커밋: `fix/additional-mvp-note-session-scope` / `10ab6026f1cf7d244a75ee529830afb8bcf6b8c8`
- PR:
- 선행 작업 / 차단 조건:

| 영역 | 담당 | 구현 상태 | 검증 상태 |
|---|---|---|---|
| Web | 김다훈 | 기존 메모 UI/API 재사용·세션/편집 비동기 결속 수정 | 반례2건 수정 전 FAIL → 수정 후 PASS, 관련 회귀는 아래 원본 기록 |
| Server | | 미확인 | 미실행 |
| Extension | | 미확인 | 미실행 |

해당하지 않는 영역은 관련 명세 근거와 함께 해당없음으로 표시한다.

## 설계 참조

- 화면: SESSION-01
- 흐름: TF-A09
- API: API-NOTE-01, API-NOTE-02
- 데이터: session_notes
- 회원: 회원 Web·Extension
- 비회원: Extension 로컬
- 로컬: EXT 로컬 동일 검증/owner별 저장

원문: [화면](../../design/01_UX_기능설계/02_IA_화면명세.md) · [동작](../../design/01_UX_기능설계/03_동작규칙.md) · [API](../../design/02_시스템_테크설계/04_API_연동.md) · [데이터](../../design/02_시스템_테크설계/05_데이터_복구.md) · [검증 기준](../../design/04_검수_예시데이터/07_검증기준.md)

## 설계와 구현 대응

| 기준 ID | 기대 결과(기존 설계) | 코드 위치 | 검증 명령·환경 | 결과 |
|---|---|---|---|---|
| AC-SESSION-06-01 | 세션별2000자 이내 메모 저장·조회 | | | 미실행 |
| AC-SESSION-06-02 | 다른 계정·초과 입력 거절, 실패 입력 유지 | | | 미실행 |
| AC-SESSION-06-03 | 412에서 최신값과 편집값 보존 | | | 미실행 |

기존 수용 기준은 출발점이다. 상세 명세의 실제 입력·출력·오류를 검증하며 이 표의 존재만으로 충분한 테스트라고 판단하지 않는다. 관련 BOUND 사례도 선택하여 아래에 기록한다.

## 추가·통합 검증

| BOUND 또는 추가 기준 | 실행 방법 | 결과 | 증거 |
|---|---|---|---|
| | | 미실행 | |

## 중단·재개 기록

- 2026-11-01 독립 리뷰 P2 보완: [리뷰](https://github.com/kdu-sw-capstone/capstone-project/pull/69#pullrequestreview-5726376530)에서 폐기된 초기 GET401이 `useWork`의 전역 인증 만료 이벤트를 발생시키는 반례를 받았다. 같은 수명 결함을 PUT412 후속 GET에도 확인했다. 폐기2 반례 수정 전 FAIL/현재401 대조군2 PASS → 초기 load catch와 후속 GET catch에 generation/abort 검사를 추가했다. 폐기 오류만 소비하고 현재 요청의401은 계속 전파한다. api.ts·인증 계약·useWork는 수정하지 않았다. 기존7+새4, FocusScreens18/CADENCE4 포함 **33 PASS**. 외부 원본을 수정하지 않고 `.local/pr69-review-fix-20261101/`에 신규 전후 로그를 보존한다. 이전 리뷰/승인은 새 SHA로 소급하지 않으며 재검토 전 승인 완료로 표시하지 않는다.

- 2026-11-01: 기존 세션 GET이 대기하면 `useWork` lock 때문에 새 세션 GET이 생략되고 늦은 이전 값이 표시되는 반례, 초기 GET 중 입력을 늦은 서버 값이 덮는 반례를 확인했다. 기존 Note API는 session_id가 응답에 없으므로 요청 세션/컴포넌트 수명·응답 세대를 Web에서 결속한다. 세션 키별 editor와 abort/generation으로 이전 GET/PUT/412의 상태·부모 draft callback을 새 세션에서 폐기한다. 편집 후 GET은 입력을 덮지 않고 저장 ACK 이후 추가 편집은 미저장으로 구분한다. 새 버전/다음 If-Match와 기존 412 명시 복구를 유지한다.
- 중간 수정의 StrictMode 반복 effect 반례1 FAIL을 게시 전에 확인·수정했다. 실제 main.tsx의 StrictMode를 유지하며 폐기된 effect가 비동기 lock을 선점하지 않게 유효한 초기 조회만 시작한다. 이 중간 실패를 원래 제품의 추가 결함으로 집계하지 않는다.
- 독립 테스트는 세션 교체/조회 중 입력/지연 PUT의 부모 callback/저장 중 추가 편집/이전 412 폐기/StrictMode/조회 실패·명시 재시도7건이다. 기존 FocusScreens18(메모412·기록 왕복 포함)/CADENCE4와 합쳐 **29 PASS**, TypeScript/Vite build와 추가 시험 타입 검사 PASS. JS DOM/모의 HTTP이며 실제 Server/DB/Chrome 수용이 아니다. Server 생산·Note API·RC2/legacy-lock·의존성이 같으므로 기존 증거를 재사용하고 새 MySQL을 불필요하게 기동하지 않는다. 원본 `.local/note-scope-20261101/`, 새 HEAD/PR/CI는 로컬 result와 PR 본문을 참조한다.
- #62/#63/#66/#67 및 Core/Content/Shorts는 변경/복사하지 않는다. 신규 저장소·계약·메모 기능 재구현은 없다. 노트의 세션 변경 시 이전 미저장 입력을 다른 세션으로 이전하지 않으며 영구 임시보관 기능을 주장하지 않는다. 실제 Core/Content/Chrome/Native·제품 수용 NOT_RUN, `MVP_FINAL_COMPLETE=false`; Approve·Draft 해제·Merge 금지 유지.

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
