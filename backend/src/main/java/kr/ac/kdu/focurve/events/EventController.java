package kr.ac.kdu.focurve.events;

import jakarta.servlet.http.HttpServletRequest;
import java.util.*;
import kr.ac.kdu.focurve.execution.MemberLinks;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/events")
public class EventController {
  private final EventService service;
  private final MemberLinks links;

  public EventController(EventService service, MemberLinks links) {
    this.service = service;
    this.links = links;
  }

  public record Batch(List<Map<String, Object>> events) {}

  public record Status(List<String> event_ids) {}

  @PostMapping("/batch")
  public Object batch(@RequestBody Batch b, HttpServletRequest req) {
    return service.batch(links.access(req.getHeader("Authorization")), b.events());
  }

  @PostMapping("/status")
  public Object status(@RequestBody Status s, HttpServletRequest req) {
    return service.status(links.access(req.getHeader("Authorization")), s.event_ids());
  }
}
