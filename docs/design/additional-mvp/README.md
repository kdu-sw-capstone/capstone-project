# 추가 MVP 설계 작업본 — 2026-10-25

## 3차 확정 정책 정렬

정책 서명: `tracking_scope=BROWSER_ALWAYS; budget_scope=INSTALLATION; day_boundary=USER_TIMEZONE; limit_effect=SITE_ONLY; allow_bypass=false`.

추가 확정: `timezone_change=AFTER_CURRENT_DAY_CARRY; guest_import=COMPLETED_ANALYTICS_ONLY`. DEC-06·DEC-07은 사용자 확정이며 FIN-01·02의 정책승인 대기를 해소한다. 회원전환 전후 같은설치의 원장 연속성은 별도 기술합의이고 자동가져오기·회원 현재한도 자동합산은 금지한다.

DEC-01 상시측정/집행·DEC-02 설치별한도/계정합계조회전용·DEC-03 사용자timezone자정·DEC-04 해당사이트차단/집중유지·DEC-05 예약/시간대/한도/전역>site ALLOW는 확정이다. 직전 PROP-01~11은 제안이력으로만 참조한다. 현행기술계약은02의3차절·15사례/잔여TECH는05가 원본이다. 제품구현/새schema wire 승인과 정책확정은 구분한다.

상태: DESIGN_DRAFT / 구현 미착수 / 실제 연동 NOT_VERIFIED. 사용자 최신 지시에 따라 7개 영역과 YouTube 10개·Instagram 6개를 확정 요구사항으로 반영한다. 사용자 확정7개 정책은 승인 반영했으며 적용세부·새 wire/DDL·성능수치는 공동기술검토 대상이다. 정책승인과제품구현/실제검증완료를구분한다.

## 현행 인계 상태

현재 문서7개를 유지·보완했다. 01은16개/URL/모델 상세,02는API/DB/ERD관계·후보Event/Snapshot·Extension계약·R3차이,03은제작중UI요구/최종재검수,04는PR의존/파일소유/CI/rollback,05는확정DEC-01~07·잔여TECH-01~08·갱신CON-01~15이며PROP-01~11은보관이력이다. 실제제품 READY가 아니라 계약검토 가능 상태이며, 잔여 기술 합의·D06합의·모델실측/최종R3대응이 구현연동 선행조건이다. 새문서 증식 대신 기존작업카드에 MVP-UI-01~10을 통합했다.

최신 업데이트: DEC-06/07 반영·AC-TZ6/IMPORT7 시나리오추가·남은FIN-03~05 기술검토. 확정 업데이트: URL경계우선·제목본문댓글제외·HIGH고정·InceptionV3→MobileNetV2 확인. 44개 UI수치는 잠정 이력, Figma제작중을최종결함으로판정하지않음. `validate_design.py`는로컬설계전용무쓰기검사이며제품테스트를대체하지않는다. 현재문서전용최소PR에는Markdown7개만포함하고검사기파일은제외한다(04의허용목록/본문초안참조).

## 작업 공간과 기준

- Worktree: `C:/Users/dahun/.codex/worktrees/additional-mvp-design-20261025/capstone-project`
- 브랜치: `codex/additional-mvp-design`
- 시작/현재 HEAD: `90ad32be5d282f3b44c917a29e156dffc5e29187`
- `git fetch origin develop` 후 FETCH_HEAD·origin/develop이 위 SHA와 일치했다. 루트 develop HEAD `76df34e`는 유지했다.
- 기존 Git index·작업 파일·R3·검증 후보·Default·Profile 2는 편집하지 않았다. 새 Worktree의 문서만 작성한다. Commit/Push/Merge 및 제품 구현 없음.
- 위 Git 커밋은 R3 전체 소스/패키지와 같다는 뜻이 아니다. R3는 별도 릴리스·overlay·검증 후보를 포함하며, 이번에는 R3 Manifest와 전체 체크섬을 재검증하지 않았다.

## 읽는 순서

1. [기능별 상세 초안](01_기능설계.md): 7개 영역, 16개 기능, 동작·예외·수용 기준.
2. [계약 차이와 변경안](02_공통계약_차이표.md): Policy/API/DB/Event/Snapshot 및 R3 경계.
3. [UI 검수](03_UI_검수.md): 실제 Figma metadata와 Web 코드의 근거·누락.
4. [Git·3인 협업](04_Git_협업.md): 소유 파일, 순서, 병합·검증 게이트.
5. [미확정 결정](05_미확정_검증계획.md): 정책 승인 사항과 실행 검증 계획.
6. [설계 작업카드](../../implementation/tasks/ADDITIONAL-DESIGN-20261025.md): 현재 상태·재개 기록.

## 설계 원본과 우선순위

사용자 최신 지시 → 현행 상세 계약 → 구 요약 문서. 특히 다음 문서를 기준으로 읽었다.

- `AGENTS.md`, `CONTRIBUTING.md`, `docs/implementation/개발운영.md`, `통합현황.md` 및 OPTION-01~12/SESSION-05~06 작업카드.
- `docs/design/00_문서안내.md`, `04_검수_예시데이터/설계연결.json`, 화면·동작·API·데이터·검증 기준, 상세 도면 페이지 목록.
- `02_시스템_테크설계/10_호스트_정책우선순위.md`, `11_인증_실행복구_가져오기_연결계약.md`, `12_정책계약_이벤트12_호환성게이트.md`.
- `FOCURVE_D01_D10_최종공용계약.md`, `FOCURVE_APPLY_POLICY_기간전달_확정계약.md`.

기존 47개 기능 ID와 3인 배정은 유지한다. YT/IG ID는 OPTION 하위 요구사항 추적 ID다. 일일 한도는 기존 명세에 완전한 계약이 없어 추가 하위 요구사항으로 연결하고 정책을 별도 확정한다. SESSION-05/06과 OPTION-12를 7개 영역 재분류를 이유로 삭제하지 않는다. PC는 필수·추가 MVP 완료·검증 뒤 후속 단계, 모바일은 미정이다.

## 조사 한계

정적 코드와 문서·Figma 구조 확인이다. 실제 Web 기동·모델 실행·Chrome 차단·복원·DB/API 통합·Figma 프로토타입 클릭은 NOT_VERIFIED. 기존 R3의 33/33·99/99는 다른 채팅의 사용자 지시에서 참조된 이력이며 이번 작업의 독립 재검증 결과가 아니다. 설계 도면 63페이지의 모든 노드와 본문의 일치 전수 검수도 NOT_VERIFIED.
