package kr.ac.kdu.focurve.auth;

import jakarta.servlet.http.*;
import java.util.*;
import kr.ac.kdu.focurve.api.ApiFailure;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/auth")
public class AuthController {
  private final AuthService service;
  private final WebAuthentication auth;
  private final AuthRateLimits rates;
  private final JdbcTemplate db;
  private final SocialAuthentication social;
  private final EmailSignupCodes codes;

  public AuthController(
      AuthService service,
      WebAuthentication auth,
      AuthRateLimits rates,
      JdbcTemplate db,
      SocialAuthentication social, EmailSignupCodes codes) {
    this.service = service;
    this.auth = auth;
    this.rates = rates;
    this.db = db;
    this.social = social;
    this.codes = codes;
  }

  public record Credentials(String email, String password) {}

  public record Token(String token) {}

  public record Email(String email) {}
  public record SignupCode(String request_id,String email,String code) {}

  @PostMapping("/email/signup-code-requests")
  @ResponseStatus(org.springframework.http.HttpStatus.ACCEPTED)
  public Object signupCode(@RequestBody Email email,HttpServletRequest req) {
    return codes.request(email.email(),auth.credential(req),req.getRemoteAddr());
  }
  @PostMapping("/email/signup-code-verifications")
  public Object signupCodeVerify(@RequestBody SignupCode input,HttpServletRequest req) {
    return codes.verify(input.request_id(),input.email(),input.code(),auth.credential(req),req.getRemoteAddr());
  }

  public record Reset(String token, String new_password) {}

  public record Reauthentication(String password, String ticket) {}

  @GetMapping("/csrf")
  public Object csrf(HttpServletRequest req, HttpServletResponse res) {
    return auth.csrf(req, res);
  }

  @PostMapping("/signup")
  @ResponseStatus(org.springframework.http.HttpStatus.CREATED)
  public Object signup(
      @RequestBody AuthService.Signup input,
      @RequestHeader(value = "Idempotency-Key", required = false) String key,
      HttpServletRequest req) {
    return service.signup(input, auth.credential(req), key);
  }

  @PostMapping("/login")
  public Object login(@RequestBody Credentials c, HttpServletRequest req, HttpServletResponse res) {
    String email = AuthSupport.email(c.email());
    String account = "LOGIN:" + email, ip = "LOGIN-IP:" + req.getRemoteAddr();
    rates.available(account, 5, 60);
    rates.available(ip, 5, 60);
    AuthService.Credential credential;
    try {
      credential = service.credentialVersion(email, c.password());
    } catch (ApiFailure failure) {
      if (failure.status == 401) {
        rates.check(account, 5, 60, 0);
        rates.check(ip, 5, 60, 0);
      }
      throw failure;
    }
    rates.success(account);
    auth.loginVerified(credential, req, res);
    return service.user(credential.userId());
  }

  @GetMapping("/me")
  public Object me(HttpServletRequest req) {
    return service.user(auth.require(req));
  }

  @PostMapping("/email/verify")
  public Object verify(@RequestBody Token token) {
    service.verify(token.token());
    return Map.of("verified", true);
  }

  @PostMapping("/email/verification-requests")
  @ResponseStatus(org.springframework.http.HttpStatus.ACCEPTED)
  public void verification(@RequestBody Email email) {
    rates.check("MAIL:" + AuthSupport.email(email.email()), 5, 3600, 60);
    service.requestMail(email.email(), "VERIFY");
  }

  @PostMapping("/password/reset-requests")
  @ResponseStatus(org.springframework.http.HttpStatus.ACCEPTED)
  public void resetRequest(@RequestBody Email email) {
    rates.check("RESET-MAIL:" + AuthSupport.email(email.email()), 5, 3600, 60);
    service.requestMail(email.email(), "RESET");
  }

  @PostMapping("/password/reset")
  @ResponseStatus(org.springframework.http.HttpStatus.NO_CONTENT)
  public void reset(@RequestBody Reset reset) {
    service.reset(reset.token(), reset.new_password());
  }

  @PostMapping("/reauthenticate")
  @ResponseStatus(org.springframework.http.HttpStatus.NO_CONTENT)
  public void reauthenticate(@RequestBody Reauthentication c, HttpServletRequest req) {
    if ((c.password() == null) == (c.ticket() == null))
      throw new ApiFailure(422, "VALIDATION_FAILED");
    if (c.ticket() != null) {
      social.reauthenticate(c.ticket(), req);
      return;
    }
    long id = auth.require(req);
    String email = Objects.toString(service.user(id).get("email"), "");
    rates.check("REAUTH:" + id, 5, 60, 0);
    if (service.credentials(email, c.password()) != id)
      throw new ApiFailure(409, "IDENTITY_MISMATCH");
    db.update(
        "UPDATE web_sessions SET reauthenticated_at=UTC_TIMESTAMP(3) WHERE id_hash=?",
        auth.session(req).hash());
  }

  @PostMapping("/logout")
  @ResponseStatus(org.springframework.http.HttpStatus.NO_CONTENT)
  public void logout(HttpServletRequest req, HttpServletResponse res) {
    long owner = auth.require(req);
    if (!db.queryForList("SELECT user_id FROM active_execution_locks WHERE user_id=?", owner)
        .isEmpty()) throw new ApiFailure(409, "ACTIVE_EXECUTION_OR_LINK");
    String executor = req.getHeader("X-Logout-Executor");
    if (executor == null) {
      if (!db.queryForList("SELECT id FROM extension_installations WHERE current_user_id=?", owner)
          .isEmpty()) throw new ApiFailure(409, "ACTIVE_EXECUTION_OR_LINK");
    } else {
      AuthService.uuid(executor);
      var installations =
          db.queryForList(
              "SELECT current_user_id FROM extension_installations WHERE id=?", executor);
      if (installations.isEmpty()
          || db.queryForList(
                  "SELECT id FROM extension_tokens WHERE executor_id=? AND user_id=?",
                  executor,
                  owner)
              .isEmpty()) throw new ApiFailure(404, "INSTALLATION_NOT_FOUND");
      if (installations.getFirst().get("current_user_id") != null)
        throw new ApiFailure(409, "ACTIVE_EXECUTION_OR_LINK");
    }
    auth.clear(req, res);
  }
}
