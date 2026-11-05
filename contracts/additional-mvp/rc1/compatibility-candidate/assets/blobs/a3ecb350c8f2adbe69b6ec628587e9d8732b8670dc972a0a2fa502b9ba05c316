package kr.ac.kdu.focurve.auth;

import java.util.*;
import kr.ac.kdu.focurve.api.ApiFailure;
import org.springframework.core.env.Environment;
import org.springframework.http.MediaType;
import org.springframework.security.oauth2.core.*;
import org.springframework.security.oauth2.jwt.*;
import org.springframework.stereotype.Component;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.web.client.RestClient;

/** Official authorization-code exchange. Tokens and provider error bodies are never logged. */
@Component
public class SocialProviderClient {
  private final Environment env;
  private final RestClient http;

  public SocialProviderClient(Environment env, RestClient.Builder builder) {
    this.env = env;
    var factory =
        new org.springframework.http.client.JdkClientHttpRequestFactory(
            java.net.http.HttpClient.newBuilder()
                .connectTimeout(java.time.Duration.ofSeconds(5))
                .build());
    factory.setReadTimeout(java.time.Duration.ofSeconds(10));
    this.http = builder.requestFactory(factory).build();
  }

  @SuppressWarnings("unchecked")
  public Map<String, Object> exchange(
      String provider, String code, String nonceHash, String callback) {
    try {
      String client = env.getProperty(provider.toUpperCase(Locale.ROOT) + "_CLIENT_ID", "");
      String secret = env.getProperty(provider.toUpperCase(Locale.ROOT) + "_CLIENT_SECRET", "");
      if (client.isBlank() || provider.equals("google") && secret.isBlank())
        throw new ApiFailure(503, "PROVIDER_UNAVAILABLE");
      var form = new LinkedMultiValueMap<String, String>();
      form.add("grant_type", "authorization_code");
      form.add("code", code);
      form.add("client_id", client);
      form.add("redirect_uri", callback);
      if (!secret.isBlank()) form.add("client_secret", secret);
      Map<String, Object> tokens =
          http.post()
              .uri(
                  provider.equals("google")
                      ? "https://oauth2.googleapis.com/token"
                      : "https://kauth.kakao.com/oauth/token")
              .contentType(MediaType.APPLICATION_FORM_URLENCODED)
              .body(form)
              .retrieve()
              .body(Map.class);
      var identity = new LinkedHashMap<String, Object>();
      if (provider.equals("google")) {
        var decoder =
            NimbusJwtDecoder.withJwkSetUri("https://www.googleapis.com/oauth2/v3/certs").build();
        decoder.setJwtValidator(
            new DelegatingOAuth2TokenValidator<>(
                new JwtTimestampValidator(),
                new JwtClaimValidator<String>(
                    "iss",
                    iss ->
                        Set.of("accounts.google.com", "https://accounts.google.com")
                            .contains(iss))));
        var jwt = decoder.decode(Objects.toString(tokens.get("id_token"), ""));
        identity.putAll(googleIdentity(jwt, client, nonceHash));
      } else {
        var profile =
            http.get()
                .uri("https://kapi.kakao.com/v2/user/me")
                .header("Authorization", "Bearer " + tokens.get("access_token"))
                .retrieve()
                .body(Map.class);
        identity.putAll(kakaoIdentity(profile));
      }
      return identity;
    } catch (ApiFailure e) {
      throw e;
    } catch (Exception e) {
      throw new ApiFailure(401, "INVALID_IDENTITY");
    }
  }

  public static Map<String, Object> googleIdentity(Jwt jwt, String client, String nonceHash) {
    if (jwt.getAudience() == null
        || !jwt.getAudience().contains(client)
        || jwt.getSubject() == null
        || jwt.getSubject().isBlank()
        || jwt.getExpiresAt() == null
        || jwt.getIssuedAt() == null
        || jwt.getClaimAsString("nonce") == null
        || !AuthSupport.hash(jwt.getClaimAsString("nonce")).equals(nonceHash)
        || (jwt.getAudience().size() > 1 || jwt.hasClaim("azp"))
            && !client.equals(jwt.getClaimAsString("azp")))
      throw new ApiFailure(401, "INVALID_IDENTITY");
    var identity = new LinkedHashMap<String, Object>();
    identity.put("subject", jwt.getSubject());
    if (Boolean.TRUE.equals(jwt.getClaimAsBoolean("email_verified"))
        && jwt.getClaimAsString("email") != null)
      identity.put("email", AuthSupport.email(jwt.getClaimAsString("email")));
    return identity;
  }

  public static Map<String, Object> kakaoIdentity(Map<?, ?> profile) {
    if (profile == null
        || !(profile.get("id") instanceof Number id)
        || !(id instanceof Integer || id instanceof Long)
        || id.longValue() <= 0) throw new ApiFailure(401, "INVALID_IDENTITY");
    var result = new LinkedHashMap<String, Object>();
    result.put("subject", id.toString());
    if (profile.get("kakao_account") instanceof Map<?, ?> account
        && Boolean.TRUE.equals(account.get("is_email_valid"))
        && Boolean.TRUE.equals(account.get("is_email_verified"))
        && account.get("email") instanceof String email)
      result.put("email", AuthSupport.email(email));
    return result;
  }
}
