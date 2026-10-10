package kr.ac.kdu.focurve.auth;

import jakarta.servlet.http.*;
import java.net.*;
import java.nio.charset.StandardCharsets;
import java.sql.*;
import java.time.*;
import java.util.*;
import kr.ac.kdu.focurve.api.ApiFailure;
import org.springframework.core.env.Environment;
import org.springframework.http.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.support.*;
import org.springframework.security.oauth2.jwt.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class SocialAuthentication {
  private final JdbcTemplate db;
  private final AuthService service;
  private final WebAuthentication web;
  private final Environment env;
  private final SocialProviderClient providerClient;
  private final AuthRateLimits rates;
  private final MailDelivery mail;

  public SocialAuthentication(
      JdbcTemplate db,
      AuthService service,
      WebAuthentication web,
      Environment env,
      SocialProviderClient providerClient,
      AuthRateLimits rates,
      MailDelivery mail) {
    this.db = db;
    this.service = service;
    this.web = web;
    this.env = env;
    this.providerClient = providerClient;
    this.rates = rates;
    this.mail = mail;
  }

  private String client(String p) {
    return configured(p.toUpperCase(Locale.ROOT) + "_CLIENT_ID");
  }

  private String configured(String name) {
    String v = env.getProperty(name, "");
    if (v.isBlank()) throw new ApiFailure(503, "PROVIDER_UNAVAILABLE");
    return v;
  }

  private String callback(String provider) {
    return configured("OAUTH_CALLBACK_BASE") + "/api/v1/auth/social/" + provider + "/callback";
  }

  public String webLocation(String path) {
    String base = env.getProperty("AUTH_PUBLIC_URL", "http://127.0.0.1:5173");
    try {
      URI uri = URI.create(base);
      if (!Set.of("http", "https").contains(uri.getScheme())
          || uri.getHost() == null
          || uri.getUserInfo() != null
          || uri.getRawQuery() != null
          || uri.getRawFragment() != null
          || !(uri.getPath().isEmpty() || uri.getPath().equals("/")))
        throw new IllegalArgumentException();
      return base.replaceAll("/+$", "") + path;
    } catch (IllegalArgumentException e) {
      throw new ApiFailure(503, "PROVIDER_UNAVAILABLE");
    }
  }

  private void provider(String p) {
    if (!Set.of("google", "kakao").contains(p)) throw new ApiFailure(422, "INVALID_PROVIDER");
  }

  @Transactional
  public String authorize(
      String p, String mode, String returnPath, HttpServletRequest req, HttpServletResponse res) {
    provider(p);
    if (!Set.of("login", "link").contains(mode) || !"/".equals(returnPath))
      throw new ApiFailure(422, "VALIDATION_FAILED");
    client(p);
    if (p.equals("google")) configured("GOOGLE_CLIENT_SECRET");
    String redirect = callback(p);
    var session = web.session(req);
    if (session == null) {
      web.csrf(req, res);
      throw new ApiFailure(409, "CSRF_SESSION_REQUIRED");
    }
    Long user = null;
    if (mode.equals("link")) {
      user = web.require(req);
    }
    String state = AuthSupport.token(), nonce = AuthSupport.token();
    Map<String, Object> payload = new LinkedHashMap<>();
    payload.put("mode", mode);
    payload.put("return_path", returnPath);
    payload.put("session_hash", session.hash());
    db.update(
        "INSERT INTO"
            + " auth_challenges(id,user_id,kind,token_hash,provider,state_hash,nonce_hash,payload,expires_at)"
            + " VALUES (?,?,?,?,?,?,?,?,?)",
        UUID.randomUUID().toString(),
        user,
        "SOCIAL_STATE",
        AuthSupport.hash(state),
        p,
        AuthSupport.hash(state),
        AuthSupport.hash(nonce),
        service.encoded(payload),
        Timestamp.from(Instant.now().plusSeconds(300)));
    String base =
        p.equals("google")
            ? "https://accounts.google.com/o/oauth2/v2/auth"
            : "https://kauth.kakao.com/oauth/authorize";
    return base
        + "?response_type=code&client_id="
        + q(client(p))
        + "&redirect_uri="
        + q(redirect)
        + "&state="
        + q(state)
        + (p.equals("google") ? "&scope=openid%20email%20profile&nonce=" + q(nonce) : "");
  }

  @Transactional(noRollbackFor = ApiFailure.class)
  public String callback(
      String p,
      String state,
      String code,
      String error,
      HttpServletRequest req,
      HttpServletResponse res) {
    provider(p);
    Map<String, Object> challenge;
    try {
      challenge = service.consume(state, "SOCIAL_STATE");
    } catch (ApiFailure e) {
      throw new ApiFailure(409, "INVALID_STATE");
    }
    var payload = service.decoded(challenge.get("payload").toString());
    var session = web.session(req);
    if (!p.equals(challenge.get("provider"))
        || session == null
        || !session.hash().equals(payload.get("session_hash")))
      throw new ApiFailure(409, "INVALID_STATE");
    if (error != null) return webLocation("/#social-canceled");
    if (code == null) throw new ApiFailure(409, "INVALID_STATE");
    Map<String, Object> identity =
        providerClient.exchange(
            p,
            code,
            challenge.get("nonce_hash") == null ? null : challenge.get("nonce_hash").toString(),
            callback(p));
    String subject = identity.get("subject").toString();
    var existing =
        db.queryForList(
            "SELECT user_id FROM auth_identities WHERE provider=? AND subject=?",
            p.toUpperCase(Locale.ROOT),
            subject);
    if (payload.get("mode").equals("login") && !existing.isEmpty()) {
      long id = ((Number) existing.getFirst().get("user_id")).longValue();
      web.login(id, req, res);
      return webLocation("/");
    }
    if (payload.get("mode").equals("link") && challenge.get("user_id") == null)
      throw new ApiFailure(409, "IDENTITY_CONFLICT");
    String ticket = AuthSupport.token();
    identity.put("mode", payload.get("mode"));
    identity.put("session_hash", session.hash());
    db.update(
        "INSERT INTO auth_challenges(id,user_id,kind,token_hash,provider,payload,expires_at) VALUES"
            + " (?,?,?,?,?,?,?)",
        UUID.randomUUID().toString(),
        challenge.get("user_id"),
        "SOCIAL_TICKET",
        AuthSupport.hash(ticket),
        p,
        service.encoded(identity),
        Timestamp.from(Instant.now().plusSeconds(1800)));
    return webLocation(
        "/#social-"
            + (payload.get("mode").equals("link") ? "link" : "complete")
            + "?ticket="
            + q(ticket));
  }

  @Transactional
  public Object complete(
      String ticket, String terms, String name, HttpServletRequest req, HttpServletResponse res) {
    AuthService.terms(terms);
    AuthSupport.text(name, 1, 40);
    var c = service.consume(ticket, "SOCIAL_TICKET");
    var data = service.decoded(c.get("payload").toString());
    bound(data, req);
    if (!"login".equals(data.get("mode"))) throw new ApiFailure(409, "IDENTITY_CONFLICT");
    String p = c.get("provider").toString().toUpperCase(Locale.ROOT),
        subject = data.get("subject").toString();
    if (!db.queryForList(
            "SELECT id FROM auth_identities WHERE provider=? AND subject=?", p, subject)
        .isEmpty()) throw new ApiFailure(409, "IDENTITY_CONFLICT");
    String email = (String) data.get("email");
    if (email == null) throw new ApiFailure(422, "CONTACT_EMAIL_REQUIRED");
    if (email != null && !db.queryForList("SELECT id FROM users WHERE email=?", email).isEmpty())
      throw new ApiFailure(409, "IDENTITY_CONFLICT");
    var keys = new GeneratedKeyHolder();
    try {
      db.update(
          conn -> {
            var ps =
                conn.prepareStatement(
                    "INSERT INTO"
                        + " users(display_name,email,email_verified,status,created_at,terms_version,terms_accepted_at)"
                        + " VALUES (?,?,?,'ACTIVE',UTC_TIMESTAMP(3),?,UTC_TIMESTAMP(3))",
                    Statement.RETURN_GENERATED_KEYS);
            ps.setString(1, name);
            ps.setString(2, email);
            ps.setBoolean(3, email != null);
            ps.setString(4, terms);
            return ps;
          },
          keys);
      long id = keys.getKey().longValue();
      db.update(
          "INSERT INTO auth_identities(user_id,provider,subject,updated_at) VALUES"
              + " (?,?,?,UTC_TIMESTAMP(3))",
          id,
          p,
          subject);
      web.login(id, req, res);
      return service.user(id);
    } catch (org.springframework.dao.DuplicateKeyException e) {
      throw new ApiFailure(409, "IDENTITY_CONFLICT");
    }
  }

  @Transactional
  public Object link(String ticket, HttpServletRequest req) {
    long id = web.require(req);
    recent(web.session(req));
    var c = service.consume(ticket, "SOCIAL_TICKET");
    var data = service.decoded(c.get("payload").toString());
    bound(data, req);
    if (!"link".equals(data.get("mode"))
        || c.get("user_id") == null
        || ((Number) c.get("user_id")).longValue() != id)
      throw new ApiFailure(409, "IDENTITY_MISMATCH");
    try {
      db.update(
          "INSERT INTO auth_identities(user_id,provider,subject,updated_at) VALUES"
              + " (?,?,?,UTC_TIMESTAMP(3))",
          id,
          c.get("provider").toString().toUpperCase(Locale.ROOT),
          data.get("subject"));
    } catch (org.springframework.dao.DuplicateKeyException e) {
      throw new ApiFailure(409, "IDENTITY_ALREADY_LINKED");
    }
    return service.user(id);
  }

  @Transactional
  public void reauthenticate(String ticket, HttpServletRequest req) {
    long owner = web.require(req);
    var c = service.consume(ticket, "SOCIAL_TICKET");
    var data = service.decoded(c.get("payload").toString());
    bound(data, req);
    if (!"link".equals(data.get("mode"))
        || c.get("user_id") == null
        || ((Number) c.get("user_id")).longValue() != owner
        || db.queryForList(
                "SELECT id FROM auth_identities WHERE user_id=? AND provider=? AND subject=?",
                owner,
                c.get("provider").toString().toUpperCase(Locale.ROOT),
                data.get("subject"))
            .isEmpty()) throw new ApiFailure(409, "IDENTITY_MISMATCH");
    db.update(
        "UPDATE web_sessions SET reauthenticated_at=UTC_TIMESTAMP(3) WHERE id_hash=?",
        web.session(req).hash());
  }

  private Map<String, Object> signupTicket(String ticket, HttpServletRequest req) {
    if (ticket == null) throw new ApiFailure(410, "TOKEN_EXPIRED");
    var rows =
        db.queryForList(
            "SELECT * FROM auth_challenges WHERE token_hash=? AND kind='SOCIAL_TICKET' FOR UPDATE",
            AuthSupport.hash(ticket));
    if (rows.isEmpty()) throw new ApiFailure(410, "TOKEN_EXPIRED");
    var c = rows.getFirst();
    if (c.get("consumed_at") != null) throw new ApiFailure(409, "USED_TOKEN");
    if (!kr.ac.kdu.focurve.api.DbTime.instant(c.get("expires_at")).isAfter(Instant.now()))
      throw new ApiFailure(410, "TOKEN_EXPIRED");
    var data = service.decoded(c.get("payload").toString());
    bound(data, req);
    if (!"login".equals(data.get("mode"))) throw new ApiFailure(409, "IDENTITY_MISMATCH");
    return c;
  }

  @Transactional
  public Object signupInfo(String ticket, HttpServletRequest req) {
    var c = signupTicket(ticket, req);
    var data = service.decoded(c.get("payload").toString());
    var result = new LinkedHashMap<String, Object>();
    result.put("provider", c.get("provider"));
    result.put("email", data.get("email"));
    result.put("email_verified", data.get("email") != null);
    return result;
  }

  @Transactional
  public void requestContact(String ticket, String address, HttpServletRequest req) {
    var c = signupTicket(ticket, req);
    String email = AuthSupport.email(address);
    var data = service.decoded(c.get("payload").toString());
    if (data.get("email") != null) throw new ApiFailure(409, "EMAIL_ALREADY_VERIFIED");
    rates.check("SOCIAL-MAIL:" + email, 5, 3600, 60);
    String token = AuthSupport.token();
    // Supersede only this pending signup's contact challenges; never another user's mail.
    db.update(
        "UPDATE auth_challenges SET consumed_at=UTC_TIMESTAMP(3) WHERE kind='SOCIAL_EMAIL' AND"
            + " consumed_at IS NULL AND JSON_UNQUOTE(JSON_EXTRACT(payload,'$.ticket_id'))=?",
        c.get("id"));
    db.update(
        "INSERT INTO auth_challenges(id,kind,token_hash,payload,expires_at) VALUES"
            + " (?,'SOCIAL_EMAIL',?,?,?)",
        UUID.randomUUID().toString(),
        AuthSupport.hash(token),
        service.encoded(Map.of("ticket_id", c.get("id"), "email", email)),
        Timestamp.from(Instant.now().plusSeconds(1200)));
    mail.send(email, "SOCIAL_EMAIL", token);
  }

  @Transactional
  public void verifyContact(String token) {
    if (token == null) throw new ApiFailure(410, "TOKEN_EXPIRED");
    var candidates =
        db.queryForList(
            "SELECT payload FROM auth_challenges WHERE token_hash=? AND kind='SOCIAL_EMAIL'",
            AuthSupport.hash(token));
    if (candidates.isEmpty()) throw new ApiFailure(410, "TOKEN_EXPIRED");
    var data = service.decoded(candidates.getFirst().get("payload").toString());
    // Same lock order as resend: signup ticket, then contact-email challenge.
    var rows =
        db.queryForList(
            "SELECT * FROM auth_challenges WHERE id=? AND kind='SOCIAL_TICKET' FOR UPDATE",
            data.get("ticket_id"));
    if (rows.isEmpty()
        || rows.getFirst().get("consumed_at") != null
        || !kr.ac.kdu.focurve.api.DbTime.instant(rows.getFirst().get("expires_at"))
            .isAfter(Instant.now())) throw new ApiFailure(410, "TOKEN_EXPIRED");
    service.consume(token, "SOCIAL_EMAIL");
    var payload = service.decoded(rows.getFirst().get("payload").toString());
    payload.put("email", data.get("email"));
    db.update(
        "UPDATE auth_challenges SET payload=? WHERE id=?",
        service.encoded(payload),
        data.get("ticket_id"));
  }

  private void bound(Map<String, Object> data, HttpServletRequest req) {
    var s = web.session(req);
    if (s == null || !s.hash().equals(data.get("session_hash")))
      throw new ApiFailure(409, "INVALID_STATE");
  }

  private void recent(WebAuthentication.Session s) {
    if (s.reauthenticatedAt() == null
        || s.reauthenticatedAt().plusSeconds(300).isBefore(Instant.now()))
      throw new ApiFailure(401, "REAUTHENTICATION_REQUIRED");
  }

  private static String q(String s) {
    return URLEncoder.encode(s, StandardCharsets.UTF_8);
  }
}
