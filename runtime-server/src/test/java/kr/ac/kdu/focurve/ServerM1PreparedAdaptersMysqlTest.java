package kr.ac.kdu.focurve;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.time.*;
import java.time.temporal.ChronoUnit;
import java.util.*;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.jdbc.datasource.DataSourceUtils;
import static org.assertj.core.api.Assertions.*;
import static kr.ac.kdu.focurve.MemberAuth.*;
import static kr.ac.kdu.focurve.AmvpBridgeSupport.*;
/** Real SQL against an initialized disposable CI database; UUID-owned rows only, no schema reset or deletes.
 * Core proof remains synthetic. Explicit opt-in runs this suite after the existing schema owner. */
@EnabledIfEnvironmentVariable(named="FOCURVE_AMVP_TEST_URL",matches="jdbc:mysql://127\\.0\\.0\\.1:[0-9]+/amvp_test_[a-f0-9]+.*")
@EnabledIfEnvironmentVariable(named="FOCURVE_PREPARED_ADAPTER_TESTS",matches="1")
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class ServerM1PreparedAdaptersMysqlTest {
 final AdditionalConfigMysqlTest helper=new AdditionalConfigMysqlTest();
 final Map<String,List<Map<String,Object>>> existing=new LinkedHashMap<>();
 @BeforeAll void initializedDatabase(){
  var ds=new org.springframework.jdbc.datasource.DriverManagerDataSource(System.getenv("FOCURVE_AMVP_TEST_URL"),System.getenv("FOCURVE_AMVP_TEST_USER"),System.getenv("FOCURVE_AMVP_TEST_PASSWORD"));
  helper.db=new org.springframework.jdbc.core.JdbcTemplate(ds);
  assertThat(helper.db.queryForObject("SELECT DATABASE()",String.class)).matches("amvp_test_[a-f0-9]+");
  helper.manager=new org.springframework.jdbc.datasource.DataSourceTransactionManager(ds);
  helper.auth=new MemberAuth(helper.db,helper.json,"https://localhost:33339",Base64.getEncoder().encodeToString(new byte[32]),"chrome-extension://aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/popup/popup.html");
  // Fail if the required schema is absent. This suite never migrates, clears or reinitializes it.
  for(String table:List.of("users","extension_installations","amvp_owner_bindings","amvp_capability_receipts"))
   existing.put(table,helper.db.queryForList("SELECT * FROM "+table));
  assertThat(existing.get("amvp_owner_bindings")).as("run after existing bridge fixtures, not on an empty DB").isNotEmpty();
 }
 @AfterEach void preservesPreexistingRows(){
  existing.forEach((table,rows)->assertThat(helper.db.queryForList("SELECT * FROM "+table)).as("unchanged pre-existing rows in %s",table).containsAll(rows));
 }
 @Test void previousEmptyDatabaseInitializerRejectsThisPopulatedDatabase(){
  // The old assertion fails before its first DDL; do not run migrations or alter existing data.
  assertThatThrownBy(()->new AdditionalConfigMysqlTest().schema()).isInstanceOf(AssertionError.class).hasMessageContaining("expected: 0");
 }
 record Harness(AdditionalConfigMysqlTest.Fixture f,Binding binding,ObjectNode selection,TransactionTemplate tx){}
 Harness fixture()throws Exception {
  var f=helper.fixture();var b=new Binding(f.binding(),f.executor(),f.identity().user(),1);
  var selected=(ObjectNode)helper.json.readTree(getClass().getResourceAsStream("/amvp/rc2/examples.json")).path("definitions").path("CapabilitySelection").deepCopy();
  selected.put("capability_receipt_id",UUID.randomUUID().toString()).put("executor_id",b.executor()).put("owner_binding_id",b.id()).put("owner_epoch",b.epoch()).put("expires_at",utc(Instant.now().plusSeconds(3600).truncatedTo(ChronoUnit.MILLIS)));
  return new Harness(f,b,selected,new TransactionTemplate(helper.manager));
 }
 CapabilitySource authority(Harness h){return new CapabilitySource(){public ObjectNode verifiedSelection(Identity p,Binding b,String stream){return h.selection.deepCopy();}public void verifyContentProfiles(Binding b,com.fasterxml.jackson.databind.JsonNode c,ObjectNode s){}};}
 AmvpPreparedCapabilitySource adapter(Harness h,CapabilitySource a){return new AmvpPreparedCapabilitySource(helper.auth,a,Clock.systemUTC());}
 int count(Harness h){return helper.db.queryForObject("SELECT COUNT(*) FROM amvp_capability_receipts WHERE receipt_id=?",Integer.class,h.selection.path("capability_receipt_id").asText());}
 @Test void storesAndReplaysSameOriginalInSameDatasourceTransaction()throws Exception {
  var h=fixture();var a=adapter(h,authority(h));var ds=helper.db.getDataSource();assertThat(helper.manager.getDataSource()).isSameAs(ds);
  var first=h.tx.execute(t->{var c=DataSourceUtils.getConnection(ds);var r=a.recordVerified(h.f.identity(),h.binding,"ADDITIONAL_CONTENT");assertThat(DataSourceUtils.getConnection(ds)).isSameAs(c);return r;});
  assertThat(count(h)).isEqualTo(1);ObjectNode replay=h.tx.execute(t->a.recordVerified(h.f.identity(),h.binding,"ADDITIONAL_CONTENT"));assertThat(replay).isEqualTo(first);ObjectNode lookup=h.tx.execute(t->a.verifiedSelection(h.f.identity(),h.binding,"ADDITIONAL_CONTENT"));assertThat(lookup).isEqualTo(first);assertThat(count(h)).isEqualTo(1);
 }
 @Test void rejectsMutationOfExistingReceiptWithoutChangingStoredValue()throws Exception {
  var h=fixture();var a=adapter(h,authority(h));h.tx.execute(t->a.recordVerified(h.f.identity(),h.binding,"ADDITIONAL_CONTENT"));String before=helper.db.queryForObject("SELECT verification_ref FROM amvp_capability_receipts WHERE receipt_id=?",String.class,h.selection.path("capability_receipt_id").asText());h.selection.put("verification_ref","changed");assertThatThrownBy(()->h.tx.execute(t->a.recordVerified(h.f.identity(),h.binding,"ADDITIONAL_CONTENT"))).hasMessage("SOURCE_CONFLICT");assertThat(helper.db.queryForObject("SELECT verification_ref FROM amvp_capability_receipts WHERE receipt_id=?",String.class,h.selection.path("capability_receipt_id").asText())).isEqualTo(before);
 }
 @Test void finalRevocationRollsBackAlreadyInsertedReceipt()throws Exception {
  var h=fixture();int[] calls={0};CapabilitySource auth=new CapabilitySource(){public ObjectNode verifiedSelection(Identity p,Binding b,String stream){if(++calls[0]==2){assertThat(count(h)).isEqualTo(1);throw new Failure(503,"CAPABILITY_NOT_VERIFIED");}return h.selection.deepCopy();}public void verifyContentProfiles(Binding b,com.fasterxml.jackson.databind.JsonNode c,ObjectNode s){}};var a=adapter(h,auth);assertThatThrownBy(()->h.tx.execute(t->a.recordVerified(h.f.identity(),h.binding,"ADDITIONAL_CONTENT"))).hasMessage("CAPABILITY_NOT_VERIFIED");assertThat(count(h)).isZero();
 }
 @Test void readWithoutReceiptNeverWrites()throws Exception {var h=fixture();var a=adapter(h,authority(h));assertThatThrownBy(()->h.tx.execute(t->a.verifiedSelection(h.f.identity(),h.binding,"ADDITIONAL_CONTENT"))).hasMessage("CAPABILITY_NOT_VERIFIED");assertThat(count(h)).isZero();}
}
