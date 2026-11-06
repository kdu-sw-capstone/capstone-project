package kr.ac.kdu.focurve.sites;

import jakarta.servlet.http.HttpServletRequest;
import java.util.Map;
import kr.ac.kdu.focurve.auth.WebAuthentication;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/sites")
public class SiteController {
  private final SiteService sites;
  private final WebAuthentication auth;

  public SiteController(SiteService sites, WebAuthentication auth) {
    this.sites = sites;
    this.auth = auth;
  }

  @GetMapping
  public Object list(
      HttpServletRequest req,
      @RequestParam(required = false) String purpose,
      @RequestParam(required = false) String cursor,
      @RequestParam(defaultValue = "20") int limit) {
    return sites.list(auth.require(req), purpose, cursor, limit);
  }

  @GetMapping("/{id}")
  public ResponseEntity<?> get(HttpServletRequest req, @PathVariable long id) {
    return response(sites.get(auth.require(req), id), 200);
  }

  @PostMapping
  public ResponseEntity<?> create(
      HttpServletRequest req,
      @RequestHeader(value = "Idempotency-Key", required = false) String key,
      @RequestBody SiteInput body) {
    return response(sites.create(auth.require(req), key, body), 201);
  }

  @PatchMapping("/{id}")
  public ResponseEntity<?> patch(
      HttpServletRequest req,
      @PathVariable long id,
      @RequestHeader(value = "Idempotency-Key", required = false) String key,
      @RequestHeader(value = "If-Match", required = false) String version,
      @RequestBody Map<String, Object> body) {
    return response(sites.patch(auth.require(req), id, key, version, body), 200);
  }

  @DeleteMapping("/{id}")
  @ResponseStatus(HttpStatus.NO_CONTENT)
  public void delete(
      HttpServletRequest req,
      @PathVariable long id,
      @RequestHeader(value = "Idempotency-Key", required = false) String key,
      @RequestHeader(value = "If-Match", required = false) String version) {
    sites.delete(auth.require(req), id, key, version);
  }

  private ResponseEntity<?> response(Map<String, Object> site, int status) {
    return ResponseEntity.status(status).eTag("\"" + site.get("version") + "\"").body(site);
  }
}
