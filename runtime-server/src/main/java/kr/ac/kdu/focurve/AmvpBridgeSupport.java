package kr.ac.kdu.focurve;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.time.*;
import java.time.format.DateTimeFormatterBuilder;
import java.util.*;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import static kr.ac.kdu.focurve.MemberAuth.*;

/** Internal adapters only: authority is injected by the server, never accepted from HTTP JSON. */
final class AmvpBridgeSupport {
 record Binding(String id,String executor,long user,long epoch){}
 interface CapabilitySource {
  ObjectNode verifiedSelection(Identity principal,Binding binding,String stream);
  void verifyContentProfiles(Binding binding,JsonNode content,ObjectNode selection);
 }
 final MemberAuth auth;final AdditionalConfigContract contract;final CapabilitySource capabilities;
 AmvpBridgeSupport(MemberAuth auth,CapabilitySource capabilities){this.auth=auth;this.capabilities=Objects.requireNonNull(capabilities);contract=new AdditionalConfigContract(auth.json);}
 static void transaction(){check(TransactionSynchronizationManager.isActualTransactionActive(),503,"TEMPORARILY_UNAVAILABLE");}
 Binding binding(Identity principal,String executor,boolean lock) {
  contract.validate("Uuid",auth.json.valueToTree(executor));
  check(principal.executor()==null||principal.executor().equals(executor),404,"RESOURCE_NOT_FOUND");
  var installation=auth.one("SELECT current_user_id FROM extension_installations WHERE id=?"+(lock?" FOR UPDATE":""),executor);
  check(installation!=null&&installation.get("current_user_id") instanceof Number&&((Number)installation.get("current_user_id")).longValue()==principal.user(),404,"RESOURCE_NOT_FOUND");
  var rows=auth.db.queryForList("SELECT * FROM amvp_owner_bindings WHERE executor_id=? AND user_id=? AND state='ACTIVE' AND closed_at IS NULL ORDER BY owner_epoch DESC LIMIT 2"+(lock?" FOR UPDATE":""),executor,principal.user());
  check(rows.size()==1,409,"STALE_OWNER");var row=rows.getFirst();return new Binding(row.get("binding_id").toString(),executor,principal.user(),((Number)row.get("owner_epoch")).longValue());
 }
 ObjectNode capability(Identity principal,Binding binding,String stream) {
  ObjectNode supplied=capabilities.verifiedSelection(principal,binding,stream);check(supplied!=null,503,"CAPABILITY_NOT_VERIFIED");ObjectNode selected=supplied.deepCopy();contract.validate("CapabilitySelection",selected);
  check(selected.path("executor_id").asText().equals(binding.executor)&&selected.path("owner_binding_id").asText().equals(binding.id)&&selected.path("owner_epoch").asLong()==binding.epoch,403,"FORBIDDEN_EXECUTOR");
  check(Instant.parse(selected.path("expires_at").asText()).isAfter(Instant.now())&&selected.path("selected").has(stream),503,"CAPABILITY_NOT_VERIFIED");
  var receipt=auth.one("SELECT * FROM amvp_capability_receipts WHERE receipt_id=? AND owner_binding_id=?",selected.path("capability_receipt_id").asText(),binding.id);
  check(receipt!=null&&future(receipt.get("expires_at"))&&receipt.get("verified_artifact_sha256").equals(selected.path("verified_artifact_sha256").asText())&&receipt.get("verification_ref").equals(selected.path("verification_ref").asText()),503,"CAPABILITY_NOT_VERIFIED");
  // The callback proves registry/license/runtime provenance; this comparison binds its exact persisted selection.
  JsonNode stored=parse(receipt.get("selected_json"));check(stored.equals(selected.path("selected")),503,"CAPABILITY_NOT_VERIFIED");return selected;
 }
 void content(Binding binding,JsonNode content,ObjectNode selected) {
  contract.validate("ContentConfig",content);Set<String> supported=new HashSet<>();selected.path("selected_feature_ids").forEach(id->supported.add(id.asText()));
  boolean enabled=false;for(var feature:content.path("features"))if(feature.path("enabled").asBoolean()){enabled=true;check(supported.contains(feature.path("feature_id").asText()),503,"UNSUPPORTED_CONTRACT");}
  enabled|=content.path("keyword").path("enabled").asBoolean()||content.path("adult").path("enabled").asBoolean()||content.path("blur").path("enabled").asBoolean();
  if(enabled){check(selected.path("selected").has("ADDITIONAL_CONTENT"),503,"UNSUPPORTED_CONTRACT");capabilities.verifyContentProfiles(binding,content,selected);}
 }
 ObjectNode parse(Object value){try{JsonNode result=auth.json.readTree(value.toString());check(result.isObject(),409,"STORE_UNCONFIRMED");return (ObjectNode)result;}catch(java.io.IOException failure){throw new Failure(409,"STORE_UNCONFIRMED");}}
 static String utc(Instant value){return new DateTimeFormatterBuilder().appendInstant(3).toFormatter().format(value);}
 static String payloadHash(ObjectNode value){ObjectNode copy=value.deepCopy();copy.remove("payload_sha256");return hash(AdditionalConfigContract.canonical(copy));}
 static void seal(ObjectNode value){value.put("payload_sha256",payloadHash(value));}
 static void hashMatches(ObjectNode value){check(payloadHash(value).equals(value.path("payload_sha256").asText()),422,"HASH_MISMATCH");}
 static boolean matches(String actual,JsonNode scope){String host=scope.path("host").asText();return actual.equals(host)||scope.path("include_subdomains").asBoolean()&&actual.endsWith("."+host);}
}
