package kr.ac.kdu.focurve;

import com.fasterxml.jackson.databind.*;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.sql.Timestamp;
import java.time.*;
import java.util.*;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.*;
import org.springframework.transaction.support.*;
import static org.assertj.core.api.Assertions.*;
import static kr.ac.kdu.focurve.MemberAuth.*;
import static kr.ac.kdu.focurve.AmvpBridgeSupport.*;

/** New preparation boundaries only; old ServerM1BoundaryTest five cases are not rerun. */
class ServerM1PreparedAdaptersTest {
 static final String ID="00000000-0000-4000-8000-000000000001";
 static ObjectNode example(String name)throws Exception{return (ObjectNode)new ObjectMapper().readTree(ServerM1PreparedAdaptersTest.class.getResourceAsStream("/amvp/rc2/examples.json")).path("definitions").path(name).deepCopy();}
 static class Db extends JdbcTemplate {
  final Map<String,Map<String,Object>> receipts=new HashMap<>();int inserts;boolean failInsert,active=true;
  @Override public List<Map<String,Object>> queryForList(String sql,Object... args){
   if(sql.contains("FROM amvp_owner_bindings"))return active?List.of(Map.of("binding_id",ID,"owner_epoch",1)):List.of();
   throw new AssertionError("Unexpected SQL: "+sql);
  }
  @Override public int update(String sql,Object... args){
   if(!sql.startsWith("INSERT INTO amvp_capability_receipts"))throw new AssertionError("Unexpected write");
   if(failInsert)throw new org.springframework.dao.DataAccessResourceFailureException("SYNTHETIC_INSERT_FAILURE");
   receipts.put((String)args[0],Map.of("receipt_id",args[0],"owner_binding_id",args[1],"verified_artifact_sha256",args[2],"selected_json",args[3],"verification_ref",args[4],"expires_at",args[5]));inserts++;return 1;
  }
 }
 static class Tx extends AbstractPlatformTransactionManager {
  final Db db;Tx(Db db){this.db=db;}
  protected Object doGetTransaction(){return new HashMap<>(db.receipts);}
  protected void doBegin(Object tx,TransactionDefinition definition){}
  protected void doCommit(DefaultTransactionStatus status){}
  @SuppressWarnings("unchecked") protected void doRollback(DefaultTransactionStatus status){db.receipts.clear();db.receipts.putAll((Map<String,Map<String,Object>>)status.getTransaction());}
 }
 static class Auth extends MemberAuth {
  final Db fake;final ObjectNode selected,ref;final Map<String,Object> session=new HashMap<>(),snapshot=new HashMap<>();
  Auth(Db db)throws Exception {
   super(db,new ObjectMapper(),"https://localhost:33339",Base64.getEncoder().encodeToString(new byte[32]),"");fake=db;
   selected=example("CapabilitySelection");selected.put("expires_at",utc(Instant.now().plusSeconds(3600)));
   ref=(ObjectNode)example("FocusAttachmentRequest").path("focus_ref");String raw="{\"original\":true}";ref.put("snapshot_sha256",hash(raw));
   session.putAll(Map.of("policy_snapshot_id",ID,"desired_revision",1,"execution_status","RUNNING"));snapshot.putAll(Map.of("payload",raw,"payload_hash",hash(raw),"format_version","1.1"));
  }
  @Override Map<String,Object> one(String sql,Object... args){
   if(sql.contains("FROM extension_installations"))return Map.of("current_user_id",1);
   if(sql.contains("FROM amvp_capability_receipts")){var row=fake.receipts.get(args[0]);return row!=null&&(args.length==1||Objects.equals(row.get("owner_binding_id"),args[1]))?row:null;}
   if(sql.contains("FROM focus_sessions"))return session;
   if(sql.contains("FROM policy_snapshots"))return snapshot;
   throw new AssertionError("Unexpected query: "+sql);
  }
 }
 static class Authority implements CapabilitySource {
  final Auth a;int calls,revokeAt=Integer.MAX_VALUE;boolean revokeFinal,changeFinal,denyProfiles;
  Authority(Auth a){this.a=a;}
  public ObjectNode verifiedSelection(Identity p,Binding b,String stream){calls++;if(revokeFinal&&calls>1||calls>=revokeAt)throw new Failure(503,"CAPABILITY_NOT_VERIFIED");var copy=a.selected.deepCopy();if(changeFinal&&calls>1)copy.put("verification_ref","changed");return copy;}
  public void verifyContentProfiles(Binding b,JsonNode content,ObjectNode selected){if(denyProfiles)throw new Failure(503,"UNSUPPORTED_CONTRACT");}
 }
 record Fixture(Db db,Auth auth,Authority authority,TransactionTemplate tx,AmvpPreparedCapabilitySource source){}
 Fixture fixture()throws Exception {var db=new Db();var a=new Auth(db);var authority=new Authority(a);return new Fixture(db,a,authority,new TransactionTemplate(new Tx(db)),new AmvpPreparedCapabilitySource(a,authority,Clock.systemUTC()));}
 Identity principal(){return new Identity(1,ID);}Binding binding(){return new Binding(ID,ID,1,1);}
 ObjectNode record(Fixture f){return f.tx.execute(t->f.source.recordVerified(principal(),binding(),"ADDITIONAL_CONTENT"));}
 @Test void explicitWriterReadbackAndImmutableReplay()throws Exception {
  var f=fixture();var first=record(f);assertThat(f.db.inserts).isEqualTo(1);assertThat(record(f)).isEqualTo(first);assertThat(f.db.inserts).isEqualTo(1);
  ObjectNode lookup=f.tx.execute(t->f.source.verifiedSelection(principal(),binding(),"ADDITIONAL_CONTENT"));assertThat(lookup).isEqualTo(first);assertThat(f.db.inserts).isEqualTo(1);
 }
 @Test void readLookupNeverMintsReceipt()throws Exception {
  var f=fixture();assertThatThrownBy(()->f.tx.execute(t->f.source.verifiedSelection(principal(),binding(),"ADDITIONAL_CONTENT"))).hasMessage("CAPABILITY_NOT_VERIFIED");assertThat(f.db.receipts).isEmpty();
 }
 @Test void lookupRechecksCoreAfterReceiptRead()throws Exception {
  var f=fixture();record(f);f.authority.calls=0;f.authority.revokeAt=3;
  assertThatThrownBy(()->f.tx.execute(t->f.source.verifiedSelection(principal(),binding(),"ADDITIONAL_CONTENT"))).hasMessage("CAPABILITY_NOT_VERIFIED");assertThat(f.db.inserts).isEqualTo(1);
 }
 @Test void existingMysqlDatetimeReadRepresentationIsAccepted()throws Exception {
  var f=fixture();record(f);var row=new HashMap<>(f.db.receipts.get(ID));row.put("expires_at",LocalDateTime.ofInstant(((Timestamp)row.get("expires_at")).toInstant(),ZoneOffset.UTC));f.db.receipts.put(ID,row);
  assertThat(record(f)).isEqualTo(f.auth.selected);assertThat(f.db.inserts).isEqualTo(1);
 }
 @Test void writerRequiresWritableTransaction()throws Exception {
  var f=fixture();assertThatThrownBy(()->f.source.recordVerified(principal(),binding(),"ADDITIONAL_CONTENT")).hasMessage("TEMPORARILY_UNAVAILABLE");
  f.tx.setReadOnly(true);assertThatThrownBy(()->record(f)).hasMessage("TEMPORARILY_UNAVAILABLE");assertThat(f.db.receipts).isEmpty();
 }
 @Test void expiredSelectionCannotInsert()throws Exception {
  var f=fixture();f.auth.selected.put("expires_at","2026-01-01T00:00:00.000Z");assertThatThrownBy(()->record(f)).hasMessage("CAPABILITY_NOT_VERIFIED");assertThat(f.db.receipts).isEmpty();
 }
 @Test void finalRevocationRollsBackReceipt()throws Exception {
  var f=fixture();f.authority.revokeFinal=true;assertThatThrownBy(()->record(f)).hasMessage("CAPABILITY_NOT_VERIFIED");assertThat(f.db.inserts).isEqualTo(1);assertThat(f.db.receipts).isEmpty();
 }
 @Test void changedFinalSelectionRollsBackReceipt()throws Exception {
  var f=fixture();f.authority.changeFinal=true;assertThatThrownBy(()->record(f)).hasMessage("CAPABILITY_NOT_VERIFIED");assertThat(f.db.receipts).isEmpty();
 }
 @Test void existingReceiptCannotBeRewrittenOrRebound()throws Exception {
  var f=fixture();record(f);var original=f.db.receipts.get(ID);f.auth.selected.put("verification_ref","different");assertThatThrownBy(()->record(f)).hasMessage("SOURCE_CONFLICT");assertThat(f.db.receipts.get(ID)).isEqualTo(original);assertThat(f.db.inserts).isEqualTo(1);
 }
 @Test void insertFailureCannotReturnVerifiedReceipt()throws Exception {
  var f=fixture();f.db.failInsert=true;assertThatThrownBy(()->record(f)).hasMessage("SYNTHETIC_INSERT_FAILURE");assertThat(f.db.receipts).isEmpty();
 }
 @Test void contentProfileProofIsStillMandatory()throws Exception {
  var f=fixture();record(f);f.authority.denyProfiles=true;
  assertThatThrownBy(()->f.tx.execute(t->{f.source.verifyContentProfiles(binding(),exampleUnchecked("ContentConfig"),f.auth.selected);return null;})).hasMessage("UNSUPPORTED_CONTRACT");
 }
 static ObjectNode exampleUnchecked(String name){try{return example(name);}catch(Exception e){throw new AssertionError(e);}}
 @Test void frozenOriginalBytesMatchBeforeCoreCurrentness()throws Exception {
  var f=fixture();var calls=new AtomicInteger();var proof=new AmvpPreparedFrozenFocusProof(f.auth,f.source,(p,b,r)->{assertThat(r).isEqualTo(f.auth.ref);calls.incrementAndGet();});
  f.tx.execute(t->{proof.verify(principal(),binding(),f.auth.ref);return null;});assertThat(calls.get()).isEqualTo(1);assertThat(f.db.receipts).isEmpty();
 }
 @Test void frozenTamperedOriginalNeverReachesCore()throws Exception {
  var f=fixture();f.auth.snapshot.put("payload","changed");var proof=new AmvpPreparedFrozenFocusProof(f.auth,f.source,(p,b,r)->{throw new AssertionError("Must not reach Core");});
  assertThatThrownBy(()->f.tx.execute(t->{proof.verify(principal(),binding(),f.auth.ref);return null;})).hasMessage("SOURCE_CONFLICT");
 }
 @Test void frozenStaleRevisionNeverReachesCore()throws Exception {
  var f=fixture();f.auth.session.put("desired_revision",2);var proof=new AmvpPreparedFrozenFocusProof(f.auth,f.source,(p,b,r)->{throw new AssertionError("Must not reach Core");});
  assertThatThrownBy(()->f.tx.execute(t->{proof.verify(principal(),binding(),f.auth.ref);return null;})).hasMessage("SOURCE_CONFLICT");
 }
 @Test void frozenUnknownCannotBecomeLiveProof()throws Exception {
  var f=fixture();f.auth.session.put("execution_status","UNKNOWN");var proof=new AmvpPreparedFrozenFocusProof(f.auth,f.source,(p,b,r)->{throw new AssertionError("Must not reach Core");});
  assertThatThrownBy(()->f.tx.execute(t->{proof.verify(principal(),binding(),f.auth.ref);return null;})).hasMessage("RELEASE_UNCONFIRMED");
 }
 @Test void frozenCoreRevocationIsPropagated()throws Exception {
  var f=fixture();var proof=new AmvpPreparedFrozenFocusProof(f.auth,f.source,(p,b,r)->{throw new Failure(503,"CAPABILITY_NOT_VERIFIED");});
  assertThatThrownBy(()->f.tx.execute(t->{proof.verify(principal(),binding(),f.auth.ref);return null;})).hasMessage("CAPABILITY_NOT_VERIFIED");
 }
 @Test void noAdaptersAreAutoRegistered(){
  assertThat(AmvpPreparedCapabilitySource.class.getAnnotations()).isEmpty();assertThat(AmvpPreparedFrozenFocusProof.class.getAnnotations()).isEmpty();
 }
}
