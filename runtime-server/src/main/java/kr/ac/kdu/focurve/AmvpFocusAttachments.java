package kr.ac.kdu.focurve;

import com.fasterxml.jackson.databind.node.ObjectNode;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import static kr.ac.kdu.focurve.MemberAuth.*;
import static kr.ac.kdu.focurve.AmvpBridgeSupport.*;

/** Freezes an already-issued content revision; never rewrites D06 Snapshot or applies DOM. */
final class AmvpFocusAttachments {
 /** Must verify original Snapshot hash/format, session ownership/revision and live focus authority. */
 interface FrozenFocusProof {void verify(Identity principal,Binding binding,ObjectNode focusRef);}
 private final AmvpBridgeSupport support;private final FrozenFocusProof focus;private final TransactionTemplate transaction;
 AmvpFocusAttachments(MemberAuth auth,PlatformTransactionManager manager,CapabilitySource source,FrozenFocusProof focus){support=new AmvpBridgeSupport(auth,source);this.focus=java.util.Objects.requireNonNull(focus);transaction=new TransactionTemplate(manager);}
 ObjectNode issue(Identity principal,ObjectNode request,String key){
  support.contract.validate("FocusAttachmentRequest",request);support.contract.validate("Uuid",support.auth.json.valueToTree(key));
  return transaction.execute(tx->{var a=support.auth;var binding=support.binding(principal,request.path("executor_id").asText(),true);var cap=support.capability(principal,binding,"ADDITIONAL_CONTENT");String requestHash=hash(AdditionalConfigContract.canonical(request)),route="POST:/api/v1/amvp/focus-attachments";
   var replay=a.one("SELECT * FROM amvp_operations WHERE owner_binding_id=? AND route=? AND idempotency_key=?",binding.id(),route,key);
   if(replay!=null){check(replay.get("request_sha256").equals(requestHash)&&replay.get("state").equals("CONFIRMED"),409,"IDEMPOTENCY_CONFLICT");return support.parse(replay.get("response_json"));}
   ObjectNode ref=request.path("focus_ref").deepCopy();focus.verify(principal,binding,ref.deepCopy());
   var rows=a.db.queryForList("SELECT * FROM amvp_focus_attachments WHERE owner_binding_id=? AND session_uuid=?",binding.id(),ref.path("session_id").asText());check(rows.size()<=1,409,"SOURCE_CONFLICT");ObjectNode result;
   if(!rows.isEmpty()){
    result=support.parse(rows.getFirst().get("payload_json"));support.contract.validate("FocusAttachment",result);hashMatches(result);
    check(rows.getFirst().get("payload_sha256").equals(result.path("payload_sha256").asText())&&result.path("owner_binding_id").asText().equals(binding.id())&&result.path("executor_id").asText().equals(binding.executor())&&AdditionalConfigContract.canonical(result.path("focus_ref")).equals(AdditionalConfigContract.canonical(ref))&&result.path("config_revision").asLong()==request.path("config_revision").asLong(),409,"SOURCE_CONFLICT");
   }else{
    var packages=a.db.queryForList("SELECT * FROM amvp_packages WHERE owner_binding_id=? AND JSON_EXTRACT(payload_json,'$.next_focus_revision')=? ORDER BY runtime_revision DESC LIMIT 2",binding.id(),request.path("config_revision").asLong());
    check(packages.size()==1,409,"PENDING_DEPENDENCY");var pack=support.parse(packages.getFirst().get("payload_json"));support.contract.validate("RuntimePackage",pack);hashMatches(pack);
    check(pack.path("executor_id").asText().equals(binding.executor())&&pack.path("owner_binding_id").asText().equals(binding.id())&&packages.getFirst().get("payload_sha256").equals(pack.path("payload_sha256").asText())&&pack.path("capability_receipt_id").equals(cap.path("capability_receipt_id"))&&!pack.path("focus_defaults").isNull(),503,"CAPABILITY_NOT_VERIFIED");
    support.content(binding,pack.path("focus_defaults"),cap);
    result=a.obj("format_version","AMVP_FOCUS_ATTACHMENT_1","attachment_id",id(),"owner_binding_id",binding.id(),"executor_id",binding.executor(),"focus_ref",ref,"config_revision",request.path("config_revision").asLong(),"content",pack.path("focus_defaults"),"capability_receipt_id",cap.path("capability_receipt_id").asText());seal(result);support.contract.validate("FocusAttachment",result);
    a.db.update("INSERT INTO amvp_focus_attachments(attachment_id,owner_binding_id,session_uuid,snapshot_sha256,receipt_id,payload_json,payload_sha256) VALUES(?,?,?,?,?,?,?)",result.path("attachment_id").asText(),binding.id(),ref.path("session_id").asText(),ref.path("snapshot_sha256").asText(),cap.path("capability_receipt_id").asText(),AdditionalConfigContract.canonical(result),result.path("payload_sha256").asText());
   }
   a.db.update("INSERT INTO amvp_operations(operation_id,owner_binding_id,route,idempotency_key,request_sha256,state,response_json,updated_at) VALUES(?,?,?,?,?,'CONFIRMED',?,?)",id(),binding.id(),route,key,requestHash,AdditionalConfigContract.canonical(result),now());return result;
  });
 }
}
