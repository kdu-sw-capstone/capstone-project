# EXT-03 · 전송 저장 실패 후 복구 · 2026-10-10

이번 목표: staging/outbox 저장 오류를 표시하고, 저장소가 정상화되면 이미 보존된 기록을 같은 ID·원문으로 전송 재개한다. 시작 4087f33b3017c899b07971e7d72585b2526d1724, 담당 Core 종민, feature/extension-core-ext-02, Extension 0.1.14, PR #17.

## 기준과 변경

- `docs/design/02_시스템_테크설계/05_데이터_복구.md` 로컬 저장: 공간 부족 시 성공을 가장하지 않음, 원본 유지, 오래된 회원 대기 자료 자동 삭제 금지.
- `docs/design/02_시스템_테크설계/12_정책계약_이벤트12_호환성게이트.md`: ACK 전 원문 보존, 상태 조회 우선 재시도, ID 재발행 금지.
- `docs/design/01_UX_기능설계/02_IA_화면명세.md` EXT-01: 전송 상태와 계정 경계.

`member-execution-runtime.js`는 전송 오류를 별도 deliveryError로 관리한다. 기존 수집 accessError를 전송 실패로 덮어쓰지 않으며, 성공한 전송/정리 이후 전송 경고만 지운다. 수집 단계에서 저장되지 못한 자료를 복원했다고 표시하지 않는다.

MEMBER_STORAGE_UNAVAILABLE/BLOCKED 및 ACCESS_STORAGE_UNAVAILABLE는 내부 팝업 응답 DELIVERY_STORAGE_UNAVAILABLE로 변환한다. 이 오류는 Server API enum에 추가하지 않는다. 읽기 실패는 빈 건수 성공 대신 ERROR/data:null이며 원문/계정/토큰/네이티브 오류 세부 정보를 공개하지 않는다.

팝업은 저장 공간 확인 및 기존 전송 재확인 버튼을 안내한다. 자료 초기화/원문 삭제로 복구하지 않는다. 전송함 기록과 동일 owner/executor/body의 terminal receipt만 staging 정리에 사용한다. 원문 충돌·다른 계정의 receipt로 정리하지 않는다.

자동 정기 재확인과 수동 재확인은 기존 경로를 사용한다. 저장 정상화 후 enqueue 쓰기를 다시 시도하고, ACK 저장 실패로 IN_FLIGHT가 남으면 수신 상태부터 확인한다. 보존된 ID와 body는 바꾸지 않는다. Retry-After 대기와 격리 기준도 유지한다.

## 검증

- `npm --prefix extension test`: 211/211 PASS. 새 5개는 outbox 쓰기 실패 후 원문 보존·같은 ID 재개, ACK 기록 실패 후 IN_FLIGHT 유지·상태 조회 우선, 저장 오류 응답·전송 경고 해제, 수집 실패 경고 유지, 읽기 실패의 빈 성공 방지를 검사한다.
- `npm --prefix extension run check`: JavaScript 구문 PASS.
- `python3 extension/tests/ui/popup_ui.py`: 32/32 PASS. 제품 HTML+Chromium+mocked Chrome API. 새 2개는 저장 오류 안내·재확인 제공, 정상화 후 실제 상태 안내 복귀다.
- 저장 장애는 fake-indexeddb store adapter의 쓰기 오류 및 VM 상태 주입 기반 모의 검증이다. 실제 Chrome 디스크 부족·IndexedDB 중단·Server 연동 검증은 미실행이다.
- Server/Web 제품 코드 변경 없음. 이번 Backend 테스트 재실행 없음. 0.1.13 사용자 정상 검증 회신은 아직 없으며 이전 정상 회신을 새 변경에 소급하지 않는다.

## 적용 및 남은 범위

기존 로드 폴더의 extension을 덮어쓴 뒤 Chrome 확장 새로고침하여 0.1.14를 확인한다. 자료 초기화나 설치 ID 변경은 필요하지 않다. ‘화면 설정·연결 확인 → 행동 기록 전송 상태’에서 저장 실패 안내와 전송 재확인을 제공한다.

이번 작업은 **이미 저장된 회원 SITE 기록의 전송 저장 실패 복구**다. 저장 전에 잃은 관찰의 재구성, 신규 수집 중단/세션 해제 전체 절차, Worker/브라우저 전체 복구·Shorts/lifecycle/watermark 협업은 별도 남은 범위다. 전체 EXT-03 완료나 실제 새 검증 완료로 표시하지 않는다. 시작 지연 검증 보류, develop 병합/자동 병합 없음.
