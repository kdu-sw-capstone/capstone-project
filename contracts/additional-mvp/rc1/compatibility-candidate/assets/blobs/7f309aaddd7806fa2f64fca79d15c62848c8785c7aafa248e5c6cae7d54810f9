package kr.ac.kdu.focurve.execution;

import jakarta.servlet.http.HttpServletRequest;
import java.util.Map;
import kr.ac.kdu.focurve.auth.WebAuthentication;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/sessions/{uuid}/note")
public class SessionNoteController {
  private final SessionNotes notes;private final WebAuthentication auth;
  public SessionNoteController(SessionNotes notes,WebAuthentication auth){this.notes=notes;this.auth=auth;}
  @GetMapping
  public ResponseEntity<?> get(@PathVariable String uuid,HttpServletRequest req){return response(notes.get(auth.require(req),uuid));}
  @PutMapping
  public ResponseEntity<?> put(@PathVariable String uuid,@RequestHeader(value="If-Match",required=false)String match,@RequestBody Map<String,Object> body,HttpServletRequest req){return response(notes.put(auth.require(req),uuid,match,body));}
  private ResponseEntity<?> response(Map<String,Object> note){return ResponseEntity.ok().eTag("\""+note.get("version")+"\"").body(note);}
}
