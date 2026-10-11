# EXT-02 복구 오류의 Server RELEASE 조회 차단 수정

Core 종민 / feature/extension-core-ext-02 / 시작790d35a7d1a3f41704abd04d439dc2575d76e9aa. 사용자 요청: 새 Medium 회귀 자동 재현·수정·검증. candidate3 차단 문서의 요약을 읽었으며 독립 보고서 원문은 아직 미제공이다. 아래는 코드 기반 자체 재현이고 보고서 전체 조건 일치를 주장하지 않는다.

## 문제·수정

기존 tick은 recover 실패 시 client.commands 조회에 도달하지 않는다. 저장 APPLY Snapshot을 잘못되게 만든 뒤 최신 Server RELEASE를 대기시키면 INVALID_SNAPSHOT으로 종료하며 소유 규칙과 세션이 남는다.

member-execution-loop.js에서 적용 증거 관련 오류만 일시 수집하고 같은 tick을 RELEASE 전용으로 진행한다. 모든 새 APPLY는 그 tick에서 차단한다. 정상 인증으로 조회한 RELEASE는 기존 execute/context/scope/cleanup의 현재 session·executor·revision·journal 소유권 검사를 거친다. 성공적으로 로컬 해제된 해당 session의 오류만 제거하고 보고를 flush한다. 유효 RELEASE가 없거나 해제 실패면 오류를 계속 노출하고 RUNNING을 허용하지 않는다. 다른 저장/네트워크/인증 오류는 일반 성공으로 바꾸지 않는다. recovered 표시도 제거해 접근 수집을 허용하지 않는다.

Snapshot 원문을 고치거나 활성 unsupported 기능을 허용하지 않는다. foreign 규칙을 삭제하지 않는다. Server enum/API/종료 사유, Guest/D06/A0 코드는 변경하지 않는다. generated bundle은 source로 재생성했다.

## 회귀·실제 실행

새3개 시험을 수정 전 실행해 3개 FAIL을 확인했다(복구 INVALID_SNAPSHOT이 RELEASE 처리보다 먼저 발생). 수정 후 관련 member loop29/29, 전체 LF237/237 PASS. 추가 Snapshot 변이3종은 source_version0·다른executor·다른owner이며 유효 RELEASE/해제보고1회·foreignrule 보존·재적용0·원문보존을 검사했다. stale Server revision은 STALE_COMMAND, 다른 journal executor는 JOURNAL_SCOPE_MISMATCH로 규칙 삭제/해제 성공보고 없이 거절된다.

최종 전체237/237은 마지막 RELEASE-only pass 고정 변경까지 포함한다. Linux 별도 CRLF 파일 복사본 전체237/237 PASS, JS구문/build/diff 검사 PASS. fake-indexeddb·모의DNR/HTTP 기반 자동 검증이며 실제 Windows/Chrome/Server HTTP/MySQL 시험이 아니다.

## 변경·한계·다음

제품2개: extension/src/member-execution-loop.js, extension/background/member-execution.js. 회귀1개: extension/tests/member-execution-loop.test.mjs. 근거 문서·EXT02 카드·통합현황 추가. manifest0.1.20 유지, 새 수정 SHA로 구분한다.

독립 재리뷰·보고서 원문 대조·실제 Windows CRLF/Chrome 변조 복구·HTTP/격리MySQL 미실행. c746 사용자Windows234/Chrome 정상복구 근거는 과거 코드 결과로 보존하고 신규 SHA 검증으로 승격하지 않는다. RELEASED 로컬 phase와 Server 접수/최종 UI는 구분되며 정상 상태 표시는 후속 tick에서 확인해야 한다.

기존 Core 약90% 추정 유지. 결함 자체 자동 회귀는 완료, 독립 판정·실통합은 남음. D06 candidate3는 Schema/자료누락 최종확인 및 sender 선행 gate 대기. develop 미병합.

## 최신 독립 재리뷰 결과 접수

[다훈 회신 REVIEW PASS·출처·남은 검증](EXT-02-independent-release-review-pass.md). Windows LF/CRLF 각238·반례34·잘못RELEASE4·HTTP/격리MySQL3 통과 회신. 과거 NOT RUN은 당시 기록으로 보존하며 이번 독립 판정 접수로 갱신한다. 실제Chrome 실패/sender 및 A0공동승인 미완료·develop 미병합.
