# 개발 규칙

본 문서는 프로젝트에서 공통으로 사용하는 개발 원칙과 구조를 정의합니다.

기술 스택이 확정되지 않은 내용은 초안으로 관리하며, 프로젝트 진행에 따라 수정합니다.

---

## 공통 개발 원칙

프로젝트는 다음 원칙을 기준으로 개발합니다.

- 기능의 목적과 완료 조건을 확인한 후 개발합니다.
- 각 계층과 구성 요소의 역할을 명확하게 구분합니다.
- 하나의 클래스와 메서드는 하나의 책임을 갖도록 작성합니다.
- 중복 코드를 최소화하고 공통 기능은 재사용합니다.
- 의미가 명확한 이름을 사용합니다.
- 불필요하게 복잡한 구조는 도입하지 않습니다.
- 작업과 관계없는 코드는 수정하지 않습니다.
- 구조가 변경되면 관련 문서를 함께 수정합니다.
- 민감한 정보는 코드에 작성하지 않습니다.

코드 작성 규칙은 [코딩 컨벤션](./CODING_CONVENTION.md)을 따릅니다.

---

## 백엔드 구조(초안)

Spring 기반 백엔드를 사용하는 경우 다음 구조를 기본으로 검토합니다.

```text
Controller
    ↓
Service
    ↓
Repository
```

프로젝트 주제와 기술 스택에 따라 변경될 수 있습니다.

---

## 계층별 역할

| 계층 | 역할 |
|------|------|
| Controller | 요청 및 응답 처리 |
| Service | 비즈니스 로직 |
| Repository | 데이터 접근 |

각 계층은 자신의 책임만 수행하며 다른 계층의 역할을 대신하지 않습니다.

---

## 계층 간 호출 원칙

호출 방향은 다음을 기본으로 합니다.

```text
Controller → Service → Repository
```

다음과 같은 구조는 사용하지 않습니다.

```text
Controller → Repository
Repository → Service
Repository → Controller
```

---

## DTO와 Entity

Spring 기반 백엔드를 사용하는 경우 역할을 구분합니다.

| 구성 요소 | 역할 |
|-----------|------|
| DTO | 요청 및 응답 데이터 전달 |
| Entity | 데이터베이스 객체 |

Entity를 API 응답으로 직접 반환하지 않고 필요한 경우 DTO로 변환합니다.

---

## 프로젝트 구조(초안)

```text
backend/
├── controller/
├── service/
├── repository/
├── entity/
├── dto/
├── config/
└── exception/
```

프로젝트 규모에 따라 기능(도메인) 중심 구조로 변경할 수 있습니다.

---

## 문서 관리

다음 내용이 변경되면 관련 문서를 함께 수정합니다.

| 변경 내용 | 관련 문서 |
|------|------|
| API | docs/api |
| 시스템 구조 | docs/architecture |
| 개발 규칙 | DEVELOPMENT_RULE.md |
| 코드 작성 규칙 | CODING_CONVENTION.md |

문서와 실제 구현은 항상 동일한 상태를 유지합니다.

---

## 향후 추가 예정

프로젝트 진행에 따라 필요한 경우 다음 내용을 추가합니다.

- Frontend 구조
- Browser Extension 구조
- 예외 처리 규칙
- Logging 규칙
- Test 규칙
- Security 규칙
- DTO 작성 규칙
- Entity 작성 규칙

---

## 관련 문서

- [프로젝트 소개](../README.md)
- [기여 가이드](../CONTRIBUTING.md)
- [Git 사용 가이드](./GIT_GUIDE.md)
- [팀 운영 가이드](./TEAM_GUIDE.md)
- [코딩 컨벤션](./CODING_CONVENTION.md)
- [API 명세](./api/README.md)
- [시스템 아키텍처](./architecture/README.md)