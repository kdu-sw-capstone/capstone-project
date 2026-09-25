# ERD 원문 텍스트

적용 범위: 기본 기능의 상세 설계. 이번 학기 추가 기능의 API·데이터·상태 계약은 [추가 기능 설계](../01_UX_기능설계/FOCURVE_추가_기능_설계.md)와 [설계 결정사항](FOCURVE_설계_결정사항.md)을 따른다. 미정 항목은 구현 전 확정한다.

편집 가능한 관계도는 [FOCURVE_ERD_IE_v1.0.drawio](./FOCURVE_ERD_IE_v1.0.drawio)입니다. 아래 내용은 원본 다이어그램의 라벨을 페이지별로 옮긴 읽기용 자료입니다. 관계의 방향·카디널리티·선 종류는 원본을 확인하세요.

## 00 읽는 방법

```text
FOCURVE ERD · IE 표기법 · v1.0 검토안
```

```text
사용 방법
하단 탭에서 전체 관계도 또는 영역별 상세도를 선택하세요. 테이블·속성·관계선은 각각 편집할 수 있습니다.
기존 Server/MySQL 설계를 옮긴 검토안입니다. 비회원이 로그인 전에 저장하는 자료는 Extension 로컬 저장소에 있습니다.
```

```text
표기 기준
PK: 기본키   FK: 외래키   UQ: 유일 제약   ?: NULL 허용   표시 없는 컬럼: NOT NULL
실선: 부모 키를 자식 PK에 포함하는 식별 관계 / 점선: 자식 PK에 포함하지 않는 비식별 관계
필수·선택 여부는 선의 실선/점선이 아니라 양 끝의 원·막대·까마귀발로 읽습니다.
관계선은 부모 → 자식 방향으로 작성했고, 선 위 문자는 자식의 FK 이름입니다.
```

```text
정확히 1
```

```text
0 또는 1
```

```text
1 이상
```

```text
0 이상
```

```text
설계상 주의점
① 확정 접근 이벤트와 세션 시작·종료 이벤트는 수신 이벤트의 하위 테이블입니다. 각 하위 event_id가 수신 테이블을 참조합니다.
② 수신 이벤트 하나는 유형에 따라 접근 또는 세션 이벤트 중 하나로 확정됩니다. 거절·대기 상태라면 둘 다 없을 수 있습니다. 이 배타 조건은 Server에서 검증합니다.
③ 반복 접근은 동일 세션 + target_key에서 access_seq 순으로 계산합니다. 별도 반복 이벤트를 추가하지 않습니다.
④ 과거 기록은 현재 사이트 설정이 아니라 불변 policy_snapshots를 참조합니다.
⑤ 세션의 스냅샷 FK는 (policy_snapshot_id, user_id, executor_id) 복합 FK입니다. 계정·실행 주체를 함께 맞춥니다.
⑥ 비회원 자료 가져오기는 사용자 동의 후 복사합니다. 항목별 성공·실패를 기록하며 결과 사이트/세션은 유형에 맞게 하나만 연결합니다.
⑦ 회원당 활성 세션 1개, 이벤트 유형별 컬럼 조건, 가져오기 자료 소유권은 별도 Server 검증·트랜잭션이 필요합니다.
⑧ 보관 기간·가져오기 후 로컬 자료 처리 등 기존 문서의 미확정 정책은 이 파일에서 임의로 확정하지 않습니다.
⑨ 관계도는 삭제 전파를 지정하지 않습니다. 계정 탈퇴·데이터 정리 정책 확정 후 DDL에서 결정하세요.
```

```text
파일 구성
01 전체 관계도: 12개 테이블과 22개 FK 관계의 개요
02 계정·사이트: 회원, 인증, 확장 설치, 사이트와 내부 기능 제한
03 정책·세션: 불변 정책 스냅샷과 세션 상태
04 이벤트: 수신·검증과 확정 이벤트 분리
05 비회원 자료 가져오기: 요청 단위와 항목 단위 처리

상세 탭에서 같은 이름의 테이블은 동일한 DB 테이블을 반복 표시한 것입니다.
내부 bigint PK는 자동 증가를 전제로 합니다. char(36) 식별자는 UUID입니다. 시간은 UTC 저장을 전제로 합니다.
```

## 01 전체 관계도

```text
FOCURVE · 01 전체 관계도
```

```text
IE / Crow’s Foot · 실선: 식별 관계 · 점선: 비식별 관계 · 원: 0 허용 · 막대: 1 · 까마귀발: 다수
각 테이블의 ?는 NULL 허용. 관계선의 자식 쪽 최소 0은 FK만으로 자식 생성을 강제하지 않기 때문입니다.
```

```text
users  |  회원
```

```text
PK id : bigint
… 상세 속성은 영역별 탭 참고
```

```text
auth_identities  |  인증 수단
```

```text
PK id : bigint
FK user_id : bigint
… 상세 속성은 영역별 탭 참고
```

```text
extension_installations  |  확장 프로그램 설치
```

```text
PK id : char(36)
FK current_user_id : bigint ?
… 상세 속성은 영역별 탭 참고
```

```text
sites  |  사이트 설정
```

```text
PK id : bigint
FK user_id : bigint
… 상세 속성은 영역별 탭 참고
```

```text
site_feature_policies  |  내부 기능 제한
```

```text
PK,FK site_id : bigint
PK feature_code : varchar(50)
… 상세 속성은 영역별 탭 참고
```

```text
policy_snapshots  |  세션 정책 스냅샷
```

```text
PK id : char(36)
FK user_id : bigint
FK executor_id : char(36)
… 상세 속성은 영역별 탭 참고
```

```text
focus_sessions  |  집중 세션
```

```text
PK id : bigint
FK user_id : bigint
FK executor_id : char(36)
FK policy_snapshot_id : char(36)
… 상세 속성은 영역별 탭 참고
```

```text
event_receipts  |  이벤트 수신·처리
```

```text
PK event_id : char(36)
FK owner_user_id : bigint
FK executor_id : char(36)
FK resolved_session_id : bigint ?
… 상세 속성은 영역별 탭 참고
```

```text
access_events  |  확정 접근 이벤트
```

```text
PK,FK event_id : char(36)
FK session_id : bigint
… 상세 속성은 영역별 탭 참고
```

```text
session_lifecycle_events  |  세션 시작·종료 이벤트
```

```text
PK,FK event_id : char(36)
FK session_id : bigint
… 상세 속성은 영역별 탭 참고
```

```text
guest_import_batches  |  비회원 자료 가져오기
```

```text
PK id : char(36)
FK user_id : bigint
FK executor_id : char(36)
… 상세 속성은 영역별 탭 참고
```

```text
guest_import_items  |  가져오기 항목
```

```text
PK id : bigint
FK batch_id : char(36)
FK result_site_id : bigint ?
FK result_session_id : bigint ?
… 상세 속성은 영역별 탭 참고
```

## 02 계정·사이트

```text
FOCURVE · 02 계정·사이트
```

```text
IE / Crow’s Foot · 실선: 식별 관계 · 점선: 비식별 관계 · 원: 0 허용 · 막대: 1 · 까마귀발: 다수
각 테이블의 ?는 NULL 허용. 관계선의 자식 쪽 최소 0은 FK만으로 자식 생성을 강제하지 않기 때문입니다.
```

```text
users  |  회원
```

```text
PK id : bigint
display_name : varchar(50) ?
status : varchar(20) = ACTIVE
created_at : datetime(3)
updated_at : datetime(3)
withdrawn_at : datetime(3) ?
```

```text
auth_identities  |  인증 수단
```

```text
PK id : bigint
FK user_id : bigint
provider : varchar(30)
provider_subject : varchar(255)
password_hash : varchar(255) ?
created_at : datetime(3)
updated_at : datetime(3)
UQ (provider, provider_subject)
```

```text
extension_installations  |  확장 프로그램 설치
```

```text
PK id : char(36)
FK current_user_id : bigint ?
extension_version : varchar(30) ?
last_seen_at : datetime(3) ?
created_at : datetime(3)
updated_at : datetime(3)
```

```text
sites  |  사이트 설정
```

```text
PK id : bigint
FK user_id : bigint
display_name : varchar(100)
canonical_host : varchar(253)
include_subdomains : boolean = true
purpose : varchar(20)
access_policy : varchar(20)
row_version : bigint = 1
created_at : datetime(3)
updated_at : datetime(3)
deleted_at : datetime(3) ?
UQ (user_id, canonical_host)
```

```text
site_feature_policies  |  내부 기능 제한
```

```text
PK,FK site_id : bigint
PK feature_code : varchar(50)
enabled : boolean = false
updated_at : datetime(3)
```

```text
user_id
```

```text
current_user_id
```

```text
user_id
```

```text
site_id
```

## 03 정책·세션

```text
FOCURVE · 03 정책·세션
```

```text
IE / Crow’s Foot · 실선: 식별 관계 · 점선: 비식별 관계 · 원: 0 허용 · 막대: 1 · 까마귀발: 다수
각 테이블의 ?는 NULL 허용. 관계선의 자식 쪽 최소 0은 FK만으로 자식 생성을 강제하지 않기 때문입니다.
```

```text
users  |  회원
```

```text
PK id : bigint
display_name : varchar(50) ?
status : varchar(20) = ACTIVE
created_at : datetime(3)
updated_at : datetime(3)
withdrawn_at : datetime(3) ?
```

```text
extension_installations  |  확장 프로그램 설치
```

```text
PK id : char(36)
FK current_user_id : bigint ?
extension_version : varchar(30) ?
last_seen_at : datetime(3) ?
created_at : datetime(3)
updated_at : datetime(3)
```

```text
policy_snapshots  |  세션 정책 스냅샷
```

```text
PK id : char(36)
FK user_id : bigint
FK executor_id : char(36)
format_version : varchar(10)
policy_json : json
created_at : datetime(3)
UQ (id, user_id, executor_id)
```

```text
focus_sessions  |  집중 세션
```

```text
PK id : bigint
source_session_id : char(36)
FK user_id : bigint
FK executor_id : char(36)
FK policy_snapshot_id : char(36)
origin : varchar(20)
UQ start_request_id : char(36) ?
execution_status : varchar(30)
record_status : varchar(30)
planned_duration_seconds : int
started_at : datetime(3) ?
planned_end_at : datetime(3) ?
ended_at : datetime(3) ?
policy_released_at : datetime(3) ?
end_reason : varchar(30) ?
end_time_basis : varchar(30) ?
last_access_seq : bigint ?
import_status : varchar(20) ?
last_error_code : varchar(60) ?
row_version : bigint = 1
created_at : datetime(3)
updated_at : datetime(3)
UQ (executor_id, source_session_id)
```

```text
user_id
```

```text
executor_id
```

```text
user_id
```

```text
executor_id
```

```text
(id,user_id,executor_id) → (policy_snapshot_id,user_id,executor_id)
```

## 04 이벤트

```text
FOCURVE · 04 이벤트
```

```text
IE / Crow’s Foot · 실선: 식별 관계 · 점선: 비식별 관계 · 원: 0 허용 · 막대: 1 · 까마귀발: 다수
각 테이블의 ?는 NULL 허용. 관계선의 자식 쪽 최소 0은 FK만으로 자식 생성을 강제하지 않기 때문입니다.
```

```text
users  |  회원
```

```text
PK id : bigint
display_name : varchar(50) ?
status : varchar(20) = ACTIVE
created_at : datetime(3)
updated_at : datetime(3)
withdrawn_at : datetime(3) ?
```

```text
extension_installations  |  확장 프로그램 설치
```

```text
PK id : char(36)
FK current_user_id : bigint ?
extension_version : varchar(30) ?
last_seen_at : datetime(3) ?
created_at : datetime(3)
updated_at : datetime(3)
```

```text
focus_sessions  |  집중 세션
```

```text
PK id : bigint
source_session_id : char(36)
FK user_id : bigint
FK executor_id : char(36)
FK policy_snapshot_id : char(36)
origin : varchar(20)
UQ start_request_id : char(36) ?
execution_status : varchar(30)
record_status : varchar(30)
planned_duration_seconds : int
started_at : datetime(3) ?
planned_end_at : datetime(3) ?
ended_at : datetime(3) ?
policy_released_at : datetime(3) ?
end_reason : varchar(30) ?
end_time_basis : varchar(30) ?
last_access_seq : bigint ?
import_status : varchar(20) ?
last_error_code : varchar(60) ?
row_version : bigint = 1
created_at : datetime(3)
updated_at : datetime(3)
UQ (executor_id, source_session_id)
```

```text
event_receipts  |  이벤트 수신·처리
```

```text
PK event_id : char(36)
FK owner_user_id : bigint
FK executor_id : char(36)
source_session_id : char(36)
FK resolved_session_id : bigint ?
schema_version : varchar(10)
event_type : varchar(40)
occurred_at : datetime(3)
origin : varchar(20)
payload_json : json
payload_hash : char(64)
processing_status : varchar(30)
FK canonical_event_id : char(36) ?
error_code : varchar(60) ?
received_at : datetime(3)
processed_at : datetime(3) ?
```

```text
access_events  |  확정 접근 이벤트
```

```text
PK,FK event_id : char(36)
FK session_id : bigint
attempt_id : char(36)
access_seq : bigint
event_type : varchar(40)
target_kind : varchar(20)
target_host : varchar(253)
feature_code : varchar(50) ?
target_key : varchar(320)
trigger_type : varchar(30)
occurred_at : datetime(3)
stored_at : datetime(3)
UQ (session_id, access_seq)
UQ (session_id, attempt_id, target_key)
```

```text
session_lifecycle_events  |  세션 시작·종료 이벤트
```

```text
PK,FK event_id : char(36)
FK session_id : bigint
event_type : varchar(30)
stored_at : datetime(3)
UQ (session_id, event_type)
```

```text
owner_user_id
```

```text
executor_id
```

```text
resolved_session_id
```

```text
canonical_event_id
```

```text
event_id
```

```text
session_id
```

```text
event_id
```

```text
session_id
```

## 05 비회원 자료 가져오기

```text
FOCURVE · 05 비회원 자료 가져오기
```

```text
IE / Crow’s Foot · 실선: 식별 관계 · 점선: 비식별 관계 · 원: 0 허용 · 막대: 1 · 까마귀발: 다수
각 테이블의 ?는 NULL 허용. 관계선의 자식 쪽 최소 0은 FK만으로 자식 생성을 강제하지 않기 때문입니다.
```

```text
users  |  회원
```

```text
PK id : bigint
display_name : varchar(50) ?
status : varchar(20) = ACTIVE
created_at : datetime(3)
updated_at : datetime(3)
withdrawn_at : datetime(3) ?
```

```text
extension_installations  |  확장 프로그램 설치
```

```text
PK id : char(36)
FK current_user_id : bigint ?
extension_version : varchar(30) ?
last_seen_at : datetime(3) ?
created_at : datetime(3)
updated_at : datetime(3)
```

```text
guest_import_batches  |  비회원 자료 가져오기
```

```text
PK id : char(36)
UQ request_id : char(36)
FK user_id : bigint
FK executor_id : char(36)
status : varchar(30)
requested_at : datetime(3)
completed_at : datetime(3) ?
```

```text
guest_import_items  |  가져오기 항목
```

```text
PK id : bigint
FK batch_id : char(36)
item_type : varchar(20)
source_item_id : char(36)
status : varchar(30)
FK result_site_id : bigint ?
FK result_session_id : bigint ?
error_code : varchar(60) ?
result_message : varchar(255) ?
created_at : datetime(3)
updated_at : datetime(3)
UQ (batch_id, item_type, source_item_id)
```

```text
sites  |  사이트 설정
```

```text
PK id : bigint
FK user_id : bigint
display_name : varchar(100)
canonical_host : varchar(253)
include_subdomains : boolean = true
purpose : varchar(20)
access_policy : varchar(20)
row_version : bigint = 1
created_at : datetime(3)
updated_at : datetime(3)
deleted_at : datetime(3) ?
UQ (user_id, canonical_host)
```

```text
focus_sessions  |  집중 세션
```

```text
PK id : bigint
source_session_id : char(36)
FK user_id : bigint
FK executor_id : char(36)
FK policy_snapshot_id : char(36)
origin : varchar(20)
UQ start_request_id : char(36) ?
execution_status : varchar(30)
record_status : varchar(30)
planned_duration_seconds : int
started_at : datetime(3) ?
planned_end_at : datetime(3) ?
ended_at : datetime(3) ?
policy_released_at : datetime(3) ?
end_reason : varchar(30) ?
end_time_basis : varchar(30) ?
last_access_seq : bigint ?
import_status : varchar(20) ?
last_error_code : varchar(60) ?
row_version : bigint = 1
created_at : datetime(3)
updated_at : datetime(3)
UQ (executor_id, source_session_id)
```

```text
user_id
```

```text
executor_id
```

```text
batch_id
```

```text
result_site_id
```

```text
result_session_id
```

