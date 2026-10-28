package kr.ac.kdu.focurve;

import com.fasterxml.jackson.databind.*;
import com.fasterxml.jackson.databind.node.*;
import jakarta.servlet.http.HttpServletRequest;
import java.nio.file.*;
import java.time.*;
import java.security.MessageDigest;
import java.util.*;
import static kr.ac.kdu.focurve.MemberAuth.*;
import static kr.ac.kdu.focurve.MemberIntervals.*;

/** Explicit owner provisioned termination authority. No login, refresh, START or HOLD transition.
 * The existing API transaction encloses all checks and existing reconcile/report mutations. */
final class PreservedEndScope {
 static JsonNode read(MemberAuth a,Instant now){
  try{
   check(a.preservedEndGrant!=null&&!a.preservedEndGrant.isBlank()&&a.preservedEndSHA.matches("[a-f0-9]{64}"),409,"PRESERVED_END_SCOPE_REQUIRED");
   Path p=Path.of(a.preservedEndGrant).toAbsolutePath().normalize(),m=Path.of(a.recoveryGate).toAbsolutePath().normalize();
   check(p.getFileName().toString().equals("preserved-end-grant.json")&&p.getParent().equals(m.getParent())&&!Files.isSymbolicLink(p)&&!Files.isSymbolicLink(m)&&Files.isRegularFile(p)&&Files.isRegularFile(m)&&Files.size(p)<=4096,409,"PRESERVED_END_SCOPE_INVALID");
   byte[] raw=Files.readAllBytes(p);check(HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(raw)).equals(a.preservedEndSHA),409,"PRESERVED_END_SCOPE_CHANGED");
   JsonNode g=a.json.readTree(raw);Set<String> keys=new HashSet<>();g.fieldNames().forEachRemaining(keys::add);
   check(keys.equals(Set.of("contract","installation_id","extension_id","profile_instance","operation_id","executor_id","owner_user_id","session_id","policy_snapshot_id","base_revision","origin","callback","not_before","not_after"))&&text(g,"contract").equals("FOCURVE_PRESERVED_END_SCOPE_1"),409,"PRESERVED_END_SCOPE_INVALID");
   for(String key:List.of("installation_id","profile_instance","operation_id"))check(text(g,key).matches("[a-f0-9]{32}"),409,"PRESERVED_END_SCOPE_INVALID");
   for(String key:List.of("executor_id","session_id","policy_snapshot_id"))uuid(text(g,key));
   check(p.getParent().getFileName().toString().equals(text(g,"installation_id"))&&text(g,"owner_user_id").matches("[1-9][0-9]{0,17}")&&g.path("base_revision").isIntegralNumber()&&g.path("base_revision").canConvertToLong()&&g.path("base_revision").asLong()>0&&g.path("base_revision").asLong()<9007199254740991L&&text(g,"extension_id").matches("[a-p]{32}")&&text(g,"callback").equals("chrome-extension://"+text(g,"extension_id")+"/popup/popup.html")&&a.callbacks.contains(text(g,"callback"))&&text(g,"origin").equals(a.origin),409,"PRESERVED_END_SCOPE_INVALID");
   Instant begin=Instant.parse(text(g,"not_before")),end=Instant.parse(text(g,"not_after"));
   check(!now.isBefore(begin)&&now.isBefore(end)&&end.isAfter(begin)&&Duration.between(begin,end).toMillis()<=1200000,409,"PRESERVED_END_SCOPE_EXPIRED");return g;
  }catch(Failure f){throw f;}catch(Exception e){throw new Failure(409,"PRESERVED_END_SCOPE_INVALID");}
 }
 static ObjectNode route(MemberAuth a,MemberExecution e,HttpServletRequest req,String p,String method,JsonNode b,String raw){
  JsonNode g=read(a,Instant.now());String ex=text(g,"executor_id"),sid=text(g,"session_id"),owner=text(g,"owner_user_id");
  boolean status=method.equals("GET")&&p.equals("/install/preserved-end"),session=method.equals("GET")&&p.equals("/sessions/"+sid),reconcile=method.equals("POST")&&p.equals("/executors/"+ex+"/reconcile"),report=method.equals("POST")&&p.equals("/executors/"+ex+"/reports");
  check(status||session||reconcile||report,403,"PRESERVED_END_ONLY");
  check(ex.equals(req.getHeader("X-Installation-Id")),403,"PRESERVED_END_OWNER_MISMATCH");a.installation(req,ex);
  check(("focurve_user_"+text(g,"installation_id")).equals(a.db.queryForObject("SELECT DATABASE()",String.class)),409,"PRESERVED_END_DATABASE_MISMATCH");
  var install=a.one("SELECT * FROM extension_installations WHERE id=? FOR UPDATE",ex);check(install!=null&&Objects.toString(install.get("current_user_id"),"").equals(owner),409,"PRESERVED_END_OWNER_MISMATCH");
  Identity i=new Identity(Long.parseLong(owner),ex);e.ownerLock(i);ObjectNode s=e.session(sid,i);long internal=e.internal(sid),base=g.path("base_revision").asLong();
  boolean ended=text(s,"execution_status").equals("ENDED")&&s.hasNonNull("policy_released_at");
  check(text(s,"session_id").equals(sid)&&text(s,"owner_user_id").equals(owner)&&text(s,"executor_id").equals(ex)&&text(s,"policy_snapshot_id").equals(text(g,"policy_snapshot_id"))&&(ended?s.path("desired_revision").asLong()==base+1:Set.of("UNKNOWN","ENDING").contains(text(s,"execution_status"))&&s.path("desired_revision").asLong()==base),409,"PRESERVED_END_SESSION_MISMATCH");
  var lock=a.one("SELECT * FROM active_execution_locks WHERE user_id=? FOR UPDATE",i.user());
  check(ended?lock==null:lock!=null&&Objects.toString(lock.get("executor_id"),"").equals(ex)&&Objects.toString(lock.get("session_id"),"").equals(Long.toString(internal))&&Objects.toString(lock.get("revision"),"").equals(Long.toString(base)),409,"PRESERVED_END_LOCK_MISMATCH");
  check(a.one("SELECT id FROM focus_sessions WHERE executor_id=? AND id<>? AND (execution_status IS NULL OR execution_status NOT IN ('ENDED','START_FAILED','INTERRUPTED')) LIMIT 1",ex,internal)==null&&a.one("SELECT event_id FROM event_receipts WHERE executor_id=? AND (status IS NULL OR status<>'ACCEPTED') LIMIT 1",ex)==null,409,"PRESERVED_END_OTHER_OBLIGATIONS");
  if(status)return a.obj("operation_id",text(g,"operation_id"),"session_id",sid,"owner_user_id",owner,"executor_id",ex,"server_ended",ended,"lock_released",lock==null,"focus_allowed",false,"not_after",text(g,"not_after"));
  if(session)return s;
  if(reconcile){
   check(b.path("local_actions").isArray()&&b.path("local_actions").size()==1&&text(b.path("journal_summary"),"session_id").equals(sid),409,"PRESERVED_END_ACTION_MISMATCH");
   JsonNode action=b.path("local_actions").get(0);check(text(action,"type").equals("END")&&text(action,"session_id").equals(sid)&&text(action,"policy_snapshot_id").equals(text(g,"policy_snapshot_id"))&&action.path("base_revision").asLong(-1)==base,409,"PRESERVED_END_ACTION_MISMATCH");
   // A fresh owner grant may acknowledge the old immutable local END. Existing
   // reconcile verifies its command/session/snapshot and immutable action hash.
   check(!Instant.parse(text(action.path("report"),"observed_at")).isAfter(Instant.now()),409,"PRESERVED_END_ACTION_MISMATCH");
   ObjectNode result=e.reconcile(i,ex,b);read(a,Instant.now());return result;
  }
  // Old reports are admitted only after terminal release advanced the revision.
  // Existing report IDs and bodies remain immutable and use existing deduplication.
  check(ended&&text(b,"session_id").equals(sid)&&text(b,"executor_id").equals(ex)&&b.path("desired_revision").asLong(-1)==base&&!Instant.parse(text(b,"observed_at")).isAfter(Instant.parse(text(g,"not_before"))),409,"PRESERVED_END_REPORT_MISMATCH");
  ObjectNode result=e.report(i,ex,b,raw);read(a,Instant.now());return result;
 }
}
