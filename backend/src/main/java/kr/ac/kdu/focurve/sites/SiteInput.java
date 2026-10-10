package kr.ac.kdu.focurve.sites;

import java.net.*;
import java.util.*;
import kr.ac.kdu.focurve.api.ApiFailure;

public record SiteInput(
    String url,
    String display_name,
    Boolean include_subdomains,
    String purpose,
    String access_policy,
    List<Feature> feature_policies) {
  public record Feature(String feature_code, Boolean enabled) {}

  public record Validated(
      String host,
      String name,
      boolean subdomains,
      String purpose,
      String policy,
      List<Feature> features) {}

  public Validated validate() {
    String host = host(url);
    if (!validDisplayName(display_name)) invalid();
    if (!Set.of("FOCUS", "GENERAL", "DISTRACTION").contains(Objects.toString(purpose, "")))
      invalid();
    if ((purpose.equals("DISTRACTION")
            && !Set.of("BLOCK", "RECORD").contains(Objects.toString(access_policy, "")))
        || (!purpose.equals("DISTRACTION") && !"ALLOW".equals(access_policy))) invalid();
    List<Feature> features = feature_policies == null ? List.of() : feature_policies;
    Set<String> codes = new HashSet<>();
    for (var feature : features) {
      // Only the required-MVP Shorts policy is editable in this implementation.
      if (feature == null
          || feature.enabled() == null
          || !"YOUTUBE_SHORTS".equals(feature.feature_code())
          || !codes.add(feature.feature_code())
          || !(host.equals("youtube.com") || host.endsWith(".youtube.com"))) invalid();
    }
    return new Validated(
        host,
        display_name,
        include_subdomains == null || include_subdomains,
        purpose,
        access_policy,
        features);
  }

  /** Same Unicode scalar limit for writes and frozen Snapshot validation. */
  public static boolean validDisplayName(String value) {
    if (value == null || value.isBlank() || value.codePointCount(0, value.length()) > 100)
      return false;
    // An unpaired UTF-16 surrogate is not valid Unicode and cannot round-trip as UTF-8.
    for (int i = 0; i < value.length(); i++) {
      char c = value.charAt(i);
      if (Character.isHighSurrogate(c)) {
        if (++i >= value.length() || !Character.isLowSurrogate(value.charAt(i))) return false;
      } else if (Character.isLowSurrogate(c)) return false;
    }
    return true;
  }

  public static String host(String value) {
    try {
      if (value == null
          || value.length() > 2048
          || value.isBlank()
          || value.chars().anyMatch(c -> Character.isWhitespace(c) || Character.isISOControl(c))
          || value.contains("\\")) invalid();
      URI uri = new URI(value.contains("://") ? value : "https://" + value);
      if (!Set.of("http", "https")
          .contains(Objects.toString(uri.getScheme(), "").toLowerCase(Locale.ROOT))) invalid();
      String authority = uri.getRawAuthority();
      if (authority == null
          || authority.contains("@")
          || authority.contains(":")
          || authority.contains("%")) invalid();
      var idna =
          com.ibm.icu.text.IDNA.getUTS46Instance(
              com.ibm.icu.text.IDNA.NONTRANSITIONAL_TO_ASCII
                  | com.ibm.icu.text.IDNA.CHECK_BIDI
                  | com.ibm.icu.text.IDNA.CHECK_CONTEXTJ
                  | com.ibm.icu.text.IDNA.USE_STD3_RULES);
      var info = new com.ibm.icu.text.IDNA.Info();
      var ascii = new StringBuilder();
      idna.nameToASCII(authority, ascii, info);
      if (info.hasErrors()) invalid();
      String h = ascii.toString().toLowerCase(Locale.ROOT);
      if (h.endsWith(".")) h = h.substring(0, h.length() - 1);
      if (h.length() > 253
          || !h.contains(".")
          || h.equals("localhost")
          || h.endsWith(".localhost")
          || h.matches("[0-9.]+")
          || h.chars().allMatch(Character::isDigit)) invalid();
      for (String label : h.split("\\.", -1)) if (label.isEmpty() || label.length() > 63) invalid();
      return h;
    } catch (URISyntaxException | IllegalArgumentException e) {
      throw new ApiFailure(422, "VALIDATION_FAILED");
    }
  }

  private static void invalid() {
    throw new ApiFailure(422, "VALIDATION_FAILED");
  }
}
