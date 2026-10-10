# D-06 필수 Shorts 메시지·성공 기준 초안 — 지민 검토용

상태: **미합의, 제품에 미구현**. 사용자 답변: 지민 회신 아직 없음. 이 문서는 다음 구현을 위한 검토 자료이며 기존 공용 계약을 변경하거나 승인하는 문서가 아니다.

기능 ID EXT-02 / POLICY-03 / EVENT-03, D-06 연결. 담당 Core 윤종민·Content 채지민, Event/회원 보고 검증 김다훈. Core 기준 b8bc7a17269a9c46981f6891f9fc92e9d98c38c9; Content 기준 2d681f0d8422e613e7adc0978d65cc30fa0b972d; Server 명세·SnapshotValidation/SnapshotAccess 대조 기준 develop90ad32be5d282f3b44c917a29e156dffc5e29187 (현재 Core에 merge하지 않음).

이번 목표: 필요한 wire 의미·실제 성공/실패·중복·탐색 경계와 테스트 순서를 구체화하여 합의 후 그대로 작은 구현 단위로 옮길 수 있게 한다. 현재 적용/해제 또는 이벤트 성공을 주장하지 않는다.

## 1. 이미 확정된 사항

현행 D01D10 D06과 API04에 따라 공통요청 {request_id,type,owner_context,payload}, 응답 {request_id,status,data,error} 유지. Content→Core 허용관찰 OBSERVE_ACCESS/FEATURE_RESULT 중 필수Shorts만 사용. Content는정책선택·계정인증·ID발급·DNR·Server저장/보고를하지않는다. 부모feature정책을섞지않고Core선택사이트행전체를기준으로한다. 세션설정변경은다음세션. Event1.2 bare호스트키·www보존·matched_policy_host·확인된복수사유·전송원문불변 유지.

최신 Server는 feature_policies[].feature_code=YOUTUBE_SHORTS와boolean enabled를검증한다. Content 내부features.shorts boolean은adapter에서변환할필드며ServerSnapshot형식을바꾸지않는다. Core는현재비어있지않은feature_policies를거절하므로이검증·GuestCRUD·frozenSnapshot지원이별도필요하다.

## 2. 제품 주입 및 동기화 제안

- 첫범위: HTTPS youtube.com/www.youtube.com top frame, isolated world. 다수iframe/Instagram/성인·키워드/모델은후속.
- 제품용 classic bootstrap/bundle을패키징하여manifest정적주입하는안과 chrome.scripting을이용한주입안중하나선택. ESM.mjs를그대로content_scripts목록에넣지않는다. 기존열린탭은정적주입만으로충족하지않으므로별도부트스트랩/재주입전략이필요하다.
- 새문서ready에서Core현재실행을조회하고Core가서명아닌내부문맥binding을만들어전달. ready조회요청의이름/허용범위는아직미합의: GET_STATE를Content용으로자동허용하지않는다. 팝업sender검증과Content검증을분리한다.
- Core→Content 제어 type 후보는아래 D06_CONTENT_CONTROL. APPLY/RELEASE/QUERY를operation으로구분하는**신규초안**이다. 아직현행제품type가아니며지민과합의전listener/발신추가금지.
- SPA가같은document를유지해도Core가명시탐색경계를확인해새navigation binding전달. pending시알수없는 navigation_id를Content가임의생성하지않는다.
- Content에token/proof/PKCE·전체Snapshot·개인본문·query/영상ID저장값을전달하지않는다. 필요시최소호스트+내부feature코드만반환한다.

## 3. 필드 제안 및 요청 예시

아래UUID는모두가상값. 필드/enum/버전문자열은**후보**이며구현지원선언이아니다. context는ServerCommand JSON을대체하지않는다. operation_id는Core의문서단위멱등제어ID,Server command_id/action_id/seq와구분. binding_id는검증된owner/session/revision/document/navigation에Core가묶는내부ID. tabId/frameId는Core전송대상과runtime.sender에서확인하며Content임의body값을신뢰하지않는다.

### 적용 요청 — Core에서 검증된 문서로만

```json
{
  "request_id": "77777777-7777-4777-8777-777777777777",
  "type": "D06_CONTENT_CONTROL",
  "owner_context": "GUEST:33333333-3333-4333-8333-333333333333",
  "payload": {
    "contract_version": "d06-shorts-draft-1",
    "operation_id": "88888888-8888-4888-8888-888888888888",
    "operation": "APPLY",
    "context": {
      "session_id": "11111111-1111-4111-8111-111111111111",
      "policy_snapshot_id": "22222222-2222-4222-8222-222222222222",
      "executor_id": "33333333-3333-4333-8333-333333333333",
      "desired_revision": 1,
      "document_id": "44444444-4444-4444-8444-444444444444",
      "navigation_id": "55555555-5555-4555-8555-555555555555",
      "binding_id": "66666666-6666-4666-8666-666666666666"
    },
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

Snapshot/호스트정책은최소부분을projection한것이다. 실제frozenSnapshot원문은Core에보존하고그원문에서다시선택·검증한다. 매칭사이트가없으면 matched_policy_host/access_policy null과비활성기능의의미를별도합의한다. 적용중GLOBAL후보를이초안에슬쩍추가하지않는다.

### 적용 확인 응답 — 예시

```json
{
  "request_id": "77777777-7777-4777-8777-777777777777",
  "status": "OK",
  "data": {
    "contract_version": "d06-shorts-draft-1",
    "operation_id": "88888888-8888-4888-8888-888888888888",
    "operation": "APPLY",
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
    "capability": "SUPPORTED",
    "effect": "CONFIRMED",
    "observation_complete": true,
    "evidence": {
      "viewer_present": true,
      "viewer_hidden": true,
      "playback_stopped": true
    }
  },
  "error": null
}
```

status OK는메시지처리성공일뿐이다. Core는context와실제DOM effect를검증한뒤별도journal과실행보고를생성한다. 아래enum은내부초안이며Server Capability/APPLIED enum을변경하지않는다.

| 상황 | capability 제안 | effect 제안 | 세션/이벤트 판정 |
|---|---|---|---|
| 직접Shorts viewer 숨김·재생정지 확인 | SUPPORTED | CONFIRMED | 올바른탐색문맥과활성정책확인후접근후보수용 |
| 일반영상에서Shorts링크/선반만 제한 | SUPPORTED | CONFIRMED 또는 NOT_APPLICABLE | 페이지상태별실효구분; 내부지원확인만으로Shorts접근0→1금지 |
| 일반영상에현재Shorts대상없음 | SUPPORTED (adapter준비검증시) | NOT_APPLICABLE | 실패/전체성공둘다자동판정하지않음; listener준비와실제제한분리 |
| 직접Shorts인데viewer늦게등장 | SUPPORTED 또는미확인 | UNCONFIRMED | 관찰유지; 성공접근통계제외,완료시점별도합의 |
| DOM 미지원 또는유효한필수adapter없음 | UNSUPPORTED | UNCONFIRMED | 활성필수정책지원불가,부분적용성공금지 |
| 숨김/재생중지예외·관찰실패 | FAILED | UNCONFIRMED | Core실패/rollback경로,기존데이터보존 |
| release 작업·원상복구확인 | 기존지원값 | CONFIRMED | 문서집계및DNR해제와함께Core RELEASED확정 |
| release 복원실패/응답유실 | FAILED/미확인 | UNCONFIRMED | 종료성공표시금지,재시도자료유지 |

Content의현재 {feature,status,changed}는위필드의자동증거가아니다. 지민adapter가실제viewer/재생/observer복원확인결과를추가해야한다. 대상없음기준과미지원판별도공동합의한다. fake CONFIRMED 응답으로Core통과금지.

### 해제 요청·실패 응답

동일공통envelope에서 operation RELEASE,새operation_id,현재문서binding을사용. policy는해제에서생략하는안제안. 감지timer/observer/listener먼저중단→스타일·안내복원→결과전달. 과거session/revision의늦은결과로재가림금지. 해제는RUNNING만받는일반접근검증과분리하여종료전환중원래문서도해제할수있게한다.

실패는status ERROR,error {code,message}에등록된안전한code만반환. 후보 UNKNOWN_DOCUMENT,STALE_CONTEXT,OPERATION_CONFLICT,UNSUPPORTED_FEATURE,APPLY_UNCONFIRMED,RELEASE_UNCONFIRMED. 실제APIcode와충돌하는지합의후whitelist확정;본문/토큰/JSstack을wire에싣지않는다.

## 4. 중복·sender 검증과 적용집계

- 동일operation_id+문맥+동일canonicalpayload는기존결과응답. 다른payload면충돌. request_id가달라도동일실행을중복적용하지않는다. 새문서는새operation binding.
- Core는sender.id=현재확장,tab존재/frame0,documentId,active문서,url지원host,owner/executor/session/snapshot/revision/binding 일치검증. unknown/stale/다른owner/종료세션관찰은event/state변경없이거절한다.
- Content는페이지MAIN world window.postMessage를정책명령으로신뢰하지않는다. credentials는Core만소유한다.
- APPLIED집계전에필수Content adapter주입/지원과현재대상문서결과를분리한다. 현재열린문서중어떤집합을명령적용완료의필수로볼지,탭닫힘/문서교체/대상없음/신규탭/시간초과/부분성공을어떻게journal에보존할지**미합의**. 일부실패를성공으로묶지않는다.
- release실패가있다면원상복구할수있도록실패문서/원래binding/남은변경을유지한다. 새문서에서죽은DOM복원은불가능하므로document소멸의확인기준도합의한다. 단순sendMessage예외=해제성공금지.

## 5. 탐색 관찰·한 접근 확정 초안

```json
{
  "request_id": "99999999-9999-4999-8999-999999999999",
  "type": "OBSERVE_ACCESS",
  "owner_context": "GUEST:33333333-3333-4333-8333-333333333333",
  "payload": {
    "contract_version": "d06-shorts-draft-1",
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
    "target_host": "www.youtube.com",
    "observation_id": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    "entry_kind": "ROUTE_CANDIDATE",
    "effect": "CONFIRMED",
    "observed_at": "2026-10-10T08:00:00.000Z"
  }
}
```

Content후보는새접근생성권한이아니다. Core는webNavigation commit/history 경계로받은동일문서/nav문맥및활성Shorts정책·effect확인을결합한다. initial injection/단순rerender/일반영상선반숨김은OBSERVE_ACCESS로새접근을만들지않는다. 명시Shorts직접/SPA진입은새탐색후보고할수있다. 시작시이미열린Shorts를제한하는것과실제새진입을통계상구분한다.

| 탐색 상황 | 권장 문맥/접근 처리 (합의 대상) |
|---|---|
| 링크·주소입력→Shorts commit | Core가새navigation바인딩,정책/실제제한확인후1건 |
| 일반영상→Shorts SPA/뒤로·앞으로 | Core history/route확인후새문맥;Content후보와동일이동중복병합 |
| Shorts 문서reload | 새document/newnav,실제재방문과정책자동재적용을구분;성공시실제방문1건 |
| 차단안내reload/Mutation/중복scan | 새접근0건 |
| 자동플레이로Shorts item이바뀜 | 사용자명시탐색여부미확인;무조건새접근발급금지,경계별도합의 |
| query/fragment만변경 | 모든변경을새접근으로간주하지않음,기능route/명시사용자이동판정별도 |
| failed/cancelled 또는다음nav뒤늦은error | 실패nav정리,다음문맥보존 |

### 이벤트 확정의 남은 결정

차단은첫조건확인즉시실행한다. 저장/전송은동일navigation의Core관찰과Content초기관찰완료를묶는draft에서1회freeze하는안을제안한다. 초기round완료신호·문서소멸·실패·지연의종결조건/최대대기는미확정이다. 숫자timeout과정상감지미확인처리를임의로정하지않는다. 오래된/freeze후결과는진단만하며같은event_id원문수정또는새접근생성금지. 늦은FEATURE를버리면불완전통계가될수있으므로품질표시/실패진단·Server조회계약필요여부도다훈과합의한다. annotation API는없다.

- Event1.2 target_key/target_host=www.youtube.com, matched_policy_host=youtube.com (선택한행).
- FEATURE포함확인시 BLOCKED_FEATURE_ACCESS/FEATURE/YOUTUBE_SHORTS. 대표reason은사유우선순위대로, FEATURE가대표일필요없음.
- SITE BLOCK이DNR로DOM진입을막았다면실제로수행하지않은FEATURE를붙이지않음. 복수사유시확인된증거만같은접근에통합.
- draft저장/원문freeze/outbox ACK와navigation중복방지가atomic해야함. 기존SITE committed이벤트에뒤늦은FEATURE를덧붙이는방식금지.

## 6. 구현 단위와 검증표

| 단위 | 구현 대상 | 통과에 필요한 근거 |
|---|---|---|
| A. 정책주입·결과 | 확정된wirevalidator/Core senderguard/Content adapter/bundle/manifest/Guest feature지원 | 모의기술회귀와제품Chrome:직접·일반·SPA·새로고침자동재적용·해제·복원·stale/중복/실패구분 |
| B. 탐색·기록 | navigation binding/draft freeze/FEATURE목록·반복집계 | 동일이동1건·rerender0건·호스트별repeat·SITE기존회귀·복수사유·late불변·저장실패오표시방지 |
| C. 회원통합 | 최신ServerCommand/Journal/APPLIED·RELEASED/Event HTTP전송 | 실제회원Chrome→Server→MySQL→Web,합성HTTP와구분 |
| D. 복구 | Worker/브라우저/절전/오프라인/reconcile | 실제환경근거,지원하지않는자동 복구은BLOCKED유지 |

AC-POLICY-03-01 대상기능만/전체사이트차단우선; -02 실제제한실패성공접근통계제외; -03 정지·종료복원/중복관찰1접근. BOUND-19은현재공용복수사유1건과대표사유우선으로해석하고옛문구의사유1개만저장을그대로구현하지않음. 문서간충돌은다훈에표시한다.

## 7. 지민·다훈에게 요청할 결정

1. 지민: 제어type/ready조회·계약버전·context/operation_id 의미와지원결과(effect/불해당/관찰완료) 필드에동의하는지,Content기존모듈에필요한보완.
2. 지민·Core: 기존열린탭주입방식,필수문서집계·문서소멸·부분실패rollback·release확인.
3. 지민·Core: SPA/history/reload/자동Shortsitem의새접근경계와operation/observation중복.
4. 다훈·지민·Core: 초기관찰round종결/최대대기/늦은사유품질처리;현Event1.2에영향이있으면공용문서변경먼저합의.

## 판정

미검증: 제품wire·주입·전체연결,이번테스트미실행. 실패: 실행실패평가없음,검토상미합의차단점있음. 조율필요: 위4가지결정. 다음행동: 검토회신을받아합의한A단위부터구현. 이문서만으로제품계약이나수용기준통과를확정하지않는다.
