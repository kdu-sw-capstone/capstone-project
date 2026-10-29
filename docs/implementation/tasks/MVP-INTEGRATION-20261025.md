# 필수 MVP 독립 소스·UI·연동 통합

- 기능 범위: AUTH-01~05, DASH-01, SITE-01~05, POLICY-01~03, SESSION-01~04, EVENT-01~04, LOG-01~02, STAT-01~02, SETTING-01~02, EXT-01~03, 선택적 가져오기. 추가 MVP 신규 구현 제외.
- 작업 역할: Codex 독립 통합·검증. 기존 담당 배정 변경 없음.
- 브랜치: `codex/mandatory-mvp-integration-20261025`
- 시작 Git SHA: `90ad32be5d282f3b44c917a29e156dffc5e29187`
- 기준: 현행 작업카드/API/Event/Snapshot 계약, R3 0.1.24, RC5 sender 후보, 독립 HOLD 복구 후보.

## 실제 반영

1. PR17의 회귀·도구와 R3/RC5 Extension 제품 소스를 비교해 수용된 제품 경로를 선택했다. PR21의 추가 제어 전체를 덮어쓰지 않고 R3에 결속된 Shorts 경로를 유지했다. PR22는 읽기 참조만 했다.
2. 검증된 Web 인증·사이트 저장/삭제 확인·가져오기·Snapshot·타이머 직렬화 소스를 보존했다. 팝업에서 Web의 집중/사이트 화면으로 이동하는 허용 목록 URL 계약과 로그인 후 경로 보존을 추가했다.
3. 팝업 브랜드·간격·상태·웹 작업 메뉴를 기본 MVP Figma에 맞췄다. 사이트의 로컬 검색·목적 필터·이름 정렬과 Figma의 정확한 사이트 이미지 8개를 연결했다. 페이지 일부만 조회했을 때 전체 검색으로 오인시키지 않는다.
4. R3 서버의 재현된 소스 및 후속 RECORD/Shorts 수정 3개를 `runtime-server`로 통합했다. develop의 `backend`는 그대로 보존한다. API 중복 등록을 피하기 위해 같은 실행 애플리케이션에 합치지 않는다.
5. 설치 준비 게이트는 명시적 `user-install` 프로필에서만 등록되며, 설치기는 `member-runtime,user-install`을 지정한다. 준비·기한·정상 종료 계약을 유지한다.
6. Java 제품 라우트/서비스/JDBC 경계와 Web가 동일한 공개 응답 fixture를 검증한다. 실제 DB와 회원 인증을 모의 결과로 대체했다고 명시한다.

## 검증과 한계

- Web: 223 테스트, TypeScript/Vite 빌드 PASS.
- Extension: 322 테스트 PASS. 모의 IndexedDB/Chrome API, sender 회귀, 원본·중복 보존, Worker 및 번들 재현 포함.
- runtime-server: 18 테스트 PASS. Servlet 게이트 8, 모의 JDBC/제품 라우트 5, 로컬 시험 SMTP 수신기 5. 외부 Gmail 발송 아님.
- 배포 도구: 이 저장소 경로에 맞춰 59 복구 계약 시험 PASS. 실제 HOLD 복구 아님.
- 서버 소스/클래스: RC5 51개 클래스 누락 없음. 설치 게이트를 제외한 48개는 클래스 바이트 또는 정규화된 명령·서명 비교가 일치한다. 전체 JAR 바이트 동일 주장은 하지 않는다.
- Figma 원본 읽기만 수행. 로그인·설정·회원 팝업·가입·사이트·집중·기록·통계 기본 페이지의 context/screenshot 참조. 인증/다크 숲 이미지 2개는 기존 로컬 asset과 SHA 일치. 사이트 이미지 8개는 공식 asset 그대로 저장했다.
- 실제 브라우저 레이아웃/반응형/렌더 픽셀 검수는 정책 차단으로 미검증. jsdom DOM 검증을 실제 Chrome 결과로 확대하지 않는다.
- 실제 MySQL 통합·새 회원가입/외부 메일·회원/비회원 Chrome START/END·정상 종료/재기동은 이번 후보에서 미실행.

초기 실패: 이전 PR fixture의 비결속 API 주소와 동일 탐색 시각을 현행 계약에 맞게 고쳤다. JDBC가 필요한 develop 시험은 DB 설정이 없어 실패했으며 실제 DB PASS로 취급하지 않는다. 공유 JSON fixture 비교의 Java 숫자 노드 종류 차이는 실제 JSON 직렬화 기준으로 비교해 수정했다. 패키지 초안의 config 인수 누락·점이 포함된 ZIP 파일명 절단은 설치 전에 발견해 초안을 보존하고 수정했다.

## 다음 단계와 승인 경계

STEP04는 공식적으로 허용되는 정확한 독립 프로필 관측과 신규 인증서/설치·고정 실행 기한 승인 이후 진행한다. 현재 URL 정책 차단은 미해결이다. 새 설치를 반복하거나 CDP/다른 도구로 우회하지 않는다.
STEP05 실제 수용, STEP06 실제 정상 종료/재기동, STEP07 Commit/Push/PR, STEP08 CI/리뷰/승인된 Merge/팀 공유는 아직 미완료다.
Git 게시나 보호 환경 변경을 실행하지 않았다. 기존 33/33·99/99는 원래 후보의 증거로 유지하며 이 통합 후보의 실제 수용으로 승격하지 않는다.

## 2026-10-26 제품 자체 기동 계약 조사

Chrome 공식 Native Messaging은 확장과 제품 로컬 실행기 사이의 통신 기능이다. ChatGPT 관측 제공자나 차단된 Extension 문서를 읽는 대체 도구로 사용하지 않는다. 제품 전용 프레이밍·정확한 allowed_origins 등록 계획·설치/프로필/실행 nonce/기한/순서 검증·자체 기동/정상 종료 상태 계약 원형을 작성했다. 관련 신규 22개 및 기존 배포 70개 시험 합계 92/92 PASS는 합성 어댑터 시험이며 실제 Native Host·Chrome·서비스 검증이 아니다.

Windows Native Host 실행 파일, OS 소유권/프로필 검증 어댑터, 사용자 UI/Extension 자체 검사 연결, 설치기 등록/제거 및 실제 통합은 미완료다. 기존 Extension manifest 권한·레지스트리·실제 설치를 변경하지 않았다. 설치형 실행 완료 또는 MVP 수용으로 승격하지 않는다.

## 2026-10-26 Windows Native Link 실제 적용

제품 전용 HELLO 연결만 지원하는 C# Native Host를 실제 EXE로 빌드했다. 설치 ID·확장 ID·현재 사용자 SID·허용 Chrome PID/생성시각/실행경로/프로필 인자를 대조하며, 예상 Chrome 조상 프로세스가 아니면 입력 전에 거절한다. 바인딩 파일 SHA를 EXE에 고정하고 05:40:20 KST 이후 연결을 거절한다. Storage/로컬 안전 데이터·Credential·서비스 명령·START/END는 제공하지 않는다. BrowserBridge와 연결하지 않았으며 도구 정책 우회에 사용하지 않는다.

C# 합성 계약 28/28, 실제 EXE의 비허용 부모 거절 PASS, Extension 관련 신규 15개 포함 337/337 PASS. 새 설치 f87448f781e74090a782a54296b8a4a7에 원본 백업·해시 대조 후 9경로와 무결성 메타데이터를 적용했고 정확한 확장 origin만 허용하는 HKCU 항목 1개를 등록했다. 기존 환경·Extension ID·사용자 데이터는 보존했다. 실제 Chrome Native Messaging 연결은 사용자 재로드와 연결 버튼 입력 대기이며 PASS가 아니다. 서비스 기동과 최종 STEP04 수용은 아직 미완료다.

## 2026-10-26 제품 자체 런타임 실제 검증 중단

사용자 승인 신규 15분 범위에서 사용자 버튼으로 Native Runtime 검증을 시작했으나, 최초 로컬 응답 단계에서 PRODUCT_RUNTIME_UNCONFIRMED로 보존 중단했다. 현재 설치 PRODUCT_HOLD_PRESERVED, launchId 없음, Server 기록 없음, 실패·lock 보존. 실제 Web·Server·MySQL 기동/종료/재기동 수용은 도달하지 않았고 PASS가 아니다.

C#→Python 파이프의 FileStream 소형 응답이 Flush 전까지 전달되지 않는 결함을 독립 자식 프로세스에서 재현했고, 매 전송 Flush로 바꾼 생산 코드 전달 함수를 같은 시험에서 통과했다. 102 배포 시험·28 C# 계약 유지. 최초 상세 예외가 없어 실제 중단과 동일 원인 확정은 하지 않는다. 향후 실패에는 타임아웃 코드·예외 종류·단계를 비밀값 없이 보존하도록 수정했다. 수정은 독립 소스에만 반영했고 실패 설치·Chrome·HOLD·lock·기존 실패 자료는 변경하지 않았다. 새 안전 실행과 실제 수용은 별도 유효 범위에서 검증해야 한다.

## 2026-10-26 수정 Native 실제 실행과 DB 비교 결함

새 설치 c64b8b5c81e740daab94664f3e4806cb에서 사용자 실행으로 Web·Server Health UP, 독립 MySQL, 제품 내부 안전 검사 후 데이터 비교 단계에 도달했다. PRODUCT_SCHEMA_UNCONFIRMED로 HOLD 보존 중단. root-client.ini는 기본 DB를 선택하지 않는데 비교 코드가 DATABASE()에 의존해 빈 테이블 목록을 받은 결함이었다. 실제 읽기 전용 진단에서 기본 DB null·대상 스키마 1개·테이블 32개를 확인했다. 설치 ID에 결속된 스키마 명시·테이블명 검증·정규화된 COUNT 조회로 수정하고 107 배포 계약 및 실제 해당 DB 읽기 검증 PASS.

소유 프로세스 신원·시작 차단·DB 세션/잠금/Receipt 0 확인 후 승인 범위에서 Server·MySQL만 정상 종료했다. 데이터·Chrome·로컬 상태·HOLD·원본 실패·lock 보존. 새로운 로컬 종료 조회는 수행하지 않아 전체 제품 정상 종료 PASS로 승격하지 않는다. 재기동/전체 데이터 보존 수용은 미도달. 실패 설치에 수정 적용·재실행·복구는 하지 않았다.

## 2026-10-26 DB 비교 결함 복구 조건 검증

사용자 연속 해결 지시에 따라 c64b8b5c81e740daab94664f3e4806cb의 설치 상태·최초 실패·lock·수정 대상·native 결속 원본 9개를 설치 외부에 복사하고 SHA-256 일치를 확인했다. DB·Credential·프로필은 복사하거나 변경하지 않았다.

별도 schema_recovery_gate.py는 확인된 PRODUCT_SCHEMA_UNCONFIRMED 원인에 한해 설치/실행/원본/수정본 해시, 독립 원인 증거, 15분 이내 신규 승인, 30초 이내 현재 제품 로컬·독립 DB 관측, 이전 서비스 종료, STOP/중복 실행 부재를 요구한다. 오래된 stage 표식만으로 원인을 분류하지 않는다. 읽기 전용 사전 조건 검증이며 실행기·복구 실행 기능이나 실제 관측 제공자가 아니다. 외부 JSON을 실제 관측으로 받는 진입점은 없다.

배포 단위·계약·회귀 115/115 PASS. 기존 설치 복구/패치/재로드·서비스 재기동은 미실행. 지난 실제 기한 2026-10-26 06:28:07 KST는 만료됐다. 실패 설치 PRODUCT_HOLD_PRESERVED 및 lock은 그대로다. 제품 자체 복구 실행 연결과 사용자 신뢰 클릭이 필요한 현재 경로를 자동으로 대신 수행할 수 없다. 도구 정책 차단을 Native Messaging·CDP·다른 도구로 우회하지 않는다. 신규 실제 실행 전에 이 연결의 검증 및 고정된 새 실행 범위가 필요하다. 실제 정상 종료/재기동·DB 보존 수용은 아직 미완료이고 MVP_FINAL_COMPLETE=false.

## 2026-10-26 STEP04 제품 연결 설치 통합

현재 통합 브랜치에서 기존 R3/CDP 기동기는 관측 정책 때문에 재사용하지 않았다. 새 관측 제공자나 복구 시스템을 추가하지 않고, 실제 서비스 기동까지 도달한 Native Messaging 경로의 등록 기능을 distribution/installer/native_setup.py로 옮겼다. scripts/provision-native-runtime.py는 같은 구현을 호출하는 호환 진입점이다.

새 설치는 Connect-FOCURVE.cmd와 install_core.py connect 명령으로 전용 일반 Chrome 실행 및 현재 사용자 HKCU의 정확한 Extension Origin 1개 호스트 등록을 준비한다. 설치/프로필/프로세스 결속, 변경 전 재검사, 원본 백업, 파일 해시, 중복 실행 잠금, RAM3GiB, 고정 최대15분, STOP 및 실패 보존 조건을 유지한다. 정상 HELLO 재연결은 가능하지만 실패한 제품 검증은 자동 재전송하지 않는다. 기존 HOLD 설치는 이 경로에서 거절한다.

배포 시험 125/125 및 관련 Extension 회귀31/31 PASS. ZIP 102bb035140502faf2a362b6a250cb1f93f01ee4230b939f91c8918e36cb8e7b, Manifest4393/ZIP4394파일 해시와 필수15구성 확인 PASS. 단위/패키지 검증은 실제 STEP04 수용이 아니다.

사용자가 새 설치·인증서·Native Host 등록·Chrome1개·독립DB 기동/종료/재기동(전체30분, 제품검증15분, START/END없음)을 승인했다. 새 실제 설치 ID92e060800e17485b9c29d4652e9691bb 생성, 종료상한2026-10-26 07:17:02 KST. 최초 실행 전 증거는 outputs/focurve-mvp-integration-20261025/step04-native-actual-20261026에 기록한다. 기존 c64/f874 HOLD·UNKNOWN·Default/Profile2·운영DB·SMTP·R3원본은 변경하지 않는다. 실제 종료/재기동 성공은 아직 기록하지 않는다.

## 2026-10-26 STEP04 실제 Native 서비스 왕복 완료

새92e060800e17485b9c29d4652e9691bb/kbhkglmhbgodlpcefggphdcaakpehkcm 설치에서 사용자가 제품 검증 버튼을 직접 실행했다. 실제첫실행 e0e2588e8a1740e89dceb2700ba23006의 정상 STOPPED를 관측했고, 두번째실행9989a7989f82442a8b12cbca5f7024c0 재기동 및 최종STOPPED/성공lock해제/실패파일없음을 확인했다. 마지막Server PID6536·MySQL PID33596 종료 확인. 설치payload와Native runtimeFiles 해시 일치. 제품은 각 기동/종료 시 자체 로컬·DB 안전을 검사하고, 전후 스키마/행 수 비교가 같아야 성공lock을 해제한다. Chrome 문서/Storage를 도구로 조회하거나 정책을 우회하지 않았다.

실제 서비스 왕복·Native 연결·스키마/행 수 보존 범위 PASS. 모든 사용자 레코드 내용 보존은 미검증. 집중 admission은 끝까지CLOSED, START/END·회원·비회원 실제 수용은 이번 승인에서 제외되어 미실행. 물리청취PENDING, 기존 프로필적용BLOCKED, MVP_FINAL_COMPLETE=false. 구체 증거 ACTUAL-RESULT.json. 기존c64 원본보존9파일SHA 일치.

진행 중 새설치 Native 등록 후 무결성 목록에 루트CMD4개가 누락된 오류 발견. source native_setup.py의 잘못된 한 줄을 launcher_payload 함수로 수정했고 관련회귀포함127/127 PASS. 새설치는 원본백업의4개파일SHA와 기존모든payloadSHA/등록/프로세스신원을 대조한 메타데이터완결만 수행했다. 상태변경·등록재실행·코드교체·Extension재로드·서비스재시도는 하지 않았다. 최초오류·부분등록원본·setup lock 보존. 현재배포검토ZIP은 이 누락코드가 포함돼 재설치/배포용으로 재사용하지 않으며, 수정source의 최종패키징은 이후수용범위와 함께 확정해야 한다.

## 2026-10-26 STEP05 정상 사용 모드

사용자 STEP05~06 승인에 따라 새 실행 범위07:18:31~08:18:31 KST를 별도로 기록했다. 이전 기한은 연장하지 않았다. 현재 설치92e060800e17485b9c29d4652e9691bb의 ID/프로필/DB/SMTP를 유지한18경로 업데이트 후 사용자 재로드1회·서비스시작 입력으로 PRODUCT_RUNNING_USER_SESSION/READY 생성·시작 차단 해제를 실제 확인했다. launch385634c960884082b851de33936c7757, 실제launch상한08:17:56 KST. 자동 START/END와 AI 브라우저 관측 경로는 제공하지 않았다. 사용자 입력은 정상 제품 UI에서만 수행한다.

서비스모드 준비/개방/정상종료, Worker 재생성 시 현재metadata+저장READY 대조, 팝업 현재launch 재검사, 스키마/행수 대신 지정된 세션/접근/구간 필드의 서버측 SHA256 비교를 구현했다. 인증/토큰테이블은 비교하지 않는다. MySQL 새조회 준비에서 과거r.launchDeadline을 잘못 전달한 운영스크립트 오류를 보존했고, 기존 설치메타데이터를 변경하지 않은 새조회Operation으로 같은소유DB 프로세스에서 조회/0세션0잠금0Receipt/정상종료를 확인했다. 현재 DB3테이블은 비어 있어 실제 사용자 기록 보존은 아직PASS가 아니다.

SMTP입력 전 살아있는Chrome을 불필요하게 요구한 스크립트는 입력전에 종료됐다. 비밀파일이 최초설치시각 그대로임을 확인하고 오프라인설정으로 수정했다. 사용자가 이번설치에 직접입력한 값만 DPAPI저장했고 이전설치Secret은 읽거나 복사하지 않았다. 사용자는 실제6자리회원가입메일수신을 보고했다. 인증번호는 보고서에 저장하지 않았다. 가입/로그인/회원연결/집중수용은 아직대기다.

사용자스크린샷에서 비밀번호재설정메일 설정오류를 추가확인했다. 가입메일은직접MAIL_*어댑터를쓰지만 재설정Outbox는 JavaMailSender와member.mail.from을 요구하는 설정불일치였다. 독립source.server_env에동일SMTP의SPRING_MAIL_*/MEMBER_MAIL_FROM 및보안속성바인딩을추가했다. Spring Boot 실제AutoConfiguration 문맥시험4/4와배포156/156 PASS. 실행중설치는수정하지않았으며정상종료후반영대기다. 비밀번호변경·실제인증복구는실행하지않았다.

Extension364/364, Native35합성계약PASS. 사용자용로그인/재설정화면은사용자제공이미지로확인했지만이를회원/비회원전체수용PASS로승격하지않았다. STEP05/06미완료, 최종릴리스/Push/PR/Merge미실행, MVP_FINAL_COMPLETE=false.

### STEP05 이메일 수신 판정 정정

사용자가 앞서 받은6자리는비밀번호설정과정의번호였다고명확히정정했다. 앞선FOCURVE가입메일수신추정은폐기한다. 실제회원가입인증메일요청은MAIL_UNAVAILABLE로실패했다. 프로그램이보호설정으로SMTP연결을1회확인한결과네트워크/TLS1.3 PASS, SMTP AUTH535거절이다. 비밀번호/서버상세응답/인증번호를출력하거나저장하지않았다. 추가인증재시도나메일발송은하지않았고새앱비밀번호사용자조작대기다. 회원가입/로그인/회원집중PASS가아니다.

재설정메일Outbox설정불일치는별도독립원인으로유지한다. source.mail환경바인딩수정은Spring실제문맥4개/배포156개시험으로검증했지만실행중설치에는아직미반영이다. 재설정화면에서가입실패처럼표현한공용메일오류문구를중립적인요청실패안내로수정하고관련Web22개시험PASS. 현재서비스를사용자정상종료한후적용할예정이며인증복구나사용자비밀번호변경은실행하지않았다.

## 2026-10-26 STEP05 보존 종료 및 집중 수정

사용자 승인 backend-only 범위에서 설치92e060800e17485b9c29d4652e9691bb의 Server22620·MySQL35972와 하위35508 종료 및 포트28455/28456 수신 부재를07:54 KST 확인했다. 종료 직전 집중세션·잠금·미처리Receipt·대기메일0. HOLD·최초실패·lock·설치설정·보호SMTP 파일은 보존했다. 종료 전 관측 모듈 import가 만든 __pycache__1개도 삭제하지 않고 별도 기록했다. 현재 로컬 상태는 미확인이며 전체 제품 안전 종료/최종 수용으로 승격하지 않는다.

07:56 KST 사용자90분 자율 수정 지시를 시작했다. 현재 브랜치/기준SHA를 유지하고 기존 설치에 적용·재로드·재기동·복구하지 않은 채 독립 소스만 수정했다. 도구 정책과 제품 Native 연결은 별개로 유지하며 새 관측 경로·CDP·집중 명령 endpoint를 추가하지 않았다.

확인된 과거 실패는 EXTENSION_QUIESCE의 PRODUCT_CHANNEL_CLOSED다. 당시 직접 종료 계기는 로그 부족으로 미확정이다. 읽기 종료를 모두 같은 오류로 뭉치던 Channel을 EOF/헤더/본문/JSON/IO/타임아웃으로 나눴고 비밀 프레임·예외 원문은 기록하지 않는다. C# 상위 입력 예외에도 자식stdin을닫아 단절을전달한다. 실제Windows자식에서부모입력이열린채main이끝날때기존bufferedstdin reader daemon이0xC0000005를일으키는것을재현했고 전용unbuffered복제핸들/부분프레임조립후정상종료0을확인했다. 과거실패와동일원인으로단정하지않는다.

제어 탭 beforeunload 경고·종료 접수 STOPPING 안내를 추가했다. 닫기를 END/서비스종료로 처리하지 않으며 COMPLETE 확인 전 완료 문구를 표시하지 않는다. 중복 제어창은 기존 실행을 실패로 만들지 않고 새 요청만 거절한다. 정상 사용 READY가 정상 종료 후에도 남아 재기동을 막는 결함을 수정 전 시험으로 확인하고, 로컬/DB 안전·Server/MySQL종료 후 동일launch의READY만제거하도록고쳤다. UNKNOWN/단절/다른launch 표식은보존한다.

신규 설치의 Native 사용 모드·최대60분 명시적 승인 경로를 설치기에 연결했다. 정상 STOPPED의 새 실행 범위는 기존 session_update 계약을재사용하며 재설치/DB/SMTP변경없이 프로그램설정만백업·검증한다. 이전정상종료증거는자격일뿐현재안전PASS가아니고실제기동시새로조회한다. HOLD는거절한다. 임시합성설치에서실제C#컴파일·비Chrome부모거절·백업·해시검증을실행했으며실제Chrome재연결은미검증이다.

SMTP535 원본은 보존했다. 신규Gmail입력의표시공백제거·16자리형식·숨김입력불가시거절만추가하며기존보호값을재정규화/복사하지않는다. 새앱비밀번호는아직미입력/미인증이다. 기존메일어댑터와SpringOutbox바인딩수정및중립적인메일실패Web문구를포함한다. 일반Web빌드의설치자리표시자누락으로패키징이중단된증거를보존하고, 설치전용고정빌드와BUILD-CONTRACT/실제HTML·JS해시검사로수정했다.

결과: 배포187/187, Extension374/374·구문, C#38/38, 실제Windows파이프1건, 패키지Python채널5/5, Web설치빌드·Server패키징·실제빌드자산의합성설치결속PASS. Spring메일4/4와기존완료증거재사용. 검토ZIP63845ed48044ab1b816452a99095ab67e713958acb144c13d149ae0a478d65a3/Manifest4398·ZIP4399·필수20구성PASS. 별도새릴리스번호/실행기/Worktree를늘리지않았다. 최종설치신원/주소결속·실제Chrome·메일수신·회원/비회원START/RUNNING/END·채워진기록재기동은미검증이다.

STEP05는새실행승인/사용자입력대기, STEP06은자동검증완료·실제수용대기, STEP07은로컬Draft/소스정리·게시승인대기, STEP08은인계초안만준비했다. Commit/Push/PR/Merge/팀메시지는미실행. 기존HOLD보호파일해시6개일치·Gitstaged없음·제품소스알려진비밀키패턴검사0건. 물리청취PENDING·기존Default/Profile2BLOCKED·MVP_FINAL_COMPLETE=false. 추가기능개발이나과거Chrome정책경로재시도를하지않았다.

## 2026-10-26 새 제한 실행 실제 기동·인증 수용

입력 전 만료된 첫 범위는 대상 설치0개이며 그대로 보존했다. 사용자 새60분 승인으로 별도 작업 기록과11:05:31 KST 상한을 고정했다. SHA63845… 검증 패키지를 변경하지 않고 설치b3d6…/Extension dkdk…/HTTPS29511/독립MySQL29512를 생성했다. 인증서는 새 지문1개가CurrentUser My/Root에 존재하며 발급자/기간/제거 절차를 비밀없이 기록했다. 설치·최초DB초기안전/정상정지·Native등록 후 사용자가 확장을 최초 로드하고 서비스 시작을 직접 실행했다. 실제Chrome/Server/MySQL 소유권 일치와ServerHealthUP, 제품의초기사전검사통과를확인했다. 임의설치교체·확장재로드·기존HOLD변경없음.

새SMTP앱비밀번호는사용자가숨김입력했고이전보호값을읽거나복사하지않았다. 실제Web이메일코드 verified/consumed1·회원생성1·회원연결설치1과사용자제공회원연결/대기팝업이미지를확인했다. 인증번호·비밀번호·토큰·원문payload는도구/로그에출력하지않았다. 이전SMTP535증거는보존하며새설치메일성공과구분한다. 실제비밀번호재설정·외부OAuth를재시험하거나완료로승격하지않는다.

10:36 KST까지집중세션/잠금/미해소Receipt0건. 설정된정책2건은계획3건과달라아직START하지않았다. 기록사이트누락·YouTube호스트/하위도메인범위수정은정상UI입력대기다. 초기안전PASS나계정연결PASS를집중수용PASS로표시하지않았다. 실행중코드수정·재로드·SQL정책쓰기·브라우저관측우회없음. 원격게시없이Git인계/문서정리만병행했고, source CI/설치안내의잘못된실행경로·빌드명령·근거파일참조를정정했다. 승인된ZIP과현재설치에는이문서정정을적용하지않았다. MVP_FINAL_COMPLETE=false.


## 2026-10-26 회원 시작 오류 보존·안내 결함 최소 수정

신규설치 b3d6…의 실제회원가입·메일코드소비·회원연결 PASS는 재사용한다. 10:48 KST 읽기전용확인에서 www.youtube.com/ALLOW/Shorts/정확호스트, example.com/BLOCK, example.org/RECORD의3정책을확인했다. 예제2사이트의하위도메인옵션은켜진채이며이번시험대상은정확한두호스트로제한했다.

사용자는웹집중관리에서3분으로입력하고시작했으나일반요청실패안내를보고했다. 10:53 KST 실제DB세션·command·report·잠금·미처리Receipt0, HealthUP. 실제클릭시각·요청HTTP오류코드는미관측이며로컬상태를DB0으로대체판정하지않는다. 실제RUNNING은미확인, END/Cleanup/복구/재시도/재로드0. 기존실행상한11:05:31KST와제품자체종료예비시간을유지한다.

독립소스 api.ts에기존 INSTALLATION_START_WINDOW_CLOSED의사용자용안내매핑만추가했다. 기존세이프티gate·인증·기한·재전송로직은유지한다. UserErrorPresentation 기존시험에안내/HTTP409와code·retryable=false보존/START1회전송검증2건추가, 수정전신규2FAIL·기존3PASS/수정후api회귀포함15/15PASS. 별도원본로그파일없이실행도구출력과 START-ERROR-PRESENTATION-FIX.json에결과와정확한파일SHA를보존했다. 실행중설치·승인ZIP·Extension코드는변경하지않았고이번실패가시간거절이라고단정하지않는다. 실제수용·최종릴리스·Git게시미완료, MVP_FINAL_COMPLETE=false.

11:00:40KST 기존 product자체종료예비절차의STOPPED·소유Server/MySQL프로세스부재를관측했다. 11:01KST포트29511/29512수신0·최초failure없음·runtime.lock/READY해제·admission.CLOSED·정상종료증거파일존재를확인했다. 로컬안전원문은도구로읽지않았으며제품자체현재검사통과후정상종료경로의결과로한정한다. Chrome/계정/정책/DB/보호SMTP보존, 실제집중수용/재기동된채워진기록보존은미검증. 같은설치의공식정상STOPPED신규범위준비경로는있지만새명시승인전기동하지않는다.


## 2026-10-26 동일설치 새30분 실제기동 중단·종료후조회 결함 수정

새사용자승인 범위11:05:08~11:35:08KST를독립기록했다. 기존b3d6… 정상STOPPED/Server·MySQL종료/설치payload검증후같은설치의공식갱신을실행했다. 확장ID·프로필·계정·DB·SMTP·인증서는유지했고새설치/비밀번호입력/확장재로드없음. 보호설정7경로와이전종료증거SHA보존을확인했다.

사용자가서비스준비를보고했지만실제11:09:32KST Native기동은최초 EXTENSION_CHECK_LOCAL/PRODUCT_LOCAL_NOT_CLEAR에서HOLD보존중단됐다. Server/MySQL미기동·현재DB미조회이며과거0을현재로재사용하지않는다. 사용자제품읽기전용조회결과 R4_GUEST_LOCAL_SAFETY_1/UNKNOWN/GUEST_OBSERVATION_UNCONFIRMED/counts:null/identity.installation:false를보존했다. 이것만으로로그아웃·설치충돌·0의무를확정하지않는다. START/END/Cleanup/복구/재시도0, 실패·lock·Chrome보존.

독립실제MemberAuth클래스+제품WebBridge VM시험에서서비스QUIESCE이후CONNECT/WAKE가인증갱신을시도하고오프라인응답실패로AUTH_RECOVERY_REQUIRED로바꾸는결함을재현했다(수정전3FAIL/2PASS). user-admission.withServices는현재READY/동일launch/미만료를기존lock하에검증하고진행중조회가끝나야QUIESCE가완료된다. Web의인증상태조회/actor조회, Worker초기·주기poll만연결했다. START/END권한·기한·신원·UNKNOWN/응답유실보존계약은완화하지않았다. 수정후관련48/48·Extension384/384·JavaScript구문·diff검사PASS. 최초bootstrap시험의getManifest fixture누락2실패도로그보존후fixture만보완했다.

수정runtime3파일·시험2파일SHA는 same-install-30min-20261026/LIFECYCLE-FIX-MANIFEST.json에기록했다. 현재HOLD/승인ZIP에는미적용이며이번실패와동일원인으로자동확정하지않았다. 이미보존된인증상태를소급복구하지않고새실제Chrome수용도미검증이다. STEP05/06실제수용·최종릴리스·Git게시미완료, MVP_FINAL_COMPLETE=false.


## 2026-10-26 두실패 직접원인 조사·최소진단계측

기존독립Server원본로그(62103bytes/SHA10d3f4…f233a)에서696HTTP감사기록을읽기전용분석했다. POST/sessions기록0, 세션조회모두200이며오류로그는초기인증401/비활성소셜503/사이트검증422다. 원감사필터가UserInstallGate뒤에있어게이트거절은로그에남지않으며시각·requestID·거절코드도없음을확인했다. 따라서10:49~10:52 START의실제클릭시각·HTTP거절코드는여전히미확정이고시간게이트거절로단정하지않는다. 기존Launcher의Chrome stderr에서는허용된제품오류표식이없었으며브라우저연결·페이지·프로필·Storage를조회하지않았다.

재기동최초Native실패는11:09:32KST EXTENSION_CHECK_LOCAL/PRODUCT_LOCAL_NOT_CLEAR, 서비스미기동이다. 사용자후속읽기전용결과는Guest UNKNOWN/일반관측오류/counts:null이지만예외를일괄치환해세부조건이소실됐다. 그파일의receivedUTC는저장시각이며원조회시각이나Native실패시각을소급확정하지않는다. 두사건의공통직접원인은미입증이고기존종료후인증갱신결함과의인과도미확정이다.

같은통합소스에서감사필터를게이트앞에배치하고서버발급요청ID/UTC시각/기존거절코드만추가했다. UserInstallGate조건·409본문·권한검사는유지한다. Guest읽기전용조회는기존UNKNOWN/counts:null을유지하면서고정목록의failureStage/issue만보존하도록했다. 동일기록누락조건의수정전실패·수정후정확한이유출력·비밀값비출력·읽기전용회귀를확인했다. 이는진단누락수정이며과거실행오류해결/실제START완주로승격하지않는다. 현재HOLD·데이터·서비스·인증상태·승인ZIP에는미적용이다.

기존설치내읽기전용화면 guest-reader.js1파일만최대10분임시교체→사용자1회조회→조건부원본복원하는정확한SHA계획을작성했다. 설치기·새환경·Worker재로드·서비스·START/END·HOLD복구는포함하지않고상태파일/무결성목록은손대지않는다. 기존HOLD파일변경금지지시에대한명시적예외승인전에는실행하지않는다. 상세근거/수정파일SHA/남은차단은 START-UNKNOWN-CAUSE-DECISION.json, DIAGNOSTIC-ONE-FILE-PREVIEW.json. MVP_FINAL_COMPLETE=false, Git게시미실행.


## 2026-10-26 AUTH_STATE 원인 분류 보완 — 기존 설치 미변경

승인된 임시 조회는 AUTH_TRANSITION_OR_MEMBER_STATE/AUTH_STATE를 반환했고 11:59:21KST 정확한 원본 복원·HOLD/최초실패/설치Manifest 보존을 확인했다. 실제 phase·세부 거절조건·과거 START와의 인과는 여전히 미관측이다. 설치신원불일치나 DB손상으로 확정하지 않는다. 정상 LINKED는 회원 reader, 나머지는 보수적 guest reader로 분기하므로 회원연결 자체 충돌로 단정하지 않는다.

현재 통합 소스의 guest-reader 1파일에 허용목록 phase/분류/거절조건/오류분류/만료구간만 출력하는 진단을 추가했다. 원래 3개 허용·거절식은 정확 비교로 동일하며 토큰/소유자ID/주소/원시 오류는 출력하지 않는다. 실제 MemberAuth+메모리 fixture의 만료토큰 갱신응답유실→AUTH_RECOVERY_REQUIRED→guest AUTH_STATE UNKNOWN을 재현했으나 실제 설치 원인으로 승격하지 않는다. 기존 종료후 polling fence 수정은 유지하고 인증상태·갱신 계약을 변경하지 않았다. 관련42시험·구문검사PASS, 현재설치/DB/인증/서비스미변경, 실제START/END미실행. 상세 SHA/증거는 AUTH-STATE-CAUSE-REVIEW.json. 추가 실제 관측에는 기존 HOLD 변경금지의 별도 1파일 한시 예외가 필요하며 이전 승인은 재사용하지 않는다. MVP_FINAL_COMPLETE=false.


## 2026-10-26 실제 AUTH_STATE 세부조건 확인·원복 완료

사용자 새 1파일 예외 승인으로 13:02:30KST guest-reader만 임시 적용, 사용자 1회 조회에서 실제 AUTH_RECOVERY_REQUIRED/UNCONFIRMED/AUTH_RESPONSE_UNCONFIRMED/EXPIRED와 PHASE_NOT_GUEST·MEMBER_OWNER_PRESENT·MEMBER_TOKEN_PRESENT·ERROR_PRESENT를 확인했다. 회원 소유권·토큰이 남은 인증 응답 미확정 상태이므로 guest 안전검사의 UNKNOWN은 올바른 거절이며 정상 비회원으로 처리하지 않는다. 13:04:27KST 정확한 원본 SHA c1bdc0…c5d9 복원·전체설치payload PASS·HOLD/최초실패 불변을 확인했다. 서비스·인증갱신·복구·재로드·START/END는 실행하지 않았다.

기존 실제 MemberAuth 클래스의 만료토큰 갱신 응답 유실 재현에 이번 관측의 정확한 4거절조건 assertion을 추가해 관련42/42PASS를 확인했다. 종료후 조회 갱신 fence 수정은 이미 통합소스에 있으며 중복 구현하지 않았다. 다만 실제 상태 전이를 일으킨 요청/시각은 원로그에 없으므로 종료후 갱신이 실제 원인이라고 소급확정하지 않는다. 이전 START 실패와의 인과도 미입증이다. 현재 HOLD/auth 상태 복구나 현재 DB 안전 확정 없이 실제 수용 재개 불가. USER-AUTH-STATE-EXACT-OBSERVATION.json 및 AUTH-STATE-CAUSE-REVIEW.json에 세부 증거·SHA 보존, MVP_FINAL_COMPLETE=false.


## 2026-10-26 회원 인증 복구 경로 확인·정기조회 잔여 누락 수정

SameOwnerRecovery/복구 Worker/Server 구현은 있으나 SAME_OWNER_RECOVERY_1_CANDIDATE 독립 opt-in이며 기본 비활성이다. Worker에는 로드되지만 일반 사용자 popup에는 복구 조작이 없고 개발화면에만 있다. 일반 credentials는 LINKED만 허용하므로 AUTH_RECOVERY_REQUIRED의 미확정 refresh 토큰을 재전송해서는 안 된다. 후보는 동일 owner/executor/authority·새 PKCE·설치 proof/callback·로컬 의무0·Server 현재 owner/auth_version/잠금·동일회원 Web 승인·새 토큰/최종 owner 검증을 요구한다.

현재 PRODUCT_HOLD는 기존 ACCEPTANCE_HOLD 전용 복구 분류 대상이 아니며, 만료 인증은 기존 local-clear를 통과할 수 없고 local-clear 전에 Server를 열 수도 없다. 검증된 인증복구 전용 기동 계약이 없어 현재 설치에 즉시 적용 불가, 단순 승인/설정ON/재로그인으로 해소됐다고 처리하지 않는다. 기존 로그의 refresh200 2건은 성공 서버 응답이며 유실된 요청/시각을 특정할 수 없다. 이전START와의 인과도 미입증이다.

추가로 member-ui/runtime.js의 30초 정기알람이 기존 withServices를 우회해 종료후 실제 MemberAuth 갱신을 시도하는 잔여 코드 결함을 독립재현했다. 수정전 신규2FAIL·open 동작PASS. runtime1파일에 기존 service/QUIESCE fence 연결 및 admission 부재 거절만 추가했다. 수정후 관련 lifecycle/admission/popup/product-fence55/55·구문검사PASS. 기존 안전검사·토큰회전·같은회원 검증·HOLD 복구는 변경하지 않았다. 현재 설치/DB/인증/서비스/START·END 미실행, Git index·게시 미변경. 소스/시험 SHA와 정확한 차단은 MEMBER-AUTH-RECOVERY-PATH-DECISION.json. MVP_FINAL_COMPLETE=false.


## 2026-10-26 회원 재인증 제품 연결 구현·독립 검증

기존 PKCE actor를 사용자 popup의 회원 재연결/웹승인확인에 연결했다. 서버는 GET /api/v1/install/auth-recovery에서 설치 proof·동일 executor/member/Origin/callback·현재 전용 schema/세션/잠금/Receipt를 검증한다. 기본 전역 복구스위치만으로는 허용되지 않으며 설치경로의 SHA고정·최대20분·작업ID 결속 범위가 필요하다. 정상 service READY 없이 재인증만 진행할 수 있지만 START/END·정책 변경·불확정 refresh 재전송은 차단한다. 예전 작업의 링크증명은 새 작업에서 소비할 수 없도록 서버 seal에 operation_id를 결속했다.

로컬 관측은 기존 schema/project를 재사용한 재인증 전용 projection으로 제한했다. 기존 비회원 reader는 변경하지 않았다. 알 수 없는 DB/schema·다른 설치·미해소 Binding/Journal/Lease/Outbox/DNR은 거절한다. 미승인 Web은 PENDING 유지, 확인 클릭 전 토큰교환0, 승인 후 단1회교환, 소유권 불일치/응답유실은 AUTH_RECOVERY_REQUIRED 및 기존자료 보존이다. 인증 성공만으로 HOLD나 집중 준비 상태를 바꾸지 않는다.

현재 통합후보에서 관련 Extension85/85, Server계약20/20 및 JAR빌드, 복구환경·권한종료7/7 PASS. 팝업 DOM/JSDOM·fake-indexeddb 실제 schema의 기록/정책 전후 보존은 독립 자동 검증이며 실제Chrome/실제DB 재인증으로 승격하지 않는다. 설치기에는 별도 승인 DB기동 이후 현재 안전을 다시 검사하는 recovery_server_env와 권한파일을 증거로 보존하며 닫는 close_recovery_scope만 연결했다. 이 함수들은 프로세스기동·HOLD수정·READY생성·START/END를 수행하지 않는다. 기존 일반서비스 기동을 HOLD복구 우회로 사용하지 않는다.

실제 적용은 설치대상/원본 SHA/백업/무결성 및 Native 결속 갱신, 확장재로드, 새 최대20분 DB·Server 인증복구 전용 범위가 별도 승인돼야 한다. 현재 HOLD/인증/DB/Credential/Default/Profile2/R3 원본·Git index는 변경하지 않았다. 과거START와의 인과미확정, 실제최종수용미완료. AUTH-RECOVERY-IMPLEMENTATION-MANIFEST.json 및 AUTH-RECOVERY-PRODUCT-CONNECTION-RESULT.json 참조. MVP_FINAL_COMPLETE=false.


## 2026-10-26 동일 설치 실제 회원 재인증 PASS·안전 종료

사용자 승인으로 기존 b3d6…/확장 dkdk…/전용 profile/API29511/독립DB29512 원본과 수정 해시를 대조·백업 후 Extension10파일(기존종료fence3포함)+ServerJAR1 및 installation payload 해시만 적용했다. 다른 상태필드는 원본과 동일하고 Native등록/인증서/SMTP비밀/원실패기록/기존product lock은 유지했다. 사용자확장재로드1회, 새20분 operation fa232… 범위14:20:47~14:40:47KST로 제한했다.

기동 준비의 기본DB 미선택 SQL1046과 MySQL 수신자식PID 대조를 실제증거로 해결했다. MySQL은 재시작하지 않았고 부모44680/직계수신자식16092/실행경로/전용datadir를 확인했으며 원기한을 유지했다. 현재 DB회원1/기존executor-owner결속/세션0·잠금0·Receipt0·대기메일0 확인 후 복구전용ServerUP. 초기PKCE는로그인중만료되어미소비로보존, 새PKCE는같은범위에서사용자가Web승인과확장확인을실행했다. 14:36:50KST claim/token발급/auth-me200, 현재토큰행3→4·활성토큰1·소비링크1→2·같은회원1/executor de95… 유지. 사용자사진의회원연결됨과서버/DB증거가일치했다.

14:37:47복구권한폐쇄후소유Server/MySQL을14:38:03KST정상종료,포트해제·기한내완료. 사용자14:38:24KST사후직접조회 R3_LOCAL_SAFETY_2/CLEAR_LOCAL_ONLY/모든10의무0/4신원true/필수5·관측7DB/리소스0 확인. 기록·정책등업무자료의DB내내용해시를전후비교해일치했다. 기존HOLD는PRODUCT_HOLD_PRESERVED그대로이며START/END/Cleanup/인증복구명목HOLD해제0이다. 현재재인증수용PASS이나정식HOLD전이·새정상기동승인·실제집중START완주는미완료, MVP_FINAL_COMPLETE=false. 상세변경SHA·실제증거·종료판정은 reauth-actual/FINAL-RESULT.json 및 ACTUAL-APPLY-MANIFEST.json.


### 2026-10-27 PRODUCT_CHANNEL_CLOSED 동일 설치 경로 (실제 적용 전)

- 기능: EXT/SESSION 설치 수명주기. 기존 담당 배정 유지, 통합 브랜치 codex/mandatory-mvp-integration-20261025, 시작 HEAD 90ad32be5d282f3b44c917a29e156dffc5e29187. 사용자 최신 지시의 READY 후 EOF 정식 재개 계약을 기존 ProductHoldRecovery/Native 경로에 한정 추가했다. 5초 재검증·인증·sender·정책 소유권 계약은 유지한다.
- 기준: AGENTS.md, 개발운영.md, 통합현황.md, 본 카드, distribution/docs/USER-RUNBOOK-CURRENT.md와 기존 PRODUCT_HOLD_TRANSITION 계약. 일반 명세의 UNKNOWN에서 실행을 잠그고 원장/정리 의무를 보존하는 기준을 유지한다.
- 구현: post-READY EOF 증거/현재 로컬·DB 조회/정상 종료 후 CLOSED 전이, 증거 원본 보존, 별도 승인 서비스만 종료, 읽기 전용 Worker/고유 Manifest 진입 URL/일반 UI 임시 비활성화와 정확한 원복, 원복 이후 복구 영수증·정상 실행 갱신 결속, 제어 UI 단절 시 해당 launch의 READY 표시만 실효화. 새 launch와 회원·세션·DNR 원장은 건드리지 않는다.
- 실제 설치 7cd15…bb32의 파일·HOLD·Credential·프로필은 변경하지 않았다. 관측 패치 9경로를 설치 외부에 준비만 했다. 실제 Chrome 기동/DB/Server/재인증/전이/START/END는 수행하지 않았다. 기존 UNKNOWN 사건은 별도로 보존한다.
- 검증 및 SHA 원본: outputs/focurve-mvp-integration-20261025/actual-current-r5-20261027/CHANNEL-RESUME-IMPLEMENTATION.json (상위 작업공간). 같은 positive EOF fixture는 수정 전 CAUSE_NOT_SUPPORTED 오류, 수정 후 성공. 독립 fixture와 실제 Chrome 결과를 구분한다.
- 미검증/다음: 캐시가 존재하는 독립 Chrome에서 Manifest 진입 URL 변경과 저장소/DNR 실제 보존 확인을 별도 승인으로 진행한다. 과거 합성 IndexedDB backing 오류는 원인 미확정이며 재현되면 UNKNOWN 유지, 조회 검사를 생략하지 않는다. 실제 Chrome 미검증이므로 기존 프로필 적용·정상 재개 준비 완료/최종 수용 PASS로 선언하지 않는다. r5 ZIP 재배포·Git 게시 없음.


#### 2026-10-27 21:22 KST 독립 Chrome 실측 갱신

별도 승인된 동일 합성 프로필 2회 기동에서 캐시된 쓰기 canary Worker → 고유 읽기 전용 진입 URL 전환을 확인했다. 사용자 제품 UI 결과의 baseline/after SHA는 모두 `70d607c51b3c601ecd98abdefc757a4af28e152e87b1f8ad3f6af487058e4d7f`다. 5개 IndexedDB 관측, Journal/Outbox/Lease/Binding 각1 및 dynamic DNR1 보존, gate UNKNOWN·authenticationVerified=false 유지, 쓰기 canary 수를 포함한 합성 전후 내용 일치가 확인됐다. 기존 전체 Core/Native/실제 회원을 실행한 시험은 아니다. session DNR의 재기동 간 보존을 주장하지 않는다. 최초 저장소 backing 오류 원인은 여전히 미확정이며 이번 짧은 시험 프로필에서는 재현되지 않았다.

시험 창을 정상 닫고 해당 프로필의 Chrome 프로세스 전체 부재를 확인했다. 21:23:41 KST 상한 전인 21:22:02에 범위를 CLOSED_NOT_REUSABLE로 종료했다. 기존 설치 7cd15…bb32의 수정 적용·실제 관측·재인증·DB 조회·HOLD 전이·정상 재개·START/END는 수행하지 않았다. 실제 기존 설치 단계는 새 승인과 그 시점 안전 검사가 필요하다. 실제 증거: CHANNEL-CACHE-ACTUAL-RESULT.json, CHANNEL-CACHE-RESTART-PROOF.json, CHANNEL-CACHE-EXECUTION.json.


### 2026-10-28 r6 보존 세션 종료 연결 — 실제 적용 전

기준 브랜치 codex/mandatory-mvp-integration-20261025 / HEAD 90ad32be5d282f3b44c917a29e156dffc5e29187. 대상 r6 65c238…7e56, 회원1/executor855cd941…/UNKNOWN d1da660a…는 보존한다. 기존 Core.end/endIntent/finish, MemberA1Adapter.offlineEnd, MemberExecution.reconcile/released를 재사용했다. 기존 5초 재검증 및 Native 문서·sender·소유권·ACK 검사는 변경하지 않았다.

새 연결은 기존 세션의 종료에만 한정한다. 별도 승인으로 소유자가 배치하는 SHA 결속·20분 이하 scope와 기존 installation proof, DB/회원/executor/session/snapshot/revision/잠금을 서버 트랜잭션에서 대조한다. 만료된 access/미확정 refresh를 보내지 않고 새 토큰도 발급하지 않는다. 이 권한은 인증 정상화나 HOLD 해제가 아니며 START/로그인/사이트 수정/갱신/일반 polling은 거절된다. 기본 패키지는 PRESERVED_END_DISABLED_1이다. 명세의 일반 토큰 인증을 대체하는 전역 설정이 아니라 사용자가 별도 승인해야 하는 제한적 기존 의무 종료 경로다.

제품 연결 탭의 종료 대상 확인 → 기존 집중 종료·로컬 복원 → 종료 기록 전송 확인 순서로 연결했다. Core의 현재 문서·cleanup 증거가 실패하면 local-end 확정 보고를 생성하지 않는다. 응답 유실 시 durable 1회 시도 표식으로 END를 재실행하지 않는다. LOCAL_END reconcile/terminal ENDED·revision 증가를 먼저 확인하고 기존 50건을 원 ID/본문으로 멱등 전송한다. 과거 APPLIED/UNCONFIRMED는 이전 revision이므로 ENDED를 덮어쓸 수 없다. 미ACK/소유권 불명확/실패 의무는 보존한다. 모든 ACK와 서버 잠금 해제를 확인한 뒤 기존 RootAuthority.released를 호출하며 HOLD와 집중 CLOSED는 유지한다.

독립 검증: 종료·인증 fence12, 호출자/Worker 기동·종료화면14, 서버 종료scope9(기존 실제 reconcile/보고 함수의 독립 검증 포함), 실행 환경4 PASS. 관련 기존 인증/기한/DP·NR/원장/요청ID·Native 연결·Windows 환경 회귀 통과. Chrome DOM/IndexedDB는 fixture, 서버 DB 검사는 JDBC double이다. 실제 r6 종료·잠금 해제·DOM30건 복원·50건 ACK PASS를 의미하지 않는다. 과거 ROW_SCHEMA_UNKNOWN도 CLEAR로 취급하지 않는다.

원본19경로와 기존 설치/실패 기록 백업·SHA, 소스 SHA, 생성 번들 및 Server JAR/추출 class 대조는 상위 outputs/focurve-mvp-integration-20261025/actual-current-r6-20261027/formal-end-preparation/PATCH-MANIFEST.json과 IMPLEMENTATION-RESULT.json에 기록했다. 별도 승인 전 설치 파일·HOLD·DB·Chrome·Native 등록·Credential·Git index는 변경하지 않았다. 새 설치/전체 복구 구조/진단 도구는 만들지 않았다. 실제 적용은 코드/runtime19경로 + 승인 시작 시 생성할 종료scope/installation payload 해시2경로, 재로드 최대1회, 전용 DB·종료전용 Server 최대20분, 현재 안전·문서 검증 후 기존 세션 END1회/reconcile/정상 종료로 제한해야 한다. 일반 정상 서비스/재인증/HOLD 전이/START/Git 게시는 제외한다.


#### 2026-10-28 00:12–00:16 KST 승인된 r6 종료 전용 실제 시도

사용자 정정 승인으로 준비된19경로와 종료scope/설치 payload 해시를 적용했다. 기존 상태·회원·인증서·Native 등록·최초 실패는 유지했다. 새 scope e7ee1e5708874ce3b14308ee2ae6b3d2의 고정 상한은 00:32:16KST였다. 전용 DB 현재 UNKNOWN/잠금 각1, member1/executor855cd941…/sessiond1da660a… 일치, Receipt 미처리0을 조회했다. 전용 MySQL 부모35400/자식30460과 Server26716의 실행 경로·직계 계보·localhost 포트를 대조했고 Health UP이었다.

사용자 재로드1회 후 종료 대상 조회에서 Worker fetch Illegal invocation이 발생했다. PreservedEnd의 기본 fetch를 globalThis에 bind하지 않아 this.fetch 호출이 controller를 수신자로 전달한 직접 코드 결함이다. Core END 이전 Server preflight fetch 단계였고, 후속 DB에서 target local_actions0, 같은 UNKNOWN·잠금1, 세션 본문 SHA 이전과 일치를 확인했다. END/Cleanup 성공으로 보고하지 않았다.

동일 범위의 정상 종료로 Server/MySQL과 포트30179/30180 해제를 확인했다. 종료scope 원문은 해시 그대로 archive하고 public context를 DISABLED로 되돌려 기존 scope를 재사용하지 못하게 했다. HOLD·데이터·최초 실패·Credential은 보존했다. 상세 실제 증거: formal-end-preparation/actual-20261027T151216Z/ACTUAL-RESULT.json.

독립 소스1파일의 fetch 기본값에 bind(globalThis)를 추가했다. 동일 WorkerGlobalScope 수신자 테스트가 수정 전 Illegal invocation/수정 후 FETCH_OK이며 관련27건 PASS다. 새 변경은 실제 설치에 아직 미적용이다. 기존19경로는 재제작하지 않으며 추가1파일 적용·무결성 결속·추가 재로드1회와 새 제한 실행 승인이 필요하다. 후보 SHA와 원본은 formal-end-preparation/fetch-receiver-fix/MANIFEST.json에 기록했다.


#### 2026-10-28 r6 END 실제 결과 — RELEASE_UNCONFIRMED, 안전 종료

fetch 바인딩 1파일의 추가 적용·재로드 승인으로 진행했다. 준비 runner의 백업 참조 오류는 DB/Server 기동 전 발생했고, 동일 파일이 이미 적용됐음을 해시로 확인해 백업 참조를 바로잡은 뒤 원래 고정 상한 00:38:34KST를 유지했다. 추가 재로드/END 횟수나 시간을 늘리지 않았다. 실제 scope58d678…는 00:19:45 시작, 서버 종료 대상 GET은 00:31:42/00:31:46에200을 반환하여 fetch 결함 해결을 확인했다.

Core END 의도는 로컬에 기록됐으나 실제 종료는 RELEASE_UNCONFIRMED로 실패했다. 사용자00:34:12 직접 감사에서 로컬 ENDING/revision2, journal RELEASED/APPLIED, Bindingd0e3… NONE/cleanupPending/DOM30/releaseEvidencefalse, 미ACK50/rootACTIVE/DNR실제0·원장2 누락이 확인됐다. 서버 종료 후 읽기 전용 결과는 UNKNOWN/revision1/잠금1/local_actions0/미처리Receipt0. 이는 로컬 복원을 확정하지 않아 reconcile와 서버 잠금 해제를 진행하지 않은 상태다. 두 계층의 상태 차이를 강제 동기화하지 않았다.

Core.finish:327은 미해소 Binding의 원래 문서가 active top frame으로 reachable하지 않으면 종료 확정 없이 반환한다. 이 결과 Adapter.verifyRelease가 ENDING/APPLIED를 거절한다. 관측 상태/코드로 이 경로를 좁혔지만 당시 getAllFrames 원 응답·오류는 미수집으로, 문서 소멸/cached/Native API 오류를 임의 확정하지 않는다. 별도 metadata list_pages 조회는 응답을 받지 못해 중단했고 evaluate_script·정책 우회는 하지 않았다. 기존 nativeCleanupHandoff는 RUNNING/NATIVE_VERIFYING 전용이며 END/최초 실패 시 거절하므로 이를 무조건 재사용하거나 END 분기 검사를 제거하지 않았다.

사용자 재시도 없이 전용 Server/MySQL을 정상 종료하고 포트 해제, 새scope archive·DISABLED, 기존 HOLD·회원·원실패·Credential 보존을 확인했다. 다음 최소 단계는 기존 Binding의 정확한 Native 문서 상태와 정식 복원/retirement 증거 대조다. 실제 END/정리/재로드/서비스 재기동은 별도 범위가 필요하며 START 금지다. 실제 종료 PASS 또는 MVP완료로 선언하지 않는다. 증거: formal-end-preparation/fetch-receiver-fix/actual-20261027T151945Z/ACTUAL-RESULT.json, LOCAL-AFTER-END.json, TERMINAL-DB.json.


### 2026-10-28 ENDING 原문서 관측 준비 (실제 적용/재실행 없음)

사용자 지시에 따라 기존 evidence만 재대조했다. 기존 sanitized binding에는 tab_id/frame_id/document_id가 없고, Core.reachable:236은 getAllFrames의 no-match/비활성/API exception을 모두 false로 합친다. Core.finish:327의 ENDING 중단 분기는 확인됐으나 원래 문서의 소멸/비활성/조회오류는 현재 자료로 구분 불가다. 설치65c238…/확장clfn…/member1/executor855cd941…/sessiond1da660a…/bindingd0e3…의 저장 소유권은 기존 증거로 결속되나 현재 Native 문서 소유권으로 승격하지 않는다. 실제 r6의 새로운 Native 조회·DB·END·Cleanup은 실행하지 않았다.

기존 safety/reader.js의 ENDING STATE 감사에만 저장 tab/frame/document와 직접 read-only webNavigation.getAllFrames/getFrame 관측을 추가했다. 활성/비활성/미반환/조회오류를 분리하고 raw URL·에러문자열·Credential을 출력하지 않는다. 미반환은 disappearanceProven=false이고 모든 분류에서 nativeIdentityVerified=false/mutationAllowed=false다. 인증·Worker·Storage쓰기·DNR변경·복구 없음. 기존 설치 미적용이며 1파일 후보/원본 백업/SHA는 formal-end-preparation/ending-document-observation/MANIFEST.json에 기록했다. 신규10건 및 기존 회귀 합64건 PASS(독립 fixture), 실제 Chrome 미검증이다.

기존 D1의 TAB_REMOVED는 Boot/profile/owner fence·기존 Native proof·scope·원장 CAS를 검증한 native_resolution_proof를 남기고 GONE_NATIVE로 구분한다. 이는 Content RELEASE/DOM복원 성공 위조가 아니다. 기존 DOCUMENT_RETIRED는 새 commit/원래 doc/fresh doc/기한 증거를 검사하며 END·최초 실패에서는 거절한다. 단순 빈 목록/실제DNR0/다른 Binding의 GONE 증거를 현재 Binding의 증거로 재사용하지 않는다. 원문서가 살아 있으면 기존 동일 문서 RELEASE가 가능해야 하고, cached/증거부족이면 의무를 유지한다. 관측 전 자동 복구/계약완화는 하지 않았다.

최소 다음 승인: 이미 열린 r6 기존 safety 탭에서 읽기1파일 최대10분 임시 적용→화면 새로고침·조회1회→즉시 정확 원복. 재로드·브라우저/DB/Server 재기동·인증·END·Cleanup·HOLD 전이 없음. 이후 Native 증거에 따라 정식 복원/retirement 처리 가능 여부를 판정한다.


#### 2026-10-28 00:45 KST 기존 문서 실제 관측·정확 원복

사용자 승인된 1파일/조회1회/최대10분 범위로 기존 r6 Chrome32300·기존 safety 탭에서만 관측했다. 새grant00:44:29~00:54:29KST, 사용자실제조회00:45:30KST. 미해소 Bindingd0e3…의 저장 tuple은 tabId1909851846/frameId0/documentId10D3EB2FD80BE15EBBF219664A149D40로 확인됐다. 동일 MEMBER:1/executor855cd941…/sessiond1da660a…/설치65c238…/확장clfn… 신원에 결속됐다.

Native getAllFrames/getFrame 결과 분류는 NOT_RETURNED, ORIGINAL_DOCUMENT_NOT_RETURNED_NOT_RETIREMENT_PROOF였다. API 예외 QUERY_ERROR는 아니며 active/cached/prerender/pending_deletion 원문서 반환도 관측되지 않았다. 현재 조회에서 원문서가 반환되지 않는 직접 조건은 확인됐으나, 유효한 Root retirement event·replacement/native proof 결속은 이 결과에 없으므로 소멸 증명·Native 신원 검증·복원 권한으로 승격하지 않는다. DNR0·다른 Binding GONE_NATIVE는 현재 DOM30건의 해제 증거가 아니다. 새 관측 뒤에도 로컬ENDING/journal RELEASED·APPLIED/Binding1·DOM30·미ACK50/RootACTIVE/UNKNOWN이 유지됐다. 신규 END/Cleanup/DB/Server/인증/확장재로드/Chrome재기동0.

결과 수신 즉시00:45:51KST reader를 정확 원본 f5db31…ad0b로 복원했다. 설치기록·Credential·원실패·HOLD lock·Native등록·manifest 등 보호11파일 해시 모두 일치했고 자동원복 기한 내 완료됐다. 독립64건PASS와 이번 Native 읽기 성공은 구분하며 실제 복원/종료 PASS로 보고하지 않는다. 증거 ending-document-observation/ACTUAL-DOCUMENT-OBSERVATION.json, RESULT.json, RESTORED.json.

다음 최소 선행 조건은 해당 tuple의 기존 Native retirement/원래 문서 복원 증거 결속이다. 현 계약상 END 상태를 ordinary committedReplacement로 우회하거나, 단순 NOT_RETURNED로 GONE을 작성할 수 없다. 증거 확보 전 END 재실행·미ACK 전송·서버 잠금 해제 승인을 요청하지 않는다. 정식 Cleanup/reconcile은 증거와 별도 승인 후에만 가능하다.


### 2026-10-28 기존 문서 생명주기 증거 재사용·종료 계약 검증

기존 r6 Chrome/Server/제품실패/수명주기 로그와 출력 evidence를 정확한 tab1909851846/document10D3EB2FD80BE15EBBF219664A149D40/bindingd0e3…로 대조했다. 일치 파일은 기존 감사 JSON이며 로그4종에는 해당 tuple·Binding에 결속된 제거/교체/복원 기록이 없었다. 로그 부재를 소멸로 해석하지 않는다. 현 판정 DOCUMENT_UNKNOWN이다. 기존 NOT_RETURNED 조회는 반복하지 않았다. 같은 tab의 현재 대체 문서와 binding 내 native_resolution_proof의 결속·유효성은 sanitized evidence에 없어 미확인이다. DOM30건 release ACK도 미확인이다.

D1의 lastRemoval/lastFailure/commit map은 메모리이고 성공한 GONE_NATIVE는 원장 native_resolution_proof로 남는다. 이벤트를 잃은 뒤 빈 목록으로 이벤트를 만들어서는 안 된다. Core END/D1에 우회·기한 완화·소급 GONE을 추가하지 않았다.

기존 Core 독립 fixture2개를 검증했다. ENDING에서 검증된 Native onRemoved callback이 있으면 원래 D1 proof/CAS로 GONE_NATIVE가 기록되고 기존 finish가 ENDED에 도달한다(Content release_evidence null 유지, Native 소멸과 DOM복원을 구분). Native 이벤트 없이 문서 목록만 비우면 ENDING/Binding NONE/cleanupPending/RELEASE_UNCONFIRMED를 유지한다. 두 건 PASS는 실제 r6 종료 증거가 아니다. 변경은 기존 member-preserved-end.test.mjs의 이 회귀2건뿐이다. 제품 코드·실제 설치·Chrome·DB·END·Cleanup 재실행은 없고 이전64건 읽기 검증은 재사용했다.

체크리스트·계약 처리·부족한 최소 증거는 formal-end-preparation/document-lifecycle-review/RESULT.json. 현재는 문서 복원/retirement 증거와 별도 승인 없이 종료할 수 없다. 동일 DB/NOT_RETURNED 조회를 반복하지 않았다.

## 2026-10-28 야간 통합 갱신 — 실제 실행 미승인

기존 r6 문서는 DOCUMENT_UNKNOWN이다. NOT_RETURNED는 소멸 증거가 아니며, 원본 로그에서 대상 문서에 결속된 소멸·교체·복원 증거를 확보하지 못했다. ENDING/Binding/DOM 30건/미ACK 50건/서버 잠금은 보존한다. 과거 조회를 현재 안전 판정으로 사용하지 않는다.

종료 전용 승인이 만료된 뒤 새 승인으로 이미 검증된 로컬 END 기록을 전송할 수 없던 연결 결함을 수정했다. 새 승인에서 현재 소유권·Core verifyRelease를 다시 확인하고, 원래 action/report ID와 본문으로 reconcile만 이어간다. Core END를 반복하거나 문서 복원을 대신하지 않는다. 서버는 새 승인 시작 전 생성된 동일 종료 기록을 기존 reconcile 계약으로 검증하며 미래 시각 기록은 거절한다. 현재 r6는 복원이 미확정이므로 이 경로로 종료 성공 처리할 수 없다.

독립 검증: Extension 전체 570건(수정 전 기준선), 종료 영향 범위 33건(수정 후), 실행기·배포 327건, Web 226건, Server 56건(현재 보고서 합계) 통과. Web·Server 빌드 성공. 실제 Chrome·DB·Server 기동, 설치 적용, END/Cleanup, Git 게시·병합은 이번 야간 범위에서 수행하지 않았다. 최신 r7 후보는 소스·생성물·JAR·Manifest·ZIP 검증 후 하나만 수용 대상으로 지정한다. 실제 필수 수용 전 MVP_FINAL_COMPLETE=false를 유지한다.



## 2026-10-29 코드 동결·GitHub 통합 준비

- 담당 Codex. 기존 재현/개발 Worktree를 변경하지 않고 원격 develop90ad32be5d282f3b44c917a29e156dffc5e29187에서 로컬 codex/mandatory-mvp-freeze-20261029 공간을 생성했다. HEAD는 기준 커밋이며 새 구현의 Commit SHA가 아니다. 구현 후보는 미커밋 파일 Manifest SHA로 식별한다.
- 최신 설치 ZIP5bcdced239ead3fa458106c2683054cbd4a6e0d248aa04f538c8229112a6b662를 동결 참조한다. 기존 실제 설치·UNKNOWN/HOLD·Credential·DB/실패 원장 변경·서비스/Chrome 실행 없음.
- PR17(92691c55…)·21(86b0e9e…)은 각각 원격 develop에 mergeable이나 최신 후보와 합성할 때33개 PR/파일 충돌 항목(32고유 파일)을 별도로 검토했다. 원격 전용115경로 보존, 동일61·clean merge1, 의미 충돌33은 최신 안전·UI·원장 계약을 유지하고 API CONNECT/WAKE와 NR01 확인을 함께 보존했다. 단순 ours/theirs Git merge나 이력 삭제를 수행하지 않았다. PR22/a29d02c…의 설계7파일은 별도 보존한다.
- 누락된 공동 합성 contracts fixture와 runtime-server/pom.xml을 포함하여 깨끗한 소스에서 재현 가능한 구성을 보완했다. PR17 backend와 runtime-server는 같은 JVM에 섞지 않는다. runtime-server/설치 계약 CI를 추가했다. 제품 소스 및4생성 번들은 동결된11파일 SHA와 일치해야 한다. 모의 시간 시험의 Date/타이머 일치만 보완했다.
- 통합 작업공간 검증: Extension747/747, Content 비브라우저4/4, Web226/226+build, runtime-server56/56+verify/JAR, 설치·Native67/67 PASS. 기존backend 비DB 단위24/24 및 skipTests package PASS이며 실제 DB HTTP 전체 회귀는 NOT_RUN/CI 대기다. 실제 Chrome/설치/START/END는 NOT_RUN. 초기 fixture누락·CPU경합 시계 실패 로그도 작업루트 outputs/focurve-github-freeze-20261029에 보존한다.
- 현재 PR·Commit 구성/소유권/승인·추가 MVP 착수 조건은 인계 TXT와 외부 결과 파일에 기록한다. Commit·Push·PR 생성·Merge는 수행하지 않았다. 코드 통합 리뷰 준비와 MVP 완료/제품 릴리스는 구분한다.

- PR17 Node HTTP 인증 probe의 누락된 설치 주소 provider 의존성을 시험 전용 loopback 고정 provider로 연결했다. 불일치 입력 fetch0·정확 입력 합성 transport1·외부 fixture 거절을 독립 확인했다. 실제 HTTP/DB 시험은 CI 대기이며 제품 HTTPS pinning을 완화하지 않았다.
