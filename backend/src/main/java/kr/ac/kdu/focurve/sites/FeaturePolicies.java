package kr.ac.kdu.focurve.sites;

import java.util.*;
import kr.ac.kdu.focurve.api.ApiFailure;

/** Shared storage/Snapshot validation. Storage support is not executor capability. */
public final class FeaturePolicies {
  private FeaturePolicies() {}
  private static final Map<String, String> HOSTS = Map.of(
      "YOUTUBE_SHORTS", "youtube.com",
      "YOUTUBE_RECOMMENDATIONS", "youtube.com",
      "YOUTUBE_COMMENTS", "youtube.com",
      "YOUTUBE_AUTOPLAY", "youtube.com",
      "INSTAGRAM_REELS", "instagram.com",
      "INSTAGRAM_RECOMMENDATIONS", "instagram.com");

  public static boolean valid(String host, List<SiteInput.Feature> features) {
    var seen = new HashSet<String>();
    for (var f : features) {
      if (f == null || f.enabled() == null || f.feature_code() == null) return false;
      String domain = HOSTS.get(f.feature_code());
      if (domain == null || !seen.add(f.feature_code())
          || !(host.equals(domain) || host.endsWith("." + domain))) return false;
    }
    return true;
  }

  /** Additional feature execution has not been verified in the product Core. */
  public static void requireIssuable(List<?> sites) {
    for (Object item : sites) {
      var site = (Map<?, ?>) item;
      for (Object itemFeature : (List<?>) site.get("feature_policies")) {
        var f = (Map<?, ?>) itemFeature;
        if (Boolean.TRUE.equals(f.get("enabled"))
            && !"YOUTUBE_SHORTS".equals(f.get("feature_code")))
          throw new ApiFailure(503, "SNAPSHOT_COMPATIBILITY_REQUIRED");
      }
    }
  }
}
