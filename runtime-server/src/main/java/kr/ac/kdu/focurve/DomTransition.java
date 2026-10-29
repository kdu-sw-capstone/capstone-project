package kr.ac.kdu.focurve;
import com.fasterxml.jackson.databind.*;import com.fasterxml.jackson.databind.node.*;import java.time.Instant;import java.util.*;import static kr.ac.kdu.focurve.MemberIntervals.*;
/** Approved DP01_1: a negative-authority projection; original reports remain immutable. */
final class DomTransition {
 static final String MODE="DP01_1",WAIT="EFFECT_VERIFYING";
 static boolean opted(JsonNode c){return MODE.equals(text(c,"dom_transition_contract"));}
 static void validate(JsonNode r){
  JsonNode n=r.path("effect_transition_context");boolean waiting=text(r,"result").equals("EFFECT_VERIFYING");if(n.isMissingNode()){require(!waiting,"INVALID_MEMBER_REPORT");return;}
  keys(n,"version","transition_id","root_generation","phase","started_at","deadline_at","root_evidence_sha256");require(MODE.equals(text(n,"version")),"INVALID_MEMBER_REPORT");uuid(text(n,"transition_id"));require(n.path("root_generation").isIntegralNumber()&&n.path("root_generation").asLong()>0,"INVALID_MEMBER_REPORT");
  require(Set.of("VERIFYING","CONFIRMED","FAILED").contains(text(n,"phase")),"INVALID_MEMBER_REPORT");long start=time(n,"started_at"),end=time(n,"deadline_at");require(end>start&&end-start<=3000&&text(n,"root_evidence_sha256").matches("[a-f0-9]{64}"),"INVALID_MEMBER_REPORT");
  require(!waiting||text(n,"phase").equals("VERIFYING"),"INVALID_MEMBER_REPORT");require(!text(r,"result").equals("APPLIED")||text(n,"phase").equals("CONFIRMED"),"INVALID_MEMBER_REPORT");
  if(waiting)for(JsonNode i:r.path("intervals"))require(i.hasNonNull("end_at"),"INVALID_MEMBER_INTERVAL");
 }
 static boolean expire(ObjectNode s,long now){JsonNode n=s.path("effect_transition");if(WAIT.equals(text(s,"execution_status"))&&n.isObject()&&now>=time(n,"deadline_at")){failed(s,n,"SERVER_DEADLINE",now);return true;}return false;}
 static void failed(ObjectNode s,JsonNode n,String code,long now){s.put("execution_status","UNKNOWN");s.put("last_error_code",code);s.put("record_status","PARTIAL");if(!s.hasNonNull("first_dp_failure")){ObjectNode f=s.objectNode();f.put("source","SERVER");f.put("transition_id",text(n,"transition_id"));f.put("code",code);f.put("at",Instant.ofEpochMilli(now).toString());s.set("first_dp_failure",f);}}
 static void cancelForNative(ObjectNode s,JsonNode c,JsonNode r){JsonNode prior=s.path("effect_transition");// A prior cancelled grant carries no authority. A later NR may repeat that reference.
  JsonNode nr=s.path("native_transition"),incoming=r.path("transition_context");
  if(opted(c)&&NativeTransition.opted(c)&&prior.isObject()&&text(prior,"transition_id").equals(text(r,"effect_cancel_ref"))&&text(prior,"phase").equals("CANCELLED")&&text(s,"execution_status").equals("RUNNING")&&text(nr,"phase").equals("CONFIRMED")&&nr.path("root_generation").asLong()>prior.path("root_generation").asLong()&&incoming.path("root_generation").asLong()>nr.path("root_generation").asLong()&&!s.hasNonNull("first_dp_failure")&&!s.hasNonNull("first_nr_failure"))return;
  require(opted(c)&&prior.isObject()&&text(prior,"transition_id").equals(text(r,"effect_cancel_ref"))&&Set.of("VERIFYING","CANCELLED").contains(text(prior,"phase"))&&Set.of(WAIT,"NATIVE_VERIFYING").contains(text(s,"execution_status"))&&!s.hasNonNull("first_dp_failure"),"DP_TRANSITION_CONFLICT");((ObjectNode)prior).put("phase","CANCELLED");}
 static boolean accept(ObjectNode s,JsonNode command,JsonNode r,long now){
  JsonNode n=r.path("effect_transition_context"),prior=s.path("effect_transition");String result=text(r,"result");
  if(n.isMissingNode()&&!result.equals("EFFECT_VERIFYING")){
   if(!opted(command))return true;
   if(s.hasNonNull("first_dp_failure")&&result.equals("APPLIED"))return false;
   if(result.equals("RELEASED"))return true;
   if(result.equals("UNCONFIRMED")||result.equals("FAILED")){failed(s,prior,"ROOT_UNCONFIRMED",now);return true;}
   return prior.isMissingNode();
  }
  require(opted(command)&&MODE.equals(text(s,"dom_transition_contract")),"DP_MODE_MISMATCH");
  if(s.hasNonNull("first_dp_failure"))return false;if(result.equals("APPLIED")&&s.path("native_transition").path("root_generation").asLong()>n.path("root_generation").asLong())return false;
  long start=time(n,"started_at"),deadline=time(n,"deadline_at");require(s.hasNonNull("started_at")&&time(s,"started_at")<=time(command,"execute_before")&&start>=time(s,"started_at")&&start<=now+2000,"INVALID_DP_WINDOW");
  if(result.equals("EFFECT_VERIFYING")){
   require(Set.of("RUNNING",WAIT).contains(text(s,"execution_status")),"INVALID_DP_STATE");
   if(prior.isObject()&&!Set.of("CONFIRMED","CANCELLED").contains(text(prior,"phase")))require(text(prior,"transition_id").equals(text(n,"transition_id"))&&prior.path("root_generation").equals(n.path("root_generation"))&&time(prior,"started_at")==start&&time(prior,"deadline_at")==deadline,"DP_TRANSITION_CONFLICT");
   if(prior.isObject()&&Set.of("CONFIRMED","CANCELLED").contains(text(prior,"phase"))){if(n.path("root_generation").asLong()<=prior.path("root_generation").asLong())return false;require(!text(prior,"transition_id").equals(text(n,"transition_id")),"DP_TRANSITION_CONFLICT");}
   s.set("effect_transition",n.deepCopy());if(now>=deadline){failed(s,n,"SERVER_DEADLINE",now);return false;}s.put("execution_status",WAIT);return true;
  }
  require(prior.isObject()&&text(prior,"transition_id").equals(text(n,"transition_id"))&&prior.path("root_generation").equals(n.path("root_generation"))&&time(prior,"started_at")==start&&time(prior,"deadline_at")==deadline,"DP_TRANSITION_CONFLICT");
  if(text(prior,"phase").equals("CANCELLED"))return false;
  if(text(prior,"phase").equals("CONFIRMED")){if(result.equals("APPLIED")){if(!text(s,"execution_status").equals("RUNNING"))return false;s.set("effect_transition",n.deepCopy());return true;}failed(s,n,"ROOT_UNCONFIRMED",now);return true;}
  if(now>=deadline){failed(s,n,"SERVER_DEADLINE",now);return false;}
  if(result.equals("APPLIED")){s.set("effect_transition",n.deepCopy());return true;}
  failed(s,n,"ROOT_UNCONFIRMED",now);return true;
 }
}
