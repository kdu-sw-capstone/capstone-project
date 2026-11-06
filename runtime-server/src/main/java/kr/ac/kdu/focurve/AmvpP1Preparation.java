package kr.ac.kdu.focurve;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.*;
import java.util.*;
import java.util.function.Function;

/** Internal, opt-in preparation service. No Bean, route, command, grant or execution hook.
 * Repository.atomic must return only after commit. Auth/settings/policy sources must be
 * supplied by trusted server code; the default constructor fails closed.
 */
final class AmvpP1Preparation {
 static final long MAX_SAFE = 9_007_199_254_740_991L;
 enum Action { LINK, REFRESH, DISCONNECT, SECURITY_REVOKE, READ, CREATE_PREPARATION,
   CANCEL_PREPARATION, EXPIRE_PREPARATION, REVOKE_PREPARATION, INVALIDATE_SETTINGS }
 enum TransitionIntent { LINK, REFRESH, DISCONNECT, SECURITY_REVOKE }
 enum RetirementIntent { USER_CANCEL, EXPIRED, OWNER_REVOKED, SETTINGS_CHANGED }
 enum PreparationStatus { CURRENT, CANCELLED, EXPIRED, OWNER_REVOKED, SETTINGS_CHANGED }
 record Identity(long user, UUID executor) { Identity { if(user <= 0) throw failure("UNAUTHENTICATED"); Objects.requireNonNull(executor); } }
 sealed interface ExpectedOwnerState permits AbsentOwner, CurrentOwner {}
 record AbsentOwner() implements ExpectedOwnerState {}
 record CurrentOwner(UUID bindingId, long epoch) implements ExpectedOwnerState {
   CurrentOwner { Objects.requireNonNull(bindingId); positive(epoch); }
 }
 record ExactAttempt(UUID requestId, String original) {
   ExactAttempt { Objects.requireNonNull(requestId); if(original == null || original.isEmpty()) throw failure("INVALID_REQUEST"); }
   String digest() { return hash(original); }
 }
 record Binding(UUID id, UUID executor, long user, long epoch, Instant createdAt, Instant closedAt) {
   Binding { Objects.requireNonNull(id); Objects.requireNonNull(executor); positive(epoch); Objects.requireNonNull(createdAt); }
   boolean active() { return closedAt == null; }
   Binding close(Instant now) { if(!active()) throw failure("STALE_OWNER"); return new Binding(id,executor,user,epoch,createdAt,now); }
 }
 record BindingExpectation(UUID bindingId, long epoch) { BindingExpectation { Objects.requireNonNull(bindingId); positive(epoch); } }
 record StoredTransition(UUID reference, UUID requestId, String requestDigest, String fingerprint, String requestOriginal, TransitionIntent intent,
                         UUID executor, long user, Binding previous, Binding created, Instant committedAt) {}
 record Snapshot(String format, String bytes, long settingsVersion) {
   Snapshot { if(!Set.of("1.1","1.2","AMVP_P1_SETTINGS_SOURCE_1").contains(format) || bytes == null) throw failure("SOURCE_CONFLICT"); positive(settingsVersion); }
   String digest() { return hash(bytes); }
 }
 record Policy(String id, Duration ttl) {
   Policy { if(id == null || id.isBlank() || ttl == null || ttl.isZero() || ttl.isNegative()) throw failure("POLICY_NOT_VERIFIED"); }
 }
 record PreparationOriginal(UUID reference, UUID executor, long user, UUID requestId,
       String requestDigest, BindingExpectation binding, Snapshot snapshot, String policyId,
       Instant createdAt, Instant expiresAt) {}
 record Termination(RetirementIntent reason, Instant at) {}
 record StoredPreparation(PreparationOriginal original, long savedRevision, Termination storedTermination, ExactAttempt resultAttempt) {}
 record PreparationRow(StoredPreparation creation, long revision, Termination termination) {}
 record CurrentStatus(Binding currentBinding, Long currentSettingsVersion, long currentRevision,
                      PreparationStatus preparationStatus, Instant observedAt) {}
 record Observation<T>(T stored, CurrentStatus currentStatus) {}
 sealed interface PreparationLookupKey permits ByRequest, ByReference {}
 record ByRequest(UUID requestId, String expectedDigest) implements PreparationLookupKey {
   ByRequest { Objects.requireNonNull(requestId); digest(expectedDigest); }
 }
 record ByReference(UUID reference, String expectedDigest) implements PreparationLookupKey {
   ByReference { Objects.requireNonNull(reference); digest(expectedDigest); }
 }
 record RequestKey(UUID executor, long user, UUID requestId) {}
 record Journal(String requestOriginal, String requestDigest, String fingerprint, String kind, Object result) {}
 interface Tx {
   Long currentUser(UUID executor);
   boolean hasExecutionLock(long user, UUID executor);
   List<Binding> activeBindings(UUID executor);
   long maximumEpoch(UUID executor);
   void saveBinding(Binding binding);
   Journal journal(RequestKey key);
   void saveJournal(RequestKey key, Journal value);
   PreparationRow preparation(UUID reference);
   void savePreparation(PreparationRow value, Long expectedRevision);
 }
 interface Repository { <T> T atomic(boolean write, Function<Tx,T> work); }
 interface Authenticator { Identity authenticate(Object trusted, UUID executor, Action action); }
 /** Must read/lock the selected settings revision in the same server transaction. */
 interface SettingsSource { Snapshot read(Tx tx, Identity identity); }
 interface PolicySource { Policy resolve(Object opaqueHandle, Identity identity); }
 static final class Rejected extends RuntimeException { final String internalReason;
   Rejected(String reason) { super(reason); internalReason=reason; }
 }
 private record Session(Tx tx, Identity identity) {}
 private record Committed<T>(Identity identity, T value) {}
 private final Repository repository; private final Clock clock; private final Authenticator authenticator;
 private final SettingsSource settings; private final PolicySource policies;
 AmvpP1Preparation(Repository repository, Clock clock) {
   this(repository,clock,(t,e,a)->{throw failure("AUTHORITY_NOT_VERIFIED");},
       (t,i)->{throw failure("SOURCE_UNCONFIRMED");},(h,i)->{throw failure("POLICY_NOT_VERIFIED");});
 }
 AmvpP1Preparation(Repository repository, Clock clock, Authenticator authenticator,
                    SettingsSource settings, PolicySource policies) {
   this.repository=Objects.requireNonNull(repository); this.clock=Objects.requireNonNull(clock);
   this.authenticator=Objects.requireNonNull(authenticator);this.settings=Objects.requireNonNull(settings);this.policies=Objects.requireNonNull(policies);
 }
 private Identity authenticate(Object trusted, UUID executor, Action action, Tx tx) {
   Identity identity=Objects.requireNonNull(authenticator.authenticate(trusted,executor,action),"trusted identity");
   if(!executor.equals(identity.executor()) || !Objects.equals(tx.currentUser(executor),identity.user())) throw failure("STALE_OWNER");
   return identity;
 }
 private <T> T write(Object trusted, UUID executor, Action action, Function<Session,T> work) {
   Committed<T> committed=repository.atomic(true,tx->{
     Identity identity=authenticate(trusted,executor,action,tx);
     T value=work.apply(new Session(tx,identity));
     if(!identity.equals(authenticate(trusted,executor,action,tx))) throw failure("STALE_OWNER");
     return new Committed<>(identity,value);
   });
   // Commit is already complete: failure here MUST NOT erase the stored result.
   Identity current=repository.atomic(false,tx->authenticate(trusted,executor,action,tx));
   if(!committed.identity().equals(current)) throw failure("STALE_OWNER");
   return committed.value();
 }
 private <T> T read(Object trusted, UUID executor, Function<Session,T> work) {
   return repository.atomic(false,tx->{Identity identity=authenticate(trusted,executor,Action.READ,tx);
     T value=work.apply(new Session(tx,identity));
     if(!identity.equals(authenticate(trusted,executor,Action.READ,tx))) throw failure("STALE_OWNER");
     return value;
   });
 }
 /** Existing UTC millisecond contract; normalize once before immutable construction. */
 private Instant immutableTime(){return clock.instant().truncatedTo(java.time.temporal.ChronoUnit.MILLIS);}
 private static Binding current(Tx tx, UUID executor) {
   List<Binding> active=tx.activeBindings(executor);
   if(active.size()>1) throw failure("STALE_OWNER");
   return active.isEmpty()?null:active.getFirst();
 }
 private static void expect(Binding actual, ExpectedOwnerState expected) {
   Objects.requireNonNull(expected);
   if(expected instanceof AbsentOwner) { if(actual!=null) throw failure("STALE_OWNER"); }
   else { CurrentOwner e=(CurrentOwner)expected;
     if(actual==null || !actual.id().equals(e.bindingId()) || actual.epoch()!=e.epoch()) throw failure("STALE_OWNER"); }
 }
 private static Binding bound(Tx tx, Identity id, BindingExpectation expected) {
   Objects.requireNonNull(expected);Binding value=current(tx,id.executor());
   if(value==null || value.user()!=id.user() || !value.id().equals(expected.bindingId()) || value.epoch()!=expected.epoch()) throw failure("STALE_OWNER");
   return value;
 }
 private static RequestKey key(Identity id, UUID request) { return new RequestKey(id.executor(),id.user(),request); }
 private static Object replay(Tx tx, RequestKey key, ExactAttempt attempt, String fingerprint, String kind) {
   Journal prior=tx.journal(key);if(prior==null)return null;
   validateJournal(key,prior);
   if(!prior.requestDigest().equals(attempt.digest()) || !prior.fingerprint().equals(fingerprint) || !prior.kind().equals(kind)) throw failure("SOURCE_CONFLICT");
   return prior.result();
 }
 private static void validateJournal(RequestKey key,Journal entry) {
   if(entry.requestOriginal()==null || !hash(entry.requestOriginal()).equals(entry.requestDigest()))throw failure("SOURCE_CONFLICT");
   if(entry.kind().equals("transition") && entry.result() instanceof StoredTransition value) {
     if(!value.executor().equals(key.executor()) || value.user()!=key.user() || !value.requestId().equals(key.requestId())
       || !value.requestDigest().equals(entry.requestDigest()) || !value.fingerprint().equals(entry.fingerprint())
       || !value.requestOriginal().equals(entry.requestOriginal()))throw failure("SOURCE_CONFLICT");
   } else if(entry.kind().equals("preparation") && entry.result() instanceof StoredPreparation value) {
     if(!value.original().executor().equals(key.executor()) || value.original().user()!=key.user()
       || !value.resultAttempt().requestId().equals(key.requestId()) || !value.resultAttempt().original().equals(entry.requestOriginal())
       || !value.resultAttempt().digest().equals(entry.requestDigest()))throw failure("SOURCE_CONFLICT");
   } else throw failure("SOURCE_CONFLICT");
 }
 StoredTransition transitionBinding(Object trusted, ExactAttempt attempt, UUID executor,
                                     ExpectedOwnerState expectedOwnerState, TransitionIntent intent) {
   Objects.requireNonNull(attempt);Objects.requireNonNull(intent);
   String fp=fingerprint("transition",attempt.original(),executor,expectedOwnerState,intent);
   return write(trusted,executor,Action.valueOf(intent.name()),s->{
     RequestKey request=key(s.identity(),attempt.requestId());Object previous=replay(s.tx(),request,attempt,fp,"transition");
     if(previous!=null)return (StoredTransition)previous;
     Binding active=current(s.tx(),executor);expect(active,expectedOwnerState);
     Instant now=immutableTime();Binding created=null;
     if(intent==TransitionIntent.DISCONNECT && s.tx().hasExecutionLock(s.identity().user(),executor)) throw failure("ACTIVE_SESSION_EXISTS");
     if(intent==TransitionIntent.REFRESH) {
       if(active==null || active.user()!=s.identity().user())throw failure("STALE_OWNER");created=active;
     } else {
       if(active!=null)s.tx().saveBinding(active.close(now));
       if(intent==TransitionIntent.LINK) {
         long maximum=s.tx().maximumEpoch(executor);if(maximum>=MAX_SAFE)throw failure("EPOCH_EXHAUSTED");
         created=new Binding(UUID.randomUUID(),executor,s.identity().user(),maximum+1,now,null);s.tx().saveBinding(created);
       }
     }
     StoredTransition result=new StoredTransition(UUID.randomUUID(),attempt.requestId(),attempt.digest(),fp,attempt.original(),intent,executor,s.identity().user(),active,created,now);
     s.tx().saveJournal(request,new Journal(attempt.original(),attempt.digest(),fp,"transition",result));return result;
   });
 }
 Observation<StoredTransition> queryTransition(Object trusted, UUID executor, ExactAttempt attempt) {
   return read(trusted,executor,s->{Journal entry=s.tx().journal(key(s.identity(),attempt.requestId()));
     if(entry==null)return null;
     validateJournal(key(s.identity(),attempt.requestId()),entry);
     if(!entry.kind().equals("transition") || !entry.requestDigest().equals(attempt.digest()))throw failure("SOURCE_CONFLICT");
     StoredTransition stored=(StoredTransition)entry.result();
     return new Observation<>(stored,new CurrentStatus(current(s.tx(),executor),null,0,null,clock.instant()));
   });
 }
 StoredPreparation createPreparation(Object trusted, UUID executor, ExactAttempt attempt,
       BindingExpectation expectedBinding,long settingsVersion,Object policyHandle) {
   positive(settingsVersion);String fp=fingerprint("prepare",attempt.original(),executor,expectedBinding,settingsVersion);
   return write(trusted,executor,Action.CREATE_PREPARATION,s->{
     RequestKey request=key(s.identity(),attempt.requestId());Object prior=replay(s.tx(),request,attempt,fp,"preparation");
     if(prior!=null)return (StoredPreparation)prior;
     bound(s.tx(),s.identity(),expectedBinding);
     Snapshot snapshot=Objects.requireNonNull(settings.read(s.tx(),s.identity()),"snapshot source");
     if(snapshot.settingsVersion()!=settingsVersion)throw failure("SOURCE_CONFLICT");
     Policy policy=Objects.requireNonNull(policies.resolve(policyHandle,s.identity()),"policy source");
     Instant now=immutableTime(),expires=now.plus(policy.ttl()).truncatedTo(java.time.temporal.ChronoUnit.MILLIS);
     if(!expires.isAfter(now))throw failure("POLICY_NOT_VERIFIED");
     PreparationOriginal original=new PreparationOriginal(UUID.randomUUID(),executor,s.identity().user(),attempt.requestId(),attempt.digest(),expectedBinding,snapshot,policy.id(),now,expires);
     StoredPreparation result=new StoredPreparation(original,1,null,attempt);
     s.tx().savePreparation(new PreparationRow(result,1,null),null);
     s.tx().saveJournal(request,new Journal(attempt.original(),attempt.digest(),fp,"preparation",result));
     // Sources may call other local code; do not consume an earlier settings/binding observation.
     bound(s.tx(),s.identity(),expectedBinding);
     if(!snapshot.equals(settings.read(s.tx(),s.identity())))throw failure("SOURCE_CONFLICT");
     return result;
   });
 }
 private CurrentStatus observe(Session s, PreparationRow row) {
   PreparationOriginal original=row.creation().original();Binding actual=current(s.tx(),s.identity().executor());
   PreparationStatus status;Long version=null;
   if(row.termination()!=null)status=switch(row.termination().reason()) {
     case USER_CANCEL->PreparationStatus.CANCELLED;case EXPIRED->PreparationStatus.EXPIRED;
     case OWNER_REVOKED->PreparationStatus.OWNER_REVOKED;case SETTINGS_CHANGED->PreparationStatus.SETTINGS_CHANGED;};
   else if(actual==null || actual.user()!=original.user() || !actual.id().equals(original.binding().bindingId()) || actual.epoch()!=original.binding().epoch())status=PreparationStatus.OWNER_REVOKED;
   // Historical deadlines retain their exact Instant; never round the comparison clock.
   else if(!clock.instant().isBefore(original.expiresAt()))status=PreparationStatus.EXPIRED;
   else {Snapshot now=Objects.requireNonNull(settings.read(s.tx(),s.identity()),"snapshot source");version=now.settingsVersion();
     status=version!=original.snapshot().settingsVersion() || !now.equals(original.snapshot())?PreparationStatus.SETTINGS_CHANGED:PreparationStatus.CURRENT;}
   return new CurrentStatus(actual,version,row.revision(),status,clock.instant());
 }
 private static void originalOwner(Identity id, PreparationRow row) {
   if(row==null)throw failure("SOURCE_NOT_FOUND");
   if(row.creation().original().user()!=id.user() || !row.creation().original().executor().equals(id.executor()))throw failure("FORBIDDEN_EXECUTOR");
 }
 Observation<StoredPreparation> queryPreparation(Object trusted, UUID executor, PreparationLookupKey lookup) {
   return read(trusted,executor,s->{
     StoredPreparation stored;PreparationRow row;
     if(lookup instanceof ByRequest request) {
       Journal journal=s.tx().journal(key(s.identity(),request.requestId()));if(journal==null)return null;
       validateJournal(key(s.identity(),request.requestId()),journal);
       if(!journal.kind().equals("preparation") || !journal.requestDigest().equals(request.expectedDigest()))throw failure("SOURCE_CONFLICT");
       stored=(StoredPreparation)journal.result();row=s.tx().preparation(stored.original().reference());
       originalOwner(s.identity(),row); // Missing backing record is corruption, not normal absence.
     } else if(lookup instanceof ByReference reference) {
       row=s.tx().preparation(reference.reference());if(row==null)return null;originalOwner(s.identity(),row);
       stored=row.creation();if(!stored.original().requestDigest().equals(reference.expectedDigest()))throw failure("SOURCE_CONFLICT");
     } else throw failure("INVALID_REQUEST");
     return new Observation<>(stored,observe(s,row));
   });
 }
 /** Resolves a protected creation journal, never a caller-supplied original request digest. */
 ByReference referenceForSource(Object trusted,UUID executor,UUID reference,long expectedSourceVersion){
  positive(expectedSourceVersion);Objects.requireNonNull(reference);
  return read(trusted,executor,s->{
   var row=s.tx().preparation(reference);if(row==null)return null;
   originalOwner(s.identity(),row);var creation=row.creation();var original=creation.original();
   if(!reference.equals(original.reference())||creation.savedRevision()!=expectedSourceVersion)throw failure("SOURCE_CONFLICT");
   var request=key(s.identity(),original.requestId());var journal=s.tx().journal(request);
   if(journal==null)throw failure("SOURCE_CONFLICT");validateJournal(request,journal);
   if(!"preparation".equals(journal.kind())||!creation.equals(journal.result())
     ||!original.requestDigest().equals(journal.requestDigest())
     ||!creation.resultAttempt().requestId().equals(original.requestId()))throw failure("SOURCE_CONFLICT");
   return new ByReference(reference,journal.requestDigest());
  });
 }
 StoredPreparation retirePreparation(Object trusted, UUID executor, ExactAttempt attempt,
       UUID preparationRef,long expectedVersion,RetirementIntent intent) {
   positive(expectedVersion);Objects.requireNonNull(intent);
   Action action=switch(intent) {case USER_CANCEL->Action.CANCEL_PREPARATION;case EXPIRED->Action.EXPIRE_PREPARATION;
     case OWNER_REVOKED->Action.REVOKE_PREPARATION;case SETTINGS_CHANGED->Action.INVALIDATE_SETTINGS;};
   String fp=fingerprint("retire",attempt.original(),executor,preparationRef,expectedVersion,intent);
   return write(trusted,executor,action,s->{
     RequestKey request=key(s.identity(),attempt.requestId());Object prior=replay(s.tx(),request,attempt,fp,"preparation");if(prior!=null)return (StoredPreparation)prior;
     PreparationRow row=s.tx().preparation(preparationRef);originalOwner(s.identity(),row);
     if(row.revision()!=expectedVersion)throw failure("STALE_VERSION");
     if(row.termination()!=null)throw failure("SOURCE_CONFLICT");
     CurrentStatus current=observe(s,row);
     if(intent==RetirementIntent.EXPIRED && clock.instant().isBefore(row.creation().original().expiresAt()))throw failure("SOURCE_CONFLICT");
     if(intent==RetirementIntent.OWNER_REVOKED && current.preparationStatus()!=PreparationStatus.OWNER_REVOKED)throw failure("SOURCE_CONFLICT");
     if(intent==RetirementIntent.SETTINGS_CHANGED && current.preparationStatus()!=PreparationStatus.SETTINGS_CHANGED)throw failure("SOURCE_CONFLICT");
     if(expectedVersion>=MAX_SAFE)throw failure("REVISION_EXHAUSTED");
     Termination terminal=new Termination(intent,immutableTime());long next=expectedVersion+1;
     s.tx().savePreparation(new PreparationRow(row.creation(),next,terminal),expectedVersion);
     StoredPreparation result=new StoredPreparation(row.creation().original(),next,terminal,attempt);
     s.tx().saveJournal(request,new Journal(attempt.original(),attempt.digest(),fp,"preparation",result));return result;
   });
 }
 static String hash(String value) {
   try{return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8)));}
   catch(java.security.NoSuchAlgorithmException e){throw new IllegalStateException(e);}
 }
 private static String fingerprint(Object... values) {
   StringBuilder out=new StringBuilder();for(Object value:values){String part=Objects.toString(value);out.append(part.length()).append(':').append(part);}return hash(out.toString());
 }
 private static void positive(long value){if(value<1 || value>MAX_SAFE)throw failure("INVALID_REVISION");}
 private static void digest(String value){if(value==null || !value.matches("[0-9a-f]{64}"))throw failure("INVALID_REQUEST");}
 private static Rejected failure(String reason){return new Rejected(reason);}
}
