# Wire·D06·복원

모든 신규 메시지는 `schema.json`의 strict type이다. legacy Event1.2/Snapshot1.1·1.2/Journal1.1/APPLY_POLICY 및 guest/member D06의 exact raw bytes와 sender 검사를 보존한다. 신규 stream은 기존 endpoint/actor에 섞지 않는다.

| stream | schema_version | 방향/용도 |
|---|---|---|
| RUNTIME_POLICY | AMVP_RUNTIME_PACKAGE_1 | Server/local compiler→Core 정책 |
| RUNTIME_USAGE | AMVP_BROWSER_USAGE_2 | Core immutable segment→Server |
| RUNTIME_REPORT | AMVP_RUNTIME_REPORT_1 | Core actual evidence→Server |
| ADDITIONAL_CONTENT | AMVP_CONTENT_2 | Core→Content control/역방향 result |
| ADDITIONAL_EVENT | AMVP_ACCESS_EVENT_1 | Core event→Server |
| FOCUS_CONTROL | AMVP_FOCUS_CONTROL_1 | 검증된 Web/Server→Core coordinated focus actor |

capability는 stream version·활성 feature·artifact SHA·revision·expiry에 결속한다. 서버 catalog가 executor 검증 기록을 확인하고 receipt를 발급하며 client 주장만 믿지 않는다. 지원되지 않으면 시작/갱신 **전에 전체 거절**, 기존 적용중 owner claim은 새 발급 실패만으로 해제하지 않는다. 구형 extension/server에 신규 enum을 보내지 않고 UNSUPPORTED 상태와 업데이트 필요 안내를 노출한다.

## 식별자·해시·sender

physical installation/executor는 같은 설치 범위를 나타내되 토큰의 실제 executor ID만 신뢰한다. owner_binding_id는 로그인 principal 기간, owner_epoch는 전환 fencing, runtime_execution_id는 장기 실행 identity, boot ID는 재기동 관측용으로 별도 local metadata다. collector_epoch/seq는 durable continuity이며 Worker 재생성만으로 초기화하지 않는다. native 재연결과 새 document는 scope_epoch/generation을 갱신하지만 원장 ID를 재발급하지 않는다.

canonical hash 후보: UTF-8 JSON, key codepoint 정렬, 공백 없음, Unicode NFC 미적용(이미 field별 normalization 완료), 정수만 사용, 배열순서보존. hash 대상에서 자기 payload_sha256/semantic_sha256만 제외하고 나머지 field를 포함한다. control semantic hash는 payload의 channel_credential와 semantic_sha256을 제외하며 request_id는 transport root이므로 제외된다. 인증 proof·token·원본 URL은 hash 문서/로그에 출력하지 않는다. 서로 다른 언어 구현은 fixtures canonical bytes와 digest를 일치시킨다. canonical 정수 전용 프로파일은 수치형 모델 confidence를 이 메시지에 포함하지 않으므로 float 직렬화 차이를 피한다.

Content→Worker의 browser sender와 Worker→Content의 발급 채널은 아래 방향별로 구분한다. browser가 실제 제공하지 않은 sender.tab을 만들어내거나 body의 scope를 발신자 증거로 쓰지 않는다. frame0만 제어, iframe은 새 capability 없으면 미지원. message body tab/url은 증명이 아니다. channel_credential은 Core가 검증된 문서에만 내리고 document/epoch별 rotate하며 외부 Web·native caller에게 노출하지 않는다. page world window.postMessage는 명령 authority가 아니다. externally_connectable/native host allowlist/실제 origin 검사는 기존 경계를 유지한다.

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

Core가 논리 claim registry와 물리 DNR rule ID allocator를 단독 소유한다. 기존 rule IDs를 재사용하지 않고 실제 registry와 충돌 검사 후 stable mapping을 저장한다. 구체 숫자 범위·Chrome quota budget은 윤종민 승인 필요다. focus/runtime 각각 독립 add/removeAll을 호출하면 안 된다. 하나의 coordinator가 유효 claim 합집합을 만들되 SESSION과 DYNAMIC을 각각 조회·변경하고 전체 복원 의무를 조정한다. 서로 다른 저장소의 변경을 단일 원자 transaction으로 가정하지 않는다. 특정 site ALLOW로 allowAllRequests를 발행해 global quota/adult/block-window를 우회하지 않는다. 새 navigation DNR과 기존 document/media 통제 증거는 별개다.

Content는 DOM 원래값과 claim 소유자 set을 저장한다. A와 B가 같은 요소를 가리면 A release 후 B 효과 유지; 마지막 claim에서만 원본 복원. 사이트가 스스로 바꾼 style/property를 무조건 옛 값으로 덮어쓰지 않는다. observer/listener/media 상태도 claim 자원이며 BFCache pagehide/freeze/reentry에서 stale observer를 중복 생성하지 않는다. cleanup 불가능한 detached element는 원장에 종료 증거를 남기고 current doc와 혼동하지 않는다.

Journal1.1은 직접 확장/재작성하지 않는다. 신규 `amvp_journal_v1` sidecar에 claim/command/seq/outbox/transfer 상태를 transaction으로 저장하고 legacy focus journal과 조정하는 single writer를 둔다. 두 writer가 하나의 focus state를 소유하게 하지 않는다. coordinated focus extension은 승인 후 기존 actor의 공통 함수만 재사용하며 old actor가 새 상태를 읽지 않게 fencing한다.

Worker 복원은 durable cursor→실제 DNR/native/browser 상태 조회→current owner/doc validation→IN_DOUBT reconcile→수집 재개 순서다. Chrome 종료·강제 종료 동안 이용시간을 만들어내지 않는다. native/hash HELLO는 새 runtime 권한 승인이 아니며 artifact+owner+nonce 검증을 반복한다. Server offline은 로컬 durable 원장/정책을 유지, 인증 만료 시 새 정책 수령/업로드를 중단하되 미해제 효과를 거짓으로 해제했다고 표시하지 않는다.


capability supported/selected는 지원하는 stream만 포함하는 부분 map이며 빈 map은 거절한다. 특정 Core가 FOCUS_CONTROL/Content 미지원이어도 검증된 RUNTIME_USAGE 기능만 협상할 수 있다. 활성화할 package에 필요한 stream/feature의 교집합이 없으면 전체 package를 거절한다. supported_feature_ids와 selected_feature_ids를 별도로 비교한다. `wire-fixtures.json`은 APPLY/APPLIED→RELEASE/RELEASED와 UNSUPPORTED NACK의 완전한 합성 JSON이다. 실제 sender/효과 증거로 사용할 수 없다. FOCUS_CONTROL은 명시적 stream/schema_version/request_id/command envelope를 사용한다.


FOCUS_CONTROL envelope는 owner_binding_id/executor_id/owner_epoch/capability_receipt_id/execute_before를 필수로 포함한다. Server는 인증 context와 대조, Core는 로컬 current owner와 receipt를 대조한 후 command를 실행한다. 만료 명령은 실행하지 않고 status/reconcile한다. CapabilitySelection에도 owner/executor/epoch를 결속하여 로그인 전 receipt를 새 owner가 재사용하지 못하게 한다. cleanup_grant_id는 Core가 current binding 검증 후 사전 저장한 제한된 grant의 ID다. grant는 owner/binding/generation/footprint/허용 RELEASE 연산/expiry에 결속하며 page가 발급하거나 다른 scope로 전용할 수 없다. grant 만료 후 무조건 cleanup 성공으로 처리하지 않고 native 재검증을 통해 새 cleanup 권한을 받아야 한다.

## RC2 C-01/T-04: 하나의 Cleanup 순서 계약

NORMAL control_seq는 1..9007199254740991 정수, gap은 의존 대기/조회 후 복구한다. 상한에 도달하면 새 정상 APPLY/UPDATE를 거절하고 승인된 새 generation 전까지 증가·wrap·0 재사용하지 않는다. CLEANUP_ONLY는 **RELEASE만 control_seq=null**이며 정상 cursor를 소비하지 않는다. null은 면책 권한이 아니다. Core·Content가 같은 Control/ContentResult Schema와 다음 규칙을 쓴다.

1. 효과 전 durable Binding·정확한 owner/generation/full scope·Footprint hash에 연결한 grant와 고정 cleanup operation_id/receipt_id 및 각각 한 슬롯을 예약한다. grant에 실제 scope를 포함한다. receiver는 grant registry에서 receipt를 찾고 body가 임의 지정한 receipt를 신뢰하지 않는다.
2. sender와 정확한 old document/grant/expiry/기존 claim을 대조한다. NORMAL 권한이나 다른 owner RELEASE로 전용할 수 없다. cleanup 예약 소진·저장 실패는 새 효과를 거절하고 기존 복원 의무를 보존한다. 예약/미해결 receipt를 LRU로 지우지 않는다.
3. cleanup INTENT를 예약 슬롯에 기록한 후 자기 효과만 제거한다. 응답 유실은 같은 operation_id/semantic hash 재전송+QUERY; 같은 ID 다른 hash/다른 lane/다른 scope는 거절한다. receipt 저장 실패는 IN_DOUBT이며 원장을 지우지 않는다. 재조회로 자기 잔여0을 확인한 뒤 같은 receipt를 확정한다.
4. 만료 grant는 새 적용 권한을 주지 않는다. Native 재검증 후 동일 예약 identity의 권한 갱신 또는 명시적 승계 기록이 필요하고 중복 제거 이력을 잃지 않는다. 예약이 없거나 검증 불가하면 RELEASE_PENDING; 복원 성공을 위조하지 않는다.

이 후보는 기존 positive-seq D06에 호환 주입하지 않는다. v2 capability를 확인한 전용 stream만 사용한다. wire-fixtures의 null RELEASE/APPLIED 금지와 BLUR/KEYWORD 해제도 같은 lane을 사용한다. 합성 CleanupLane 시험은 실제 storage 원자성·권한 발급 증명이 아니다.

## RC2 C-03: 메시지 방향별 검증 책임

| 방향 | 신뢰 가능한 증거/검증자 | 금지/실패 처리 |
|---|---|---|
| Worker→Content | Content가 own extension ID·검증된 private Port 등록·Worker 발급 channel credential·현재 document scope/epoch/generation 대조 | sender.tab 필수 가정 금지; page world/body tab·URL 불신 |
| Content→Worker | Worker가 browser MessageSender id/tab/frame/documentId와 실제 Native/navigation URL digest·등록 origin·private channel 대조 | body의 tab/url로 sender를 대체하지 않음 |
| Content 응답→Worker | tabs.sendMessage의 pending call에 저장한 tab/document/frame/request/op/hash와 응답 scope, 호출 전후 current navigation 재검증 | Promise 응답에 독립 sender가 있다고 가정 금지; 별도 메시지는 위 행 적용 |
| Worker→Core | 같은 Worker 내부 trusted call과 선행 인증 결과를 전달하는 명시적 어댑터 | body sender='worker'만으로 권한 부여 금지 |
| Core→Native | host allowlist·등록 확장 origin·연결 handle·대상 installation/binding/operation 결속 | 새 native actor/명령 지원을 가정하지 않음 |
| Native→Server | 고정된 endpoint/TLS·기존 설치 증명·owner와 operation scope 인증 | Chrome MessageSender를 전송받았다고 신뢰하지 않음; 미지원 hop 거절 |

SPA/BFCache 후 generation이 다르면 정상 적용/ACK 거절. old-scope Cleanup만 정확한 기존 document와 제한 grant를 Native로 재검증한 경우 예외이며 새 scope에 APPLY 불가. `verify_direction`의 trusted flag는 테스트 어댑터 입력이지 wire 필드가 아니다. 실제 Chrome/Native 증거 검증은 미실행이다. 근거: [MessageSender](https://developer.chrome.com/docs/extensions/reference/api/runtime#type-MessageSender), [Chrome messaging](https://developer.chrome.com/docs/extensions/develop/concepts/messaging).

## RC2 C-04: Session/Dynamic DNR

기존 focus claim은 SESSION을 유지한다. 새 상시 navigation claim은 tabIds/excludedTabIds가 없는 경우 DYNAMIC 후보, tab-bound 정책은 SESSION이며 재시작 재조정 대상으로 분리한다. focus를 자동으로 dynamic에 옮기지 않는다. 승인된 legacy runtime claim의 저장소 이전만 별도 transition plan으로 허용한다. DOM과 DNR의 복원 의무는 별도다.

- 키는 `(rule_store,rule_id)`이다. 같은 숫자가 다른 store에 있어도 독립 claim이며 owner/claim/generation·full rule hash·writer epoch를 모두 저장한다. 등록되지 않은 관측 규칙은 삭제·채택 금지.
- 신규 예약 범위 후보 SESSION 100000..999999 / DYNAMIC 1000000..1999999. 기존 채택 규칙은 범위 밖이어도 증거를 유지한다. 전 규칙을 조회하여 충돌을 피하고 실제 runtime quota·regex/unsafe budget·다른 기능 소비량·복원 여유를 검사한다. 참조 모델 5000/1000 등의 인자는 시험값이며 Chrome 지원 한도를 확정하지 않는다.
- 기존 writer의 모든 updateSessionRules/remove/getSessionRules().length 경로를 공통 guard로 직렬화·fence한 후에만 채택한다. epoch는 Chrome 자체 보안 장치가 아니다. 구 writer가 adapter를 우회할 수 있으면 신규 공유 DNR 활성화 금지. 현행 제품 코드는 이번 PR에서 바꾸지 않았다.
- getSessionRules/getDynamicRules 각각 조회→소유 증명과 전체 rule 대조→durable PREPARED/cleanup 예약→target 적용·재조회 확인→source의 자기 claim만 해제→receipt 확정. 두 API 사이 crash에는 양쪽 claim/IN_DOUBT를 유지하고 target을 재확인한 후 재개한다. target 유실이면 source를 삭제하지 않는다.
- Focus END는 focus owner만 해제하고 runtime·다른 owner·미관리 규칙을 보존한다. 저장 실패 전에는 효과를 시작하지 않고, 해제 효과 후 저장 실패면 의무를 유지하여 재조회한다. 같은 rule 공유자는 마지막 claim에서만 물리 삭제한다.
- 브라우저 재시작은 SESSION 소멸과 DYNAMIC 유지가 서로 다르다. 확인된 재시작+실제 조회로 SESSION_STORE_RESET을 기록하되 DOM/Native 미해결 의무까지 지우지 않는다. Worker 재생성만으로 SESSION이 비었다고 가정하지 않는다. writer epoch 갱신 후 stale writer를 거절한다.

두 store 안의 API 변경 원자성과 store 사이의 원자성은 다르다. 공식 수명·조건·조회/변경 API는 [Chrome DNR API](https://developer.chrome.com/docs/extensions/reference/api/declarativeNetRequest)에 따른다. fake banks 시험은 실제 Chrome 적용·quota·writer fencing 검증을 대신하지 않는다.

## 최종 교차 검증 보완 (4309b26 이후)

Cleanup의 reserved_receipt_id는 grant/operation과 일대일로 예약한다. 다른 grant가 같은 Receipt를 공유할 수 없으며 완료 Receipt를 지워 새 권한으로 재사용하지 않는다. 만료 후 revalidate는 Native와 exact old document 검증 및 기존 owner/Binding/full scope/Footprint/operation/receipt 일치가 모두 필요하다. 권한만 갱신하고 슬롯·INTENT·완료 Receipt를 초기화하지 않는다. 참조 모델의 valid/verified flag는 검증 어댑터를 흉내 낸 fixture 입력이며 실제 TTL·서명 검증이 아니다.

DNR 채택도 새 claim을 쓰기 전에 cleanup 예약이 필요하다. 예약 소진은 관측된 기존 규칙과 legacy 복원 의무를 그대로 두고 채택을 거절한다. capacity는 미해결 의무 수이며 정상 해제 Receipt 확정 후에만 해당 예약 예산을 반환한다. IN_DOUBT에는 반환하지 않는다. 확정된 중복 제거 이력은 별도로 보존하므로 예산 반환이 Receipt eviction을 뜻하지 않는다. 저장소 이전도 source claim 정리 확인 후 source 예산만 반환한다.

sender.id와 구성된 own extension ID가 둘 다 없으면 일치가 아니다. scope·private channel 증거가 비었으면 거절한다. scope/URL·tab·document·generation을 body가 꾸며도 현재 신뢰 문맥을 대체하지 못한다. 이 판정은 합성 어댑터 시험이며 실제 Native/Chrome sender PASS가 아니다.

**QUERY_OPEN / REVIEW_PENDING**: Control에는 QUERY 형상이 있지만 기존 RC2 참조 모델은 projection을 읽다 KeyError가 났고 대상 operation hash·QUERY 자체 hash·응답 상관관계가 완성되지 않았다. 현재는 QUERY_CONTRACT_REVIEW_PENDING으로 명시 거절하며 처리 성공을 주장하지 않는다. 권장안은 상태 변경 명령과 분리한 읽기 전용 target 조회이고 대안은 이 Revision의 QUERY 제거+기존 status/동일 요청 재전송만 사용이다. 어느 안도 이 수정에서 확정하지 않는다. 윤종민·채지민·김다훈이 target/request ID, hash, seq/null Cleanup 조회, 반환 Schema를 같은 SHA에 합의해야 한다. QUERY 의존 신규 executor 활성화는 금지하며 Cleanup 동일 요청 재전송 경로는 별도 시험으로 보존한다.
