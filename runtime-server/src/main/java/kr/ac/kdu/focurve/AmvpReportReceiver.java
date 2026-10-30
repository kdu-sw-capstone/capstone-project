package kr.ac.kdu.focurve;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.util.*;
import java.util.function.Supplier;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.TransactionTemplate;
import static kr.ac.kdu.focurve.MemberAuth.*;
import static kr.ac.kdu.focurve.AmvpBridgeSupport.*;

/** Immutable report receipts and a rebuildable read projection; Core retains final effect authority. */
final class AmvpReportReceiver {
 record VerifiedReport(Set<String> affectedPolicies){VerifiedReport{affectedPolicies=Set.copyOf(affectedPolicies);}}
 interface EvidenceVerifier {
  /** Verify operation/execution, current epoch, legal transition, fresh observation and actual evidence
   * behind evidence_sha256. A digest, client state or successful transport is not proof. */
  VerifiedReport verify(Identity principal,Binding binding,ObjectNode report,ObjectNode issuedPackage,JsonNode predecessor);
 }
 private final AmvpBridgeSupport s;private final EvidenceVerifier evidence;private final TransactionTemplate writes;
 AmvpReportReceiver(MemberAuth auth,PlatformTransactionManager manager,CapabilitySource source,EvidenceVerifier evidence){s=new AmvpBridgeSupport(auth,source);this.evidence=Objects.requireNonNull(evidence);writes=new TransactionTemplate(manager);writes.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);}
 ObjectNode batch(Supplier<Identity> authenticate,ObjectNode body){
  check(body.size()==5&&body.has("stream")&&body.has("schema_version")&&body.has("batch_id")&&body.has("executor_id")&&body.has("reports"),400,"VALIDATION_FAILED");
  check(body.path("stream").asText().equals("RUNTIME_REPORT")&&body.path("schema_version").asText().equals("AMVP_RUNTIME_REPORT_1")&&body.path("reports").isArray()&&body.path("reports").size()>0&&body.path("reports").size()<=100,400,"VALIDATION_FAILED");
  for(String field:List.of("batch_id","executor_id"))s.contract.validate("Uuid",body.path(field));
  for(var item:body.path("reports")){s.contract.validate("Uuid",item.path("report_id"));check(item.path("payload_sha256").asText().matches("[a-f0-9]{64}"),400,"VALIDATION_FAILED");}
  var result=s.auth.obj("batch_id",body.path("batch_id").asText());var items=result.putArray("items");
  for(var item:body.path("reports"))try{ObjectNode ack=writes.execute(tx->receive(authenticate.get(),body.path("executor_id").asText(),(ObjectNode)item));items.add(ack);}catch(Failure rejected){items.add(ack(item,"REJECTED",rejected.code));}
  s.contract.validate("BatchAck",result);return result;
 }
 private ObjectNode receive(Identity principal,String executor,ObjectNode report){
  check(executor.equals(principal.executor()),403,"FORBIDDEN_EXECUTOR");var binding=s.binding(principal,executor,true);s.capability(principal,binding,"RUNTIME_REPORT");s.contract.validate("RuntimeReport",report);hashMatches(report);
  check(report.path("owner_binding_id").asText().equals(binding.id())&&report.path("executor_id").asText().equals(executor),403,"FORBIDDEN_EXECUTOR");
  var a=s.auth;String id=report.path("report_id").asText(),hash=report.path("payload_sha256").asText(),epoch=report.path("report_epoch").asText();long seq=report.path("report_seq").asLong();String route="RPT01:"+binding.id()+":"+epoch+":"+seq;
  var receipt=a.one("SELECT * FROM amvp_operations WHERE operation_id=?",id);
  if(receipt!=null){check(receipt.get("owner_binding_id").equals(binding.id()),404,"RESOURCE_NOT_FOUND");check(receipt.get("route").equals(route)&&receipt.get("request_sha256").equals(hash),409,"SOURCE_CONFLICT");}
  var old=a.one("SELECT * FROM amvp_reports WHERE report_id=?",id);
  if(old!=null){check(old.get("owner_binding_id").equals(binding.id()),404,"RESOURCE_NOT_FOUND");check(old.get("payload_sha256").equals(hash)&&receipt!=null&&receipt.get("state").equals("CONFIRMED"),409,"SOURCE_CONFLICT");return ack(report,"DUPLICATE",null);}
  var position=a.one("SELECT report_id FROM amvp_reports WHERE owner_binding_id=? AND report_epoch=? AND report_seq=?",binding.id(),epoch,seq);check(position==null,409,"SEQUENCE_REUSE");
  var reserved=a.one("SELECT operation_id FROM amvp_operations WHERE owner_binding_id=? AND route=?",binding.id(),route);check(reserved==null||reserved.get("operation_id").equals(id),409,"SEQUENCE_REUSE");
  var previous=a.one("SELECT payload_json,report_seq FROM amvp_reports WHERE owner_binding_id=? AND report_epoch=? ORDER BY report_seq DESC LIMIT 1",binding.id(),epoch);long last=previous==null?0:((Number)previous.get("report_seq")).longValue();check(seq>last,409,"STALE_SEQUENCE");
  var issued=a.one("SELECT * FROM amvp_packages WHERE owner_binding_id=? AND package_id=? AND runtime_revision=?",binding.id(),report.path("package_id").asText(),report.path("runtime_revision").asLong());
  if(seq!=last+1||issued==null){var pending=ack(report,"PENDING_DEPENDENCY",null);if(receipt==null)save(binding,report,route,"PENDING_DEPENDENCY",pending);return pending;}
  var pack=s.parse(issued.get("payload_json"));s.contract.validate("RuntimePackage",pack);hashMatches(pack);
  check(pack.path("owner_binding_id").asText().equals(binding.id())&&pack.path("executor_id").asText().equals(executor)&&pack.path("package_id").equals(report.path("package_id"))&&pack.path("runtime_revision").asLong()==report.path("runtime_revision").asLong()&&issued.get("payload_sha256").equals(pack.path("payload_sha256").asText()),422,"SOURCE_CONFLICT");
  check(!java.time.Instant.parse(report.path("observed_at").asText()).isBefore(java.time.Instant.parse(pack.path("issued_at").asText())),422,"INVALID_EFFECT_EVIDENCE");
  var verified=evidence.verify(principal,binding,report.deepCopy(),pack.deepCopy(),previous==null?null:s.parse(previous.get("payload_json")));check(verified!=null,409,"INVALID_EFFECT_EVIDENCE");
  Set<String> published=new HashSet<>();for(var policy:pack.path("runtime_policies"))published.add(policy.path("policy_id").asText());check(published.containsAll(verified.affectedPolicies()),409,"INVALID_EFFECT_EVIDENCE");
  var accepted=ack(report,"ACCEPTED",null);var stored=a.obj("profile","AMVP_REPORT_RECEIPT_1","ack",accepted);var covered=stored.putArray("affected_policy_ids");verified.affectedPolicies().stream().sorted().forEach(covered::add);
  a.db.update("INSERT INTO amvp_reports(report_id,owner_binding_id,report_epoch,report_seq,payload_json,payload_sha256) VALUES(?,?,?,?,?,?)",id,binding.id(),epoch,seq,AdditionalConfigContract.canonical(report),hash);
  if(receipt==null)save(binding,report,route,"CONFIRMED",stored);else a.db.update("UPDATE amvp_operations SET state='CONFIRMED',response_json=?,updated_at=? WHERE operation_id=?",AdditionalConfigContract.canonical(stored),now(),id);
  for(var policy:pack.path("runtime_policies"))if(verified.affectedPolicies().contains(policy.path("policy_id").asText())){
   String configId=policy.path("policy_id").asText();var config=a.one("SELECT * FROM amvp_configs WHERE config_id=? AND owner_binding_id=?",configId,binding.id());
   if(config==null||!config.get("kind").equals("SITE_TIME")||((Number)config.get("version")).longValue()!=policy.path("version").asLong()||!AdditionalConfigContract.canonical(s.parse(config.get("value_json"))).equals(AdditionalConfigContract.canonical(policy)))continue;
   var cursor=a.one("SELECT * FROM amvp_operations WHERE owner_binding_id=? AND route='RPT_STATE' AND idempotency_key=?",binding.id(),configId);
   if(cursor!=null&&s.parse(cursor.get("response_json")).path("runtime_revision").asLong()>report.path("runtime_revision").asLong())continue;
   var projection=a.obj("profile","AMVP_REPORT_PROJECTION_1","report_id",id,"config_version",policy.path("version").asLong(),"runtime_revision",report.path("runtime_revision").asLong());String projectionJson=AdditionalConfigContract.canonical(projection);
   if(cursor==null)a.db.update("INSERT INTO amvp_operations(operation_id,owner_binding_id,route,idempotency_key,request_sha256,state,response_json,updated_at) VALUES(?,?,'RPT_STATE',?,?,'PROJECTED',?,?)",MemberAuth.id(),binding.id(),configId,MemberAuth.hash(configId),projectionJson,now());
   else a.db.update("UPDATE amvp_operations SET response_json=?,updated_at=? WHERE operation_id=?",projectionJson,now(),cursor.get("operation_id"));
  }
  return accepted;
 }
 private void save(Binding binding,ObjectNode report,String route,String state,ObjectNode response){s.auth.db.update("INSERT INTO amvp_operations(operation_id,owner_binding_id,route,idempotency_key,request_sha256,state,response_json,updated_at) VALUES(?,?,?,?,?,?,?,?)",report.path("report_id").asText(),binding.id(),route,report.path("report_id").asText(),report.path("payload_sha256").asText(),state,AdditionalConfigContract.canonical(response),now());}
 private ObjectNode ack(JsonNode report,String status,String error){return s.auth.obj("item_id",report.path("report_id").asText(),"payload_sha256",report.path("payload_sha256").asText(),"status",status,"error_code",error);}
 static AdditionalConfigStore.ApplyState projection(AmvpBridgeSupport s,Map<String,Object> config){
  var pending=new AdditionalConfigStore.ApplyState("PENDING",null);if(!config.get("kind").equals("SITE_TIME"))return pending;
  var cursor=s.auth.one("SELECT response_json FROM amvp_operations WHERE owner_binding_id=? AND route='RPT_STATE' AND idempotency_key=?",config.get("owner_binding_id"),config.get("config_id"));if(cursor==null)return pending;var selected=s.parse(cursor.get("response_json"));
  if(!selected.path("profile").asText().equals("AMVP_REPORT_PROJECTION_1")||selected.path("config_version").asLong()!=((Number)config.get("version")).longValue())return pending;
  var raw=s.auth.one("SELECT r.payload_json,r.payload_sha256,o.response_json,o.request_sha256 FROM amvp_reports r JOIN amvp_operations o ON o.operation_id=r.report_id AND o.owner_binding_id=r.owner_binding_id AND o.state='CONFIRMED' WHERE r.report_id=? AND r.owner_binding_id=?",selected.path("report_id").asText(),config.get("owner_binding_id"));
  check(raw!=null,409,"STORE_UNCONFIRMED");var report=s.parse(raw.get("payload_json"));hashMatches(report);var receipt=s.parse(raw.get("response_json"));
  boolean covered=false;for(var policyId:receipt.path("affected_policy_ids"))covered|=policyId.asText().equals(config.get("config_id"));
  check(receipt.path("profile").asText().equals("AMVP_REPORT_RECEIPT_1")&&raw.get("payload_sha256").equals(report.path("payload_sha256").asText())&&raw.get("request_sha256").equals(raw.get("payload_sha256"))&&receipt.path("ack").path("payload_sha256").equals(report.path("payload_sha256"))&&receipt.path("ack").path("item_id").equals(report.path("report_id"))&&selected.path("runtime_revision").asLong()==report.path("runtime_revision").asLong()&&covered,409,"STORE_UNCONFIRMED");
  long revision=report.path("runtime_revision").asLong();if(revision<((Number)config.get("saved_runtime_revision")).longValue())return pending;
  return switch(report.path("state").asText()){
   case "APPLIED" -> new AdditionalConfigStore.ApplyState("APPLIED",revision);
   case "FAILED","UNKNOWN" -> new AdditionalConfigStore.ApplyState("UNKNOWN",null);
   case "RELEASED" -> new AdditionalConfigStore.ApplyState(!s.parse(config.get("value_json")).path("enabled").asBoolean()?"NOT_APPLICABLE":"UNKNOWN",null);
   default -> pending;
  };
 }
}
