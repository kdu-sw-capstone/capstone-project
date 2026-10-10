package kr.ac.kdu.focurve.records;

import jakarta.servlet.http.HttpServletRequest;
import kr.ac.kdu.focurve.auth.WebAuthentication;
import kr.ac.kdu.focurve.execution.ExecutionService;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1")
public class RecordController {
  private final RecordQueries records;
  private final WebAuthentication auth;
  private final ExecutionService execution;

  public RecordController(
      RecordQueries records, WebAuthentication auth, ExecutionService execution) {
    this.records = records;
    this.auth = auth;
    this.execution = execution;
  }

  @GetMapping("/access-events")
  public Object list(
      HttpServletRequest req,
      @RequestParam(required = false) String from_date,
      @RequestParam(required = false) String to_date,
      @RequestParam(required = false) String session_id,
      @RequestParam(required = false) String host,
      @RequestParam(required = false) String event_type,
      @RequestParam(required = false) String cursor,
      @RequestParam(defaultValue = "20") int limit) {
    return records.list(
        auth.require(req), from_date, to_date, session_id, host, event_type, cursor, limit);
  }

  @GetMapping("/access-events/{id}")
  public Object detail(HttpServletRequest req, @PathVariable String id) {
    return records.detail(auth.require(req), id);
  }

  @GetMapping("/statistics/summary")
  public Object summary(
      HttpServletRequest req,
      @RequestParam(required = false) String from_date,
      @RequestParam(required = false) String to_date) {
    return records.summary(auth.require(req), from_date, to_date);
  }

  @GetMapping("/statistics/targets")
  public Object targets(
      HttpServletRequest req,
      @RequestParam(required = false) String from_date,
      @RequestParam(required = false) String to_date,
      @RequestParam(required = false) String cursor) {
    return records.targets(auth.require(req), from_date, to_date, cursor);
  }

  @GetMapping("/statistics/hourly")
  public Object hourly(
      HttpServletRequest req,
      @RequestParam(required = false) String from_date,
      @RequestParam(required = false) String to_date) {
    return records.hourly(auth.require(req), from_date, to_date);
  }

  @GetMapping("/dashboard")
  public Object dashboard(HttpServletRequest req) {
    long owner = auth.require(req);
    return records.dashboard(owner, execution.current(owner));
  }
}
