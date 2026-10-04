# 개발·기여 규칙

## 브랜치와 PR

main은 검증된 안정 버전, develop은 기능 통합 기준이다. 새 작업은 최신 develop에서 기능 단위 브랜치를 만든다. 기존 작업 재개 시 변경을 보존한 뒤 develop의 변경과 충돌 여부를 확인한다.

| 종류 | 예시 |
|---|---|
| 기능 | feature/web-session-start |
| 오류 | fix/extension-release |
| 문서 | docs/design-sync |
| 환경 | chore/backend-setup |
| 정리 | refactor/event-storage |

PR의 대상은 develop이며 기능 ID·설계 대응·실제 테스트 결과·미완료를 작성한다. 다른 구성원의 검토 후 병합하며 전체 통합 결과가 확인돼야 기능을 검증완료로 표시한다. 안정 버전은 develop→main PR로 반영한다. 병합 확인 후 임시 브랜치를 정리한다. GitHub 보호 규칙은 권장 운영 기준이며 이 폴더 수정만으로 서버 설정이 적용되지는 않는다.

## 커밋

type(scope): 변경 결과 형식을 사용한다. 예: feat(session): 적용 확인 후 진행 상태 표시. feat, fix, docs, test, refactor, chore, style을 사용한다.

## 작업과 검증

[AGENTS.md](AGENTS.md)와 [개발 운영](docs/implementation/개발운영.md)을 따른다. 관련 기능 작업카드를 갱신한다. 다른 담당자의 변경·공용 계약을 임의로 덮어쓰지 않는다. 변경 범위가 겹치거나 설계 충돌이 있으면 해당 담당자와 조율한다. 시간 부족으로 중단할 때 다음 행동을 기록하며 매일 작업·회의를 요구하지 않는다.

구현·관련 테스트·실제 연동을 구분한다. 코드가 생성됐거나 모의 테스트만 통과한 기능을 전체 완료로 표시하지 않는다. 실제 비밀번호·토큰·개인 자료·.env는 커밋하지 않는다.
