# FOCURVE Web 개발 기반

React 19.3.0 · TypeScript 5.9.3 · Vite 8.3.3 · Vitest 5.0.3. Node 24.19.0 LTS와 npm을 사용한다. `.nvmrc`, `package.json`, `package-lock.json`이 버전·의존성 기준이다. React+TypeScript는 화면과 API 타입 검증, Vite는 최소 실행·빌드, Vitest+Testing Library는 화면 상태 검증을 위해 선택했다. 실제 설치 버전은 lockfile을 따른다.

기반 커밋 `25c4ec7`의 화면은 **개발 환경 확인용**이었다. 현재 작업공간에는 회원·사이트·세션 요청·기록·통계·테마 화면을 구현 중이며 전체 제품 기능 완료 상태는 아니다. DB 자격정보나 MySQL 드라이버를 Web에 넣지 않는다. Web → HTTP Server → MySQL 경계를 유지한다.

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

위 결과는 기반 커밋 `25c4ec7` 당시의 Windows 검증이다. 기반은 PR #16으로 develop에 병합되었다. 새 제품 화면의 Windows 검증은 별도 미검증이며 아래 기록과 구분한다.

## 이번 필수 MVP Web 구현·검증

- `src/MemberApp.tsx`: 이메일/소셜 가입·로그인·재인증, 사이트 CRUD·정책, 세션 요청/상태/당시 정책, 기록 필터·상세, 통계·오늘/최근7일 현황, 계정·연결.
- `src/api.ts`: 동일 출처 쿠키·CSRF·멱등 키·If-Match. 안전한 GET 또는 멱등 키가 있는 요청에만1/2/4/8/16/30초+지터 재전송을 적용하며 Retry-After를 존중한다.422·단회 인증·설정 부족은 자동 재시도하지 않는다. 실패 후 입력·키를 보존한다.
- `src/ThemeSettings.tsx`, `style.css`: 라이트 기본·다크·로컬 저장. 계정 자료를 지우지 않는다.
- 새 테스트: MemberApp/ThemeSettings/api 테스트. 기존 App health 테스트는 새 회원 화면과 HTTP 응답을 구분한다.
- Linux 자동 테스트20/20 및 TypeScript·Vite 빌드 성공. HTTP/저장 실패 재현은 모의 검증이다. 실제 Linux Chromium·Server·MySQL·개발용 SMTP 검증은 [검토 자료](../docs/implementation/Web_Server_DB_필수MVP_검토.md)에 별도 기록한다.
- 새 화면의 Windows·실제 Extension·원본 Figma 시각적 일치·전체 접근성 검수는 미검증이다. 추가 MVP 화면을 임의로 구현하지 않았다.

실행 명령은 위와 같다. 기존 `.env`를 덮어쓰지 말고 Server 인증 설정만 필요한 키를 추가한다. Mailpit 등 개발 수신기로 검증하는 것과 실제 외부 메일 전달을 구분한다. Windows 절차는 [새 기능 검증 절차](../docs/implementation/Windows_필수MVP_검증.md)를 따른다.

소셜 제공자 미설정 오류는 authorize를 manual redirect로 확인해 현재 화면에서 안내한다. 외부 redirect를 fetch로 따라가지 않는다. 성공 시 원 authorize 경로로 이동하며 probe의 미사용 state는5분 후 만료된다. 실제 제공자 연결은 아직 미검증이다.


## Figma UI 적용
2026-10-08 사용자 지정 원본의 실제 프레임으로 공통 UI를 교체했다. 기능/계약/전체 상태를 구분한 [검증 결과](../docs/implementation/UI_Figma_적용_검증결과_2026-10-08.md)와 [비교 캡처](../docs/implementation/ui-figma-review-20261008/index.html)를 참조한다. API·DB·기존 검증 자료 유지, Git 반영 없음.
