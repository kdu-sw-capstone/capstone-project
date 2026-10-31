package kr.ac.kdu.focurve;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.time.*;
import java.time.format.DateTimeFormatterBuilder;
import java.util.*;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import static kr.ac.kdu.focurve.MemberAuth.*;

/** Read-side only. Raw receipt, trusted measurement, quota debit and focus time remain distinct. */
final class AdditionalUsageStatistics {
 record Range(String scope,String executor,LocalDate from,LocalDate to) {
  static Range parse(Map<String,String[]> query) {
   check(query.keySet().stream().allMatch(Set.of("scope","executor_id","from_date","to_date")::contains),400,"VALIDATION_FAILED");
   for(var values:query.values())check(values.length==1,400,"VALIDATION_FAILED");
   String scope=single(query,"scope"),executor=single(query,"executor_id"),from=single(query,"from_date"),to=single(query,"to_date");
   check(Set.of("INSTALLATION","ACCOUNT_TOTAL").contains(scope==null?"":scope),400,"VALIDATION_FAILED");
   check(!scope.equals("INSTALLATION")||executor!=null,400,"VALIDATION_FAILED");
   if(executor!=null)check(executor.matches("[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}"),400,"VALIDATION_FAILED");
   try {
    check(from!=null&&to!=null&&from.matches("[0-9]{4}-[0-9]{2}-[0-9]{2}")&&to.matches("[0-9]{4}-[0-9]{2}-[0-9]{2}"),400,"VALIDATION_FAILED");
    LocalDate first=LocalDate.parse(from),last=LocalDate.parse(to);check(!last.isBefore(first)&&java.time.temporal.ChronoUnit.DAYS.between(first,last)<366,422,"VALIDATION_FAILED");return new Range(scope,executor,first,last);
   }catch(DateTimeException e){throw new Failure(422,"VALIDATION_FAILED");}
  }
  private static String single(Map<String,String[]> q,String key){return q.containsKey(key)?q.get(key)[0]:null;}
 }
 private final MemberAuth a;private final AdditionalConfigStore.Admission admission;private final TransactionTemplate read;
 AdditionalUsageStatistics(MemberAuth a,PlatformTransactionManager manager,AdditionalConfigStore.Admission admission){this.a=a;this.admission=admission;read=new TransactionTemplate(manager);read.setReadOnly(true);read.setIsolationLevel(org.springframework.transaction.TransactionDefinition.ISOLATION_REPEATABLE_READ);}
 ObjectNode query(Identity identity,Range range) {
  check(identity.executor()==null||range.scope.equals("INSTALLATION")&&identity.executor().equals(range.executor),403,"FORBIDDEN_EXECUTOR");
  return read.execute(tx->{
   String filter=range.scope.equals("INSTALLATION")?" AND b.executor_id=?":"";Object[] args=range.scope.equals("INSTALLATION")?new Object[]{identity.user(),range.executor}:new Object[]{identity.user()};
   var bindings=a.db.queryForList("SELECT b.binding_id,b.executor_id FROM amvp_owner_bindings b WHERE b.user_id=?"+filter,args);
   check(!bindings.isEmpty(),404,"RESOURCE_NOT_FOUND");
   for(var binding:bindings)admission.verify(identity,binding.get("executor_id").toString(),binding.get("binding_id").toString(),false);
   // Historical bindings retain their original member, and are never reassigned to current_user_id.
   var rows=a.db.queryForList("SELECT s.payload_json,s.confirmed_ms,s.measurement_state,r.confirmed_ms AS resolved_ms,r.day_start_at AS resolved_day_start,ca.verification_state AS anchor_state FROM amvp_usage_segments s JOIN amvp_owner_bindings b ON b.binding_id=s.owner_binding_id LEFT JOIN amvp_clock_resolutions r ON r.segment_id=s.segment_id AND r.owner_binding_id=s.owner_binding_id AND r.executor_id=s.executor_id AND r.source_hash=s.payload_sha256 LEFT JOIN amvp_clock_anchors ca ON ca.anchor_id=r.anchor_id AND ca.owner_binding_id=r.owner_binding_id AND ca.executor_id=r.executor_id WHERE b.user_id=?"+filter+" ORDER BY s.segment_id LIMIT 50001",args);
   check(rows.size()<=50000,503,"TEMPORARILY_UNAVAILABLE");
   long confirmed=0;boolean counted=false,unconfirmed=false;
   for(var row:rows) {
    try {
     JsonNode raw=a.json.readTree(row.get("payload_json").toString());String zone=raw.path("timezone").asText();
     check(ZoneId.getAvailableZoneIds().contains(zone),422,"INVALID_TIMEZONE");
     Instant day=row.get("resolved_day_start")==null?Instant.parse(raw.path("day_start_at").asText()):Instant.parse(instant(row.get("resolved_day_start")));
     LocalDate date=day.atZone(ZoneId.of(zone)).toLocalDate();if(date.isBefore(range.from)||date.isAfter(range.to))continue;
     if(!"COUNTED".equals(row.get("measurement_state"))){unconfirmed=true;continue;}
     if(row.get("resolved_ms")!=null&&!"VERIFIED".equals(row.get("anchor_state"))){unconfirmed=true;continue;}
     if(row.get("resolved_ms")==null&&!"TRUSTED".equals(raw.path("clock").path("quality").asText())){unconfirmed=true;continue;}
     long milliseconds=((Number)(row.get("resolved_ms")==null?row.get("confirmed_ms"):row.get("resolved_ms"))).longValue();
     check(milliseconds>=0&&milliseconds<=AdditionalConfigContract.MAX_VERSION,422,"VERSION_LIMIT");
     check(confirmed<=AdditionalConfigContract.MAX_VERSION-milliseconds,422,"VERSION_LIMIT");confirmed+=milliseconds;counted=true;
     unconfirmed|=raw.path("uncertain_ms").asLong(0)>0||!raw.path("quality").asText().equals("COMPLETE");
    }catch(java.io.IOException|DateTimeException error){unconfirmed=true;}
   }
   // Collector coverage is not issued by this read adapter, so even counted data is PARTIAL.
   String quality=counted?"PARTIAL":unconfirmed?"UNKNOWN":"NO_DATA";
   return a.obj("scope",range.scope,"quota_debit",false,"aggregation","SUM_OF_DEVICE_USAGE","from_date",range.from.toString(),"to_date",range.to.toString(),"browser_ms",counted?confirmed:null,"focus_ms",null,"repeat_count",null,"repeat_ratio",null,"quality",quality,"as_of",new DateTimeFormatterBuilder().appendInstant(3).toFormatter().format(Instant.now()));
  });
 }
}
