# FOCURVE 최소 CI

- 담당: 김다훈 개발환경/Server 검증. 시작 기준: `41d4074c83171aa4a7777c7601776cecd24d8ca6`, 브랜치 `codex/server-event12-integration`. 제품 기능 ID를 새로 만들거나 기존 카드의 완료 상태를 변경하지 않는다.
- 워크플로: `.github/workflows/ci.yml`, `FOCURVE CI`.
- develop 대상 PR(초기 생성·재개·새 push, Draft 포함), develop/현재 PR18 브랜치 push, 수동 dispatch에서 실행한다. PR에서는 GitHub의 가상 merge ref를 checkout한다. 경로 필터로 검증을 생략하지 않는다.
- Backend: Ubuntu 24.04, Temurin JDK21, 프로젝트 Maven Wrapper 3.9.16, `bash backend/mvnw -f backend/pom.xml -B -ntp verify`.
- 매 Job의 새 MySQL8.4.8 service/`focurve_ci_test`만 사용한다. UTC 및 utf8mb4를 제품 테스트가 검사한다. 예시 CI 전용 계정은 일회성 runner용이며 사용자 비밀값이 아니다. secrets/.env/개발 Compose/사용자 DB를 사용하지 않는다.
- 기존 `@ActiveProfiles("test")`와 `application-test.yml`을 유지한다. 테스트 profile의 Snapshot1.2 합성 검증 활성화는 제품 기본 발급 OFF 변경이 아니다. gate OFF 회귀 테스트도 그대로 실행한다.
- Frontend: `.nvmrc`의 Node24.19.0, `npm ci`, `npm test`, `npm run build`; 테스트는 jsdom/API 합성 응답이며 실제 Chrome 연동을 의미하지 않는다.
- OAuth/SMTP는 기존 테스트의 합성 제공자/메일 대역을 사용한다. 실제 외부 인증·메일 수신·회원 Extension 통합·운영 DB 복구는 CI의 완료 범위가 아니다.
- Actions는 확인한 공식 태그의 commit SHA로 고정하고 contents:read만 부여한다. pull_request_target, 비밀값 접근, 자동 승인/병합/배포는 없다.
- test 실패를 허용하는 continue-on-error/skip 옵션은 없다. always() 요약 단계는 테스트 상태를 성공으로 덮어쓰지 않는다. Backend summary에는 테스트 이름/개수만 기록하고 시스템 속성/본문/토큰을 업로드하지 않는다.
- 실행 여부·Job 결과는 GitHub Actions run과 정확한 head SHA를 확인해야 판정한다. 이 파일 작성만으로 PASS가 아니다. 이 CI는 기능별 작업카드의 실제 연동 수용 기준을 대체하지 않는다.
- 브랜치 보호의 required checks 등록은 별도 관리자 결정이다. CI 성공만으로 Draft 해제·공식 승인 충족·필수 MVP 완료를 뜻하지 않는다.
