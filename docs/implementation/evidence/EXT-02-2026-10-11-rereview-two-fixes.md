# 독립 재리뷰 후 잔여 CRLF·회원 복구 보완

2026-10-11 KST / EXT-02 / 종민 / PR17 / 시작0db954a. 사용자 전달 FIX REQUIRED 요약을 기준으로 두 건을 보완했다. 독립 보고서 원문은 미제공이므로 전체 재현 조건 일치를 주장하지 않는다. 기존140조건/HTTP·격리MySQL PASS는 다훈의 보고이며 이번 자체 실행 결과가 아니다.

## 변경

- tests/member-execution-loop.test.mjs: checkout된 generated bundle의 CRLF를 LF로 정규화한 후 deterministic builder와 비교. 실제 내용 비교를 유지하며 원문 비교 검사를 삭제하지 않는다. 기존 생성기 입력 CRLF fixture도 유지.
- src/member-execution-loop.js: recover 시작부터 UNCONFIRMED로 두고 실제 session ID/executor, 저장 APPLY command/session/revision, 전체 frozen Snapshot/owner/executor/snapshot ID, journal scope/revision/Snapshot 원문 일치를 RUNNING 표시 전에 검증. command 만료 시각으로 기존 실행을 재적용하지 않는다. 검증 실패 시 재적용·RUNNING 표시 없이 오류를 전파하며 수상한 journal 규칙 소유권을 추정해 삭제하지 않는다. Server API/종료 사유/원문은 변경하지 않는다.
- background/member-execution.js: source로 재생성.
- 회귀: Snapshot source_version, Snapshot executor/owner, command executor, Server executor, journal executor 변이 6가지에 대해 새 Worker가 RUNNING을 표시하지 않고 규칙 추가를 반복하지 않는지 확인.

## 실제 실행

- npm --prefix extension run build:member-worker PASS.
- npm --prefix extension test: LF 전체234/234 PASS.
- /tmp 별도 extension 복사본의 JS/MJS/JSON을 CRLF로 바꾸고 npm test: 전체234/234 PASS. Linux에서 CRLF 파일 checkout을 모사한 검사이며 실제 Windows 실행은 아님.
- npm --prefix extension run check: JS 구문 PASS, ESLint 아님.
- git diff --check PASS.

처음 새 회귀는 Server executor 변이에 기존 client가 INVALID_SESSION_RESPONSE로 거절하여 기대 오류 목록이 누락된 1건 실패였고, 기대 목록에 해당 기존 거절을 포함한 뒤 전체 재실행 PASS. 오류를 숨기거나 production 성공 처리를 변경한 것은 아니다.

## 미검증·다음 행동

실제 Windows CRLF checkout, 실제 Chrome MV3 복구, Server HTTP/격리 MySQL 재실행, 독립 보고서 원문 대조는 남는다. 복구 검증 실패 시 owned cleanup/Server 처리의 추가 요구 여부는 보고서와 재리뷰에서 확인하며 임의 runtime END 계약을 추가하지 않았다.

기존 Guest·회원·추가 MVP·D06 문서 보존. 제품 Core↔Content 연결 없음, A0 계약 별도 승인 대기. 수정본 독립 재리뷰 요청 후 실제 Chrome 통합까지 develop 병합 보류.

## 후속 사용자 검증

[Windows CRLF·Chrome 정상 복구 후속 근거](EXT-02-user-windows-crlf-chrome-recovery.md). 앞의 미검증은 수정 당시 상태로 보존한다. 후속 Windows234/234 및 정상 Chrome 부분 확인과, 여전히 남은 변조시험·독립 재리뷰를 구분한다.
