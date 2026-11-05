package kr.ac.kdu.focurve;
import com.fasterxml.jackson.databind.*;import com.fasterxml.jackson.databind.node.*;import java.util.*;
import static kr.ac.kdu.focurve.MemberAuth.*;import static kr.ac.kdu.focurve.MemberIntervals.text;
/** Opt-in independent proposal. No schema migration, Native contract change,
 * token replay or operating-profile enablement. Caller owns existing tx. */
final class SameOwnerRecovery {

 static AuthRecoveryScope.Grant scope(MemberAuth a){return AuthRecoveryScope.read(a.recoveryGrant,a.recoveryGrantSHA,a.recoveryGate,java.time.Instant.now());}
 static void bound(MemberAuth a,String ex,String owner){var g=scope(a);check(g.executor().equals(ex)&&g.owner().equals(owner)&&g.origin().equals(a.origin)&&a.callbacks.contains(g.callback()),409,"RECOVERY_OWNER_MISMATCH");}
 static void serverSafe(MemberAuth a,String ex){
  check(("focurve_user_"+scope(a).installation()).equals(a.db.queryForObject("SELECT DATABASE()",String.class)),409,"RECOVERY_DATABASE_MISMATCH");
  check(a.one("SELECT user_id FROM active_execution_locks WHERE executor_id=?",ex)==null,409,"RELEASE_UNCONFIRMED");
  check(a.one("SELECT id FROM focus_sessions WHERE executor_id=? AND (execution_status IS NULL OR execution_status NOT IN ('ENDED','START_FAILED','INTERRUPTED')) LIMIT 1",ex)==null,409,"RECOVERY_SESSION_UNCONFIRMED");
  check(a.one("SELECT event_id FROM event_receipts WHERE executor_id=? AND (status IS NULL OR status <> 'ACCEPTED') LIMIT 1",ex)==null,409,"RECOVERY_RECEIPT_UNCONFIRMED");
 }
 static void admit(MemberAuth a,String path,JsonNode body){
  var g=scope(a);
  if(path.equals("/extension-link-requests")){bound(a,text(body,"executor_id"),text(body,"recovery_owner_user_id"));return;}
  String id=path.equals("/extension-tokens")?text(body,"link_request_id"):path.split("/")[2];
  var row=a.one("SELECT * FROM link_requests WHERE id=? FOR UPDATE",id);check(row!=null,409,"RECOVERY_EVIDENCE_INVALID");var p=claim(a,row);
  check(p!=null&&g.operation().equals(text(p,"operation_id"))&&g.executor().equals(Objects.toString(row.get("executor_id"),""))&&g.owner().equals(text(p,"owner")),409,"RECOVERY_OWNER_MISMATCH");
 }
 static ObjectNode status(MemberAuth a,jakarta.servlet.http.HttpServletRequest req){
  var g=scope(a);String ex=Objects.toString(req.getHeader("X-Installation-Id"),"");a.installation(req,ex);bound(a,ex,g.owner());
  var row=a.one("SELECT * FROM extension_installations WHERE id=?",ex);check(row!=null&&Objects.toString(row.get("current_user_id"),"").equals(g.owner()),409,"RECOVERY_OWNER_MISMATCH");serverSafe(a,ex);
  return a.obj("contract","FOCURVE_MEMBER_REAUTH_READY_1","operation_id",g.operation(),"executor_id",ex,"owner_user_id",g.owner(),"web_origin",g.origin(),"callback_uri",g.callback(),"not_after",g.end().toString(),"focus_allowed",false);
 }
 static final String KEY="_same_owner_recovery";
 static ObjectNode claim(MemberAuth a,Map<String,Object> row){
  Object raw=row.get("execution_evidence");if(raw==null)return null;
  try{JsonNode n=a.json.readTree(raw.toString()).get(KEY);if(n==null)return null;ObjectNode p=(ObjectNode)n;
   check("SAME_OWNER_RECOVERY_1_CANDIDATE".equals(text(p,"version"))&&Objects.toString(row.get("id"),"").equals(text(p,"link_id"))&&Objects.toString(row.get("executor_id"),"").equals(text(p,"executor_id"))&&java.security.MessageDigest.isEqual(text(p,"seal").getBytes(java.nio.charset.StandardCharsets.UTF_8),seal(a,p).getBytes(java.nio.charset.StandardCharsets.UTF_8)),409,"RECOVERY_EVIDENCE_INVALID");return p;}
  catch(Exception e){throw new Failure(409,"RECOVERY_EVIDENCE_INVALID");}
 }
 static String seal(MemberAuth a,JsonNode p){
  try{var mac=javax.crypto.Mac.getInstance("HmacSHA256");mac.init(new javax.crypto.spec.SecretKeySpec(a.encryptionKey,"HmacSHA256"));String payload="FOCURVE_SAME_OWNER_RECOVERY_1\u0000"+a.json.writeValueAsString(java.util.List.of(text(p,"version"),text(p,"operation_id"),text(p,"link_id"),text(p,"executor_id"),text(p,"owner"),p.path("auth_version").asLong(-1),p.path("idle_confirmed").asBoolean()));return java.util.HexFormat.of().formatHex(mac.doFinal(payload.getBytes(java.nio.charset.StandardCharsets.UTF_8)));}catch(Exception e){throw new Failure(409,"RECOVERY_EVIDENCE_INVALID");}
 }
 static ObjectNode begin(MemberAuth a,JsonNode b,String ex,String linkId){
  if(!b.has("recovery_owner_user_id"))return null;
  scope(a);
  String owner=text(b,"recovery_owner_user_id");check(owner.matches("[1-9][0-9]{0,17}"),422,"VALIDATION_FAILED");bound(a,ex,owner);check(text(b,"callback_uri").equals(scope(a).callback()),409,"RECOVERY_OWNER_MISMATCH");serverSafe(a,ex);
  var i=a.one("SELECT * FROM extension_installations WHERE id=? FOR UPDATE",ex);
  check(i!=null&&Objects.toString(i.get("current_user_id"),"").equals(owner),409,"RECOVERY_OWNER_MISMATCH");
  check(a.one("SELECT user_id FROM active_execution_locks WHERE executor_id=?",ex)==null,409,"RELEASE_UNCONFIRMED");
  ObjectNode p=a.obj("version","SAME_OWNER_RECOVERY_1_CANDIDATE","operation_id",scope(a).operation(),"link_id",linkId,"executor_id",ex,"owner",owner,"auth_version",a.authVersion(Long.parseLong(owner)),"idle_confirmed",false);p.put("seal",seal(a,p));return p;
 }
 static void validate(MemberAuth a,Map<String,Object> l,long webOwner){
  ObjectNode p=claim(a,l);if(p==null)return;
  scope(a);
  check(scope(a).operation().equals(text(p,"operation_id")),409,"RECOVERY_SCOPE_CHANGED");String owner=text(p,"owner");bound(a,Objects.toString(l.get("executor_id"),""),owner);serverSafe(a,Objects.toString(l.get("executor_id"),""));check(owner.equals(Long.toString(webOwner)),409,"RECOVERY_OWNER_MISMATCH");
  check(p.path("auth_version").asLong(-1)==a.authVersion(webOwner),409,"RECOVERY_GENERATION_CHANGED");
  var i=a.one("SELECT * FROM extension_installations WHERE id=? FOR UPDATE",l.get("executor_id"));
  check(i!=null&&Objects.toString(i.get("current_user_id"),"").equals(owner),409,"RECOVERY_OWNER_MISMATCH");
  check(a.one("SELECT user_id FROM active_execution_locks WHERE executor_id=?",l.get("executor_id"))==null,409,"RELEASE_UNCONFIRMED");
  check(p.path("idle_confirmed").asBoolean(false),409,"EXECUTION_EVIDENCE_REQUIRED");
 }
 static ObjectNode evidence(MemberAuth a,Map<String,Object> l,JsonNode body){
  ObjectNode clean=((ObjectNode)body).deepCopy();clean.remove(KEY);
  ObjectNode stored=claim(a,l);if(stored!=null){stored=stored.deepCopy();stored.put("idle_confirmed",true);stored.put("seal",seal(a,stored));clean.set(KEY,stored);}return clean;
 }
 static void retire(MemberAuth a,Map<String,Object> l,long owner){
  if(claim(a,l)==null)return;validate(a,l,owner);
  a.db.update("UPDATE extension_tokens SET revoked_at=COALESCE(revoked_at,?) WHERE executor_id=? AND user_id=?",now(),l.get("executor_id"),owner);
 }
}
