package kr.ac.kdu.focurve;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.nio.file.Path;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.TimeUnit;
import kr.ac.kdu.focurve.auth.*;
import kr.ac.kdu.focurve.execution.*;
import kr.ac.kdu.focurve.records.RecordQueries;
import kr.ac.kdu.focurve.sites.*;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

/** Product JS adapter + real HTTP/MySQL. Synthetic auth/APPLIED, fake IndexedDB; NOT Chrome integration. */
@ActiveProfiles("test")
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
    properties = "AUTH_PUBLIC_URL=http://127.0.0.1:5173")
class ExtensionEventDeliveryHttpIntegrationTest {
  @LocalServerPort int port;
  @Autowired JdbcTemplate db;
  @Autowired ExecutionService execution;
  @Autowired SiteService sites;
  @Autowired RecordQueries records;
  @MockitoBean MailDelivery mail;
  private String uuid() { return UUID.randomUUID().toString(); }

  @Test
  @SuppressWarnings("unchecked")
  void productAdapterDeliversActualHostsAndRecoversLostResponseWithoutDuplicateAccesses() throws Exception {
    String email = uuid() + "@example.invalid";
    db.update("INSERT INTO users(display_name,email,email_verified,status,created_at,terms_version,terms_accepted_at) VALUES ('Extension adapter synthetic',?,true,'ACTIVE',UTC_TIMESTAMP(3),'dev-v1',UTC_TIMESTAMP(3))", email);
    long owner = db.queryForObject("SELECT id FROM users WHERE email=?", Long.class, email);
    String executor = uuid(), family = uuid(), token = AuthSupport.token(), refresh = uuid();
    db.update("INSERT INTO extension_installations VALUES (?,?,?,'HTTP_SYNTHETIC',UTC_TIMESTAMP(3))", executor, owner, AuthSupport.hash(uuid()));
    db.update("INSERT INTO extension_tokens VALUES (?,?,?,?,?,DATE_ADD(UTC_TIMESTAMP(3),INTERVAL 1 DAY),NULL)", refresh, executor, owner, AuthSupport.hash(uuid()), family);
    db.update("INSERT INTO extension_access_tokens VALUES (?,?,DATE_ADD(UTC_TIMESTAMP(3),INTERVAL 15 MINUTE))", AuthSupport.hash(token), refresh);
    sites.create(owner, uuid(), new SiteInput("naver.com", "Adapter contract", true, "DISTRACTION", "RECORD", List.of()));
    var session = execution.start(owner, executor, 10, uuid());
    String sessionId = session.get("session_id").toString();
    String command = db.queryForObject("SELECT c.id FROM execution_commands c JOIN focus_sessions s ON c.session_id=s.id WHERE s.source_session_id=? AND c.kind='APPLY_POLICY'", String.class, sessionId);
    Instant begin = Instant.now().minusSeconds(20);
    execution.report(new MemberLinks.Principal(owner, executor), Map.of("report_id", uuid(), "command_id", command, "session_id", sessionId, "executor_id", executor, "desired_revision", 1, "result", "APPLIED", "observed_at", begin.toString(), "intervals", List.of(Map.of("interval_id", uuid(), "kind", "RUN", "start_at", begin.toString(), "quality", "CONFIRMED"))));
    var events = new ArrayList<Map<String, Object>>();
    for (int i = 0; i < 4; i++) {
      String host = i % 2 == 0 ? "chzzk.naver.com" : "www.naver.com";
      var event = new LinkedHashMap<String, Object>();
      event.put("schema_version", "1.2"); event.put("event_id", uuid()); event.put("executor_id", executor);
      event.put("session_id", sessionId); event.put("policy_snapshot_id", session.get("policy_snapshot_id"));
      event.put("event_type", "RECORDED_ACCESS"); event.put("occurred_at", begin.plusSeconds(i + 1).toString()); event.put("local_seq", i + 1);
      event.put("payload", Map.of("access_seq", i + 1, "navigation_id", uuid(), "target_kind", "SITE", "target_host", host, "target_key", host, "matched_policy_host", "naver.com", "reason", "RECORD", "blocked_reasons", List.of()));
      events.add(event);
    }
    Path root = Path.of(System.getProperty("user.dir"));
    if (!root.resolve("extension/scripts/member-event-http-probe.mjs").toFile().isFile()) root = root.getParent();
    var process = new ProcessBuilder("node", "extension/scripts/member-event-http-probe.mjs").directory(root.toFile()).redirectErrorStream(true);
    process.environment().put("FOCURVE_TEST_BEARER", token);
    process.environment().put("FOCURVE_HTTP_FIXTURE", new ObjectMapper().writeValueAsString(Map.of("owner_key", "MEMBER:" + owner, "base_url", "http://127.0.0.1:" + port + "/api/v1", "events", events)));
    var child = process.start();
    if (!child.waitFor(30, TimeUnit.SECONDS)) { child.destroyForcibly(); throw new AssertionError("Node adapter probe timed out"); }
    // Never log credentials, even on assertion failure.
    String output = new String(child.getInputStream().readAllBytes()).replace(token, "[redacted]");
    assertThat(child.exitValue()).as(output).isZero();
    assertThat(output).contains("PASS: product Node adapter");
    var rows = (List<Map<String, Object>>) records.list(owner, null, null, sessionId, null, null, null, 100).get("items");
    assertThat(rows).hasSize(4);
    for (String host : List.of("chzzk.naver.com", "www.naver.com")) {
      var hostRows = rows.stream().filter(row -> host.equals(row.get("target_key"))).toList();
      assertThat(hostRows).hasSize(2);
      assertThat(hostRows).allSatisfy(row -> assertThat(row.get("matched_policy_host")).isEqualTo("naver.com"));
      assertThat(hostRows.stream().map(row -> ((Number) row.get("repeat_count")).longValue()).sorted().toList()).containsExactly(0L, 1L);
    }
    for (var event : events) assertThat(db.queryForObject("SELECT COUNT(*) FROM access_events WHERE event_id=?", Long.class, event.get("event_id"))).isEqualTo(1L);
  }
}
