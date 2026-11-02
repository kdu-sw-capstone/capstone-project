package kr.ac.kdu.focurve;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.*;
import java.util.*;
import org.junit.jupiter.api.Test;
import static org.assertj.core.api.Assertions.*;

class DailyFocusGoalTest {
 final ObjectMapper json=new ObjectMapper();
 @Test void targetBoundsAndNullAreIndependentFromSessionDuration(){
  for(Integer n:new Integer[]{null,1,1440})DailyFocusGoal.validate(json.valueToTree(new LinkedHashMap<String,Object>(){{put("goal_minutes",n);put("timezone",null);}}));
  for(var raw:List.of("{\"goal_minutes\":0,\"timezone\":null}","{\"goal_minutes\":1441,\"timezone\":null}","{\"goal_minutes\":1.5,\"timezone\":null}","{\"goal_minutes\":\"30\",\"timezone\":null}"))assertThatThrownBy(()->DailyFocusGoal.validate(json.readTree(raw))).hasMessage("VALIDATION_FAILED");
 }
 @Test void zoneMustBeExplicitIanaRatherThanOffsetOrSystemDefault()throws Exception{
  DailyFocusGoal.validate(json.readTree("{\"goal_minutes\":30,\"timezone\":\"Asia/Seoul\"}"));
  assertThatThrownBy(()->DailyFocusGoal.zone("+09:00")).hasMessage("INVALID_TIMEZONE");
  assertThatThrownBy(()->DailyFocusGoal.validate(json.readTree("{\"goal_minutes\":30,\"timezone\":null,\"user_id\":5}"))).hasMessage("VALIDATION_FAILED");
 }
 @Test void duplicatesAndCrossSessionOverlapAreUnionedWithoutLosingSubMinutePrecision(){
  var spans=List.of(new DailyFocusGoal.Span(0,90001),new DailyFocusGoal.Span(30000,120001),new DailyFocusGoal.Span(0,90001));
  assertThat(DailyFocusGoal.union(spans,0,200000)).isEqualTo(120001);
  assertThat(DailyFocusGoal.union(spans,60000,120000)).isEqualTo(60000);
  assertThat(DailyFocusGoal.union(spans,120001,180000)).isZero();
 }
 @Test void midnightPartitionIsExclusiveAndDstDaysAreNotFixed24Hours(){
  var zone=ZoneId.of("America/New_York");
  for(var day:List.of(LocalDate.of(2026,3,8),LocalDate.of(2026,11,1))){
   long start=day.atStartOfDay(zone).toInstant().toEpochMilli(),mid=day.plusDays(1).atStartOfDay(zone).toInstant().toEpochMilli(),end=day.plusDays(2).atStartOfDay(zone).toInstant().toEpochMilli();
   var spans=List.of(new DailyFocusGoal.Span(start, end));
   assertThat(DailyFocusGoal.union(spans,start,mid)+DailyFocusGoal.union(spans,mid,end)).isEqualTo(end-start);
   assertThat(mid-start).isEqualTo(Duration.ofHours(day.getMonthValue()==3?23:25).toMillis());
  }
 }
 @Test void conflictAndVersionExhaustionCannotSilentlyOverwrite(){
  assertThatThrownBy(()->Option12Writes.expected(null,0)).hasMessage("PRECONDITION_REQUIRED");
  assertThatThrownBy(()->Option12Writes.expected("\"1\"",2)).hasMessage("VERSION_CONFLICT");
  assertThatThrownBy(()->Option12Writes.next(Option12Writes.MAX)).hasMessage("VERSION_CONFLICT");
 }
}
