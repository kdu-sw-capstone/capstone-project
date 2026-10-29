package kr.ac.kdu.focurve;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.*;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;
import java.time.*;
import java.util.*;
import static kr.ac.kdu.focurve.MemberAuth.*;import static kr.ac.kdu.focurve.MemberIntervals.*;

/** Read-only projection. Focus RUN time is never substituted for site usage time. */
@Profile("member-runtime | local-integration") @Component
class MemberMetrics {
 final MemberAuth a; final MemberExecution execution; final MemberReadModel read;
 MemberMetrics(MemberAuth a,MemberExecution execution,MemberReadModel read){this.a=a;this.execution=execution;this.read=read;}
 record Evidence(boolean collected,boolean partial,long duration,Set<String> hosts){}
 boolean inRange(JsonNode s,MemberReadModel.Range r){
  if(!s.hasNonNull("started_at"))return false;
  long start=Instant.parse(text(s,"started_at")).toEpochMilli();
  long end=s.hasNonNull("ended_at")?Instant.parse(text(s,"ended_at")).toEpochMilli():System.currentTimeMillis();
  return start<r.to()&&end>r.from();
 }
 Evidence evidence(Identity i,MemberReadModel.Range range,String host){
  boolean collected=false,partial=false;long duration=0;Set<String>hosts=new TreeSet<>();
  for(var row:a.db.queryForList("SELECT * FROM focus_sessions WHERE user_id=?",i.user())){
   JsonNode s=execution.parse(row.get("body"));
   if(i.executor()!=null&&!text(s,"executor_id").equals(i.executor())||!inRange(s,range))continue;
   JsonNode snapshot=execution.parse(a.one("SELECT payload FROM policy_snapshots WHERE id=? AND user_id=?",text(s,"policy_snapshot_id"),i.user()).get("payload"));
   boolean matching=false;
   for(JsonNode site:snapshot.path("sites")){
    String h=text(site,"canonical_host");
    if(Set.of("RECORD","BLOCK").contains(text(site,"access_policy"))){hosts.add(h);if(host==null||h.equals(host))matching=true;}
   }
   // Enabling a feature does not prove a producer existed in historical clients.
   // Accepted FEATURE rows are positive lower bounds; no watermark proves a
   // complete empty range, so feature-only zero remains NOT_COLLECTED.
   for(var feature:a.db.queryForList("SELECT DISTINCT x.target_host FROM access_events x JOIN event_receipts r ON r.event_id=x.event_id WHERE x.session_id=? AND x.target_kind='FEATURE' AND r.status='ACCEPTED'",row.get("id"))){String h=feature.get("target_host").toString();hosts.add(h);if(host==null||host.equals(h)){matching=true;partial=true;}}
   collected|=matching;
   if(matching)partial|=!text(s,"record_status").equals("COMPLETE");
   if(host==null){long remaining=((Number)row.get("duration_minutes")).longValue()*60000;
    for(var interval:a.db.queryForList("SELECT start_at,confirmed_until FROM session_intervals WHERE session_id=? AND kind='RUN' AND quality='CONFIRMED' ORDER BY start_at,id",row.get("id"))){
     long begin=Instant.parse(instant(interval.get("start_at"))).toEpochMilli(),end=Instant.parse(instant(interval.get("confirmed_until"))).toEpochMilli();
     long confirmed=Math.min(remaining,Math.max(0,end-begin));
     duration+=Math.max(0,Math.min(begin+confirmed,range.to())-Math.max(begin,range.from()));remaining-=confirmed;
    }
   }
  }
  return new Evidence(collected,partial,duration,hosts);
 }
 ObjectNode project(Identity i,MemberReadModel.Range range,String host,List<ObjectNode> all){
  Evidence proof=evidence(i,range,host);
  List<ObjectNode> selected=all.stream().filter(x->{long at=Instant.parse(text(x,"occurred_at")).toEpochMilli();return at>=range.from()&&at<range.to()&&(host==null||text(x,"target_host").equals(host));}).toList();
  long repeat=selected.stream().filter(x->x.path("is_repeat").asBoolean()).count();
  // Accepted rows are observable lower bounds; pending rows make the result PARTIAL.
  boolean known=proof.collected()&&(!selected.isEmpty()||!proof.partial());
  String quality=selected.stream().anyMatch(x->text(x,"quality").equals("REVIEW_REQUIRED"))?"REVIEW_REQUIRED":!proof.collected()?"NOT_COLLECTED":proof.partial()?"PARTIAL":selected.isEmpty()?"NO_DATA":"COMPLETE";
  return a.obj("total_access",known?selected.size():null,"repeat_access",known?repeat:null,
    "blocked_access",known?selected.stream().filter(x->text(x,"event_type").startsWith("BLOCKED_")).count():null,
    "active_duration_ms",host==null?proof.duration():null,
    "repeat_ratio",known&&!selected.isEmpty()?(double)repeat/selected.size():null,
    "quality",quality,"as_of",Instant.now().toString());
 }
 ObjectNode summary(Identity i,Map<String,String[]>q){Query.allowed(q,"from_date","to_date");return project(i,read.range(q),null,read.accesses(i));}
 ObjectNode targets(Identity i,Map<String,String[]>q){
  Query.allowed(q,"from_date","to_date","cursor","limit");var range=read.range(q);
  String context="TARGET:"+i.user()+":"+Objects.toString(i.executor(),"WEB")+":"+range.from()+":"+range.to();
  long after=Query.cursor(q,context);int limit=Query.limit(q),index=0;boolean more=false;ArrayNode items=a.json.createArrayNode();
  List<ObjectNode>all=read.accesses(i);Set<String>hosts=new TreeSet<>(evidence(i,range,null).hosts());
  for(ObjectNode row:all){long at=Instant.parse(text(row,"occurred_at")).toEpochMilli();if(at>=range.from()&&at<range.to())hosts.add(text(row,"target_host"));}
  for(String host:hosts){if(index++<after)continue;if(items.size()==limit){more=true;break;}ObjectNode item=project(i,range,host,all);item.put("host",host);items.add(item);}
  return Query.page(a,items,more,more?Query.encode(context,after+items.size()):null);
 }
}
