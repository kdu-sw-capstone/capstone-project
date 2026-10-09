package kr.ac.kdu.focurve.execution;

import jakarta.servlet.http.HttpServletRequest;
import kr.ac.kdu.focurve.auth.*;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1")
public class LinkController {
  private final MemberLinks links;
  private final WebAuthentication auth;
  private final AuthRateLimits rates;

  public LinkController(MemberLinks links, WebAuthentication auth, AuthRateLimits rates) {
    this.links = links;
    this.auth = auth;
    this.rates = rates;
  }

  public record Install(String executor_id, String client_version) {}

  public record Link(
      String executor_id, String code_challenge, String state, String callback_uri) {}

  public record Approval(boolean approve) {}

  public record Exchange(String link_request_id, String code, String code_verifier) {}

  public record Refresh(String refresh_token) {}

  public record Claim(String state) {}

  @PostMapping("/extension-link-requests/{id}/evidence")
  public Object evidence(
      @PathVariable String id,
      @RequestBody java.util.Map<String, Object> body,
      @RequestHeader(value = "X-Installation-Proof", required = false) String proof) {
    return links.evidence(id, proof, body);
  }

  @PostMapping("/extension-link-requests/{id}/claim")
  public Object claim(
      @PathVariable String id,
      @RequestBody Claim claim,
      @RequestHeader(value = "X-Installation-Proof", required = false) String proof) {
    return links.claim(id, claim.state(), proof);
  }

  @PostMapping("/extension-installations")
  @ResponseStatus(HttpStatus.CREATED)
  public Object install(@RequestBody Install i, HttpServletRequest req) {
    rates.check("INSTALL:" + req.getRemoteAddr(), 5, 60, 0);
    return links.install(i.executor_id(), i.client_version());
  }

  @PostMapping("/extension-link-requests")
  @ResponseStatus(HttpStatus.CREATED)
  public Object request(
      @RequestBody Link l,
      @RequestHeader(value = "X-Installation-Proof", required = false) String proof) {
    return links.request(l.executor_id(), l.code_challenge(), l.state(), l.callback_uri(), proof);
  }

  @PostMapping("/extension-link-requests/{id}/approval")
  public Object approve(@PathVariable String id, @RequestBody Approval a, HttpServletRequest req) {
    if (req.getHeader("Authorization") != null)
      throw new kr.ac.kdu.focurve.api.ApiFailure(403, "WEB_CONFIRMATION_REQUIRED");
    return links.approve(auth.require(req), id, a.approve());
  }

  @PostMapping("/extension-tokens")
  public Object exchange(
      @RequestBody Exchange e,
      @RequestHeader(value = "X-Installation-Proof", required = false) String proof) {
    return links.exchange(e.link_request_id(), e.code(), e.code_verifier(), proof);
  }

  @PostMapping("/extension-tokens/refresh")
  public Object refresh(@RequestBody Refresh r) {
    return links.refresh(r.refresh_token());
  }

  @GetMapping("/extension-installations")
  public Object installations(HttpServletRequest req) {
    return links.installations(auth.require(req));
  }

  @DeleteMapping("/extension-installations/{executor}/connection")
  @ResponseStatus(HttpStatus.NO_CONTENT)
  public void disconnect(@PathVariable String executor, HttpServletRequest req) {
    links.disconnect(auth.require(req), executor);
  }
}
