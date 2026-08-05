# Git 사용 가이드

본 문서는 캡스톤 프로젝트에서 사용하는 Git 작업 절차와 주요 명령어를 설명합니다.

브랜치, Commit, Pull Request, 코드 리뷰 및 병합 규칙은 [기여 가이드](../CONTRIBUTING.md)를 기준으로 합니다.

---

## 기본 작업 흐름

일반적인 개발 및 문서 작업은 다음 순서로 진행합니다.

```text
Issue 확인
    ↓
develop 최신화
    ↓
작업 브랜치 생성
    ↓
기능 개발 또는 문서 수정
    ↓
변경 사항 확인
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
작업 브랜치 정리
```

`main`과 `develop` 브랜치에서는 직접 작업하지 않습니다.

---

## 저장소 Clone

프로젝트 저장소를 처음 받을 때 한 번만 실행합니다.

```bash
git clone https://github.com/kdu-sw-capstone/capstone-project.git
```

저장소 폴더로 이동합니다.

```bash
cd capstone-project
```

원격 저장소가 정상적으로 연결되었는지 확인합니다.

```bash
git remote -v
```

로컬 및 원격 브랜치를 확인합니다.

```bash
git branch -a
```

---

## develop 브랜치 최신화

새로운 작업을 시작하기 전에 항상 `develop` 브랜치를 최신 상태로 만듭니다.

```bash
git switch develop
git pull origin develop
```

현재 브랜치를 확인합니다.

```bash
git branch --show-current
```

출력 결과가 아래와 같아야 합니다.

```text
develop
```

수정 중인 파일이 남아 있다면 Commit하거나 정리한 후 브랜치를 이동합니다.

---

## 작업 브랜치 생성

일반 작업은 최신 `develop` 브랜치를 기준으로 생성합니다.

### 기능 개발

```bash
git switch -c feature/login
```

### 버그 수정

```bash
git switch -c bugfix/login-error
```

### 리팩터링

```bash
git switch -c refactor/auth-service
```

### 문서 수정

```bash
git switch -c docs/readme-update
```

### 환경 설정

```bash
git switch -c chore/project-setup
```

브랜치 이름은 영문 소문자와 하이픈을 사용합니다.

```text
feature/login
feature/user-profile
bugfix/login-error
refactor/auth-service
docs/readme-update
chore/project-setup
```

하나의 브랜치에서는 하나의 목적에 해당하는 작업만 수행합니다.

---

## 현재 작업 상태 확인

작업 중에는 현재 브랜치와 변경 사항을 수시로 확인합니다.

### 현재 브랜치 확인

```bash
git branch --show-current
```

또는 다음 명령어를 사용할 수 있습니다.

```bash
git branch
```

현재 브랜치 앞에는 `*`가 표시됩니다.

```text
  develop
* feature/login
```

### 변경된 파일 확인

```bash
git status
```

### 수정 내용 확인

```bash
git diff
```

### Stage에 추가된 내용 확인

```bash
git diff --staged
```

---

## 변경 사항 Stage에 추가

변경된 파일을 먼저 확인합니다.

```bash
git status
```

특정 파일만 추가하려면 다음 명령어를 사용합니다.

```bash
git add 파일경로
```

예시:

```bash
git add README.md
git add docs/GIT_GUIDE.md
```

현재 작업과 관련된 모든 변경 사항을 추가하려면 다음 명령어를 사용할 수 있습니다.

```bash
git add .
```

`git add .`을 사용하기 전에는 반드시 `git status`로 불필요한 파일이 포함되지 않았는지 확인합니다.

Stage에 추가된 파일을 다시 확인합니다.

```bash
git status
git diff --staged
```

---

## Commit 생성

Commit 메시지는 다음 형식을 사용합니다.

```text
type(scope): 작업 내용
```

예시:

```bash
git commit -m "feat(auth): 로그인 기능 구현"
```

주요 Commit 메시지 예시는 다음과 같습니다.

```text
feat(auth): 로그인 기능 구현
fix(api): 회원 조회 오류 수정
docs(readme): 프로젝트 설명 수정
refactor(user): 사용자 서비스 구조 개선
test(auth): 로그인 서비스 테스트 추가
chore(repo): 저장소 설정 변경
```

Commit이 정상적으로 생성되었는지 확인합니다.

```bash
git log --oneline -5
```

자세한 Commit 규칙은 [기여 가이드](../CONTRIBUTING.md)를 참고합니다.

---

## 원격 저장소로 Push

새로 만든 작업 브랜치를 처음 Push할 때는 다음 명령어를 사용합니다.

```bash
git push -u origin feature/login
```

`feature/login` 부분은 현재 작업 중인 브랜치 이름으로 변경합니다.

예시:

```bash
git push -u origin bugfix/login-error
git push -u origin docs/readme-update
```

`-u` 옵션을 사용하면 로컬 브랜치와 원격 브랜치가 연결됩니다.

이후 같은 브랜치에서는 다음 명령어만 사용해도 됩니다.

```bash
git push
```

현재 브랜치가 어떤 원격 브랜치를 추적하는지 확인하려면 다음 명령어를 사용합니다.

```bash
git branch -vv
```

---

## Pull Request 생성

Push가 완료되면 GitHub에서 Pull Request를 생성합니다.

1. GitHub 저장소에 접속합니다.
2. **Compare & pull request** 버튼을 클릭합니다.
3. Base 브랜치와 Compare 브랜치를 확인합니다.
4. Pull Request 제목을 작성합니다.
5. 주요 변경 사항을 작성합니다.
6. 실행 확인 또는 테스트 방법을 작성합니다.
7. 관련 Issue가 있다면 연결합니다.
8. Reviewer를 지정합니다.
9. **Create pull request** 버튼을 클릭합니다.

일반 작업의 Pull Request 방향은 다음과 같습니다.

```text
feature/*  → develop
bugfix/*   → develop
refactor/* → develop
docs/*     → develop
chore/*    → develop
```

예시:

```text
feature/login → develop
bugfix/login-error → develop
docs/readme-update → develop
```

Pull Request를 생성하기 전에 Base 브랜치가 `develop`인지 반드시 확인합니다.

관련 Issue를 자동으로 종료하려면 Pull Request 본문에 다음과 같이 작성합니다.

```text
Closes #이슈번호
```

예시:

```text
Closes #12
```

---

## 코드 리뷰 및 병합

Pull Request를 생성한 사람 이외의 팀원이 변경 내용을 검토합니다.

리뷰 및 병합 기준은 [기여 가이드](../CONTRIBUTING.md)를 따릅니다.

다음 조건이 충족된 후 병합합니다.

- 최소 1명의 승인 완료
- 모든 리뷰 대화 해결
- 충돌 없음
- 대상 브랜치 확인
- 필요한 실행 확인 또는 테스트 완료

작업 브랜치에서 `develop`으로 병합할 때는 `Squash and merge`를 기본으로 사용합니다.

```text
작업 브랜치 → develop
```

병합이 완료되면 원격 작업 브랜치를 삭제합니다.

---

## 병합 이후 로컬 정리

Pull Request가 병합되면 로컬 `develop` 브랜치를 최신화합니다.

```bash
git switch develop
git pull origin develop
```

병합이 완료된 로컬 작업 브랜치를 삭제합니다.

```bash
git branch -d feature/login
```

원격에서 삭제된 브랜치 정보를 로컬에서도 정리합니다.

```bash
git fetch --prune
```

로컬 및 원격 브랜치 상태를 확인합니다.

```bash
git branch -a
```

다음 작업은 최신 `develop`에서 새로운 브랜치를 생성하여 시작합니다.

```bash
git switch -c feature/새로운-기능
```

이미 병합된 작업 브랜치는 다시 사용하지 않습니다.

---

## develop에서 main으로 병합

통합된 기능이 발표 또는 배포 가능한 상태가 되면 `develop`에서 `main`으로 Pull Request를 생성합니다.

```text
develop → main
```

GitHub에서 다음 항목을 확인합니다.

```text
Base: main
Compare: develop
```

리뷰와 검토가 완료되면 `Create a merge commit` 방식으로 병합합니다.

세부 승인 및 병합 조건은 [기여 가이드](../CONTRIBUTING.md)를 따릅니다.

병합 이후 로컬 `main`과 `develop`을 각각 최신화합니다.

```bash
git switch main
git pull origin main

git switch develop
git pull origin develop
```

---

## 긴급 수정

발표 또는 배포 중인 `main` 버전에 긴급한 문제가 발생한 경우에만 `hotfix/*` 브랜치를 사용합니다.

최신 `main`으로 이동합니다.

```bash
git switch main
git pull origin main
```

긴급 수정 브랜치를 생성합니다.

```bash
git switch -c hotfix/server-error
```

수정된 파일을 확인하고 Commit합니다.

```bash
git status
git add .
git commit -m "fix(server): 서버 오류 긴급 수정"
```

원격 저장소에 Push합니다.

```bash
git push -u origin hotfix/server-error
```

Pull Request 방향은 다음과 같습니다.

```text
hotfix/* → main
```

`main`에 병합한 긴급 수정 내용은 `develop`에도 반영해야 합니다.

```text
main → develop
```

두 과정 모두 직접 Push하지 않고 Pull Request를 통해 진행합니다.

---

## 원격 변경 사항 확인

원격 저장소의 변경 사항을 로컬 작업 파일에 바로 반영하지 않고 먼저 확인하려면 다음 명령어를 사용합니다.

```bash
git fetch origin
```

원격 `develop`과 로컬 `develop`의 차이를 확인합니다.

```bash
git log develop..origin/develop --oneline
```

필요한 경우 최신 변경 사항을 Pull합니다.

```bash
git switch develop
git pull origin develop
```

---

## 자주 사용하는 명령어

### 현재 브랜치 확인

```bash
git branch --show-current
```

### 로컬 브랜치 확인

```bash
git branch
```

### 로컬 및 원격 브랜치 확인

```bash
git branch -a
```

### 변경 사항 확인

```bash
git status
```

### 수정 내용 확인

```bash
git diff
```

### Stage 내용 확인

```bash
git diff --staged
```

### Commit 기록 확인

```bash
git log --oneline
```

### 원격 저장소 확인

```bash
git remote -v
```

### 원격 변경 정보 가져오기

```bash
git fetch
```

### 삭제된 원격 브랜치 정보 정리

```bash
git fetch --prune
```

### 브랜치 추적 상태 확인

```bash
git branch -vv
```

---

## 주의사항

다음 사항을 반드시 지킵니다.

- `main`과 `develop` 브랜치에서 직접 작업하지 않습니다.
- `main`과 `develop` 브랜치에 직접 Push하지 않습니다.
- 일반 작업은 최신 `develop`에서 시작합니다.
- 긴급 수정은 최신 `main`에서 시작합니다.
- 작업 목적에 맞는 브랜치를 생성합니다.
- 하나의 브랜치에서는 하나의 작업만 수행합니다.
- 작업 중인 변경 사항을 정리하지 않고 다른 브랜치로 이동하지 않습니다.
- `git add .`을 실행하기 전에 변경 파일을 확인합니다.
- Commit은 의미 있는 작업 단위로 작성합니다.
- Pull Request 없이 병합하지 않습니다.
- 리뷰 승인 없이 병합하지 않습니다.
- 병합이 끝난 작업 브랜치를 재사용하지 않습니다.
- 민감한 정보를 Commit하지 않습니다.
- 강제 Push는 사용하지 않습니다.
- 팀 합의 없이 다른 팀원의 브랜치를 수정하지 않습니다.

---

## 문제가 발생했을 때

다음 상황에서는 임의로 명령어를 반복 실행하지 말고 팀원과 함께 확인합니다.

- Merge Conflict가 발생한 경우
- 잘못된 브랜치에서 작업한 경우
- `main` 또는 `develop`에서 수정한 경우
- 민감한 정보를 Commit한 경우
- 잘못된 파일을 삭제하거나 Commit한 경우
- Push 또는 Pull 과정에서 오류가 발생한 경우

특히 `reset --hard`, 강제 Push, Rebase와 같이 Commit 기록에 영향을 줄 수 있는 명령어는 팀원과 확인한 후 사용합니다.

---

## 관련 문서

- [프로젝트 소개](../README.md)
- [기여 가이드](../CONTRIBUTING.md)
- [팀 운영 가이드](./TEAM_GUIDE.md)
- [개발 규칙](./DEVELOPMENT_RULE.md)
- [코딩 컨벤션](./CODING_CONVENTION.md)