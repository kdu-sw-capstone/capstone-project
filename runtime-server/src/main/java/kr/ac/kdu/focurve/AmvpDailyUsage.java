package kr.ac.kdu.focurve;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.time.*;
import java.sql.Timestamp;
import java.util.*;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.TransactionTemplate;
import static kr.ac.kdu.focurve.MemberAuth.*;
import static kr.ac.kdu.focurve.AmvpBridgeSupport.*;

/** DAY-01 read projection. Never issues quota, resets a day or infers live Core enforcement. */
final class AmvpDailyUsage {
 record Query(String executor,LocalDate date){
  static Query parse(Map<String,String[]> params){
   check(params.keySet().equals(Set.of("executor_id","date")),400,"VALIDATION_FAILED");
   for(var values:params.values())check(values.length==1,400,"VALIDATION_FAILED");
   String executor=params.get("executor_id")[0],date=params.get("date")[0];
   check(executor.matches("[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}")&&date.matches("[0-9]{4}-[0-9]{2}-[0-9]{2}"),400,"VALIDATION_FAILED");
   try{return new Query(executor,LocalDate.parse(date));}catch(DateTimeException invalid){throw new Failure(422,"VALIDATION_FAILED");}
  }
 }
 private final MemberAuth a;private final AdditionalConfigStore.Admission admission;private final AdditionalConfigContract contract;private final TransactionTemplate read;
 AmvpDailyUsage(MemberAuth auth,PlatformTransactionManager manager,AdditionalConfigStore.Admission admission){
  a=auth;this.admission=Objects.requireNonNull(admission);contract=new AdditionalConfigContract(a.json);
  read=new TransactionTemplate(manager);read.setReadOnly(true);read.setIsolationLevel(TransactionDefinition.ISOLATION_REPEATABLE_READ);
 }
 ObjectNode get(Identity principal,String policy,Query query){
  contract.validate("Uuid",a.json.valueToTree(policy));
  check(principal.executor()==null||principal.executor().equals(query.executor),403,"FORBIDDEN_EXECUTOR");
  return read.execute(tx->{
   var config=a.one("SELECT c.*,b.executor_id,b.user_id FROM amvp_configs c JOIN amvp_owner_bindings b ON b.binding_id=c.owner_binding_id WHERE c.config_id=? AND c.kind='SITE_TIME' AND b.user_id=? AND b.executor_id=?",policy,principal.user(),query.executor);
   check(config!=null,404,"RESOURCE_NOT_FOUND");String binding=config.get("owner_binding_id").toString();admission.verify(principal,query.executor,binding,false);
   // Bounded broad UTC scan; the actual local date is selected from persisted capture timezone.
   Instant lo=query.date.atStartOfDay(ZoneOffset.UTC).minusDays(2).toInstant(),hi=query.date.atStartOfDay(ZoneOffset.UTC).plusDays(3).toInstant();
   var budgets=a.db.queryForList("SELECT * FROM amvp_day_budgets WHERE executor_id=? AND policy_id=? AND day_start_at>=? AND day_start_at<? ORDER BY day_start_at LIMIT 17",query.executor,policy,Timestamp.from(lo),Timestamp.from(hi));
   check(budgets.size()<=16,503,"TEMPORARILY_UNAVAILABLE");check(!budgets.isEmpty(),404,"RESOURCE_NOT_FOUND");
   var segments=a.db.queryForList("SELECT s.*,r.confirmed_ms AS resolved_ms,r.day_start_at AS resolved_day_start,r.day_end_at AS resolved_day_end,ca.verification_state AS resolution_anchor_state FROM amvp_usage_segments s LEFT JOIN amvp_clock_resolutions r ON r.segment_id=s.segment_id AND r.owner_binding_id=s.owner_binding_id AND r.executor_id=s.executor_id AND r.source_hash=s.payload_sha256 LEFT JOIN amvp_clock_anchors ca ON ca.anchor_id=r.anchor_id AND ca.owner_binding_id=r.owner_binding_id AND ca.executor_id=r.executor_id WHERE s.owner_binding_id=? AND s.executor_id=? AND ((s.start_at>=? AND s.start_at<?) OR (r.day_start_at>=? AND r.day_start_at<?)) ORDER BY s.segment_id LIMIT 50001",binding,query.executor,Timestamp.from(lo),Timestamp.from(hi),Timestamp.from(lo),Timestamp.from(hi));
   check(segments.size()<=50000,503,"TEMPORARILY_UNAVAILABLE");
   var matches=new ArrayList<ObjectNode>();boolean unresolved=false;
   for(var budget:budgets){
    Instant start=Instant.parse(instant(budget.get("day_start_at"))),end=Instant.parse(instant(budget.get("day_end_at")));
    String chain=budget.get("enforcement_day_chain_id").toString(),zone=null;Long zoneVersion=null;long total=0;boolean found=false;
    for(var row:segments){
     var raw=parse(row.get("payload_json"));
     if(!raw.path("enforcement_day_chain_id").asText().equals(chain))continue;
     boolean attributed=false;for(var item:raw.path("policy_attributions"))attributed|=item.path("policy_id").asText().equals(policy);
     if(!attributed)continue;
     Instant first=Instant.parse(row.get("resolved_day_start")==null?raw.path("day_start_at").asText():instant(row.get("resolved_day_start")));
     Instant last=Instant.parse(row.get("resolved_day_end")==null?raw.path("day_end_at").asText():instant(row.get("resolved_day_end")));
     if(!start.equals(first)||!end.equals(last))continue;
     if(!"COUNTED".equals(row.get("measurement_state")))continue;
     boolean resolved=row.get("resolved_ms")!=null;
     check(resolved?"VERIFIED".equals(row.get("resolution_anchor_state")):"TRUSTED".equals(raw.path("clock").path("quality").asText()),503,"STORE_UNCONFIRMED");
     String capturedZone=raw.path("timezone").asText();long capturedVersion=raw.path("timezone_version").asLong();
     check(ZoneId.getAvailableZoneIds().contains(capturedZone)&&capturedVersion>=1,503,"STORE_UNCONFIRMED");
     if(zone!=null)check(zone.equals(capturedZone)&&zoneVersion==capturedVersion,503,"STORE_UNCONFIRMED");
     zone=capturedZone;zoneVersion=capturedVersion;
     long amount=((Number)row.get(resolved?"resolved_ms":"confirmed_ms")).longValue();
     check(amount>=0&&amount<=AdditionalConfigContract.MAX_VERSION-total,503,"STORE_UNCONFIRMED");total+=amount;found=true;
    }
    // No clock/day proof means no invented timezone, zero usage or zero carry.
    if(!found){unresolved=true;continue;}
    ZoneId z=ZoneId.of(zone);if(!start.atZone(z).toLocalDate().equals(query.date))continue;
    long cache=((Number)budget.get("confirmed_ms")).longValue(),carry=((Number)budget.get("budget_carry_debit_ms")).longValue();
    check(cache==total&&carry>=0&&carry<=AdditionalConfigContract.MAX_VERSION,503,"STORE_UNCONFIRMED");
    Instant midnight=query.date.atStartOfDay(z).toInstant(),next=query.date.plusDays(1).atStartOfDay(z).toInstant();
    var value=a.obj("policy_id",policy,"executor_id",query.executor,"day_start_at",utc(start),"day_end_at",utc(end),"timezone",zone,"timezone_version",zoneVersion,
     "day_kind",start.equals(midnight)&&end.equals(next)?"NORMAL":"TRANSITION","confirmed_ms",total,"budget_carry_debit_ms",carry,"remaining_ms",null,"daily_limit_ms",budget.get("daily_limit_ms"),
     "active_reasons",List.of(),"enforcement_state","UNKNOWN","next_usable_at",null,"next_usable_status","UNKNOWN","quality","PARTIAL","as_of",utc(Instant.now()));
    contract.validate("DailyUsage",value);matches.add(value);
   }
   // Timezone transition can yield two buckets with the same local date. Never choose or merge one silently.
   check(matches.size()<=1&&!unresolved,503,"STORE_UNCONFIRMED");check(!matches.isEmpty(),404,"RESOURCE_NOT_FOUND");return matches.getFirst();
  });
 }
 private ObjectNode parse(Object value){try{var result=a.json.readTree(value.toString());check(result.isObject(),503,"STORE_UNCONFIRMED");return (ObjectNode)result;}catch(java.io.IOException invalid){throw new Failure(503,"STORE_UNCONFIRMED");}}
}
