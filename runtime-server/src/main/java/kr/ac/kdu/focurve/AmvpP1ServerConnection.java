package kr.ac.kdu.focurve;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletRequestWrapper;
import java.time.*;
import java.util.*;
import static kr.ac.kdu.focurve.AmvpP1Preparation.*;

/** Private, unregistered adapter. No route, Bean, default policy or execution caller. */
final class AmvpP1ServerConnection {
 private final MemberAuth auth;private final MemberAccounts accounts;
 private final AmvpP1JdbcRepository repository;private final Clock clock;private final PolicySource policies;
 AmvpP1ServerConnection(MemberAuth a,MemberAccounts accounts,AmvpP1JdbcRepository repository,Clock clock,PolicySource policies){
  this.auth=Objects.requireNonNull(a);this.accounts=Objects.requireNonNull(accounts);this.repository=Objects.requireNonNull(repository);
  this.clock=Objects.requireNonNull(clock);this.policies=Objects.requireNonNull(policies);
 }
 private AmvpP1Preparation service(Repository repo,HttpServletRequest request,EnumSet<Action> allowed){
  return new AmvpP1Preparation(repo,clock,(trusted,executor,action)->{
   if(trusted!=request||!allowed.contains(action))throw new Rejected("AUTHORITY_NOT_VERIFIED");
   var i=auth.identity(request,action!=Action.READ);
   if(i.executor()!=null&&!i.executor().equals(executor.toString()))throw new Rejected("STALE_OWNER");
   return new Identity(i.user(),executor);
  },this::settings,policies);
 }
 record LinkResult(ObjectNode authentication,StoredTransition transition){}
 LinkResult link(HttpServletRequest request,JsonNode body,ExactAttempt attempt,ExpectedOwnerState expected){
  return repository.own(repo->{
   // Official installation proof + approved link + PKCE path; no caller-provided identity.
   ObjectNode token=auth.token(request,body);
   String executor=auth.one("SELECT executor_id FROM link_requests WHERE id=?",body.path("link_request_id").asText()).get("executor_id").toString();
   var bearer=new HttpServletRequestWrapper(request){@Override public String getHeader(String name){
    return "Authorization".equalsIgnoreCase(name)?"Bearer "+token.path("access_token").asText():super.getHeader(name);
   }};
   var transition=service(repo,bearer,EnumSet.of(Action.LINK,Action.READ)).transitionBinding(bearer,attempt,UUID.fromString(executor),expected,TransitionIntent.LINK);
   return new LinkResult(token.deepCopy(),transition);
  }); // Only returns after outer commit. No sensitive token is persisted in the P1 journal.
 }
 StoredTransition disconnect(HttpServletRequest request,UUID executor,ExactAttempt attempt,ExpectedOwnerState expected){
  return repository.own(repo->{
   var identity=auth.identity(request,true);
   var result=service(repo,request,EnumSet.of(Action.DISCONNECT,Action.READ)).transitionBinding(request,attempt,executor,expected,TransitionIntent.DISCONNECT);
   accounts.disconnect(identity,executor.toString());return result;
  });
 }
 void resetPassword(JsonNode body,Map<UUID,ExactAttempt> attempts){
  var immutable=Map.copyOf(attempts);
  repository.own(repo->{
   var challenge=accounts.token(body,"PASSWORD_RESET");long user=((Number)challenge.get("user_id")).longValue();
   // Stable multi-executor lock order; this is a verified reset challenge, not a member-selected intent.
   var installations=auth.db.queryForList("SELECT id FROM extension_installations WHERE current_user_id=? ORDER BY id FOR UPDATE",user);
   var found=new HashSet<UUID>();for(var row:installations)found.add(UUID.fromString(row.get("id").toString()));
   if(!found.equals(immutable.keySet()))throw new Rejected("SOURCE_CONFLICT");
   for(var row:installations){UUID executor=UUID.fromString(row.get("id").toString());
    Object trusted=new Object();
    var preparation=new AmvpP1Preparation(repo,clock,(t,e,action)->{
     if(t!=trusted||!e.equals(executor)||!(action==Action.SECURITY_REVOKE||action==Action.READ))throw new Rejected("AUTHORITY_NOT_VERIFIED");
     var current=accounts.token(body,"PASSWORD_RESET");if(((Number)current.get("user_id")).longValue()!=user)throw new Rejected("STALE_OWNER");
     return new Identity(user,e);
    },this::settings,policies);
    ExpectedOwnerState expected=repo.atomic(false,tx->{var active=tx.activeBindings(executor);if(active.size()>1)throw new Rejected("STALE_OWNER");return active.isEmpty()?new AbsentOwner():new CurrentOwner(active.getFirst().id(),active.getFirst().epoch());});
    preparation.transitionBinding(trusted,immutable.get(executor),executor,expected,TransitionIntent.SECURITY_REVOKE);
   }
   accounts.reset(body);return null;
  });
 }
 AmvpP1Preparation authenticated(HttpServletRequest request){
  // Standalone calls own their transaction; deliberately cannot be used inside an unknown outer one.
  Repository authenticatedBoundary=new Repository(){public <T> T atomic(boolean write,java.util.function.Function<Tx,T> work){
   // MemberAuth.identity uses SELECT FOR UPDATE even for authenticated reads. Own a SQL
   // read-write transaction while the domain Tx still prohibits writes on a read query.
   return repository.own(scope->scope.atomic(write,work));
  }};
  return service(authenticatedBoundary,request,EnumSet.of(Action.READ,Action.CREATE_PREPARATION,Action.CANCEL_PREPARATION));
 }
 Snapshot settings(Tx tx,Identity i){
  // Installation lock is shared with AdditionalConfigStore writers; no MAX(version) across deleted-away rows.
  if(!Objects.equals(tx.currentUser(i.executor()),i.user()))throw new Rejected("STALE_OWNER");
  var active=tx.activeBindings(i.executor());if(active.size()!=1||active.getFirst().user()!=i.user())throw new Rejected("STALE_OWNER");
  String binding=active.getFirst().id().toString();
  var rows=auth.db.queryForList("SELECT config_id,kind,version,value_json,saved_runtime_revision,deleted_at FROM amvp_configs WHERE owner_binding_id=? ORDER BY config_id",binding);
  if(rows.isEmpty())throw new Rejected("SOURCE_UNCONFIRMED");
  long revision=0;var entries=auth.json.createArrayNode();
  for(var row:rows){long v=((Number)row.get("saved_runtime_revision")).longValue();if(v<1||v>MAX_SAFE)throw new Rejected("SOURCE_UNCONFIRMED");revision=Math.max(revision,v);
   var entry=auth.obj("config_id",row.get("config_id"),"kind",row.get("kind"),"version",row.get("version"),"saved_runtime_revision",v,"deleted",row.get("deleted_at")!=null);
   try{entry.set("value",auth.json.readTree(row.get("value_json").toString()));}catch(java.io.IOException error){throw new Rejected("SOURCE_CONFLICT");}
   entries.add(entry);
  }
  // Internal settings source, explicitly NOT MemberSnapshot/FocusRef or a policy for execution.
  var original=auth.obj("format","AMVP_P1_SETTINGS_SOURCE_1","owner_binding_id",binding,"executor_id",i.executor().toString(),"settings",entries);
  return new Snapshot("AMVP_P1_SETTINGS_SOURCE_1",AdditionalConfigContract.canonical(original),revision);
 }
 record SourceRead(String sourceRef,long sourceVersion,String raw,String rawSha256,long expiresAt,String bindingId,long ownerEpoch,String executorId){}
 SourceRead readSource(HttpServletRequest request,UUID executor,ByReference lookup,long expectedSourceVersion){
  var observation=authenticated(request).queryPreparation(request,executor,lookup);
  return mapSource(observation,expectedSourceVersion);
 }
 /** Authenticated read-attempt mapping; creation digest comes only from protected journal. */
 SourceRead readAttemptSource(HttpServletRequest request,UUID executor,ExactAttempt readAttempt,UUID reference,long expectedSourceVersion){
  Objects.requireNonNull(readAttempt);Objects.requireNonNull(reference);
  try(var parser=auth.json.getFactory().createParser(readAttempt.original())){
   parser.enable(com.fasterxml.jackson.core.JsonParser.Feature.STRICT_DUPLICATE_DETECTION);
   JsonNode original=auth.json.readTree(parser);
   if(original==null||!original.isObject()||original.size()!=1||original.path("sourceRef").size()!=2||parser.nextToken()!=null
     ||!AdditionalConfigContract.canonical(original).equals(readAttempt.original())
     ||!reference.toString().equals(original.path("sourceRef").path("id").asText())
     ||!original.path("sourceRef").path("version").isIntegralNumber()
     ||!original.path("sourceRef").path("version").canConvertToLong()
     ||original.path("sourceRef").path("version").asLong()!=expectedSourceVersion)throw new Rejected("SOURCE_CONFLICT");
  }catch(java.io.IOException error){throw new Rejected("SOURCE_CONFLICT");}
  return readOwnedSource(request,executor,reference,expectedSourceVersion);
 }
 /** Matches Core readSource's sourceRef-only seam: creation digest is never received from Core. */
 SourceRead readOwnedSource(HttpServletRequest request,UUID executor,UUID reference,long expectedSourceVersion){
  return repository.own(scope->{
   var reader=service(scope,request,EnumSet.of(Action.READ));
   var lookup=reader.referenceForSource(request,executor,reference,expectedSourceVersion);
   return lookup==null?null:mapSource(reader.queryPreparation(request,executor,lookup),expectedSourceVersion);
  });
 }
 private SourceRead mapSource(Observation<StoredPreparation> observation,long expectedSourceVersion){
  if(observation==null)return null; // Confirmed authenticated absence only; never catch-to-null.
  var stored=observation.stored();var original=stored.original();var current=observation.currentStatus();
  if(current.preparationStatus()!=PreparationStatus.CURRENT||stored.savedRevision()!=expectedSourceVersion||current.currentRevision()!=stored.savedRevision())throw new Rejected("SOURCE_UNCONFIRMED");
  // Exact private mapping: full immutable preparation original, NOT the nested settings bytes alone.
  var rawOriginal=auth.obj("reference",original.reference().toString(),"executor",original.executor().toString(),"user",Long.toString(original.user()),
   "requestId",original.requestId().toString(),"requestDigest",original.requestDigest(),
   "binding",auth.obj("bindingId",original.binding().bindingId().toString(),"epoch",original.binding().epoch()),
   "snapshot",auth.obj("format",original.snapshot().format(),"bytes",original.snapshot().bytes(),"settingsVersion",original.snapshot().settingsVersion()),
   "policyId",original.policyId(),"createdAt",original.createdAt().toString(),"expiresAt",original.expiresAt().toString());
  String raw=AdditionalConfigContract.canonical(rawOriginal);
  return new SourceRead(original.reference().toString(),stored.savedRevision(),raw,AmvpP1Preparation.hash(raw),original.expiresAt().toEpochMilli(),original.binding().bindingId().toString(),original.binding().epoch(),original.executor().toString());
 }
}
