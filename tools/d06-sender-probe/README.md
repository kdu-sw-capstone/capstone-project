# A0-G02 sender 관측 도구

EXT-02 / Core 종민 / 준비 완료·실제 Windows MV3 NOT RUN. 제품 Core/Content receiver 구현이 아니라 별도 확장의 관측 도구다. 세 명 계약 승인·sender 판정·A0 연결 완료를 대신하지 않는다.

## 실행

1. 승인된 격리 sender 실험 범위에서만 사용. 새로운 Chrome 시험 프로필에 제품 확장/회원/Server 없이 실행한다.
2. chrome://extensions 개발자 모드에서 이 tools/d06-sender-probe 폴더만 로드. 이름은 FOCURVE A0 Sender Probe다. 제품 extension 폴더를 바꾸거나 다시 로드하지 않는다.
3. https://www.youtube.com/ 시험 탭을 열고 팝업의1번 주입,2번Worker,3번Popup,4번Content 순서로 실행. page contents/display/playback을 바꾸지 않으며 observer/timer/세션/Event를 생성하지 않는다.
4. claimedSource는 모두worker로 위조해도 관측sender는Chrome이 제공한 값이다. 결과 authorized:false/effects:0은 관측도구의 고정 거절이며 제품권한 negative PASS가 아니다.
5. 출력은 popup 닫으면 사라지므로 각 실행 후 로컬에 복사. raw sender.url/origin/tab URL/영상ID·토큰은 출력하지 않는다. 실제 field 존재/타입 및 정확한worker/popup URL일치 여부,tab/frame/documentId만 기록. Chrome/Windows fullversion, Git SHA·probe파일hash, 확장ID·실행시각도별도기록.
6. Worker/popup을 Chrome 필드로구별할수없으면BLOCKED. sender.id·origin·tab부재·body주장만으로허용하지않는다. 구분가능해도규칙을3인재확인하기전제품적용없음.

## 범위·한계

SND01/02 Worker/Popup→동일Content receiver 실제관측을 제공한다. SND03은Content→Worker runtime발신관측이며Content→Content 동일endpoint directnegative/다른tab·iframe·relay spoof 전체검증을대체하지않는다. receiver재주입singleton은1번반복후2번response.instance동일로확인. Worker Stop은popup/WorkerDevTools닫고internals에서시험확장에만실행후1번재주입/2번관측,기존instance변화여부기록. 문서교체는새documentId로별도실험이며옛동일문서시험PASS로혼합하지않음.

SND04 외부웹/다른확장·SND05필드누락합성negative·SND06전체lifecycle는이도구만으로완료되지않고NOT RUN이다. externallisteners/externally_connectable없음;외부메시지채널을제품에서열지않는다. popup출처의실험trigger검사는진단도구내부의제한일뿐candidate3제품sender승인규칙이아니다.

허용필드조합판정·부속규칙재승인·Windows실측은후속. 제품API/DB/Guest·Member·추가MVP/D06기존코드변경0,develop미병합.
