package kr.ac.kdu.focurve.imports;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.sql.Timestamp;
import java.time.*;
import java.util.*;
import kr.ac.kdu.focurve.api.ApiFailure;
import kr.ac.kdu.focurve.auth.*;
import kr.ac.kdu.focurve.execution.*;
import kr.ac.kdu.focurve.sites.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;

/** Only an authenticated installation can submit explicitly selected guest items. */
@Service
public class ImportService {
  private final JdbcTemplate db;
  private final AuthService json;
  private final ObjectMapper mapper;
  private final SiteService sites;
  private final ImportedSession sessions;
  private final ImportQueries queries;
  private final TransactionTemplate transaction;

  public ImportService(
      JdbcTemplate db,
      AuthService json,
      ObjectMapper mapper,
      SiteService sites,
      ImportedSession sessions,
      ImportQueries queries,
      PlatformTransactionManager manager) {
    this.db = db;
    this.json = json;
    this.mapper = mapper;
    this.sites = sites;
    this.sessions = sessions;
    this.queries = queries;
    this.transaction = new TransactionTemplate(manager);
  }

  private void lock(MemberLinks.Principal p) {
    db.queryForList("SELECT id FROM users WHERE id=? FOR UPDATE", p.user());
    if (db.queryForList(
            "SELECT id FROM extension_installations WHERE id=? AND current_user_id=? FOR UPDATE",
            p.executor(),
            p.user())
        .isEmpty()) throw new ApiFailure(403, "EXECUTOR_MISMATCH");
  }

  @Transactional
  public Object create(MemberLinks.Principal p, String key, Map<String, Object> body) {
    AuthService.uuid(key);
    keys(body, Set.of("source_installation_id", "manifest"));
    if (!p.executor().equals(body.get("source_installation_id")))
      throw new ApiFailure(403, "EXECUTOR_MISMATCH");
    var manifest = list(body.get("manifest"), 100);
    if (manifest.isEmpty()) throw new ApiFailure(422, "EMPTY_SELECTION");
    lock(p);
    String owner = "MEMBER:" + p.user(),
        path = "/api/v1/guest-imports",
        hash = AuthSupport.hash(json.encoded(body));
    var previous =
        db.queryForList(
            "SELECT body_hash,response FROM idempotency_keys WHERE owner_key=? AND method='POST'"
                + " AND path=? AND request_key=?",
            owner,
            path,
            key);
    if (!previous.isEmpty()) {
      if (!hash.equals(previous.getFirst().get("body_hash")))
        throw new ApiFailure(409, "IDEMPOTENCY_CONFLICT");
      return queries.get(
          p.user(),
          json.decoded(previous.getFirst().get("response").toString()).get("batch_id").toString());
    }
    String batch = UUID.randomUUID().toString();
    db.update(
        "INSERT INTO guest_import_batches VALUES (?,?,?,'PENDING',UTC_TIMESTAMP(3),NULL)",
        batch,
        p.user(),
        p.executor());
    var seen = new HashSet<String>();
    for (var item : manifest) {
      keys(item, Set.of("type", "source_item_id", "source_hash"));
      String source = str(item, "source_item_id"),
          type = str(item, "type"),
          sourceHash = str(item, "source_hash");
      AuthService.uuid(source);
      if (!seen.add(source) || !sourceHash.matches("[a-f0-9]{64}"))
        throw new ApiFailure(422, "INVALID_SCHEMA");
      if (!Set.of("SITE", "SESSION").contains(type))
        throw new ApiFailure(422, "IMPORT_TYPE_UNSUPPORTED");
      var old =
          db.queryForList(
              "SELECT * FROM guest_import_items WHERE source_executor_id=? AND source_item_id=? FOR"
                  + " UPDATE",
              p.executor(),
              source);
      String id;
      if (old.isEmpty()) {
        id = UUID.randomUUID().toString();
        db.update(
            "INSERT INTO guest_import_items VALUES (?,?,?,?,?,?,?,'PENDING',NULL,NULL)",
            id,
            batch,
            p.executor(),
            source,
            sourceHash,
            type,
            p.user());
      } else {
        var r = old.getFirst();
        id = r.get("id").toString();
        if (((Number) r.get("bound_user_id")).longValue() != p.user())
          throw new ApiFailure(409, "SOURCE_BOUND_TO_OTHER_ACCOUNT");
        if (!sourceHash.equals(r.get("source_hash")) || !type.equals(r.get("item_type")))
          throw new ApiFailure(409, "SOURCE_CONFLICT");
      }
      db.update("INSERT INTO guest_import_batch_items VALUES (?,?)", batch, id);
    }
    refreshBatches(batch);
    db.update(
        "INSERT INTO idempotency_keys VALUES (?,'POST',?,?,?,?,?)",
        owner,
        path,
        key,
        hash,
        json.encoded(Map.of("batch_id", batch)),
        Timestamp.from(Instant.now().plus(Duration.ofDays(7))));
    return queries.get(p.user(), batch);
  }

  public Object upload(
      MemberLinks.Principal p, String batch, String source, Map<String, Object> body) {
    AuthService.uuid(batch);
    AuthService.uuid(source);
    try {
      return transaction.execute(status -> save(p, batch, source, body));
    } catch (ApiFailure failure) {
      if (failure.status != 422) throw failure;
      return transaction.execute(
          status -> {
            lock(p);
            var r = item(p, batch, source);
            if (!terminal(r))
              db.update(
                  "UPDATE guest_import_items SET status='FAILED',error_code=? WHERE id=?",
                  failure.code,
                  r.get("id"));
            refreshBatches(batch);
            return result(item(p, batch, source));
          });
    }
  }

  private Object save(
      MemberLinks.Principal p, String batch, String source, Map<String, Object> body) {
    lock(p);
    var r = item(p, batch, source);
    keys(body, Set.of("type", "source_item_id", "source_hash", "payload"));
    if (!source.equals(body.get("source_item_id"))
        || !r.get("source_hash").equals(body.get("source_hash"))
        || !r.get("item_type").equals(body.get("type")))
      throw new ApiFailure(409, "SOURCE_CONFLICT");
    var payload = object(body.get("payload"));
    canonicalValues(payload);
    if (json.encoded(payload).getBytes(java.nio.charset.StandardCharsets.UTF_8).length > 1048576)
      throw new ApiFailure(413, "BATCH_TOO_LARGE");
    if (!AuthSupport.hash(json.encoded(payload)).equals(r.get("source_hash")))
      throw new ApiFailure(409, "SOURCE_CONFLICT");
    if (terminal(r)) return result(r);
    String result, status = "SUCCEEDED";
    if ("SITE".equals(r.get("item_type"))) {
      SiteInput input;
      try {
        input = mapper.convertValue(payload, SiteInput.class);
      } catch (IllegalArgumentException e) {
        throw new ApiFailure(422, "INVALID_SCHEMA");
      }
      var valid = input.validate();
      // Local settings already have canonical hosts. Do not archive URL paths or private queries.
      if (!valid.host().equals(input.url())) throw new ApiFailure(422, "INVALID_SCHEMA");
      var existing =
          db.queryForList(
              "SELECT id FROM sites WHERE user_id=? AND canonical_host=?", p.user(), valid.host());
      if (!existing.isEmpty()) {
        result = existing.getFirst().get("id").toString();
        status = "SKIPPED_CONFLICT";
      } else
        result = sites.create(p.user(), r.get("id").toString(), input).get("site_id").toString();
    } else result = sessions.save(p, source, payload);
    db.update("INSERT INTO guest_import_payloads VALUES (?,?)", r.get("id"), json.encoded(payload));
    db.update(
        "UPDATE guest_import_items SET status=?,result_id=?,error_code=NULL WHERE id=?",
        status,
        result,
        r.get("id"));
    refreshBatches(batch);
    return result(item(p, batch, source));
  }

  private Map<String, Object> item(MemberLinks.Principal p, String batch, String source) {
    var rows =
        db.queryForList(
            "SELECT i.* FROM guest_import_items i JOIN guest_import_batch_items bi ON"
                + " bi.item_id=i.id JOIN guest_import_batches b ON b.id=bi.batch_id WHERE b.id=?"
                + " AND b.user_id=? AND b.executor_id=? AND i.source_item_id=? AND"
                + " i.bound_user_id=? FOR UPDATE",
            batch,
            p.user(),
            p.executor(),
            source,
            p.user());
    if (rows.isEmpty()) throw new ApiFailure(404, "IMPORT_NOT_FOUND");
    return rows.getFirst();
  }

  private boolean terminal(Map<String, Object> r) {
    return Set.of("SUCCEEDED", "SKIPPED_CONFLICT").contains(r.get("status"));
  }

  private Map<String, Object> result(Map<String, Object> r) {
    var out = new LinkedHashMap<String, Object>();
    for (String k : List.of("source_item_id", "status", "result_id", "error_code"))
      out.put(k, r.get(k));
    return out;
  }

  private void refreshBatches(String batch) {
    var batches =
        db.queryForList(
            "SELECT DISTINCT x.batch_id FROM guest_import_batch_items x JOIN"
                + " guest_import_batch_items y ON x.item_id=y.item_id WHERE y.batch_id=?",
            String.class,
            batch);
    for (String id : batches) {
      var rows =
          db.queryForList(
              "SELECT i.status FROM guest_import_items i JOIN guest_import_batch_items bi ON"
                  + " bi.item_id=i.id WHERE bi.batch_id=?",
              id);
      boolean complete = rows.stream().allMatch(this::terminal),
          pending = rows.stream().allMatch(r -> "PENDING".equals(r.get("status")));
      db.update(
          "UPDATE guest_import_batches SET status=?,completed_at=IF(?,UTC_TIMESTAMP(3),NULL) WHERE"
              + " id=?",
          complete ? "COMPLETE" : pending ? "PENDING" : "PARTIAL",
          complete,
          id);
    }
  }

  public static void keys(Map<String, Object> v, Set<String> allowed) {
    if (!allowed.containsAll(v.keySet())) throw new ApiFailure(422, "INVALID_SCHEMA");
  }

  @SuppressWarnings("unchecked")
  public static Map<String, Object> object(Object v) {
    if (!(v instanceof Map<?, ?>)) throw new ApiFailure(422, "INVALID_SCHEMA");
    return (Map<String, Object>) v;
  }

  public static List<Map<String, Object>> list(Object v, int max) {
    if (!(v instanceof List<?> l) || l.size() > max) throw new ApiFailure(422, "INVALID_SCHEMA");
    return l.stream().map(ImportService::object).toList();
  }

  public static String str(Map<String, Object> v, String k) {
    return ExecutionService.str(v, k);
  }

  private void canonicalValues(Object v) {
    if (v instanceof Map<?, ?> m) m.values().forEach(this::canonicalValues);
    else if (v instanceof List<?> l) l.forEach(this::canonicalValues);
    else if (v instanceof Number n) {
      if (!(n instanceof Integer || n instanceof Long)
          || Math.abs(n.longValue()) > 9007199254740991L)
        throw new ApiFailure(422, "INVALID_SCHEMA");
    } else if (v != null && !(v instanceof String) && !(v instanceof Boolean))
      throw new ApiFailure(422, "INVALID_SCHEMA");
  }
}
