package kr.ac.kdu.focurve;

import static org.assertj.core.api.Assertions.*;

import java.util.UUID;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

@ActiveProfiles("test")
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class DatabaseIntegrationTest {
  @Autowired JdbcTemplate jdbc;
  @Autowired Flyway flyway;
  @Autowired TestRestTemplate http;

  @Test
  void migratesAndRevalidatesOnRealMySql() {
    String version = jdbc.queryForObject("SELECT VERSION()", String.class);
    assertThat(version).startsWith("8.4.");
    assertThat(jdbc.queryForObject("SELECT @@session.time_zone", String.class)).isEqualTo("+00:00");
    assertThat(jdbc.queryForObject("SELECT @@character_set_database", String.class))
        .isEqualTo("utf8mb4");
    flyway.validate();
    assertThat(flyway.migrate().migrationsExecuted).isZero();
    assertThat(flyway.info().current().getVersion().getVersion()).isEqualTo("10");
  }

  @Test
  @Transactional
  void storesAndReadsUnicodeAndUtcMilliseconds() {
    String email = UUID.randomUUID() + "@example.invalid";
    insertUser(email);
    assertThat(
            jdbc.queryForObject(
                "SELECT display_name FROM users WHERE email = ?", String.class, email))
        .isEqualTo("검증 사용자 🧪");
    assertThat(
            jdbc.queryForObject(
                "SELECT DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s.%f') FROM users WHERE email = ?",
                String.class, email))
        .isEqualTo("2026-10-07 00:00:00.123000");
  }

  @Test
  @Transactional
  void rejectsDuplicateEmailsWithoutOverwriting() {
    String email = UUID.randomUUID() + "@example.invalid";
    insertUser(email);
    assertThatThrownBy(() -> insertUser(email)).isInstanceOf(DuplicateKeyException.class);
    assertThat(
            jdbc.queryForObject("SELECT COUNT(*) FROM users WHERE email = ?", Integer.class, email))
        .isEqualTo(1);
  }

  @Test
  void reportsHealthyOverHttpWithRealDatabase() {
    var response = http.getForEntity("/actuator/health", String.class);
    assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
    assertThat(response.getBody()).contains("\"status\":\"UP\"");
  }

  private void insertUser(String email) {
    jdbc.update(
        "INSERT INTO"
            + " users(display_name,email,email_verified,status,created_at,terms_version,terms_accepted_at)"
            + " VALUES (?, ?, false, 'TEST_ONLY', '2026-10-07 00:00:00.123', 'test-only',"
            + " '2026-10-07 00:00:00.123')",
        "검증 사용자 🧪",
        email);
  }
}
