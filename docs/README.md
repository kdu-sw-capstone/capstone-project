# 문서 안내

## 설계 확인

- [설계 안내](design/00_문서안내.md): 기능 범위와 명세 구성
- [통합 Markdown](design/FOCURVE_설계_통합본.md): GitHub에서 읽거나 AI에 전달하는 통합 문서
- [통합 HTML](design/FOCURVE_설계_통합본.html): 폴더를 내려받아 Chrome·Edge에서 열면 도면을 함께 확인할 수 있다.

설계 수정은 design/의 항목별 원문에 반영하고 통합 Markdown·HTML도 함께 갱신한다. 도면과 미리보기 파일은 같은 폴더 구조를 유지한다.

## 개발과 협업

- [개발 기준](DEVELOPMENT_RULE.md): 설계 적용과 검증 원칙
- [Git 작업 순서](GIT_GUIDE.md): 브랜치·커밋·PR·병합
- [담당·협업 기준](TEAM_GUIDE.md): 영역별 책임과 인계
- [개발 운영](implementation/개발운영.md): 필수·추가 MVP 진행 단계와 완료 조건
- [기능별 현황](implementation/통합현황.md): 진행 상태와 작업카드
- [AI 요청문](implementation/AI_요청문.md): 기능 작업을 요청하는 양식

현행 설계는 design/, 구현·검증 기록은 implementation/에서 관리한다. archive/와 design/이전자료/는 참고용 보관 자료이며 현행 구현 기준이 아니다.

## 후속 PC 확장

필수·추가 MVP 완료·검증 후 PC 앱으로 확장하여 PC 프로그램 관리 기능을 개발한다. 현재 상세 설계는 Web·Server·Chrome Extension 기준이며 모바일은 미정이다. PC 세부 설계·일정·담당은 후속 단계에서 구체화한다. 기존 47개 기능과 3인 담당 배정은 유지한다.

[개발 단계와 PC 후속 확장 계획](design/02_시스템_테크설계/09_PC_후속확장계획.md)을 함께 확인한다.
