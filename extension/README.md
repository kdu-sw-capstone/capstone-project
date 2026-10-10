# FOCURVE Chrome Extension

Manifest V3 기반으로 브라우저 정책 적용·해제, 내부 기능 제한, 접근 이벤트 수집과 비회원 로컬 이용을 구현합니다.

현재 develop 기준 Core는 별도 PR17에서 개발 중입니다. 이 브랜치의 Content Control은 독립 ES module이며 manifest/제품 메시지 연결은 아직 없습니다. 이 폴더를 실제 unpacked Extension으로 로드할 수 있는 상태가 아닙니다.

`content/`는 Shorts·추천·댓글·다음 영상 autoplay·Reels의 내부 제어, 키워드 검사/페이지 가림, 성인 도메인 판정, 이미지 가림/보기/교체 파이프라인을 포함합니다. 모듈 입력은 내부 호출 경계이며 공용 Core 메시지 계약이 아닙니다. 실제 학습 모델/목록은 포함되지 않았습니다.

독립 자동 검증은 저장소 루트에서 `node --test extension/content-tests/*.test.mjs`로 실행합니다. Node24와 Playwright, Chrome이 필요합니다. Playwright가 로컬 모듈 경로에 없으면 `PLAYWRIGHT_MODULE`, 실제 Chrome을 선택하려면 `CHROME_EXECUTABLE`에 설치 경로를 지정합니다. 합성 페이지/정책과 모의 분류 시험이며 실제 서비스 지원이나 회원 연동 통과를 의미하지 않습니다. 이 모듈에는 dependency/lock/번들 빌드가 필요 없습니다.

눈으로 보는 합성 도구는 `node extension/content-tools/serve.mjs` 실행 후 `http://127.0.0.1:4178/content-tools/harness.html`에서 확인합니다. 실제 Windows 검증 명령·서비스 선행·현재 불가한 Extension 로드 조건은 [Windows 절차](../docs/implementation/Content_Control_Windows_검증.md), 기능별 범위·결과·미검증은 [개발 기록](../docs/implementation/Content_Control_2026-10-10.md), 공용 계약 제안은 [D-06 연결안](../docs/implementation/Content_Core_D06_연결제안.md)을 참고합니다.

[기능·화면 설계](../docs/design/01_UX_기능설계/) · [시스템 설계](../docs/design/02_시스템_테크설계/) · [개발 계획](../docs/implementation/개발운영.md)
