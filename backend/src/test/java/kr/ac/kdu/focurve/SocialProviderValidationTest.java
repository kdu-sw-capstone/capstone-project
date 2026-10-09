package kr.ac.kdu.focurve;

import static org.assertj.core.api.Assertions.*;

import java.time.Instant;
import java.util.*;
import kr.ac.kdu.focurve.api.ApiFailure;
import kr.ac.kdu.focurve.auth.*;
import org.junit.jupiter.api.Test;
import org.springframework.security.oauth2.jwt.Jwt;

/** Claim-boundary tests; no assertion of a real provider login or signature verification. */
class SocialProviderValidationTest {
  Jwt token(String audience, String nonce, Boolean verified, String azp) {
    var b =
        Jwt.withTokenValue("synthetic")
            .header("alg", "RS256")
            .subject("provider-subject")
            .audience(List.of(audience))
            .issuedAt(Instant.now())
            .expiresAt(Instant.now().plusSeconds(60))
            .claim("nonce", nonce)
            .claim("email", "Verified@EXAMPLE.invalid")
            .claim("email_verified", verified);
    if (azp != null) b.claim("azp", azp);
    return b.build();
  }

  @Test
  void googleUsesSubjectAndOnlyVerifiedEmail() {
    var result =
        SocialProviderClient.googleIdentity(
            token("client", "nonce", true, null), "client", AuthSupport.hash("nonce"));
    assertThat(result)
        .containsEntry("subject", "provider-subject")
        .containsEntry("email", "Verified@example.invalid");
    assertThat(
            SocialProviderClient.googleIdentity(
                token("client", "nonce", false, null), "client", AuthSupport.hash("nonce")))
        .doesNotContainKey("email");
  }

  @Test
  void googleRejectsOtherAudienceNonceAndAuthorizedParty() {
    for (var t :
        List.of(
            token("other", "nonce", true, null),
            token("client", "wrong", true, null),
            token("client", "nonce", true, "other")))
      assertThatThrownBy(
              () -> SocialProviderClient.googleIdentity(t, "client", AuthSupport.hash("nonce")))
          .isInstanceOf(ApiFailure.class);
  }

  @Test
  void kakaoWithoutEmailOrWithoutVerifiedValidFlagsRequiresContact() {
    for (var p :
        List.of(
            Map.of("id", 123L),
            Map.of(
                "id",
                123L,
                "kakao_account",
                Map.of(
                    "email",
                    "A@example.invalid",
                    "is_email_valid",
                    false,
                    "is_email_verified",
                    true)),
            Map.of(
                "id",
                123L,
                "kakao_account",
                Map.of(
                    "email",
                    "A@example.invalid",
                    "is_email_valid",
                    true,
                    "is_email_verified",
                    false))))
      assertThat(SocialProviderClient.kakaoIdentity(p))
          .containsEntry("subject", "123")
          .doesNotContainKey("email");
  }

  @Test
  void kakaoAcceptsVerifiedContactAndRejectsInvalidSubjects() {
    assertThat(
            SocialProviderClient.kakaoIdentity(
                Map.of(
                    "id",
                    123L,
                    "kakao_account",
                    Map.of(
                        "email",
                        "A@EXAMPLE.invalid",
                        "is_email_valid",
                        true,
                        "is_email_verified",
                        true))))
        .containsEntry("email", "A@example.invalid");
    for (Object id : List.of(0, -1, "123", 123.5))
      assertThatThrownBy(() -> SocialProviderClient.kakaoIdentity(Map.of("id", id)))
          .isInstanceOf(ApiFailure.class);
  }
}
