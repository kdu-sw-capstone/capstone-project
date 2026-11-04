# IMPORT-01 · 가져올 자료 선택

단계: 필수 MVP · 설계 담당 영역: Web·Extension·Server

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

- 화면: EXT-01, SETTING-01
- 흐름: TF-11
- API: API-IMPORT-01, API-IMPORT-02, API-IMPORT-03, API-IMPORT-04
- 데이터: guest_import_batches, guest_import_items, focus_sessions
- 회원: 회원 Web·Extension
- 비회원: Extension 로컬
- 로컬: EXT 로컬 동일 검증/owner별 저장

원문: [화면](../../design/01_UX_기능설계/02_IA_화면명세.md) · [동작](../../design/01_UX_기능설계/03_동작규칙.md) · [API](../../design/02_시스템_테크설계/04_API_연동.md) · [데이터](../../design/02_시스템_테크설계/05_데이터_복구.md) · [검증 기준](../../design/04_검수_예시데이터/07_검증기준.md)

## 설계와 구현 대응

| 기준 ID | 기대 결과(기존 설계) | 코드 위치 | 검증 명령·환경 | 결과 |
|---|---|---|---|---|
| AC-IMPORT-01-01 | 선택 자료만 가져오고 원본은 원래 만료일까지 유지 | | | 미실행 |
| AC-IMPORT-01-02 | 로그인만으로 전송 없음, 타계정 재이전 거절 | | | 미실행 |
| AC-IMPORT-01-03 | 부분 성공/응답 유실 후 미완료만 재시도·중복 없음 | | | 미실행 |

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

## 2026-10-09 PR18 F2/N1 로컬 수정·회귀

김다훈(Server/API/DB), codex/server-event12-integration, 시작HEAD7dd7abce2bdb7f2d3dfda99c9874c4efb9cd041d 및 기존18파일 미커밋수정 보존. 상태: 가져오기 버전 결함 수정·HTTP/MySQL 재검증 통과, 독립 재리뷰/실제Extension 통합 대기. ImportedSession의 site/source/content 버전 guard·공통검사 및 새HTTP5개. Backend114/114·Frontend112/112·양쪽build PASS. Windows/Java21/MySQL3308repair_test, 합성 계정·이력; 실제 제품Chrome 아님. item 단위 rollback/별도item 부분성공/재요청 중복 방지·통계 회귀 확인. [위치·명령·증거·미검증](../PR18_F2_가져오기_수정검증_2026-10-09.md). 신규1.2발급OFF 유지. 전체AC/전체MVP 완료 아님, Commit/Push/PR변경 없음. 이전 이력 보존.


## Web owner·비동기 가져오기 수명 — 2026-11-01

- 김다훈 Web, `fix/additional-mvp-import-owner-lifetime`, 기존 관리형 Worktree 재사용. 시작 통합 **d386f170f79368907b2f5263a299c3e0d7c65ce8**. #72/#74는 병합 코드 그대로이며 #71 Content P2/#75 팝업과 다른 Worktree/index는 변경하지 않는다.
- TF-11/API-IMPORT-01~04의 로그인 자동 전송 금지·선택 자료/원본 hash·owner/executor·Server 처리 결과 결속·원본 보존을 유지한다. 기존 `GuestImports`가 owner 문자열만 비교해 A의 지연 history/batch401로 새 B 인증을 만료시키고 owner A→B→A에서 구 lock/자료를 공유했다. **신규3 반례 수정 전 FAIL → PASS**.
- owner별 내부 화면을 분리해 work lock/선택/자료를 새 owner와 공유하지 않는다. 각 비동기 load/list/submit의 성공과 catch를 generation에 결속하며 모든 Server GET은 정리 시 취소한다. 늦은 Chrome reply는 취소 성공으로 가장하지 않고 UI만 폐기하며 old owner의 후속 batch GET/성공 표시를 수행하지 않는다. Extension/Server의 미확정 전송·원장·복원 의무는 그대로이며 현재 미확정 submit의 명시 재확인/자동 재시도 금지도 유지한다.
- 신규8 + 기존 recovery3/result binding7/Settings7/MemberApp22 = **47 PASS**, 타입/Vite PASS. 동일 owner 부모 재렌더의 선택 유지, 구 history/batch/커서401, A→B→A, 현재401, 구 submit ACK 폐기, 현재 유효 payload/선택 hash/Server 확인을 검증한다. 기존 이전 owner reply 시험은 B에 old 오류를 표시하는 기대를 현재 B 제어 활성/구 오류 없음 검증으로 바꿨고 자료 미노출 assertion은 유지했다. 최초 실패와 기존 기대 불일치는 `.local/import-owner-20261101/` before/after/final-payload/build/result에 보존.
- 모두 jsdom/모의 Chrome messaging+HTTP·기존 SDK 시험이며 실제 가져오기·메일·Server 서비스·Native 실행이 아니다. production api.ts/인증·Server/DB schema·RC2/legacy-lock·Batch/Receipt·Wire payload·Core/Content 코드는 그대로다. 변경 없는 Server/DB의 기존 격리 결과를 재사용하고 불필요한 DB/서비스를 실행하지 않는다. 최종 HEAD·Push/Draft/CI는 PR 본문/result, 새 담당 리뷰/승인은 별도다. 실제 제품 수용 NOT_RUN, MVP_FINAL_COMPLETE=false.

> 후속 통합 CI 이력: 타 트랙의 #59/#75 병합으로 기준이3569911로 이동해 같은 자체5파일 blob을 유지하는 clean merge(a47f411)를 반영했다. a47f411의 [주 Web job124786283727](https://github.com/kdu-sw-capstone/capstone-project/actions/runs/41285650060/job/124786283727)은415 PASS/1 FAIL: 상속된 RecordPrimaryLifetime의 afterEach가 cleanup 전에 request.mockReset을 실행해 pending effect가 undefined.then을 호출했다. #74의 BehaviorRecords 제품 코드와 모든 기존 assertion은 그대로 두고 해당 시험에서 cleanup 후 mockReset을 명시하는2줄만 보완한다. 기존 글로벌 setup/인증을 바꾸거나 실패를 skip하지 않는다. 최초 로그는 `.local/import-owner-20261101/`에 보존하고 바뀐 시험 조건의 새 HEAD로 검증한다. 새 후보는 자체 시험 정리1파일이 추가되며 그 외 incoming Core/popup/Server/DB/계약은 그대로다.
