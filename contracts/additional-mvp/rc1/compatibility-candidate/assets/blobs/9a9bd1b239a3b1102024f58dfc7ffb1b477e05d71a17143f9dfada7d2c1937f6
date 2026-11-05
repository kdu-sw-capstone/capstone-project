package kr.ac.kdu.focurve.imports;

import java.nio.charset.StandardCharsets;
import java.util.*;
import kr.ac.kdu.focurve.api.ApiFailure;
import kr.ac.kdu.focurve.api.DbTime;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

/** Owner-scoped read side. It never uploads, deletes or binds local guest data. */
@Service
public class ImportQueries {
  private final JdbcTemplate db;

  public ImportQueries(JdbcTemplate db) {
    this.db = db;
  }

  public Map<String, Object> get(long owner, String id) {
    var rows =
        db.queryForList("SELECT * FROM guest_import_batches WHERE id=? AND user_id=?", id, owner);
    if (rows.isEmpty()) throw new ApiFailure(404, "IMPORT_NOT_FOUND");
    var row = rows.getFirst();
    var out = new LinkedHashMap<String, Object>();
    out.put("batch_id", id);
    out.put("status", row.get("status"));
    out.put("created_at", DbTime.instant(row.get("created_at")).toString());
    out.put(
        "completed_at",
        row.get("completed_at") == null
            ? null
            : DbTime.instant(row.get("completed_at")).toString());
    out.put(
        "items",
        db.queryForList(
            "SELECT i.source_item_id,i.item_type,i.status,i.result_id,i.error_code FROM"
                + " guest_import_items i JOIN guest_import_batch_items bi ON bi.item_id=i.id WHERE"
                + " bi.batch_id=? AND i.bound_user_id=? ORDER BY i.source_item_id",
            id,
            owner));
    return out;
  }

  public Object list(long owner, String cursor) {
    String after = "";
    try {
      if (cursor != null)
        after = new String(Base64.getUrlDecoder().decode(cursor), StandardCharsets.UTF_8);
    } catch (IllegalArgumentException failure) {
      throw new ApiFailure(400, "INVALID_CURSOR");
    }
    var ids =
        db.queryForList(
            "SELECT id FROM guest_import_batches WHERE user_id=? AND id>? ORDER BY id LIMIT 21",
            String.class,
            owner,
            after);
    boolean more = ids.size() > 20;
    if (more) ids = new ArrayList<>(ids.subList(0, 20));
    var out = new LinkedHashMap<String, Object>();
    out.put("items", ids.stream().map(id -> get(owner, id)).toList());
    out.put("has_more", more);
    out.put(
        "next_cursor",
        more
            ? Base64.getUrlEncoder()
                .withoutPadding()
                .encodeToString(ids.getLast().getBytes(StandardCharsets.UTF_8))
            : null);
    return out;
  }
}
