package kr.ac.kdu.focurve.auth;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.*;
import jakarta.servlet.http.*;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.*;
import kr.ac.kdu.focurve.api.ApiErrors;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

@Component
public class RequestProtection extends OncePerRequestFilter {
  private final WebAuthentication auth;
  private final Set<String> origins;
  private final ObjectMapper json;

  public RequestProtection(
      WebAuthentication auth,
      ObjectMapper json,
      @Value("${AUTH_ALLOWED_ORIGINS:http://127.0.0.1:5173}") String origins) {
    this.auth = auth;
    this.json = json;
    this.origins = Set.of(origins.split(","));
  }

  protected void doFilterInternal(
      HttpServletRequest req, HttpServletResponse response, FilterChain chain)
      throws IOException, ServletException {
    boolean modifying = Set.of("POST", "PUT", "PATCH", "DELETE").contains(req.getMethod());
    String path = req.getRequestURI();
    // Token-consumption endpoints authenticate using a high-entropy single-use challenge.
    boolean challenge =
        Set.of(
                    "/api/v1/extension-installations",
                    "/api/v1/extension-link-requests",
                    "/api/v1/extension-tokens",
                    "/api/v1/extension-tokens/refresh")
                .contains(path)
            || path.equals("/api/v1/auth/email/verify")
            || path.equals("/api/v1/auth/social/email/verify")
            || path.matches("/api/v1/extension-link-requests/[a-f0-9-]{36}/(evidence|claim)")
            || path.equals("/api/v1/auth/password/reset");
    if (path.startsWith("/api/v1/")
        && modifying
        && !challenge
        && req.getHeader("Authorization") != null) {
      try {
        if (path.startsWith("/api/v1/auth/"))
          throw new kr.ac.kdu.focurve.api.ApiFailure(403, "CSRF_OR_ORIGIN_INVALID");
        auth.require(req);
      } catch (kr.ac.kdu.focurve.api.ApiFailure failure) {
        response.setStatus(failure.status);
        response.setContentType("application/json");
        json.writeValue(response.getWriter(), ApiErrors.body(failure.code, false));
        return;
      }
    }
    if (path.startsWith("/api/v1/")
        && modifying
        && !challenge
        && req.getHeader("Authorization") == null) {
      var s = auth.session(req);
      String csrf = req.getHeader("X-CSRF-Token");
      if (!origins.contains(Objects.toString(req.getHeader("Origin"), ""))
          || s == null
          || csrf == null
          || !MessageDigest.isEqual(
              AuthSupport.hash(csrf).getBytes(StandardCharsets.UTF_8),
              s.csrfHash().getBytes(StandardCharsets.UTF_8))) {
        response.setStatus(403);
        response.setContentType("application/json");
        json.writeValue(response.getWriter(), ApiErrors.body("CSRF_OR_ORIGIN_INVALID", false));
        return;
      }
    }
    chain.doFilter(req, response);
  }
}
