package kr.ac.kdu.focurve;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.*;
import jakarta.servlet.http.HttpServletRequest;
import java.time.*;
import java.time.format.DateTimeFormatterBuilder;
import java.util.*;
import org.springframework.context.annotation.Profile;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.bind.annotation.*;
import static kr.ac.kdu.focurve.MemberAuth.*;
import static kr.ac.kdu.focurve.MemberIntervals.text;

/** API-STAT-03: 24 positional Metrics (00..23 KST), from accepted owner-scoped access receipts.
 * Positive counts are lower bounds; no receipt/collector watermark proves an empty hour complete.
 */
@Profile("member-runtime | local-integration") @RestController
final class MemberHourlyStatisticsApi {
 private final MemberAuth auth;private final MemberReadModel read;private final TransactionTemplate tx;
 // Preserve MemberAuth's existing FOR UPDATE ownership/auth fences; this route issues no writes.
 MemberHourlyStatisticsApi(MemberAuth auth,MemberReadModel read,PlatformTransactionManager manager){this.auth=auth;this.read=read;tx=new TransactionTemplate(manager);tx.setIsolationLevel(org.springframework.transaction.TransactionDefinition.ISOLATION_REPEATABLE_READ);}
 @GetMapping("/api/v1/statistics/hourly") ResponseEntity<?> get(HttpServletRequest request){
  try {return tx.execute(ignored->{var identity=auth.identity(request,false);Query.allowed(request.getParameterMap(),"from_date","to_date");var range=read.range(request.getParameterMap());return ResponseEntity.ok().header("Cache-Control","no-store").body(project(auth.json,range,read.accesses(identity),Instant.now()));});}
  catch(Failure failure){return ResponseEntity.status(failure.status).header("Cache-Control","no-store").body(MemberMvpApi.error(auth,failure.code));}
  catch(Exception failure){return ResponseEntity.status(409).header("Cache-Control","no-store").body(MemberMvpApi.error(auth,"READ_UNCONFIRMED"));}
 }
 static ArrayNode project(ObjectMapper json,MemberReadModel.Range range,List<ObjectNode> rows,Instant observed){
  check(rows.size()<=50000,503,"TEMPORARILY_UNAVAILABLE");long[] total=new long[24],repeat=new long[24],blocked=new long[24];boolean[] review=new boolean[24];Set<String> seen=new HashSet<>();
  for(var row:rows){
   var time=Instant.parse(text(row,"occurred_at"));long epoch=time.toEpochMilli();if(epoch<range.from()||epoch>=range.to())continue;
   check(seen.add(text(row,"event_id")),409,"READ_UNCONFIRMED");
   int hour=time.atZone(ZoneId.of("Asia/Seoul")).getHour();total[hour]++;if(row.path("is_repeat").asBoolean())repeat[hour]++;
   if(text(row,"event_type").startsWith("BLOCKED_"))blocked[hour]++;review[hour]|=text(row,"quality").equals("REVIEW_REQUIRED");
  }
  String asOf=new DateTimeFormatterBuilder().appendInstant(3).toFormatter().format(observed);ArrayNode result=json.createArrayNode();
  for(int hour=0;hour<24;hour++){
   var value=result.addObject();boolean known=total[hour]>0;
   if(known){value.put("total_access",total[hour]);value.put("repeat_access",repeat[hour]);value.put("blocked_access",blocked[hour]);value.put("repeat_ratio",(double)repeat[hour]/total[hour]);}
   else {for(String name:List.of("total_access","repeat_access","blocked_access","repeat_ratio"))value.putNull(name);}
   value.putNull("active_duration_ms");value.put("quality",review[hour]?"REVIEW_REQUIRED":known?"PARTIAL":"NOT_COLLECTED");value.put("as_of",asOf);
  }
  return result;
 }
}
