# 추가 MVP · 정책 발행·이용시간 수신 경계

- 담당: 김다훈 Web·Server·DB. Core·Content producer와 Shorts 안정화는 변경하지 않는다.
- 브랜치: `feature/additional-mvp-runtime-adapters`.
- 시작 기준: PR #25 head `6073442df501c4e381142ea6ed1108808d249814`.
- 현재 통합 기준: PR #25 병합 `202d6317ff7d88b6d5e916ec549e7ffff02f2d91`. 시작 기준과 병합 tree가 같음을 확인하고 이 독립 브랜치만 fast-forward했다.
- 계약: `AMVP-CONTRACT-20261029-RC2`, 계약 기준 `e2b3fc318fe52acc45145a30def07b874b2255f6`. 공유 계약·PR #25 파일 변경 없음.
- 상태: **PARTIAL — 독립 어댑터·HTTP·DB·UI 상태 검증 PASS, 실제 producer 연결 및 제품 수용 NOT_RUN**.

## 재사용한 구현·명세

PR #25의 `AdditionalConfigContract`, `AdditionalConfigStore.Admission`, `MemberAuth`, `AdditionalUsageStatistics`, `additionalConfigApi`, `AdditionalUi.Panel`과 빈 격리 DB fixture/실행 스크립트를 재사용한다. CRUD·인증·통계·기존 화면을 다시 구현하지 않았다.

원문: `contracts/additional-mvp/rc1/schema.json`, `api.json`, `mysql-runtime-candidate.sql`, `tests/review_reference.py`; `docs/design/additional-mvp-contracts/02_API_DB.md`, `03_Wire_D06_복원.md`, `04_정책_시간.md`. 디렉터리명 rc1과 달리 Schema/계약 revision은 RC2다.

## 실제 구현

1. **정책 발행**: 기존 config writer의 동일 트랜잭션에서 canonical RuntimePackage·RUNTIME_POLICY outbox·current pointer를 저장한다. binding/owner epoch, 서버 검증 capability receipt/유효기간, 적용된 timezone, 콘텐츠 feature/profile 권한을 확인한다. 실패 시 config/version/발행 전체가 rollback된다. 저장·발행을 Core APPLIED로 표시하지 않는다.
2. **고정 정책 부착**: 발행된 immutable package의 지정 `next_focus_revision`에서 콘텐츠를 가져온다. 원본 FocusRef는 trusted `FrozenFocusProof`가 검증해야 한다. 동일 요청은 영속 receipt로 재생하고, 다른 revision/Snapshot으로 기존 집중에 재부착하는 것은 거절한다. D06 Snapshot 변경·DOM 적용·실행 ACK 생성은 없다.
3. **이용시간 수신**: USG-01 item별 독립 transaction과 실제 bearer 재검증. 원본 canonical hash, active owner, 발행 package/revision/발행 시각, ALL_MATCHING attribution, 순번/hash chain, 단일 collector의 물리 구간 중복을 확인한다. 순번·package 누락은 기존 operation ledger에 ID/hash/위치를 예약하고 PENDING_DEPENDENCY로 남긴다. 재전송·수신기 재생성·동시 중복은 이중 집계를 만들지 않는다.
4. **측정·집계**: client TRUSTED만으로 COUNTED가 되지 않는다. 소유권이 일치하는 서버 VERIFIED anchor와 별도 ClockProof가 모두 있어야 한다. 나머지는 원본을 보존하며 QUARANTINED. 확인된 구간은 일일 정책마다 집계하되 새 day carry가 검증되지 않았으면 quota cache를 만들지 않는다. 기존 carry·day chain·limit를 임의 변경하지 않고 충돌 시 raw/receipt/projection을 함께 rollback한다. 통계는 구간 하나를 한 번만 합산한다. 이는 live Core 잔여 한도 증명이 아니다.
5. **HTTP**: PKG-01 GET current, FOC-01 POST attachment, USG-01 POST batch. `focurve.additional.runtime-bridge.enabled=true`와 서버 authority/proof bean이 필요하다. 기본 비활성·생산 verifier 없음. 켜기만 하면 CAPABILITY_NOT_VERIFIED. 재인증/보존 END 전용 서비스는 거절한다. request body duplicate key·추가 query·크기 제한을 검증하고 secret/raw SQL 오류를 반환하지 않는다.
6. **Web**: 독립 `RuntimeDeliveryPanel`은 기존 config API를 읽고 저장/적용 대기/미확인/미지원/정확한 revision 적용 상태를 구분한다. 설치 전환·늦은 응답·재조회 오류를 처리한다. `runtimeDeliveryState`는 usage ACK와 COUNTED/QUARANTINED를 구분한다. 기존 화면 entry 파일을 수정하지 않았으므로 **라우트 배치·Figma 시각 수용은 NOT_RUN**이다.

## 실제 연결과 대기 경계

| 경계 | 결과 |
|---|---|
| ConfigStore → canonical package/outbox/current pointer | 격리 MySQL PASS, 생산 capability source 대기 |
| Frozen issued content → immutable attachment/receipt | 격리 MySQL PASS, 원본 focus verifier는 SYNTHETIC |
| 실제 bearer/MemberAuth → PKG/USG HTTP → JDBC | MockMvc+실제 격리 MySQL PASS |
| Raw usage → quarantine/count → 기존 statistics | 격리 MySQL PASS, clock/carry producer는 SYNTHETIC |
| 기존 회원의 closed binding 기록 조회 | owner 이전 후 기존 회원 read-only 보존 PASS |
| Web 상태 패널 → 기존 API | 렌더링/API Mock 시험 PASS, 화면 배치 미완료 |
| Core/Content 실행·실제 effect ACK·RPT report 연결 | BLOCKED: 검증된 producer 및 근거 조회 연결 대기 |
| 비회원 로컬 collector/guest 원장 | 변경 없음, 실제 수용 NOT_RUN; 회원 서버 업로드로 대체하지 않음 |
| Chrome·Native·정상 END·복원·재기동 | NOT_RUN, 이번 승인 범위에서 제외 |

### 공유 계약을 임의로 바꾸지 않은 경계

- RuntimePackage에는 SITE_TIME과 focus_defaults만 있다. CADENCE/FOCUS_SCHEDULE은 별도 actor 경로가 필요하다. 이 publisher로 해당 변경의 실행을 발행하려 하면 UNSUPPORTED_CONTRACT로 rollback하며, 저장했다고 실행 가능으로 표시하지 않는다. 기존 PR #25의 CRUD 자체는 보존했다.
- USG-02: StatusRequest에는 item_ids만 있지만 UsageItemAck에는 NOT_RECEIVED일 때도 payload_sha256이 필수다. 미수신 ID의 실제 hash를 알 수 없다. 내부 `knownStatus`는 영속 receipt가 있는 경우만 반환하고, 미수신은 Optional.empty로 구분한다. **없는 hash를 0/임의 값으로 채우거나 계약을 수정하지 않았다. 외부 status endpoint 활성화는 공동 결정 대기.** immutable batch 재전송은 이미 지원한다.
- 생산 `CapabilitySource`는 approved artifact/feature/license와 현재 owner/capability를 확인하고, 그 결과를 DB receipt의 selection·hash·verification_ref·expiry와 결속해야 한다. 시험 issuer는 test source에만 존재한다.
- 생산 `ClockProof`는 registered anchor 외에도 restart/predecessor, wall/mono 정합성, immutable day/timezone allocation과 carry provenance를 증명해야 한다. `initialCarry`가 없으면 quota cache 초기값을 추정하지 않는다. 불확실 구간 보정/owner handoff/carry 갱신은 이 수신기가 대신 결정하지 않는다.
- 생산 `FrozenFocusProof`는 원래 Snapshot bytes/hash/format·같은 session/owner/revision·live focus authority를 확인해야 한다. 이번 synthetic proof 시험을 실제 D06/Chrome 연결 완료로 보고하지 않는다.

## 검증 — 2026-10-29 KST

- PR #25 CI run `40881211102`의 Web242·Server82 및 기존 MySQL16 결과는 동일 소스·계약에 한해 재사용한다.
- Windows, Node24, Java21, MySQL8.4.8, 승인된 19-table candidate를 **새 빈 disposable DB**에만 적용했다. 운영 migration·설치 서비스·사용자 DB 기동 없음. 시험 DB는 소유권 대조 후 mysqladmin으로 정상 종료했다.
- 새 MySQL14: 원자 발행, rollback, capability 만료, 동일/상이 hash, 동시 중복, seq gap/위치 재사용, receiver 재생성, quarantine, attribution/owner/geometry/hash 거절, overlap, item별 결과, day 충돌 rollback, package dependency, carry 미확정, immutable attachment, 실제 bearer HTTP/폐기, ALL_MATCHING 및 statistics 중복 방지, closed-owner history, registered anchor 부재.
- 새 HTTP/bean6: 생산 source 없는 API·Web principal·restricted service·malformed/duplicate body·활성화 조건·기존 Admission 연결. 자동 적용/초기화 없음.
- 별도 Server 단위72(위 HTTP/bean6 포함), JAR verify PASS. 두 DB 초기화 클래스는 이 단위 실행에서 명시적으로 제외했다. MySQL14는 별도 실행으로 검증했다.
- Web246/246 PASS, 타입 검사·Vite build PASS. 새 4개 시험 포함. 오류 문구 시험의 첫 실패는 기존 안전한 오류 masking 기대값을 수정해 해결했으며 제품 판정을 완화하지 않았다.
- 새 `.github/workflows/additional-runtime-bridges.yml`: Web 전체, 새 DB suite만 독립 초기화, DB 초기화 제외 단위 suite. 기존 PR #25 CI 파일은 변경하지 않는다.
- 로컬 상세 증거: `.local/bridge-verification/` 및 `.local/amvp-mysql-d0d3ac8e4d3a/`. 과거 실패 fixture 로그도 유지한다. 실제 비밀번호·로컬 DB·시험 credential 파일은 Git 제외다.

재현: Java21과 기존 Maven/MySQL8.4.8 경로를 사용한다. 새 DB suite는 `$env:FOCURVE_AMVP_BRIDGE_TESTS='1'`로 설정한 뒤 기존 `scripts/test-additional-config-mysql.ps1`의 `-BinaryDirectory`, `-MavenCommand`, 미사용 `-Port` 및 `-Tests 'AmvpRuntimeBridgeMysqlTest,AmvpRuntimeBridgeApiTest,AmvpRuntimeBridgeConfigurationTest'`를 사용한다. Server 단위는 `mvn -f runtime-server/pom.xml '-Dtest=*,!AdditionalConfigMysqlTest,!AmvpRuntimeBridgeMysqlTest' verify`, Web은 `npm --prefix frontend test -- --maxWorkers=2`, `npm --prefix frontend run build`. 두 DB 초기화 suite를 한 DB에서 동시에 실행하지 않는다.

## 다음 최소 연결

1. 윤종민 Core: verified capability/collector/clock/day carry producer와 runtime report proof 제공. 기존 인터페이스·테스트 fixture를 기준으로 연결하며 공유 계약을 임의 확정하지 않는다.
2. 채지민 Content: agreed feature/profile/effect proof 연결. 기존 Shorts 안정화를 일괄 이관하지 않는다.
3. 김다훈 Web·Server: 합의된 status unknown-hash 처리와 report read projection 연결 후 상태 패널을 기존 화면에 배치하고 관련 UI/API 시험. 생산 authority가 없으면 현재 비활성 유지.
4. 실제 Chrome/Native 검증은 별도 유효 승인 후 수행한다. 기존 UNKNOWN/HOLD·실패 증거·Credential·다른 worktree는 변경하지 않았다.

`MVP_FINAL_COMPLETE=false`. 이 PR은 독립 연동 경계 준비이며 제품 최종 수용 완료가 아니다.

## PR #27 이후 · 검증 보고·현재 상태·UI 연결

- 기준 `9a7b1d798ae9d4f6542f07310ddd09145670bfcc`, 후속 브랜치 `feature/additional-mvp-runtime-receipts`. PR #27은 Draft·미병합이며 해당 브랜치/리뷰 내용은 수정하지 않았다. 같은 작업공간을 재사용한다. 계약 기준 RC2 `e2b3fc3`, 제품 통합 기준 `202d6317`은 구분한다.
- RPT-01을 기본 비활성 HTTP로 연결했다. 실제 bearer/현재 owner/capability, package/hash/발행 시각, report epoch/seq/ID 중복·gap을 확인하고 원본 report·receipt·read projection을 item별 transaction으로 저장한다. gap은 PENDING_DEPENDENCY로 원래 ID/hash를 예약한다. SQL 실패·commit 응답 유실 시 같은 immutable 요청으로 재확인하며 성공을 추정하지 않는다.
- `EvidenceVerifier`는 **Core 담당 경계**다. operation/execution/current epoch·합법 전이·fresh observation·evidence hash 뒤의 실제 문서/효과 근거와 전체 policy coverage를 검증해야 한다. 운영 bean·가짜 producer를 만들지 않았다. 없으면503. 검증된 affected policy가 없으면 수신 ACK가 ACCEPTED여도 적용 상태는 PENDING이다.
- 원본 `amvp_reports`와 개별 receipt는 수정하지 않는다. 기존 `amvp_operations`에 private receipt profile `AMVP_REPORT_RECEIPT_1`과 mutable read cursor `RPT_STATE`를 사용한다. 이 cursor는 immutable report/receipt를 참조하며 외부 Wire 확장이 아니다. 현재 SITE_TIME의 ID·전체 내용·config version이 같을 때만 반영한다. 이전 package 보고가 더 최신 cursor를 덮지 않는다. 새 epoch/늦은 actor의 유효성은 Core verifier가 판정해야 한다.
- 기존 Admission에 기본 PENDING read hook을 추가했다. 기존 시험/다른 Admission은 그대로 동작한다. APPLIED는 검증된 현재 설정에만, FAILED/UNKNOWN은 기존 ConfigRecord enum의 UNKNOWN으로 투영한다. 상세 FAILED 원본은 report에 보존한다. enum/DTO에 임의 필드를 추가하지 않았으므로 UI에서 상세 실패 원인을 새 필드로 노출하지 않는다. CONTENT/frozen actor 및 삭제 후 release 완료는 이 runtime coverage만으로 확정하지 않고 기존 대기를 유지한다.
- 한 설정이 바뀌지 않아도 다른 설정 발행으로 package revision이 증가할 수 있다. 서버가 정확한 config version/내용을 검증한 APPLIED에 한해 UI는 `applied_runtime_revision >= saved_runtime_revision`을 허용한다. 오래된 설정 ACK로 최신 편집을 확인 처리하지 않는다. 실제 ACK revision을 저장하며 이전 revision 값으로 위조하지 않는다.
- `AmvpRegisteredClockProof`는 DB의 VERIFIED anchor, 동일 boot/clock, 서버가 선택한 wall skew, 자연일/timezone 정합성을 실제로 읽는 보수적 생산 코드다. receiver/collector 객체 재생성 후에도 기존 원장·통계를 읽는다. collector_epoch를 바꿔 restart 증명을 우회할 수 없다. 새로운 boot/clock·legacy clock 부재·전환일은 전문 clock/restart proof가 없으면 QUARANTINED. 초기 carry를 추정하거나 격리 원본을 자동 승격하지 않는다. bean 자동 등록·제품 활성화는 하지 않았다.
- 기존 AdditionalSettings에 RuntimeDeliveryPanel을 연결했다. 같은 설정 조회 결과를 재사용하여 중복 fetch 없이 예약·한도·반복·콘텐츠의 저장/적용 상태를 표시하고 재조회한다. 수정/삭제 UI·디자인 컴포넌트를 재사용하며 다른 설치의 늦은 결과를 표시하지 않는다. 실제 적용 ACK는 SITE_TIME runtime 경계에서만 준비됐고 예약/반복 actor의 실행은 여전히 별도 연결 대기다.
- legacy-lock/API 공유 파일은 수정하지 않았다. RC2 전체 재승인을 시작하지 않는다. 알려진 api.ts 전체 해시 충돌은 설계/회귀 담당의 좁은 보존 범위 결론 대기이며 독립 후속 개발의 차단 사유로 사용하지 않는다.

### 후속 검증·재개점

- 새 독립 MySQL suite `AmvpRuntimeReceiptMysqlTest`: 13건. verified/partial coverage, 영속 수신·중복·gap·UNKNOWN/FAILED, 현재 버전/후속 package, owner/hash/proof 거절, 동시성, projection SQL 실패 rollback, 실제 bearer HTTP/폐기, 구체 clock verifier·통계·receiver 재생성·drift/restart/collector reset을 시험했다. Core 효과 verifier와 anchor 등록 근거는 명시적 SYNTHETIC fixture다. 실패 주입은 빈 시험 DB의 제한된 CHECK로 수행하며 SUPER 권한을 요청하지 않는다.
- `AmvpReportApiTest`: 4건. 생산 source 부재·Web principal·restricted service·malformed JSON/query 거절. 새 suite17/17 PASS. 변경 영향의 PR #27 suite20/20, Server 단위76/76 및 JAR verify PASS. Web247/247 및 타입/Vite build PASS. 설치 전환은 조회 effect 전에 기존 행을 동기적으로 비우고 이전 응답 세대를 무효화한다. 원격 최종 결과는 후속 PR에 기록한다.
- 새 suite는 `$env:FOCURVE_AMVP_RECEIPT_TESTS='1'`와 기존 격리 스크립트의 `-Tests 'AmvpRuntimeReceiptMysqlTest,AmvpReportApiTest'`로 실행한다. suite별 DB를 따로 만들며 기존 두 초기화 suite와 섞지 않는다. 단위 실행에서는 세 `*MysqlTest` 초기화 클래스를 제외한다. 원격 후속 workflow도 별도 서비스 DB를 사용한다.
- 증거 `.local/receipt-verification/`, `.local/amvp-mysql-3f0fcff8c63b/`; 실패 시험 로그도 유지한다. 실제 설치·Chrome·Native·Core producer·운영 DB·END/복원/재기동 수용은 NOT_RUN. 사용자 데이터·이전 UNKNOWN/HOLD·Credential 변경 없음.
- 다음: Core 담당의 실제 EvidenceVerifier/clock restart/day carry 등록 연결 → 동일 RC2 계약 HTTP 수용 → Content 효과/복원 proof 연결. 미수신 hash status 합의·예약/반복/frozen 실행 보고·삭제 release 증명은 분리해서 처리한다. 이번 후속 PR은 #27 위에만 쌓고 #27 병합 후 integration으로 기준을 갱신한다. `MVP_FINAL_COMPLETE=false` 유지.
