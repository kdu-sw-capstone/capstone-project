# Core 독립 결함 3건 수정 · 0.1.20

2026-10-11 KST / Core 종민 / feature/extension-core-ext-02 / 시작33d382882b2295d6e576fd2f97c453bd80a3b3f2 / PR #17. 사용자 요청: 첨부 D-06 문서 검토와 별도로 Core 결함3건 수정. U 승인/제품 Core↔Content 연결과 분리한다.

## F-17-01: whole Snapshot 누락

기존 SiteController는 format/executor/owner 일부와 사이트 host/정책만 검사했다. 시작 HEAD의 controller를 VM에서 실행해 source_version0, 잘못된 purpose, 비어 있는 content_policy도 DNR 추가/APPLIED가 되는 것을 재현했다. 재현 스크립트의 뒤쪽 old-loop 추출은 처음 문법 오류였고, loop 재현은 별도 정확한 함수 추출로 다시 실행했다.

host-policy.js에 현재 Snapshot1.1/1.2 전용 전체 검사 추가: 필수 UUID/owner/time/source_version, 사이트 ID/버전/이름/목적·정책/feature boolean, content policy version·rules/exceptions·image enum, legacy 중첩/중복 및 알려지지 않은 필드. 버전은1..MAX_SAFE_INTEGER이며 문자열/소수/null을 coercion하지 않는다. 회원 site_id는 양수10진 문자열, guest site_id는 UUID다. 정상 형식과 지원되는 활성 profile은 별개다.

SiteController.guard와 member requireSiteOnly는 전체 검사 후 SITE-only 활성 지원을 검사한다. Guest 새 frozen Snapshot은 명세의 owner_user_id:null 및 전체 disabled content_policy를 포함하고, DNR/상태 기록 전에 전체 검증한다. Guest 활성 복구에서는 executor가 현재 세션과 일치하고 owner가 null인지 추가 확인한다. 다른 executor로 바뀐 원문은 재작성하지 않고 규칙 해제·중단한다. 저장된 Snapshot 필드는 고쳐 쓰지 않는다. 활성 guest의 불완전/잘못된 Snapshot은 기존 소유 규칙 해제·보수 중단 경로로 처리한다. 과거 terminal 자료/이벤트/원문은 수정·삭제하지 않는다. 업그레이드 중 구형 불완전 활성 guest가 자동 재개된다고 보장하지 않는다.

## F-17-02: disabled false 거절

기존 requireSiteOnly는 feature_policies가 비어 있지 않으면 false도 FEATURE_NOT_IMPLEMENTED였다. 시작 HEAD 함수로 재현했다. 이제 전체 구조를 검사한 뒤 true인 알려진 미지원 기능만 FEATURE_NOT_IMPLEMENTED, null/missing/type/unknown은 INVALID_SNAPSHOT으로 거절한다. Guest site validation도 알려진 YOUTUBE_SHORTS false를 원문대로 보존하며 true는 계속 거절한다. 활성 Shorts를 제품 연결 없이 실행시키거나 gate만 제거하지 않는다.

## F-17-03: Windows CRLF 생성

기존 생성기 HEAD를 CRLF 입력으로 실행하면 import 제거 regex가 남아 Unsupported bundle import가 됨을 재현했다. source CRLF를 LF로 정규화한 뒤 변환하고, CLI entry는 fileURLToPath/resolve로 확인한다. 출력은 실행 cwd가 아닌 생성기 기준 URL에 기록한다. LF/CRLF 생성물이 정확히 동일함을 검사했다. Linux의 /tmp cwd에서 절대 경로 CLI도 실행했다. 실제 Windows Node/Git Bash는 NOT RUN이며 Windows 이식성을 검증완료로 승격하지 않는다.

## 이번 실행 증거

- npm --prefix extension run build:member-worker: PASS, 생성물 source와 동일.
- npm --prefix extension test: 최종233/233 PASS. fake-indexeddb·대체 DNR/HTTP 기반 A. 기존227개에 새6개 검사 추가(전체 검사 안에 다수 잘못된 Snapshot 변이/1.1·1.2 false·true·null 조합 포함).
- npm --prefix extension run check: JS 구문 PASS(ESLint 아님).
- node --test tests/site-controller.test.js tests/member-execution-loop.test.mjs: 61/61 PASS(guest 최종 검사 추가 전 실행, 이후 전체233에서 모두 재실행).
- 기존 valid fixtures는 실제 명세의 필수 메타데이터를 가진 fixture로 바꿨다. production이 누락 필드를 보충해 잘못된 입력을 통과시키도록 하지 않았다. old unsupported 검사는 실제 유효한 활성 Shorts 입력으로 바꾸고 malformed/null은 별도 검증했다.
- git diff --check: PASS.

실제 Windows/제품MV3/YouTube/Server HTTP·MySQL·D-06 연결/Content33개/UI42개는 이번 새 실행 없음. D06-T03/T04의 Core 검증 조각에 대응하지만 전체 신규 D06-T/기존 AC PASS가 아니다. 공유 메시지 validator·Content listener/주입·FEATURE_RESULT·OBSERVE_ACCESS·회원 Shorts 보고는 NOT IMPLEMENTED다.

## 범위 보존

Content PR #21 코드, Backend/Frontend, 추가 MVP, D-07 신규 Snapshot1.2 기본 OFF·executor allowlist는 변경하지 않았다. Event1.1/1.2 원문과 Server API/enum도 변경하지 않았다. 수정은 PR #17에만 반영한다. U-01~08 미확정, develop 병합/자동병합 없음. 개인 Core 기존약90%는 현재 SITE 구현/안정화 추정이며 D-06 연결 완료율이 아니다. D-06 구현 단위 A~D는 별도 미착수/합의 대기다.
