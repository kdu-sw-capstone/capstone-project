package kr.ac.kdu.focurve;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.time.Instant;
import java.time.Clock;
import java.sql.Timestamp;
import static kr.ac.kdu.focurve.MemberAuth.*;
import static kr.ac.kdu.focurve.AmvpBridgeSupport.*;

/** RC2 publisher for the two existing RuntimePackage carriers. No Core ACK is synthesized. */
final class AmvpPolicyPublisher implements AdditionalConfigStore.Admission {
 private final AmvpBridgeSupport support;private final Clock clock;
 AmvpPolicyPublisher(MemberAuth auth,CapabilitySource capabilities){this(auth,capabilities,Clock.systemUTC());}
 AmvpPolicyPublisher(MemberAuth auth,CapabilitySource capabilities,Clock clock){support=new AmvpBridgeSupport(auth,capabilities);this.clock=java.util.Objects.requireNonNull(clock);}
 public AdditionalConfigStore.ApplyState appliedState(java.util.Map<String,Object> config){return AmvpReportReceiver.projection(support,config);}
 public void verify(Identity principal,String executor,String binding,boolean mutation){
  // Statistics may read a member's own closed binding after the installation changes owners.
  // ConfigStore independently requires its current active binding before invoking this admission.
  if(!mutation){var historical=support.auth.one("SELECT * FROM amvp_owner_bindings WHERE binding_id=? AND executor_id=? AND user_id=?",binding,executor,principal.user());
   check(historical!=null&&(principal.executor()==null||principal.executor().equals(executor)),404,"RESOURCE_NOT_FOUND");
   if(historical.get("state").equals("CLOSED")&&historical.get("closed_at")!=null)return;
  }
  var current=support.binding(principal,executor,mutation);check(current.id().equals(binding),409,"STALE_OWNER");support.capability(principal,current,"RUNTIME_POLICY");
 }
 public void publish(String binding,String configId,long revision,JsonNode value,boolean deleted){
  transaction();var a=support.auth;
  // CADENCE/FOCUS_SCHEDULE have separate agreed actors; RuntimePackage is not their wire carrier.
  check(value.path("kind").asText().equals("SITE_TIME")||value.path("kind").asText().equals("CONTENT"),503,"UNSUPPORTED_CONTRACT");
  var owner=a.one("SELECT executor_id,user_id FROM amvp_owner_bindings WHERE binding_id=?",binding);check(owner!=null,409,"STALE_OWNER");
  var principal=new Identity(((Number)owner.get("user_id")).longValue(),null);var current=support.binding(principal,owner.get("executor_id").toString(),true);check(current.id().equals(binding),409,"STALE_OWNER");
  var cap=support.capability(principal,current,"RUNTIME_POLICY");
  // Timezone is a verified Core selection, not the server machine's default timezone.
  var timezone=a.one("SELECT * FROM amvp_timezone_states WHERE executor_id=?",current.executor());
  check(timezone!=null,409,"TIMEZONE_UNCONFIRMED");
  Instant issued=clock.instant();ObjectNode result=a.obj("contract_revision","AMVP-CONTRACT-20261029-RC2","format_version","AMVP_RUNTIME_PACKAGE_1","package_id",id(),"owner_binding_id",binding,"executor_id",current.executor(),"runtime_revision",revision,"issued_at",utc(issued),"timezone",timezone.get("applied_zone"),"timezone_version",timezone.get("applied_version"),"time_match_strategy","ALL_MATCHING_CONSTRAINTS","next_focus_revision",revision,"focus_defaults",null,"capability_receipt_id",cap.path("capability_receipt_id").asText(),"stream","RUNTIME_POLICY");
  var policies=result.putArray("runtime_policies");
  for(var row:a.db.queryForList("SELECT * FROM amvp_configs WHERE owner_binding_id=? AND deleted_at IS NULL ORDER BY config_id",binding)){
   var config=support.parse(row.get("value_json"));String kind=config.path("kind").asText();
   if(kind.equals("SITE_TIME")){support.contract.validate("SiteTimePolicy",config);policies.add(config);}
   else if(kind.equals("CONTENT")){support.content(current,config,cap);result.set("focus_defaults",config);}
  }
  seal(result);support.contract.validate("RuntimePackage",result);
  String canonical=AdditionalConfigContract.canonical(result),hash=result.path("payload_sha256").asText(),packageId=result.path("package_id").asText();
  a.db.update("INSERT INTO amvp_packages(package_id,owner_binding_id,runtime_revision,payload_json,payload_sha256,issued_at) VALUES(?,?,?,?,?,?)",packageId,binding,revision,canonical,hash,Timestamp.from(issued));
  a.db.update("INSERT INTO amvp_outbox(item_id,owner_binding_id,stream,payload_json,payload_sha256,state,attempts,next_attempt_at) VALUES(?,?,'RUNTIME_POLICY',?,?,'PENDING',0,?)",packageId,binding,canonical,hash,now());
  a.db.update("INSERT INTO amvp_current_packages(owner_binding_id,package_id) VALUES(?,?) ON DUPLICATE KEY UPDATE package_id=VALUES(package_id)",binding,packageId);
 }
 ObjectNode current(Identity principal,String executor){
  transaction();var binding=support.binding(principal,executor,false);var cap=support.capability(principal,binding,"RUNTIME_POLICY");
  var row=support.auth.one("SELECT p.* FROM amvp_current_packages c JOIN amvp_packages p ON p.package_id=c.package_id AND p.owner_binding_id=c.owner_binding_id WHERE c.owner_binding_id=?",binding.id());
  check(row!=null,404,"RESOURCE_NOT_FOUND");var result=support.parse(row.get("payload_json"));support.contract.validate("RuntimePackage",result);hashMatches(result);
  check(row.get("payload_sha256").equals(result.path("payload_sha256").asText())&&row.get("package_id").equals(result.path("package_id").asText())&&((Number)row.get("runtime_revision")).longValue()==result.path("runtime_revision").asLong()&&result.path("owner_binding_id").asText().equals(binding.id())&&result.path("executor_id").asText().equals(executor)&&result.path("capability_receipt_id").equals(cap.path("capability_receipt_id")),503,"CAPABILITY_NOT_VERIFIED");return result;
 }
}
