# Contribution Guide

본 문서는 캡스톤 프로젝트 팀원이 동일한 Git 규칙으로 협업하기 위한 기준입니다.

## 기본 브랜치

- `main`: 배포 및 최종 발표용 브랜치
- `develop`: 기능 통합 및 테스트용 브랜치

팀원은 `main` 또는 `develop`에서 직접 작업하지 않습니다.

## 작업 시작 방법

항상 최신 `develop`에서 새로운 작업 브랜치를 만듭니다.

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
git switch -c docs/api-specification
```

## 브랜치 이름 규칙

| 종류 | 형식 | 예시 |
| --- | --- | --- |
| 기능 개발 | `feature/기능명` | `feature/login` |
| 버그 수정 | `bugfix/내용` | `bugfix/navbar-overflow` |
| 긴급 수정 | `hotfix/내용` | `hotfix/server-error` |
| 리팩터링 | `refactor/내용` | `refactor/auth-service` |
| 문서 작업 | `docs/내용` | `docs/readme-update` |
| 환경 설정 | `chore/내용` | `chore/project-setup` |

브랜치 이름은 영문 소문자와 하이픈을 사용합니다.

## Commit 메시지 규칙

Commit 메시지는 다음 형식을 사용합니다.

```text
type(scope): 작업 내용
```

예시:

```text
feat(auth): 로그인 기능 구현
fix(api): 회원 조회 오류 수정
docs(readme): 프로젝트 실행 방법 추가
refactor(user): 사용자 서비스 구조 개선
test(auth): 로그인 서비스 테스트 추가
chore(repo): 초기 저장소 구조 설정
```

사용 가능한 주요 타입:

- `feat`: 새로운 기능
- `fix`: 버그 수정
- `docs`: 문서 변경
- `refactor`: 기능 변화 없는 코드 구조 개선
- `test`: 테스트 코드
- `chore`: 설정, 빌드, 저장소 관리
- `style`: 코드 동작과 관계없는 형식 수정

다음과 같은 모호한 메시지는 사용하지 않습니다.

```text
수정
최종
진짜 최종
작업함
오류 해결
```

## Pull Request 규칙

1. 하나의 Pull Request에는 하나의 목적만 포함합니다.
2. 관련 Issue가 있다면 PR 본문에 번호를 작성합니다.
3. 구현 내용과 테스트 방법을 작성합니다.
4. 다른 팀원의 리뷰 승인 후 병합합니다.
5. 리뷰 의견이 해결되지 않은 상태에서는 병합하지 않습니다.
6. 병합 후 사용한 브랜치를 삭제합니다.

## 파일 수정 원칙

1. 담당 영역을 중심으로 작업합니다.
2. 다른 담당자의 주요 파일을 수정해야 한다면 먼저 공유합니다.
3. 공용 설정 파일은 동시에 수정하지 않습니다.
4. `.github`, 배포 설정, 환경 변수 구조 변경은 팀에 먼저 알립니다.
5. 프로젝트 전체 자동 포맷은 사전 합의 없이 실행하지 않습니다.

## 보안 규칙

다음 정보는 GitHub에 Commit하지 않습니다.

1. 실제 비밀번호
2. API Key
3. Access Token
4. 데이터베이스 접속 비밀번호
5. 개인정보
6. 실제 `.env` 파일

필요한 환경 변수 이름은 `.env.example`에 작성합니다.