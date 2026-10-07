# FOCURVE Server·Database 개발 기반

Java **21 JDK** · Spring Boot 3.5.16 · Maven 3.9.16 Wrapper · Flyway 11.20.3 · MySQL 8.4.8 LTS를 사용한다. Java/Node LTS와 현재 실행 환경, Spring Boot 3.5 계열의 안정적인 최소 구성을 기준으로 선택했다. Flyway는 MySQL 8.4 지원 경고를 해결하기 위해 같은 11 계열 최신 패치로 고정했다. Connector/J 등 나머지 Server 의존성은 Boot BOM을 따른다. Maven 배포본은 SHA-256, MySQL 이미지는 digest로 고정한다.

제품 API·인증·세션 기능은 없다. `/actuator/health`만 노출하며 상세 DB 정보는 응답에 포함하지 않는다. 기본 바인딩은 127.0.0.1이다. 제품 인증·CSRF·소유권 검증은 다음 기능 작업에서 반드시 구성한다. 이 서버를 제품 서비스처럼 외부에 공개하지 않는다.

## 개발용 MySQL 준비

Docker Engine과 Docker Compose가 필요하다. 아래 명령은 **저장소 루트**에서 실행한다.

```bash
cp .env.example .env
# .env의 DB_PASSWORD와 MYSQL_ROOT_PASSWORD에 서로 다른 로컬 개발용 값을 입력한다.
# 파일은 신뢰하는 로컬 셸 설정이며 특수문자·공백이 포함된 값은 따옴표로 감싼다.
docker compose up -d --wait mysql
./scripts/prepare-test-db.sh
```

Windows에서는 `.env`를 복사·편집하고 Docker Desktop을 사용한다. `scripts/*.sh`와 `./mvnw` 명령은 Bash/WSL/Git Bash 기준이며 Maven은 Windows용 `mvnw.cmd`도 제공한다. Windows에서 아래 별도 절차의 Bash 명령을 사용한 실행·검증을 완료했다. PowerShell의 `mvnw.cmd` 경로와 WSL 별도 환경을 검증했다는 뜻은 아니다.

Compose는 DB를 127.0.0.1:3306에만 노출하고 `focurve` DB·사용자를 만든다. 포트 변경 시 `.env`의 MYSQL_PORT 및 두 JDBC URL을 함께 맞춘다. 비밀번호는 `.env`에만 두고 커밋하지 않는다. 이미 초기화된 볼륨에는 `.env` 수정만으로 기존 DB 비밀번호가 바뀌지 않는다. 기존 자료를 지우지 말고 DB 자격을 별도로 조정한다.

`prepare-test-db.sh`는 해당 Compose 인스턴스에 `focurve_test` DB를 만들고 개발 사용자에게 그 DB 권한을 부여한다. 반복 실행 가능하며 데이터·볼륨을 삭제하지 않는다. 테스트는 `TEST_DB_URL`을 사용한다. 개발·운영·공유 DB를 테스트 URL로 지정하지 않는다.

## 설치·테스트·실행

아래 명령은 **저장소 루트**에서 실행한다. Java 21은 JRE가 아니라 `javac`가 포함된 JDK여야 한다. Wrapper가 Maven을 설치하므로 별도 Maven 설치는 필요하지 않다.

```bash
./scripts/with-env.sh ./backend/mvnw -f backend/pom.xml -B -ntp verify
./scripts/with-env.sh java -jar backend/target/focurve-server-0.0.1-SNAPSHOT.jar
```

`verify`는 의존성 설치·컴파일·실제 MySQL 테스트·실행 jar 빌드까지 수행한다. DB가 없으면 실패하며 H2로 대체하거나 테스트를 자동 생략하지 않는다. 개발 중에는 `./scripts/with-env.sh ./backend/mvnw -f backend/pom.xml spring-boot:run`도 사용할 수 있다.

```bash
curl --fail http://127.0.0.1:8080/actuator/health
```

기대 결과는 HTTP 200과 `{"status":"UP"}`이다. 종료는 서버 셸의 Ctrl+C, DB는 루트에서 `docker compose stop mysql`을 사용한다. 볼륨은 보존한다. 프로세스는 새 Codex 작업에서 다시 시작해야 한다.

## Windows 로컬 검증 절차·결과

검증 기준: `25c4ec75f7d9c506fabace48c2204baf0377f000`. 아래 결과는 사용자가 Windows에서 실행하여 공유한 결과이며, Codex Linux 검증과 구분한다. Docker 29.8.2·Docker Compose v5.5.1·Java 21을 사용했다. 기존 `.env`는 유지하고, 없을 때만 위 예시를 복사해 로컬 비밀번호를 설정한다. `git check-ignore .env`의 결과는 `.env`였다.

저장소 루트의 Git Bash에서:

```bash
docker compose up -d --wait mysql
docker compose ps
bash scripts/prepare-test-db.sh
bash scripts/with-env.sh bash backend/mvnw -f backend/pom.xml -B -ntp verify
bash scripts/with-env.sh java -jar backend/target/focurve-server-0.0.1-SNAPSHOT.jar
```

서버를 실행한 채 별도 셸에서:

```bash
curl --fail http://127.0.0.1:8080/actuator/health
```

- MySQL 8.4.8 컨테이너 `capstone-project-mysql-1`: `healthy`, `127.0.0.1:3306` 연결 정상.
- 테스트 DB `focurve_test` 준비·연결, HikariCP 연결 및 Flyway `V1__create_users.sql` 적용 성공.
- 실제 MySQL의 `DatabaseIntegrationTest` 포함 테스트: **4건 통과, 실패·오류·스킵 0건**, Maven `BUILD SUCCESS`, 실행 JAR 생성 성공.
- 실행 JAR에서 개발 DB `focurve` 연결·Flyway v1 적용, Spring Boot 3.5.16·Tomcat 8080 시작 성공. health 응답은 `{"status":"UP"}`.
- Web 브라우저 버튼을 통한 실제 Server 상태 확인도 성공했다. health 확인은 제품 API·인증·Extension 차단 검증을 대신하지 않는다.

## Codex 클라우드 초기화

Linux x86_64 클라우드의 read-only 홈과 HTTPS 프록시에 대응하는 선택적 helper다. 루트에서:

```bash
./scripts/cloud-setup.sh
source .local/cloud-env.sh
docker compose up -d --wait mysql
./scripts/prepare-test-db.sh
./scripts/with-env.sh ./backend/mvnw -f backend/pom.xml -B -ntp verify
```

helper는 체크섬 고정 Temurin JDK 21.0.12.1+1을 `/workspace/.tools`에 설치하고, `/workspace/.cache` 캐시와 `.local`의 Maven 프록시 설정을 준비한다. JDK의 Maven 통신은 환경이 제공한 시스템 Java 신뢰 저장소를 사용한다. TLS·체크섬 검증은 끄지 않는다. `.env`가 없을 때만 로컬 DB 전용 랜덤 자격을 만들며 기존 파일을 덮어쓰지 않는다. 처음 helper의 jar 준비 단계는 테스트를 생략하므로 뒤의 `verify`가 필수다. `.local/cloud-env.sh`는 새 셸마다 다시 읽는다.

## 마이그레이션 범위·변경 파일

- `pom.xml`, `mvnw`, `mvnw.cmd`, `.mvn/wrapper/`: 도구·의존성·빌드.
- `FocurveApplication.java`, `application.yml`: Server 시작·DB 연결·상태 확인.
- `db/migration/V1__create_users.sql`: 현행 데이터 사전의 users 테이블만 구성. 다른 제품 테이블·API·검증 로직은 다음 작업으로 남긴다.
- `DatabaseIntegrationTest.java`, `application-test.yml`: 별도 MySQL 테스트 DB 사용.
- 루트 `compose.yaml`, `.env.example`, `scripts/`: 개발 DB·자격 주입·테스트 DB·클라우드 준비.

DB는 UTC `DATETIME(3)`와 utf8mb4를 사용하고 email은 정확 비교용 binary collation과 고유 제약을 둔다. 이메일 정규화·비밀번호 해시·계정 상태 검증은 AUTH 구현에 속한다. 검증 데이터는 트랜잭션 롤백으로 제거한다. 제품 seed와 실제 사용자 정보는 없다. 적용된 migration 파일은 수정하지 않고 다음 V번호로 추가한다. `clean`과 암묵 baseline은 사용하지 않는다.

## 검증 결과와 남은 작업

2026-10-07 Codex Linux: 실제 MySQL 8.4.8에서 테스트 **4건 통과, 실패·오류·스킵 0건**. 빈 DB의 V1 적용과 재실행 무변경, UTC·utf8mb4, 한글·이모지 저장·조회, ms 정밀도, 중복 이메일 거절, HTTP 상태 확인을 검증했다. 개발 DB와 테스트 DB는 별도이며 테스트 데이터가 남지 않는지 확인한다. jar 실행 및 Web 프록시 요청은 실제 확인한다.

미검증·남은 설정: macOS 및 다른 셸·환경의 실행, 브라우저 레이아웃·접근성, 인증·메일·Google/카카오 설정, 제품 API·전체 DB 테이블, 운영 HTTPS·백업·성능·Extension 연동. 필수 MVP 기능 완료를 뜻하지 않는다.
