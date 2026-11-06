package kr.ac.kdu.focurve;
import java.time.*;import org.junit.jupiter.api.*;import org.junit.jupiter.params.ParameterizedTest;import org.junit.jupiter.params.provider.CsvSource;
import static org.junit.jupiter.api.Assertions.*;import static kr.ac.kdu.focurve.AmvpP1Preparation.*;
/** No DB; exact historical Instants must not be rounded by the observation clock. */
class AmvpP1LegacyExpiryTest {
 static final Instant CREATED=Instant.parse("2026-11-06T04:39:39.149011900Z"),DEADLINE=Instant.parse("2026-11-06T04:44:39.149011900Z");
 AmvpP1PreparationTest f;StoredPreparation legacy;
 @BeforeEach void setup(){
  f=new AmvpP1PreparationTest();f.setup();var p=f.prepare();var o=p.original();
  var original=new PreparationOriginal(o.reference(),o.executor(),o.user(),o.requestId(),o.requestDigest(),o.binding(),o.snapshot(),o.policyId(),CREATED,DEADLINE);
  legacy=new StoredPreparation(original,1,null,p.resultAttempt());f.repo.state.prepared.put(original.reference(),new PreparationRow(legacy,1,null));
  var key=new RequestKey(original.executor(),original.user(),original.requestId());var j=f.repo.state.journal.get(key);
  f.repo.state.journal.put(key,new Journal(j.requestOriginal(),j.requestDigest(),j.fingerprint(),j.kind(),legacy));
 }
 @ParameterizedTest @CsvSource({"-1,CURRENT","0,EXPIRED","1,EXPIRED"})
 void historicalDeadlineUsesExactInstant(long offset,PreparationStatus expected){
  f.clock.now=DEADLINE.plusNanos(offset);var result=f.read(legacy);
  assertEquals(expected,result.currentStatus().preparationStatus());assertEquals(legacy,result.stored());assertEquals(DEADLINE,result.stored().original().expiresAt());
 }
 @ParameterizedTest @CsvSource({"-1,false","0,true","1,true"})
 void explicitExpiryCannotBeDelayedByRoundedNow(long offset,boolean allowed){
  f.clock.now=DEADLINE.plusNanos(offset);var a=f.attempt("exact-expiry");
  if(!allowed)assertThrows(Rejected.class,()->f.service.retirePreparation(f.context,AmvpP1PreparationTest.EXEC,a,legacy.original().reference(),1,RetirementIntent.EXPIRED));
  else {var ended=f.service.retirePreparation(f.context,AmvpP1PreparationTest.EXEC,a,legacy.original().reference(),1,RetirementIntent.EXPIRED);
   assertEquals(RetirementIntent.EXPIRED,ended.storedTermination().reason());assertEquals(legacy.original(),ended.original());assertEquals(DEADLINE,ended.original().expiresAt());}
 }
 @Test void newMillisOriginalAndExpiredReplayRemainImmutable(){
  var n=new AmvpP1PreparationTest();n.setup();n.clock.now=CREATED;var binding=n.link().created();var a=n.attempt("new-millis");
  var p=n.service.createPreparation(n.context,AmvpP1PreparationTest.EXEC,a,n.expectation(binding),1,n.policyHandle);
  assertEquals(Instant.parse("2026-11-06T04:39:39.149Z"),p.original().createdAt());
  n.clock.now=p.original().expiresAt().plusNanos(1);
  assertEquals(p,n.service.createPreparation(n.context,AmvpP1PreparationTest.EXEC,a,n.expectation(binding),1,n.policyHandle));
  assertEquals(PreparationStatus.EXPIRED,n.read(p).currentStatus().preparationStatus());assertEquals(1,n.repo.state.prepared.size());
 }
}
