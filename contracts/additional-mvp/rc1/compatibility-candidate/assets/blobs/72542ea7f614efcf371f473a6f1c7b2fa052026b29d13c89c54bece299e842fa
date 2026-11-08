package kr.ac.kdu.focurve.execution;

import kr.ac.kdu.focurve.api.ApiFailure;

/** New exchanged numeric versions only; never rewrites historical values or IDs. */
public final class SafeVersion {
  public static final long MAX = 9_007_199_254_740_991L;
  private SafeVersion() {}
  public static boolean valid(Object value) {
    return (value instanceof Integer || value instanceof Long)
        && ((Number)value).longValue() >= 1 && ((Number)value).longValue() <= MAX;
  }
  public static void requireIncrementable(Object value) {
    if (!valid(value) || ((Number)value).longValue() == MAX)
      throw new ApiFailure(409, "VERSION_LIMIT");
  }
}
