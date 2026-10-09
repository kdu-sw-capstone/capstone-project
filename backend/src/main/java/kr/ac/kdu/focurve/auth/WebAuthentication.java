package kr.ac.kdu.focurve.auth;

import jakarta.servlet.http.*;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.*;
import kr.ac.kdu.focurve.api.ApiFailure;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseCookie;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

@Service
public class WebAuthentication {
  public record Session(String hash, Long userId, String csrfHash, Instant reauthenticatedAt) {}

  private final JdbcTemplate db;
  private final boolean secure;
  private final long lifetime;
  private final kr.ac.kdu.focurve.execution.MemberLinks links;

  public WebAuthentication(
      kr.ac.kdu.focurve.execution.MemberLinks links,
      JdbcTemplate db,
      @Value("${AUTH_COOKIE_SECURE:true}") boolean secure,
      @Value("${AUTH_SESSION_HOURS:24}") long lifetime) {
    this.links = links;
    this.db = db;
    this.secure = secure;
    this.lifetime = lifetime;
  }

  public Session session(HttpServletRequest req) {
    String token = null;
    if (req.getCookies() != null)
      for (var c : req.getCookies())
        if (c.getName().equals("focurve_session")) token = c.getValue();
    if (token == null) return null;
    var list =
        db.query(
            "SELECT s.* FROM web_sessions s LEFT JOIN users u ON u.id=s.user_id"
                + " WHERE s.id_hash=? AND s.expires_at>UTC_TIMESTAMP(3)"
                + " AND (s.user_id IS NULL OR s.auth_version=u.auth_version)",
            (rs, n) ->
                new Session(
                    rs.getString("id_hash"),
                    (Long) rs.getObject("user_id"),
                    rs.getString("csrf_hash"),
                    rs.getTimestamp("reauthenticated_at") == null
                        ? null
                        : rs.getTimestamp("reauthenticated_at").toInstant()),
            AuthSupport.hash(token));
    return list.isEmpty() ? null : list.getFirst();
  }

  public String credential(HttpServletRequest req) {
    String value = null;
    if (req.getCookies() != null)
      for (var cookie : req.getCookies())
        if (cookie.getName().equals("focurve_session")) value = cookie.getValue();
    if (value == null) throw new ApiFailure(401, "UNAUTHENTICATED");
    return value;
  }

  public Map<String, String> csrf(HttpServletRequest req, HttpServletResponse response) {
    var s = session(req);
    String csrf;
    if (s == null) csrf = create(null, response);
    else {
      // Stable for this HttpOnly session, rotated with the session on login.
      // Another tab fetching CSRF must not invalidate a pending request.
      csrf = AuthSupport.fingerprint(credential(req), "FOCURVE_CSRF_V1");
      db.update(
          "UPDATE web_sessions SET csrf_hash=? WHERE id_hash=?", AuthSupport.hash(csrf), s.hash());
    }
    return Map.of("csrf_token", csrf);
  }

  @org.springframework.transaction.annotation.Transactional
  public void login(long id, HttpServletRequest req, HttpServletResponse response) {
    var old = session(req);
    if (old != null) db.update("DELETE FROM web_sessions WHERE id_hash=?", old.hash());
    create(id, response);
  }

  @org.springframework.transaction.annotation.Transactional
  public void loginVerified(
      AuthService.Credential credential, HttpServletRequest req, HttpServletResponse response) {
    // Rotate the old browser session before taking the user lock. Reset may finish while this
    // waits.
    var old = session(req);
    if (old != null) db.update("DELETE FROM web_sessions WHERE id_hash=?", old.hash());
    long current =
        db.queryForObject(
            "SELECT auth_version FROM users WHERE id=? FOR UPDATE",
            Long.class,
            credential.userId());
    if (current != credential.version()) throw new ApiFailure(401, "INVALID_CREDENTIALS");
    create(credential.userId(), response);
  }

  private String create(Long id, HttpServletResponse response) {
    String value = AuthSupport.token();
    String csrf = AuthSupport.fingerprint(value, "FOCURVE_CSRF_V1");
    db.update(
        "INSERT INTO web_sessions(id_hash,user_id,csrf_hash,expires_at,auth_version)"
            + " VALUES (?,?,?,?,COALESCE((SELECT auth_version FROM users WHERE id=?),0))",
        AuthSupport.hash(value),
        id,
        AuthSupport.hash(csrf),
        Timestamp.from(Instant.now().plusSeconds(lifetime * 3600)),
        id);
    response.addHeader(
        "Set-Cookie",
        ResponseCookie.from("focurve_session", value)
            .httpOnly(true)
            .secure(secure)
            .sameSite("Lax")
            .path("/")
            .maxAge(lifetime * 3600)
            .build()
            .toString());
    return csrf;
  }

  public long require(HttpServletRequest req) {
    if (req.getHeader("Authorization") != null)
      return links.access(req.getHeader("Authorization")).user();
    var s = session(req);
    if (s == null || s.userId() == null) throw new ApiFailure(401, "UNAUTHENTICATED");
    return s.userId();
  }

  public void clear(HttpServletRequest req, HttpServletResponse response) {
    var s = session(req);
    if (s != null) db.update("DELETE FROM web_sessions WHERE id_hash=?", s.hash());
    response.addHeader(
        "Set-Cookie",
        ResponseCookie.from("focurve_session", "")
            .httpOnly(true)
            .secure(secure)
            .sameSite("Lax")
            .path("/")
            .maxAge(0)
            .build()
            .toString());
  }
}
