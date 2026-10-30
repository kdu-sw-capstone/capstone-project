package kr.ac.kdu.focurve;
import com.fasterxml.jackson.databind.JsonNode;
import java.util.Map;
import static kr.ac.kdu.focurve.MemberAuth.*;
import static kr.ac.kdu.focurve.AmvpBridgeSupport.*;

/** Frozen actor settings handoff. CADENCE is deliberately absent from RuntimePackage. */
final class AmvpCadenceAdmission implements AdditionalConfigStore.Admission {
 private final MemberAuth a;private final AdditionalConfigStore.Admission delegate;private final AmvpBridgeSupport support;
 AmvpCadenceAdmission(MemberAuth auth,AdditionalConfigStore.Admission delegate,CapabilitySource source){a=auth;this.delegate=delegate;support=new AmvpBridgeSupport(auth,source);}
 public void verify(Identity principal,String executor,String binding,boolean mutation){
  try{delegate.verify(principal,executor,binding,mutation);}
  catch(Failure missing){if(!missing.code.equals("CAPABILITY_NOT_VERIFIED"))throw missing;var owner=support.binding(principal,executor,mutation);check(owner.id().equals(binding),409,"STALE_OWNER");support.capability(principal,owner,"FOCUS_CONTROL");}
  // RC2 capability maps are partial. FOCUS_CONTROL need not negotiate RUNTIME_POLICY.
  // Non-CADENCE writes still execute the delegate publisher's own stream verification atomically.
 }
 public AdditionalConfigStore.ApplyState appliedState(Map<String,Object> config){return config.get("kind").equals("CADENCE")?new AdditionalConfigStore.ApplyState("PENDING",null):delegate.appliedState(config);}
 public void publish(String binding,String id,long revision,JsonNode value,boolean deleted){
  if(!value.path("kind").asText().equals("CADENCE")){delegate.publish(binding,id,revision,value,deleted);return;}
  transaction();new AdditionalConfigContract(a.json).validate("CadenceConfig",value);
  var row=a.one("SELECT version FROM amvp_configs WHERE config_id=? AND owner_binding_id=? AND kind='CADENCE'",id,binding);check(row!=null,409,"STALE_OWNER");
  String raw=AdditionalConfigContract.canonical(value);
  a.db.update("INSERT INTO amvp_cadence_definitions VALUES(?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE config_id=VALUES(config_id),config_version=VALUES(config_version),config_revision=VALUES(config_revision),value_json=VALUES(value_json),payload_sha256=VALUES(payload_sha256),deleted=VALUES(deleted)",binding,id,row.get("version"),revision,raw,hash(raw),deleted);
  // Existing runs retain their original definition, Snapshot, explicit null/real Attachment and obligations.
 }
}
