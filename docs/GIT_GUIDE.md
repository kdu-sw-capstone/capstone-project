# Git 사용 가이드

본 문서는 캡스톤 프로젝트에서 사용하는 Git 협업 절차를 설명합니다.

모든 팀원은 아래 순서대로 작업을 진행합니다.

---

## 개발 흐름

```text
develop 최신 Pull
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
코드 리뷰
        ↓
Merge
```

---

## 저장소 Clone (최초 1회)

프로젝트를 처음 받을 때 한 번만 실행합니다.

```bash
git clone https://github.com/kdu-sw-capstone/capstone-project.git
```

저장소 폴더로 이동합니다.

```bash
cd capstone-project
```

---

## develop 브랜치 최신화

새로운 작업을 시작하기 전에 항상 `develop` 브랜치를 최신 상태로 만듭니다.

```bash
git switch develop
git pull origin develop
```

---

## 새로운 작업 브랜치 생성

항상 최신 `develop`을 기준으로 작업 목적에 맞는 브랜치를 생성합니다.

### 기능 개발

```bash
git switch -c feature/login
```

### 버그 수정

```bash
git switch -c bugfix/login-error
```

### 문서 수정

```bash
git switch -c docs/readme-update
```

### 리팩터링

```bash
git switch -c refactor/auth-service
```

### 환경 설정

```bash
git switch -c chore/project-setup
```

브랜치 이름은 영문 소문자와 하이픈을 사용합니다.

```text
feature/login
feature/dashboard
bugfix/login-error
docs/readme-update
refactor/auth-service
chore/project-setup
```

---

## 개발 및 파일 수정

생성한 작업 브랜치에서 담당 기능을 개발하거나 문서를 수정합니다.

작업 중에는 현재 브랜치를 수시로 확인합니다.

```bash
git branch
```

현재 작업 상태를 확인합니다.

```bash
git status
```

---

## 작업 내용 저장 (Commit)

변경된 파일을 Git의 Commit 대상으로 추가합니다.

```bash
git add .
```

Commit을 생성합니다.

```bash
git commit -m "feat(login): 로그인 기능 구현"
```

Commit 메시지는 `CONTRIBUTING.md`의 규칙을 따릅니다.

Commit 메시지 예시:

```text
feat(auth): 로그인 기능 구현
fix(api): 회원 조회 오류 수정
docs(readme): 프로젝트 설명 수정
refactor(user): 사용자 서비스 구조 개선
chore(repo): 저장소 설정 변경
```

---

## GitHub로 Push

현재 작업 브랜치를 원격 저장소에 업로드합니다.

```bash
git push origin feature/login
```

`feature/login` 부분은 현재 작업 중인 브랜치 이름으로 변경합니다.

예시:

```bash
git push origin bugfix/login-error
git push origin docs/readme-update
```

---

## Pull Request 생성

Push가 완료되면 GitHub에서 Pull Request를 생성합니다.

1. GitHub 저장소에 접속합니다.
2. **Compare & pull request** 버튼을 클릭합니다.
3. 병합 대상 브랜치가 `develop`인지 확인합니다.
4. Pull Request 제목을 작성합니다.
5. 구현 내용과 테스트 방법을 작성합니다.
6. Reviewer를 지정합니다.
7. **Create Pull Request** 버튼을 클릭합니다.

Pull Request의 기본 방향은 다음과 같습니다.

```text
작업 브랜치 → develop
```

예시:

```text
feature/login → develop
bugfix/login-error → develop
docs/readme-update → develop
```

---

## 코드 리뷰 및 Merge

다른 팀원이 Pull Request 내용을 확인하고 코드 리뷰를 진행합니다.

다음 조건을 충족한 후 병합합니다.

- 작업 내용이 정상적으로 동작함
- 리뷰 의견이 모두 해결됨
- 병합 대상이 `develop`으로 설정됨
- 불필요한 파일이 포함되지 않음
- 비밀번호나 API Key가 포함되지 않음

코드 리뷰가 완료되면 `develop` 브랜치로 병합합니다.

병합 후에는 사용한 작업 브랜치를 삭제합니다.

---

## Merge 이후 다음 작업 준비

병합이 완료되면 로컬 `develop` 브랜치를 다시 최신화합니다.

```bash
git switch develop
git pull origin develop
```

이후 새로운 작업을 시작할 때 새로운 작업 브랜치를 생성합니다.

```bash
git switch -c feature/새로운-기능
```

기존 작업 브랜치를 계속 재사용하지 않습니다.

---

## 자주 사용하는 명령어

### 현재 브랜치 확인

```bash
git branch
```

### 변경 사항 확인

```bash
git status
```

### 원격 저장소 확인

```bash
git remote -v
```

### Commit 기록 확인

```bash
git log --oneline
```

### 원격 브랜치 목록까지 확인

```bash
git branch -a
```

### 최근 변경사항 비교

```bash
git diff
```

---

## 주의사항

다음 사항은 반드시 지켜야 합니다.

- `main` 브랜치에 직접 Push하지 않습니다.
- `develop` 브랜치에 직접 Push하지 않습니다.
- 작업 목적에 맞는 작업 브랜치를 생성합니다.
- 기능 개발은 `feature/*` 브랜치를 사용합니다.
- 버그 수정은 `bugfix/*` 브랜치를 사용합니다.
- 문서 수정은 `docs/*` 브랜치를 사용합니다.
- 하나의 브랜치에서는 하나의 목적에 해당하는 작업만 수행합니다.
- 작업 중인 변경사항을 정리하지 않고 다른 브랜치로 이동하지 않습니다.
- Commit은 의미 있는 작업 단위로 작성합니다.
- Pull Request 없이 병합하지 않습니다.
- API Key, 비밀번호, Access Token, 개인정보는 Commit하지 않습니다.

---

## 관련 문서

- [프로젝트 소개](../README.md)
- [팀 개발 가이드](./TEAM_GUIDE.md)
- [Git 협업 규칙](../CONTRIBUTING.md)
- [개발 규칙](./DEVELOPMENT_RULE.md)
- [코딩 컨벤션](./CODING_CONVENTION.md)