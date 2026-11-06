package kr.ac.kdu.focurve;

import org.junit.jupiter.api.*;
import java.time.*;
import java.util.*;
import java.util.concurrent.atomic.*;
import java.util.function.Function;
import static org.junit.jupiter.api.Assertions.*;
import static kr.ac.kdu.focurve.AmvpP1Preparation.*;

/** Synthetic auth/settings/policy and transactional repository. No database/HTTP/server. */
class AmvpP1PreparationTest {
 static final UUID EXEC=UUID.fromString("11111111-1111-4111-8111-111111111111");
 static class MutableClock extends Clock {Instant now=Instant.parse("2026-11-05T00:00:00Z");
   public ZoneId getZone(){return ZoneOffset.UTC;}public Clock withZone(ZoneId z){return this;}public Instant instant(){return now;}}
 static class Context {final long user;final Set<Action> actions;boolean active=true;
   Context(long user,Set<Action> actions){this.user=user;this.actions=actions;}}
 static class State {
   Map<UUID,Long> users=new HashMap<>();Map<UUID,Binding> bindings=new HashMap<>();
   Map<RequestKey,Journal> journal=new HashMap<>();Map<UUID,PreparationRow> prepared=new HashMap<>();boolean executionLock;
   State copy(){State n=new State();n.users.putAll(users);n.bindings.putAll(bindings);n.journal.putAll(journal);n.prepared.putAll(prepared);n.executionLock=executionLock;return n;}}
 static class MemoryRepository implements Repository {
   State state=new State();boolean failJournal,failCommit,loseReply;Runnable afterCommit;int commits,reads;
   @Override public synchronized <T>T atomic(boolean write,Function<Tx,T> work){
     State selected=write?state.copy():state;T value=work.apply(new Tx(){
       void writable(){if(!write)throw new IllegalStateException("read mutated");}
       public Long currentUser(UUID e){return selected.users.get(e);}
       public boolean hasExecutionLock(long u,UUID e){return selected.executionLock;}
       public List<Binding> activeBindings(UUID e){return selected.bindings.values().stream().filter(b->b.executor().equals(e)&&b.active()).toList();}
       public long maximumEpoch(UUID e){return selected.bindings.values().stream().filter(b->b.executor().equals(e)).mapToLong(Binding::epoch).max().orElse(0);}
       public void saveBinding(Binding b){writable();selected.bindings.put(b.id(),b);}
       public Journal journal(RequestKey k){return selected.journal.get(k);}
       public void saveJournal(RequestKey k,Journal v){writable();if(failJournal)throw new IllegalStateException("journal write failed");if(selected.journal.putIfAbsent(k,v)!=null)throw new IllegalStateException("duplicate journal");}
       public PreparationRow preparation(UUID ref){return selected.prepared.get(ref);}
       public void savePreparation(PreparationRow value,Long expected){writable();UUID ref=value.creation().original().reference();PreparationRow prior=selected.prepared.get(ref);
         if(expected==null?prior!=null:prior==null||prior.revision()!=expected)throw new Rejected("STALE_VERSION");selected.prepared.put(ref,value);}
     });
     if(write){if(failCommit)throw new IllegalStateException("commit aborted");state=selected;commits++;
       if(afterCommit!=null){Runnable action=afterCommit;afterCommit=null;action.run();}
       if(loseReply){loseReply=false;throw new IllegalStateException("commit reply lost");}}
     else reads++;return value;
   }
 }
 MemoryRepository repo;MutableClock clock;Context context;AtomicReference<Snapshot> settings;Object policyHandle;
 Authenticator auth;PolicySource policies;AmvpP1Preparation service;
 @BeforeEach void setup(){
   repo=new MemoryRepository();repo.state.users.put(EXEC,1L);clock=new MutableClock();context=new Context(1,EnumSet.allOf(Action.class));
   settings=new AtomicReference<>(new Snapshot("1.2","{\"synthetic_settings\":\"A\"}",1));policyHandle=new Object();
   auth=(trusted,executor,action)->{if(!(trusted instanceof Context c)||!c.active||!c.actions.contains(action))throw new Rejected("UNAUTHENTICATED");return new Identity(c.user,executor);};
   policies=(handle,identity)->{if(handle!=policyHandle)throw new Rejected("POLICY_NOT_VERIFIED");return new Policy("synthetic-test-policy",Duration.ofMinutes(5));};
   service=new AmvpP1Preparation(repo,clock,auth,(tx,id)->settings.get(),policies);
 }
 ExactAttempt attempt(String body){return new ExactAttempt(UUID.randomUUID(),body);}
 StoredTransition link(){return service.transitionBinding(context,attempt("link"),EXEC,new AbsentOwner(),TransitionIntent.LINK);}
 BindingExpectation expectation(Binding b){return new BindingExpectation(b.id(),b.epoch());}
 StoredPreparation prepare(){Binding b=link().created();return service.createPreparation(context,EXEC,attempt("prepare"),expectation(b),1,policyHandle);}
 Observation<StoredPreparation> read(StoredPreparation p){return service.queryPreparation(context,EXEC,new ByReference(p.original().reference(),p.original().requestDigest()));}
 void reason(String reason,Runnable action){assertEquals(reason,assertThrows(Rejected.class,action::run).internalReason);}

 @Test void firstBindingUsesAbsentAndClosedEpochHistoryIsNeverReset(){
   Binding first=link().created();service.transitionBinding(context,attempt("revoke"),EXEC,new CurrentOwner(first.id(),first.epoch()),TransitionIntent.SECURITY_REVOKE);
   Binding second=link().created();assertEquals(2,second.epoch());assertNotEquals(first.id(),second.id());assertNotNull(repo.state.bindings.get(first.id()).closedAt());
 }
 @Test void absentIsRejectedWhenBindingExistsAndRefreshDoesNotAdvanceEpoch(){
   Binding first=link().created();reason("STALE_OWNER",this::link);
   var refresh=service.transitionBinding(context,attempt("refresh"),EXEC,new CurrentOwner(first.id(),first.epoch()),TransitionIntent.REFRESH);
   assertEquals(first,refresh.created());assertEquals(1,repo.state.bindings.size());
 }
 @Test void ownerSwitchCannotReusePriorUsersEpoch(){
   Binding first=link().created();repo.state.users.put(EXEC,2L);Context next=new Context(2,EnumSet.allOf(Action.class));
   Binding second=service.transitionBinding(next,attempt("new-owner"),EXEC,new CurrentOwner(first.id(),first.epoch()),TransitionIntent.LINK).created();
   assertEquals(2,second.epoch());assertEquals(2,second.user());reason("STALE_OWNER",()->service.queryTransition(context,EXEC,attempt("read-old")));
 }
 @Test void exactReplayReturnsSameResultAndChangedOriginalConflicts(){
   ExactAttempt exact=attempt("same-link");StoredTransition stored=service.transitionBinding(context,exact,EXEC,new AbsentOwner(),TransitionIntent.LINK);
   assertEquals(stored,service.transitionBinding(context,exact,EXEC,new AbsentOwner(),TransitionIntent.LINK));
   reason("SOURCE_CONFLICT",()->service.transitionBinding(context,new ExactAttempt(exact.requestId(),"changed"),EXEC,new AbsentOwner(),TransitionIntent.LINK));
   assertEquals(1,repo.state.bindings.size());
 }
 @Test void normalDisconnectHonorsExecutionLockButTrustedSecurityRevokeDoesNotWaitForCleanup(){
   Binding first=link().created();repo.state.executionLock=true;
   reason("ACTIVE_SESSION_EXISTS",()->service.transitionBinding(context,attempt("disconnect"),EXEC,new CurrentOwner(first.id(),first.epoch()),TransitionIntent.DISCONNECT));
   var retired=service.transitionBinding(context,attempt("security-revoke"),EXEC,new CurrentOwner(first.id(),first.epoch()),TransitionIntent.SECURITY_REVOKE);
   assertNull(retired.created());assertTrue(repo.state.executionLock);assertFalse(repo.state.bindings.get(first.id()).active());
 }
 @Test void callerCannotSelectSecurityPurposeWithoutTrustedAuthorization(){
   Context ordinary=new Context(1,EnumSet.of(Action.LINK,Action.DISCONNECT,Action.READ));Binding first=link().created();
   reason("UNAUTHENTICATED",()->service.transitionBinding(ordinary,attempt("spoof-system"),EXEC,new CurrentOwner(first.id(),first.epoch()),TransitionIntent.SECURITY_REVOKE));
   assertTrue(repo.state.bindings.get(first.id()).active());
 }
 @Test void partialJournalFailureAndCommitAbortRollbackBindingAndPreparation(){
   repo.failJournal=true;assertThrows(IllegalStateException.class,this::link);assertTrue(repo.state.bindings.isEmpty());assertTrue(repo.state.journal.isEmpty());
   repo.failJournal=false;Binding b=link().created();repo.failCommit=true;
   assertThrows(IllegalStateException.class,()->service.createPreparation(context,EXEC,attempt("aborted"),expectation(b),1,policyHandle));
   assertTrue(repo.state.prepared.isEmpty());assertEquals(1,repo.state.journal.size());
 }
 @Test void commitReplyLossSurvivesNewServiceAndExactQuery(){
   ExactAttempt a=attempt("lost-link");repo.loseReply=true;
   assertThrows(IllegalStateException.class,()->service.transitionBinding(context,a,EXEC,new AbsentOwner(),TransitionIntent.LINK));
   service=new AmvpP1Preparation(repo,clock,auth,(tx,id)->settings.get(),policies);
   var observation=service.queryTransition(context,EXEC,a);assertNotNull(observation);assertEquals(a.original(),observation.stored().requestOriginal());assertEquals(a.requestId(),observation.stored().requestId());assertEquals(1,repo.state.bindings.size());
 }
 @Test void postCommitAuthorityFailurePreservesStoredResultWithoutReturningSuccess(){
   ExactAttempt a=attempt("post-commit");repo.afterCommit=()->context.active=false;
   reason("UNAUTHENTICATED",()->service.transitionBinding(context,a,EXEC,new AbsentOwner(),TransitionIntent.LINK));
   assertEquals(1,repo.state.bindings.size());Context recovered=new Context(1,EnumSet.allOf(Action.class));assertNotNull(service.queryTransition(recovered,EXEC,a));
 }
 @Test void nullRequiresSuccessfulAuthenticationAndConfirmedJournalAbsence(){
   assertNull(service.queryTransition(context,EXEC,attempt("absent")));context.active=false;
   reason("UNAUTHENTICATED",()->service.queryTransition(context,EXEC,attempt("unknown")));
   reason("AUTHORITY_NOT_VERIFIED",()->new AmvpP1Preparation(repo,clock).queryTransition(new Object(),EXEC,attempt("missing-source")));
 }
 @Test void readOnlyHistoricalTransitionKeepsImmutableResultAndCurrentOwnerSeparate(){
   ExactAttempt a=attempt("history");StoredTransition original=service.transitionBinding(context,a,EXEC,new AbsentOwner(),TransitionIntent.LINK);Binding b=original.created();
   service.transitionBinding(context,attempt("close"),EXEC,new CurrentOwner(b.id(),b.epoch()),TransitionIntent.SECURITY_REVOKE);
   int commits=repo.commits;var read=service.queryTransition(context,EXEC,a);assertEquals(original,read.stored());assertNull(read.currentStatus().currentBinding());assertEquals(commits,repo.commits);
 }
 @Test void preparedCreateAndReadAreIndependentOfExecutionAndKeepExactSnapshot(){
   StoredPreparation p=prepare();int commits=repo.commits;var observed=read(p);
   assertEquals(p,observed.stored());assertEquals(PreparationStatus.CURRENT,observed.currentStatus().preparationStatus());assertEquals(commits,repo.commits);
   assertFalse(repo.state.executionLock);assertEquals(1,repo.state.prepared.size());assertEquals(AmvpP1Preparation.hash(p.original().snapshot().bytes()),p.original().snapshot().digest());
 }
 @Test void policyMustComeFromTrustedHandleAndExpiryUsesServerClock(){
   Binding b=link().created();reason("POLICY_NOT_VERIFIED",()->service.createPreparation(context,EXEC,attempt("bad-policy"),expectation(b),1,Map.of("ttl",999999)));
   StoredPreparation p=service.createPreparation(context,EXEC,attempt("server-clock"),expectation(b),1,policyHandle);
   clock.now=p.original().expiresAt();int commits=repo.commits;assertEquals(PreparationStatus.EXPIRED,read(p).currentStatus().preparationStatus());assertEquals(commits,repo.commits);assertNull(repo.state.prepared.get(p.original().reference()).termination());
 }
 @Test void changedSettingsCannotReviveEvenWhenContentReturnsToSameBytes(){
   StoredPreparation p=prepare();Snapshot original=p.original().snapshot();settings.set(new Snapshot("1.2","{\"synthetic_settings\":\"B\"}",2));
   assertEquals(PreparationStatus.SETTINGS_CHANGED,read(p).currentStatus().preparationStatus());
   settings.set(new Snapshot(original.format(),original.bytes(),3));assertEquals(PreparationStatus.SETTINGS_CHANGED,read(p).currentStatus().preparationStatus());assertEquals(p,read(p).stored());
 }
 @Test void cancellationIsCasIdempotentAndDoesNotOverwriteFirstTermination(){
   StoredPreparation p=prepare();ExactAttempt cancel=attempt("cancel");StoredPreparation result=service.retirePreparation(context,EXEC,cancel,p.original().reference(),1,RetirementIntent.USER_CANCEL);
   assertEquals(result,service.retirePreparation(context,EXEC,cancel,p.original().reference(),1,RetirementIntent.USER_CANCEL));
   reason("STALE_VERSION",()->service.retirePreparation(context,EXEC,attempt("late-cancel"),p.original().reference(),1,RetirementIntent.USER_CANCEL));
   clock.now=p.original().expiresAt();reason("SOURCE_CONFLICT",()->service.retirePreparation(context,EXEC,attempt("overwrite-cause"),p.original().reference(),2,RetirementIntent.EXPIRED));
   assertEquals(RetirementIntent.USER_CANCEL,repo.state.prepared.get(p.original().reference()).termination().reason());assertEquals(p,read(p).stored());assertEquals(2,read(p).currentStatus().currentRevision());
 }
 @Test void systemExpiryIsNotUserCancellationAndRequiresServerEvidence(){
   StoredPreparation p=prepare();reason("SOURCE_CONFLICT",()->service.retirePreparation(context,EXEC,attempt("early-expiry"),p.original().reference(),1,RetirementIntent.EXPIRED));
   Context user=new Context(1,EnumSet.of(Action.READ,Action.CANCEL_PREPARATION));clock.now=p.original().expiresAt();
   reason("UNAUTHENTICATED",()->service.retirePreparation(user,EXEC,attempt("user-system-cause"),p.original().reference(),1,RetirementIntent.EXPIRED));
   assertNotNull(service.retirePreparation(context,EXEC,attempt("trusted-expiry"),p.original().reference(),1,RetirementIntent.EXPIRED).storedTermination());
 }
 @Test void bindingRevocationRejectsCurrentUseWithoutDeletingPreparation(){
   StoredPreparation p=prepare();Binding b=repo.state.bindings.get(p.original().binding().bindingId());
   service.transitionBinding(context,attempt("revoke-for-prep"),EXEC,new CurrentOwner(b.id(),b.epoch()),TransitionIntent.SECURITY_REVOKE);
   assertEquals(PreparationStatus.OWNER_REVOKED,read(p).currentStatus().preparationStatus());assertEquals(p,read(p).stored());
 }
 @Test void backingRecordCorruptionAndWrongDigestAreErrorsNotNormalNull(){
   StoredPreparation p=prepare();reason("SOURCE_CONFLICT",()->service.queryPreparation(context,EXEC,new ByReference(p.original().reference(),AmvpP1Preparation.hash("wrong"))));
   repo.state.prepared.clear();reason("SOURCE_NOT_FOUND",()->service.queryPreparation(context,EXEC,new ByRequest(p.original().requestId(),p.original().requestDigest())));
 }
 @Test void sourceChangeDuringCreateRollsBackBothRowAndJournal(){
   Binding b=link().created();AtomicInteger reads=new AtomicInteger();
   service=new AmvpP1Preparation(repo,clock,auth,(tx,id)->reads.incrementAndGet()==1?settings.get():new Snapshot("1.2","changed",2),policies);
   reason("SOURCE_CONFLICT",()->service.createPreparation(context,EXEC,attempt("settings-race"),expectation(b),1,policyHandle));
   assertTrue(repo.state.prepared.isEmpty());assertEquals(1,repo.state.journal.size());
 }
 @Test void installationTransitionImmediatelyAfterCommitCannotReturnCurrentSuccess(){
   ExactAttempt a=attempt("installation-switch-after-commit");repo.afterCommit=()->repo.state.users.put(EXEC,2L);
   reason("STALE_OWNER",()->service.transitionBinding(context,a,EXEC,new AbsentOwner(),TransitionIntent.LINK));
   assertEquals(1,repo.state.bindings.size());assertEquals(1,repo.state.journal.size());
 }
 @Test void corruptedJournalCannotSubstituteAnotherOriginalUnderAuthenticatedKey(){
   ExactAttempt a=attempt("protected-original");StoredTransition original=service.transitionBinding(context,a,EXEC,new AbsentOwner(),TransitionIntent.LINK);
   RequestKey key=new RequestKey(EXEC,1,a.requestId());Journal old=repo.state.journal.get(key);
   StoredTransition foreign=new StoredTransition(original.reference(),UUID.randomUUID(),original.requestDigest(),original.fingerprint(),original.requestOriginal(),original.intent(),EXEC,99,original.previous(),original.created(),original.committedAt());
   repo.state.journal.put(key,new Journal(old.requestOriginal(),old.requestDigest(),old.fingerprint(),old.kind(),foreign));
   reason("SOURCE_CONFLICT",()->service.queryTransition(context,EXEC,a));
 }
}
