package kr.ac.kdu.focurve;

import com.fasterxml.jackson.databind.*;import com.fasterxml.jackson.databind.node.*;
import java.util.*;import java.time.*;import java.sql.Timestamp;
import static kr.ac.kdu.focurve.MemberAuth.*;import static kr.ac.kdu.focurve.MemberIntervals.*;

/** Historical copy only: never issues execution commands, credentials or active locks. */
final class MemberImportedSession {
 static void validate(JsonNode p,String source,String sourceItem,long now){
  keys(p,"snapshot","session","events","intervals","usage_segments","note");
  JsonNode s=p.path("session"),snap=p.path("snapshot");
  keys(s,"session_id","executor_id","execution_status","record_status","source","duration_minutes","active_duration_ms","overrun_ms","started_at","ended_at","end_reason");
  uuid(sourceItem);uuid(text(snap,"policy_snapshot_id"));
  check(text(s,"session_id").equals(sourceItem)&&text(s,"executor_id").equals(source)&&text(s,"execution_status").equals("ENDED"),422,"IMPORT_SESSION_NOT_COMPLETED");
  check(Set.of("PENDING","PARTIAL","COMPLETE","REVIEW_REQUIRED").contains(text(s,"record_status"))&&Set.of("MANUAL","SCHEDULE").contains(text(s,"source")),422,"INVALID_IMPORT_SESSION");
  check(s.path("duration_minutes").isIntegralNumber()&&s.path("duration_minutes").canConvertToInt()&&s.path("duration_minutes").asInt()>=1&&s.path("duration_minutes").asInt()<=180,422,"INVALID_IMPORT_SESSION");
  long start=time(s,"started_at"),end=time(s,"ended_at");
  check(start<=end&&end<=now+30000&&end>now-30L*86400000,422,"IMPORT_SESSION_EXPIRED_OR_INVALID");
  for(String k:List.of("active_duration_ms","overrun_ms"))check(s.path(k).isIntegralNumber()&&s.path(k).asLong()>=0,422,"INVALID_IMPORT_SESSION");
  keys(snap,"policy_snapshot_id","format_version","site_match_strategy","owner_user_id","executor_id","created_at","source_version","sites","content_policy","catalog_version","model_profile_version");
  check(Set.of("1.1","1.2").contains(text(snap,"format_version"))&&snap.has("owner_user_id")&&snap.path("owner_user_id").isNull()&&text(snap,"executor_id").equals(source)&&snap.path("source_version").isIntegralNumber()&&snap.path("source_version").asLong()>0,422,"INVALID_IMPORT_SNAPSHOT");
  check(time(snap,"created_at")<=start&&snap.path("sites").isArray()&&snap.path("sites").size()<=500,422,"INVALID_IMPORT_SNAPSHOT");
  // Guest frozen Snapshots carry content_policy.version; Member policy PUT does
  // not. Validate that metadata separately without stripping it from history.
  ObjectNode content=snap.path("content_policy").deepCopy();if(content.has("version")){check(content.path("version").isIntegralNumber()&&content.path("version").asLong()>=1,422,"INVALID_IMPORT_SNAPSHOT");content.remove("version");}MemberPolicy.validate(content);
  Set<String> hosts=new HashSet<>();for(JsonNode site:snap.path("sites")){
   keys(site,"site_id","canonical_host","display_name","include_subdomains","purpose","access_policy","version","created_at","updated_at","feature_policies");
   String h=text(site,"canonical_host");check(hosts.add(h),422,"INVALID_IMPORT_SNAPSHOT");
   ObjectNode input=site.deepCopy();input.remove(List.of("site_id","canonical_host","version","created_at","updated_at"));input.put("url",h);MemberImports.validateSite(input);
  }
  for(String key:List.of("events","intervals","usage_segments"))check(p.path(key).isArray()&&p.path(key).size()<=1000,422,"INVALID_IMPORT_CHILDREN");
  Set<String> ids=new HashSet<>();long priorEnd=start,confirmed=0;
  for(JsonNode interval:p.path("intervals")){
   keys(interval,"interval_id","kind","start_at","end_at","duration_ms","quality");uuid(text(interval,"interval_id"));
   long a=time(interval,"start_at"),b=time(interval,"end_at");
   check(ids.add(text(interval,"interval_id"))&&Set.of("RUN","PAUSE").contains(text(interval,"kind"))&&Set.of("CONFIRMED","UNCONFIRMED").contains(text(interval,"quality"))&&a>=priorEnd&&b>=a&&b<=end&&interval.path("duration_ms").isIntegralNumber()&&interval.path("duration_ms").asLong()==b-a,422,"INVALID_IMPORT_INTERVAL");priorEnd=b;
   if(text(interval,"kind").equals("RUN")&&text(interval,"quality").equals("CONFIRMED"))confirmed+=b-a;
  }
  long budget=s.path("duration_minutes").asLong()*60000;
  check(s.path("active_duration_ms").asLong()==Math.min(confirmed,budget)&&s.path("overrun_ms").asLong()==Math.max(0,confirmed-budget),422,"IMPORT_TIME_MISMATCH");
  ids.clear();Set<Long> sequences=new HashSet<>();Set<String> navigationTargets=new HashSet<>();
  for(JsonNode event:p.path("events")){
   keys(event,"schema_version","event_id","executor_id","session_id","policy_snapshot_id","event_type","occurred_at","local_seq","payload");uuid(text(event,"event_id"));
   long at=time(event,"occurred_at");check(ids.add(text(event,"event_id"))&&sequences.add(event.path("local_seq").asLong())&&event.path("local_seq").isIntegralNumber()&&event.path("local_seq").asLong()>0&&text(event,"executor_id").equals(source)&&text(event,"session_id").equals(sourceItem)&&text(event,"policy_snapshot_id").equals(text(snap,"policy_snapshot_id"))&&at>=start&&at<=end,422,"INVALID_IMPORT_EVENT");
   if(Set.of("SESSION_STARTED","SESSION_ENDED").contains(text(event,"event_type")))keys(event.path("payload"));
   else{MemberAccessPolicy.validate(event,snap);uuid(text(event.path("payload"),"navigation_id"));check(navigationTargets.add(text(event.path("payload"),"navigation_id")+":"+text(event.path("payload"),"target_key")),422,"INVALID_IMPORT_EVENT");}
  }
  ids.clear();long last=start,usageSeq=0;for(JsonNode u:p.path("usage_segments")){
   keys(u,"id","target_host","start_at","end_at","duration_ms","usage_seq","quality");uuid(text(u,"id"));long a=time(u,"start_at"),b=time(u,"end_at");
   check(ids.add(text(u,"id"))&&text(u,"target_host").equals(MemberSites.host(text(u,"target_host")))&&a>=last&&b>=a&&b<=end&&u.path("duration_ms").isIntegralNumber()&&u.path("duration_ms").asLong()==b-a&&u.path("usage_seq").isIntegralNumber()&&u.path("usage_seq").canConvertToLong()&&u.path("usage_seq").asLong()>usageSeq&&Set.of("CONFIRMED","UNCONFIRMED").contains(text(u,"quality")),422,"INVALID_IMPORT_USAGE");last=b;usageSeq=u.path("usage_seq").asLong();
  }
  JsonNode note=p.path("note");check(!note.isMissingNode(),422,"INVALID_IMPORT_NOTE");if(!note.isNull()){keys(note,"text","version","updated_at");check(note.path("text").isTextual()&&text(note,"text").codePointCount(0,text(note,"text").length())<=2000&&note.path("version").isIntegralNumber()&&note.path("version").asLong()>=1,422,"INVALID_IMPORT_NOTE");time(note,"updated_at");}
 }
 static String copy(MemberAuth a,MemberExecution e,MemberAuth.Identity i,JsonNode p,String sourceItem,long selectionAt){
  validate(p,i.executor(),sourceItem,selectionAt);JsonNode original=p.path("session"),snapshot=p.path("snapshot");
  String sid=id(),pid=id();ObjectNode historySnapshot=snapshot.deepCopy();historySnapshot.put("policy_snapshot_id",pid);
  // Preserve the Guest owner/null in the immutable historical Snapshot. SQL FK is
  // the receiving account; this object is never an executable MEMBER command.
  a.db.update("INSERT INTO policy_snapshots(id,user_id,executor_id,format_version,payload,payload_hash,created_at,source_version) VALUES(?,?,?,?,?,?,?,?)",pid,i.user(),i.executor(),text(snapshot,"format_version"),historySnapshot.toString(),hash(historySnapshot.toString()),MemberExecution.nullableTime(snapshot,"created_at"),snapshot.path("source_version").asLong());
  ObjectNode s=original.deepCopy();s.put("session_id",sid);s.put("owner_user_id",Long.toString(i.user()));s.put("policy_snapshot_id",pid);s.put("origin","GUEST_IMPORT");s.put("desired_revision",1);s.put("version",1);s.put("remaining_ms",0);s.put("automatic_recovery_supported",false);s.put("time_accounting_mode","GUEST_LOCAL_CONFIRMED_1");
  a.db.update("INSERT INTO focus_sessions(source_session_id,user_id,executor_id,policy_snapshot_id,execution_status,duration_minutes,desired_revision,body,source,origin,record_status) VALUES(?,?,?,?,'ENDED',?,1,?,?,'GUEST_IMPORT',?)",sid,i.user(),i.executor(),pid,s.path("duration_minutes").asInt(),s.toString(),text(s,"source"),text(s,"record_status"));e.syncTyped(s);long internal=e.internal(sid);
  a.db.update("INSERT INTO guest_import_session_payloads VALUES(?,?,?,?,?)",internal,i.executor(),sourceItem,p.toString(),hash(p.toString()));
  for(JsonNode interval:p.path("intervals")){String iid=id();ObjectNode v=interval.deepCopy();v.put("interval_id",iid);a.db.update("INSERT INTO session_intervals VALUES(?,?,?,?,?,?,?,?,?)",iid,internal,text(v,"kind"),MemberExecution.nullableTime(v,"start_at"),MemberExecution.nullableTime(v,"end_at"),v.path("duration_ms").asLong(),text(v,"quality"),text(v,"quality").equals("CONFIRMED")?MemberExecution.nullableTime(v,"end_at"):MemberExecution.nullableTime(v,"start_at"),v.toString());}
  for(JsonNode originalEvent:p.path("events")){
   ObjectNode v=originalEvent.deepCopy();String eid=id();v.put("event_id",eid);v.put("session_id",sid);v.put("policy_snapshot_id",pid);
   a.db.update("INSERT INTO event_receipts VALUES(?,?,?,?,?,?,?,?,?,?,?)",eid,i.user(),i.executor(),internal,text(v,"schema_version"),text(v,"event_type"),hash(v.toString()),v.toString(),"ACCEPTED",v.path("local_seq").asLong(),now());
   JsonNode q=v.path("payload");if(Set.of("SESSION_STARTED","SESSION_ENDED").contains(text(v,"event_type")))a.db.update("INSERT INTO session_lifecycle_events VALUES(?,?,?,?,?)",eid,internal,MemberExecution.nullableTime(v,"occurred_at"),text(v,"event_type"),1);
   else a.db.update("INSERT INTO access_events(event_id,session_id,occurred_at,access_seq,target_kind,target_host,target_key,feature_code,reason,navigation_id,policy_snapshot_id) VALUES(?,?,?,?,?,?,?,?,?,?,?)",eid,internal,MemberExecution.nullableTime(v,"occurred_at"),q.path("access_seq").asLong(),text(q,"target_kind"),text(q,"target_host"),text(q,"target_key"),q.hasNonNull("feature_code")?text(q,"feature_code"):null,text(q,"reason"),text(q,"navigation_id"),pid);
  }
  for(JsonNode u:p.path("usage_segments"))a.db.update("INSERT INTO usage_segments VALUES(?,?,?,?,?,?,?,?,?)",id(),internal,text(u,"target_host"),MemberExecution.nullableTime(u,"start_at"),MemberExecution.nullableTime(u,"end_at"),u.path("duration_ms").asLong(),u.path("usage_seq").asLong(),text(u,"quality"),hash(u.toString()));
  JsonNode n=p.path("note");if(!n.isNull())a.db.update("INSERT INTO session_notes VALUES(?,?,?,?)",internal,text(n,"text"),n.path("version").asLong(),MemberExecution.nullableTime(n,"updated_at"));
  return sid;
 }
}
