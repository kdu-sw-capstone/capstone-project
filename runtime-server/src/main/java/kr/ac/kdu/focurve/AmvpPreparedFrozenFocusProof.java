package kr.ac.kdu.focurve;

import com.fasterxml.jackson.databind.node.ObjectNode;
import java.util.*;
import static kr.ac.kdu.focurve.MemberAuth.*;
import static kr.ac.kdu.focurve.AmvpBridgeSupport.*;

/** Preparation only, not registered. SQL identity/hash checks never substitute for live Core proof.
 * Historical Attachment replay remains historical; it never calls this provider or grants APPLY.
 */
final class AmvpPreparedFrozenFocusProof implements AmvpFocusAttachments.FrozenFocusProof {
 private final MemberAuth a;private final AmvpBridgeSupport support;private final AmvpFocusAttachments.FrozenFocusProof currentAuthority;
 AmvpPreparedFrozenFocusProof(MemberAuth auth,CapabilitySource capabilities,AmvpFocusAttachments.FrozenFocusProof authority){a=Objects.requireNonNull(auth);support=new AmvpBridgeSupport(auth,Objects.requireNonNull(capabilities));currentAuthority=Objects.requireNonNull(authority);}
 @Override public void verify(Identity principal,Binding binding,ObjectNode supplied){
  transaction();var ref=supplied.deepCopy();var contract=new AdditionalConfigContract(a.json);contract.validate("FocusRef",ref);
  // No capability access here: the caller verifies capability in the same transaction.
  check(support.binding(principal,binding.executor(),true).equals(binding),409,"STALE_OWNER");
  var session=a.one("SELECT * FROM focus_sessions WHERE source_session_id=? AND user_id=? AND executor_id=? FOR UPDATE",ref.path("session_id").asText(),binding.user(),binding.executor());
  check(session!=null&&Objects.equals(session.get("policy_snapshot_id"),ref.path("snapshot_id").asText())&&session.get("desired_revision") instanceof Number&&((Number)session.get("desired_revision")).longValue()==ref.path("desired_revision").asLong(),409,"SOURCE_CONFLICT");
  check(!"UNKNOWN".equals(session.get("execution_status")),409,"RELEASE_UNCONFIRMED");
  var snapshot=a.one("SELECT * FROM policy_snapshots WHERE id=? AND user_id=? AND executor_id=? FOR UPDATE",ref.path("snapshot_id").asText(),binding.user(),binding.executor());
  check(snapshot!=null&&Objects.equals(snapshot.get("format_version"),ref.path("snapshot_format").asText())&&Objects.equals(snapshot.get("payload_hash"),ref.path("snapshot_sha256").asText())&&hash(snapshot.get("payload").toString()).equals(ref.path("snapshot_sha256").asText()),409,"SOURCE_CONFLICT");
  // Final authority check must reject revocation/expiry/UNKNOWN and stale Core generation.
  // No registration, effect, closure consumption or external authority caching occurs here.
  currentAuthority.verify(principal,binding,ref.deepCopy());
 }
}
