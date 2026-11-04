package kr.ac.kdu.focurve;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.sql.Timestamp;
import java.time.*;
import java.util.*;
import static kr.ac.kdu.focurve.MemberAuth.*;

/** Reads the existing accepted CONFIRMED RUN ledger, never the UI countdown. */
final class DailyFocusGoal {
 final MemberAuth auth;
 DailyFocusGoal(MemberAuth auth){this.auth=auth;}
 record Span(long start,long end) {}
 static long union(List<Span> input,long start,long end){
  var spans=input.stream().map(s->new Span(Math.max(start,s.start),Math.min(end,s.end)))
   .filter(s->s.end>s.start).sorted(Comparator.comparingLong(Span::start)).toList();
  long total=0,until=Long.MIN_VALUE;
  for(var s:spans){total=Math.addExact(total,Math.max(0,s.end-Math.max(until,s.start)));until=Math.max(until,s.end);}
  return total;
 }
 static ZoneId zone(String value){
  check(value!=null&&ZoneId.getAvailableZoneIds().contains(value),422,"INVALID_TIMEZONE");
  return ZoneId.of(value);
 }
 static void validate(JsonNode body){
  check(body.isObject()&&body.size()==2&&body.has("goal_minutes")&&body.has("timezone"),422,"VALIDATION_FAILED");
  var goal=body.get("goal_minutes");
  check(goal.isNull()||goal.isIntegralNumber()&&goal.canConvertToInt()&&goal.asInt()>=1&&goal.asInt()<=1440,422,"VALIDATION_FAILED");
  check(body.get("timezone").isNull()||body.get("timezone").isTextual(),422,"INVALID_TIMEZONE");
  if(!body.get("timezone").isNull())zone(body.get("timezone").asText());
 }
 void owner(long user){check(auth.one("SELECT id FROM users WHERE id=? FOR UPDATE",user)!=null,401,"UNAUTHENTICATED");}
 ObjectNode settings(long user){
  var row=auth.one("SELECT * FROM daily_focus_goals WHERE user_id=?",user);
  if(row==null)return auth.obj("goal_minutes",null,"timezone",null,"version",0,"goal_effective_date",null,"updated_at",null);
  return auth.obj("goal_minutes",row.get("goal_minutes"),"timezone",row.get("timezone"),"version",row.get("version"),
   "goal_effective_date",Objects.toString(row.get("goal_effective_date"),null),"updated_at",instant(row.get("updated_at")));
 }
 ObjectNode save(long user,JsonNode body,String match,String key,Instant at){
  validate(body);owner(user);return Option12Writes.once(auth,user,"/api/v1/daily-focus-goal",body,match,key,()->{
   var old=settings(user);Option12Writes.expected(match,old.path("version").asLong());
   long version=Option12Writes.next(old.path("version").asLong());
   Integer goal=body.get("goal_minutes").isNull()?null:body.get("goal_minutes").asInt();
   String tz=body.get("timezone").isNull()?null:body.get("timezone").asText();
   // Clearing a previously chosen zone would lose its effective-time boundary.
   check(old.path("timezone").isNull()||tz!=null,422,"INVALID_TIMEZONE");
   var date=tz==null?null:at.atZone(zone(tz)).toLocalDate();
   if(!Objects.equals(tz,old.path("timezone").isNull()?null:old.path("timezone").asText())&&tz!=null){
    // On first selection no account-zone history exists; today's entire day is eligible.
    Instant effective=old.path("timezone").isNull()?date.atStartOfDay(zone(tz)).toInstant():at;
    auth.db.update("INSERT INTO daily_focus_timezones VALUES(?,?,?,?)",user,version,tz,Timestamp.from(effective));
   }
   auth.db.update("INSERT INTO daily_focus_goals VALUES(?,?,?,?,?,?) ON DUPLICATE KEY UPDATE goal_minutes=VALUES(goal_minutes),timezone=VALUES(timezone),version=VALUES(version),goal_effective_date=VALUES(goal_effective_date),updated_at=VALUES(updated_at)",
    user,goal,tz,version,date==null?null:java.sql.Date.valueOf(date),Timestamp.from(at));
   return settings(user);
  });
 }
 ObjectNode today(long user,Instant at){
  var result=settings(user);result.put("as_of",at.toString());
  if(result.path("timezone").isNull()){
   result.put("time_status","TIMEZONE_NOT_SET");result.putNull("confirmed_ms");result.putNull("last_confirmed_at");result.putNull("date");return result;
  }
  var zone=zone(result.path("timezone").asText());var date=at.atZone(zone).toLocalDate();
  long start=date.atStartOfDay(zone).toInstant().toEpochMilli(),end=date.plusDays(1).atStartOfDay(zone).toInstant().toEpochMilli();
  var period=auth.one("SELECT effective_at FROM daily_focus_timezones WHERE user_id=? ORDER BY version DESC LIMIT 1",user);
  check(period!=null,409,"READ_UNCONFIRMED");
  // Earlier zones retain their historical local-date attribution. This read is
  // the current zone/day portion only; the boundary is explicit in the response.
  long since=Instant.parse(instant(period.get("effective_at"))).toEpochMilli(),from=Math.max(start,since);
  var spans=new ArrayList<Span>();Map<Long,Long> remaining=new HashMap<>();Long cutoff=null;
  var rows=auth.db.queryForList("SELECT i.id,i.session_id,i.start_at,i.confirmed_until,s.duration_minutes FROM session_intervals i JOIN focus_sessions s ON s.id=i.session_id WHERE s.user_id=? AND i.kind='RUN' AND i.quality='CONFIRMED' ORDER BY i.session_id,i.start_at,i.id",user);
  check(rows.size()<=50000,503,"TEMPORARILY_UNAVAILABLE");
  for(var row:rows){
   long sid=((Number)row.get("session_id")).longValue(),begin=Instant.parse(instant(row.get("start_at"))).toEpochMilli(),until=Instant.parse(instant(row.get("confirmed_until"))).toEpochMilli();
   check(until>=begin&&until<=at.toEpochMilli(),409,"READ_UNCONFIRMED");
   long budget=remaining.getOrDefault(sid,((Number)row.get("duration_minutes")).longValue()*60000);
   long counted=Math.min(budget,until-begin);remaining.put(sid,budget-counted);spans.add(new Span(begin,begin+counted));
   if(until>from&&begin<end)cutoff=cutoff==null?until:Math.max(cutoff,until);
  }
  long confirmed=union(spans,from,Math.min(end,at.toEpochMilli()));
  boolean unconfirmed=auth.one("SELECT id FROM focus_sessions WHERE user_id=? AND execution_status IN ('UNKNOWN','STARTING','ENDING','NATIVE_VERIFYING','EFFECT_VERIFYING') LIMIT 1",user)!=null;
  result.put("date",date.toString());result.put("day_start",Instant.ofEpochMilli(start).toString());result.put("day_end",Instant.ofEpochMilli(end).toString());
  result.put("period_start",Instant.ofEpochMilli(from).toString());result.put("partial_day",from>start);result.put("confirmed_ms",confirmed);
  if(cutoff==null)result.putNull("last_confirmed_at");else result.put("last_confirmed_at",Instant.ofEpochMilli(cutoff).toString());
  result.put("has_unconfirmed_session",unconfirmed);result.put("time_status",cutoff==null?"NO_CONFIRMED_INTERVALS":"CONFIRMED_LOWER_BOUND");
  // No target is inferred for past dates. The only projection offered here is today.
  return result;
 }
}
