package kr.ac.kdu.focurve;

import static org.assertj.core.api.Assertions.*;

import java.util.*;
import kr.ac.kdu.focurve.api.ApiFailure;
import kr.ac.kdu.focurve.events.SnapshotAccess;
import kr.ac.kdu.focurve.sites.SiteInput;
import org.junit.jupiter.api.Test;

class HostEventValidationTest {
  Map<String, Object> policy(String host, boolean subdomains, String access) {
    return Map.of(
        "canonical_host",
        host,
        "include_subdomains",
        subdomains,
        "access_policy",
        access,
        "feature_policies",
        List.of());
  }

  Map<String, Object> snapshot() {
    return Map.of(
        "format_version",
        "1.2",
        "sites",
        List.of(policy("naver.com", true, "ALLOW"), policy("chzzk.naver.com", true, "BLOCK")));
  }

  Map<String, Object> access(String host, String target) {
    return Map.of("target_kind", "SITE", "target_host", host, "target_key", target);
  }

  @Test
  void idnIsNonTransitionalAndWwwSubdomainsRemainSeparate() {
    assertThat(SiteInput.host("https://faß.de/path")).isEqualTo("xn--fa-hia.de");
    assertThat(SiteInput.host("www.NAVER.com.")).isEqualTo("www.naver.com");
    assertThat(SiteInput.host("chzzk.naver.com")).isEqualTo("chzzk.naver.com");
    assertThat(SiteInput.host("fass.de")).isNotEqualTo(SiteInput.host("faß.de"));
  }

  @Test
  void moreSpecificPolicyWinsAndDomainBoundaryPreventsFalseMatch() {
    assertThat(SnapshotAccess.select(snapshot(), "chzzk.naver.com").get("access_policy"))
        .isEqualTo("BLOCK");
    assertThat(SnapshotAccess.select(snapshot(), "live.chzzk.naver.com").get("access_policy"))
        .isEqualTo("BLOCK");
    assertThat(SnapshotAccess.select(snapshot(), "news.naver.com").get("access_policy"))
        .isEqualTo("ALLOW");
    assertThat(SnapshotAccess.select(snapshot(), "notnaver.com")).isNull();
    assertThat(
            SnapshotAccess.select(
                Map.of("sites", List.of(policy("naver.com", false, "BLOCK"))), "chzzk.naver.com"))
        .isNull();
  }

  @Test
  void keyAndActualSnapshotPolicyMustMatchReportedOutcome() {
    SnapshotAccess.validate(
        snapshot(), "BLOCKED_SITE_ACCESS", access("chzzk.naver.com", "SITE:chzzk.naver.com"));
    for (var p :
        List.of(
            access("chzzk.naver.com", "SITE:unrelated.invalid"),
            access("naver.com", "SITE:naver.com"),
            access("notnaver.com", "SITE:notnaver.com")))
      assertThatThrownBy(() -> SnapshotAccess.validate(snapshot(), "BLOCKED_SITE_ACCESS", p))
          .isInstanceOf(ApiFailure.class);
  }
}
