package kr.ac.kdu.focurve;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.sql.Timestamp;
import java.time.*;
import java.util.*;
import static kr.ac.kdu.focurve.MemberAuth.*;
import static kr.ac.kdu.focurve.AmvpBridgeSupport.*;

/** Server adapter for the existing schedule actor routes, never a RuntimePackage carrier. */
final class AmvpScheduleBridge implements AdditionalConfigStore.Admission {
 record Request(String requestId,String scheduleId,long version,Binding owner,Instant start,Instant end){}
 interface Actor {
  /** Same DB transaction: persist the existing actor command/session only. No remote effects here.
   * Return its persisted STARTING Session. Request ID is the immutable occurrence ID;
   * the actor must retain the fixed end and apply the existing D06/ACK contracts. */
  ObjectNode enqueue(Identity principal,Request request);
  /** Verify actual Core effect/release evidence behind this existing execution report.
   * Implementations must reject unverified evidence; transport OK is insufficient. */
  void verifyReport(Identity principal,Request request,ObjectNode report);
 }
 private final MemberAuth a;private final AdditionalConfigStore.Admission delegate;
 private final Actor actor;private final Clock clock;private final AdditionalConfigContract contract;
 AmvpScheduleBridge(MemberAuth auth,AdditionalConfigStore.Admission delegate,Actor actor,Clock clock){a=auth;this.delegate=delegate;this.actor=actor;this.clock=clock;contract=new AdditionalConfigContract(a.json);}
 public void verify(Identity principal,String executor,String binding,boolean mutation){delegate.verify(principal,executor,binding,mutation);}
 public AdditionalConfigStore.ApplyState appliedState(Map<String,Object> config){
  return config.get("kind").equals("FOCUS_SCHEDULE")?new AdditionalConfigStore.ApplyState("PENDING",null):delegate.appliedState(config);
 }
 public void publish(String binding,String configId,long revision,JsonNode value,boolean deleted){
  if(!value.path("kind").asText().equals("FOCUS_SCHEDULE")){delegate.publish(binding,configId,revision,value,deleted);return;}
  transaction();contract.validate("FocusSchedule",value);
  // RC2 explicitly leaves ONCE on the legacy actor route REVIEW_PENDING. Do not invent a wire extension.
  check(value.path("when").path("recurrence").asText().equals("WEEKLY"),503,"UNSUPPORTED_CONTRACT");
  var owner=a.one("SELECT user_id,executor_id FROM amvp_owner_bindings WHERE binding_id=?",binding);check(owner!=null,409,"STALE_OWNER");
  var prior=a.one("SELECT owner_binding_id FROM schedules WHERE id=? FOR UPDATE",configId);check(prior==null||prior.get("owner_binding_id").equals(binding),409,"STALE_OWNER");
  var config=a.one("SELECT version FROM amvp_configs WHERE config_id=? AND owner_binding_id=?",configId,binding);check(config!=null,409,"STALE_OWNER");
  var when=value.path("when");Object at=now();
  a.db.update("INSERT INTO schedules(id,owner_binding_id,user_id,executor_id,name,weekdays,start_local,timezone,duration_minutes,enabled,version,created_at,updated_at,deleted_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE name=VALUES(name),weekdays=VALUES(weekdays),start_local=VALUES(start_local),timezone=VALUES(timezone),duration_minutes=VALUES(duration_minutes),enabled=VALUES(enabled),version=VALUES(version),updated_at=VALUES(updated_at),deleted_at=VALUES(deleted_at)",configId,binding,owner.get("user_id"),owner.get("executor_id"),value.path("name").asText(),when.path("weekdays").toString(),when.path("start_local").asText(),when.path("timezone").asText(),value.path("duration_minutes").asInt(),!deleted&&value.path("enabled").asBoolean(),config.get("version"),at,at,deleted?at:null);
  // Never cancel an already issued session or rewrite an old occurrence's frozen version/end.
  a.db.update("UPDATE schedule_occurrences SET status='SKIPPED',reason='CONFIG_CHANGED' WHERE schedule_id=? AND session_id IS NULL AND status IN ('PENDING','WAITING_CONFLICT')",configId);
 }
 private Map<String,Object> owned(Identity principal,String id,boolean mutation){
  contract.validate("Uuid",a.json.valueToTree(id));
  var row=a.one("SELECT * FROM schedules WHERE id=? AND user_id=?"+(principal.executor()==null?"":" AND executor_id=?"),principal.executor()==null?new Object[]{id,principal.user()}:new Object[]{id,principal.user(),principal.executor()});
  check(row!=null,404,"RESOURCE_NOT_FOUND");
  var installation=a.one("SELECT current_user_id FROM extension_installations WHERE id=?"+(mutation?" FOR UPDATE":""),row.get("executor_id"));
  check(installation!=null&&installation.get("current_user_id") instanceof Number&&((Number)installation.get("current_user_id")).longValue()==principal.user(),404,"RESOURCE_NOT_FOUND");
  var owner=a.one("SELECT * FROM amvp_owner_bindings WHERE binding_id=? AND executor_id=? AND user_id=? AND state='ACTIVE' AND closed_at IS NULL"+(mutation?" FOR UPDATE":""),row.get("owner_binding_id"),row.get("executor_id"),principal.user());
  check(owner!=null,409,"STALE_OWNER");delegate.verify(principal,row.get("executor_id").toString(),row.get("owner_binding_id").toString(),mutation);
  if(mutation)row=a.one("SELECT * FROM schedules WHERE id=? FOR UPDATE",id);
  return row;
 }
 static Optional<Instant> weekly(LocalDate date,LocalTime time,ZoneId zone){
  LocalDateTime local=date.atTime(time);var offsets=zone.getRules().getValidOffsets(local);
  return offsets.isEmpty()?Optional.empty():Optional.of(local.toInstant(offsets.getFirst()));
 }
 private void validStart(Map<String,Object> schedule,Instant start){
  var zone=ZoneId.of(schedule.get("timezone").toString());var local=start.atZone(zone);
  try{JsonNode days=a.json.readTree(schedule.get("weekdays").toString());boolean match=false;for(var day:days)match|=day.asInt()==local.getDayOfWeek().getValue();
   check(match&&weekly(local.toLocalDate(),LocalTime.parse(schedule.get("start_local").toString()),zone).filter(start::equals).isPresent(),422,"VALIDATION_FAILED");
  }catch(java.io.IOException invalid){throw new Failure(503,"STORE_UNCONFIRMED");}
 }
 ObjectNode schedules(Identity principal,String executor){
  contract.validate("Uuid",a.json.valueToTree(executor));check(principal.executor()==null||principal.executor().equals(executor),404,"RESOURCE_NOT_FOUND");
  var result=a.obj("next_cursor",null,"has_more",false);var items=result.putArray("items");
  var rows=a.db.queryForList("SELECT id FROM schedules WHERE user_id=? AND executor_id=? ORDER BY id LIMIT 101",principal.user(),executor);
  check(rows.size()<=100,503,"TOO_LARGE");
  for(var row:rows){var s=owned(principal,row.get("id").toString(),false);var value=a.obj("schedule_id",s.get("id"),"executor_id",executor,"name",s.get("name"),"start_local",s.get("start_local"),"timezone",s.get("timezone"),"duration_minutes",s.get("duration_minutes"),"enabled",s.get("enabled"),"version",s.get("version"),"created_at",instant(s.get("created_at")),"updated_at",instant(s.get("updated_at")),"deleted_at",s.get("deleted_at")==null?null:instant(s.get("deleted_at")));try{value.set("weekdays",a.json.readTree(s.get("weekdays").toString()));}catch(java.io.IOException e){throw new Failure(503,"STORE_UNCONFIRMED");}items.add(value);}
  return result;
 }
 ObjectNode claim(Identity principal,ObjectNode body){
  check(principal.executor()!=null,403,"FORBIDDEN_EXECUTOR");
  check(body.size()==3&&body.has("schedule_id")&&body.has("scheduled_start_at")&&body.path("version").isIntegralNumber()&&body.path("version").canConvertToLong()&&body.path("version").asLong()>0,400,"VALIDATION_FAILED");
  contract.validate("Utc",body.path("scheduled_start_at"));Instant start=Instant.parse(body.path("scheduled_start_at").asText());String id=body.path("schedule_id").asText();
  a.one("SELECT id FROM users WHERE id=? FOR UPDATE",principal.user());
  var schedule=owned(principal,id,true);long version=((Number)schedule.get("version")).longValue();check(version==body.path("version").asLong(),409,"VERSION_CONFLICT");
  check(schedule.get("deleted_at")==null&&Boolean.TRUE.equals(schedule.get("enabled")),409,"VERSION_CONFLICT");validStart(schedule,start);
  var existing=a.one("SELECT * FROM schedule_occurrences WHERE schedule_id=? AND scheduled_start_at=? FOR UPDATE",id,Timestamp.from(start));
  check(existing==null||((Number)existing.get("schedule_version")).longValue()==version,409,"VERSION_CONFLICT");
  if(existing!=null&&existing.get("session_id")!=null){var saved=a.one("SELECT body FROM focus_sessions WHERE id=? AND user_id=? AND executor_id=?",existing.get("session_id"),principal.user(),principal.executor());check(saved!=null,503,"STORE_UNCONFIRMED");return parse(saved.get("body"));}
  if(existing!=null&&existing.get("status").equals("SKIPPED"))return occurrence(principal,schedule,existing);
  Instant end=start.plusSeconds(((Number)schedule.get("duration_minutes")).longValue()*60),at=clock.instant();check(!at.isBefore(start),409,"VALIDATION_FAILED");
  String occurrenceId=existing==null?id():existing.get("id").toString();
  if(existing==null)a.db.update("INSERT INTO schedule_occurrences(id,schedule_id,schedule_version,scheduled_start_at,scheduled_end_at,status) VALUES(?,?,?,?,?,'PENDING')",occurrenceId,id,version,Timestamp.from(start),Timestamp.from(end));
  if(Duration.between(at,end).toMillis()<60000)a.db.update("UPDATE schedule_occurrences SET status='SKIPPED',reason='EXPIRED' WHERE id=?",occurrenceId);
  else if(a.one("SELECT session_id FROM active_execution_locks WHERE user_id=? OR executor_id=?",principal.user(),principal.executor())!=null)a.db.update("UPDATE schedule_occurrences SET status='WAITING_CONFLICT',reason=NULL WHERE id=?",occurrenceId);
  else {
   check(actor!=null,503,"CAPABILITY_NOT_VERIFIED");var request=request(schedule,a.one("SELECT * FROM schedule_occurrences WHERE id=?",occurrenceId));
   ObjectNode session=actor.enqueue(principal,request);check(session!=null,503,"RESPONSE_UNCONFIRMED");
   var persisted=a.one("SELECT * FROM focus_sessions WHERE source_session_id=? AND user_id=? AND executor_id=?",session.path("session_id").asText(),principal.user(),principal.executor());
   check(persisted!=null&&persisted.get("execution_status").equals("STARTING"),503,"RESPONSE_UNCONFIRMED");
   var saved=parse(persisted.get("body"));check(saved.path("source").asText().equals("SCHEDULE")&&Instant.parse(saved.path("planned_end_at").asText()).equals(end),503,"RESPONSE_UNCONFIRMED");
   check(a.one("SELECT session_id FROM active_execution_locks WHERE user_id=? AND executor_id=? AND session_id=?",principal.user(),principal.executor(),persisted.get("id"))!=null,503,"RESPONSE_UNCONFIRMED");
   check(a.one("SELECT id FROM execution_commands WHERE session_id=? AND executor_id=? AND desired_revision=? AND kind='APPLY_POLICY'",persisted.get("id"),principal.executor(),persisted.get("desired_revision"))!=null,503,"RESPONSE_UNCONFIRMED");
   a.db.update("UPDATE schedule_occurrences SET status='STARTING',reason=NULL,session_id=? WHERE id=?",persisted.get("id"),occurrenceId);
   return saved;
  }
  return occurrence(principal,schedule,a.one("SELECT * FROM schedule_occurrences WHERE id=?",occurrenceId));
 }
 ObjectNode occurrences(Identity principal,String id){
  var schedule=owned(principal,id,false);var rows=a.db.queryForList("SELECT * FROM schedule_occurrences WHERE schedule_id=? ORDER BY scheduled_start_at DESC LIMIT 101",id);check(rows.size()<=100,503,"TOO_LARGE");
  var result=a.obj("next_cursor",null,"has_more",false);var items=result.putArray("items");for(var row:rows)items.add(occurrence(principal,schedule,row));return result;
 }
 private Request request(Map<String,Object> schedule,Map<String,Object> row){
  var owner=a.one("SELECT owner_epoch FROM amvp_owner_bindings WHERE binding_id=?",schedule.get("owner_binding_id"));
  return new Request(row.get("id").toString(),schedule.get("id").toString(),((Number)row.get("schedule_version")).longValue(),new Binding(schedule.get("owner_binding_id").toString(),schedule.get("executor_id").toString(),((Number)schedule.get("user_id")).longValue(),((Number)owner.get("owner_epoch")).longValue()),Instant.parse(instant(row.get("scheduled_start_at"))),Instant.parse(instant(row.get("scheduled_end_at"))));
 }
 private ObjectNode occurrence(Identity principal,Map<String,Object> schedule,Map<String,Object> row){
  String status=row.get("status").toString(),reason=(String)row.get("reason"),sessionId=null;
  if(row.get("session_id")!=null){
   var session=a.one("SELECT * FROM focus_sessions WHERE id=? AND user_id=? AND executor_id=?",row.get("session_id"),principal.user(),schedule.get("executor_id"));check(session!=null,503,"STORE_UNCONFIRMED");sessionId=session.get("source_session_id").toString();
   // Existing immutable receipts are the source. Failed/uncertain history cannot become success by a later ACK.
   var reports=a.db.queryForList("SELECT * FROM execution_reports WHERE session_id=? AND executor_id=? ORDER BY observed_at DESC,id DESC LIMIT 1",row.get("session_id"),schedule.get("executor_id"));
   boolean unknown=Set.of("UNKNOWN","START_FAILED").contains(session.get("execution_status")),failed=session.get("execution_status").equals("START_FAILED");
   var failure=a.one("SELECT result FROM execution_reports WHERE session_id=? AND result IN ('FAILED','UNCONFIRMED') ORDER BY result LIMIT 1",row.get("session_id"));
   unknown|=failure!=null;failed|=failure!=null&&failure.get("result").equals("FAILED");
   if(unknown){reason=failed?"EXECUTION_FAILED":"EXECUTION_UNKNOWN";}
   if(actor==null||reports.isEmpty()){if(!unknown)reason="EVIDENCE_UNCONFIRMED";}
   else {
    var latest=reports.getFirst();var payload=parse(latest.get("payload"));
    try{check(((Number)latest.get("desired_revision")).longValue()==((Number)session.get("desired_revision")).longValue(),409,"RESPONSE_UNCONFIRMED");
     var command=latest.get("command_id")==null?null:a.one("SELECT kind FROM execution_commands WHERE id=? AND session_id=? AND executor_id=? AND desired_revision=?",latest.get("command_id"),row.get("session_id"),schedule.get("executor_id"),latest.get("desired_revision"));
     check(command!=null&&command.get("kind").equals(latest.get("result").equals("RELEASED")?"RELEASE_POLICY":"APPLY_POLICY"),409,"RESPONSE_UNCONFIRMED");
     check(latest.get("payload_hash").equals(hash(latest.get("payload").toString()))&&payload.path("session_id").asText().equals(sessionId),409,"RESPONSE_UNCONFIRMED");actor.verifyReport(principal,request(schedule,row),payload);
     if(!unknown&&session.get("execution_status").equals("RUNNING")&&latest.get("result").equals("APPLIED"))status="RUNNING";
     else if(session.get("execution_status").equals("ENDED")&&latest.get("result").equals("RELEASED")&&payload.path("rollback_confirmed").asBoolean()&&parse(session.get("body")).hasNonNull("policy_released_at")&&a.one("SELECT session_id FROM active_execution_locks WHERE session_id=?",row.get("session_id"))==null)status="FINISHED";
     else if(!unknown)reason="EVIDENCE_UNCONFIRMED";
    }catch(Failure unconfirmed){if(!unknown)reason="EVIDENCE_UNCONFIRMED";}
   }
  }
  return a.obj("occurrence_id",row.get("id"),"schedule_id",row.get("schedule_id"),"schedule_version",row.get("schedule_version"),"scheduled_start_at",utc(Instant.parse(instant(row.get("scheduled_start_at")))),"scheduled_end_at",utc(Instant.parse(instant(row.get("scheduled_end_at")))),"status",status,"reason",reason,"session_id",sessionId);
 }
 private ObjectNode parse(Object raw){try{return (ObjectNode)a.json.readTree(raw.toString());}catch(java.io.IOException e){throw new Failure(503,"STORE_UNCONFIRMED");}}
}
