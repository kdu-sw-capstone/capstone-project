package kr.ac.kdu.focurve;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.HttpServletRequest;
import java.util.Base64;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.support.StaticListableBeanFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class AmvpRuntimeBridgeApiTest {
 static final String EXECUTOR="00000000-0000-4000-8000-000000000001";
 MemberAuth auth(boolean bearer){return new MemberAuth(new JdbcTemplate(),new ObjectMapper(),"https://localhost:33339",Base64.getEncoder().encodeToString(new byte[32]),""){
  @Override Identity identity(HttpServletRequest request,boolean mutation){return new Identity(1,bearer?EXECUTOR:null);}
 };}
 MockMvc http(MemberAuth auth){var beans=new StaticListableBeanFactory();return MockMvcBuilders.standaloneSetup(new AmvpRuntimeBridgeApi(auth,new AdditionalRestrictedChannelTest().transactions(),beans.getBeanProvider(AmvpBridgeSupport.CapabilitySource.class),beans.getBeanProvider(AmvpUsageReceiver.ClockProof.class),beans.getBeanProvider(AmvpFocusAttachments.FrozenFocusProof.class))).build();}
 @Test void enabledTransportWithoutVerifiedProducerCannotPublishOrIngest()throws Exception{
  var http=http(auth(true));http.perform(get("/api/v1/amvp/runtime-packages/current").param("executor_id",EXECUTOR)).andExpect(status().isServiceUnavailable()).andExpect(jsonPath("$.error.code").value("CAPABILITY_NOT_VERIFIED"));
  http.perform(post("/api/v1/amvp/usage/batch").contentType("application/json").content("{}")).andExpect(status().isServiceUnavailable()).andExpect(jsonPath("$.error.code").value("CAPABILITY_NOT_VERIFIED"));
  http.perform(post("/api/v1/amvp/focus-attachments").contentType("application/json").content("{}")).andExpect(status().isServiceUnavailable()).andExpect(jsonPath("$.error.code").value("CAPABILITY_NOT_VERIFIED"));
 }
 @Test void webPrincipalCannotUseExecutorOnlyChannels()throws Exception{
  var http=http(auth(false));http.perform(get("/api/v1/amvp/runtime-packages/current").param("executor_id",EXECUTOR)).andExpect(status().isForbidden());http.perform(post("/api/v1/amvp/usage/batch").contentType("application/json").content("{}")).andExpect(status().isForbidden());
 }
 @Test void restrictedReauthenticationAndEndGrantsCannotUseNewTransport()throws Exception{
  for(boolean recovery:new boolean[]{true,false}){var auth=auth(true);if(recovery)auth.recoveryGrant="synthetic-test";else auth.preservedEndGrant="synthetic-test";var http=http(auth);
   http.perform(get("/api/v1/amvp/runtime-packages/current").param("executor_id",EXECUTOR)).andExpect(status().isServiceUnavailable()).andExpect(jsonPath("$.error.code").value("UNSUPPORTED_CONTRACT"));
   http.perform(post("/api/v1/amvp/usage/batch").contentType("application/json").content("{}")).andExpect(status().isServiceUnavailable()).andExpect(jsonPath("$.error.code").value("UNSUPPORTED_CONTRACT"));}
 }
 @Test void malformedDuplicateAndExtraTransportFieldsAreRejected()throws Exception{
  var http=http(auth(true));http.perform(post("/api/v1/amvp/usage/batch").contentType("application/json").content("{\"batch_id\":1,\"batch_id\":2}")).andExpect(status().isBadRequest());
  http.perform(get("/api/v1/amvp/runtime-packages/current").param("executor_id",EXECUTOR).param("owner_binding_id",EXECUTOR)).andExpect(status().isBadRequest());
 }
}
