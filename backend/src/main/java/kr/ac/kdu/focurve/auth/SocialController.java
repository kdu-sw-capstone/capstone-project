package kr.ac.kdu.focurve.auth;

import jakarta.servlet.http.*;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/auth")
public class SocialController {
  private final SocialAuthentication social;

  public SocialController(SocialAuthentication social) {
    this.social = social;
  }

  public record Complete(String ticket, String terms_version, String display_name) {}

  public record Ticket(String ticket, Boolean consent) {}

  public record Contact(String ticket, String email) {}

  public record Token(String token) {}

  @GetMapping("/social/{provider}/authorize")
  public ResponseEntity<?> authorize(
      @PathVariable String provider,
      @RequestParam(defaultValue = "login") String mode,
      @RequestParam(defaultValue = "/") String return_path,
      HttpServletRequest req,
      HttpServletResponse res) {
    return ResponseEntity.status(302)
        .header("Location", social.authorize(provider, mode, return_path, req, res))
        .build();
  }

  @GetMapping("/social/{provider}/callback")
  public ResponseEntity<?> callback(
      @PathVariable String provider,
      @RequestParam(required = false) String code,
      @RequestParam(required = false) String state,
      @RequestParam(required = false) String error,
      HttpServletRequest req,
      HttpServletResponse res) {
    String location;
    try {
      location = social.callback(provider, state, code, error, req, res);
    } catch (kr.ac.kdu.focurve.api.ApiFailure failure) {
      location = social.webLocation("/#social-error?code=" + failure.code);
    }
    return ResponseEntity.status(303).header("Location", location).build();
  }

  @PostMapping("/social/complete")
  @ResponseStatus(HttpStatus.CREATED)
  public Object complete(@RequestBody Complete c, HttpServletRequest req, HttpServletResponse res) {
    return social.complete(c.ticket(), c.terms_version(), c.display_name(), req, res);
  }

  @PostMapping("/identities/link")
  public Object link(@RequestBody Ticket t, HttpServletRequest req) {
    if (!Boolean.TRUE.equals(t.consent()))
      throw new kr.ac.kdu.focurve.api.ApiFailure(422, "CONSENT_REQUIRED");
    return social.link(t.ticket(), req);
  }

  @PostMapping("/social/signup-info")
  public Object info(@RequestBody Ticket t, HttpServletRequest req) {
    return social.signupInfo(t.ticket(), req);
  }

  @PostMapping("/social/email-requests")
  @ResponseStatus(HttpStatus.ACCEPTED)
  public void contact(@RequestBody Contact c, HttpServletRequest req) {
    social.requestContact(c.ticket(), c.email(), req);
  }

  @PostMapping("/social/email/verify")
  public Object verifyContact(@RequestBody Token t) {
    social.verifyContact(t.token());
    return java.util.Map.of("verified", true);
  }
}
