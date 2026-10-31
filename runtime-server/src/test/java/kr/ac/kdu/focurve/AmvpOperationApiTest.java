package kr.ac.kdu.focurve;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.support.StaticListableBeanFactory;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
class AmvpOperationApiTest {
 @Test void missingAuthorityCannotBecomeAnOperationSuccess()throws Exception{
  var beans=new StaticListableBeanFactory();var auth=new AdditionalRestrictedChannelTest().authentication();
  var http=MockMvcBuilders.standaloneSetup(new AmvpOperationApi(auth,new AdditionalRestrictedChannelTest().transactions(),beans.getBeanProvider(AdditionalConfigStore.Admission.class))).build();
  http.perform(get("/api/v1/amvp/operations/00000000-0000-4000-8000-000000000001")).andExpect(status().isServiceUnavailable()).andExpect(jsonPath("$.error.code").value("CAPABILITY_NOT_VERIFIED"));
  http.perform(get("/api/v1/amvp/operations/00000000-0000-4000-8000-000000000001").param("confirmed","true")).andExpect(status().isBadRequest());
  http.perform(get("/api/v1/amvp/operations/00000000-0000-4000-8000-000000000001").contentType("application/json").content("{}")).andExpect(status().isBadRequest());
 }
}
