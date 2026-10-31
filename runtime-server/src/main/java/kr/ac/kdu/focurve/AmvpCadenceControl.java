package kr.ac.kdu.focurve;

import com.fasterxml.jackson.databind.node.ObjectNode;
import java.sql.Timestamp;
import java.time.*;
import java.util.*;
import java.util.function.Supplier;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import static kr.ac.kdu.focurve.MemberAuth.*;
import static kr.ac.kdu.focurve.AmvpBridgeSupport.*;

/** RC2 coordinated command/receipt sidecar. No timer, cycle scheduler or legacy actor mutation. */
final class AmvpCadenceControl {
 record Bootstrap(long generation,ObjectNode state){}
 record Receipt(String id,long generation,long sequence,Instant observedAt,ObjectNode state,ObjectNode frozen,String evidenceSha){}
 interface Authority {
  /** Verify the unique prepared focus authority, coordinated writer fencing and receipt-bound Core generation,
   * not merely the legacy Session state. Recreated actors must not execute an old receipt's queued commands.
   * This is a read-only proof check; never create a session or apply policies during a query. */
  Bootstrap inspect(Identity principal,Binding binding,ObjectNode frozen);
  /** Verify current-generation operation/ACK, observed time, focus-only effects/release and runtime unchanged.
   * Raw APPLIED/PAUSED, a digest, or an HTTP acknowledgement is not actual effect evidence. */
  void verify(Identity principal,Binding binding,ObjectNode issued,ObjectNode frozen,Receipt receipt);
 }
 record View(ObjectNode state,long version,ObjectNode context){}
 private final AmvpBridgeSupport s;private final Authority authority;private final Clock clock;private final TransactionTemplate tx;
 AmvpCadenceControl(MemberAuth auth,PlatformTransactionManager manager,CapabilitySource source,Authority authority,Clock clock){s=new AmvpBridgeSupport(auth,source);this.authority=authority;this.clock=clock;tx=new TransactionTemplate(manager);}
 private Map<String,Object> session(Identity principal,String id){
  s.contract.validate("Uuid",s.auth.json.valueToTree(id));var row=s.auth.one("SELECT * FROM focus_sessions WHERE source_session_id=? AND user_id=?"+(principal.executor()==null?"":" AND executor_id=?"),principal.executor()==null?new Object[]{id,principal.user()}:new Object[]{id,principal.user(),principal.executor()});check(row!=null,404,"RESOURCE_NOT_FOUND");return row;
 }
 private ObjectNode frozen(Binding owner,Map<String,Object> session){
  var a=s.auth;var definition=a.one("SELECT * FROM amvp_cadence_definitions WHERE owner_binding_id=?",owner.id());check(definition!=null&&!Boolean.TRUE.equals(definition.get("deleted")),503,"UNSUPPORTED_CONTRACT");
  var cadence=s.parse(definition.get("value_json"));s.contract.validate("CadenceConfig",cadence);check(cadence.path("enabled").asBoolean()&&hash(AdditionalConfigContract.canonical(cadence)).equals(definition.get("payload_sha256")),503,"UNSUPPORTED_CONTRACT");
  var snapshot=a.one("SELECT * FROM policy_snapshots WHERE id=? AND user_id=? AND executor_id=?",session.get("policy_snapshot_id"),owner.user(),owner.executor());check(snapshot!=null,409,"RELEASE_UNCONFIRMED");
  String raw=snapshot.get("payload").toString();check(hash(raw).equals(snapshot.get("payload_hash")),409,"RELEASE_UNCONFIRMED");
  ObjectNode ref=a.obj("session_id",session.get("source_session_id"),"snapshot_id",snapshot.get("id"),"snapshot_format",snapshot.get("format_version"),"snapshot_sha256",snapshot.get("payload_hash"),"desired_revision",session.get("desired_revision"));s.contract.validate("FocusRef",ref);
  ref=s.parse(AdditionalConfigContract.canonical(ref));
  var attachments=a.db.queryForList("SELECT * FROM amvp_focus_attachments WHERE session_uuid=? AND owner_binding_id=?",session.get("source_session_id"),owner.id());check(attachments.size()<=1,409,"SOURCE_CONFLICT");ObjectNode attachment=null;
  if(!attachments.isEmpty()){var stored=attachments.getFirst();attachment=s.parse(stored.get("payload_json"));s.contract.validate("FocusAttachment",attachment);hashMatches(attachment);check(stored.get("payload_sha256").equals(attachment.path("payload_sha256").asText())&&attachment.path("focus_ref").equals(ref)&&attachment.path("owner_binding_id").asText().equals(owner.id())&&attachment.path("executor_id").asText().equals(owner.executor()),409,"SOURCE_CONFLICT");}
  // Normalize JSON integer nodes before crossing JDBC/HTTP. LongNode(1) and IntNode(1)
  // have identical RC2 bytes but Jackson's object equality otherwise rejects a valid replay.
  return s.parse(AdditionalConfigContract.canonical(a.obj("focus_ref",ref,"snapshot_raw",raw,"attachment",attachment,"cadence",cadence,"config_id",definition.get("config_id"),"config_version",definition.get("config_version"),"config_revision",definition.get("config_revision"))));
 }
 private void sameFrozen(ObjectNode frozen,Binding owner,Map<String,Object> session){
  var a=s.auth;var ref=frozen.path("focus_ref");check(ref.path("session_id").asText().equals(session.get("source_session_id"))&&ref.path("snapshot_id").asText().equals(session.get("policy_snapshot_id")),409,"SOURCE_CONFLICT");
  var snapshot=a.one("SELECT payload,payload_hash,format_version FROM policy_snapshots WHERE id=? AND user_id=? AND executor_id=?",session.get("policy_snapshot_id"),owner.user(),owner.executor());check(snapshot!=null&&frozen.path("snapshot_raw").asText().equals(snapshot.get("payload").toString())&&hash(snapshot.get("payload").toString()).equals(ref.path("snapshot_sha256").asText())&&snapshot.get("format_version").equals(ref.path("snapshot_format").asText()),409,"SOURCE_CONFLICT");
  var rows=a.db.queryForList("SELECT * FROM amvp_focus_attachments WHERE session_uuid=? AND owner_binding_id=?",session.get("source_session_id"),owner.id());
  if(frozen.path("attachment").isNull())check(rows.isEmpty(),409,"SOURCE_CONFLICT");
  else check(rows.size()==1&&s.parse(rows.getFirst().get("payload_json")).equals(frozen.path("attachment"))&&rows.getFirst().get("payload_sha256").equals(frozen.path("attachment").path("payload_sha256").asText()),409,"SOURCE_CONFLICT");
 }
 private record Scope(Binding binding,ObjectNode cap,Map<String,Object> session,Map<String,Object> run,ObjectNode frozen,Bootstrap bootstrap){}
 private Scope scope(Identity principal,String sessionId,boolean lock){
  var session=session(principal,sessionId);var binding=s.binding(principal,session.get("executor_id").toString(),lock);var cap=s.capability(principal,binding,"FOCUS_CONTROL");check(authority!=null,503,"CAPABILITY_NOT_VERIFIED");
  var run=s.auth.one("SELECT * FROM amvp_focus_runs WHERE session_uuid=?"+(lock?" FOR UPDATE":""),sessionId);ObjectNode frozen;
  if(run==null)frozen=frozen(binding,session);
  else{check(run.get("owner_binding_id").equals(binding.id())&&((Number)run.get("owner_epoch")).longValue()==binding.epoch(),409,"STALE_OWNER");frozen=s.parse(run.get("frozen_json"));check(hash(AdditionalConfigContract.canonical(frozen)).equals(run.get("frozen_sha256")),409,"SOURCE_CONFLICT");sameFrozen(frozen,binding,session);}
  var bootstrap=authority.inspect(principal,binding,frozen.deepCopy());check(bootstrap!=null&&bootstrap.generation()>0&&bootstrap.generation()<=AdditionalConfigContract.MAX_VERSION,503,"CAPABILITY_NOT_VERIFIED");s.contract.validate("FocusState",bootstrap.state());check(bootstrap.state().path("focus_ref").equals(frozen.path("focus_ref")),409,"SOURCE_CONFLICT");
  if(run==null)check(bootstrap.state().path("state").asText().equals("STARTING")&&bootstrap.state().path("confirmed_ms").asLong()==0,503,"CAPABILITY_NOT_VERIFIED"); // scope inspection cannot fabricate prior application evidence
  if(run!=null)check(((Number)run.get("actor_generation")).longValue()==bootstrap.generation(),409,"STALE_OWNER");
  return new Scope(binding,cap,session,run,frozen,bootstrap);
 }
 View get(Identity principal,String sessionId){return tx.execute(status->{var scope=scope(principal,sessionId,false);return view(scope);});}
 private View view(Scope scope){
  ObjectNode state=scope.run==null?s.parse(AdditionalConfigContract.canonical(scope.bootstrap.state())):s.parse(scope.run.get("state_json"));long version=scope.run==null?1:((Number)scope.run.get("version")).longValue();
  if(scope.run!=null){var control=s.auth.one("SELECT execute_before,operation_id FROM amvp_focus_controls WHERE operation_id=?",scope.run.get("current_operation_id"));
   if(control!=null&&Set.of("STARTING","PAUSING","RESUMING","ENDING").contains(state.path("state").asText())&&!Instant.parse(instant(control.get("execute_before"))).isAfter(clock.instant()))state.put("state","UNKNOWN").put("last_error_code","FOCUS_COMMAND_EXPIRED");}
  if(scope.run!=null&&scope.run.get("first_failure_json")!=null&&!Set.of("ENDED","UNKNOWN","START_FAILED").contains(state.path("state").asText()))state.put("state","UNKNOWN").set("last_error_code",s.parse(scope.run.get("first_failure_json")).path("last_error_code"));
  var context=s.auth.obj("owner_binding_id",scope.binding.id(),"executor_id",scope.binding.executor(),"owner_epoch",scope.binding.epoch(),"capability_receipt_id",scope.cap.path("capability_receipt_id").asText(),"attachment_id",scope.frozen.path("attachment").isNull()?null:scope.frozen.path("attachment").path("attachment_id").asText(),"version",version,"start_allowed",scope.run==null&&scope.bootstrap.state().path("state").asText().equals("STARTING"));
  context.put("execute_before",utc(clock.instant().plusMillis(5000)));
  if(!scope.frozen.path("cadence").path("deadline_at").isNull()&&!Instant.parse(scope.frozen.path("cadence").path("deadline_at").asText()).isAfter(clock.instant()))context.put("start_allowed",false);
  return new View(state,version,context);
 }
 View command(Identity principal,String sessionId,ObjectNode body,String match,String key){
  s.contract.validate("FocusControl",body);s.contract.validate("Uuid",s.auth.json.valueToTree(key));var command=(ObjectNode)body.path("command");check((command.path("action").asText().equals("START"))==!command.path("duration_minutes").isNull(),422,"VALIDATION_FAILED");
  return tx.execute(status->{var scope=scope(principal,sessionId,true);var a=s.auth;var owner=scope.binding;var current=view(scope);String operation=command.path("operation_id").asText(),action=command.path("action").asText();
   check(body.path("owner_binding_id").asText().equals(owner.id())&&body.path("executor_id").asText().equals(owner.executor())&&body.path("owner_epoch").asLong()==owner.epoch()&&body.path("capability_receipt_id").equals(scope.cap.path("capability_receipt_id")),403,"FORBIDDEN_EXECUTOR");
   check(command.path("focus_ref").equals(scope.frozen.path("focus_ref"))&&Objects.equals(command.path("attachment_id").isNull()?null:command.path("attachment_id").asText(),scope.frozen.path("attachment").isNull()?null:scope.frozen.path("attachment").path("attachment_id").asText()),409,"SOURCE_CONFLICT");
   var fingerprint=body.deepCopy();fingerprint.remove("request_id");String hash=hash(AdditionalConfigContract.canonical(fingerprint)+"|"+match);var replay=a.one("SELECT * FROM amvp_focus_controls WHERE owner_binding_id=? AND session_uuid=? AND request_key=?",owner.id(),sessionId,key);
   if(replay==null)replay=a.one("SELECT * FROM amvp_focus_controls WHERE operation_id=?",operation);
   if(replay!=null){check(replay.get("owner_binding_id").equals(owner.id())&&replay.get("session_uuid").equals(sessionId),404,"RESOURCE_NOT_FOUND");check(replay.get("request_sha256").equals(hash),409,"IDEMPOTENCY_CONFLICT");long replayVersion=((Number)replay.get("expected_version")).longValue()+1;return new View(s.parse(replay.get("response_json")),replayVersion,current.context.deepCopy().put("version",replayVersion).put("start_allowed",false));}
   AdditionalConfigContract.precondition(match,null,current.version);check(command.path("expected_version").asLong()==current.version,412,"VERSION_CONFLICT");
   Instant deadline=Instant.parse(body.path("execute_before").asText());check(deadline.isAfter(clock.instant())&&!deadline.isAfter(clock.instant().plusMillis(5000)),409,"RELEASE_UNCONFIRMED");
   String previous=current.state.path("state").asText();
   check(action.equals("START")?scope.run==null&&previous.equals("STARTING"):scope.run!=null&&switch(action){case "PAUSE"->previous.equals("RUNNING");case "RESUME"->previous.equals("PAUSED");case "END"->Set.of("RUNNING","PAUSED","UNKNOWN").contains(previous);default->false;},409,"RELEASE_UNCONFIRMED");
   if(action.equals("START")){check(current.context.path("start_allowed").asBoolean(),409,"RELEASE_UNCONFIRMED");check(command.path("duration_minutes").asInt()==scope.frozen.path("cadence").path("focus_minutes").asInt(),422,"VALIDATION_FAILED");}
   long next=AdditionalConfigContract.next(current.version);ObjectNode pending=current.state.deepCopy().put("operation_id",operation).put("state",switch(action){case "START"->"STARTING";case "PAUSE"->"PAUSING";case "RESUME"->"RESUMING";default->"ENDING";}).putNull("last_error_code");s.contract.validate("FocusState",pending);
   if(scope.run==null){String raw=AdditionalConfigContract.canonical(scope.frozen);a.db.update("INSERT INTO amvp_focus_runs(session_uuid,owner_binding_id,executor_id,owner_epoch,actor_generation,version,frozen_json,frozen_sha256,state_json,current_operation_id) VALUES(?,?,?,?,?,?,?,?,?,?)",sessionId,owner.id(),owner.executor(),owner.epoch(),scope.bootstrap.generation(),next,raw,hash(raw),pending.toString(),operation);}
   else {if(previous.equals("UNKNOWN"))a.db.update("UPDATE amvp_focus_runs SET first_failure_json=COALESCE(first_failure_json,?) WHERE session_uuid=?",current.state.toString(),sessionId);a.db.update("UPDATE amvp_focus_runs SET version=?,state_json=?,current_operation_id=? WHERE session_uuid=?",next,pending.toString(),operation,sessionId);}
   String canonical=AdditionalConfigContract.canonical(body);a.db.update("INSERT INTO amvp_focus_controls VALUES(?,?,?,?,?,?,?,?,?,?)",operation,owner.id(),sessionId,key,hash,current.version,canonical,Timestamp.from(clock.instant()),Timestamp.from(deadline),pending.toString());
   a.db.update("INSERT INTO amvp_outbox VALUES(?,?,'FOCUS_CONTROL',?,?,'PENDING',0,?)",operation,owner.id(),canonical,hash(canonical),now());
   return new View(pending,next,current.context.deepCopy().put("version",next).put("start_allowed",false));
  });
 }
 /** Internal result ingress for a real Core transport. Not a new public Wire endpoint or synthetic producer. */
 ObjectNode receive(Supplier<Identity> authenticate,String sessionId,Receipt receipt){return tx.execute(status->{
  var principal=authenticate.get();var scope=scope(principal,sessionId,true);check(scope.run!=null,409,"PENDING_DEPENDENCY");var a=s.auth;s.contract.validate("Uuid",a.json.valueToTree(receipt.id));s.contract.validate("FocusState",receipt.state);
  check(receipt.generation==scope.bootstrap.generation()&&receipt.sequence>0&&receipt.sequence<=AdditionalConfigContract.MAX_VERSION&&receipt.frozen.equals(scope.frozen)&&receipt.state.path("focus_ref").equals(scope.frozen.path("focus_ref")),409,"SOURCE_CONFLICT");
  check(receipt.evidenceSha!=null&&receipt.evidenceSha.matches("[a-f0-9]{64}")&&receipt.observedAt.getNano()%1000000==0&&!receipt.observedAt.isAfter(clock.instant()),422,"VALIDATION_FAILED");
  String operation=receipt.state.path("operation_id").asText();var issued=a.one("SELECT * FROM amvp_focus_controls WHERE operation_id=? AND session_uuid=? AND owner_binding_id=?",operation,sessionId,scope.binding.id());check(issued!=null,404,"RESOURCE_NOT_FOUND");
  String action=s.parse(issued.get("command_json")).path("command").path("action").asText(),state=receipt.state.path("state").asText();String expected=switch(action){case "START","RESUME"->"RUNNING";case "PAUSE"->"PAUSED";default->"ENDED";};
  boolean sameOperation=scope.run.get("current_operation_id").equals(operation),established=sameOperation&&s.parse(scope.run.get("state_json")).path("state").asText().equals(expected),failure=Set.of("UNKNOWN","START_FAILED").contains(state);
  // Five seconds bounds initial transition confirmation, not later real runtime failures/progress.
  // An expired initial ACK still cannot establish RUNNING or clear UNKNOWN.
  check(!receipt.observedAt.isBefore(Instant.parse(instant(issued.get("issued_at"))))&&(failure||established||!receipt.observedAt.isAfter(Instant.parse(instant(issued.get("execute_before"))))),409,"RELEASE_UNCONFIRMED");
  authority.verify(principal,scope.binding,s.parse(issued.get("command_json")),scope.frozen.deepCopy(),receipt);
  var old=a.one("SELECT * FROM amvp_focus_receipts WHERE receipt_id=? OR (session_uuid=? AND actor_generation=? AND receipt_seq=?)",receipt.id,sessionId,receipt.generation,receipt.sequence);
  if(old!=null){check(old.get("receipt_id").equals(receipt.id)&&old.get("operation_id").equals(operation)&&old.get("evidence_sha256").equals(receipt.evidenceSha)&&s.parse(old.get("state_json")).equals(receipt.state)&&instant(old.get("observed_at")).equals(receipt.observedAt.toString()),409,"SOURCE_CONFLICT");if(Boolean.TRUE.equals(old.get("projected")))return a.obj("duplicate",true,"projected",true);}
  check(state.equals(expected)||state.equals("UNKNOWN")||action.equals("START")&&state.equals("START_FAILED"),409,"RELEASE_UNCONFIRMED");
  var pending=s.parse(issued.get("response_json"));check(receipt.state.path("confirmed_ms").asLong()>=pending.path("confirmed_ms").asLong()&&(!action.equals("RESUME")||receipt.state.path("remaining_ms").asLong()<=pending.path("remaining_ms").asLong()),409,"RELEASE_UNCONFIRMED");
  boolean current=sameOperation&&receipt.sequence==((Number)scope.run.get("last_receipt_seq")).longValue()+1&&(failure||established||Instant.parse(instant(issued.get("execute_before"))).isAfter(clock.instant()));
  boolean lockPending=state.equals("ENDED")&&a.db.queryForObject("SELECT COUNT(*) FROM active_execution_locks WHERE session_id=?",Long.class,scope.session.get("id"))>0;
  if(lockPending)current=false; // a Core effect ACK cannot replace the owned Server lock's normal release
  var observed=view(scope).state;if(observed.path("state").asText().equals("UNKNOWN")||Set.of("UNKNOWN","START_FAILED").contains(state)){var first=observed.path("state").asText().equals("UNKNOWN")?observed:receipt.state;a.db.update("UPDATE amvp_focus_runs SET first_failure_json=COALESCE(first_failure_json,?) WHERE session_uuid=?",first.toString(),sessionId);if(!state.equals("ENDED")&&!state.equals("UNKNOWN")&&!state.equals("START_FAILED"))current=false;}
  if(scope.run.get("first_failure_json")!=null&&!state.equals("ENDED"))current=false;
  if(old==null)a.db.update("INSERT INTO amvp_focus_receipts VALUES(?,?,?,?,?,?,?,?,?)",receipt.id,operation,sessionId,receipt.generation,receipt.sequence,receipt.state.toString(),receipt.evidenceSha,Timestamp.from(receipt.observedAt),current);
  else if(current)a.db.update("UPDATE amvp_focus_receipts SET projected=true WHERE receipt_id=?",receipt.id);
  if(!lockPending&&receipt.sequence==((Number)scope.run.get("last_receipt_seq")).longValue()+1)a.db.update("UPDATE amvp_focus_runs SET last_receipt_seq=? WHERE session_uuid=?",receipt.sequence,sessionId);
  if(current)a.db.update("UPDATE amvp_focus_runs SET state_json=?,version=? WHERE session_uuid=?",receipt.state.toString(),AdditionalConfigContract.next(((Number)scope.run.get("version")).longValue()),sessionId);
  return a.obj("duplicate",old!=null,"projected",current);
 });}
}
