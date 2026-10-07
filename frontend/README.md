# FOCURVE Web 개발 기반

React 19.3.0 · TypeScript 5.9.3 · Vite 8.3.3 · Vitest 5.0.3. Node 24.19.0 LTS와 npm을 사용한다. `.nvmrc`, `package.json`, `package-lock.json`이 버전·의존성 기준이다. React+TypeScript는 화면과 API 타입 검증, Vite는 최소 실행·빌드, Vitest+Testing Library는 화면 상태 검증을 위해 선택했다. 실제 설치 버전은 lockfile을 따른다.

현재 화면은 **개발 환경 확인용**이며 회원가입·사이트·세션 등 제품 기능을 구현하지 않았다. DB 자격정보나 MySQL 드라이버를 Web에 넣지 않는다. Web → HTTP Server → MySQL 경계를 유지한다.

## 설치·실행·검증

아래 명령의 작업 디렉터리는 `capstone-project/frontend`다. Windows는 PowerShell에서도 npm 명령을 사용할 수 있다.

```bash
npm ci
npm test
npm run build
npm run dev
```

서버를 먼저 실행하면 화면의 서버 상태 확인 버튼으로 확인할 수 있다. Vite는 127.0.0.1:5173, Server는 127.0.0.1:8080을 사용한다. 개발 프록시 `/api`와 `/actuator/health`는 Server로만 전달한다. DB 포트로 프록시하지 않는다. 개발 서버는 외부에 공개하지 않는다.

빌드 산출물은 `dist/`, 빌드 로컬 확인은 `npm run preview`다. preview는 개발 프록시를 제공하지 않는다. 실제 배포용 HTTPS·동일 출처 API 구성은 다음 배포 작업에서 정한다.

Codex 클라우드에서 홈 캐시·JDK·프록시 설정이 필요하면 저장소 루트의 `./scripts/cloud-setup.sh`를 실행한 뒤, 각 새 셸에서 `source ../.local/cloud-env.sh`를 실행한다. 별도 Git worktree를 만들지 않고 기존 격리된 체크아웃을 사용한다.

## 변경 파일과 검증

- `package.json`, `package-lock.json`: 실행·빌드·테스트 명령과 의존성 고정.
- `vite.config.ts`, `tsconfig.json`, `index.html`: 프록시·테스트·타입 검사·진입점.
- `src/main.tsx`, `App.tsx`, `style.css`: 개발 확인 화면.
- `src/App.test.tsx`, `src/test/setup.ts`: 확인 전·정상·통신 실패·HTTP 실패·비정상 상태의 테스트.

2026-10-07 Codex Linux 환경: `npm ci` 성공, `npm test` **5건 통과**, `npm run build` 성공. 화면 테스트의 HTTP 응답은 **모의 검증**이다. 실제 Vite 문서 요청과 Vite 프록시 → Server → MySQL 상태 요청은 HTTP 200/UP 확인. 브라우저의 기본 버튼 동작은 아래 Windows 기록으로 별도 확인했다. 레이아웃·접근성 수동 검증과 제품 기능·Extension 연동은 미검증이다.

## Windows 로컬 검증 결과

검증 기준: `25c4ec75f7d9c506fabace48c2204baf0377f000`. 사용자가 Windows에서 위 `frontend` 디렉터리의 `npm ci`, `npm test`, `npm run build`, `npm run dev`를 실제 실행해 공유한 결과다.

- `npm ci`: 정상 완료, 보고된 취약점 0건.
- `npm test`: 테스트 파일 1개·테스트 **5/5 통과**. HTTP 응답은 모의 검증이다.
- `npm run build`: TypeScript 검사·Vite production build 성공, `dist/` 생성.
- `npm run dev`: `127.0.0.1:5173` 실행 및 브라우저 개발 확인 화면 접속 성공.
- [Server·DB 절차](../backend/README.md)에 따라 MySQL과 Server를 실행한 상태에서 `서버 상태 확인` 버튼 → `정상`. Browser → Web → Server의 실제 통신을 확인했으며, Server의 실제 MySQL 연결은 Backend 검증에서 확인했다.

개발 기반 구축·Windows 검증은 완료했다. 현재 화면은 제품 UI가 아니며 회원가입·사이트 관리·집중 세션·기록·통계 등 제품 기능은 미구현이다. PR #16의 팀 리뷰·develop 병합도 완료했다(merge commit `76df34e`).
