package kr.ac.kdu.focurve;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.time.Instant;
import java.util.*;
import org.junit.jupiter.api.Test;
import static org.assertj.core.api.Assertions.*;

class MemberHourlyStatisticsTest {
 final ObjectMapper json=new ObjectMapper();
 final Instant at=Instant.parse("2026-11-11T01:00:00.123Z");
 final MemberReadModel.Range range=new MemberReadModel.Range(Instant.parse("2026-11-10T15:00:00Z").toEpochMilli(),Instant.parse("2026-11-11T15:00:00Z").toEpochMilli());
 ObjectNode row(String id,String time,boolean repeat,String type,String quality){return json.createObjectNode().put("event_id",id).put("occurred_at",time).put("is_repeat",repeat).put("event_type",type).put("quality",quality);}
 @Test void emptyHoursStayUnknownWithoutCoverageOrInventedTime(){
  var values=MemberHourlyStatisticsApi.project(json,range,List.of(),at);assertThat(values.size()).isEqualTo(24);
  for(var value:values){assertThat(value.path("total_access").isNull()).isTrue();assertThat(value.path("repeat_ratio").isNull()).isTrue();assertThat(value.path("active_duration_ms").isNull()).isTrue();assertThat(value.path("quality").asText()).isEqualTo("NOT_COLLECTED");assertThat(value.path("as_of").asText()).isEqualTo(at.toString());}
 }
 @Test void koreaBoundaryAndExclusiveEndPreserveExistingRepeatFlags(){
  var values=MemberHourlyStatisticsApi.project(json,range,List.of(row("prior","2026-11-10T14:59:59.999Z",false,"RECORDED_ACCESS","COMPLETE"),row("first","2026-11-10T15:00:00Z",true,"RECORDED_ACCESS","COMPLETE"),row("second","2026-11-10T15:59:59.999Z",false,"BLOCKED_SITE_ACCESS","COMPLETE"),row("next","2026-11-11T15:00:00Z",true,"RECORDED_ACCESS","COMPLETE")),at);
  assertThat(values.get(0).path("total_access").asLong()).isEqualTo(2);assertThat(values.get(0).path("repeat_access").asLong()).isEqualTo(1);assertThat(values.get(0).path("repeat_ratio").asDouble()).isEqualTo(.5);assertThat(values.get(0).path("blocked_access").asLong()).isEqualTo(1);assertThat(values.get(0).path("quality").asText()).isEqualTo("PARTIAL");assertThat(values.get(23).path("total_access").isNull()).isTrue();
 }
 @Test void multipleDaysUseTheSameHourAndRetainReviewRequired(){
  var days=new MemberReadModel.Range(range.from(),range.to()+86400000);var values=MemberHourlyStatisticsApi.project(json,days,List.of(row("a","2026-11-11T01:00:00Z",false,"RECORDED_ACCESS","COMPLETE"),row("b","2026-11-12T01:00:00Z",true,"BLOCKED_FEATURE_ACCESS","REVIEW_REQUIRED")),at);
  assertThat(values.get(10).path("total_access").asLong()).isEqualTo(2);assertThat(values.get(10).path("quality").asText()).isEqualTo("REVIEW_REQUIRED");
 }
 @Test void duplicateReceiptsAndMalformedTimesCannotProducePartialSuccess(){
  var duplicate=row("same","2026-11-11T01:00:00Z",false,"RECORDED_ACCESS","COMPLETE");assertThatThrownBy(()->MemberHourlyStatisticsApi.project(json,range,List.of(duplicate,duplicate),at)).hasMessage("READ_UNCONFIRMED");
  assertThatThrownBy(()->MemberHourlyStatisticsApi.project(json,range,List.of(row("bad","invalid",false,"RECORDED_ACCESS","COMPLETE")),at)).isInstanceOf(java.time.DateTimeException.class);
 }
}
