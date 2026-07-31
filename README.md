# 경동대학교 소프트웨어학과 캡스톤 프로젝트

경동대학교 소프트웨어학과 캡스톤 디자인 팀 프로젝트 저장소입니다.

본 저장소는 프로젝트의 소스 코드, 설계 문서, 회의록 및 협업 문서를 통합 관리하기 위해 사용됩니다.

현재는 프로젝트 아이디어를 기획하고 선정하는 단계이며, 프로젝트 주제와 기술 스택이 확정되면 본 문서를 지속적으로 업데이트합니다.

---

## 팀 정보

| 이름 | 역할 | 담당 영역 |
| --- | --- | --- |
| 윤종민 | 팀원 | 추후 확정 |
| 김다훈 | 초기 GitHub 관리자 | 저장소 및 협업 환경 초기 설정 |
| 채지민 | 팀원 | 추후 확정 |

> 실제 팀 리더와 담당 영역은 프로젝트 주제 및 기술 스택 확정 후 결정합니다.

---

## 프로젝트 상태

- 현재 단계 : 아이디어 기획 및 선정
- 프로젝트 기간 : 3학년 2학기 ~ 4학년 1학기
- 프로젝트 주제 : 미정
- 기술 스택 : 미정
- 배포 환경 : 미정

---

## 저장소 구조

```text
capstone-project/
├── frontend/                  # 프론트엔드 소스 코드
├── backend/                   # 백엔드 소스 코드
├── extension/                 # 브라우저 확장 프로그램
│
├── docs/
│   ├── architecture/          # 시스템 아키텍처
│   ├── api/                   # API 명세
│   ├── meeting/               # 회의록
│   ├── presentation/          # 발표 자료
│   ├── GIT_GUIDE.md           # Git 사용 가이드
│   ├── TEAM_GUIDE.md          # 팀 운영 가이드
│   ├── DEVELOPMENT_RULE.md    # 개발 규칙
│   └── CODING_CONVENTION.md   # 코딩 컨벤션
│
├── .github/
│   ├── ISSUE_TEMPLATE/
│   └── workflows/
│
├── README.md
├── CONTRIBUTING.md
├── .gitignore
└── .env.example
```

현재 프로젝트 구성이 확정되지 않았으므로 폴더 구조는 추후 변경될 수 있습니다.

---

## 브랜치 전략

- `main` : 최종 배포 및 발표 가능한 안정 버전
- `develop` : 기능을 통합하는 개발 브랜치
- `feature/*` : 새로운 기능 개발
- `bugfix/*` : 버그 수정
- `hotfix/*` : 긴급 수정
- `docs/*` : 문서 작업

기본 작업 흐름은 다음과 같습니다.

```text
feature/* → develop → main
```

`main`과 `develop` 브랜치에는 직접 Push하지 않고 Pull Request를 통해 병합하는 것을 원칙으로 합니다.

---

## 협업 규칙

1. 작업 시작 전 최신 `develop` 브랜치를 Pull합니다.
2. 작업 목적에 맞는 브랜치를 새로 생성합니다.
3. 하나의 브랜치에서는 하나의 작업만 수행합니다.
4. 작업 완료 후 Commit 및 Push를 진행합니다.
5. Pull Request를 생성하여 코드 리뷰를 요청합니다.
6. 리뷰가 완료되면 병합(Merge)합니다.
7. 비밀번호, API Key, 개인정보 등 민감한 정보는 저장소에 Commit하지 않습니다.

세부 협업 규칙은 `CONTRIBUTING.md`를 참고합니다.

---

## 문서 관리

프로젝트 관련 문서는 `docs` 폴더에서 관리합니다.

| 문서 | 설명 |
| --- | --- |
| `docs/meeting` | 회의록 |
| `docs/api` | API 명세 |
| `docs/architecture` | 시스템 아키텍처 |
| `docs/presentation` | 발표 자료 |
| `docs/GIT_GUIDE.md` | Git 사용 가이드 |
| `docs/TEAM_GUIDE.md` | 팀 운영 가이드 |
| `docs/DEVELOPMENT_RULE.md` | 개발 규칙 |
| `docs/CODING_CONVENTION.md` | 코딩 컨벤션 |

---

## 개발 문서

프로젝트 진행에 필요한 문서는 아래에서 확인할 수 있습니다.

- [Git 사용 가이드](docs/GIT_GUIDE.md)
- [팀 운영 가이드](docs/TEAM_GUIDE.md)
- [개발 규칙](docs/DEVELOPMENT_RULE.md)
- [코딩 컨벤션](docs/CODING_CONVENTION.md)

---

## 라이선스

현재 별도의 오픈소스 라이선스를 적용하지 않았습니다.