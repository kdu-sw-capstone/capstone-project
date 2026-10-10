# D-06 Core 재응답 — 필수 Shorts 연결

2026-10-10 / 윤종민 / feature/extension-core-ext-02 / EXT-02·POLICY-03·EVENT-03.

**Core 측 수락·수정 제안이다. 공동 합의 완료 문서가 아니다.** 지민의 재확인 및 다훈의 Server 관련 확인 전 제품 메시지를 구현하지 않는다. 이번 변경은 문서와 작업 기록뿐이며 develop 병합·자동병합 없음.

## 1. 대조 기준과 최신 Core 차이

- Content 응답/코드: **bcca67412711507aa04cf01dc33ce2808e28e2e5**. 요청 순서대로 검토응답 → Draft PR #21 본문/HEAD → Content_Shorts_2026-10-10.md를 확인했다. shorts.mjs/controller.mjs/changes.mjs도 고정 커밋으로 대조했다. Content 브랜치를 병합하지 않았다.
- Core 실제 코드: **5c6064a6e770b055741cc16fd87b41e844a987d0**, PR #17. 과거 초안 4e2f055와 지민이 대조한 b8bc7a 이후 회원 실행 loop가 추가됐다.
- 현재 member-execution-loop.js의 requireSiteOnly는 **비어 있지 않은 feature_policies 전체** 및 활성 global content를 거절한다. Guest site-store/session-core도 기능 연결이 없다. 거절만 제거하지 않는다.
- 최신 Core에는 회원 명령/사이트 DNR 실제 검증/별도 control·report IndexedDB/동일 보고 재전송/수동·만료 END/reconcile가 연결돼 있다. Content 의무 집합·통합 APPLIED·회원 탐색 Event 수집은 아직 없다. manifest에 content_scripts/scripting 없고 제품 FEATURE_RESULT receiver도 없다.
- access-store.js는 Guest BLOCK/RECORD에서 pending 후 SITE 이벤트를 즉시 원문 저장한다. ALLOW+Shorts 및 FEATURE 조회/반복 집계와 draft/freeze가 추가로 필요하다. 회원 수집도 별도 연결해야 한다.
- 공용 계약: develop **90ad32be5d282f3b44c917a29e156dffc5e29187** 기반 현행 FOCURVE_D01_D10_최종공용계약.md §7/미확정 기술안, 12_정책계약_이벤트12_호환성게이트.md, 검증기준 AC-POLICY-03-01~03/BOUND-19. 최신 Core에 이 develop 기준은 이미 병합돼 있다.
- AGENTS.md·개발운영.md·통합현황.md·tasks/EXT-02.md를 확인했다. 현행 복수 사유 계약과 BOUND-19의 옛 ‘우선 이유1건’ 문구 충돌은 아래 Server 확인 대상으로 남긴다.

## 2. 지민 §2 제안마다 재응답

| 제안 | Core 판단 | 이유·대안 / 남은 확인 |
|---|---|---|
| 정책 projection/책임 | 수락 | 가장 구체적인 frozen 사이트 전체 행만 선택. 부모 flags 합산 금지, 설정 변경은 다음 세션. matched_policy_host=null이면 access_policy=null, feature_policies=[] |
| 적용·해제 응답 | 수락 | OK는 처리 성공, data가 실제 효과. RELEASE_FAILED/APPLY_FAILED를 접수 거절 ERROR와 분리. Server enum으로 직접 복사 금지 |
| 새 문서/기존 탭 주입 | 수락 | classic isolated singleton 정적 주입 + scripting 기존 탭 주입. top-frame HTTPS youtube.com/www.youtube.com만 첫 범위. 번들/권한 변경 공동 리뷰 |
| ready/미결속 QUERY | 수정안 | 새 Content→Core ready type은 첫 단위에 추가하지 않는다. Core navigation/시작/복구에서 주입 확인→대상 documentId QUERY→정책 push. 미결속 QUERY는 owner/context=null 허용하되 Core→Content 전용이며 사용자 자료 반환 금지 (§3) |
| SPA 재바인딩 | 수락 | 같은 정책이면 release 없이 새 binding/round로 보호 유지. 기존 epoch 결과 발행 취소, 새 binding에서 재검사. route 선행 변화는 옛 nav로 보고 금지 |
| 문맥·control_seq | 수락 | 문서 수명 전체 단조 증가, owner/session/revision과 별개. sender/실제 탭·frame0·documentId·지원 host를 Core registry와 대조 |
| 멱등/충돌 | 수정안 | 불변 최초 응답/in-flight 공유 수락. 캐시 상한과 eviction 후 재실행 금지, QUERY 최신 상태 분리 (§4). cached 과거 응답은 현재 성공 집계에 사용 금지 |
| viewer/재생/복원 | 수락 | 관측 전체 viewer·media 검증과 소유 변경 복원 증거 필요. Content 현 status/changed만으로 성공 인정 불가 |
| 대상없음/관찰/실패 | 수정안 | NOT_APPLICABLE은 일반 경로 준비·링크 제어 검증 필요. Shorts media0는 성공 보류, OBSERVING→TIMED_OUT/UNCONFIRMED (§6) |
| 탐색·재렌더 | 수정안 | Core ID만 사용, 초기적용/Mutation/선반0. 자동 item/query/fragment는 첫 범위 새 접근으로 세지 않음. 사용자/자동 구분 못 하는 이동도 추측 금지, 별도 합의 (§6) |
| 초기 round/freeze | 수정안 | state/cause 수락. 초기 관찰 3초·명령 전체 10초를 시험 후보로 제안하되 합의 전 구현 금지. deadline은 Core 단조 경과시간과 영속 복구 경계로 관리 (§7) |
| 늦은 결과/소멸/유실 | 수락 | stale/frozen 결과 진단만. 실제 Chrome 문서 소멸 증거 필요. sendMessage 예외는 RELEASED 증거 아님. 잔존 binding 보존 |

## 3. 메시지와 QUERY 구체안 — draft-3-proposal

공용 요청 {request_id,type,owner_context,payload}, 응답 {request_id,status,data,error} 유지. 후보 type은 Core→Content D06_CONTENT_CONTROL, Content→Core FEATURE_RESULT/OBSERVE_ACCESS만. GET_STATE/계정 API를 Content에 개방하지 않는다. type/version 새 후보는 공용 D-06에 공동 반영 후 구현한다.

- APPLY/RELEASE는 operation_id·control_seq·context 필수. QUERY는 제어 순서 증가/적용/접근 생성 없음. QUERY operation_id는 요청 상관 ID이며 불변 실행 캐시에 넣지 않는다.
- 미결속 QUERY만 owner_context=null/context=null. Core가 지정한 실제 documentId에만 전송, Content는 sender.id=자기 확장 검증. Content→Core에서는 이 예외를 허용하지 않는다. QUERY 응답은 document_id와 current_control_seq, binding 상태만 반환하며 owner/토큰/정책 원문/개인 자료 없음. bound QUERY는 지민 §3.3 문맥 검증 유지.
- 문서 ID는 Chrome documentId 문자열 그대로이며 UUID로 재발급하지 않는다. 예시 UUID 형태는 가상 Chrome ID다. tab/frame은 신뢰한 Chrome 대상/receiver 정보, body로 인증하지 않는다.
- result_state: NOT_APPLICABLE/OBSERVING/APPLIED/UNSUPPORTED/APPLY_FAILED/RELEASED/RELEASE_FAILED. capability: SUPPORTED/UNSUPPORTED/UNCONFIRMED. effect: CONFIRMED/UNCONFIRMED. NOT_APPLICABLE은 viewer 제한 effect=UNCONFIRMED, 별도 coverage 증거로 일반 페이지 준비를 판단한다.
- observation.state: OPEN/CLOSED/FAILED/ABORTED/TIMED_OUT. state/cause와 result_state의 조합 검증. timeout은 OBSERVING+TIMED_OUT+UNCONFIRMED로 남기고 APPLIED/UNSUPPORTED로 바꾸지 않는다. 실행 실패는 APPLY_FAILED+FAILED.
- 접수 오류 후보: UNSUPPORTED_CONTRACT/INVALID_MESSAGE/UNKNOWN_DOCUMENT/STALE_CONTEXT/STALE_CONTROL/OPERATION_CONFLICT/OBSERVATION_CONFLICT/RESULT_EVICTED/RESOURCE_LIMIT. 안전한 고정 message만, raw stack 금지. 구현 전에 whitelist 함께 확정.
- FEATURE_RESULT는 observation_id·round_id별 실제 결과. ACK accepted는 Core 수용만 뜻하며 Event freeze/Server ACK가 아니다. stale/late ACK는 accepted=false, disposition=STALE_CONTEXT 또는 FROZEN_DIAGNOSTIC. 동일 내용 재전송은 최초 ACK 재응답, ID 충돌 ERROR.
- OBSERVE_ACCESS 최종 후보 필드는 보류한다. 첫 제어 단위에서는 발신하지 않고 관찰 binding으로 접근0 유지. 이벤트 단위 전에 필드·Core 탐색 신호·중복 키를 별도 공동 확정한다.

## 4. 명령 순서·캐시·Worker 복구

1. Core가 (installation,tab,frame,document) registry에 다음 seq/operation/context/의무를 **전송 전에 transaction commit**한다. safe positive integer, max Number.MAX_SAFE_INTEGER. owner/session 전환도 같은 문서 seq 증가. 소멸 후 다른 document에 seq 재사용 가능.
2. Content 문서 singleton이 직렬 실행한다. 정책 변경·release는 epoch 취소를 먼저 수행해 늦은 Promise가 재가림/보고하지 못하게 한다. 오래된 APPLY로 현재 RELEASE를 뒤집지 않는다.
3. 동일 operation ID+동일 의미 payload는 in-flight 공유 또는 최초 불변 data 응답(request_id만 교체). 동일 ID 다른 의미는 OPERATION_CONFLICT. 캐시를 먼저 확인해도 Core는 현재 seq/binding과 다르면 상태 집계에 사용하지 않는다.
4. 캐시 밖 seq<=high-water는 STALE_CONTROL, 재실행 금지. 캐시 항목을 제거해도 high-water는 문서 수명 동안 보존한다. seq가 크다고 미승인 owner/binding을 자동 수용하지 않는다.
5. 크기 후보: 메시지 UTF-8 JSON 16KiB, 문서별 실행 응답64개·관찰 ACK64개, FIFO 완료 항목 eviction, TTL 없음(문서 소멸 때 삭제). active 실행/현재 결과/release 잔여 변경은 eviction 금지. 공간 부족 RESOURCE_LIMIT, 활성 상태를 버려 성공하지 않는다. eviction된 동일 작업 재조회는 RESULT_EVICTED 또는 STALE_CONTROL, QUERY로 최신 확인. 배열 순서는 의미에 포함, 객체 키 순서 무시, unknown 필드 거절. 숫자/boolean/null 타입 변환 금지.
6. Worker 재생성 시 영속 registry와 document QUERY를 대조한 뒤 기존 세션/Server reconcile. seq 저장 실패/registry 상실이면 새 APPLY 금지, 복구 확인 상태. Content가 문서-local 잔여 제어를 보존해도 현재 RUNNING 추정 금지. QUERY 불일치도 임의 새 seq로 덮지 않고 해제/복구 절차로 처리한다.
7. RELEASE는 현재 종료 권한+원래 applied_binding_id로 검증한다. owner 전환 중에도 Core가 보존한 원래 의무의 cleanup만 허용하며 새 owner APPLY는 이전 cleanup 확인 전 금지. 실패 후 새 RELEASE operation/seq로 실제 재시도하고 과거 실패 응답은 캐시 유지.

## 5. 필수 문서 집합과 적용·해제 집계

**Core 제안, 회원 보고 매핑은 다훈 확인 필요.** 시작 시 검증된 Chrome 탭 목록의 살아있는 top-frame 지원 문서 중 frozen 선택행의 Shorts가 활성이고 SITE BLOCK에 가려지지 않은 문서를 필수 집합 R0로 영속한다. 비활성 정책/다른 host/subframe/Chrome 내부 페이지 제외. 선택 정책이 BLOCK이면 사이트 DNR과 열린 탭 전환을 검증하며 수행하지 않은 Content FEATURE를 추정하지 않는다.

- 일반 페이지는 adapter/observer 준비 및 존재하는 링크·선반 제한 검증(coverage)을 필수로 확인한다. 현재 viewer 없다고 Shorts 차단 접근을 생성하지 않는다. Shorts 경로는 viewer/media 실제 성공이 필수. 링크0은 정상 무대상일 수 있으나 adapter readiness 증거는 있어야 한다.
- R0의 교체 문서는 Chrome registry로 실제 교체 확인하고 원래 의무 DOCUMENT_GONE으로 종결, replacement가 지원/활성 대상이면 후속 의무를 추가한다. 열린 탭/문서 새 발생도 즉시 의무를 등록한다. 시작 완료 직전 registry generation 재검사해 그 시점까지 추가된 의무를 포함한다. 10초 후보 내 안정된 집합/결과가 없으면 미확인 종료, 무한 대기·moving target 성공 금지.
- 대상0이면 이 host DOM 결과는 NOT_APPLICABLE, 지원 adapter 패키지/validator 준비와 사이트 DNR 검증을 따로 수행한다. 이것을 ‘실제 Shorts DOM 성공’으로 표시하지 않는다. 전체 APPLIED 무대상 매핑은 다훈과 확인 후 제품 반영한다.
- 필수 살아있는 문서 하나라도 failed/unsupported/unconfirmed이면 전체 APPLIED 및 RUN interval 금지. 성공 문서와 DNR도 소유 범위 rollback, 모든 복원 확인 전 실패를 종료 성공으로 바꾸지 않는다. 실패·미확인 보고 매핑은 기존 Server 계약 확인 후 적용.
- 적용 이후 새 문서는 별도 지속 의무이며 최초 ACK 성공이 영구 보장을 뜻하지 않는다. 새 문서 실패/문서 복원 실패 시 실제 연속 실행 확인을 중단하고 gap을 RUN으로 보충하지 않는다. 회원 실행 상태·보고 변화는 다훈 확인 대상으로 분리한다.
- RELEASE 집합은 ‘현재 YouTube 탭’이 아니라 **소유 변경/활성 listener를 남긴 모든 applied_binding**이다. SPA로 일반 페이지가 되어도 복원해야 한다. 소멸 문서는 Core가 tab removal/active document 교체를 확인해 DOCUMENT_GONE으로 종결하고 Content RELEASED로 위조하지 않는다. BFCache/비활성 문서는 소멸이 아니므로 복원/재활성 guard를 별도 처리한다.
- release_evidence observer/timer/listener/notice 정리+owned_changes_restored=true+remaining=0, 또는 확인된 실제 소멸이 모든 의무에 필요. DNR 자체 제거·actual rules 부재도 독립 필수. sendMessage 실패/timeout은 미확인이다. 부분 복원 실패 원래 binding/Changes 자료 보존.

## 6. viewer·탐색 경계

media 없는 Shorts viewer는 최종 비재생 구조인지 지연인지 현재 코드로 증명할 수 없다. 따라서 첫 범위 APPLIED로 인정하지 않는다. 이미 가능한 viewer 숨김은 즉시 수행하고 media_present=false/playback_stopped=null, OBSERVING. deadline 후 TIMED_OUT/UNCONFIRMED. 지민이 안정적인 비재생 viewer 증명 기준을 제시하면 별도 수락 검토한다. media가 실제 존재하면 관측 전체 viewer 숨김/inert 및 연결된 모든 media pause 검증이 필요하다.

Core navigation_id는 실행 binding(초기접근0)과 실제 신규 진입을 구분하는 registry를 사용한다. 초기/재주입/QUERY/재렌더는 새로운 접근0. direct commit·실제 reload·검증된 history back/forward·일반→Shorts SPA 신규 진입은 현재 정책/실제 제한 확인 뒤 한 건 후보. Chrome commit/history 중복은 같은 traversal로 병합한다.

자동 Shorts item 이동, Shorts 내부 query/fragment 변화는 첫 범위 새 접근0 제안. 보호와 필요한 binding 갱신은 수행한다. 단순 onHistoryStateUpdated는 사용자 진입 증거가 아니므로 자동/명시를 구별 못 하면 기록을 추정하지 않는다. 사용자 클릭으로 Shorts→다른 Shorts를 별도 접근으로 셀지, 신뢰 가능한 최소 탐색 증거는 공동 보류. 기능 route 분류는 Core 메모리에서 URL을 사용할 수 있으나 전체 URL/query/영상ID를 메시지·저장·진단에 남기지 않는다. failed/cancelled/옛 nav error가 다음 nav를 지우지 않는 회귀 필수.

## 7. 초기 관찰·freeze·늦은 결과 — 다훈 협의

- 차단은 첫 유효 조건 즉시 수행한다. 초기 round는 APPLY/새 binding마다 Core 발급하며 round 종료와 미래 Mutation 보호 지속을 구분한다.
- 초기 관찰 deadline **3초**, 시작/해제 의무 집계 최대 **10초**는 측정용 제안값이다. execute_before/HTTP timeout과 다르며 계약 승인값이 아니다. 제어의 명령 유효기간보다 길게 허용하지 않는다. Worker 중단/복구 시 경과를 증명 못 하면 관찰 연장으로 성공 추정하지 않고 ABORTED/UNCONFIRMED.
- Core 관찰과 필수 해당 round들이 종결되고 현 binding 유효성을 재확인한 단일 transaction에서 draft 종료, event ID/seq·원문/outbox를 freeze한다. 성공 차단 증거가 없으면 성공 접근 이벤트0, 실패 진단은 별도 로컬 자료. SITE-only도 이 barrier로 연결해 선 저장 후 FEATURE 덧붙이기 금지.
- timeout/소멸일 때 **이미 확인된 사유만** 한 건으로 freeze하는 안을 다훈에게 제안한다. 전혀 확인된 차단 사유가 없으면 FEATURE 성공 기록 금지. RECORD 정책일 때 실패 기능과 RECORDED_ACCESS를 어떻게 보존할지도 다훈 확인 필요. 품질 필드는 현재 Event1.2에 임의 추가하지 않는다.
- freeze 후 late 결과는 로컬 bounded 진단만, same ID/body 변경 또는 새 ID 동일 접근 추가 금지. stale 결과는 정책/세션/이벤트 변경 금지. 중복 ACK 저장과 관찰 수용·freeze transaction의 race를 검증한다.
- target_host/target_key는 실제 bare host(www 유지), matched_policy_host는 선택행/null. 확인된 복수 blocked_reasons, 대표 USER_SITE→ADULT_DOMAIN→KEYWORD→FEATURE, FEATURE 포함 시 BLOCKED_FEATURE_ACCESS/FEATURE/YOUTUBE_SHORTS 유지.

다훈에게 확인할 항목: (S1) R0/대상0/NOT_APPLICABLE·부분 실패/런타임 새 문서 실패의 현행 보고·Journal 매핑, (S2) freeze barrier·timeout 확인된 이유만 저장 및 RECORD 공존, (S3) 늦은 진단의 조회 필요/공용 품질 확장 여부, (S4) BOUND-19 옛 문구 정리, (S5) Snapshot1.2 검증 executor gate·회원/비회원 실시험 cohort. 기본 OFF/기존 API·enum 유지. 이 문서는 Server 변경 승인이 아니다.

## 8. DNR 소유권 보완

Content는 필수 Shorts DNR을 만들지 않는다. 최신 Guest는 rules 시작 후보100000, 회원 SiteController는 후보1을 쓰며 둘 다 이미 점유한 ID를 건너뛴다. 실제 priority는 Snapshot1.2 100+호스트 깊이(legacy100). ‘100000 공통 예약 범위’로 표현하면 부정확하다. Core의 소유 rule 전체 구조 검증/선택 삭제를 유지한다. 추가 global 기능의 ID 예약/priority 및 site ALLOW와 global BLOCK 우선순위는 후속 별도 합의, 이번 Shorts에 임의 예약 없음.

## 9. 수정 JSON 예시

지민의 bound QUERY/APPLY/RELEASE 문맥을 유지하고 version만 draft-3-proposal로 수정한다. 아래 모두 가상 값이며 제품 지원 선언이 아니다. 첫 두 예시는 미결속 QUERY 예외, 일반 페이지 coverage와 media0/late ACK를 추가한다. bound QUERY 현재 결과와 RELEASE 정상·실패는 지민 §3.3/3.4 구조를 유지한다.

### 9.1 미결속 QUERY

```json
{
  "request_id": "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
  "type": "D06_CONTENT_CONTROL",
  "owner_context": null,
  "payload": {
    "contract_version": "d06-shorts-draft-3-proposal",
    "operation_id": "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
    "operation": "QUERY",
    "context": null
  }
}
```

### 9.2 미결속 상태 응답

```json
{
  "request_id": "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
  "status": "OK",
  "data": {
    "contract_version": "d06-shorts-draft-3-proposal",
    "operation_id": "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
    "operation": "QUERY",
    "document_id": "44444444-4444-4444-8444-444444444444",
    "binding_state": "UNBOUND",
    "current_control_seq": 0,
    "current_operation_id": null,
    "current_result": null
  },
  "error": null
}
```

### 9.3 APPLY

```json
{
  "request_id": "77777777-7777-4777-8777-777777777777",
  "type": "D06_CONTENT_CONTROL",
  "owner_context": "GUEST:33333333-3333-4333-8333-333333333333",
  "payload": {
    "contract_version": "d06-shorts-draft-3-proposal",
    "operation_id": "88888888-8888-4888-8888-888888888888",
    "operation": "APPLY",
    "control_seq": 1,
    "context": {
      "session_id": "11111111-1111-4111-8111-111111111111",
      "policy_snapshot_id": "22222222-2222-4222-8222-222222222222",
      "executor_id": "33333333-3333-4333-8333-333333333333",
      "document_id": "44444444-4444-4444-8444-444444444444",
      "navigation_id": "55555555-5555-4555-8555-555555555555",
      "binding_id": "66666666-6666-4666-8666-666666666666",
      "desired_revision": 1
    },
    "observation_round_id": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    "policy": {
      "format_version": "1.2",
      "site_match_strategy": "MOST_SPECIFIC_HOST",
      "target_host": "www.youtube.com",
      "matched_policy_host": "youtube.com",
      "access_policy": "ALLOW",
      "feature_policies": [
        {
          "feature_code": "YOUTUBE_SHORTS",
          "enabled": true
        }
      ]
    }
  }
}
```

### 9.4 일반 페이지 준비, 접근0

```json
{
  "request_id": "77777777-7777-4777-8777-777777777777",
  "status": "OK",
  "data": {
    "contract_version": "d06-shorts-draft-3-proposal",
    "operation_id": "88888888-8888-4888-8888-888888888888",
    "operation": "APPLY",
    "control_seq": 1,
    "context": {
      "session_id": "11111111-1111-4111-8111-111111111111",
      "policy_snapshot_id": "22222222-2222-4222-8222-222222222222",
      "executor_id": "33333333-3333-4333-8333-333333333333",
      "document_id": "44444444-4444-4444-8444-444444444444",
      "navigation_id": "55555555-5555-4555-8555-555555555555",
      "binding_id": "66666666-6666-4666-8666-666666666666",
      "desired_revision": 1
    },
    "feature_code": "YOUTUBE_SHORTS",
    "adapter_ready": true,
    "capability": "SUPPORTED",
    "effect": "UNCONFIRMED",
    "result_state": "NOT_APPLICABLE",
    "observation": {
      "round_id": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      "state": "CLOSED",
      "cause": "NO_CURRENT_VIEWER"
    },
    "coverage": {
      "observer_ready": true,
      "link_shelf_control_ready": true,
      "present_targets_controlled": true
    },
    "evidence": {
      "route_kind": "GENERAL",
      "viewer_present": false,
      "viewer_hidden": null,
      "media_present": null,
      "playback_stopped": null
    }
  },
  "error": null
}
```

### 9.5 Shorts media0, 성공 아님

```json
{
  "request_id": "77777777-7777-4777-8777-777777777777",
  "status": "OK",
  "data": {
    "contract_version": "d06-shorts-draft-3-proposal",
    "operation_id": "88888888-8888-4888-8888-888888888888",
    "operation": "APPLY",
    "control_seq": 1,
    "context": {
      "session_id": "11111111-1111-4111-8111-111111111111",
      "policy_snapshot_id": "22222222-2222-4222-8222-222222222222",
      "executor_id": "33333333-3333-4333-8333-333333333333",
      "document_id": "44444444-4444-4444-8444-444444444444",
      "navigation_id": "55555555-5555-4555-8555-555555555555",
      "binding_id": "66666666-6666-4666-8666-666666666666",
      "desired_revision": 1
    },
    "feature_code": "YOUTUBE_SHORTS",
    "adapter_ready": true,
    "capability": "SUPPORTED",
    "effect": "UNCONFIRMED",
    "result_state": "OBSERVING",
    "observation": {
      "round_id": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      "state": "OPEN",
      "cause": "SHORTS_MEDIA_PENDING"
    },
    "evidence": {
      "route_kind": "SHORTS",
      "viewer_present": true,
      "viewer_hidden": true,
      "media_present": false,
      "playback_stopped": null
    }
  },
  "error": null
}
```

### 9.6 실제 제한 FEATURE_RESULT

```json
{
  "request_id": "99999999-9999-4999-8999-999999999999",
  "type": "FEATURE_RESULT",
  "owner_context": "GUEST:33333333-3333-4333-8333-333333333333",
  "payload": {
    "contract_version": "d06-shorts-draft-3-proposal",
    "operation_id": "88888888-8888-4888-8888-888888888888",
    "operation": "APPLY",
    "control_seq": 1,
    "context": {
      "session_id": "11111111-1111-4111-8111-111111111111",
      "policy_snapshot_id": "22222222-2222-4222-8222-222222222222",
      "executor_id": "33333333-3333-4333-8333-333333333333",
      "document_id": "44444444-4444-4444-8444-444444444444",
      "navigation_id": "55555555-5555-4555-8555-555555555555",
      "binding_id": "66666666-6666-4666-8666-666666666666",
      "desired_revision": 1
    },
    "feature_code": "YOUTUBE_SHORTS",
    "adapter_ready": true,
    "capability": "SUPPORTED",
    "effect": "CONFIRMED",
    "observation_id": "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    "result_state": "APPLIED",
    "observation": {
      "round_id": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      "state": "CLOSED",
      "cause": "TARGET_CONFIRMED"
    },
    "evidence": {
      "route_kind": "SHORTS",
      "viewer_present": true,
      "viewer_hidden": true,
      "media_present": true,
      "playback_stopped": true
    },
    "observed_at": "2026-10-10T08:00:00.000Z"
  }
}
```

### 9.7 freeze 이후 진단 ACK

```json
{
  "request_id": "99999999-9999-4999-8999-999999999999",
  "status": "OK",
  "data": {
    "observation_id": "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    "accepted": false,
    "disposition": "FROZEN_DIAGNOSTIC"
  },
  "error": null
}
```

### 9.8 새 종료 문맥 RELEASE

```json
{
  "request_id": "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
  "type": "D06_CONTENT_CONTROL",
  "owner_context": "GUEST:33333333-3333-4333-8333-333333333333",
  "payload": {
    "contract_version": "d06-shorts-draft-3-proposal",
    "operation_id": "ffffffff-ffff-4fff-8fff-ffffffffffff",
    "operation": "RELEASE",
    "control_seq": 2,
    "context": {
      "session_id": "11111111-1111-4111-8111-111111111111",
      "policy_snapshot_id": "22222222-2222-4222-8222-222222222222",
      "executor_id": "33333333-3333-4333-8333-333333333333",
      "document_id": "44444444-4444-4444-8444-444444444444",
      "navigation_id": "55555555-5555-4555-8555-555555555555",
      "binding_id": "11111111-1111-4111-8111-111111111111",
      "desired_revision": 2
    },
    "applied_binding_id": "66666666-6666-4666-8666-666666666666"
  }
}
```

### 9.9 복원 실패, 처리 OK

```json
{
  "request_id": "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
  "status": "OK",
  "data": {
    "contract_version": "d06-shorts-draft-3-proposal",
    "operation_id": "ffffffff-ffff-4fff-8fff-ffffffffffff",
    "operation": "RELEASE",
    "control_seq": 2,
    "context": {
      "session_id": "11111111-1111-4111-8111-111111111111",
      "policy_snapshot_id": "22222222-2222-4222-8222-222222222222",
      "executor_id": "33333333-3333-4333-8333-333333333333",
      "document_id": "44444444-4444-4444-8444-444444444444",
      "navigation_id": "55555555-5555-4555-8555-555555555555",
      "binding_id": "11111111-1111-4111-8111-111111111111",
      "desired_revision": 2
    },
    "applied_binding_id": "66666666-6666-4666-8666-666666666666",
    "result_state": "RELEASE_FAILED",
    "effect": "UNCONFIRMED",
    "release_evidence": {
      "observer_stopped": true,
      "timers_cleared": true,
      "listeners_removed": true,
      "notice_removed": true,
      "owned_changes_restored": false,
      "remaining_owned_changes": 1
    }
  },
  "error": null
}
```

## 10. 수락 방향과 미합의·먼저 구현할 최소 단위

기존 공용 확정 원칙: 책임 분리/frozen 가장 구체 행/실제 효과 후 진행/한 navigation 한 이벤트/복수 확인 사유/원문 불변. 이번 Core도 수락한 방향: 처리·효과 분리, round state/cause, 멱등 최초 응답·QUERY 분리, release applied_binding, sender/문서 guard, epoch 취소·소멸 실확인. **양측이 방향을 같이 제안해도 이 재응답 전체가 공동 승인된 wire는 아니다.**

지민 재확인 필요: draft-3 type/enum/미결속 QUERY 예외, control_seq·64개/16KiB 캐시와 eviction, 일반 페이지 coverage, media0 미확인, R0와 신규 문서·BFCache 의무, 3초/10초 후보, 자동 Shorts 경계/OBSERVE_ACCESS 최소 필드. 다훈 확인 필요는 §7 S1~S5. 확정 시 두 PR의 문서와 공용 D-06에 같은 승인표·버전을 기록한다.

먼저 구현할 최소 단위 A: **비회원·Shorts 한 정책·지원 top-frame 한 문서의 주입→QUERY→APPLY 실제 증거→RELEASE 복원**. 첫 검증 fixture는 frozen projection을 사용하며 제품 Guest feature 거절을 먼저 제거하지 않는다. Content 담당: 번들/singleton·validator/직렬 큐·캐시/epoch·viewer/media/coverage/복원 증거. Core 담당: document registry·seq 영속·주입/dispatch·sender guard·의무 집계·종료 cleanup. 소스 담당 경계를 유지하고 PR21을 PR17에 무단 병합하지 않는다.

A 계약 확인 후 mock stale/중복/역순/유실/media0/복수 viewer/복원 실패 → 실제 Windows 제품 확장의 기존 탭·새 문서·새로고침 자동 적용·SPA/history·종료 시험. A에서 접근 이벤트를 생성하지 않는다. B에서 OBSERVE_ACCESS·Core nav/draft freeze·FEATURE 조회/repeat를 확정·검증한다. C에서 다훈 확인 후 회원 APPLIED/RELEASED·Snapshot gate·Chrome→Server→DB→Web. D에서 Worker/문서/브라우저 재시작·오프라인·부분실패/복구. 작은 단위 성공을 전체 제품 완료로 올리지 않는다.

## 11. 이번 검사·게시

문서 JSON 9개 파싱과 QUERY/operation/round/ACK 참조·control_seq·해제 binding·effect 일관성 검사 PASS. 작업 기록 링크 검사 및 git diff --check PASS. 제품 기능 테스트/Chrome/Server 통합은 **NOT RUN**. Content 과거33/33 합성 DOM와 사용자 YouTube6단계는 이전 근거이며 Core 자동 연동을 증명하지 않는다. Core 기존159/159·Backend165/165·UI23도 이전 사이트 실행 단위 근거이며 이번 재실행 결과가 아니다.

관련 PR: [Core #17](https://github.com/kdu-sw-capstone/capstone-project/pull/17), [Content Draft #21](https://github.com/kdu-sw-capstone/capstone-project/pull/21). 이 문서 Push 후 고정 커밋 링크로 회신한다. develop 병합 없음.
