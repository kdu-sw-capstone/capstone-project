# Wire·D06·복원

모든 신규 메시지는 `schema.json`의 strict type이다. legacy Event1.2/Snapshot1.1·1.2/Journal1.1/APPLY_POLICY 및 guest/member D06의 exact raw bytes와 sender 검사를 보존한다. 신규 stream은 기존 endpoint/actor에 섞지 않는다.

| stream | schema_version | 방향/용도 |
|---|---|---|
| RUNTIME_POLICY | AMVP_RUNTIME_PACKAGE_1 | Server/local compiler→Core 정책 |
| RUNTIME_USAGE | AMVP_BROWSER_USAGE_1 | Core immutable segment→Server |
| RUNTIME_REPORT | AMVP_RUNTIME_REPORT_1 | Core actual evidence→Server |
| ADDITIONAL_CONTENT | AMVP_CONTENT_1 | Core→Content control/역방향 result |
| ADDITIONAL_EVENT | AMVP_ACCESS_EVENT_1 | Core event→Server |
| FOCUS_CONTROL | AMVP_FOCUS_CONTROL_1 | 검증된 Web/Server→Core coordinated focus actor |

capability는 stream version·활성 feature·artifact SHA·revision·expiry에 결속한다. 서버 catalog가 executor 검증 기록을 확인하고 receipt를 발급하며 client 주장만 믿지 않는다. 지원되지 않으면 시작/갱신 **전에 전체 거절**, 기존 적용중 owner claim은 새 발급 실패만으로 해제하지 않는다. 구형 extension/server에 신규 enum을 보내지 않고 UNSUPPORTED 상태와 업데이트 필요 안내를 노출한다.

## 식별자·해시·sender

physical installation/executor는 같은 설치 범위를 나타내되 토큰의 실제 executor ID만 신뢰한다. owner_binding_id는 로그인 principal 기간, owner_epoch는 전환 fencing, runtime_execution_id는 장기 실행 identity, boot ID는 재기동 관측용으로 별도 local metadata다. collector_epoch/seq는 durable continuity이며 Worker 재생성만으로 초기화하지 않는다. native 재연결과 새 document는 scope_epoch/generation을 갱신하지만 원장 ID를 재발급하지 않는다.

canonical hash 후보: UTF-8 JSON, key codepoint 정렬, 공백 없음, Unicode NFC 미적용(이미 field별 normalization 완료), 정수만 사용, 배열순서보존. hash 대상에서 자기 payload_sha256/semantic_sha256만 제외하고 나머지 field를 포함한다. control semantic hash는 payload의 channel_credential와 semantic_sha256을 제외하며 request_id는 transport root이므로 제외된다. 인증 proof·token·원본 URL은 hash 문서/로그에 출력하지 않는다. 서로 다른 언어 구현은 fixtures canonical bytes와 digest를 일치시킨다. canonical 정수 전용 프로파일은 수치형 모델 confidence를 이 메시지에 포함하지 않으므로 float 직렬화 차이를 피한다.

Content sender 검증은 browser 제공 sender.id==본 extension, 실제 sender.tab.id/frameId/documentId와 Native 검증 navigation URL digest·승인 origin·document_instance_id를 모두 대조한다. frame0만 제어, iframe은 새 capability 없으면 미지원. message body tab/url은 증명이 아니다. channel_credential은 Core가 검증된 문서에만 내리고 document/epoch별 rotate하며 외부 Web·native caller에게 노출하지 않는다. page world window.postMessage는 명령 authority가 아니다. externally_connectable/native host allowlist/실제 origin 검사는 기존 경계를 유지한다.

## 정상 시퀀스

1. Server/local store config 저장 → 새 runtime revision·검증된 receipt+package 원자 발행 → UI SAVED/PENDING.
2. Core는 durable intent/claim 예약 → native sender/current document 재검증 → DNR compile/Content APPLY; 같은 operation_id·semantic hash로 retry한다.
3. Content는 scope를 비교하고 claim journal을 효과 **전** 예약 → observer 설치/eligible target 적용 → 각 option evidence 반환. RECEIVED는 APPLIED가 아니다.
4. Core는 효과 footprint·native 재조회·Content 증거를 합쳐 report APPLIED/UNKNOWN/FAILED를 저장하고 item ACK 이후 outbox 완료한다. UI는 actual applied revision을 별도 표시한다.
5. RELEASE는 정확한 owner/binding/generation의 claim만 정상 복원 → remaining own claims0과 footprint 확인 → RELEASED. focus END는 다른 runtime owner를 건드리지 않는다.

## 실패·중복·순서

- request_id는 전송별 UUID, operation_id는 같은 의미 작업 불변. 재전송 ACK 유실 시 QUERY/status 선행, 동일 의미는 기존 receipt 반환. 같은 operation ID 다른 hash→IDEMPOTENCY_CONFLICT, 실행 안 함.
- owner_epoch/generation/control_seq가 오래되면 STALE_* NACK, 최신 효과를 덮어쓰지 않는다. 동일seq/hash는 receipt 재송신, 같은seq/다른hash거절, seq gap은 dependency 대기·QUERY 후 복구. UPDATE는 snapshot replacement이며 승인된 이전 claims 제거를 먼저 예약; 다른 owner cleanup 불가.
- 시험 목표 timeout5초, backoff1/2/4/8초±20% jitter/max30초, UI10초후 UNKNOWN 제안이다. alarm/타이머 지연이 실제 효과 성공을 뜻하지 않는다. 무한 blind APPLY 대신 reconcile; END가 진행중이면 새 UPDATE 차단.
- storage 실패면 효과 시작 전 중지. 효과 후 receipt 저장 실패는 IN_DOUBT, footprint 조회로 복구하고 원장/receipt를 지우지 않는다. owner별 unresolved claim 상한1024 제안, 상한 도달은 신규 적용 거절; unresolved를 LRU로 제거 금지.
- release proof가 불명확하면 RELEASE_FAILED/RELEASE_PENDING, session PAUSED/ENDED 확정 금지. old scope cleanup은 기존 claim digest와 단기 cleanup grant에만 허용하고 새 policy 적용 권한 없음.

## DNR·DOM·Journal 공유 경계

Core가 논리 claim registry와 물리 DNR rule ID allocator를 단독 소유한다. 기존 rule IDs를 재사용하지 않고 실제 registry와 충돌 검사 후 stable mapping을 저장한다. 구체 숫자 범위·Chrome quota budget은 윤종민 승인 필요다. focus/runtime 각각 독립 add/removeAll을 호출하면 안 된다. 하나의 compiler가 유효 claim 합집합을 만들고 updateDynamicRules 결과 및 현재 rules를 대조한다. 특정 site ALLOW로 allowAllRequests를 발행해 global quota/adult/block-window를 우회하지 않는다. 새 navigation DNR과 기존 document/media 통제 증거는 별개다.

Content는 DOM 원래값과 claim 소유자 set을 저장한다. A와 B가 같은 요소를 가리면 A release 후 B 효과 유지; 마지막 claim에서만 원본 복원. 사이트가 스스로 바꾼 style/property를 무조건 옛 값으로 덮어쓰지 않는다. observer/listener/media 상태도 claim 자원이며 BFCache pagehide/freeze/reentry에서 stale observer를 중복 생성하지 않는다. cleanup 불가능한 detached element는 원장에 종료 증거를 남기고 current doc와 혼동하지 않는다.

Journal1.1은 직접 확장/재작성하지 않는다. 신규 `amvp_journal_v1` sidecar에 claim/command/seq/outbox/transfer 상태를 transaction으로 저장하고 legacy focus journal과 조정하는 single writer를 둔다. 두 writer가 하나의 focus state를 소유하게 하지 않는다. coordinated focus extension은 승인 후 기존 actor의 공통 함수만 재사용하며 old actor가 새 상태를 읽지 않게 fencing한다.

Worker 복원은 durable cursor→실제 DNR/native/browser 상태 조회→current owner/doc validation→IN_DOUBT reconcile→수집 재개 순서다. Chrome 종료·강제 종료 동안 이용시간을 만들어내지 않는다. native/hash HELLO는 새 runtime 권한 승인이 아니며 artifact+owner+nonce 검증을 반복한다. Server offline은 로컬 durable 원장/정책을 유지, 인증 만료 시 새 정책 수령/업로드를 중단하되 미해제 효과를 거짓으로 해제했다고 표시하지 않는다.


capability supported/selected는 지원하는 stream만 포함하는 부분 map이며 빈 map은 거절한다. 특정 Core가 FOCUS_CONTROL/Content 미지원이어도 검증된 RUNTIME_USAGE 기능만 협상할 수 있다. 활성화할 package에 필요한 stream/feature의 교집합이 없으면 전체 package를 거절한다. supported_feature_ids와 selected_feature_ids를 별도로 비교한다. `wire-fixtures.json`은 APPLY/APPLIED→RELEASE/RELEASED와 UNSUPPORTED NACK의 완전한 합성 JSON이다. 실제 sender/효과 증거로 사용할 수 없다. FOCUS_CONTROL은 명시적 stream/schema_version/request_id/command envelope를 사용한다.


FOCUS_CONTROL envelope는 owner_binding_id/executor_id/owner_epoch/capability_receipt_id/execute_before를 필수로 포함한다. Server는 인증 context와 대조, Core는 로컬 current owner와 receipt를 대조한 후 command를 실행한다. 만료 명령은 실행하지 않고 status/reconcile한다. CapabilitySelection에도 owner/executor/epoch를 결속하여 로그인 전 receipt를 새 owner가 재사용하지 못하게 한다. cleanup_grant_id는 Core가 current binding 검증 후 사전 저장한 제한된 grant의 ID다. grant는 owner/binding/generation/footprint/허용 RELEASE 연산/expiry에 결속하며 page가 발급하거나 다른 scope로 전용할 수 없다. grant 만료 후 무조건 cleanup 성공으로 처리하지 않고 native 재검증을 통해 새 cleanup 권한을 받아야 한다.
