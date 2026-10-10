# EXT-02 회원 사이트 제어 — Windows 사용자 실행 결과

2026-10-10 / 기록 윤종민 / feature/extension-core-ext-02 / 기록 시작 a1f668c2a2079492cb7f78c5a09cea52da505aa3. 기능 EXT-02·SESSION-01/02/04, 기존 사이트 제어/회원 실행 계약. 제품 코드 변경 없이 사용자 화면과 후속 응답을 기록한다. develop 병합 없음.

## 환경·근거 경계

사용자 Windows Chrome 실제 제품 확장 **0.1.6** 화면, localhost Web5173/Server8080, MySQL 연결·Flyway10/Started FocurveApplication 로그를 확인했다. 현재 Chrome/OS 정확한 버전과 실제 로드 소스 SHA·JAR hash는 이번에 대조하지 않았다. 과거 Chrome154/Windows11 기록을 이번 재측정으로 표시하지 않는다. 계정·설치 ID·쿠키·토큰 원문은 문서에 저장하지 않는다.

사용자 직접 실행과 공유한 화면 근거다. Codex가 해당 Windows 브라우저/DB에 직접 접속해 관찰한 것은 아니다. 차단 안내/종료 후 대상 사이트 화면 자체는 미확보이며 **‘전부 됨’**이라는 후속 응답으로 두 실제 사이트 동작을 사용자 PASS로 기록한다.

## 시험 중 장애와 처리

1. 초기 Web은 연결된 설치2개 중 다른 설치를 선택했다. 현재 확장의 LINKED executor를 제한된 필드만 출력해 확인하고 Web 선택을 맞췄다.
2. POST sessions 503의 Response에서 **SNAPSHOT_COMPATIBILITY_REQUIRED**를 확인했다. 전체 wildcard/운영 .env 변경 없이 로컬 Server 프로세스에 gate=true와 해당 executor 하나만 임시 지정했다. 검증 대상 설치의 시험 허용이며 운영 호환성 전체 승인으로 해석하지 않는다. 시험 종료 후 기본 실행 명령으로 되돌려야 한다.
3. 담당 AI가 설치 UUID 한 부분을 잘못 읽어 임시 허용값을 오안내했다. 최신 화면과 대조해 수정했다. JAR 부재는 package로 생성했고 `-DskipTests` 빌드는 테스트 통과가 아니다. Git Bash 줄바꿈 오입력은 단일행 실행으로 바로잡았다.
4. Server 중단/재기동 과정 뒤 확장 **AUTH_RECOVERY_REQUIRED/AUTH_RESPONSE_UNCONFIRMED**, 기존 access의 GET auth/me **401 INVALID_TOKEN**을 확인했다. 원래 네트워크 요청이 처리됐는지/refresh가 사용됐는지 DB receipt로 확인하지 않아 원인 시점은 미확정이다. 이전 refresh 재사용/토큰 원문 공개/전체 storage 삭제를 하지 않았다.
5. 실제 DNR 규칙0과 Web 시작 준비 상태를 확인하고, Web의 정확한 대상 설치 연결 종료로 토큰을 폐기했다. 남은 다른 설치는 유지했다. DevTools 복구 절차는 guest journal·member control 미완료·member 보고 미전송 guard 후 인증 레코드만 REGISTERED(원래 설치 proof/ID 유지)로 바꾸는 일회성 조치였다. 성공 후 사용자 ‘다시 연결됨’을 보고했다. 이 절차는 제품 복구 버튼/자동 회복 구현이 아니다. 기록·설정·별도 IDB/outbox를 삭제하지 않았다.

## 실제 결과

| 항목 | 확보한 근거 | 판정/한계 |
|---|---|---|
| 회원 연결 복구 | 사용자 ‘다시 연결됨’, 이후 popup 회원 연결됨 | 사용자 PASS. 제품 공식 복구 UI는 없음 |
| 회원 1분 시작 | Web 집중 진행 중/00:46/목표1분, 18:14:35 시작·18:15:35 예정; popup 회원 연결됨 | 실제 UI 전환 확인. 별도 명령·APPLIED receipt/규칙 JSON·DB 원본 미확보 |
| 목표 만료 뒤 종료 | 다음 화면 종료 완료·실제 정책 해제 확인, 18:15:49 종료 | 만료 후 종료 UI 확인. 예정 대비14초 지연, 정상 Chrome 30초 주기 검사 영향 가능. 실제 규칙 제거 시각 미측정이므로 정확한 deadline 해제 PASS 아님 |
| 확인 시간 | 1분 시험 결과00:43, 상단0분 | 보수적 체크포인트 집계/미확인 gap 제외 가능성이 있으나 실제 intervals 원문 미확보. 60초 전체 인정이나 정상 시간 집계로 단정하지 않음 |
| 추가 회원 세션·수동 종료 | Web 직접 종료·실제 해제 확인, 18:17:03 시작~18:17:33 종료,00:29 | UI 결과 확인. 추가 시험 지시 duration2분은 요청/명령 원문 미확보라 실제 발급 기간 단정하지 않음 |
| 집중 중 example.com 실제 차단 | 직전 안내 대상 사이트, 후속 질문 ‘FOCURVE 차단 안내가 나왔어?’에 사용자 ‘전부 됨’ | **사용자 실행 PASS**, 차단 화면 원본 미확보 |
| 수동 종료 후 동일 사이트 접속 복원 | ‘종료 후 같은 주소를 다시 열면 정상 접속돼?’와 위 응답 | **사용자 실행 PASS**, 사이트 화면/HTTP 원본 미확보 |
| 접근 기록 | Web 전체접근0·일부수집 | 회원 collector 미연결 경계 유지. 차단 여부를 접근0으로 부정하거나 기록 완료로 올리지 않음 |

popup 상단의 비회원 집중 폼/사이트 차단0은 Guest 설정을 표시한다. 회원 실행은 별도 하단 panel과 Web을 확인해야 한다. 이 표시 혼동은 이번 시험에서 안내로 구분했으며 제품 UX 개선은 별도 작업이다.

## 판정과 다음 행동

**회원 연결→Web 시작/진행→실제 대상 사이트 제한→Web 수동 종료→사이트 접속 복원** 작은 실제 Windows 경로를 사용자 시험 PASS로 갱신한다. 회원 전체 AC 완료가 아니며 자동 만료 정확성·확인 시간·복구·오프라인·장시간 refresh까지 성공으로 확장하지 않는다.

다음 독립 검증: 자동 만료 actual DNR 제거 시각·checkpoint/RUN 원문 대조(1분43초/14초 지연 원인), Worker stop/recreation의 no reapply·동일 타이머, 토큰 정상 refresh와 응답 유실 복구, 브라우저 재시작/절전·오프라인. 회원 Event1.2 수집/미전송 watermark는 후속 구현. 지민·다훈 D06/전체 성공 집계·freeze는 공동 합의 대기, Shorts 제품 연결 미완료. 시험 전용 gate는 테스트 종료 시 제거한다.

이번 변경은 기록뿐. 신규 기능 테스트/Chrome 자동화/Backend·Frontend 재실행 **NOT RUN**. 기존 Extension174/174와 native Worker/IndexedDB PASS는 이전 registry 단계 근거로 구분. 이번에는 문서 경로·diff 검사만 실행한다.
