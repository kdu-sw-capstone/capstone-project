package kr.ac.kdu.focurve;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.util.*;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.transaction.PlatformTransactionManager;
import static kr.ac.kdu.focurve.MemberAuth.*;

/** RC2 configuration persistence. No D06/Content writes and no direct policy execution. */
final class AdditionalConfigStore {
 record ApplyState(String state,Long appliedRevision){}
 /** Trusted server adapter, never a request-supplied capability boolean or artifact hash. */
 interface Admission {
  void verify(Identity principal,String executor,String binding,boolean mutation);
  /** Must persist the canonical package/outbox in the caller's transaction or throw. */
  void publish(String binding,String configId,long revision,JsonNode value,boolean deleted);
  default ApplyState appliedState(Map<String,Object> savedConfig){return new ApplyState("PENDING",null);}
 }
 private final MemberAuth a;
 private final AdditionalConfigContract contract;
 private final Admission admission;
 private final TransactionTemplate writes,reads;
 AdditionalConfigStore(MemberAuth auth,PlatformTransactionManager manager,Admission admission) {
  a=auth;contract=new AdditionalConfigContract(a.json);this.admission=Objects.requireNonNull(admission);
  writes=new TransactionTemplate(manager);reads=new TransactionTemplate(manager);reads.setReadOnly(true);
  reads.setIsolationLevel(org.springframework.transaction.TransactionDefinition.ISOLATION_REPEATABLE_READ);
 }
 private String binding(Identity principal,String executor,boolean mutation) {
  contract.validate("Uuid",a.json.valueToTree(executor));
  check(principal.executor()==null||principal.executor().equals(executor),404,"RESOURCE_NOT_FOUND");
  // All writers acquire the installation before its binding. Old bindings cannot authorize a new owner.
  var installation=a.one("SELECT current_user_id FROM extension_installations WHERE id=?"+(mutation?" FOR UPDATE":""),executor);
  check(installation!=null&&installation.get("current_user_id") instanceof Number&&((Number)installation.get("current_user_id")).longValue()==principal.user(),404,"RESOURCE_NOT_FOUND");
  var rows=a.db.queryForList("SELECT binding_id FROM amvp_owner_bindings WHERE executor_id=? AND user_id=? AND state='ACTIVE' AND closed_at IS NULL ORDER BY owner_epoch DESC LIMIT 2"+(mutation?" FOR UPDATE":""),executor,principal.user());
  check(rows.size()==1,409,"STALE_OWNER");String binding=rows.getFirst().get("binding_id").toString();
  admission.verify(principal,executor,binding,mutation);return binding;
 }
 ObjectNode get(Identity i,String configId) {
  contract.validate("Uuid",a.json.valueToTree(configId));
  return reads.execute(tx->{var row=owned(i,configId);String active=binding(i,row.get("executor_id").toString(),false);check(row.get("owner_binding_id").equals(active),404,"RESOURCE_NOT_FOUND");return record(row);});
 }
 /** OP-01 deletion tracking: storage acceptance is never an effect confirmation. */
 ObjectNode operation(Identity principal,String operationId){
  contract.validate("Uuid",a.json.valueToTree(operationId));
  return reads.execute(tx->{
   var receipt=a.one("SELECT o.*,b.executor_id FROM amvp_operations o JOIN amvp_owner_bindings b ON b.binding_id=o.owner_binding_id WHERE o.operation_id=? AND b.user_id=? AND b.state='ACTIVE' AND b.closed_at IS NULL"+(principal.executor()==null?"":" AND b.executor_id=?"),principal.executor()==null?new Object[]{operationId,principal.user()}:new Object[]{operationId,principal.user(),principal.executor()});
   check(receipt!=null,404,"RESOURCE_NOT_FOUND");String owner=binding(principal,receipt.get("executor_id").toString(),false);
   check(receipt.get("owner_binding_id").equals(owner),404,"RESOURCE_NOT_FOUND");
   String route=receipt.get("route").toString(),prefix="DELETE:/api/v1/amvp/configs/";
   // Other stream receipts have their own schema/authority; do not reinterpret a usage ACK.
   check(route.startsWith(prefix),503,"UNSUPPORTED_CONTRACT");String id=route.substring(prefix.length());contract.validate("Uuid",a.json.valueToTree(id));
   var row=owned(principal,id);check(row.get("owner_binding_id").equals(owner)&&row.get("deleted_at")!=null,409,"RELEASE_UNCONFIRMED");
   deletionReceipt(owner,row); // durable operation identity, original hash and immutable tombstone
   var state=admission.appliedState(row);
   boolean released=row.get("kind").equals("SITE_TIME")&&state.state().equals("NOT_APPLICABLE");
   String status=released?"CONFIRMED":state.state().equals("UNKNOWN")||state.state().equals("APPLIED")?"IN_DOUBT":"RELEASE_PENDING";
   ObjectNode result=a.obj("operation_id",operationId,"state",status,"actual_effect_confirmed",released,"error_code",status.equals("IN_DOUBT")?"RELEASE_UNCONFIRMED":null);
   contract.validate("OperationState",result);return result;
  });
 }
 private Map<String,Object> owned(Identity i,String configId) {
  var row=a.one("SELECT c.*,b.executor_id FROM amvp_configs c JOIN amvp_owner_bindings b ON b.binding_id=c.owner_binding_id WHERE c.config_id=? AND b.user_id=?"+(i.executor()==null?"":" AND b.executor_id=?"),i.executor()==null?new Object[]{configId,i.user()}:new Object[]{configId,i.user(),i.executor()});
  check(row!=null,404,"RESOURCE_NOT_FOUND");return row;
 }
 ObjectNode list(Identity i,String executor,String kind,String cursor,int limit) {
  return page(i,executor,kind,cursor,limit,false);
 }
 /** Web-owned additive read model; CFG01 continues excluding tombstones. */
 ObjectNode deletions(Identity i,String executor,String cursor,int limit){return page(i,executor,"SITE_TIME",cursor,limit,true);}
 private ObjectNode page(Identity i,String executor,String kind,String cursor,int limit,boolean deleted) {
  check(limit>=1&&limit<=100,400,"VALIDATION_FAILED");
  check(kind==null||Set.of("CONTENT","CADENCE","SITE_TIME","FOCUS_SCHEDULE").contains(kind),400,"VALIDATION_FAILED");
  return reads.execute(tx->{String binding=binding(i,executor,false);var items=a.json.createArrayNode();String after="";
   if(cursor!=null) {
    try {check(cursor.length()<=2048,400,"VALIDATION_FAILED");var token=parse(a.crypt(cursor,false));
     check(token.path("binding").asText().equals(binding)&&Objects.equals(token.path("kind").isNull()?null:token.path("kind").asText(),kind)&&token.path("limit").asInt()==limit,400,"VALIDATION_FAILED");
     check(deleted?token.path("view").asText().equals("SITE_TIME_DELETIONS_1"):!token.has("view"),400,"VALIDATION_FAILED");
     after=token.path("after").asText();contract.validate("Uuid",a.json.valueToTree(after));
    }catch(RuntimeException error){throw new Failure(400,"VALIDATION_FAILED");}
   }
   var rows=a.db.queryForList("SELECT c.*,? AS executor_id FROM amvp_configs c WHERE owner_binding_id=? AND deleted_at IS "+(deleted?"NOT NULL":"NULL")+(kind==null?"":" AND kind=?")+" AND config_id>? ORDER BY config_id LIMIT ?",kind==null?new Object[]{executor,binding,after,limit+1}:new Object[]{executor,binding,kind,after,limit+1});
   for(int n=0;n<Math.min(limit,rows.size());n++){var row=rows.get(n);if(deleted)deletionReceipt(binding,row);items.add(record(row));}
   boolean more=rows.size()>limit;
   var token=a.obj("binding",binding,"kind",kind,"limit",limit,"after",more?items.get(items.size()-1).path("config_id").asText():null);if(deleted)token.put("view","SITE_TIME_DELETIONS_1");String next=more?a.crypt(token.toString(),true):null;
   var result=a.obj("items",items,"next_cursor",next,"has_more",more);if(deleted)result.put("read_model","AMVP_SITE_TIME_DELETIONS_1");return result;
  });
 }
 private void deletionReceipt(String binding,Map<String,Object> config){
  var rows=a.db.queryForList("SELECT * FROM amvp_operations WHERE owner_binding_id=? AND route=?",binding,"DELETE:/api/v1/amvp/configs/"+config.get("config_id"));check(rows.size()==1,409,"STORE_UNCONFIRMED");var receipt=rows.getFirst();contract.validate("Uuid",a.json.valueToTree(receipt.get("operation_id")));
  check(receipt.get("state").equals("CONFIRMED")&&receipt.get("request_sha256").equals(hash("{}")),409,"STORE_UNCONFIRMED");
  // RC2 permits response-cache expiry while retaining the durable operation identity.
  // Do not reconstruct the old ACK or confuse its optional cache with release evidence.
  if(receipt.get("response_json")!=null){var response=parse(receipt.get("response_json"));contract.validate("OperationState",response);check(response.path("operation_id").asText().equals(receipt.get("operation_id"))&&response.path("state").asText().equals("RELEASE_PENDING")&&response.path("actual_effect_confirmed").isBoolean()&&!response.path("actual_effect_confirmed").asBoolean(),409,"STORE_UNCONFIRMED");}
  var version=a.one("SELECT payload_sha256 FROM amvp_config_versions WHERE config_id=? AND version=?",config.get("config_id"),config.get("version"));check(version!=null&&version.get("payload_sha256").equals(hash(AdditionalConfigContract.canonical(parse(config.get("value_json"))))),409,"STORE_UNCONFIRMED");
 }
 ObjectNode put(Identity principal,String configId,JsonNode body,String match,String none,String key) {
  contract.validate("Uuid",a.json.valueToTree(configId));contract.validate("Uuid",a.json.valueToTree(key));
  contract.validate("ConfigWrite",body);String executor=body.path("executor_id").asText();
  return writes.execute(tx->{String binding=binding(principal,executor,true);String route="PUT:/api/v1/amvp/configs/"+configId;
   String requestHash=hash(AdditionalConfigContract.canonical(body));var replay=receipt(binding,route,key,requestHash);if(replay!=null)return replay;
   var row=a.one("SELECT * FROM amvp_configs WHERE config_id=? FOR UPDATE",configId);
   check(row==null||row.get("owner_binding_id").equals(binding),404,"RESOURCE_NOT_FOUND");
   check(row==null||row.get("deleted_at")==null,412,"VERSION_CONFLICT");
   Long oldVersion=row==null?null:((Number)row.get("version")).longValue();AdditionalConfigContract.precondition(match,none,oldVersion);
   String kind=body.path("value").path("kind").asText();check(row==null||kind.equals(row.get("kind")),422,"VALIDATION_FAILED");
   if(Set.of("CONTENT","CADENCE").contains(kind))check(a.one("SELECT config_id FROM amvp_configs WHERE owner_binding_id=? AND kind=? AND deleted_at IS NULL AND config_id<>?",binding,kind,configId)==null,409,"IDEMPOTENCY_CONFLICT");
   long version=AdditionalConfigContract.next(oldVersion==null?0:oldVersion);ObjectNode value=body.path("value").deepCopy();
   if(kind.equals("SITE_TIME")) {
    check(value.path("policy_id").asText().equals(configId)&&value.path("version").asLong()==(oldVersion==null?1:oldVersion),422,"VALIDATION_FAILED");
    value.put("version",version);String site=value.path("site_id").isNull()?null:value.path("site_id").asText();
    if(site!=null)check(a.one("SELECT id FROM sites WHERE id=? AND user_id=? AND deleted_at IS NULL",site,principal.user())!=null,404,"RESOURCE_NOT_FOUND");
   }
   if(kind.equals("FOCUS_SCHEDULE"))check(value.path("schedule_id").asText().equals(configId),422,"VALIDATION_FAILED");
   long revision=revision(binding);String canonical=AdditionalConfigContract.canonical(value);
   if(row==null)a.db.update("INSERT INTO amvp_configs(config_id,owner_binding_id,kind,version,value_json,saved_runtime_revision,updated_at) VALUES(?,?,?,?,?,?,?)",configId,binding,kind,version,canonical,revision,now());
   else a.db.update("UPDATE amvp_configs SET version=?,value_json=?,saved_runtime_revision=?,updated_at=? WHERE config_id=?",version,canonical,revision,now(),configId);
   a.db.update("INSERT INTO amvp_config_versions(config_id,version,value_json,payload_sha256,created_at) VALUES(?,?,?,?,?)",configId,version,canonical,hash(canonical),now());
   admission.publish(binding,configId,revision,value.deepCopy(),false);
   ObjectNode result=record(owned(principal,configId));saveReceipt(binding,route,key,requestHash,result);return result;
  });
 }
 ObjectNode delete(Identity principal,String configId,String match,String key) {
  contract.validate("Uuid",a.json.valueToTree(configId));contract.validate("Uuid",a.json.valueToTree(key));
  return writes.execute(tx->{var initial=owned(principal,configId);String binding=binding(principal,initial.get("executor_id").toString(),true);check(initial.get("owner_binding_id").equals(binding),404,"RESOURCE_NOT_FOUND");
   String route="DELETE:/api/v1/amvp/configs/"+configId,requestHash=hash("{}");var replay=receipt(binding,route,key,requestHash);if(replay!=null)return replay;
   var row=a.one("SELECT * FROM amvp_configs WHERE config_id=? AND owner_binding_id=? FOR UPDATE",configId,binding);
   check(row!=null&&row.get("deleted_at")==null,412,"VERSION_CONFLICT");
   AdditionalConfigContract.precondition(match,null,((Number)row.get("version")).longValue());long version=AdditionalConfigContract.next(((Number)row.get("version")).longValue()),revision=revision(binding);
   JsonNode value=parse(row.get("value_json"));if(value.path("kind").asText().equals("SITE_TIME"))((ObjectNode)value).put("version",version);
   String canonical=AdditionalConfigContract.canonical(value);
   a.db.update("UPDATE amvp_configs SET deleted_at=?,updated_at=?,version=?,value_json=?,saved_runtime_revision=? WHERE config_id=?",now(),now(),version,canonical,revision,configId);
   a.db.update("INSERT INTO amvp_config_versions(config_id,version,value_json,payload_sha256,created_at) VALUES(?,?,?,?,?)",configId,version,canonical,hash(canonical),now());
   admission.publish(binding,configId,revision,value,true);
   ObjectNode result=a.obj("operation_id",id(),"state","RELEASE_PENDING","actual_effect_confirmed",false,"error_code",null);
   contract.validate("OperationState",result);saveReceipt(binding,route,key,requestHash,result);return result;
  });
 }
 private long revision(String binding) {
  Long last=a.db.queryForObject("SELECT GREATEST(COALESCE((SELECT MAX(saved_runtime_revision) FROM amvp_configs WHERE owner_binding_id=?),0),COALESCE((SELECT MAX(runtime_revision) FROM amvp_packages WHERE owner_binding_id=?),0))",Long.class,binding,binding);
  return AdditionalConfigContract.next(last==null?0:last);
 }
 private ObjectNode receipt(String binding,String route,String key,String requestHash) {
  var row=a.one("SELECT request_sha256,response_json,state FROM amvp_operations WHERE owner_binding_id=? AND route=? AND idempotency_key=?",binding,route,key);
  if(row==null)return null;check(row.get("request_sha256").equals(requestHash),409,"IDEMPOTENCY_CONFLICT");
  check(row.get("response_json")!=null&&row.get("state").equals("CONFIRMED"),409,"RELEASE_UNCONFIRMED");return (ObjectNode)parse(row.get("response_json"));
 }
 private void saveReceipt(String binding,String route,String key,String requestHash,ObjectNode result) {
  a.db.update("INSERT INTO amvp_operations(operation_id,owner_binding_id,route,idempotency_key,request_sha256,state,response_json,updated_at) VALUES(?,?,?,?,?,'CONFIRMED',?,?)",result.has("operation_id")?result.path("operation_id").asText():id(),binding,route,key,requestHash,result.toString(),now());
 }
 private JsonNode parse(Object value){try{return a.json.readTree(value.toString());}catch(java.io.IOException e){throw new Failure(409,"STORE_UNCONFIRMED");}}
 private String utc(Object value){return new java.time.format.DateTimeFormatterBuilder().appendInstant(3).toFormatter().format(java.time.Instant.parse(instant(value)));}
 private ObjectNode record(Map<String,Object> row) {
  ObjectNode result=a.obj("config_id",row.get("config_id"),"executor_id",row.get("executor_id"),"version",row.get("version"),"value",parse(row.get("value_json")),"deleted_at",row.get("deleted_at")==null?null:utc(row.get("deleted_at")),"saved_state","SAVED","runtime_apply_state","PENDING","saved_runtime_revision",row.get("saved_runtime_revision"),"applied_runtime_revision",null,"next_focus_revision",row.get("saved_runtime_revision"),"updated_at",utc(row.get("updated_at")));
  var applied=admission.appliedState(row);result.put("runtime_apply_state",applied.state());if(applied.appliedRevision()!=null)result.put("applied_runtime_revision",applied.appliedRevision());
  contract.validate("ConfigRecord",result);return result;
 }
}
