package kr.ac.kdu.focurve;

import com.fasterxml.jackson.databind.*;
import com.fasterxml.jackson.databind.node.*;
import java.time.Instant;
import java.util.*;

/** Port of the approved independent MEMBER interval contract, not legacy wall clock accounting. */
final class MemberIntervals {
 static void require(boolean ok,String code){if(!ok)throw new IllegalArgumentException(code);}
 static String text(JsonNode n,String k){return n.path(k).asText("");}
 static long time(JsonNode n,String k){String v=text(n,k);require(v.endsWith("Z"),"INVALID_MEMBER_INTERVAL");return Instant.parse(v).toEpochMilli();}
 static void uuid(String v){require(v.matches("[0-9a-fA-F]{8}(?:-[0-9a-fA-F]{4}){3}-[0-9a-fA-F]{12}"),"INVALID_UUID");}
 static void keys(JsonNode n,String... allowed){require(n.isObject(),"INVALID_MEMBER_REPORT");Set<String>s=Set.of(allowed);n.fieldNames().forEachRemaining(k->require(s.contains(k),"INVALID_MEMBER_REPORT"));}
 static void validate(JsonNode r,boolean local){
  keys(r,"report_id","command_id","session_id","executor_id","desired_revision","result","observed_at","intervals","error_code","rollback_confirmed","local_action_seq","transition_context","effect_transition_context","effect_cancel_ref");
  for(String k:List.of("report_id","session_id","executor_id"))uuid(text(r,k));
  if(local)require(r.has("command_id")&&r.get("command_id").isNull(),"INVALID_MEMBER_REPORT");else uuid(text(r,"command_id"));
  require(r.path("desired_revision").isIntegralNumber()&&r.path("desired_revision").asLong()>0,"INVALID_MEMBER_REPORT");
  require(Set.of("APPLIED","RELEASED","FAILED","UNCONFIRMED","REVALIDATING","EFFECT_VERIFYING").contains(text(r,"result")),"INVALID_MEMBER_REPORT");if(r.has("effect_cancel_ref")){uuid(text(r,"effect_cancel_ref"));require(text(r,"result").equals("REVALIDATING")&&r.has("transition_context")&&!r.has("effect_transition_context"),"INVALID_MEMBER_REPORT");}NativeTransition.validate(r);DomTransition.validate(r);require(!(r.has("transition_context")&&r.has("effect_transition_context")),"INVALID_MEMBER_REPORT");long until=time(r,"observed_at");
  require(r.path("intervals").isArray()&&r.path("intervals").size()<=512,"INVALID_MEMBER_REPORT");Set<String>ids=new HashSet<>();
  for(JsonNode i:r.path("intervals")){keys(i,"interval_id","kind","start_at","end_at","duration_ms","quality");String id=text(i,"interval_id");uuid(id);require(ids.add(id)&&text(i,"kind").equals("RUN")&&text(i,"quality").equals("CONFIRMED"),"INVALID_MEMBER_INTERVAL");long a=time(i,"start_at");require(a<=until,"INVALID_MEMBER_INTERVAL");if(!i.path("end_at").isMissingNode()&&!i.path("end_at").isNull()){long b=time(i,"end_at");require(b>=a&&b<=until&&i.path("duration_ms").isIntegralNumber()&&i.path("duration_ms").asLong()==b-a,"INVALID_MEMBER_INTERVAL");}else require(!text(r,"result").equals("RELEASED"),"INVALID_MEMBER_INTERVAL");}
 }
 record Merged(ArrayNode rows,long duration){}
 static Merged merge(ObjectMapper mapper,ArrayNode previous,JsonNode report){
  validate(report,report.path("command_id").isNull());ArrayNode rows=previous.deepCopy();long until=time(report,"observed_at");
  for(JsonNode i:report.path("intervals")){ObjectNode old=null;for(JsonNode r:rows)if(text(r,"interval_id").equals(text(i,"interval_id")))old=(ObjectNode)r;
   boolean closed=i.hasNonNull("end_at");long horizon=closed?time(i,"end_at"):until;
   if(old!=null){require(text(old,"start_at").equals(text(i,"start_at"))&&text(old,"kind").equals(text(i,"kind"))&&text(old,"quality").equals(text(i,"quality")),"INTERVAL_CONFLICT");if(old.hasNonNull("end_at")){require(old.path("interval").equals(i),"INTERVAL_CONFLICT");continue;}require(!closed||horizon>=old.path("confirmed_until").asLong(),"INTERVAL_CONFLICT");old.put("confirmed_until",Math.max(old.path("confirmed_until").asLong(),horizon));if(closed){old.put("end_at",text(i,"end_at"));old.set("interval",i.deepCopy());}}
   else{ObjectNode r=i.deepCopy();r.set("interval",i.deepCopy());r.put("confirmed_until",horizon);rows.add(r);}
  }
  List<JsonNode>sorted=new ArrayList<>();rows.forEach(sorted::add);sorted.sort(Comparator.comparingLong(i->time(i,"start_at")));long sum=0,end=Long.MIN_VALUE;for(JsonNode i:sorted){long start=time(i,"start_at"),h=i.path("confirmed_until").asLong();require(start>=end,"INTERVAL_OVERLAP");sum=Math.addExact(sum,h-start);end=h;}return new Merged(rows,sum);
 }
}
