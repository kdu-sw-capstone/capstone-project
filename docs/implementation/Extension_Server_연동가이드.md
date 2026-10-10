# Extension–Server 연동 가이드 — 실제 공유 저장소 점검

확인일: 2026-10-09 (Asia/Seoul). 담당: 윤종민 Extension Core / 김다훈 Server·API·DB / 채지민 Content Control. 최신 사용자 전달의 역할을 유지한다.

**판정: 다훈의 최신 정책 수정본이 접근 가능한 공유 브랜치에서 확인되지 않아 제품 Server 연동은 차단 상태다.** 이 문서는 현재 확인 가능한 코드와 필요한 자료를 정리한 것이며 Event1.2 통합 완료/실제 JSON 계약 확정을 뜻하지 않는다. 이번 작업에서는 기존 미커밋 변경을 보존하고 문서만 추가했다. 브랜치 전환/fetch/merge/Commit/Push/PR 갱신·생성/병합, DB 초기화, 서버 시작 또는 테스트 재실행을 하지 않았다. GitHub 조회와 localhost health GET만 수행했다.

## 1. 최신 브랜치·커밋 및 공유 여부

실제 GitHub API로 원격 브랜치와 전체 PR을 조회하고 해당 commit의 recursive tree를 대조했다. 로컬 remote-tracking ref만 최신이라고 가정하지 않았다.

| 확인 대상 | 실제 SHA | 확인 내용 |
|---|---|---|
| local feature/extension-core-ext-02 / PR17 head | e79ef3034e3951a20c735de714debab830006284 | 제품 비회원/adapter/UI. 방문-host 수정 및 후속 문서는 미커밋. PR17 open |
| origin develop (GitHub 조회) | 76df34ea6be1c591be33c29606c24fc654f61932 | 개발 기반 포함. 최신 Event1.2 제품 API 없음 |
| chore/web-server-db-foundation | d38cde49ebe5caee9bad663dbdfca0677bbf0c60 | health·users V1·Backend4/Frontend5 기본 테스트 코드. PR16 merged, merge commit=develop SHA |
| main | 1cddbbd0f1e4a1945337f5da5f17662aaad45633 | 해당 Backend/Frontend 제품 소스 없음 |
| docs/foundation-merge-status | 7ca409cc0bff6dc29f6ec9efcc03e9e7bd85d839 | 개발 기반 소스만 존재 |
| docs/pc-expansion-plan | 5327f8d1197d3c36ba2855215125aeac0c1acf98 | 제품 API 코드 없음 |

로컬 `/workspace`에서 별도 최신 Server 소스 작업 디렉터리는 찾지 못했다. 다훈의 Windows 로컬 디렉터리는 이 환경에 연결되어 있지 않아 조회할 수 없다. 따라서 다훈 수정본의 정확한 branch/SHA/Commit·Push·PR 여부는 **미확인**이다. 다른 저장소/비공유 ref에 있을 가능성을 부정하지 않는다.

다훈 보고 Backend106/106·Frontend104/104·실제 MySQL/HTTP 합성 데이터 통과는 **다훈의 보고 결과**로 보존하지만 해당 소스/출력/수신 JSON은 확보하지 못해 직접 대조하지 못했다. 현재 공유 코드의 Backend4/Frontend5를 해당106/104 결과와 혼동하지 않는다. 기존 문서의 개발 기반 성공은 과거 결과이며 이번 실행 성공으로 재사용하지 않는다.

## 2. 실제 구현·호출 가능한 API

소스: backend/src/main/java에는 FocurveApplication.java만 존재. RestController/제품 service/DTO/인증 filter/이벤트 검증기는 없다. README도 제품 API·인증·세션 부재를 명시한다. Spring Boot Actuator 설정만 health를 노출한다.

| 경로 | 현재 공유 코드 판정 | 이번 실행 근거 |
|---|---|---|
| GET /actuator/health | **구현 완료(개발 기반)** / 현재 호출 성공 미검증 | localhost8080 GET은 connection refused. 서비스를 시작하지 않았음 |
| Event1.2 수신·저장·조회 | **공유 코드 미구현 / 최신 수정본 미확인** | events controller/validator/DTO 및 DB 테이블 없음 |
| Snapshot 발급·조회·검증 | **공유 코드 미구현 / 최신 수정본 미확인** | Server Snapshot 코드/발급 flag 없음. 다훈의 신규1.2 OFF는 보고 상태이며 config 미확인 |
| 회원 로그인/Extension 설치 인증 | **공유 코드 미구현** | users 테이블만 있고 로그인/토큰/설치연결 코드 없음 |
| 명령 조회/보고/reconcile | **공유 코드 미구현** | 제품 API/보고/outbox전송/reconcile 구현 없음 |

다음 경로는 `docs/design/02_시스템_테크설계/04_API_연동.md`의 **설계 경로**이며 호출 가능한 API 목록이 아니다. 최신 Server에서 같은 경로인지 확인 필요:

| 목적 | 설계 메서드·경로 | 인증(설계) |
|---|---|---|
| 이벤트 배치 | POST /api/v1/events/batch | 설치·계정 결박 Bearer E |
| 이벤트 접수 상태 | POST /api/v1/events/status | E |
| Snapshot 조회 | GET /api/v1/sessions/{session_id}/policy | W/E |
| 집중 시작/Snapshot 생성 연결 | POST /api/v1/sessions | W/E |
| 설치 등록 | POST /api/v1/extension-installations | 공개 제한 |
| 설치 연결 요청 | POST /api/v1/extension-link-requests | 설치 증명 I |
| 사용자 연결 승인 | POST /api/v1/extension-link-requests/{id}/approval | Web W |
| 설치 토큰/갱신 | POST /api/v1/extension-tokens, /api/v1/extension-tokens/refresh | I / refresh |
| 명령 조회 | GET /api/v1/executors/{executor_id}/commands | E |
| 실행 보고 | POST /api/v1/executors/{executor_id}/reports | E |
| 재조정 | POST /api/v1/executors/{executor_id}/reconcile | E |

회원 로그인과 기록 Web 조회의 실제 지원 endpoint 또한 최신 source 확인 전에는 확정하지 않는다. 응답 코드/에러/Idempotency header를 기존 문서만 보고 실제 구현이라고 안내하지 않는다.

## 3. 실제 JSON·버전·계약 차이

### 확인할 수 있는 JSON

health의 **설정/기존 테스트상 기대 응답**은 다음과 같다. 이번 GET은 연결 실패했으므로 새로 받은 실제 응답이 아니다:

```json
{"status":"UP"}
```

현재 제품 `access-store.js` 및 사용자 IndexedDB 원본 캡처에서 확인한 신규 RECORD 이벤트 payload 발췌(전체 HTTP 요청 아님):

```json
{
  "access_seq": 3,
  "target_kind": "SITE",
  "target_host": "chzzk.naver.com",
  "target_key": "SITE:chzzk.naver.com",
  "matched_policy_host": "naver.com",
  "reason": "RECORD"
}
```

네이버 접근은 target_host=www.naver.com / target_key=SITE:www.naver.com / matched_policy_host=naver.com. 실제 로컬 envelope.schema_version은 **1.1**이다. 새로운 필드 저장 성공이 Event1.2 HTTP 수용 성공을 뜻하지 않는다.

### 확보되지 않은 실제 JSON

| 객체 | 현재 확인 가능한 범위 | 확보해야 할 자료 |
|---|---|---|
| Event1.2 요청/수신/조회 | 최신 전달 메시지의 의미 규칙만 존재. Extension은1.1 envelope/single reason | 실제 DTO/검증기·필수 필드/형식/버전·배치 envelope·성공/duplicate/422 HTTP JSON |
| Snapshot1.1/1.2 | Extension 버전 선택/사이트 규칙 및 설계 문서. Server 발급본 없음 | 전체 Server JSON, 필수 필드, 전역 policy 구조, 발급OFF 설정명, 미지원/잘못된 데이터 오류 |
| 회원/설치 인증 | 설계 흐름만 존재 | 실제 cookie/CSRF/설치proof/토큰 발급·검증·갱신 JSON/테스트 절차 |
| 명령/실행 보고/reconcile | internal SiteController guard 존재, 실제 API 없음 | command/ExecutionReport/reconcile request-response 원문, revision/ack/기한/error 계약 |

자료가 없는 실제 요청·응답을 만들어 curl 예시로 제공하지 않는다. 새 문서/소스를 받은 뒤 해당 section을 실제 DTO와 테스트/HTTP 결과로 채운다.

### 구현 전에 확정해야 할 차이

1. **Event1.2 버전**: 현재1.1을 문자열만1.2로 바꾸지 않는다. 실제 envelope/DTO/필수 fields·수신 header 확인 필요.
2. **target_key 형식**: 현재 `SITE:<actual_host>`. 다훈 메시지의 '실제 방문 host'가 이 접두사를 유지하는지 실제 JSON으로 확인한다. www 유지·마지막 점·소문자 IDNA는 기존 Host 규칙이다.
3. **반복 숫자**: 현 로컬 target_access_index는1,2,3이고 is_repeat는false,true,true. 다훈의 반복 횟수0,1,2와 의미를 구분해야 한다. 반복 횟수=rank−1이지만 Server 필드 이름·소유/조회 계산 여부는 미확인. total repeat_access는 첫 방문 제외 횟수다.
4. **동일 event_id**: Server unique receipt/hash/duplicate 응답·재전송 멱등성은 미확인. events 로컬 저장만으로 Server 중복집계 방지를 통과 처리하지 않는다.
5. **복수 차단 사유**: 현재 reason은 USER_SITE 또는 RECORD 단일 값이다. 새 reasons 표현·우선순위·하나의 탐색에 한 event_id를 공유하는 Core↔Content 연결 계약과 실제 감지 구현이 필요하다. 배열/필드명은 추측하지 않는다.
6. **부분 정책**: Guest는 사이트 정책 실행 경로다. SiteController도 사이트 계층 adapter이며 전역 성인/키워드 적용을 검증하지 않는다. 지원하지 않는 정책을 무시하고 전체 APPLIED로 보고하면 안 된다. 필수 Snapshot fields/지원 capabilities/전체 확인·실패 rollback을 실제 contract와 연결한다.
7. **Snapshot 발급**: 기존1.1 보존, 신규1.2 발급OFF 유지라는 다훈 기준을 적용한다. 현재 Guest가 로컬1.2를 생성하는 것이 Server 신규 발급 활성화 증거는 아니다.
8. **우선순위**: 사이트 MOST_SPECIFIC_HOST와 전역 성인·키워드 독립 제한/제한별 예외/유효조건 하나라도BLOCK을 함께 확인해야 한다. 사이트 allow가 전역 block을 해제하지 않도록 Core/Content actual rules priority를 통합해야 한다.

## 4. 로컬 실행 명령·포트·DB·환경변수

아래는 **현재 공유 개발 기반 코드의 재현 명령**이다. 다훈 정책 수정본 실행 명령은 미확인. 이번 점검에서 실행하지 않았으며, 실행해도 Event1.2 제품 endpoint가 생성되지 않는다.

전제: JDK21(javac 포함), Docker Desktop Linux 엔진/Compose, Git Bash, Node24.x. 저장소 루트에서 기존 `.env`를 보존한다. 없을 때만 `.env.example`을 복사하여 로컬 값을 설정한다.

| 변수 | 코드상 용도 |
|---|---|
| DB_URL | JDBC 개발DB focurve, 기본127.0.0.1:3306·UTC |
| DB_USERNAME / DB_PASSWORD | 개발DB 자격. 실제 값은 공유/기록하지 않음 |
| MYSQL_ROOT_PASSWORD | 개발 Compose 초기 자격 |
| MYSQL_PORT | 기본3306, Compose127.0.0.1 바인딩 |
| TEST_DB_URL | 별도 focurve_test DB; 운영/개발자료 테스트 대상 금지 |
| SERVER_ADDRESS / SERVER_PORT | application.yml 기본127.0.0.1 / 8080 |

Windows Git Bash에서:

```bash
docker compose up -d --wait mysql
bash scripts/prepare-test-db.sh
bash scripts/with-env.sh bash backend/mvnw -f backend/pom.xml -B -ntp verify
bash scripts/with-env.sh java -jar backend/target/focurve-server-0.0.1-SNAPSHOT.jar
```

서버 실행 후 별도 셸:

```bash
curl --fail --max-time 5 http://127.0.0.1:8080/actuator/health
```

이번 직접 GET 결과: `curl (7) Failed to connect to 127.0.0.1 port 8080`. Server가 현재 실행 중이라고 확인되지 않았다. DB를 새로 시작/초기화/검증데이터 INSERT하지 않았다.

MySQL8.4.8 LTS digest 고정, 개발3306·Server8080·Web5173. migrations에는 **users V1만** 존재하고 이벤트/설치/명령/보고 테이블은 없다. 기존 DB/볼륨 삭제나 적용된 V1 수정 금지. 새 Server 수정본 migration·test data·env/flag 목록 확보 필요.

Web 기존 개발 기반:

```bash
cd frontend
npm ci
npm run dev
```

Vite5173에서 /api 및 /actuator/health를8080으로 proxy한다. Extension은 Vite proxy를 자동 사용하지 않는다. 현재 manifest의 http/https host_permissions는 localhost 접근 권한만 뜻하며 실제 전송 코드/API 인증이 존재한다는 의미가 아니다. 제품 service-worker에 Server fetch 경로가 없다. 최신 Server의 origin/CORS/cookie/설치 Bearer 조건을 확인한 후 전송을 구현한다.

## 5. 회원·Extension 설치 인증 준비

**실제 준비 절차 미검증/공유 코드 미구현.** 기존 설치 UUID/GUEST owner를 회원 token으로 취급하지 않는다. 설치 ID 비교를 token 인증으로 처리하지 않는다. SiteController.getContext의 reconciled=true는 주입 context 조건이며 실제 Server reconcile 결과가 아니다.

아래는 설계상 체크리스트이지 실행 가능한 현행 로그인 recipe가 아니다:

1. 다훈의 실제 회원 가입/로그인 방법·테스트 계정 생성·cookie/token/CSRF 조건 확보.
2. 설치 등록/설치 proof 발급 확인.
3. Extension link request→Web 승인→code 교환 및 계정/설치 결박 token 발급.
4. 인증 상태/refresh/만료·회수·잘못된 설치 rejection 확인.
5. reconcile 성공→현재 owner/executor/revision의 명령 확인→durable journal→전체정책 적용 확인→실행보고→Server ack/조회 순서 확인.
6. Worker 재생성·인증 변경/다른 설치/만료명령·실제 DB quota·Server 장애 때 기존 자료/규칙과 실패 표시 확인.

다훈: API/인증/테스트 계정·설치 준비/DB·수신 검증. 윤종민: token/context/전송/명령·보고·journal/outbox/reconcile 연결과 실제 Chrome 검증. 지민: 전역/Content 감지·예외 및 복수 사유 동시 처리. 선행 준비 부재 기준은 차단, 실행 없는 기준은 미검증으로 관리한다.

## 6. 구형 이벤트 저장·조회 호환성

| 범위 | 확인 결과 |
|---|---|
| Extension 신규 로컬 SITE | actual host key + matched_policy_host 저장,1.1 envelope. source/모의79·사용자 RECORD DB 캡처 확인 |
| 과거 로컬 policy-host key | raw event/event_id 불변; 조회 repeat grouping은 actual target_host로 계산. 모의 regression으로 원본 불변 확인 |
| old Worker pending | commit시 actual target_host로 key 확정. 모의 fresh Worker regression 확인 |
| Server 구형 key/필드 누락 수용·보존 | **미확인** — 최신 validator/DTO/migration/HTTP/조회 코드 부재 |
| Server 반복·Web 표시 | **미확인** — 다훈 보고 실제 합성검증과 사용자 실제 Extension 수신을 구분 |

과거 matched_policy_host를 실제 방문 host나 상위 host로 추정하여 채우지 않는다. legacy schema1.1 receipts와 Event1.2 지원 협상, raw body hash 불일치/동일ID 재전송, 과거반복 재계산/조회범위·quality 처리 규칙은 다훈 수정본과 합의가 필요하다. 현 source만으로 기존 이벤트를 임의 변환·재전송하지 않는다.

## 즉시 가능한 범위 / 추가 구현 / 통합 전제

- **즉시 가능:** 기존 비회원 로컬 실행/사이트·Snapshot 정책/host 이벤트 생성 검증 유지. 전달된1~25 사용자 Chrome 성공 및 원본 RECORD key 확인은 보존. 코드/계약 차이 검토와 테스트 계획 작성. 현재 공유기반의 health 실행 준비 가능하나 제품 이벤트 연동은 불가.
- **추가 구현:** 실제 Event1.2 DTO 변환·검증/복수사유·event_id/outbox/재전송·ack, 인증된 회원 context·명령/전체정책 적용·실행보고·reconcile, 실제 Content/전역 감지와 priority. 어떤 모듈이 다훈 수정본에서 이미 준비됐는지는 source 확보 후 다시 나눈다.
- **실통합 전제:** 최신 Server branch/SHA/소스·106/104 테스트/실HTTP 증거; 실행/env/migration/test 계정·설치 인증; Event/Snapshot 실제 JSON/지원·미지원·legacy 처리; Server1.2 발급OFF 상태 확인; Windows 실제 Extension 로드hash/버전·실quota/장애와 end-to-end 수신·DB·Web 근거.

### 다훈에게 필요한 추가 전달

현재 공유 저장소에서는 수정본을 찾지 못했으므로 **정확한 저장소 URL + 브랜치 + 커밋 SHA** 또는 Windows 수정본 파일이 필요하다. 기존 코드를 덮어쓰지 않고 해당 source 기준으로 위6개 항목을 다시 대조한다. 106/104 테스트 출력과 실제 수신 JSON, 준비된 API만 표시한 목록·인증/실행 가이드도 함께 필요하다. 이번 사용자 지시의 Git 동결은 유지하며 공유 반영은 다훈 쪽 진행 상태를 확인한다.

## 최종 판정

미검증: 최신 Server6개 기술정보·회원/설치/보고/reconcile·Event1.2 실제 HTTP/DB/Web·legacy·복수사유·실quota. 실패: 이번 localhost health 연결 실패(제품API 실패/Server 새 코드 결함으로 확대하지 않음). 조율 필요: 다훈 소스·실JSON/지원범위·인증·전역/Content 계약. 다음 행동: 실제 최신 수정본 확보→준비된 Event1.2 API부터 연결→DB/반복/Web→회원/명령/보고/reconcile→Content→Windows 전체 검증→Server Snapshot1.2 발급 활성화 판단. 전체 EXT-02 완료와 팀 Git 갱신은 보류한다.
