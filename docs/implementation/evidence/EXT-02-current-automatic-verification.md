# 현재 Core 자동 검증 — 2026-10-11

EXT-02 / 종민 / 브랜치 feature/extension-core-ext-02 / HEAD ac39226 및 현재 미커밋 시험·문서 변경 기준. 사용자가 직접 수행할 필요 없는 검증 전체 실행을 요청했다. 이전 문서·sender 시험 변경은 보존했다. 제품 구현 변경 없음.

## 실행 결과

| 검증 | 명령 | 결과·범위 |
|---|---|---|
| Core 전체 | extension에서 npm test | 238/238, 실패/스킵 0; Chrome/DNR 모의 포함 |
| Core 구문 | extension에서 npm run check | PASS; ESLint가 아닌 구문 검사 |
| sender 후보 | node --test tools/d06-sender-probe/tests/sender-policy.test.mjs | 46/46; 합성 입력·모의 Chrome, 실제 인증 판정 아님 |
| CRLF 모사 | /tmp에 확장 복사, JS/MJS/JSON/HTML/CSS LF→CRLF 변환 후 npm test | 238/238; Linux 실행이며 Windows 실측 아님 |
| 팝업 | python3 extension/tests/ui/popup_ui.py | 42/42; 실제 Chromium HTML + 모의 Chrome API, Figma 일치 검증 아님 |
| 문서 registry | python3 extension/tests/ui/document_registry_worker.py | PASS; 네이티브 IndexedDB·Dedicated Worker, Chrome 문서/effect 합성 |
| 실행 보고 | python3 extension/tests/ui/member_execution_worker.py | PASS; Worker 재생성·동일 보고 재전송, 실제 IDB·합성 응답 |
| fetch 결속 | python3 extension/tests/ui/member_fetch_worker.py | PASS; 원 결함 재현/수정 후 요청 확인; baseline 오류는 예상 재현 |
| 수집 저장 장애 | python3 extension/tests/ui/member_access_storage_worker.py | PASS; 실제 IDB 연결 종료·쓰기 취소·blocked open 후 upgrade |
| Event 복구 | python3 extension/tests/ui/member_event_recovery_worker.py | accepted/not_received 두 경로 PASS; 실제 IDB·Worker, 응답 합성 |
| Web 회귀·빌드 | frontend에서 npm test 및 npm run build | 130/130 및 TS/Vite PASS; 제품 실제 전체 연동 아님 |
| Server 회귀·빌드 | cloud-env 후 with-env.sh env SNAPSHOT_1_2_ENABLED=true SNAPSHOT_1_2_VERIFIED_EXECUTORS='*' backend/mvnw -f backend/pom.xml -B -ntp verify | 167/167, 실패/오류/스킵 0, BUILD SUCCESS; 실제 HTTP·MySQL 시험 포함 |
| 변경 검사 | git diff --check·node --check extension/scripts/member-loop-http-probe.mjs | PASS |

시험 DB는 실행 전 TEST_DB_URL이 로컬 focurve_test임을 값 노출 없이 확인했다. 개발 focurve DB를 시험 대상으로 사용하지 않았다. 발급 설정은 테스트 프로세스에만 지정했으며 .env/운영 cohort/제품 기본 설정은 변경하지 않았다. 임의 Server·DB 정책 수정 없음.

첫 Maven 실행은 기본 /home/agent/.m2 읽기 전용으로 실패해 기존 .local/cloud-env.sh의 캐시 설정으로 해결했다. 이어 첫 전체 시험은 .env의 Snapshot gate 때문에 165개 중 failures12/errors48로 실패했다. gate 오류를 숨기지 않고 기존 테스트 프로세스 override를 적용해 167개 전체 재실행으로 통과했다. 실패한 실행과 최종 통과를 구분한다.

## 추가한 실제 HTTP RELEASE 회귀

extension/scripts/member-loop-http-probe.mjs와 backend/src/test/java/kr/ac/kdu/focurve/ExtensionExecutionClientHttpIntegrationTest.java에 journal 단독 source_version=0 및 journal/control 동시 오염 두 조건을 추가했다. 정상 적용 후 저장 자료를 시험용 IDB에서만 변이하고 실제 Server END/RELEASE 조회·보고 및 MySQL 결과를 확인한다. 재생성 loop 3회에서 RUNNING 아님, 추가 규칙 적용 없음, foreign rule 9000 보존, 원 오염 journal 유지, 최종 phase FINAL을 검사한다. Java에서 ENDED·보고2행·닫힌 구간1행·lock0 확인. 해당 클래스 5/5 통과.

HTTP/MySQL은 실제지만 auth는 합성 fixture, DNR/tabs는 모의, IDB는 fake-indexeddb다. 실제 Windows 복구 변이 또는 MV3 시험으로 승격하지 않는다. 제품 loop 구현은 변경하지 않았다. 통합 담당의 독립 재리뷰를 대신하지 않는다.

## 실행할 수 없거나 아직 대상이 없는 항목

현재 관리 정책 ExtensionInstallBlocklist=["*"]로 시험 확장 설치가 차단돼 있다. 정책을 바꾸거나 우회하지 않았다. 실제 MV3 sender 허용/거절·다른 탭/프레임·외부 발신·오래된 문서·BFCache 검증은 이 환경에서 미실행이다. Windows 사용자 실행만이 유일한 방법은 아니며, 확장 설치 가능한 승인된 자동 브라우저 환경에서도 수행할 수 있다.

A0 제품 연결·후속 미구현 기능은 실행할 제품 코드가 없어 완료 판정하지 않는다. 공동 승인·독립 재리뷰도 자동 테스트 성공으로 대신하지 않는다. 기존 실제 사용자 정상 경로 증거는 별도 보존한다.

## 종료 진행 현황

전체 Core 16묶음 기준안: 검증까지 확정완료 0/16, 부분 제품구현 8/16, sender 관측/시험 1/16, 후속·미연결 7/16 유지. 이번 실행으로 자동/HTTP 검증의 미확인 부분을 줄였지만 각 묶음의 전체 필수 완료 조건은 충족하지 않았다. 완료한 검증과 기능 완료를 섞지 않는다. 팝업 시험이 생성한 기존 PNG 변경은 이번 생성분만 복원해 문서/코드 변경을 보존했다. Commit/Push·develop 병합 없음.
