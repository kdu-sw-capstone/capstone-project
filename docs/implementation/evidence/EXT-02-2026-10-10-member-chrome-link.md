# EXT-02 / D09 수정 후 실제 Windows 회원 연결 — 사용자 실행 결과

실행주체 사용자 윤종민. 안내한제품소스b8bc7a17269a9c46981f6891f9fc92e9d98c38c9 ZIP다운로드·압축해제확장로드보고. 로드filehash독립대조미검증. 이전Chrome환경제공:154.0.8037.98 /Windows11 25H2 Build26200.9457;이번별도버전재확인미실행.

사용자PC MySQL healthy→Server healthUP→Web기동→Mailpit로컬메일→회원가입/인증/로그인 진행. 정확한계정/메일/비밀은기록하지않음. Server루트.env의실제Extension callback등록후재시작/health확인. 기존설치등록오류Illegal invocation는Windows debugger와Linux Worker회귀로별도확인·수정했다.

수정본로드후동일확장callback확인,팝업계정미연결상태→계정연결버튼→Web연결확인화면의실제요청id와로그인회원표시→후속팝업의“회원 연결 확인 완료 · 회원 집중 실행은 아직 연결되지 않았습니다.” 원본화면을사용자가제공. Web초기미연결표시는일반새로고침후사용자가“회원 연결됨”으로확인했다.

- 통과(사용자실행/원본화면+보고): 제품회원연결흐름및팝업LINKED표시,Web연결표시. 코드상LINKED까지설치proof/PKCE/토큰/me확인이필요하나각HTTP교환·DB원문을이번직접캡처/검증한것은아님.
- 과거실패: 수정전설치등록미확인/Illegal invocation. 이번후속연결에서동일오류보고없음.
- 미검증: 토큰회전/만료·재시작후인증유지·응답유실실제복구·회원명령적용/APPLIED/RELEASED·이벤트Server저장/조회·reconcile·전체EXT02 AC. 회원집중실행을시험하지않았으며완료로표시하지않음.
- 조율필요: 다훈의최신develop90ad32b/Command기간·시각계약 및 회원실행연결,지민D06별도.
- 다음행동: 회원연결성공 및 실행통합미완료를 분리하여기록;Core/Content계약 합의 후 작은 단위 구현, 회원 명령 연동은 별도 단위.

사용자화면에노출된개인계정·요청UUID·executor UUID·설치인증정보는이문서에복사하지않는다. 이번기록은모의자동테스트나Core/Server전체완료증거로전용하지않는다.
