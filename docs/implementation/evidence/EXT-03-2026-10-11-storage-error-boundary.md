# EXT-03 · 수집 저장 장애 오류 경계 보완 · 0.1.18

담당 Core 종민, feature/extension-core-ext-02, 시작0ac9b0f, PR #17. 목표는 저장 장애 후 수집 중단·원문 보존·복구 시 잘못된 재개 방지를 검증하는 것이다. 개인 Core 약90% 추정 유지(전체 MVP/정식 AC/팀 통합 완료율 아님).

## 설계와 재현

AGENTS.md, 개발운영.md, 통합현황.md, tasks/EXT-03.md 및 설계 `05_데이터_복구.md` 로컬 저장 규칙을 확인했다. 저장 공간 부족 시 수집 성공을 가장하지 않고 신규 수집 중단/해제 절차를 진행하며 대기 원문은 자동 삭제하지 않는다. 기존 `11_인증_실행복구_가져오기_연결계약.md`의 종료 사유를 변경하지 않는다. AC-EXT-03-03 전체 완료 판정은 하지 않는다.

IndexedDB 연결이 열린 직후 닫히면 `db.transaction`이 InvalidStateError로 실패한다. 기존 MemberAccessStore는 transaction abort만 ACCESS_STORAGE_UNAVAILABLE로 변환했고 트랜잭션 생성 실패는 원래 DOMException을 그대로 전달했다. MemberExecutionLoop는 ACCESS_STORAGE_UNAVAILABLE만 수집 중단·fault 영속화·자기 규칙 해제 경로로 처리하므로 이 경계가 누락되어 있었다.

새 회귀 검사에서 수정 전 `InvalidStateError`로 기대 오류 코드와 불일치하며 실패하는 것을 확인했다. 이는 통제된 연결 종료 재현이며 실제 사용자 환경에서 같은 장애가 발생했다고 주장하지 않는다.

## 변경

- `extension/src/member-access.js`: open부터 트랜잭션 생성·완료까지 저장 API 실패를 기존 ACCESS_STORAGE_UNAVAILABLE로 변환한다. 열린 DB 연결은 finally에서 닫는다.
- 생성된 `extension/background/member-execution.js` 갱신. manifest 버전0.1.18.
- 기존 수집 중단/영속화/실제 자기 규칙 해제 절차로 연결한다. 저장 정상화 후에도 fault 세션은 자동 수집 재개하지 않는다. Server END 사유·API·owner·event ID·원문 저장 형식은 변경하지 않는다.
- 새 단위 검사: 닫힌 연결에서도 draft 보존 및 같은 event ID/seq로 저장 재시도; 실제 MemberAccessStore 실패가 loop의 영속 중단·자기 규칙 해제로 이어지고 외부 규칙 및 Server 종료 미확인 상태가 보존됨을 확인한다.
- 새 native 검사: `extension/tests/ui/member_access_storage_worker.py`.

## 이번 검증

- `npm --prefix extension run build:member-worker`: PASS.
- `cd extension && node --test --test-name-pattern='closed IndexedDB' tests/member-access.test.mjs`: 수정 전 1개 FAIL(InvalidStateError가 기존 저장 장애 코드로 변환되지 않음), 수정 후 관련 검사 통과.
- `cd extension && npm test`: 222/222 PASS. fake-indexeddb 및 대체 DNR/HTTP 기반 자동 검사다.
- `cd extension && npm run check`: JavaScript 구문 PASS(ESLint 아님).
- 최종 소스 정리/생성물 갱신 후 `node --test tests/member-access.test.mjs tests/member-execution-loop.test.mjs`: 32/32 PASS, 생성물 일치 포함.
- `python3 extension/tests/ui/member_access_storage_worker.py`: PASS. 실제 Chromium module Worker와 실제 IndexedDB를 사용한다. 연결을 닫아 트랜잭션 생성 오류를 주입하고, 원문 add 성공 뒤 transaction을 abort해 쓰기 실패를 주입한다. 두 경우 ACCESS_STORAGE_UNAVAILABLE, 기존 원문 보존, draft 유지, 새 Worker 생성 후 동일 ID로 복구 및 순번2(실패가 순번을 소비하지 않음), 원문 내 URL 경로/검색값 제외를 확인했다. 검사 최초 작성 시 너무 이른 abort 주입이 후속 put에서 TransactionInactiveError를 발생시켜 harness를 수정했고, add 성공 이벤트에서 abort하는 최종 검사가 통과했다.
- `git diff --check`: PASS.

실제 저장 공간을 고갈시키지 않았다. native 검사에서 네트워크는 로컬 JS 제공용이고 Server API를 호출하지 않는다. 설치형 MV3·실제 DNR 장애·실제 Server 및 Windows0.1.18 저장 장애는 미검증이다. 지난 Windows 정상 작동 회신은0.1.18/장애 검증 근거로 재사용하지 않는다. 팝업 코드는 변경하지 않았고 UI42/42는 과거 결과다.

## 잔여와 적용

기존 Windows 확장 로드 폴더에 최신 파일을 반영하고 chrome://extensions에서 새로고침하여0.1.18을 확인한다. 삭제/재설치/저장소 초기화는 필요하지 않다. 정상 시작·종료 회귀 확인 후 저장 장애 검증은 별도 테스트 프로필에서 진행한다. 사용자 자료를 지우거나 실제 저장 공간을 임의 고갈시키는 절차는 제공하지 않는다.

개인 잔여: 실제 MV3 미전송 재시작 및 저장 장애 확인, 발견 결함 보완. 팀 협업: Shorts/Core D06, 저장 오류 자동 END 사유, lifecycle local_seq/watermark/완전 수집 경계. 시작 지연 측정 보류. develop 미병합.
