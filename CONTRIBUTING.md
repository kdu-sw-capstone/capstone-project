# 기여 가이드

본 문서는 캡스톤 프로젝트 팀원이 동일한 Git 규칙과 협업 절차에 따라 작업하기 위한 기준 문서입니다.

브랜치, Commit, Pull Request, 코드 리뷰 및 병합에 관한 세부 규칙은 본 문서를 기준으로 합니다.

실제 Git 명령어와 작업 순서는 [Git 사용 가이드](docs/GIT_GUIDE.md)를 참고합니다.

---

## 기본 브랜치

| 브랜치 | 용도 |
|--------|------|
| `main` | 배포 및 최종 발표가 가능한 안정 버전 |
| `develop` | 기능 통합 및 테스트를 위한 개발 버전 |

팀원은 `main` 또는 `develop` 브랜치에서 직접 작업하지 않습니다.

모든 변경 사항은 작업 브랜치에서 작성한 후 Pull Request를 통해 병합합니다.

---

## 기본 작업 흐름

일반 작업은 다음 순서로 진행합니다.

```text
Issue 생성 또는 작업 확인
        ↓
develop 최신화
        ↓
작업 브랜치 생성
        ↓
기능 개발 또는 문서 수정
        ↓
Commit
        ↓
Push
        ↓
Pull Request 생성
        ↓
팀원 리뷰 및 승인
        ↓
develop에 병합
        ↓
작업 브랜치 삭제
```

발표 또는 배포가 가능한 상태가 되면 `develop`을 `main`에 병합합니다.

```text
develop → main
```

---

## 작업 시작 방법

일반적인 기능 개발, 버그 수정, 리팩터링, 문서 작업 및 환경 설정은 최신 `develop` 브랜치에서 시작합니다.

```bash
git switch develop
git pull origin develop
git switch -c feature/기능명
```

예시:

```bash
git switch -c feature/login
git switch -c feature/dashboard
git switch -c bugfix/login-validation
git switch -c refactor/auth-service
git switch -c docs/api-specification
git switch -c chore/project-setup
```

긴급 수정이 필요한 경우에만 최신 `main` 브랜치에서 `hotfix/*` 브랜치를 생성합니다.

```bash
git switch main
git pull origin main
git switch -c hotfix/수정내용
```

---

## 브랜치 이름 규칙

| 종류 | 형식 | 예시 |
|------|------|------|
| 기능 개발 | `feature/기능명` | `feature/login` |
| 버그 수정 | `bugfix/내용` | `bugfix/navbar-overflow` |
| 긴급 수정 | `hotfix/내용` | `hotfix/server-error` |
| 리팩터링 | `refactor/내용` | `refactor/auth-service` |
| 문서 작업 | `docs/내용` | `docs/readme-update` |
| 환경 설정 | `chore/내용` | `chore/project-setup` |

브랜치 이름은 영문 소문자와 하이픈을 사용합니다.

```text
feature/user-profile
bugfix/login-validation
refactor/auth-service
docs/readme-update
chore/project-setup
```

하나의 브랜치에서는 하나의 목적에 해당하는 작업만 수행합니다.

---

## Pull Request 대상 브랜치

일반 작업은 `develop` 브랜치로 병합합니다.

```text
feature/*  → develop
bugfix/*   → develop
refactor/* → develop
docs/*     → develop
chore/*    → develop
```

발표 또는 배포가 가능한 버전은 `develop`에서 `main`으로 병합합니다.

```text
develop → main
```

긴급 수정은 `hotfix/*`에서 `main`으로 병합합니다.

```text
hotfix/* → main
```

긴급 수정이 `main`에 반영된 후에는 동일한 변경 사항을 `develop`에도 반영합니다.

```text
main → develop
```

일반 작업 브랜치에서 `main`으로 직접 Pull Request를 생성하지 않습니다.

---

## Issue 연결 규칙

작업을 시작하기 전에 관련 Issue가 있는지 확인합니다.

Issue가 필요한 작업은 다음 내용을 포함합니다.

- 작업 목적
- 작업 범위
- 완료 조건
- 담당자
- 관련 Label
- 필요한 경우 목표 일정

Pull Request에서 관련 Issue를 연결하려면 다음 형식을 사용합니다.

```text
Closes #이슈번호
```

예시:

```text
Closes #12
```

해당 Pull Request가 병합되면 연결된 Issue가 자동으로 종료됩니다.

단순한 오탈자 수정처럼 별도 추적 가치가 낮은 작업은 Issue 없이 진행할 수 있습니다.

---

## Commit 메시지 규칙

Commit 메시지는 다음 형식을 사용합니다.

```text
type(scope): 작업 내용
```

`scope`는 변경 영역을 구분할 필요가 있을 때 작성합니다.

예시:

```text
feat(auth): 로그인 기능 구현
fix(api): 회원 조회 오류 수정
docs(readme): 프로젝트 실행 방법 추가
refactor(user): 사용자 서비스 구조 개선
test(auth): 로그인 서비스 테스트 추가
chore(repo): 초기 저장소 구조 설정
```

사용 가능한 주요 타입은 다음과 같습니다.

| 타입 | 용도 |
|------|------|
| `feat` | 새로운 기능 |
| `fix` | 버그 수정 |
| `docs` | 문서 변경 |
| `refactor` | 기능 변화가 없는 코드 구조 개선 |
| `test` | 테스트 코드 추가 또는 수정 |
| `chore` | 설정, 빌드 및 저장소 관리 |
| `style` | 코드 동작과 관계없는 형식 수정 |

다음과 같이 변경 내용을 알 수 없는 메시지는 사용하지 않습니다.

```text
수정
최종
진짜 최종
작업함
오류 해결
```

하나의 Commit에는 가능한 한 하나의 논리적인 변경만 포함합니다.

---

## Pull Request 작성 규칙

1. 하나의 Pull Request에는 하나의 목적만 포함합니다.
2. 제목만 보고도 작업 내용을 이해할 수 있도록 작성합니다.
3. 주요 변경 사항을 본문에 작성합니다.
4. 실행 확인 또는 테스트 방법을 작성합니다.
5. 관련 Issue가 있다면 Issue 번호를 연결합니다.
6. 리뷰어가 확인해야 할 사항이 있다면 별도로 작성합니다.
7. 작업과 관계없는 파일은 포함하지 않습니다.
8. Pull Request 생성 전에 대상 브랜치를 확인합니다.

Pull Request 제목은 Commit 메시지와 비슷한 형식을 사용할 수 있습니다.

```text
feat(auth): 로그인 기능 구현
docs(api): API 명세 템플릿 추가
```

---

## 코드 리뷰 규칙

Pull Request는 작성자 이외의 팀원이 검토합니다.

리뷰어는 다음 항목을 확인합니다.

- Issue 또는 작업 목적을 충족했는가
- 변경 범위가 Pull Request의 목적과 일치하는가
- 기존 기능에 불필요한 영향을 주지 않는가
- 불필요한 파일이나 변경이 포함되지 않았는가
- 보안 정보가 포함되지 않았는가
- 필요한 실행 확인 또는 테스트가 이루어졌는가
- 구현과 관련 문서가 일치하는가
- 코드 또는 문서가 팀 규칙을 따르는가

리뷰 의견은 목적이 드러나도록 작성합니다.

- 수정이 필요한 경우: 수정 요청
- 확인이 필요한 경우: 질문
- 선택적으로 개선할 수 있는 경우: 제안

작성자는 리뷰 의견을 확인한 후 다음 중 하나로 대응합니다.

- 변경 내용을 수정
- 질문에 답변
- 수정하지 않는 이유 설명

---

## 승인 및 병합 조건

다음 조건을 모두 충족한 후 병합합니다.

- 최소 1명의 팀원에게 승인을 받음
- 리뷰 대화가 모두 해결됨
- 충돌이 발생하지 않음
- 대상 브랜치가 올바르게 설정됨
- 필요한 실행 확인 또는 테스트가 완료됨
- 민감한 정보가 포함되지 않음

리뷰 승인 이후 새로운 Commit이 추가되어 승인이 무효화된 경우 다시 리뷰를 요청합니다.

본인이 작성한 Pull Request를 승인 처리하지 않습니다.

---

## 병합 방식

작업 브랜치를 `develop`에 병합할 때는 `Squash and merge`를 기본으로 사용합니다.

```text
feature/*  → develop
bugfix/*   → develop
refactor/* → develop
docs/*     → develop
chore/*    → develop
```

하나의 Pull Request에 포함된 여러 Commit을 하나의 의미 있는 Commit으로 정리하여 병합합니다.

`develop`을 `main`에 반영할 때는 통합 이력을 확인할 수 있도록 `Create a merge commit`을 기본으로 사용합니다.

```text
develop → main
```

긴급 수정 브랜치도 `main`에 병합한 후 변경 사항을 `develop`에 반영합니다.

GitHub 저장소의 실제 Merge 설정과 본 문서의 규칙은 동일하게 유지합니다.

---

## 파일 수정 원칙

1. 담당 영역을 중심으로 작업합니다.
2. 다른 담당자의 주요 파일을 수정해야 한다면 작업 전에 공유합니다.
3. 공용 설정 파일은 가능한 한 동시에 수정하지 않습니다.
4. `.github`, 배포 설정, 환경 변수 구조 변경은 팀에 먼저 알립니다.
5. 프로젝트 전체 자동 포맷은 사전 합의 없이 실행하지 않습니다.
6. 기능이나 구조를 변경한 경우 관련 문서도 함께 수정합니다.
7. 작업과 관계없는 파일은 Pull Request에 포함하지 않습니다.
8. 다른 팀원이 작업 중인 브랜치를 임의로 수정하지 않습니다.

---

## 보안 규칙

다음 정보는 GitHub에 Commit하지 않습니다.

1. 실제 비밀번호
2. API Key
3. Access Token
4. Secret Key
5. 데이터베이스 접속 정보
6. 개인정보
7. 실제 `.env` 파일
8. 인증서 또는 개인키

필요한 환경 변수 이름과 형식은 `.env.example`에 작성합니다.

민감한 정보가 실수로 Commit된 경우 파일만 삭제하지 않습니다.

해당 키, 토큰 또는 비밀번호를 즉시 폐기하고 재발급한 후 팀원에게 상황을 공유합니다.

---

## 작업 완료 기준

다음 조건을 충족했을 때 작업이 완료된 것으로 처리합니다.

- 작업 목적과 완료 조건을 충족함
- 필요한 실행 확인 또는 테스트를 완료함
- 관련 문서를 수정함
- Pull Request를 생성함
- 팀원의 리뷰와 승인을 받음
- 대상 브랜치에 정상적으로 병합됨
- 사용한 원격 작업 브랜치를 삭제함
- 필요한 경우 로컬 작업 브랜치를 삭제함
- 관련 Issue 또는 Project 상태를 완료로 변경함

---

## 규칙 변경

협업 규칙을 변경해야 하는 경우 팀원 간 합의 후 본 문서를 수정합니다.

브랜치 전략, Commit 형식, 리뷰 조건 또는 병합 방식이 변경되면 다음 문서와 GitHub 설정도 함께 확인합니다.

- `README.md`
- `docs/GIT_GUIDE.md`
- GitHub Branch Ruleset
- GitHub Merge 설정

---

## 관련 문서

- [프로젝트 소개](README.md)
- [Git 사용 가이드](docs/GIT_GUIDE.md)
- [팀 운영 가이드](docs/TEAM_GUIDE.md)
- [개발 규칙](docs/DEVELOPMENT_RULE.md)
- [코딩 컨벤션](docs/CODING_CONVENTION.md)