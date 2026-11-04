package kr.ac.kdu.focurve;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.sql.Timestamp;
import java.time.*;
import java.util.*;
import static kr.ac.kdu.focurve.MemberAuth.*;
import static kr.ac.kdu.focurve.AmvpBridgeSupport.*;

/** Preparation only: no Bean/HTTP registration. Never accepts a request's claimed selection.
 * The injected authority must perform a read-only, authenticated CURRENT selection lookup,
 * including artifact/license/feature/profile/revocation checks, and fail closed on uncertainty.
 * Two matching observations are NOT an ABA/non-reuse proof or an IG04 closure lease.
 */
final class AmvpPreparedCapabilitySource implements CapabilitySource {
 private final MemberAuth a;private final CapabilitySource authority;private final AmvpBridgeSupport support;private final Clock clock;
 AmvpPreparedCapabilitySource(MemberAuth auth,CapabilitySource authority,Clock clock){a=Objects.requireNonNull(auth);this.authority=Objects.requireNonNull(authority);this.clock=Objects.requireNonNull(clock);support=new AmvpBridgeSupport(a,authority);}
 private static Instant storedExpiry(Object value){return value instanceof Timestamp t?t.toInstant():value instanceof LocalDateTime t?t.toInstant(ZoneOffset.UTC):null;}
 private void owner(Identity principal,Binding expected,boolean lock){check(support.binding(principal,expected.executor(),lock).equals(expected),409,"STALE_OWNER");}
 private ObjectNode selection(Identity principal,Binding binding,String stream){
  var value=authority.verifiedSelection(principal,binding,stream);check(value!=null,503,"CAPABILITY_NOT_VERIFIED");var copy=value.deepCopy();support.contract.validate("CapabilitySelection",copy);
  check(copy.path("executor_id").asText().equals(binding.executor())&&copy.path("owner_binding_id").asText().equals(binding.id())&&copy.path("owner_epoch").asLong()==binding.epoch(),403,"FORBIDDEN_EXECUTOR");
  check(copy.path("selected").has(stream)&&Instant.parse(copy.path("expires_at").asText()).isAfter(clock.instant()),503,"CAPABILITY_NOT_VERIFIED");return copy;
 }
 ObjectNode recordVerified(Identity principal,Binding binding,String stream){
  transaction();check(!org.springframework.transaction.support.TransactionSynchronizationManager.isCurrentTransactionReadOnly(),503,"TEMPORARILY_UNAVAILABLE");owner(principal,binding,true);var selected=selection(principal,binding,stream);String receipt=selected.path("capability_receipt_id").asText();
  // Existing schema, immutable receipt: caller's installation/owner lock serializes writers.
  var stored=a.one("SELECT * FROM amvp_capability_receipts WHERE receipt_id=? FOR UPDATE",receipt);
  var expiry=Timestamp.from(Instant.parse(selected.path("expires_at").asText()));String streams=AdditionalConfigContract.canonical(selected.path("selected"));
  if(stored==null){
   a.db.update("INSERT INTO amvp_capability_receipts(receipt_id,owner_binding_id,verified_artifact_sha256,selected_json,verification_ref,expires_at) VALUES(?,?,?,?,?,?)",receipt,binding.id(),selected.path("verified_artifact_sha256").asText(),streams,selected.path("verification_ref").asText(),expiry);
   stored=a.one("SELECT * FROM amvp_capability_receipts WHERE receipt_id=? FOR UPDATE",receipt);
  }
  check(stored!=null&&Objects.equals(stored.get("owner_binding_id"),binding.id())&&Objects.equals(stored.get("verified_artifact_sha256"),selected.path("verified_artifact_sha256").asText())&&Objects.equals(stored.get("verification_ref"),selected.path("verification_ref").asText())&&streams.equals(AdditionalConfigContract.canonical(support.parse(stored.get("selected_json"))))&&expiry.toInstant().equals(storedExpiry(stored.get("expires_at"))),409,"SOURCE_CONFLICT");
  owner(principal,binding,true);
  // Last external authority call is a revalidation, never an issuance/retry.
  var current=selection(principal,binding,stream);check(AdditionalConfigContract.canonical(current).equals(AdditionalConfigContract.canonical(selected)),503,"CAPABILITY_NOT_VERIFIED");
  return selected.deepCopy(); // Caller must commit before reporting persistence success.
 }
 @Override public ObjectNode verifiedSelection(Identity principal,Binding binding,String stream){
  transaction();owner(principal,binding,false);var selected=selection(principal,binding,stream);
  // Read paths NEVER mint a receipt. The existing support checks its stored binding/hash/expiry.
  var persisted=support.capability(principal,binding,stream);
  check(AdditionalConfigContract.canonical(persisted).equals(AdditionalConfigContract.canonical(selected)),503,"CAPABILITY_NOT_VERIFIED");
  owner(principal,binding,false);var current=selection(principal,binding,stream);
  check(AdditionalConfigContract.canonical(current).equals(AdditionalConfigContract.canonical(selected)),503,"CAPABILITY_NOT_VERIFIED");
  return current.deepCopy();
 }
 @Override public void verifyContentProfiles(Binding binding,JsonNode content,ObjectNode selected){
  transaction();var principal=new Identity(binding.user(),binding.executor());owner(principal,binding,false);support.contract.validate("ContentConfig",content);
  authority.verifyContentProfiles(binding,content.deepCopy(),selected.deepCopy());
  owner(principal,binding,false);
  var current=selection(principal,binding,"ADDITIONAL_CONTENT");check(AdditionalConfigContract.canonical(current).equals(AdditionalConfigContract.canonical(selected)),503,"CAPABILITY_NOT_VERIFIED");
 }
}
