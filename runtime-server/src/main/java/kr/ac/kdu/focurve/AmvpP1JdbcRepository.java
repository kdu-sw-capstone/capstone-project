package kr.ac.kdu.focurve;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.sql.Timestamp;
import java.time.*;
import java.util.*;
import java.util.function.Function;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.transaction.support.TransactionTemplate;
import static kr.ac.kdu.focurve.AmvpP1Preparation.*;

/** Opt-in JDBC persistence only. Not a Bean or migration runner. No external authority calls.
 * The owning authentication orchestrator must enlist its mutations inside this outermost
 * boundary before deployment; joining an unknown outer transaction is deliberately rejected.
 */
final class AmvpP1JdbcRepository implements Repository {
 private final JdbcTemplate db;private final PlatformTransactionManager manager;private final ObjectMapper json;
 AmvpP1JdbcRepository(JdbcTemplate db,PlatformTransactionManager manager,ObjectMapper json){
   this.db=Objects.requireNonNull(db);this.manager=Objects.requireNonNull(manager);// Immutable JSON originals must not use floating epoch seconds (MySQL JSON may
   // normalize numeric values). Preserve exact historical Instants as ISO strings.
   this.json=Objects.requireNonNull(json).copy().disable(com.fasterxml.jackson.databind.SerializationFeature.WRITE_DATES_AS_TIMESTAMPS);
 }
 @Override public <T> T atomic(boolean write,Function<Tx,T> work){
   if(TransactionSynchronizationManager.isActualTransactionActive())throw new Rejected("OUTERMOST_COMMIT_REQUIRED");
   TransactionTemplate transaction=new TransactionTemplate(manager);transaction.setReadOnly(!write);
   return transaction.execute(status->work.apply(new JdbcTx(write)));
 }
 /** Explicit outer owner only. The supplied repository cannot escape the callback. */
 <T> T own(java.util.function.Function<Repository,T> work) {
   if(TransactionSynchronizationManager.isActualTransactionActive())throw new Rejected("OUTERMOST_COMMIT_REQUIRED");
   final boolean[] open={true};final Thread owner=Thread.currentThread();
   Repository enlisted=new Repository(){public <R> R atomic(boolean write,Function<Tx,R> body){
     if(!open[0]||Thread.currentThread()!=owner||!TransactionSynchronizationManager.isActualTransactionActive())throw new Rejected("TRANSACTION_SCOPE_CLOSED");
     return body.apply(new JdbcTx(write));
   }};
   try{return new TransactionTemplate(manager).execute(status->work.apply(enlisted));}
   finally{open[0]=false;}
 }
 private final class JdbcTx implements Tx {
   private final boolean write;private final Set<UUID> locked=new HashSet<>();
   JdbcTx(boolean write){this.write=write;}
   private void writable(){if(!write)throw new Rejected("READ_ONLY_QUERY");}
   private void executorLock(UUID executor){
     if(write && !locked.contains(executor))throw new Rejected("EXECUTOR_LOCK_REQUIRED");
   }
   @Override public Long currentUser(UUID executor){
     var rows=db.queryForList("SELECT current_user_id FROM extension_installations WHERE id=?"+(write?" FOR UPDATE":""),executor.toString());
     if(rows.size()!=1)throw new Rejected("STALE_OWNER");
     if(write)locked.add(executor);
     Object value=rows.getFirst().get("current_user_id");return value instanceof Number n?n.longValue():null;
   }
   @Override public boolean hasExecutionLock(long user,UUID executor){
     executorLock(executor);return !db.queryForList("SELECT user_id FROM active_execution_locks WHERE user_id=? OR executor_id=?",user,executor.toString()).isEmpty();
   }
   @Override public List<Binding> activeBindings(UUID executor){
     executorLock(executor);
     return db.queryForList("SELECT * FROM amvp_owner_bindings WHERE executor_id=? AND state='ACTIVE' AND closed_at IS NULL"+(write?" FOR UPDATE":""),executor.toString()).stream().map(AmvpP1JdbcRepository::binding).toList();
   }
   @Override public long maximumEpoch(UUID executor){
     executorLock(executor);Long epoch=db.queryForObject("SELECT COALESCE(MAX(owner_epoch),0) FROM amvp_owner_bindings WHERE executor_id=?",Long.class,executor.toString());return Objects.requireNonNull(epoch);
   }
   @Override public void saveBinding(Binding value){
     writable();executorLock(value.executor());
     if(value.active()) {
       if(db.update("INSERT INTO amvp_owner_bindings(binding_id,executor_id,user_id,owner_epoch,state,created_at,closed_at) VALUES(?,?,?,?,'ACTIVE',?,NULL)",value.id().toString(),value.executor().toString(),value.user(),value.epoch(),Timestamp.from(value.createdAt()))!=1)throw new Rejected("STORE_UNCONFIRMED");
     } else {
       if(db.update("UPDATE amvp_owner_bindings SET state='CLOSED',closed_at=? WHERE binding_id=? AND executor_id=? AND user_id=? AND owner_epoch=? AND state='ACTIVE' AND closed_at IS NULL",Timestamp.from(value.closedAt()),value.id().toString(),value.executor().toString(),value.user(),value.epoch())!=1)throw new Rejected("STALE_OWNER");
     }
   }
   @Override public Journal journal(RequestKey key){
     executorLock(key.executor());var rows=db.queryForList("SELECT * FROM amvp_p1_request_results WHERE executor_id=? AND user_id=? AND request_id=?"+(write?" FOR UPDATE":""),key.executor().toString(),key.user(),key.requestId().toString());
     if(rows.isEmpty())return null;if(rows.size()!=1)throw new Rejected("STORE_UNCONFIRMED");
     var row=rows.getFirst();String kind=row.get("result_kind").toString();Class<?> type=switch(kind){case "transition"->StoredTransition.class;case "preparation"->StoredPreparation.class;default->throw new Rejected("STORE_UNCONFIRMED");};
     return new Journal(row.get("request_original").toString(),row.get("request_sha256").toString(),row.get("fingerprint").toString(),kind,parse(row.get("result_json").toString(),type));
   }
   @Override public void saveJournal(RequestKey key,Journal value){
     writable();executorLock(key.executor());
     if(db.update("INSERT INTO amvp_p1_request_results(executor_id,user_id,request_id,request_original,request_sha256,fingerprint,result_kind,result_json) VALUES(?,?,?,?,?,?,?,?)",key.executor().toString(),key.user(),key.requestId().toString(),value.requestOriginal(),value.requestDigest(),value.fingerprint(),value.kind(),serialize(value.result()))!=1)throw new Rejected("STORE_UNCONFIRMED");
   }
   @Override public PreparationRow preparation(UUID reference){
     var rows=db.queryForList("SELECT * FROM amvp_p1_preparations WHERE preparation_id=?"+(write?" FOR UPDATE":""),reference.toString());
     if(rows.isEmpty())return null;if(rows.size()!=1)throw new Rejected("STORE_UNCONFIRMED");var row=rows.getFirst();
     StoredPreparation creation=parse(row.get("creation_json").toString(),StoredPreparation.class);
     Termination terminal=row.get("termination_json")==null?null:parse(row.get("termination_json").toString(),Termination.class);
     return new PreparationRow(creation,((Number)row.get("cas_revision")).longValue(),terminal);
   }
   @Override public void savePreparation(PreparationRow value,Long expectedRevision){
     writable();PreparationOriginal original=value.creation().original();executorLock(original.executor());
     int count;
     if(expectedRevision==null){
       if(value.revision()!=1 || value.termination()!=null)throw new Rejected("INVALID_REVISION");
       count=db.update("INSERT INTO amvp_p1_preparations(preparation_id,executor_id,user_id,creation_json,cas_revision,termination_json) VALUES(?,?,?,?,1,NULL)",original.reference().toString(),original.executor().toString(),original.user(),serialize(value.creation()));
     } else {
       if(value.revision()!=expectedRevision+1 || value.termination()==null)throw new Rejected("INVALID_REVISION");
       count=db.update("UPDATE amvp_p1_preparations SET cas_revision=?,termination_json=? WHERE preparation_id=? AND executor_id=? AND user_id=? AND cas_revision=? AND termination_json IS NULL",value.revision(),serialize(value.termination()),original.reference().toString(),original.executor().toString(),original.user(),expectedRevision);
     }
     if(count!=1)throw new Rejected("STALE_VERSION");
   }
 }
 private String serialize(Object value){try{return json.writeValueAsString(value);}catch(Exception e){throw new IllegalStateException("P1_STORE_SERIALIZATION",e);}}
 private <T> T parse(String value,Class<T> type){try{return json.readValue(value,type);}catch(Exception e){throw new IllegalStateException("P1_STORE_UNCONFIRMED",e);}}
 private static Instant instant(Object value){
   if(value==null)return null;if(value instanceof Timestamp t)return t.toInstant();if(value instanceof LocalDateTime t)return t.toInstant(ZoneOffset.UTC);throw new Rejected("STORE_UNCONFIRMED");
 }
 private static Binding binding(Map<String,Object> row){
   return new Binding(UUID.fromString(row.get("binding_id").toString()),UUID.fromString(row.get("executor_id").toString()),((Number)row.get("user_id")).longValue(),((Number)row.get("owner_epoch")).longValue(),instant(row.get("created_at")),instant(row.get("closed_at")));
 }
}
