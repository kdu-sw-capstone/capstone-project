# 코딩 컨벤션

## 목적

본 문서는 프로젝트에서 일관된 코드 스타일과 명명 규칙을 유지하기 위한 기준입니다.

기술 스택이 확정되지 않은 내용은 초안으로 관리하며, 프로젝트 진행에 따라 수정합니다.

---

## 공통 작성 원칙

프로젝트에서는 다음 원칙을 따릅니다.

- 이름만 보고 역할을 이해할 수 있도록 작성합니다.
- 하나의 클래스와 메서드는 하나의 책임을 갖도록 작성합니다.
- 중복 코드를 최소화합니다.
- 의미가 명확한 이름을 사용합니다.
- 불필요하게 복잡한 코드를 작성하지 않습니다.
- 사용하지 않는 코드와 주석은 제거합니다.
- 코드 형식은 프로젝트의 Formatter 설정을 따릅니다.

---

## 명명 규칙

### 공통

| 대상 | 규칙 |
|------|------|
| 클래스 | PascalCase |
| 메서드 | camelCase |
| 변수 | camelCase |
| 상수 | UPPER_SNAKE_CASE |
| 패키지 | lowercase |

예시

```text
UserService
findUserById
userName
MAX_LOGIN_COUNT
```

---

### Boolean

```text
isActive
hasPermission
canAccess
shouldRetry
```

---

### Collection

복수형을 사용합니다.

```text
users
blockedUrls
loginAttempts
```

단일 객체는 단수형을 사용합니다.

```text
user
blockedUrl
loginAttempt
```

---

## 코드 작성 기준

- 하나의 함수는 하나의 역할만 수행합니다.
- 함수 이름은 수행하는 동작을 명확하게 표현합니다.
- 중첩을 최소화합니다.
- 반복되는 코드는 함수로 분리합니다.
- 매개변수가 많아지면 객체로 분리하는 것을 검토합니다.

예시

```text
findUserById
createLoginSession
validateAccessToken
```

---

## 주석 작성 기준

주석은 **무엇을 하는지**보다 **왜 그렇게 작성했는지**를 설명합니다.

권장

```text
외부 API 호출 제한으로 인해 결과를 5분간 캐시한다.
```

지양

```text
사용자를 조회한다.
```

---

## Java(Spring) 규칙 (초안)

| 대상 | 규칙 | 예시 |
|------|------|------|
| 클래스 | PascalCase | `UserService` |
| 메서드 | camelCase | `findUserById` |
| 변수 | camelCase | `userName` |
| 상수 | UPPER_SNAKE_CASE | `MAX_LOGIN_ATTEMPTS` |
| 패키지 | lowercase | `auth`, `user` |

프로젝트에서 Spring을 사용하는 경우 적용합니다.

---

## React 규칙 (초안)

| 대상 | 규칙 | 예시 |
|------|------|------|
| Component | PascalCase | `LoginForm` |
| Hook | use + PascalCase | `useAuth` |
| 함수 | camelCase | `handleLogin` |
| 변수 | camelCase | `userName` |
| 상수 | UPPER_SNAKE_CASE | `MAX_RETRY_COUNT` |

프로젝트에서 React를 사용하는 경우 적용합니다.

---

## Formatter 및 Linter

기술 스택이 확정되면 팀 공용 설정을 사용합니다.

예시

- Prettier
- ESLint
- Checkstyle
- Spotless
- EditorConfig

개인 IDE 설정이 아닌 프로젝트 설정을 기준으로 합니다.

---

## 향후 추가 예정

프로젝트 진행에 따라 필요한 경우 다음 내용을 추가합니다.

- 들여쓰기 기준
- import 순서
- 파일 및 디렉터리 규칙
- 테스트 코드 규칙
- 로그 작성 규칙
- 예외 처리 규칙

---

## 관련 문서

- [프로젝트 소개](../README.md)
- [기여 가이드](../CONTRIBUTING.md)
- [Git 사용 가이드](./GIT_GUIDE.md)
- [팀 운영 가이드](./TEAM_GUIDE.md)
- [개발 규칙](./DEVELOPMENT_RULE.md)