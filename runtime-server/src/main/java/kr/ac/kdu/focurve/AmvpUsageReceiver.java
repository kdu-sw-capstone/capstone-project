package kr.ac.kdu.focurve;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.sql.Timestamp;
import java.time.*;
import java.util.*;
import java.util.function.Supplier;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.TransactionTemplate;
import static kr.ac.kdu.focurve.MemberAuth.*;
import static kr.ac.kdu.focurve.AmvpBridgeSupport.*;

/** Per-item durable receipt/clock boundary. Does not claim that a Core collector is connected. */
final class AmvpUsageReceiver {
 /** A server verifier must prove clock continuity, day allocation and any initial quota carry. */
 record VerifiedCapture(boolean counted,Map<String,Long> initialCarry){
  VerifiedCapture{initialCarry=Map.copyOf(initialCarry);}
  static VerifiedCapture quarantine(){return new VerifiedCapture(false,Map.of());}
 }
 interface ClockProof {VerifiedCapture verify(Identity principal,Binding binding,ObjectNode segment,String predecessorHash);}
 private final AmvpBridgeSupport support;private final ClockProof proof;private final TransactionTemplate itemTransaction;
 AmvpUsageReceiver(MemberAuth auth,PlatformTransactionManager manager,CapabilitySource capabilities,ClockProof proof){
  support=new AmvpBridgeSupport(auth,capabilities);this.proof=Objects.requireNonNull(proof);itemTransaction=new TransactionTemplate(manager);itemTransaction.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
 }
 ObjectNode batch(Supplier<Identity> authenticate,ObjectNode body){
  // Validate routable identity before any commit; invalid item contents are rejected independently.
  check(body.size()==5&&body.has("stream")&&body.has("schema_version")&&body.has("batch_id")&&body.has("executor_id")&&body.has("segments"),400,"VALIDATION_FAILED");
  check(body.path("stream").asText().equals("RUNTIME_USAGE")&&body.path("schema_version").asText().equals("AMVP_BROWSER_USAGE_2")&&body.path("segments").isArray()&&body.path("segments").size()>=1&&body.path("segments").size()<=100,400,"VALIDATION_FAILED");
  for(String field:List.of("batch_id","executor_id"))support.contract.validate("Uuid",body.path(field));
  for(var segment:body.path("segments")){support.contract.validate("Uuid",segment.path("segment_id"));check(segment.path("payload_sha256").isTextual()&&segment.path("payload_sha256").asText().matches("[0-9a-f]{64}"),400,"VALIDATION_FAILED");}
  ObjectNode result=support.auth.obj("batch_id",body.path("batch_id").asText());var items=result.putArray("items");
  for(var segment:body.path("segments")){
   ObjectNode item=(ObjectNode)segment;
   try{ObjectNode acknowledged=itemTransaction.execute(tx->receive(authenticate.get(),body.path("executor_id").asText(),item));items.add(acknowledged);}
   catch(Failure failure){items.add(ack(item,"REJECTED",failure.code,"UNCONFIRMED"));}
  }
  support.contract.validate("UsageBatchAck",result);return result;
 }
 private ObjectNode receive(Identity principal,String executor,ObjectNode item){
  check(principal.executor()!=null&&principal.executor().equals(executor),403,"FORBIDDEN_EXECUTOR");
  var binding=support.binding(principal,executor,true);support.capability(principal,binding,"RUNTIME_USAGE");support.contract.validate("ClockedUsageSegment",item);hashMatches(item);
  check(item.path("executor_id").asText().equals(executor)&&item.path("owner_binding_id").asText().equals(binding.id()),403,"FORBIDDEN_EXECUTOR");
  var a=support.auth;String id=item.path("segment_id").asText(),hash=item.path("payload_sha256").asText(),epoch=item.path("collector_epoch").asText();long seq=item.path("local_usage_seq").asLong();
  var old=a.one("SELECT * FROM amvp_usage_segments WHERE segment_id=?",id);
  if(old!=null){check(old.get("owner_binding_id").equals(binding.id())&&old.get("executor_id").equals(executor)&&old.get("payload_sha256").equals(hash),409,"SOURCE_CONFLICT");String oldState=old.get("measurement_state").toString();return ack(item,"DUPLICATE",null,Set.of("COUNTED","QUARANTINED").contains(oldState)?oldState:"UNCONFIRMED");}
  String route="USG01:"+executor+":"+epoch+":"+seq;
  var receipt=a.one("SELECT * FROM amvp_operations WHERE operation_id=?",id);
  if(receipt!=null)check(receipt.get("owner_binding_id").equals(binding.id())&&receipt.get("route").equals(route)&&receipt.get("request_sha256").equals(hash)&&receipt.get("state").equals("PENDING_DEPENDENCY"),409,"SOURCE_CONFLICT");
  var position=a.one("SELECT segment_id FROM amvp_usage_segments WHERE executor_id=? AND collector_epoch=? AND local_usage_seq=?",executor,epoch,seq);check(position==null,409,"SEQUENCE_REUSE");
  var reserved=a.one("SELECT operation_id FROM amvp_operations WHERE route=?",route);check(reserved==null||reserved.get("operation_id").equals(id),409,"SEQUENCE_REUSE");
  var clock=item.path("clock");long lo=clock.path("mono_start_ms").asLong(),hi=clock.path("mono_end_ms").asLong();Instant start=Instant.parse(item.path("start_at").asText()),end=Instant.parse(item.path("end_at").asText()),dayStart=Instant.parse(item.path("day_start_at").asText()),dayEnd=Instant.parse(item.path("day_end_at").asText()),anchor=Instant.parse(clock.path("anchor_utc").asText());
  check(lo<hi&&item.path("confirmed_ms").asLong()+item.path("uncertain_ms").asLong()==hi-lo,422,"DURATION_MISMATCH");
  check(start.equals(anchor.plusMillis(lo-clock.path("anchor_mono_ms").asLong()))&&end.equals(anchor.plusMillis(hi-clock.path("anchor_mono_ms").asLong())),422,"ANCHOR_PROJECTION_MISMATCH");
  check(!start.isBefore(dayStart)&&!end.isAfter(dayEnd),422,"DAY_BOUNDARY_SPLIT_REQUIRED");
  String host=item.path("actual_host").asText();check(MemberSites.host(host).equals(host),422,"VALIDATION_FAILED");
  var packageRow=a.one("SELECT * FROM amvp_packages WHERE package_id=? AND owner_binding_id=? AND runtime_revision=?",item.path("package_id").asText(),binding.id(),item.path("runtime_revision").asLong());if(packageRow==null)return pending(item,binding,route,receipt==null);
  var pack=support.parse(packageRow.get("payload_json"));support.contract.validate("RuntimePackage",pack);hashMatches(pack);
  check(!start.isBefore(Instant.parse(pack.path("issued_at").asText())),422,"POLICY_ATTRIBUTION_MISMATCH");
  check(packageRow.get("payload_sha256").equals(pack.path("payload_sha256").asText())&&pack.path("owner_binding_id").asText().equals(binding.id())&&pack.path("package_id").equals(item.path("package_id"))&&pack.path("runtime_revision").asLong()==item.path("runtime_revision").asLong()&&pack.path("executor_id").asText().equals(executor)&&pack.path("timezone").equals(item.path("timezone"))&&pack.path("timezone_version").asLong()==item.path("timezone_version").asLong(),422,"SOURCE_CONFLICT");
  var matching=new LinkedHashMap<String,JsonNode>();for(var policy:pack.path("runtime_policies"))if(policy.path("enabled").asBoolean()&&matches(host,policy.path("scope")))matching.put(policy.path("policy_id").asText(),policy);
  var attributed=new HashSet<String>();for(var attribution:item.path("policy_attributions")){String policyId=attribution.path("policy_id").asText();var policy=matching.get(policyId);check(policy!=null&&attributed.add(policyId)&&attribution.path("policy_version").equals(policy.path("version"))&&attribution.path("matched_policy_host").equals(policy.path("scope").path("host")),422,"POLICY_ATTRIBUTION_MISMATCH");}check(attributed.equals(matching.keySet()),422,"POLICY_ATTRIBUTION_MISMATCH");
  // A focus reference requires a real frozen focus verifier; never turn a schema-valid claim into focus time.
  check(item.path("focus_ref").isNull(),503,"UNSUPPORTED_CONTRACT");
  var predecessor=a.one("SELECT local_usage_seq,payload_sha256 FROM amvp_usage_segments WHERE executor_id=? AND collector_epoch=? ORDER BY local_usage_seq DESC LIMIT 1",executor,epoch);
  long last=predecessor==null?0:((Number)predecessor.get("local_usage_seq")).longValue();String previous=predecessor==null?null:predecessor.get("payload_sha256").toString();
  check(seq>last,409,"STALE_SEQUENCE");
  if(seq!=last+1)return pending(item,binding,route,receipt==null);
  check(Objects.equals(previous,item.path("previous_segment_sha256").isNull()?null:item.path("previous_segment_sha256").asText()),409,"CHAIN_CONFLICT");
  check(a.one("SELECT segment_id FROM amvp_usage_segments WHERE executor_id=? AND clock_boot_id=? AND mono_start_ms<? AND mono_end_ms>? LIMIT 1",executor,clock.path("boot_id").asText(),hi,lo)==null,409,"MONOTONIC_OVERLAP");
  VerifiedCapture verified=proof.verify(principal,binding,item.deepCopy(),previous);
  var registered=a.one("SELECT * FROM amvp_clock_anchors WHERE anchor_id=? AND owner_binding_id=? AND executor_id=? AND verification_state='VERIFIED'",clock.path("anchor_id").asText(),binding.id(),executor);
  boolean anchored=registered!=null&&registered.get("clock_epoch").equals(clock.path("clock_epoch").asText())&&registered.get("boot_id").equals(clock.path("boot_id").asText())&&((Number)registered.get("anchor_mono_ms")).longValue()==clock.path("anchor_mono_ms").asLong()&&Instant.parse(instant(registered.get("anchor_utc"))).equals(anchor);
  boolean counted=verified.counted()&&anchored&&clock.path("quality").asText().equals("TRUSTED");String state=counted?"COUNTED":"QUARANTINED";
  a.db.update("INSERT INTO amvp_usage_segments(segment_id,owner_binding_id,executor_id,collector_epoch,local_usage_seq,actual_host,start_at,end_at,confirmed_ms,uncertain_ms,payload_json,payload_sha256,clock_epoch,clock_boot_id,mono_start_ms,mono_end_ms,measurement_state) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",id,binding.id(),executor,epoch,seq,host,Timestamp.from(start),Timestamp.from(end),item.path("confirmed_ms").asLong(),item.path("uncertain_ms").asLong(),AdditionalConfigContract.canonical(item),hash,clock.path("clock_epoch").asText(),clock.path("boot_id").asText(),lo,hi,state);
  if(counted)for(var policy:matching.values())if(!policy.path("daily_limit_ms").isNull())project(binding,item,policy,verified);
  var accepted=ack(item,"ACCEPTED",null,state);
  if(receipt==null)a.db.update("INSERT INTO amvp_operations(operation_id,owner_binding_id,route,idempotency_key,request_sha256,state,response_json,updated_at) VALUES(?,?,?,?,?,'CONFIRMED',?,?)",id,binding.id(),route,id,hash,AdditionalConfigContract.canonical(accepted),now());
  else a.db.update("UPDATE amvp_operations SET state='CONFIRMED',response_json=?,updated_at=? WHERE operation_id=?",AdditionalConfigContract.canonical(accepted),now(),id);
  return accepted;
 }
 private void project(Binding binding,ObjectNode item,JsonNode policy,VerifiedCapture verified){
  var a=support.auth;String policyId=policy.path("policy_id").asText(),chain=item.path("enforcement_day_chain_id").asText();Timestamp start=Timestamp.from(Instant.parse(item.path("day_start_at").asText())),end=Timestamp.from(Instant.parse(item.path("day_end_at").asText()));long amount=item.path("confirmed_ms").asLong(),limit=policy.path("daily_limit_ms").asLong();
  var old=a.one("SELECT * FROM amvp_day_budgets WHERE executor_id=? AND policy_id=? AND day_start_at=? FOR UPDATE",binding.executor(),policyId,start);
  if(old==null){Long carry=verified.initialCarry().get(policyId);if(carry==null)return;check(carry>=0&&carry<=AdditionalConfigContract.MAX_VERSION,422,"VALIDATION_FAILED");a.db.update("INSERT INTO amvp_day_budgets(executor_id,policy_id,day_start_at,day_end_at,enforcement_day_chain_id,confirmed_ms,budget_carry_debit_ms,daily_limit_ms,version) VALUES(?,?,?,?,?,?,?,?,1)",binding.executor(),policyId,start,end,chain,amount,carry,limit);}
  else{check(old.get("enforcement_day_chain_id").equals(chain)&&instant(old.get("day_end_at")).equals(instant(end))&&old.get("daily_limit_ms") instanceof Number&&((Number)old.get("daily_limit_ms")).longValue()==limit,409,"DAY_PROJECTION_CONFLICT");long previous=((Number)old.get("confirmed_ms")).longValue();check(previous<=AdditionalConfigContract.MAX_VERSION-amount,422,"VERSION_LIMIT");long total=previous+amount;a.db.update("UPDATE amvp_day_budgets SET confirmed_ms=?,version=? WHERE executor_id=? AND policy_id=? AND day_start_at=?",total,AdditionalConfigContract.next(((Number)old.get("version")).longValue()),binding.executor(),policyId,start);}
 }
 Optional<ObjectNode> knownStatus(Supplier<Identity> authenticate,String executor,String itemId){
  support.contract.validate("Uuid",support.auth.json.valueToTree(itemId));return itemTransaction.execute(tx->{var principal=authenticate.get();check(principal.executor()!=null&&principal.executor().equals(executor),403,"FORBIDDEN_EXECUTOR");var binding=support.binding(principal,executor,false);support.capability(principal,binding,"RUNTIME_USAGE");var row=support.auth.one("SELECT response_json FROM amvp_operations WHERE operation_id=? AND owner_binding_id=? AND route LIKE ?",itemId,binding.id(),"USG01:"+executor+":%");return row==null?Optional.empty():Optional.of(support.parse(row.get("response_json")));});
 }
 private ObjectNode pending(ObjectNode item,Binding binding,String route,boolean insert){var result=ack(item,"PENDING_DEPENDENCY",null,"UNCONFIRMED");if(insert)support.auth.db.update("INSERT INTO amvp_operations(operation_id,owner_binding_id,route,idempotency_key,request_sha256,state,response_json,updated_at) VALUES(?,?,?,?,?,'PENDING_DEPENDENCY',?,?)",item.path("segment_id").asText(),binding.id(),route,item.path("segment_id").asText(),item.path("payload_sha256").asText(),AdditionalConfigContract.canonical(result),now());return result;}
 private ObjectNode ack(JsonNode item,String status,String error,String measurement){return support.auth.obj("item_id",item.path("segment_id").asText(),"payload_sha256",item.path("payload_sha256").asText(),"status",status,"error_code",error,"measurement_state",measurement);}
}
