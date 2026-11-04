package kr.ac.kdu.focurve;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.sql.Timestamp;
import java.time.*;
import java.util.*;
import static kr.ac.kdu.focurve.MemberAuth.*;

/** No provider, HTTP client, dispatch worker or acceptance of unspecified notices. */
final class AnalysisSafety {
 static final int TIMEOUT_SECONDS=60,RETRIES=1,CACHE_HOURS=24;
 final MemberAuth auth;
 AnalysisSafety(MemberAuth auth){this.auth=auth;}
 ObjectNode consent(long user){
  var row=auth.one("SELECT * FROM analysis_consents WHERE user_id=?",user);
  return auth.obj("accepted",row!=null&&Boolean.TRUE.equals(row.get("accepted")),"notice_version",row==null?null:row.get("notice_version"),
   "version",row==null?0:row.get("version"),"updated_at",row==null?null:instant(row.get("updated_at")),"provider_configured",false);
 }
 ObjectNode withdraw(long user,JsonNode body,String match,String key,Instant at){
  check(body.isObject()&&body.size()==2&&body.path("accepted").isBoolean()&&body.path("notice_version").isTextual()&&body.path("notice_version").asText().length()>=1&&body.path("notice_version").asText().length()<=40,422,"VALIDATION_FAILED");
  new DailyFocusGoal(auth).owner(user);
  // The provider/notice contract is deliberately unavailable; no synthetic consent is minted.
  check(!body.path("accepted").asBoolean(),503,"PROVIDER_UNAVAILABLE");
  return Option12Writes.once(auth,user,"/api/v1/analysis-consent",body,match,key,()->{
   var prior=consent(user);Option12Writes.expected(match,prior.path("version").asLong());
   check(prior.path("notice_version").isNull()||prior.path("notice_version").asText().equals(body.path("notice_version").asText()),412,"VERSION_CONFLICT");
   long version=Option12Writes.next(prior.path("version").asLong());
   auth.db.update("INSERT INTO analysis_consents VALUES(?,false,?,?,?) ON DUPLICATE KEY UPDATE accepted=false,version=VALUES(version),updated_at=VALUES(updated_at)",user,body.path("notice_version").asText(),version,Timestamp.from(at));
   // The same account lock fences admission/withdrawal. No new attempts can be
   // dispatched by this implementation; in-flight legacy outcomes are preserved.
   return consent(user);
  });
 }
 void rejectSubmission(long user,JsonNode body){
  check(body.isObject()&&body.size()==3&&body.path("from_date").isTextual()&&body.path("to_date").isTextual()&&body.path("consent_version").isTextual(),422,"VALIDATION_FAILED");
  var from=LocalDate.parse(body.path("from_date").asText());var to=LocalDate.parse(body.path("to_date").asText());
  check(!to.isBefore(from)&&java.time.temporal.ChronoUnit.DAYS.between(from,to)<366,422,"VALIDATION_FAILED");
  var consent=consent(user);check(consent.path("accepted").asBoolean()&&consent.path("notice_version").asText().equals(body.path("consent_version").asText()),403,"CONSENT_REQUIRED");
  throw new Failure(503,"PROVIDER_UNAVAILABLE");
 }
 /** Internal immutable snapshot, not a new provider/wire schema. as_of must be
  * the supplied source cutoff, never a changing GET timestamp. Future dispatch
  * still requires the unapproved provider/notice/input contract. */
 record Input(String json,String hash,String asOf) {}
 static Input freeze(String from,String to,String sourceCutoff,JsonNode aggregates){
  Instant.parse(sourceCutoff);LocalDate.parse(from);LocalDate.parse(to);
  Set<String> allowed=Set.of("active_duration_ms","completed_sessions","total_access","repeat_access","blocked_access");
  check(aggregates.isObject(),422,"VALIDATION_FAILED");var keys=new TreeSet<String>();aggregates.fieldNames().forEachRemaining(keys::add);
  var canonical=new com.fasterxml.jackson.databind.ObjectMapper().createObjectNode();
  for(String key:keys){check(allowed.contains(key),422,"VALIDATION_FAILED");var n=aggregates.get(key);check(n.isNull()||n.isIntegralNumber()&&n.canConvertToLong()&&n.asLong()>=0,422,"VALIDATION_FAILED");canonical.set(key,n.deepCopy());}
  var value=new com.fasterxml.jackson.databind.ObjectMapper().createObjectNode().put("from_date",from).put("to_date",to).put("as_of",sourceCutoff);value.set("metrics",canonical);
  return new Input(value.toString(),MemberAuth.hash(value.toString()),sourceCutoff);
 }
 static boolean reusable(Input stored,Input current,Instant created,Instant now,String model,String requestedModel){
  return !now.isBefore(created)&&now.isBefore(created.plus(Duration.ofHours(CACHE_HOURS)))&&Objects.equals(model,requestedModel)&&stored.hash.equals(current.hash);
 }
}
