# D-06 Content 재검토 — Core 재응답 회신

2026-10-11 / 채지민 / feature/content-control / POLICY-03·EXT-02·EVENT-03 연결 경계.

**검토·문서 회신만 수행했다. 공동 wire 계약 확정이나 제품 구현 승인이 아니다.** ‘수락’은 Content 측 회신이며 Core의 수정안 재확인과 공동 승인표가 필요하다. 제품 listener/발신·추가 MVP·Core 브랜치·공용 계약·develop은 변경하지 않는다.

## 1. 실제 대조 기준

- 시작 Content HEAD: bcca67412711507aa04cf01dc33ce2808e28e2e5, feature/content-control, 미커밋 변경 없음. 기존 검토응답·shorts.mjs·controller.mjs·changes.mjs를 읽고 보존했다.
- [Core 재응답 고정 원본](https://github.com/kdu-sw-capstone/capstone-project/blob/63193ef33da4a32610626e16b6eb30f0895e841a/docs/implementation/Content_Core_D06_Core재응답_2026-10-10.md): 63193ef33da4a32610626e16b6eb30f0895e841a. §2~10의 제안과 JSON9개 대조.
- Core 실제 코드 대조: **5c6064a6e770b055741cc16fd87b41e844a987d0**. extension/manifest.json, background/service-worker.js·access-store.js·site-store.js·session-core.js·member-execution-runtime.js, src/member-execution-loop.js·site-controller.js를 GitHub 고정 ref로 읽었다. 최초 background/member-execution-loop.js 요청은 404였고 PR 파일 목록으로 실제 src 경로를 확인했다.
- [PR17](https://github.com/kdu-sw-capstone/capstone-project/pull/17) 조회 시 HEAD는 **33d382882b2295d6e576fd2f97c453bd80a3b3f2**였다. 요청된 실제 코드5c6064a보다 이후다. PR 본문/파일 목록은 참고했고 이후 코드 전체까지 대조했다고 주장하지 않는다. 다음 구현 전 새 registry 등 후속 변경을 반드시 재대조한다.
- AGENTS.md·개발운영.md·통합현황.md·POLICY-03 카드 및 현행 D-06/D-07·Event1.2·Snapshot·API 로컬 메시지 계약을 읽었다. 기준은 Content에 보존된 develop90ad32be5d282f3b44c917a29e156dffc5e29187 기반 문서다. 설계 문서안내·PC 후속확장계획도 확인했다.

| 실제 코드 | 재검토 근거 |
|---|---|
| src/member-execution-loop.js requireSiteOnly, handle/cleanup/recover | 비어 있지 않은 feature_policies 및 활성 global 거절. 회원 사이트 apply/report/reconcile 경로는 존재. Content 결과 없이 거절만 제거하면 부분 성공 위험 |
| src/site-controller.js apply/release | 사이트 규칙·Journal 검증/복원 경로. Content 의무 집계와 별도이며 현재 사이트 성공을 Shorts 성공으로 승격 불가 |
| manifest/background service-worker | 지정5c6064a에는 Content 제품 주입/scripting/FEATURE_RESULT receiver 없음 |
| Guest site-store/session-core/access-store | 기능 거절, BLOCK/RECORD pending, SITE 즉시 저장 유지. 제어 단위 A는 이 경로를 건드려 이벤트를 만들지 않음 |
| Content shorts/controller/changes | status/changed만 제공. media0 성공 가능·명령 문맥/coverage/round/cache/BFCache guard 부재. URL 변경 때 release→apply, 실제 복원 후 잔존 검증 보완 필요 |

## 2. Core 제안마다 판단

| Core 제안 위치/항목 | 판단 | 이유·수정/다음 결정 |
|---|---|---|
| §2 정책 projection/책임 | 수락 | frozen 가장 구체 호스트 전체 행만. 부모 flags 혼합 금지·다음 세션 반영·비밀/본문 제외 |
| §2/3 OK와 효과 분리·enum | 수락 | transport OK ≠ APPLIED. NOT_APPLICABLE은 viewer 효과 UNCONFIRMED+coverage로만 판단. Server enum 직접 복사 금지 |
| §2/3 정적 singleton+기존 탭 scripting·새 ready 없음 | 수락 | Core 주입 확인→문서 QUERY→push. 첫 범위 HTTPS youtube.com/www.youtube.com top-frame isolated. 제품 빌드/권한은 합의 후 공동 리뷰 |
| §3 owner_context=null/context=null QUERY | 수정안 | Core→Content QUERY에만 한정 수락. bound 상태에서도 이 조회는 비식별 최소 요약만. Content가 자기 Chrome documentId를 스스로 안다고 가정할 수 없으므로 Core 대상 ID와 문서 instance challenge를 분리(§3.1) |
| §2 SPA 재바인딩 | 수락 | 동일 frozen 정책 보호 유지·epoch 교체. route 선행 시 이전 nav로 결과 금지. 첫 A에서 실제 SPA 재바인딩은 확장 시험으로 분리 |
| §4 control_seq·전송 전 commit | 수락 | 문서 수명 high-water, 안전정수, 원자 영속 후 전송. owner/session 변경으로 seq 초기화 금지. 순서 복구 불가면 새 APPLY 금지 |
| §4 불변 응답·QUERY·eviction | 수락·수정안 | 완료 cache와 진행중/현재 상태·cleanup 의무 분리. 오래된 캐시 응답으로 현재 집계 금지. eviction된 seq<=high-water는 STALE_CONTROL 단일 거절 권장. ID 재사용 higher seq는 Core durable ID↔seq 의미 registry에서 차단 |
| §4 16KiB·응답64/ACK64 | 수정안 | A 시험 상한으로 조건부 수락. UTF-8 JSON 전체 envelope(요청/응답/ACK 각각), 요청 크기 거절은 동작 전. 캐시 각64는 완료 항목 한정. 현재 상태/잔여 변경은 별도 소유 ledger, RELEASE를 캐시 포화로 거절하지 않음 |
| §5 R0·generation 재검사·새 문서 | 수락·보류 | 방향 수락. 세션 시작 성공 시점의 generation/결과를 한 transaction으로 결속. 지속 새 문서 실패의 RUN 중단/보고 매핑은 다훈 합의까지 보류 |
| §5 일반페이지 coverage | 수정안 | readiness 선언만으로 부족. observer 등록·초기 scan 완료·현재 관측 대상수와 제어 확인수·오류 여부를 증거로 보고. 무대상0/0 허용, 접근0 (§3.2) |
| §5 모든 applied binding 해제 | 수락·수정안 | 현재 탭만 조회 금지. SPA 여러 binding이 같은 DOM ledger를 공유하면 중복 소유를 만들지 않고 ledger→bindings 추적. RELEASE는 해당 ledger 소유 의무 모두 복원해야 성공 |
| §5 교체문서 DOCUMENT_GONE | 수정안 | active document 교체만으로 영구 소멸 단정 금지: BFCache 잔존 가능. ACTIVE/SUSPENDED/DESTROYED/UNKNOWN 분리. 확인 불가면 해제 미확인 유지 |
| §5 BFCache/부분실패/복원실패 | 보류·수정안 | pagehide/pageshow guard·재활성 전 reconcile 필요. BFCache는 소멸 아님. 일부 실패 전체 성공 금지. A는 한 활성 문서 고정, 교체/휴면 발생 시 중단·cleanup 검증으로 처리 |
| §6 media 없는 Shorts viewer | 수락 | 먼저 hide 유지, media_present=false/playback_stopped=null, OBSERVING→TIMED_OUT/UNCONFIRMED. 실제 media 없는 구조를 정상으로 인정하는 대안은 이번에 제시하지 않음 |
| §6 자동item/query/fragment 새 접근0 | 수락·보류 | 초기 첫 범위에서는0 수락. click isTrusted만으로 사용자 명시 탐색 입증 불가. Core commit/traversal과 일반→Shorts 경계 결합을 다음 이벤트 단위에서 검증. Shorts→Shorts 클릭별 집계는 보류 |
| §7 3초 관찰/10초 명령 | 수정안 | A 측정 시작값으로 유지하되 합의값 아님. 빠른 성공은 즉시 종결, 늦음은 미확인. §4의 절대 집계 예산·cleanup 별도 처리 제안. 실측 전 더 적절한 생산값 주장 금지 |
| §7 barrier/freeze/late | 수락·보류 | 첫조건 즉시 제한·한 원문·late 진단 원칙 수락. timeout 확인사유 저장/RECORD 공존/품질조회는 다훈 확인 전 보류. A는 접근 이벤트0 |
| §8 DNR 보완 | 수락 | Guest100000/회원1은 현 구현 후보·공통 예약 아님. Content DNR 없음, 추가 global은 후속 |
| §10 최소 A | 수락 | 비회원 frozen Shorts 한 정책·한 지원 활성 문서. 주입→QUERY→APPLY 실제 증거→RELEASE. 제품 Guest 거절 제거/Server 명령/이벤트 발신은 이 단계에 포함하지 않음 |

## 3. 수정 JSON 예시 — draft-4-proposal, 미합의

기존 bound APPLY/RELEASE/FEATURE_RESULT 구조는 Core §9를 유지하는 방향이다. 아래는 **수정이 필요한 부분만** 정확한 전체 envelope로 제시한다. 가상 ID·시각이며 제품 지원 선언이 아니다. token/proof/본문/전체 URL은 없다. operation_id는 QUERY 상관용이며 실행 캐시 대상 아님.

### 3.1 미결속 QUERY의 문서 신원

Core가 실제 전송 documentId를 target_document_id로 넣고 Content는 echo만 한다. echo는 인증 증거가 아니며 Core는 실제 target routing·주입 결과/수신 frame/document 검증으로 결속한다. Content가 생성하는 content_instance_id는 singleton 인스턴스 식별용이며 navigation_id/Chrome documentId를 대신하지 않는다. 최초 handshake 결과와 이후 인스턴스가 다르면 기존 seq를 새 인스턴스에 임의 승계하지 않고 reconcile한다.

NULL QUERY는 이미 BOUND 상태여도 owner/session/정책/result 원문을 반환하지 않는다. document_id 필드 의미를 ‘스스로 검증한 ID’로 오해시키지 않게 응답을 target_document_id로 명시하고 Core 내부 registry가 신원을 보증한다. 송신자 검증은 확장 ID만이 아니라 합의된 Core 호출 context도 확인하며 popup/다른 Content/Web에서 보낸 QUERY는 허용하지 않는다. 실제 sender metadata 가용성은 제품 Chrome 시험 항목이다.

```json
{
  "request_id": "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
  "type": "D06_CONTENT_CONTROL",
  "owner_context": null,
  "payload": {
    "contract_version": "d06-shorts-draft-4-proposal",
    "operation_id": "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
    "operation": "QUERY",
    "context": null,
    "target_document_id": "44444444-4444-4444-8444-444444444444"
  }
}
```

```json
{
  "request_id": "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
  "status": "OK",
  "data": {
    "contract_version": "d06-shorts-draft-4-proposal",
    "operation_id": "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
    "operation": "QUERY",
    "binding_state": "UNBOUND",
    "current_control_seq": 0,
    "current_operation_id": null,
    "target_document_id": "44444444-4444-4444-8444-444444444444",
    "content_instance_id": "abababab-abab-4bab-8bab-abababababab"
  },
  "error": null
}
```

### 3.2 일반 페이지 coverage — 대상없음도 실제 scan 근거

아래 counts는 원문 콘텐츠가 아닌 관측한 제어 대상 개수다. scanned0/controlled0은 정상 무대상이며 adapter_ready·observer_ready·initial_scan_complete가 모두 실제 확인돼야 한다. 일부 대상 실패는 NOT_APPLICABLE+CLOSED로 정상 종결하지 않는다. 지금 Content changed는 누적/시도 의미이므로 이 counts로 복사하지 않는다.

```json
{
  "request_id": "77777777-7777-4777-8777-777777777777",
  "status": "OK",
  "data": {
    "contract_version": "d06-shorts-draft-4-proposal",
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
      "initial_scan_complete": true,
      "link_shelf_control_ready": true,
      "scan_completed_without_error": true,
      "present_target_count": 0,
      "controlled_target_count": 0,
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

### 3.3 캐시 포화와 해제 의무

캐시 각64는 **완료 응답64와 완료 관찰 ACK64** 상한으로 한정한다. active/in-flight 실행은 직렬 queue 별도 상한, 현재 상태와 잔여 DOM ledger는 별도 필수 보존이다. 완료 cache FIFO 교체로 RELEASE 결과 공간을 우선 확보하고 실제 cleanup을 실행한다. 자원압박으로 결과 저장까지 실패하면 해제 확인을 지어내지 않고 QUERY/재시도 상태를 남긴다. 신규 APPLY는 RESOURCE_LIMIT로 거절 가능하지만 cleanup 허가는 유지한다.

다음은 eviction된 오래된 명령의 거절 예다. seq가 같거나 낮다고 실행하지 않는다. 과거 ID가 더 높은 seq로 다시 들어오는 경우 Content high-water만으로 과거 ID 충돌을 증명할 수 없으므로 Core의 durable operation registry에서 문서 수명 내 ID 재사용을 금지한다. 전체 이력 삭제 뒤 완전한 OPERATION_CONFLICT 보장을 주장하지 않는다.

```json
{
  "request_id": "77777777-7777-4777-8777-777777777777",
  "status": "ERROR",
  "data": null,
  "error": {
    "code": "STALE_CONTROL",
    "message": "This control sequence is no longer executable."
  }
}
```

관찰 ACK cache eviction 뒤에도 round terminal observation의 ID/최소 semantic fingerprint/처리 disposition은 Core registry에 유지해 freeze 중복·retry를 막는다. 그 저장 상한과 문서/round 종결 후 보존 기간은 이벤트 단위에서 결정한다. raw URL/body fingerprint는 저장하지 않는다. 보존 예산 부족은 새 관찰 UNCONFIRMED이며 과거 이벤트를 재생성하지 않는다.

## 4. 시간·종결 기준 제안

- 첫 측정 후보는 Core 제안 **초기 round3초/명령 집계10초**를 유지한다. 근거는 공통 시험 출발점일 뿐 적합성 실측은 없다. 바꾸는 숫자를 임의로 더 적절하다고 제시하지 않는다. A에서 1/3/5초 관찰, 5/10/15초 집계를 비교해 로딩·주입·복원 지연 분포와 오탐 미확인율을 기록한 뒤 생산값 결정한다.
- APPLY 총 예산은 Core 명령 승인/dispatch 준비 시점부터 주입·QUERY·APPLY/round를 포함한다. 3초 round는 해당 문서 APPLY 송신 시점부터, 별도 Content 수신/scan 경과 진단을 구분한다. 실제 round deadline은 min(3초, 전체 남은 예산, 명령 유효기간 잔여)이다. 각 retry가 예산을 초기화하지 않는다.
- 10초 APPLY 실패 뒤 rollback은 **별도 cleanup 의무**로 남기며 실패한 APPLY 예산이 끝났다고 RELEASE를 포기하지 않는다. RELEASE 집계10초는 회차의 확인 대기 상한이며 소유 의무 만료/자동 해제 성공 TTL이 아니다. 기한 뒤 UNCONFIRMED+retry 유지.
- 단조 경과시간은 같은 실행 수명 내에서만 사용한다. Worker 재생성·절전 경과를 증명 못 하면 기존 round ABORTED/UNCONFIRMED, 문맥 QUERY/reconcile 후 새 승인된 회차. 타이머 콜백이 늦었다고 3초 안 성공으로 소급하지 않는다. deadline 전 증거의 지연 수신 수용 조건은 추가 합의한다.
- 성공: 현재 binding/seq/문서가 유효하고 실제 viewer 숨김/inert·연결 media 모두 pause 확인. 실패: 실제 제어/검증 예외 즉시 FAILED. 관찰 지연: deadline에 TIMED_OUT/UNCONFIRMED. 일반페이지는 scan 완료+coverage 검증 시 CLOSED/NOT_APPLICABLE이며 viewer effect는 미확인이다.
- round CLOSED 후 Mutation 보호는 계속된다. 새 정책/RELEASE/문서휴면은 이전 epoch 보고 취소. 마지막 성공 결과를 살아있는 현재 성공 증거로 영구 재사용하지 않는다.
- 이벤트 freeze는 단위 B에서 결정한다. 첫 유효 조건 즉시 제한, 원문 freeze 후 late 진단만. 확인사유만 저장/RECORD 공존/실패 진단·품질 조회는 다훈 확인 전 구현하지 않는다.

## 5. 문서 집합·BFCache·해제 집계

R0/generation 방식은 수락하지만 새 문서 의무 등록과 시작 성공 판정 사이의 race를 registry transaction/최종 generation 일치로 막아야 한다. 안정된 순간이 없으면 timeout이며 과거 집합의 성공으로 RUNNING을 확정하지 않는다. 신규 문서 실패 이후 confirmed RUN gap 처리·회원 보고는 S1로 분리한다.

교체=영구 소멸로 처리하지 않는다. BFCache/SUSPENDED 문서는 소유 ledger를 계속 추적한다. pagehide 시 보고 epoch 중단·가능한 안전 cleanup, pageshow 시 재생 guard를 유지하며 Core QUERY/정책 재검증 후 새 관찰. cleanup이 확인되지 않았으면 RELEASED로 보고하지 않는다. 활성화 전 보호가 보장되는 제품 방식은 실측/합의 대상이다. tab 제거 등 실제 소멸 확인과 수신 불가를 구분하고 불명확하면 UNKNOWN 의무를 유지한다.

동일 문서에서 재바인딩된 b1/b2가 같은 소유 DOM 변경을 공유할 때 b1만 해제했다는 응답으로 b2 의무를 잃지 않는다. Core는 모든 applied binding↔ledger 연결을 추적하고 Content는 ledger 복원/중지 완료로 연결된 의무를 종결한다. 변경 count만0이라도 observer/listener가 남으면 해제 실패다. 페이지가 나중에 변경한 스타일은 보존하며 ‘원래와 다름’만으로 실패라고 하지 않고 **Content가 소유한 변경이 남았는지** 검증한다.

A에서는 한 활성 문서 고정으로 이 복잡도를 제한한다. 문서 교체/휴면·다중 탭 발생은 자동 전체 성공으로 확대하지 않고 A를 중단·미확인으로 처리, 가능한 cleanup 확인 후 다음 회차를 승인한다. BFCache 전체 지원을 생략해서 제품 완료로 표시하지 않는다.

## 6. 수락 방향 / 미합의 / 다훈 확인

| 분류 | 내용 |
|---|---|
| 양측 방향 일치 | 책임 분리/frozen most-specific/OK≠효과/초기접근0/seq·멱등·QUERY/실제 viewer-media/잔여 binding 복원/late 원문 불변/최소 A 접근0 |
| A 전에 재확인 | 미결속 QUERY 문서ID·instance 결속 및 sender 검증, cache 포화에서도 cleanup 가능, draft 버전/enum·coverage counts,3초/10초 시험 예산 의미, 한 문서 교체 시 중단 기준 |
| 다음 B/D로 보류 | 전체 R0·새 문서 지속 의무/BFCache guard 검증, 자동 Shorts→Shorts 명시 이동, OBSERVE_ACCESS 필드, 관찰 ACK 장기 중복 보존, 실제 생산 timeout·복구 |
| 다훈 S1 | 일반페이지/대상0/부분실패/런타임 새 문서 실패의 회원 APPLIED·UNCONFIRMED·RELEASED·Journal/RUN gap 매핑 |
| 다훈 S2 | freeze barrier/timeout 확인사유 저장·RECORD와 실패 기능 공존·중복/seq·기존SITE 회귀 |
| 다훈 S3/S4 | 늦은 진단 조회/품질 확장 필요성과 BOUND-19 옛 단일사유 문구 정리. 현행 Event1.2/API 임의 추가 금지 |
| 다훈 S5 | Snapshot1.2 검증 executor cohort·회원/비회원 시험. 기본 발급 OFF 유지 |

방향 일치 표는 승인된 wire 표가 아니다. Core가 A 수정안을 재확인하고 같은 버전/승인표를 양측 문서에 남긴 뒤 A를 구현한다. A가 Server 계약을 변경하지 않는 독립 제어 시험이면 B/C의 Server 결정을 기다리지 않고 별도 승인 범위로 시작할 수 있다.

## 7. 변경 파일·담당 경계와 최소 단위

| 담당 | 합의 후 변경 후보(이번 미변경) |
|---|---|
| Content 채지민 | extension/content/shorts.mjs 실제 media/coverage 증거, controller.mjs 직렬 제어/epoch·route 재결속/휴면 guard, changes.mjs 소유 복원/잔여 확인. 별도 제품 adapter/bootstrap·validator·cache 파일은 합의 후 명명. content-tests는 모의/실제 분리 |
| Core 윤종민 | manifest.json 및 제품 빌드/주입, service-worker.js/Core document registry(후속 PR코드 재대조 후 파일 확정), dispatch·seq/operation 영속·senderguard·의무 집계. session-core/site-store/member-execution-loop/site-controller의 feature gate/전체 집계는 A 통과 후 별도 제품 단위 |
| Core 이벤트 단위 B | access-store 및 회원수집/draft-freeze·FEATURE 조회/반복. A에서는 수정·발신하지 않음 |
| Server 김다훈 | S1~S5 결정 및 필요 공용계약/검증 변경. 이번 Server 코드 변경 없음 |

첫 A: **비회원·frozen Shorts 한 정책·한 지원 top-frame 활성 문서, 주입→미결속 QUERY→APPLY 실제 증거→RELEASE 복원**. fixture projection을 명시한 시험 연결로 시작하고 제품 Guest feature 거절을 가짜로 제거하지 않는다. 성공해도 전체 세션/회원/접근 통계 완료 아님.

검증 순서:

1. A 계약 수정안 공동 확인→schema/instance/seq/cache/coverage 모의 검사. stale/역순/중복/eviction/포화 시 RELEASE·유실/두 bootstrap·media0/복수 viewer/pause·복원 실패 포함.
2. 실제 Windows 제품 Chrome에서 패키지 주입·한 문서 QUERY·실제 viewer/음성 제한·복원 확인. fixture 정책과 실제 Core 세션 정책 구분. A는 OBSERVE_ACCESS/접근 이벤트0, FEATURE_RESULT는 제어 증거용만.
3. A를 통과한 뒤 새 문서/기존 탭/새로고침 자동 적용/SPA/history·R0·BFCache·교체/소멸·부분 실패 확대. 기존33개 회귀는 그때 실행하고 이번에는 재실행하지 않음.
4. B 탐색/이벤트 계약·다훈 확인 후 한 접근1건/재렌더0/실제host repeat/freeze불변. C 회원 Chrome→Core→Server→DB→Web, D Worker/브라우저/오프라인·복구. 단계별 모의/제품 결과 분리.

## 8. 이번 결과·문제·다음 행동

- 과거 근거: 자동33/33은 합성 DOM·모의 정책, 사용자 YouTube6단계는 시험 확장 정상 실행 보고. 재실행/재관찰 없음. Core 과거 테스트 수치도 이번 결과로 승격하지 않음.
- 이번 검사: JSON 예시 구문/상관·문맥·count 검증, 참조 경로/변경 범위, git diff --check. 실제 결과는 작업 기록에 남긴다. 제품 기능/Chrome/Server 테스트 **NOT RUN**.
- 차단점: 지정 Core에 Content 거절/제품 주입·receiver 부재, Content 증거·seq/cache/instance/round 부재. 실행 실패를 재현한 것은 아니며 코드 검토의 미구현 경계다.
- 미검증: 16KiB/64개 메모리 실측·3초/10초 적합성·BFCache/제품 lifecycle·Core 최신HEAD 후속 registry와 본 제안 호환·실제 모든 연동. 공동 합의도 아직 미완료.
- 다음: PR21 회신 링크 전달→Core가 A 전에 필요한 수정안 수락/대안 제시→A만 공동 확정·구현. B/C/D 결정은 별도 유지. 이번에는 문서와 필요한 작업 기록만 Commit·Push, PR21 갱신. Core PR17/브랜치·develop 병합·자동병합 없음.
