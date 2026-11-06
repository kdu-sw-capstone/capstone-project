package kr.ac.kdu.focurve;

import com.fasterxml.jackson.databind.JsonNode;
import java.util.*;
import static kr.ac.kdu.focurve.MemberAuth.*;
import static kr.ac.kdu.focurve.MemberIntervals.*;

/** Validates frozen policy, never grants Content or execution authority. */
final class MemberAccessPolicy {
 static void validate(JsonNode event,JsonNode snapshot){
  String schema=text(event,"schema_version"),type=text(event,"event_type");JsonNode p=event.path("payload");
  boolean modern=schema.equals("1.2"),feature=type.equals("BLOCKED_FEATURE_ACCESS"),record=type.equals("RECORDED_ACCESS");
  check(Set.of("1.1","1.2").contains(schema)&&Set.of("RECORDED_ACCESS","BLOCKED_SITE_ACCESS","BLOCKED_FEATURE_ACCESS").contains(type),422,"UNSUPPORTED_EVENT_POLICY");
  keys(event,"schema_version","event_id","executor_id","session_id","policy_snapshot_id","event_type","occurred_at","local_seq","payload");
  keys(p,"access_seq","navigation_id","target_kind","target_host","target_key","reason","feature_code","matched_policy_host","blocked_reasons");
  String host=text(p,"target_host"),kind=feature?"FEATURE":"SITE",reason=feature?"FEATURE":record?"RECORD":"USER_SITE";
  check(host.equals(MemberSites.host(host))&&host.length()<=253&&text(p,"target_kind").equals(kind)&&text(p,"reason").equals(reason),422,"UNSUPPORTED_EVENT_POLICY");
  check(event.path("local_seq").isIntegralNumber()&&event.path("local_seq").asLong()>0&&p.path("access_seq").isIntegralNumber()&&p.path("access_seq").asLong()>0,422,"UNSUPPORTED_EVENT_POLICY");
  check(text(p,"target_key").equals(modern?host:feature?"FEATURE:"+host+":YOUTUBE_SHORTS":"SITE:"+host),422,"UNSUPPORTED_EVENT_POLICY");
  if(feature)check(text(p,"feature_code").equals("YOUTUBE_SHORTS")&&Set.of("youtube.com","www.youtube.com").contains(host),422,"UNSUPPORTED_EVENT_POLICY");
  else check(!p.hasNonNull("feature_code"),422,"UNSUPPORTED_EVENT_POLICY");
  if(modern)check(p.has("matched_policy_host")&&p.path("blocked_reasons").isArray()&&(record?p.path("blocked_reasons").isEmpty():p.path("blocked_reasons").size()==1&&p.path("blocked_reasons").get(0).asText().equals(reason)),422,"UNSUPPORTED_EVENT_POLICY");
  // Select one frozen row for all fields; an ancestor cannot contribute a
  // different access/feature policy after a more specific host has matched.
  JsonNode selected=null;
  for(JsonNode site:snapshot.path("sites")){
   String canonical=text(site,"canonical_host");
   if((host.equals(canonical)||site.path("include_subdomains").asBoolean()&&host.endsWith("."+canonical))&&(selected==null||canonical.length()>text(selected,"canonical_host").length()))selected=site;
  }
  boolean allowed=false;
  if(selected!=null&&(!modern||text(p,"matched_policy_host").equals(text(selected,"canonical_host")))){
   if(feature){for(JsonNode f:selected.path("feature_policies"))if(!text(selected,"access_policy").equals("BLOCK")&&text(f,"feature_code").equals("YOUTUBE_SHORTS")&&f.path("enabled").asBoolean())allowed=true;}
   else allowed=text(selected,"access_policy").equals(record?"RECORD":"BLOCK");
  }
  check(allowed,422,"EVENT_POLICY_MISMATCH");
 }
}
