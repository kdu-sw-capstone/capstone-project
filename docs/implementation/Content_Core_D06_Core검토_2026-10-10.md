# D-06 Core 검토 의견 — Shorts 연결 경계 (제안, 미확정)

검토일 2026-10-10 / 윤종민 Core 영역. Content PR21 Draft HEAD `2d681f0d8422e613e7adc0978d65cc30fa0b972d`; Core PR17 HEAD `b8bc7a17269a9c46981f6891f9fc92e9d98c38c9`. Content의 기존 비교 기준9b063be 이후 Core는 auth/event fetch 바인딩을 수정했으나 Content 주입/메시지/탐색 구조는 아직 연결하지 않았다. 최신 develop90ad32b는 Content 시작 기준이며 현재 Core에 반영한 것으로 표시하지 않는다.

## 읽은 자료와 검증 범위

PR21 본문, Content_Shorts_2026-10-10.md, Content_Core_D06_연결제안.md, tasks/POLICY-03.md, content/controller.mjs·features.mjs·shorts.mjs·entry.mjs를 Content의 고정 HEAD에서 확인. 공용 D01D10의 D06, 인증/복구11, 이벤트12, API04와 Core manifest/service-worker/access-store/session-core/site-store/host-policy/member-events를 대조했다.
Content 자동33/33과 실제YouTube6단계는 PR/문서에 기록된 담당자·사용자 결과이며 이번 검토에서 재실행하거나 직접 관찰하지 않았다. 29개는 이전 이력, 33개는 최신 기록이다. 코드/메시지 구현·브랜치병합·외부댓글/메시지전송 없음.

## 수용 가능한 방향

Core가 정책선택·owner/session/snapshot/revision·명령·DNR·탐색ID·저장·전송을 소유한다. Content는 Core가 선택한 가장 구체적인 사이트행 전체의 기능flags와 frozen 전역정책만 받아 DOM 제한/복원 및 최소 증거를 반환한다. 부모행 flags 혼합·설정 실시간반영·페이지계정주장·토큰전달 금지. 필수Shorts부터 연결하며 성인/키워드/이미지 모델·추가MVP는 별도단위다.

## 확인한 제품 연결 차단점

1. Core manifest에 content_scripts/scripting권한·Content번들 없음. ESM .mjs 모듈은 시험harness의주입을그대로제품manifest에복사하면 안됨. 제품용번들 또는 bootstrap/주입 전략을 정해야 한다.
2. GuestSites.validate는 feature_policies가 비어있지 않으면 FEATURE_NOT_IMPLEMENTED. session-core도 활성기능을거절한다. 정책저장/Snapshot/실행검증을같이연결해야하며 거절코드만제거하면안됨.
3. Core에 OBSERVE_ACCESS/FEATURE_RESULT 수신과 historyState/fragment 탐색경계가없음. pending은BLOCK/RECORD사이트만생성하고 Content전용접근에는ID가없다. 탐색문맥발급과이벤트대상선택을분리해야함.
4. AccessStore.commit은곧바로SITE이벤트저장. local목록도BLOCKED_FEATURE_ACCESS를조회/반복집계하지않음. feature접근을기존SITE이벤트와중복추가하거나전송된원문수정하면계약위반.
5. Content start는중복시CONTENT_ALREADY_ACTIVE, scan은렌더/Mutation마다결과를발행. 결과에는Core command/document/navigation 문맥이없다. SUPPORTED를Server APPLIED나새접근으로직접변환할수없다.
6. Content siteBlocked는feature를억제한다. 실제수행하지않은FEATURE사유를붙이면안됨. 키워드차단시features.apply도생략되어복수사유증거를동작순서만으로추정하면안됨(전역통합은후속).

## 연결 제안 — 공동 합의 전 제품 wire 계약 아님

| 항목 | Core 검토 제안 | 책임 |
|---|---|---|
| 주입/재적용 | YouTube HTTPS의 top frame부터 isolated Content bootstrap. 새문서ready에서 Core현재실행확인→frozen정책전달. 새로고침/SPA/기존열린탭도지원; 정책설정화면값을직접읽지않음. enabled없으면release/noop확인. | Core 주입·정책, Content bootstrap |
| 문맥/보안 | 공통 request_id/type/owner_context/payload 및 응답 request_id/status/data/error 유지. session/snapshot/executor/revision·tab/frame/document는Core문맥과sender실제값대조. sender.id/HTTPS지원host/frame0/documentId·문서교체·세션종료·계정변경·revision불일치거절. 비밀키/본문/전체URL불전달. | Core 검증, Content 문맥반환 |
| 타입 | Content→Core는기존 OBSERVE_ACCESS/FEATURE_RESULT만사용. 정책/해제의Core→Content type, version,필수필드,크기상한,오류enum은다음협의에서정의; TEST_SHORTS_* 재사용금지. 이미지type는이번미사용. | 공동합의 |
| 적용/해제 | transport응답과실제DOM결과분리. 적용대상/불해당/미지원/실패를구분; changed수·SUPPORTED만으로전체적용확정금지. 해당문서의관찰된Shortsviewer숨김·재생정지확인. release는observer/timer/listener중지·스타일복원확인, 실패시retry가능한상태유지. | Content 관찰, Core 세션/report집계 |
| 중복명령 | request_id는응답상관,내부실행ID는멱등식별. 동일ID/같은payload는저장결과재응답,다른payload충돌. 동일revision재전달로start중복호출금지. 신규document는새적용문맥. 오래된결과는관찰해도상태변경금지. | 공동adapter |
| 성공집계 | 설치준비·문서불해당·실제제한확인을구분. 탭이없거나일반영상에viewer가없다는이유를설치전체성공/실패로임의치환하지않음. 적용중문서집합/새문서/닫힌탭/일부실패/rollback집계기준을합의. Content결과는내부결과, APPLIED/RELEASED Journal 및Server보고는Core만생성. | Core, Server계약확인 |
| 탐색 | Core가실제commit/SPA명시이동에서공통navigation_id발급. fragment변경을무조건새접근으로보지않음. direct/SPA/history/reload별경계확정; failed·자동렌더·추천숨김·이미지결과·차단안내refresh는신규접근제외. lateerror가다음탐색지우지않는기존guard유지. | Core 탐색, Content 후보 |
| 이벤트 | session+navigation+실제정규화host로한접근. target_host/target_key는bare실제host, www보존; matched_policy_host는선택행/null. 실제확인된blocked_reasons만중복없이,대표 USER_SITE→ADULT_DOMAIN→KEYWORD→FEATURE. FEATURE있을때event_type/target_kind/feature_code는현Event1.2규칙. feature반복도같은실제host집계. | Core 저장, Server검증 |
| 확정시점 | 차단은첫유효조건확인즉시실행. 이벤트는Core관찰과해당navigation의초기Content관찰완료를구분해draft에서한번freeze하는안제안. 없는Content응답을성공으로보거나무한대기금지. 완료/실패/문서소멸/지연의종결조건·제한시간은별도합의; 임의ms선정없음. freeze이후원문변경/늦은사유로신규접근발행금지. 별도annotation API없음. | Core·Content·다훈합의 |
| DNR | Core만소유. 현재ID100000시작/priority100+host깊이는기존구현사실이며예약계약아님. 필수DOMShorts에DNR신설불필요. 이후global DNR과siteALLOW우선순위·ID범위는별도합의. | Core, Content 직접DNR금지 |

## 권장 실제 연결 순서

1. Core 최신 develop/공용계약을보존반영하고위wire필드·적용집계·탐색/freeze 초안을공동확정. 회원명령보고와충돌하지않게독립단위분리.
2. 제품주입 + frozenShorts정책 + actualapply/release응답/멱등/보안 먼저연결. 모의ChromeAPI와합성DOM은별도기록.
3. 비회원제품Chrome에서일반영상/직접Shorts/SPA/뒤로앞으로/새로고침자동재적용/기존탭/종료복원/다음세션설정/부분실패·rollback·stale결과검증. 단순브랜치합치기로완료판정금지.
4. 공통navigation+Event1.2를연결해한번접근1건/렌더0건/같은host재방문만repeat증가/저장실패성공금지/다른host분리·단일이벤트사유검증. 기존SITE회귀유지.
5. 회원명령·보고가준비되면실제Chrome→Extension→Server→MySQL→Web 통합. Worker재생성·브라우저재시작·절전·오프라인·늦은결과·Server장애는독립검증. Snapshot1.2 gate는검증전OFF, D01/D05자동복구는별도미구현유지.

## 지민에게 전달할 검토 의견

기본 책임분리와 가장구체적인사이트전체행/frozen정책방향에동의한다. 최신Core는b8bc7a1이며9b063be 이후인증fetch수정만있고D06연결은여전히없다. 우선필수Shorts만연결하자. Core가주입·문맥·탐색ID·집계를맡고Content가실제DOM적용/복원을보고하는안으로, 위메시지/멱등/불해당·실패/탐색·freeze종결조건을공동확정하자. SUPPORTED나반복scan을실행성공/접근으로직접처리하지않겠다. Core의feature정책거절·탐색생성·즉시SITE저장·feature조회도함께수정해야한다. 제품연결전독립33개·사용자6단계를전체통합PASS로올리지않는다.

## 최종 상태

- 미검증: 제품Core/Content주입·회원/비회원정책·이벤트·Server통합·재시작/복구. 이번실행테스트없음.
- 실패: PR기록상Content33개/사용자6단계정상. 이번재실행없으므로독립통과확인으로표현하지않음. 제품결합차단점은위6개.
- 조율 필요: 지민과wire·적용집계·문서/SPA탐색·중복·release실패, 다훈과이벤트freeze/늦은사유·회원보고범위.
- 다음 행동: 이검토안을사용자가지민에게전달→세부계약응답→확정된Shorts주입/적용/해제부터작은구현단위. 검토문서작성만했으며Commit/Push/PR수정/병합/외부전송없음.
