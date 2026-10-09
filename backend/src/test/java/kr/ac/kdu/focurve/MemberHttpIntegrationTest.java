package kr.ac.kdu.focurve;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import java.util.*;
import java.util.concurrent.atomic.AtomicReference;
import kr.ac.kdu.focurve.auth.*;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.http.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

@ActiveProfiles("test")
@SpringBootTest(
    webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
    properties = {"AUTH_COOKIE_SECURE=false", "AUTH_ALLOWED_ORIGINS=http://127.0.0.1:5173"})
class MemberHttpIntegrationTest {
  @Autowired TestRestTemplate http;
  @Autowired JdbcTemplate db;
  @MockitoBean MailDelivery mail;
  private final List<String> emails = new ArrayList<>();
  private final Set<String> sessionHashes = new HashSet<>();

  @AfterEach
  void clean() {
    for (String hash : sessionHashes) {
      db.update("DELETE FROM idempotency_keys WHERE owner_key=?", "ANON:" + hash);
      db.update("DELETE FROM email_signup_codes WHERE owner_hash=?",hash);
      db.update("DELETE FROM web_sessions WHERE id_hash=?", hash);
    }
    for (String email : emails) {
      var users = db.queryForList("SELECT id FROM users WHERE email=?", Long.class, email);
      for (long id : users) {
        db.update("DELETE FROM idempotency_keys WHERE owner_key=?", "MEMBER:" + id);
        var sites = db.queryForList("SELECT id FROM sites WHERE user_id=?", Long.class, id);
        for (long site : sites)
          db.update("DELETE FROM site_feature_policies WHERE site_id=?", site);
        db.update("DELETE FROM sites WHERE user_id=?", id);
        db.update("DELETE FROM auth_challenges WHERE user_id=?", id);
        db.update("DELETE FROM auth_identities WHERE user_id=?", id);
        db.update("DELETE FROM web_sessions WHERE user_id=?", id);
        db.update("DELETE FROM users WHERE id=?", id);
      }
      for (String prefix : List.of("LOGIN:", "MAIL:", "RESET-MAIL:","SIGNUP-CODE-MAIL:"))
        db.update(
            "DELETE FROM auth_rate_limits WHERE bucket_hash=?", AuthSupport.hash(prefix + email));
    }
  }

  private Map<String, Object> asMap(ResponseEntity<Map> r) {
    return r.getBody();
  }

  private String cookie(ResponseEntity<?> response) {
    String cookie = response.getHeaders().getFirst("Set-Cookie").split(";", 2)[0];
    sessionHashes.add(AuthSupport.hash(cookie.split("=", 2)[1]));
    return cookie;
  }

  private HttpHeaders headers(String cookie, String csrf) {
    var h = new HttpHeaders();
    h.setContentType(MediaType.APPLICATION_JSON);
    h.set("Cookie", cookie);
    h.set("Origin", "http://127.0.0.1:5173");
    h.set("X-CSRF-Token", csrf);
    return h;
  }

  @Test
  void csrfRemainsUsableAcrossTabsOfSameSession() {
    String email = "http-csrf-" + UUID.randomUUID() + "@example.invalid";
    emails.add(email);
    var first = http.getForEntity("/api/v1/auth/csrf", Map.class);
    String cookie = cookie(first);
    String token = first.getBody().get("csrf_token").toString();
    var headers = headers(cookie, token);
    var second =
        http.exchange("/api/v1/auth/csrf", HttpMethod.GET, new HttpEntity<>(headers), Map.class);
    assertThat(token.equals(second.getBody().get("csrf_token"))).isTrue();
    var response =
        http.postForEntity(
            "/api/v1/auth/password/reset-requests",
            new HttpEntity<>(Map.of("email", email), headers),
            String.class);
    assertThat(response.getStatusCode().value()).isEqualTo(202);
  }

  @Test
  void actualHttpSignupVerifyLoginSiteIsolationAndLogout() {
    String email = UUID.randomUUID() + "@example.invalid";
    emails.add(email);
    AtomicReference<String> verifyToken = new AtomicReference<>();
    doAnswer(
            invocation -> {
              verifyToken.set(invocation.getArgument(2));
              return null;
            })
        .when(mail)
        .send(eq(email), eq("SIGNUP_CODE"), anyString());
    var csrf = http.getForEntity("/api/v1/auth/csrf", Map.class);
    String anon = cookie(csrf);
    var headers = headers(anon, csrf.getBody().get("csrf_token").toString());
    headers.set("Idempotency-Key", UUID.randomUUID().toString());
    var sent=http.postForEntity("/api/v1/auth/email/signup-code-requests",new HttpEntity<>(Map.of("email",email),headers),Map.class);
    assertThat(sent.getStatusCode().value()).isEqualTo(202);
    var codeResult=http.postForEntity("/api/v1/auth/email/signup-code-verifications",new HttpEntity<>(Map.of("email",email,"request_id",sent.getBody().get("request_id"),"code",verifyToken.get()),headers),Map.class);
    assertThat(codeResult.getStatusCode().value()).isEqualTo(200);
    var input =
        Map.of(
            "email",
            email,
            "password",
            "test-password-1234",
            "display_name",
            "HTTP 검증",
            "terms_version",
            "dev-v1","verification_proof",codeResult.getBody().get("verification_proof"));
    var blocked = http.postForEntity("/api/v1/auth/signup", input, Map.class);
    assertThat(blocked.getStatusCode().value()).isEqualTo(403);
    var signed =
        http.postForEntity("/api/v1/auth/signup", new HttpEntity<>(input, headers), Map.class);
    assertThat(signed.getStatusCode().value()).isEqualTo(201);
    var repeated =
        http.postForEntity("/api/v1/auth/signup", new HttpEntity<>(input, headers), Map.class);
    assertThat(repeated.getBody()).isEqualTo(signed.getBody());
    var resend =
        http.postForEntity(
            "/api/v1/auth/email/signup-code-requests",
            new HttpEntity<>(Map.of("email", email), headers),
            Map.class);
    assertThat(resend.getStatusCode().value()).isEqualTo(429);
    var logged =
        http.postForEntity(
            "/api/v1/auth/login",
            new HttpEntity<>(Map.of("email", email, "password", "test-password-1234"), headers),
            Map.class);
    assertThat(logged.getStatusCode().value()).isEqualTo(200);
    String member = cookie(logged);
    assertThat(member).isNotEqualTo(anon);
    var memberHeaders = new HttpHeaders();
    memberHeaders.set("Cookie", member);
    var memberCsrf =
        http.exchange(
            "/api/v1/auth/csrf", HttpMethod.GET, new HttpEntity<>(memberHeaders), Map.class);
    headers = headers(member, memberCsrf.getBody().get("csrf_token").toString());
    headers.set("Idempotency-Key", UUID.randomUUID().toString());
    var fractional =
        http.postForEntity(
            "/api/v1/sessions",
            new HttpEntity<>(
                Map.of("executor_id", UUID.randomUUID().toString(), "duration_minutes", 1.5),
                headers),
            Map.class);
    assertThat(fractional.getStatusCode().value()).isEqualTo(422);
    var saved =
        http.postForEntity(
            "/api/v1/sites",
            new HttpEntity<>(
                Map.of(
                    "url",
                    "https://www.example.org/private?data=discard",
                    "display_name",
                    "HTTP 사이트",
                    "include_subdomains",
                    true,
                    "purpose",
                    "DISTRACTION",
                    "access_policy",
                    "BLOCK",
                    "feature_policies",
                    List.of()),
                headers),
            Map.class);
    assertThat(saved.getStatusCode().value()).isEqualTo(201);
    assertThat(saved.getBody().get("canonical_host")).isEqualTo("www.example.org");
    assertThat(saved.getHeaders().getETag()).isEqualTo("\"1\"");
    String id = saved.getBody().get("site_id").toString();
    var anonymous = http.getForEntity("/api/v1/sites/" + id, Map.class);
    assertThat(anonymous.getStatusCode().value()).isEqualTo(401);
    var bad = new HttpHeaders();
    bad.putAll(headers);
    bad.set("Origin", "https://untrusted.invalid");
    var denied =
        http.exchange("/api/v1/sites/" + id, HttpMethod.DELETE, new HttpEntity<>(bad), Map.class);
    assertThat(denied.getStatusCode().value()).isEqualTo(403);
    headers.set("If-Match", "\"1\"");
    var deleted =
        http.exchange(
            "/api/v1/sites/" + id, HttpMethod.DELETE, new HttpEntity<>(headers), String.class);
    assertThat(deleted.getStatusCode().value()).isEqualTo(204);
    var loggedOut =
        http.postForEntity(
            "/api/v1/auth/logout", new HttpEntity<>(Map.of(), headers), String.class);
    assertThat(loggedOut.getStatusCode().value()).isEqualTo(204);
    assertThat(db.queryForObject("SELECT COUNT(*) FROM users WHERE email=?", Long.class, email))
        .isEqualTo(1);
    var after =
        http.exchange("/api/v1/auth/me", HttpMethod.GET, new HttpEntity<>(headers), Map.class);
    assertThat(after.getStatusCode().value()).isEqualTo(401);
  }

  @Test
  void actualHttpMailFailureRollsBackSignup() {
    String email = UUID.randomUUID() + "@example.invalid";
    emails.add(email);
    doThrow(new kr.ac.kdu.focurve.api.ApiFailure(503, "MAIL_UNAVAILABLE"))
        .when(mail)
        .send(eq(email), eq("SIGNUP_CODE"), anyString());
    var csrf = http.getForEntity("/api/v1/auth/csrf", Map.class);
    var headers = headers(cookie(csrf), csrf.getBody().get("csrf_token").toString());
    headers.set("Idempotency-Key", UUID.randomUUID().toString());
    var failed=http.postForEntity("/api/v1/auth/email/signup-code-requests",new HttpEntity<>(Map.of("email",email),headers),Map.class);
    assertThat(failed.getStatusCode().value()).isEqualTo(503);
    assertThat(failed.getHeaders().getFirst("Retry-After")).isNotBlank();
    assertThat(db.queryForObject("SELECT COUNT(*) FROM users WHERE email=?", Integer.class, email))
        .isZero();
    assertThat(
            db.queryForObject(
                "SELECT COUNT(*) FROM auth_identities WHERE provider='EMAIL' AND subject=?",
                Integer.class,
                email))
        .isZero();
  }

  @Test
  void bogusBearerDoesNotBypassCsrfForAuthentication() {
    var h = new HttpHeaders();
    h.set("Authorization", "Bearer invalid");
    h.setContentType(MediaType.APPLICATION_JSON);
    var result =
        http.postForEntity(
            "/api/v1/auth/login",
            new HttpEntity<>(
                Map.of("email", "nonexistent@example.invalid", "password", "test-password-1234"),
                h),
            Map.class);
    assertThat(result.getStatusCode().value()).isEqualTo(403);
  }
}
