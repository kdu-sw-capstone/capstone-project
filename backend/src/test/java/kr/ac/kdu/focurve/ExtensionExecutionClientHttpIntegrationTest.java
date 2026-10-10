package kr.ac.kdu.focurve;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.nio.file.Path;
import java.util.*;
import java.util.concurrent.TimeUnit;
import kr.ac.kdu.focurve.auth.*;
import kr.ac.kdu.focurve.execution.ExecutionService;
import kr.ac.kdu.focurve.sites.*;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

/** Actual Server HTTP/DB; synthetic auth, DNR, trusted context and fake IndexedDB, NOT Chrome. */
@ActiveProfiles("test")
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class ExtensionExecutionClientHttpIntegrationTest {
  @LocalServerPort int port;
  @Autowired JdbcTemplate db;
  @Autowired ExecutionService execution;
  @Autowired SiteService sites;
  @MockitoBean MailDelivery mail;
  String uuid() { return UUID.randomUUID().toString(); }

  @Test
  void productAdaptersApplyAndReleaseWithDurableIdenticalReportRetry() throws Exception {
    String email = uuid() + "@example.invalid";
    db.update("INSERT INTO users(display_name,email,email_verified,status,created_at,terms_version,terms_accepted_at) VALUES ('Execution HTTP synthetic',?,true,'ACTIVE',UTC_TIMESTAMP(3),'dev-v1',UTC_TIMESTAMP(3))", email);
    long owner = db.queryForObject("SELECT id FROM users WHERE email=?", Long.class, email);
    String executor = uuid(), refresh = uuid(), token = AuthSupport.token();
    db.update("INSERT INTO extension_installations VALUES (?,?,?,'HTTP_SYNTHETIC',UTC_TIMESTAMP(3))", executor, owner, AuthSupport.hash(uuid()));
    db.update("INSERT INTO extension_tokens VALUES (?,?,?,?,?,DATE_ADD(UTC_TIMESTAMP(3),INTERVAL 1 DAY),NULL)", refresh, executor, owner, AuthSupport.hash(uuid()), uuid());
    db.update("INSERT INTO extension_access_tokens VALUES (?,?,DATE_ADD(UTC_TIMESTAMP(3),INTERVAL 15 MINUTE))", AuthSupport.hash(token), refresh);
    sites.create(owner, uuid(), new SiteInput("example.org", "Synthetic block", true, "DISTRACTION", "BLOCK", List.of()));
    String sessionId = execution.start(owner, executor, 1, uuid()).get("session_id").toString();
    Path root = Path.of(System.getProperty("user.dir"));
    if (!root.resolve("extension/scripts/member-execution-http-probe.mjs").toFile().isFile()) root = root.getParent();
    var process = new ProcessBuilder("node", "extension/scripts/member-execution-http-probe.mjs").directory(root.toFile()).redirectErrorStream(true);
    process.environment().put("FOCURVE_TEST_BEARER", token);
    process.environment().put("FOCURVE_HTTP_FIXTURE", new ObjectMapper().writeValueAsString(Map.of(
        "owner_key", "MEMBER:" + owner, "executor_id", executor, "session_id", sessionId,
        "base_url", "http://127.0.0.1:" + port + "/api/v1")));
    var child = process.start();
    if (!child.waitFor(30, TimeUnit.SECONDS)) { child.destroyForcibly(); throw new AssertionError("Execution probe timed out"); }
    String output = new String(child.getInputStream().readAllBytes()).replace(token, "[redacted]");
    assertThat(child.exitValue()).as(output).isZero();
    assertThat(output).contains("PASS: execution adapters");
    long session = db.queryForObject("SELECT id FROM focus_sessions WHERE source_session_id=?", Long.class, sessionId);
    assertThat(db.queryForObject("SELECT execution_status FROM focus_sessions WHERE id=?", String.class, session)).isEqualTo("ENDED");
    assertThat(db.queryForObject("SELECT COUNT(*) FROM execution_reports WHERE session_id=?", Long.class, session)).isEqualTo(2);
    assertThat(db.queryForObject("SELECT COUNT(*) FROM session_intervals WHERE session_id=? AND end_at IS NOT NULL", Long.class, session)).isEqualTo(1);
    assertThat(db.queryForObject("SELECT COUNT(*) FROM active_execution_locks WHERE session_id=?", Long.class, session)).isZero();
  }
}
