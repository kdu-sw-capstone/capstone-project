package kr.ac.kdu.focurve.api;

import java.time.*;

public final class DbTime {
  private DbTime() {}

  public static Instant instant(Object value) {
    if (value instanceof java.sql.Timestamp timestamp) return timestamp.toInstant();
    if (value instanceof LocalDateTime local) return local.toInstant(ZoneOffset.UTC);
    if (value instanceof Instant instant) return instant;
    throw new IllegalArgumentException("Unsupported database time type");
  }
}
