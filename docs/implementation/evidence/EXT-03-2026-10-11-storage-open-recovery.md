# EXT-03 · 저장소 열기 실패 후 연결 정리 · 0.1.19

담당 Core 종민, 브랜치 feature/extension-core-ext-02, 시작04f5167, PR #17. 목표: 저장소 open이 blocked 오류를 반환한 뒤 늦게 성공해도 사용하지 않는 연결을 남기지 않고, 전송함 연결 오류를 기존 저장 장애로 안내한다. 개인 Core 약90% 추정 유지(전체 MVP/정식 AC/팀 통합 완료율 아님).

## 기준과 재현

AGENTS.md, 개발운영.md, 통합현황.md, tasks/EXT-03.md 및 설계 `05_데이터_복구.md`의 저장 실패 시 원문 유지·마이그레이션 실패 원본 보존 규칙을 확인했다. 기존 owner 고정·자료 보존을 유지한다.

네 회원 저장소의 onblocked는 Promise를 reject하지만 IndexedDB open 요청 자체는 취소되지 않는다. 이전 연결이 닫힌 뒤 open이 성공하면 reject된 Promise로 resolve를 시도하면서 그 DB 연결이 사용/정리되지 않았다. 이 연결은 이후 upgrade/delete를 막을 수 있다. 수집함·전송함·실행 journal·보고함에서 같은 경계를 재현했다. 또 MemberEventStore의 transaction 생성 실패가 InvalidStateError 그대로 전달되어 기존 전송 저장 오류 안내로 분류되지 않았다.

추가한 `member-storage-open.test.mjs`는 수정 전 5/5 FAIL, 수정 후 5/5 PASS였다. blocked 재현은 테스트용 빈 version1 DB 연결을 유지하고 테스트 IndexedDB adapter에서 version2 open을 요청하는 방식이다. 제품 DB 버전을 변경하는 구현이 아니다.

## 변경

- MemberAccessStore, MemberEventStore, MemberJournalStore, MemberReportStore는 open이 blocked로 거절된 사실을 기억하고, 늦은 onsuccess의 DB 연결을 즉시 닫는다. 실패한 작업을 다시 성공으로 반환하거나 데이터 쓰기로 재개하지 않는다.
- MemberEventStore는 open/transaction 생성·완료 오류를 기존 MEMBER_STORAGE_UNAVAILABLE로 변환한다. 기존 MEMBER_STORAGE_BLOCKED는 구분해 보존한다. 기존 런타임의 전송 저장 오류 안내로 연결된다.
- generated member-execution.js 갱신, manifest0.1.19. 제품 DB version/스키마·API·이벤트 ID/원문·Server 종료 사유는 변경하지 않는다. 기존 사용자 자료 삭제/관리 정책 수정 없음.
- 실제 IndexedDB 검사에 네 저장소의 blocked→늦은 성공→후속 upgrade 성공 시나리오를 추가했다.

## 이번 실행 결과

- `npm --prefix extension run build:member-worker`: PASS.
- `cd extension && node --test tests/member-storage-open.test.mjs`: 수정 전5/5 FAIL, 수정 후5/5 PASS. fake-indexeddb 기반이며 late connection이 닫혔는지 및 이후 upgrade를 막지 않는지 확인했다.
- `cd extension && npm test`: 227/227 PASS. 제품 런타임의 대체 DNR/HTTP 및 fake-indexeddb 검사 포함.
- `cd extension && npm run check`: JavaScript 구문 PASS(ESLint 아님).
- `python3 extension/tests/ui/member_access_storage_worker.py`: PASS. 실제 Chromium module Worker/IndexedDB에서 기존 연결 종료/쓰기 abort 원문·draft·순번 보존과 Worker 재생성 복구 유지. 네 저장소 모두 실제 blocked 이벤트 후 늦게 열린 연결을 닫고 다음 upgrade 성공을 확인했다. 빈 테스트 DB의 version1→2→3은 fixture이며 제품 마이그레이션 검증 완료를 의미하지 않는다.
- `git diff --check`: PASS.

실제 저장 공간 고갈·설치형 MV3·실제 Server·Windows0.1.19 장애는 미검증이다. native 검사에서 HTTP는 JS 제공용으로만 사용한다. 제품 팝업 코드를 수정하지 않았고 UI 검사를 이번에 재실행하지 않았다. 이전 Windows 정상 회신을 최신 버전/장애 검사 성공으로 확대하지 않는다. AC-EXT-03 전체 완료 판정 없음.

## 잔여 및 적용

기존 Windows 확장 폴더에 최신 파일 반영 후 chrome://extensions 새로고침,0.1.19 확인. 기존 폴더·연결·원문을 보존하며 재설치/저장소 초기화는 하지 않는다. 정상 집중 시작/종료 회귀와 실제 미전송 Worker 복구 확인이 다음 실제 검증이다. 저장 장애는 별도 테스트 환경에서 검증한다.

개인 잔여: 실제 MV3 장애·재시작 검증, 발견 결함 보완. 팀 협업: Shorts/Core D06, 저장 오류 자동 END 사유, lifecycle local_seq/watermark/완전 수집 경계. 시작 지연 측정은 보류한다. develop 미병합.
