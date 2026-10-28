# D-06 A0 Core 착수 준비

기능 ID EXT-02 / 단계 D-06 A0 / 담당 종민 / 2026-10-11 KST.
시작 bda6a8861497572a3624308ec562a6273f32c3bc. Core 제품 기준 e23d74b5bee9bccec18b5c761155db11a3a23798, Content 기준 2c56d4010697f630f4123c1395d672e4fd569c58.

상태: 준비 문서 작성. 다훈의 A0 최소 계약 승인안 수신·세 명 최종 확인 전이며 제품 연결 미착수. 다훈의 방향 동의는 최종 schema 승인으로 해석하지 않는다. 결함 수정본 독립 재리뷰도 결과 대기. develop 병합 금지 유지.

## 이번 목표와 범위

승인안 도착 시 Core·Content 의견과 바로 대조할 수 있는 안전 조건·시험표·구현 순서를 마련한다. A0는 비회원·Shorts 한 정책·지원 top-frame 한 활성 문서의 독립 projection 제어시험 후보다. 제품 Guest frozen Snapshot/세션 연결 A1과 구분한다. 적용은 실제 viewer 숨김·inert·영상 정지, 해제는 소유 변경 복원을 확인한다.

접근 Event 생성·회원 Server 연결·회원 runtime 보고는 비활성이다. U06/U07 이벤트·명시 접근 결정은 후속 단계다. 기존 탭/새 문서/SPA/BFCache 전체 지원을 A0 성공으로 선언하지 않는다. 범위 밖 상황도 성공으로 추정하거나 cleanup 의무를 삭제하지 않는다. 기존 추가 MVP 활성 정책을 조용히 무시해 성공하지 않는다.

## 승인안 대조표

| 항목 | Core 필수 안전 조건 | 승인안에서 고정할 사항 |
|---|---|---|
| U01 결속 | 실제 Chrome routing/sender와 registry의 문서·instance·epoch 대조; echo만으로 인증하지 않음; singleton 재주입 | 버전·전체 schema·QUERY bootstrap/BOUND 응답·허용 sender |
| U01 최소 응답 | null QUERY는 BOUND에서도 owner/session/policy/current_result 미반환 | 안전 readiness 허용 목록·null 예외의 범위 |
| U02 순서 | 동일 ID/의미 원문 재시도는 최초 data 불변, 충돌 원문 거절, 오래된 seq는 재적용 없음 | canonical 의미 범위·응답 상관 ID·eviction 거절 코드 |
| U02 해제 | 완료 cache와 high-water/활성/cleanup ledger 분리; 포화/저장 오류/seq 상한이 해제를 막지 않는 명시 경로 | 포화 시 신규 APPLY 거절과 RELEASE 경로·공간·오류 처리. 현재 registry만으로 보장 완료 아님 |
| U03 집계 | transport 성공≠실제 적용; 실패/미확인 전체 APPLIED 금지; 옛 generation 결과 제외 | 한 문서 필수 대상·generation·관찰 기한·실패/중단 상태 |
| U04 ID | Guest frozen 선택행 ID 유지; Content echo만; 논리 키와 DNR 정수 ID 분리 | A0 projection 식별 범위·무매칭/비활성 의미·논리 rule_id |
| U05 적용 | viewer>0, 전수 hidden/inert; media>0, 전수 paused; observer 준비·오류 없음 실제 재검사 | 증거 필드·오류 목록·media0 관찰 종료 기준 |
| U05 복원 | owned 잔여 확인 후 완료; 실패 ledger 보존; unrelated 페이지 변경 보존; 자동 재생 강제 없음 | 복원 증거·재시도·실패 처리·listener/guard 수명 |
| U08 수명 | 교체≠GONE; send 실패≠RELEASED; binding/ledger 의무 보존 | A0 교체/휴면 발생 시 보수 중단·cleanup·pending 표현 |
| 단계 gate | 최소 안전 조건은 제외할 수 없음; 담당 의견≠공동 승인 | 세 명 승인 문서 SHA/해시·일시·profile·예외·수용 기준 |

용량·시간 상한은 승인 전 시험 후보다. 시험표의 코드와 상태 명칭도 구현된 계약으로 해석하지 않는다.

## 실행할 시험표 — 현재 모두 NOT RUN

| 준비 ID | 입력/상황 | 확인할 결과 |
|---|---|---|
| A0-C01 | 처음 주입 및 재주입 | bootstrap instance 안정성, receiver/listener 중복 없음 |
| A0-C02 | 다른 문서/instance/epoch 또는 잘못된 sender | 정책 적용/상태 변경 없음, 승인된 오류 |
| A0-C03 | 미결속 및 BOUND에 null QUERY | 허용 요약만 반환, owner/session/policy/current_result 노출 없음 |
| A0-C04 | 같은 명령 ID/원문 재전송 및 같은 ID/다른 원문 | 최초 data 불변·DOM 중복 변경 없음, 충돌 거절 |
| A0-C05 | 늦은 명령·완료 cache eviction·옛 ID에 높은 seq | 재적용 없음, high-water/ID 의미 충돌 보존 |
| A0-C06 | cache/registry 포화 및 seq 상한 | 신규 적용은 승인된 경로로 거절, RELEASE 및 cleanup 의무 유지 |
| A0-C07 | viewer/media 여러 개 정상 | 실제 전수 hidden/inert/paused·observer 준비 확인 후 적용 성공 |
| A0-C08 | viewer0/media0/pause 실패/일부 대상 실패 | 성공 추정 없음, 승인 기한 종료·미확인 및 복원 의무 유지 |
| A0-C09 | 해제 및 silent setter 실패 | 잔여 재검사; 실패 ledger 유지·재시도; 사용자 직접 재생 가능 |
| A0-C10 | 페이지가 unrelated 또는 원래 owned 값을 변경 | 소유권 규칙에 따른 복원, 페이지 후속 unrelated 변경 보존 |
| A0-C11 | 명령 또는 응답 유실·옛 generation 응답 | 불변 재시도/QUERY 확인, 늦은 성공으로 현재 성공 집계 없음 |
| A0-C12 | 문서 교체/휴면/소멸 주장 | 근거 없이 GONE/RELEASED 처리 없음; pending 의무 유지 |
| A0-C13 | invalid projection·알 수 없는 활성 profile | 부분 적용/APPLIED 없음; 기존 기능/원문 보존 |
| A0-C14 | 전체 A0 적용·해제 | 접근/Event/outbox 생성 0; 기존 Guest/회원 자료 변경 없음 |

준비 ID는 문서 내부 추적용이며 공식 D06-T/AC ID를 대체하지 않는다. A0-C14는 기존 native 수집을 사용하는 일반 제품 세션이 아니라 승인된 독립 fixture 범위에서 검사한다. Event를 끄기 위해 기존 제품 수집 코드를 임의 변경하지 않는다.

## 승인 후 구현 순서와 담당 후보

1. 세 명의 승인 문서에서 위 항목·A0/A1 경계와 제외 범위를 대조해 계약 버전/SHA 고정. 미결정 안전 조건이 있으면 관련 구현 보류.
2. Core: projection 검증·trusted 문서 결속·QUERY/APPLY/RELEASE 발신·durable 명령 순서와 cleanup 의무·결과 집계. Content: singleton bootstrap/adapter·직렬 처리/cache·실제 효과와 소유 복원 증거. 공유 schema 변경은 승인된 담당 분담으로 진행.
3. 승인된 fixture로 메시지/문맥/중복/오래된 명령/포화/실패 시험. 실제 production 주입 전 schema·권한 오류를 확인.
4. Chrome 합성 DOM에서 전수 효과/복원·실패 증거 확인 후 제품 YouTube 단일 문서 적용/해제. 실행 환경과 모의/실제 근거를 분리.
5. 양측 고정 SHA·실행 결과·미검증·남은 의무를 기록하고 A1 착수는 별도 확인. A0 성공으로 전체 D06 통과나 develop 병합을 승인하지 않음.

## 현재 검증 및 다음 행동

이번은 문서 안전 조건/시험표/상대 참조/diff 검사만 실시한다. 제품 코드는 변경하지 않으며 기능 테스트 재실행 없음. 결함 3건의 직전 자동233/233 PASS는 별도 근거이고 독립 재리뷰/실제 Windows·MV3·Server 통합 미완료다.

다음 행동: 다훈의 승인안을 수신해 대조표 각 행을 승인/수정 필요/미결정으로 기록하고, 세 명 최종 확인 후 승인 범위만 구현한다. 기존 Core SITE 구현/안정화 약90% 추정 유지, D06 연결은 별도 미착수다.

[Core 재회신](FOCURVE_D06_Core_Content통합검토_재회신_2026-10-11.md) · [결함 수정 근거](evidence/EXT-02-2026-10-11-core-defects-three.md)
