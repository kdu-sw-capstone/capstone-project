package kr.ac.kdu.focurve;

import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.support.StaticListableBeanFactory;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import static org.assertj.core.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class AmvpDailyUsageApiTest {
 @Test void absentAuthorityCannotBeEnabledByHttpQuery()throws Exception{
  var beans=new StaticListableBeanFactory();var auth=new AmvpRuntimeBridgeApiTest().auth(true);var tx=new AdditionalRestrictedChannelTest().transactions();
  var http=MockMvcBuilders.standaloneSetup(new AmvpDailyUsageApi(auth,tx,beans.getBeanProvider(AdditionalConfigStore.Admission.class))).build();
  http.perform(get("/api/v1/amvp/site-time-policies/00000000-0000-4000-8000-000000000001/usage").param("executor_id","00000000-0000-4000-8000-000000000001").param("date","2026-10-29")).andExpect(status().isServiceUnavailable()).andExpect(jsonPath("$.error.code").value("CAPABILITY_NOT_VERIFIED"));
 }
 @Test void usageDayQueryRejectsMissingRepeatedUnknownAndInvalidDates(){
  String id="00000000-0000-4000-8000-000000000001";assertThat(AmvpDailyUsage.Query.parse(Map.of("executor_id",new String[]{id},"date",new String[]{"2026-10-29"})).date().toString()).isEqualTo("2026-10-29");
  for(var q:java.util.List.of(Map.of("date",new String[]{"2026-10-29"}),Map.of("executor_id",new String[]{id},"date",new String[]{"2026-02-30"}),Map.of("executor_id",new String[]{id},"date",new String[]{"2026-10-29","2026-10-30"}),Map.of("executor_id",new String[]{id},"date",new String[]{"2026-10-29"},"unknown",new String[]{"true"})))assertThatThrownBy(()->AmvpDailyUsage.Query.parse(q)).isInstanceOf(MemberAuth.Failure.class);
 }
}
