package kr.ac.kdu.focurve.imports;

import jakarta.servlet.http.HttpServletRequest;
import kr.ac.kdu.focurve.auth.WebAuthentication;
import kr.ac.kdu.focurve.execution.MemberLinks;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/guest-imports")
public class ImportController {
  private final ImportQueries queries;
  private final WebAuthentication web;
  private final MemberLinks links;
  private final ImportService service;

  public ImportController(
      ImportQueries queries, WebAuthentication web, MemberLinks links, ImportService service) {
    this.queries = queries;
    this.web = web;
    this.links = links;
    this.service = service;
  }

  @PostMapping
  @ResponseStatus(org.springframework.http.HttpStatus.ACCEPTED)
  public Object create(
      @RequestBody java.util.Map<String, Object> body,
      @RequestHeader("Idempotency-Key") String key,
      HttpServletRequest request) {
    return service.create(links.access(request.getHeader("Authorization")), key, body);
  }

  @PutMapping("/{id}/items/{source}")
  public Object upload(
      @PathVariable String id,
      @PathVariable String source,
      @RequestBody java.util.Map<String, Object> body,
      HttpServletRequest request) {
    return service.upload(links.access(request.getHeader("Authorization")), id, source, body);
  }

  @GetMapping("/{id}")
  public Object get(@PathVariable String id, HttpServletRequest request) {
    return queries.get(web.require(request), id);
  }

  @GetMapping
  public Object list(@RequestParam(required = false) String cursor, HttpServletRequest request) {
    return queries.list(web.require(request), cursor);
  }
}
