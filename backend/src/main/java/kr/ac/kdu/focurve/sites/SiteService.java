package kr.ac.kdu.focurve.sites;

import java.sql.*;
import java.time.*;
import java.util.*;
import kr.ac.kdu.focurve.api.ApiFailure;
import kr.ac.kdu.focurve.auth.AuthService;
import kr.ac.kdu.focurve.auth.AuthSupport;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.support.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class SiteService {
  private final JdbcTemplate db;
  private final AuthService json;
  private final com.fasterxml.jackson.databind.ObjectMapper mapper;

  public SiteService(
      JdbcTemplate db, AuthService json, com.fasterxml.jackson.databind.ObjectMapper mapper) {
    this.db = db;
    this.json = json;
    this.mapper = mapper;
  }

  public Map<String, Object> list(long owner, String purpose, String cursor, int limit) {
    if (limit < 1 || limit > 100) throw new ApiFailure(422, "VALIDATION_FAILED");
    if (purpose != null && !Set.of("FOCUS", "DISTRACTION", "GENERAL").contains(purpose))
      throw new ApiFailure(422, "VALIDATION_FAILED");
    long after = 0;
    try {
      if (cursor != null)
        after =
            Long.parseLong(
                new String(
                    Base64.getUrlDecoder().decode(cursor),
                    java.nio.charset.StandardCharsets.UTF_8));
      if (after < 0) throw new NumberFormatException();
    } catch (IllegalArgumentException e) {
      throw new ApiFailure(400, "INVALID_CURSOR");
    }
    var ids =
        purpose == null
            ? db.queryForList(
                "SELECT id FROM sites WHERE user_id=? AND deleted_at IS NULL AND id>? ORDER BY id"
                    + " LIMIT ?",
                Long.class,
                owner,
                after,
                limit + 1)
            : db.queryForList(
                "SELECT id FROM sites WHERE user_id=? AND deleted_at IS NULL AND id>? AND purpose=?"
                    + " ORDER BY id LIMIT ?",
                Long.class,
                owner,
                after,
                purpose,
                limit + 1);
    boolean more = ids.size() > limit;
    if (more) ids = new ArrayList<>(ids.subList(0, limit));
    var result = new LinkedHashMap<String, Object>();
    result.put("items", ids.stream().map(id -> get(owner, id)).toList());
    result.put("has_more", more);
    result.put(
        "next_cursor",
        more
            ? Base64.getUrlEncoder()
                .withoutPadding()
                .encodeToString(
                    ids.getLast().toString().getBytes(java.nio.charset.StandardCharsets.UTF_8))
            : null);
    return result;
  }

  public Map<String, Object> get(long owner, long id) {
    return object(row(owner, id, false));
  }

  @Transactional
  public Map<String, Object> create(long owner, String key, SiteInput input) {
    var v = input.validate();
    lock(owner);
    String path = "/api/v1/sites";
    var old = replay(owner, "POST", path, key, input);
    if (old != null) return old;
    checkDuplicateHost(owner, v, 0);
    var found =
        db.queryForList(
            "SELECT id,version FROM sites WHERE user_id=? AND canonical_host=?", owner, v.host());
    long id;
    if (!found.isEmpty()) {
      id = ((Number) found.getFirst().get("id")).longValue();
      save(id, v);
    } else {
      var keys = new GeneratedKeyHolder();
      db.update(
          c -> {
            var p =
                c.prepareStatement(
                    "INSERT INTO"
                        + " sites(user_id,canonical_host,display_name,include_subdomains,purpose,access_policy,version,created_at,updated_at)"
                        + " VALUES (?,?,?,?,?,?,1,UTC_TIMESTAMP(3),UTC_TIMESTAMP(3))",
                    Statement.RETURN_GENERATED_KEYS);
            p.setLong(1, owner);
            p.setString(2, v.host());
            p.setString(3, v.name());
            p.setBoolean(4, v.subdomains());
            p.setString(5, v.purpose());
            p.setString(6, v.policy());
            return p;
          },
          keys);
      id = keys.getKey().longValue();
      features(id, v.features());
    }
    var result = get(owner, id);
    remember(owner, "POST", path, key, input, result);
    return result;
  }

  @Transactional
  public Map<String, Object> patch(
      long owner, long id, String key, String version, Map<String, Object> input) {
    lock(owner);
    String path = "/api/v1/sites/" + id;
    var old = replay(owner, "PATCH", path, key, input);
    if (old != null) return old;
    var r = row(owner, id, true);
    match(r, version);
    kr.ac.kdu.focurve.execution.SafeVersion.requireIncrementable(r.get("version"));
    Set<String> allowed =
        Set.of(
            "url",
            "display_name",
            "include_subdomains",
            "purpose",
            "access_policy",
            "feature_policies");
    if (!allowed.containsAll(input.keySet())) throw new ApiFailure(422, "VALIDATION_FAILED");
    var merged = new LinkedHashMap<String, Object>();
    merged.put("url", r.get("canonical_host"));
    merged.put("display_name", r.get("display_name"));
    merged.put("include_subdomains", r.get("include_subdomains"));
    merged.put("purpose", r.get("purpose"));
    merged.put("access_policy", r.get("access_policy"));
    merged.put("feature_policies", featureList(id));
    merged.putAll(input);
    SiteInput v;
    try {
      v = mapper.convertValue(merged, SiteInput.class);
    } catch (IllegalArgumentException e) {
      throw new ApiFailure(422, "VALIDATION_FAILED");
    }
    var valid = v.validate();
    checkDuplicateHost(owner, valid, id);
    // Deleted rows keep the same host identity; host-changing conflicts include archived rows.
    if (!db.queryForList(
            "SELECT id FROM sites WHERE user_id=? AND canonical_host=? AND id<>?",
            owner,
            valid.host(),
            id)
        .isEmpty()) throw new ApiFailure(409, "SITE_SCOPE_CONFLICT");
    save(id, valid);
    var result = get(owner, id);
    remember(owner, "PATCH", path, key, input, result);
    return result;
  }

  @Transactional
  public void delete(long owner, long id, String key, String version) {
    lock(owner);
    String path = "/api/v1/sites/" + id;
    var old = replay(owner, "DELETE", path, key, Map.of());
    if (old != null) return;
    var r = row(owner, id, true);
    match(r, version);
    kr.ac.kdu.focurve.execution.SafeVersion.requireIncrementable(r.get("version"));
    db.update(
        "UPDATE sites SET deleted_at=UTC_TIMESTAMP(3),updated_at=UTC_TIMESTAMP(3),version=version+1"
            + " WHERE id=?",
        id);
    remember(owner, "DELETE", path, key, Map.of(), Map.of("deleted", true));
  }

  private void lock(long owner) {
    if (db.queryForList("SELECT id FROM users WHERE id=? FOR UPDATE", owner).isEmpty())
      throw new ApiFailure(401, "UNAUTHENTICATED");
  }

  private Map<String, Object> row(long owner, long id, boolean lock) {
    var rows =
        db.queryForList(
            "SELECT * FROM sites WHERE user_id=? AND id=? AND deleted_at IS NULL"
                + (lock ? " FOR UPDATE" : ""),
            owner,
            id);
    if (rows.isEmpty()) throw new ApiFailure(404, "SITE_NOT_FOUND");
    return rows.getFirst();
  }

  private void checkDuplicateHost(long owner, SiteInput.Validated v, long excluded) {
    // Scope overlap is allowed. The database identity remains owner + exact canonical host.
    if (!db.queryForList(
            "SELECT id FROM sites WHERE user_id=? AND canonical_host=?"
                + " AND deleted_at IS NULL AND id<>?",
            owner, v.host(), excluded)
        .isEmpty()) throw new ApiFailure(409, "SITE_SCOPE_CONFLICT");
  }

  private void save(long id, SiteInput.Validated v) {
    var storedVersion = db.queryForObject("SELECT version FROM sites WHERE id=? FOR UPDATE", Long.class, id);
    kr.ac.kdu.focurve.execution.SafeVersion.requireIncrementable(storedVersion);
    db.update(
        "UPDATE sites SET"
            + " canonical_host=?,display_name=?,include_subdomains=?,purpose=?,access_policy=?,version=version+1,updated_at=UTC_TIMESTAMP(3),deleted_at=NULL"
            + " WHERE id=?",
        v.host(),
        v.name(),
        v.subdomains(),
        v.purpose(),
        v.policy(),
        id);
    features(id, v.features());
  }

  private void features(long id, List<SiteInput.Feature> features) {
    db.update("DELETE FROM site_feature_policies WHERE site_id=?", id);
    for (var f : features)
      db.update(
          "INSERT INTO site_feature_policies VALUES (?,?,?)", id, f.feature_code(), f.enabled());
  }

  private List<Map<String, Object>> featureList(long id) {
    return db.queryForList(
        "SELECT feature_code,enabled FROM site_feature_policies WHERE site_id=? ORDER BY"
            + " feature_code",
        id);
  }

  private Map<String, Object> object(Map<String, Object> r) {
    var out = new LinkedHashMap<String, Object>();
    long id = ((Number) r.get("id")).longValue();
    out.put("site_id", Long.toString(id));
    for (String name :
        List.of(
            "canonical_host",
            "display_name",
            "include_subdomains",
            "purpose",
            "access_policy",
            "version")) out.put(name, r.get(name));
    out.put("feature_policies", featureList(id));
    for (String t : List.of("created_at", "updated_at", "deleted_at"))
      out.put(
          t, r.get(t) == null ? null : kr.ac.kdu.focurve.api.DbTime.instant(r.get(t)).toString());
    return out;
  }

  private void match(Map<String, Object> r, String version) {
    if (version == null) throw new ApiFailure(428, "PRECONDITION_REQUIRED");
    if (!version.equals("\"" + r.get("version") + "\""))
      throw new ApiFailure(412, "VERSION_CONFLICT");
  }

  private Map<String, Object> replay(
      long owner, String method, String path, String key, Object input) {
    AuthService.uuid(key);
    var rows =
        db.queryForList(
            "SELECT body_hash,response FROM idempotency_keys WHERE owner_key=? AND method=? AND"
                + " path=? AND request_key=? AND expires_at>UTC_TIMESTAMP(3)",
            "MEMBER:" + owner,
            method,
            path,
            key);
    if (rows.isEmpty()) {
      db.update(
          "DELETE FROM idempotency_keys WHERE owner_key=? AND method=? AND path=? AND"
              + " request_key=?",
          "MEMBER:" + owner,
          method,
          path,
          key);
      return null;
    }
    if (!rows.getFirst().get("body_hash").equals(AuthSupport.hash(json.encoded(input))))
      throw new ApiFailure(409, "IDEMPOTENCY_CONFLICT");
    return json.decoded(rows.getFirst().get("response").toString());
  }

  private void remember(
      long owner, String method, String path, String key, Object input, Object output) {
    db.update(
        "INSERT INTO idempotency_keys VALUES (?,?,?,?,?,?,?)",
        "MEMBER:" + owner,
        method,
        path,
        key,
        AuthSupport.hash(json.encoded(input)),
        json.encoded(output),
        Timestamp.from(Instant.now().plus(Duration.ofDays(7))));
  }
}
