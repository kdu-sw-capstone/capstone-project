# 설치형 런타임 Server

필수 MVP 검토 후보의 설치형 제품 API다. 기존 `backend` 개발 Server와 같은 JVM에 함께 올리지 않는다. 두 모듈은 일부 경로·클래스 이름을 공유하므로 소스를 한 디렉터리로 합치지 않는다. 회원 자료는 이 모듈의 Server API/JDBC 경계로만 접근한다.

JDK 21과 저장소 Maven Wrapper로 재현한다. 저장소 루트에서 실행한다.

```sh
bash backend/mvnw -f runtime-server/pom.xml -B -ntp verify
```

Windows에서는 `backend\mvnw.cmd -f runtime-server/pom.xml -B -ntp verify`를 사용한다. 산출물은 `runtime-server/target/focurve-server-0.0.1-SNAPSHOT.jar`다. 배포 패키지는 기존 `scripts/package-integrated-candidate.py`를 사용한다.

현재 시험은 제품 함수와 Servlet/JDBC double 및 로컬 합성 SMTP를 사용한다. 실제 MySQL·회원 메일·Chrome·Native Messaging 수용을 대신하지 않는다. 이 명령은 제품 Server를 실행하거나 설치를 만들지 않는다. 실행형 JAR의 서비스 기동은 별도 유효한 승인과 설치 신원·안전 검사를 요구한다.

`contracts/fixtures/site-list.json`은 Web/Server 공동 합성 fixture다. 실제 회원·설치 데이터가 아니다. 기존 운영 DB, UNKNOWN/HOLD, 인증정보와 실패 원장을 이 저장소에 복사하지 않는다.
