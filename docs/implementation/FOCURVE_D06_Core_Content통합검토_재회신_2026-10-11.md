# D-06 Content 통합 검토에 대한 Core 재회신

2026-10-11 KST / 종민 Core / EXT-02·D-06 계약 검토 / feature/extension-core-ext-02 / 시작 c0ac1df75e7987a0273b454262c51f22388c30e8 / PR #17.

지민의 통합 전달문과 U별 상세 의견을 읽고 아래와 같이 회신한다. **수락은 Core 담당자의 제안 동의이며 공동 계약 승인·착수 승인이 아니다. U-01~U-08은 미합의 유지한다.** 이번 작업은 문서뿐이며 제품 코드와 공유 schema는 구현하지 않았다.

## 대조 기준

- Core 제품 코드: e23d74b5bee9bccec18b5c761155db11a3a23798 (0.1.20). 직전 검토 문서 커밋 c0ac1df75e7987a0273b454262c51f22388c30e8.
- Content: 2c56d4010697f630f4123c1395d672e4fd569c58. c0a1674 이후 변경은 통합 검토 문서와 작업 기록 4개뿐이며 제품 코드는 같다. git show로 읽었고 checkout/merge하지 않았다.
- Server 계약: 기존 고정 기준 90ad32be5d282f3b44c917a29e156dffc5e29187 유지. 이번에 Server 신규 HTTP/DB 시험 없음.
- AGENTS·개발운영·EXT-02 카드·통합현황과 기존 3문서 검토 응답을 유지한다. 원본 첨부, PR #21 및 추가 MVP는 수정하지 않는다.

아래 C는 Core 고정 SHA, T는 Content 고정 SHA의 위치다. 제품 구현이 없는 부분을 구현 예정으로 구분했다.

## U별 회신

| U | 판단 | 코드 충돌·이유 | 권장 대안·미합의/검증 |
|---|---|---|---|
| U-01 | **수락 + schema 보류** | C manifest.json에 제품 Content 주입이 없고 T controller.mjs:21은 library start만 제공한다. QUERY/receiver/instance handshake는 미구현 | Core 주입→QUERY→push, target_document_id echo와 Content instance 결속 방향 수락. 문서 ID echo는 인증이 아니므로 Chrome의 실제 대상 routing/sender와 registry epoch로 대조한다. instance는 bootstrap lifetime 동안 안정적으로 유지하고 기존 주입은 singleton으로 중복 생성하지 않는다. null QUERY는 BOUND여도 지원 버전·instance·안전한 readiness 요약만 반환하고 owner/session/policy/current_result를 제외한다. null 예외는 QUERY에만 적용. 새 READY/버전 fallback 없음. 최종 필드·응답 허용 목록 및 sender 실험 승인 전 보류 |
| U-02 | **수락 + 경계 수정안** | C src/document-control-registry.js:28,99,113은 durable 내부 stage와 APPLY 포화 거절을 제공하지만 Content 완료 cache/ACK 불변 wire를 구현한 것은 아니다. T controller.mjs:21 중복 start는 예외 | observation_id+정규화된 동일 의미 원문이면 최초 data를 그대로 재응답하고 현재 request_id로 감싼다. disposition을 DUPLICATE로 새로 바꾸지 않는다. 같은 ID/다른 원문은 충돌 거절; 최초 ACK는 현재 정책 효과가 아니다. 최초 판단 전에 scope/epoch 검사하고 과거 cache replay는 새 상태 변경 없이 처리한다. 완료 FIFO와 high-water/활성/cleanup 의무를 분리한다. cache eviction 뒤 oldseq는 STALE_CONTROL 제안, 높은 seq로 old ID 재사용도 fingerprint로 탐지. 신규 APPLY를 거절해도 RELEASE 처리·저장 공간을 따로 보장해야 한다. registry 현 stage가 포화에서 RELEASE를 허용하는 사실만으로 전체 보장 완료라 하지 않는다. seq MAX에서도 해제 가능한 경로는 별도 승인 필요. INACTIVE를 GONE으로 버리지 않는다. 용량·시간은 전부 시험 후보 |
| U-03 | **초기 방향 수락 / 회원 runtime 보류** | C src/member-execution-loop.js:170~185는 현재 SITE-only DNR 결과를 보고한다. Content 대상 집계는 없다. 고정 Server ExecutionService.java report 경로의 ACKNOWLEDGED 재보고 충돌과 UNCONFIRMED/RUNNING 경계를 바꿀 권한은 없다 | R0와 generation, 대상 0 readiness/coverage 구분 수락. 승인된 필수 문서 하나라도 실패/미확인이면 전체 APPLIED 금지; 늦은 옛 generation 성공은 현재 집계에 넣지 않는다. 교체·inactive 의무를 삭제해 성공하지 않는다. runtime fault는 Content 사실→Core last-trusted·owned cleanup까지만 방향 동의, 기존 command 재보고·자동 END 사유·interval/reconcile 표현은 다훈의 정확한 경로와 HTTPDB 검증 전 보류. pending 복원은 RELEASED가 아니다 |
| U-04 | **수락 + 무매칭 schema 보류** | C background/host-policy.js validateSnapshot은 회원 양수 10진 문자열/Guest UUID를 검사한다. T에는 rule_id 생성기가 없다. 공통 UUID 제약은 실제 회원 Snapshot과 충돌 | frozen 원문 site_id를 변환 없이 echo하고 Core가 profile별 검증. feature:<snapshot_id>:<원래 site_id>:YOUTUBE_SHORTS 내부 안정키 방향 수락. Content는 DNR ID를 발급하지 않는다. 무매칭은 site_id/rule_id null 또는 제어 없음 분기를 하나로 승인해야 하며 비활성 selected row와 무매칭을 구분한다. 200자 제한은 wire 예산 시험 후 확정; 다른 profile 키는 이번 범위 밖. Server Event 필드 추가 없음 |
| U-05 | **수락 / Content 구현·실제 검증 필요** | T shorts.mjs:24~39는 viewer의 media 0에서도 SUPPORTED 가능하다. changes.mjs:19~30은 setter 성공 후 잔여 검사 없이 ledger entry를 지운다. controller.mjs:66 publish는 census 증거가 아니다 | viewer_count>0, 전수 hidden/inert, media_count>0와 전수 paused, observer 준비·오류 없음의 실제 재검사 방향 수락. inert_viewer_count를 포함하되 숫자 assertion 자체를 DOM 증거로 삼지 않는다. media0는 숨김을 유지해도 첫 범위 APPLIED 불가. 일반 route의 0/0은 readiness/NOT_APPLICABLE이며 접근이 아니다. 해제는 owned 잔여 검사 후 ledger 완료; silent setter/pause 실패·일부 대상 실패·페이지 후속 변경 보존을 시험한다. 자동 재생을 강제 재개하지 않고 사용자 직접 재생 가능성을 확인한다. 정확한 증거 필드/오류 목록은 승인 필요 |
| U-06 | **종류별 ID·공통 round 방향 수락 / 이벤트 보류** | T controller.mjs:66은 매 scan publish하며 wire 관찰 ID가 없다. C src/member-access.js:9~42는 draft+seq+original을 한 DB에 원자 저장하나 전송함은 별도 DB다. FEATURE round/freeze writer는 없다 | FEATURE_RESULT와 OBSERVE_ACCESS는 다른 observation_id를 쓰고 재전송은 같은 ID/원문 유지. 두 메시지는 Core가 부여한 context.navigation_id+observation.round_id+rule_id/결속 scope로 연결한다. nested observation.round_id 통일 방향 수락, 실제 전체 schema는 승인 필요. 같은 관찰 ACK retry가 새 access/Event가 되지 않게 한 access draft에서 한 writer만 freeze. 즉시 제한과 barrier를 분리한다. original 원자 저장→durable replay→같은 ID/body outbox 멱등 복사 대안 유지. timeout/late/RECORD·품질·Server 접수 경계는 다훈 포함 보류. 첫 단계 접근 이벤트 생성 0 |
| U-07 | **보수 제외 수락 / 명시 접근 경계 보류** | T entry.mjs featureEntry는 URL 종류 판별일 뿐이다. C src/member-access.js 기존 native SITE draft는 Content SPA 의도를 증명하지 않는다 | 초기 주입/QUERY/Mutation/선반/자동 item/query/fragment는 새 접근0, 구분 못 하면0 방향 수락. isTrusted 클릭 단독으로 확정하지 않는다. 후속 B에서 trusted Core traversal과 문서·nav·round를 연결한 일반→Shorts/직접/reload/back-forward 증거를 실제 검사한다. Shorts→Shorts 개별 클릭 집계와 최소 증거는 세 명 승인 전 보류 |
| U-08 | **원칙 수락 / 실제 수명 보장 보류** | C src/document-control-registry.js:60~83은 교체 문서 INACTIVE와 confirmGone을 분리한다. T controller.mjs:37~42는 URL 변화 release→apply이며 pagehide/pageshow 보호 guard는 없다 | 교체≠GONE, senderror≠RELEASED 방향 수락. 원래 applied_binding/ledger/seq/cleanup 의무 보존. 같은 문서 b1/b2의 DOM ledger 공유도 별도 연결해야 한다. 응답 유실은 처음 불변 응답 재시도/현재 QUERY로 확인하며 새로운 성공을 추정하지 않는다. BFCache 재활성 전 guard/rebind 가능성·dormant cleanup은 실제 Chrome 실험 후 승인. A0에서 교체/휴면 발생 시 범위 밖·미확인으로 종료하고 복원 확인 없이는 성공으로 기록하지 않는다 |

## 승인 후 최소 단위 제안

지민의 **비회원·Shorts 한 정책·지원 top-frame 한 활성 문서, 주입→QUERY→제한→해제 복원, 접근 이벤트 0** 방향을 Core 측에서 수락한다. 단, 승인 없는 착수는 하지 않는다.

A0 독립 projection 제어시험과 A1 제품 Guest frozen Snapshot 연결을 구분한다. A0용 U01/U02/U04/U05 및 U03/U08 최소 안전처리를 다훈·종민·지민 세 명이 명시 승인하고 U06/U07/회원runtime 비활성 범위를 기록하는 단계별 예외안이 필요하다. 이는 G-01 전체 승인 조건을 우리 둘이 임의로 완화한 것이 아니다. CO-01~CO-18/CT/T 기준을 낮추지 않는다. A0는 실제 Snapshot/기존·새 탭/SPA/BFCache/Server 전체 기준을 통과시키지 않는다.

순서는 승인 schema·projection/queue/문맥 실패 모의 시험 → Chrome 합성 DOM → 실제 제품 YouTube 적용/복원이다. 기존 탭/새 문서 및 제품 Guest 활성 연결은 A1로 구분한다. scope/version/ID/ACK/cache 분리·RELEASE 공간·owned restore ledger가 첫 단위의 필수 검토 대상이다. 이번에 체크박스 완료 처리하거나 실행 코드를 추가하지 않았다.

## 별도 Core 결함 3건 — 수정 결과

수정 SHA **e23d74b5bee9bccec18b5c761155db11a3a23798**, 제품0.1.20, PR #17 Push 완료.

1. F-17-01: Snapshot 전체 필수 구조·타입·값/owner/executor 검증 후 journal/DNR 적용. 잘못된 원문을 자동 보정하지 않는다.
2. F-17-02: 유효한 YOUTUBE_SHORTS enabled:false를 1.1/1.2와 Guest에서 보존·허용, 활성 true는 제품 미지원 유지, null/잘못된 구조는 거절.
3. F-17-03: bundle 입력 CRLF→LF 정규화와 CLI 경로 처리, LF/CRLF 생성물 동일성 검사.

직전 실제 실행: 전체 자동 **233/233**, JS 구문, CRLF fixture PASS. 상세 [수정 근거](evidence/EXT-02-2026-10-11-core-defects-three.md). 기존 Guest/회원 Server 연동·추가 MVP 보존. 수정본 독립 재리뷰와 실제 Windows/MV3/Server HTTP·MySQL는 미완료다. 이번 문서 회신에서 기능 테스트를 재실행하지 않았다. 과거 Content33개·YouTube6단계는 과거 근거로만 유지한다.

## 이번 검증·게시 범위

최신 Content 문서 2개 및 고정 코드 정적 대조. U8개/로컬 상대 참조/고정 코드 위치/문서 diff 검사만 실행한다. 제품 D06 wiring NOT IMPLEMENTED, 신규 D06 통합 테스트 NOT RUN, U 공동 승인 미완료. PR #17 문서 갱신만 하며 PR #21 수정·팀원에게 직접 메시지 전송·develop 병합은 하지 않는다.

- [직전 Core 3문서 응답](FOCURVE_D06_Core_3문서_검토응답_2026-10-11.md)
- [Content 통합본](https://github.com/kdu-sw-capstone/capstone-project/blob/2c56d4010697f630f4123c1395d672e4fd569c58/docs/implementation/Content_D06_종민전달_통합검토_2026-10-11.md)
- [Content U별 상세 의견](https://github.com/kdu-sw-capstone/capstone-project/blob/2c56d4010697f630f4123c1395d672e4fd569c58/docs/implementation/Content_D06_다훈계약안_검토의견_2026-10-11.md)
- [Core PR #17](https://github.com/kdu-sw-capstone/capstone-project/pull/17) · [Content PR #21](https://github.com/kdu-sw-capstone/capstone-project/pull/21)
