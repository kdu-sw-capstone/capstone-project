package kr.ac.kdu.focurve.auth;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.sql.*;
import java.time.*;
import java.util.*;
import kr.ac.kdu.focurve.api.ApiFailure;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.support.*;
import org.springframework.security.crypto.argon2.Argon2PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AuthService {
  private final JdbcTemplate db;
  private final MailDelivery mail;
  private final ObjectMapper json;
  private final AuthRateLimits rates;
  private final EmailSignupCodes codes;
  private final Argon2PasswordEncoder encoder = new Argon2PasswordEncoder(16, 32, 1, 19456, 2);

  public AuthService(JdbcTemplate db, MailDelivery mail, ObjectMapper json, AuthRateLimits rates, EmailSignupCodes codes) {
    this.db = db;
    this.mail = mail;
    this.json = json;
    this.rates = rates;
    this.codes = codes;
  }

  public record Signup(String email, String password, String display_name, String terms_version, String verification_proof) {
    public Signup(String email,String password,String display_name,String terms_version) { this(email,password,display_name,terms_version,null); }
  }

  @Transactional
  public Map<String, Object> signup(Signup input, String credential, String key) {
    if (credential == null) throw new ApiFailure(401, "UNAUTHENTICATED");
    String owner = AuthSupport.hash(credential);
    String email = AuthSupport.email(input.email());
    AuthSupport.text(input.password(), 12, 128);
    AuthSupport.text(input.display_name(), 1, 40);
    terms(input.terms_version());
    uuid(key);
    String path = "/api/v1/auth/signup";
    String bodyHash = AuthSupport.fingerprint(credential, encoded(input));
    // Lock the anonymous session, serializing requests with the same principal.
    if (db.queryForList(
            "SELECT id_hash FROM web_sessions WHERE id_hash=? AND expires_at>UTC_TIMESTAMP(3) FOR"
                + " UPDATE",
            owner)
        .isEmpty()) throw new ApiFailure(401, "UNAUTHENTICATED");
    var old =
        db.queryForList(
            "SELECT * FROM idempotency_keys WHERE owner_key=? AND method='POST' AND path=? AND"
                + " request_key=? AND expires_at>UTC_TIMESTAMP(3)",
            "ANON:" + owner,
            path,
            key);
    if (!old.isEmpty()) {
      if (!old.getFirst().get("body_hash").equals(bodyHash))
        throw new ApiFailure(409, "IDEMPOTENCY_CONFLICT");
      return decoded(old.getFirst().get("response").toString());
    }
    db.update(
        "DELETE FROM idempotency_keys WHERE owner_key=? AND method='POST' AND path=? AND"
            + " request_key=?",
        "ANON:" + owner,
        path,
        key);
    codes.consume(email,credential,input.verification_proof());
    if (!db.queryForList("SELECT id FROM users WHERE email=?", email).isEmpty())
      throw new ApiFailure(409, "EMAIL_IN_USE");
    var keys = new GeneratedKeyHolder();
    try {
      db.update(
          c -> {
            var p =
                c.prepareStatement(
                    "INSERT INTO"
                        + " users(display_name,email,email_verified,status,created_at,terms_version,terms_accepted_at)"
                        + " VALUES"
                        + " (?,?,true,'ACTIVE',UTC_TIMESTAMP(3),?,UTC_TIMESTAMP(3))",
                    Statement.RETURN_GENERATED_KEYS);
            p.setString(1, input.display_name());
            p.setString(2, email);
            p.setString(3, input.terms_version());
            return p;
          },
          keys);
      long id = keys.getKey().longValue();
      db.update(
          "INSERT INTO auth_identities(user_id,provider,subject,password_hash,updated_at) VALUES"
              + " (?,'EMAIL',?,?,UTC_TIMESTAMP(3))",
          id,
          email,
          encoder.encode(input.password()));
      Map<String, Object> result =
          Map.of("user_id", Long.toString(id), "status", "ACTIVE", "email_verified", true);
      db.update(
          "INSERT INTO idempotency_keys VALUES (?,'POST',?,?,?,?,?)",
          "ANON:" + owner,
          path,
          key,
          bodyHash,
          encoded(result),
          Timestamp.from(Instant.now().plus(Duration.ofDays(7))));
      return result;
    } catch (DuplicateKeyException e) {
      throw new ApiFailure(409, "EMAIL_IN_USE");
    }
  }

  public record Credential(long userId, long version) {}

  public long credentials(String email, String password) {
    return credentialVersion(email, password).userId();
  }

  public Credential credentialVersion(String email, String password) {
    String normalized = AuthSupport.email(email);
    var ids =
        db.queryForList(
            "SELECT a.user_id,a.password_hash,u.email_verified,u.auth_version FROM auth_identities"
                + " a JOIN users u ON u.id=a.user_id WHERE provider='EMAIL' AND subject=?",
            normalized);
    if (ids.isEmpty()
        || password == null
        || password.length() > 128
        || !encoder.matches(password, ids.getFirst().get("password_hash").toString()))
      throw new ApiFailure(401, "INVALID_CREDENTIALS");
    if (!((Boolean) ids.getFirst().get("email_verified")))
      throw new ApiFailure(403, "EMAIL_UNVERIFIED");
    return new Credential(
        ((Number) ids.getFirst().get("user_id")).longValue(),
        ((Number) ids.getFirst().get("auth_version")).longValue());
  }

  public Map<String, Object> user(long id) {
    var u = db.queryForMap("SELECT id,display_name,email,email_verified FROM users WHERE id=?", id);
    var out = new LinkedHashMap<String, Object>();
    out.put("user_id", id + "");
    out.put("display_name", u.get("display_name"));
    out.put("email", u.get("email"));
    out.put("email_verified", u.get("email_verified"));
    out.put(
        "providers",
        db.queryForList(
            "SELECT provider FROM auth_identities WHERE user_id=? ORDER BY provider",
            String.class,
            id));
    return out;
  }

  @Transactional
  public void verify(String token) {
    var c = consume(token, "VERIFY");
    db.update("UPDATE users SET email_verified=true,status='ACTIVE' WHERE id=?", c.get("user_id"));
  }

  @Transactional
  public void requestMail(String address, String kind) {
    String email = AuthSupport.email(address);
    var users = db.queryForList("SELECT id,email_verified FROM users WHERE email=?", email);
    if (!users.isEmpty()
        && (!kind.equals("VERIFY") || !((Boolean) users.getFirst().get("email_verified")))) {
      long userId = ((Number) users.getFirst().get("id")).longValue();
      var providers =
          db.queryForList(
              "SELECT provider FROM auth_identities WHERE user_id=? ORDER BY provider",
              String.class,
              userId);
      if (kind.equals("RESET") && !providers.contains("EMAIL")) {
        // Keep the public 202 response identical; recovery guidance is delivered privately.
        if (Boolean.TRUE.equals(users.getFirst().get("email_verified"))) {
          try {
            mail.send(email, "SOCIAL_RECOVERY", String.join(",", providers));
          } catch (ApiFailure failure) {
            if (failure.status != 503) throw failure;
          }
        }
        return;
      }
      String token =
          challenge(
              ((Number) users.getFirst().get("id")).longValue(),
              kind,
              kind.equals("VERIFY") ? Duration.ofHours(24) : Duration.ofMinutes(30));
      try {
        mail.send(email, kind, token);
      } catch (ApiFailure failure) {
        if (failure.status != 503) throw failure;
        db.update(
            "UPDATE auth_challenges SET payload=JSON_OBJECT('delivery_status','FAILED') WHERE"
                + " token_hash=?",
            AuthSupport.hash(token));
      }
    }
  }

  @Transactional
  public void reset(String token, String password) {
    AuthSupport.text(password, 12, 128);
    var c = consume(token, "RESET");
    long id = ((Number) c.get("user_id")).longValue();
    db.update("UPDATE users SET auth_version=auth_version+1 WHERE id=?", id);
    int changed =
        db.update(
            "UPDATE auth_identities SET password_hash=?,updated_at=UTC_TIMESTAMP(3) WHERE user_id=?"
                + " AND provider='EMAIL'",
            encoder.encode(password),
            id);
    if (changed != 1) throw new ApiFailure(422, "INVALID_IDENTITY");
    db.update("DELETE FROM web_sessions WHERE user_id=?", id);
    // Extension token revocation is installed with the member-linking migration.
    if (Boolean.TRUE.equals(
        db.queryForObject(
            "SELECT COUNT(*)>0 FROM information_schema.tables WHERE table_schema=DATABASE() AND"
                + " table_name='extension_tokens'",
            Boolean.class)))
      db.update("UPDATE extension_tokens SET revoked_at=UTC_TIMESTAMP(3) WHERE user_id=?", id);
  }

  public String challenge(long id, String kind, Duration duration) {
    String token = AuthSupport.token();
    db.update(
        "INSERT INTO auth_challenges(id,user_id,kind,token_hash,payload,expires_at) VALUES"
            + " (?,?,?,?,JSON_OBJECT(),?)",
        UUID.randomUUID().toString(),
        id,
        kind,
        AuthSupport.hash(token),
        Timestamp.from(Instant.now().plus(duration)));
    return token;
  }

  public Map<String, Object> consume(String token, String kind) {
    if (token == null) throw new ApiFailure(410, "TOKEN_EXPIRED");
    var rows =
        db.queryForList(
            "SELECT * FROM auth_challenges WHERE token_hash=? AND kind=? FOR UPDATE",
            AuthSupport.hash(token),
            kind);
    if (rows.isEmpty()) throw new ApiFailure(410, "TOKEN_EXPIRED");
    var c = rows.getFirst();
    if (c.get("consumed_at") != null) throw new ApiFailure(409, "USED_TOKEN");
    if (!kr.ac.kdu.focurve.api.DbTime.instant(c.get("expires_at")).isAfter(Instant.now()))
      throw new ApiFailure(410, "TOKEN_EXPIRED");
    db.update("UPDATE auth_challenges SET consumed_at=UTC_TIMESTAMP(3) WHERE id=?", c.get("id"));
    return c;
  }

  public static void terms(String value) {
    if (!"dev-v1".equals(value)) throw new ApiFailure(422, "VALIDATION_FAILED");
  }

  public static void uuid(String key) {
    try {
      if (key == null || !UUID.fromString(key).toString().equals(key))
        throw new IllegalArgumentException();
    } catch (IllegalArgumentException e) {
      throw new ApiFailure(422, "VALIDATION_FAILED");
    }
  }

  public String encoded(Object v) {
    try {
      return json.copy()
          .configure(
              com.fasterxml.jackson.databind.SerializationFeature.ORDER_MAP_ENTRIES_BY_KEYS, true)
          .writeValueAsString(v);
    } catch (Exception e) {
      throw new IllegalStateException(e);
    }
  }

  @SuppressWarnings("unchecked")
  public Map<String, Object> decoded(String v) {
    try {
      return json.readValue(v, Map.class);
    } catch (Exception e) {
      throw new IllegalStateException(e);
    }
  }
}
