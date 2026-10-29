# EXT-03 · 재전송 대기 시간 안내 · 2026-10-10

이번 목표: 서버/로컬 재시도 대기 중 남은 시간을 팝업에 표시하고 재확인 가능한 시점을 안내한다. 내부 작업명 재전송 대기 안내, 기능 ID EXT-03, 담당 Core 종민, 브랜치 feature/extension-core-ext-02, 시작 bcd1ccb7b485690d34953af29c7f5e8144f42e53, Extension 0.1.13, PR #17.

## 사용자 확인

사용자가 직전 0.1.12 원문 오류 격리 작업을 정상 검증했다고 회신했다. 사용자 확인으로 기록하며 추가 로그·환경·건별 결과는 제공되지 않았다. 새 0.1.13 검증 근거로 소급하지 않는다.

## 설계 대응 및 구현

- `docs/design/01_UX_기능설계/02_IA_화면명세.md` EXT-01: 전송 상태 표시, 소유자 전환 중 이전 계정 자료 숨김.
- `docs/design/02_시스템_테크설계/04_API_연동.md` 공통: 429/503 Retry-After 및 로컬 지터 backoff.
- `docs/design/02_시스템_테크설계/12_정책계약_이벤트12_호환성게이트.md`: 원문/ID 보존, 재시도 전에 상태 조회.

`member-events.js` 로컬 요약에 retry_after_at/next_retry_at을 추가했다. 현재 owner/executor의 모든 전송함 행에서 미래 서버 하한을 구하고, 전송 가능한 행과 staging의 최초 로컬 재시도 시점에 적용한다. terminal/review-only 자료는 재시도할 기록으로 세지 않는다. Server API·enum·원문은 바꾸지 않았다.

팝업은 남은 초를 표시하고 대기 중 전송 재확인 버튼을 비활성화한다. 로컬 상태 조회는 계속 가능하다. 만료 후 버튼을 활성화하며 자동 HTTP 요청이나 수신 완료로 확정하지 않는다. 실제 백그라운드 전송은 기존 경로와 영속 deadline을 따른다.

계정 상태 갱신/연결 종료 시 기존 시각과 타이머를 제거한다. 조회 실패 시 이전 시각을 최신으로 표시하지 않는다. 건수와 시각만 전달하며 원문·토큰·계정 식별자는 응답에 포함하지 않는다.

## 검증

- `npm --prefix extension test`: 206/206 PASS. 추가 2개는 owner 경계, 서버 하한/최초 로컬 backoff, 소수 ms 올림, staging, terminal/review-only, 만료 시각을 검사한다.
- `npm --prefix extension run check`: JavaScript 구문 PASS.
- `python3 extension/tests/ui/popup_ui.py`: 30/30 PASS. 제품 HTML+Chromium+mocked Chrome API. 새 2개는 서버 대기 안내·전송 버튼 제한·조회 유지, 만료 후 버튼 활성화와 수신 확정/자동 전송 방지다.
- 자동 검증은 모의 어댑터를 포함한다. 실제 새 Chrome+Server 대기 안내 검증은 미실행이며 Backend 테스트는 재실행하지 않았다.

## 적용 및 남은 범위

기존 로드 폴더의 extension 파일을 덮어쓰고 Chrome 확장 새로고침하여 0.1.13을 확인한다. ‘화면 설정·연결 확인 → 행동 기록 전송 상태’에서 대기 안내를 볼 수 있다. 계정/설치/로컬 자료를 초기화할 필요는 없다.

전체 EXT-03는 진행 중이다. 실제 Chrome+Server 복구·원문 격리·대기 안내 및 공동 lifecycle sequence/Shorts·watermark 연동은 별도 검증/협업 대상이다. 시작 지연 검증 보류, develop 병합·자동 병합 없음.
