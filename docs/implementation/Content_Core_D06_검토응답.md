# D-06 Content 검토 응답 — 필수 Shorts 연결

2026-10-10 / 채지민 / feature/content-control. 시작 HEAD **2d681f0d8422e613e7adc0978d65cc30fa0b972d**, 작업본 clean 확인.

**Content 측 검토 의견이며 공동 합의된 계약이 아니다.** 아래 type·필드·enum·버전·상한·종결 기준은 제안이다. 승인 전 제품 listener/발신을 구현하지 않는다. 이번 변경은 본 문서와 필요한 작업 기록뿐이다. 추가 MVP 확장·Core PR17/타 담당 코드 변경·develop 병합·자동병합 없음.

## 1. 대조한 커밋·계약·코드

- Content: 위 2d681f0의 extension/content/controller.mjs, shorts.mjs, changes.mjs, entry.mjs와 기존 features.mjs 및 시험 harness.
- Core 검토 문서: **4e2f0557854064f2e5f74d8b26f51cf2b1aac646**의 다음 두 파일을 실제 읽었다. 로컬 Git object가 없어 GitHub connector의 고정 ref 읽기를 사용했으며 checkout/merge하지 않았다.
  - [필수 Shorts 메시지 초안](https://github.com/kdu-sw-capstone/capstone-project/blob/4e2f0557854064f2e5f74d8b26f51cf2b1aac646/docs/implementation/Content_Core_D06_필수Shorts_메시지초안.md)
  - [Core 검토 의견](https://github.com/kdu-sw-capstone/capstone-project/blob/4e2f0557854064f2e5f74d8b26f51cf2b1aac646/docs/implementation/Content_Core_D06_Core검토_2026-10-10.md)
- Core 실제 코드: 초안에 명시된 **b8bc7a17269a9c46981f6891f9fc92e9d98c38c9**의 extension/manifest.json, background/service-worker.js, access-store.js, session-core.js, site-store.js를 고정 ref로 읽었다. 현재 PR17 최신 HEAD라고 확대하지 않는다.
- 공용/Server 기준: Content 커밋에 있는 develop **90ad32be5d282f3b44c917a29e156dffc5e29187** 기반 docs/design/02_시스템_테크설계/FOCURVE_D01_D10_최종공용계약.md의 D-06/D-07/미확정 기술안, 12_정책계약_이벤트12_호환성게이트.md, 04_API_연동.md 로컬 메시지, 05_데이터_복구.md Snapshot/이벤트 및 기존 호스트 정책우선순위. backend/src/main/java/kr/ac/kdu/focurve/execution/SnapshotValidation.java와 events/SnapshotAccess.java의 validate12를 대조했다.
- 운영/수용 기준: AGENTS.md, 개발운영.md, 통합현황.md, tasks/POLICY-03.md, 설계 문서안내·PC 후속확장계획, AC-POLICY-03-01~03, BOUND-19. BOUND-19 옛 ‘우선 이유1건’ 표현은 현행 D-06/Event1.2의 **확인된 복수 사유를 한 접근에 통합** 원칙으로 해석하며 다훈에게 문구 정리를 요청한다.

| 위치 | 실제 사실 / 필요한 보완 |
|---|---|
| controller.mjs start/scan/publish/release | 중복 start는 CONTENT_ALREADY_ACTIVE. Mutation마다 publish, URL 변경 때 release→apply. 명령·문서·탐색 문맥/멱등 저장/초기 round 없음 |
| shorts.mjs apply/release | viewer 숨김과 video.paused 검사 있으나 반환은 feature/status/changed뿐. viewer에 video가 0개여도 SUPPORTED 가능. play capture pause 실패가 결과 증거로 전달되지 않음 |
| changes.mjs hide/restore | hide는 computed display/inert 확인. restore는 예외 시 항목 보존하지만 복원 후 전 속성 확인/잔존 수 공개가 없음. 페이지의 후속 스타일 변경은 보존해야 함 |
| entry.mjs | 지원 경로 후보만 반환. 명시 탐색 증명이나 접근 생성권한 아님 |
| chrome-harness/bootstrap.js | TEST_SHORTS_*는 모의 정책 시험 popup 전용. 제품 계약으로 재사용 금지 |
| Core manifest/service-worker | 제품 Content 주입/scripting 권한/관찰 receiver/historyState 연결 없음 |
| Core site-store validate/session-core begin | feature_policies/활성 기능 거절. 거절만 제거하면 안 되고 frozen 정책·실행 집계까지 연결 필요 |
| Core access-store pending/commit/list | BLOCK/RECORD에만 pending, commit은 SITE 이벤트 즉시 저장. ALLOW+Shorts의 nav 발급 및 feature 조회/반복 집계 필요 |

## 2. 항목별 동의·수정·미합의

‘동의’도 Content 측 방향 동의이며 공동 승인/구현완료가 아니다.

| 항목 | 판단 | 응답 |
|---|---|---|
| 정책 projection/책임 | 동의 | Core가 frozen Snapshot에서 가장 구체적 사이트 전체 행 선택. Content는 최소 Shorts 정책만 적용. 부모 flags 혼합 금지, 세션 설정 변경은 다음 세션 |
| 적용·해제 메시지/응답 | 수정 제안 | 기존 envelope 유지. 신규 D06_CONTENT_CONTROL은 후보. 처리 OK와 실제 효과·관찰 종료를 분리하고 §3 증거 추가 |
| 새 문서/새로고침/기존 탭 | 수정 제안 | 정적 classic isolated bootstrap + 기존 열린 top-frame 탭에 Core scripting 주입 권장. singleton으로 중복 방지. 제품 빌드·권한 변경 공동 검토 |
| ready 조회 | 추가 합의 필요 | 세션 모르는 Content에 GET_STATE 자동 개방/owner 추측 금지. 우선 Core가 주입 확인→문서 QUERY→현재 정책 push하는 방식 제안. Content발 ready가 필요하면 별도 허용 type·owner 부재 의미 합의 |
| SPA 정책 전달 | 수정 제안 | Core가 새 nav/binding/round 발급. 같은 frozen 정책 재바인딩은 불필요한 release 없이 보호 유지. route가 먼저 바뀌면 이전 nav로 새 결과 보고하지 않고 새 binding 후 재검사 |
| session/Snapshot/revision/document/nav | 동의·수정 제안 | Core가 sender 실제 documentId/frame0/host와 registry 대조. 문서 수명 내 control_seq 후보 추가. 새 session의 revision1과 과거 revision1 혼동 금지 |
| 멱등/충돌 | 수정 제안 | 같은 operation_id+동일 canonical 의미 payload는 최초 결과 data 재응답(request_id만 현재 요청으로). in-flight는 같은 실행 공유. 다른 내용은 OPERATION_CONFLICT. 최신 상태는 QUERY로 구분 |
| viewer/재생/해제 복원 | 수정 제안 | adapter 준비와 실제 효과 분리. 관측 viewer 전체 숨김/inert·연결 media 정지·소유 변경 복원/observer/timer/listener/안내 제거 확인 |
| 없음/관찰/미지원/실패 | 수정 제안 | 일반영상 무대상 NOT_APPLICABLE, Shorts viewer/media 지연 OBSERVING, 명백한 지원불가 UNSUPPORTED, 실제 조작 실패 APPLY_FAILED/RELEASE_FAILED. timeout은 성공/미지원 추정 아님 |
| navigation/재렌더 | 동의·추가 합의 필요 | Core만 ID 발급. session+navigation+실제host 한 접근. 초기 적용/Mutation/선반 숨김0건. 자동 Shorts item/query/fragment의 명시 이동 경계는 공동 결정 |
| 초기 완료/freeze | 수정 제안·추가 합의 필요 | boolean 완료 대신 round.state/cause. 현재 round 종결과 미래 DOM 관찰은 다름. Core와 필수 Content 관찰 종결 후 1회 freeze. 최대 대기/불완전 기록은 다훈 포함 결정 |
| 늦은 결과/문서 소멸/유실 | 동의·수정 제안 | stale/freeze후 결과는 진단만. 동일 명령 retry/QUERY·관찰 ACK 필요. sendMessage 실패는 문서 소멸/해제성공 증거 아님. Core가 실제 문서 교체/닫힘 확인 |

## 3. 정확한 JSON 수정 제안 — 미승인 후보

초안 draft-1 공통 envelope를 유지한다. 가상 UUID/시각을 사용한다. 아래 코드/버전 문자열은 제품 지원 선언이 아니다. Server API·보고 enum을 바꾸지 않는다. 토큰·설치 증명·페이지 본문·전체URL/query/영상ID는 전달하지 않는다.

control_seq는 Core가 문서별로 부여/영속하는 제어 순서 후보다. revision과 별개이며 세션·owner 변경도 포함해 문서 수명 동안 단조 증가한다. Worker 재생성 뒤 복구 못 하면 reconcile 전 APPLY 금지. 상한/캐시 TTL/크기/eviction 정책은 추가 합의한다.

### 3.1 적용 요청과 관찰 중 응답

observation_round_id는 Core 소유 초기 관찰 ID다. matched_policy_host=null이면 access_policy=null/feature_policies=[]의 명시 무정책 projection을 제안한다. 기존 제한이 있으면 별도 RELEASE 확인 필요. site BLOCK만으로 수행하지 않은 FEATURE를 추정하지 않는다.


```json
{
  "request_id": "77777777-7777-4777-8777-777777777777",
  "type": "D06_CONTENT_CONTROL",
  "owner_context": "GUEST:33333333-3333-4333-8333-333333333333",
  "payload": {
    "contract_version": "d06-shorts-draft-2-proposal",
    "operation_id": "88888888-8888-4888-8888-888888888888",
    "operation": "APPLY",
    "control_seq": 1,
    "context": {
      "session_id": "11111111-1111-4111-8111-111111111111",
      "policy_snapshot_id": "22222222-2222-4222-8222-222222222222",
      "executor_id": "33333333-3333-4333-8333-333333333333",
      "desired_revision": 1,
      "document_id": "44444444-4444-4444-8444-444444444444",
      "navigation_id": "55555555-5555-4555-8555-555555555555",
      "binding_id": "66666666-6666-4666-8666-666666666666"
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

```json
{
  "request_id": "77777777-7777-4777-8777-777777777777",
  "status": "OK",
  "data": {
    "contract_version": "d06-shorts-draft-2-proposal",
    "operation_id": "88888888-8888-4888-8888-888888888888",
    "operation": "APPLY",
    "control_seq": 1,
    "context": {
      "session_id": "11111111-1111-4111-8111-111111111111",
      "policy_snapshot_id": "22222222-2222-4222-8222-222222222222",
      "executor_id": "33333333-3333-4333-8333-333333333333",
      "desired_revision": 1,
      "document_id": "44444444-4444-4444-8444-444444444444",
      "navigation_id": "55555555-5555-4555-8555-555555555555",
      "binding_id": "66666666-6666-4666-8666-666666666666"
    },
    "feature_code": "YOUTUBE_SHORTS",
    "adapter_ready": true,
    "capability": "SUPPORTED",
    "effect": "UNCONFIRMED",
    "result_state": "OBSERVING",
    "observation": {
      "round_id": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      "state": "OPEN",
      "cause": "SHORTS_VIEWER_PENDING"
    },
    "evidence": {
      "route_kind": "SHORTS",
      "viewer_present": false,
      "viewer_hidden": null,
      "media_present": null,
      "playback_stopped": null
    }
  },
  "error": null
}
```

### 3.2 관찰 종결 FEATURE_RESULT 및 수용 ACK

```json
{
  "request_id": "99999999-9999-4999-8999-999999999999",
  "type": "FEATURE_RESULT",
  "owner_context": "GUEST:33333333-3333-4333-8333-333333333333",
  "payload": {
    "contract_version": "d06-shorts-draft-2-proposal",
    "operation_id": "88888888-8888-4888-8888-888888888888",
    "operation": "APPLY",
    "control_seq": 1,
    "context": {
      "session_id": "11111111-1111-4111-8111-111111111111",
      "policy_snapshot_id": "22222222-2222-4222-8222-222222222222",
      "executor_id": "33333333-3333-4333-8333-333333333333",
      "desired_revision": 1,
      "document_id": "44444444-4444-4444-8444-444444444444",
      "navigation_id": "55555555-5555-4555-8555-555555555555",
      "binding_id": "66666666-6666-4666-8666-666666666666"
    },
    "feature_code": "YOUTUBE_SHORTS",
    "observation_id": "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    "adapter_ready": true,
    "capability": "SUPPORTED",
    "effect": "CONFIRMED",
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

```json
{
  "request_id": "99999999-9999-4999-8999-999999999999",
  "status": "OK",
  "data": {
    "observation_id": "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    "accepted": true
  },
  "error": null
}
```

### 3.3 최신 상태 QUERY 및 응답

```json
{
  "request_id": "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
  "type": "D06_CONTENT_CONTROL",
  "owner_context": "GUEST:33333333-3333-4333-8333-333333333333",
  "payload": {
    "contract_version": "d06-shorts-draft-2-proposal",
    "operation_id": "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
    "operation": "QUERY",
    "context": {
      "session_id": "11111111-1111-4111-8111-111111111111",
      "policy_snapshot_id": "22222222-2222-4222-8222-222222222222",
      "executor_id": "33333333-3333-4333-8333-333333333333",
      "desired_revision": 1,
      "document_id": "44444444-4444-4444-8444-444444444444",
      "navigation_id": "55555555-5555-4555-8555-555555555555",
      "binding_id": "66666666-6666-4666-8666-666666666666"
    }
  }
}
```

```json
{
  "request_id": "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
  "status": "OK",
  "data": {
    "contract_version": "d06-shorts-draft-2-proposal",
    "operation_id": "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
    "operation": "QUERY",
    "context": {
      "session_id": "11111111-1111-4111-8111-111111111111",
      "policy_snapshot_id": "22222222-2222-4222-8222-222222222222",
      "executor_id": "33333333-3333-4333-8333-333333333333",
      "desired_revision": 1,
      "document_id": "44444444-4444-4444-8444-444444444444",
      "navigation_id": "55555555-5555-4555-8555-555555555555",
      "binding_id": "66666666-6666-4666-8666-666666666666"
    },
    "current_control_seq": 1,
    "current_operation_id": "88888888-8888-4888-8888-888888888888",
    "current_result": {
      "contract_version": "d06-shorts-draft-2-proposal",
      "operation_id": "88888888-8888-4888-8888-888888888888",
      "operation": "APPLY",
      "control_seq": 1,
      "context": {
        "session_id": "11111111-1111-4111-8111-111111111111",
        "policy_snapshot_id": "22222222-2222-4222-8222-222222222222",
        "executor_id": "33333333-3333-4333-8333-333333333333",
        "desired_revision": 1,
        "document_id": "44444444-4444-4444-8444-444444444444",
        "navigation_id": "55555555-5555-4555-8555-555555555555",
        "binding_id": "66666666-6666-4666-8666-666666666666"
      },
      "feature_code": "YOUTUBE_SHORTS",
      "observation_id": "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      "adapter_ready": true,
      "capability": "SUPPORTED",
      "effect": "CONFIRMED",
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
  },
  "error": null
}
```

### 3.4 해제 요청·복원 실패 응답·충돌 거절

```json
{
  "request_id": "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
  "type": "D06_CONTENT_CONTROL",
  "owner_context": "GUEST:33333333-3333-4333-8333-333333333333",
  "payload": {
    "contract_version": "d06-shorts-draft-2-proposal",
    "operation_id": "ffffffff-ffff-4fff-8fff-ffffffffffff",
    "operation": "RELEASE",
    "control_seq": 2,
    "context": {
      "session_id": "11111111-1111-4111-8111-111111111111",
      "policy_snapshot_id": "22222222-2222-4222-8222-222222222222",
      "executor_id": "33333333-3333-4333-8333-333333333333",
      "desired_revision": 2,
      "document_id": "44444444-4444-4444-8444-444444444444",
      "navigation_id": "55555555-5555-4555-8555-555555555555",
      "binding_id": "12121212-1212-4212-8212-121212121212"
    },
    "applied_binding_id": "66666666-6666-4666-8666-666666666666"
  }
}
```

```json
{
  "request_id": "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
  "status": "OK",
  "data": {
    "contract_version": "d06-shorts-draft-2-proposal",
    "operation_id": "ffffffff-ffff-4fff-8fff-ffffffffffff",
    "operation": "RELEASE",
    "control_seq": 2,
    "context": {
      "session_id": "11111111-1111-4111-8111-111111111111",
      "policy_snapshot_id": "22222222-2222-4222-8222-222222222222",
      "executor_id": "33333333-3333-4333-8333-333333333333",
      "desired_revision": 2,
      "document_id": "44444444-4444-4444-8444-444444444444",
      "navigation_id": "55555555-5555-4555-8555-555555555555",
      "binding_id": "12121212-1212-4212-8212-121212121212"
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

```json
{
  "request_id": "77777777-7777-4777-8777-777777777777",
  "status": "ERROR",
  "data": null,
  "error": {
    "code": "OPERATION_CONFLICT",
    "message": "Operation identity conflicts with the accepted payload."
  }
}
```

### 3.5 예시 해석과 상태 구분

- APPLY 응답의 OK는 접수/처리 성공이다. OBSERVING+UNCONFIRMED는 적용 성공/접근 확정이 아니다. viewer/media 없음을 false/true로 채우지 않고 null로 보고한다.
- FEATURE_RESULT는 해당 binding/round의 실제 효과와 관찰 종결의 단일 출처로 권장한다. ACK accepted는 관찰 수용이며 이벤트 저장/Server 접수 성공이 아니다. 같은 observation_id+같은 내용은 멱등, 다른 내용은 OBSERVATION_CONFLICT 후보. ACK retry 수명·횟수·크기는 합의 후 구현한다.
- OBSERVE_ACCESS는 명시 진입 후보용으로 한정한다. 초안 ROUTE_CANDIDATE는 사용자 진입 확정이 아니다. Core가 nav 경계를 검증한다. 두 type에 같은 증거를 보낼 경우 observation_id/round_id를 공유해 중복 병합한다. 초기 적용/일반 선반 숨김은 OBSERVE_ACCESS를 보내지 않는다. 최종 후보 필수 필드는 미합의다.
- QUERY는 최신 상태 재검사이며 정책 적용/접근 생성이 아니다. 최초 응답 캐시는 불변이다. 해제 후 과거 APPLY 재전달은 캐시만 응답하고 재적용하지 않는다. Core가 캐시 응답을 현재 상태로 오해하지 않게 QUERY/control_seq를 확인한다. 초기 미결속 QUERY 응답 스키마는 추가 합의다.
- RELEASE 현재 desired_revision/binding과 원래 applied_binding_id를 구분한다. 종료 중 RUNNING-only 관찰 guard로 해제를 막지 않는다. 전환 중 registry가 과거 적용의 복원을 허가하되 과거 APPLY는 거절한다.
- RELEASE_FAILED도 처리된 시도이면 status OK/data에 실패를 담는 수정안이다. 정상 해제는 RELEASED/CONFIRMED, release_evidence 모두 true/remaining_owned_changes=0. status ERROR는 버전/스키마/권한/문맥/충돌 등 접수 거절이다. 초안 APPLY_UNCONFIRMED/RELEASE_UNCONFIRMED를 data 결과로 분리하자는 제안이며 Server 보고 코드를 변경하지 않는다.
- canonical 비교는 request_id 제외, type/owner/version/operation/context/control_seq/policy/round/applied_binding 의미 필드 포함. 키 순서 무시·배열 처리·unknown field 거절·숫자/크기 상한은 합의 필요. raw stack/본문을 error.message로 보내지 않는다.

| result_state 후보 | 의미/종결 |
|---|---|
| NOT_APPLICABLE | 일반영상에 viewer 없음. round CLOSED 가능하지만 observer는 유지. 링크 숨김과 viewer 효과 분리, Shorts 접근0 |
| OBSERVING | Shorts viewer/media 지연. round OPEN/UNCONFIRMED, 가능한 제한은 즉시 수행 |
| APPLIED | 실제 viewer 전체 숨김/연결 media 정지 확인. round CLOSED/CONFIRMED. 해당 문서 효과일 뿐 전체 APPLIED 아님 |
| UNSUPPORTED | 지원 host/frame/adapter가 명백히 범위 밖. 지연을 미지원으로 단정 금지 |
| APPLY_FAILED | 조작 예외 또는 검증 실패. 성공 접근 통계 제외/rollback |
| RELEASED/RELEASE_FAILED | observer/timer/listener/안내 정리 및 소유 속성 복원 검증 결과. 잔여 상태 보존/retry |

viewer는 있지만 media가 0이면 playback_stopped=true를 만들지 않는다. 로드 지연이면 OBSERVING/null, 최종 비재생 viewer 구조를 성공으로 인정할지는 추가 합의한다. CLOSED는 현재 round 종료이며 미래 DOM 불변 선언이 아니다. 초안 observation_complete boolean은 state/cause로 대체 제안한다.

## 4. 탐색·관찰 종결·이벤트 확정

1. Core가 before/commit/history 문서 registry와 navigation_id를 관리한다. route가 먼저 바뀌면 Content는 보호를 유지하되 이전 nav로 새 증거 발행 금지. 새 binding 후 현재 상태 재검사한다. Content가 URL/영상ID를 보고해 탐색 권한을 대신하지 않는다.
2. 명시 direct/SPA/뒤로·앞으로는 Core가 새 nav 판정. 세션 시작 시 이미 열린 Shorts 제한은 접근0, Mutation/scan/중복 명령/일반 선반/차단안내 refresh도0. 실제 Shorts reload의 새 진입과 자동 정책 재적용을 구분한다. 자동 item/query/fragment 경계는 아직 미합의다.
3. 첫 유효 조건 즉시 제한. 저장/전송 대기와 DOM 집행 분리. Core 관찰 완료+필수 round CLOSED/FAILED/ABORTED/TIMED_OUT 후 draft를 한 번 freeze하는 방향에 동의한다. 문서 소멸은 Core의 실제 document 확인으로 round 종결한다.
4. round deadline은 Core가 관리하는 별도 관찰 제한시간 후보이며 session execute_before/HTTP timeout과 혼동하지 않는다. 이번에 숫자를 정하지 않는다. 지연을 성공 CLOSED로 바꾸거나 무한 대기하지 않는다.
5. timeout/소멸/무응답 때 확인된 사유만 저장할지, 실패 진단으로 남길지, 누락 FEATURE 품질을 어디 보관할지는 다훈과 추가 합의. 1.2에 quality/annotation API 임의 추가 금지.
6. freeze 뒤 same event_id 원문 수정/새 ID로 동일 접근 추가 금지. atomic draft 종결·seq·event/outbox 저장/중복 ACK는 Core 책임. 늦은 감지는 진단만 유지하며 stale 문맥 결과는 세션/이벤트를 변경하지 않는다.
7. FEATURE 포함 시 BLOCKED_FEATURE_ACCESS/FEATURE/YOUTUBE_SHORTS, 대표 reason은 USER_SITE→ADULT_DOMAIN→KEYWORD→FEATURE. bare 실제host(www 보존)를 target_host/target_key로, frozen 선택행/null을 matched_policy_host로 유지. DNR이 DOM을 막았다면 수행하지 않은 FEATURE를 만들지 않는다.
8. 명령 응답 유실은 동일 operation retry/QUERY. 문서 소멸은 Core가 실제로 확인해 문서 의무를 별도 DOCUMENT_GONE 후보로 종결하고 Content RELEASED로 위조하지 않는다. 새 문서는 별도 적용 의무다. 살아있는 문서 일부 실패가 있으면 전체 해제 성공 금지.
9. release 실패의 잔여 Changes/원래 binding을 재시도 가능하게 유지. 늦은 Promise/observer 결과가 해제 뒤 재가림·새 이벤트를 만들지 않도록 제어 epoch 취소 필요.

## 5. 필요한 변경 분리 — 이번에는 미구현

| Content 담당 | Core 담당 |
|---|---|
| classic bundle/bootstrap 협업·문서 singleton | manifest/권한/기존 탭·새 문서 주입/정책 dispatch |
| projection→내부 shorts:true adapter·schema/송신자 검증 | feature_policies CRUD·검증·frozen Snapshot 보존·가장 구체 행 선택 |
| 직렬 queue·operation 캐시/high-water·재바인딩/epoch 취소 | operation/control_seq/binding/round registry·재시도/QUERY |
| 실제 viewer/media 증거·대상없음/관찰/미지원/실패 구분 | 필수 대상 문서 집합·신규/닫힌 탭·부분실패 rollback·전체 APPLIED 집계 |
| 복원 후 소유 속성 검증·잔존 수·해제 retry | 종료 중 해제 권한·문서 소멸 확인·Journal/Server 보고 |
| 합의된 FEATURE_RESULT/후보 보고 | ALLOW+feature nav·history 경계·draft/freeze·feature 조회/반복/중복 방지 |

naver.com뿐 아니라 임의 xxx.naver.com도 개별 설정이 가능하고 가장 구체적인 전체 행이 우선한다. Content에 치지직 특별 예외나 부모 flags 합산을 넣지 않는다. 세션 중 변경은 다음 세션, 재개는 동일 Snapshot. Content Shorts용 DNR을 만들지 않는다.

## 6. 다훈과 합의할 Server 항목

1. 설치 준비/문서 무대상/관찰중/실제 효과/부분실패를 현행 APPLIED·UNCONFIRMED·RELEASED/회원 Journal 보고로 집계하는 기준. Content data는 Server 보고 형식이 아니다. 서버 접수만으로 RUNNING 표시 금지.
2. 초기 round timeout/문서 소멸/늦은 FEATURE의 진단·품질·조회 필요성. 새 필드/API 필요 시 공용 계약 변경 선행, 현행 annotation 없음.
3. SITE 즉시 저장→draft/freeze 전환에서 기존 SITE/FEATURE 한 접근·실제host repeat·seq·불변 원문 유지. BOUND-19 옛 단일사유 문구 정리.
4. 회원/비회원 Snapshot 스키마/명령 revision·기간/실행보고 호환과 검증 설치 gate. Snapshot1.2 신규 발급 기본 OFF 유지, 실제 제품 Chrome 검증 전 전체 통합 완료 선언 금지.
5. 현재 DNR ID100000/priority100+깊이는 구현 사실이지 승인 예약 아님. 규칙 소유는 Core. Server가 Content rule_id를 요구하는 경로/필수성 확인 후 결정하며 임의 ID 발급 금지.

## 7. 작은 구현 단위·검증 순서

1. 공동 결정: type/ready·QUERY 미결속 상태/enum·round/seq·캐시/상한·문서 집합·시간/소멸·Server 집계 확정. 승인 전 제품 코드 없음.
2. Content 증거 adapter: 합의 후 모의 DOM의 media0·복수 viewer·pause 실패·복원 실패·늦은 DOM 검증. 기존33개는 그때 회귀 재실행, 이번 문서 검토에서는 미실행.
3. 비회원 주입/제어: 모의 Chrome API/validator·stale/멱등 순서 검사→실제 제품 Windows Chrome 새 문서/기존 탭/새로고침 자동 적용/직접/SPA/history/중복 bootstrap/종료·복원/설정 다음세션. 과거 수동 harness6단계를 제품 자동 연동 성공으로 치환하지 않음.
4. 탐색/기록: 모의 순서역전/중복/late/유실/저장실패→제품 Chrome 명시1건/렌더0/초기적용0/실제host repeat/복수사유1건/freeze불변/기존SITE 회귀. 실제 제한 실패는 성공 접근 통계 제외.
5. 회원/복구: 다훈 계약 확인 후 Chrome→Core→Server→DB→Web 적용/해제·이벤트 검증. Worker/브라우저/문서 소멸·오프라인·부분실패·rollback 별도 시험. Core 담당이 PR17을 수정하며 본 브랜치에서 병합하지 않음.

## 8. 상태·검사·다음 행동

- 과거 근거: 자동33/33은 합성 DOM/모의 정책 Windows Chrome 엔진 결과. 사용자 YouTube6단계는 시험용 확장 정상 실행 보고. 29개는 이전 이력. 이번에는 재실행/재관찰하지 않았다.
- 미검증: 새 JSON 제품 지원/제품 주입·Core/Server·회원/비회원 통합·재시작/실패복구. 이번 기능 테스트 NOT RUN.
- 실패: 신규 테스트 실패 판정 없음(미실행). 코드 대조 차단점은 feature 정책 거절/제품 주입·receiver·nav 부재/SITE 즉시 저장/Content 증거·문맥·멱등·round 부재. 가짜 성공으로 우회하지 않는다.
- 조율 필요: 위 제안 type/enum·ready/QUERY, seq 영속/상한·캐시, 적용 문서 집합/rollback/소멸, media0 성공 기준, 자동 Shorts 진입 경계, round deadline/freeze/늦은 진단, 회원 보고 집계.
- 이번 검사: JSON 예시 파싱/짝·필드 일관성, 링크/참조, 변경 파일 범위, git diff --check. 실제 결과는 작업카드에 기록한다. 문서 검사 PASS를 제품 동작 PASS로 부르지 않는다.
- 다음 행동: PR21에 이 회신 링크와 남은 결정 반영→종민이 항목별 수락/수정 회신→다훈 관련 합의→공용 계약 공동 확정→최소 연결 단위 구현. 본 회신 자체로 합의 완료가 되지 않는다.
