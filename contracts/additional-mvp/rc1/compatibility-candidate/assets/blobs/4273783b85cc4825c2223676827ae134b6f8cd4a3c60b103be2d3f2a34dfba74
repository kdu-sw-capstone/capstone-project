package kr.ac.kdu.focurve;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.context.annotation.Profile;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.bind.annotation.*;
import java.util.*;
import static kr.ac.kdu.focurve.MemberAuth.*;
@Profile("member-runtime | local-integration")
@RestController
@RequestMapping("/api/v1/sessions/{uuid}/note")
class MemberSessionNotes {
 final MemberAuth a; final MemberExecution e; final TransactionTemplate tx;
 MemberSessionNotes(MemberAuth a,MemberExecution e,PlatformTransactionManager tm){this.a=a;this.e=e;tx=new TransactionTemplate(tm);}
 @GetMapping ResponseEntity<?> get(@PathVariable("uuid") String uuid,HttpServletRequest req){return run(req,uuid,null,null);}
 @PutMapping ResponseEntity<?> put(@PathVariable("uuid") String uuid,@RequestHeader(value="If-Match",required=false)String match,@RequestBody JsonNode body,HttpServletRequest req){return run(req,uuid,match,body);}
 ResponseEntity<?> run(HttpServletRequest req,String uuid,String match,JsonNode body){
  try{ObjectNode value=tx.execute(t->{Identity i=a.identity(req,!req.getMethod().equals("GET"));check(i.executor()==null,403,"WEB_AUTH_REQUIRED");e.session(uuid,i);long sid=e.internal(uuid);ObjectNode before=read(sid,uuid);
   if(req.getMethod().equals("PUT")){check(match!=null,428,"PRECONDITION_REQUIRED");check(match.equals("\""+before.path("version").asLong()+"\""),412,"VERSION_CONFLICT");check(body!=null&&body.isObject()&&body.size()==1&&body.has("text")&&body.path("text").isTextual(),422,"VALIDATION_FAILED");String text=body.path("text").asText();check(text.codePointCount(0,text.length())<=2000,422,"VALIDATION_FAILED");check(before.path("version").asLong()<9007199254740991L,409,"VERSION_CONFLICT");a.db.update("INSERT INTO session_notes(session_id,text,version,updated_at) VALUES (?,?,1,UTC_TIMESTAMP(3)) ON DUPLICATE KEY UPDATE text=?,version=version+1,updated_at=UTC_TIMESTAMP(3)",sid,text,text);return read(sid,uuid);}
   return before;});return ResponseEntity.ok().eTag("\""+value.path("version").asLong()+"\"").body(value);
  }catch(Failure f){return ResponseEntity.status(f.status).body(a.obj("error",Map.of("code",f.code,"retryable",false)));}
 }
 ObjectNode read(long sid,String uuid){var row=a.one("SELECT text,version FROM session_notes WHERE session_id=?",sid);return a.obj("session_id",uuid,"text",row==null?"":row.get("text"),"version",row==null?0L:row.get("version"));}
}
