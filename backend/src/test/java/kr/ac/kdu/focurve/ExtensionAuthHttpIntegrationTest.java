package kr.ac.kdu.focurve;

import static org.assertj.core.api.Assertions.assertThat;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.nio.file.Path;
import java.util.*;
import java.util.concurrent.TimeUnit;
import kr.ac.kdu.focurve.auth.*;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

/** Real product JS -> HTTP -> MySQL. Web session, storage and Chrome idle evidence are synthetic. */
@ActiveProfiles("test")
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
    properties = {"AUTH_PUBLIC_URL=http://127.0.0.1:5173", "AUTH_ALLOWED_ORIGINS=http://127.0.0.1:5173",
      "EXTENSION_CALLBACK_URIS=chrome-extension://aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/popup/popup.html"})
class ExtensionAuthHttpIntegrationTest {
  @LocalServerPort int port;
  @Autowired JdbcTemplate db;
  @MockitoBean MailDelivery mail;

  @Test
  void productBackgroundModuleRegistersAndLinksAndRotatesUsingActualHttpContracts() throws Exception {
    String email = UUID.randomUUID() + "@example.invalid";
    db.update("INSERT INTO users(display_name,email,email_verified,status,created_at,terms_version,terms_accepted_at) VALUES ('Auth adapter synthetic',?,true,'ACTIVE',UTC_TIMESTAMP(3),'dev-v1',UTC_TIMESTAMP(3))", email);
    long owner = db.queryForObject("SELECT id FROM users WHERE email=?", Long.class, email);
    String executor = UUID.randomUUID().toString(), cookie = AuthSupport.token(), csrf = AuthSupport.token();
    db.update("INSERT INTO web_sessions(id_hash,user_id,csrf_hash,expires_at,auth_version) VALUES (?,?,?,DATE_ADD(UTC_TIMESTAMP(3),INTERVAL 1 HOUR),0)", AuthSupport.hash(cookie), owner, AuthSupport.hash(csrf));
    Path root = Path.of(System.getProperty("user.dir"));
    if (!root.resolve("extension/scripts/member-auth-http-probe.mjs").toFile().isFile()) root = root.getParent();
    var process = new ProcessBuilder("node", "extension/scripts/member-auth-http-probe.mjs").directory(root.toFile()).redirectErrorStream(true);
    process.environment().put("FOCURVE_AUTH_FIXTURE", new ObjectMapper().writeValueAsString(Map.of(
        "owner_user_id", Long.toString(owner), "executor_id", executor, "web_cookie", cookie, "csrf", csrf,
        "base_url", "http://127.0.0.1:" + port + "/api/v1", "web_origin", "http://127.0.0.1:5173",
        "callback_uri", "chrome-extension://aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/popup/popup.html")));
    var child = process.start();
    if (!child.waitFor(30, TimeUnit.SECONDS)) { child.destroyForcibly(); throw new AssertionError("Auth HTTP probe timed out"); }
    String output = new String(child.getInputStream().readAllBytes()).replace(cookie, "[redacted]").replace(csrf, "[redacted]");
    assertThat(child.exitValue()).as(output).isZero(); assertThat(output).contains("PASS: actual installation");
    assertThat(db.queryForObject("SELECT current_user_id FROM extension_installations WHERE id=?", Long.class, executor)).isEqualTo(owner);
    assertThat(db.queryForObject("SELECT COUNT(*) FROM link_requests WHERE executor_id=? AND consumed_at IS NOT NULL", Long.class, executor)).isEqualTo(1L);
    assertThat(db.queryForObject("SELECT COUNT(*) FROM extension_tokens WHERE executor_id=? AND revoked_at IS NULL", Long.class, executor)).isEqualTo(1L);
    assertThat(db.queryForObject("SELECT COUNT(*) FROM extension_tokens WHERE executor_id=? AND revoked_at IS NOT NULL", Long.class, executor)).isEqualTo(1L);
    assertThat(db.queryForObject("SELECT COUNT(*) FROM active_execution_locks WHERE executor_id=?", Long.class, executor)).isZero();
  }
}
