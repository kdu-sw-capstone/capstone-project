package kr.ac.kdu.focurve.execution;

import jakarta.servlet.http.HttpServletRequest;
import java.util.*;
import kr.ac.kdu.focurve.api.ApiFailure;
import kr.ac.kdu.focurve.auth.WebAuthentication;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1")
public class ExecutionController {
  private final ExecutionService service;
  private final WebAuthentication auth;
  private final MemberLinks links;

  public ExecutionController(ExecutionService service, WebAuthentication auth, MemberLinks links) {
    this.service = service;
    this.auth = auth;
    this.links = links;
  }

  public record Start(String executor_id, int duration_minutes) {}

  @PostMapping("/sessions")
  @ResponseStatus(HttpStatus.ACCEPTED)
  public Object start(
      @RequestBody Start s,
      @RequestHeader(value = "Idempotency-Key", required = false) String key,
      HttpServletRequest req) {
    if (req.getHeader("Authorization") != null) principal(s.executor_id(), req);
    return service.start(auth.require(req), s.executor_id(), s.duration_minutes(), key);
  }

  @GetMapping("/sessions")
  public Object list(
      HttpServletRequest req,
      @RequestParam(required = false) String from_date,
      @RequestParam(required = false) String to_date,
      @RequestParam(required = false) String status,
      @RequestParam(required = false) String cursor) {
    return service.list(auth.require(req), from_date, to_date, status, cursor);
  }

  @GetMapping("/sessions/current")
  public Object current(HttpServletRequest req) {
    return service.current(auth.require(req));
  }

  @GetMapping("/sessions/{uuid}")
  public Object get(@PathVariable String uuid, HttpServletRequest req) {
    var r = service.byUuid(auth.require(req), uuid);
    return service.get(auth.require(req), ((Number) r.get("id")).longValue());
  }

  @GetMapping("/sessions/{uuid}/policy")
  public Object policy(@PathVariable String uuid, HttpServletRequest req) {
    return service.policy(auth.require(req), uuid);
  }

  @PostMapping("/sessions/{uuid}/end")
  @ResponseStatus(HttpStatus.ACCEPTED)
  public Object end(
      @PathVariable String uuid,
      @RequestHeader(value = "Idempotency-Key", required = false) String key,
      HttpServletRequest req) {
    if (req.getHeader("Authorization") != null)
      principal(service.byUuid(auth.require(req), uuid).get("executor_id").toString(), req);
    return service.end(auth.require(req), uuid, key);
  }

  @GetMapping("/operations/{id}")
  public Object operation(@PathVariable String id, HttpServletRequest req) {
    return service.operation(auth.require(req), id);
  }

  @GetMapping("/executors/{executor}/commands")
  public Object commands(@PathVariable String executor, HttpServletRequest req) {
    return service.commands(principal(executor, req));
  }

  @PostMapping("/executors/{executor}/reports")
  public Object report(
      @PathVariable String executor,
      @RequestBody Map<String, Object> body,
      HttpServletRequest req) {
    return service.report(principal(executor, req), body);
  }

  private MemberLinks.Principal principal(String executor, HttpServletRequest req) {
    var p = links.access(req.getHeader("Authorization"));
    if (!p.executor().equals(executor)) throw new ApiFailure(403, "EXECUTOR_MISMATCH");
    return p;
  }

  @PostMapping("/executors/{executor}/reconcile")
  public Object reconcile(
      @PathVariable String executor,
      @RequestBody Map<String, Object> body,
      HttpServletRequest request) {
    return service.reconcile(principal(executor, request), body);
  }
}
