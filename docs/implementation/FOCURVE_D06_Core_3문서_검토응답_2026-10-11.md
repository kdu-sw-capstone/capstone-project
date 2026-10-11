# D-06 첨부 3문서에 대한 Core 검토 응답

2026-10-11 KST / 윤종민 Core / feature/extension-core-ext-02 / PR #17.

**Core 측 검토 의견이며 공동 승인이나 제품 연결 착수 선언이 아니다. U-01~U-08은 모두 미합의로 유지한다.** 사용자 요청에 따른 독립 Core 결함3건만 별도로 수정했다. Content/추가MVP 코드를 보존했고 develop 병합·자동병합은 하지 않는다. 문서 작성 당시의 “제품 수정·Commit 없음”은 첨부의 과거 작업 이력으로 읽었으며 이번 사용자의 별도 결함 수정 요청과 구분했다.

## 1. 실제 대조 기준

| 대상 | 고정 기준 |
|---|---|
| 첨부의 Core 및 이번 시작 | 33d382882b2295d6e576fd2f97c453bd80a3b3f2 |
| Core 결함 수정 코드 | **e23d74b5bee9bccec18b5c761155db11a3a23798**, 제품0.1.20 |
| 첨부 Content | bcca67412711507aa04cf01dc33ce2808e28e2e5 |
| 검토 중 갱신된 PR21 | **c0a167410e82091e26d8f2f0e995e7702b32d7de**. 새 Content 재검토 문서/작업 기록만 추가, extension/content 제품 코드 변화0 |
| 공용/Server 대조 | 원격 develop **90ad32be5d282f3b44c917a29e156dffc5e29187**. 로컬 origin/develop76df34e와 구분하고 고정 Git object를 읽음 |

PR21 제품 코드는 git show로 읽었고 별도 문서 갱신을 fetch해 확인했다. checkout/merge/PR21 수정은 하지 않았다. Content 최신 회신은 이전 Core5c6064a 코드까지 대조한 문서이므로, 이번e23d74b 전체 검사 수정과 후속 registry도 다음 공동 검토에서 다시 대조해야 한다.

첨부 원본은 수정하지 않았다. SHA-256:

- 세부메시지계약 확정안: ea233078e3fafa4badfd67aa71a8a9a686974600a093310288b52b9b0500982d
- 종민·지민 구현 체크리스트: 0ae794a6cc3cb9fee15fc43e809ccab935896cf5349c0c1d77a61577e843e04a
- 통합검증 수용기준: 045586eec66a7cacab27fd0464ce30200905fade59b94442ee55ca6193664523

AGENTS.md·개발운영·통합현황·EXT-02/POLICY-03 카드, AC-EXT-02/POLICY-03/EVENT-03 및 develop D06/D07·Snapshot/API/Event/Journal을 대조했다. 근거 코드: Core manifest/service-worker, host-policy/site-store/session-core, site-controller/site-rules/member-execution-loop/client/member-access/member-events/document-control-registry; Content controller/shorts/changes/entry/features; Server SnapshotValidation/SiteInput/ExecutionService.

## 2. 그대로 적용 가능한 원칙

F-01~F-10의 책임/권한 분리, frozen 전체 행 선택, 활성 미지원 부분 성공 금지, owner·revision·원문 보존, 한 접근 한Event·즉시 차단, ALLOW와 전역 제한 분리, 실제 해제 확인,1.2 신규발급 OFF 원칙에 동의한다. “그대로 적용”은 기존 원칙 동의이며 현재 Core↔Content 제품 연결이 지원된다는 뜻이 아니다.

P 중 최소 정책 projection·Core 주도 QUERY·문서별 단조 seq·직렬 실행/epoch·처음 불변 응답과 QUERY 분리·모든 applied_binding cleanup 보존·증거와 transport ACK 분리 방향에 동의한다. 명칭/필드/상한/기한/집계는 아래 U 승인 후 구현한다. Core Snapshot 검사 수정은 공유 메시지 validator가 아니다.

## 3. U별 의견: 현재 충돌과 권장 대안

| U | 판단 | 현재 코드와 충돌하는 이유 | Core 권장 대안 / 다음 결정 |
|---|---|---|---|
| **U-01** type/version·QUERY·주입 | 방향 적용 가능, schema 수정·실제 시험 필요 | manifest에 Content 주입/scripting이 없고 product receiver도 없다. Content controller는 library API뿐이다. rc1-proposal과 새 Content draft4는 서로 다른 제안 버전이다. Content가 자기 Chrome documentId를 검증해 알고 있다고 가정하면 안 된다 | Core 주도 QUERY, static classic isolated singleton+기존 탭 주입 방향 수락. c0a1674의 target_document_id echo/content_instance_id 제안을 추가 검토 대상으로 수락한다. echo/instance는 인증 증거가 아니며 실제 대상 routing·sender·registry가 권한을 보장한다. null QUERY는 BOUND에서도 owner/session/result 원문을 반환하지 않는다. 하나의 버전/QUERY schema 및 sender metadata 가능성을 세 명이 고정한 후 A를 시작한다 |
| **U-02** schema·seq/cache·limits | 수정/대안 및 시험 필요 | DocumentControlRegistry.stage는 내부 reference/scope/intent/sequence의 영속 foundation이다. wire policy/round/canonical 원문·Content cache/inflight는 아직 없다. 내부 operationLimit256은 공유 wire 승인값이 아니다 | key 순서 무시/array 순서 보존, commit 후 dispatch, 문서 lifetime high-water, QUERY 비실행 원칙 수락. eviction 뒤 seq≤high-water는 STALE_CONTROL 단일 거절안 권장(RESULT_EVICTED 필요성부터 결정). 높은 seq로 과거 ID 재사용을 탐지하려면 durable ID↔semantic fingerprint 보존이 필요하다. 상한에서 신규 APPLY를 막고 RELEASE/QUERY/의무 보존은 계속 허용한다.16KiB/64/256·3초/10초·backoff/retention은 시험 후보만, 전체 envelope UTF-8와 cleanup 별도 예산을 합의한다 |
| **U-03** R0/무대상/부분실패/runtime 보고 | 초기 집계 방향 적용 가능, 회원 runtime은 합의 전 차단 | 현재 SiteController/loop는 DNR와 열린 탭 확인만으로 APPLIED를 보고한다. Content aggregate/generation이 없다. Server ACKNOWLEDGED command에 새 보고는 REPORT_CONFLICT, UNCONFIRMED는 RUNNING을 끝내지 않는다 | 시작 R0/generation/대상없는 readiness는 실제 효과와 구분, 전체 필요 대상 확인 후 단일 RUN 시작. 후속 문서 의무를 지우거나 늦은 과거 성공으로 집계하지 않는다. runtime 실패는 새 APPLIED/UNCONFIRMED를 옛 command에 보내지 않는다. local owned cleanup·마지막 신뢰 관측 보존과 사용자 MANUAL/정상 EXPIRED는 현행 경로로 유지한다. 자동 FEATURE 실패 종료 사유·interval/reconcile 매핑은 다훈 승인/실제 HTTPDB 재현 전 구현하지 않는다. APPLY_FAILED/MANUAL로 runtime 실패를 위장하지 않는다 |
| **U-04** logical rule_id/DNR | 수정 필요 | 회원 Snapshot site_id는 Server 양수10진 문자열이며 guest는 UUID다. 예시의 site UUID를 모든 profile에 강제하면 회원 정책을 거절한다. Core DNR ID1/100000은 현 구현값이며 공용예약이 아니다 | 논리 키 feature:<snapshot_id>:<원래 site_id>:YOUTUBE_SHORTS 방향 수락, ID를 변환/재발급하지 않는다. 문서/binding 의무와 별개다. 매칭 없는 site_id:null/비활성 policy의 rule_id null 허용 여부 또는 제어 불필요 분기를 schema에 명시한다. 논리 키를 Event1.2에 새 필드로 넣지 않는다. 전역 프로필의 키는 별도 승인 |
| **U-05** media0/coverage/복원 | 보수안 적용 가능, Content 보완·실제 시험 필요 | shorts.apply는 viewer가 있고 video가0이면 pause 반복문이 비어 SUPPORTED일 수 있다. status/changed는 전체 실제 효과/해제 증거가 아니다. Changes.restore는 예외 없이 반환하면 entry를 지우며 잔여 owned 값 검증이 없다 | media0는 hide 즉시 유지하되 OBSERVING→TIMED_OUT/UNCONFIRMED, 성공 보류. 일반 페이지0/0은 observer 등록+scan 완료+coverage 오류 없음의 NOT_APPLICABLE이며 Shorts 접근0. 전체 viewer 숨김/inert·연결 media 모두 paused를 실제 재검사한다. 복원 후 owned 잔여를 검증하고 실패 ledger를 보존한다. 페이지 후속 unrelated 변경은 유지한다. observer/timer/effect listener/notice와 안전 lifecycle guard 수명을 구분한다 |
| **U-06** observation·freeze/late·RECORD | 수정/대안 및 세 명 합의 필요 | MemberAccessCollector는 SITE commit에서 즉시 consume해 seq/원문을 저장한다. FEATURE round/candidate writer는 없다. MemberAccessStore 원문 DB와 MemberEventStore 전송함은 서로 다른 DB라 문자 그대로 하나의 IDB transaction으로 둘을 동시에 commit할 수 없다 | FEATURE 참여 접근은 한 Core draft로 SITE/FEATURE 증거를 모아 단 한 writer가 freeze한다. 첫 차단은 즉시, 저장 barrier와 분리. 권장 대안은 기존처럼 draft종결+seq+불변 원문을 한 transaction, 그 원문을 durable replay source로 두고 같은 ID/body로 전송함에 멱등 복사, 실제 receipt 보존 후 원본 정리다. 하나의 물리DB 통합이 필수라면 별도 migration/원본 보존 승인 필요. timeout/소멸 시 confirmed reason만 저장할지, RECORD와 실패Shorts 공존, late 진단·품질 조회는 다훈 결정까지 보류. 같은 observation의 ACK 재전송과 후속 상태의 새 observation ID를 구분하고 Event 새 ID를 만들지 않는다 |
| **U-07** 자동item/query/같은기능 이동 | 보수 제외 원칙 적용 가능, 실제 판별 합의 필요 | entry.mjs는 URL의 경로 종류만 알며 사용자 의도를 증명하지 않는다. Core native before/commit는 명시 transition/재렌더 제외가 있지만 SPA 기능 진입과 연결돼 있지 않다. click.isTrusted 단독으로 자동 navigation을 배제하지 못한다 | 초기 주입/QUERY/Mutation/선반/차단안내refresh/자동 item은 새 접근0. 최초 범위는 trusted Core traversal과 결속된 일반→Shorts/직접/검증 reload·back-forward만 후보로 정한다. query/fragment와 Shorts→Shorts는 확인 근거가 없으면0/별도 보류. 명시 후보를 승인하기 전 기존 nav에 붙여 새 접근을 기록하지 않는다 |
| **U-08** BFCache/inactive/GONE/해제 | 원칙 적용 가능, 구현·실제 시험 필요 | registry.observe는 교체 문서를 INACTIVE로 유지하고 confirmGone은 실제 소멸 근거가 필요하다. Content에는 pagehide/pageshow guard가 없다. controller.scan의 URL 변경 release→apply는 보호 공백·ledger 의무 손실 가능성이 있다 | 교체≠GONE, send 실패≠RELEASED. dormant ledger와 원래 applied_binding을 유지한다. 페이지 재활성 전 QUERY/rebind guard를 합의하고 실제 BFCache에서 검사한다. 같은 문서 SPA b1/b2가 하나의 DOM ledger를 공유할 수 있어 ledger↔bindings 연결을 유지하고 전체 의무 복원 시에만 해제 성공. A는 한 활성 문서 한정, 교체/휴면 발생 시 미확인·cleanup으로 종료하며 BFCache 전체 지원으로 표시하지 않는다 |

U-03/U-06/U-07/U-08은 다훈의 Server/집계 결정이 필요하다. U-01/U-02/U-04/U-05도 Core·Content의 방향 일치만으로 세 명 공동 승인이 완료된 것으로 표시하지 않는다.

## 4. 수정 JSON 예시 — 검토용, 미구현/미합의

아래는 rc1 제안에 대한 수정 후보다. Content draft4와 자동 fallback/호환을 선언하지 않는다. 가상 값이며 schema 확정/제품 지원을 뜻하지 않는다.

### U-01: Core→Content 미결속 QUERY, target echo는 인증 아님

```json
{"request_id":"77777777-7777-4777-8777-777777777777","type":"D06_CONTENT_CONTROL","owner_context":null,"payload":{"contract_version":"d06-shorts-rc1-proposal","operation_id":"88888888-8888-4888-8888-888888888888","operation":"QUERY","context":null,"target_document_id":"44444444-4444-4444-8444-444444444444"}}
```

```json
{"request_id":"77777777-7777-4777-8777-777777777777","status":"OK","data":{"contract_version":"d06-shorts-rc1-proposal","operation_id":"88888888-8888-4888-8888-888888888888","operation":"QUERY","target_document_id":"44444444-4444-4444-8444-444444444444","content_instance_id":"99999999-9999-4999-8999-999999999999","binding_state":"UNBOUND","current_control_seq":0,"current_operation_id":null,"current_result":null},"error":null}
```

새 instance는 기존 document의 새 권한을 만들지 않는다. 기존 의무가 있으면 임의 seq 초기화/새 APPLY 대신 registry·현재 문서·잔여 ledger를 재검사한다. BOUND null QUERY 응답의 최소 필드는 U-01에서 따로 고정한다.

### U-04: 회원 site_id는 원래 숫자형 문자열

```json
{"request_id":"77777777-7777-4777-8777-777777777777","type":"D06_CONTENT_CONTROL","owner_context":"MEMBER:42","payload":{"contract_version":"d06-shorts-rc1-proposal","operation_id":"88888888-8888-4888-8888-888888888888","operation":"APPLY","control_seq":1,"context":{"session_id":"11111111-1111-4111-8111-111111111111","policy_snapshot_id":"22222222-2222-4222-8222-222222222222","executor_id":"33333333-3333-4333-8333-333333333333","desired_revision":1,"document_id":"44444444-4444-4444-8444-444444444444","navigation_id":"55555555-5555-4555-8555-555555555555","binding_id":"66666666-6666-4666-8666-666666666666"},"observation_round_id":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","policy":{"format_version":"1.2","site_match_strategy":"MOST_SPECIFIC_HOST","source_version":1,"site_id":"123","site_version":1,"target_host":"www.youtube.com","matched_policy_host":"youtube.com","access_policy":"ALLOW","feature_policies":[{"feature_code":"YOUTUBE_SHORTS","enabled":true}]},"rule_id":"feature:22222222-2222-4222-8222-222222222222:123:YOUTUBE_SHORTS"}}
```

현재 Core0.1.20의 SITE-only profile은 이 활성 Shorts를 여전히 거절한다. 이 예시는 합의 후 projection 후보이며 gate 제거 허가가 아니다.

### U-02/U-08: 해제 재시도는 새 operation/seq, 원래 적용 binding 보존

```json
{"request_id":"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb","type":"D06_CONTENT_CONTROL","owner_context":"MEMBER:42","payload":{"contract_version":"d06-shorts-rc1-proposal","operation_id":"cccccccc-cccc-4ccc-8ccc-cccccccccccc","operation":"RELEASE","control_seq":3,"context":{"session_id":"11111111-1111-4111-8111-111111111111","policy_snapshot_id":"22222222-2222-4222-8222-222222222222","executor_id":"33333333-3333-4333-8333-333333333333","desired_revision":2,"document_id":"44444444-4444-4444-8444-444444444444","navigation_id":"55555555-5555-4555-8555-555555555555","binding_id":"dddddddd-dddd-4ddd-8ddd-dddddddddddd"},"applied_binding_id":"66666666-6666-4666-8666-666666666666","rule_id":"feature:22222222-2222-4222-8222-222222222222:123:YOUTUBE_SHORTS"}}
```

## 5. 체크리스트 검토

- G-01/G-04 미완료. 숫자·enum·strict schema·ACK 의미 및 합의 문서 해시/일시/예외가 필요하다. 승인란을 채우지 않았다.
- G-02: 독립3건 수정코드는e23d74b, 자동 근거 확보. 재리뷰·실제 Windows/Chrome는 남는다. CO-01은 현재 SITE-only 전체 검사 기반까지 보완했으며 Content 활성 profile 완료가 아니다.
- CO-02~14/CT-01~10은 새 product adapter·주입·sender·seq·의무·효과/복원 구현이 필요하다. foundation 재사용은 제품 완성을 뜻하지 않는다. 기존 Content 추가 기능을 삭제/새 필수wire에 무조건 포함하지 않는다.
- CO-15~18/CT-11~14 및 SV-01~05는 U06/03/07/08 승인과 실제 Event/Server 검증에 맞춰 별도 단위로 진행한다. 회원 SITE outbox 경로 재사용과 FEATURE 단일 freeze 확장은 구분한다.
- G-03의 README/통합현황 merge 충돌은 이번에 해결/merge하지 않았다. 원격 문서가 새로 갱신됐으므로 실제 병합 시점에 다시 조율한다.
- 공통 기록 기능 ID는 EXT-02/POLICY-03/EVENT-03, 코드수정은 Core. 기존 담당자 배정은 바꾸지 않는다.

## 6. 통합 수용 기준 검토

D06-T01~T28 및 S/A/B/C/H/U 구분 방향에 동의한다. 전체 ID는 새 wire 기준으로 **NOT RUN** 유지한다. 이번233개 Core 검사나 Content 과거33개/사용자 과거6단계를 신규 D06 PASS로 옮기지 않는다. T03/T04는 Core 독립 guard 조각의 A 근거를 새로 확보했지만 전체 C/H/공유 메시지 조건은 없다.

추가/수정할 oracle:

1. T01/T02/T05/T26: target_document_id echo 위조·다른 content_instance·BOUND null QUERY에서 비밀/정책/결과 원문 미반환, bootstrap 두 번과 실제 sender metadata를 시험한다.
2. T03/T04: 회원 숫자 site_id/guest UUID, source/site/content MAX·MAX+1·missing/null, 목적/정책 불일치, disabled false 보존, null 거절, 활성 추가 기능 부분 적용0을 포함한다. CRLF/LF 동일 bundle과 Windows 절대경로/공백 경로/cwd 변경을 별도 검사한다.
3. T09/T11: 완료 cache와 durable 의무 분리, eviction 이후 stale 단일 오류, 높은 seq 과거 ID 재사용, 용량 가득 찬 뒤 RELEASE 수용 및 미정 상한의 실측을 포함한다.
4. T12/T14/T23: 침묵하는 DOM setter/restore 예외 후 ledger 유지, 페이지 후속 스타일 보존, b1/b2 shared ledger 및 BFCache dormant 해제/재활성 guard를 검사한다. sendMessage timeout을 소멸로 승격하지 않는다.
5. T18/T19/T25: SITE 원문 freeze 전 crash, 원문 commit 이후 outbox 복사 전 crash, 복사/Server ACK 유실 후 crash를 구분한다. 원문·ID 불변과 한 receipt/한 access를 확인한다. RECORD/late/failure 처리는 U06 승인값을 oracle로 사용한다.
6. T24: ACK command 새 report의409 및 RUNNING UNCONFIRMED 미종료를 실제 격리HTTPDB에서 재현하고, 승인된 안전 END 경로와 last-trusted interval을 확인한다. 아직 Server 테스트를 실행하지 않았으며 코드 대조 근거다.
7. T28: D01/D05 전체 자동재개·절전 복구는 별도 NOT IMPLEMENTED 범위, SW 재생성 성공으로 대체하지 않는다.

## 7. 이번 결과와 다음 최소 단위

Core 독립 수정: **0.1.20 / e23d74b**, 전체 자동233/233·구문·CRLF fixture PASS. 상세는 [수정 근거](evidence/EXT-02-2026-10-11-core-defects-three.md). 이번 문서 JSON4개 문법/U8개 누락/참조/diff만 별도 검사한다. 실제 Windows/MV3/YouTube/Content/HTTP/MySQL 및 D06 새 기능 테스트는 NOT RUN, product D06 wiring은 NOT IMPLEMENTED다.

먼저 구현할 최소 단위는 **A: 승인된 guest 한 활성 문서 Shorts 제어**. 공통 schema·QUERY instance/sender·단조 seq/불변 cache·실제 viewer/media/owned 복원 증거와 A 문서 교체 시 중단 기준을 세 명이 확인한 뒤 주입→QUERY→APPLY→RESULT→RELEASE를 구현한다. A에서는 접근 Event/OBSERVE_ACCESS/회원 성공 보고를 만들지 않는다. 초기 무대상·runtime Server·freeze·자동이동·BFCache 확대는 B/C/D 승인 gate로 남긴다.

개인약90%는 기존 Core SITE 구현/안정화 추정에 한정한다. 새 D06 연결 단위A~D는 미착수/합의 대기이며 90%에 포함해 완료로 표시하지 않는다. 이번 사용자 요청에 따른 검토·독립 결함 수정은 완료, 공동 승인·제품 통합은 미완료다.

PR 링크: [Core #17](https://github.com/kdu-sw-capstone/capstone-project/pull/17), [Content #21](https://github.com/kdu-sw-capstone/capstone-project/pull/21). 이 회신을 종민의 의견으로 취합하고 지민·다훈 의견 및 승인표를 맞춘 뒤 구현한다. 동료에게 자동 메시지를 보내지 않았다. develop 미병합.
