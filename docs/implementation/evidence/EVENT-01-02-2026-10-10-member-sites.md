# EVENT-01·EVENT-02 회원 SITE-only 접근 수집 (0.1.9)

담당 Extension Core 윤종민 / feature/extension-core-ext-02 / 시작61118b2c843610503f3fc814405ff2ec36a50c12. 사용자 지시: 시작/종료 속도 문제는 실제 검증 대기로 두고 다음 기능 구현. 기존 Server 담당 김다훈 및 Content 담당 채지민의 범위는 변경하지 않는다. develop 병합 없음.

## 기준과 범위

AGENTS·개발운영·통합현황·EVENT-01/02 작업카드, 화면 LOG-01·EXT-01, 동작규칙 TF-08/TF-09 및 명시적 RUNNING 접근, API-EVENT-01/02, 데이터 access_events/event_receipts, 최신 정책계약/이벤트1.2/호환성게이트를 대조했다. AC-EVENT-01/02-01~03의 중복·다른 계정 제외·원문 재전송을 이번 단위로 검증하며 전체 AC 완료는 아니다.

현재 Core가 실제 적용 가능한 requireSiteOnly 지원 경계에서만 연결한다. feature_policies 없는 사이트 및 전역 ContentPolicy disabled인 frozen Snapshot만 대상이다. 한 탐색의 SITE 이유만 있으므로 Content 관찰/freeze barrier를 기다릴 이유가 없다. Shorts/키워드/성인/FEATURE 복수 사유 합치기·SPA 기능 진입·공통 D06 navigation 연결은 공동 합의 대기이며 이번 수집기가 새 D06 계약을 만들지 않는다.

## 구현

- member-access.js: Core의 native webNavigation before/commit/error·tab 제거만 사용. 명시적인 top-frame/active 문서, BLOCK·RECORD 선택행만. ALLOW·하위 프레임·자동/client redirect·초기 정책 적용·차단 안내 단독 새로고침 제외.
- member-execution-loop.js: 실제 verified RUNNING/해당 session/recovered·owner/executor/server/revision·frozen Snapshot·자기 DNR 전체 존재 검증 후 수집. 만료/종료/복구 미확인 시 성공 접근을 만들지 않는다. Worker 초기 준비가 끝나기 전에 들어온 native callback은 runtime 준비를 기다리고 관측 당시 시각과 적용 시각을 대조한다. Chrome 전체 자동 재개는 구현하지 않는다.
- BLOCK는 원래 방문 host를 pending에 보존하고 실제 적용 규칙과 동일한 확장 차단 안내 URL로 commit된 경우만 이벤트 확정. 주소 표시줄에서 안내 페이지를 직접 열거나 새로고침한 것은 pending 없으면0건이다. RECORD는 원래 실제 host로 commit되어야 한다. 가장 구체적인 frozen 정책만 선택, 부모 혼합 금지.
- 신규 Event1.2: 실제 host=target_host/target_key, matched_policy_host=선택 정책, BLOCK 이유 [USER_SITE], RECORD 이유 [], 새 navigation/event UUID. local_seq/access_seq는 같은 session에서 단조 증가한다. 본문 확정·sequence·pending 소비가 하나의 IndexedDB transaction이다. duplicate commit은 두 번째 이벤트를 만들지 않는다. 방문 전체 URL·경로·query/본문/토큰은 원문에 저장하지 않고 error 매칭용 fingerprint만 사용한다.
- 별도 focurve-member-access IndexedDB에 pending/sequence/originals. 전송 outbox로 복사 도중 종료되어도 같은 원문이 남는다. 기존 MemberEventDelivery를 사용하고 ACKED/REJECTED가 확인된 staging 원문만 삭제한다. REJECTED 원문은 전송 outbox에 보존된다. 응답 유실/오프라인·PENDING_DEPENDENCY는 기존 status 조회·동일 ID/body 재전송 규칙을 유지한다.
- 전달 직전 expected owner/executor를 검증하여 계정이 바뀐 동안 이전 계정 이벤트를 새 계정 outbox에 넣지 않는다. Server마다 별도 회원 outbox 이름, 원문 staging도 server/owner/executor 분리. guest 자료 자동 업로드 없음. 새 event 생성 중 전송이 진행 중이면 후속 전달을 보존하고 backup tick도 재전송을 시도한다.
- 팝업은 수집/전송 미확인 또는 전송 대기를 구분해 안내한다. 수집 실패를 접근0 성공으로 확정하지 않는다. Server 기록 상태/watermark를 임의 COMPLETE로 만들지 않는다.

## 실제 실행 검증

| 실행 | 결과 | 한계 |
|---|---|---|
| extension npm test | 189/189 PASS, 실패0/skip0 | fake IndexedDB·Chrome/API 모의. 신규 수집/중복/순번/정책 예외/소유권/복구/응답유실/저장 실패 및 실제 Core context→DNR 확인 경로 포함 |
| extension npm run test:popup-ui | 23항목 PASS | 제품 HTML·Chromium·Chrome API 모의, 실제 설치 아님 |
| extension npm run check, bundle 원본 일치, git diff --check | PASS | 문법/생성물 일치 검증 |
| ExtensionEventDeliveryHttpIntegrationTest | 1/1 PASS | 새 제품 collector가 생성한4접근→실제 HTTP/MySQL/기록 조회. Node fake IndexedDB, native 탐색·인증·APPLIED 증거는 합성 |
| Event12HttpIntegrationTest | 2/2 PASS | 기존 실제 HTTP/MySQL Event1.2 회귀, 실제 Chrome 감지 아님 |

실제 HTTP 검사에서는 chzzk.naver.com/www.naver.com 각각2건, host별 repeat_count0/1 및 원래 정책 naver.com 유지. 실제 Server ACCEPTED 뒤 응답 유실→status ACK 복구→같은 원문 재전송 DUPLICATE, 최종4행 유지. 방문 실제 URL은 합성 입력이며 실제 사용자 자료 없음.

```bash
npm --prefix extension run build:member-worker
npm --prefix extension test
npm --prefix extension run check
npm --prefix extension run test:popup-ui
source .local/cloud-env.sh
bash scripts/with-env.sh env SNAPSHOT_1_2_ENABLED=true SNAPSHOT_1_2_VERIFIED_EXECUTORS='*' bash backend/mvnw -f backend/pom.xml -B -ntp -Dtest=ExtensionEventDeliveryHttpIntegrationTest,Event12HttpIntegrationTest test
```

'*'는 격리 test profile 전용 실행 override. 개발 .env/DB/운영 gate 변경 없음. Server 제품 코드·DB migration·Frontend 코드 변경 없음. 이번에는 관련 Backend3건만 실행했으며 전체 Backend/Web 검사 재실행 없음. UI 실행이 만든 기존 PNG2개는 이 작업 전 원본으로 복구하고 변경에 포함하지 않았다.

작업 중 수정 스크립트의 cwd 경로 오류가 발생해 실제 파일 변경이 적용되지 않았고, 저장소 루트에서 재실행 후 bundle/test/HTTP를 검증했다. 최종 기능 검사 실패0. 과거 Chrome 성공 보고를0.1.9 성공으로 취급하지 않는다.

## 미검증·협업·다음 확인

- 실제 Windows 제품 MV3 native navigation/DNR redirect의 transitionType·순서, Chrome Worker 종료 중 callback, 실제 기록 페이지 표시·전체AC·quota/Server 장기 장애는 미검증. Chrome 오류의 같은URL 겹침·redirect chain 경계도 실제 시험 필요. 완전 수집을 주장하지 않으며 기록 상태 PARTIAL을 유지한다.
- 사이트 SITE-only 원문 수집·서버 전송은 Core 독립 작업이다. 김다훈과 실제 Server cohort의 수신/반복·기록 상태를 함께 검증한다. 채지민과 D06 확정 뒤 같은 접근을 SITE/FEATURE로 이중 생성하지 않도록 navigation/freeze를 통합한다. 현재 불지원 FEATURE guard를 해제하지 않는다.
- 접근 sequence는 이번 SITE 접근 단위가 소유한다. SESSION_STARTED/ENDED 및 다른 종류의 회원 event를 추가할 때 중앙 local_seq 할당에 통합해야 하며 별도 generator에서 같은local_seq를 재사용하면 안 된다. 이번에 lifecycle event를 임의 생성하지 않는다.
- 시작/종료 즉시 연결(0.1.8)의 Windows 검증은 보류 상태를 유지한다. 이번 수집·전송 작업으로 해결 완료라 하지 않는다.

Windows 적용은 기존 확장 로드 경로의 extension 내용만 갱신→확장 ↻→0.1.9 확인. 기존 회원 연결/사이트/DB를 유지하며 확장 삭제·새 경로 재로드 없음. Server JAR·Web 재빌드 불필요(0.1.8 Web 변경은 별도 기존 적용 범위). 현재 실제 설치의 Snapshot 테스트 gate 조건은 유지해야 한다.

실제 확인 순서: 회원 사이트 하나 BLOCK·하나 RECORD 설정→2분 세션→BLOCK 방문/안내 새로고침/재방문, RECORD 명시방문/새로고침, ALLOW 및 subframe 제외→종료→Web 행동 기록의 host/사유/회수/반복 확인. 최초 적용 전에 열려 있던 사이트의 안내 전환은 접근에 포함하지 않는다. 모의 결과와 실제 결과를 따로 기록한다.
