package kr.ac.kdu.focurve.auth;

import java.nio.charset.StandardCharsets;
import java.security.*;
import java.util.*;
import kr.ac.kdu.focurve.api.ApiFailure;

public final class AuthSupport {
  private static final SecureRandom random = new SecureRandom();

  public static String token() {
    byte[] b = new byte[32];
    random.nextBytes(b);
    return Base64.getUrlEncoder().withoutPadding().encodeToString(b);
  }

  public static String hash(String s) {
    try {
      return HexFormat.of()
          .formatHex(
              MessageDigest.getInstance("SHA-256").digest(s.getBytes(StandardCharsets.UTF_8)));
    } catch (NoSuchAlgorithmException e) {
      throw new IllegalStateException(e);
    }
  }

  public static String fingerprint(String secret, String body) {
    try {
      var mac = javax.crypto.Mac.getInstance("HmacSHA256");
      mac.init(
          new javax.crypto.spec.SecretKeySpec(
              secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
      return HexFormat.of().formatHex(mac.doFinal(body.getBytes(StandardCharsets.UTF_8)));
    } catch (GeneralSecurityException e) {
      throw new IllegalStateException(e);
    }
  }

  public static String email(String value) {
    if (value == null) throw new ApiFailure(422, "VALIDATION_FAILED");
    String e = value.strip();
    int at = e.lastIndexOf('@');
    if (e.length() > 254
        || at < 1
        || at != e.indexOf('@')
        || at == e.length() - 1
        || e.chars().anyMatch(c -> Character.isWhitespace(c) || Character.isISOControl(c)))
      throw new ApiFailure(422, "VALIDATION_FAILED");
    return e.substring(0, at + 1) + e.substring(at + 1).toLowerCase(Locale.ROOT);
  }

  public static String text(String value, int min, int max) {
    if (value == null
        || value.codePointCount(0, value.length()) < min
        || value.codePointCount(0, value.length()) > max)
      throw new ApiFailure(422, "VALIDATION_FAILED");
    return value;
  }
}
